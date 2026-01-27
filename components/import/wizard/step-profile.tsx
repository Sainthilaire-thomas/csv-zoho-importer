// components/import/wizard/step-profile.tsx
// Étape 2 du wizard : Sélection ou création de profil d'import

'use client';

import { useState, useEffect } from 'react';
import {
  CheckCircle,
  AlertCircle,
  Plus,
  FileSpreadsheet,
  Loader2,
  ChevronRight,
  Settings,
  Zap,
  Edit,
  Trash2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/dialog';
import { ProfileEditDialog } from '@/components/import/profile-edit-dialog';
import {
  ImportProfile,
  ProfileMatchResult,
  DetectedColumn,
  ColumnMapping
} from '@/types/profiles';
import type { ImportMode } from '@/types';
import { detectColumnTypes } from '@/lib/domain/detection';
import { 
  profileManager, 
  getMatchPercentage,
  getColumnsNeedingConfirmation,
  getNewColumns,
  getMissingColumns
} from '@/lib/domain/profile';

// =============================================================================
// TYPES
// =============================================================================

interface StepProfileProps {
  // Données du fichier parsé
  fileData: Record<string, string>[];
  fileName: string;
  
  // Métadonnées Excel (optionnel, absent pour CSV)
  columnMetadata?: Record<string, import('@/types/profiles').ExcelColumnMeta> | null;

  // Callbacks
 onProfileSelected: (profile: ImportProfile, matchResult: ProfileMatchResult, detectedColumns: DetectedColumn[]) => void;
  onCreateNewProfile: (detectedColumns: DetectedColumn[]) => void;
  onSkipProfile: (detectedColumns: DetectedColumn[]) => void;
  onBack: () => void;
}

type ViewMode = 'loading' | 'matches' | 'no-match' | 'error';

// =============================================================================
// COMPOSANT PRINCIPAL
// =============================================================================

export function StepProfile({
  fileData,
  fileName,
  columnMetadata,  // AJOUTER
  onProfileSelected,
  onCreateNewProfile,
  onSkipProfile,
  onBack
}: StepProfileProps) {
  // État
  const [viewMode, setViewMode] = useState<ViewMode>('loading');
  const [detectedColumns, setDetectedColumns] = useState<DetectedColumn[]>([]);
  const [matchResults, setMatchResults] = useState<ProfileMatchResult[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<ProfileMatchResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Charger et analyser au montage
  useEffect(() => {
    analyzeFileAndFindProfiles();
  }, [fileData]);

  // ===========================================================================
  // LOGIQUE
  // ===========================================================================

  async function analyzeFileAndFindProfiles() {
    setViewMode('loading');
    setError(null);

    try {
       // 1. Détecter les types de colonnes (avec métadonnées Excel si disponibles)
     const columns = detectColumnTypes(fileData, {
        excelMetadata: columnMetadata ?? undefined
      });
      
      // Stocker les colonnes détectées dans l'état local
      setDetectedColumns(columns);

      // 2. Chercher les profils compatibles
      const matches = await profileManager.findMatchingProfiles(columns);
      setMatchResults(matches);

      // 3. Déterminer la vue
      if (matches.length > 0) {
        setSelectedMatch(matches[0]); // Sélectionner le meilleur match par défaut
        setViewMode('matches');
      } else {
        setViewMode('no-match');
      }
    } catch (err) {
      console.error('Erreur analyse fichier:', err);
      setError(err instanceof Error ? err.message : 'Erreur lors de l\'analyse');
      setViewMode('error');
    }
  }

  function handleUseProfile() {
    if (selectedMatch) {
      onProfileSelected(selectedMatch.profile, selectedMatch, detectedColumns);
    }
  }

  function handleCreateNew() {
    onCreateNewProfile(detectedColumns);
  }

  function handleSkip() {
    onSkipProfile(detectedColumns);
  }

  // ===========================================================================
  // RENDU
  // ===========================================================================

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold">Profil d'import</h2>
        <p className="text-muted-foreground mt-1">
          {viewMode === 'loading' && 'Analyse du fichier en cours...'}
          {viewMode === 'matches' && 'Un profil compatible a été trouvé'}
          {viewMode === 'no-match' && 'Aucun profil existant ne correspond à ce fichier'}
          {viewMode === 'error' && 'Une erreur est survenue'}
        </p>
      </div>

      {/* Résumé fichier */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center gap-3">
            <FileSpreadsheet className="h-8 w-8 text-muted-foreground" />
            <div>
              <p className="font-medium">{fileName}</p>
              <p className="text-sm text-muted-foreground">
                {fileData.length} lignes • {detectedColumns.length || '...'} colonnes
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Contenu selon le mode */}
      {viewMode === 'loading' && <LoadingView />}
      {viewMode === 'error' && <ErrorView error={error} onRetry={analyzeFileAndFindProfiles} />}
        {viewMode === 'matches' && (
        <MatchesView
    matches={matchResults}
    selectedMatch={selectedMatch}
    onSelectMatch={setSelectedMatch}
    onUseProfile={handleUseProfile}
    onCreateNew={handleCreateNew}  // ← AJOUTER
    onSkip={handleSkip}
    onProfileUpdated={analyzeFileAndFindProfiles}
  />
      )}
      {viewMode === 'no-match' && (
        <NoMatchView
          detectedColumns={detectedColumns}
          onCreateNew={handleCreateNew}
          onSkip={handleSkip}
        />
      )}

      {/* Navigation */}
      <div className="flex justify-between pt-4 border-t">
        <Button variant="outline" onClick={onBack}>
          Retour
        </Button>
        
        {viewMode === 'matches' && selectedMatch && (
          <Button onClick={handleUseProfile}>
            Utiliser ce profil
            <ChevronRight className="ml-2 h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// SOUS-COMPOSANTS
// =============================================================================

function LoadingView() {
  return (
    <Card>
      <CardContent className="py-12">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <div className="text-center">
            <p className="font-medium">Analyse en cours...</p>
            <p className="text-sm text-muted-foreground">
              Détection des colonnes et recherche de profils compatibles
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ErrorView({ error, onRetry }: { error: string | null; onRetry: () => void }) {
  return (
    <Card className="border-destructive">
      <CardContent className="py-8">
        <div className="flex flex-col items-center gap-4">
          <AlertCircle className="h-8 w-8 text-destructive" />
          <div className="text-center">
            <p className="font-medium">Erreur</p>
            <p className="text-sm text-muted-foreground">{error}</p>
          </div>
          <Button variant="outline" onClick={onRetry}>
            Réessayer
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

interface MatchesViewProps {
  matches: ProfileMatchResult[];
  selectedMatch: ProfileMatchResult | null;
  onSelectMatch: (match: ProfileMatchResult) => void;
  onUseProfile: () => void;
  onCreateNew: () => void;  // ← AJOUTER
  onSkip: () => void;
  onProfileUpdated: () => void;
}

function MatchesView({
  matches,
  selectedMatch,
  onSelectMatch,
  onUseProfile,
  onSkip,
  onCreateNew,
  onProfileUpdated
}: MatchesViewProps) {
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const bestMatch = matches[0];
  const percentage = getMatchPercentage(bestMatch);
  const needsConfirmation = bestMatch.needsConfirmation;
  const confirmColumns = getColumnsNeedingConfirmation(bestMatch);
  const newColumns = getNewColumns(bestMatch);
  const missingColumns = getMissingColumns(bestMatch);
  const handleEditSave = async (updates: {
    name: string;
    description?: string;
    defaultImportMode: ImportMode;
    matchingColumns: string[] | null;
  }) => {
    const response = await fetch(`/api/profiles/${bestMatch.profile.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Erreur lors de la mise à jour');
    }
    onProfileUpdated();
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/profiles/${bestMatch.profile.id}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erreur lors de la suppression');
      }
      setShowDeleteDialog(false);
      onProfileUpdated();
    } catch (err) {
      console.error('Erreur suppression:', err);
      alert(err instanceof Error ? err.message : 'Erreur lors de la suppression');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Profil trouvé */}
      <Card 
        className={`cursor-pointer transition-colors ${
          selectedMatch?.profile.id === bestMatch.profile.id 
            ? 'border-primary ring-2 ring-primary/20' 
            : 'hover:border-primary/50'
        }`}
        onClick={() => onSelectMatch(bestMatch)}
      >
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-full ${
                percentage >= 90 ? 'bg-green-100 dark:bg-green-900' :
                percentage >= 70 ? 'bg-yellow-100 dark:bg-yellow-900' :
                'bg-orange-100 dark:bg-orange-900'
              }`}>
                {percentage >= 90 ? (
                  <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                )}
              </div>
              <div>
                <CardTitle className="text-lg">{bestMatch.profile.name}</CardTitle>
                <CardDescription>
                  Table : {bestMatch.profile.viewName}
                </CardDescription>
              </div>
            </div>
            <div className="text-right">
              <span className={`text-2xl font-bold ${
                percentage >= 90 ? 'text-green-600' :
                percentage >= 70 ? 'text-yellow-600' :
                'text-orange-600'
              }`}>
                {percentage}%
              </span>
              <p className="text-xs text-muted-foreground">compatibilité</p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Stats de matching */}
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div className="text-center p-2 bg-muted rounded">
              <p className="font-semibold text-green-600">
                {bestMatch.mappings.filter(m => m.status === 'exact').length}
              </p>
              <p className="text-xs text-muted-foreground">Colonnes exactes</p>
            </div>
            <div className="text-center p-2 bg-muted rounded">
              <p className="font-semibold text-yellow-600">
                {confirmColumns.length}
              </p>
              <p className="text-xs text-muted-foreground">À confirmer</p>
            </div>
            <div className="text-center p-2 bg-muted rounded">
              <p className="font-semibold text-blue-600">
                {newColumns.length}
              </p>
              <p className="text-xs text-muted-foreground">Nouvelles</p>
            </div>
          </div>

          {/* Message si confirmations nécessaires */}
          {needsConfirmation && (
            <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                <AlertCircle className="inline h-4 w-4 mr-1" />
                {confirmColumns.length > 0 && `${confirmColumns.length} colonne(s) à confirmer. `}
                {newColumns.length > 0 && `${newColumns.length} nouvelle(s) colonne(s) détectée(s). `}
                {missingColumns.length > 0 && `${missingColumns.length} colonne(s) obligatoire(s) manquante(s).`}
              </p>
            </div>
          )}

        
            {/* Dernière utilisation */}
          {bestMatch.profile.lastUsedAt && (
            <p className="mt-3 text-xs text-muted-foreground">
              Dernière utilisation : {new Date(bestMatch.profile.lastUsedAt).toLocaleDateString('fr-FR')}
              {bestMatch.profile.useCount > 0 && ` • ${bestMatch.profile.useCount} import(s)`}
            </p>
          )}

          {/* Actions du profil */}
          <div className="flex gap-2 mt-4 pt-3 border-t">
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                setShowEditDialog(true);
              }}
            >
              <Edit className="h-4 w-4 mr-1" />
              Modifier
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                setShowDeleteDialog(true);
              }}
              className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Supprimer
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Dialogs */}
      <ProfileEditDialog
        open={showEditDialog}
        onClose={() => setShowEditDialog(false)}
        profile={bestMatch.profile}
        onSave={handleEditSave}
      />

      <ConfirmDialog
        open={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        onConfirm={handleDelete}
        title="Supprimer le profil"
        description={`Êtes-vous sûr de vouloir supprimer le profil "${bestMatch.profile.name}" ? Cette action est irréversible.`}
        confirmText="Supprimer"
        variant="danger"
        isLoading={isDeleting}
      />

    {/* Options alternatives */}
      <div className="grid grid-cols-2 gap-3">
        {/* Créer nouveau profil vers autre table */}
        <Card
          className="cursor-pointer hover:border-primary/50 transition-colors"
          onClick={onCreateNew}
        >
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-primary/10">
                <Plus className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-medium text-sm">Nouveau profil</p>
                <p className="text-xs text-muted-foreground">
                  Vers une autre table Zoho
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Import ponctuel */}
        <Card
          className="cursor-pointer hover:border-primary/50 transition-colors"
          onClick={onSkip}
        >
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-muted">
                <Zap className="h-5 w-5" />
              </div>
              <div>
                <p className="font-medium text-sm">Import ponctuel</p>
                <p className="text-xs text-muted-foreground">
                  Sans créer de profil
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Autres profils compatibles */}
      {matches.length > 1 && (
        <details className="text-sm">
          <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
            {matches.length - 1} autre(s) profil(s) compatible(s)
          </summary>
          <div className="mt-2 space-y-2">
            {matches.slice(1).map(match => (
              <Card 
                key={match.profile.id}
                className={`cursor-pointer transition-colors ${
                  selectedMatch?.profile.id === match.profile.id 
                    ? 'border-primary' 
                    : 'hover:border-primary/50'
                }`}
                onClick={() => onSelectMatch(match)}
              >
                <CardContent className="py-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{match.profile.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {match.profile.viewName}
                      </p>
                    </div>
                    <span className="text-sm font-semibold">
                      {getMatchPercentage(match)}%
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

interface NoMatchViewProps {
  detectedColumns: DetectedColumn[];
  onCreateNew: () => void;
  onSkip: () => void;
}

function NoMatchView({ detectedColumns, onCreateNew, onSkip }: NoMatchViewProps) {
  // Compter les types détectés
  const typeCounts = detectedColumns.reduce((acc, col) => {
    acc[col.detectedType] = (acc[col.detectedType] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Aucun profil compatible
          </CardTitle>
          <CardDescription>
            Ce fichier ne correspond à aucun profil existant. 
            Vous pouvez créer un nouveau profil ou faire un import ponctuel.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Résumé des colonnes détectées */}
          <div className="mb-4">
            <p className="text-sm font-medium mb-2">Colonnes détectées :</p>
            <div className="flex flex-wrap gap-2">
              {typeCounts.date && (
                <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded text-xs">
                  {typeCounts.date} date(s)
                </span>
              )}
              {typeCounts.duration && (
                <span className="px-2 py-1 bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 rounded text-xs">
                  {typeCounts.duration} durée(s)
                </span>
              )}
              {typeCounts.number && (
                <span className="px-2 py-1 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded text-xs">
                  {typeCounts.number} nombre(s)
                </span>
              )}
              {typeCounts.text && (
                <span className="px-2 py-1 bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded text-xs">
                  {typeCounts.text} texte(s)
                </span>
              )}
              {typeCounts.boolean && (
                <span className="px-2 py-1 bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200 rounded text-xs">
                  {typeCounts.boolean} booléen(s)
                </span>
              )}
            </div>
          </div>

          {/* Liste des colonnes */}
          <details className="text-sm">
            <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
              Voir les {detectedColumns.length} colonnes
            </summary>
            <div className="mt-2 max-h-48 overflow-y-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-1 px-2">Colonne</th>
                    <th className="text-left py-1 px-2">Type</th>
                    <th className="text-left py-1 px-2">Exemple</th>
                  </tr>
                </thead>
                <tbody>
                  {detectedColumns.map((col, idx) => (
                    <tr key={idx} className="border-b border-muted">
                      <td className="py-1 px-2 font-medium">{col.name}</td>
                      <td className="py-1 px-2">
                        <span className={`px-1.5 py-0.5 rounded ${
                          col.detectedType === 'date' ? 'bg-blue-100 dark:bg-blue-900' :
                          col.detectedType === 'number' ? 'bg-green-100 dark:bg-green-900' :
                          col.detectedType === 'duration' ? 'bg-purple-100 dark:bg-purple-900' :
                          'bg-gray-100 dark:bg-gray-800'
                        }`}>
                          {col.detectedType}
                        </span>
                      </td>
                      <td className="py-1 px-2 text-muted-foreground truncate max-w-[150px]">
                        {col.samples[0] || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </CardContent>
      </Card>

      {/* Options */}
      <div className="grid grid-cols-2 gap-4">
        <Card 
          className="cursor-pointer hover:border-primary transition-colors"
          onClick={onCreateNew}
        >
          <CardContent className="py-6">
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="p-3 rounded-full bg-primary/10">
                <Plus className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="font-medium">Créer un profil</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Sélectionner une table Zoho et configurer le mapping
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card 
          className="cursor-pointer hover:border-muted-foreground transition-colors"
          onClick={onSkip}
        >
          <CardContent className="py-6">
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="p-3 rounded-full bg-muted">
                <Zap className="h-6 w-6 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium">Import ponctuel</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Importer sans créer de profil réutilisable
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default StepProfile;
