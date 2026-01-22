/**
 * @file lib/domain/rollback/rollback-service.ts
 * @description Service de rollback pour annuler un import test
 * 
 * Mission 012 : Support dual stratégie RowID et matching_key
 */

import type { RollbackConfig, RollbackResult, RollbackLog, RollbackStrategy } from './types';

/**
 * Détermine la stratégie de rollback à utiliser selon la config
 */
function getRollbackStrategy(config: RollbackConfig): RollbackStrategy {
  if (config.rowIdRange) return 'rowid_range';
  if (config.rowIds && config.rowIds.length > 0) return 'rowid_list';
  if (config.matchingColumn && config.matchingValues?.length) return 'matching_key';
  throw new Error('Configuration de rollback invalide: aucune stratégie applicable');
}

/**
 * Exécute un rollback en supprimant les lignes importées lors du test
 * Supporte 2 stratégies : matching_key (existante) et rowid (nouvelle)
 */
export async function executeRollback(config: RollbackConfig): Promise<RollbackResult> {
  const startTime = Date.now();
  
  try {
    const strategy = getRollbackStrategy(config);
    console.log('[Rollback] Strategy:', strategy);

    // Log selon la stratégie
    if (strategy === 'matching_key') {
      console.log('[Rollback] Matching column:', config.matchingColumn);
      console.log('[Rollback] Values count:', config.matchingValues?.length);
      console.log('[Rollback] Values:', config.matchingValues);
    } else if (strategy === 'rowid_range') {
      console.log('[Rollback] RowID range: >', config.rowIdRange?.min);
      if (config.rowIdRange?.max) {
        console.log('[Rollback] RowID max:', config.rowIdRange.max);
      }
    } else if (strategy === 'rowid_list') {
      console.log('[Rollback] RowIDs to delete:', config.rowIds);
    }

    // Appeler l'API de suppression avec les paramètres appropriés
    const response = await fetch('/api/zoho/delete', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        workspaceId: config.workspaceId,
        viewId: config.viewId,
        tableName: config.tableName,
        // Stratégie matching_key
        matchingColumn: config.matchingColumn,
        matchingValues: config.matchingValues,
        // Stratégie rowid
        rowIdRange: config.rowIdRange,
        rowIds: config.rowIds,
      }),
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      return {
        success: false,
        deletedRows: 0,
        duration: Date.now() - startTime,
        strategyUsed: strategy,
        errorMessage: result.error || 'Erreur lors du rollback',
        remainingValues: strategy === 'matching_key' ? config.matchingValues : undefined,
        remainingRowIds: strategy === 'rowid_list' ? config.rowIds : undefined,
      };
    }

    return {
      success: true,
      deletedRows: result.deletedRows,
      duration: Date.now() - startTime,
      strategyUsed: strategy,
    };

  } catch (error) {
    console.error('[Rollback] Error:', error);
    
    // Déterminer la stratégie pour le rapport d'erreur
    let strategy: RollbackStrategy = 'matching_key';
    try {
      strategy = getRollbackStrategy(config);
    } catch {
      // Ignore
    }

    return {
      success: false,
      deletedRows: 0,
      duration: Date.now() - startTime,
      strategyUsed: strategy,
      errorMessage: error instanceof Error ? error.message : 'Erreur inconnue',
      remainingValues: config.matchingValues,
      remainingRowIds: config.rowIds,
    };
  }
}

/**
 * Formate la raison du rollback pour l'affichage
 */
export function formatRollbackReason(reason: RollbackConfig['reason']): string {
  switch (reason) {
    case 'verification_failed':
      return 'Anomalies détectées lors de la vérification';
    case 'user_cancelled':
      return 'Annulé par l\'utilisateur';
    case 'error_recovery':
      return 'Récupération après erreur';
    default:
      return 'Raison inconnue';
  }
}

/**
 * Crée un log de rollback (pour stockage futur en base)
 */
export function createRollbackLog(
  config: RollbackConfig,
  result: RollbackResult
): RollbackLog {
  const strategy = result.strategyUsed || 'matching_key';
  
  return {
    workspaceId: config.workspaceId,
    viewId: config.viewId,
    strategyUsed: strategy,
    // Matching key
    matchingColumn: config.matchingColumn,
    matchingValues: config.matchingValues,
    // RowID
    rowIdRange: config.rowIdRange,
    rowIds: config.rowIds,
    // Résultat
    rowsDeleted: result.deletedRows,
    reason: config.reason,
    success: result.success,
    errorMessage: result.errorMessage,
    durationMs: result.duration,
    timestamp: new Date(),
  };
}
