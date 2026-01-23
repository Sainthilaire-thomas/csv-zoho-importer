/**
 * @file app/api/zoho/verify-by-rowid/route.ts
 * @description API pour vérification post-import via RowID (tables volumineuses)
 *
 * Utilise l'API Bulk async de Zoho pour supporter les grosses tables (2M+ lignes)
 *
 * Action supportée :
 * - getAfter : Récupère les lignes avec RowID > minRowId
 *
 * Actions supprimées :
 * - getMax : timeout sur grosses tables (remplacé par probe-service)
 * - getLatest : non utilisé
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

  const headers = parseCSVLine(lines[0]);
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

/**
 * Attend la fin d'un job async et récupère les données
 */
async function waitForJobAndDownload(
  apiDomain: string,
  workspaceId: string,
  jobId: string,
  headers: Record<string, string>,
  maxPolls: number = 30,
  pollInterval: number = 1000
): Promise<{ success: boolean; data?: Record<string, string>[]; error?: string }> {
  
  for (let poll = 1; poll <= maxPolls; poll++) {
    console.log(`[VerifyByRowID] Poll ${poll} - checking job status...`);
    
    const statusUrl = `${apiDomain}/restapi/v2/bulk/workspaces/${workspaceId}/exportjobs/${jobId}`;
    const statusResponse = await fetch(statusUrl, { method: 'GET', headers });
    const statusData = await statusResponse.json();
    
    const jobCode = statusData.data?.jobCode;
    console.log(`[VerifyByRowID] Poll ${poll} - jobCode: ${jobCode}`);
    
    if (jobCode === 3010) {
      // Job completed - download data
      console.log('[VerifyByRowID] Job completed, downloading data...');
      const downloadUrl = `${apiDomain}/restapi/v2/bulk/workspaces/${workspaceId}/exportjobs/${jobId}/data`;
      const downloadResponse = await fetch(downloadUrl, { method: 'GET', headers });
      const csvText = await downloadResponse.text();
      
      const data = parseZohoCSV(csvText);
      console.log('[VerifyByRowID] Downloaded', data.length, 'rows');
      return { success: true, data };
    }
    
    if (jobCode === 3011 || jobCode === 3012) {
      // Job failed
      return { success: false, error: `Job failed with code ${jobCode}` };
    }
    
    // Job still running (1001, 1004, etc.) - wait and retry
    await new Promise(resolve => setTimeout(resolve, pollInterval));
  }
  
  return { success: false, error: 'Job timeout after ' + maxPolls + ' polls' };
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
    const action = searchParams.get('action');
    const minRowId = searchParams.get('minRowId');
    const limit = searchParams.get('limit') || '10';

    if (!workspaceId || !tableName || !action) {
      return NextResponse.json(
        { error: 'Paramètres manquants: workspaceId, tableName, action' },
        { status: 400 }
      );
    }

    // 3. Seule action supportée : getAfter
    if (action !== 'getAfter') {
      return NextResponse.json(
        { error: `Action invalide: ${action}. Seule 'getAfter' est supportée.` },
        { status: 400 }
      );
    }

    if (!minRowId) {
      return NextResponse.json(
        { error: 'minRowId requis pour action getAfter' },
        { status: 400 }
      );
    }

    const sqlQuery = `SELECT * FROM "${tableName}" WHERE "RowID" > ${minRowId} ORDER BY "RowID" ASC LIMIT ${limit}`;
    console.log('[VerifyByRowID] SQL:', sqlQuery);

    const apiDomain = convertToAnalyticsDomain(tokens.apiDomain);
    const headers = {
      'Authorization': `Zoho-oauthtoken ${tokens.accessToken}`,
      'ZANALYTICS-ORGID': tokens.orgId || '',
    };

    // 4. Créer un job d'export async (pour supporter les grosses tables)
    const jobConfig = {
      responseFormat: 'csv',
      sqlQuery: sqlQuery,
    };
    const configEncoded = encodeURIComponent(JSON.stringify(jobConfig));
    const createJobUrl = `${apiDomain}/restapi/v2/bulk/workspaces/${workspaceId}/data?CONFIG=${configEncoded}`;

    console.log('[VerifyByRowID] Creating async job...');

    const createResponse = await fetch(createJobUrl, {
      method: 'GET',
      headers,
    });

    const createResult = await createResponse.json();
    
    if (createResult.status === 'failure') {
      console.error('[VerifyByRowID] Failed to create job:', createResult);
      return NextResponse.json({
        success: false,
        error: createResult.data?.errorMessage || createResult.summary || 'Failed to create export job',
      }, { status: 400 });
    }

    const jobId = createResult.data?.jobId;
    if (!jobId) {
      console.error('[VerifyByRowID] No jobId in response:', createResult);
      return NextResponse.json({
        success: false,
        error: 'No jobId returned from Zoho',
      }, { status: 500 });
    }

    console.log('[VerifyByRowID] Job created:', jobId);

    // 5. Attendre et télécharger les résultats
    const result = await waitForJobAndDownload(
      apiDomain,
      workspaceId,
      jobId,
      headers,
      30,  // max polls
      500  // poll interval (rapide car c'est une petite requête)
    );

    if (!result.success) {
      return NextResponse.json({
        success: false,
        error: result.error,
      }, { status: 500 });
    }

    console.log('[VerifyByRowID] Success - getAfter - rows:', result.data?.length);

    return NextResponse.json({
      success: true,
      action: 'getAfter',
      data: result.data,
      rowCount: result.data?.length || 0,
    });

  } catch (error) {
    console.error('[VerifyByRowID] Exception:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Erreur inconnue',
    }, { status: 500 });
  }
}
