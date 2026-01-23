// components/import/wizard/hooks/use-chunked-import.ts
'use client';

import { useCallback } from 'react';
import Papa from 'papaparse';
import type { ImportProfile } from '@/types/profiles';
import type { TestImportResult, ValidationResult, ImportMode, ImportProgress } from '@/types';
import type { VerificationResult } from '@/lib/domain/verification';
import { calculateEndRowId, updateSyncAfterImport } from '@/lib/domain/rowid-sync';
import type { ProfileState, TestImportState, RowIdState, SchemaState } from './use-import-wizard-state';

// ============================================================================
// Constants
// ============================================================================

/** Nombre de lignes par chunk (~ 1-2MB selon les données) */
export const CHUNK_SIZE = 5000;

/** Nombre de tentatives par chunk en cas d'erreur */
export const MAX_RETRIES = 2;

// ============================================================================
// Types
// ============================================================================

export interface ChunkedImportConfig {
  /** État du schéma (depuis useImportWizardState) */
  schemaState: SchemaState;
  /** État du profil (depuis useImportWizardState) */
  profileState: ProfileState;
  /** État du test import (depuis useImportWizardState) */
  testImportState: TestImportState;
  /** État RowID (depuis useImportWizardState) */
  rowIdState: RowIdState;
  /** Résultat de validation */
  validation: ValidationResult | null;
  /** Résultat du test import */
  testResult: TestImportResult | null;
  /** Configuration de l'import */
  importConfig: {
    tableId: string;
    tableName: string;
    importMode: ImportMode;
    file: File | null;
  };
  /** ID du workspace */
  workspaceId: string;
  /** Colonnes de matching pour l'import */
  matchingColumns: string[];
  /** Fonction pour obtenir les types de colonnes */
  getColumnTypesFromSchema: () => Record<string, string> | undefined;
  /** Fonction pour sauvegarder le profil */
  saveOrUpdateProfile: () => Promise<void>;
  /** Callbacks du hook useImport */
  importActions: {
  startFullImport: () => void;
  updateProgress: (progress: ImportProgress) => void;
  setImportSuccess: (result: ImportSuccessResult) => void;
  setImportError: (error: string) => void;
};
  /** Callback pour reset tous les états */
  resetAll: () => void;
}


export interface ImportSuccessResult {
  success: boolean;
  importId: string;
  rowsImported: number;
  duration: number;
  verification?: VerificationResult;
}

export interface ChunkedImportActions {
  /** Confirme l'import complet après test réussi */
  handleConfirmFullImport: () => Promise<void>;
  /** Force l'import malgré les anomalies */
  handleForceImport: () => void;
}

// ============================================================================
// Hook
// ============================================================================

export function useChunkedImport(config: ChunkedImportConfig): ChunkedImportActions {
  const {
    schemaState,
    profileState,
    testImportState,
    rowIdState,
    validation,
    testResult,
    importConfig,
    workspaceId,
    matchingColumns,
    getColumnTypesFromSchema,
    saveOrUpdateProfile,
    importActions,
    resetAll,
  } = config;

  // ─────────────────────────────────────────────────────────────────────────
  // Helper : Filtrer les données valides
  // ─────────────────────────────────────────────────────────────────────────
  const getValidData = useCallback(() => {
    const { parsedData } = schemaState;
    if (!parsedData || !validation) return [];

    return parsedData.filter((_, index) => {
      const lineNumber = index + 2;
      return !validation.errors.some((err) => err.line === lineNumber);
    });
  }, [schemaState, validation]);

  // ─────────────────────────────────────────────────────────────────────────
  // Helper : Importer un chunk avec retry
  // ─────────────────────────────────────────────────────────────────────────
  const importChunk = useCallback(async (
    chunk: Record<string, unknown>[],
    chunkIndex: number,
    totalChunks: number
  ): Promise<{ success: boolean; error?: string }> => {
    const csvData = Papa.unparse(chunk);
    let lastError: string | null = null;

    for (let retry = 0; retry <= MAX_RETRIES; retry++) {
      if (retry > 0) {
        console.log(`[Import] Retry ${retry}/${MAX_RETRIES} pour chunk ${chunkIndex + 1}`);
        // Backoff exponentiel : 1s, 2s
        await new Promise(resolve => setTimeout(resolve, 1000 * retry));
      }

      try {
        const response = await fetch('/api/zoho/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            workspaceId,
            tableId: importConfig.tableId,
            tableName: importConfig.tableName,
            importMode: 'append', // Toujours append pour les données restantes
            csvData,
            fileName: importConfig.file?.name,
            totalRows: chunk.length,
            matchingColumns: matchingColumns.length > 0 ? matchingColumns : undefined,
            columnTypes: getColumnTypesFromSchema(),
          }),
        });

        const result = await response.json();

        if (response.ok && result.success) {
          return { success: true };
        }

        lastError = result.error || 'Erreur inconnue';
        console.warn(`[Import] Chunk ${chunkIndex + 1} erreur:`, lastError);
      } catch (error) {
        lastError = error instanceof Error ? error.message : 'Erreur réseau';
        console.warn(`[Import] Chunk ${chunkIndex + 1} exception:`, lastError);
      }
    }

    return { success: false, error: lastError || 'Échec après retries' };
  }, [workspaceId, importConfig, matchingColumns, getColumnTypesFromSchema]);

  // ─────────────────────────────────────────────────────────────────────────
  // Helper : Logger l'import dans l'historique
  // ─────────────────────────────────────────────────────────────────────────
  const logImportToHistory = useCallback(async (
    totalRowsImported: number,
    totalChunks: number,
    duration: number,
    maxRowIdAfter: number | null
  ) => {
    try {
      await fetch('/api/imports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId,
          viewId: importConfig.tableId,
          tableName: importConfig.tableName,
          importMode: importConfig.importMode,
          fileName: importConfig.file?.name || 'unknown',
          fileSizeBytes: importConfig.file?.size,
          rowsTotal: schemaState.parsedData?.length || 0,
          rowsValid: validation?.validRows || 0,
          rowsImported: totalRowsImported,
          rowsErrors: validation?.errorRows || 0,
          rowIdBefore: rowIdState.maxRowIdBeforeTestRef.current,
          rowIdAfter: maxRowIdAfter,
          matchingColumn: testImportState.verificationColumnRef.current,
          chunksCount: totalChunks + 1, // +1 pour le test
          durationMs: duration,
          status: 'success',
          profileId: profileState.selectedProfile?.id,
        }),
      });
      console.log('[Import] Log enregistré dans l\'historique');
    } catch (logError) {
      console.warn('[Import] Erreur logging (non bloquant):', logError);
    }
  }, [
    workspaceId,
    importConfig,
    schemaState.parsedData,
    validation,
    rowIdState.maxRowIdBeforeTestRef,
    testImportState.verificationColumnRef,
    profileState.selectedProfile,
  ]);

  // ─────────────────────────────────────────────────────────────────────────
  // Helper : Mettre à jour la sync RowID après import
  // ─────────────────────────────────────────────────────────────────────────
  const updateRowIdSync = useCallback(async (totalRowsImported: number) => {
    if (!importConfig.tableId || !importConfig.tableName || !workspaceId) return;
    if (rowIdState.rowIdStartForImportRef.current === null) return;

    try {
      const endRowId = calculateEndRowId(
        rowIdState.rowIdStartForImportRef.current,
        totalRowsImported
      );

      await updateSyncAfterImport({
        zohoTableId: importConfig.tableId,
        tableName: importConfig.tableName,
        workspaceId,
        lastKnownRowid: endRowId,
        source: 'import',
      });

      console.log('[Import] RowID sync updated:', endRowId);
    } catch (syncError) {
      console.warn('[Import] Failed to update RowID sync (non-blocking):', syncError);
    }
  }, [importConfig, workspaceId, rowIdState.rowIdStartForImportRef]);

  // ─────────────────────────────────────────────────────────────────────────
  // Confirme l'import complet après test réussi
  // ─────────────────────────────────────────────────────────────────────────
  const handleConfirmFullImport = useCallback(async () => {
    const { parsedData } = schemaState;
    if (!parsedData || !importConfig.tableId || !validation) return;

    importActions.startFullImport();

    try {
      const validData = getValidData();
      const { sampleSize } = testImportState;

      // Prendre les données RESTANTES (après l'échantillon test)
      const remainingData = validData.slice(sampleSize);

      if (remainingData.length === 0) {
        // Toutes les données ont déjà été importées dans le test
        importActions.setImportSuccess({
          success: true,
          importId: `imp_${Date.now()}`,
          rowsImported: sampleSize,
          duration: 0,
          verification: testResult?.verification,
        });
        return;
      }

      // ==================== CHUNKING ====================
      const totalChunks = Math.ceil(remainingData.length / CHUNK_SIZE);
      let totalImported = 0;
      const startTime = Date.now();

      console.log(
        `[Import] Démarrage import par chunks: ${remainingData.length} lignes en ${totalChunks} lot(s) de ${CHUNK_SIZE} lignes max`
      );

      for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
        const start = chunkIndex * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, remainingData.length);
        const chunk = remainingData.slice(start, end);

        // Mise à jour progression avec info chunk
        const chunkPercentage = Math.round(((chunkIndex + 0.5) / totalChunks) * 100);
        importActions.updateProgress({
          phase: 'full-importing',
          current: start + Math.floor(chunk.length / 2),
          total: remainingData.length,
          percentage: chunkPercentage,
          chunk: {
            current: chunkIndex + 1,
            total: totalChunks,
          },
        });

        console.log(
          `[Import] Chunk ${chunkIndex + 1}/${totalChunks}: lignes ${start + 1}-${end} (${chunk.length} lignes)`
        );

        // Importer le chunk
        const result = await importChunk(chunk, chunkIndex, totalChunks);

        if (!result.success) {
          throw new Error(
            `Échec à l'import du lot ${chunkIndex + 1}/${totalChunks} (lignes ${start + 1}-${end}): ${result.error}`
          );
        }

        totalImported += chunk.length;
        console.log(
          `[Import] Chunk ${chunkIndex + 1} OK: ${chunk.length} lignes importées (total: ${totalImported})`
        );

        // Mise à jour progression après chunk réussi
        const completedPercentage = Math.round(((chunkIndex + 1) / totalChunks) * 100);
        importActions.updateProgress({
          phase: 'full-importing',
          current: end,
          total: remainingData.length,
          percentage: completedPercentage,
          chunk: {
            current: chunkIndex + 1,
            total: totalChunks,
          },
        });
      }

      // ==================== FIN CHUNKING ====================

      const duration = Date.now() - startTime;
      const totalRowsImported = sampleSize + totalImported;

      console.log(
        `[Import] Terminé: ${totalImported} lignes en ${duration}ms (${totalChunks} chunks)`
      );

      // Sauvegarder/mettre à jour le profil
      if (profileState.mode !== 'skip') {
        try {
          await saveOrUpdateProfile();
        } catch (profileError) {
          console.error('[Import] Erreur sauvegarde profil (non bloquant):', profileError);
        }
      }

      // Calculer maxRowIdAfter
      let maxRowIdAfter: number | null = null;
      if (rowIdState.rowIdStartForImportRef.current !== null) {
        maxRowIdAfter = calculateEndRowId(
          rowIdState.rowIdStartForImportRef.current,
          totalRowsImported
        );
        console.log('[Import] Calculated MAX(RowID) after import:', maxRowIdAfter);
      }

      // Logger l'import dans l'historique
      await logImportToHistory(totalRowsImported, totalChunks, duration, maxRowIdAfter);

      // Mettre à jour la sync RowID
      await updateRowIdSync(totalRowsImported);

      // Succès
      importActions.setImportSuccess({
        success: true,
        importId: `imp_${Date.now()}`,
        rowsImported: totalRowsImported,
        duration,
        verification: testResult?.verification,
      });

      // Reset tous les états
      resetAll();

    } catch (error) {
      console.error('[Import] Erreur import complet:', error);
      importActions.setImportError(
        error instanceof Error ? error.message : "Erreur lors de l'import"
      );
    }
  }, [
    schemaState,
    importConfig,
    validation,
    testResult,
    testImportState,
    profileState,
    rowIdState,
    getValidData,
    importChunk,
    logImportToHistory,
    updateRowIdSync,
    saveOrUpdateProfile,
    importActions,
    resetAll,
  ]);

  // ─────────────────────────────────────────────────────────────────────────
  // Force l'import malgré les anomalies
  // ─────────────────────────────────────────────────────────────────────────
  const handleForceImport = useCallback(() => {
    handleConfirmFullImport();
  }, [handleConfirmFullImport]);

  return {
    handleConfirmFullImport,
    handleForceImport,
  };
}
