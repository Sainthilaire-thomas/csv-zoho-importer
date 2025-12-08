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
    const tableName = searchParams.get('table') || 'SC_PQS_2025';
    const filter = searchParams.get('filter') || '';
    const limit = searchParams.get('limit') || '10';

    // Construire la requête SQL
    let sqlQuery = `SELECT * FROM "${tableName}"`;
    if (filter) {
      sqlQuery += ` WHERE ${filter}`;
    }
    sqlQuery += ` LIMIT ${limit}`;

    const apiDomain = convertToAnalyticsDomain(tokens.apiDomain);
    
    // Méthode 1: Export direct avec SQL (peut ne pas marcher pour QueryTable)
    const config = {
      responseFormat: 'json',
      sqlQuery: sqlQuery,
    };
    
    const configEncoded = encodeURIComponent(JSON.stringify(config));
    const url = `${apiDomain}/restapi/v2/workspaces/${WORKSPACE_ID}/data?CONFIG=${configEncoded}`;

    console.log('[SQL Query] URL:', url);
    console.log('[SQL Query] SQL:', sqlQuery);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Zoho-oauthtoken ${tokens.accessToken}`,
        'ZANALYTICS-ORGID': tokens.orgId || '',
      },
    });

    const responseText = await response.text();
    console.log('[SQL Query] Status:', response.status);
    console.log('[SQL Query] Response:', responseText.substring(0, 500));

    let data;
    try {
      data = JSON.parse(responseText);
    } catch {
      // C'est peut-être du CSV
      data = { raw: responseText.substring(0, 2000) };
    }

    return NextResponse.json({
      success: response.ok,
      sqlQuery,
      status: response.status,
      data,
    });

  } catch (error) {
    console.error('Erreur:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
