/**
 * @file lib/domain/rowid-sync/index.ts
 * @description Module de synchronisation RowID pour rollback
 */

// Types
export type {
  RowIdProbeResult,
  TableRowIdSync,
  UpsertRowIdSyncData,
  PreImportCheckResult,
  ProbeParams,
} from './types';

export { ROWID_TOLERANCE } from './types';

// Services
export { probeForMaxRowId, checkMultipleRowIds } from './probe-service';
export {
  getTableSync,
  getEstimatedStartRowId,
  updateSyncAfterImport,
  manualResync,
  checkSyncBeforeImport,
  calculateEndRowId,
} from './sync-service';
