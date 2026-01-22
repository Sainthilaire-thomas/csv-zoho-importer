// ============================================
// @file types/imports.ts
// Types pour l'historique des imports et rollback
// Mission 013
// ============================================

export type ImportMode = 'append' | 'truncateadd' | 'updateadd' | 'deleteupsert' | 'onlyadd';

export type ImportStatus = 'pending' | 'validating' | 'importing' | 'success' | 'partial' | 'error';

/**
 * Log d'import stocké en base de données
 */
export interface ImportLog {
  id: string;
  user_id: string;
  
  // Identification Zoho
  zoho_table_id: string;      // view_id
  workspace_id: string | null;
  table_name: string | null;
  
  // Fichier
  file_name: string;
  file_size_bytes: number | null;
  
  // Configuration import
  import_mode: ImportMode;
  matching_column: string | null;
  profile_id: string | null;
  
  // Statistiques
  rows_total: number;
  rows_valid: number;
  rows_imported: number;
  rows_errors: number;
  chunks_count: number;
  
  // Rollback info
  row_id_before: number | null;
  row_id_after: number | null;
  
  // Statut
  status: ImportStatus;
  error_summary: ErrorSummary[];
  zoho_import_id: string | null;
  
  // Timing
  duration_ms: number | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  
  // Rollback
  rolled_back: boolean;
  rolled_back_at: string | null;
  rolled_back_by: string | null;
}

export interface ErrorSummary {
  row: number;
  column: string;
  error: string;
}

/**
 * Données pour créer un nouveau log d'import
 */
export interface CreateImportLogData {
  workspaceId: string;
  viewId: string;           // zoho_table_id
  tableName: string;
  importMode: ImportMode;
  fileName: string;
  fileSizeBytes?: number;
  rowsTotal: number;
  rowsValid: number;
  rowsImported: number;
  rowsErrors?: number;
  rowIdBefore: number | null;
  rowIdAfter: number | null;
  matchingColumn?: string;
  chunksCount: number;
  durationMs: number;
  status: ImportStatus;
  errorSummary?: ErrorSummary[];
  profileId?: string;
}

/**
 * Réponse de la liste des imports
 */
export interface ImportListResponse {
  imports: ImportLog[];
  total: number;
  hasMore: boolean;
}

/**
 * Réponse du rollback
 */
export interface RollbackResponse {
  success: boolean;
  deletedRows: number;
  duration: number;
  errorMessage?: string;
}

/**
 * Erreur LIFO - imports plus récents à annuler d'abord
 */
export interface LIFOError {
  error: string;
  newerImports: {
    id: string;
    file_name: string;
    created_at: string;
  }[];
}
