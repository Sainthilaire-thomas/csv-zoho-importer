/**
 * @file app/api/zoho/sample-row/route.ts
 * @description Récupère une ligne d'exemple via SQL Query async (bulk API)
 * Fonctionne pour toutes les tailles de tables
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
    const viewId = searchParams.get('viewId');
    const tableName = searchParams.get('tableName');

    if (!workspaceId || (!viewId && !tableName)) {
      return NextResponse.json(
        { error: 'Paramètres manquants: workspaceId et (viewId ou tableName) requis' },
        { status: 400 }
      );
    }

    const apiDomain = convertToAnalyticsDomain(tokens.apiDomain);
    const headers = {
      'Authorization': `Zoho-oauthtoken ${tokens.accessToken}`,
      'ZANALYTICS-ORGID': tokens.orgId || '',
    };

    // 3. Si on a tableName, utiliser SQL Query async
    if (tableName) {
      const sqlQuery = `SELECT * FROM "${tableName}" LIMIT 1`;
      const config = {
        responseFormat: 'json',
        sqlQuery: sqlQuery,
      };
      const configEncoded = encodeURIComponent(JSON.stringify(config));
      
      // Créer le job d'export async
      const createUrl = `${apiDomain}/restapi/v2/bulk/workspaces/${workspaceId}/data?CONFIG=${configEncoded}`;
      console.log('[SampleRow] Creating async job with SQL:', sqlQuery);
      
      const createResponse = await fetch(createUrl, { method: 'GET', headers });
      const createData = await createResponse.json();
      
      if (!createResponse.ok || createData.status !== 'success' || !createData.data?.jobId) {
        console.error('[SampleRow] Failed to create job:', createData);
        return NextResponse.json({ success: false, error: 'Échec création job', details: createData }, { status: 500 });
      }
      
      const jobId = createData.data.jobId;
      console.log('[SampleRow] Job created:', jobId);
      
      // Poll jusqu'à completion (max 30s)
      let jobComplete = false;
      let downloadUrl = '';
      for (let i = 0; i < 30; i++) {
        await sleep(1000);
        const statusUrl = `${apiDomain}/restapi/v2/bulk/workspaces/${workspaceId}/exportjobs/${jobId}`;
        const statusResponse = await fetch(statusUrl, { method: 'GET', headers });
        const statusData = await statusResponse.json();
        
        const jobCode = statusData.data?.jobCode;
        console.log('[SampleRow] Poll', i + 1, '- jobCode:', jobCode);
        
        if (jobCode === '1004') {
          jobComplete = true;
          downloadUrl = statusData.data?.downloadUrl || '';
          break;
        }
        if (jobCode === '1003') {
          return NextResponse.json({ success: false, error: 'Job échoué' }, { status: 500 });
        }
      }
      
      if (!jobComplete) {
        return NextResponse.json({ success: false, error: 'Timeout job' }, { status: 504 });
      }
      
      // Télécharger les données
      console.log('[SampleRow] Downloading from:', downloadUrl);
      const dataResponse = await fetch(downloadUrl || `${apiDomain}/restapi/v2/bulk/workspaces/${workspaceId}/exportjobs/${jobId}/data`, {
        method: 'GET',
        headers,
      });
      const dataResult = await dataResponse.json();
      
      // Extraire la première ligne
      if (dataResult.data && Array.isArray(dataResult.data) && dataResult.data.length > 0) {
        console.log('[SampleRow] Success - got row');
        return NextResponse.json({ success: true, data: dataResult.data[0] });
      }
      
      return NextResponse.json({ success: true, data: null });
    }

    // 4. Si on a viewId, utiliser l'export async par viewId
    const config = { responseFormat: 'json' };
    const configEncoded = encodeURIComponent(JSON.stringify(config));
    const createUrl = `${apiDomain}/restapi/v2/bulk/workspaces/${workspaceId}/views/${viewId}/data?CONFIG=${configEncoded}`;
    
    console.log('[SampleRow] Creating async job for viewId:', viewId);
    const createResponse = await fetch(createUrl, { method: 'GET', headers });
    const createData = await createResponse.json();
    
    if (!createResponse.ok || createData.status !== 'success' || !createData.data?.jobId) {
      console.error('[SampleRow] Failed to create job:', createData);
      return NextResponse.json({ success: false, error: 'Échec création job', details: createData }, { status: 500 });
    }
    
    const jobId = createData.data.jobId;
    console.log('[SampleRow] Job created:', jobId);
    
    // Poll
    let jobComplete = false;
    for (let i = 0; i < 30; i++) {
      await sleep(1000);
      const statusUrl = `${apiDomain}/restapi/v2/bulk/workspaces/${workspaceId}/exportjobs/${jobId}`;
      const statusResponse = await fetch(statusUrl, { method: 'GET', headers });
      const statusData = await statusResponse.json();
      
      const jobCode = statusData.data?.jobCode;
      console.log('[SampleRow] Poll', i + 1, '- jobCode:', jobCode);
      
      if (jobCode === '1004') {
        jobComplete = true;
        break;
      }
      if (jobCode === '1003') {
        return NextResponse.json({ success: false, error: 'Job échoué' }, { status: 500 });
      }
    }
    
    if (!jobComplete) {
      return NextResponse.json({ success: false, error: 'Timeout job' }, { status: 504 });
    }
    
    // Télécharger
    const dataUrl = `${apiDomain}/restapi/v2/bulk/workspaces/${workspaceId}/exportjobs/${jobId}/data`;
    const dataResponse = await fetch(dataUrl, { method: 'GET', headers });
    const dataResult = await dataResponse.json();
    
    if (dataResult.data && Array.isArray(dataResult.data) && dataResult.data.length > 0) {
      console.log('[SampleRow] Success - returning first row of', dataResult.data.length);
      return NextResponse.json({ success: true, data: dataResult.data[0] });
    }
    
    return NextResponse.json({ success: true, data: null });

  } catch (error) {
    console.error('[SampleRow] Exception:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Erreur inconnue' },
      { status: 500 }
    );
  }
}
