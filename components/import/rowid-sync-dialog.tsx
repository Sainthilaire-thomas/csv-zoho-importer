/**
 * @file components/import/rowid-sync-dialog.tsx
 * @description Dialogue de resynchronisation du RowID avec auto-détection
 */

'use client';

import { useState } from 'react';
import { AlertTriangle, HelpCircle, RefreshCw, Loader2, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert } from '@/components/ui/alert';

interface RowIdSyncDialogProps {
  tableName: string;
  workspaceId: string;
  zohoTableId: string;
  estimatedRowId?: number;
  /** RowID réel détecté depuis Zoho (si disponible) */
  detectedRealRowId?: number;
  message: string;
  onSync: (rowId: number) => Promise<void>;
  onCancel: () => void;
}

export function RowIdSyncDialog({
  tableName,
  workspaceId,
  zohoTableId,
  estimatedRowId,
  detectedRealRowId,
  message,
  onSync,
  onCancel,
}: RowIdSyncDialogProps) {
  const [rowIdInput, setRowIdInput] = useState(
    detectedRealRowId?.toString() || estimatedRowId?.toString() || ''
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showManualInput, setShowManualInput] = useState(!detectedRealRowId);

  const handleSubmit = async (rowIdToUse?: number) => {
    const rowId = rowIdToUse ?? parseInt(rowIdInput, 10);

    if (isNaN(rowId) || rowId < 0) {
      setError('Veuillez saisir un nombre valide');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await onSync(rowId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de synchronisation');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUseDetectedValue = () => {
    if (detectedRealRowId) {
      handleSubmit(detectedRealRowId);
    }
  };

  return (
    <div className="rounded-lg border bg-card p-6 space-y-4 max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="shrink-0 w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
          <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
        </div>
        <div>
          <h3 className="font-semibold text-lg">Synchronisation requise</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Table : <span className="font-medium">{tableName}</span>
          </p>
        </div>
      </div>

      {/* Message */}
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <p className="ml-2 text-sm">{message}</p>
      </Alert>

      {/* Valeur détectée automatiquement */}
      {detectedRealRowId && !showManualInput && (
        <div className="rounded-md bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-4 space-y-3">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5 shrink-0" />
            <div>
              <p className="font-medium text-green-800 dark:text-green-200">
                Valeur détectée automatiquement
              </p>
              <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                Le dernier RowID dans Zoho Analytics est :
              </p>
              <p className="text-2xl font-mono font-bold text-green-800 dark:text-green-200 mt-2">
                {detectedRealRowId.toLocaleString()}
              </p>
              {estimatedRowId && estimatedRowId !== detectedRealRowId && (
                <p className="text-xs text-green-600 dark:text-green-400 mt-2">
                  Valeur précédente enregistrée : {estimatedRowId.toLocaleString()}
                  <span className="ml-1">
                    (écart de {Math.abs(detectedRealRowId - estimatedRowId).toLocaleString()})
                  </span>
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Instructions manuelles (si pas de valeur détectée ou si l'utilisateur veut saisir manuellement) */}
      {showManualInput && (
        <>
          <div className="rounded-md bg-muted/50 p-4 space-y-3">
            <div className="flex items-start gap-2">
              <HelpCircle className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <div className="text-sm text-muted-foreground">
                <p className="font-medium text-foreground mb-2">
                  Pour trouver le dernier RowID dans Zoho Analytics :
                </p>
                <ol className="list-decimal list-inside space-y-1">
                  <li>Ouvrez la table <span className="font-mono bg-muted px-1 rounded">{tableName}</span></li>
                  <li>Cliquez sur l'en-tête de colonne <span className="font-mono bg-muted px-1 rounded">RowID</span></li>
                  <li>Triez par ordre <strong>décroissant</strong></li>
                  <li>Copiez la valeur de la première ligne</li>
                </ol>
              </div>
            </div>
          </div>

          {/* Input */}
          <div className="space-y-2">
            <label htmlFor="rowid-input" className="text-sm font-medium">
              Dernier RowID actuel de la table
            </label>
            <Input
              id="rowid-input"
              type="number"
              min="0"
              value={rowIdInput}
              onChange={(e) => setRowIdInput(e.target.value)}
              placeholder="Ex: 2198851"
              className="font-mono"
              disabled={isSubmitting}
            />
            {estimatedRowId && (
              <p className="text-xs text-muted-foreground">
                Valeur estimée (peut être incorrecte) : {estimatedRowId.toLocaleString()}
              </p>
            )}
          </div>
        </>
      )}

      {/* Erreur */}
      {error && (
        <Alert variant="error">
          {error}
        </Alert>
      )}

      {/* Actions */}
      <div className="flex flex-col gap-3 pt-2">
        {/* Boutons principaux */}
        {detectedRealRowId && !showManualInput ? (
          <div className="flex justify-between gap-3">
            <Button
              variant="outline"
              onClick={() => setShowManualInput(true)}
              disabled={isSubmitting}
              className="flex-1"
            >
              Saisir manuellement
            </Button>
            <Button
              onClick={handleUseDetectedValue}
              disabled={isSubmitting}
              className="flex-1"
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4 mr-2" />
              )}
              Utiliser cette valeur
            </Button>
          </div>
        ) : (
          <div className="flex justify-end gap-3">
            {detectedRealRowId && showManualInput && (
              <Button
                variant="ghost"
                onClick={() => setShowManualInput(false)}
                disabled={isSubmitting}
              >
                Retour
              </Button>
            )}
            <Button
              onClick={() => handleSubmit()}
              disabled={isSubmitting || !rowIdInput}
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Synchroniser et continuer
            </Button>
          </div>
        )}

        {/* Bouton annuler */}
        <Button
          variant="outline"
          onClick={onCancel}
          disabled={isSubmitting}
          className="w-full"
        >
          Annuler l'import
        </Button>
      </div>
    </div>
  );
}
