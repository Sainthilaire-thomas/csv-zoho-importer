// ============================================
// @file app/api/imports/route.ts
// API CRUD pour l'historique des imports
// GET: Liste des imports avec pagination
// POST: Créer un nouveau log d'import
// Mission 013
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/infrastructure/supabase/server';
import type { CreateImportLogData, ImportListResponse } from '@/types/imports';

/**
 * GET /api/imports
 * Liste des imports avec pagination et filtres
 * 
 * Query params:
 * - limit: number (default 20, max 100)
 * - offset: number (default 0)
 * - viewId: string (optionnel, filtre par table)
 * - status: string (optionnel, filtre par statut)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Vérifier l'authentification
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    // Paramètres de requête
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');
    const viewId = searchParams.get('viewId');
    const status = searchParams.get('status');

    // Construire la requête
    let query = supabase
      .schema('csv_importer')
      .from('import_logs')
      .select('*', { count: 'exact' })
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Filtres optionnels
    if (viewId) {
      query = query.eq('zoho_table_id', viewId);
    }
    if (status) {
      query = query.eq('status', status);
    }

    const { data: imports, error, count } = await query;

    if (error) {
      console.error('[API imports] Erreur Supabase:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const response: ImportListResponse = {
      imports: imports || [],
      total: count || 0,
      hasMore: (count || 0) > offset + limit,
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('[API imports] Erreur inattendue:', error);
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/imports
 * Créer un nouveau log d'import
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Vérifier l'authentification
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    // Parser le body
    const body: CreateImportLogData = await request.json();

    // Validation minimale
    if (!body.viewId || !body.fileName || !body.importMode) {
      return NextResponse.json(
        { error: 'Champs requis manquants: viewId, fileName, importMode' },
        { status: 400 }
      );
    }

    // Préparer les données pour insertion
    const insertData = {
      user_id: user.id,
      zoho_table_id: body.viewId,
      workspace_id: body.workspaceId,
      table_name: body.tableName,
      file_name: body.fileName,
      file_size_bytes: body.fileSizeBytes || null,
      import_mode: body.importMode,
      matching_column: body.matchingColumn || null,
      rows_total: body.rowsTotal,
      rows_valid: body.rowsValid,
      rows_imported: body.rowsImported,
      rows_errors: body.rowsErrors || 0,
      row_id_before: body.rowIdBefore,
      row_id_after: body.rowIdAfter,
      chunks_count: body.chunksCount,
      duration_ms: body.durationMs,
      status: body.status,
      error_summary: body.errorSummary || [],
      profile_id: body.profileId || null,
      started_at: new Date(Date.now() - body.durationMs).toISOString(),
      completed_at: new Date().toISOString(),
    };

    // Insérer le log
    const { data: newImport, error } = await supabase
      .schema('csv_importer')
      .from('import_logs')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      console.error('[API imports] Erreur insertion:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log(`[API imports] Log créé: ${newImport.id} - ${body.fileName}`);

    return NextResponse.json({
      success: true,
      importId: newImport.id,
    });

  } catch (error) {
    console.error('[API imports] Erreur inattendue:', error);
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    );
  }
}
