// components/import/wizard/import-wizard.tsx
'use client';

import { useCallback, useEffect, useState } from 'react';
import { WizardProgress } from './wizard-progress';
import { StepSource } from './step-source';
import { StepProfile } from './step-profile';
import { StepConfig } from './step-config';
import { StepValidate } from './step-validate';
import { StepReview } from './step-review';
import { StepResolve } from './step-resolve';
import { StepConfirm } from './step-confirm';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useImport } from '@/lib/hooks/use-import';
import { useCsvParser } from '@/lib/hooks/use-csv-parser';
import { useValidation } from '@/lib/hooks/use-validation';
import { validateSchema } from '@/lib/domain/schema-validator';
import { RotateCcw } from 'lucide-react';
import type { FileSource, TableValidationConfig } from '@/types';
import type { SchemaValidationResult, ZohoTableSchema, ResolvableIssue } from '@/lib/infrastructure/zoho/types';
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

  // Données parsées et validation de schéma
  const [parsedData, setParsedData] = useState<Record<string, unknown>[] | null>(null);
  const [schemaValidation, setSchemaValidation] = useState<SchemaValidationResult | null>(null);
  const [zohoSchema, setZohoSchema] = useState<ZohoTableSchema | null>(null);

  // Issues résolues par l'utilisateur
  const [resolvedIssues, setResolvedIssues] = useState<ResolvableIssue[] | null>(null);
  const [issuesResolved, setIssuesResolved] = useState(false);

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
    setTable('', '');
    setSchemaValidation(null);
    setZohoSchema(null);
    setResolvedIssues(null);
    setIssuesResolved(false);
  }, [setTable]);

  // Récupérer le schéma Zoho d'une table
  const fetchZohoSchema = useCallback(async (workspaceId: string, viewId: string, viewName: string): Promise<ZohoTableSchema | null> => {
    try {
      console.log('[Schema] Fetching schema for', viewId);
      const response = await fetch(`/api/zoho/columns?workspaceId=${workspaceId}&viewId=${viewId}`);
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

  const handleValidation = useCallback(async () => {
    console.log('handleValidation demarre');
    if (!state.config.file || !state.config.tableId) {
      console.log('Pas de fichier ou tableId');
      return;
    }

    startValidation();
    
    // Reset les états de résolution
    setResolvedIssues(null);
    setIssuesResolved(false);

    try {
      // Phase 1: Parsing du fichier
      updateProgress({ phase: 'parsing', current: 0, total: 100, percentage: 0 });
      console.log('Debut du parsing...');
      const parseResult = await parseFile(state.config.file);
      console.log('Parsing termine, lignes:', parseResult.totalRows);
      setParsedData(parseResult.data);
      updateProgress({ phase: 'parsing', current: 100, total: 100, percentage: 20 });

      // Phase 2: Récupération du schéma Zoho
      updateProgress({ phase: 'validating', current: 20, total: 100, percentage: 30 });
      console.log('Recuperation du schema Zoho...');
      const schema = await fetchZohoSchema(selectedWorkspaceId, state.config.tableId, state.config.tableName);
      setZohoSchema(schema);

      // Phase 3: Validation du schéma (correspondance colonnes)
      if (schema && schema.columns.length > 0) {
        updateProgress({ phase: 'validating', current: 40, total: 100, percentage: 50 });
        console.log('Validation du schema...');

        // Extraire les headers et données pour la validation
        const headers = parseResult.data.length > 0 ? Object.keys(parseResult.data[0]) : [];
        const sampleData = parseResult.data.slice(0, 100).map(row =>
          headers.map(h => String((row as Record<string, unknown>)[h] ?? ''))
        );

        const schemaResult = validateSchema({
          fileHeaders: headers,
          sampleData,
          zohoSchema: schema,
        });

        setSchemaValidation(schemaResult);
        console.log('Schema validation:', schemaResult.summary);
        console.log('Auto transformations:', schemaResult.autoTransformations);
        
        // Log des issues détectées
        if (schemaResult.resolvableIssues && schemaResult.resolvableIssues.length > 0) {
          console.log('Issues à résoudre:', schemaResult.resolvableIssues.length);
          schemaResult.resolvableIssues.forEach(issue => {
            console.log(`  - ${issue.type}: ${issue.column} - ${issue.message}`);
          });
        }
      } else {
        console.log('Pas de schema Zoho disponible, validation classique uniquement');
        setSchemaValidation(null);
      }

      // Phase 4: Validation des données (règles métier)
      updateProgress({ phase: 'validating', current: 60, total: 100, percentage: 70 });
      const validationConfig: TableValidationConfig = {
        tableId: state.config.tableId,
        tableName: state.config.tableName,
        columns: [],
      };

      console.log('Debut de la validation des donnees...');
      const result = await validate(parseResult.data, validationConfig);
      console.log('Validation terminee:', result);

      setValidationResult(result);
    } catch (error) {
      console.error('Erreur validation:', error);
      setValidationError(
        error instanceof Error ? error.message : 'Erreur lors de la validation'
      );
    }
  }, [state.config.file, state.config.tableId, state.config.tableName, selectedWorkspaceId, startValidation, updateProgress, parseFile, fetchZohoSchema, validate, setValidationResult, setValidationError]);

  const handleImport = useCallback(async () => {
    if (!parsedData || !state.config.tableId || !state.validation) return;

    startImport();

    try {
      const validData = parsedData.filter((_, index) => {
        const lineNumber = index + 2;
        return !state.validation!.errors.some((err) => err.line === lineNumber);
      });

      const csvData = Papa.unparse(validData);

      updateProgress({
        phase: 'importing',
        current: 0,
        total: validData.length,
        percentage: 0,
      });

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
      setSchemaValidation(null);
      setZohoSchema(null);
      setResolvedIssues(null);
      setIssuesResolved(false);
    } catch (error) {
      console.error('Erreur import:', error);
      setImportError(
        error instanceof Error ? error.message : "Erreur lors de l'import"
      );
    }
  }, [parsedData, state.config, state.validation, selectedWorkspaceId, startImport, updateProgress, setImportSuccess, setImportError]);

  // Handler pour la résolution des issues
  const handleIssuesResolved = useCallback((resolved: ResolvableIssue[]) => {
    console.log('Issues résolues:', resolved.length);
    setResolvedIssues(resolved);
    setIssuesResolved(true);
  }, []);

  // Vérifier si on doit afficher l'étape de résolution
  const hasUnresolvedIssues = schemaValidation?.resolvableIssues && 
    schemaValidation.resolvableIssues.length > 0 && 
    !issuesResolved;

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
        // Parser le fichier si pas encore fait
        if (!parsedData && state.config.file) {
          parseFile(state.config.file).then(result => {
            setParsedData(result.data);
          });
          return <div className="text-center p-8">Analyse du fichier en cours...</div>;
        }
        
        if (!parsedData) {
          return <div className="text-center p-8">Aucune donnée à analyser</div>;
        }
        
        return (
          <StepProfile
            fileData={(parsedData as Record<string, string>[])}
            fileName={state.config.file?.name || ''}
            onProfileSelected={(profile, matchResult) => {
              console.log('Profile selected:', profile.name, matchResult);
              goToStep('configuring');
            }}
            onCreateNewProfile={(detectedColumns) => {
              console.log('Create new profile:', detectedColumns.length);
              goToStep('configuring');
            }}
            onSkipProfile={(detectedColumns) => {
              console.log('Skip profile:', detectedColumns.length);
              goToStep('configuring');
            }}
            onBack={goBack}
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
              workspaces={workspaces}
              selectedWorkspaceId={selectedWorkspaceId}
              isLoadingWorkspaces={isLoadingWorkspaces}
              onWorkspaceSelect={handleWorkspaceChange}
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
        // Si des issues sont à résoudre et pas encore résolues, afficher StepResolve
        if (hasUnresolvedIssues && schemaValidation?.resolvableIssues) {
          return (
            <StepResolve
              issues={schemaValidation.resolvableIssues}
              onResolve={handleIssuesResolved}
              onBack={goBack}
            />
          );
        }
        
        // Sinon afficher la review normale
        return state.validation ? (
          <StepReview
            validation={state.validation}
            schemaValidation={schemaValidation}
            tableName={state.config.tableName}
            importMode={state.config.importMode}
            isImporting={isImporting}
            onBack={() => {
              // Si on revient en arrière depuis review après résolution,
              // on revient à la résolution
              if (resolvedIssues && schemaValidation?.resolvableIssues && schemaValidation.resolvableIssues.length > 0) {
                setIssuesResolved(false);
              } else {
                goBack();
              }
            }}
            onImport={handleImport}
              resolvedIssues={resolvedIssues || []}
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
        <WizardProgress currentStatus={state.status} isResolving={hasUnresolvedIssues} />
      )}
      {renderStep()}
    </div>
  );
}
