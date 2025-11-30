// components/import/wizard/step-review.tsx
'use client';

import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { ValidationResults } from '@/components/import/validation-results';
import { ArrowLeft, Upload, FileWarning } from 'lucide-react';
import type { ValidationResult, ImportMode } from '@/types';

interface StepReviewProps {
  validation: ValidationResult;
  tableName: string;
  importMode: ImportMode;
  isImporting: boolean;
  onBack: () => void;
  onImport: () => void;
}

export function StepReview({
  validation,
  tableName,
  importMode,
  isImporting,
  onBack,
  onImport,
}: StepReviewProps) {
  const canImport = validation.isValid || validation.validRows > 0;
  const hasErrors = validation.errorRows > 0;

  return (
    <Card variant="bordered" padding="lg">
      <CardHeader>
        <CardTitle>Résultat de la validation</CardTitle>
        <CardDescription>
          Vérifiez les données avant de lancer l&apos;import vers{' '}
          <span className="font-medium text-gray-900 dark:text-gray-100">
            {tableName}
          </span>
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Validation results */}
        <ValidationResults result={validation} />

        {/* Warning if partial import */}
        {hasErrors && validation.validRows > 0 && (
          <Alert variant="warning" title="Import partiel possible">
            <p>
              Seules les <strong>{validation.validRows.toLocaleString()}</strong> lignes valides 
              seront importées. Les <strong>{validation.errorRows.toLocaleString()}</strong> lignes 
              en erreur seront ignorées.
            </p>
            <p className="mt-2">
              Vous pouvez revenir en arrière pour corriger votre fichier, ou continuer avec un import partiel.
            </p>
          </Alert>
        )}

        {/* Block if no valid rows */}
        {!canImport && (
          <Alert variant="error" title="Import impossible">
            Aucune ligne valide à importer. Veuillez corriger votre fichier CSV et réessayer.
          </Alert>
        )}

        {/* Import mode reminder */}
        {canImport && (
          <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              <strong>Mode d&apos;import :</strong>{' '}
              {importMode === 'append' ? (
                <span className="text-green-600 dark:text-green-400">
                  Ajouter aux données existantes
                </span>
              ) : (
                <span className="text-orange-600 dark:text-orange-400">
                  Remplacer toutes les données
                </span>
              )}
            </p>
          </div>
        )}
      </CardContent>

      <CardFooter className="justify-between">
        <Button
          variant="outline"
          onClick={onBack}
          leftIcon={<ArrowLeft className="h-4 w-4" />}
          disabled={isImporting}
        >
          Corriger le fichier
        </Button>
        
        {canImport ? (
          <Button
            onClick={onImport}
            isLoading={isImporting}
            leftIcon={!isImporting ? <Upload className="h-4 w-4" /> : undefined}
          >
            {isImporting
              ? 'Import en cours...'
              : hasErrors
              ? `Importer ${validation.validRows.toLocaleString()} lignes`
              : 'Lancer l\'import'}
          </Button>
        ) : (
          <Button disabled leftIcon={<FileWarning className="h-4 w-4" />}>
            Import impossible
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
