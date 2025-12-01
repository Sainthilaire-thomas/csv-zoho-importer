// lib/domain/schema-validator.ts
// Version 2 - Avec détection des cas ambigus

import type {
  ZohoColumn,
  ZohoDataType,
  ColumnMapping,
  SchemaValidationResult,
  TypeWarning,
  ResolvableIssue,
  ResolvableIssueType,
} from '@/lib/infrastructure/zoho/types';

// ==================== TYPES INTERNES ====================

type FileColumnType = 'string' | 'number' | 'date' | 'email' | 'boolean' | 'unknown';

interface ZohoSchema {
  viewId: string;
  viewName: string;
  columns: ZohoColumn[];
}

interface ValidateSchemaParams {
  fileHeaders: string[];
  sampleData: string[][];
  zohoSchema: ZohoSchema;
}

// ==================== DÉTECTION DES CAS AMBIGUS ====================

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
    string: ['PLAIN', 'MULTI_LINE', 'URL', 'EMAIL', 'NUMBER', 'CURRENCY', 'PERCENT', 'DATE', 'DATE_TIME'],
    number: ['NUMBER', 'POSITIVE_NUMBER', 'DECIMAL_NUMBER', 'CURRENCY', 'PERCENT', 'PLAIN'],
    date: ['DATE', 'DATE_TIME', 'PLAIN'],
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
): 'date_format' | 'number_format' | 'trim' | 'none' {
  if (fileType === 'date' && (zohoType === 'DATE' || zohoType === 'DATE_TIME')) {
    return 'date_format';
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
 */
export function detectResolvableIssues(
  fileHeaders: string[],
  sampleData: string[][],
  matchedColumns: ColumnMapping[]
): ResolvableIssue[] {
  const issues: ResolvableIssue[] = [];
  
  fileHeaders.forEach((fileCol, index) => {
    const sampleValues = sampleData
      .slice(0, 100)
      .map(row => row[index] || '')
      .filter(v => v.trim() !== '');
    
    const mapping = matchedColumns.find(m => m.fileColumn === fileCol);
    
    // 1. Vérifier les dates ambiguës
    if (mapping?.fileType === 'date' || detectColumnType(sampleValues) === 'date') {
      const { hasAmbiguous, ambiguousSamples } = hasAmbiguousDates(sampleValues);
      
      if (hasAmbiguous) {
        issues.push({
          id: generateIssueId(),
          type: 'ambiguous_date_format',
          column: fileCol,
          message: `Format de date ambigu détecté. Est-ce JJ/MM/AAAA ou MM/JJ/AAAA ?`,
          sampleValues: ambiguousSamples,
          resolved: false,
        });
      }
    }
    
    // 2. Vérifier la notation scientifique
    const { hasScientific, scientificSamples } = hasScientificNotation(sampleValues);
    
    if (hasScientific) {
      // Convertir la notation en nombre pour montrer le résultat
      const convertedExamples = scientificSamples.map(v => {
        const num = parseFloat(v);
        return `${v} → ${num.toLocaleString('fr-FR')}`;
      });
      
      issues.push({
        id: generateIssueId(),
        type: 'scientific_notation',
        column: fileCol,
        message: `Notation scientifique détectée. Interpréter comme nombre ou garder comme texte ?`,
        sampleValues: convertedExamples,
        resolved: false,
      });
    }
    
    // 3. Vérifier les incompatibilités de type non résolubles automatiquement
    if (mapping && !mapping.isCompatible && mapping.zohoType) {
      // Seulement si c'est vraiment incompatible (pas juste un warning)
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

  // 3. Détecter les problèmes résolubles
  const resolvableIssues = detectResolvableIssues(fileHeaders, sampleData, matchedColumns);
  
  // 4. Calculer le résumé
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
    summary,
  };
}
