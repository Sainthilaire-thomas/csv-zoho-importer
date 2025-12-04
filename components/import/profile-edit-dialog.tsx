// components/import/profile-edit-dialog.tsx
'use client';

import { useState, useEffect } from 'react';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { Key, Loader2 } from 'lucide-react';
import type { ImportProfile, ImportMode } from '@/types';

interface ProfileEditDialogProps {
  open: boolean;
  onClose: () => void;
  profile: ImportProfile | null;
  onSave: (updates: ProfileUpdates) => Promise<void>;
  availableColumns?: string[];
}

interface ProfileUpdates {
  name: string;
  description?: string;
  defaultImportMode: ImportMode;
  matchingColumns: string[] | null;
}

const IMPORT_MODES: { value: ImportMode; label: string }[] = [
  { value: 'append', label: 'Ajouter (APPEND)' },
  { value: 'truncateadd', label: 'Remplacer tout (TRUNCATEADD)' },
  { value: 'updateadd', label: 'Mettre à jour ou ajouter (UPDATEADD)' },
  { value: 'deleteupsert', label: 'Synchroniser (DELETEUPSERT)' },
  { value: 'onlyadd', label: 'Ajouter uniquement les nouvelles (ONLYADD)' },
];

const MODES_REQUIRING_KEY: ImportMode[] = ['updateadd', 'deleteupsert', 'onlyadd'];

export function ProfileEditDialog({
  open,
  onClose,
  profile,
  onSave,
  availableColumns = [],
}: ProfileEditDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [importMode, setImportMode] = useState<ImportMode>('append');
  const [matchingColumns, setMatchingColumns] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialiser avec les valeurs du profil
  useEffect(() => {
    if (profile) {
      setName(profile.name);
      setDescription(profile.description || '');
      setImportMode(profile.defaultImportMode);
      setMatchingColumns(profile.matchingColumns || []);
    }
  }, [profile]);

  const requiresMatchingKey = MODES_REQUIRING_KEY.includes(importMode);
  const hasMatchingKey = matchingColumns.length > 0;
  const canSave = name.trim() && (!requiresMatchingKey || hasMatchingKey);

  // Colonnes disponibles : du profil ou passées en prop
  const columns = availableColumns.length > 0 
    ? availableColumns 
    : profile?.columns.map(c => c.zohoColumn) || [];

  const handleColumnToggle = (col: string) => {
    if (matchingColumns.includes(col)) {
      setMatchingColumns(matchingColumns.filter(c => c !== col));
    } else {
      setMatchingColumns([...matchingColumns, col]);
    }
  };

  const handleSave = async () => {
    if (!canSave) return;
    
    setIsSaving(true);
    setError(null);

    try {
      await onSave({
        name: name.trim(),
        description: description.trim() || undefined,
        defaultImportMode: importMode,
        matchingColumns: matchingColumns.length > 0 ? matchingColumns : null,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la sauvegarde');
    } finally {
      setIsSaving(false);
    }
  };

  if (!profile) return null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Modifier le profil"
      description={`Table : ${profile.viewName}`}
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            Annuler
          </Button>
          <Button onClick={handleSave} disabled={!canSave || isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Enregistrement...
              </>
            ) : (
              'Enregistrer'
            )}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && (
          <Alert variant="error">{error}</Alert>
        )}

        {/* Nom */}
        <div className="space-y-2">
          <label className="block text-sm font-medium">
            Nom du profil *
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                     bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100
                     focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Nom du profil"
          />
        </div>

        {/* Description */}
        <div className="space-y-2">
          <label className="block text-sm font-medium">
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                     bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100
                     focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Description optionnelle"
          />
        </div>

        {/* Mode d'import */}
        <div className="space-y-2">
          <label className="block text-sm font-medium">
            Mode d&apos;import par défaut *
          </label>
          <select
            value={importMode}
            onChange={(e) => setImportMode(e.target.value as ImportMode)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                     bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100
                     focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            {IMPORT_MODES.map((mode) => (
              <option key={mode.value} value={mode.value}>
                {mode.label}
              </option>
            ))}
          </select>
        </div>

        {/* Clé de matching */}
        {requiresMatchingKey && (
          <div className="space-y-2">
            <label className="block text-sm font-medium">
              <Key className="inline h-4 w-4 mr-1" />
              Clé de matching (colonnes uniques) *
            </label>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Colonnes utilisées pour identifier les lignes existantes.
            </p>
            
            {columns.length === 0 ? (
              <p className="text-sm text-gray-500 italic">Aucune colonne disponible</p>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg max-h-40 overflow-y-auto">
                {columns.map((col) => (
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
              <p className="text-sm text-green-600 dark:text-green-400">
                Clé : {matchingColumns.join(' + ')}
              </p>
            )}

            {!hasMatchingKey && (
              <Alert variant="warning">
                Ce mode nécessite une clé de matching.
              </Alert>
            )}
          </div>
        )}

        {/* Infos */}
        <div className="text-xs text-gray-500 dark:text-gray-400 pt-2 border-t">
          <p>Créé le : {new Date(profile.createdAt).toLocaleDateString('fr-FR')}</p>
          <p>Utilisations : {profile.useCount}</p>
          {profile.columns.length > 0 && (
            <p>{profile.columns.length} colonnes configurées</p>
          )}
        </div>
      </div>
    </Dialog>
  );
}
