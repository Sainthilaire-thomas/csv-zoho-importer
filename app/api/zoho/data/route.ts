/**
 * @file app/api/zoho/data/route.ts
 * @description Lecture de données depuis Zoho Analytics
 *
 * GET /api/zoho/data
 * Query params:
 *   - workspaceId: string (requis)
 *   - viewId: string (requis)
 *   - criteria: string (optionnel) - Critère SQL pour filtrer
 *   - columns: string (optionnel) - Colonnes à récupérer (séparées par virgules)
 *   - limit: number (optionnel) - Nombre max de lignes
 *
 * Utilisé pour la vérification post-import
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/infrastructure/supabase/server';
import {
  ZohoAnalyticsClient,
  ZohoAuthError,
} from '@/lib/infrastructure/zoho';

export async function GET(request: NextRequest) {
  try {
    // 1. Vérifier l'authentification Supabase
    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json(
        { error: 'Non authentifié' },
        { status: 401 }
      );
    }

    // 2. Récupérer les paramètres
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspaceId');
    const viewId = searchParams.get('viewId');
    const criteria = searchParams.get('criteria');
    const columnsParam = searchParams.get('columns');
    const limitParam = searchParams.get('limit');

    // 3. Valider les paramètres requis
    if (!workspaceId || !viewId) {
      return NextResponse.json(
        { error: 'Paramètres manquants: workspaceId et viewId requis' },
        { status: 400 }
      );
    }

    // 4. Parser les paramètres optionnels
    const selectedColumns = columnsParam 
      ? columnsParam.split(',').map(c => c.trim()).filter(Boolean)
      : undefined;
    
    const limit = limitParam ? parseInt(limitParam, 10) : undefined;

    // 5. Créer le client Zoho
    const client = await ZohoAnalyticsClient.forUser(session.user.id);

    if (!client) {
      return NextResponse.json(
        { error: 'Non connecté à Zoho', needsConnection: true },
        { status: 403 }
      );
    }

    // 6. Récupérer les données
    const result = await client.exportData(workspaceId, viewId, {
      criteria: criteria || undefined,
      selectedColumns,
      limit,
    });

    // 7. Retourner les données
    return NextResponse.json({
      success: true,
      data: result.data,
      rowCount: result.rowCount,
    });

  } catch (error) {
    console.error('Erreur lecture données Zoho:', error);

    // Erreur d'authentification Zoho
    if (error instanceof ZohoAuthError && error.needsReauthorization) {
      return NextResponse.json(
        { error: 'Session Zoho expirée', needsReauthorization: true },
        { status: 401 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur lors de la lecture des données'
      },
      { status: 500 }
    );
  }
}
