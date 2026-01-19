/**
 * @file app/api/zoho/verify-data/route.ts
 * @description Récupère les données pour vérification post-import via Bulk API async
 * Fonctionne pour toutes les tailles de tables (contrairement à /api/zoho/data)
 * 
 * Sprint 4 - Mission 010
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/infrastructure/supabase/server';
import { getTokens } from '@/lib/infrastructure/zoho/auth';

function convertToAnalyticsDomain(apiDomain: string): string {
  if (apiDomain.includes('analyticsapi')) {
    return apiDomain.startsWith('https://') ? apiDomain : `https://${apiDomain}`;
  }
  const match = apiDomain.match(/zohoapis\.(\w+)/);
  const region = match ? match[1] : 'eu';
  return `https://analyticsapi.zoho.${region}`;
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function GET(request: NextRequest) {
  try {
    // 1. Auth
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const tokens = await getTokens(user.id);
    if (!tokens) {
      return NextResponse.json({ error: 'Non connecté à Zoho' }, { status: 401 });
    }

    // 2. Params
    const searchParams = request.nextUrl.searchParams;
    const workspaceId = searchParams.get('workspaceId');
    const tableName = searchParams.get('tableName');
    const matchingColumn = searchParams.get('matchingColumn');
    const matchingValuesParam = searchParams.get('matchingValues'); // JSON array
    const limit = searchParams.get('limit') || '100';

    if (!workspaceId || !tableName) {
      return NextResponse.json(
        { error: 'Paramètres manquants: workspaceId et tableName requis' },
        { status: 400 }
      );
    }

    const apiDomain = convertToAnalyticsDomain(tokens.apiDomain);
    const headers = {
      'Authorization': `Zoho-oauthtoken ${tokens.accessToken}`,
      'ZANALYTICS-ORGID': tokens.orgId || '',
    };

    // 3. Construire la requête SQL
    let sqlQuery: string;

    if (matchingColumn && matchingValuesParam) {
      // Avec critère de filtre (pour vérification post-import)
      try {
        const matchingValues: string[] = JSON.parse(matchingValuesParam);
        
        if (matchingValues.length === 0) {
          return NextResponse.json({ success: true, data: [], rowCount: 0 });
        }

        // Échapper les valeurs pour SQL
        const escapedValues = matchingValues
          .map(v => `'${String(v).trim().replace(/'/g, "''")}'`)
          .join(',');

        sqlQuery = `SELECT * FROM "${tableName}" WHERE "${matchingColumn}" IN (${escapedValues}) LIMIT ${limit}`;
      } catch {
        return NextResponse.json(
          { error: 'matchingValues doit être un tableau JSON valide' },
          { status: 400 }
        );
      }
    } else {
      // Sans critère (récupère les N premières lignes)
      sqlQuery = `SELECT * FROM "${tableName}" LIMIT ${limit}`;
    }

    console.log('[VerifyData] SQL Query:', sqlQuery);

    // 4. Créer le job d'export async
    const config = {
      responseFormat: 'json',
      sqlQuery: sqlQuery,
    };
    const configEncoded = encodeURIComponent(JSON.stringify(config));
    const createUrl = `${apiDomain}/restapi/v2/bulk/workspaces/${workspaceId}/data?CONFIG=${configEncoded}`;

    console.log('[VerifyData] Creating async job...');

    const createResponse = await fetch(createUrl, { method: 'GET', headers });
    const createData = await createResponse.json();

    if (!createResponse.ok || createData.status !== 'success' || !createData.data?.jobId) {
      console.error('[VerifyData] Failed to create job:', createData);
      return NextResponse.json(
        { success: false, error: 'Échec création job export', details: createData },
        { status: 500 }
      );
    }

    const jobId = createData.data.jobId;
    console.log('[VerifyData] Job created:', jobId);

    // 5. Poll jusqu'à completion (max 60s pour les requêtes avec filtre)
    let jobComplete = false;
    let downloadUrl = '';
    const maxPolls = 60;

    for (let i = 0; i < maxPolls; i++) {
      await sleep(1000);
      
      const statusUrl = `${apiDomain}/restapi/v2/bulk/workspaces/${workspaceId}/exportjobs/${jobId}`;
      const statusResponse = await fetch(statusUrl, { method: 'GET', headers });
      const statusData = await statusResponse.json();

      const jobCode = statusData.data?.jobCode;
      
      if (i % 5 === 0) {
        console.log('[VerifyData] Poll', i + 1, '- jobCode:', jobCode);
      }

      if (jobCode === '1004') {
        jobComplete = true;
        downloadUrl = statusData.data?.downloadUrl || '';
        break;
      }
      
      if (jobCode === '1003') {
        console.error('[VerifyData] Job failed:', statusData);
        return NextResponse.json(
          { success: false, error: 'Job export échoué', details: statusData },
          { status: 500 }
        );
      }
    }

    if (!jobComplete) {
      return NextResponse.json(
        { success: false, error: 'Timeout: job export trop long' },
        { status: 504 }
      );
    }

    // 6. Télécharger les données
    const dataUrl = downloadUrl || `${apiDomain}/restapi/v2/bulk/workspaces/${workspaceId}/exportjobs/${jobId}/data`;
    console.log('[VerifyData] Downloading data...');

    const dataResponse = await fetch(dataUrl, { method: 'GET', headers });
    const dataResult = await dataResponse.json();

    if (dataResult.data && Array.isArray(dataResult.data)) {
      console.log('[VerifyData] Success - got', dataResult.data.length, 'rows');
      return NextResponse.json({
        success: true,
        data: dataResult.data,
        rowCount: dataResult.data.length,
      });
    }

    return NextResponse.json({
      success: true,
      data: [],
      rowCount: 0,
    });

  } catch (error) {
    console.error('[VerifyData] Exception:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Erreur inconnue' },
      { status: 500 }
    );
  }
}
