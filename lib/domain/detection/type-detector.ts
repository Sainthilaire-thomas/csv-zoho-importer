// lib/domain/detection/type-detector.ts
// Service de détection automatique des types de colonnes d'un fichier
// Supporte CSV (patterns seuls) et Excel (patterns + métadonnées)

import { DetectedColumn, DetectedType, ExcelColumnMeta, ExcelHint } from '@/types/profiles';

// =============================================================================
// CONFIGURATION
// =============================================================================

const CONFIG = {
  // Nombre d'échantillons à analyser pour déterminer le type
  SAMPLE_SIZE: 100,
  // Nombre d'échantillons à conserver pour l'affichage
  DISPLAY_SAMPLES: 5,
  // Seuil de confiance minimum (%)
  MIN_CONFIDENCE: 70,
  // Seuil pour considérer une colonne comme "vide"
  EMPTY_THRESHOLD: 90,
};

// =============================================================================
// PATTERNS DE DÉTECTION
// =============================================================================

const PATTERNS = {
  // Dates
  DATE_ISO: /^\d{4}-\d{2}-\d{2}$/,                    // 2025-03-05
  DATE_FR: /^\d{2}\/\d{2}\/\d{4}$/,                   // 05/03/2025
  DATE_FR_DASH: /^\d{2}-\d{2}-\d{4}$/,                // 05-03-2025
  DATE_US: /^\d{2}\/\d{2}\/\d{4}$/,                   // 03/05/2025 (même pattern que FR)
  DATE_SHORT: /^\d{2}\/\d{2}\/\d{2}$/,                // 05/03/25
  DATE_LOOSE: /^\d{1,2}\/\d{1,2}\/\d{2,4}$/,         // 5/3/2025 ou 5/3/25

  // Durées
  DURATION_HMS: /^\d{1,2}:\d{2}:\d{2}$/,              // 23:54:00 ou 9:30:00
  DURATION_HM: /^\d{1,2}:\d{2}$/,                     // 23:54 ou 9:30

  // Nombres
  NUMBER_INT: /^-?\d+$/,                              // 1234 ou -1234
  NUMBER_FR: /^-?\d{1,3}(?:\s\d{3})*(?:,\d+)?$/,     // 1 234,56 (espace milliers, virgule décimale)
  NUMBER_FR_SIMPLE: /^-?\d+,\d+$/,                    // 1234,56 (virgule décimale)
  NUMBER_US: /^-?\d{1,3}(?:,\d{3})*(?:\.\d+)?$/,     // 1,234.56 (virgule milliers, point décimal)
  NUMBER_US_SIMPLE: /^-?\d+\.\d+$/,                   // 1234.56 (point décimal)
  NUMBER_SCIENTIFIC: /^-?\d+(?:\.\d+)?[eE][+-]?\d+$/, // 1E6, 1.5E-3

  // Booléens
  BOOLEAN_FR: /^(oui|non|vrai|faux)$/i,
  BOOLEAN_EN: /^(yes|no|true|false)$/i,
  BOOLEAN_NUM: /^[01]$/,

  // Email
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,

  // URL
  URL: /^https?:\/\/.+/i,
};

// Valeurs considérées comme "vides"
const EMPTY_VALUES = new Set([
  '', 'null', 'nil', 'na', 'n/a', '-', '--', '/', 'none', 'aucun', 'vide',
  'undefined', '#n/a', '#ref!', '#valeur!', '#value!'
]);

// =============================================================================
// OPTIONS DE DÉTECTION
// =============================================================================

export interface DetectionOptions {
  // Métadonnées Excel par colonne (absent pour CSV)
  excelMetadata?: Record<string, ExcelColumnMeta>;
}

// =============================================================================
// TYPE DETECTOR CLASS
// =============================================================================

export class TypeDetector {
  /**
   * Analyse toutes les colonnes d'un fichier
   * @param data Tableau de lignes (chaque ligne est un objet clé-valeur)
   *             Accepte unknown pour supporter les types natifs Excel (number, boolean, Date)
   * @param options Options de détection (métadonnées Excel si disponibles)
   * @returns Tableau de colonnes détectées
   */
  detectColumns(
    data: Record<string, unknown>[],
    options?: DetectionOptions
  ): DetectedColumn[] {
    if (!data || data.length === 0) {
      return [];
    }

    // Récupérer les noms de colonnes depuis la première ligne
    const columnNames = Object.keys(data[0]);

    return columnNames.map((name, index) => {
      // Extraire toutes les valeurs de cette colonne et les convertir en string
      const values = data.map(row => this.toStringValue(row[name]));
      
      // Récupérer les métadonnées Excel pour cette colonne (si disponibles)
      const excelMeta = options?.excelMetadata?.[name];
      
      return this.analyzeColumn(name, index, values, excelMeta);
    });
  }

  /**
   * Convertit une valeur de type unknown en string
   * Gère les types natifs retournés par xlsx (number, boolean, Date, null, undefined)
   */
  private toStringValue(value: unknown): string {
    if (value === null || value === undefined) {
      return '';
    }
    if (typeof value === 'string') {
      return value;
    }
    if (typeof value === 'number') {
      // Éviter la notation scientifique pour les grands nombres
      if (Math.abs(value) >= 1e15 || (Math.abs(value) < 1e-6 && value !== 0)) {
        return value.toLocaleString('en-US', { useGrouping: false, maximumFractionDigits: 20 });
      }
      return String(value);
    }
    if (typeof value === 'boolean') {
      return value ? 'true' : 'false';
    }
    if (value instanceof Date) {
      // Convertir Date en format ISO pour analyse ultérieure
      if (isNaN(value.getTime())) {
        return '';
      }
      return value.toISOString().split('T')[0]; // YYYY-MM-DD
    }
    // Fallback pour tout autre type
    return String(value);
  }

  /**
   * Analyse une colonne spécifique
   */
  private analyzeColumn(
    name: string,
    index: number,
    values: string[],
    excelMeta?: ExcelColumnMeta
  ): DetectedColumn {
    // Filtrer les valeurs non vides pour l'analyse
    const nonEmptyValues = values.filter(v => !this.isEmpty(v));
    const emptyCount = values.length - nonEmptyValues.length;

    // Si la colonne est majoritairement vide
    const emptyPercentage = (emptyCount / values.length) * 100;
    if (emptyPercentage >= CONFIG.EMPTY_THRESHOLD) {
      return {
        name,
        index,
        detectedType: 'empty',
        confidence: 100,
        samples: this.getSamples(nonEmptyValues),
        totalValues: values.length,
        emptyCount,
        isAmbiguous: false,
      };
    }

    // Prendre un échantillon pour l'analyse
    const sampleValues = this.getSampleForAnalysis(nonEmptyValues);

    // Détecter le type par patterns
    const detection = this.detectType(sampleValues);

    // Vérifier les ambiguïtés
    const ambiguity = this.checkAmbiguity(detection, sampleValues);

    // Construire le hint Excel si disponible et pertinent
    const excelHint = this.buildExcelHint(detection, ambiguity, excelMeta);

    return {
      name,
      index,
      detectedType: detection.type,
      confidence: detection.confidence,
      detectedFormat: detection.format,
      samples: this.getSamples(nonEmptyValues),
      totalValues: values.length,
      emptyCount,
      isAmbiguous: ambiguity.isAmbiguous,
      ambiguityReason: ambiguity.reason,
      excelHint,
    };
  }

  /**
   * Construit un hint Excel si les métadonnées sont disponibles et utiles
   */
  private buildExcelHint(
    detection: { type: DetectedType; format?: string },
    ambiguity: { isAmbiguous: boolean; reason?: string },
    excelMeta?: ExcelColumnMeta
  ): ExcelHint | undefined {
    // Pas de métadonnées = pas de hint
    if (!excelMeta) {
      return undefined;
    }

    // Pas d'ambiguïté = pas besoin de hint
    if (!ambiguity.isAmbiguous) {
      return undefined;
    }

    // Métadonnées non fiables = pas de hint
    if (excelMeta.confidence === 'low') {
      return undefined;
    }

    // Format normalisé non disponible = pas de hint
    if (!excelMeta.normalizedFormat || !excelMeta.rawExcelFormat) {
      return undefined;
    }

    // Pour les dates ambiguës, le hint Excel est très utile
    if (detection.type === 'date' && excelMeta.normalizedFormat) {
      return {
        suggestedFormat: excelMeta.normalizedFormat,
        rawExcelFormat: excelMeta.rawExcelFormat,
        confidence: excelMeta.confidence,
      };
    }

    // Pour les nombres avec notation scientifique
    if (detection.type === 'number' && detection.format === 'scientific') {
      // Excel peut indiquer si c'est vraiment un nombre ou du texte
      if (excelMeta.dominantCellType === 'string') {
        return {
          suggestedFormat: 'text',
          rawExcelFormat: excelMeta.rawExcelFormat,
          confidence: excelMeta.confidence,
        };
      }
    }

    return undefined;
  }

  /**
   * Détecte le type d'une liste de valeurs
   */
  private detectType(values: string[]): { type: DetectedType; confidence: number; format?: string } {
    if (values.length === 0) {
      return { type: 'empty', confidence: 100 };
    }

    // Tester chaque type et calculer le score
    const scores: { type: DetectedType; confidence: number; format?: string }[] = [];

    // Test Date
    const dateResult = this.testDate(values);
    if (dateResult.confidence > 0) {
      scores.push({ type: 'date', ...dateResult });
    }

    // Test Duration
    const durationResult = this.testDuration(values);
    if (durationResult.confidence > 0) {
      scores.push({ type: 'duration', ...durationResult });
    }

    // Test Number
    const numberResult = this.testNumber(values);
    if (numberResult.confidence > 0) {
      scores.push({ type: 'number', ...numberResult });
    }

    // Test Boolean
    const booleanResult = this.testBoolean(values);
    if (booleanResult.confidence > 0) {
      scores.push({ type: 'boolean', ...booleanResult });
    }

    // Trier par confiance décroissante
    scores.sort((a, b) => b.confidence - a.confidence);

    // Si aucun type spécifique détecté avec assez de confiance, c'est du texte
    if (scores.length === 0 || scores[0].confidence < CONFIG.MIN_CONFIDENCE) {
      return { type: 'text', confidence: 100 };
    }

    return scores[0];
  }

  // ===========================================================================
  // TESTS DE TYPE SPÉCIFIQUES
  // ===========================================================================

  /**
   * Teste si les valeurs sont des dates
   */
  private testDate(values: string[]): { confidence: number; format?: string } {
    const formats = [
      { pattern: PATTERNS.DATE_ISO, format: 'YYYY-MM-DD' },
      { pattern: PATTERNS.DATE_FR, format: 'DD/MM/YYYY' },
      { pattern: PATTERNS.DATE_FR_DASH, format: 'DD-MM-YYYY' },
      { pattern: PATTERNS.DATE_SHORT, format: 'DD/MM/YY' },
      { pattern: PATTERNS.DATE_LOOSE, format: 'D/M/YYYY' },
    ];

    for (const { pattern, format } of formats) {
      const matches = values.filter(v => pattern.test(v.trim())).length;
      const confidence = (matches / values.length) * 100;

      if (confidence >= CONFIG.MIN_CONFIDENCE) {
        return { confidence: Math.round(confidence), format };
      }
    }

    return { confidence: 0 };
  }

  /**
   * Teste si les valeurs sont des durées
   */
  private testDuration(values: string[]): { confidence: number; format?: string } {
    const formats = [
      { pattern: PATTERNS.DURATION_HMS, format: 'HH:mm:ss' },
      { pattern: PATTERNS.DURATION_HM, format: 'HH:mm' },
    ];

    for (const { pattern, format } of formats) {
      const matches = values.filter(v => pattern.test(v.trim())).length;
      const confidence = (matches / values.length) * 100;

      if (confidence >= CONFIG.MIN_CONFIDENCE) {
        // Vérifier que ce sont des heures valides (0-23:0-59)
        const validTimes = values.filter(v => {
          const match = v.trim().match(/^(\d{1,2}):(\d{2})/);
          if (!match) return false;
          const hours = parseInt(match[1]);
          const minutes = parseInt(match[2]);
          return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
        }).length;

        const validConfidence = (validTimes / values.length) * 100;
        if (validConfidence >= CONFIG.MIN_CONFIDENCE) {
          return { confidence: Math.round(validConfidence), format };
        }
      }
    }

    return { confidence: 0 };
  }

  /**
   * Teste si les valeurs sont des nombres
   */
  private testNumber(values: string[]): { confidence: number; format?: string } {
    const formats = [
      { pattern: PATTERNS.NUMBER_SCIENTIFIC, format: 'scientific' },
      { pattern: PATTERNS.NUMBER_INT, format: 'integer' },
      { pattern: PATTERNS.NUMBER_FR, format: 'fr' },
      { pattern: PATTERNS.NUMBER_FR_SIMPLE, format: 'fr' },
      { pattern: PATTERNS.NUMBER_US, format: 'us' },
      { pattern: PATTERNS.NUMBER_US_SIMPLE, format: 'us' },
    ];

    for (const { pattern, format } of formats) {
      const matches = values.filter(v => pattern.test(v.trim())).length;
      const confidence = (matches / values.length) * 100;

      if (confidence >= CONFIG.MIN_CONFIDENCE) {
        return { confidence: Math.round(confidence), format };
      }
    }

    return { confidence: 0 };
  }

  /**
   * Teste si les valeurs sont des booléens
   */
  private testBoolean(values: string[]): { confidence: number; format?: string } {
    const patterns = [
      { pattern: PATTERNS.BOOLEAN_FR, format: 'fr' },
      { pattern: PATTERNS.BOOLEAN_EN, format: 'en' },
      { pattern: PATTERNS.BOOLEAN_NUM, format: 'numeric' },
    ];

    for (const { pattern, format } of patterns) {
      const matches = values.filter(v => pattern.test(v.trim())).length;
      const confidence = (matches / values.length) * 100;

      if (confidence >= CONFIG.MIN_CONFIDENCE) {
        return { confidence: Math.round(confidence), format };
      }
    }

    return { confidence: 0 };
  }

  // ===========================================================================
  // DÉTECTION D'AMBIGUÏTÉS
  // ===========================================================================

  /**
   * Vérifie si le type détecté présente des ambiguïtés
   */
  private checkAmbiguity(
    detection: { type: DetectedType; format?: string },
    values: string[]
  ): { isAmbiguous: boolean; reason?: string } {

    // Ambiguïté date : DD/MM vs MM/DD
    if (detection.type === 'date' && detection.format?.includes('/')) {
      const ambiguousDates = values.filter(v => {
        // Pattern qui capture la partie date, avec ou sans heure après
        const match = v.match(/^(\d{1,2})\/(\d{1,2})\/\d{2,4}/);
        if (!match) return false;
        const first = parseInt(match[1]);
        const second = parseInt(match[2]);
        // Ambigu si les deux valeurs pourraient être jour OU mois (≤ 12)
        return first <= 12 && second <= 12;
      });

      if (ambiguousDates.length > values.length * 0.5) {
        return {
          isAmbiguous: true,
          reason: 'Format de date ambigu : JJ/MM/AAAA ou MM/JJ/AAAA ?'
        };
      }
    }

    // Ambiguïté notation scientifique dans une colonne texte
    if (detection.type === 'number' && detection.format === 'scientific') {
      return {
        isAmbiguous: true,
        reason: 'Notation scientifique détectée : développer (1E6 → 1000000) ou garder ?'
      };
    }

    return { isAmbiguous: false };
  }

  // ===========================================================================
  // HELPERS
  // ===========================================================================

  /**
   * Vérifie si une valeur est considérée comme vide
   */
  private isEmpty(value: unknown): boolean {
    if (value === null || value === undefined) return true;
    const strValue = String(value);
    if (strValue === '') return true;
    const normalized = strValue.trim().toLowerCase();
    return EMPTY_VALUES.has(normalized);
  }

  /**
   * Récupère un échantillon de valeurs pour l'analyse
   */
  private getSampleForAnalysis(values: string[]): string[] {
    if (values.length <= CONFIG.SAMPLE_SIZE) {
      return values;
    }

    // Prendre des valeurs réparties uniformément
    const step = Math.floor(values.length / CONFIG.SAMPLE_SIZE);
    const sample: string[] = [];
    for (let i = 0; i < values.length && sample.length < CONFIG.SAMPLE_SIZE; i += step) {
      sample.push(values[i]);
    }
    return sample;
  }

  /**
   * Récupère des échantillons pour l'affichage
   */
  private getSamples(values: string[]): string[] {
    // Prendre des valeurs uniques et variées
    const unique = [...new Set(values)];
    return unique.slice(0, CONFIG.DISPLAY_SAMPLES);
  }
}

// =============================================================================
// INSTANCE SINGLETON
// =============================================================================

export const typeDetector = new TypeDetector();

// =============================================================================
// FONCTIONS UTILITAIRES EXPORTÉES
// =============================================================================

/**
 * Détecte les types de colonnes d'un fichier parsé
 */
export function detectColumnTypes(
  data: Record<string, unknown>[],
  options?: DetectionOptions
): DetectedColumn[] {
  return typeDetector.detectColumns(data, options);
}

/**
 * Analyse une seule colonne
 */
export function analyzeColumnValues(
  name: string,
  values: unknown[]
): DetectedColumn {
  const stringValues = values.map(v => typeDetector['toStringValue'](v));
  return typeDetector['analyzeColumn'](name, 0, stringValues, undefined);
}
