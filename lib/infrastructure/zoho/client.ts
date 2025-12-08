/**
 * @file lib/infrastructure/zoho/client.ts
 * @description Client API Zoho Analytics
 *
 * Gère les appels à l'API Zoho Analytics :
 * - Liste des workspaces
 * - Liste des tables/vues
 * - Colonnes d'une table
 * - Import de données
 *
 * Documentation : https://www.zoho.com/analytics/api/
 */

import { getTokens } from './auth';
import {
  ZohoTokens,
  ZohoWorkspace,
  ZohoTable,
  ZohoFolder,
  ZohoColumn,
  ZohoImportParams,
  ZohoImportResponse,
  ZohoApiError,
  ZohoAuthError,
  ZohoImportType,
  IMPORT_MODE_TO_ZOHO,
} from './types';

// ==================== TYPES INTERNES ====================

interface ZohoWorkspaceResponse {
  workspaceId: string;
  workspaceName: string;
  workspaceDesc?: string;
  createdBy?: string;
  createdTime?: string;
  isDefault?: boolean;
}

interface ZohoViewResponse {
  viewId: string;
  viewName: string;
  viewDesc?: string;
  viewType: string;
  createdBy?: string;
  createdTime?: string;
  folderId?: string;
}

interface ZohoColumnResponse {
  columnName: string;
  columnDesc?: string;
  dataType: string;
  isUnique?: boolean;
  isLookup?: boolean;
  isMandatory?: boolean;
}

// ==================== MAPPERS ====================

function mapWorkspace(ws: ZohoWorkspaceResponse): ZohoWorkspace {
  return {
    workspaceId: ws.workspaceId,
    workspaceName: ws.workspaceName,
    workspaceDesc: ws.workspaceDesc,
    createdBy: ws.createdBy,
    createdTime: ws.createdTime,
    isDefault: ws.isDefault,
  };
}

function mapTable(view: ZohoViewResponse): ZohoTable {
  return {
    viewId: view.viewId,
    viewName: view.viewName,
    viewDesc: view.viewDesc,
    viewType: view.viewType as ZohoTable['viewType'],
    createdBy: view.createdBy,
    createdTime: view.createdTime,
    folderId: view.folderId,
  };
}

function mapColumn(col: ZohoColumnResponse): ZohoColumn {
  return {
    columnName: col.columnName,
    columnDesc: col.columnDesc,
    dataType: col.dataType as ZohoColumn['dataType'],
    isUnique: col.isUnique,
    isLookup: col.isLookup,
    isMandatory: col.isMandatory,
  };
}

// ==================== CLIENT CLASS ====================

/**
 * Client pour l'API Zoho Analytics
 */
export class ZohoAnalyticsClient {
  private tokens: ZohoTokens;

  constructor(tokens: ZohoTokens) {
    this.tokens = tokens;
  }

  /**
   * Crée un client pour un utilisateur donné
   * Récupère et rafraîchit automatiquement les tokens
   *
   * @param userId - ID de l'utilisateur Supabase
   * @returns Client initialisé ou null si non connecté
   */
  static async forUser(userId: string): Promise<ZohoAnalyticsClient | null> {
    const tokens = await getTokens(userId);

    if (!tokens) {
      return null;
    }

    return new ZohoAnalyticsClient(tokens);
  }

  /**
   * Effectue une requête authentifiée vers l'API Zoho
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.tokens.apiDomain}/restapi/v2${endpoint}`;

    // Construire les headers avec ZANALYTICS-ORGID si disponible
    const headers: Record<string, string> = {
      'Authorization': `Zoho-oauthtoken ${this.tokens.accessToken}`,
    };

    // Ajouter l'orgId si disponible (REQUIS pour certains endpoints comme /views)
    if (this.tokens.orgId) {
      headers['ZANALYTICS-ORGID'] = this.tokens.orgId;
    }

    // DEBUG - À supprimer après résolution
    console.log('=== ZOHO API REQUEST ===');
    console.log('URL:', url);
    console.log('API Domain:', this.tokens.apiDomain);
    console.log('Org ID:', this.tokens.orgId || 'NON DÉFINI');
    console.log('Token (10 premiers chars):', this.tokens.accessToken?.substring(0, 10) + '...');

    const response = await fetch(url, {
      ...options,
      headers: {
        ...headers,
        ...options.headers,
      },
    });

    // Gérer les erreurs HTTP
    if (!response.ok) {
      const errorText = await response.text();

      // DEBUG - À supprimer après résolution
      console.log('=== ZOHO API ERROR ===');
      console.log('Status:', response.status);
      console.log('Response:', errorText);

      let errorData: { message?: string; code?: string; error_message?: string } = {};

      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { message: errorText };
      }

      // Token expiré ou invalide
      if (response.status === 401) {
        throw new ZohoAuthError(
          'Token Zoho invalide ou expiré',
          'invalid_grant',
          true
        );
      }

      throw new ZohoApiError(
        errorData.message || errorData.error_message || `Erreur API Zoho : ${response.status}`,
        errorData.code || 'API_ERROR',
        response.status
      );
    }

    return response.json();
  }

  /**
   * Effectue une requête POST avec form data
   */
  private async postForm<T>(
    endpoint: string,
    formData: Record<string, string>
  ): Promise<T> {
    const url = `${this.tokens.apiDomain}/restapi/v2${endpoint}`;

    const body = new URLSearchParams(formData);

    // Construire les headers avec ZANALYTICS-ORGID si disponible
    const headers: Record<string, string> = {
      'Authorization': `Zoho-oauthtoken ${this.tokens.accessToken}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    };

    // Ajouter l'orgId si disponible (REQUIS pour l'import)
    if (this.tokens.orgId) {
      headers['ZANALYTICS-ORGID'] = this.tokens.orgId;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: body.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorData: { message?: string; code?: string; error_message?: string } = {};

      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { message: errorText };
      }

      if (response.status === 401) {
        throw new ZohoAuthError(
          'Token Zoho invalide ou expiré',
          'invalid_grant',
          true
        );
      }

      throw new ZohoApiError(
        errorData.message || errorData.error_message || `Erreur API Zoho : ${response.status}`,
        errorData.code || 'API_ERROR',
        response.status
      );
    }

    return response.json();
  }

  // ==================== ORGANIZATIONS ====================

  /**
   * Récupère les organisations de l'utilisateur
   */
  async getOrganizations(): Promise<{ orgId: string; orgName: string }[]> {
    interface OrgResponse {
      data: {
        orgs: Array<{ orgId: string; orgName: string }>
      };
    }

    const response = await this.request<OrgResponse>('/orgs');
    return response.data?.orgs || [];
  }

  // ==================== WORKSPACES ====================

  /**
   * Liste tous les workspaces accessibles
   */
  async getWorkspaces(): Promise<ZohoWorkspace[]> {
    interface WorkspacesResponse {
      data: {
        ownedWorkspaces?: ZohoWorkspaceResponse[];
        sharedWorkspaces?: ZohoWorkspaceResponse[];
      };
    }

    const response = await this.request<WorkspacesResponse>('/workspaces');

    const owned = response.data?.ownedWorkspaces || [];
    const shared = response.data?.sharedWorkspaces || [];

    return [...owned, ...shared].map(mapWorkspace);
  }

  /**
   * Récupère les détails d'un workspace
   */
  async getWorkspace(workspaceId: string): Promise<ZohoWorkspace | null> {
    interface WorkspaceResponse {
      data: { workspaces: ZohoWorkspaceResponse[] };
    }

    try {
      const response = await this.request<WorkspaceResponse>(
        `/workspaces/${workspaceId}`
      );

      const ws = response.data?.workspaces?.[0];
      return ws ? mapWorkspace(ws) : null;
    } catch (error) {
      if (error instanceof ZohoApiError && error.statusCode === 404) {
        return null;
      }
      throw error;
    }
  }

  // ==================== TABLES / VIEWS ====================

  /**
   * Liste toutes les tables d'un workspace
   *
   * @param workspaceId - ID du workspace
   * @param onlyTables - Si true, filtre uniquement les tables (pas les charts, pivots, etc.)
   */
 async getTables(workspaceId: string, onlyTables: boolean = true): Promise<ZohoTable[]> {
    interface ViewsResponse {
      data: { views: ZohoViewResponse[] };
    }

    const response = await this.request<ViewsResponse>(
      `/workspaces/${workspaceId}/views`
    );

    // DEBUG - Voir la réponse complète
    console.log('=== DEBUG getTables ===');
    console.log('Response complète:', JSON.stringify(response, null, 2).substring(0, 2000));
    console.log('Clés niveau racine:', Object.keys(response));
    console.log('response.data:', response.data);
    console.log('response.data?.views:', response.data?.views);

    let views = response.data?.views || [];
    console.log('Nombre de views:', views.length);

    // Filtrer pour ne garder que les tables si demandé
   if (onlyTables) {
  views = views.filter(v => {
    const type = v.viewType?.toLowerCase();
    return type === 'table' || type === 'querytable';
  });
}

    return views.map(mapTable);
  }

/**
   * Récupère les colonnes d'une table
   * Utilise l'endpoint /views/{viewId} avec CONFIG.withInvolvedMetaInfo
   */
  async getColumns(workspaceId: string, viewId: string): Promise<ZohoColumn[]> {
    // Le bon endpoint est /views/{viewId} avec le paramètre CONFIG
    const config = { withInvolvedMetaInfo: true };
    const configEncoded = encodeURIComponent(JSON.stringify(config));
    
    interface ViewDetailsResponse {
      status: string;
      data: {
        views: {
          viewId: string;
          viewName: string;
          viewType: string;
          columns?: Array<{
            columnName: string;
            columnDesc?: string;
            dataType: string;
            isUnique?: boolean;
            isLookup?: boolean;
            isMandatory?: boolean;
          }>;
        };
      };
    }

    console.log('[getColumns] Fetching columns for view:', viewId);
    
    const response = await this.request<ViewDetailsResponse>(
      `/views/${viewId}?CONFIG=${configEncoded}`
    );

    console.log('[getColumns] Response:', JSON.stringify(response.data?.views, null, 2).substring(0, 500));

    const columns = response.data?.views?.columns || [];
    
    return columns.map(col => ({
      columnName: col.columnName,
      columnDesc: col.columnDesc,
      dataType: col.dataType as ZohoColumn['dataType'],
      isUnique: col.isUnique,
      isLookup: col.isLookup,
      isMandatory: col.isMandatory,
    }));
  }

  

  // ==================== FOLDERS ====================

  /**
   * Liste les dossiers d'un workspace
   */
  async getFolders(workspaceId: string): Promise<ZohoFolder[]> {
    interface FolderResponse {
      folderId: string;
      folderName: string;
      folderDesc?: string;
      folderIndex?: number;
      isDefault?: boolean;
      parentFolderId?: string;
    }

    interface FoldersResponse {
      data: { folders: FolderResponse[] };
    }

    try {
      const response = await this.request<FoldersResponse>(
        `/workspaces/${workspaceId}/folders`
      );

      return (response.data?.folders || []).map(f => ({
        folderId: f.folderId,
        folderName: f.folderName,
        folderDesc: f.folderDesc,
        folderIndex: f.folderIndex,
        isDefault: f.isDefault,
        parentFolderId: f.parentFolderId,
      }));
    } catch (error) {
      console.error('Erreur r�cup�ration folders:', error);
      return []; // Retourner tableau vide si pas de dossiers
    }
  }

  // ==================== IMPORT ====================

  /**
   * Importe des données dans une table
   *
   * @param params - Paramètres d'import
   * @returns Résultat de l'import
   */
  
 async importData(params: ZohoImportParams): Promise<ZohoImportResponse> {
  const {
    workspaceId,
    viewId,
    viewName,
    importType,
    data,
    autoIdentify = true,
    dateFormat = 'dd/MM/yyyy',
    matchingColumns,
  } = params;

  // Nettoyer les données CSV
  const cleanedData = this.cleanCsvData(data);
  
  // DEBUG
  console.log('[Zoho Import] CSV nettoyé (500 premiers chars):');
  console.log(cleanedData.substring(0, 500));
  console.log('[Zoho Import] Headers:', cleanedData.split('\n')[0]);

  // Construire le CONFIG JSON
  const config: Record<string, any> = {
    importType: importType.toLowerCase(), // append, truncateadd, updateadd, etc.
    fileType: 'csv',
    autoIdentify: autoIdentify,
  };

  if (dateFormat) {
    config.dateFormat = dateFormat;
  }

  if (matchingColumns && matchingColumns.length > 0) {
    config.matchingColumns = matchingColumns;
  }

  // Encoder le CONFIG pour le query string
  const configEncoded = encodeURIComponent(JSON.stringify(config));
  
  // URL avec viewId et CONFIG dans query string
  const url = `${this.tokens.apiDomain}/restapi/v2/workspaces/${workspaceId}/views/${viewId}/data?CONFIG=${configEncoded}`;

  // Créer FormData avec FILE (pas ZOHO_FILE)
  const formData = new FormData();
  const csvBlob = new Blob([cleanedData], { type: 'text/csv; charset=utf-8' });
  formData.append('FILE', csvBlob, 'import.csv');

  const headers: Record<string, string> = {
    'Authorization': `Zoho-oauthtoken ${this.tokens.accessToken}`,
  };

  if (this.tokens.orgId) {
    headers['ZANALYTICS-ORGID'] = this.tokens.orgId;
  }

  // Log minimal
  console.log('[Zoho Import] URL:', url);
  console.log('[Zoho Import] Config:', JSON.stringify(config));
  console.log('[Zoho Import] Rows:', cleanedData.split('\n').length - 1);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: formData,
    });

    const responseText = await response.text();
    console.log('[Zoho Import] Status:', response.status);

    let responseData: any;
    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = { message: responseText };
    }

    if (!response.ok) {
      console.error('[Zoho Import] Error:', JSON.stringify(responseData, null, 2));
      
      if (response.status === 401) {
        throw new ZohoAuthError('Token Zoho invalide ou expiré', 'invalid_grant', true);
      }

      throw new ZohoApiError(
        responseData.data?.errorMessage || responseData.message || `Erreur API Zoho : ${response.status}`,
        responseData.data?.errorCode || responseData.error_code || 'API_ERROR',
        response.status
      );
    }

    console.log('[Zoho Import] Success:', JSON.stringify(responseData.data?.importSummary));

    if (responseData.status === 'success' && responseData.data) {
      return {
        status: 'success',
        importId: responseData.data?.importId,
        importSummary: {
          totalRowCount: responseData.data.importSummary?.totalRowCount || 0,
          successRowCount: responseData.data.importSummary?.successRowCount || 0,
          warningCount: responseData.data.importSummary?.warnings || 0,
          failedRowCount: 0,
          columnCount: responseData.data.importSummary?.totalColumnCount || 0,
          importType: responseData.data.importSummary?.importType || importType,
          importTime: new Date().toISOString(),
        },
        importErrors: responseData.data.importErrors ? 
          (typeof responseData.data.importErrors === 'string' ? undefined : responseData.data.importErrors) 
          : undefined,
      };
    }

    return {
      status: 'error',
      errorMessage: responseData.data?.errorMessage || responseData.message || 'Erreur inconnue',
      errorCode: responseData.data?.errorCode || responseData.error_code,
    };

  } catch (error) {
    if (error instanceof ZohoApiError || error instanceof ZohoAuthError) {
      throw error;
    }
    console.error('[Zoho Import] Exception:', error);
    return {
      status: 'error',
      errorMessage: error instanceof Error ? error.message : 'Erreur lors de l\'import',
    };
  }
}

  /**
   * Nettoie les données CSV pour éviter les erreurs d'import
   */
  private cleanCsvData(data: string): string {
    return data
      .split('\n')
      .map(line => {
        // Trim chaque cellule tout en préservant les guillemets
        return line.split(',').map(cell => {
          const trimmed = cell.trim();
          // Si la cellule est entre guillemets, trim l'intérieur aussi
          if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
            const inner = trimmed.slice(1, -1).trim();
            return `"${inner}"`;
          }
          return trimmed;
        }).join(',');
      })
      .filter(line => line.trim() !== '') // Supprimer lignes vides
      .join('\n');
  }

  /**
   * Importe des données par lots (pour les gros fichiers)
   *
   * @param params - Paramètres d'import
   * @param batchSize - Nombre de lignes par lot (défaut: 5000)
   * @param onProgress - Callback de progression
   */
  async importDataBatched(
    params: Omit<ZohoImportParams, 'data'> & { rows: string[][] },
    batchSize: number = 5000,
    onProgress?: (progress: { current: number; total: number; batch: number }) => void
  ): Promise<ZohoImportResponse> {
    const { rows, ...restParams } = params;

    if (rows.length === 0) {
      return {
        status: 'error',
        errorMessage: 'Aucune donnée à importer',
      };
    }

    // Première ligne = headers
    const headers = rows[0];
    const dataRows = rows.slice(1);
    const totalRows = dataRows.length;

    if (totalRows <= batchSize) {
      // Pas besoin de batching
      const csvData = rowsToCsv([headers, ...dataRows]);
      return this.importData({ ...restParams, data: csvData });
    }

    // Import par lots
    let totalImported = 0;
    let totalFailed = 0;
    let batchNumber = 0;
    const allErrors: ZohoImportResponse['importErrors'] = [];

    // Premier lot : utiliser le type d'import demandé
    // Lots suivants : toujours APPEND
    let currentImportType = restParams.importType;

    for (let i = 0; i < totalRows; i += batchSize) {
      batchNumber++;
      const batchRows = dataRows.slice(i, i + batchSize);
      const csvData = rowsToCsv([headers, ...batchRows]);

      onProgress?.({
        current: Math.min(i + batchSize, totalRows),
        total: totalRows,
        batch: batchNumber,
      });

      const result = await this.importData({
        ...restParams,
        importType: currentImportType,
        data: csvData,
      });

      if (result.status === 'error') {
        return {
          status: 'error',
          errorMessage: `Erreur au lot ${batchNumber}: ${result.errorMessage}`,
          errorCode: result.errorCode,
        };
      }

      totalImported += result.importSummary?.successRowCount || 0;
      totalFailed += result.importSummary?.failedRowCount || 0;

      if (result.importErrors) {
        // Ajuster les index de ligne pour le contexte global
        allErrors.push(...result.importErrors.map(e => ({
          ...e,
          rowIndex: e.rowIndex + i,
        })));
      }

      // Après le premier lot, passer en APPEND
      currentImportType = 'APPEND';
    }

    return {
      status: totalFailed === 0 ? 'success' : 'error',
      importSummary: {
        totalRowCount: totalRows,
        successRowCount: totalImported,
        warningCount: 0,
        failedRowCount: totalFailed,
        columnCount: headers.length,
        importType: restParams.importType,
        importTime: new Date().toISOString(),
      },
      importErrors: allErrors.length > 0 ? allErrors : undefined,
    };
  }
// ==================== EXPORT / READ DATA ====================

  /**
   * Lit des données depuis une table Zoho
   * Utilisé pour la vérification post-import
   */
  async exportData(
    workspaceId: string,
    viewId: string,
    options: {
      criteria?: string;
      selectedColumns?: string[];
      limit?: number;
    } = {}
  ): Promise<{ data: Record<string, unknown>[]; rowCount: number }> {
    const { criteria, selectedColumns, limit } = options;

    // Construire le CONFIG
    const config: Record<string, unknown> = {
      responseFormat: 'json',
    };

    if (criteria) {
      config.criteria = criteria;
    }

    if (selectedColumns && selectedColumns.length > 0) {
      config.selectedColumns = selectedColumns;
    }

    // Encoder le CONFIG
    const configEncoded = encodeURIComponent(JSON.stringify(config));

    const url = `/workspaces/${workspaceId}/views/${viewId}/data?CONFIG=${configEncoded}`;

    console.log('[Zoho Export] URL:', url);
    console.log('[Zoho Export] Config:', JSON.stringify(config));

    // La réponse Zoho a le format : { data: [...rows...] }
    interface ExportResponse {
      status?: string;
      data: Record<string, unknown>[];  // ← C'est directement un tableau !
    }

    const response = await this.request<ExportResponse>(url);

    // response.data EST le tableau de lignes directement
    const rows = Array.isArray(response.data) ? response.data : [];
    const totalRowCount = rows.length;

    // Appliquer la limite côté client si nécessaire
    const limitedRows = limit ? rows.slice(0, limit) : rows;

    console.log('[Zoho Export] Rows fetched:', limitedRows.length, '/', totalRowCount);

    return {
      data: limitedRows,
      rowCount: totalRowCount,
    };
  }

  // ==================== EXPORT ASYNC (pour QueryTables) ====================

  /**
   * Export asynchrone des données - requis pour les QueryTables et Dashboards
   * 
   * Flow:
   * 1. Créer un job d'export
   * 2. Poll jusqu'à completion (jobCode 1004)
   * 3. Télécharger les données
   * 
   * @param workspaceId - ID du workspace
   * @param viewId - ID de la vue (QueryTable, etc.)
   * @param options - Options d'export
   * @returns Données exportées
   */
  async exportDataAsync(
    workspaceId: string,
    viewId: string,
    options: {
      criteria?: string;
      responseFormat?: 'json' | 'csv';
      maxWaitSeconds?: number;
    } = {}
  ): Promise<{ data: Record<string, unknown>[]; rowCount: number }> {
    const { 
      criteria, 
      responseFormat = 'json',
      maxWaitSeconds = 60 
    } = options;

    // Helper pour pause
    const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    // === ÉTAPE 1: Créer le job d'export ===
    const config: Record<string, string> = { responseFormat };
    if (criteria) {
      config.criteria = criteria;
    }
    const configEncoded = encodeURIComponent(JSON.stringify(config));

    const createUrl = `/bulk/workspaces/${workspaceId}/views/${viewId}/data?CONFIG=${configEncoded}`;
    
    console.log('[ExportAsync] Creating job for view:', viewId);

    interface CreateJobResponse {
      status: string;
      data?: { jobId: string };
    }

    const createResponse = await this.request<CreateJobResponse>(createUrl);

    if (createResponse.status !== 'success' || !createResponse.data?.jobId) {
      throw new ZohoApiError(
        'Échec de la création du job d\'export',
        'EXPORT_JOB_CREATE_FAILED',
        400
      );
    }

    const jobId = createResponse.data.jobId;
    console.log('[ExportAsync] Job created:', jobId);

    // === ÉTAPE 2: Poll jusqu'à completion ===
    interface JobStatusResponse {
      status: string;
      data?: {
        jobId: string;
        jobCode: string;
        jobStatus: string;
        downloadUrl?: string;
      };
    }

    let jobStatus: JobStatusResponse | null = null;
    let attempts = 0;
    const maxAttempts = maxWaitSeconds; // 1 poll par seconde

    while (attempts < maxAttempts) {
      await sleep(1000);
      attempts++;

      const statusUrl = `/bulk/workspaces/${workspaceId}/exportjobs/${jobId}`;
      jobStatus = await this.request<JobStatusResponse>(statusUrl);

      const code = jobStatus.data?.jobCode;
      console.log(`[ExportAsync] Poll ${attempts}: code=${code}, status=${jobStatus.data?.jobStatus}`);

      if (code === '1004') {
        // Job terminé !
        break;
      }

      if (code === '1003') {
        throw new ZohoApiError(
          'Job d\'export échoué',
          'EXPORT_JOB_FAILED',
          500
        );
      }
    }

    if (attempts >= maxAttempts) {
      throw new ZohoApiError(
        `Timeout: le job d'export n'a pas terminé en ${maxWaitSeconds}s`,
        'EXPORT_JOB_TIMEOUT',
        408
      );
    }

    // === ÉTAPE 3: Télécharger les données ===
    const downloadUrl = `${this.tokens.apiDomain}/restapi/v2/bulk/workspaces/${workspaceId}/exportjobs/${jobId}/data`;
    
    console.log('[ExportAsync] Downloading data...');

    const headers: Record<string, string> = {
      'Authorization': `Zoho-oauthtoken ${this.tokens.accessToken}`,
    };
    if (this.tokens.orgId) {
      headers['ZANALYTICS-ORGID'] = this.tokens.orgId;
    }

    const downloadResponse = await fetch(downloadUrl, {
      method: 'GET',
      headers,
    });

    if (!downloadResponse.ok) {
      throw new ZohoApiError(
        'Échec du téléchargement des données',
        'EXPORT_DOWNLOAD_FAILED',
        downloadResponse.status
      );
    }

    const contentType = downloadResponse.headers.get('content-type');
    
    if (contentType?.includes('application/json')) {
      interface DownloadResponse {
        data: Record<string, unknown>[];
      }
      const result = await downloadResponse.json() as DownloadResponse;
      const rows = Array.isArray(result.data) ? result.data : [];
      
      console.log('[ExportAsync] Downloaded', rows.length, 'rows');
      
      return {
        data: rows,
        rowCount: rows.length,
      };
    } else {
      // CSV - parser manuellement
      const csvText = await downloadResponse.text();
      const rows = this.parseCSVToObjects(csvText);
      
      console.log('[ExportAsync] Downloaded', rows.length, 'rows (CSV)');
      
      return {
        data: rows,
        rowCount: rows.length,
      };
    }
  }

  /**
   * Parse CSV en tableau d'objets
   */
  private parseCSVToObjects(csvText: string): Record<string, unknown>[] {
    const lines = csvText.trim().split('\n');
    if (lines.length < 2) return [];

    // Parser les headers
    const headers = this.parseCSVLine(lines[0]);
    
    // Parser les données
    return lines.slice(1).map(line => {
      const values = this.parseCSVLine(line);
      const obj: Record<string, unknown> = {};
      headers.forEach((header, i) => {
        obj[header] = values[i] || '';
      });
      return obj;
    });
  }

  /**
   * Parse une ligne CSV (gestion des guillemets)
   */
  private parseCSVLine(line: string): string[] {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim());

    return values;
  }

  /**
   * Construit un critère SQL pour filtrer sur une colonne
   * Utilisé pour la vérification post-import (mode UPDATE)
   *
   * @param column - Nom de la colonne
   * @param values - Valeurs à filtrer
   * @returns Critère SQL formaté pour Zoho
   */
  static buildInCriteria(column: string, values: string[]): string {
    const escapedValues = values.map(v => `'${v.replace(/'/g, "''")}'`);
    return `"${column}" IN (${escapedValues.join(',')})`;
  }


  // ==================== DELETE DATA ====================

  /**
   * Supprime des lignes dans une table Zoho
   * Utilisé pour le rollback après un import test
   * 
   * @param workspaceId - ID du workspace
   * @param viewId - ID de la table/vue
   * @param criteria - Critère SQL de suppression (ex: "\"NuméroQuittance\" IN ('val1','val2')")
   * @returns Nombre de lignes supprimées
   */
async deleteData(
  workspaceId: string,
  viewId: string,
  criteria: string
): Promise<{ deletedRows: number }> {
  console.log('[Zoho Delete] Criteria:', criteria);

  // Construire les headers
  const headers: Record<string, string> = {
    'Authorization': `Zoho-oauthtoken ${this.tokens.accessToken}`,
  };

  if (this.tokens.orgId) {
    headers['ZANALYTICS-ORGID'] = this.tokens.orgId;
  }

  // CONFIG encodé dans l'URL
  const config = JSON.stringify({ criteria });
  const configEncoded = encodeURIComponent(config);
  
  // IMPORTANT: utiliser /rows et non /data
  const url = `/workspaces/${workspaceId}/views/${viewId}/rows?CONFIG=${configEncoded}`;
  const fullUrl = `${this.tokens.apiDomain}/restapi/v2${url}`;
  
  console.log('[Zoho Delete] URL:', fullUrl);
  console.log('[Zoho Delete] CONFIG:', config);

  // Méthode DELETE standard
  const response = await fetch(fullUrl, {
    method: 'DELETE',
    headers,
  });

  console.log('[Zoho Delete] Status:', response.status);

  const responseText = await response.text();
  let data;
  try {
    data = JSON.parse(responseText);
  } catch {
    data = { raw: responseText };
  }

  console.log('[Zoho Delete] Response:', JSON.stringify(data, null, 2));

  if (!response.ok) {
    throw new ZohoApiError(
      data?.data?.errorMessage || data?.message || 'Delete failed',
      data?.data?.errorCode || response.status,
      response.status
    );
  }

  return {
    deletedRows: data?.data?.deletedRows || data?.deletedRows || 0,
  };
}
  
  // ==================== HELPERS ====================

  /**
   * Récupère l'email de l'utilisateur Zoho connecté
   */
  async getCurrentUserEmail(): Promise<string | null> {
    try {
      const orgs = await this.getOrganizations();
      // L'API ne retourne pas directement l'email, on pourrait le récupérer autrement
      return this.tokens.zohoEmail || null;
    } catch {
      return null;
    }
  }
}

// ==================== UTILITAIRES ====================

/**
 * Convertit un tableau de lignes en CSV
 */
function rowsToCsv(rows: string[][]): string {
  return rows.map(row =>
    row.map(cell => {
      // Échapper les guillemets et entourer si nécessaire
      const escaped = String(cell ?? '').replace(/"/g, '""');
      if (escaped.includes(',') || escaped.includes('"') || escaped.includes('\n')) {
        return `"${escaped}"`;
      }
      return escaped;
    }).join(',')
  ).join('\n');
}

/**
 * Convertit un mode d'import de l'app vers le type Zoho
 */
export function getZohoImportType(appMode: string): ZohoImportType {
  return IMPORT_MODE_TO_ZOHO[appMode] || 'APPEND';
}
