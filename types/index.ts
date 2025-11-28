// types/index.ts

// ==================== IMPORT ====================

export type ImportStatus =
  | 'idle'
  | 'selecting'
  | 'configuring'
  | 'validating'
  | 'reviewing'
  | 'importing'
  | 'success'
  | 'error';

export type ImportMode = 'append' | 'replace';

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

// ==================== ZOHO ====================

export interface ZohoTable {
  id: string;
  zohoTableId: string;
  name: string;
  displayName: string;
  workspaceId: string;
  columns: ZohoColumn[];
  isActive: boolean;
}

export interface ZohoColumn {
  name: string;
  displayName: string;
  dataType: 'text' | 'number' | 'date' | 'boolean' | 'email';
  isRequired: boolean;
}

// ==================== FILE PROVIDER ====================

export interface FileInfo {
  name: string;
  size: number;
  path: string;
  lastModified: Date;
  source: FileSource;
}
