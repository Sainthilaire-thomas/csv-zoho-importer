import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/infrastructure/supabase/server';
import { getTokens } from '@/lib/infrastructure/zoho/auth';

const WORKSPACE_ID = '1718953000016707052';

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
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const tokens = await getTokens(user.id);
    if (!tokens) {
      return NextResponse.json({ error: 'Non connecté à Zoho' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const viewId = searchParams.get('viewId') || '1718953000032998801';
    const filter = searchParams.get('filter');
    const action = searchParams.get('action') || 'full'; // full, create, status, download

    const apiDomain = convertToAnalyticsDomain(tokens.apiDomain);
    const headers: Record<string, string> = {
      'Authorization': `Zoho-oauthtoken ${tokens.accessToken}`,
      'ZANALYTICS-ORGID': tokens.orgId || '',
    };

    // Mode debug: tester chaque étape séparément
    if (action === 'create') {
      // Créer le job avec POST
      const config: Record<string, string> = { responseFormat: 'json' };
      if (filter) config.criteria = filter;
      
      const url = `${apiDomain}/restapi/v2/bulk/workspaces/${WORKSPACE_ID}/views/${viewId}/data`;
      console.log('[AsyncExport] Create URL:', url);
      console.log('[AsyncExport] Config:', JSON.stringify(config));

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `CONFIG=${encodeURIComponent(JSON.stringify(config))}`,
      });

      const data = await response.json();
      return NextResponse.json({ action: 'create', status: response.status, data });
    }

    if (action === 'status') {
      const jobId = searchParams.get('jobId');
      if (!jobId) return NextResponse.json({ error: 'jobId requis' }, { status: 400 });

      const url = `${apiDomain}/restapi/v2/bulk/workspaces/${WORKSPACE_ID}/exportjobs/${jobId}`;
      const response = await fetch(url, { method: 'GET', headers });
      const data = await response.json();
      return NextResponse.json({ action: 'status', data });
    }

    if (action === 'download') {
      const jobId = searchParams.get('jobId');
      if (!jobId) return NextResponse.json({ error: 'jobId requis' }, { status: 400 });

      const url = `${apiDomain}/restapi/v2/bulk/workspaces/${WORKSPACE_ID}/exportjobs/${jobId}/data`;
      const response = await fetch(url, { method: 'GET', headers });
      
      const contentType = response.headers.get('content-type');
      let data;
      if (contentType?.includes('json')) {
        data = await response.json();
      } else {
        data = { raw: (await response.text()).substring(0, 5000) };
      }
      return NextResponse.json({ action: 'download', contentType, data });
    }

    // === MODE FULL: tout en un ===
    
    // Étape 1: Créer le job (essayer GET d'abord, puis POST si échec)
    const config: Record<string, string> = { responseFormat: 'json' };
    if (filter) config.criteria = filter;
    const configEncoded = encodeURIComponent(JSON.stringify(config));
    
    // Essayer avec GET (comme dans la doc Zoho pour bulk export)
    let createUrl = `${apiDomain}/restapi/v2/bulk/workspaces/${WORKSPACE_ID}/views/${viewId}/data?CONFIG=${configEncoded}`;
    console.log('[AsyncExport] Create job (GET):', createUrl);
    
    let createResponse = await fetch(createUrl, { method: 'GET', headers });
    let createData = await createResponse.json();
    
    console.log('[AsyncExport] Create response:', JSON.stringify(createData));

    if (createData.status !== 'success' || !createData.data?.jobId) {
      return NextResponse.json({ success: false, step: 'create', error: createData });
    }

    const jobId = createData.data.jobId;

    // Étape 2: Poll (augmenter le délai entre les polls)
    let jobStatus = null;
    let attempts = 0;
    const maxAttempts = 60;

    while (attempts < maxAttempts) {
      await sleep(2000); // 2 secondes entre chaque poll
      attempts++;

      const statusUrl = `${apiDomain}/restapi/v2/bulk/workspaces/${WORKSPACE_ID}/exportjobs/${jobId}`;
      const statusResponse = await fetch(statusUrl, { method: 'GET', headers });
      jobStatus = await statusResponse.json();

      const code = jobStatus.data?.jobCode;
      console.log(`[AsyncExport] Poll ${attempts}: code=${code}, status=${jobStatus.data?.jobStatus}`);

      if (code === '1004' || code === 1004) {
        break; // Terminé !
      }
      if (code === '1003' || code === 1003) {
        return NextResponse.json({ success: false, step: 'failed', error: jobStatus });
      }
    }

    if (attempts >= maxAttempts) {
      return NextResponse.json({ 
        success: false, 
        step: 'timeout',
        jobId,
        attempts,
        lastStatus: jobStatus 
      });
    }

    // Étape 3: Télécharger
    const downloadUrl = `${apiDomain}/restapi/v2/bulk/workspaces/${WORKSPACE_ID}/exportjobs/${jobId}/data`;
    const downloadResponse = await fetch(downloadUrl, { method: 'GET', headers });
    
    const contentType = downloadResponse.headers.get('content-type');
    let data;
    if (contentType?.includes('json')) {
      data = await downloadResponse.json();
    } else {
      data = { raw: (await downloadResponse.text()).substring(0, 5000), format: contentType };
    }

    return NextResponse.json({
      success: true,
      jobId,
      attempts,
      data,
    });

  } catch (error) {
    console.error('[AsyncExport] Error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
