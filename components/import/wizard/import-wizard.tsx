// components/import/wizard/import-wizard.tsx
'use client';

import { useCallback, useEffect, useState, useRef } from 'react';
import { WizardProgress } from './wizard-progress';
import { StepSource } from './step-source';
import { StepProfile } from './step-profile';
import { StepConfig } from './step-config';
import { StepValidate } from './step-validate';
import { StepReview } from './step-review';
import { StepResolve } from './step-resolve';
import { StepConfirm } from './step-confirm';
import { StepTransformPreview } from './step-transform-preview';
import { verifyImport, type SentRow, type VerificationResult, EMPTY_VERIFICATION_RESULT } from '@/lib/domain/verification';
import { StepTestImport } from './step-test-import';
import { StepTestResult } from './step-test-result';
import { applyAllTransformations } from '@/lib/domain/data-transformer';
import { MatchingColumnSelector } from './matching-column-selector';
import { 
  findBestMatchingColumnEnhanced, 
  type MatchingColumnResult 
} from '@/lib/domain/verification';
import { executeRollback, type RollbackResult } from '@/lib/domain/rollback';
import type { TestImportResult } from '@/types';

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
import { toast } from 'sonner';

// ==================== CONSTANTES CHUNKING ====================
const CHUNK_SIZE = 5000;  // Lignes par chunk (~ 1-2MB selon les données)
const MAX_RETRIES = 2;    // Tentatives par chunk en cas d'erreur

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
  startTestImport,        // ← NOUVEAU
  setTestImportComplete,  // ← NOUVEAU
  startFullImport,        // ← NOUVEAU
  updateProgress,
  setImportSuccess,
  setImportError,
  goToStep,
  goNext,
  goBack,
  reset,
  canGoNext,
  isImporting,
  isTestImporting,        // ← NOUVEAU
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
  const [zohoReferenceRow, setZohoReferenceRow] = useState<Record<string, unknown> | null>(null);

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
const [verificationSample, setVerificationSample] = useState<SentRow[]>([]);

// ==========================================================================
// État pour l'import en 2 phases
// ==========================================================================
const [testSampleSize, setTestSampleSize] = useState(5);
const [verificationColumn, setVerificationColumn] = useState<string | null>(null);
const [matchingColumnResult, setMatchingColumnResult] = useState<MatchingColumnResult | null>(null);
const [testMatchingValues, setTestMatchingValues] = useState<string[]>([]);
// Ref pour accès immédiat à l'échantillon (évite le délai du state React)
const verificationSampleRef = useRef<SentRow[]>([]);
// Refs pour accès immédiat aux valeurs de matching (évite le délai du state React)
const verificationColumnRef = useRef<string | null>(null);
const testMatchingValuesRef = useRef<string[]>([]);
// Mission 012 : Stratégie RowID
const [maxRowIdBeforeTest, setMaxRowIdBeforeTest] = useState<number | null>(null);
const maxRowIdBeforeTestRef = useRef<number | null>(null);
const [tableName, setTableName] = useState<string | null>(null);

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

  // ==========================================================================
  // NOUVEAU : Helper pour extraire les types de colonnes du schema Zoho
  // ==========================================================================
  const getColumnTypesFromSchema = useCallback((): Record<string, string> | undefined => {
    if (!zohoSchema?.columns || zohoSchema.columns.length === 0) {
      console.log('[ColumnTypes] Pas de schema Zoho disponible');
      return undefined;
    }
    
    const types: Record<string, string> = {};
    for (const col of zohoSchema.columns) {
      types[col.columnName] = col.dataType;
    }
    
    console.log('[ColumnTypes] Types extraits du schema Zoho:', types);
    return Object.keys(types).length > 0 ? types : undefined;
  }, [zohoSchema]);

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
      
      updateProgress({ phase: 'parsing', current: 100, total: 100, percentage: 20 });

      // Phase 2: Recuperation du schema Zoho
      updateProgress({ phase: 'validating', current: 20, total: 100, percentage: 30 });
      console.log('Recuperation du schema Zoho...');
      const schema = await fetchZohoSchema(selectedWorkspaceId, state.config.tableId, state.config.tableName);
      setZohoSchema(schema);

     
      // Phase 2b: Récupération d'une ligne de référence Zoho (pour preview)
      try {
        const refResponse = await fetch(
         `/api/zoho/sample-row?workspaceId=${selectedWorkspaceId}&tableName=${encodeURIComponent(state.config.tableName)}`
        );
        const refData = await refResponse.json();
        if (refData.success && refData.data) {
          setZohoReferenceRow(refData.data);
          console.log('[Reference] Ligne Zoho de référence récupérée:', refData.data);
        } else {
          setZohoReferenceRow(null);
          console.log('[Reference] Aucune donnée existante dans la table');
        }
      } catch (refError) {
        console.warn('[Reference] Erreur récupération ligne de référence:', refError);
        setZohoReferenceRow(null);
      }

      // Phase 3: Validation du schema (correspondance colonnes)
let schemaResult: SchemaValidationResult | null = null;

if (schema && schema.columns.length > 0) {
        updateProgress({ phase: 'validating', current: 40, total: 100, percentage: 50 });
        console.log('Validation du schema...');

        // Extraire les headers et donnees pour la validation
        const headers = parseResult.data.length > 0 ? Object.keys(parseResult.data[0]) : [];
        const sampleData = parseResult.data.slice(0, 100).map(row =>
          headers.map(h => String((row as Record<string, unknown>)[h] ?? ''))
        );

       schemaResult = validateSchema({
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

       // ========================================================================
      // Appliquer les transformations aux données parsées
      // C'est la SOURCE DE VÉRITÉ - ces données seront utilisées pour preview ET envoi à Zoho
      // ========================================================================
      const transformedData = applyAllTransformations(
        parseResult.data as Record<string, unknown>[],
        schemaResult?.matchedColumns
      );
      console.log('[Transformation] Données transformées:', transformedData.length, 'lignes');
      
      // Stocker les données TRANSFORMÉES (pas les données brutes)
      setParsedData(transformedData);

     
      // Phase 4: Validation des donnees (regles metier)
      updateProgress({ phase: 'validating', current: 60, total: 100, percentage: 70 });
      const validationConfig: TableValidationConfig = {
        tableId: state.config.tableId,
        tableName: state.config.tableName,
        columns: [],
      };

      console.log('Debut de la validation des donnees...');
      const result = await validate(transformedData, validationConfig);
      console.log('Validation terminee:', result);

      setValidationResult(result);
    } catch (error) {
      console.error('Erreur validation:', error);
      setValidationError(
        error instanceof Error ? error.message : 'Erreur lors de la validation'
      );
    }
  }, [state.config.file, state.config.tableId, state.config.tableName, selectedWorkspaceId, startValidation, updateProgress, parseFile, fetchZohoSchema, validate, setValidationResult, setValidationError, selectedProfile]);

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

    // ==================== NOUVEAU : Sauvegarder échantillon pour vérification ====================
    const sampleSize = 5;
    const sampleRows: SentRow[] = validData.slice(0, sampleSize).map((row, index) => ({
      index: index + 2, // +2 car ligne 1 = headers, index 0 = ligne 2
      data: Object.fromEntries(
        Object.entries(row).map(([k, v]) => [k, String(v ?? '')])
      ) as Record<string, string>,
    }));
    setVerificationSample(sampleRows);
    
    // ==================== FIN NOUVEAU ====================

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
        columnTypes: getColumnTypesFromSchema(),  // ← NOUVEAU : Passer les types Zoho
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "Erreur lors de l'import");
    }

    // Sauvegarder/mettre à jour le profil après import réussi
    if (profileMode !== 'skip') {
      try {
        await saveOrUpdateProfile();
      } catch (profileError) {
        console.error('Erreur sauvegarde profil (non bloquant):', profileError);
      }
    }

    // ==================== NOUVEAU : Lancer la vérification post-import ====================
    let verificationResult: VerificationResult = EMPTY_VERIFICATION_RESULT;
    
    if (sampleRows.length > 0) {
      try {
        updateProgress({
          phase: 'validating', // Réutiliser pour afficher "Vérification..."
          current: 90,
          total: 100,
          percentage: 90,
        });

        verificationResult = await verifyImport(sampleRows, {
          mode: state.config.importMode,
          matchingColumn: matchingColumns.length > 0 ? matchingColumns[0] : undefined,
          sampleSize: sampleRows.length,
          workspaceId: selectedWorkspaceId,
          viewId: state.config.tableId,
          delayBeforeRead: 2000,
        });

        console.log('[Verification] Result:', verificationResult);
      } catch (verifyError) {
        console.error('Erreur vérification (non bloquant):', verifyError);
        // La vérification a échoué mais l'import est réussi
        verificationResult = {
          ...EMPTY_VERIFICATION_RESULT,
          performed: true,
          errorMessage: verifyError instanceof Error ? verifyError.message : 'Erreur de vérification',
        };
      }
    }
    // ==================== FIN NOUVEAU ====================

    setImportSuccess({
      success: true,
      importId: result.importId || `imp_${Date.now()}`,
      rowsImported: result.summary?.totalRowCount || validData.length,
      duration: result.duration || 0,
      zohoImportId: result.importId,
      verification: verificationResult, // ← NOUVEAU
    });

    // Reset des états
    setParsedData(null);
    setSchemaValidation(null);
    setZohoSchema(null);
    setResolvedIssues(null);
    setIssuesResolved(false);
    setSelectedProfile(null);
    setSelectedMatchResult(null);
    setDetectedColumns([]);
    setProfileMode('skip');
    setVerificationSample([]); // ← NOUVEAU
  } catch (error) {
    console.error('Erreur import:', error);
    setImportError(
      error instanceof Error ? error.message : "Erreur lors de l'import"
    );
  }
}, [
  parsedData, 
  state.config, 
  state.validation, 
  selectedWorkspaceId, 
  profileMode, 
  saveOrUpdateProfile, 
  startImport, 
  updateProgress, 
  setImportSuccess, 
  setImportError,
  matchingColumns,
  getColumnTypesFromSchema,  // ← NOUVEAU : Ajouter à la liste des dépendances
]);
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

    console.log('[Wizard] hasUnresolvedIssues:', hasUnresolvedIssues);
console.log('[Wizard] schemaValidation?.resolvableIssues:', schemaValidation?.resolvableIssues?.length);
console.log('[Wizard] issuesResolved:', issuesResolved);

    // ==========================================================================
// Handlers pour l'import en 2 phases
// ==========================================================================

/**
 * Prépare et lance l'import test
 */
const handleStartTestImport = useCallback(async () => {
  if (!parsedData || !state.config.tableId || !state.validation) return;

  // Détecter la colonne de matching si pas encore fait
  if (!verificationColumn && verificationSample.length > 0) {
    const result = findBestMatchingColumnEnhanced(verificationSample, {
      profile: selectedProfile || undefined,
      zohoSchema: zohoSchema?.columns,
    });
    setMatchingColumnResult(result);
    setVerificationColumn(result.column || null);
verificationColumnRef.current = result.column || null;  // Stockage immédiat
  }

  startTestImport();
}, [parsedData, state.config.tableId, state.validation, verificationColumn, verificationSample, selectedProfile, zohoSchema, startTestImport]);

/**
 * Exécute l'import de l'échantillon test
 */
const executeTestImport = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
  if (!parsedData || !state.config.tableId) {
    return { success: false, error: 'Données manquantes' };
  }

  try {
    // Filtrer les données valides
    const validData = parsedData.filter((_, index) => {
      const lineNumber = index + 2;
      return !state.validation!.errors.some((err) => err.line === lineNumber);
    });

    // Prendre l'échantillon
    const sampleData = validData.slice(0, testSampleSize);

    // Construire l'échantillon pour vérification
    const sampleRows: SentRow[] = sampleData.map((row, index) => ({
      index: index + 2,
      data: Object.fromEntries(
        Object.entries(row).map(([k, v]) => [k, String(v ?? '')])
      ) as Record<string, string>,
    }));

    // Détecter la colonne de matching si pas encore fait
    let matchingCol = verificationColumn;
    if (!matchingCol && sampleRows.length > 0) {
      const result = findBestMatchingColumnEnhanced(sampleRows, {
        profile: selectedProfile || undefined,
        zohoSchema: zohoSchema?.columns,
      });
      matchingCol = result.column || null;
      setVerificationColumn(matchingCol);
      verificationColumnRef.current = matchingCol;
      setMatchingColumnResult(result);
      console.log('[TestImport] Detected matching column:', matchingCol);
    }

    // Sauvegarder les valeurs de matching pour le rollback
    if (matchingCol) {
      const values = sampleRows
        .map(row => String(row.data[matchingCol!] ?? '').trim())
        .filter(v => v !== '');
      setTestMatchingValues(values);
      testMatchingValuesRef.current = values;
      console.log('[TestImport] Matching values:', values);
    }

    // Stocker l'échantillon
    setVerificationSample(sampleRows);
    verificationSampleRef.current = sampleRows;

    // ─────────────────────────────────────────────────────────────────────────
    // Mission 012 : Récupérer MAX(RowID) AVANT l'import pour stratégie RowID
    // ─────────────────────────────────────────────────────────────────────────
    const currentTableName = state.config.tableName || null;
    setTableName(currentTableName);
    
    if (currentTableName && selectedWorkspaceId) {
      try {
        console.log('[TestImport] Fetching MAX(RowID) before import...');
        const maxResponse = await fetch(
          `/api/zoho/verify-by-rowid?workspaceId=${selectedWorkspaceId}&tableName=${encodeURIComponent(currentTableName)}&action=getMax`
        );
        const maxResult = await maxResponse.json();
        
        if (maxResult.success && maxResult.data?.[0]) {
          const maxRowId = Number(maxResult.data[0].maxRowId || maxResult.data[0].maxrowid || 0);
          setMaxRowIdBeforeTest(maxRowId);
          maxRowIdBeforeTestRef.current = maxRowId;
          console.log('[TestImport] MAX(RowID) before import:', maxRowId);
        } else {
          console.warn('[TestImport] Could not get MAX(RowID):', maxResult.error);
          setMaxRowIdBeforeTest(null);
          maxRowIdBeforeTestRef.current = null;
        }
      } catch (e) {
        console.warn('[TestImport] Error getting MAX(RowID):', e);
        setMaxRowIdBeforeTest(null);
        maxRowIdBeforeTestRef.current = null;
      }
    }
    // ─────────────────────────────────────────────────────────────────────────

    // Convertir en CSV
    const csvData = Papa.unparse(sampleData);

    // Envoyer à Zoho avec les types de colonnes
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
      error: error instanceof Error ? error.message : 'Erreur inconnue'
    };
  }
}, [parsedData, state.config, state.validation, testSampleSize, verificationColumn, selectedWorkspaceId, matchingColumns, selectedProfile, zohoSchema, getColumnTypesFromSchema]);
/**
 * Exécute la vérification après import test
 */
const executeTestVerification = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
  // Utiliser la ref pour accès immédiat (le state peut ne pas être à jour)
  const sampleToVerify = verificationSampleRef.current;
  
  if (sampleToVerify.length === 0) {
    return { success: false, error: 'Pas d\'échantillon à vérifier' };
  }

  try {
     const verificationResult = await verifyImport(sampleToVerify, {
      mode: state.config.importMode,
      matchingColumn: verificationColumnRef.current || undefined,
      sampleSize: sampleToVerify.length,
      workspaceId: selectedWorkspaceId,
      viewId: state.config.tableId,
      delayBeforeRead: 2000,
      // Mission 012 : Support stratégie RowID
      tableName: tableName || state.config.tableName || undefined,
      maxRowIdBeforeImport: maxRowIdBeforeTestRef.current ?? undefined,
    });

    // Créer le résultat du test
    const testResult: TestImportResult = {
      success: verificationResult.success,
      rowsImported: sampleToVerify.length,
      matchingColumn: verificationColumn || '',
      matchingValues: testMatchingValues,
      verification: verificationResult,
      duration: verificationResult.duration,
    };

    setTestImportComplete(testResult);

    return { 
      success: verificationResult.success,
      error: verificationResult.success ? undefined : 'Anomalies détectées'
    };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Erreur de vérification' 
    };
  }
}, [state.config, verificationColumn, selectedWorkspaceId, testMatchingValues, setTestImportComplete]);
/**
 * Gère le test import complet (appelé par StepTestImport)
 */
const handleTestComplete = useCallback((success: boolean) => {
  // Le résultat est déjà set par executeTestVerification via setTestImportComplete
  console.log('[Wizard] Test import complete, success:', success);
}, []);

/**
 * Gère les erreurs du test import
 */
const handleTestError = useCallback((error: string) => {
  setImportError(error);
}, [setImportError]);

/**
 * Exécute le rollback - Supporte stratégie RowID et matching_key (Mission 012)
 */
const handleRollback = useCallback(async (): Promise<RollbackResult> => {
  // Déterminer la stratégie selon le mode d'import
  const mode = state.config.importMode;
  const useRowIdStrategy = 
    (mode === 'append' || mode === 'truncateadd' || mode === 'onlyadd') &&
    maxRowIdBeforeTestRef.current !== null;

  console.log('[Rollback] Strategy:', useRowIdStrategy ? 'rowid' : 'matching_key');

  if (useRowIdStrategy) {
    // ─────────────────────────────────────────────────────────────────────────
    // Stratégie RowID : Supprimer les lignes avec RowID > maxRowIdBeforeTest
    // ─────────────────────────────────────────────────────────────────────────
    console.log('[Rollback] Using RowID strategy, deleting rows after:', maxRowIdBeforeTestRef.current);

    const result = await executeRollback({
      workspaceId: selectedWorkspaceId,
      viewId: state.config.tableId,
      tableName: tableName || state.config.tableName || undefined,
      rowIdRange: { min: maxRowIdBeforeTestRef.current! },
      reason: 'user_cancelled',
    });

    if (result.success) {
      toast.success(`${result.deletedRows} lignes supprimées de Zoho`);
      goToStep('previewing');
      // Reset les états ET les refs
      setTestMatchingValues([]);
      testMatchingValuesRef.current = [];
      setVerificationSample([]);
      verificationSampleRef.current = [];
      setMaxRowIdBeforeTest(null);
      maxRowIdBeforeTestRef.current = null;
    }

    return result;
  } else {
    // ─────────────────────────────────────────────────────────────────────────
    // Stratégie matching_key : Comportement existant
    // ─────────────────────────────────────────────────────────────────────────
    const column = verificationColumnRef.current;
    const values = testMatchingValuesRef.current;

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
      workspaceId: selectedWorkspaceId,
      viewId: state.config.tableId,
      matchingColumn: column,
      matchingValues: values,
      reason: 'user_cancelled',
    });

    if (result.success) {
      toast.success(`${result.deletedRows} lignes supprimées de Zoho`);
      goToStep('previewing');
      // Reset les états ET les refs
      setTestMatchingValues([]);
      testMatchingValuesRef.current = [];
      setVerificationSample([]);
      verificationSampleRef.current = [];
    }

    return result;
  }
}, [selectedWorkspaceId, state.config.tableId, state.config.tableName, state.config.importMode, tableName, goToStep]);

/**
 * Confirme l'import complet après test réussi - VERSION CHUNKING
 */
const handleConfirmFullImport = useCallback(async () => {
  if (!parsedData || !state.config.tableId || !state.validation) return;

  startFullImport();

  try {
    // Filtrer les données valides
    const validData = parsedData.filter((_, index) => {
      const lineNumber = index + 2;
      return !state.validation!.errors.some((err) => err.line === lineNumber);
    });

    // Prendre les données RESTANTES (après l'échantillon test)
    const remainingData = validData.slice(testSampleSize);

    if (remainingData.length === 0) {
      // Toutes les données ont déjà été importées dans le test
      setImportSuccess({
        success: true,
        importId: `imp_${Date.now()}`,
        rowsImported: testSampleSize,
        duration: 0,
        verification: state.testResult?.verification,
      });
      return;
    }

    // ==================== CHUNKING ====================
    const totalChunks = Math.ceil(remainingData.length / CHUNK_SIZE);
    let totalImported = 0;
    const startTime = Date.now();

    console.log(`[Import] Démarrage import par chunks: ${remainingData.length} lignes en ${totalChunks} lot(s) de ${CHUNK_SIZE} lignes max`);

    for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
      const start = chunkIndex * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, remainingData.length);
      const chunk = remainingData.slice(start, end);

      // Mise à jour progression avec info chunk
      const chunkPercentage = Math.round(((chunkIndex + 0.5) / totalChunks) * 100);
      updateProgress({
        phase: 'full-importing',
        current: start + Math.floor(chunk.length / 2),
        total: remainingData.length,
        percentage: chunkPercentage,
        chunk: {
          current: chunkIndex + 1,
          total: totalChunks,
        },
      });

      console.log(`[Import] Chunk ${chunkIndex + 1}/${totalChunks}: lignes ${start + 1}-${end} (${chunk.length} lignes)`);

      // Convertir en CSV
      const csvData = Papa.unparse(chunk);

      // Retry loop
      let success = false;
      let lastError: string | null = null;

      for (let retry = 0; retry <= MAX_RETRIES && !success; retry++) {
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
              workspaceId: selectedWorkspaceId,
              tableId: state.config.tableId,
              tableName: state.config.tableName,
              importMode: 'append', // Toujours append pour les données restantes
              csvData: csvData,
              fileName: state.config.file?.name,
              totalRows: chunk.length,
              matchingColumns: matchingColumns.length > 0 ? matchingColumns : undefined,
              columnTypes: getColumnTypesFromSchema(),
            }),
          });

          const result = await response.json();

          if (response.ok && result.success) {
            success = true;
            totalImported += chunk.length;
            console.log(`[Import] Chunk ${chunkIndex + 1} OK: ${chunk.length} lignes importées (total: ${totalImported})`);
          } else {
            lastError = result.error || 'Erreur inconnue';
            console.warn(`[Import] Chunk ${chunkIndex + 1} erreur:`, lastError);
          }
        } catch (error) {
          lastError = error instanceof Error ? error.message : 'Erreur réseau';
          console.warn(`[Import] Chunk ${chunkIndex + 1} exception:`, lastError);
        }
      }

      if (!success) {
        throw new Error(
          `Échec à l'import du lot ${chunkIndex + 1}/${totalChunks} (lignes ${start + 1}-${end}): ${lastError}`
        );
      }

      // Mise à jour progression après chunk réussi
      const completedPercentage = Math.round(((chunkIndex + 1) / totalChunks) * 100);
      updateProgress({
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
    console.log(`[Import] Terminé: ${totalImported} lignes en ${duration}ms (${totalChunks} chunks)`);

    // Sauvegarder/mettre à jour le profil
    if (profileMode !== 'skip') {
      try {
        await saveOrUpdateProfile();
      } catch (profileError) {
        console.error('Erreur sauvegarde profil (non bloquant):', profileError);
      }
    }

    setImportSuccess({
      success: true,
      importId: `imp_${Date.now()}`,
      rowsImported: testSampleSize + totalImported,
      duration,
      verification: state.testResult?.verification,
    });

    // Reset
    setParsedData(null);
    setSchemaValidation(null);
    setZohoSchema(null);
    setResolvedIssues(null);
    setIssuesResolved(false);
    setSelectedProfile(null);
    setSelectedMatchResult(null);
    setDetectedColumns([]);
    setProfileMode('skip');
    setVerificationSample([]);
    setTestMatchingValues([]);
    testMatchingValuesRef.current = [];
    setVerificationColumn(null);
    verificationColumnRef.current = null;

  } catch (error) {
    console.error('Erreur import complet:', error);
    setImportError(
      error instanceof Error ? error.message : "Erreur lors de l'import"
    );
  }
}, [
  parsedData,
  state.config,
  state.validation,
  state.testResult,
  testSampleSize,
  selectedWorkspaceId,
  matchingColumns,
  profileMode,
  saveOrUpdateProfile,
  startFullImport,
  updateProgress,
  setImportSuccess,
  setImportError,
  getColumnTypesFromSchema,
]);

/**
 * Force l'import malgré les anomalies
 */
const handleForceImport = useCallback(() => {
  // Lancer l'import complet même avec anomalies
  handleConfirmFullImport();
}, [handleConfirmFullImport]);


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
  // Appliquer les transformations de base même sans schéma
  const transformed = applyAllTransformations(result.data as Record<string, unknown>[]);
  setParsedData(transformed);
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

        case 'previewing':
        return (
          <StepTransformPreview
            autoTransformations={schemaValidation?.autoTransformations || []}
            matchedColumns={schemaValidation?.matchedColumns || []}
            parsedData={parsedData || []}
            totalRows={state.validation?.totalRows || 0}
            zohoReferenceRow={zohoReferenceRow}
            onBack={() => goToStep('configuring')}
            onConfirm={() => goToStep('reviewing')}
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
            isImporting={isImporting || isTestImporting}  // ← MODIFIÉ
            onBack={() => {
              if (resolvedIssues && schemaValidation?.resolvableIssues && schemaValidation.resolvableIssues.length > 0) {
                setIssuesResolved(false);
              } else {
                goBack();
              }
            }}
            onImport={handleStartTestImport}  // ← MODIFIÉ : lance le test au lieu de l'import direct
            resolvedIssues={resolvedIssues || []}
          />
        ) : null;

        // ==================== NOUVEAU : Étapes 2 phases ====================
      case 'test-importing':
        return (
          <StepTestImport
            sampleSize={testSampleSize}
            matchingColumn={verificationColumn}
            matchingValues={testMatchingValues}
            onComplete={handleTestComplete}
            onError={handleTestError}
            executeImport={executeTestImport}
            executeVerification={executeTestVerification}
          />
        );

      case 'test-result':
        if (!state.testResult) return null;
        
        const totalValidRows = parsedData 
          ? parsedData.filter((_, index) => {
              const lineNumber = index + 2;
              return !state.validation!.errors.some((err) => err.line === lineNumber);
            }).length
          : 0;
        const remainingRows = totalValidRows - testSampleSize;

        return (
          <StepTestResult
            verificationResult={state.testResult.verification}
            sampleSize={testSampleSize}
            remainingRows={remainingRows}
            matchingColumn={verificationColumn || ''}
            matchingValues={testMatchingValues}
            onConfirmFullImport={handleConfirmFullImport}
            onRollbackAndFix={handleRollback}
            onForceImport={handleForceImport}
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
      // ==================== FIN NOUVEAU ====================

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
