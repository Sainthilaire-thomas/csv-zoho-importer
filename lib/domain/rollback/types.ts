/**
 * @file lib/domain/rollback/types.ts
 * @description Types pour le service de rollback
 */

export interface RollbackConfig {
  workspaceId: string;
  viewId: string;
  matchingColumn: string;
  matchingValues: string[];
  reason: RollbackReason;
}

export type RollbackReason = 'verification_failed' | 'user_cancelled' | 'error_recovery';

export interface RollbackResult {
  success: boolean;
  deletedRows: number;
  duration: number;
  errorMessage?: string;
  remainingValues?: string[];
}

export interface RollbackLog {
  workspaceId: string;
  viewId: string;
  matchingColumn: string;
  matchingValues: string[];
  rowsDeleted: number;
  reason: RollbackReason;
  success: boolean;
  errorMessage?: string;
  durationMs: number;
  timestamp: Date;
}
