// lib/domain/excel/date-converter.ts
/**
 * Helpers pour la conversion des dates Excel et la prédiction d'affichage Zoho
 * Mission 017 Phase 2
 */

// =============================================================================
// TYPES
// =============================================================================

export interface CellDebugInfo {
  // Source Excel
  v: unknown;              // Valeur brute (number pour dates, string, etc.)
  z?: string;              // Format Excel (ex: "m/d/yy h:mm")
  w?: string;              // Ce que xlsx génère (peut être faux pour locale-aware)
  t?: string;              // Type de cellule (n=number, s=string, b=boolean, d=date)
  
  // Interprétation
  isLocaleAwareFormat: boolean;  // true si z est "m/d/yy" etc.
  localInterpretation?: string;  // Ce que l'utilisateur voit dans Excel FR
  
  // Transformation
  transformedValue: string;      // Après notre transformation
  transformationRule?: string;   // Description de la règle appliquée
  
  // Zoho
  zohoValue: string;             // Ce qu'on envoie à Zoho
  zohoDisplay?: string;          // Prévision affichage Zoho
}

// =============================================================================
// FORMATS LOCALE-AWARE
// =============================================================================

/**
 * Liste des formats Excel "locale-aware" qui s'adaptent aux paramètres Windows
 * xlsx les interprète toujours comme américains (incorrectement)
 */
const LOCALE_AWARE_FORMATS = [
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

/**
 * Détecte si un format Excel est "locale-aware"
 */
export function isLocaleAwareDateFormat(format: string | undefined): boolean {
  if (!format) return false;
  return LOCALE_AWARE_FORMATS.includes(format.toLowerCase());
}

// =============================================================================
// CONVERSION EXCEL → DATE STRING
// =============================================================================

/**
 * Convertit un nombre sériel Excel en string de date format français DD/MM/YYYY
 * 
 * @param serial - Nombre sériel Excel (ex: 45088.98)
 * @param format - Format Excel (ex: "m/d/yy h:mm")
 * @returns Date formatée en français (ex: "11/06/2023 23:35:00")
 */
export function excelSerialToFrenchDate(serial: number, format?: string): string {
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
  const hasTimeInFormat = format ? /h/i.test(format) : timeFraction > 0.0001;

  if (timeFraction > 0.0001 && hasTimeInFormat) {
    const totalSeconds = Math.round(timeFraction * 24 * 60 * 60);
    const hours = Math.floor(totalSeconds / 3600).toString().padStart(2, '0');
    const minutes = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, '0');
    const seconds = (totalSeconds % 60).toString().padStart(2, '0');
    timeStr = ` ${hours}:${minutes}:${seconds}`;
  }

  return `${day}/${month}/${year}${timeStr}`;
}

/**
 * Convertit une date DD/MM/YYYY en format ISO YYYY-MM-DD
 */
export function frenchDateToISO(frenchDate: string): string {
  // Format avec heure : DD/MM/YYYY HH:mm:ss
  const withTimeMatch = frenchDate.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2}):(\d{2})$/);
  if (withTimeMatch) {
    const [, day, month, year, hours, minutes, seconds] = withTimeMatch;
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  }

  // Format date seule : DD/MM/YYYY
  const dateOnlyMatch = frenchDate.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (dateOnlyMatch) {
    const [, day, month, year] = dateOnlyMatch;
    return `${year}-${month}-${day}`;
  }

  // Pas de match, retourner tel quel
  return frenchDate;
}

// =============================================================================
// PRÉDICTION AFFICHAGE ZOHO
// =============================================================================

const ZOHO_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Prédit comment Zoho affichera une valeur basée sur le type de colonne
 * 
 * @param isoValue - Valeur en format ISO (ex: "2023-06-11 23:35:00")
 * @param zohoType - Type de colonne Zoho (DATE, DATE_TIME, etc.)
 * @returns Prévision d'affichage Zoho (ex: "11 Jun, 2023 23:35:00")
 */
export function predictZohoDisplay(isoValue: string, zohoType?: string | null): string {
  if (!isoValue) return '';

  // Pour les dates, Zoho affiche en format "DD Mon, YYYY HH:mm:ss"
  if (zohoType === 'DATE' || zohoType === 'DATE_AS_DATE' || zohoType === 'DATE_TIME') {
    // Format ISO datetime : 2025-04-04 23:59:35 ou 2025-04-04T23:59:35
    const dateTimeMatch = isoValue.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})$/);
    if (dateTimeMatch) {
      const [, year, monthNum, day, hours, minutes, seconds] = dateTimeMatch;
      const month = ZOHO_MONTHS[parseInt(monthNum, 10) - 1];
      return `${day} ${month}, ${year} ${hours}:${minutes}:${seconds}`;
    }

    // Format ISO date seule : 2025-04-04
    const dateOnlyMatch = isoValue.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (dateOnlyMatch) {
      const [, year, monthNum, day] = dateOnlyMatch;
      const month = ZOHO_MONTHS[parseInt(monthNum, 10) - 1];
      return `${day} ${month}, ${year} 00:00:00`;
    }
  }

  return isoValue;
}

// =============================================================================
// DESCRIPTION DES TRANSFORMATIONS
// =============================================================================

/**
 * Génère une description lisible de la transformation appliquée
 */
export function getTransformationDescription(
  isLocaleAware: boolean,
  hasTime: boolean
): string {
  if (isLocaleAware) {
    if (hasTime) {
      return 'Date locale-aware (Excel FR) → ISO datetime';
    }
    return 'Date locale-aware (Excel FR) → ISO date';
  }
  return 'Format standard → ISO';
}

// =============================================================================
// EXPORT INDEX
// =============================================================================

export default {
  isLocaleAwareDateFormat,
  excelSerialToFrenchDate,
  frenchDateToISO,
  predictZohoDisplay,
  getTransformationDescription,
};
