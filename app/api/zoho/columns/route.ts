/**
 * @file app/api/zoho/columns/route.ts
 * @description API pour récupérer les colonnes d'une table Zoho
 * 
 * GET /api/zoho/columns?workspaceId=xxx&viewId=yyy
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/infrastructure/supabase/server';
import { ZohoAnalyticsClient } from '@/lib/infrastructure/zoho/client';

export async function GET(request: NextRequest) {
  try {
    // 1. Vérifier l'authentification
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Non authentifié' },
        { status: 401 }
      );
    }

    // 2. Récupérer les paramètres
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspaceId');
    const viewId = searchParams.get('viewId');

    if (!workspaceId || !viewId) {
      return NextResponse.json(
        { error: 'workspaceId et viewId sont requis' },
        { status: 400 }
      );
    }

    // 3. Créer le client Zoho
    const client = await ZohoAnalyticsClient.forUser(user.id);
    
    if (!client) {
      return NextResponse.json(
        { error: 'Compte Zoho non connecté' },
        { status: 401 }
      );
    }

    // 4. Récupérer les colonnes
    console.log(`[API /zoho/columns] Fetching columns for workspace=${workspaceId}, view=${viewId}`);
    
    const columns = await client.getColumns(workspaceId, viewId);

    console.log(`[API /zoho/columns] Found ${columns.length} columns`);

    return NextResponse.json({
      success: true,
      viewId,
      workspaceId,
      columns,
      totalColumns: columns.length,
    });

  } catch (error) {
    console.error('[API /zoho/columns] Error:', error);
    
    const message = error instanceof Error ? error.message : 'Erreur inconnue';
    
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des colonnes', details: message },
      { status: 500 }
    );
  }
}
