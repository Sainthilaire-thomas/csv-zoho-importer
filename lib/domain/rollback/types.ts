/**
 * @file lib/domain/rollback/types.ts
 * @description Types pour le service de rollback
 * 
 * Mission 012 : Support dual stratégie RowID et matching_key
 */

/** Stratégie de rollback */
export type RollbackStrategy = 'matching_key' | 'rowid_range' | 'rowid_list';

/** Raison du rollback */
export type RollbackReason = 'verification_failed' | 'user_cancelled' | 'error_recovery';

/**
 * Configuration du rollback
 * Supporte 2 stratégies : matching_key (existante) et rowid (nouvelle)
 */
export interface RollbackConfig {
  workspaceId: string;
  viewId: string;
  reason: RollbackReason;
  
  // ─────────────────────────────────────────────────────────────────────────
  // Stratégie 1 : Par clé de matching (existante - pour UPDATEADD/DELETEUPSERT)
  // ─────────────────────────────────────────────────────────────────────────
  
  /** Colonne utilisée pour identifier les lignes */
  matchingColumn?: string;
  /** Valeurs des lignes à supprimer */
  matchingValues?: string[];
  
  // ─────────────────────────────────────────────────────────────────────────
  // Stratégie 2 : Par RowID (nouvelle - pour APPEND/TRUNCATEADD/ONLYADD)
  // ─────────────────────────────────────────────────────────────────────────
  
  /** Nom de la table (requis pour stratégie RowID) */
  tableName?: string;
  /** Plage de RowID à supprimer (RowID > min) */
  rowIdRange?: {
    /** RowID minimum (exclusif) - les lignes avec RowID > min seront supprimées */
    min: number;
    /** RowID maximum (inclusif) - optionnel */
    max?: number;
  };
  /** Liste explicite de RowIDs à supprimer (alternative à rowIdRange) */
  rowIds?: number[];
}

/**
 * Résultat du rollback
 */
export interface RollbackResult {
  success: boolean;
  deletedRows: number;
  duration: number;
  /** Stratégie utilisée */
  strategyUsed?: RollbackStrategy;
  errorMessage?: string;
  /** Pour matching_key : valeurs non supprimées en cas d'erreur partielle */
  remainingValues?: string[];
  /** Pour rowid : RowIDs non supprimés en cas d'erreur partielle */
  remainingRowIds?: number[];
}

/**
 * Log de rollback (pour historique)
 */
export interface RollbackLog {
  workspaceId: string;
  viewId: string;
  strategyUsed: RollbackStrategy;
  // Matching key
  matchingColumn?: string;
  matchingValues?: string[];
  // RowID
  rowIdRange?: { min: number; max?: number };
  rowIds?: number[];
  // Résultat
  rowsDeleted: number;
  reason: RollbackReason;
  success: boolean;
  errorMessage?: string;
  durationMs: number;
  timestamp: Date;
}
