/**
 * @file app/api/zoho/test-cloudsql/route.ts
 * @description Test de l'API v1 CloudSQL (synchrone)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/infrastructure/supabase/server';
import { getTokens } from '@/lib/infrastructure/zoho/auth';

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
    const workspaceName = searchParams.get('workspaceName') || 'RATP PV';
    const tableName = searchParams.get('tableName') || 'QUITTANCES2';
   const ownerEmail = searchParams.get('ownerEmail') || user.email;

    if (!ownerEmail) {
      return NextResponse.json({ error: 'Email non disponible' }, { status: 400 });
    }

    // 3. Construire la requête API v1 CloudSQL
    const sqlQuery = `SELECT "RowID" FROM "${tableName}" ORDER BY "RowID" DESC LIMIT 1`;
    
    // API v1 endpoint
    const apiDomain = 'https://analyticsapi.zoho.com';
    const url = `${apiDomain}/api/${encodeURIComponent(ownerEmail)}/${encodeURIComponent(workspaceName)}`;

    console.log('[TestCloudSQL] URL:', url);
    console.log('[TestCloudSQL] SQL:', sqlQuery);
    console.log('[TestCloudSQL] Email:', ownerEmail);

    const formData = new URLSearchParams();
    formData.append('ZOHO_ACTION', 'EXPORT');
    formData.append('ZOHO_OUTPUT_FORMAT', 'JSON');
    formData.append('ZOHO_ERROR_FORMAT', 'JSON');
    formData.append('ZOHO_API_VERSION', '1.0');
    formData.append('ZOHO_SQLQUERY', sqlQuery);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Zoho-oauthtoken ${tokens.accessToken}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    });

    const responseText = await response.text();
    console.log('[TestCloudSQL] Status:', response.status);
    console.log('[TestCloudSQL] Response:', responseText.substring(0, 1000));

    // Essayer de parser en JSON
    try {
      const data = JSON.parse(responseText);
      return NextResponse.json({
        success: true,
        status: response.status,
        data: data,
      });
    } catch {
      return NextResponse.json({
        success: false,
        status: response.status,
        rawResponse: responseText.substring(0, 2000),
      });
    }

  } catch (error) {
    console.error('[TestCloudSQL] Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Erreur inconnue',
    }, { status: 500 });
  }
}
