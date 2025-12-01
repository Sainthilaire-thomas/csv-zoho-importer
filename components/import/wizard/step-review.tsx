// components/import/wizard/step-review.tsx
'use client';

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { ValidationResults } from '@/components/import/validation-results';
import { 
  ArrowLeft, 
  Upload, 
  FileWarning, 
  ChevronDown, 
  ChevronRight,
  Check,
  AlertTriangle,
  XCircle,
  HelpCircle,
  Columns
} from 'lucide-react';
import type { ValidationResult, ImportMode, SchemaValidationResult, ColumnMapping } from '@/types';

interface StepReviewProps {
  validation: ValidationResult;
  schemaValidation?: SchemaValidationResult | null;
  tableName: string;
  importMode: ImportMode;
  isImporting: boolean;
  onBack: () => void;
  onImport: () => void;
}

// Composant pour afficher une ligne de mapping
function ColumnMappingRow({ mapping }: { mapping: ColumnMapping }) {
  const getStatusIcon = () => {
    if (!mapping.isMapped) {
      return <HelpCircle className="h-4 w-4 text-gray-400" />;
    }
    if (!mapping.isCompatible) {
      return <XCircle className="h-4 w-4 text-red-500" />;
    }
    if (mapping.transformNeeded && mapping.transformNeeded !== 'none') {
      return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    }
    return <Check className="h-4 w-4 text-green-500" />;
  };

  const getConfidenceBadge = () => {
    if (!mapping.isMapped) return null;
    const color = mapping.confidence >= 90 
      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
      : mapping.confidence >= 70
      ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
      : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
    
    return (
      <span className={`text-xs px-1.5 py-0.5 rounded ${color}`}>
        {mapping.confidence}%
      </span>
    );
  };

  return (
    <div className={`flex items-center gap-3 p-2 rounded ${
      !mapping.isMapped 
        ? 'bg-gray-50 dark:bg-gray-800/30' 
        : mapping.isCompatible 
        ? 'bg-green-50 dark:bg-green-900/10' 
        : 'bg-red-50 dark:bg-red-900/10'
    }`}>
      {getStatusIcon()}
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm truncate">{mapping.fileColumn}</span>
          <span className="text-xs text-gray-500 dark:text-gray-400">({mapping.fileType})</span>
        </div>
      </div>

      <div className="text-gray-400">→</div>

      <div className="flex-1 min-w-0">
        {mapping.isMapped ? (
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm truncate">{mapping.zohoColumn}</span>
            <span className="text-xs text-gray-500 dark:text-gray-400">({mapping.zohoType})</span>
            {getConfidenceBadge()}
          </div>
        ) : (
          <span className="text-sm text-gray-400 italic">Non mappé</span>
        )}
      </div>

      {mapping.isRequired && (
        <span className="text-xs px-1.5 py-0.5 rounded bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
          Requis
        </span>
      )}
    </div>
  );
}

// Composant pour la section de validation de schéma
function SchemaValidationSection({ schemaValidation }: { schemaValidation: SchemaValidationResult }) {
  const [isExpanded, setIsExpanded] = useState(true);
  const { summary, matchedColumns, missingRequired, extraColumns, typeWarnings } = schemaValidation;

  return (
    <div className="border rounded-lg dark:border-gray-700">
      {/* Header cliquable */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Columns className="h-5 w-5 text-blue-500" />
          <span className="font-medium">Correspondance des colonnes</span>
          
          {/* Badges résumé */}
          <div className="flex items-center gap-2">
            <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
              {summary.matchedCount} mappées
            </span>
            {summary.unmatchedCount > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                {summary.unmatchedCount} non mappées
              </span>
            )}
            {summary.errorCount > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                {summary.errorCount} erreurs
              </span>
            )}
            {summary.warningCount > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
                {summary.warningCount} avertissements
              </span>
            )}
          </div>
        </div>
        
        {isExpanded ? (
          <ChevronDown className="h-5 w-5 text-gray-400" />
        ) : (
          <ChevronRight className="h-5 w-5 text-gray-400" />
        )}
      </button>

      {/* Contenu dépliable */}
      {isExpanded && (
        <div className="border-t dark:border-gray-700 p-4 space-y-4">
          {/* Alertes colonnes requises manquantes */}
          {missingRequired.length > 0 && (
            <Alert variant="error" title="Colonnes obligatoires manquantes">
              Les colonnes suivantes sont requises par Zoho mais absentes de votre fichier :{' '}
              <strong>{missingRequired.join(', ')}</strong>
            </Alert>
          )}

          {/* Alertes warnings de type */}
          {typeWarnings.filter(w => w.severity === 'error').length > 0 && (
            <Alert variant="error" title="Incompatibilités de types">
              {typeWarnings.filter(w => w.severity === 'error').map((w, i) => (
                <div key={i} className="text-sm">
                  <strong>{w.column}</strong> : {w.message}
                  {w.suggestion && <span className="text-gray-600"> → {w.suggestion}</span>}
                </div>
              ))}
            </Alert>
          )}

          {typeWarnings.filter(w => w.severity === 'warning').length > 0 && (
            <Alert variant="warning" title="Avertissements">
              {typeWarnings.filter(w => w.severity === 'warning').map((w, i) => (
                <div key={i} className="text-sm">
                  <strong>{w.column}</strong> : {w.message}
                </div>
              ))}
            </Alert>
          )}

          {/* Liste des mappings */}
          <div className="space-y-1">
            <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Détail des correspondances ({matchedColumns.length} colonnes)
            </div>
            <div className="max-h-64 overflow-y-auto space-y-1">
              {matchedColumns.map((mapping, index) => (
                <ColumnMappingRow key={index} mapping={mapping} />
              ))}
            </div>
          </div>

          {/* Colonnes supplémentaires ignorées */}
          {extraColumns.length > 0 && (
            <div className="text-sm text-gray-500 dark:text-gray-400">
              <span className="font-medium">Colonnes ignorées</span> (non présentes dans Zoho) :{' '}
              {extraColumns.join(', ')}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function StepReview({
  validation,
  schemaValidation,
  tableName,
  importMode,
  isImporting,
  onBack,
  onImport,
}: StepReviewProps) {
  const canImport = validation.isValid || validation.validRows > 0;
  const hasErrors = validation.errorRows > 0;
  
  // Vérifier si la validation de schéma bloque l'import
  const schemaBlocksImport = schemaValidation && !schemaValidation.canProceed;

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
        {/* Schema validation section (si disponible) */}
        {schemaValidation && (
          <SchemaValidationSection schemaValidation={schemaValidation} />
        )}

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

        {/* Block if schema validation fails */}
        {schemaBlocksImport && (
          <Alert variant="error" title="Import bloqué par la validation de schéma">
            Des colonnes obligatoires sont manquantes ou des incompatibilités de types empêchent l&apos;import.
            Veuillez corriger votre fichier.
          </Alert>
        )}

        {/* Block if no valid rows */}
        {!canImport && !schemaBlocksImport && (
          <Alert variant="error" title="Import impossible">
            Aucune ligne valide à importer. Veuillez corriger votre fichier CSV et réessayer.
          </Alert>
        )}

        {/* Import mode reminder */}
        {canImport && !schemaBlocksImport && (
          <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              <strong>Mode d&apos;import :</strong>{' '}
              {importMode === 'append' ? (
                <span className="text-green-600 dark:text-green-400">
                  Ajouter aux données existantes
                </span>
              ) : importMode === 'truncateadd' ? (
                <span className="text-orange-600 dark:text-orange-400">
                  Remplacer toutes les données
                </span>
              ) : importMode === 'updateadd' ? (
                <span className="text-blue-600 dark:text-blue-400">
                  Mettre à jour ou ajouter
                </span>
              ) : importMode === 'deleteupsert' ? (
                <span className="text-red-600 dark:text-red-400">
                  Synchroniser (supprime les absents)
                </span>
              ) : (
                <span className="text-purple-600 dark:text-purple-400">
                  Ajouter uniquement les nouveaux
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

        {canImport && !schemaBlocksImport ? (
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
