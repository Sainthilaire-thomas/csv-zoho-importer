// lib/domain/profile/profile-manager.ts
// Service de gestion des profils d'import côté client

import {
  ImportProfile,
  ProfileMatchResult,
  DetectedColumn,
  CreateProfilePayload,
  UpdateProfilePayload,
  ProfileUpdateFromImport,
  ColumnMapping,
  ProfileColumn,
  ZohoDataType,
} from '@/types/profiles';

// =============================================================================
// TYPES INTERNES
// =============================================================================

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  count?: number;
}

interface MatchApiResponse {
  success: boolean;
  data?: {
    matches: ProfileMatchResult[];
    totalProfiles: number;
    fileColumnsCount: number;
  };
  error?: string;
}

// =============================================================================
// PROFILE MANAGER CLASS
// =============================================================================

export class ProfileManager {
  private baseUrl = '/api/profiles';

  // ===========================================================================
  // CRUD OPERATIONS
  // ===========================================================================

  /**
   * Récupère tous les profils
   */
  async getAll(workspaceId?: string): Promise<ImportProfile[]> {
    const url = workspaceId 
      ? `${this.baseUrl}?workspaceId=${workspaceId}`
      : this.baseUrl;
    
    const response = await fetch(url);
    const data: ApiResponse<ImportProfile[]> = await response.json();
    
    if (!data.success || !data.data) {
      throw new Error(data.error || 'Erreur lors de la récupération des profils');
    }
    
    return data.data;
  }

  /**
   * Récupère un profil par son ID
   */
  async getById(id: string): Promise<ImportProfile> {
    const response = await fetch(`${this.baseUrl}/${id}`);
    const data: ApiResponse<ImportProfile> = await response.json();
    
    if (!data.success || !data.data) {
      throw new Error(data.error || 'Profil non trouvé');
    }
    
    return data.data;
  }

  /**
   * Récupère le profil associé à une table Zoho (par viewId)
   */
  async getByViewId(viewId: string): Promise<ImportProfile | null> {
    const url = `${this.baseUrl}?viewId=${viewId}`;
    const response = await fetch(url);
    const data: ApiResponse<ImportProfile[]> = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || 'Erreur lors de la récupération du profil');
    }
    
    return data.data && data.data.length > 0 ? data.data[0] : null;
  }

  /**
   * Crée un nouveau profil
   */
  async create(payload: CreateProfilePayload): Promise<ImportProfile> {
    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    
    const data: ApiResponse<ImportProfile> = await response.json();
    
    if (!data.success || !data.data) {
      throw new Error(data.error || 'Erreur lors de la création du profil');
    }
    
    return data.data;
  }

  /**
   * Met à jour un profil
   */
  async update(id: string, payload: UpdateProfilePayload): Promise<ImportProfile> {
    const response = await fetch(`${this.baseUrl}/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    
    const data: ApiResponse<ImportProfile> = await response.json();
    
    if (!data.success || !data.data) {
      throw new Error(data.error || 'Erreur lors de la mise à jour du profil');
    }
    
    return data.data;
  }

  /**
   * Met à jour un profil après un import (nouveaux alias/formats)
   */
  async updateFromImport(
    id: string, 
    updates: ProfileUpdateFromImport
  ): Promise<ImportProfile> {
    const response = await fetch(`${this.baseUrl}/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    
    const data: ApiResponse<ImportProfile> = await response.json();
    
    if (!data.success || !data.data) {
      throw new Error(data.error || 'Erreur lors de la mise à jour du profil');
    }
    
    return data.data;
  }

  /**
   * Supprime un profil
   */
  async delete(id: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/${id}`, {
      method: 'DELETE',
    });
    
    const data: ApiResponse<void> = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || 'Erreur lors de la suppression du profil');
    }
  }

  // ===========================================================================
  // MATCHING
  // ===========================================================================

  /**
   * Recherche les profils compatibles avec les colonnes d'un fichier
   */
  async findMatchingProfiles(
    fileColumns: DetectedColumn[],
    workspaceId?: string
  ): Promise<ProfileMatchResult[]> {
    const response = await fetch(`${this.baseUrl}/match`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileColumns, workspaceId }),
    });
    
    const data: MatchApiResponse = await response.json();
    
    if (!data.success || !data.data) {
      throw new Error(data.error || 'Erreur lors de la recherche de profils');
    }
    
    return data.data.matches;
  }

  /**
   * Trouve le meilleur profil pour un fichier
   * Retourne null si aucun profil compatible
   */
  async findBestMatch(
    fileColumns: DetectedColumn[],
    workspaceId?: string
  ): Promise<ProfileMatchResult | null> {
    const matches = await this.findMatchingProfiles(fileColumns, workspaceId);
    return matches.length > 0 ? matches[0] : null;
  }

  // ===========================================================================
  // CRÉATION DE PROFIL DEPUIS SCHÉMA ZOHO
  // ===========================================================================

  /**
   * Crée un profil à partir du schéma d'une table Zoho
   */
  createProfileFromZohoSchema(
    name: string,
    workspace: { id: string; name: string },
    view: { id: string; name: string },
    zohoColumns: ZohoColumnInfo[],
    fileColumns?: DetectedColumn[]
  ): CreateProfilePayload {
    const columns: Omit<ProfileColumn, 'id'>[] = zohoColumns.map(zohoCol => {
      // Trouver la colonne du fichier qui correspond (si fournie)
      const fileCol = fileColumns?.find(fc => 
        this.normalizeColumnName(fc.name) === this.normalizeColumnName(zohoCol.columnName)
      );

      // Déterminer le type de données
      const dataType = this.zohoTypeToDataType(zohoCol.dataType);
      
      // Créer la configuration par défaut
      const config = this.createDefaultConfig(dataType, zohoCol.dataType, fileCol);

      return {
        zohoColumn: zohoCol.columnName,
        zohoType: zohoCol.dataType,
        isRequired: zohoCol.isMandatory || false,
        acceptedNames: [zohoCol.columnName],
        dataType,
        config,
      };
    });

    return {
      name,
      workspaceId: workspace.id,
      workspaceName: workspace.name,
      viewId: view.id,
      viewName: view.name,
      columns,
      defaultImportMode: 'append',
    };
  }

  // ===========================================================================
  // HELPERS
  // ===========================================================================

  /**
   * Normalise un nom de colonne pour la comparaison
   */
  private normalizeColumnName(name: string): string {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Supprimer accents
      .replace(/[^a-z0-9]/g, '');      // Garder que alphanumérique
  }

  /**
   * Convertit un type Zoho en type de données du profil
   */
  private zohoTypeToDataType(zohoType: ZohoDataType): ProfileColumn['dataType'] {
    switch (zohoType) {
      case 'DATE':
      case 'DATE_AS_DATE':
        return 'date';
      case 'DURATION':
        return 'duration';
      case 'NUMBER':
      case 'POSITIVE_NUMBER':
      case 'DECIMAL_NUMBER':
      case 'CURRENCY':
      case 'PERCENT':
      case 'AUTO_NUMBER':
        return 'number';
      case 'BOOLEAN':
        return 'boolean';
      default:
        return 'text';
    }
  }

  /**
   * Crée une configuration par défaut pour un type de données
   */
  private createDefaultConfig(
    dataType: ProfileColumn['dataType'],
    zohoType: ZohoDataType,
    fileCol?: DetectedColumn
  ): ProfileColumn['config'] {
    switch (dataType) {
      case 'date':
        return {
          type: 'date',
          acceptedFormats: fileCol?.detectedFormat 
            ? [fileCol.detectedFormat] 
            : ['DD/MM/YYYY', 'YYYY-MM-DD'],
          dayMonthOrder: 'dmy', // Par défaut français
          outputFormat: 'iso',
        };
      
      case 'duration':
        return {
          type: 'duration',
          acceptedFormats: fileCol?.detectedFormat
            ? [fileCol.detectedFormat]
            : ['HH:mm', 'HH:mm:ss'],
          outputFormat: 'hms',
        };
      
      case 'number':
        return {
          type: 'number',
          acceptedFormats: [
            { decimalSeparator: ',', thousandSeparator: ' ' },  // FR: 1 234,56
            { decimalSeparator: '.', thousandSeparator: null }, // US: 1234.56
          ],
          expandScientific: zohoType === 'PLAIN', // Développer si c'est du texte
          outputFormat: 'standard',
        };
      
      case 'boolean':
        return {
          type: 'boolean',
          trueValues: ['Oui', 'Yes', '1', 'Vrai', 'true', 'O'],
          falseValues: ['Non', 'No', '0', 'Faux', 'false', 'N'],
        };
      
      case 'text':
      default:
        return {
          type: 'text',
          trim: true,
          emptyValues: ['N/A', 'null', '-', 'NA', 'n/a'],
          expandScientific: true, // Développer notation scientifique dans le texte
        };
    }
  }
}

// =============================================================================
// TYPES POUR LES COLONNES ZOHO
// =============================================================================

export interface ZohoColumnInfo {
  columnName: string;
  columnDesc?: string;
  dataType: ZohoDataType;
  isUnique?: boolean;
  isLookup?: boolean;
  isMandatory?: boolean;
}

// =============================================================================
// INSTANCE SINGLETON
// =============================================================================

export const profileManager = new ProfileManager();

// =============================================================================
// HOOKS HELPERS
// =============================================================================

/**
 * Vérifie si un profil nécessite des confirmations utilisateur
 */
export function profileNeedsConfirmation(matchResult: ProfileMatchResult): boolean {
  return matchResult.needsConfirmation;
}

/**
 * Récupère les colonnes qui nécessitent une confirmation
 */
export function getColumnsNeedingConfirmation(
  matchResult: ProfileMatchResult
): ColumnMapping[] {
  return matchResult.mappings.filter(m => m.needsConfirmation);
}

/**
 * Récupère les colonnes nouvelles (non mappées)
 */
export function getNewColumns(matchResult: ProfileMatchResult): ColumnMapping[] {
  return matchResult.mappings.filter(m => m.status === 'new');
}

/**
 * Récupère les colonnes manquantes (obligatoires dans Zoho mais absentes du fichier)
 */
export function getMissingColumns(matchResult: ProfileMatchResult): ColumnMapping[] {
  return matchResult.mappings.filter(m => m.status === 'missing');
}

/**
 * Calcule le pourcentage de matching
 */
export function getMatchPercentage(matchResult: ProfileMatchResult): number {
  const totalProfileColumns = matchResult.profile.columns.length;
  if (totalProfileColumns === 0) return 0;
  
  const matchedColumns = matchResult.mappings.filter(
    m => m.status === 'exact' || m.status === 'format_different' || m.status === 'similar'
  ).length;
  
  return Math.round((matchedColumns / totalProfileColumns) * 100);
}
