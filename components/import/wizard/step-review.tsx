// components/import/wizard/step-review.tsx
// VERSION 4 - Distinction transformations automatiques (🔄) vs confirmations (⚠️)
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
  Columns,
  RefreshCw,
  User,
  ArrowRight
} from 'lucide-react';
import type { ValidationResult, ImportMode, SchemaValidationResult, ColumnMapping } from '@/types';
import type { ResolvableIssue, AutoTransformation, TypeWarning } from '@/lib/infrastructure/zoho/types';
import type { ImportProfile } from '@/types/profiles';

// ============================================================================
// PROPS
// ============================================================================

interface StepReviewProps {
  validation: ValidationResult;
  schemaValidation?: SchemaValidationResult | null;
  tableName: string;
  importMode: ImportMode;
  isImporting: boolean;
  onBack: () => void;
  onImport: () => void;
  resolvedIssues?: ResolvableIssue[];
  parsedData?: Record<string, string>[];
  selectedProfile?: ImportProfile;
}

// ============================================================================
// COMPOSANT : Ligne de mapping de colonne
// ============================================================================

function ColumnMappingRow({ 
  mapping,
  hasAutoTransform,
  hasUnresolvedIssue
}: { 
  mapping: ColumnMapping;
  hasAutoTransform: boolean;
  hasUnresolvedIssue: boolean;
}) {
  const getStatusIcon = () => {
    // Pas mappé
    if (!mapping.isMapped) {
      return <HelpCircle className="h-4 w-4 text-gray-400" />;
    }
    // Incompatible (erreur)
    if (!mapping.isCompatible) {
      return <XCircle className="h-4 w-4 text-red-500" />;
    }
    // Issue non résolue (bloquant)
    if (hasUnresolvedIssue) {
      return <AlertTriangle className="h-4 w-4 text-amber-500" />;
    }
    // Transformation automatique (informatif)
    if (hasAutoTransform) {
      return <RefreshCw className="h-4 w-4 text-blue-500" />;
    }
    // OK
    return <Check className="h-4 w-4 text-green-500" />;
  };

  const getRowStyle = () => {
    if (!mapping.isMapped) return 'bg-gray-50 dark:bg-gray-800/30';
    if (!mapping.isCompatible) return 'bg-red-50 dark:bg-red-900/10';
    if (hasUnresolvedIssue) return 'bg-amber-50 dark:bg-amber-900/10';
    if (hasAutoTransform) return 'bg-blue-50 dark:bg-blue-900/10';
    return 'bg-green-50 dark:bg-green-900/10';
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
    <div className={`flex items-center gap-3 p-2 rounded ${getRowStyle()}`}>
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

// ============================================================================
// COMPOSANT : Section des transformations automatiques (🔄)
// ============================================================================

function AutoTransformationsSection({ 
  transformations 
}: { 
  transformations: AutoTransformation[] 
}) {
  const [isExpanded, setIsExpanded] = useState(true);

  if (transformations.length === 0) return null;

  return (
    <div className="border rounded-lg border-blue-200 dark:border-blue-800">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors rounded-t-lg"
      >
        <div className="flex items-center gap-3">
          <RefreshCw className="h-5 w-5 text-blue-500" />
          <span className="font-medium">Transformations automatiques</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
            {transformations.length} colonne{transformations.length > 1 ? 's' : ''}
          </span>
        </div>
        {isExpanded ? (
          <ChevronDown className="h-5 w-5 text-gray-400" />
        ) : (
          <ChevronRight className="h-5 w-5 text-gray-400" />
        )}
      </button>

      {isExpanded && (
        <div className="border-t border-blue-200 dark:border-blue-800 p-4 space-y-3">
          <p className="text-sm text-blue-700 dark:text-blue-400 mb-3">
            Ces transformations seront appliquées automatiquement vers le format universel :
          </p>
          
          {transformations.map((transform, index) => (
            <div 
              key={index} 
              className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg"
            >
              <div className="flex items-center gap-2 mb-2">
                <RefreshCw className="h-4 w-4 text-blue-500" />
                <span className="font-medium text-sm">{transform.column}</span>
                <span className="text-xs text-blue-600 dark:text-blue-400">
                  ({transform.description})
                </span>
              </div>
              
              <div className="space-y-1">
                {transform.samples.map((sample: { before: string; after: string }, sampleIndex: number) => (
                  <div 
                    key={sampleIndex}
                    className="flex items-center gap-2 text-sm font-mono"
                  >
                    <span className="text-gray-600 dark:text-gray-400">
                      &quot;{sample.before}&quot;
                    </span>
                    <ArrowRight className="h-3 w-3 text-blue-500" />
                    <span className="text-blue-700 dark:text-blue-300 font-semibold">
                      &quot;{sample.after}&quot;
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
          
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 italic">
            Note : Les transformations ci-dessus seront appliquées automatiquement lors de l&apos;import.
            Aucune confirmation n&apos;est requise car ces formats sont non ambigus.
          </p>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// COMPOSANT : Section de validation de schéma
// ============================================================================

function SchemaValidationSection({ 
  schemaValidation,
  unresolvedIssues,
  autoTransformations
}: { 
  schemaValidation: SchemaValidationResult;
  unresolvedIssues: ResolvableIssue[];
  autoTransformations: AutoTransformation[];
}) {
  const [isExpanded, setIsExpanded] = useState(true);
  const { summary, matchedColumns, missingRequired, extraColumns, typeWarnings } = schemaValidation;

  // Créer des Sets pour lookup rapide
  const columnsWithAutoTransform = new Set(autoTransformations.map(t => t.column));
  const columnsWithUnresolvedIssue = new Set(unresolvedIssues.filter(i => !i.resolved).map(i => i.column));

  return (
    <div className="border rounded-lg dark:border-gray-700">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Columns className="h-5 w-5 text-blue-500" />
          <span className="font-medium">Correspondance des colonnes</span>
          
          <div className="flex items-center gap-2">
            <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
              {summary.matchedCount} mappées
            </span>
            {autoTransformations.length > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                {autoTransformations.length} transformations
              </span>
            )}
            {summary.errorCount > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                {summary.errorCount} erreurs
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

      {isExpanded && (
        <div className="border-t dark:border-gray-700 p-4 space-y-4">
          {/* Alertes colonnes requises manquantes */}
          {missingRequired.length > 0 && (
            <Alert variant="error" title="Colonnes obligatoires manquantes">
              Les colonnes suivantes sont requises par Zoho mais absentes de votre fichier :{' '}
              <strong>{missingRequired.join(', ')}</strong>
            </Alert>
          )}

          {/* Alertes erreurs de type */}
          {typeWarnings.filter((w: TypeWarning) => w.severity === 'error').length > 0 && (
            <Alert variant="error" title="Incompatibilités de types">
              {typeWarnings.filter((w: TypeWarning) => w.severity === 'error').map((w: TypeWarning, i: number) => (
                <div key={i} className="text-sm">
                  <strong>{w.column}</strong> : {w.message}
                </div>
              ))}
            </Alert>
          )}

          {/* Légende des icônes */}
          <div className="flex flex-wrap gap-4 text-xs text-gray-600 dark:text-gray-400 p-2 bg-gray-50 dark:bg-gray-800/50 rounded">
            <div className="flex items-center gap-1">
              <Check className="h-3 w-3 text-green-500" />
              <span>OK</span>
            </div>
            <div className="flex items-center gap-1">
              <RefreshCw className="h-3 w-3 text-blue-500" />
              <span>Transformation auto</span>
            </div>
            <div className="flex items-center gap-1">
              <AlertTriangle className="h-3 w-3 text-amber-500" />
              <span>Confirmation requise</span>
            </div>
            <div className="flex items-center gap-1">
              <XCircle className="h-3 w-3 text-red-500" />
              <span>Erreur</span>
            </div>
          </div>

          {/* Liste des mappings */}
          <div className="space-y-1">
            <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Détail des correspondances ({matchedColumns.length} colonnes)
            </div>
            <div className="max-h-64 overflow-y-auto space-y-1">
              {matchedColumns.map((mapping: ColumnMapping, index: number) => (
                <ColumnMappingRow 
                  key={index} 
                  mapping={mapping}
                  hasAutoTransform={columnsWithAutoTransform.has(mapping.fileColumn)}
                  hasUnresolvedIssue={columnsWithUnresolvedIssue.has(mapping.fileColumn)}
                />
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

// ============================================================================
// COMPOSANT : Info profil utilisé
// ============================================================================

function ProfileInfoSection({ profile }: { profile: ImportProfile }) {
  return (
    <div className="flex items-center gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
      <User className="h-5 w-5 text-blue-600 dark:text-blue-400" />
      <div className="flex-1">
        <p className="text-sm font-medium text-blue-800 dark:text-blue-300">
          Profil d&apos;import : {profile.name}
        </p>
        <p className="text-xs text-blue-600 dark:text-blue-400">
          Table : {profile.viewName} • {profile.columns.length} colonnes configurées
          {profile.useCount > 0 && ` • ${profile.useCount} import${profile.useCount > 1 ? 's' : ''} précédent${profile.useCount > 1 ? 's' : ''}`}
        </p>
      </div>
    </div>
  );
}

// ============================================================================
// COMPOSANT PRINCIPAL
// ============================================================================

export function StepReview({
  validation,
  schemaValidation,
  tableName,
  importMode,
  isImporting,
  onBack,
  onImport,
  resolvedIssues,
  selectedProfile,
}: StepReviewProps) {
  const canImport = validation.isValid || validation.validRows > 0;
  const hasErrors = validation.errorRows > 0;
  
  // Récupérer les transformations automatiques
  const autoTransformations = schemaValidation?.autoTransformations || [];
  
  // Récupérer les issues (uniquement les bloquantes)
  const unresolvedIssues = (resolvedIssues || schemaValidation?.resolvableIssues || []).filter(issue => !issue.resolved);
  
  // ============================================================================
  // LOGIQUE DE BLOCAGE
  // ============================================================================
  // Bloqué si :
  // 1. Colonnes obligatoires manquantes
  // 2. Erreurs de type (severity: 'error')
  // 3. Issues NON résolues (dates ambiguës, notation scientifique)
  //
  // NON bloqué si :
  // - Transformations automatiques (virgule, durée, espaces)
  // ============================================================================
  
  const hasBlockingErrors = schemaValidation && (
    schemaValidation.missingRequired.length > 0 ||
    schemaValidation.typeWarnings.some((w: TypeWarning) => w.severity === 'error')
  );
  
  const hasUnresolvedIssues = unresolvedIssues.length > 0;
  
  const schemaBlocksImport = hasBlockingErrors || hasUnresolvedIssues;

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
        {/* Profil utilisé */}
        {selectedProfile && (
          <ProfileInfoSection profile={selectedProfile} />
        )}

        {/* Transformations automatiques (🔄 informatif) */}
        {autoTransformations.length > 0 && (
          <AutoTransformationsSection transformations={autoTransformations} />
        )}

        {/* Validation de schéma */}
        {schemaValidation && (
          <SchemaValidationSection 
            schemaValidation={schemaValidation}
            unresolvedIssues={unresolvedIssues}
            autoTransformations={autoTransformations}
          />
        )}

        {/* Résultats de validation des données */}
        <ValidationResults result={validation} />

        {/* Warning si import partiel */}
        {hasErrors && validation.validRows > 0 && (
          <Alert variant="warning" title="Import partiel possible">
            <p>
              Seules les <strong>{validation.validRows.toLocaleString()}</strong> lignes valides
              seront importées. Les <strong>{validation.errorRows.toLocaleString()}</strong> lignes
              en erreur seront ignorées.
            </p>
          </Alert>
        )}

        {/* Blocage si schéma invalide */}
        {schemaBlocksImport && hasBlockingErrors && (
          <Alert variant="error" title="Import bloqué par la validation de schéma">
            Des colonnes obligatoires sont manquantes ou des incompatibilités de types empêchent l&apos;import.
          </Alert>
        )}

        {/* Blocage si issues non résolues */}
        {schemaBlocksImport && hasUnresolvedIssues && !hasBlockingErrors && (
          <Alert variant="warning" title="Formats à confirmer">
            {unresolvedIssues.length} format{unresolvedIssues.length > 1 ? 's' : ''} nécessite{unresolvedIssues.length > 1 ? 'nt' : ''} votre confirmation avant de pouvoir importer.
            Retournez à l&apos;étape de résolution pour les valider.
          </Alert>
        )}

        {/* Blocage si aucune ligne valide */}
        {!canImport && !schemaBlocksImport && (
          <Alert variant="error" title="Import impossible">
            Aucune ligne valide à importer. Veuillez corriger votre fichier et réessayer.
          </Alert>
        )}

        {/* Rappel mode d'import */}
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
            
            {/* Résumé des transformations */}
            {autoTransformations.length > 0 && (
              <p className="text-sm text-blue-600 dark:text-blue-400 mt-2">
                <RefreshCw className="h-3 w-3 inline mr-1" />
                {autoTransformations.length} transformation{autoTransformations.length > 1 ? 's' : ''} automatique{autoTransformations.length > 1 ? 's' : ''} sera{autoTransformations.length > 1 ? 'ont' : ''} appliquée{autoTransformations.length > 1 ? 's' : ''} lors de l&apos;import.
              </p>
            )}
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
