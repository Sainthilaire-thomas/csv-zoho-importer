// ============================================
// @file app/api/imports/[id]/rollback/route.ts
// API pour annuler un import (rollback différé)
// POST: Exécuter le rollback
// Mission 013
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/infrastructure/supabase/server';
import { isRollbackable, getRollbackInfo } from '@/lib/domain/history/rollback-rules';
import { getTokens } from '@/lib/infrastructure/zoho/auth';
import type { ImportMode, RollbackResponse, LIFOError } from '@/types/imports';

/**
 * POST /api/imports/[id]/rollback
 * Annuler un import (supprimer les lignes ajoutées)
 * 
 * Vérifications:
 * 1. Mode rollbackable (append ou onlyadd)
 * 2. Pas d'import plus récent sur cette table (LIFO)
 * 3. Pas déjà rollback
 * 4. RowID disponibles
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now();
  
  try {
    const { id } = await params;
    const supabase = await createClient();
    
    // Vérifier l'authentification
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    // Récupérer l'import à annuler
    const { data: importToRollback, error: fetchError } = await supabase
      .schema('csv_importer')
    .from('import_logs')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (fetchError || !importToRollback) {
      return NextResponse.json({ error: 'Import non trouvé' }, { status: 404 });
    }

    // === VÉRIFICATION 1: Déjà rollback ? ===
    if (importToRollback.rolled_back) {
      return NextResponse.json(
        { error: 'Cet import a déjà été annulé' },
        { status: 400 }
      );
    }

    // === VÉRIFICATION 2: Mode rollbackable ? ===
    const mode = importToRollback.import_mode as ImportMode;
    if (!isRollbackable(mode)) {
      const info = getRollbackInfo(mode);
      return NextResponse.json(
        { 
          error: `Ce mode d'import (${mode}) ne permet pas l'annulation automatique`,
          suggestion: info.message,
        },
        { status: 400 }
      );
    }

    // === VÉRIFICATION 3: RowID disponibles ? ===
    const rowIdBefore = importToRollback.row_id_before;
    const rowIdAfter = importToRollback.row_id_after;
    
    if (rowIdBefore === null || rowIdAfter === null) {
      return NextResponse.json(
        { error: 'Informations de rollback non disponibles (RowID manquants)' },
        { status: 400 }
      );
    }

    if (rowIdAfter <= rowIdBefore) {
      return NextResponse.json(
        { error: 'Aucune ligne à supprimer' },
        { status: 400 }
      );
    }

    // === VÉRIFICATION 4: Contrainte LIFO ===
    const { data: newerImports, error: lifoError } = await supabase
    .schema('csv_importer')
      .from('import_logs')
      .select('id, file_name, created_at')
      .eq('zoho_table_id', importToRollback.zoho_table_id)
      .eq('rolled_back', false)
      .gt('created_at', importToRollback.created_at)
      .order('created_at', { ascending: false });

    if (lifoError) {
      console.error('[Rollback] Erreur vérification LIFO:', lifoError);
      return NextResponse.json({ error: 'Erreur vérification LIFO' }, { status: 500 });
    }

    if (newerImports && newerImports.length > 0) {
      const response: LIFOError = {
        error: `Vous devez d'abord annuler l'import "${newerImports[0].file_name}"`,
        newerImports: newerImports,
      };
      return NextResponse.json(response, { status: 400 });
    }

    // === EXÉCUTER LE ROLLBACK ===
    
    // Récupérer les tokens Zoho
    const tokens = await getTokens(user.id);
    if (!tokens) {
      return NextResponse.json(
        { error: 'Connexion Zoho requise' },
        { status: 401 }
      );
    }

    // Construire le critère de suppression
    const criteria = `"RowID" > ${rowIdBefore} AND "RowID" <= ${rowIdAfter}`;
    
    console.log(`[Rollback] Import ${id}: DELETE WHERE ${criteria}`);

    // Appeler l'API Zoho DELETE
    const workspaceId = importToRollback.workspace_id;
    const viewId = importToRollback.zoho_table_id;
    
    const deleteUrl = `${tokens.apiDomain}/restapi/v2/workspaces/${workspaceId}/views/${viewId}/rows?CONFIG=${encodeURIComponent(JSON.stringify({ criteria }))}`;
    
    const deleteResponse = await fetch(deleteUrl, {
      method: 'DELETE',
      headers: {
        'Authorization': `Zoho-oauthtoken ${tokens.accessToken}`,
        'ZANALYTICS-ORGID': tokens.orgId || '',
      },
    });

    if (!deleteResponse.ok) {
      const errorText = await deleteResponse.text();
      console.error('[Rollback] Erreur Zoho DELETE:', errorText);
      return NextResponse.json(
        { error: `Erreur Zoho: ${errorText}` },
        { status: deleteResponse.status }
      );
    }

    const deleteResult = await deleteResponse.json();
    const deletedRows = deleteResult.data?.deletedRows || 0;

    console.log(`[Rollback] ${deletedRows} lignes supprimées`);

    // === METTRE À JOUR LE LOG ===
    const { error: updateError } = await supabase
    .schema('csv_importer')
      .from('import_logs')
      .update({
        rolled_back: true,
        rolled_back_at: new Date().toISOString(),
        rolled_back_by: user.id,
      })
      .eq('id', id);

    if (updateError) {
      console.error('[Rollback] Erreur mise à jour log:', updateError);
      // Le rollback a réussi côté Zoho, on continue malgré l'erreur de log
    }

    const duration = Date.now() - startTime;

    const response: RollbackResponse = {
      success: true,
      deletedRows,
      duration,
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('[Rollback] Erreur inattendue:', error);
    return NextResponse.json(
      { error: 'Erreur serveur lors du rollback' },
      { status: 500 }
    );
  }
}
