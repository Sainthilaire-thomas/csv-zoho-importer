// components/import/wizard/import-wizard.tsx
'use client';

import { useCallback, useEffect } from 'react';
import { WizardProgress } from './wizard-progress';
import { StepSource } from './step-source';
import { StepProfile } from './step-profile';
import { StepConfig } from './step-config';
import { StepValidate } from './step-validate';
import { StepReview } from './step-review';
import { StepResolve } from './step-resolve';
import { StepConfirm } from './step-confirm';
import { StepTransformPreview } from './step-transform-preview';
import { StepTestImport } from './step-test-import';
import { StepTestResult } from './step-test-result';
import { applyAllTransformations } from '@/lib/domain/data-transformer';
import { validateSchema } from '@/lib/domain/schema-validator';
import { RowIdSyncDialog } from '@/components/import/rowid-sync-dialog';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useImport } from '@/lib/hooks/use-import';
import { useCsvParser } from '@/lib/hooks/use-csv-parser';
import { useValidation } from '@/lib/hooks/use-validation';
import { RotateCcw } from 'lucide-react';

import type { FileSource, TableValidationConfig } from '@/types';
import type { SchemaValidationResult, ZohoTableSchema, ResolvableIssue } from '@/lib/infrastructure/zoho/types';

// Import des hooks extraits
import {
  useImportWizardState,
  useProfileManagement,
  useTestImport,
  useChunkedImport,
} from './hooks';

// ============================================================================
// Types
// ============================================================================

interface ImportWizardProps {
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

export function ImportWizard({ className = '' }: ImportWizardProps) {
  // ─────────────────────────────────────────────────────────────────────────
  // Core import hook (from lib/hooks)
  // ─────────────────────────────────────────────────────────────────────────
  const {
    state,
    setFile,
    removeFile,
    setTable,
    setImportMode,
    startValidation,
    setValidationResult,
    setValidationError,
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
    canGoNext,
    isImporting,
    isTestImporting,
  } = useImport();

  const { parseFile } = useCsvParser();
  const { validate } = useValidation({
    onProgress: (percentage) => {
      updateProgress({
        phase: 'validating',
        current: percentage,
        total: 100,
        percentage,
      });
    },
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Wizard state (extracted hook)
  // ─────────────────────────────────────────────────────────────────────────
  const wizardState = useImportWizardState();

  // ─────────────────────────────────────────────────────────────────────────
  // Profile management (extracted hook)
  // ─────────────────────────────────────────────────────────────────────────
  const profileActions = useProfileManagement({
    profileState: wizardState.profile,
    issuesState: wizardState.issues,
    workspaces: wizardState.workspaces.workspaces,
    selectedWorkspaceId: wizardState.workspaces.selectedId,
    importConfig: {
      tableId: state.config.tableId,
      tableName: state.config.tableName,
      importMode: state.config.importMode,
    },
    navigation: {
  setTable,
  setImportMode,
  goToStep,
  setWorkspaceId: wizardState.workspaces.setSelectedId,
},
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Helper: Get column types from Zoho schema
  // ─────────────────────────────────────────────────────────────────────────
  const getColumnTypesFromSchema = useCallback((): Record<string, string> | undefined => {
    const { zohoSchema } = wizardState.schema;
    if (!zohoSchema?.columns || zohoSchema.columns.length === 0) {
      return undefined;
    }

    const types: Record<string, string> = {};
    for (const col of zohoSchema.columns) {
      types[col.columnName] = col.dataType;
    }

    return Object.keys(types).length > 0 ? types : undefined;
  }, [wizardState.schema]);

  // ─────────────────────────────────────────────────────────────────────────
  // Test import (extracted hook)
  // ─────────────────────────────────────────────────────────────────────────
  const testImportActions = useTestImport({
    testImportState: wizardState.testImport,
    rowIdState: wizardState.rowId,
    parsedData: wizardState.schema.parsedData,
    validation: state.validation,
    importConfig: {
      tableId: state.config.tableId,
      tableName: state.config.tableName,
      importMode: state.config.importMode,
      file: state.config.file,
    },
     workspaceId: wizardState.workspaces.selectedId,
      workspaceName: wizardState.workspaces.workspaces.find(
        w => w.id === wizardState.workspaces.selectedId
      )?.name || '',
    matchingColumns: wizardState.profile.matchingColumns,
    selectedProfile: wizardState.profile.selectedProfile,
    zohoColumns: wizardState.schema.zohoSchema?.columns,
    getColumnTypesFromSchema,
    importActions: {
      startTestImport,
      setTestImportComplete,
      setImportError,
      goToStep,
    },
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Chunked import (extracted hook)
  // ─────────────────────────────────────────────────────────────────────────
  const chunkedImportActions = useChunkedImport({
    schemaState: wizardState.schema,
    profileState: wizardState.profile,
    testImportState: wizardState.testImport,
    rowIdState: wizardState.rowId,
    validation: state.validation,
    testResult: state.testResult,
    importConfig: {
      tableId: state.config.tableId,
      tableName: state.config.tableName,
      importMode: state.config.importMode,
      file: state.config.file,
    },
    workspaceId: wizardState.workspaces.selectedId,
      workspaceName: wizardState.workspaces.workspaces.find(
        w => w.id === wizardState.workspaces.selectedId
      )?.name || '',
    matchingColumns: wizardState.profile.matchingColumns,
    getColumnTypesFromSchema,
    saveOrUpdateProfile: profileActions.saveOrUpdateProfile,
    importActions: {
      startFullImport,
      updateProgress,
      setImportSuccess,
      setImportError,
    },
    resetAll: wizardState.resetAll,
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Load workspaces on mount
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    async function fetchWorkspaces() {
      wizardState.workspaces.setIsLoading(true);
      wizardState.workspaces.setError(null);

      try {
        const response = await fetch('/api/zoho/workspaces');
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Erreur lors du chargement des workspaces');
        }

        wizardState.workspaces.setWorkspaces(data.workspaces || []);

        if (data.workspaces?.length === 1) {
          wizardState.workspaces.setSelectedId(data.workspaces[0].id);
        }
      } catch (error) {
        console.error('Erreur chargement workspaces:', error);
        wizardState.workspaces.setError(
          error instanceof Error ? error.message : 'Erreur inconnue'
        );
      } finally {
        wizardState.workspaces.setIsLoading(false);
      }
    }

    fetchWorkspaces();
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // Pre-fill config when existing profile selected
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const { selectedProfile, mode } = wizardState.profile;
    if (selectedProfile && mode === 'existing') {
      wizardState.workspaces.setSelectedId(selectedProfile.workspaceId);
      setTable(selectedProfile.viewId, selectedProfile.viewName);
      setImportMode(selectedProfile.defaultImportMode);
    }
  }, [wizardState.profile.selectedProfile, wizardState.profile.mode, setTable, setImportMode]);

  // ─────────────────────────────────────────────────────────────────────────
  // Handlers
  // ─────────────────────────────────────────────────────────────────────────
  const handleSourceChange = useCallback((source: FileSource) => {
    if (source === 'sftp') {
      return; // SFTP not implemented yet
    }
  }, []);

  const handleWorkspaceChange = useCallback((workspaceId: string) => {
    wizardState.workspaces.setSelectedId(workspaceId);
    setTable('', '');
    wizardState.schema.setSchemaValidation(null);
    wizardState.schema.setZohoSchema(null);
    wizardState.issues.resetIssues();
  }, [setTable, wizardState.workspaces, wizardState.schema, wizardState.issues]);

  const handleIssuesResolved = useCallback((resolved: ResolvableIssue[]) => {
    console.log('Issues résolues:', resolved.length);
    wizardState.issues.setResolvedIssues(resolved);
    wizardState.issues.setIssuesResolved(true);
  }, [wizardState.issues]);

  // ─────────────────────────────────────────────────────────────────────────
  // Fetch Zoho schema
  // ─────────────────────────────────────────────────────────────────────────
  const fetchZohoSchema = useCallback(async (
    workspaceId: string,
    viewId: string,
    viewName: string
  ): Promise<ZohoTableSchema | null> => {
    try {
      console.log('[Schema] Fetching schema for', viewId);
      const response = await fetch(
        `/api/zoho/columns?workspaceId=${workspaceId}&viewId=${viewId}`
      );
      const data = await response.json();

      if (!response.ok) {
        console.error('[Schema] Error:', data.error);
        return null;
      }

      const schema: ZohoTableSchema = {
        viewId,
        viewName,
        workspaceId,
        columns: data.columns || [],
        fetchedAt: new Date(),
      };

      console.log('[Schema] Found', schema.columns.length, 'columns');
      return schema;
    } catch (error) {
      console.error('[Schema] Exception:', error);
      return null;
    }
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // Validation handler
  // ─────────────────────────────────────────────────────────────────────────
  const handleValidation = useCallback(async () => {
    console.log('handleValidation démarré');
    if (!state.config.file || !state.config.tableId) {
      console.log('Pas de fichier ou tableId');
      return;
    }

    startValidation();
    wizardState.issues.resetIssues();

    try {
      // Phase 1: Parsing
      updateProgress({ phase: 'parsing', current: 0, total: 100, percentage: 0 });
      const parseResult = await parseFile(state.config.file);
      console.log('Parsing terminé, lignes:', parseResult.totalRows);
      updateProgress({ phase: 'parsing', current: 100, total: 100, percentage: 20 });

      // Phase 2: Fetch Zoho schema
      updateProgress({ phase: 'validating', current: 20, total: 100, percentage: 30 });
      const schema = await fetchZohoSchema(
        wizardState.workspaces.selectedId,
        state.config.tableId,
        state.config.tableName
      );
      wizardState.schema.setZohoSchema(schema);

      // Phase 2b: Fetch reference row for preview
      try {
        const refResponse = await fetch(
          `/api/zoho/sample-row?workspaceId=${wizardState.workspaces.selectedId}&tableName=${encodeURIComponent(state.config.tableName)}`
        );
        const refData = await refResponse.json();
        if (refData.success && refData.data) {
          wizardState.schema.setZohoReferenceRow(refData.data);
        } else {
          wizardState.schema.setZohoReferenceRow(null);
        }
      } catch (refError) {
        console.warn('[Reference] Erreur récupération ligne de référence:', refError);
        wizardState.schema.setZohoReferenceRow(null);
      }

      // Phase 3: Schema validation
      let schemaResult: SchemaValidationResult | null = null;

      if (schema && schema.columns.length > 0) {
        updateProgress({ phase: 'validating', current: 40, total: 100, percentage: 50 });

        const headers = parseResult.data.length > 0 ? Object.keys(parseResult.data[0]) : [];
        const sampleData = parseResult.data.slice(0, 100).map(row =>
          headers.map(h => String((row as Record<string, unknown>)[h] ?? ''))
        );

       schemaResult = validateSchema({
          fileHeaders: headers,
          sampleData,
          zohoSchema: schema,
          profile: wizardState.profile.selectedProfile || undefined,
          detectedColumns: wizardState.profile.detectedColumns,  // Pour les hints Excel
        });

        wizardState.schema.setSchemaValidation(schemaResult);
        console.log('Schema validation:', schemaResult.summary);
      } else {
        wizardState.schema.setSchemaValidation(null);
      }

      // Apply transformations (SOURCE OF TRUTH)
      const transformedData = applyAllTransformations(
        parseResult.data as Record<string, unknown>[],
        schemaResult?.matchedColumns
      );
      console.log('[Transformation] Données transformées:', transformedData.length, 'lignes');
      wizardState.schema.setParsedData(transformedData);

      // Phase 4: Data validation
      updateProgress({ phase: 'validating', current: 60, total: 100, percentage: 70 });
      const validationConfig: TableValidationConfig = {
        tableId: state.config.tableId,
        tableName: state.config.tableName,
        columns: [],
      };

      const result = await validate(transformedData, validationConfig);
      console.log('Validation terminée:', result);
      setValidationResult(result);

    } catch (error) {
      console.error('Erreur validation:', error);
      setValidationError(
        error instanceof Error ? error.message : 'Erreur lors de la validation'
      );
    }
  }, [
    state.config.file,
    state.config.tableId,
    state.config.tableName,
    wizardState.workspaces.selectedId,
    wizardState.profile.selectedProfile,
    wizardState.schema,
    wizardState.issues,
    startValidation,
    updateProgress,
    parseFile,
    fetchZohoSchema,
    validate,
    setValidationResult,
    setValidationError,
  ]);

  // ─────────────────────────────────────────────────────────────────────────
  // Computed values
  // ─────────────────────────────────────────────────────────────────────────
  const hasUnresolvedIssues =
    wizardState.schema.schemaValidation?.resolvableIssues &&
    wizardState.schema.schemaValidation.resolvableIssues.length > 0 &&
    !wizardState.issues.issuesResolved;

  // ─────────────────────────────────────────────────────────────────────────
  // Render step
  // ─────────────────────────────────────────────────────────────────────────
  const renderStep = () => {
    switch (state.status) {
      case 'selecting':
        return (
          <StepSource
            file={state.config.file}
            source={state.config.source}
            onFileSelect={setFile}
            onFileRemove={removeFile}
            onSourceChange={handleSourceChange}
            onNext={goNext}
            canProceed={canGoNext}
          />
        );

     case 'profiling':
        if (!wizardState.schema.parsedData && state.config.file) {
          parseFile(state.config.file).then(result => {
            const transformed = applyAllTransformations(result.data as Record<string, unknown>[]);
            wizardState.schema.setParsedData(transformed);
            // Stocker les métadonnées Excel si disponibles
            if (result.columnMetadata) {
              wizardState.schema.setColumnMetadata(result.columnMetadata);
            }
            // Stocker les données brutes Excel pour l'UI accordéon (Phase 2)
            if (result.rawCellData) {
              wizardState.schema.setRawCellData(result.rawCellData);
            }
          });
          return <div className="text-center p-8">Analyse du fichier en cours...</div>;
        }
        if (!wizardState.schema.parsedData) {
          return <div className="text-center p-8">Aucune donnée à analyser</div>;
        }
        return (
          <StepProfile
            fileData={wizardState.schema.parsedData as Record<string, string>[]}
            fileName={state.config.file?.name || ''}
            columnMetadata={wizardState.schema.columnMetadata}
            onProfileSelected={profileActions.handleProfileSelected}
            onCreateNewProfile={profileActions.handleCreateNewProfile}
            onSkipProfile={profileActions.handleSkipProfile}
            onBack={goBack}
          />
        );

      case 'configuring':
        return (
          <>
            {wizardState.workspaces.error && (
              <Alert variant="error" className="mb-4">
                {wizardState.workspaces.error}
              </Alert>
            )}

            {wizardState.profile.mode === 'existing' && wizardState.profile.selectedProfile && (
              <Alert variant="info" className="mb-4">
                Profil &quot;{wizardState.profile.selectedProfile.name}&quot; sélectionné - Table: {wizardState.profile.selectedProfile.viewName}
              </Alert>
            )}

            <StepConfig
              fileName={state.config.file?.name ?? ''}
              fileSize={state.config.file?.size ?? 0}
              workspaces={wizardState.workspaces.workspaces}
              selectedWorkspaceId={wizardState.workspaces.selectedId}
              isLoadingWorkspaces={wizardState.workspaces.isLoading}
              onWorkspaceSelect={handleWorkspaceChange}
              selectedTableId={state.config.tableId}
              importMode={state.config.importMode}
              onTableSelect={setTable}
              onImportModeChange={setImportMode}
              onBack={goBack}
              onNext={() => goToStep('validating')}
              canProceed={canGoNext && !!wizardState.workspaces.selectedId}
              matchingColumns={wizardState.profile.matchingColumns}
              onMatchingColumnsChange={wizardState.profile.setMatchingColumns}
              availableColumns={wizardState.profile.detectedColumns.map(c => c.name)}
            />
          </>
        );

      case 'validating':
        return (
          <StepValidate
            progress={state.progress}
            fileName={state.config.file?.name ?? ''}
            onValidationStart={handleValidation}
          />
        );

      case 'previewing':
        const fileExtension = state.config.file?.name.split('.').pop()?.toLowerCase();
        const fileType = fileExtension === 'xlsx' || fileExtension === 'xls' ? fileExtension : 'csv';
        return (
          <StepTransformPreview
            autoTransformations={wizardState.schema.schemaValidation?.autoTransformations || []}
            matchedColumns={wizardState.schema.schemaValidation?.matchedColumns || []}
            parsedData={wizardState.schema.parsedData || []}
            totalRows={state.validation?.totalRows || 0}
            zohoReferenceRow={wizardState.schema.zohoReferenceRow}
            rawCellData={wizardState.schema.rawCellData ?? undefined}
            fileType={fileType}
            onBack={() => goToStep('configuring')}
            onConfirm={() => goToStep('reviewing')}
          />
        );

      case 'reviewing':
        if (hasUnresolvedIssues && wizardState.schema.schemaValidation?.resolvableIssues) {
          return (
            <StepResolve
              issues={wizardState.schema.schemaValidation.resolvableIssues}
              onResolve={handleIssuesResolved}
              onBack={goBack}
            />
          );
        }

        return state.validation ? (
          <StepReview
            validation={state.validation}
            schemaValidation={wizardState.schema.schemaValidation}
            tableName={state.config.tableName}
            importMode={state.config.importMode}
            isImporting={isImporting || isTestImporting}
            onBack={() => {
              if (
                wizardState.issues.resolvedIssues &&
                wizardState.schema.schemaValidation?.resolvableIssues &&
                wizardState.schema.schemaValidation.resolvableIssues.length > 0
              ) {
                wizardState.issues.setIssuesResolved(false);
              } else {
                goBack();
              }
            }}
            onImport={testImportActions.handleStartTestImport}
            resolvedIssues={wizardState.issues.resolvedIssues || []}
          />
        ) : null;

      case 'test-importing':
        return (
          <StepTestImport
            sampleSize={wizardState.testImport.sampleSize}
            matchingColumn={wizardState.testImport.verificationColumn}
            matchingValues={wizardState.testImport.testMatchingValues}
            onComplete={testImportActions.handleTestComplete}
            onError={testImportActions.handleTestError}
            executeImport={testImportActions.executeTestImport}
            executeVerification={testImportActions.executeTestVerification}
          />
        );

      case 'test-result':
        if (!state.testResult) return null;

        const totalValidRows = wizardState.schema.parsedData
          ? wizardState.schema.parsedData.filter((_, index) => {
              const lineNumber = index + 2;
              return !state.validation!.errors.some((err) => err.line === lineNumber);
            }).length
          : 0;
        const remainingRows = totalValidRows - wizardState.testImport.sampleSize;

        return (
          <StepTestResult
            verificationResult={state.testResult.verification}
            sampleSize={wizardState.testImport.sampleSize}
            remainingRows={remainingRows}
            matchingColumn={wizardState.testImport.verificationColumn || ''}
            matchingValues={wizardState.testImport.testMatchingValues}
            onConfirmFullImport={chunkedImportActions.handleConfirmFullImport}
            onRollbackAndFix={testImportActions.handleRollback}
            onForceImport={chunkedImportActions.handleForceImport}
          />
        );

      case 'full-importing':
        return (
          <StepValidate
            progress={state.progress}
            fileName={state.config.file?.name ?? ''}
            onValidationStart={() => {}}
          />
        );

      case 'importing':
        return (
          <StepValidate
            progress={state.progress}
            fileName={state.config.file?.name ?? ''}
            onValidationStart={() => {}}
          />
        );

      case 'success':
        return state.result ? (
          <StepConfirm
            result={state.result}
            tableName={state.config.tableName}
            onNewImport={reset}
          />
        ) : null;

      case 'error':
        return (
          <div className="space-y-4">
            <Alert variant="error" title="Une erreur est survenue">
              {state.error ?? 'Erreur inconnue'}
            </Alert>
            <div className="flex gap-3">
              <Button variant="outline" onClick={goBack}>
                Retour
              </Button>
              <Button onClick={reset} leftIcon={<RotateCcw className="h-4 w-4" />}>
                Recommencer
              </Button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className={`space-y-8 ${className}`}>
      {!['success', 'error'].includes(state.status) && (
        <WizardProgress currentStatus={state.status} isResolving={hasUnresolvedIssues} />
      )}

      {/* Mission 013 : Dialog de resynchronisation RowID */}
      {wizardState.rowId.showSyncDialog && state.config.tableName && (
        <RowIdSyncDialog
            tableName={state.config.tableName}
            workspaceId={wizardState.workspaces.selectedId}
            zohoTableId={state.config.tableId || ''}
            estimatedRowId={
              wizardState.rowId.syncCheck?.estimatedStartRowId
                ? wizardState.rowId.syncCheck.estimatedStartRowId - 1
                : undefined
            }
            detectedRealRowId={wizardState.rowId.syncCheck?.detectedRealRowId}
            message={wizardState.rowId.syncCheck?.message || 'Synchronisation requise'}
            onSync={testImportActions.handleRowIdResync}
            onCancel={testImportActions.handleRowIdResyncCancel}
          />
      )}

      {!wizardState.rowId.showSyncDialog && renderStep()}
    </div>
  );
}
