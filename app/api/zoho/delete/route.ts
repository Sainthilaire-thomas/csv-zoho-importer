/**
 * @file app/api/zoho/delete/route.ts
 * @description API pour supprimer des données dans Zoho (rollback)
 * 
 * Mission 012 : Support dual stratégie matching_key et RowID
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
    const { 
      workspaceId, 
      viewId,
      // Stratégie matching_key
      matchingColumn, 
      matchingValues,
      // Stratégie rowid
      rowIdRange,
      rowIds,
    } = body;

    if (!workspaceId || !viewId) {
      return NextResponse.json(
        { error: 'Paramètres manquants: workspaceId et viewId requis' },
        { status: 400 }
      );
    }

    // Construire le critère SQL selon la stratégie
    let criteria: string;
    let strategyUsed: string;

    if (rowIdRange) {
      // ─────────────────────────────────────────────────────────────────────
      // Stratégie RowID range : DELETE WHERE "RowID" > min [AND "RowID" <= max]
      // ─────────────────────────────────────────────────────────────────────
      if (rowIdRange.max !== undefined) {
        criteria = `"RowID" > ${rowIdRange.min} AND "RowID" <= ${rowIdRange.max}`;
      } else {
        criteria = `"RowID" > ${rowIdRange.min}`;
      }
      strategyUsed = 'rowid_range';
      console.log('[API Delete] Strategy: rowid_range');
      console.log('[API Delete] Criteria:', criteria);

    } else if (rowIds && rowIds.length > 0) {
      // ─────────────────────────────────────────────────────────────────────
      // Stratégie RowID list : DELETE WHERE "RowID" IN (...)
      // ─────────────────────────────────────────────────────────────────────
      criteria = `"RowID" IN (${rowIds.join(',')})`;
      strategyUsed = 'rowid_list';
      console.log('[API Delete] Strategy: rowid_list');
      console.log('[API Delete] Criteria:', criteria);

    } else if (matchingColumn && matchingValues?.length) {
      // ─────────────────────────────────────────────────────────────────────
      // Stratégie matching_key : DELETE WHERE "column" IN ('val1', 'val2', ...)
      // ─────────────────────────────────────────────────────────────────────
      criteria = ZohoAnalyticsClient.buildInCriteria(matchingColumn, matchingValues);
      strategyUsed = 'matching_key';
      console.log('[API Delete] Strategy: matching_key');
      console.log('[API Delete] Criteria:', criteria);

    } else {
      return NextResponse.json(
        { error: 'Critère de suppression requis: matchingColumn+matchingValues OU rowIdRange OU rowIds' },
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

    // Exécuter la suppression
    const result = await client.deleteData(workspaceId, viewId, criteria);

    console.log('[API Delete] Success - deleted', result.deletedRows, 'rows');

    return NextResponse.json({
      success: true,
      deletedRows: result.deletedRows,
      strategyUsed,
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
