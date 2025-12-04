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
import type { ImportProfile, ProfileMatchResult, DetectedColumn } from '@/types/profiles';
import Papa from 'papaparse';

interface ZohoWorkspace {
  id: string;
  name: string;
}

interface ImportWizardProps {
  className?: string;
}

type ProfileMode = 'existing' | 'new' | 'skip';

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

  // Donnees parsees et validation de schema
  const [parsedData, setParsedData] = useState<Record<string, unknown>[] | null>(null);
  const [schemaValidation, setSchemaValidation] = useState<SchemaValidationResult | null>(null);
  const [zohoSchema, setZohoSchema] = useState<ZohoTableSchema | null>(null);

  // Issues resolues par l utilisateur
  const [resolvedIssues, setResolvedIssues] = useState<ResolvableIssue[] | null>(null);
  const [issuesResolved, setIssuesResolved] = useState(false);

  // ==========================================================================
  // Etat du profil
  // ==========================================================================
  const [profileMode, setProfileMode] = useState<ProfileMode>('skip');
  const [selectedProfile, setSelectedProfile] = useState<ImportProfile | null>(null);
  const [selectedMatchResult, setSelectedMatchResult] = useState<ProfileMatchResult | null>(null);
  const [detectedColumns, setDetectedColumns] = useState<DetectedColumn[]>([]);
 const [matchingColumns, setMatchingColumns] = useState<string[]>([]);

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

  // ==========================================================================
  // Pre-remplir config si profil existant selectionne
  // ==========================================================================
  useEffect(() => {
    if (selectedProfile && profileMode === 'existing') {
      setSelectedWorkspaceId(selectedProfile.workspaceId);
      setTable(selectedProfile.viewId, selectedProfile.viewName);
      setImportMode(selectedProfile.defaultImportMode);
    }
  }, [selectedProfile, profileMode, setTable, setImportMode]);

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

  // Recuperer le schema Zoho d une table
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
    
    // Reset les etats de resolution
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

      // Phase 2: Recuperation du schema Zoho
      updateProgress({ phase: 'validating', current: 20, total: 100, percentage: 30 });
      console.log('Recuperation du schema Zoho...');
      const schema = await fetchZohoSchema(selectedWorkspaceId, state.config.tableId, state.config.tableName);
      setZohoSchema(schema);

      // Phase 3: Validation du schema (correspondance colonnes)
      if (schema && schema.columns.length > 0) {
        updateProgress({ phase: 'validating', current: 40, total: 100, percentage: 50 });
        console.log('Validation du schema...');

        // Extraire les headers et donnees pour la validation
        const headers = parseResult.data.length > 0 ? Object.keys(parseResult.data[0]) : [];
        const sampleData = parseResult.data.slice(0, 100).map(row =>
          headers.map(h => String((row as Record<string, unknown>)[h] ?? ''))
        );

        const schemaResult = validateSchema({
          fileHeaders: headers,
          sampleData,
          zohoSchema: schema,
          profile: selectedProfile || undefined,
        });

        setSchemaValidation(schemaResult);
        console.log('Schema validation:', schemaResult.summary);
        console.log('Auto transformations:', schemaResult.autoTransformations);
        
        // Log des issues detectees
        if (schemaResult.resolvableIssues && schemaResult.resolvableIssues.length > 0) {
          console.log('Issues a resoudre:', schemaResult.resolvableIssues.length);
          schemaResult.resolvableIssues.forEach(issue => {
            console.log(`  - ${issue.type}: ${issue.column} - ${issue.message}`);
          });
        }
      } else {
        console.log('Pas de schema Zoho disponible, validation classique uniquement');
        setSchemaValidation(null);
      }

      // Phase 4: Validation des donnees (regles metier)
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

  // ==========================================================================
  // Fonction pour sauvegarder ou mettre a jour le profil
  // ==========================================================================
  const saveOrUpdateProfile = useCallback(async () => {
    const workspace = workspaces.find(w => w.id === selectedWorkspaceId);
    if (!workspace) {
      console.error('Workspace non trouve');
      return;
    }

    if (profileMode === 'existing' && selectedProfile) {
      console.log('Mise a jour du profil existant:', selectedProfile.id);

      const updates: Record<string, unknown> = {
        lastUsedAt: new Date().toISOString(),
        incrementUseCount: true,
      };

      if (selectedMatchResult) {
        const newAliases: Record<string, string[]> = {};
        
        for (const mapping of selectedMatchResult.mappings) {
          if (mapping.status === 'similar' && mapping.profileColumn) {
            const zohoCol = mapping.profileColumn.zohoColumn;
            if (!mapping.profileColumn.acceptedNames.includes(mapping.fileColumn)) {
              if (!newAliases[zohoCol]) newAliases[zohoCol] = [];
              newAliases[zohoCol].push(mapping.fileColumn);
            }
          }
        }

        if (Object.keys(newAliases).length > 0) {
          updates.newAliases = newAliases;
        }
      }

      if (resolvedIssues && resolvedIssues.length > 0) {
        const newFormats: Record<string, string[]> = {};

        for (const issue of resolvedIssues) {
          if (issue.type === 'ambiguous_date_format' && issue.resolution) {
            const profileCol = selectedProfile.columns.find(c => 
              c.acceptedNames.some(name => 
                name.toLowerCase() === issue.column.toLowerCase()
              )
            );
            
            if (profileCol) {
              const zohoCol = profileCol.zohoColumn;
              const format = issue.resolution?.type === 'date_format' ? issue.resolution.format : 'DD/MM/YYYY';
              
              if (!newFormats[zohoCol]) newFormats[zohoCol] = [];
              if (!newFormats[zohoCol].includes(format)) {
                newFormats[zohoCol].push(format);
              }
            }
          }
        }

        if (Object.keys(newFormats).length > 0) {
          updates.newFormats = newFormats;
        }
      }

      await fetch(`/api/profiles/${selectedProfile.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      console.log('Profil mis a jour avec succes');

    } else if (profileMode === 'new') {
      console.log('Creation d un nouveau profil');

      const profileColumns = detectedColumns.map(col => {
        const resolution = resolvedIssues?.find(r => r.column === col.name);
        
        let dataType: 'date' | 'duration' | 'number' | 'text' | 'boolean' = 'text';
        if (col.detectedType === 'date') dataType = 'date';
        else if (col.detectedType === 'duration') dataType = 'duration';
        else if (col.detectedType === 'number') dataType = 'number';
        else if (col.detectedType === 'boolean') dataType = 'boolean';

        let config: Record<string, unknown>;
        
        if (dataType === 'date') {
          const dayMonthOrder = (resolution?.resolution?.type === 'date_format' && resolution.resolution.format === 'MM/DD/YYYY') ? 'mdy' : 'dmy';
          config = {
            type: 'date',
            acceptedFormats: col.detectedFormat ? [col.detectedFormat] : ['DD/MM/YYYY'],
            dayMonthOrder,
            outputFormat: 'iso',
          };
        } else if (dataType === 'duration') {
          config = {
            type: 'duration',
            acceptedFormats: col.detectedFormat ? [col.detectedFormat] : ['HH:mm', 'HH:mm:ss'],
            outputFormat: 'hms',
          };
        } else if (dataType === 'number') {
          config = {
            type: 'number',
            acceptedFormats: [
              { decimalSeparator: ',', thousandSeparator: ' ' },
              { decimalSeparator: '.', thousandSeparator: null },
            ],
            expandScientific: true,
            outputFormat: 'standard',
          };
        } else if (dataType === 'boolean') {
          config = {
            type: 'boolean',
            trueValues: ['Oui', 'Yes', '1', 'Vrai', 'true', 'O'],
            falseValues: ['Non', 'No', '0', 'Faux', 'false', 'N'],
          };
        } else {
          config = {
            type: 'text',
            trim: true,
            emptyValues: ['N/A', 'null', '-', 'NA', 'n/a'],
            expandScientific: true,
          };
        }

        return {
          zohoColumn: col.name,
          zohoType: 'PLAIN',
          isRequired: false,
          acceptedNames: [col.name],
          dataType,
          config,
        };
      });

     const profilePayload = {
        name: `Import ${state.config.tableName} - ${new Date().toLocaleDateString('fr-FR')}`,
        workspaceId: selectedWorkspaceId,
        workspaceName: workspace.name,
        viewId: state.config.tableId,
        viewName: state.config.tableName,
        columns: profileColumns,
        defaultImportMode: state.config.importMode,
        matchingColumns: matchingColumns.length > 0 ? matchingColumns : null,
      };

      const response = await fetch('/api/profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profilePayload),
      });

      const result = await response.json();

      if (!response.ok) {
        if (response.status === 409) {
          // Un profil existe déjà pour cette table, on le met à jour avec les colonnes
          console.log('Profil existant trouvé, mise à jour:', result.existingProfileId);
          
          // Faire un PUT pour mettre à jour le profil existant
           const updateResponse = await fetch(`/api/profiles/${result.existingProfileId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              columns: profileColumns,
              defaultImportMode: state.config.importMode,
              matchingColumns: matchingColumns.length > 0 ? matchingColumns : null,
              lastUsedAt: new Date().toISOString(),
              useCount: 1,
            }),
          });
          
          if (updateResponse.ok) {
            console.log('Profil existant mis à jour avec', profileColumns.length, 'colonnes');
          } else {
            console.error('Erreur mise à jour profil existant:', updateResponse.status);
          }
          return;
        }
        throw new Error(`Erreur creation profil: ${response.status}`);
      } else {
        console.log('Nouveau profil cree:', result.data?.id);
      }
    }
  }, [profileMode, selectedProfile, selectedMatchResult, resolvedIssues, detectedColumns, selectedWorkspaceId, workspaces, state.config, matchingColumns]);

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
          matchingColumns: matchingColumns.length > 0 ? matchingColumns : undefined,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Erreur lors de l'import");
      }

      // ==========================================================================
      // Sauvegarder/mettre a jour le profil apres import reussi
      // ==========================================================================
      if (profileMode !== 'skip') {
        try {
          await saveOrUpdateProfile();
        } catch (profileError) {
          console.error('Erreur sauvegarde profil (non bloquant):', profileError);
        }
      }

      setImportSuccess({
        success: true,
        importId: result.importId || `imp_${Date.now()}`,
        rowsImported: result.summary?.totalRowCount || validData.length,
        duration: result.duration || 0,
        zohoImportId: result.importId,
      });

      // Reset des etats
      setParsedData(null);
      setSchemaValidation(null);
      setZohoSchema(null);
      setResolvedIssues(null);
      setIssuesResolved(false);
      setSelectedProfile(null);
      setSelectedMatchResult(null);
      setDetectedColumns([]);
      setProfileMode('skip');
    } catch (error) {
      console.error('Erreur import:', error);
      setImportError(
        error instanceof Error ? error.message : "Erreur lors de l'import"
      );
    }
  }, [parsedData, state.config, state.validation, selectedWorkspaceId, profileMode, saveOrUpdateProfile, startImport, updateProgress, setImportSuccess, setImportError]);

  // ==========================================================================
  // Handlers pour StepProfile
  // ==========================================================================
  const handleProfileSelected = useCallback((profile: ImportProfile, matchResult: ProfileMatchResult) => {
    console.log('Profile selected:', profile.name);
    setSelectedProfile(profile);
    setSelectedMatchResult(matchResult);
    setProfileMode('existing');
    
       setSelectedWorkspaceId(profile.workspaceId);
    setTable(profile.viewId, profile.viewName);
    setImportMode(profile.defaultImportMode);
    setMatchingColumns(profile.matchingColumns || []);
    
    if (!matchResult.needsConfirmation) {
      goToStep('validating');
    } else {
      goToStep('configuring');
    }
  }, [setTable, setImportMode, goToStep]);

  const handleCreateNewProfile = useCallback((columns: DetectedColumn[]) => {
    console.log('Create new profile with', columns.length, 'columns');
    setDetectedColumns(columns);
    setProfileMode('new');
    setSelectedProfile(null);
     setMatchingColumns([]);
    goToStep('configuring');
  }, [goToStep]);

  const handleSkipProfile = useCallback((columns: DetectedColumn[]) => {
    console.log('Skip profile, import ponctuel');
    setDetectedColumns(columns);
    setProfileMode('skip');
    setSelectedProfile(null);
     setMatchingColumns([]);
    goToStep('configuring');
  }, [goToStep]);

  // Handler pour la resolution des issues
  const handleIssuesResolved = useCallback((resolved: ResolvableIssue[]) => {
    console.log('Issues resolues:', resolved.length);
    setResolvedIssues(resolved);
    setIssuesResolved(true);
  }, []);

  // Verifier si on doit afficher l etape de resolution
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
        if (!parsedData && state.config.file) {
          parseFile(state.config.file).then(result => {
            setParsedData(result.data);
          });
          return <div className="text-center p-8">Analyse du fichier en cours...</div>;
        }
        
        if (!parsedData) {
          return <div className="text-center p-8">Aucune donnee a analyser</div>;
        }
        
        return (
          <StepProfile
            fileData={(parsedData as Record<string, string>[])}
            fileName={state.config.file?.name || ''}
            onProfileSelected={handleProfileSelected}
            onCreateNewProfile={handleCreateNewProfile}
            onSkipProfile={handleSkipProfile}
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

            {profileMode === 'existing' && selectedProfile && (
             <Alert variant="info" className="mb-4">
                Profil &quot;{selectedProfile.name}&quot; selectionne - Table: {selectedProfile.viewName}
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
              matchingColumns={matchingColumns}
              onMatchingColumnsChange={setMatchingColumns}
              availableColumns={detectedColumns.map(c => c.name)}
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
        if (hasUnresolvedIssues && schemaValidation?.resolvableIssues) {
          return (
            <StepResolve
              issues={schemaValidation.resolvableIssues}
              onResolve={handleIssuesResolved}
              onBack={goBack}
            />
          );
        }
        
        return state.validation ? (
          <StepReview
            validation={state.validation}
            schemaValidation={schemaValidation}
            tableName={state.config.tableName}
            importMode={state.config.importMode}
            isImporting={isImporting}
            onBack={() => {
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
