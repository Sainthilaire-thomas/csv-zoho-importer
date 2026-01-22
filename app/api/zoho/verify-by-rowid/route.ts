/**
 * @file app/api/zoho/verify-by-rowid/route.ts
 * @description API pour vérification optimisée via RowID (tables volumineuses)
 * 
 * Actions supportées :
 * - getMax : Récupère MAX(RowID) de la table
 * - getAfter : Récupère les lignes avec RowID > minRowId
 * - getLatest : Récupère les N dernières lignes (ORDER BY RowID DESC)
 * 
 * @mission 012
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/infrastructure/supabase/server';
import { getTokens } from '@/lib/infrastructure/zoho/auth';

/**
 * Convertit le domaine API stocké en domaine Analytics
 */
function convertToAnalyticsDomain(apiDomain: string): string {
  if (apiDomain.includes('analyticsapi')) {
    return apiDomain.startsWith('https://') ? apiDomain : `https://${apiDomain}`;
  }
  const match = apiDomain.match(/zohoapis\.(\w+)/);
  const region = match ? match[1] : 'eu';
  return `https://analyticsapi.zoho.${region}`;
}

/**
 * Parse une réponse CSV de Zoho en tableau d'objets
 */
function parseZohoCSV(csvText: string): Record<string, string>[] {
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) return [];

  // Headers (première ligne)
  const headers = parseCSVLine(lines[0]);

  // Data (lignes suivantes)
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length === headers.length) {
      const row: Record<string, string> = {};
      headers.forEach((header, idx) => {
        row[header] = values[idx];
      });
      rows.push(row);
    }
  }

  return rows;
}

/**
 * Parse une ligne CSV en gérant les guillemets
 */
function parseCSVLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  values.push(current.trim());

  return values;
}

export async function GET(request: NextRequest) {
  try {
    // 1. Authentification
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const tokens = await getTokens(user.id);
    if (!tokens) {
      return NextResponse.json({ error: 'Non connecté à Zoho' }, { status: 401 });
    }

    // 2. Paramètres
    const searchParams = request.nextUrl.searchParams;
    const workspaceId = searchParams.get('workspaceId');
    const tableName = searchParams.get('tableName');
    const action = searchParams.get('action'); // 'getMax' | 'getAfter' | 'getLatest'
    const minRowId = searchParams.get('minRowId');
    const limit = searchParams.get('limit') || '10';

    if (!workspaceId || !tableName || !action) {
      return NextResponse.json(
        { error: 'Paramètres manquants: workspaceId, tableName, action' },
        { status: 400 }
      );
    }

    // 3. Construire la requête SQL selon l'action
    let sqlQuery: string;

    switch (action) {
      case 'getMax':
        sqlQuery = `SELECT MAX("RowID") as "maxRowId" FROM "${tableName}"`;
        break;

      case 'getAfter':
        if (!minRowId) {
          return NextResponse.json(
            { error: 'minRowId requis pour action getAfter' },
            { status: 400 }
          );
        }
        sqlQuery = `SELECT * FROM "${tableName}" WHERE "RowID" > ${minRowId} ORDER BY "RowID" ASC LIMIT ${limit}`;
        break;

      case 'getLatest':
        sqlQuery = `SELECT * FROM "${tableName}" ORDER BY "RowID" DESC LIMIT ${limit}`;
        break;

      default:
        return NextResponse.json(
          { error: `Action invalide: ${action}` },
          { status: 400 }
        );
    }

    console.log('[VerifyByRowID] SQL:', sqlQuery);

    // 4. Appeler l'API Zoho
    const apiDomain = convertToAnalyticsDomain(tokens.apiDomain);
    const config = {
      responseFormat: 'json',
      sqlQuery: sqlQuery,
    };
    const url = `${apiDomain}/restapi/v2/workspaces/${workspaceId}/data?CONFIG=${encodeURIComponent(JSON.stringify(config))}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Zoho-oauthtoken ${tokens.accessToken}`,
        'ZANALYTICS-ORGID': tokens.orgId || '',
      },
    });

    const responseText = await response.text();
    console.log('[VerifyByRowID] Status:', response.status);
    console.log('[VerifyByRowID] Response preview:', responseText.substring(0, 300));

    // 5. Parser la réponse
    let data: Record<string, string>[] = [];

    try {
      const jsonResponse = JSON.parse(responseText);

      // Erreur Zoho ?
      if (jsonResponse.status === 'failure') {
        console.error('[VerifyByRowID] Zoho error:', jsonResponse);
        return NextResponse.json({
          success: false,
          error: jsonResponse.data?.errorMessage || jsonResponse.summary || 'Erreur Zoho',
        }, { status: 400 });
      }

      // Données JSON
      if (Array.isArray(jsonResponse.data)) {
        data = jsonResponse.data;
      } else if (Array.isArray(jsonResponse)) {
        data = jsonResponse;
      } else if (jsonResponse.data) {
        data = [jsonResponse.data];
      }
    } catch {
      // Fallback CSV
      console.log('[VerifyByRowID] Parsing as CSV...');
      data = parseZohoCSV(responseText);
    }

    console.log('[VerifyByRowID] Success -', action, '- rows:', data.length);

    return NextResponse.json({
      success: true,
      action,
      data,
      rowCount: data.length,
    });

  } catch (error) {
    console.error('[VerifyByRowID] Exception:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Erreur inconnue',
    }, { status: 500 });
  }
}
