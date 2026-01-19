// types/index.ts

// ==================== IMPORT ====================

import type { VerificationResult } from '@/lib/domain/verification';

export type ImportStatus =
  | 'selecting'
  | 'profiling'
  | 'configuring'
  | 'validating'
  | 'previewing'
  | 'reviewing'
  | 'test-importing'    // ← NOUVEAU
  | 'test-result'       // ← NOUVEAU
  | 'full-importing'    // ← NOUVEAU
  | 'importing'         // Garde pour compatibilité
  | 'success'
  | 'error';

export type ImportMode = 'append' | 'truncateadd' | 'updateadd' | 'deleteupsert' | 'onlyadd';

export type FileSource = 'upload' | 'sftp';

export interface ImportConfig {
  source: FileSource;
  file: File | null;
  sftpPath: string | null;
  tableId: string;
  tableName: string;
  importMode: ImportMode;
}

export interface ImportState {
  status: ImportStatus;
  config: ImportConfig;
  validation: ValidationResult | null;
  progress: ImportProgress | null;
  result: ImportResult | null;
  error: string | null;
}

export interface ImportProgress {
  phase: 'parsing' | 'validating' | 'importing' | 'test-importing' | 'verifying' | 'full-importing';
  current: number;
  total: number;
  percentage: number;
  chunk?: {
    current: number;
    total: number;
  };
}
export interface ImportResult {
  success: boolean;
  importId: string;
  rowsImported: number;
  duration: number;
  zohoImportId?: string;
  verification?: VerificationResult;  // ← AJOUTER
}

// ==================== VALIDATION ====================

export type RuleType =
  | 'required'
  | 'date'
  | 'number'
  | 'email'
  | 'enum'
  | 'regex'
  | 'length'
  | 'custom';

export interface ValidationRule {
  type: RuleType;
  enabled: boolean;
  params?: Record<string, unknown>;
  message?: string;
}

export interface ColumnValidationConfig {
  columnName: string;
  displayName?: string;
  rules: ValidationRule[];
}

export interface TableValidationConfig {
  tableId: string;
  tableName: string;
  columns: ColumnValidationConfig[];
}

export interface ValidationError {
  line: number;
  column: string;
  value: string;
  rule: RuleType;
  message: string;
}

export interface ValidationResult {
  isValid: boolean;
  totalRows: number;
  validRows: number;
  errorRows: number;
  errors: ValidationError[];
  preview?: ParsedRow[];
}

export interface ParsedRow {
  _lineNumber: number;
  _isValid: boolean;
  _errors: ValidationError[];
  [key: string]: unknown;
}

// ==================== FILE PROVIDER ====================

export interface FileInfo {
  name: string;
  size: number;
  path: string;
  lastModified: Date;
  source: FileSource;
}

// ==================== RE-EXPORT ZOHO TYPES ====================
// Pour simplifier les imports dans l'application

export type {
  // OAuth & Connection
  ZohoRegion,
  ZohoTokens,
  ZohoConnectionStatus,
  // API Entities
  ZohoOrganization,
  ZohoWorkspace,
  ZohoTable,
  ZohoFolder,
  ZohoColumn,
  ZohoDataType,
  // Import
  ZohoImportType,
  ZohoImportParams,
  ZohoImportResponse,
  ZohoImportError,
  // Schema Validation (Mission 004)
  FileColumnType,
  ColumnMapping,
  TypeWarning,
  SchemaValidationResult,
  ZohoTableSchema,
  // Errors
  ZohoApiError,
  ZohoAuthError,
} from '@/lib/infrastructure/zoho/types';
export * from './profiles';

// ==================== ROLLBACK & TWO-PHASE IMPORT ====================

/** Configuration de l'import en 2 phases */
export interface TwoPhaseImportConfig {
  testSampleSize: number;        // Défaut: 5
  matchingColumn?: string;       // Auto-détecté ou manuel
  skipVerification?: boolean;    // Passer outre la vérification
}

/** Résultat de l'import test */
export interface TestImportResult {
  success: boolean;
  rowsImported: number;
  matchingColumn: string;
  matchingValues: string[];      // Pour le rollback
  verification: VerificationResult;
  duration: number;
}

/** Configuration du rollback */
export interface RollbackConfig {
  workspaceId: string;
  viewId: string;
  matchingColumn: string;
  matchingValues: string[];
  reason: RollbackReason;
}

export type RollbackReason = 'verification_failed' | 'user_cancelled' | 'error_recovery';

/** Résultat du rollback */
export interface RollbackResult {
  success: boolean;
  deletedRows: number;
  duration: number;
  errorMessage?: string;
  /** Valeurs à supprimer manuellement si échec */
  remainingValues?: string[];
}

/** Statistiques de matching pour sélection manuelle */
export interface ColumnMatchingStats {
  columnName: string;
  uniquePercentage: number;
  nonEmptyCount: number;
  totalCount: number;
  isRecommended: boolean;
  source: 'schema' | 'pattern' | 'content';
}
