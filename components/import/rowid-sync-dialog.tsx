/**
 * @file components/import/rowid-sync-dialog.tsx
 * @description Dialogue de resynchronisation manuelle du RowID
 */

'use client';

import { useState } from 'react';
import { AlertTriangle, HelpCircle, RefreshCw, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert } from '@/components/ui/alert';

interface RowIdSyncDialogProps {
  tableName: string;
  workspaceId: string;
  zohoTableId: string;
  estimatedRowId?: number;
  message: string;
  onSync: (rowId: number) => Promise<void>;
  onCancel: () => void;
}

export function RowIdSyncDialog({
  tableName,
  workspaceId,
  zohoTableId,
  estimatedRowId,
  message,
  onSync,
  onCancel,
}: RowIdSyncDialogProps) {
  const [rowIdInput, setRowIdInput] = useState(estimatedRowId?.toString() || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    const rowId = parseInt(rowIdInput, 10);
    
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

      {/* Instructions */}
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

      {/* Erreur */}
      {error && (
        <Alert variant="error">
          {error}
        </Alert>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-2">
        <Button
          variant="outline"
          onClick={onCancel}
          disabled={isSubmitting}
        >
          Annuler l'import
        </Button>
        <Button
          onClick={handleSubmit}
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
    </div>
  );
}
