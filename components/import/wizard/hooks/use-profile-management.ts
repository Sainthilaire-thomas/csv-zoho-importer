// components/import/wizard/hooks/use-profile-management.ts
'use client';

import { useCallback } from 'react';
import type { ImportProfile, ProfileMatchResult, DetectedColumn } from '@/types/profiles';
import type { ResolvableIssue } from '@/lib/infrastructure/zoho/types';
import type { ProfileState, IssuesState, ZohoWorkspace } from './use-import-wizard-state';
import type { ImportMode, ImportStatus } from '@/types';
// ============================================================================
// Types
// ============================================================================

export interface ProfileManagementConfig {
  /** État du profil (depuis useImportWizardState) */
  profileState: ProfileState;
  /** État des issues (depuis useImportWizardState) */
  issuesState: IssuesState;
  /** Liste des workspaces disponibles */
  workspaces: ZohoWorkspace[];
  /** ID du workspace sélectionné */
  selectedWorkspaceId: string;
  /** Configuration actuelle de l'import */
  importConfig: {
    tableId: string;
    tableName: string;
    importMode: string;
  };
  /** Callbacks de navigation */
  navigation: {
    setTable: (id: string, name: string) => void;
    setImportMode: (mode: ImportMode) => void;
    goToStep: (step: ImportStatus) => void;
    setWorkspaceId: (id: string) => void;
  };
}

export interface ProfileManagementActions {
  /** Sélectionne un profil existant */
  handleProfileSelected: (profile: ImportProfile, matchResult: ProfileMatchResult) => void;
  /** Crée un nouveau profil */
  handleCreateNewProfile: (columns: DetectedColumn[]) => void;
  /** Skip le profil (import ponctuel) */
  handleSkipProfile: (columns: DetectedColumn[]) => void;
  /** Sauvegarde ou met à jour le profil après import */
  saveOrUpdateProfile: () => Promise<void>;
}

// ============================================================================
// Hook
// ============================================================================

export function useProfileManagement(config: ProfileManagementConfig): ProfileManagementActions {
  const {
    profileState,
    issuesState,
    workspaces,
    selectedWorkspaceId,
    importConfig,
    navigation,
  } = config;

  // ─────────────────────────────────────────────────────────────────────────
  // Sélection d'un profil existant
  // ─────────────────────────────────────────────────────────────────────────
const handleProfileSelected = useCallback((
  profile: ImportProfile,
  matchResult: ProfileMatchResult
) => {
  console.log('[ProfileManagement] Profile selected:', profile.name);
  
  profileState.setSelectedProfile(profile);
  profileState.setSelectedMatchResult(matchResult);
  profileState.setMode('existing');
  profileState.setMatchingColumns(profile.matchingColumns || []);

  // Pré-remplir la configuration - AJOUTER setWorkspaceId
  navigation.setWorkspaceId(profile.workspaceId);  // ← AJOUTER
  navigation.setTable(profile.viewId, profile.viewName);
  navigation.setImportMode(profile.defaultImportMode);

  // Navigation selon si confirmation nécessaire
  if (!matchResult.needsConfirmation) {
    navigation.goToStep('validating');
  } else {
    navigation.goToStep('configuring');
  }
}, [profileState, navigation]);

  // ─────────────────────────────────────────────────────────────────────────
  // Création d'un nouveau profil
  // ─────────────────────────────────────────────────────────────────────────
  const handleCreateNewProfile = useCallback((columns: DetectedColumn[]) => {
    console.log('[ProfileManagement] Create new profile with', columns.length, 'columns');
    
    profileState.setDetectedColumns(columns);
    profileState.setMode('new');
    profileState.setSelectedProfile(null);
    profileState.setMatchingColumns([]);
    
    navigation.goToStep('configuring');
  }, [profileState, navigation]);

  // ─────────────────────────────────────────────────────────────────────────
  // Skip profil (import ponctuel)
  // ─────────────────────────────────────────────────────────────────────────
  const handleSkipProfile = useCallback((columns: DetectedColumn[]) => {
    console.log('[ProfileManagement] Skip profile, import ponctuel');
    
    profileState.setDetectedColumns(columns);
    profileState.setMode('skip');
    profileState.setSelectedProfile(null);
    profileState.setMatchingColumns([]);
    
    navigation.goToStep('configuring');
  }, [profileState, navigation]);

  // ─────────────────────────────────────────────────────────────────────────
  // Sauvegarde ou mise à jour du profil
  // ─────────────────────────────────────────────────────────────────────────
  const saveOrUpdateProfile = useCallback(async () => {
    const workspace = workspaces.find(w => w.id === selectedWorkspaceId);
    if (!workspace) {
      console.error('[ProfileManagement] Workspace non trouvé');
      return;
    }

    const { mode, selectedProfile, selectedMatchResult, detectedColumns, matchingColumns } = profileState;
    const { resolvedIssues } = issuesState;

    // ───────────────────────────────────────────────────────────────────────
    // Mise à jour d'un profil existant
    // ───────────────────────────────────────────────────────────────────────
    if (mode === 'existing' && selectedProfile) {
      console.log('[ProfileManagement] Mise à jour du profil existant:', selectedProfile.id);

      const updates: Record<string, unknown> = {
        lastUsedAt: new Date().toISOString(),
        incrementUseCount: true,
      };

      // Ajouter les nouveaux alias détectés
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

      // Ajouter les nouveaux formats de date résolus
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
              const format = issue.resolution?.type === 'date_format'
                ? issue.resolution.format
                : 'DD/MM/YYYY';

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

      console.log('[ProfileManagement] Profil mis à jour avec succès');
      return;
    }

    // ───────────────────────────────────────────────────────────────────────
    // Création d'un nouveau profil
    // ───────────────────────────────────────────────────────────────────────
    if (mode === 'new') {
      console.log('[ProfileManagement] Création d\'un nouveau profil');

      const profileColumns = buildProfileColumns(detectedColumns, resolvedIssues);

      const profilePayload = {
        name: `Import ${importConfig.tableName} - ${new Date().toLocaleDateString('fr-FR')}`,
        workspaceId: selectedWorkspaceId,
        workspaceName: workspace.name,
        viewId: importConfig.tableId,
        viewName: importConfig.tableName,
        columns: profileColumns,
        defaultImportMode: importConfig.importMode,
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
          // Profil existant, mise à jour
          console.log('[ProfileManagement] Profil existant trouvé, mise à jour:', result.existingProfileId);

          const updateResponse = await fetch(`/api/profiles/${result.existingProfileId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              columns: profileColumns,
              defaultImportMode: importConfig.importMode,
              matchingColumns: matchingColumns.length > 0 ? matchingColumns : null,
              lastUsedAt: new Date().toISOString(),
              useCount: 1,
            }),
          });

          if (updateResponse.ok) {
            console.log('[ProfileManagement] Profil existant mis à jour avec', profileColumns.length, 'colonnes');
          } else {
            console.error('[ProfileManagement] Erreur mise à jour profil existant:', updateResponse.status);
          }
          return;
        }
        throw new Error(`Erreur création profil: ${response.status}`);
      }

      console.log('[ProfileManagement] Nouveau profil créé:', result.data?.id);
    }
  }, [
    workspaces,
    selectedWorkspaceId,
    profileState,
    issuesState,
    importConfig,
  ]);

  return {
    handleProfileSelected,
    handleCreateNewProfile,
    handleSkipProfile,
    saveOrUpdateProfile,
  };
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Construit les colonnes du profil à partir des colonnes détectées
 */
function buildProfileColumns(
  detectedColumns: DetectedColumn[],
  resolvedIssues: ResolvableIssue[] | null
) {
  return detectedColumns.map(col => {
    const resolution = resolvedIssues?.find(r => r.column === col.name);

    // Déterminer le type de données
    let dataType: 'date' | 'duration' | 'number' | 'text' | 'boolean' = 'text';
    if (col.detectedType === 'date') dataType = 'date';
    else if (col.detectedType === 'duration') dataType = 'duration';
    else if (col.detectedType === 'number') dataType = 'number';
    else if (col.detectedType === 'boolean') dataType = 'boolean';

    // Construire la configuration selon le type
    let config: Record<string, unknown>;

    if (dataType === 'date') {
      const dayMonthOrder = (
        resolution?.resolution?.type === 'date_format' &&
        resolution.resolution.format === 'MM/DD/YYYY'
      ) ? 'mdy' : 'dmy';

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
}
