// components/import/wizard/import-wizard.tsx
'use client';

import { useCallback, useEffect, useState } from 'react';
import { WizardProgress } from './wizard-progress';
import { StepSource } from './step-source';
import { StepConfig } from './step-config';
import { StepValidate } from './step-validate';
import { StepReview } from './step-review';
import { StepConfirm } from './step-confirm';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useImport } from '@/lib/hooks/use-import';
import { useCsvParser } from '@/lib/hooks/use-csv-parser';
import { useValidation } from '@/lib/hooks/use-validation';
import { RotateCcw } from 'lucide-react';
import type { FileSource, TableValidationConfig } from '@/types';
import Papa from 'papaparse';

interface ZohoWorkspace {
  id: string;
  name: string;
}

interface ImportWizardProps {
  className?: string;
}

export function ImportWizard({ className = '' }: ImportWizardProps) {
  const {
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
    canGoNext,
    isImporting,
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

  // Workspaces
  const [workspaces, setWorkspaces] = useState<ZohoWorkspace[]>([]);
  const [isLoadingWorkspaces, setIsLoadingWorkspaces] = useState(false);
  const [workspacesError, setWorkspacesError] = useState<string | null>(null);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string>('');

  // Tables

  const [parsedData, setParsedData] = useState<Record<string, unknown>[] | null>(null);

  // Charger les workspaces au montage
  useEffect(() => {
    async function fetchWorkspaces() {
      setIsLoadingWorkspaces(true);
      setWorkspacesError(null);

      try {
        const response = await fetch('/api/zoho/workspaces');
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Erreur lors du chargement des workspaces');
        }

        setWorkspaces(data.workspaces || []);
        
        // Si un seul workspace, le sélectionner automatiquement
        if (data.workspaces?.length === 1) {
          setSelectedWorkspaceId(data.workspaces[0].id);
        }
      } catch (error) {
        console.error('Erreur chargement workspaces:', error);
        setWorkspacesError(error instanceof Error ? error.message : 'Erreur inconnue');
      } finally {
        setIsLoadingWorkspaces(false);
      }
    }

    fetchWorkspaces();
  }, []);


  const handleSourceChange = useCallback((source: FileSource) => {
    if (source === 'sftp') {
      return;
    }
  }, []);

  const handleWorkspaceChange = useCallback((workspaceId: string) => {
    setSelectedWorkspaceId(workspaceId);
    // Reset la sélection de table quand on change de workspace
    setTable('', '');
  }, [setTable]);

  const handleValidation = useCallback(async () => {
    console.log('handleValidation demarre');
    if (!state.config.file || !state.config.tableId) {
      console.log('Pas de fichier ou tableId');
      return;
    }

    startValidation();

    try {
      updateProgress({ phase: 'parsing', current: 0, total: 100, percentage: 0 });
      
      console.log('Debut du parsing...');
      const parseResult = await parseFile(state.config.file);
      console.log('Parsing termine, lignes:', parseResult.totalRows);
      setParsedData(parseResult.data);

      updateProgress({ phase: 'parsing', current: 100, total: 100, percentage: 20 });

      const validationConfig: TableValidationConfig = {
        tableId: state.config.tableId,
        tableName: state.config.tableName,
        columns: [],
      };

      console.log('Debut de la validation...');
      const result = await validate(parseResult.data, validationConfig);
      console.log('Validation terminee:', result);

      setValidationResult(result);
    } catch (error) {
      console.error('Erreur validation:', error);
      setValidationError(
        error instanceof Error ? error.message : 'Erreur lors de la validation'
      );
    }
  }, [state.config.file, state.config.tableId, state.config.tableName, startValidation, updateProgress, parseFile, validate, setValidationResult, setValidationError]);

  const handleImport = useCallback(async () => {
    if (!parsedData || !state.config.tableId || !state.validation) return;

    startImport();

    try {
      // Filtrer les données valides
      const validData = parsedData.filter((_, index) => {
        const lineNumber = index + 2;
        return !state.validation!.errors.some((err) => err.line === lineNumber);
      });

      // Convertir en CSV
      const csvData = Papa.unparse(validData);

      updateProgress({
        phase: 'importing',
        current: 0,
        total: validData.length,
        percentage: 0,
      });

      // Appel API pour import réel vers Zoho
      const response = await fetch('/api/zoho/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId: selectedWorkspaceId,
          tableId: state.config.tableId,
          tableName: state.config.tableName,
          importMode: state.config.importMode,
          csvData: csvData,
          fileName: state.config.file?.name,
          totalRows: validData.length,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Erreur lors de l'import");
      }

      setImportSuccess({
        success: true,
        importId: result.importId || `imp_${Date.now()}`,
        rowsImported: result.summary?.totalRowCount || validData.length,
        duration: result.duration || 0,
        zohoImportId: result.importId,
      });

      setParsedData(null);
    } catch (error) {
      console.error('Erreur import:', error);
      setImportError(
        error instanceof Error ? error.message : "Erreur lors de l'import"
      );
    }
  }, [parsedData, state.config, state.validation, selectedWorkspaceId, startImport, updateProgress, setImportSuccess, setImportError]);

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

      case 'configuring':
        return (
          <>
            {workspacesError && (
              <Alert variant="error" className="mb-4">
                {workspacesError}
              </Alert>
            )}
           
           <StepConfig
              fileName={state.config.file?.name ?? ''}
              fileSize={state.config.file?.size ?? 0}
              // Workspaces
              workspaces={workspaces}
              selectedWorkspaceId={selectedWorkspaceId}
              isLoadingWorkspaces={isLoadingWorkspaces}
              onWorkspaceSelect={handleWorkspaceChange}
              // Tables - le composant TableSelectorAccordion gère le chargement
              selectedTableId={state.config.tableId}
              importMode={state.config.importMode}
              onTableSelect={setTable}
              onImportModeChange={setImportMode}
              onBack={goBack}
              onNext={() => goToStep('validating')}
              canProceed={canGoNext && !!selectedWorkspaceId}
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

      case 'reviewing':
        return state.validation ? (
          <StepReview
            validation={state.validation}
            tableName={state.config.tableName}
            importMode={state.config.importMode}
            isImporting={isImporting}
            onBack={goBack}
            onImport={handleImport}
          />
        ) : null;

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

  return (
    <div className={`space-y-8 ${className}`}>
      {!['success', 'error'].includes(state.status) && (
        <WizardProgress currentStatus={state.status} />
      )}
      {renderStep()}
    </div>
  );
}
