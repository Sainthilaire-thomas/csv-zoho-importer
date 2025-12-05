// types/index.ts

// ==================== IMPORT ====================

export type ImportStatus =
  | 'selecting'
  | 'profiling'     // ← AJOUTER
  | 'configuring'
  | 'validating'
  | 'previewing'
  | 'reviewing'
  | 'importing'
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
  phase: 'parsing' | 'validating' | 'importing';
  current: number;
  total: number;
  percentage: number;
}

export interface ImportResult {
  success: boolean;
  importId: string;
  rowsImported: number;
  duration: number;
  zohoImportId?: string;
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
