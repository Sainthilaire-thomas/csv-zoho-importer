// components/import/wizard/hooks/use-import-wizard-state.ts
'use client';

import { useState, useRef, useCallback } from 'react';
import type { SchemaValidationResult, ZohoTableSchema, ResolvableIssue } from '@/lib/infrastructure/zoho/types';
import type { ImportProfile, ProfileMatchResult, DetectedColumn } from '@/types/profiles';
import type { SentRow, MatchingColumnResult } from '@/lib/domain/verification';
import type { PreImportCheckResult } from '@/lib/domain/rowid-sync/types';

// ============================================================================
// Types
// ============================================================================

export type ProfileMode = 'existing' | 'new' | 'skip';

export interface ZohoWorkspace {
  id: string;
  name: string;
}

export interface WorkspacesState {
  workspaces: ZohoWorkspace[];
  isLoading: boolean;
  error: string | null;
  selectedId: string;
  setWorkspaces: (workspaces: ZohoWorkspace[]) => void;
  setIsLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setSelectedId: (id: string) => void;
}

export interface SchemaState {
  parsedData: Record<string, unknown>[] | null;
  schemaValidation: SchemaValidationResult | null;
  zohoSchema: ZohoTableSchema | null;
  zohoReferenceRow: Record<string, unknown> | null;
  setParsedData: (data: Record<string, unknown>[] | null) => void;
  setSchemaValidation: (result: SchemaValidationResult | null) => void;
  setZohoSchema: (schema: ZohoTableSchema | null) => void;
  setZohoReferenceRow: (row: Record<string, unknown> | null) => void;
}

export interface IssuesState {
  resolvedIssues: ResolvableIssue[] | null;
  issuesResolved: boolean;
  setResolvedIssues: (issues: ResolvableIssue[] | null) => void;
  setIssuesResolved: (resolved: boolean) => void;
  resetIssues: () => void;
}

export interface ProfileState {
  mode: ProfileMode;
  selectedProfile: ImportProfile | null;
  selectedMatchResult: ProfileMatchResult | null;
  detectedColumns: DetectedColumn[];
  matchingColumns: string[];
  setMode: (mode: ProfileMode) => void;
  setSelectedProfile: (profile: ImportProfile | null) => void;
  setSelectedMatchResult: (result: ProfileMatchResult | null) => void;
  setDetectedColumns: (columns: DetectedColumn[]) => void;
  setMatchingColumns: (columns: string[]) => void;
  resetProfile: () => void;
}

export interface TestImportState {
  sampleSize: number;
  verificationColumn: string | null;
  matchingColumnResult: MatchingColumnResult | null;
  testMatchingValues: string[];
  verificationSample: SentRow[];
  // Refs pour accès immédiat (évite délai setState)
  verificationSampleRef: React.MutableRefObject<SentRow[]>;
  verificationColumnRef: React.MutableRefObject<string | null>;
  testMatchingValuesRef: React.MutableRefObject<string[]>;
  setSampleSize: (size: number) => void;
  setVerificationColumn: (column: string | null) => void;
  setMatchingColumnResult: (result: MatchingColumnResult | null) => void;
  setTestMatchingValues: (values: string[]) => void;
  setVerificationSample: (sample: SentRow[]) => void;
  resetTestImport: () => void;
}

export interface RowIdState {
  maxRowIdBeforeTest: number | null;
  tableName: string | null;
  syncCheck: PreImportCheckResult | null;
  showSyncDialog: boolean;
  rowIdStartForImport: number | null;
  // Refs pour accès immédiat
  maxRowIdBeforeTestRef: React.MutableRefObject<number | null>;
  rowIdStartForImportRef: React.MutableRefObject<number | null>;
  setMaxRowIdBeforeTest: (rowId: number | null) => void;
  setTableName: (name: string | null) => void;
  setSyncCheck: (check: PreImportCheckResult | null) => void;
  setShowSyncDialog: (show: boolean) => void;
  setRowIdStartForImport: (rowId: number | null) => void;
  resetRowId: () => void;
}

export interface ImportWizardState {
  workspaces: WorkspacesState;
  schema: SchemaState;
  issues: IssuesState;
  profile: ProfileState;
  testImport: TestImportState;
  rowId: RowIdState;
  resetAll: () => void;
}

// ============================================================================
// Hook principal
// ============================================================================

export function useImportWizardState(): ImportWizardState {
  // ─────────────────────────────────────────────────────────────────────────
  // Workspaces
  // ─────────────────────────────────────────────────────────────────────────
  const [workspaces, setWorkspaces] = useState<ZohoWorkspace[]>([]);
  const [isLoadingWorkspaces, setIsLoadingWorkspaces] = useState(false);
  const [workspacesError, setWorkspacesError] = useState<string | null>(null);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string>('');

  // ─────────────────────────────────────────────────────────────────────────
  // Schema & Parsed Data
  // ─────────────────────────────────────────────────────────────────────────
  const [parsedData, setParsedData] = useState<Record<string, unknown>[] | null>(null);
  const [schemaValidation, setSchemaValidation] = useState<SchemaValidationResult | null>(null);
  const [zohoSchema, setZohoSchema] = useState<ZohoTableSchema | null>(null);
  const [zohoReferenceRow, setZohoReferenceRow] = useState<Record<string, unknown> | null>(null);

  // ─────────────────────────────────────────────────────────────────────────
  // Issues Resolution
  // ─────────────────────────────────────────────────────────────────────────
  const [resolvedIssues, setResolvedIssues] = useState<ResolvableIssue[] | null>(null);
  const [issuesResolved, setIssuesResolved] = useState(false);

  const resetIssues = useCallback(() => {
    setResolvedIssues(null);
    setIssuesResolved(false);
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // Profile
  // ─────────────────────────────────────────────────────────────────────────
  const [profileMode, setProfileMode] = useState<ProfileMode>('skip');
  const [selectedProfile, setSelectedProfile] = useState<ImportProfile | null>(null);
  const [selectedMatchResult, setSelectedMatchResult] = useState<ProfileMatchResult | null>(null);
  const [detectedColumns, setDetectedColumns] = useState<DetectedColumn[]>([]);
  const [matchingColumns, setMatchingColumns] = useState<string[]>([]);

  const resetProfile = useCallback(() => {
    setProfileMode('skip');
    setSelectedProfile(null);
    setSelectedMatchResult(null);
    setDetectedColumns([]);
    setMatchingColumns([]);
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // Test Import (2 phases)
  // ─────────────────────────────────────────────────────────────────────────
  const [testSampleSize, setTestSampleSize] = useState(5);
  const [verificationColumn, setVerificationColumn] = useState<string | null>(null);
  const [matchingColumnResult, setMatchingColumnResult] = useState<MatchingColumnResult | null>(null);
  const [testMatchingValues, setTestMatchingValues] = useState<string[]>([]);
  const [verificationSample, setVerificationSample] = useState<SentRow[]>([]);

  // Refs pour accès immédiat
  const verificationSampleRef = useRef<SentRow[]>([]);
  const verificationColumnRef = useRef<string | null>(null);
  const testMatchingValuesRef = useRef<string[]>([]);

  const resetTestImport = useCallback(() => {
    setTestSampleSize(5);
    setVerificationColumn(null);
    verificationColumnRef.current = null;
    setMatchingColumnResult(null);
    setTestMatchingValues([]);
    testMatchingValuesRef.current = [];
    setVerificationSample([]);
    verificationSampleRef.current = [];
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // RowID Sync (Mission 012-013)
  // ─────────────────────────────────────────────────────────────────────────
  const [maxRowIdBeforeTest, setMaxRowIdBeforeTest] = useState<number | null>(null);
  const [tableName, setTableName] = useState<string | null>(null);
  const [rowIdSyncCheck, setRowIdSyncCheck] = useState<PreImportCheckResult | null>(null);
  const [showRowIdSyncDialog, setShowRowIdSyncDialog] = useState(false);
  const [rowIdStartForImport, setRowIdStartForImport] = useState<number | null>(null);

  // Refs pour accès immédiat
  const maxRowIdBeforeTestRef = useRef<number | null>(null);
  const rowIdStartForImportRef = useRef<number | null>(null);

  const resetRowId = useCallback(() => {
    setMaxRowIdBeforeTest(null);
    maxRowIdBeforeTestRef.current = null;
    setTableName(null);
    setRowIdSyncCheck(null);
    setShowRowIdSyncDialog(false);
    setRowIdStartForImport(null);
    rowIdStartForImportRef.current = null;
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // Reset All
  // ─────────────────────────────────────────────────────────────────────────
  const resetAll = useCallback(() => {
    // Schema
    setParsedData(null);
    setSchemaValidation(null);
    setZohoSchema(null);
    setZohoReferenceRow(null);
    // Issues
    resetIssues();
    // Profile
    resetProfile();
    // Test Import
    resetTestImport();
    // RowID
    resetRowId();
  }, [resetIssues, resetProfile, resetTestImport, resetRowId]);

  // ─────────────────────────────────────────────────────────────────────────
  // Return structured state
  // ─────────────────────────────────────────────────────────────────────────
  return {
    workspaces: {
      workspaces,
      isLoading: isLoadingWorkspaces,
      error: workspacesError,
      selectedId: selectedWorkspaceId,
      setWorkspaces,
      setIsLoading: setIsLoadingWorkspaces,
      setError: setWorkspacesError,
      setSelectedId: setSelectedWorkspaceId,
    },

    schema: {
      parsedData,
      schemaValidation,
      zohoSchema,
      zohoReferenceRow,
      setParsedData,
      setSchemaValidation,
      setZohoSchema,
      setZohoReferenceRow,
    },

    issues: {
      resolvedIssues,
      issuesResolved,
      setResolvedIssues,
      setIssuesResolved,
      resetIssues,
    },

    profile: {
      mode: profileMode,
      selectedProfile,
      selectedMatchResult,
      detectedColumns,
      matchingColumns,
      setMode: setProfileMode,
      setSelectedProfile,
      setSelectedMatchResult,
      setDetectedColumns,
      setMatchingColumns,
      resetProfile,
    },

    testImport: {
      sampleSize: testSampleSize,
      verificationColumn,
      matchingColumnResult,
      testMatchingValues,
      verificationSample,
      verificationSampleRef,
      verificationColumnRef,
      testMatchingValuesRef,
      setSampleSize: setTestSampleSize,
      setVerificationColumn,
      setMatchingColumnResult,
      setTestMatchingValues,
      setVerificationSample,
      resetTestImport,
    },

    rowId: {
      maxRowIdBeforeTest,
      tableName,
      syncCheck: rowIdSyncCheck,
      showSyncDialog: showRowIdSyncDialog,
      rowIdStartForImport,
      maxRowIdBeforeTestRef,
      rowIdStartForImportRef,
      setMaxRowIdBeforeTest,
      setTableName,
      setSyncCheck: setRowIdSyncCheck,
      setShowSyncDialog: setShowRowIdSyncDialog,
      setRowIdStartForImport,
      resetRowId,
    },

    resetAll,
  };
}
