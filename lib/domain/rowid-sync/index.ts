/**
 * @file lib/domain/rowid-sync/index.ts
 * @description Module de synchronisation RowID pour rollback
 */

// Types
export type {
  TableRowIdSync,
  UpsertRowIdSyncData,
  PreImportCheckResult,
} from './types';
export { ROWID_TOLERANCE } from './types';

// Services
export {
  getTableSync,
  getEstimatedStartRowId,
  updateSyncAfterImport,
  manualResync,
  checkSyncBeforeImport,
  calculateEndRowId,
  fetchRealMaxRowIdAfterImport,
} from './sync-service';
