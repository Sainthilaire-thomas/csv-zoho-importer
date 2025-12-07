// lib/domain/schema-validator.ts
// Version 3 - Avec détection de TOUS les cas nécessitant confirmation
// ============================================================================
// PRINCIPE : Zéro boîte noire, tout format transformé doit être confirmé
// ============================================================================

import type {
  ZohoColumn,
  ZohoDataType,
  ColumnMapping,
  SchemaValidationResult,
  TypeWarning,
  ResolvableIssue,
  ResolvableIssueType, 
  AutoTransformation,
} from '@/lib/infrastructure/zoho/types';
import type { ImportProfile } from '@/types/profiles';

// ==================== TYPES INTERNES ====================

type FileColumnType = 'string' | 'number' | 'date' | 'duration' | 'email' | 'boolean' | 'unknown';

interface ZohoSchema {
  viewId: string;
  viewName: string;
  columns: ZohoColumn[];
}

interface ValidateSchemaParams {
  fileHeaders: string[];
  sampleData: string[][];
  zohoSchema: ZohoSchema;
  profile?: ImportProfile;  // Profil pour skip les issues connues
}

// ==================== DÉTECTION DES FORMATS ====================

/**
 * Vérifie si une valeur est en notation scientifique
 */
function isScientificNotation(value: string): boolean {
  const trimmed = value.trim();
  // Patterns: 1.5E6, 1.5e6, 1E10, 3.14e-2, etc.
  return /^-?\d+\.?\d*[eE][+-]?\d+$/.test(trimmed);
}

/**
 * Vérifie si une date au format XX/XX/XXXX est ambiguë (jour/mois interchangeables)
 * Une date est ambiguë si les deux premiers nombres sont <= 12
 */
function isAmbiguousDateFormat(value: string): { isAmbiguous: boolean; day?: number; month?: number } {
  const trimmed = value.trim();
  
  // Pattern: DD/MM/YYYY ou MM/DD/YYYY
  const match = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) {
    return { isAmbiguous: false };
  }
  
  const first = parseInt(match[1], 10);
  const second = parseInt(match[2], 10);
  
  // Si les deux sont <= 12, on ne peut pas savoir si c'est jour/mois ou mois/jour
  if (first <= 12 && second <= 12) {
    return { isAmbiguous: true, day: first, month: second };
  }
  
  // Si first > 12, c'est forcément le jour (format DD/MM)
  // Si second > 12, c'est forcément le jour (format MM/DD)
  return { isAmbiguous: false };
}

// ============================================================================
// NOUVEAU : Détection des nombres avec virgule décimale
// ============================================================================

/**
 * Vérifie si une valeur est un nombre avec virgule décimale (format français/européen)
 * Exemples: 1234,56 / 1 234,56 / 1.234,56
 */
function hasDecimalComma(value: string): boolean {
  const trimmed = value.trim();
  
  // Pattern: nombre avec virgule comme séparateur décimal
  // Accepte: 1234,56 | 1 234,56 | 1.234,56 | -1234,56
  // Le pattern vérifie qu'il y a une virgule suivie de 1-2 chiffres (décimales)
  
  // Exclure les cas où la virgule est un séparateur de milliers (1,234,567)
  if (/^\d{1,3}(,\d{3})+$/.test(trimmed)) {
    return false; // C'est un format US avec virgule comme milliers
  }
  
  // Détecter: virgule suivie de 1-4 chiffres en fin de chaîne (décimales)
  return /,\d{1,4}$/.test(trimmed) && /^-?[\d\s.]+,\d{1,4}$/.test(trimmed);
}

/**
 * Analyse une colonne pour détecter les nombres avec virgule décimale
 */
function detectDecimalComma(sampleValues: string[]): {
  hasDecimalComma: boolean;
  samples: string[];
  transformedSamples: string[];
} {
  const samples: string[] = [];
  const transformedSamples: string[] = [];
  
  for (const value of sampleValues) {
    if (!value || value.trim() === '') continue;
    
    if (hasDecimalComma(value) && samples.length < 3) {
      samples.push(value);
      // Transformation: remplacer espaces/points milliers, puis virgule → point
      const transformed = value
        .replace(/\s/g, '')           // Supprimer espaces
        .replace(/\.(?=\d{3})/g, '')  // Supprimer points milliers
        .replace(',', '.');           // Virgule → point
      transformedSamples.push(transformed);
    }
  }
  
  return {
    hasDecimalComma: samples.length > 0,
    samples,
    transformedSamples,
  };
}

// ============================================================================
// NOUVEAU : Détection des durées au format court (HH:mm)
// ============================================================================

/**
 * Vérifie si une valeur est une durée au format HH:mm (sans secondes)
 */
function isShortDuration(value: string): boolean {
  const trimmed = value.trim();
  // Pattern: H:mm ou HH:mm (pas de secondes)
  return /^\d{1,2}:\d{2}$/.test(trimmed);
}

/**
 * Vérifie si une valeur est une durée complète HH:mm:ss
 */
function isFullDuration(value: string): boolean {
  const trimmed = value.trim();
  return /^\d{1,2}:\d{2}:\d{2}$/.test(trimmed);
}

/**
 * Analyse une colonne pour détecter les durées au format court
 */
function detectShortDuration(sampleValues: string[]): {
  hasShortDuration: boolean;
  samples: string[];
  transformedSamples: string[];
} {
  const samples: string[] = [];
  const transformedSamples: string[] = [];
  let hasFullDuration = false;
  
  for (const value of sampleValues) {
    if (!value || value.trim() === '') continue;
    
    // Vérifier si la colonne contient déjà des durées complètes
    if (isFullDuration(value)) {
      hasFullDuration = true;
    }
    
    if (isShortDuration(value) && samples.length < 3) {
      samples.push(value);
      // Transformation: ajouter :00 pour les secondes
      const parts = value.split(':');
      const transformed = `${parts[0].padStart(2, '0')}:${parts[1]}:00`;
      transformedSamples.push(transformed);
    }
  }
  
  // Ne signaler que si TOUTES les durées sont au format court
  // (pas de mélange avec des durées complètes)
  return {
    hasShortDuration: samples.length > 0 && !hasFullDuration,
    samples,
    transformedSamples,
  };
}

// ============================================================================
// NOUVEAU : Détection des espaces comme séparateurs de milliers
// ============================================================================

/**
 * Vérifie si une valeur contient des espaces comme séparateurs de milliers
 * Exemples: 1 234 567 / 12 345
 */
function hasThousandSeparatorSpace(value: string): boolean {
  const trimmed = value.trim();
  // Pattern: chiffres séparés par des espaces (groupes de 3)
  // Accepte: 1 234 | 1 234 567 | 12 345,67
  return /^\d{1,3}(\s\d{3})+([,\.]\d+)?$/.test(trimmed);
}

/**
 * Analyse une colonne pour détecter les espaces séparateurs de milliers
 */
function detectThousandSeparator(sampleValues: string[]): {
  hasThousandSeparator: boolean;
  samples: string[];
  transformedSamples: string[];
} {
  const samples: string[] = [];
  const transformedSamples: string[] = [];
  
  for (const value of sampleValues) {
    if (!value || value.trim() === '') continue;
    
    if (hasThousandSeparatorSpace(value) && samples.length < 3) {
      samples.push(value);
      // Transformation: supprimer les espaces, normaliser la virgule
      const transformed = value
        .replace(/\s/g, '')
        .replace(',', '.');
      transformedSamples.push(transformed);
    }
  }
  
  return {
    hasThousandSeparator: samples.length > 0,
    samples,
    transformedSamples,
  };
}


// ============================================================================
// DÉTECTION DES TRANSFORMATIONS AUTOMATIQUES (🔄 non bloquant)
// ============================================================================

export function detectAutoTransformations(
  fileHeaders: string[],
  sampleData: string[][],
  matchedColumns: ColumnMapping[]
): AutoTransformation[] {
  const transformations: AutoTransformation[] = [];

  fileHeaders.forEach((fileCol, index) => {
    const sampleValues = sampleData
      .slice(0, 100)
      .map(row => row[index] || '')
      .filter(v => v.trim() !== '');

    const mapping = matchedColumns.find(m => m.fileColumn === fileCol);
    if (!mapping || !mapping.isMapped) return;

    const detectedType = detectColumnType(sampleValues);

    // 1. Nombres avec virgule décimale → automatique
    if (mapping.fileType === 'number' || detectedType === 'number') {
      const decimalResult = detectDecimalComma(sampleValues);
      
      if (decimalResult.hasDecimalComma) {
        transformations.push({
          type: 'decimal_comma',
          column: fileCol,
          description: 'Virgule décimale → point (format universel)',
          samples: decimalResult.samples.map((v, i) => ({
            before: v,
            after: decimalResult.transformedSamples[i],
          })),
        });
      }
      
      // Espaces séparateurs de milliers → automatique
      const thousandResult = detectThousandSeparator(sampleValues);
      
      if (thousandResult.hasThousandSeparator && !decimalResult.hasDecimalComma) {
        transformations.push({
          type: 'thousand_separator',
          column: fileCol,
          description: 'Suppression des espaces séparateurs de milliers',
          samples: thousandResult.samples.map((v, i) => ({
            before: v,
            after: thousandResult.transformedSamples[i],
          })),
        });
      }
    }

    // 2. Durées au format court → automatique
    if (mapping.fileType === 'duration' || detectedType === 'duration' || 
        mapping.zohoType === 'DURATION') {
      const durationResult = detectShortDuration(sampleValues);
      
      if (durationResult.hasShortDuration) {
        transformations.push({
          type: 'duration_short',
          column: fileCol,
          description: 'Ajout des secondes (HH:mm → HH:mm:ss)',
          samples: durationResult.samples.map((v, i) => ({
            before: v,
            after: durationResult.transformedSamples[i],
          })),
        });
      }
    }

    // 3. Dates non ambiguës (jour > 12) → automatique
    if (mapping.fileType === 'date' || detectedType === 'date') {
      const nonAmbiguousSamples: Array<{ before: string; after: string }> = [];
      let hasAmbiguous = false;
      
      for (const value of sampleValues) {
        const trimmed = value.trim();
        const match = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
        
        if (match) {
          const first = parseInt(match[1], 10);
          const second = parseInt(match[2], 10);
          const year = match[3];
          
          if (first <= 12 && second <= 12) {
            hasAmbiguous = true;
          } else if (first > 12 && nonAmbiguousSamples.length < 3) {
            // Forcément DD/MM/YYYY
            nonAmbiguousSamples.push({
              before: trimmed,
              after: `${year}-${second.toString().padStart(2, '0')}-${first.toString().padStart(2, '0')}`,
            });
          }
        }
      }
      
      // Seulement si TOUTES les dates sont non-ambiguës
      if (nonAmbiguousSamples.length > 0 && !hasAmbiguous) {
        transformations.push({
          type: 'date_iso',
          column: fileCol,
          description: 'Conversion vers format ISO (YYYY-MM-DD)',
          samples: nonAmbiguousSamples,
        });
      }
    }
  });

  return transformations;
}
// ==================== DÉTECTIONS EXISTANTES (conservées) ====================

/**
 * Analyse une colonne pour détecter si elle contient des dates ambiguës
 */
function hasAmbiguousDates(sampleValues: string[]): { 
  hasAmbiguous: boolean; 
  ambiguousCount: number;
  ambiguousSamples: string[];
} {
  const ambiguousSamples: string[] = [];
  
  for (const value of sampleValues) {
    if (!value || value.trim() === '') continue;
    
    const { isAmbiguous } = isAmbiguousDateFormat(value);
    if (isAmbiguous && !ambiguousSamples.includes(value)) {
      ambiguousSamples.push(value);
      if (ambiguousSamples.length >= 3) break; // Max 3 exemples
    }
  }
  
  return {
    hasAmbiguous: ambiguousSamples.length > 0,
    ambiguousCount: ambiguousSamples.length,
    ambiguousSamples,
  };
}

/**
 * Analyse une colonne pour détecter si elle contient des notations scientifiques
 */
function hasScientificNotation(sampleValues: string[]): {
  hasScientific: boolean;
  scientificSamples: string[];
} {
  const scientificSamples: string[] = [];
  
  for (const value of sampleValues) {
    if (!value || value.trim() === '') continue;
    
    if (isScientificNotation(value) && !scientificSamples.includes(value)) {
      scientificSamples.push(value);
      if (scientificSamples.length >= 3) break;
    }
  }
  
  return {
    hasScientific: scientificSamples.length > 0,
    scientificSamples,
  };
}

// ==================== DÉTECTION DES TYPES ====================

/**
 * Détecte le type d'une valeur à partir d'un échantillon
 */
function detectValueType(value: string): FileColumnType {
  if (!value || value.trim() === '') {
    return 'unknown';
  }
  
  const trimmed = value.trim();
  
  // Email
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    return 'email';
  }
  
  // Notation scientifique → on la traite comme string par défaut (nécessite confirmation)
  if (isScientificNotation(trimmed)) {
    return 'string'; // Par défaut string, l'utilisateur décidera
  }
  
  // Durée (HH:mm ou HH:mm:ss)
  if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(trimmed)) {
    return 'duration';
  }
  
  // Date (formats courants)
  const datePatterns = [
    /^\d{2}\/\d{2}\/\d{4}$/,           // DD/MM/YYYY ou MM/DD/YYYY
    /^\d{4}-\d{2}-\d{2}$/,             // YYYY-MM-DD (ISO)
    /^\d{2}-\d{2}-\d{4}$/,             // DD-MM-YYYY
    /^\d{4}\/\d{2}\/\d{2}$/,           // YYYY/MM/DD
    /^\d{2}\.\d{2}\.\d{4}$/,           // DD.MM.YYYY
  ];
  
  if (datePatterns.some(pattern => pattern.test(trimmed))) {
    return 'date';
  }
  
  // Nombre (avec gestion des séparateurs)
  const numberPatterns = [
    /^-?\d+$/,                          // Entier simple
    /^-?\d+\.\d+$/,                     // Décimal avec point
    /^-?\d+,\d+$/,                      // Décimal avec virgule
    /^-?\d{1,3}([ \s]\d{3})*([,\.]\d+)?$/, // Avec séparateurs milliers
    /^-?\d{1,3}(\.\d{3})*(,\d+)?$/,     // Format européen 1.234,56
    /^-?\d{1,3}(,\d{3})*(\.\d+)?$/,     // Format US 1,234.56
  ];
  
  if (numberPatterns.some(pattern => pattern.test(trimmed))) {
    return 'number';
  }
  
  return 'string';
}

/**
 * Détermine le type dominant d'une colonne à partir d'un échantillon
 */
export function detectColumnType(sampleValues: string[]): FileColumnType {
  const nonEmptyValues = sampleValues.filter(v => v && v.trim() !== '');
  
  if (nonEmptyValues.length === 0) {
    return 'unknown';
  }
  
  const typeCounts: Record<FileColumnType, number> = {
    string: 0,
    number: 0,
    date: 0,
    duration: 0,
    email: 0,
    boolean: 0,
    unknown: 0,
  };
  
  nonEmptyValues.forEach(value => {
    const type = detectValueType(value);
    typeCounts[type]++;
  });
  
  // Trouver le type dominant (au moins 70% des valeurs)
  const total = nonEmptyValues.length;
  const threshold = 0.7;
  
  for (const [type, count] of Object.entries(typeCounts)) {
    if (count / total >= threshold) {
      return type as FileColumnType;
    }
  }
  
  return 'string';
}

// ==================== COMPATIBILITÉ DES TYPES ====================

/**
 * Vérifie si un type de fichier est compatible avec un type Zoho
 */
function isTypeCompatible(fileType: FileColumnType, zohoType: ZohoDataType): boolean {
  const compatibilityMap: Record<FileColumnType, ZohoDataType[]> = {
    string: ['PLAIN', 'MULTI_LINE', 'URL', 'EMAIL', 'NUMBER', 'CURRENCY', 'PERCENT', 'DATE', 'DATE_TIME', 'DATE_AS_DATE', 'DURATION'],
    number: ['NUMBER', 'POSITIVE_NUMBER', 'DECIMAL_NUMBER', 'CURRENCY', 'PERCENT', 'PLAIN'],
    date: ['DATE', 'DATE_TIME', 'DATE_AS_DATE', 'PLAIN'],
    duration: ['DURATION', 'PLAIN', 'NUMBER'],
    email: ['EMAIL', 'PLAIN'],
    boolean: ['PLAIN', 'NUMBER', 'BOOLEAN'],
    unknown: ['PLAIN', 'MULTI_LINE'],
  };
  
  return compatibilityMap[fileType]?.includes(zohoType) || false;
}

/**
 * Détermine si une transformation est nécessaire
 */
function getTransformNeeded(
  fileType: FileColumnType,
  zohoType: ZohoDataType
): 'date_format' | 'number_format' | 'duration_format' | 'trim' | 'none' {
  if (fileType === 'date' && (zohoType === 'DATE' || zohoType === 'DATE_TIME' || zohoType === 'DATE_AS_DATE')) {
    return 'date_format';
  }
  
  if (fileType === 'duration' && zohoType === 'DURATION') {
    return 'duration_format';
  }
  
  if (fileType === 'number' && ['NUMBER', 'CURRENCY', 'PERCENT', 'DECIMAL_NUMBER', 'POSITIVE_NUMBER'].includes(zohoType)) {
    return 'number_format';
  }
  
  if (fileType === 'string') {
    return 'trim';
  }
  
  return 'none';
}

// ==================== MATCHING DE COLONNES ====================

/**
 * Normalise un nom de colonne pour la comparaison
 */
function normalizeColumnName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[\s_-]+/g, '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Calcule un score de similarité entre deux noms de colonnes (0-100)
 */
function calculateMatchScore(fileName: string, zohoName: string): number {
  const normalizedFile = normalizeColumnName(fileName);
  const normalizedZoho = normalizeColumnName(zohoName);
  
  if (normalizedFile === normalizedZoho) {
    return 100;
  }
  
  if (normalizedFile.includes(normalizedZoho) || normalizedZoho.includes(normalizedFile)) {
    const longer = Math.max(normalizedFile.length, normalizedZoho.length);
    const shorter = Math.min(normalizedFile.length, normalizedZoho.length);
    return Math.round((shorter / longer) * 90);
  }
  
  const maxLength = Math.max(normalizedFile.length, normalizedZoho.length);
  if (maxLength === 0) return 0;
  
  let commonChars = 0;
  const fileChars = normalizedFile.split('');
  const zohoChars = [...normalizedZoho];
  
  for (const char of fileChars) {
    const idx = zohoChars.indexOf(char);
    if (idx !== -1) {
      commonChars++;
      zohoChars.splice(idx, 1);
    }
  }
  
  return Math.round((commonChars / maxLength) * 70);
}

/**
 * Trouve la meilleure correspondance Zoho pour une colonne fichier
 */
function findBestMatch(
  fileColumn: string,
  zohoColumns: ZohoColumn[],
  alreadyMatched: Set<string>
): { zohoColumn: ZohoColumn | null; confidence: number } {
  let bestMatch: ZohoColumn | null = null;
  let bestScore = 0;
  
  for (const zohoCol of zohoColumns) {
    if (alreadyMatched.has(zohoCol.columnName)) continue;
    
    const score = calculateMatchScore(fileColumn, zohoCol.columnName);
    
    if (score > bestScore && score >= 60) {
      bestScore = score;
      bestMatch = zohoCol;
    }
  }
  
  return { zohoColumn: bestMatch, confidence: bestScore };
}

// ==================== DÉTECTION DES ISSUES À RÉSOUDRE ====================

/**
 * Génère un ID unique pour une issue
 */
function generateIssueId(): string {
  return `issue_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Détecte tous les problèmes résolubles dans les données
 * ============================================================================
 * VERSION 3 : Détecte TOUS les formats nécessitant confirmation
 * ============================================================================
 */
export function detectResolvableIssues(
  fileHeaders: string[],
  sampleData: string[][],
  matchedColumns: ColumnMapping[],
  profile?: ImportProfile
): ResolvableIssue[] {
  const issues: ResolvableIssue[] = [];
  
  fileHeaders.forEach((fileCol, index) => {
    const sampleValues = sampleData
      .slice(0, 100)
      .map(row => row[index] || '')
      .filter(v => v.trim() !== '');
    
    const mapping = matchedColumns.find(m => m.fileColumn === fileCol);
    const detectedType = detectColumnType(sampleValues);
    
    // ========================================================================
    // 1. Dates ambiguës (DD/MM vs MM/DD)
    // ========================================================================
    if (mapping?.fileType === 'date' || detectedType === 'date') {
      const { hasAmbiguous, ambiguousSamples } = hasAmbiguousDates(sampleValues);
      
      if (hasAmbiguous) {
        // Verifier si le profil connait deja le format pour cette colonne
        const profileColumn = profile?.columns.find(c =>
          c.acceptedNames.some(name =>
            name.toLowerCase().replace(/[^a-z0-9]/g, '') === fileCol.toLowerCase().replace(/[^a-z0-9]/g, '')
          )
        );
        
        let formatKnownInProfile = false;
        if (profileColumn?.config.type === 'date') {
          const dateConfig = profileColumn.config as { dayMonthOrder?: 'dmy' | 'mdy' };
          formatKnownInProfile = !!dateConfig.dayMonthOrder;
        }
        
        if (!formatKnownInProfile) {
          issues.push({
            id: generateIssueId(),
            type: 'ambiguous_date_format',
            column: fileCol,
            message: `Format de date ambigu détecté. Est-ce JJ/MM/AAAA ou MM/JJ/AAAA ?`,
            sampleValues: ambiguousSamples,
            resolved: false,
          });
        } else {
          console.log(`[Schema] Format date connu pour "${fileCol}", skip issue`);
        }
      }
    }
    
    // ========================================================================
    // 2. Notation scientifique (1E6 → 1000000)
    // ========================================================================
    const { hasScientific, scientificSamples } = hasScientificNotation(sampleValues);
    
    if (hasScientific) {
      const convertedExamples = scientificSamples.map(v => {
        const num = parseFloat(v);
        return `${v} → ${num.toLocaleString('fr-FR')}`;
      });
      
      issues.push({
        id: generateIssueId(),
        type: 'scientific_notation',
        column: fileCol,
        message: `Notation scientifique détectée. Ces valeurs seront développées en nombres complets.`,
        sampleValues: convertedExamples,
        resolved: false,
      });
    }
    
   
    
   
    
    // ========================================================================
    // 5. Incompatibilités de type non résolubles automatiquement
    // ========================================================================
    if (mapping && !mapping.isCompatible && mapping.zohoType) {
      const isReallyIncompatible = 
        (mapping.fileType === 'string' && mapping.zohoType === 'NUMBER') ||
        (mapping.fileType === 'date' && mapping.zohoType === 'NUMBER');
      
      if (isReallyIncompatible) {
        issues.push({
          id: generateIssueId(),
          type: 'type_incompatible',
          column: fileCol,
          message: `Type "${mapping.fileType}" incompatible avec Zoho "${mapping.zohoType}". Ignorer cette colonne ?`,
          sampleValues: sampleValues.slice(0, 3),
          resolved: false,
        });
      }
    }
  });
  

 console.log('[detectResolvableIssues] profile:', profile ? profile.name : 'UNDEFINED');
console.log('[detectResolvableIssues] issues count:', issues.length);
issues.forEach(issue => console.log(`  - ${issue.type}: ${issue.column}`));

return issues;
}

// ==================== VALIDATION PRINCIPALE ====================

/**
 * Valide la correspondance entre un fichier et un schéma Zoho
 */
export function validateSchema(params: ValidateSchemaParams): SchemaValidationResult {
  const { fileHeaders, sampleData, zohoSchema } = params;
  
  const matchedColumns: ColumnMapping[] = [];
  const typeWarnings: TypeWarning[] = [];
  const extraColumns: string[] = [];
  const missingRequired: string[] = [];
  const alreadyMatched = new Set<string>();

  // 1. Pour chaque colonne du fichier, trouver la correspondance Zoho
  fileHeaders.forEach((fileCol, index) => {
    const sampleValues = sampleData
      .slice(0, 100)
      .map(row => row[index] || '')
      .filter(v => v.trim() !== '')
      .slice(0, 10);

    const fileType = detectColumnType(sampleValues);
    const { zohoColumn, confidence } = findBestMatch(fileCol, zohoSchema.columns, alreadyMatched);

    if (zohoColumn) {
      alreadyMatched.add(zohoColumn.columnName);
      
      const isCompatible = isTypeCompatible(fileType, zohoColumn.dataType);
      const transformNeeded = getTransformNeeded(fileType, zohoColumn.dataType);

      matchedColumns.push({
        fileColumn: fileCol,
        zohoColumn: zohoColumn.columnName,
        fileType,
        zohoType: zohoColumn.dataType,
        isCompatible,
        isMapped: true,
        isRequired: zohoColumn.isMandatory || false,
        transformNeeded,
        sampleValues,
        confidence,
      });

      if (!isCompatible) {
        typeWarnings.push({
          column: fileCol,
          fileType,
          zohoType: zohoColumn.dataType,
          message: `Type incompatible: fichier "${fileType}" vs Zoho "${zohoColumn.dataType}"`,
          severity: 'warning',
          suggestion: `Vérifiez que les données de "${fileCol}" sont au format attendu`,
        });
      }
    } else {
      extraColumns.push(fileCol);
      
      matchedColumns.push({
        fileColumn: fileCol,
        zohoColumn: null,
        fileType,
        zohoType: null,
        isCompatible: false,
        isMapped: false,
        isRequired: false,
        transformNeeded: 'none',
        sampleValues,
        confidence: 0,
      });
    }
  });

  // 2. Vérifier les colonnes Zoho obligatoires manquantes
  zohoSchema.columns.forEach(zohoCol => {
    if (zohoCol.isMandatory && !alreadyMatched.has(zohoCol.columnName)) {
      missingRequired.push(zohoCol.columnName);
      
      typeWarnings.push({
        column: zohoCol.columnName,
        fileType: 'unknown',
        zohoType: zohoCol.dataType,
        message: `Colonne obligatoire manquante: "${zohoCol.columnName}"`,
        severity: 'error',
      });
    }
  });

  // 3. Détecter les transformations automatiques (🔄 informatif)
  const autoTransformations = detectAutoTransformations(fileHeaders, sampleData, matchedColumns);
  
  // 4. Détecter les problèmes résolubles (⚠️ bloquant)
  const resolvableIssues = detectResolvableIssues(fileHeaders, sampleData, matchedColumns, params.profile);
  console.log('[validateSchema] resolvableIssues:', resolvableIssues.length);
  
  // 5. Calculer le résumé
  const errorCount = typeWarnings.filter(w => w.severity === 'error').length;
  const warningCount = typeWarnings.filter(w => w.severity === 'warning').length;
  const unresolvedIssuesCount = resolvableIssues.filter(i => !i.resolved).length;

  const summary = {
    totalFileColumns: fileHeaders.length,
    totalZohoColumns: zohoSchema.columns.length,
    matchedCount: matchedColumns.filter(m => m.isMapped).length,
    unmatchedCount: extraColumns.length,
    warningCount,
    errorCount,
    resolvableIssuesCount: resolvableIssues.length,
  };

  const isValid = errorCount === 0 && unresolvedIssuesCount === 0;
  const hasWarnings = warningCount > 0 || extraColumns.length > 0;
  // canProceed = false si erreurs OU si des issues non résolues existent
  const canProceed = errorCount === 0 && unresolvedIssuesCount === 0;

   return {
    isValid,
    hasWarnings,
    canProceed,
    matchedColumns,
    missingRequired,
    extraColumns,
    typeWarnings,
    resolvableIssues,
    autoTransformations,  // ← AJOUTER
    summary,
  };
}
