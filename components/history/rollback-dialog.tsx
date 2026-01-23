// ============================================
// @file components/history/rollback-dialog.tsx
// Dialog de confirmation pour annuler un import
// Mission 013
// ============================================

'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { ImportLog, RollbackResponse, LIFOError } from '@/types/imports';

interface RollbackDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  importLog: ImportLog;
  onSuccess: () => void;
}

export function RollbackDialog({ 
  open, 
  onOpenChange, 
  importLog, 
  onSuccess 
}: RollbackDialogProps) {
  const [isRollingBack, setIsRollingBack] = useState(false);

  const handleRollback = async () => {
    setIsRollingBack(true);

    try {
      const response = await fetch(`/api/imports/${importLog.id}/rollback`, {
        method: 'POST',
      });

      const data = await response.json();

      if (!response.ok) {
        // Vérifier si c'est une erreur LIFO
        if (data.newerImports) {
          const lifoError = data as LIFOError;
          toast.error('Annulation impossible', {
            description: lifoError.error,
          });
        } else {
          toast.error('Erreur lors de l\'annulation', {
            description: data.error || 'Erreur inconnue',
          });
        }
        return;
      }

      const result = data as RollbackResponse;
      
      toast.success('Import annulé', {
        description: `${result.deletedRows} lignes supprimées en ${Math.round(result.duration / 1000)}s`,
      });

      onSuccess();

    } catch (error) {
      console.error('Erreur rollback:', error);
      toast.error('Erreur réseau', {
        description: 'Impossible de contacter le serveur',
      });
    } finally {
      setIsRollingBack(false);
    }
  };

  if (!open) return null;

  const rowsToDelete = importLog.rows_imported;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50" 
        onClick={() => !isRollingBack && onOpenChange(false)}
      />
      
      {/* Dialog */}
      <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-full bg-red-100 dark:bg-red-900">
            <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Annuler cet import ?
          </h2>
        </div>

        {/* Content */}
        <div className="mb-6 space-y-3">
          <p className="text-gray-600 dark:text-gray-300">
            Vous êtes sur le point d'annuler l'import suivant :
          </p>
          
          <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-md">
            <p className="font-medium text-gray-900 dark:text-white">
              {importLog.file_name}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {importLog.table_name} • {importLog.rows_imported.toLocaleString('fr-FR')} lignes
            </p>
          </div>

          <div className="p-3 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-md">
             <p className="text-sm text-amber-800 dark:text-amber-200">
              <strong>Attention :</strong> Cette action va supprimer les{' '}
              <strong>{rowsToDelete.toLocaleString('fr-FR')}</strong> lignes importées de la table Zoho.
              Cette action est irréversible.
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 justify-end">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isRollingBack}
          >
            Annuler
          </Button>
          <Button
            variant="danger"
            onClick={handleRollback}
            disabled={isRollingBack}
            
          >
            {isRollingBack ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Suppression...
              </>
            ) : (
              'Confirmer l\'annulation'
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
