/**
 * @file lib/domain/verification/types.ts
 * @description Types pour la vérification post-import
 */

import type { ImportMode } from '@/types';

// ==================== CONFIGURATION ====================

/**
 * Configuration pour la vérification post-import
 */
export interface VerificationConfig {
  /** Mode d'import utilisé */
  mode: ImportMode;
  /** Colonne utilisée pour le matching (obligatoire en mode updateadd, auto-détectée en append) */
  matchingColumn?: string;
  /** Nombre de lignes à vérifier */
  sampleSize: number;
  /** ID du workspace Zoho */
  workspaceId: string;
  /** ID de la vue/table Zoho */
  viewId: string;
  /** Délai avant lecture (ms) pour laisser Zoho indexer */
  delayBeforeRead?: number;
}

// ==================== DONNÉES ====================

/**
 * Ligne envoyée à Zoho (échantillon)
 */
export interface SentRow {
  /** Index de la ligne dans le fichier source (1-based) */
  index: number;
  /** Données de la ligne (clé = nom colonne) */
  data: Record<string, string>;
}

/**
 * Données comparatives d'une ligne (envoyé vs reçu)
 */
export interface ComparedRow {
  /** Index de la ligne */
  rowIndex: number;
  /** Valeur de la colonne de matching */
  matchingValue: string;
  /** Ligne trouvée dans Zoho ? */
  found: boolean;
  /** Comparaison par colonne */
  columns: ComparedColumn[];
}

/**
 * Comparaison d'une colonne
 */
export interface ComparedColumn {
  /** Nom de la colonne */
  name: string;
  /** Valeur envoyée (brute) */
  sentValue: string;
  /** Valeur normalisée (après transformation) */
  normalizedValue: string;
  /** Valeur reçue de Zoho */
  receivedValue: string;
  /** Les valeurs correspondent ? */
  match: boolean;
  /** Type d'anomalie si différent */
  anomalyType?: AnomalyType;
}

// ==================== ANOMALIES ====================

/**
 * Types d'anomalies détectables
 */
export type AnomalyType =
  | 'value_different'   // Valeur complètement différente
  | 'value_missing'     // Valeur présente dans source mais vide dans Zoho
  | 'row_missing'       // Ligne non trouvée dans Zoho
  | 'date_inverted'     // Jour/mois inversés (05/03 → 03/05)
  | 'datetime_truncated' // Heure perdue (datetime → date)
  | 'spaces_trimmed'    // Espaces supprimés par Zoho  ← NOUVEAU
  | 'truncated'         // Texte tronqué
  | 'rounded'           // Nombre arrondi
  | 'encoding_issue';   // Problème d'encodage (accents)

/**
 * Niveau de gravité d'une anomalie
 */
export type AnomalyLevel = 'critical' | 'warning';

/**
 * Anomalie détectée lors de la vérification
 */
export interface Anomaly {
  /** Niveau de gravité */
  level: AnomalyLevel;
  /** Type d'anomalie */
  type: AnomalyType;
  /** Index de la ligne concernée */
  rowIndex: number;
  /** Nom de la colonne concernée */
  column: string;
  /** Valeur envoyée */
  sentValue: string;
  /** Valeur reçue */
  receivedValue: string;
  /** Message descriptif */
  message: string;
}

// ==================== RÉSULTAT ====================

/**
 * Résultat de la vérification post-import
 */
export interface VerificationResult {
  /** Vérification réussie (aucune anomalie critique) */
  success: boolean;
  /** Vérification effectuée */
  performed: boolean;
  /** Nombre de lignes vérifiées */
  checkedRows: number;
  /** Nombre de lignes trouvées dans Zoho */
  matchedRows: number;
  /** Liste des anomalies détectées */
  anomalies: Anomaly[];
  /** Durée de la vérification (ms) */
  duration: number;
  /** Résumé par niveau */
  summary: {
    critical: number;
    warning: number;
  };
  /** Message d'erreur si échec */
  errorMessage?: string;
  /** Colonne utilisée pour le matching (auto-détectée ou configurée) */
  matchingColumn?: string;
  /** Données comparatives détaillées */
  comparedRows?: ComparedRow[];
}

// ==================== CONSTANTES ====================

/**
 * Résultat vide (vérification non effectuée)
 */
export const EMPTY_VERIFICATION_RESULT: VerificationResult = {
  success: true,
  performed: false,
  checkedRows: 0,
  matchedRows: 0,
  anomalies: [],
  duration: 0,
  summary: { critical: 0, warning: 0 },
};

// ==================== HELPERS ====================

/**
 * Retourne le niveau de gravité pour un type d'anomalie
 */
export function getAnomalyLevel(type: AnomalyType): AnomalyLevel {
  switch (type) {
    case 'value_different':
    case 'value_missing':
    case 'row_missing':
    case 'date_inverted':
      return 'critical';
    case 'datetime_truncated':  // ← NOUVEAU
    case 'truncated':
      case 'spaces_trimmed': 
    case 'rounded':
    case 'encoding_issue':
      return 'warning';
    default:
      return 'critical';
  }
}

/**
 * Génère un message descriptif pour une anomalie
 */
export function getAnomalyMessage(type: AnomalyType, column: string): string {
  switch (type) {
    case 'value_different':
      return `Valeur différente pour "${column}"`;
    case 'value_missing':
      return `Valeur manquante pour "${column}"`;
    case 'row_missing':
      return 'Ligne non trouvée dans Zoho';
    case 'date_inverted':
      return `Date inversée (jour/mois) pour "${column}"`;
    case 'datetime_truncated':  // ← NOUVEAU
      return `Heure ignorée pour "${column}" (le fichier contient une date+heure, mais la colonne Zoho est de type DATE sans heure)`;
    case 'truncated':
      return `Texte tronqué pour "${column}"`;
    case 'rounded':
      return `Nombre arrondi pour "${column}"`;
      case 'spaces_trimmed':
  return `Espaces modifiés pour "${column}" (Zoho supprime les espaces autour des virgules/ponctuations)`;
    case 'encoding_issue':
      return `Problème d'encodage pour "${column}"`;
    default:
      return `Anomalie pour "${column}"`;
  }
}

/**
 * Crée une anomalie avec tous les champs remplis
 */
export function createAnomaly(
  type: AnomalyType,
  rowIndex: number,
  column: string,
  sentValue: string,
  receivedValue: string
): Anomaly {
  return {
    level: getAnomalyLevel(type),
    type,
    rowIndex,
    column,
    sentValue,
    receivedValue,
    message: getAnomalyMessage(type, column),
  };
}
