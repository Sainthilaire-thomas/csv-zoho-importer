/**
 * @file lib/domain/rowid-sync/sync-service.ts
 * @description Service de synchronisation RowID avec Supabase
 */

import type { 
  TableRowIdSync, 
  UpsertRowIdSyncData, 
  PreImportCheckResult,
} from './types';
import { ROWID_TOLERANCE } from './types';

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
 */
export async function checkSyncBeforeImport(
  zohoTableId: string,
  tableName: string,
  workspaceId: string,
  workspaceName: string  // NOUVEAU PARAMÈTRE
): Promise<PreImportCheckResult> {

  // 1. Récupérer l'état actuel depuis Supabase
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

  // 2. Récupérer le vrai MAX(RowID) depuis Zoho via API v1 CloudSQL
  console.log('[SyncCheck] Fetching real MAX(RowID) from Zoho...');
  const realMaxRowId = await fetchRealMaxRowIdAfterImport(
    workspaceId,
    workspaceName,  // NOUVEAU
    tableName
  );

  // 3. Si l'API échoue → demander resync manuelle
  if (realMaxRowId === null) {
    console.warn('[SyncCheck] API failed, requesting manual resync');
    return {
      success: false,
      estimatedStartRowId,
      needsResync: true,
      message: 'Impossible de vérifier la synchronisation. Veuillez saisir le dernier RowID actuel.',
    };
  }
  
  // 4. Comparer avec la valeur attendue
  const offset = realMaxRowId - sync.lastKnownRowid;
  console.log(`[SyncCheck] Real MAX: ${realMaxRowId}, Expected: ${sync.lastKnownRowid}, Offset: ${offset}`);
  
  if (offset === 0) {
    // Parfait ! Synchro exacte
    return {
      success: true,
      estimatedStartRowId,
      actualStartRowId: estimatedStartRowId,
      needsResync: false,
      message: 'Synchronisation OK',
    };
  } else if (Math.abs(offset) <= ROWID_TOLERANCE) {
    // Petit décalage détecté, on recale automatiquement
    const actualStartRowId = realMaxRowId + 1;
    const direction = offset > 0 ? 'ajoutées' : 'manquantes';
    
    return {
      success: true,
      estimatedStartRowId,
      actualStartRowId,
      needsResync: false,
      message: `${Math.abs(offset)} ligne(s) ${direction} détectée(s). Synchronisation recalée.`,
    };
  } else {
      // Écart trop important → demander confirmation avec la valeur détectée
      return {
        success: false,
        estimatedStartRowId,
        needsResync: true,
        detectedRealRowId: realMaxRowId,
        message: `Écart de ${Math.abs(offset)} RowID détecté (max toléré: ${ROWID_TOLERANCE}). Resynchronisation nécessaire.`,
      };
    }
}

// ==================== CALCUL POST-IMPORT ====================

/**
 * Calcule le RowID de fin après un import (FALLBACK uniquement)
 * ⚠️ Cette formule est approximative car Zoho crée des "trous" dans les RowID
 * Utiliser fetchRealMaxRowIdAfterImport() pour obtenir la vraie valeur
 */
export function calculateEndRowId(startRowId: number, rowCount: number): number {
  return startRowId + rowCount - 1;
}

// ==================== RÉCUPÉRATION RÉELLE POST-IMPORT ====================

/**
 * Récupère le vrai MAX(RowID) depuis Zoho après un import
 * Utilise l'API v1 CloudSQL (synchrone, ~2-3s) au lieu de Bulk Async
 *
 * @param workspaceId - ID du workspace Zoho
 * @param workspaceName - Nom du workspace Zoho (requis pour API v1)
 * @param tableName - Nom de la table
 * @returns Le vrai MAX(RowID) ou null si erreur
 */
export async function fetchRealMaxRowIdAfterImport(
  workspaceId: string,
  workspaceName: string,
  tableName: string
): Promise<number | null> {
  try {
    const params = new URLSearchParams({
      workspaceId,
      workspaceName,
      tableName,
      action: 'getLastRowId',
    });

    console.log('[RowIdSync] Fetching real MAX(RowID) via CloudSQL API...');
    const response = await fetch(`/api/zoho/verify-by-rowid?${params}`);
    const result = await response.json();

    if (result.success && result.maxRowId !== null) {
      console.log('[RowIdSync] Real MAX(RowID) fetched:', result.maxRowId);
      return result.maxRowId;
    }

    console.warn('[RowIdSync] Failed to fetch real MAX(RowID):', result.error);
    return null;
  } catch (error) {
    console.error('[RowIdSync] Error fetching real MAX(RowID):', error);
    return null;
  }
}
