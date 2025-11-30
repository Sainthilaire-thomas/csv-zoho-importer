/**
 * @file app/api/zoho/import/route.ts
 * @description Import de données vers Zoho Analytics
 * 
 * POST /api/zoho/import
 * Body: {
 *   workspaceId: string,
 *   tableId: string,
 *   tableName: string,
 *   importMode: string,
 *   csvData: string,
 *   matchingColumns?: string[]
 * }
 * 
 * Note: Les données CSV transitent par cette route mais ne sont
 * JAMAIS stockées (zero data retention). Elles sont transmises
 * directement à Zoho et nettoyées de la mémoire.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/infrastructure/supabase/server';
import { 
  ZohoAnalyticsClient, 
  ZohoAuthError,
  getZohoImportType,
} from '@/lib/infrastructure/zoho';

// Timeout étendu pour les imports (Vercel Hobby = 10s max par défaut)
export const maxDuration = 60;

interface ImportRequestBody {
  workspaceId: string;
  tableId: string;
  tableName: string;
  importMode: string;
  csvData: string;
  matchingColumns?: string[];
  fileName?: string;
  totalRows?: number;
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  let csvData: string | null = null;
  
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
    
    // 2. Parser le body
    const body: ImportRequestBody = await request.json();
    
    const { 
      workspaceId, 
      tableId, 
      tableName,
      importMode, 
      matchingColumns,
      fileName,
      totalRows,
    } = body;
    
    // Stocker temporairement pour traitement
    csvData = body.csvData;
    
    // 3. Valider les paramètres requis
    if (!workspaceId || !tableId || !importMode || !csvData) {
      return NextResponse.json(
        { error: 'Paramètres manquants: workspaceId, tableId, importMode et csvData requis' },
        { status: 400 }
      );
    }
    
    // 4. Créer le client Zoho
    const client = await ZohoAnalyticsClient.forUser(session.user.id);
    
    if (!client) {
      return NextResponse.json(
        { error: 'Non connecté à Zoho', needsConnection: true },
        { status: 403 }
      );
    }
    
    // 5. Convertir le mode d'import
    const zohoImportType = getZohoImportType(importMode);
    
    // 6. Effectuer l'import
 const result = await client.importData({
      workspaceId,
      viewId: tableId,
      viewName: tableName,  // <-- AJOUTER
      importType: zohoImportType,
      data: csvData,
      autoIdentify: true,
      dateFormat: 'dd/MM/yyyy',
      matchingColumns,
    });
    
    const duration = Date.now() - startTime;
    
    // 7. Logger les métadonnées (PAS les données CSV)
    try {
      await logImportMetadata(supabase, {
        userId: session.user.id,
        workspaceId,
        tableId,
        tableName,
        fileName,
        importMode,
        status: result.status,
        totalRows: totalRows || result.importSummary?.totalRowCount || 0,
        importedRows: result.importSummary?.successRowCount || 0,
        failedRows: result.importSummary?.failedRowCount || 0,
        duration,
        zohoImportId: result.importId,
        errorMessage: result.errorMessage,
      });
    } catch (logError) {
      // Ne pas faire échouer l'import si le log échoue
      console.error('Erreur log import:', logError);
    }
    
    // 8. Retourner le résultat
    if (result.status === 'success') {
      return NextResponse.json({
        success: true,
        importId: result.importId,
        summary: result.importSummary,
        duration,
      });
    } else {
      return NextResponse.json({
        success: false,
        error: result.errorMessage || 'Erreur lors de l\'import',
        errorCode: result.errorCode,
        errors: result.importErrors,
      }, { status: 400 });
    }
    
  } catch (error) {
    console.error('Erreur import Zoho:', error);
    
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
        error: error instanceof Error ? error.message : 'Erreur lors de l\'import' 
      },
      { status: 500 }
    );
    
  } finally {
    // CRITIQUE: Nettoyer les données de la mémoire
    csvData = null;
  }
}

// ==================== HELPERS ====================

interface ImportLogData {
  userId: string;
  workspaceId: string;
  tableId: string;
  tableName?: string;
  fileName?: string;
  importMode: string;
  status: 'success' | 'error';
  totalRows: number;
  importedRows: number;
  failedRows: number;
  duration: number;
  zohoImportId?: string;
  errorMessage?: string;
}

async function logImportMetadata(
  supabase: ReturnType<typeof createClient> extends Promise<infer T> ? T : never,
  data: ImportLogData
) {
  // Utiliser le client avec le schéma csv_importer
  const { error } = await supabase
    .from('import_logs')
    .insert({
      user_id: data.userId,
      zoho_table_id: data.tableId,
      file_name: data.fileName || 'import.csv',
      file_size_bytes: 0, // Non disponible côté serveur
      import_mode: data.importMode,
      status: data.status,
      rows_total: data.totalRows,
      rows_imported: data.importedRows,
      rows_errors: data.failedRows,
      error_summary: data.errorMessage ? [{ message: data.errorMessage }] : null,
      zoho_import_id: data.zohoImportId,
      duration_ms: data.duration,
    });
  
  if (error) {
    throw error;
  }
}
