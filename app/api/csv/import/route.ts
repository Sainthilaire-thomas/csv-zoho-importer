// app/api/csv/import/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/infrastructure/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Vérifier l'authentification
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Non autorisé' },
        { status: 401 }
      );
    }

    // Récupérer les métadonnées (pas de fichier !)
    const body = await request.json();
    const { tableId, tableName, fileName, fileSize, importMode, rowsImported } = body;

    // Logger les métadonnées de l'import (ZERO DATA RETENTION)
    const { error: logError } = await supabase
    .schema('csv_importer')
      .from('import_logs')
      .insert({
        user_id: user.id,
        zoho_table_id: tableId,
        file_name: fileName,
        file_size_bytes: fileSize,
        import_mode: importMode,
        status: 'success',
        rows_total: rowsImported,
        rows_valid: rowsImported,
        rows_imported: rowsImported,
        rows_errors: 0,
        duration_ms: 0,
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
      });

    if (logError) {
      console.error('Erreur log import:', logError);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Erreur log import:', error);
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    );
  }
}
