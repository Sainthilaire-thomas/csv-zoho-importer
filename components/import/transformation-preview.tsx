// ============================================================================
// CHEMIN DESTINATION : components/import/transformation-preview.tsx
// ACTION : CRÉER ce nouveau fichier
// ============================================================================

'use client';

/**
 * Composant d'affichage des transformations qui seront appliquées
 * Affiche un aperçu avant/après pour chaque colonne transformée
 */

import { Calendar, Hash, Type, Sparkles } from 'lucide-react';
import type { TransformationPreview, TransformationType } from '@/lib/domain/data-transformer';

// ============================================================================
// HELPERS
// ============================================================================

function getTransformationIcon(type: TransformationType) {
  switch (type) {
    case 'date_to_iso':
      return <Calendar className="h-4 w-4" />;
    case 'decimal_separator':
    case 'scientific_to_number':
      return <Hash className="h-4 w-4" />;
    case 'trim':
      return <Type className="h-4 w-4" />;
    default:
      return <Sparkles className="h-4 w-4" />;
  }
}

function getTransformationLabel(type: TransformationType): string {
  switch (type) {
    case 'date_to_iso':
      return 'Conversion date → ISO';
    case 'decimal_separator':
      return 'Séparateur décimal';
    case 'scientific_to_number':
      return 'Notation scientifique → Nombre';
    case 'trim':
      return 'Suppression espaces';
    default:
      return 'Transformation';
  }
}

function getTransformationDescription(type: TransformationType): string {
  switch (type) {
    case 'date_to_iso':
      return 'Format universel YYYY-MM-DD';
    case 'decimal_separator':
      return 'Virgule → Point';
    case 'scientific_to_number':
      return 'Notation développée';
    case 'trim':
      return 'Espaces supprimés';
    default:
      return '';
  }
}

// ============================================================================
// COMPOSANT PRINCIPAL
// ============================================================================

interface TransformationPreviewDisplayProps {
  previews: TransformationPreview[];
  className?: string;
}

export function TransformationPreviewDisplay({ 
  previews, 
  className = '' 
}: TransformationPreviewDisplayProps) {
  if (!previews || previews.length === 0) {
    return (
      <div className={`text-sm text-gray-500 dark:text-gray-400 italic ${className}`}>
        Aucune transformation nécessaire - les données seront envoyées telles quelles.
      </div>
    );
  }

  const totalAffectedRows = Math.max(...previews.map(p => p.affectedRows));

  return (
    <div className={className}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-4 text-sm text-amber-700 dark:text-amber-400">
        <Sparkles className="h-4 w-4" />
        <span className="font-medium">
          {previews.length} colonne{previews.length > 1 ? 's' : ''} • {totalAffectedRows} ligne{totalAffectedRows > 1 ? 's' : ''}
        </span>
      </div>

      {/* Liste des transformations */}
      <div className="space-y-4">
        {previews.map((preview, index) => (
          <TransformationCard key={index} preview={preview} />
        ))}
      </div>

      {/* Note explicative */}
      <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-sm text-blue-700 dark:text-blue-300">
        <strong>Note :</strong> Les transformations ci-dessus seront appliquées automatiquement 
        lors de l&apos;import. Les données envoyées à Zoho seront au format universel 
        (dates ISO, nombres sans notation scientifique).
      </div>
    </div>
  );
}

// ============================================================================
// SOUS-COMPOSANT : CARTE DE TRANSFORMATION
// ============================================================================

interface TransformationCardProps {
  preview: TransformationPreview;
}

function TransformationCard({ preview }: TransformationCardProps) {
  return (
    <div className="border border-amber-200 dark:border-amber-800 rounded-lg overflow-hidden">
      {/* En-tête de la carte */}
      <div className="flex items-center justify-between px-4 py-2 bg-amber-50 dark:bg-amber-900/30">
        <div className="flex items-center gap-2">
          <span className="text-amber-600 dark:text-amber-400">
            {getTransformationIcon(preview.type)}
          </span>
          <span className="font-medium text-gray-900 dark:text-gray-100">
            {preview.columnName}
          </span>
        </div>
        <span className="text-xs px-2 py-1 bg-amber-100 dark:bg-amber-800 text-amber-700 dark:text-amber-300 rounded">
          {getTransformationLabel(preview.type)}
        </span>
      </div>

      {/* Tableau avant/après */}
      <div className="p-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-500 dark:text-gray-400">
              <th className="text-left font-medium pb-2 w-1/2">Avant</th>
              <th className="text-center pb-2 w-8">→</th>
              <th className="text-left font-medium pb-2 w-1/2">Après</th>
            </tr>
          </thead>
          <tbody>
            {preview.sampleBefore.map((before, idx) => (
              <tr key={idx} className="border-t border-gray-100 dark:border-gray-700">
                <td className="py-2 font-mono text-gray-600 dark:text-gray-300">
                  {before}
                </td>
                <td className="py-2 text-center text-gray-400">→</td>
                <td className="py-2 font-mono text-green-600 dark:text-green-400">
                  {preview.sampleAfter[idx]}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Footer avec stats */}
        <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
          <span>{preview.affectedRows} valeur{preview.affectedRows > 1 ? 's' : ''}</span>
          <span>{getTransformationDescription(preview.type)}</span>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// EXPORT PAR DÉFAUT
// ============================================================================

export default TransformationPreviewDisplay;
