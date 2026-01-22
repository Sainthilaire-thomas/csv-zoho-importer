/**
 * @file lib/domain/rowid-sync/probe-service.ts
 * @description Service de sondage RowID pour trouver le max réel
 * 
 * Algorithme :
 * 1. Tester si le RowID estimé existe
 * 2. Si oui : monter jusqu'à trouver le premier absent
 * 3. Si non : descendre jusqu'à trouver le premier présent
 * 4. Si hors tolérance : demander resync manuelle
 */

import type { RowIdProbeResult, ProbeParams } from './types';
import { ROWID_TOLERANCE } from './types';

// ==================== FONCTION PRINCIPALE ====================

/**
 * Sonde autour du RowID estimé pour trouver le max réel
 * 
 * @param params - Paramètres de sondage
 * @returns Résultat avec le max RowID trouvé ou demande de resync
 */
export async function probeForMaxRowId(params: ProbeParams): Promise<RowIdProbeResult> {
  const { workspaceId, tableName, estimatedRowId, tolerance = ROWID_TOLERANCE } = params;
  
  let requestCount = 0;
  
  try {
    // 1. Tester si l'estimé existe
    requestCount++;
    const estimatedExists = await checkRowIdExists(workspaceId, tableName, estimatedRowId);
    
    if (estimatedExists) {
      // ─────────────────────────────────────────────────────────────
      // CAS A : L'estimé existe → Monter pour trouver la bordure
      // ─────────────────────────────────────────────────────────────
      
      // Peut-être que c'est exactement le max ?
      requestCount++;
      const nextExists = await checkRowIdExists(workspaceId, tableName, estimatedRowId + 1);
      
      if (!nextExists) {
        // L'estimé est exactement le max !
        return {
          success: true,
          maxRowId: estimatedRowId,
          requestCount,
          direction: 'exact',
          offset: 0,
        };
      }
      
      // Monter jusqu'à trouver le premier absent
      for (let i = 2; i <= tolerance; i++) {
        requestCount++;
        const exists = await checkRowIdExists(workspaceId, tableName, estimatedRowId + i);
        
        if (!exists) {
          // Trouvé la bordure !
          return {
            success: true,
            maxRowId: estimatedRowId + i - 1,
            requestCount,
            direction: 'up',
            offset: i - 1,
          };
        }
      }
      
      // Dépassé la tolérance en montée → trop de lignes externes
      return {
        success: false,
        requestCount,
        direction: 'up',
        failureReason: 'too_many_external_rows',
        errorMessage: `Plus de ${tolerance} lignes ont été ajoutées en dehors de l'application`,
      };
      
    } else {
      // ─────────────────────────────────────────────────────────────
      // CAS B : L'estimé n'existe pas → Descendre pour trouver le max
      // ─────────────────────────────────────────────────────────────
      
      for (let i = 1; i <= tolerance; i++) {
        requestCount++;
        const exists = await checkRowIdExists(workspaceId, tableName, estimatedRowId - i);
        
        if (exists) {
          // Trouvé le max réel !
          return {
            success: true,
            maxRowId: estimatedRowId - i,
            requestCount,
            direction: 'down',
            offset: -i,
          };
        }
      }
      
      // Pas trouvé en descendant → désynchronisation importante
      return {
        success: false,
        requestCount,
        direction: 'down',
        failureReason: 'desync_too_large',
        errorMessage: `Le RowID estimé (${estimatedRowId}) est trop éloigné de la réalité`,
      };
    }
    
  } catch (error) {
    return {
      success: false,
      requestCount,
      failureReason: 'api_error',
      errorMessage: error instanceof Error ? error.message : 'Erreur API',
    };
  }
}

// ==================== HELPERS ====================

/**
 * Vérifie si un RowID existe dans la table
 * Utilise l'API verify-data avec RowID comme colonne de matching
 */
async function checkRowIdExists(
  workspaceId: string,
  tableName: string,
  rowId: number
): Promise<boolean> {
  const params = new URLSearchParams({
    workspaceId,
    tableName,
    matchingColumn: 'RowID',
    matchingValues: JSON.stringify([String(rowId)]),
    limit: '1',
  });
  
  const response = await fetch(`/api/zoho/verify-data?${params.toString()}`);
  const data = await response.json();
  
  return data.success && data.data?.length > 0;
}

/**
 * Vérifie plusieurs RowID en une seule requête (optimisation)
 * Utile pour réduire le nombre d'appels API
 */
export async function checkMultipleRowIds(
  workspaceId: string,
  tableName: string,
  rowIds: number[]
): Promise<Map<number, boolean>> {
  const params = new URLSearchParams({
    workspaceId,
    tableName,
    matchingColumn: 'RowID',
    matchingValues: JSON.stringify(rowIds.map(String)),
    limit: String(rowIds.length),
  });
  
  const response = await fetch(`/api/zoho/verify-data?${params.toString()}`);
  const data = await response.json();
  
  const results = new Map<number, boolean>();
  
  // Initialiser tous à false
  rowIds.forEach(id => results.set(id, false));
  
  // Marquer ceux qui existent
  if (data.success && data.data) {
    data.data.forEach((row: Record<string, unknown>) => {
      const rowId = Number(row.RowID || row.rowId);
      if (!isNaN(rowId)) {
        results.set(rowId, true);
      }
    });
  }
  
  return results;
}
