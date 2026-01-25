/**
 * @file lib/domain/verification/compare.ts
 * @description Logique de comparaison des données envoyées vs reçues
 *
 * Compare les données envoyées à Zoho avec ce qui a été réellement stocké
 * pour détecter les anomalies.
 *
 * Sprint 4 - Mission 010 : Support Bulk API async pour grosses tables
 * Sprint 3 - Mission 012 : Support stratégie RowID pour tables volumineuses
 */

import type {
  VerificationConfig,
  SentRow,
  VerificationResult,
  Anomaly,
  AnomalyType,
  ComparedRow,
  ComparedColumn,
  VerificationStrategy,
} from './types';
import { createAnomaly, EMPTY_VERIFICATION_RESULT } from './types';

// ==================== CONSTANTES ====================

/** Délai par défaut avant lecture (indexation Zoho) */
const DEFAULT_DELAY_MS = 2000;

/** Longueur max avant de considérer une troncature possible */
const TRUNCATION_THRESHOLD = 250;

// ==================== CACHE ====================

/**
 * Cache pour les noms de tables (évite les appels répétés)
 */
const tableNameCache = new Map<string, string>();

// ==================== STRATÉGIE (Mission 012) ====================

/**
 * Détermine la stratégie de vérification selon le mode d'import
 * - rowid: Pour APPEND, TRUNCATEADD, ONLYADD (lignes nouvelles)
 * - matching_key: Pour UPDATEADD, DELETEUPSERT (lignes existantes modifiées)
 */
export function getVerificationStrategy(
  config: VerificationConfig
): VerificationStrategy {
  // Si explicitement défini, utiliser cette stratégie
  if (config.verificationStrategy) {
    return config.verificationStrategy;
  }

  // Si on a un maxRowIdBeforeImport, on peut utiliser RowID
  if (config.maxRowIdBeforeImport !== undefined && config.tableName) {
    // Modes UPDATE nécessitent matching_key car les lignes existantes sont modifiées
    if (config.mode === 'updateadd' || config.mode === 'deleteupsert') {
      return 'matching_key';
    }
    // Autres modes : RowID est plus performant
    return 'rowid';
  }

  // Fallback : matching_key (comportement historique)
  return 'matching_key';
}

// ==================== FONCTION PRINCIPALE ====================

/**
 * Effectue la vérification post-import
 *
 * @param sentRows - Lignes envoyées à Zoho (échantillon)
 * @param config - Configuration de vérification
 * @returns Résultat de la vérification avec anomalies détectées
 */
export async function verifyImport(
  sentRows: SentRow[],
  config: VerificationConfig
): Promise<VerificationResult> {
  const startTime = Date.now();

  // Vérifications préliminaires
  if (!sentRows || sentRows.length === 0) {
    return {
      ...EMPTY_VERIFICATION_RESULT,
      performed: true,
      errorMessage: 'Aucune ligne à vérifier',
    };
  }

  try {
    // 1. Attendre l'indexation Zoho
    const delay = config.delayBeforeRead ?? DEFAULT_DELAY_MS;
    await sleep(delay);

    // 2. Déterminer la stratégie
    const strategy = getVerificationStrategy(config);
    console.log('[Verification] Strategy:', strategy);

    // 3. Trouver la colonne de matching (toujours utile pour comparer)
    const matchingColumn = config.matchingColumn || findBestMatchingColumn(sentRows);
    console.log('[Verification] Using matching column:', matchingColumn);

    // 4. Récupérer les données depuis Zoho selon la stratégie
    const receivedRows = await fetchRowsFromZoho(sentRows, config, matchingColumn, strategy);

    if (!receivedRows || receivedRows.length === 0) {
      return {
        success: false,
        performed: true,
        checkedRows: sentRows.length,
        matchedRows: 0,
        anomalies: sentRows.map((row) =>
          createAnomaly('row_missing', row.index, '', '', '')
        ),
        duration: Date.now() - startTime,
        summary: { critical: sentRows.length, warning: 0 },
        errorMessage: 'Aucune ligne trouvée dans Zoho',
        matchingColumn,
      };
    }

    // 5. Comparer les données et construire le détail
    const { anomalies, comparedRows } = compareRowsDetailed(
      sentRows,
      receivedRows,
      config,
      matchingColumn,
      strategy
    );

    // 6. Construire le résultat
    const summary = {
      critical: anomalies.filter((a) => a.level === 'critical').length,
      warning: anomalies.filter((a) => a.level === 'warning').length,
    };

    return {
      success: summary.critical === 0,
      performed: true,
      checkedRows: sentRows.length,
      matchedRows: comparedRows.filter(r => r.found).length,
      anomalies,
      duration: Date.now() - startTime,
      summary,
      matchingColumn,
      comparedRows,
    };
  } catch (error) {
    console.error('[Verification] Error:', error);
    return {
      ...EMPTY_VERIFICATION_RESULT,
      performed: true,
      success: false,
      duration: Date.now() - startTime,
      errorMessage: error instanceof Error ? error.message : 'Erreur de vérification',
    };
  }
}

// ==================== RÉCUPÉRATION DONNÉES ====================

/**
 * Récupère les lignes depuis Zoho pour comparaison
 * Supporte 2 stratégies :
 * - rowid: Utilise l'API verify-by-rowid (rapide sur grosses tables)
 * - matching_key: Utilise l'API verify-data avec WHERE IN (comportement existant)
 */
async function fetchRowsFromZoho(
  sentRows: SentRow[],
  config: VerificationConfig,
  matchingColumn: string | undefined,
  strategy: VerificationStrategy
): Promise<Record<string, unknown>[]> {

  // ─────────────────────────────────────────────────────────────────────────
  // STRATÉGIE ROWID (Mission 012) - Pour APPEND, TRUNCATEADD, ONLYADD
  // ─────────────────────────────────────────────────────────────────────────
  if (strategy === 'rowid' && config.maxRowIdBeforeImport !== undefined && config.tableName) {
    console.log('[Verification] Using RowID strategy');
    console.log('[Verification] maxRowIdBeforeImport:', config.maxRowIdBeforeImport);
    console.log('[Verification] tableName:', config.tableName);

    try {
      const params = new URLSearchParams({
        workspaceId: config.workspaceId,
        tableName: config.tableName,
        action: 'getAfter',
        minRowId: String(config.maxRowIdBeforeImport),
        limit: String(config.sampleSize * 2),
      });

      const response = await fetch(`/api/zoho/verify-by-rowid?${params.toString()}`);
      const result = await response.json();

      if (response.ok && result.success) {
        console.log('[Verification] RowID strategy returned', result.rowCount, 'rows');
        return result.data || [];
      }

      console.warn('[Verification] RowID strategy failed:', result.error);
      // Fallback vers matching_key
    } catch (error) {
      console.warn('[Verification] RowID strategy error:', error);
      // Fallback vers matching_key
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // STRATÉGIE MATCHING_KEY (comportement existant)
  // ─────────────────────────────────────────────────────────────────────────
  console.log('[Verification] Using matching_key strategy');

  if (!matchingColumn) {
    console.warn('[Verification] Aucune colonne de matching trouvée, vérification impossible');
    return [];
  }

  // Extraire les valeurs de matching des lignes envoyées (avec trim!)
  const matchingValues = sentRows
    .map((row) => row.data[matchingColumn]?.trim())
    .filter((v): v is string => v !== undefined && v !== null && v !== '');

  if (matchingValues.length === 0) {
    console.warn('[Verification] Aucune valeur de matching trouvée');
    return [];
  }

  console.log('[Verification] Matching column:', matchingColumn);
  console.log('[Verification] Matching values:', matchingValues);

  // Essayer d'abord la nouvelle API async (supporte les grosses tables)
  try {
    const tableName = config.tableName || await getTableNameFromViewId(config.workspaceId, config.viewId);

    if (tableName) {
      console.log('[Verification] Using async API with tableName:', tableName);

      const params = new URLSearchParams({
        workspaceId: config.workspaceId,
        tableName: tableName,
        matchingColumn: matchingColumn,
        matchingValues: JSON.stringify(matchingValues),
        limit: String(config.sampleSize * 2),
      });

      const response = await fetch(`/api/zoho/verify-data?${params.toString()}`);
      const result = await response.json();

      if (response.ok && result.success) {
        console.log('[Verification] Async API returned', result.rowCount, 'rows');
        return result.data || [];
      }

      console.warn('[Verification] Async API failed:', result.error);
    }
  } catch (asyncError) {
    console.warn('[Verification] Async API error:', asyncError);
  }

  // L'API async est requise pour supporter les grosses tables
  // Si elle échoue, on ne peut pas utiliser de fallback sync (timeout)
  throw new Error('Impossible de récupérer les données pour vérification. Vérifiez que tableName est disponible.');
}

/**
 * Récupère le nom de la table depuis le viewId
 * Utilise un cache en mémoire pour éviter les appels répétés
 */
async function getTableNameFromViewId(workspaceId: string, viewId: string): Promise<string | null> {
  const cacheKey = `${workspaceId}:${viewId}`;

  if (tableNameCache.has(cacheKey)) {
    return tableNameCache.get(cacheKey)!;
  }

  try {
    // Appeler l'API pour récupérer les infos de la vue
    const response = await fetch(`/api/zoho/tables?workspaceId=${workspaceId}`);
    const result = await response.json();

    if (response.ok && result.tables) {
      const table = result.tables.find((t: { id: string; name: string }) => t.id === viewId);
      if (table) {
        tableNameCache.set(cacheKey, table.name);
        return table.name;
      }
    }
  } catch (error) {
    console.warn('[Verification] Failed to get table name:', error);
  }

  return null;
}

/**
 * Trouve la meilleure colonne pour le matching
 * Cherche une colonne avec des valeurs uniques dans l'échantillon
 */
function findBestMatchingColumn(sentRows: SentRow[]): string | undefined {
  if (sentRows.length === 0) return undefined;

  const columns = Object.keys(sentRows[0].data);

  // Colonnes candidates (noms typiques de colonnes uniques)
  const preferredPatterns = [
    /num[eé]ro/i,
    /quittance/i,
    /n°/i,
    /^id$/i,
    /code/i,
    /reference/i,
    /référence/i,
  ];

  // Chercher une colonne candidate avec valeurs uniques
  for (const pattern of preferredPatterns) {
    const candidateCol = columns.find(col => pattern.test(col));
    if (candidateCol && hasUniqueValues(sentRows, candidateCol)) {
      console.log('[Verification] Auto-detected matching column:', candidateCol);
      return candidateCol;
    }
  }

  // Sinon, chercher n'importe quelle colonne avec valeurs uniques non vides
  for (const col of columns) {
    if (hasUniqueValues(sentRows, col) && hasNonEmptyValues(sentRows, col)) {
      console.log('[Verification] Fallback matching column:', col);
      return col;
    }
  }

  return undefined;
}

/**
 * Vérifie si une colonne a des valeurs uniques dans l'échantillon
 */
function hasUniqueValues(rows: SentRow[], column: string): boolean {
  const values = rows.map(r => r.data[column]).filter(v => v !== undefined && v !== '');
  const uniqueValues = new Set(values);
  return values.length > 0 && uniqueValues.size === values.length;
}

/**
 * Vérifie si une colonne a des valeurs non vides
 */
function hasNonEmptyValues(rows: SentRow[], column: string): boolean {
  return rows.some(r => r.data[column] && r.data[column].trim() !== '');
}

/**
 * Construit un critère SQL IN pour Zoho
 */
function buildInCriteria(column: string, values: string[]): string {
  // Important: trim les valeurs pour éviter les espaces parasites
  const escapedValues = values.map((v) => `'${String(v).trim().replace(/'/g, "''")}'`);
  return `"${column}" IN (${escapedValues.join(',')})`;
}

// ==================== COMPARAISON ====================

/**
 * Compare les lignes envoyées avec les lignes reçues
 * Retourne les anomalies ET les données comparatives détaillées
 * 
 * Pour la stratégie RowID, les lignes sont matchées par position (ordre d'insertion)
 * Pour la stratégie matching_key, les lignes sont matchées par valeur de la colonne
 */
function compareRowsDetailed(
  sentRows: SentRow[],
  receivedRows: Record<string, unknown>[],
  config: VerificationConfig,
  matchingColumn: string | undefined,
  strategy: VerificationStrategy
): { anomalies: Anomaly[]; comparedRows: ComparedRow[] } {
  const anomalies: Anomaly[] = [];
  const comparedRows: ComparedRow[] = [];

  // Pour stratégie RowID, trier les lignes reçues par RowID croissant
  let sortedReceivedRows = receivedRows;
  if (strategy === 'rowid') {
    sortedReceivedRows = [...receivedRows].sort((a, b) => {
      const rowIdA = Number(a['RowID'] || a['rowId'] || 0);
      const rowIdB = Number(b['RowID'] || b['rowId'] || 0);
      return rowIdA - rowIdB;
    });
    console.log('[Verification] Sorted received rows by RowID for positional matching');
  }

  for (let i = 0; i < sentRows.length; i++) {
    const sentRow = sentRows[i];
    let receivedRow: Record<string, unknown> | undefined;
    const matchingValue = matchingColumn ? (sentRow.data[matchingColumn] || '') : '';

    // Trouver la ligne correspondante selon la stratégie
    if (strategy === 'rowid') {
      // Stratégie RowID : matcher par position (ordre d'insertion)
      receivedRow = sortedReceivedRows[i];
    } else {
      // Stratégie matching_key : matcher par valeur
      receivedRow = findMatchingRow(sentRow, receivedRows, config, matchingColumn);
    }

    if (!receivedRow) {
      anomalies.push(createAnomaly('row_missing', sentRow.index, '', '', ''));
      comparedRows.push({
        rowIndex: sentRow.index,
        matchingValue,
        found: false,
        columns: Object.entries(sentRow.data).map(([name, value]) => ({
          name,
          sentValue: value,
          normalizedValue: normalizeValue(value),
          receivedValue: '',
          match: false,
        })),
      });
      continue;
    }

    // Comparer chaque colonne
    const columns: ComparedColumn[] = [];

    for (const [column, sentValue] of Object.entries(sentRow.data)) {
      const receivedValue = receivedRow[column];
      const sentStr = String(sentValue ?? '');
      const receivedStr = String(receivedValue ?? '');
      const normalizedSent = normalizeValue(sentStr);
      const normalizedReceived = normalizeValue(receivedStr);
      const match = normalizedSent === normalizedReceived;

      // Ignorer les colonnes vides des deux côtés pour les anomalies
      if (sentStr || receivedStr) {
        const anomaly = detectAnomaly(sentRow.index, column, sentStr, receivedStr);
        if (anomaly) {
          anomalies.push(anomaly);
        }
      }

      columns.push({
        name: column,
        sentValue: sentStr,
        normalizedValue: normalizedSent,
        receivedValue: receivedStr,
        match: match || (!sentStr && !receivedStr),
        anomalyType: !match && (sentStr || receivedStr)
          ? detectAnomalyType(sentStr, receivedStr)
          : undefined,
      });
    }

    comparedRows.push({
      rowIndex: sentRow.index,
      matchingValue,
      found: true,
      columns,
    });
  }

  return { anomalies, comparedRows };
}

/**
 * Trouve la ligne correspondante dans les données Zoho
 */
function findMatchingRow(
  sentRow: SentRow,
  receivedRows: Record<string, unknown>[],
  config: VerificationConfig,
  matchingColumn: string | undefined
): Record<string, unknown> | undefined {
  // Utiliser la colonne de matching
  const colToMatch = matchingColumn || config.matchingColumn;

  if (colToMatch) {
    const sentValue = normalizeValue(sentRow.data[colToMatch]);
    return receivedRows.find(
      (row) => normalizeValue(row[colToMatch]) === sentValue
    );
  }

  // Fallback : matcher sur plusieurs colonnes (moins fiable)
  let bestMatch: Record<string, unknown> | undefined;
  let bestScore = 0;

  for (const receivedRow of receivedRows) {
    let score = 0;
    for (const [column, sentValue] of Object.entries(sentRow.data)) {
      const receivedValue = receivedRow[column];
      if (normalizeValue(sentValue) === normalizeValue(receivedValue)) {
        score++;
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestMatch = receivedRow;
    }
  }

  const threshold = Object.keys(sentRow.data).length * 0.5;
  return bestScore >= threshold ? bestMatch : undefined;
}

// ==================== DÉTECTION D'ANOMALIES ====================

/**
 * Détecte le type d'anomalie entre deux valeurs (sans créer l'objet Anomaly)
 */
function detectAnomalyType(sentValue: string, receivedValue: string): AnomalyType | undefined {
  const normalizedSent = normalizeValue(sentValue);
  const normalizedReceived = normalizeValue(receivedValue);

  if (normalizedSent === normalizedReceived) return undefined;
  if (sentValue && !receivedValue) return 'value_missing';
  if (isDateInverted(sentValue, receivedValue)) return 'date_inverted';
  if (isDatetimeTruncatedToDate(sentValue, receivedValue)) return 'datetime_truncated';
  if (isTruncated(sentValue, receivedValue)) return 'truncated';
  if (isRounded(sentValue, receivedValue)) return 'rounded';
  if (hasEncodingIssue(sentValue, receivedValue)) return 'encoding_issue';
  if (isSpacesTrimmed(sentValue, receivedValue)) return 'spaces_trimmed';
  return 'value_different';
}

/**
 * Détecte le type d'anomalie entre deux valeurs
 */
function detectAnomaly(
  rowIndex: number,
  column: string,
  sentValue: string,
  receivedValue: string
): Anomaly | null {
  // Normaliser pour comparaison
  const normalizedSent = normalizeValue(sentValue);
  const normalizedReceived = normalizeValue(receivedValue);

  // Valeurs identiques après normalisation
  if (normalizedSent === normalizedReceived) {
    return null;
  }

  // Ignorer si les deux sont vides
  if (!sentValue && !receivedValue) {
    return null;
  }

  // Valeur manquante
  if (sentValue && !receivedValue) {
    return createAnomaly('value_missing', rowIndex, column, sentValue, receivedValue);
  }

  // Détecter perte d'heure (datetime → date)
  if (isDatetimeTruncatedToDate(sentValue, receivedValue)) {
    return createAnomaly('datetime_truncated', rowIndex, column, sentValue, receivedValue);
  }

  // Détecter date inversée (ex: 05/03/2025 vs 03/05/2025)
  if (isDateInverted(sentValue, receivedValue)) {
    return createAnomaly('date_inverted', rowIndex, column, sentValue, receivedValue);
  }

  // Détecter troncature
  if (isTruncated(sentValue, receivedValue)) {
    return createAnomaly('truncated', rowIndex, column, sentValue, receivedValue);
  }

  // Détecter arrondi numérique
  if (isRounded(sentValue, receivedValue)) {
    return createAnomaly('rounded', rowIndex, column, sentValue, receivedValue);
  }

  // Détecter problème d'encodage
  if (hasEncodingIssue(sentValue, receivedValue)) {
    return createAnomaly('encoding_issue', rowIndex, column, sentValue, receivedValue);
  }

  // Détecter espaces supprimés
  if (isSpacesTrimmed(sentValue, receivedValue)) {
    return createAnomaly('spaces_trimmed', rowIndex, column, sentValue, receivedValue);
  }

  // Valeur différente (cas général)
  return createAnomaly('value_different', rowIndex, column, sentValue, receivedValue);
}

// ==================== HELPERS DE DÉTECTION ====================

/**
 * Mapping des mois en anglais vers numéro
 */
const MONTH_MAP: Record<string, string> = {
  Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06',
  Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12',
};

/**
 * Essaie de parser une date et retourne un format canonique (YYYY-MM-DD)
 * Gère plusieurs formats : ISO, Zoho (avec et sans virgule), FR, MM/yyyy
 */
function tryParseDateToCanonical(str: string): string | null {
  if (!str || typeof str !== 'string') return null;

  const trimmed = str.trim();

  // Format ISO : 2025-04-04 ou 2025-04-04 09:01:00 ou 2025-04-04T00:00:00
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  }

  // Format Zoho avec virgule : "04 Apr, 2025 00:00:00" ou "04 Apr, 2025"
  const zohoWithCommaMatch = trimmed.match(/^(\d{2}) (\w{3}), (\d{4})/);
  if (zohoWithCommaMatch) {
    const day = zohoWithCommaMatch[1];
    const month = MONTH_MAP[zohoWithCommaMatch[2]];
    const year = zohoWithCommaMatch[3];
    if (month) {
      return `${year}-${month}-${day}`;
    }
  }

  // Format Zoho sans virgule : "01 Apr 2025 09:01:00" ou "01 Apr 2025"
  const zohoNoCommaMatch = trimmed.match(/^(\d{2}) (\w{3}) (\d{4})/);
  if (zohoNoCommaMatch) {
    const day = zohoNoCommaMatch[1];
    const month = MONTH_MAP[zohoNoCommaMatch[2]];
    const year = zohoNoCommaMatch[3];
    if (month) {
      return `${year}-${month}-${day}`;
    }
  }

  // Format FR : 04/04/2025 ou 04/04/2025 09:01:00
  const frMatch = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (frMatch) {
    return `${frMatch[3]}-${frMatch[2]}-${frMatch[1]}`;
  }

  // Format MM/yyyy (période) : 04/2025 → 2025-04-01
  const periodMatch = trimmed.match(/^(\d{2})\/(\d{4})$/);
  if (periodMatch) {
    return `${periodMatch[2]}-${periodMatch[1]}-01`;
  }

  return null;
}

/**
 * Normalise une valeur pour comparaison
 */
function normalizeValue(value: unknown): string {
  if (value === null || value === undefined) return '';

  let str = String(value).trim();

  // 1. Essayer de parser comme date
  const parsedDate = tryParseDateToCanonical(str);
  if (parsedDate) {
    return parsedDate;
  }

  // 2. Normaliser les nombres : enlever les .0 inutiles (50.0 → 50)
  // et gérer les formats avec virgule (50,0 → 50)
  const numMatch = str.match(/^-?\d+([.,]\d+)?$/);
  if (numMatch) {
    const num = parseFloat(str.replace(',', '.'));
    if (!isNaN(num)) {
      // Si c'est un entier, enlever les décimales
      if (Number.isInteger(num)) {
        str = String(Math.round(num));
      } else {
        // Sinon, garder max 6 décimales et enlever les 0 finaux
        str = num.toFixed(6).replace(/\.?0+$/, '');
      }
    }
  }

  return str.toLowerCase();
}

/**
 * Détecte si l'heure a été perdue (datetime → date)
 * Ex: "07/01/26 07:04:34" → "07/01/26 00:00:00"
 */
function isDatetimeTruncatedToDate(sent: string, received: string): boolean {
  // Pattern : date avec heure
  const datetimePattern = /^(\d{2}\/\d{2}\/\d{2,4})\s+(\d{2}:\d{2}:\d{2})$/;

  const sentMatch = sent.match(datetimePattern);
  const receivedMatch = received.match(datetimePattern);

  if (sentMatch && receivedMatch) {
    const sentDate = sentMatch[1];
    const sentTime = sentMatch[2];
    const receivedDate = receivedMatch[1];
    const receivedTime = receivedMatch[2];

    // Même date mais heure reçue = 00:00:00 (heure perdue)
    if (sentDate === receivedDate && sentTime !== '00:00:00' && receivedTime === '00:00:00') {
      return true;
    }
  }

  return false;
}

/**
 * Détecte si la seule différence est les espaces autour des virgules/ponctuations
 * Ex: "QS, RS, RC" → "QS,RS,RC"
 */
function isSpacesTrimmed(sent: string, received: string): boolean {
  // Normaliser les espaces autour des virgules et ponctuations
  const normalizedSent = sent.replace(/\s*([,;:])\s*/g, '$1').trim();
  const normalizedReceived = received.replace(/\s*([,;:])\s*/g, '$1').trim();

  // Si égaux après normalisation des espaces, c'est bien ce cas
  return normalizedSent.toLowerCase() === normalizedReceived.toLowerCase() && sent !== received;
}

/**
 * Détecte si une date a été inversée (jour/mois)
 */
function isDateInverted(sent: string, received: string): boolean {
  // Pattern date: YYYY-MM-DD ou DD/MM/YYYY ou MM/DD/YYYY
  const datePatterns = [
    /^(\d{4})-(\d{2})-(\d{2})$/,  // YYYY-MM-DD
    /^(\d{2})\/(\d{2})\/(\d{4})$/, // DD/MM/YYYY ou MM/DD/YYYY
  ];

  for (const pattern of datePatterns) {
    const sentMatch = sent.match(pattern);
    const receivedMatch = received.match(pattern);

    if (sentMatch && receivedMatch) {
      // Extraire jour et mois
      let sentDay: string, sentMonth: string;
      let recDay: string, recMonth: string;

      if (pattern.source.startsWith('^(\\d{4})')) {
        // Format YYYY-MM-DD
        [, , sentMonth, sentDay] = sentMatch;
        [, , recMonth, recDay] = receivedMatch;
      } else {
        // Format DD/MM/YYYY - on suppose DD/MM
        [, sentDay, sentMonth] = sentMatch;
        [, recDay, recMonth] = receivedMatch;
      }

      // Vérifier si jour et mois sont inversés
      if (sentDay === recMonth && sentMonth === recDay && sentDay !== sentMonth) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Détecte si un texte a été tronqué
 */
function isTruncated(sent: string, received: string): boolean {
  if (sent.length <= TRUNCATION_THRESHOLD) return false;
  if (received.length >= sent.length) return false;

  // Vérifier si received est un préfixe de sent
  return sent.startsWith(received) || sent.toLowerCase().startsWith(received.toLowerCase());
}

/**
 * Détecte si un nombre a été arrondi
 */
function isRounded(sent: string, received: string): boolean {
  const sentNum = parseFloat(sent.replace(',', '.').replace(/\s/g, ''));
  const receivedNum = parseFloat(received.replace(',', '.').replace(/\s/g, ''));

  if (isNaN(sentNum) || isNaN(receivedNum)) return false;

  // Si égaux après normalisation, pas d'arrondi
  if (sentNum === receivedNum) return false;

  // Vérifier si la différence est petite (< 1%)
  const diff = Math.abs(sentNum - receivedNum);
  const tolerance = Math.max(0.01, Math.abs(sentNum) * 0.01);
  return diff > 0 && diff <= tolerance;
}

/**
 * Détecte un problème d'encodage (accents perdus)
 */
function hasEncodingIssue(sent: string, received: string): boolean {
  // Caractères qui indiquent un problème d'encodage
  const encodingIssueChars = ['?', '�', 'ï¿½'];

  // Vérifier si received contient des caractères de remplacement
  // là où sent avait des caractères spéciaux
  const sentHasSpecial = /[àâäéèêëïîôùûüç]/i.test(sent);
  const receivedHasIssue = encodingIssueChars.some((c) => received.includes(c));

  return sentHasSpecial && receivedHasIssue;
}

// ==================== UTILITAIRES ====================

/**
 * Pause asynchrone
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ==================== EXPORT ====================

export { buildInCriteria };
