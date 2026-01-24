// lib/hooks/use-csv-parser.ts
'use client';

import { useCallback } from 'react';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import { ExcelColumnMeta } from '@/types/profiles';

// =============================================================================
// TYPES
// =============================================================================

export interface ParseResult {
  data: Record<string, unknown>[];
  headers: string[];
  totalRows: number;
  fileName: string;
  fileType: 'csv' | 'xlsx' | 'xls';
  
  // NOUVEAU: Métadonnées Excel par colonne (absent pour CSV)
  columnMetadata?: Record<string, ExcelColumnMeta>;
}

export interface ParseError {
  message: string;
  details?: string[];
}

// =============================================================================
// HOOK PRINCIPAL
// =============================================================================

export function useCsvParser() {
  const parseFile = useCallback(async (file: File): Promise<ParseResult> => {
    const fileName = file.name;
    const extension = fileName.split('.').pop()?.toLowerCase();
    
    console.log('Parsing fichier:', fileName, 'extension:', extension);

    if (extension === 'csv') {
      return parseCsv(file);
    } else if (extension === 'xlsx' || extension === 'xls') {
      return parseExcel(file);
    } else {
      throw new Error(`Format non supporté: .${extension}`);
    }
  }, []);

  return { parseFile };
}

// =============================================================================
// PARSING CSV
// =============================================================================

async function parseCsv(file: File): Promise<ParseResult> {
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, unknown>>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim(),
      transform: (value) => value.trim(),
      complete: (results) => {
        console.log('CSV parse complete, rows:', results.data.length);
        
        if (results.errors.length > 0) {
          const criticalErrors = results.errors.filter(
            (e) => e.type === 'Quotes' || e.type === 'FieldMismatch'
          );
          if (criticalErrors.length > 0) {
            reject(new Error(`Erreur CSV: ${criticalErrors[0].message}`));
            return;
          }
        }

        const headers = results.meta.fields || [];
        
        resolve({
          data: results.data,
          headers,
          totalRows: results.data.length,
          fileName: file.name,
          fileType: 'csv',
          // Pas de columnMetadata pour CSV
        });
      },
      error: (error) => {
        reject(new Error(`Erreur parsing CSV: ${error.message}`));
      },
    });
  });
}

// =============================================================================
// PARSING EXCEL AVEC EXTRACTION DES MÉTADONNÉES
// =============================================================================

async function parseExcel(file: File): Promise<ParseResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      console.log('Fichier Excel chargé, début du parsing...');

      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, {
          type: 'array',
          cellDates: false,  // Garder les dates comme nombres pour extraire le format
          cellNF: true,      // Conserver le format de nombre
          cellText: true,    // Générer le texte formaté (propriété 'w')
        });

        const firstSheetName = workbook.SheetNames[0];
        console.log('Feuille:', firstSheetName);

        const worksheet = workbook.Sheets[firstSheetName];

        // Extraire les métadonnées AVANT la conversion
        const columnMetadata = extractColumnMetadata(worksheet);
        console.log('Métadonnées Excel extraites:', Object.keys(columnMetadata).length, 'colonnes');

        // Extraire les données avec les valeurs FORMATÉES (comme l'utilisateur les voit)
        const jsonData = extractFormattedData(worksheet);
        console.log('Excel parse complete, rows:', jsonData.length);

        const headers = jsonData.length > 0 ? Object.keys(jsonData[0]) : [];

        resolve({
          data: jsonData,
          headers,
          totalRows: jsonData.length,
          fileName: file.name,
          fileType: file.name.endsWith('.xlsx') ? 'xlsx' : 'xls',
          columnMetadata,
        });
      } catch (error) {
        console.error('Erreur parsing Excel:', error);
        reject(new Error(`Erreur parsing Excel: ${error instanceof Error ? error.message : 'Erreur inconnue'}`));
      }
    };

    reader.onerror = () => {
      reject(new Error('Erreur lecture du fichier'));
    };

    reader.readAsArrayBuffer(file);
  });
}

/**
 * Extrait les données en utilisant la bonne interprétation selon le format Excel
 * 
 * Logique :
 * - Si z contient un format date locale-aware (m/d/yy, etc.) → c'est une date, on convertit v en DD/MM/YYYY
 * - Si z est "General" → c'est un nombre normal (montant, ID), on garde v
 * - Sinon → on utilise w si disponible, sinon v
 */
function extractFormattedData(worksheet: XLSX.WorkSheet): Record<string, unknown>[] {
  const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
  const data: Record<string, unknown>[] = [];

  // Extraire les headers (première ligne)
  const headers: string[] = [];
  for (let col = range.s.c; col <= range.e.c; col++) {
    const cellAddress = XLSX.utils.encode_cell({ r: range.s.r, c: col });
    const cell = worksheet[cellAddress];
    headers.push(cell?.v?.toString().trim() || `Column${col}`);
  }

  // Extraire les données (lignes suivantes)
  for (let row = range.s.r + 1; row <= range.e.r; row++) {
    const rowData: Record<string, unknown> = {};
    let hasData = false;

    for (let col = range.s.c; col <= range.e.c; col++) {
      const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
      const cell = worksheet[cellAddress];
      const header = headers[col - range.s.c];

      if (cell) {
        let value: unknown;
        const format = (cell.z || 'General').toLowerCase();

        if (cell.t === 'n' && isLocaleAwareDateFormat(format)) {
          // Format date "locale-aware" (m/d/yy, etc.)
          // xlsx génère w incorrectement, on convertit v nous-mêmes en français DD/MM/YYYY
          value = excelSerialToDateString(cell.v as number, format);
        } else if (cell.t === 'n' && format === 'general') {
          // Format General = nombre normal (montant, ID, etc.)
          value = cell.v;
        } else if (cell.w !== undefined && cell.w !== '') {
          // Format explicite avec w disponible et fiable
          value = cell.w;
        } else {
          // Fallback : valeur brute
          value = cell.v ?? '';
        }

        rowData[header] = value;
        if (value !== '') hasData = true;
      } else {
        rowData[header] = '';
      }
    }

    // Ne pas ajouter les lignes complètement vides
    if (hasData) {
      data.push(rowData);
    }
  }

  return data;
}

/**
 * Détecte si un format Excel est un format de date "locale-aware"
 * Ces formats s'adaptent aux paramètres régionaux de Windows,
 * mais xlsx les interprète toujours comme américains (incorrectement)
 */
function isLocaleAwareDateFormat(format: string): boolean {
  // Formats de date locale-aware générés par xlsx
  const localeAwareFormats = [
    'm/d/yy',
    'm/d/yy h:mm',
    'm/d/yyyy',
    'm/d/yyyy h:mm',
    'm/d/yyyy h:mm:ss',
    'mm/dd/yy',
    'mm/dd/yyyy',
    'd/m/yy',
    'd/m/yyyy',
    'dd/mm/yy',
    'dd/mm/yyyy',
  ];
  
  return localeAwareFormats.includes(format);
}


/**
 * Convertit un nombre sériel Excel en string de date format français DD/MM/YYYY
 * 
 * Pour les formats "locale-aware", on force toujours le format français
 * car l'application est destinée à un contexte français.
 */
function excelSerialToDateString(serial: number, format: string): string {
  // Séparer la partie entière (jours) et décimale (heure)
  const days = Math.floor(serial);
  const timeFraction = serial - days;
  
  // Conversion Excel → Date JavaScript
  // Excel: jour 1 = 1 janvier 1900
  // Excel a un bug historique : il pense que 1900 était bissextile
  const excelEpoch = new Date(1899, 11, 30); // 30 déc 1899
  const date = new Date(excelEpoch.getTime() + days * 24 * 60 * 60 * 1000);
  
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  
  // Partie heure si présente dans le format
  let timeStr = '';
  const hasTimeInFormat = /h/i.test(format);
  
  if (timeFraction > 0.0001 && hasTimeInFormat) {
    const totalSeconds = Math.round(timeFraction * 24 * 60 * 60);
    const hours = Math.floor(totalSeconds / 3600).toString().padStart(2, '0');
    const minutes = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, '0');
    const seconds = (totalSeconds % 60).toString().padStart(2, '0');
    timeStr = ` ${hours}:${minutes}:${seconds}`;
  }
  
  // TOUJOURS format français DD/MM/YYYY (contexte application française)
  return `${day}/${month}/${year}${timeStr}`;
}

/**
 * Convertit un nombre sériel Excel en string de temps (durée ou heure)
 */
function excelSerialToTimeString(serial: number): string {
  // La partie décimale représente la fraction du jour
  const fraction = serial < 1 ? serial : serial - Math.floor(serial);
  const totalSeconds = Math.round(fraction * 24 * 60 * 60);
  
  const hours = Math.floor(totalSeconds / 3600).toString().padStart(2, '0');
  const minutes = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, '0');
  const seconds = (totalSeconds % 60).toString().padStart(2, '0');
  
  return `${hours}:${minutes}:${seconds}`;
}

// =============================================================================
// EXTRACTION DES MÉTADONNÉES EXCEL
// =============================================================================

/**
 * Extrait les métadonnées de format de chaque colonne du worksheet
 */
function extractColumnMetadata(worksheet: XLSX.WorkSheet): Record<string, ExcelColumnMeta> {
  const metadata: Record<string, ExcelColumnMeta> = {};
  
  // Obtenir la plage de cellules
  const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
  
  // Pour chaque colonne
  for (let col = range.s.c; col <= range.e.c; col++) {
    // Obtenir le nom de la colonne depuis la première ligne (header)
    const headerCell = worksheet[XLSX.utils.encode_cell({ r: range.s.r, c: col })];
    const columnName = headerCell?.v?.toString() || `Column${col}`;
    
    // Collecter les infos de toutes les cellules de cette colonne (sauf header)
    const cellInfos: Array<{ type: string; format?: string; formatted?: string }> = [];
    
    for (let row = range.s.r + 1; row <= range.e.r; row++) {
      const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
      const cell = worksheet[cellAddress];

      
      
      if (cell) {
        cellInfos.push({
          type: cell.t || 's',           // Type: s=string, n=number, d=date, b=boolean
          format: cell.z,                 // Format de nombre/date
          formatted: cell.w,              // Valeur formatée (ce que l'utilisateur voit)
        });
      }
    }
    
    // Analyser les informations collectées
    metadata[columnName] = analyzeColumnCells(cellInfos);
  }
  
  return metadata;
}

/**
 * Analyse les cellules d'une colonne pour déterminer le type/format dominant
 */
function analyzeColumnCells(
  cellInfos: Array<{ type: string; format?: string; formatted?: string }>
): ExcelColumnMeta {
  if (cellInfos.length === 0) {
    return {
      dominantCellType: 'string',
      formattedSamples: [],
      confidence: 'low',
    };
  }
  
  // Compter les types
  const typeCounts: Record<string, number> = {};
  const formatCounts: Record<string, number> = {};
  const formattedSamples: string[] = [];
  
  for (const info of cellInfos) {
    // Compter les types
    const mappedType = mapExcelType(info.type);
    typeCounts[mappedType] = (typeCounts[mappedType] || 0) + 1;
    
    // Compter les formats (si présent)
    if (info.format) {
      formatCounts[info.format] = (formatCounts[info.format] || 0) + 1;
    }
    
    // Collecter des échantillons formatés (max 5, uniques)
    if (info.formatted && formattedSamples.length < 5 && !formattedSamples.includes(info.formatted)) {
      formattedSamples.push(info.formatted);
    }
  }
  
  // Déterminer le type dominant
  const dominantType = Object.entries(typeCounts)
    .sort((a, b) => b[1] - a[1])[0];
  
  const dominantTypePercentage = dominantType ? (dominantType[1] / cellInfos.length) * 100 : 0;
  
  // Déterminer le format dominant
  const dominantFormat = Object.entries(formatCounts)
    .sort((a, b) => b[1] - a[1])[0];
  
  const dominantFormatPercentage = dominantFormat ? (dominantFormat[1] / cellInfos.length) * 100 : 0;
  
  // Calculer la confiance
  let confidence: 'high' | 'medium' | 'low' = 'low';
  if (dominantTypePercentage >= 90 && dominantFormatPercentage >= 80) {
    confidence = 'high';
  } else if (dominantTypePercentage >= 70 || dominantFormatPercentage >= 60) {
    confidence = 'medium';
  }
  
  // Normaliser le format Excel vers notre système
  const rawFormat = dominantFormat?.[0];
  const normalizedFormat = rawFormat ? normalizeExcelFormat(rawFormat) : undefined;
  
  return {
    dominantCellType: (dominantType?.[0] as ExcelColumnMeta['dominantCellType']) || 'string',
    rawExcelFormat: rawFormat,
    normalizedFormat,
    formattedSamples,
    confidence,
  };
}

/**
 * Mappe le code de type Excel vers notre système
 */
function mapExcelType(excelType: string): ExcelColumnMeta['dominantCellType'] {
  switch (excelType) {
    case 's': return 'string';
    case 'n': return 'number';  // Note: les dates Excel sont aussi 'n'
    case 'd': return 'date';
    case 'b': return 'boolean';
    default: return 'string';
  }
}

/**
 * Normalise un format Excel vers notre système de formats
 */
function normalizeExcelFormat(excelFormat: string): string | undefined {
  const formatLower = excelFormat.toLowerCase();
  
  // Formats de date
  if (formatLower.includes('dd') && formatLower.includes('mm') && formatLower.includes('yy')) {
    // Déterminer l'ordre jour/mois
    const ddIndex = formatLower.indexOf('dd');
    const mmIndex = formatLower.indexOf('mm');
    
    if (ddIndex < mmIndex) {
      return 'DD/MM/YYYY';  // Format européen
    } else {
      return 'MM/DD/YYYY';  // Format américain
    }
  }
  
  // Format ISO
  if (formatLower.includes('yyyy-mm-dd') || formatLower.includes('yyyy/mm/dd')) {
    return 'YYYY-MM-DD';
  }
  
  // Formats de durée/heure
  if (formatLower.includes('hh') && formatLower.includes('mm') && formatLower.includes('ss')) {
    return 'HH:mm:ss';
  }
  if (formatLower.includes('hh') && formatLower.includes('mm') && !formatLower.includes('ss')) {
    return 'HH:mm';
  }
  
  // Formats numériques
  if (formatLower.includes('#') || formatLower.includes('0')) {
    // Détecter le séparateur décimal
    if (excelFormat.includes(',') && !excelFormat.includes('.')) {
      return 'fr';  // Virgule décimale (français)
    }
    if (excelFormat.includes('.') && !excelFormat.includes(',')) {
      return 'us';  // Point décimal (US)
    }
    // Format avec séparateur de milliers
    if (excelFormat.includes(' ')) {
      return 'fr';  // Espace comme séparateur de milliers = français
    }
  }
  
  return undefined;
}
