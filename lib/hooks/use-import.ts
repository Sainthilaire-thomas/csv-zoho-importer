// lib/hooks/use-import.ts
// VERSION MODIFIÉE - Avec étape Profil et Preview
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
} from '@/types';

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
  | { type: 'UPDATE_PROGRESS'; payload: ImportProgress }
  | { type: 'IMPORT_SUCCESS'; payload: ImportResult }
  | { type: 'IMPORT_ERROR'; payload: string }
  | { type: 'GO_TO_STEP'; payload: ImportStatus }
  | { type: 'RESET' };

// ==================== INITIAL STATE ====================

const initialConfig: ImportConfig = {
  source: 'upload',
  file: null,
  sftpPath: null,
  tableId: '',
  tableName: '',
  importMode: 'append',
};

const initialState: ImportState = {
  status: 'selecting',
  config: initialConfig,
  validation: null,
  progress: null,
  result: null,
  error: null,
};

// ==================== REDUCER ====================

function importReducer(state: ImportState, action: ImportAction): ImportState {
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
        status: 'previewing',  // ← MODIFIÉ : passe à previewing au lieu de reviewing
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
  state: ImportState;
  setFile: (file: File) => void;
  removeFile: () => void;
  setTable: (tableId: string, tableName: string) => void;
  setImportMode: (mode: ImportMode) => void;
  startValidation: () => void;
  setValidationResult: (result: ValidationResult) => void;
  setValidationError: (error: string) => void;
  startImport: () => void;
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
  hasErrors: boolean;
}

// ============================================================================
// MODIFIÉ : Ordre des étapes avec 'profiling' et 'previewing'
// ============================================================================
const STEP_ORDER: ImportStatus[] = [
  'selecting',
  'profiling',
  'configuring',
  'validating',
  'previewing',  // ← NOUVEAU
  'reviewing',
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

  // Actions import
  const startImport = useCallback(() => {
    dispatch({ type: 'START_IMPORT' });
  }, []);

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

  // ============================================================================
  // MODIFIÉ : canGoNext avec étape previewing
  // ============================================================================
  const canGoNext = useMemo(() => {
    switch (state.status) {
      case 'selecting':
        return !!state.config.file;
      case 'profiling':
        return true;
      case 'configuring':
        return !!state.config.tableId;
      case 'previewing':  // ← NOUVEAU
        return true;
      case 'reviewing':
        return state.validation?.isValid ?? false;
      default:
        return false;
    }
  }, [state.status, state.config.file, state.config.tableId, state.validation]);

  // ============================================================================
  // MODIFIÉ : canGoBack avec étape previewing
  // ============================================================================
  const canGoBack = useMemo(() => {
    return ['profiling', 'configuring', 'previewing', 'reviewing', 'error'].includes(state.status);
  }, [state.status]);

  // ============================================================================
  // MODIFIÉ : goNext avec étape previewing
  // ============================================================================
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
      case 'previewing':  // ← NOUVEAU
        goToStep('reviewing');
        break;
      case 'reviewing':
        break;
    }
  }, [state.status, canGoNext, goToStep]);

  // ============================================================================
  // MODIFIÉ : goBack avec étape previewing
  // ============================================================================
  const goBack = useCallback(() => {
    if (!canGoBack) return;

    switch (state.status) {
      case 'profiling':
        goToStep('selecting');
        break;
      case 'configuring':
        goToStep('profiling');
        break;
      case 'previewing':  // ← NOUVEAU
        goToStep('configuring');
        break;
      case 'reviewing':
      case 'error':
        goToStep('previewing');  // ← MODIFIÉ : retour vers previewing
        break;
    }
  }, [state.status, canGoBack, goToStep]);

  const isValidating = state.status === 'validating';
  const isImporting = state.status === 'importing';
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
    hasErrors,
  };
}
