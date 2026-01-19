// components/import/wizard/step-validate.tsx
'use client';

import { useEffect, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Loader2, FileSearch, CheckCircle2, Upload } from 'lucide-react';
import type { ImportProgress } from '@/types';

interface StepValidateProps {
  progress: ImportProgress | null;
  fileName: string;
  onValidationStart: () => void;
}

export function StepValidate({
  progress,
  fileName,
  onValidationStart,
}: StepValidateProps) {
  const hasStarted = useRef(false);

  useEffect(() => {
    if (!hasStarted.current) {
      hasStarted.current = true;
      onValidationStart();
    }
  }, [onValidationStart]);

  const percentage = progress?.percentage ?? 0;
  const isFullImporting = progress?.phase === 'full-importing';
  const chunk = progress?.chunk;

  return (
    <Card variant="bordered" padding="lg">
      <CardContent>
        <div className="flex flex-col items-center justify-center py-12">
          <div className="relative mb-8">
            <div className={`absolute inset-0 ${isFullImporting ? 'bg-green-500/20' : 'bg-blue-500/20'} rounded-full animate-ping`} />
            <div className={`relative p-6 ${isFullImporting ? 'bg-green-100 dark:bg-green-900/50' : 'bg-blue-100 dark:bg-blue-900/50'} rounded-full`}>
              {isFullImporting ? (
                <Upload className="h-12 w-12 text-green-600 dark:text-green-400" />
              ) : (
                <FileSearch className="h-12 w-12 text-blue-600 dark:text-blue-400" />
              )}
            </div>
          </div>

          <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
            {isFullImporting ? 'Import en cours' : 'Validation en cours'}
          </h3>
          
          <p className="text-gray-500 dark:text-gray-400 mb-2 text-center">
            {isFullImporting ? (
              <>Import vers Zoho Analytics</>
            ) : (
              <>Analyse du fichier <span className="font-medium">{fileName}</span></>
            )}
          </p>

          {/* Affichage du chunk en cours */}
          {isFullImporting && chunk && chunk.total > 1 && (
            <p className="text-lg font-medium text-green-600 dark:text-green-400 mb-2">
              Lot {chunk.current} / {chunk.total}
            </p>
          )}

          {/* Affichage des lignes */}
          {isFullImporting && progress && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              {progress.current.toLocaleString('fr-FR')} / {progress.total.toLocaleString('fr-FR')} lignes
            </p>
          )}

          <div className="w-full max-w-md mb-6">
            <Progress
              value={percentage}
              max={100}
              size="md"
              showLabel
              animated
            />
          </div>

          {/* Indicateurs d'étapes - uniquement pour la validation */}
          {!isFullImporting && (
            <div className="flex flex-col gap-3 text-sm">
              <StepIndicator
                label="Lecture du fichier"
                status={percentage >= 20 ? 'complete' : percentage > 0 ? 'active' : 'pending'}
              />
              <StepIndicator
                label="Analyse des colonnes"
                status={percentage >= 40 ? 'complete' : percentage >= 20 ? 'active' : 'pending'}
              />
              <StepIndicator
                label="Validation des donnees"
                status={percentage >= 80 ? 'complete' : percentage >= 40 ? 'active' : 'pending'}
              />
              <StepIndicator
                label="Generation du rapport"
                status={percentage >= 100 ? 'complete' : percentage >= 80 ? 'active' : 'pending'}
              />
            </div>
          )}

          {/* Indicateurs pour l'import par chunks */}
          {isFullImporting && chunk && (
            <div className="flex flex-col gap-3 text-sm mt-4">
              {Array.from({ length: Math.min(chunk.total, 5) }, (_, i) => {
                // Afficher max 5 indicateurs avec ellipsis si plus
                const chunkNum = i + 1;
                let status: 'pending' | 'active' | 'complete' = 'pending';
                
                if (chunkNum < chunk.current) {
                  status = 'complete';
                } else if (chunkNum === chunk.current) {
                  status = 'active';
                }

                return (
                  <StepIndicator
                    key={chunkNum}
                    label={`Lot ${chunkNum}${chunk.total > 5 && chunkNum === 5 ? ` ... ${chunk.total}` : ''}`}
                    status={status}
                  />
                );
              })}
              {chunk.total > 5 && chunk.current > 5 && (
                <StepIndicator
                  label={`Lot ${chunk.current} / ${chunk.total}`}
                  status="active"
                />
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

interface StepIndicatorProps {
  label: string;
  status: 'pending' | 'active' | 'complete';
}

function StepIndicator({ label, status }: StepIndicatorProps) {
  return (
    <div className="flex items-center gap-3">
      {status === 'pending' && (
        <div className="w-5 h-5 rounded-full border-2 border-gray-300 dark:border-gray-600" />
      )}
      {status === 'active' && (
        <Loader2 className="w-5 h-5 text-blue-600 dark:text-blue-400 animate-spin" />
      )}
      {status === 'complete' && (
        <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
      )}
      <span
        className={`
          ${status === 'pending' ? 'text-gray-400 dark:text-gray-500' : ''}
          ${status === 'active' ? 'text-blue-600 dark:text-blue-400 font-medium' : ''}
          ${status === 'complete' ? 'text-gray-700 dark:text-gray-300' : ''}
        `}
      >
        {label}
      </span>
    </div>
  );
}
