/**
 * @file components/import/wizard/matching-column-selector.tsx
 * @description Sélecteur de colonne de matching pour vérification/rollback
 */

'use client';

import { useState } from 'react';
import { AlertTriangle, CheckCircle, Info, HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ColumnMatchingStats, MatchingColumnResult } from '@/lib/domain/verification';

interface MatchingColumnSelectorProps {
  matchingResult: MatchingColumnResult;
  onSelect: (column: string | null) => void;
  onSkip?: () => void;
  className?: string;
}

export function MatchingColumnSelector({
  matchingResult,
  onSelect,
  onSkip,
  className = '',
}: MatchingColumnSelectorProps) {
  const [selectedColumn, setSelectedColumn] = useState<string | null>(
    matchingResult.column || null
  );

  const { alternatives } = matchingResult;
  const hasAutoDetected = matchingResult.column !== undefined;

  // Filtrer pour afficher les colonnes pertinentes (> 50% unique ou recommandées)
  const relevantColumns = alternatives.filter(
    col => col.uniquePercentage >= 50 || col.isRecommended
  );

  const handleConfirm = () => {
    onSelect(selectedColumn);
  };

  const handleSkip = () => {
    onSelect(null);
    onSkip?.();
  };

  return (
    <div className={`rounded-lg border bg-card p-4 ${className}`}>
      {/* Header */}
      <div className="flex items-start gap-3 mb-4">
        {hasAutoDetected ? (
          <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 shrink-0" />
        ) : (
          <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
        )}
        <div>
          <h3 className="font-medium">
            {hasAutoDetected
              ? 'Colonne de matching détectée'
              : 'Sélectionnez une colonne de matching'}
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            {hasAutoDetected
              ? `La colonne "${matchingResult.column}" sera utilisée pour identifier les lignes lors de la vérification.`
              : 'Pour vérifier l\'intégrité des données après import, sélectionnez une colonne avec des valeurs uniques.'}
          </p>
        </div>
      </div>

      {/* Info box */}
      <div className="flex items-start gap-2 p-3 rounded-md bg-muted/50 mb-4">
        <Info className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
        <p className="text-xs text-muted-foreground">
          Cette colonne permet de retrouver chaque ligne dans Zoho après import 
          pour vérifier que les données ont été correctement enregistrées, 
          et de les supprimer en cas de rollback.
        </p>
      </div>

      {/* Liste des colonnes */}
      <div className="space-y-2 mb-4 max-h-64 overflow-y-auto">
        {relevantColumns.map((col) => (
          <label
            key={col.columnName}
            className={`flex items-center gap-3 p-3 rounded-md border cursor-pointer transition-colors ${
              selectedColumn === col.columnName
                ? 'border-primary bg-primary/5'
                : 'border-transparent bg-muted/30 hover:bg-muted/50'
            }`}
          >
            <input
              type="radio"
              name="matchingColumn"
              value={col.columnName}
              checked={selectedColumn === col.columnName}
              onChange={() => setSelectedColumn(col.columnName)}
              className="shrink-0"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium truncate">{col.columnName}</span>
                {col.isRecommended && (
                  <span className="text-xs px-1.5 py-0.5 rounded bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                    Recommandé
                  </span>
                )}
              </div>
              {col.reason && (
                <p className="text-xs text-muted-foreground mt-0.5">{col.reason}</p>
              )}
            </div>
            <div className="text-right shrink-0">
              <div className={`text-sm font-medium ${
                col.uniquePercentage === 100 
                  ? 'text-green-600 dark:text-green-400' 
                  : col.uniquePercentage >= 90 
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-muted-foreground'
              }`}>
                {col.uniquePercentage}% unique
              </div>
              <div className="text-xs text-muted-foreground">
                {col.nonEmptyCount}/{col.totalCount} valeurs
              </div>
            </div>
          </label>
        ))}

        {/* Option: Aucune colonne */}
        <label
          className={`flex items-center gap-3 p-3 rounded-md border cursor-pointer transition-colors ${
            selectedColumn === null
              ? 'border-primary bg-primary/5'
              : 'border-transparent bg-muted/30 hover:bg-muted/50'
          }`}
        >
          <input
            type="radio"
            name="matchingColumn"
            value=""
            checked={selectedColumn === null}
            onChange={() => setSelectedColumn(null)}
            className="shrink-0"
          />
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="font-medium">Aucune</span>
              <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Continuer sans vérification post-import
            </p>
          </div>
        </label>
      </div>

      {/* Warning si aucune sélection */}
      {selectedColumn === null && (
        <div className="flex items-start gap-2 p-3 rounded-md bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 mb-4">
          <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
          <p className="text-xs text-amber-700 dark:text-amber-300">
            Sans colonne de matching, la vérification post-import et le rollback seront impossibles.
            Les données seront importées sans contrôle.
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-2">
        {onSkip && (
          <Button variant="ghost" onClick={handleSkip}>
            Ignorer
          </Button>
        )}
        <Button onClick={handleConfirm}>
          {selectedColumn ? 'Confirmer' : 'Continuer sans vérification'}
        </Button>
      </div>
    </div>
  );
}
