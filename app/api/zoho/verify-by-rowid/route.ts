/**
 * @file app/api/zoho/verify-by-rowid/route.ts
 * @description API pour récupérer le MAX RowID et vérification via RowID
 *
 * Actions supportées :
 * - getLastRowId : Récupère le dernier RowID via API v1 CloudSQL (SYNCHRONE ~2s)
 * - getAfter : Récupère les lignes avec RowID > minRowId (Bulk Async)
 * - getMaxAfter : Récupère le MAX(RowID) après un minRowId (Bulk Async)
 *
 * @mission 012, 013
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
 * Attend la fin d'un job async et récupère les données (pour getAfter et getMaxAfter)
 */
async function waitForJobAndDownload(
  apiDomain: string,
  workspaceId: string,
  jobId: string,
  headers: Record<string, string>,
  maxPolls: number = 10,
  pollInterval: number = 500
): Promise<{ success: boolean; data?: Record<string, string>[]; error?: string }> {

  for (let poll = 1; poll <= maxPolls; poll++) {
    console.log(`[VerifyByRowID] Poll ${poll}/${maxPolls} - checking job status...`);

    const statusUrl = `${apiDomain}/restapi/v2/bulk/workspaces/${workspaceId}/exportjobs/${jobId}`;
    const statusResponse = await fetch(statusUrl, { method: 'GET', headers });
    const statusData = await statusResponse.json();

    const jobCode = statusData.data?.jobCode;
    console.log(`[VerifyByRowID] Poll ${poll} - jobCode: ${jobCode}`);

    if (jobCode === 1004 || jobCode === '1004') {
      console.log('[VerifyByRowID] Job completed, downloading data...');
      const downloadUrl = `${apiDomain}/restapi/v2/bulk/workspaces/${workspaceId}/exportjobs/${jobId}/data`;
      const downloadResponse = await fetch(downloadUrl, { method: 'GET', headers });
      const csvText = await downloadResponse.text();

      const data = parseZohoCSV(csvText);
      console.log('[VerifyByRowID] Downloaded', data.length, 'rows');
      return { success: true, data };
    }

    if (jobCode === 1003 || jobCode === '1003') {
      return { success: false, error: `Job failed with code ${jobCode}` };
    }

    await new Promise(resolve => setTimeout(resolve, pollInterval));
  }

  return { success: false, error: 'Job timeout after ' + maxPolls + ' polls' };
}

/**
 * Récupère le dernier RowID via API v1 CloudSQL (SYNCHRONE)
 * Cette méthode est rapide (~2s) car elle n'utilise pas de job async
 */
async function getLastRowIdSync(
  apiDomain: string,
  workspaceName: string,
  tableName: string,
  ownerEmail: string,
  accessToken: string
): Promise<{ success: boolean; maxRowId?: number; error?: string }> {
  
  const sqlQuery = `SELECT "RowID" FROM "${tableName}" ORDER BY "RowID" DESC LIMIT 1`;
  
  // API v1 CloudSQL endpoint
  const url = `${apiDomain}/api/${encodeURIComponent(ownerEmail)}/${encodeURIComponent(workspaceName)}`;

  console.log('[VerifyByRowID] CloudSQL URL:', url);
  console.log('[VerifyByRowID] CloudSQL SQL:', sqlQuery);

  const formData = new URLSearchParams();
  formData.append('ZOHO_ACTION', 'EXPORT');
  formData.append('ZOHO_OUTPUT_FORMAT', 'JSON');
  formData.append('ZOHO_ERROR_FORMAT', 'JSON');
  formData.append('ZOHO_API_VERSION', '1.0');
  formData.append('ZOHO_SQLQUERY', sqlQuery);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Zoho-oauthtoken ${accessToken}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: formData.toString(),
  });

  const responseText = await response.text();
  console.log('[VerifyByRowID] CloudSQL status:', response.status);

  if (!response.ok) {
    console.error('[VerifyByRowID] CloudSQL error:', responseText.substring(0, 500));
    return { success: false, error: `CloudSQL error: ${response.status}` };
  }

  try {
    const data = JSON.parse(responseText);
    
    // Format: { "response": { "result": { "rows": [["3122445"]] } } }
    const rows = data?.response?.result?.rows;
    if (Array.isArray(rows) && rows.length > 0 && rows[0].length > 0) {
      const rowId = parseInt(rows[0][0], 10);
      if (!isNaN(rowId)) {
        console.log('[VerifyByRowID] CloudSQL success - maxRowId:', rowId);
        return { success: true, maxRowId: rowId };
      }
    }

    // Vérifier s'il y a une erreur
    if (data?.response?.error) {
      console.error('[VerifyByRowID] CloudSQL API error:', data.response.error);
      return { success: false, error: data.response.error.message || 'API error' };
    }

    console.error('[VerifyByRowID] Unexpected response format:', JSON.stringify(data).substring(0, 300));
    return { success: false, error: 'Format de réponse inattendu' };

  } catch (parseError) {
    console.error('[VerifyByRowID] JSON parse error:', parseError);
    return { success: false, error: 'Erreur parsing JSON' };
  }
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
    const workspaceName = searchParams.get('workspaceName');
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

    // 3. Validation de l'action
    const validActions = ['getLastRowId', 'getAfter', 'getMaxAfter'];
    if (!validActions.includes(action)) {
      return NextResponse.json(
        { error: `Action invalide: ${action}. Actions supportées: ${validActions.join(', ')}` },
        { status: 400 }
      );
    }

    const apiDomain = convertToAnalyticsDomain(tokens.apiDomain);

    // ========== ACTION getLastRowId : API v1 CloudSQL (SYNCHRONE) ==========
    if (action === 'getLastRowId') {
      if (!workspaceName) {
        return NextResponse.json(
          { error: 'workspaceName requis pour getLastRowId' },
          { status: 400 }
        );
      }

      // Utiliser l'email Zoho stocké lors de l'OAuth
      const ownerEmail = tokens.zohoEmail;
      if (!ownerEmail) {
        return NextResponse.json(
          { error: 'Email Zoho non disponible. Reconnectez-vous à Zoho.' },
          { status: 400 }
        );
      }

      console.log('[VerifyByRowID] Using Zoho email:', ownerEmail);

      const result = await getLastRowIdSync(
        apiDomain,
        workspaceName,
        tableName,
        ownerEmail,
        tokens.accessToken
      );

      if (result.success) {
        return NextResponse.json({
          success: true,
          action: 'getLastRowId',
          maxRowId: result.maxRowId,
        });
      } else {
        return NextResponse.json({
          success: false,
          error: result.error,
        }, { status: 500 });
      }
    }

    // ========== ACTIONS getAfter et getMaxAfter : API Bulk Async ==========
    const headers = {
      'Authorization': `Zoho-oauthtoken ${tokens.accessToken}`,
      'ZANALYTICS-ORGID': tokens.orgId || '',
    };

    let sqlQuery: string;
    let maxPolls = 10;

    if (action === 'getMaxAfter') {
      if (!minRowId) {
        return NextResponse.json({ error: 'minRowId requis pour getMaxAfter' }, { status: 400 });
      }
      sqlQuery = `SELECT MAX("RowID") as max_rowid FROM "${tableName}" WHERE "RowID" > ${minRowId}`;
      console.log('[VerifyByRowID] SQL (getMaxAfter):', sqlQuery);
      maxPolls = 15;
    } else {
      // getAfter
      if (!minRowId) {
        return NextResponse.json({ error: 'minRowId requis pour getAfter' }, { status: 400 });
      }
      sqlQuery = `SELECT * FROM "${tableName}" WHERE "RowID" > ${minRowId} ORDER BY "RowID" ASC LIMIT ${limit}`;
      console.log('[VerifyByRowID] SQL (getAfter):', sqlQuery);
    }

    // Créer job async
    const jobConfig = { responseFormat: 'csv', sqlQuery };
    const configEncoded = encodeURIComponent(JSON.stringify(jobConfig));
    const createJobUrl = `${apiDomain}/restapi/v2/bulk/workspaces/${workspaceId}/data?CONFIG=${configEncoded}`;

    console.log('[VerifyByRowID] Creating async job...');
    const createResponse = await fetch(createJobUrl, { method: 'GET', headers });
    const createResult = await createResponse.json();

    if (createResult.status === 'failure' || !createResult.data?.jobId) {
      console.error('[VerifyByRowID] Failed to create job:', createResult);
      return NextResponse.json({
        success: false,
        error: createResult.data?.errorMessage || 'Failed to create export job',
      }, { status: 400 });
    }

    const jobId = createResult.data.jobId;
    console.log('[VerifyByRowID] Job created:', jobId);

    const result = await waitForJobAndDownload(apiDomain, workspaceId, jobId, headers, maxPolls, 500);

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 500 });
    }

    if (action === 'getMaxAfter') {
      const maxRowId = result.data?.[0]?.max_rowid;
      const maxRowIdNumber = maxRowId ? parseInt(maxRowId, 10) : null;
      console.log('[VerifyByRowID] Success - getMaxAfter:', maxRowIdNumber);
      return NextResponse.json({ success: true, action: 'getMaxAfter', maxRowId: maxRowIdNumber });
    }

    // getAfter
    console.log('[VerifyByRowID] Success - getAfter - rows:', result.data?.length);
    return NextResponse.json({ success: true, action: 'getAfter', data: result.data, rowCount: result.data?.length || 0 });

  } catch (error) {
    console.error('[VerifyByRowID] Exception:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Erreur inconnue',
    }, { status: 500 });
  }
}
