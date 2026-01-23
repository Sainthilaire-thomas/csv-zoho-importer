// components/import/wizard/hooks/use-test-import.ts
'use client';

import { useCallback } from 'react';
import Papa from 'papaparse';
import { toast } from 'sonner';
import { verifyImport, findBestMatchingColumnEnhanced } from '@/lib/domain/verification';
import type { SentRow, VerificationResult } from '@/lib/domain/verification';
import { executeRollback, type RollbackResult } from '@/lib/domain/rollback';
import { checkSyncBeforeImport, updateSyncAfterImport } from '@/lib/domain/rowid-sync';
import type { ImportProfile } from '@/types/profiles';
import type { ZohoColumn } from '@/lib/infrastructure/zoho/types';
import type { TestImportState, RowIdState } from './use-import-wizard-state';
import type { TestImportResult, ValidationResult, ImportMode, ImportStatus } from '@/types';
// ============================================================================
// Types
// ============================================================================

export interface TestImportConfig {
  /** État du test import (depuis useImportWizardState) */
  testImportState: TestImportState;
  /** État RowID (depuis useImportWizardState) */
  rowIdState: RowIdState;
  /** Données parsées et transformées */
  parsedData: Record<string, unknown>[] | null;
  /** Résultat de validation */
  validation: ValidationResult | null;
  /** Configuration de l'import */
  importConfig: {
    tableId: string;
    tableName: string;
    importMode: ImportMode;  // ← Changer string en ImportMode
    file: File | null;
  };
 /** ID du workspace */
  workspaceId: string;
  /** Nom du workspace (pour API v1 CloudSQL) */
  workspaceName: string;
  /** Colonnes de matching pour l'import */
  matchingColumns: string[];
  /** Profil sélectionné (optionnel) */
  selectedProfile: ImportProfile | null;
  /** Schéma Zoho (colonnes) */
  zohoColumns: ZohoColumn[] | undefined;
  /** Fonction pour obtenir les types de colonnes */
  getColumnTypesFromSchema: () => Record<string, string> | undefined;
  /** Callbacks du hook useImport */
  importActions: {
  startTestImport: () => void;
  setTestImportComplete: (result: TestImportResult) => void;
  setImportError: (error: string) => void;
  goToStep: (step: ImportStatus) => void;
};
}

export interface TestImportActions {
  /** Prépare et lance l'import test */
  handleStartTestImport: () => Promise<void>;
  /** Exécute l'import de l'échantillon */
  executeTestImport: () => Promise<{ success: boolean; error?: string }>;
  /** Exécute la vérification après import */
  executeTestVerification: () => Promise<{ success: boolean; error?: string }>;
  /** Callback quand le test est terminé */
  handleTestComplete: (success: boolean) => void;
  /** Callback en cas d'erreur */
  handleTestError: (error: string) => void;
  /** Exécute le rollback */
  handleRollback: () => Promise<RollbackResult>;
  /** Callback après resync manuelle */
  handleRowIdResync: (rowId: number) => Promise<void>;
  /** Annulation du dialog de resync */
  handleRowIdResyncCancel: () => void;
}

// ============================================================================
// Hook
// ============================================================================

export function useTestImport(config: TestImportConfig): TestImportActions {
    const {
    testImportState,
    rowIdState,
    parsedData,
    validation,
    importConfig,
    workspaceId,
    workspaceName,  // ← AJOUTER
    matchingColumns,
    selectedProfile,
    zohoColumns,
    getColumnTypesFromSchema,
    importActions,
  } = config;

  // ─────────────────────────────────────────────────────────────────────────
  // Helper : Filtrer les données valides
  // ─────────────────────────────────────────────────────────────────────────
  const getValidData = useCallback(() => {
    if (!parsedData || !validation) return [];
    
    return parsedData.filter((_, index) => {
      const lineNumber = index + 2;
      return !validation.errors.some((err) => err.line === lineNumber);
    });
  }, [parsedData, validation]);

  // ─────────────────────────────────────────────────────────────────────────
  // Helper : Construire l'échantillon pour vérification
  // ─────────────────────────────────────────────────────────────────────────
  const buildSampleRows = useCallback((data: Record<string, unknown>[], size: number): SentRow[] => {
    return data.slice(0, size).map((row, index) => ({
      index: index + 2, // +2 car ligne 1 = headers, index 0 = ligne 2
      data: Object.fromEntries(
        Object.entries(row).map(([k, v]) => [k, String(v ?? '')])
      ) as Record<string, string>,
    }));
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // Helper : Détecter la colonne de matching
  // ─────────────────────────────────────────────────────────────────────────
  const detectMatchingColumn = useCallback((sampleRows: SentRow[]): string | null => {
    if (testImportState.verificationColumn) {
      return testImportState.verificationColumn;
    }

    if (sampleRows.length === 0) return null;

    const result = findBestMatchingColumnEnhanced(sampleRows, {
      profile: selectedProfile || undefined,
      zohoSchema: zohoColumns,
    });

    testImportState.setMatchingColumnResult(result);
    testImportState.setVerificationColumn(result.column || null);
    testImportState.verificationColumnRef.current = result.column || null;

    console.log('[TestImport] Detected matching column:', result.column);
    return result.column || null;
  }, [testImportState, selectedProfile, zohoColumns]);

  // ─────────────────────────────────────────────────────────────────────────
  // Prépare et lance l'import test
  // ─────────────────────────────────────────────────────────────────────────
  const handleStartTestImport = useCallback(async () => {
    if (!parsedData || !importConfig.tableId || !validation) return;

    // ───────────────────────────────────────────────────────────────────────
    // Vérifier la synchronisation RowID avant l'import
    // ───────────────────────────────────────────────────────────────────────
    if (importConfig.tableName && workspaceId) {
      try {
        console.log('[TestImport] Checking RowID sync...');
        const syncCheck = await checkSyncBeforeImport(
          importConfig.tableId,
          importConfig.tableName,
          workspaceId,
          workspaceName
        );

        rowIdState.setSyncCheck(syncCheck);
        console.log('[TestImport] Sync check result:', syncCheck);

        if (syncCheck.needsResync) {
          // Afficher le dialog de resync
          rowIdState.setShowSyncDialog(true);
          return; // Ne pas continuer tant que l'utilisateur n'a pas resync
        }

        // Utiliser le RowID de début
        const startRowId = syncCheck.actualStartRowId ?? syncCheck.estimatedStartRowId;
        rowIdState.setRowIdStartForImport(startRowId);
        rowIdState.rowIdStartForImportRef.current = startRowId;

        // Aussi mettre à jour maxRowIdBeforeTest pour compatibilité
        rowIdState.setMaxRowIdBeforeTest(startRowId - 1);
        rowIdState.maxRowIdBeforeTestRef.current = startRowId - 1;

        console.log('[TestImport] RowID start for import:', startRowId);

        if (syncCheck.message && syncCheck.message !== 'Synchronisation OK') {
          toast.info(syncCheck.message);
        }
      } catch (error) {
        console.warn('[TestImport] Sync check failed, continuing without RowID tracking:', error);
        rowIdState.setRowIdStartForImport(null);
        rowIdState.rowIdStartForImportRef.current = null;
      }
    }

    // ───────────────────────────────────────────────────────────────────────
    // Détecter la colonne de matching si pas encore fait
    // ───────────────────────────────────────────────────────────────────────
    if (!testImportState.verificationColumn && testImportState.verificationSample.length > 0) {
      detectMatchingColumn(testImportState.verificationSample);
    }

    importActions.startTestImport();
  }, [
    parsedData,
    importConfig,
    validation,
    workspaceId,
    rowIdState,
    testImportState,
    detectMatchingColumn,
    importActions,
  ]);

  // ─────────────────────────────────────────────────────────────────────────
  // Callback après resynchronisation manuelle
  // ─────────────────────────────────────────────────────────────────────────
  const handleRowIdResync = useCallback(async (rowId: number) => {
    if (!importConfig.tableId || !importConfig.tableName || !workspaceId) {
      throw new Error('Configuration manquante');
    }

    // Sauvegarder la resync dans Supabase
    await updateSyncAfterImport({
      zohoTableId: importConfig.tableId,
      tableName: importConfig.tableName,
      workspaceId: workspaceId,
      lastKnownRowid: rowId,
      source: 'manual',
    });

    // Mettre à jour les états locaux
    const startRowId = rowId + 1;
    rowIdState.setRowIdStartForImport(startRowId);
    rowIdState.rowIdStartForImportRef.current = startRowId;
    rowIdState.setMaxRowIdBeforeTest(rowId);
    rowIdState.maxRowIdBeforeTestRef.current = rowId;

    rowIdState.setShowSyncDialog(false);
    toast.success('Synchronisation effectuée');

    // Détecter la colonne de matching
    if (!testImportState.verificationColumn && testImportState.verificationSample.length > 0) {
      detectMatchingColumn(testImportState.verificationSample);
    }

    importActions.startTestImport();
  }, [importConfig, workspaceId, rowIdState, testImportState, detectMatchingColumn, importActions]);

  // ─────────────────────────────────────────────────────────────────────────
  // Annulation du dialog de resync
  // ─────────────────────────────────────────────────────────────────────────
  const handleRowIdResyncCancel = useCallback(() => {
    rowIdState.setShowSyncDialog(false);
    toast.info('Import annulé');
  }, [rowIdState]);

  // ─────────────────────────────────────────────────────────────────────────
  // Exécute l'import de l'échantillon test
  // ─────────────────────────────────────────────────────────────────────────
  const executeTestImport = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
    if (!parsedData || !importConfig.tableId) {
      return { success: false, error: 'Données manquantes' };
    }

    try {
      const validData = getValidData();
      const sampleData = validData.slice(0, testImportState.sampleSize);
      const sampleRows = buildSampleRows(sampleData, testImportState.sampleSize);

      // Détecter la colonne de matching
      let matchingCol = testImportState.verificationColumn;
      if (!matchingCol && sampleRows.length > 0) {
        matchingCol = detectMatchingColumn(sampleRows);
      }

      // Sauvegarder les valeurs de matching pour le rollback
      if (matchingCol) {
        const values = sampleRows
          .map(row => String(row.data[matchingCol!] ?? '').trim())
          .filter(v => v !== '');
        testImportState.setTestMatchingValues(values);
        testImportState.testMatchingValuesRef.current = values;
        console.log('[TestImport] Matching values:', values);
      }

      // Stocker l'échantillon
      testImportState.setVerificationSample(sampleRows);
      testImportState.verificationSampleRef.current = sampleRows;

      // Le tableName pour la vérification
      rowIdState.setTableName(importConfig.tableName || null);

      console.log('[TestImport] Using pre-calculated RowID start:', rowIdState.rowIdStartForImportRef.current);

      // Convertir en CSV
      const csvData = Papa.unparse(sampleData);

      // Envoyer à Zoho
      const response = await fetch('/api/zoho/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId,
          tableId: importConfig.tableId,
          tableName: importConfig.tableName,
          importMode: importConfig.importMode,
          csvData,
          fileName: importConfig.file?.name,
          totalRows: sampleData.length,
          matchingColumns: matchingColumns.length > 0 ? matchingColumns : undefined,
          columnTypes: getColumnTypesFromSchema(),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        return { success: false, error: result.error || "Erreur lors de l'import test" };
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
      };
    }
  }, [
    parsedData,
    importConfig,
    workspaceId,
    matchingColumns,
    testImportState,
    rowIdState,
    getValidData,
    buildSampleRows,
    detectMatchingColumn,
    getColumnTypesFromSchema,
  ]);

  // ─────────────────────────────────────────────────────────────────────────
  // Exécute la vérification après import test
  // ─────────────────────────────────────────────────────────────────────────
  const executeTestVerification = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
    // Utiliser la ref pour accès immédiat
    const sampleToVerify = testImportState.verificationSampleRef.current;

    if (sampleToVerify.length === 0) {
      return { success: false, error: "Pas d'échantillon à vérifier" };
    }

    try {
      const verificationResult: VerificationResult = await verifyImport(sampleToVerify, {
        mode: importConfig.importMode,
        matchingColumn: testImportState.verificationColumnRef.current || undefined,
        sampleSize: sampleToVerify.length,
        workspaceId,
        viewId: importConfig.tableId,
        delayBeforeRead: 2000,
        tableName: rowIdState.tableName || importConfig.tableName || undefined,
        maxRowIdBeforeImport: rowIdState.maxRowIdBeforeTestRef.current ?? undefined,
      });

      // Créer le résultat du test
      const testResult: TestImportResult = {
        success: verificationResult.success,
        rowsImported: sampleToVerify.length,
        matchingColumn: testImportState.verificationColumn || '',
        matchingValues: testImportState.testMatchingValues,
        verification: verificationResult,
        duration: verificationResult.duration,
      };

      importActions.setTestImportComplete(testResult);

      return {
        success: verificationResult.success,
        error: verificationResult.success ? undefined : 'Anomalies détectées',
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur de vérification',
      };
    }
  }, [importConfig, workspaceId, testImportState, rowIdState, importActions]);

  // ─────────────────────────────────────────────────────────────────────────
  // Callback quand le test est terminé
  // ─────────────────────────────────────────────────────────────────────────
  const handleTestComplete = useCallback((success: boolean) => {
    console.log('[TestImport] Test import complete, success:', success);
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // Callback en cas d'erreur
  // ─────────────────────────────────────────────────────────────────────────
  const handleTestError = useCallback((error: string) => {
    importActions.setImportError(error);
  }, [importActions]);

  // ─────────────────────────────────────────────────────────────────────────
  // Exécute le rollback
  // ─────────────────────────────────────────────────────────────────────────
  const handleRollback = useCallback(async (): Promise<RollbackResult> => {
    // Déterminer la stratégie selon le mode d'import
    const mode = importConfig.importMode;
    const useRowIdStrategy =
      (mode === 'append' || mode === 'truncateadd' || mode === 'onlyadd') &&
      rowIdState.maxRowIdBeforeTestRef.current !== null;

    console.log('[Rollback] Strategy:', useRowIdStrategy ? 'rowid' : 'matching_key');

    if (useRowIdStrategy) {
      // ─────────────────────────────────────────────────────────────────────
      // Stratégie RowID : Supprimer les lignes avec RowID > maxRowIdBeforeTest
      // ─────────────────────────────────────────────────────────────────────
      console.log('[Rollback] Using RowID strategy, deleting rows after:', rowIdState.maxRowIdBeforeTestRef.current);

      const result = await executeRollback({
        workspaceId,
        viewId: importConfig.tableId,
        tableName: rowIdState.tableName || importConfig.tableName || undefined,
        rowIdRange: { min: rowIdState.maxRowIdBeforeTestRef.current! },
        reason: 'user_cancelled',
      });

      if (result.success) {
        toast.success(`${result.deletedRows} lignes supprimées de Zoho`);
        importActions.goToStep('previewing');
        
        // Reset les états
        testImportState.resetTestImport();
        rowIdState.setMaxRowIdBeforeTest(null);
        rowIdState.maxRowIdBeforeTestRef.current = null;
      }

      return result;
    } else {
      // ─────────────────────────────────────────────────────────────────────
      // Stratégie matching_key : Comportement existant
      // ─────────────────────────────────────────────────────────────────────
      const column = testImportState.verificationColumnRef.current;
      const values = testImportState.testMatchingValuesRef.current;

      console.log('[Rollback] Using matching_key strategy:', { column, values });

      if (!column || values.length === 0) {
        return {
          success: false,
          deletedRows: 0,
          duration: 0,
          errorMessage: 'Pas de données à supprimer',
          remainingValues: values,
        };
      }

      const result = await executeRollback({
        workspaceId,
        viewId: importConfig.tableId,
        matchingColumn: column,
        matchingValues: values,
        reason: 'user_cancelled',
      });

      if (result.success) {
        toast.success(`${result.deletedRows} lignes supprimées de Zoho`);
        importActions.goToStep('previewing');
        
        // Reset les états
        testImportState.resetTestImport();
      }

      return result;
    }
  }, [workspaceId, importConfig, rowIdState, testImportState, importActions]);

  return {
    handleStartTestImport,
    executeTestImport,
    executeTestVerification,
    handleTestComplete,
    handleTestError,
    handleRollback,
    handleRowIdResync,
    handleRowIdResyncCancel,
  };
}
