/**
 * @file app/api/rowid-sync/route.ts
 * @description API pour gérer la synchronisation RowID par table
 * 
 * GET  ?tableId=xxx     → Récupérer l'état de synchro d'une table
 * POST { ... }          → Créer/mettre à jour la synchro
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/infrastructure/supabase/server';

// ==================== GET ====================

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Vérifier l'authentification
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }
    
    const { searchParams } = new URL(request.url);
    const tableId = searchParams.get('tableId');
    const workspaceId = searchParams.get('workspaceId');
    
    // Récupérer une table spécifique
    if (tableId) {
      const { data, error } = await supabase
        .schema('csv_importer')
        .from('table_rowid_sync')
        .select('*')
        .eq('zoho_table_id', tableId)
        .single();
      
      if (error && error.code !== 'PGRST116') { // PGRST116 = not found
        throw error;
      }
      
      return NextResponse.json({
        sync: data ? mapToFrontend(data) : null,
      });
    }
    
    // Récupérer toutes les tables d'un workspace
    if (workspaceId) {
      const { data, error } = await supabase
        .schema('csv_importer')
        .from('table_rowid_sync')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('synced_at', { ascending: false });
      
      if (error) throw error;
      
      return NextResponse.json({
        syncs: data?.map(mapToFrontend) || [],
      });
    }
    
    return NextResponse.json({ error: 'tableId ou workspaceId requis' }, { status: 400 });
    
  } catch (error) {
    console.error('[RowIdSync GET] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur serveur' },
      { status: 500 }
    );
  }
}

// ==================== POST ====================

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Vérifier l'authentification
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }
    
    const body = await request.json();
    const {
      zohoTableId,
      tableName,
      workspaceId,
      lastKnownRowid,
      source = 'import',
      lastImportId,
    } = body;
    
    // Validation
    if (!zohoTableId || !tableName || !workspaceId || lastKnownRowid === undefined) {
      return NextResponse.json(
        { error: 'zohoTableId, tableName, workspaceId et lastKnownRowid requis' },
        { status: 400 }
      );
    }
    
    if (typeof lastKnownRowid !== 'number' || lastKnownRowid < 0) {
      return NextResponse.json(
        { error: 'lastKnownRowid doit être un nombre positif' },
        { status: 400 }
      );
    }
    
    // Upsert (insert ou update si existe)
    const { data, error } = await supabase
      .schema('csv_importer')
      .from('table_rowid_sync')
      .upsert({
        zoho_table_id: zohoTableId,
        table_name: tableName,
        workspace_id: workspaceId,
        last_known_rowid: lastKnownRowid,
        source,
        last_import_id: lastImportId || null,
        synced_at: new Date().toISOString(),
        synced_by: user.id,
      }, {
        onConflict: 'zoho_table_id',
      })
      .select()
      .single();
    
    if (error) throw error;
    
    console.log(`[RowIdSync] Updated: table=${tableName}, rowid=${lastKnownRowid}, source=${source}`);
    
    return NextResponse.json({
      success: true,
      sync: mapToFrontend(data),
    });
    
  } catch (error) {
    console.error('[RowIdSync POST] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur serveur' },
      { status: 500 }
    );
  }
}

// ==================== HELPERS ====================

interface DbRowIdSync {
  id: string;
  zoho_table_id: string;
  table_name: string;
  workspace_id: string;
  last_known_rowid: number;
  source: string;
  last_import_id: string | null;
  synced_at: string;
  synced_by: string | null;
  created_at: string;
  updated_at: string;
}

function mapToFrontend(row: DbRowIdSync) {
  return {
    id: row.id,
    zohoTableId: row.zoho_table_id,
    tableName: row.table_name,
    workspaceId: row.workspace_id,
    lastKnownRowid: row.last_known_rowid,
    source: row.source,
    lastImportId: row.last_import_id,
    syncedAt: row.synced_at,
    syncedBy: row.synced_by,
  };
}
