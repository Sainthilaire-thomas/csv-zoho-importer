/**
 * @file lib/domain/verification/matching-detection.ts
 * @description Détection intelligente de la colonne de matching pour vérification/rollback
 */

import type { ZohoColumn } from '@/lib/infrastructure/zoho/types';
import type { ImportProfile } from '@/types/profiles';
import type { SentRow } from './types';

// ==================== TYPES ====================

export interface ColumnMatchingStats {
  columnName: string;
  uniquePercentage: number;
  nonEmptyCount: number;
  totalCount: number;
  isRecommended: boolean;
  source: 'profile' | 'schema' | 'pattern' | 'content';
  reason?: string;
}

export interface MatchingColumnResult {
  column: string | undefined;
  source: 'profile' | 'schema' | 'pattern' | 'content' | 'none';
  confidence: number; // 0-100
  alternatives: ColumnMatchingStats[];
}

// ==================== PATTERNS ====================

/** Patterns de noms typiques pour colonnes uniques (par priorité) */
const UNIQUE_COLUMN_PATTERNS = [
  { pattern: /^id$/i, weight: 100 },
  { pattern: /^_id$/i, weight: 100 },
  { pattern: /num[eé]ro.*quittance/i, weight: 95 },
  { pattern: /quittance/i, weight: 90 },
  { pattern: /^n°/i, weight: 85 },
  { pattern: /num[eé]ro/i, weight: 80 },
  { pattern: /^code$/i, weight: 75 },
  { pattern: /code.*unique/i, weight: 85 },
  { pattern: /ref[eé]rence/i, weight: 70 },
  { pattern: /^ref$/i, weight: 70 },
  { pattern: /matricule/i, weight: 65 },
  { pattern: /identifiant/i, weight: 60 },
  { pattern: /^sku$/i, weight: 60 },
  { pattern: /^uuid$/i, weight: 100 },
];

// ==================== FONCTION PRINCIPALE ====================

/**
 * Trouve la meilleure colonne de matching avec détection intelligente
 * 
 * Priorité :
 * 1. Profil (si matchingColumn défini)
 * 2. Schéma Zoho (colonne isUnique ou AUTO_NUMBER)
 * 3. Patterns de noms
 * 4. Analyse de contenu (100% unique)
 */
export function findBestMatchingColumnEnhanced(
  sentRows: SentRow[],
  options: {
    profile?: ImportProfile;
    zohoSchema?: ZohoColumn[];
  } = {}
): MatchingColumnResult {
  const { profile, zohoSchema } = options;
  const alternatives: ColumnMatchingStats[] = [];

  if (sentRows.length === 0) {
    return { column: undefined, source: 'none', confidence: 0, alternatives: [] };
  }

  const columns = Object.keys(sentRows[0].data);

  // 1. Vérifier le profil
  if (profile?.verificationColumn) {
    const col = profile.verificationColumn;
    if (columns.includes(col) && hasUniqueNonEmptyValues(sentRows, col)) {
      return {
        column: col,
        source: 'profile',
        confidence: 100,
        alternatives: calculateAllStats(sentRows, columns, zohoSchema),
      };
    }
  }

  // 2. Chercher dans le schéma Zoho
  if (zohoSchema) {
    const uniqueCol = zohoSchema.find(
      c => c.isUnique === true || c.dataType === 'AUTO_NUMBER'
    );
    if (uniqueCol && columns.includes(uniqueCol.columnName)) {
      if (hasUniqueNonEmptyValues(sentRows, uniqueCol.columnName)) {
        return {
          column: uniqueCol.columnName,
          source: 'schema',
          confidence: 95,
          alternatives: calculateAllStats(sentRows, columns, zohoSchema),
        };
      }
    }
  }

  // 3. Chercher par patterns de noms
  for (const { pattern, weight } of UNIQUE_COLUMN_PATTERNS) {
    const matchingCol = columns.find(col => pattern.test(col));
    if (matchingCol && hasUniqueNonEmptyValues(sentRows, matchingCol)) {
      return {
        column: matchingCol,
        source: 'pattern',
        confidence: weight,
        alternatives: calculateAllStats(sentRows, columns, zohoSchema),
      };
    }
  }

  // 4. Chercher par contenu (première colonne 100% unique)
  for (const col of columns) {
    if (hasUniqueNonEmptyValues(sentRows, col)) {
      return {
        column: col,
        source: 'content',
        confidence: 50,
        alternatives: calculateAllStats(sentRows, columns, zohoSchema),
      };
    }
  }

  // Aucune colonne trouvée - retourner les stats pour sélection manuelle
  return {
    column: undefined,
    source: 'none',
    confidence: 0,
    alternatives: calculateAllStats(sentRows, columns, zohoSchema),
  };
}

// ==================== HELPERS ====================

/**
 * Vérifie si une colonne a des valeurs 100% uniques et non vides
 */
function hasUniqueNonEmptyValues(rows: SentRow[], column: string): boolean {
  const values = rows
    .map(r => r.data[column])
    .filter(v => v !== undefined && v !== null && String(v).trim() !== '');
  
  if (values.length === 0) return false;
  if (values.length < rows.length * 0.9) return false; // Au moins 90% non vides
  
  const uniqueValues = new Set(values.map(v => String(v).trim().toLowerCase()));
  return uniqueValues.size === values.length;
}

/**
 * Calcule le pourcentage d'unicité d'une colonne
 */
function calculateUniqueness(rows: SentRow[], column: string): { percentage: number; nonEmpty: number } {
  const values = rows
    .map(r => r.data[column])
    .filter(v => v !== undefined && v !== null && String(v).trim() !== '');
  
  if (values.length === 0) return { percentage: 0, nonEmpty: 0 };
  
  const uniqueValues = new Set(values.map(v => String(v).trim().toLowerCase()));
  return {
    percentage: Math.round((uniqueValues.size / values.length) * 100),
    nonEmpty: values.length,
  };
}

/**
 * Calcule les statistiques de matching pour toutes les colonnes
 */
function calculateAllStats(
  rows: SentRow[],
  columns: string[],
  zohoSchema?: ZohoColumn[]
): ColumnMatchingStats[] {
  return columns.map(col => {
    const { percentage, nonEmpty } = calculateUniqueness(rows, col);
    
    // Déterminer la source et si recommandé
    let source: ColumnMatchingStats['source'] = 'content';
    let isRecommended = false;
    let reason: string | undefined;

    // Vérifier schéma Zoho
    const schemaCol = zohoSchema?.find(c => c.columnName === col);
    if (schemaCol?.isUnique || schemaCol?.dataType === 'AUTO_NUMBER') {
      source = 'schema';
      isRecommended = percentage === 100;
      reason = schemaCol.dataType === 'AUTO_NUMBER' ? 'Auto-numérotation Zoho' : 'Marqué unique dans Zoho';
    }

    // Vérifier patterns
    const matchedPattern = UNIQUE_COLUMN_PATTERNS.find(p => p.pattern.test(col));
    if (matchedPattern && source !== 'schema') {
      source = 'pattern';
      if (percentage === 100) {
        isRecommended = true;
        reason = 'Nom typique d\'identifiant';
      }
    }

    // Recommander si 100% unique même sans pattern
    if (percentage === 100 && !isRecommended) {
      isRecommended = true;
      reason = 'Valeurs 100% uniques';
    }

    return {
      columnName: col,
      uniquePercentage: percentage,
      nonEmptyCount: nonEmpty,
      totalCount: rows.length,
      isRecommended,
      source,
      reason,
    };
  }).sort((a, b) => {
    // Trier : recommandés d'abord, puis par % unicité
    if (a.isRecommended !== b.isRecommended) return a.isRecommended ? -1 : 1;
    return b.uniquePercentage - a.uniquePercentage;
  });
}

/**
 * Formate le résultat pour affichage
 */
export function formatMatchingSource(source: MatchingColumnResult['source']): string {
  switch (source) {
    case 'profile': return 'Défini dans le profil';
    case 'schema': return 'Détecté via schéma Zoho';
    case 'pattern': return 'Détecté par le nom';
    case 'content': return 'Détecté par le contenu';
    case 'none': return 'Non détecté';
  }
}
