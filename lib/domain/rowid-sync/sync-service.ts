/**
 * @file lib/domain/rowid-sync/sync-service.ts
 * @description Service de synchronisation RowID avec Supabase
 */

import type { 
  TableRowIdSync, 
  UpsertRowIdSyncData, 
  PreImportCheckResult,
  RowIdProbeResult,
} from './types';
import { probeForMaxRowId } from './probe-service';

// ==================== LECTURE ====================

/**
 * Récupère l'état de synchronisation d'une table
 */
export async function getTableSync(zohoTableId: string): Promise<TableRowIdSync | null> {
  const response = await fetch(`/api/rowid-sync?tableId=${zohoTableId}`);
  const data = await response.json();
  
  if (!response.ok || !data.sync) {
    return null;
  }
  
  return data.sync;
}

/**
 * Calcule le RowID de début estimé pour un nouvel import
 */
export async function getEstimatedStartRowId(zohoTableId: string): Promise<number | null> {
  const sync = await getTableSync(zohoTableId);
  
  if (!sync) {
    return null; // Première fois → resync manuelle requise
  }
  
  return sync.lastKnownRowid + 1;
}

// ==================== ÉCRITURE ====================

/**
 * Met à jour la synchronisation après un import réussi
 */
export async function updateSyncAfterImport(
  data: UpsertRowIdSyncData
): Promise<{ success: boolean; error?: string }> {
  const response = await fetch('/api/rowid-sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  
  const result = await response.json();
  
  if (!response.ok) {
    return { success: false, error: result.error || 'Erreur de synchronisation' };
  }
  
  return { success: true };
}

/**
 * Resynchronisation manuelle par l'utilisateur
 */
export async function manualResync(
  zohoTableId: string,
  tableName: string,
  workspaceId: string,
  lastKnownRowid: number
): Promise<{ success: boolean; error?: string }> {
  return updateSyncAfterImport({
    zohoTableId,
    tableName,
    workspaceId,
    lastKnownRowid,
    source: 'manual',
  });
}

// ==================== VÉRIFICATION PRÉ-IMPORT ====================

/**
 * Vérifie la synchronisation avant un import
 * 
 * @returns Instructions pour le wizard :
 *   - success: true → continuer avec estimatedStartRowId
 *   - success: false + needsResync: false → continuer avec actualStartRowId (recalé)
 *   - success: false + needsResync: true → afficher UI de resync
 */
export async function checkSyncBeforeImport(
  zohoTableId: string,
  tableName: string,
  workspaceId: string
): Promise<PreImportCheckResult> {
  
  // 1. Récupérer l'état actuel
  const sync = await getTableSync(zohoTableId);
  
  if (!sync) {
    // Premier import sur cette table → demander le RowID initial
    return {
      success: false,
      estimatedStartRowId: 0,
      needsResync: true,
      message: 'Première utilisation sur cette table. Veuillez saisir le dernier RowID actuel.',
    };
  }
  
  const estimatedStartRowId = sync.lastKnownRowid + 1;
  
  // 2. Sonder pour vérifier
  const probeResult = await probeForMaxRowId({
    workspaceId,
    tableName,
    estimatedRowId: sync.lastKnownRowid,
  });
  
  if (probeResult.success && probeResult.maxRowId !== undefined) {
    const actualMaxRowId = probeResult.maxRowId;
    const offset = probeResult.offset || 0;
    
    if (offset === 0) {
      // Parfait ! Synchro exacte
      return {
        success: true,
        estimatedStartRowId,
        actualStartRowId: estimatedStartRowId,
        needsResync: false,
        message: 'Synchronisation OK',
        probeResult,
      };
    } else {
      // Petit décalage détecté, on recale automatiquement
      const actualStartRowId = actualMaxRowId + 1;
      const direction = offset > 0 ? 'ajoutées' : 'manquantes';
      
      return {
        success: true,
        estimatedStartRowId,
        actualStartRowId,
        needsResync: false,
        message: `${Math.abs(offset)} ligne(s) ${direction} détectée(s). Synchronisation recalée.`,
        probeResult,
      };
    }
  }
  
  // 3. Échec du sondage → demander resync manuelle
  return {
    success: false,
    estimatedStartRowId,
    needsResync: true,
    message: probeResult.errorMessage || 'Synchronisation perdue. Veuillez resaisir le dernier RowID.',
    probeResult,
  };
}

// ==================== CALCUL POST-IMPORT ====================

/**
 * Calcule le RowID de fin après un import
 */
export function calculateEndRowId(startRowId: number, rowCount: number): number {
  return startRowId + rowCount - 1;
}
