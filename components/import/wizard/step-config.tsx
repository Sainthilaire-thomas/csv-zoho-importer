// components/import/wizard/step-config.tsx
'use client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { ArrowLeft, ArrowRight, Database, Loader2, Building2, Key } from 'lucide-react';
import { TableSelectorAccordion } from '@/components/import/table-selector-accordion';
import type { ImportMode } from '@/types';

interface ZohoWorkspace {
  id: string;
  name: string;
}

interface StepConfigProps {
  fileName: string;
  fileSize: number;
  // Workspaces
  workspaces: ZohoWorkspace[];
  selectedWorkspaceId: string;
  isLoadingWorkspaces: boolean;
  onWorkspaceSelect: (workspaceId: string) => void;
  // Tables
  selectedTableId: string;
  importMode: ImportMode;
  onTableSelect: (tableId: string, tableName: string) => void;
  onImportModeChange: (mode: ImportMode) => void;
  onBack: () => void;
  onNext: () => void;
  canProceed: boolean;
  // Matching columns (pour modes UPDATE*)
  matchingColumns: string[];
  onMatchingColumnsChange: (columns: string[]) => void;
  availableColumns: string[];
}

const IMPORT_MODES: { value: ImportMode; label: string; description: string }[] = [
  {
    value: 'append',
    label: 'Ajouter (APPEND)',
    description: 'Ajoute les nouvelles lignes à la fin de la table',
  },
  {
    value: 'truncateadd',
    label: 'Remplacer tout (TRUNCATEADD)',
    description: 'Supprime toutes les données existantes avant d\'importer',
  },
  {
    value: 'updateadd',
    label: 'Mettre à jour ou ajouter (UPDATEADD)',
    description: 'Met à jour les lignes existantes, ajoute les nouvelles',
  },
  {
    value: 'deleteupsert',
    label: 'Synchroniser (DELETEUPSERT)',
    description: 'Supprime les lignes absentes du fichier, met à jour/ajoute les autres',
  },
  {
    value: 'onlyadd',
    label: 'Ajouter uniquement les nouvelles (ONLYADD)',
    description: 'Ajoute uniquement les lignes qui n\'existent pas',
  },
];

// Modes nécessitant une clé de matching
const MODES_REQUIRING_KEY: ImportMode[] = ['updateadd', 'deleteupsert', 'onlyadd'];

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export function StepConfig({
  fileName,
  fileSize,
  workspaces,
  selectedWorkspaceId,
  isLoadingWorkspaces,
  onWorkspaceSelect,
  selectedTableId,
  importMode,
  onTableSelect,
  onImportModeChange,
  onBack,
  onNext,
  canProceed,
  matchingColumns,
  onMatchingColumnsChange,
  availableColumns,
}: StepConfigProps) {
  const handleWorkspaceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onWorkspaceSelect(e.target.value);
    onTableSelect('', '');
  };

  const handleColumnToggle = (columnName: string) => {
    if (matchingColumns.includes(columnName)) {
      onMatchingColumnsChange(matchingColumns.filter(c => c !== columnName));
    } else {
      onMatchingColumnsChange([...matchingColumns, columnName]);
    }
  };

  const requiresConfirmation = importMode === 'truncateadd' || importMode === 'deleteupsert';
  const requiresMatchingKey = MODES_REQUIRING_KEY.includes(importMode);
  const hasMatchingKey = matchingColumns.length > 0;
  
  // Bloquer si mode UPDATE* sans clé de matching
  const canProceedFinal = canProceed && 
    !!selectedWorkspaceId && 
    !!selectedTableId &&
    (!requiresMatchingKey || hasMatchingKey);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5" />
          Configuration de l&apos;import
        </CardTitle>
        <CardDescription>
          Sélectionnez le workspace et la table de destination
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Fichier sélectionné */}
        <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <div className="text-sm text-gray-600 dark:text-gray-400">Fichier sélectionné</div>
          <div className="font-medium">{fileName}</div>
          <div className="text-sm text-gray-500">{formatFileSize(fileSize)}</div>
        </div>

        {/* Sélection du Workspace */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            <Building2 className="inline h-4 w-4 mr-1" />
            Workspace Zoho Analytics *
          </label>
          {isLoadingWorkspaces ? (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Chargement des workspaces...
            </div>
          ) : workspaces.length === 0 ? (
            <Alert variant="warning">
              Aucun workspace disponible. Vérifiez votre connexion Zoho.
            </Alert>
          ) : (
            <select
              value={selectedWorkspaceId}
              onChange={handleWorkspaceChange}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                       bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100
                       focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Sélectionnez un workspace</option>
              {workspaces.map((ws) => (
                <option key={ws.id} value={ws.id}>
                  {ws.name}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Sélection de la Table avec Accordéon */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            <Database className="inline h-4 w-4 mr-1" />
            Table de destination *
          </label>
          {!selectedWorkspaceId ? (
            <div className="text-sm text-gray-500 italic p-4 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-center">
              Sélectionnez d&apos;abord un workspace
            </div>
          ) : (
            <TableSelectorAccordion
              workspaceId={selectedWorkspaceId}
              selectedTableId={selectedTableId}
              onTableSelect={onTableSelect}
              disabled={false}
            />
          )}
        </div>

        {/* Mode d'import */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Mode d&apos;import *
          </label>
          <div className="space-y-2">
            {IMPORT_MODES.map((mode) => (
              <label
                key={mode.value}
                className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors
                  ${
                    importMode === mode.value
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
                  }`}
              >
                <input
                  type="radio"
                  name="importMode"
                  value={mode.value}
                  checked={importMode === mode.value}
                  onChange={() => onImportModeChange(mode.value)}
                  className="mt-1"
                />
                <div>
                  <div className="font-medium text-gray-900 dark:text-gray-100">
                    {mode.label}
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    {mode.description}
                  </div>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Sélecteur de clé de matching - affiché si mode UPDATE* */}
        {requiresMatchingKey && (
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              <Key className="inline h-4 w-4 mr-1" />
              Clé de matching (colonnes uniques) *
            </label>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Sélectionnez les colonnes qui identifient de manière unique chaque ligne.
              Ces colonnes seront utilisées pour détecter les lignes existantes.
            </p>
            
            {availableColumns.length === 0 ? (
              <Alert variant="info">
                Les colonnes seront disponibles après le parsing du fichier.
              </Alert>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg max-h-48 overflow-y-auto">
                {availableColumns.map((col) => (
                  <label
                    key={col}
                    className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-colors
                      ${matchingColumns.includes(col)
                        ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
                        : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                      }`}
                  >
                    <input
                      type="checkbox"
                      checked={matchingColumns.includes(col)}
                      onChange={() => handleColumnToggle(col)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm truncate" title={col}>{col}</span>
                  </label>
                ))}
              </div>
            )}
            
            {matchingColumns.length > 0 && (
              <div className="text-sm text-green-600 dark:text-green-400">
                Clé sélectionnée : {matchingColumns.join(' + ')}
              </div>
            )}
            
            {!hasMatchingKey && (
              <Alert variant="warning">
                Vous devez sélectionner au moins une colonne pour la clé de matching.
              </Alert>
            )}
          </div>
        )}

        {/* Warning pour modes destructifs */}
        {requiresConfirmation && (
          <Alert variant="warning" title="Attention">
            Ce mode d&apos;import peut supprimer des données existantes. Assurez-vous d&apos;avoir une
            sauvegarde si nécessaire.
          </Alert>
        )}

        {/* Navigation */}
        <div className="flex justify-between pt-4 border-t dark:border-gray-700">
          <Button variant="outline" onClick={onBack} leftIcon={<ArrowLeft className="h-4 w-4" />}>
            Retour
          </Button>
          <Button
            onClick={onNext}
            disabled={!canProceedFinal}
            rightIcon={<ArrowRight className="h-4 w-4" />}
          >
            Valider et continuer
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
