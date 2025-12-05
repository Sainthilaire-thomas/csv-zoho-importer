/**
 * Preview des transformations - Mission 006
 * Génère un aperçu détaillé des transformations qui seront appliquées
 */

import type { AutoTransformation } from '@/lib/infrastructure/zoho/types';

// =============================================================================
// TYPES
// =============================================================================

export type TransformStatus = 'transformed' | 'unchanged' | 'empty' | 'error';

export interface TransformSample {
  rowIndex: number;
  sourceValue: string;
  transformedValue: string;
  status: TransformStatus;
}

export interface TransformPreviewColumn {
  columnName: string;
  zohoColumnName: string;
  zohoType: string;
  transformationType: string | null;
  transformationLabel: string;
  samples: TransformSample[];
  transformedCount: number;
  unchangedCount: number;
  emptyCount: number;
}

export interface TransformPreviewSummary {
  totalRows: number;
  totalColumns: number;
  totalValues: number;
  transformedColumns: Array<{
    name: string;
    type: string;
    count: number;
  }>;
  unchangedColumns: string[];
  emptyValuesCount: number;
  totalTransformations: number;
  transformationPercentage: number;
}

export interface TransformPreviewResult {
  columns: TransformPreviewColumn[];
  summary: TransformPreviewSummary;
}

// =============================================================================
// FONCTIONS
// =============================================================================

/**
 * Génère un preview des transformations à partir des AutoTransformations détectées
 */
export function generateTransformPreview(
  autoTransformations: AutoTransformation[],
  data: Record<string, unknown>[],
  sampleSize: number = 5
): TransformPreviewResult {
  const columns: TransformPreviewColumn[] = [];
  
  // Grouper les transformations par colonne
  const transformsByColumn = new Map<string, AutoTransformation[]>();
  
  for (const transform of autoTransformations) {
    const existing = transformsByColumn.get(transform.column) || [];
    existing.push(transform);
    transformsByColumn.set(transform.column, existing);
  }
  
  // Générer le preview pour chaque colonne avec transformation
  for (const [columnName, transforms] of transformsByColumn) {
    const primaryTransform = transforms[0];
    
    const samples: TransformSample[] = primaryTransform.samples
      .slice(0, sampleSize)
      .map((sample, index) => ({
        rowIndex: index + 1,
        sourceValue: sample.before,
        transformedValue: sample.after,
        status: getTransformStatus(sample.before, sample.after),
      }));
    
    const transformedCount = samples.filter(s => s.status === 'transformed').length;
    const unchangedCount = samples.filter(s => s.status === 'unchanged').length;
    const emptyCount = samples.filter(s => s.status === 'empty').length;
    
    columns.push({
      columnName,
      zohoColumnName: columnName, // Même nom pour l'instant
      zohoType: getZohoTypeFromTransform(primaryTransform.type),
      transformationType: primaryTransform.type,
      transformationLabel: primaryTransform.description,
      samples,
      transformedCount,
      unchangedCount,
      emptyCount,
    });
  }
  
  // Calculer le résumé
  const summary = calculateSummary(columns, data, autoTransformations);
  
  return { columns, summary };
}

/**
 * Détermine le status d'une transformation
 */
function getTransformStatus(before: string, after: string): TransformStatus {
  if (!before || before.trim() === '' || before === 'N/A' || before === '-') {
    return 'empty';
  }
  if (before === after) {
    return 'unchanged';
  }
  return 'transformed';
}

/**
 * Déduit le type Zoho depuis le type de transformation
 */
function getZohoTypeFromTransform(transformType: string): string {
  switch (transformType) {
    case 'decimal_comma':
    case 'thousands_separator':
      return 'NUMBER / DECIMAL';
    case 'short_duration':
      return 'DURATION';
    case 'date_format':
    case 'ambiguous_date':
      return 'DATE';
    case 'scientific_notation':
      return 'TEXT / NUMBER';
    default:
      return 'TEXT';
  }
}

/**
 * Calcule le résumé global des transformations
 */
function calculateSummary(
  columns: TransformPreviewColumn[],
  data: Record<string, unknown>[],
  autoTransformations: AutoTransformation[]
): TransformPreviewSummary {
  const totalRows = data.length;
  const totalColumns = Object.keys(data[0] || {}).length;
  const totalValues = totalRows * totalColumns;
  
  // Colonnes transformées
  const transformedColumns = columns.map(col => ({
    name: col.columnName,
    type: col.transformationLabel,
    count: totalRows, // Estimation: toutes les lignes sont transformées
  }));
  
  // Colonnes inchangées (toutes les colonnes moins celles transformées)
  const transformedColumnNames = new Set(columns.map(c => c.columnName));
  const allColumns = Object.keys(data[0] || {});
  const unchangedColumns = allColumns.filter(c => !transformedColumnNames.has(c));
  
  // Comptage des valeurs vides
  const emptyValuesCount = columns.reduce((sum, col) => sum + col.emptyCount, 0);
  
  // Total des transformations
  const totalTransformations = transformedColumns.reduce((sum, col) => sum + col.count, 0);
  const transformationPercentage = totalValues > 0 
    ? Math.round((totalTransformations / totalValues) * 100) 
    : 0;
  
  return {
    totalRows,
    totalColumns,
    totalValues,
    transformedColumns,
    unchangedColumns,
    emptyValuesCount,
    totalTransformations,
    transformationPercentage,
  };
}

/**
 * Formate une description de transformation pour l'affichage
 */
export function formatTransformDescription(type: string): string {
  const descriptions: Record<string, string> = {
    'decimal_comma': 'Virgule décimale → Point',
    'short_duration': 'Durée courte → HH:mm:ss',
    'thousands_separator': 'Séparateur milliers supprimé',
    'date_format': 'Format de date → ISO',
    'ambiguous_date': 'Date ambiguë résolue',
    'scientific_notation': 'Notation scientifique → Nombre',
    'iso_date': 'Date ISO confirmée',
  };
  return descriptions[type] || type;
}

/**
 * Retourne l'icône/emoji approprié pour un status
 */
export function getStatusIndicator(status: TransformStatus): { icon: string; label: string; color: string } {
  switch (status) {
    case 'transformed':
      return { icon: '🔄', label: 'Transformé', color: 'text-blue-600' };
    case 'unchanged':
      return { icon: '✅', label: 'Inchangé', color: 'text-green-600' };
    case 'empty':
      return { icon: '⚠️', label: 'Vide', color: 'text-amber-600' };
    case 'error':
      return { icon: '❌', label: 'Erreur', color: 'text-red-600' };
    default:
      return { icon: '❓', label: 'Inconnu', color: 'text-gray-600' };
  }
}
