// lib/hooks/use-import.ts
// VERSION MODIFIÉE - Avec import en 2 phases et rollback
'use client';

import { useReducer, useCallback, useMemo } from 'react';
import type {
  ImportState,
  ImportStatus,
  ImportMode,
  ImportConfig,
  ValidationResult,
  ImportProgress,
  ImportResult,
  TestImportResult,
} from '@/types';
import type { VerificationResult } from '@/lib/domain/verification';

// ==================== ACTIONS ====================

type ImportAction =
  | { type: 'SET_FILE'; payload: File }
  | { type: 'REMOVE_FILE' }
  | { type: 'SET_TABLE'; payload: { tableId: string; tableName: string } }
  | { type: 'SET_IMPORT_MODE'; payload: ImportMode }
  | { type: 'START_VALIDATION' }
  | { type: 'VALIDATION_SUCCESS'; payload: ValidationResult }
  | { type: 'VALIDATION_ERROR'; payload: string }
  | { type: 'START_IMPORT' }
  | { type: 'START_TEST_IMPORT' }
  | { type: 'TEST_IMPORT_COMPLETE'; payload: TestImportResult }
  | { type: 'START_FULL_IMPORT' }
  | { type: 'UPDATE_PROGRESS'; payload: ImportProgress }
  | { type: 'IMPORT_SUCCESS'; payload: ImportResult }
  | { type: 'IMPORT_ERROR'; payload: string }
  | { type: 'GO_TO_STEP'; payload: ImportStatus }
  | { type: 'RESET' };

// ==================== STATE ÉTENDU ====================

export interface ImportStateExtended extends ImportState {
  testResult: TestImportResult | null;
}

// ==================== INITIAL STATE ====================

const initialConfig: ImportConfig = {
  source: 'upload',
  file: null,
  sftpPath: null,
  tableId: '',
  tableName: '',
  importMode: 'append',
};

const initialState: ImportStateExtended = {
  status: 'selecting',
  config: initialConfig,
  validation: null,
  progress: null,
  result: null,
  error: null,
  testResult: null,
};

// ==================== REDUCER ====================

function importReducer(state: ImportStateExtended, action: ImportAction): ImportStateExtended {
  switch (action.type) {
    case 'SET_FILE':
      return {
        ...state,
        config: {
          ...state.config,
          file: action.payload,
          source: 'upload',
        },
        error: null,
      };

    case 'REMOVE_FILE':
      return {
        ...state,
        config: {
          ...state.config,
          file: null,
        },
        validation: null,
        error: null,
      };

    case 'SET_TABLE':
      return {
        ...state,
        config: {
          ...state.config,
          tableId: action.payload.tableId,
          tableName: action.payload.tableName,
        },
        error: null,
      };

    case 'SET_IMPORT_MODE':
      return {
        ...state,
        config: {
          ...state.config,
          importMode: action.payload,
        },
      };

    case 'START_VALIDATION':
      return {
        ...state,
        status: 'validating',
        validation: null,
        error: null,
        progress: {
          phase: 'validating',
          current: 0,
          total: 100,
          percentage: 0,
        },
      };

    case 'VALIDATION_SUCCESS':
      return {
        ...state,
        status: 'previewing',
        validation: action.payload,
        progress: null,
        error: null,
      };

    case 'VALIDATION_ERROR':
      return {
        ...state,
        status: 'error',
        error: action.payload,
        progress: null,
      };

    // ==================== NOUVEAU : Test Import ====================
    case 'START_TEST_IMPORT':
      return {
        ...state,
        status: 'test-importing',
        error: null,
        testResult: null,
        progress: {
          phase: 'test-importing',
          current: 0,
          total: 100,
          percentage: 0,
        },
      };

    case 'TEST_IMPORT_COMPLETE':
      return {
        ...state,
        status: 'test-result',
        testResult: action.payload,
        progress: null,
        error: null,
      };

    case 'START_FULL_IMPORT':
      return {
        ...state,
        status: 'full-importing',
        error: null,
        progress: {
          phase: 'full-importing',
          current: 0,
          total: 100,
          percentage: 0,
        },
      };
    // ==================== FIN NOUVEAU ====================

    case 'START_IMPORT':
      return {
        ...state,
        status: 'importing',
        error: null,
        progress: {
          phase: 'importing',
          current: 0,
          total: 100,
          percentage: 0,
        },
      };

    case 'UPDATE_PROGRESS':
      return {
        ...state,
        progress: action.payload,
      };

    case 'IMPORT_SUCCESS':
      return {
        ...state,
        status: 'success',
        result: action.payload,
        progress: null,
        error: null,
        testResult: null, // Reset
      };

    case 'IMPORT_ERROR':
      return {
        ...state,
        status: 'error',
        error: action.payload,
        progress: null,
      };

    case 'GO_TO_STEP':
      const targetStatus = action.payload;

      // Vérifications de transition
      if (targetStatus === 'profiling' && !state.config.file) {
        return state;
      }
      if (targetStatus === 'configuring' && !state.config.file) {
        return state;
      }
      if (targetStatus === 'validating' && !state.config.tableId) {
        return state;
      }

      // Si on retourne à previewing après rollback, reset testResult
      if (targetStatus === 'previewing' || targetStatus === 'reviewing') {
        return {
          ...state,
          status: targetStatus,
          error: null,
          testResult: null,
        };
      }

      return {
        ...state,
        status: targetStatus,
        error: null,
      };

    case 'RESET':
      return initialState;

    default:
      return state;
  }
}

// ==================== HOOK ====================

export interface UseImportReturn {
  state: ImportStateExtended;
  setFile: (file: File) => void;
  removeFile: () => void;
  setTable: (tableId: string, tableName: string) => void;
  setImportMode: (mode: ImportMode) => void;
  startValidation: () => void;
  setValidationResult: (result: ValidationResult) => void;
  setValidationError: (error: string) => void;
  startImport: () => void;
  startTestImport: () => void;
  setTestImportComplete: (result: TestImportResult) => void;
  startFullImport: () => void;
  updateProgress: (progress: ImportProgress) => void;
  setImportSuccess: (result: ImportResult) => void;
  setImportError: (error: string) => void;
  goToStep: (status: ImportStatus) => void;
  goNext: () => void;
  goBack: () => void;
  reset: () => void;
  currentStepIndex: number;
  canGoNext: boolean;
  canGoBack: boolean;
  isValidating: boolean;
  isImporting: boolean;
  isTestImporting: boolean;
  hasErrors: boolean;
}

// Ordre des étapes avec les nouvelles
const STEP_ORDER: ImportStatus[] = [
  'selecting',
  'profiling',
  'configuring',
  'validating',
  'previewing',
  'reviewing',
  'test-importing',
  'test-result',
  'full-importing',
  'success',
];

export function useImport(): UseImportReturn {
  const [state, dispatch] = useReducer(importReducer, initialState);

  // Actions fichier
  const setFile = useCallback((file: File) => {
    dispatch({ type: 'SET_FILE', payload: file });
  }, []);

  const removeFile = useCallback(() => {
    dispatch({ type: 'REMOVE_FILE' });
  }, []);

  // Actions config
  const setTable = useCallback((tableId: string, tableName: string) => {
    dispatch({ type: 'SET_TABLE', payload: { tableId, tableName } });
  }, []);

  const setImportMode = useCallback((mode: ImportMode) => {
    dispatch({ type: 'SET_IMPORT_MODE', payload: mode });
  }, []);

  // Actions validation
  const startValidation = useCallback(() => {
    dispatch({ type: 'START_VALIDATION' });
  }, []);

  const setValidationResult = useCallback((result: ValidationResult) => {
    dispatch({ type: 'VALIDATION_SUCCESS', payload: result });
  }, []);

  const setValidationError = useCallback((error: string) => {
    dispatch({ type: 'VALIDATION_ERROR', payload: error });
  }, []);

  // Actions import classique
  const startImport = useCallback(() => {
    dispatch({ type: 'START_IMPORT' });
  }, []);

  // ==================== NOUVEAU : Actions 2 phases ====================
  const startTestImport = useCallback(() => {
    dispatch({ type: 'START_TEST_IMPORT' });
  }, []);

  const setTestImportComplete = useCallback((result: TestImportResult) => {
    dispatch({ type: 'TEST_IMPORT_COMPLETE', payload: result });
  }, []);

  const startFullImport = useCallback(() => {
    dispatch({ type: 'START_FULL_IMPORT' });
  }, []);
  // ==================== FIN NOUVEAU ====================

  const updateProgress = useCallback((progress: ImportProgress) => {
    dispatch({ type: 'UPDATE_PROGRESS', payload: progress });
  }, []);

  const setImportSuccess = useCallback((result: ImportResult) => {
    dispatch({ type: 'IMPORT_SUCCESS', payload: result });
  }, []);

  const setImportError = useCallback((error: string) => {
    dispatch({ type: 'IMPORT_ERROR', payload: error });
  }, []);

  // Navigation
  const goToStep = useCallback((status: ImportStatus) => {
    dispatch({ type: 'GO_TO_STEP', payload: status });
  }, []);

  const reset = useCallback(() => {
    dispatch({ type: 'RESET' });
  }, []);

  // Computed values
  const currentStepIndex = useMemo(() => {
    const index = STEP_ORDER.indexOf(state.status);
    return index === -1 ? 0 : index;
  }, [state.status]);

  const canGoNext = useMemo(() => {
    switch (state.status) {
      case 'selecting':
        return !!state.config.file;
      case 'profiling':
        return true;
      case 'configuring':
        return !!state.config.tableId;
      case 'previewing':
        return true;
      case 'reviewing':
        return state.validation?.isValid ?? false;
      case 'test-result':
        return state.testResult?.success ?? false;
      default:
        return false;
    }
  }, [state.status, state.config.file, state.config.tableId, state.validation, state.testResult]);

  const canGoBack = useMemo(() => {
    return ['profiling', 'configuring', 'previewing', 'reviewing', 'test-result', 'error'].includes(state.status);
  }, [state.status]);

  const goNext = useCallback(() => {
    if (!canGoNext) return;

    switch (state.status) {
      case 'selecting':
        goToStep('profiling');
        break;
      case 'profiling':
        goToStep('configuring');
        break;
      case 'configuring':
        goToStep('validating');
        break;
      case 'previewing':
        goToStep('reviewing');
        break;
      case 'reviewing':
        // Après reviewing, on lance le test import (géré par le wizard)
        break;
      case 'test-result':
        // Après test-result OK, on lance full import (géré par le wizard)
        break;
    }
  }, [state.status, canGoNext, goToStep]);

  const goBack = useCallback(() => {
    if (!canGoBack) return;

    switch (state.status) {
      case 'profiling':
        goToStep('selecting');
        break;
      case 'configuring':
        goToStep('profiling');
        break;
      case 'previewing':
        goToStep('configuring');
        break;
      case 'reviewing':
      case 'error':
        goToStep('previewing');
        break;
      case 'test-result':
        // Retour après rollback → reviewing pour modifier
        goToStep('reviewing');
        break;
    }
  }, [state.status, canGoBack, goToStep]);

  const isValidating = state.status === 'validating';
  const isImporting = state.status === 'importing' || state.status === 'full-importing';
  const isTestImporting = state.status === 'test-importing';
  const hasErrors = (state.validation?.errorRows ?? 0) > 0;

  return {
    state,
    setFile,
    removeFile,
    setTable,
    setImportMode,
    startValidation,
    setValidationResult,
    setValidationError,
    startImport,
    startTestImport,
    setTestImportComplete,
    startFullImport,
    updateProgress,
    setImportSuccess,
    setImportError,
    goToStep,
    goNext,
    goBack,
    reset,
    currentStepIndex,
    canGoNext,
    canGoBack,
    isValidating,
    isImporting,
    isTestImporting,
    hasErrors,
  };
}
