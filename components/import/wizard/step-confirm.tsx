// components/import/wizard/step-confirm.tsx
'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Clock, FileSpreadsheet, RotateCcw, ExternalLink } from 'lucide-react';
import type { ImportResult } from '@/types';

interface StepConfirmProps {
  result: ImportResult;
  tableName: string;
  onNewImport: () => void;
}

export function StepConfirm({
  result,
  tableName,
  onNewImport,
}: StepConfirmProps) {
  const formatDuration = (ms: number): string => {
    if (ms < 1000) return `${ms}ms`;
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  return (
    <Card variant="bordered" padding="lg">
      <CardContent>
        <div className="flex flex-col items-center justify-center py-8">
          {/* Success icon */}
          <div className="relative mb-6">
            <div className="absolute inset-0 bg-green-500/20 rounded-full animate-pulse" />
            <div className="relative p-6 bg-green-100 dark:bg-green-900/50 rounded-full">
              <CheckCircle2 className="h-16 w-16 text-green-600 dark:text-green-400" />
            </div>
          </div>

          {/* Title */}
          <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            Import réussi !
          </h3>
          <p className="text-gray-500 dark:text-gray-400 text-center mb-8">
            Vos données ont été importées dans{' '}
            <span className="font-medium text-gray-900 dark:text-gray-100">
              {tableName}
            </span>
          </p>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-4 w-full max-w-md mb-8">
            <div className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <FileSpreadsheet className="h-8 w-8 text-blue-600 dark:text-blue-400" />
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {result.rowsImported.toLocaleString()}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  lignes importées
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <Clock className="h-8 w-8 text-purple-600 dark:text-purple-400" />
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {formatDuration(result.duration)}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  durée totale
                </p>
              </div>
            </div>
          </div>

          {/* Import ID */}
          {result.zohoImportId && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              ID Zoho : <span className="font-mono">{result.zohoImportId}</span>
            </p>
          )}

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              variant="primary"
              onClick={onNewImport}
              leftIcon={<RotateCcw className="h-4 w-4" />}
            >
              Nouvel import
            </Button>

            <a
              href="https://analytics.zoho.eu"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 bg-transparent text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800 transition-colors duration-200"
            >
              Ouvrir Zoho Analytics
              <ExternalLink className="h-4 w-4" />
            </a>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
