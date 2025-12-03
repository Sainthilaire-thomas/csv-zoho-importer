// types/profiles.ts
// Types pour le système de Profils d'Import

// =============================================================================
// TYPES ZOHO (référence)
// =============================================================================

export type ZohoDataType =
  | 'PLAIN'           // Texte simple
  | 'MULTI_LINE'      // Texte multi-lignes
  | 'EMAIL'           // Email
  | 'URL'             // URL
  | 'NUMBER'          // Nombre entier
  | 'POSITIVE_NUMBER' // Nombre positif
  | 'DECIMAL_NUMBER'  // Nombre décimal
  | 'CURRENCY'        // Monnaie
  | 'PERCENT'         // Pourcentage
  | 'DATE'            // Date (texte)
  | 'DATE_AS_DATE'    // Date native
  | 'AUTO_NUMBER'     // Auto-incrémenté
  | 'BOOLEAN'         // Booléen
  | 'DURATION'        // Durée (HH:mm:ss)
  | 'LOOKUP';         // Référence

export type ImportMode = 'append' | 'truncateadd' | 'updateadd';

// =============================================================================
// PROFIL D'IMPORT
// =============================================================================

/**
 * Profil d'import - Configuration pour UNE table Zoho
 * Relation 1:1 avec une table Zoho (via viewId UNIQUE)
 */
export interface ImportProfile {
  id: string;
  
  // Identification
  name: string;
  description?: string;
  
  // Table Zoho cible (UNIQUE - relation 1:1)
  workspaceId: string;
  workspaceName: string;
  viewId: string;                     // Clé unique - un seul profil par table
  viewName: string;
  
  // Configuration colonnes
  columns: ProfileColumn[];
  
  // Paramètres par défaut
  defaultImportMode: ImportMode;
  
  // Métadonnées
  createdAt: Date;
  createdBy: string;
  updatedAt: Date;
  lastUsedAt: Date | null;
  useCount: number;
}

/**
 * Configuration d'une colonne dans le profil
 */
export interface ProfileColumn {
  id: string;
  
  // Colonne Zoho (fixe)
  zohoColumn: string;                 // Nom exact dans Zoho
  zohoType: ZohoDataType;             // Type Zoho
  isRequired: boolean;                // Obligatoire dans Zoho
  
  // Noms acceptés (ACCUMULATION au fil des imports)
  acceptedNames: string[];            // ["Date début", "Date de début", "DateDebut"]
  
  // Type de données interprété
  dataType: ProfileDataType;
  
  // Configuration spécifique au type
  config: ColumnConfig;
}

export type ProfileDataType = 'date' | 'duration' | 'number' | 'text' | 'boolean';

// =============================================================================
// CONFIGURATIONS PAR TYPE
// =============================================================================

export type ColumnConfig = 
  | DateColumnConfig 
  | DurationColumnConfig 
  | NumberColumnConfig 
  | TextColumnConfig
  | BooleanColumnConfig;

/**
 * Configuration pour colonnes de type date
 */
export interface DateColumnConfig {
  type: 'date';
  acceptedFormats: string[];          // ["DD/MM/YYYY", "DD-MM-YYYY", "YYYY-MM-DD"]
  dayMonthOrder: 'dmy' | 'mdy';       // Confirmé par utilisateur (résout ambiguïté)
  outputFormat: 'iso';                // Toujours YYYY-MM-DD en sortie
}

/**
 * Configuration pour colonnes de type durée
 */
export interface DurationColumnConfig {
  type: 'duration';
  acceptedFormats: string[];          // ["HH:mm", "HH:mm:ss", "H:mm"]
  outputFormat: 'hms';                // Toujours HH:mm:ss en sortie
}

/**
 * Configuration pour colonnes numériques
 */
export interface NumberColumnConfig {
  type: 'number';
  acceptedFormats: NumberFormat[];    // Formats acceptés
  expandScientific: boolean;          // true = 1E6 → 1000000
  outputFormat: 'standard';           // Point décimal, pas de séparateur milliers
}

export interface NumberFormat {
  decimalSeparator: ',' | '.';
  thousandSeparator: ' ' | '.' | ',' | null;
}

/**
 * Configuration pour colonnes texte
 */
export interface TextColumnConfig {
  type: 'text';
  trim: boolean;                      // Supprimer espaces début/fin
  emptyValues: string[];              // ["N/A", "null", "-"] → ""
  expandScientific: boolean;          // Pour codes numériques (1E6 → "1000000")
}

/**
 * Configuration pour colonnes booléennes
 */
export interface BooleanColumnConfig {
  type: 'boolean';
  trueValues: string[];               // ["Oui", "Yes", "1", "Vrai", "true"]
  falseValues: string[];              // ["Non", "No", "0", "Faux", "false"]
}

// =============================================================================
// DÉTECTION DE COLONNES (fichier source)
// =============================================================================

/**
 * Colonne détectée dans le fichier source
 */
export interface DetectedColumn {
  name: string;
  index: number;
  
  // Type détecté automatiquement
  detectedType: DetectedType;
  confidence: number;                 // 0-100
  
  // Format détecté
  detectedFormat?: string;            // "DD/MM/YYYY", "HH:mm", etc.
  
  // Échantillons pour prévisualisation
  samples: string[];                  // 5 valeurs non vides
  totalValues: number;
  emptyCount: number;
  
  // Ambiguïté
  isAmbiguous: boolean;
  ambiguityReason?: string;
}

export type DetectedType = 
  | 'date'
  | 'duration' 
  | 'number'
  | 'text'
  | 'boolean'
  | 'empty';

// =============================================================================
// MATCHING FICHIER ↔ PROFIL
// =============================================================================

/**
 * Résultat du matching fichier ↔ profil
 */
export interface ProfileMatchResult {
  profile: ImportProfile;
  score: number;                      // Nombre de colonnes matchées
  totalFileColumns: number;
  mappings: ColumnMapping[];
  needsConfirmation: boolean;         // Au moins une colonne à confirmer
}

/**
 * Mapping d'une colonne fichier vers profil
 */
export interface ColumnMapping {
  // Colonne source (fichier)
  fileColumn: string;
  fileType: DetectedType;
  fileSamples: string[];              // 3-5 valeurs exemples
  
  // Colonne cible (profil/Zoho)
  profileColumn: ProfileColumn | null;
  
  // Statut du matching
  status: MappingStatus;
  similarity?: number;                // 0-100 pour 'similar'
  
  // Actions requises
  needsConfirmation: boolean;
  ambiguity?: AmbiguityInfo;          // Si format ambigu
}

export type MappingStatus = 
  | 'exact'                           // Match parfait (nom + format connus)
  | 'format_different'                // Nom connu, format nouveau
  | 'similar'                         // Nom similaire (fuzzy match > 80%)
  | 'new'                             // Colonne inconnue
  | 'missing';                        // Colonne Zoho obligatoire absente

/**
 * Information sur une ambiguïté détectée
 */
export interface AmbiguityInfo {
  type: 'date_format' | 'number_format' | 'scientific_notation';
  description: string;
  options: AmbiguityOption[];
  defaultOption: string;
}

export interface AmbiguityOption {
  value: string;
  label: string;
  example: string;
}

// =============================================================================
// TRANSFORMATION
// =============================================================================

/**
 * Résultat de transformation d'une ligne
 */
export interface TransformResult {
  success: boolean;
  transformedRow: Record<string, string>;
  transformations: TransformationApplied[];
  errors: TransformError[];
}

export interface TransformationApplied {
  column: string;
  originalValue: string;
  transformedValue: string;
  transformationType: TransformationType;
}

export type TransformationType =
  | 'date_format'           // DD/MM/YYYY → YYYY-MM-DD
  | 'duration_format'       // HH:mm → HH:mm:ss
  | 'decimal_separator'     // 1234,56 → 1234.56
  | 'thousand_separator'    // 1 234 567 → 1234567
  | 'scientific_expand'     // 1E6 → 1000000
  | 'boolean_normalize'     // Oui/Non → true/false
  | 'trim'                  // "  text  " → "text"
  | 'empty_normalize'       // "N/A" → ""
  | 'none';                 // Pas de transformation

export interface TransformError {
  column: string;
  value: string;
  error: string;
}

// =============================================================================
// MISE À JOUR DU PROFIL
// =============================================================================

/**
 * Mise à jour du profil après import
 * (nouveaux alias, nouveaux formats appris)
 */
export interface ProfileUpdateFromImport {
  // Nouveaux alias à ajouter par colonne
  newAliases: Record<string, string[]>;  // zohoColumn → nouveaux noms
  
  // Nouveaux formats à ajouter par colonne
  newFormats: Record<string, string[]>;  // zohoColumn → nouveaux formats
  
  // Métadonnées
  lastUsedAt: Date;
  incrementUseCount: boolean;
}

// =============================================================================
// API PAYLOADS
// =============================================================================

/**
 * Payload pour création de profil
 */
export interface CreateProfilePayload {
  name: string;
  description?: string;
  workspaceId: string;
  workspaceName: string;
  viewId: string;
  viewName: string;
  columns: Omit<ProfileColumn, 'id'>[];
  defaultImportMode?: ImportMode;
}

/**
 * Payload pour mise à jour de profil
 */
export interface UpdateProfilePayload {
  name?: string;
  description?: string;
  columns?: ProfileColumn[];
  defaultImportMode?: ImportMode;
}

/**
 * Payload pour recherche de profil matching
 */
export interface MatchProfilePayload {
  fileColumns: DetectedColumn[];
}

// =============================================================================
// BASE DE DONNÉES (row types pour Supabase)
// =============================================================================

/**
 * Row type pour table import_profiles (Supabase)
 */
export interface ImportProfileRow {
  id: string;
  name: string;
  description: string | null;
  workspace_id: string;
  workspace_name: string;
  view_id: string;
  view_name: string;
  columns: ProfileColumn[];           // JSONB
  default_import_mode: ImportMode;
  created_at: string;
  created_by: string;
  updated_at: string;
  last_used_at: string | null;
  use_count: number;
}

/**
 * Conversion Row → ImportProfile
 */
export function rowToProfile(row: ImportProfileRow): ImportProfile {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? undefined,
    workspaceId: row.workspace_id,
    workspaceName: row.workspace_name,
    viewId: row.view_id,
    viewName: row.view_name,
    columns: row.columns,
    defaultImportMode: row.default_import_mode,
    createdAt: new Date(row.created_at),
    createdBy: row.created_by,
    updatedAt: new Date(row.updated_at),
    lastUsedAt: row.last_used_at ? new Date(row.last_used_at) : null,
    useCount: row.use_count,
  };
}

/**
 * Conversion ImportProfile → Row (pour insert/update)
 */
export function profileToRow(
  profile: Omit<ImportProfile, 'id' | 'createdAt' | 'updatedAt' | 'lastUsedAt' | 'useCount'>
): Omit<ImportProfileRow, 'id' | 'created_at' | 'updated_at' | 'last_used_at' | 'use_count'> {
  return {
    name: profile.name,
    description: profile.description ?? null,
    workspace_id: profile.workspaceId,
    workspace_name: profile.workspaceName,
    view_id: profile.viewId,
    view_name: profile.viewName,
    columns: profile.columns,
    default_import_mode: profile.defaultImportMode,
    created_by: profile.createdBy,
  };
}
