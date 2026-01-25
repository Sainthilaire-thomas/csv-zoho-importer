// ============================================================================
// CHEMIN DESTINATION : lib/domain/data-transformer.ts
// ============================================================================

/**
 * Service de transformation des données
 * Transforme les données du fichier source vers le format attendu par Zoho
 * 
 * Principe : Transformations EXPLICITES - l'utilisateur voit ce qui sera modifié
 */

import type { ResolvableIssue, DateFormatOption, ColumnMapping } from '@/lib/infrastructure/zoho/types';

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

/**
 * Convertit une date ISO (YYYY-MM-DD HH:mm:ss) vers le format Zoho cible
 * @param isoDate - Date au format ISO (ex: "2025-04-01 00:00:00")
 * @param zohoFormat - Format Zoho cible (ex: "MM/yyyy", "dd MMM yyyy HH:mm:ss")
 * @returns La date formatée selon le format Zoho
 */
export function formatDateForZoho(isoDate: string, zohoFormat: string): string {
  if (!isoDate || !zohoFormat) return isoDate;
  
  // Parser la date ISO
  const match = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})(?:\s+(\d{2}):(\d{2}):(\d{2}))?$/);
  if (!match) return isoDate;
  
  const year = match[1];
  const month = match[2];
  const day = match[3];
  const hours = match[4] || '00';
  const minutes = match[5] || '00';
  const seconds = match[6] || '00';
  
  // Noms des mois pour formats comme "dd MMM yyyy"
  const monthNamesShort = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthNamesFull = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const monthIndex = parseInt(month, 10) - 1;
  
  // Remplacements selon le format Zoho
  let result = zohoFormat;
  
  // Année
  result = result.replace(/yyyy/g, year);
  result = result.replace(/yy/g, year.slice(2));
  
  // Mois
  result = result.replace(/MMMM/g, monthNamesFull[monthIndex] || month);
  result = result.replace(/MMM/g, monthNamesShort[monthIndex] || month);
  result = result.replace(/MM/g, month);
  result = result.replace(/M(?![a-zA-Z])/g, parseInt(month, 10).toString());
  
  // Jour
  result = result.replace(/dd/g, day);
  result = result.replace(/d(?![a-zA-Z])/g, parseInt(day, 10).toString());
  
  // Heure
  result = result.replace(/HH/g, hours);
  result = result.replace(/H(?![a-zA-Z])/g, parseInt(hours, 10).toString());
  result = result.replace(/hh/g, hours);
  result = result.replace(/h(?![a-zA-Z])/g, parseInt(hours, 10).toString());
  
  // Minutes
  result = result.replace(/mm/g, minutes);
  result = result.replace(/m(?![a-zA-Z])/g, parseInt(minutes, 10).toString());
  
  // Secondes
  result = result.replace(/ss/g, seconds);
  result = result.replace(/s(?![a-zA-Z])/g, parseInt(seconds, 10).toString());
  
  return result;
}


// ============================================================================
// FONCTIONS DE TRANSFORMATION UNITAIRES
// ============================================================================

/**
 * Applique une transformation spécifique à une valeur
 */
export function applyTransformation(value: string, transformType: string | undefined, zohoDateFormat?: string): string {
  if (!value || value.trim() === '') return '';
  
  switch (transformType) {
    case 'date_format': {
      // Étape 1: Convertir vers ISO d'abord
      let isoResult: string | null = null;
      
      // 1. Conversion période française (juin-25, janv-24, etc.) → YYYY-MM-01 00:00:00
      const normalizedValue = value
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\uFFFD/g, '')
        .replace(/[^\w\d-]/g, '');

      const monthNames: Record<string, string> = {
        'janvier': '01', 'janv': '01', 'jan': '01',
        'fevrier': '02', 'fevr': '02', 'fev': '02', 'feb': '02', 'fvrier': '02', 'fvr': '02',
        'mars': '03', 'mar': '03',
        'avril': '04', 'avr': '04', 'apr': '04',
        'mai': '05', 'may': '05',
        'juin': '06', 'jun': '06',
        'juillet': '07', 'juil': '07', 'jul': '07',
        'aout': '08', 'aug': '08', 'ao': '08', 'aot': '08', 'aut': '08', 'out': '08',
        'septembre': '09', 'sept': '09', 'sep': '09',
        'octobre': '10', 'oct': '10',
        'novembre': '11', 'nov': '11',
        'decembre': '12', 'dec': '12', 'dcembre': '12', 'dc': '12'
      };

      // Pattern: mois-année (ex: juin-25, janv-24, septembre-2025)
      const periodMatch = normalizedValue.match(/^([a-z]+)-(\d{2,4})$/);
      if (periodMatch) {
        const monthStr = periodMatch[1];
        let yearStr = periodMatch[2];
        const monthNum = monthNames[monthStr];
        if (monthNum) {
          if (yearStr.length === 2) {
            const yearNum = parseInt(yearStr, 10);
            yearStr = yearNum >= 50 ? `19${yearStr}` : `20${yearStr}`;
          }
          isoResult = `${yearStr}-${monthNum}-01 00:00:00`;
        }
      }

      // 1b. Pattern numérique mois/année (ex: 4/2025, 04/2025, 12/2025)
      if (!isoResult) {
        const numericPeriodMatch = value.match(/^(\d{1,2})\/(\d{4})$/);
        if (numericPeriodMatch) {
          const monthNum = numericPeriodMatch[1].padStart(2, '0');
          const yearStr = numericPeriodMatch[2];
          const monthInt = parseInt(monthNum, 10);
          if (monthInt >= 1 && monthInt <= 12) {
            isoResult = `${yearStr}-${monthNum}-01 00:00:00`;
          }
        }
      }

      // 2. Conversion DD/MM/YYYY ou DD/MM/YYYY HH:mm:ss → YYYY-MM-DD HH:mm:ss
      if (!isoResult) {
        const dateWithTimeMatch = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
        if (dateWithTimeMatch) {
          const day = dateWithTimeMatch[1].padStart(2, '0');
          const month = dateWithTimeMatch[2].padStart(2, '0');
          const year = dateWithTimeMatch[3];
          const hours = dateWithTimeMatch[4];
          const minutes = dateWithTimeMatch[5];
          const seconds = dateWithTimeMatch[6];
          if (hours && minutes) {
            const hh = hours.padStart(2, '0');
            const mm = minutes.padStart(2, '0');
            const ss = seconds ? seconds.padStart(2, '0') : '00';
            isoResult = `${year}-${month}-${day} ${hh}:${mm}:${ss}`;
          } else {
            isoResult = `${year}-${month}-${day} 00:00:00`;
          }
        }
      }

      // 3. Pattern ISO déjà correct (YYYY-MM-DD) - ajouter l'heure si manquante
      if (!isoResult) {
        const isoMatch = value.match(/^(\d{4}-\d{2}-\d{2})(?:\s+(\d{2}:\d{2}:\d{2}))?$/);
        if (isoMatch) {
          const datePart = isoMatch[1];
          const timePart = isoMatch[2] || '00:00:00';
          isoResult = `${datePart} ${timePart}`;
        }
      }

      // Si aucune conversion, retourner la valeur originale
      if (!isoResult) {
        return value;
      }

      // Étape 2: Si un format Zoho cible est spécifié, convertir ISO → format Zoho
      if (zohoDateFormat) {
        return formatDateForZoho(isoResult, zohoDateFormat);
      }

      // Sinon retourner le format ISO
      return isoResult;
    }

    case 'number_format':
      // Simuler conversion 1 234,56 → 1234.56
      return value.replace(/\s/g, '').replace(',', '.');
      
    case 'duration_format':
      // Simuler conversion 9:30 → 09:30:00
      const durationMatch = value.match(/^(\d{1,2}):(\d{2})$/);
      if (durationMatch) {
        const hours = durationMatch[1].padStart(2, '0');
        return `${hours}:${durationMatch[2]}:00`;
      }
      return value;
      
    case 'trim':
      return value.trim();
      
    default:
      return value;
  }
}

/**
 * Transforme une valeur selon le type de transformation (pour DataTransformer class)
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
      // Préserver les espaces, uniquement remplacer les sauts de ligne
      const withoutNewlines = String(value).replace(/[\r\n]+/g, ' ');
      return { success: true, value: withoutNewlines };
  }
}

// ============================================================================
// FONCTION PRINCIPALE - APPLIQUE TOUTES LES TRANSFORMATIONS
// ============================================================================

/**
 * Applique TOUTES les transformations aux données
 * Cette fonction est la SOURCE DE VÉRITÉ utilisée pour :
 * - L'affichage preview (StepTransformPreview)
 * - L'envoi à Zoho (executeTestImport, handleConfirmFullImport)
 * 
 * @param data - Données brutes du fichier
 * @param matchedColumns - Colonnes mappées avec leurs transformations
 * @returns Données transformées prêtes pour Zoho
 */
export function applyAllTransformations(
  data: Record<string, unknown>[],
  matchedColumns?: ColumnMapping[]
): Record<string, unknown>[] {
  return data.map(row => {
    const newRow: Record<string, unknown> = {};
    
    for (const [key, value] of Object.entries(row)) {
      if (typeof value === 'string') {
        // 1. TOUJOURS nettoyer : remplacer \r\n par espace (préserve les espaces début/fin)
        let cleaned = value.replace(/[\r\n]+/g, ' ');
        
        // 2. Appliquer transformation spécifique si définie dans le mapping
        if (matchedColumns) {
          const colMapping = matchedColumns.find(c => c.fileColumn === key);
          if (colMapping?.transformNeeded && colMapping.transformNeeded !== 'none') {
            // Pour l'import, on envoie en ISO - Zoho convertira vers son format d'affichage
          cleaned = applyTransformation(cleaned, colMapping.transformNeeded);
          }
        }
        
        newRow[key] = cleaned;
      } else if (value === null || value === undefined) {
        newRow[key] = '';
      } else {
        newRow[key] = value;
      }
    }
    
    return newRow;
  });
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
