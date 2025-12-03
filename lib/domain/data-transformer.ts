// ============================================================================
// CHEMIN DESTINATION : lib/domain/data-transformer.ts
// ACTION : CRÉER ce nouveau fichier
// ============================================================================

/**
 * Service de transformation des données
 * Transforme les données du fichier source vers le format attendu par Zoho
 * 
 * Principe : Transformations EXPLICITES - l'utilisateur voit ce qui sera modifié
 */

import type { ResolvableIssue, DateFormatOption } from '@/lib/infrastructure/zoho/types';

// ============================================================================
// TYPES
// ============================================================================

export type TransformationType = 
  | 'date_to_iso'           // DD/MM/YYYY → YYYY-MM-DD
  | 'decimal_separator'     // 1234,56 → 1234.56
  | 'scientific_to_number'  // 1.5E6 → 1500000
  | 'trim'                  // "  text  " → "text"
  | 'none';

export interface TransformationRule {
  columnName: string;
  type: TransformationType;
  sourceFormat?: string;    // Ex: "DD/MM/YYYY"
  targetFormat?: string;    // Ex: "YYYY-MM-DD"
}

export interface TransformationPreview {
  columnName: string;
  type: TransformationType;
  sampleBefore: string[];   // 3 exemples avant transformation
  sampleAfter: string[];    // 3 exemples après transformation
  affectedRows: number;     // Nombre de lignes affectées
}

export interface TransformationResult {
  success: boolean;
  transformedData: Record<string, string>[];
  previews: TransformationPreview[];
  errors: TransformationError[];
}

export interface TransformationError {
  row: number;
  column: string;
  originalValue: string;
  error: string;
}

// ============================================================================
// FONCTIONS DE PARSING DE DATES
// ============================================================================

/**
 * Parse une date selon le format spécifié
 * @returns { day, month, year } ou null si invalide
 */
function parseDateWithFormat(
  value: string, 
  format: DateFormatOption
): { day: number; month: number; year: number } | null {
  if (!value || typeof value !== 'string') return null;
  
  const cleaned = value.trim();
  
  // Patterns selon le format
  const patterns: Record<DateFormatOption, RegExp> = {
    'DD/MM/YYYY': /^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/,
    'MM/DD/YYYY': /^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/,
    'YYYY-MM-DD': /^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})$/,
    'DD-MM-YYYY': /^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/,
  };
  
  const match = cleaned.match(patterns[format]);
  if (!match) return null;
  
  let day: number, month: number, year: number;
  
  switch (format) {
    case 'DD/MM/YYYY':
    case 'DD-MM-YYYY':
      day = parseInt(match[1], 10);
      month = parseInt(match[2], 10);
      year = parseInt(match[3], 10);
      break;
    case 'MM/DD/YYYY':
      month = parseInt(match[1], 10);
      day = parseInt(match[2], 10);
      year = parseInt(match[3], 10);
      break;
    case 'YYYY-MM-DD':
      year = parseInt(match[1], 10);
      month = parseInt(match[2], 10);
      day = parseInt(match[3], 10);
      break;
    default:
      return null;
  }
  
  // Validation basique
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > 31) return null;
  if (year < 1900 || year > 2100) return null;
  
  return { day, month, year };
}

/**
 * Convertit une date en format ISO (YYYY-MM-DD)
 */
function dateToISO(
  value: string, 
  sourceFormat: DateFormatOption
): string | null {
  const parsed = parseDateWithFormat(value, sourceFormat);
  if (!parsed) return null;
  
  const { day, month, year } = parsed;
  
  // Format ISO : YYYY-MM-DD avec padding
  return `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
}

/**
 * Formate une date pour affichage humain (ex: "5 mars 2025")
 */
export function formatDateHuman(
  value: string,
  sourceFormat: DateFormatOption
): string | null {
  const parsed = parseDateWithFormat(value, sourceFormat);
  if (!parsed) return null;
  
  const { day, month, year } = parsed;
  
  const monthNames = [
    'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
    'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'
  ];
  
  return `${day} ${monthNames[month - 1]} ${year}`;
}

// ============================================================================
// FONCTIONS DE TRANSFORMATION
// ============================================================================

/**
 * Transforme une valeur selon le type de transformation
 */
function transformValue(
  value: string,
  type: TransformationType,
  sourceFormat?: string
): { success: boolean; value: string; error?: string } {
  if (value === null || value === undefined || value === '') {
    return { success: true, value: '' };
  }
  
  const trimmed = value.trim();
  
  switch (type) {
    case 'date_to_iso': {
      if (!sourceFormat) {
        return { success: false, value: trimmed, error: 'Format source non spécifié' };
      }
      const iso = dateToISO(trimmed, sourceFormat as DateFormatOption);
      if (!iso) {
        return { success: false, value: trimmed, error: `Impossible de parser "${trimmed}" avec format ${sourceFormat}` };
      }
      return { success: true, value: iso };
    }
    
    case 'decimal_separator': {
      // Remplace virgule par point pour les décimaux
      const converted = trimmed.replace(',', '.');
      if (isNaN(parseFloat(converted))) {
        return { success: false, value: trimmed, error: `"${trimmed}" n'est pas un nombre valide` };
      }
      return { success: true, value: converted };
    }
    
    case 'scientific_to_number': {
      // Convertit notation scientifique en nombre
      const num = parseFloat(trimmed);
      if (isNaN(num)) {
        return { success: false, value: trimmed, error: `"${trimmed}" n'est pas un nombre valide` };
      }
      // Formater sans notation scientifique
      return { success: true, value: num.toLocaleString('en-US', { useGrouping: false, maximumFractionDigits: 10 }) };
    }
    
    case 'trim': {
      return { success: true, value: trimmed };
    }
    
    case 'none':
    default:
      return { success: true, value: trimmed };
  }
}

// ============================================================================
// CLASSE PRINCIPALE
// ============================================================================

export class DataTransformer {
  private rules: TransformationRule[] = [];
  
  /**
   * Construit les règles de transformation à partir des résolutions utilisateur
   */
  buildRulesFromResolutions(
    resolvedIssues: ResolvableIssue[],
    fileHeaders: string[]
  ): TransformationRule[] {
    this.rules = [];
    
    for (const issue of resolvedIssues) {
      if (!issue.resolved || !issue.resolution) continue;
      
      switch (issue.resolution.type) {
        case 'date_format': {
          // Ajouter règle pour cette colonne
          this.rules.push({
            columnName: issue.column,
            type: 'date_to_iso',
            sourceFormat: issue.resolution.format,
            targetFormat: 'YYYY-MM-DD',
          });
          break;
        }
        
        case 'scientific_to_number': {
          if (issue.resolution.confirmed) {
            this.rules.push({
              columnName: issue.column,
              type: 'scientific_to_number',
            });
          }
          break;
        }
        
        // scientific_to_text et ignore_column ne nécessitent pas de transformation
      }
    }
    
    return this.rules;
  }
  
  /**
   * Génère un aperçu des transformations sans modifier les données
   */
  generatePreview(
    data: Record<string, string>[],
    maxSamples: number = 3
  ): TransformationPreview[] {
    const previews: TransformationPreview[] = [];
    
    for (const rule of this.rules) {
      const sampleBefore: string[] = [];
      const sampleAfter: string[] = [];
      let affectedRows = 0;
      
      // Collecter des exemples
      for (const row of data) {
        const originalValue = row[rule.columnName];
        if (!originalValue || originalValue.trim() === '') continue;
        
        const result = transformValue(originalValue, rule.type, rule.sourceFormat);
        
        if (result.success && result.value !== originalValue.trim()) {
          affectedRows++;
          
          if (sampleBefore.length < maxSamples) {
            sampleBefore.push(originalValue);
            sampleAfter.push(result.value);
          }
        }
      }
      
      if (affectedRows > 0) {
        previews.push({
          columnName: rule.columnName,
          type: rule.type,
          sampleBefore,
          sampleAfter,
          affectedRows,
        });
      }
    }
    
    return previews;
  }
  
  /**
   * Applique les transformations aux données
   */
  transform(data: Record<string, string>[]): TransformationResult {
    const transformedData: Record<string, string>[] = [];
    const errors: TransformationError[] = [];
    const previews = this.generatePreview(data);
    
    for (let rowIndex = 0; rowIndex < data.length; rowIndex++) {
      const originalRow = data[rowIndex];
      const transformedRow: Record<string, string> = { ...originalRow };
      
      for (const rule of this.rules) {
        const originalValue = originalRow[rule.columnName];
        
        if (originalValue === null || originalValue === undefined || originalValue === '') {
          continue;
        }
        
        const result = transformValue(originalValue, rule.type, rule.sourceFormat);
        
        if (result.success) {
          transformedRow[rule.columnName] = result.value;
        } else {
          errors.push({
            row: rowIndex + 1, // 1-indexed pour l'affichage
            column: rule.columnName,
            originalValue,
            error: result.error || 'Erreur de transformation',
          });
          // Garder la valeur originale en cas d'erreur
          transformedRow[rule.columnName] = originalValue;
        }
      }
      
      transformedData.push(transformedRow);
    }
    
    return {
      success: errors.length === 0,
      transformedData,
      previews,
      errors,
    };
  }
  
  /**
   * Retourne les règles actuelles
   */
  getRules(): TransformationRule[] {
    return [...this.rules];
  }
  
  /**
   * Vérifie si des transformations sont configurées
   */
  hasTransformations(): boolean {
    return this.rules.length > 0;
  }
}

// ============================================================================
// EXPORT PAR DÉFAUT
// ============================================================================

export default DataTransformer;
