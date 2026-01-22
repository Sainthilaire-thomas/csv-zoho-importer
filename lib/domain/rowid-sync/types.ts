/**
 * @file lib/domain/rowid-sync/types.ts
 * @description Types pour la synchronisation RowID
 */

// ==================== CONFIGURATION ====================

/** Tolérance de sondage (nombre de RowID à tester en montée/descente) */
export const ROWID_TOLERANCE = 5;

// ==================== TYPES ====================

/**
 * Résultat du sondage RowID
 */
export interface RowIdProbeResult {
  /** Sondage réussi ? */
  success: boolean;
  /** RowID max trouvé (si succès) */
  maxRowId?: number;
  /** Nombre de requêtes effectuées */
  requestCount: number;
  /** Direction du sondage : 'up' (montée), 'down' (descente), 'exact' (trouvé du premier coup) */
  direction?: 'up' | 'down' | 'exact';
  /** Écart avec l'estimé */
  offset?: number;
  /** Raison de l'échec (si échec) */
  failureReason?: 'too_many_external_rows' | 'desync_too_large' | 'api_error';
  /** Message d'erreur */
  errorMessage?: string;
}

/**
 * État de synchronisation d'une table
 */
export interface TableRowIdSync {
  id: string;
  zohoTableId: string;
  tableName: string;
  workspaceId: string;
  lastKnownRowid: number;
  source: 'import' | 'manual' | 'resync';
  lastImportId?: string;
  syncedAt: string;
  syncedBy?: string;
}

/**
 * Données pour créer/mettre à jour une synchro
 */
export interface UpsertRowIdSyncData {
  zohoTableId: string;
  tableName: string;
  workspaceId: string;
  lastKnownRowid: number;
  source: 'import' | 'manual' | 'resync';
  lastImportId?: string;
}

/**
 * Résultat de la vérification pré-import
 */
export interface PreImportCheckResult {
  /** Vérification réussie ? */
  success: boolean;
  /** RowID de début estimé */
  estimatedStartRowId: number;
  /** RowID de début réel (après sondage) */
  actualStartRowId?: number;
  /** Resynchronisation nécessaire ? */
  needsResync: boolean;
  /** Message pour l'utilisateur */
  message: string;
  /** Détails du sondage */
  probeResult?: RowIdProbeResult;
}

/**
 * Paramètres pour le sondage
 */
export interface ProbeParams {
  workspaceId: string;
  tableName: string;
  estimatedRowId: number;
  tolerance?: number;
}
