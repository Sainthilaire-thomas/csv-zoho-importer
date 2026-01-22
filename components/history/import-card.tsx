// ============================================
// @file components/history/import-card.tsx
// Carte affichant un import dans l'historique
// Mission 013
// ============================================

'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { 
  FileSpreadsheet, 
  Clock, 
  Layers, 
  Undo2, 
  Info, 
  AlertTriangle, 
  AlertCircle,
  CheckCircle,
  XCircle,
  RotateCcw
} from 'lucide-react';
import { RollbackDialog } from './rollback-dialog';
import { 
  getRollbackInfo, 
  IMPORT_MODE_LABELS,
  type RollbackInfo 
} from '@/lib/domain/history/rollback-rules';
import type { ImportLog, ImportMode } from '@/types/imports';

interface ImportCardProps {
  importLog: ImportLog;
  onRollbackSuccess: () => void;
  isLatestForTable: boolean;
}

export function ImportCard({ importLog, onRollbackSuccess, isLatestForTable }: ImportCardProps) {
  const [showRollbackDialog, setShowRollbackDialog] = useState(false);
  
  const rollbackInfo = getRollbackInfo(importLog.import_mode as ImportMode);
  const canShowRollbackButton = rollbackInfo.canRollback && 
    !importLog.rolled_back && 
    isLatestForTable &&
    importLog.row_id_before !== null && 
    importLog.row_id_after !== null;

  // Formatage date
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Formatage durée
  const formatDuration = (ms: number | null) => {
    if (!ms) return '-';
    if (ms < 1000) return `${ms}ms`;
    return `${Math.round(ms / 1000)}s`;
  };

  // Formatage nombre avec séparateurs
  const formatNumber = (n: number) => {
    return n.toLocaleString('fr-FR');
  };

  // Icône de sévérité pour les messages de correction
  const getSeverityIcon = (severity: RollbackInfo['severity']) => {
    switch (severity) {
      case 'info':
        return <Info className="h-4 w-4 text-blue-500" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-amber-500" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return null;
    }
  };

  // Couleur de fond pour les messages
  const getSeverityBgClass = (severity: RollbackInfo['severity']) => {
    switch (severity) {
      case 'info':
        return 'bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800';
      case 'warning':
        return 'bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800';
      case 'error':
        return 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800';
      default:
        return '';
    }
  };

  return (
    <>
      <div className={`bg-white dark:bg-gray-800 rounded-lg border p-4 ${
        importLog.rolled_back 
          ? 'border-gray-300 dark:border-gray-600 opacity-70' 
          : 'border-gray-200 dark:border-gray-700'
      }`}>
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <FileSpreadsheet className="h-5 w-5 text-gray-500" />
            <div>
              <h3 className="font-medium text-gray-900 dark:text-white">
                {importLog.file_name}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {importLog.table_name || 'Table inconnue'}
              </p>
            </div>
          </div>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {formatDate(importLog.created_at)}
          </span>
        </div>

        {/* Stats */}
        <div className="flex flex-wrap gap-4 mb-3 text-sm">
          <div className="flex items-center gap-1 text-gray-600 dark:text-gray-300">
            <Layers className="h-4 w-4" />
            <span>{formatNumber(importLog.rows_imported)} lignes</span>
          </div>
          <div className="flex items-center gap-1 text-gray-600 dark:text-gray-300">
            <Clock className="h-4 w-4" />
            <span>{formatDuration(importLog.duration_ms)}</span>
          </div>
          <div className="px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
            {IMPORT_MODE_LABELS[importLog.import_mode as ImportMode] || importLog.import_mode}
          </div>
        </div>

        {/* Statut */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {importLog.rolled_back ? (
              <>
                <RotateCcw className="h-4 w-4 text-gray-500" />
                <span className="text-sm text-gray-500">
                  Annulé le {formatDate(importLog.rolled_back_at!)}
                </span>
              </>
            ) : importLog.status === 'success' ? (
              <>
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span className="text-sm text-green-600 dark:text-green-400">Actif</span>
              </>
            ) : importLog.status === 'error' ? (
              <>
                <XCircle className="h-4 w-4 text-red-500" />
                <span className="text-sm text-red-600 dark:text-red-400">Erreur</span>
              </>
            ) : (
              <>
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span className="text-sm text-green-600 dark:text-green-400">Actif</span>
              </>
            )}
          </div>

          {/* Bouton rollback ou message */}
          {!importLog.rolled_back && (
            canShowRollbackButton ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowRollbackDialog(true)}
                className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
              >
                <Undo2 className="h-4 w-4 mr-1" />
                Annuler l'import
              </Button>
            ) : !rollbackInfo.canRollback && rollbackInfo.message ? null : null
          )}
        </div>

        {/* Message de correction si pas rollbackable */}
        {!importLog.rolled_back && !rollbackInfo.canRollback && rollbackInfo.message && (
          <div className={`mt-3 p-3 rounded-md border ${getSeverityBgClass(rollbackInfo.severity)}`}>
            <div className="flex items-start gap-2">
              {getSeverityIcon(rollbackInfo.severity)}
              <p className="text-sm text-gray-700 dark:text-gray-300">
                {rollbackInfo.message}
              </p>
            </div>
          </div>
        )}

        {/* Message si pas le dernier import de la table */}
        {!importLog.rolled_back && rollbackInfo.canRollback && !isLatestForTable && (
          <div className="mt-3 p-3 rounded-md border bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <p className="text-sm text-gray-700 dark:text-gray-300">
                Pour annuler cet import, vous devez d'abord annuler les imports plus récents sur cette table.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Dialog de confirmation */}
      <RollbackDialog
        open={showRollbackDialog}
        onOpenChange={setShowRollbackDialog}
        importLog={importLog}
        onSuccess={() => {
          setShowRollbackDialog(false);
          onRollbackSuccess();
        }}
      />
    </>
  );
}
