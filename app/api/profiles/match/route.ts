// app/api/profiles/match/route.ts
// API pour trouver le meilleur profil pour un fichier
// POST : Recherche les profils compatibles avec les colonnes détectées

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/infrastructure/supabase/server';
import { 
  ImportProfile,
  ImportProfileRow,
  ProfileMatchResult,
  ColumnMapping,
  DetectedColumn,
  ProfileColumn,
  MappingStatus,
  rowToProfile
} from '@/types/profiles';

interface MatchRequestBody {
  fileColumns: DetectedColumn[];
  workspaceId?: string;  // Optionnel : filtrer par workspace
}

// =============================================================================
// POST : Recherche les profils compatibles
// =============================================================================

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Vérifier l'authentification
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Non authentifié' },
        { status: 401 }
      );
    }
    
    // Parser le body
    const body: MatchRequestBody = await request.json();
    
    // Validation
    if (!body.fileColumns || !Array.isArray(body.fileColumns) || body.fileColumns.length === 0) {
      return NextResponse.json(
        { error: 'fileColumns est requis et doit être un tableau non vide' },
        { status: 400 }
      );
    }
    
    // Récupérer tous les profils (ou filtrer par workspace)
    let query = supabase
      .schema('csv_importer')
      .from('import_profiles')
      .select('*');
    
    if (body.workspaceId) {
      query = query.eq('workspace_id', body.workspaceId);
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error('Erreur récupération profils:', error);
      return NextResponse.json(
        { error: 'Erreur lors de la récupération des profils' },
        { status: 500 }
      );
    }
    
    const profiles: ImportProfile[] = (data as ImportProfileRow[]).map(rowToProfile);
    
    // Calculer le matching pour chaque profil
    const matchResults: ProfileMatchResult[] = profiles
      .map(profile => calculateMatch(body.fileColumns, profile))
      .filter(result => result.score > 0)  // Garder uniquement les profils avec au moins une colonne matchée
      .sort((a, b) => {
        // Trier par score décroissant, puis par dernière utilisation
        if (b.score !== a.score) return b.score - a.score;
        const aDate = a.profile.lastUsedAt?.getTime() || 0;
        const bDate = b.profile.lastUsedAt?.getTime() || 0;
        return bDate - aDate;
      });
    
    return NextResponse.json({
      success: true,
      data: {
        matches: matchResults,
        totalProfiles: profiles.length,
        fileColumnsCount: body.fileColumns.length
      }
    });
    
  } catch (error) {
    console.error('Erreur API profiles/match POST:', error);
    
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: 'JSON invalide dans le body' },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    );
  }
}

// =============================================================================
// ALGORITHME DE MATCHING
// =============================================================================

/**
 * Calcule le matching entre les colonnes d'un fichier et un profil
 */
function calculateMatch(
  fileColumns: DetectedColumn[],
  profile: ImportProfile
): ProfileMatchResult {
  const mappings: ColumnMapping[] = [];
  let score = 0;
  let needsConfirmation = false;
  
  for (const fileCol of fileColumns) {
    const mapping = findBestMapping(fileCol, profile.columns);
    mappings.push(mapping);
    
    // Calculer le score
    switch (mapping.status) {
      case 'exact':
        score += 1;
        break;
      case 'format_different':
        score += 0.8;
        needsConfirmation = true;
        break;
      case 'similar':
        score += 0.5;
        needsConfirmation = true;
        break;
      case 'new':
      case 'missing':
        needsConfirmation = true;
        break;
    }
    
    if (mapping.needsConfirmation) {
      needsConfirmation = true;
    }
  }
  
  // Vérifier les colonnes obligatoires manquantes
  for (const profileCol of profile.columns) {
    if (profileCol.isRequired) {
      const isMatched = mappings.some(
        m => m.profileColumn?.zohoColumn === profileCol.zohoColumn && 
             (m.status === 'exact' || m.status === 'format_different' || m.status === 'similar')
      );
      if (!isMatched) {
        mappings.push({
          fileColumn: '',
          fileType: 'empty',
          fileSamples: [],
          profileColumn: profileCol,
          status: 'missing',
          needsConfirmation: true
        });
        needsConfirmation = true;
      }
    }
  }
  
  return {
    profile,
    score,
    totalFileColumns: fileColumns.length,
    mappings,
    needsConfirmation
  };
}

/**
 * Trouve le meilleur mapping pour une colonne de fichier
 */
function findBestMapping(
  fileCol: DetectedColumn,
  profileColumns: ProfileColumn[]
): ColumnMapping {
  const normalizedFileName = normalize(fileCol.name);
  
  // 1. Chercher une correspondance exacte dans les alias
  for (const profileCol of profileColumns) {
    const hasExactMatch = profileCol.acceptedNames.some(
      alias => normalize(alias) === normalizedFileName
    );
    
    if (hasExactMatch) {
      // Vérifier si le format est connu
      const formatKnown = isFormatKnown(fileCol, profileCol);
      
      return {
        fileColumn: fileCol.name,
        fileType: fileCol.detectedType,
        fileSamples: fileCol.samples.slice(0, 3),
        profileColumn: profileCol,
        status: formatKnown ? 'exact' : 'format_different',
        needsConfirmation: !formatKnown,
        ambiguity: !formatKnown ? createFormatAmbiguity(fileCol, profileCol) : undefined
      };
    }
  }
  
  // 2. Chercher une correspondance similaire (fuzzy match)
  let bestMatch: { column: ProfileColumn; similarity: number } | null = null;
  
  for (const profileCol of profileColumns) {
    for (const alias of profileCol.acceptedNames) {
      const similarity = calculateSimilarity(normalizedFileName, normalize(alias));
      if (similarity > 80 && (!bestMatch || similarity > bestMatch.similarity)) {
        bestMatch = { column: profileCol, similarity };
      }
    }
  }
  
  if (bestMatch) {
    return {
      fileColumn: fileCol.name,
      fileType: fileCol.detectedType,
      fileSamples: fileCol.samples.slice(0, 3),
      profileColumn: bestMatch.column,
      status: 'similar',
      similarity: bestMatch.similarity,
      needsConfirmation: true
    };
  }
  
  // 3. Nouvelle colonne (pas de correspondance)
  return {
    fileColumn: fileCol.name,
    fileType: fileCol.detectedType,
    fileSamples: fileCol.samples.slice(0, 3),
    profileColumn: null,
    status: 'new',
    needsConfirmation: true
  };
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Normalise une chaîne pour comparaison
 */
function normalize(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')  // Supprimer accents
    .replace(/[^a-z0-9]/g, '');       // Garder que alphanumérique
}

/**
 * Calcule la similarité entre deux chaînes (Levenshtein normalisé)
 */
function calculateSimilarity(str1: string, str2: string): number {
  const maxLen = Math.max(str1.length, str2.length);
  if (maxLen === 0) return 100;
  
  const distance = levenshteinDistance(str1, str2);
  return Math.round((1 - distance / maxLen) * 100);
}

/**
 * Calcule la distance de Levenshtein
 */
function levenshteinDistance(s1: string, s2: string): number {
  const m = s1.length;
  const n = s2.length;
  
  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
  
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (s1[i - 1] === s2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(
          dp[i - 1][j],     // suppression
          dp[i][j - 1],     // insertion
          dp[i - 1][j - 1]  // substitution
        );
      }
    }
  }
  
  return dp[m][n];
}

/**
 * Vérifie si le format détecté est connu dans le profil
 */
function isFormatKnown(
  fileCol: DetectedColumn,
  profileCol: ProfileColumn
): boolean {
  if (!fileCol.detectedFormat) return true;  // Pas de format spécifique
  
  const config = profileCol.config;
  
  // Pour les dates et durées, acceptedFormats est string[]
  if (config.type === 'date' || config.type === 'duration') {
    const formats = config.acceptedFormats as string[];
    return formats.includes(fileCol.detectedFormat);
  }
  
  // Pour les nombres, acceptedFormats est NumberFormat[] - on vérifie différemment
  if (config.type === 'number') {
    // Pour les nombres, le format détecté serait quelque chose comme "fr" ou "us"
    // On considère que le format est connu si on a au moins un format configuré
    return config.acceptedFormats.length > 0;
  }
  
  return true;
}

/**
 * Crée une information d'ambiguïté pour un format différent
 */
function createFormatAmbiguity(
  fileCol: DetectedColumn,
  profileCol: ProfileColumn
): ColumnMapping['ambiguity'] {
  const config = profileCol.config;
  
  if (config.type === 'date' && fileCol.detectedFormat) {
    return {
      type: 'date_format',
      description: `Format "${fileCol.detectedFormat}" non encore connu pour cette colonne`,
      options: [
        { 
          value: 'add', 
          label: 'Ajouter ce format au profil',
          example: `${fileCol.detectedFormat} sera accepté à l'avenir`
        },
        { 
          value: 'once', 
          label: 'Utiliser uniquement pour cet import',
          example: 'Le profil ne sera pas modifié'
        }
      ],
      defaultOption: 'add'
    };
  }
  
  if (config.type === 'number' && fileCol.detectedFormat) {
    return {
      type: 'number_format',
      description: `Format numérique différent détecté`,
      options: [
        { 
          value: 'add', 
          label: 'Ajouter ce format au profil',
          example: 'Ce format sera reconnu à l\'avenir'
        },
        { 
          value: 'once', 
          label: 'Utiliser uniquement pour cet import',
          example: 'Le profil ne sera pas modifié'
        }
      ],
      defaultOption: 'add'
    };
  }
  
  return undefined;
}
