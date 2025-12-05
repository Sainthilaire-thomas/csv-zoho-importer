/**
 * @file app/api/zoho/delete/route.ts
 * @description API pour supprimer des données dans Zoho (rollback)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/infrastructure/supabase/server';
import { ZohoAnalyticsClient } from '@/lib/infrastructure/zoho/client';

export async function DELETE(request: NextRequest) {
  try {
    // Vérifier l'authentification
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Non authentifié' },
        { status: 401 }
      );
    }

    // Récupérer les paramètres
    const body = await request.json();
    const { workspaceId, viewId, matchingColumn, matchingValues } = body;

    if (!workspaceId || !viewId || !matchingColumn || !matchingValues?.length) {
      return NextResponse.json(
        { error: 'Paramètres manquants: workspaceId, viewId, matchingColumn, matchingValues requis' },
        { status: 400 }
      );
    }

    // Créer le client Zoho
    const client = await ZohoAnalyticsClient.forUser(user.id);

    if (!client) {
      return NextResponse.json(
        { error: 'Connexion Zoho requise' },
        { status: 401 }
      );
    }

    // Construire le critère SQL
    const criteria = ZohoAnalyticsClient.buildInCriteria(matchingColumn, matchingValues);

    console.log('[API Delete] Deleting with criteria:', criteria);

    // Exécuter la suppression
    const result = await client.deleteData(workspaceId, viewId, criteria);

    return NextResponse.json({
      success: true,
      deletedRows: result.deletedRows,
      criteria,
    });

  } catch (error) {
    console.error('[API Delete] Error:', error);

    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Erreur lors de la suppression',
        success: false,
      },
      { status: 500 }
    );
  }
}
