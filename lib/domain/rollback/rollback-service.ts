/**
 * @file lib/domain/rollback/rollback-service.ts
 * @description Service de rollback pour annuler un import test
 */

import type { RollbackConfig, RollbackResult, RollbackLog } from './types';

/**
 * Exécute un rollback en supprimant les lignes importées lors du test
 */
export async function executeRollback(config: RollbackConfig): Promise<RollbackResult> {
  const startTime = Date.now();

  try {
    console.log('[Rollback] Starting rollback for', config.matchingValues.length, 'rows');
    console.log('[Rollback] Matching column:', config.matchingColumn);
    console.log('[Rollback] Values:', config.matchingValues);

    // Appeler l'API de suppression
    const response = await fetch('/api/zoho/delete', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        workspaceId: config.workspaceId,
        viewId: config.viewId,
        matchingColumn: config.matchingColumn,
        matchingValues: config.matchingValues,
      }),
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      return {
        success: false,
        deletedRows: 0,
        duration: Date.now() - startTime,
        errorMessage: result.error || 'Erreur lors du rollback',
        remainingValues: config.matchingValues,
      };
    }

    return {
      success: true,
      deletedRows: result.deletedRows,
      duration: Date.now() - startTime,
    };

  } catch (error) {
    console.error('[Rollback] Error:', error);

    return {
      success: false,
      deletedRows: 0,
      duration: Date.now() - startTime,
      errorMessage: error instanceof Error ? error.message : 'Erreur inconnue',
      remainingValues: config.matchingValues,
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
  return {
    workspaceId: config.workspaceId,
    viewId: config.viewId,
    matchingColumn: config.matchingColumn,
    matchingValues: config.matchingValues,
    rowsDeleted: result.deletedRows,
    reason: config.reason,
    success: result.success,
    errorMessage: result.errorMessage,
    durationMs: result.duration,
    timestamp: new Date(),
  };
}
