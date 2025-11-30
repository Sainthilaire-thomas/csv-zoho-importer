/**
 * @file lib/infrastructure/zoho/types.ts
 * @description Types pour l'intégration Zoho Analytics API
 *
 * Documentation API : https://www.zoho.com/analytics/api/
 */

// ==================== OAUTH ====================

/**
 * Régions Zoho disponibles
 */
export type ZohoRegion = 'us' | 'eu' | 'in' | 'au' | 'jp' | 'cn';

/**
 * Configuration des domaines par région
 */
export interface ZohoRegionConfig {
  accountsDomain: string;
  apiDomain: string;
}

export const ZOHO_REGIONS: Record<ZohoRegion, ZohoRegionConfig> = {
  us: {
    accountsDomain: 'https://accounts.zoho.com',
    apiDomain: 'https://analyticsapi.zoho.com',
  },
  eu: {
    accountsDomain: 'https://accounts.zoho.eu',
    apiDomain: 'https://analyticsapi.zoho.eu',
  },
  in: {
    accountsDomain: 'https://accounts.zoho.in',
    apiDomain: 'https://analyticsapi.zoho.in',
  },
  au: {
    accountsDomain: 'https://accounts.zoho.com.au',
    apiDomain: 'https://analyticsapi.zoho.com.au',
  },
  jp: {
    accountsDomain: 'https://accounts.zoho.jp',
    apiDomain: 'https://analyticsapi.zoho.jp',
  },
  cn: {
    accountsDomain: 'https://accounts.zoho.com.cn',
    apiDomain: 'https://analyticsapi.zoho.com.cn',
  },
};

/**
 * Scopes OAuth requis pour l'application
 */
export const ZOHO_SCOPES = [
  'ZohoAnalytics.metadata.all',
  'ZohoAnalytics.data.all',
] as const;

/**
 * Réponse OAuth token de Zoho
 */
export interface ZohoTokenResponse {
  access_token: string;
  refresh_token?: string; // Présent uniquement lors de la première autorisation
  token_type: string;
  expires_in: number; // En secondes (généralement 3600)
  api_domain: string;
  scope?: string;
  error?: string;
  error_description?: string;
}

/**
 * Tokens stockés en base (déchiffrés)
 * MODIFIÉ : Ajout de orgId (requis pour les appels API /views, /import, etc.)
 */
export interface ZohoTokens {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresAt: Date;
  scope: string | null;
  apiDomain: string;
  accountsDomain: string;
  orgId: string | null;        // AJOUTÉ - ID de l'organisation (requis pour ZANALYTICS-ORGID header)
  zohoUserId: string | null;
  zohoEmail: string | null;
}

/**
 * Données stockées en base (chiffrées)
 * MODIFIÉ : Ajout de org_id
 */
export interface ZohoTokenRecord {
  id: string;
  user_id: string;
  access_token_encrypted: string;
  refresh_token_encrypted: string;
  token_type: string;
  expires_at: string;
  scope: string | null;
  api_domain: string;
  accounts_domain: string;
  org_id: string | null;        // AJOUTÉ - ID de l'organisation
  zoho_user_id: string | null;
  zoho_email: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * État de connexion Zoho pour un utilisateur
 */
export interface ZohoConnectionStatus {
  isConnected: boolean;
  zohoEmail: string | null;
  expiresAt: Date | null;
  needsReauthorization: boolean;
}

// ==================== API ZOHO ANALYTICS ====================

/**
 * Organisation Zoho (compte principal)
 */
export interface ZohoOrganization {
  orgId: string;
  orgName: string;
}

/**
 * Workspace Zoho Analytics
 */
export interface ZohoWorkspace {
  workspaceId: string;
  workspaceName: string;
  workspaceDesc?: string;
  createdBy?: string;
  createdTime?: string;
  isDefault?: boolean;
}

/**
 * Table/Vue Zoho Analytics
 */
export interface ZohoTable {
  viewId: string;
  viewName: string;
  viewDesc?: string;
  viewType: 'TABLE' | 'QUERY_TABLE' | 'CHART' | 'PIVOT' | 'SUMMARY' | 'TABULAR';
  createdBy?: string;
  createdTime?: string;
  isSystemTable?: boolean;
  folderId?: string;  // ← AJOUTER CETTE LIGNE
}
/**
 * Dossier Zoho Analytics (pour organiser les vues)
 */
export interface ZohoFolder {
  folderId: string;
  folderName: string;
  folderDesc?: string;
  folderIndex?: number;
  isDefault?: boolean;
  parentFolderId?: string; // '-1' pour racine
}

/**
 * Colonne d'une table Zoho
 */
export interface ZohoColumn {
  columnName: string;
  columnDesc?: string;
  dataType: ZohoDataType;
  isUnique?: boolean;
  isLookup?: boolean;
  isMandatory?: boolean;
}

/**
 * Types de données Zoho
 */
export type ZohoDataType =
  | 'PLAIN'           // Texte
  | 'MULTI_LINE'      // Texte multiligne
  | 'EMAIL'           // Email
  | 'URL'             // URL
  | 'NUMBER'          // Entier
  | 'POSITIVE_NUMBER' // Entier positif
  | 'DECIMAL_NUMBER'  // Décimal
  | 'CURRENCY'        // Monétaire
  | 'PERCENT'         // Pourcentage
  | 'DATE'            // Date
  | 'DATE_TIME'       // Date et heure
  | 'BOOLEAN'         // Oui/Non
  | 'AUTO_NUMBER';    // Auto-incrémenté

// ==================== IMPORT ====================

/**
 * Mode d'import Zoho
 * Correspond aux valeurs de l'API Zoho
 */
export type ZohoImportType =
  | 'APPEND'          // Ajoute à la fin
  | 'TRUNCATEADD'     // Vide la table puis ajoute
  | 'UPDATEADD'       // Met à jour ou ajoute (nécessite colonnes clés)
  | 'DELETEUPSERT';   // Sync complète (supprime les absents)

/**
 * Mapping entre modes de l'app et types Zoho
 */
export const IMPORT_MODE_TO_ZOHO: Record<string, ZohoImportType> = {
  append: 'APPEND',
  truncateadd: 'TRUNCATEADD',
  updateadd: 'UPDATEADD',
  deleteupsert: 'DELETEUPSERT',
  onlyadd: 'APPEND', // Géré avec l'option IGNORE_DUPLICATES
};

/**
 * Paramètres pour un import Zoho
 */
export interface ZohoImportParams {
  workspaceId: string;
  viewId: string;
  viewName: string;
  importType: ZohoImportType;
  data: string; // CSV formaté
  autoIdentify?: boolean;
  dateFormat?: string;
  matchingColumns?: string[]; // Pour UPDATEADD et DELETEUPSERT
  skipFirstRow?: boolean;
}



/**
 * Réponse d'un import Zoho
 */
export interface ZohoImportResponse {
  status: 'success' | 'error';
  importId?: string;
  importSummary?: {
    totalRowCount: number;
    successRowCount: number;
    warningCount: number;
    failedRowCount: number;
    columnCount: number;
    importType: string;
    importTime: string;
  };
  importErrors?: ZohoImportError[];
  errorMessage?: string;
  errorCode?: string;
}

/**
 * Erreur lors d'un import
 */
export interface ZohoImportError {
  rowIndex: number;
  columnName?: string;
  errorMessage: string;
}

// ==================== API RESPONSES ====================

/**
 * Réponse standard de l'API Zoho
 */
export interface ZohoApiResponse<T> {
  status: 'success' | 'error';
  data?: T;
  errorMessage?: string;
  errorCode?: string;
}

/**
 * Réponse liste workspaces
 */
export interface ZohoWorkspacesResponse {
  workspaces: ZohoWorkspace[];
}

/**
 * Réponse liste tables/vues
 */
export interface ZohoTablesResponse {
  views: ZohoTable[];
}

/**
 * Réponse colonnes d'une table
 */
export interface ZohoColumnsResponse {
  columns: ZohoColumn[];
}

// ==================== ERREURS ====================

/**
 * Codes d'erreur OAuth Zoho
 */
export type ZohoOAuthError =
  | 'invalid_code'
  | 'invalid_client'
  | 'invalid_client_secret'
  | 'invalid_redirect_uri'
  | 'invalid_grant'
  | 'access_denied'
  | 'server_error';

/**
 * Erreur API Zoho personnalisée
 */
export class ZohoApiError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode?: number
  ) {
    super(message);
    this.name = 'ZohoApiError';
  }
}

/**
 * Erreur d'authentification Zoho
 */
export class ZohoAuthError extends Error {
  constructor(
    message: string,
    public code: ZohoOAuthError | string,
    public needsReauthorization: boolean = false
  ) {
    super(message);
    this.name = 'ZohoAuthError';
  }
}
