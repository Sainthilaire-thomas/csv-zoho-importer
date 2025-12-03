# Architecture Cible - CSV to Zoho Analytics Importer

**Version:** 3.0  
**Date:** 1er décembre 2025  
**Changement majeur:** Introduction du système de Profils d'Import

---

## 1. Vue d'ensemble

### 1.1 Principes directeurs

| Principe | Description | Impact architecture |
|----------|-------------|---------------------|
| **Zero Data Retention** | Aucune donnée CSV stockée | Traitement 100% client |
| **Profil = Table Zoho** | Un profil par table destination | Relation 1:1 view_id ↔ profil |
| **Accumulation** | Alias et formats s'enrichissent | JSONB évolutif |
| **Format universel** | Normalisation intermédiaire | Transformers dédiés |
| **Explicite** | Confirmation des ambiguïtés | UI de résolution |
| **Type Safety** | TypeScript strict | Interfaces explicites |

### 1.2 Diagramme d'architecture globale

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                    PRESENTATION LAYER                                    │
│                                  (Next.js App Router + React)                            │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                          │
│  PAGES                              COMPONENTS                                           │
│  ┌─────────────────────┐            ┌─────────────────────────────────────────┐         │
│  │ app/(dashboard)/    │            │ components/                             │         │
│  │   import/           │───────────▶│   import/wizard/                        │         │
│  │   profiles/         │            │     step-source.tsx                     │         │
│  │   history/          │            │     step-profile-match.tsx    ← NOUVEAU │         │
│  │   settings/         │            │     step-column-confirm.tsx   ← NOUVEAU │         │
│  └─────────────────────┘            │     step-transform-preview.tsx          │         │
│                                     │     step-import.tsx                     │         │
│                                     │   profiles/                   ← NOUVEAU │         │
│                                     │     profile-list.tsx                    │         │
│                                     │     profile-editor.tsx                  │         │
│                                     └─────────────────────────────────────────┘         │
│                                              │                                           │
│  HOOKS                              ┌────────┴────────┐                                  │
│  ┌─────────────────────┐            │                 │                                  │
│  │ lib/hooks/          │◀───────────┤  React Query    │                                  │
│  │   use-import.ts     │            │  State Mgmt     │                                  │
│  │   use-profile.ts    │ ← NOUVEAU  │                 │                                  │
│  │   use-matching.ts   │ ← NOUVEAU  └─────────────────┘                                  │
│  │   use-transform.ts  │ ← NOUVEAU                                                       │
│  └─────────────────────┘                                                                 │
│                                                                                          │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                      API LAYER                                           │
│                                 (Next.js Route Handlers)                                 │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                          │
│  app/api/                                                                                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                 │
│  │ /profiles    │  │ /zoho        │  │ /imports     │  │ /transform   │ ← NOUVEAU       │
│  │   GET        │  │   /oauth/*   │  │   POST       │  │   /preview   │                 │
│  │   POST       │  │   /workspaces│  │   GET /[id]  │  │              │                 │
│  │   PUT /[id]  │  │   /tables    │  │   /history   │  │              │                 │
│  │   DELETE     │  │   /columns   │  │              │  │              │                 │
│  │   /match     │  │   /import    │  │              │  │              │                 │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘                 │
│        │                  │                  │                  │                        │
│        └──────────────────┴──────────────────┴──────────────────┘                        │
│                                      │                                                   │
├──────────────────────────────────────┼──────────────────────────────────────────────────┤
│                               DOMAIN LAYER                                               │
│                            (Pure Business Logic)                                         │
├──────────────────────────────────────┼──────────────────────────────────────────────────┤
│                                      │                                                   │
│  lib/domain/                         │                                                   │
│  ┌───────────────────────────────────┴───────────────────────────────────────┐          │
│  │                                                                            │          │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐            │          │
│  │  │ ProfileManager  │  │ ColumnMatcher   │  │ DataTransformer │            │          │
│  │  │ ← NOUVEAU       │  │ ← NOUVEAU       │  │ (enrichi)       │            │          │
│  │  │                 │  │                 │  │                 │            │          │
│  │  │ • findByViewId  │  │ • matchColumns  │  │ • transformDate │            │          │
│  │  │ • matchFile     │  │ • normalize     │  │ • transformNum  │            │          │
│  │  │ • updateAliases │  │ • similarity    │  │ • transformDur  │            │          │
│  │  │ • create/update │  │ • fuzzyMatch    │  │ • transformText │            │          │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────┘            │          │
│  │                                                                            │          │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐            │          │
│  │  │ SchemaValidator │  │ TypeDetector    │  │ FormatResolver  │            │          │
│  │  │ (existant)      │  │ ← NOUVEAU       │  │ ← NOUVEAU       │            │          │
│  │  │                 │  │                 │  │                 │            │          │
│  │  │ • validateSchema│  │ • detectDate    │  │ • resolveDate   │            │          │
│  │  │ • checkCompat   │  │ • detectNumber  │  │ • resolveNumber │            │          │
│  │  │                 │  │ • detectDuration│  │ • isAmbiguous   │            │          │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────┘            │          │
│  │                                                                            │          │
│  └────────────────────────────────────────────────────────────────────────────┘          │
│                                                                                          │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                              INFRASTRUCTURE LAYER                                        │
│                               (External Services)                                        │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                          │
│  lib/infrastructure/                                                                     │
│  ┌─────────────────┐     ┌─────────────────────────────────────┐     ┌─────────────────┐│
│  │ supabase/       │     │ zoho/                               │     │ sftp/           ││
│  │  client.ts      │     │  types.ts                           │     │  (placeholder)  ││
│  │  server.ts      │     │  encryption.ts (AES-256-GCM)        │     │                 ││
│  │                 │     │  auth.ts (OAuth2)                   │     │                 ││
│  │                 │     │  client.ts                          │     │                 ││
│  └────────┬────────┘     └──────────────────┬──────────────────┘     └─────────────────┘│
│           │                                 │                                            │
└───────────┼─────────────────────────────────┼────────────────────────────────────────────┘
            │                                 │
            ▼                                 ▼
     ┌──────────────┐                  ┌──────────────┐
     │   Supabase   │                  │     Zoho     │
     │  PostgreSQL  │                  │  Analytics   │
     │  - Auth      │                  │     API      │
     │  - Profiles  │ ← NOUVEAU        │              │
     │  - History   │                  │              │
     │  - Tokens    │                  │              │
     └──────────────┘                  └──────────────┘
```

---

## 2. Couche Domain (Business Logic)

### 2.1 Structure des fichiers

```
lib/domain/
├── index.ts                          # Exports publics
│
├── profile/                          # ← NOUVEAU - Gestion des profils
│   ├── index.ts
│   ├── types.ts                      # ImportProfile, ProfileColumn
│   ├── profile-manager.ts            # CRUD + matching
│   └── profile-repository.ts         # Accès Supabase
│
├── matching/                         # ← NOUVEAU - Matching colonnes
│   ├── index.ts
│   ├── types.ts                      # MatchResult, ColumnMapping
│   ├── column-matcher.ts             # Algorithme de matching
│   ├── normalizer.ts                 # Normalisation noms
│   └── similarity.ts                 # Calcul similarité (Levenshtein)
│
├── detection/                        # ← NOUVEAU - Détection types
│   ├── index.ts
│   ├── types.ts                      # DetectedColumn, DetectedType
│   ├── type-detector.ts              # Détection automatique
│   ├── date-detector.ts              # Spécifique dates
│   ├── number-detector.ts            # Spécifique nombres
│   └── duration-detector.ts          # Spécifique durées
│
├── transform/                        # ← ENRICHI - Transformations
│   ├── index.ts
│   ├── types.ts                      # TransformRule, TransformResult
│   ├── data-transformer.ts           # Orchestrateur
│   ├── transformers/
│   │   ├── date-transformer.ts       # DD/MM → ISO
│   │   ├── number-transformer.ts     # Virgule → Point
│   │   ├── duration-transformer.ts   # HH:mm → HH:mm:ss
│   │   ├── text-transformer.ts       # Trim, empty values
│   │   └── scientific-transformer.ts # 1E6 → 1000000
│   └── format-resolver.ts            # Résolution ambiguïtés
│
├── validation/                       # Existant
│   ├── index.ts
│   ├── engine.ts
│   ├── schema-validator.ts
│   └── rules/
│       ├── base.ts
│       ├── date.ts
│       ├── number.ts
│       ├── email.ts
│       └── required.ts
│
└── import/                           # Existant - enrichi
    ├── index.ts
    ├── processor.ts                  # Orchestration import
    └── types.ts
```

### 2.2 Types principaux

```typescript
// lib/domain/profile/types.ts

/**
 * Profil d'import - Configuration pour UNE table Zoho
 */
export interface ImportProfile {
  id: string;
  
  // Identification
  name: string;
  description?: string;
  
  // Table Zoho cible (UNIQUE - relation 1:1)
  workspaceId: string;
  workspaceName: string;
  viewId: string;                     // Clé unique
  viewName: string;
  
  // Configuration colonnes
  columns: ProfileColumn[];
  
  // Paramètres par défaut
  defaultImportMode: ImportMode;
  
  // Métadonnées
  createdAt: Date;
  createdBy: string;
  updatedAt: Date;
  lastUsedAt: Date;
  useCount: number;
}

/**
 * Configuration d'une colonne dans le profil
 */
export interface ProfileColumn {
  id: string;
  
  // Colonne Zoho (fixe)
  zohoColumn: string;
  zohoType: ZohoDataType;
  isRequired: boolean;
  
  // Noms acceptés (ACCUMULATION)
  acceptedNames: string[];            // ["Date début", "Date de début", "DateDebut"]
  
  // Type de données interprété
  dataType: 'date' | 'duration' | 'number' | 'text' | 'boolean';
  
  // Configuration spécifique au type
  config: ColumnConfig;
}

/**
 * Configuration spécifique par type
 */
export type ColumnConfig = 
  | DateColumnConfig 
  | DurationColumnConfig 
  | NumberColumnConfig 
  | TextColumnConfig
  | BooleanColumnConfig;

export interface DateColumnConfig {
  type: 'date';
  acceptedFormats: string[];          // ["DD/MM/YYYY", "DD-MM-YYYY"]
  dayMonthOrder: 'dmy' | 'mdy';       // Confirmé par utilisateur
  outputFormat: 'iso';                // Toujours YYYY-MM-DD
}

export interface DurationColumnConfig {
  type: 'duration';
  acceptedFormats: string[];          // ["HH:mm", "HH:mm:ss", "H:mm"]
  outputFormat: 'hms';                // Toujours HH:mm:ss
}

export interface NumberColumnConfig {
  type: 'number';
  acceptedFormats: NumberFormat[];
  expandScientific: boolean;          // true = 1E6 → 1000000
  outputFormat: 'standard';           // Point décimal, pas de milliers
}

export interface NumberFormat {
  decimalSeparator: ',' | '.';
  thousandSeparator: ' ' | '.' | ',' | null;
}

export interface TextColumnConfig {
  type: 'text';
  trim: boolean;
  emptyValues: string[];              // ["N/A", "null", "-"] → ""
  expandScientific: boolean;          // Pour codes numériques
}

export interface BooleanColumnConfig {
  type: 'boolean';
  trueValues: string[];
  falseValues: string[];
}
```

```typescript
// lib/domain/matching/types.ts

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
  | 'similar'                         // Nom similaire (fuzzy match)
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
```

```typescript
// lib/domain/detection/types.ts

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
  
  // Échantillons
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
```

### 2.3 ProfileManager

```typescript
// lib/domain/profile/profile-manager.ts

export class ProfileManager {
  constructor(private repository: ProfileRepository) {}
  
  /**
   * Trouve le profil pour une table Zoho (relation 1:1)
   */
  async findByViewId(viewId: string): Promise<ImportProfile | null> {
    return this.repository.findByViewId(viewId);
  }
  
  /**
   * Recherche les profils compatibles avec un fichier
   * Retourne les profils triés par score de matching
   */
  async findMatchingProfiles(
    fileColumns: DetectedColumn[]
  ): Promise<ProfileMatchResult[]> {
    const allProfiles = await this.repository.findAll();
    const matcher = new ColumnMatcher();
    
    return allProfiles
      .map(profile => matcher.matchFileToProfile(fileColumns, profile))
      .filter(result => result.score > 0)
      .sort((a, b) => b.score - a.score);
  }
  
  /**
   * Crée un nouveau profil
   */
  async create(profile: Omit<ImportProfile, 'id' | 'createdAt' | 'updatedAt'>): Promise<ImportProfile> {
    return this.repository.create(profile);
  }
  
  /**
   * Met à jour un profil avec nouveaux alias/formats
   */
  async updateFromImport(
    profileId: string,
    updates: ProfileUpdateFromImport
  ): Promise<ImportProfile> {
    const profile = await this.repository.findById(profileId);
    if (!profile) throw new Error('Profile not found');
    
    // Ajouter les nouveaux alias
    for (const aliasUpdate of updates.newAliases) {
      const column = profile.columns.find(c => c.id === aliasUpdate.columnId);
      if (column && !column.acceptedNames.includes(aliasUpdate.alias)) {
        column.acceptedNames.push(aliasUpdate.alias);
      }
    }
    
    // Ajouter les nouveaux formats
    for (const formatUpdate of updates.newFormats) {
      const column = profile.columns.find(c => c.id === formatUpdate.columnId);
      if (column && column.config.type === 'date') {
        const config = column.config as DateColumnConfig;
        if (!config.acceptedFormats.includes(formatUpdate.format)) {
          config.acceptedFormats.push(formatUpdate.format);
        }
      }
    }
    
    // Mettre à jour les métadonnées
    profile.updatedAt = new Date();
    profile.lastUsedAt = new Date();
    profile.useCount++;
    
    return this.repository.update(profile);
  }
}

interface ProfileUpdateFromImport {
  newAliases: Array<{ columnId: string; alias: string }>;
  newFormats: Array<{ columnId: string; format: string }>;
}
```

### 2.4 ColumnMatcher

```typescript
// lib/domain/matching/column-matcher.ts

export class ColumnMatcher {
  
  /**
   * Match un fichier contre un profil
   */
  matchFileToProfile(
    fileColumns: DetectedColumn[],
    profile: ImportProfile
  ): ProfileMatchResult {
    
    const mappings: ColumnMapping[] = [];
    let score = 0;
    
    for (const fileCol of fileColumns) {
      const mapping = this.matchColumn(fileCol, profile);
      mappings.push(mapping);
      
      if (mapping.status === 'exact') score += 1;
      else if (mapping.status === 'format_different') score += 0.8;
      else if (mapping.status === 'similar') score += 0.5;
    }
    
    // Vérifier colonnes obligatoires manquantes
    for (const profileCol of profile.columns) {
      if (profileCol.isRequired) {
        const isMapped = mappings.some(
          m => m.profileColumn?.id === profileCol.id && m.status !== 'new'
        );
        if (!isMapped) {
          mappings.push({
            fileColumn: '',
            fileType: 'text',
            fileSamples: [],
            profileColumn: profileCol,
            status: 'missing',
            needsConfirmation: true
          });
        }
      }
    }
    
    return {
      profile,
      score,
      totalFileColumns: fileColumns.length,
      mappings,
      needsConfirmation: mappings.some(m => m.needsConfirmation)
    };
  }
  
  private matchColumn(
    fileCol: DetectedColumn,
    profile: ImportProfile
  ): ColumnMapping {
    
    const normalizedName = this.normalize(fileCol.name);
    
    // 1. Chercher correspondance exacte dans les alias
    for (const profileCol of profile.columns) {
      const exactMatch = profileCol.acceptedNames.some(
        alias => this.normalize(alias) === normalizedName
      );
      
      if (exactMatch) {
        const formatKnown = this.isFormatKnown(fileCol, profileCol);
        const ambiguity = this.detectAmbiguity(fileCol, profileCol);
        
        return {
          fileColumn: fileCol.name,
          fileType: fileCol.detectedType,
          fileSamples: fileCol.samples,
          profileColumn: profileCol,
          status: formatKnown ? 'exact' : 'format_different',
          needsConfirmation: !formatKnown || !!ambiguity,
          ambiguity
        };
      }
    }
    
    // 2. Chercher correspondance similaire (fuzzy)
    let bestMatch: { column: ProfileColumn; similarity: number } | null = null;
    
    for (const profileCol of profile.columns) {
      for (const alias of profileCol.acceptedNames) {
        const similarity = this.calculateSimilarity(fileCol.name, alias);
        if (similarity > 80 && (!bestMatch || similarity > bestMatch.similarity)) {
          bestMatch = { column: profileCol, similarity };
        }
      }
    }
    
    if (bestMatch) {
      return {
        fileColumn: fileCol.name,
        fileType: fileCol.detectedType,
        fileSamples: fileCol.samples,
        profileColumn: bestMatch.column,
        status: 'similar',
        similarity: bestMatch.similarity,
        needsConfirmation: true
      };
    }
    
    // 3. Nouvelle colonne
    return {
      fileColumn: fileCol.name,
      fileType: fileCol.detectedType,
      fileSamples: fileCol.samples,
      profileColumn: null,
      status: 'new',
      needsConfirmation: true
    };
  }
  
  private normalize(str: string): string {
    return str
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')  // Accents
      .replace(/[^a-z0-9]/g, '');       // Ponctuation
  }
  
  private calculateSimilarity(str1: string, str2: string): number {
    const n1 = this.normalize(str1);
    const n2 = this.normalize(str2);
    
    const maxLen = Math.max(n1.length, n2.length);
    if (maxLen === 0) return 100;
    
    const distance = this.levenshteinDistance(n1, n2);
    return Math.round((1 - distance / maxLen) * 100);
  }
  
  private levenshteinDistance(s1: string, s2: string): number {
    const m = s1.length;
    const n = s2.length;
    const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
    
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,
          dp[i][j - 1] + 1,
          dp[i - 1][j - 1] + cost
        );
      }
    }
    
    return dp[m][n];
  }
  
  private isFormatKnown(
    fileCol: DetectedColumn,
    profileCol: ProfileColumn
  ): boolean {
    if (!fileCol.detectedFormat) return true;
    
    if (profileCol.config.type === 'date') {
      return (profileCol.config as DateColumnConfig)
        .acceptedFormats.includes(fileCol.detectedFormat);
    }
    
    if (profileCol.config.type === 'duration') {
      return (profileCol.config as DurationColumnConfig)
        .acceptedFormats.includes(fileCol.detectedFormat);
    }
    
    return true;
  }
  
  private detectAmbiguity(
    fileCol: DetectedColumn,
    profileCol: ProfileColumn
  ): AmbiguityInfo | undefined {
    
    // Ambiguïté date DD/MM vs MM/DD
    if (profileCol.config.type === 'date' && fileCol.isAmbiguous) {
      return {
        type: 'date_format',
        description: 'Le format de date est ambigu',
        options: [
          { value: 'dmy', label: 'JJ/MM/AAAA', example: '05/03/2025 = 5 mars' },
          { value: 'mdy', label: 'MM/JJ/AAAA', example: '05/03/2025 = 3 mai' }
        ],
        defaultOption: 'dmy'
      };
    }
    
    // Notation scientifique dans texte
    if (profileCol.zohoType === 'PLAIN') {
      const hasScientific = fileCol.samples.some(s => /^-?\d+\.?\d*[eE][+-]?\d+$/.test(s));
      if (hasScientific) {
        return {
          type: 'scientific_notation',
          description: 'Notation scientifique détectée',
          options: [
            { value: 'expand', label: 'Développer', example: '1E6 → "1000000"' },
            { value: 'keep', label: 'Garder tel quel', example: '1E6 → "1E6"' }
          ],
          defaultOption: 'expand'
        };
      }
    }
    
    return undefined;
  }
}
```

### 2.5 DataTransformer (enrichi)

```typescript
// lib/domain/transform/data-transformer.ts

export class DataTransformer {
  private dateTransformer = new DateTransformer();
  private numberTransformer = new NumberTransformer();
  private durationTransformer = new DurationTransformer();
  private textTransformer = new TextTransformer();
  private scientificTransformer = new ScientificTransformer();
  
  /**
   * Transforme une ligne de données selon le profil
   */
  transformRow(
    row: Record<string, string>,
    mappings: ColumnMapping[],
    profile: ImportProfile
  ): TransformResult {
    
    const transformedRow: Record<string, string> = {};
    const transformations: TransformationApplied[] = [];
    const errors: TransformError[] = [];
    
    for (const mapping of mappings) {
      if (mapping.status === 'new' || !mapping.profileColumn) {
        continue;  // Ignorer colonnes non mappées
      }
      
      const value = row[mapping.fileColumn];
      const config = mapping.profileColumn.config;
      
      try {
        const result = this.transformValue(value, config, mapping);
        transformedRow[mapping.profileColumn.zohoColumn] = result.value;
        
        if (result.transformed) {
          transformations.push({
            column: mapping.profileColumn.zohoColumn,
            originalValue: value,
            transformedValue: result.value,
            transformationType: result.type
          });
        }
      } catch (error) {
        errors.push({
          column: mapping.fileColumn,
          value,
          error: error instanceof Error ? error.message : 'Erreur de transformation'
        });
      }
    }
    
    return {
      row: transformedRow,
      transformations,
      errors,
      success: errors.length === 0
    };
  }
  
  private transformValue(
    value: string,
    config: ColumnConfig,
    mapping: ColumnMapping
  ): { value: string; transformed: boolean; type: string } {
    
    if (!value || value.trim() === '') {
      return { value: '', transformed: false, type: 'none' };
    }
    
    switch (config.type) {
      case 'date':
        return this.dateTransformer.transform(value, config as DateColumnConfig);
        
      case 'duration':
        return this.durationTransformer.transform(value, config as DurationColumnConfig);
        
      case 'number':
        return this.numberTransformer.transform(value, config as NumberColumnConfig);
        
      case 'text':
        return this.textTransformer.transform(value, config as TextColumnConfig);
        
      case 'boolean':
        return this.transformBoolean(value, config as BooleanColumnConfig);
        
      default:
        return { value, transformed: false, type: 'none' };
    }
  }
  
  private transformBoolean(
    value: string,
    config: BooleanColumnConfig
  ): { value: string; transformed: boolean; type: string } {
    
    const normalized = value.toLowerCase().trim();
    
    if (config.trueValues.map(v => v.toLowerCase()).includes(normalized)) {
      return { value: 'true', transformed: true, type: 'boolean' };
    }
    
    if (config.falseValues.map(v => v.toLowerCase()).includes(normalized)) {
      return { value: 'false', transformed: true, type: 'boolean' };
    }
    
    throw new Error(`Valeur booléenne non reconnue: ${value}`);
  }
}
```

---

## 3. Couche API

### 3.1 Nouvelles routes

```
app/api/
├── profiles/
│   ├── route.ts                      # GET (list), POST (create)
│   ├── [id]/
│   │   └── route.ts                  # GET, PUT, DELETE
│   └── match/
│       └── route.ts                  # POST - Trouver profils compatibles
│
├── transform/
│   └── preview/
│       └── route.ts                  # POST - Prévisualisation transformations
│
├── zoho/                             # Existant
│   ├── oauth/...
│   ├── workspaces/...
│   ├── tables/...
│   ├── columns/...
│   └── import/...
│
└── imports/                          # Enrichi
    ├── route.ts                      # POST (import), GET (history)
    └── [id]/
        └── route.ts                  # GET (détails)
```

### 3.2 API Profiles

```typescript
// app/api/profiles/route.ts

// GET /api/profiles
export async function GET(request: NextRequest) {
  const user = await getAuthenticatedUser(request);
  const profiles = await profileRepository.findAll();
  
  return NextResponse.json({ profiles });
}

// POST /api/profiles
export async function POST(request: NextRequest) {
  const user = await getAuthenticatedUser(request);
  const body = await request.json();
  
  // Valider qu'il n'existe pas déjà un profil pour cette table
  const existing = await profileRepository.findByViewId(body.viewId);
  if (existing) {
    return NextResponse.json(
      { error: 'Un profil existe déjà pour cette table' },
      { status: 409 }
    );
  }
  
  const profile = await profileManager.create({
    ...body,
    createdBy: user.id,
    useCount: 0
  });
  
  return NextResponse.json({ profile }, { status: 201 });
}
```

```typescript
// app/api/profiles/match/route.ts

// POST /api/profiles/match
// Body: { columns: DetectedColumn[] }
export async function POST(request: NextRequest) {
  const user = await getAuthenticatedUser(request);
  const { columns } = await request.json();
  
  const results = await profileManager.findMatchingProfiles(columns);
  
  return NextResponse.json({ 
    results,
    hasExactMatch: results.length > 0 && !results[0].needsConfirmation
  });
}
```

### 3.3 API Transform Preview

```typescript
// app/api/transform/preview/route.ts

// POST /api/transform/preview
// Body: { profileId, mappings, data: first10Rows }
export async function POST(request: NextRequest) {
  const { profileId, mappings, data } = await request.json();
  
  const profile = await profileRepository.findById(profileId);
  if (!profile) {
    return NextResponse.json({ error: 'Profil non trouvé' }, { status: 404 });
  }
  
  const transformer = new DataTransformer();
  const preview: TransformPreviewResult = {
    rows: [],
    summary: {
      columnsTransformed: 0,
      totalTransformations: 0,
      errors: 0
    }
  };
  
  for (const row of data) {
    const result = transformer.transformRow(row, mappings, profile);
    preview.rows.push({
      original: row,
      transformed: result.row,
      transformations: result.transformations,
      errors: result.errors
    });
    
    if (result.transformations.length > 0) {
      preview.summary.totalTransformations += result.transformations.length;
    }
    preview.summary.errors += result.errors.length;
  }
  
  // Compter colonnes distinctes transformées
  const transformedColumns = new Set(
    preview.rows.flatMap(r => r.transformations.map(t => t.column))
  );
  preview.summary.columnsTransformed = transformedColumns.size;
  
  return NextResponse.json({ preview });
}
```

---

## 4. Base de données Supabase

### 4.1 Schéma complet

```sql
-- =====================================================
-- SCHÉMA CSV_IMPORTER
-- =====================================================

-- Activer le schéma dédié
CREATE SCHEMA IF NOT EXISTS csv_importer;

-- =====================================================
-- Table: Tokens Zoho (existant)
-- =====================================================
CREATE TABLE IF NOT EXISTS csv_importer.user_zoho_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  access_token_encrypted TEXT NOT NULL,
  refresh_token_encrypted TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  scope TEXT,
  api_domain TEXT,
  org_id TEXT,
  zoho_user_id TEXT,
  zoho_email TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- Table: Profils d'import (NOUVEAU)
-- =====================================================
CREATE TABLE csv_importer.import_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Identification
  name TEXT NOT NULL,
  description TEXT,
  
  -- Table Zoho cible (UNIQUE - un profil par table)
  workspace_id TEXT NOT NULL,
  workspace_name TEXT NOT NULL,
  view_id TEXT NOT NULL UNIQUE,
  view_name TEXT NOT NULL,
  
  -- Configuration des colonnes (JSONB pour flexibilité)
  columns JSONB NOT NULL DEFAULT '[]',
  /*
  Format:
  [
    {
      "id": "uuid",
      "zohoColumn": "Date début",
      "zohoType": "DATE_AS_DATE",
      "isRequired": true,
      "acceptedNames": ["Date début", "Date de début", "DateDebut"],
      "dataType": "date",
      "config": {
        "type": "date",
        "acceptedFormats": ["DD/MM/YYYY", "DD-MM-YYYY"],
        "dayMonthOrder": "dmy",
        "outputFormat": "iso"
      }
    }
  ]
  */
  
  -- Paramètres par défaut
  default_import_mode TEXT DEFAULT 'append',
  
  -- Métadonnées
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,
  use_count INTEGER DEFAULT 0,
  
  -- Contrainte unicité sur view_id
  CONSTRAINT unique_profile_per_view UNIQUE (view_id)
);

-- Index pour recherche
CREATE INDEX idx_profiles_workspace ON csv_importer.import_profiles(workspace_id);
CREATE INDEX idx_profiles_updated ON csv_importer.import_profiles(updated_at DESC);

-- =====================================================
-- Table: Historique des imports (ENRICHI)
-- =====================================================
CREATE TABLE csv_importer.import_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Références
  profile_id UUID REFERENCES csv_importer.import_profiles(id),
  user_id UUID REFERENCES auth.users(id),
  
  -- Fichier source (métadonnées uniquement)
  file_name TEXT NOT NULL,
  file_size_bytes INTEGER,
  row_count INTEGER,
  column_count INTEGER,
  
  -- Résultat
  status TEXT NOT NULL CHECK (status IN ('success', 'partial', 'error')),
  rows_sent INTEGER,
  rows_imported INTEGER,
  rows_failed INTEGER,
  error_message TEXT,
  
  -- Transformations appliquées (audit)
  transformations_applied JSONB,
  /*
  Format:
  {
    "columns": ["Date début", "Montant"],
    "totalTransformations": 28,
    "details": [
      { "column": "Date début", "type": "date_format", "count": 14 }
    ]
  }
  */
  
  -- Évolutions du profil
  profile_changes JSONB,
  /*
  Format:
  {
    "newAliases": [{ "column": "Date début", "alias": "DateDebut" }],
    "newFormats": [{ "column": "Date début", "format": "DD-MM-YYYY" }]
  }
  */
  
  -- Timing
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER,
  
  -- Détails erreurs
  errors JSONB
);

-- Index
CREATE INDEX idx_history_user ON csv_importer.import_history(user_id);
CREATE INDEX idx_history_profile ON csv_importer.import_history(profile_id);
CREATE INDEX idx_history_date ON csv_importer.import_history(started_at DESC);
CREATE INDEX idx_history_status ON csv_importer.import_history(status);

-- =====================================================
-- Row Level Security
-- =====================================================

-- Tokens: utilisateur voit seulement ses propres tokens
ALTER TABLE csv_importer.user_zoho_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own tokens" ON csv_importer.user_zoho_tokens
  FOR ALL USING (auth.uid() = user_id);

-- Profils: tous les utilisateurs authentifiés
ALTER TABLE csv_importer.import_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users manage profiles" ON csv_importer.import_profiles
  FOR ALL USING (auth.role() = 'authenticated');

-- Historique: lecture pour tous, écriture pour l'utilisateur
ALTER TABLE csv_importer.import_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read all history" ON csv_importer.import_history
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Users insert own history" ON csv_importer.import_history
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- =====================================================
-- Permissions
-- =====================================================
GRANT USAGE ON SCHEMA csv_importer TO anon, authenticated;
GRANT ALL ON csv_importer.user_zoho_tokens TO authenticated;
GRANT ALL ON csv_importer.import_profiles TO authenticated;
GRANT ALL ON csv_importer.import_history TO authenticated;

-- =====================================================
-- Trigger: mise à jour automatique updated_at
-- =====================================================
CREATE OR REPLACE FUNCTION csv_importer.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON csv_importer.import_profiles
  FOR EACH ROW EXECUTE FUNCTION csv_importer.update_updated_at();
```

---

## 5. Composants UI

### 5.1 Nouveaux composants

```
components/
├── import/
│   └── wizard/
│       ├── step-source.tsx           # Existant
│       ├── step-profile-match.tsx    # NOUVEAU - Matching profil
│       ├── step-column-confirm.tsx   # NOUVEAU - Confirmation colonnes
│       ├── step-transform-preview.tsx # NOUVEAU - Prévisualisation
│       ├── step-import.tsx           # Import final
│       └── import-wizard.tsx         # Orchestrateur (modifié)
│
├── profiles/                         # NOUVEAU
│   ├── profile-list.tsx              # Liste des profils
│   ├── profile-card.tsx              # Carte profil
│   ├── profile-editor.tsx            # Éditeur complet
│   └── column-config-editor.tsx      # Configuration colonne
│
└── matching/                         # NOUVEAU
    ├── column-mapping-table.tsx      # Tableau de mapping
    ├── mapping-row.tsx               # Ligne de mapping
    ├── ambiguity-resolver.tsx        # Résolution ambiguïtés
    └── similarity-badge.tsx          # Badge % similarité
```

### 5.2 Nouveau flow du wizard

```typescript
// components/import/wizard/import-wizard.tsx

type WizardStep = 
  | 'source'           // Upload fichier
  | 'profile-match'    // Matching profil (nouveau)
  | 'column-confirm'   // Confirmation colonnes (si nécessaire)
  | 'transform'        // Prévisualisation transformations
  | 'import'           // Import + rapport

const WIZARD_STEPS: WizardStep[] = [
  'source',
  'profile-match',
  'column-confirm',
  'transform',
  'import'
];

export function ImportWizard() {
  const [step, setStep] = useState<WizardStep>('source');
  const [fileData, setFileData] = useState<ParsedFile | null>(null);
  const [matchResult, setMatchResult] = useState<ProfileMatchResult | null>(null);
  const [confirmedMappings, setConfirmedMappings] = useState<ColumnMapping[]>([]);
  
  // Logique de navigation
  const handleFileUploaded = (data: ParsedFile) => {
    setFileData(data);
    setStep('profile-match');
  };
  
  const handleProfileMatched = (result: ProfileMatchResult) => {
    setMatchResult(result);
    
    // Si pas de confirmation nécessaire, passer directement à transform
    if (!result.needsConfirmation) {
      setConfirmedMappings(result.mappings);
      setStep('transform');
    } else {
      setStep('column-confirm');
    }
  };
  
  const handleColumnsConfirmed = (mappings: ColumnMapping[]) => {
    setConfirmedMappings(mappings);
    setStep('transform');
  };
  
  return (
    <div>
      <WizardProgress currentStep={step} steps={WIZARD_STEPS} />
      
      {step === 'source' && (
        <StepSource onFileUploaded={handleFileUploaded} />
      )}
      
      {step === 'profile-match' && fileData && (
        <StepProfileMatch 
          fileColumns={fileData.columns}
          onProfileMatched={handleProfileMatched}
          onCreateNewProfile={() => { /* Ouvrir création profil */ }}
        />
      )}
      
      {step === 'column-confirm' && matchResult && (
        <StepColumnConfirm
          matchResult={matchResult}
          onConfirmed={handleColumnsConfirmed}
          onBack={() => setStep('profile-match')}
        />
      )}
      
      {step === 'transform' && matchResult && (
        <StepTransformPreview
          profile={matchResult.profile}
          mappings={confirmedMappings}
          data={fileData!.rows}
          onConfirmed={() => setStep('import')}
          onBack={() => setStep('column-confirm')}
        />
      )}
      
      {step === 'import' && matchResult && (
        <StepImport
          profile={matchResult.profile}
          mappings={confirmedMappings}
          data={fileData!.rows}
          onComplete={() => { /* Afficher rapport */ }}
        />
      )}
    </div>
  );
}
```

---

## 6. Hooks React

### 6.1 useProfile

```typescript
// lib/hooks/use-profile.ts

export function useProfile(viewId?: string) {
  return useQuery({
    queryKey: ['profile', viewId],
    queryFn: () => viewId ? profileApi.getByViewId(viewId) : null,
    enabled: !!viewId
  });
}

export function useProfiles() {
  return useQuery({
    queryKey: ['profiles'],
    queryFn: () => profileApi.getAll()
  });
}

export function useCreateProfile() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: CreateProfileInput) => profileApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
    }
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateProfileInput }) => 
      profileApi.update(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
      queryClient.invalidateQueries({ queryKey: ['profile', id] });
    }
  });
}
```

### 6.2 useProfileMatching

```typescript
// lib/hooks/use-matching.ts

export function useProfileMatching() {
  return useMutation({
    mutationFn: (columns: DetectedColumn[]) => 
      fetch('/api/profiles/match', {
        method: 'POST',
        body: JSON.stringify({ columns })
      }).then(r => r.json())
  });
}
```

### 6.3 useTransformPreview

```typescript
// lib/hooks/use-transform.ts

export function useTransformPreview() {
  return useMutation({
    mutationFn: (input: TransformPreviewInput) =>
      fetch('/api/transform/preview', {
        method: 'POST',
        body: JSON.stringify(input)
      }).then(r => r.json())
  });
}

interface TransformPreviewInput {
  profileId: string;
  mappings: ColumnMapping[];
  data: Record<string, string>[];  // 10 premières lignes
}
```

---

## 7. Flow de données complet

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                               FLOW IMPORT AVEC PROFILS                                   │
└─────────────────────────────────────────────────────────────────────────────────────────┘

CLIENT (navigateur)                                                    SERVEUR
═══════════════════                                                    ════════

1. UPLOAD FICHIER
   │
   ├─ Parse CSV/Excel (Papa Parse / xlsx)
   ├─ Extraire colonnes + détecter types
   ├─ Échantillonner 5 valeurs par colonne
   │
   ▼
2. MATCHING PROFILS
   │                                           ┌──────────────────────────┐
   ├─ POST /api/profiles/match ──────────────▶ │ ProfileManager           │
   │   { columns: DetectedColumn[] }           │   .findMatchingProfiles()│
   │                                           │                          │
   │ ◀────────────────────────────────────────│ Supabase: import_profiles│
   │   { results: ProfileMatchResult[] }       └──────────────────────────┘
   │
   ├─ Si match parfait (needsConfirmation=false)
   │   └─ Passer directement à étape 4
   │
   ├─ Si match partiel ou aucun profil
   │   └─ Afficher écran de confirmation
   │
   ▼
3. CONFIRMATION COLONNES (si nécessaire)
   │
   ├─ Afficher tableau de mapping
   │   - ✓ Colonnes matchées exactement
   │   - ⚠️ Colonnes à confirmer (nom similaire, format différent)
   │   - ➕ Nouvelles colonnes
   │
   ├─ Résoudre ambiguïtés (dates DD/MM vs MM/DD, etc.)
   │
   ├─ Utilisateur confirme/modifie
   │
   ▼
4. PRÉVISUALISATION TRANSFORMATIONS
   │                                           ┌──────────────────────────┐
   ├─ POST /api/transform/preview ───────────▶ │ DataTransformer          │
   │   { profileId, mappings, data[0:10] }     │   .transformRow()        │
   │                                           │                          │
   │ ◀────────────────────────────────────────│ Aperçu 10 lignes         │
   │   { preview: TransformPreviewResult }     └──────────────────────────┘
   │
   ├─ Afficher résumé transformations
   │   "4 colonnes seront transformées"
   │   "Date début: DD/MM/YYYY → ISO"
   │
   ├─ Afficher aperçu données transformées
   │
   ▼
5. IMPORT
   │
   ├─ Transformer TOUTES les lignes (client-side)
   │   DataTransformer.transformRow() × N lignes
   │
   ├─ Générer CSV final (format universel)
   │                                           ┌──────────────────────────┐
   ├─ POST /api/zoho/import ─────────────────▶ │ Zoho Analytics API       │
   │   FormData: FILE + CONFIG                 │   POST /views/{id}/data  │
   │                                           │                          │
   │ ◀────────────────────────────────────────│ { success, rowsImported }│
   │                                           └──────────────────────────┘
   │
   ├─ Si nouveaux alias/formats confirmés
   │   │                                       ┌──────────────────────────┐
   │   └─ PUT /api/profiles/{id} ────────────▶ │ ProfileManager           │
   │       { newAliases, newFormats }          │   .updateFromImport()    │
   │                                           │                          │
   │                                           │ Supabase: UPDATE profile │
   │                                           └──────────────────────────┘
   │
   ├─ Sauvegarder historique                   ┌──────────────────────────┐
   │   POST /api/imports ────────────────────▶ │ Supabase: import_history │
   │   { profileId, stats, transformations }   │                          │
   │                                           └──────────────────────────┘
   │
   ▼
6. RAPPORT FINAL
   │
   └─ Afficher résumé
      - Lignes importées
      - Transformations appliquées  
      - Modifications profil (si alias ajoutés)
      - Lien vers Zoho
```

---

## 8. Récapitulatif des changements

### 8.1 Fichiers à créer

| Fichier | Description |
|---------|-------------|
| `lib/domain/profile/types.ts` | Types ImportProfile, ProfileColumn |
| `lib/domain/profile/profile-manager.ts` | Gestionnaire profils |
| `lib/domain/profile/profile-repository.ts` | Accès Supabase |
| `lib/domain/matching/types.ts` | Types MatchResult, ColumnMapping |
| `lib/domain/matching/column-matcher.ts` | Algorithme matching |
| `lib/domain/matching/normalizer.ts` | Normalisation noms |
| `lib/domain/matching/similarity.ts` | Calcul Levenshtein |
| `lib/domain/detection/type-detector.ts` | Détection types colonnes |
| `lib/domain/transform/transformers/*.ts` | Transformers par type |
| `app/api/profiles/route.ts` | API CRUD profils |
| `app/api/profiles/match/route.ts` | API matching |
| `app/api/transform/preview/route.ts` | API prévisualisation |
| `components/import/wizard/step-profile-match.tsx` | Étape matching |
| `components/import/wizard/step-column-confirm.tsx` | Étape confirmation |
| `components/matching/column-mapping-table.tsx` | Tableau mapping |
| `components/matching/ambiguity-resolver.tsx` | Résolution ambiguïtés |
| `lib/hooks/use-profile.ts` | Hooks profils |
| `lib/hooks/use-matching.ts` | Hook matching |

### 8.2 Fichiers à modifier

| Fichier | Modifications |
|---------|---------------|
| `components/import/wizard/import-wizard.tsx` | Nouveau flow 5 étapes |
| `lib/domain/transform/data-transformer.ts` | Support profils |
| `types/index.ts` | Nouveaux types |

### 8.3 SQL à exécuter

```sql
-- Créer table import_profiles
-- Modifier table import_history
-- Ajouter RLS et permissions
```

---

## 9. Variables d'environnement

Aucune nouvelle variable requise. L'architecture utilise les variables existantes :

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...

# Zoho
ZOHO_CLIENT_ID=...
ZOHO_CLIENT_SECRET=...
ZOHO_API_DOMAIN=https://analyticsapi.zoho.com
ZOHO_ACCOUNTS_DOMAIN=https://accounts.zoho.com

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
APP_URL=http://localhost:3000
ENCRYPTION_KEY=...
```

---

## 10. Priorités d'implémentation

### Phase 1 - Core (Semaine 1)
1. ✅ Types et interfaces
2. Schema SQL + migration
3. ProfileRepository (CRUD Supabase)
4. ProfileManager (logique métier)
5. API /profiles

### Phase 2 - Matching (Semaine 1-2)
1. TypeDetector (détection types colonnes)
2. ColumnMatcher (algorithme matching)
3. API /profiles/match
4. useProfileMatching hook

### Phase 3 - Transform (Semaine 2)
1. Transformers par type (date, number, duration, text)
2. DataTransformer enrichi
3. API /transform/preview
4. useTransformPreview hook

### Phase 4 - UI (Semaine 2-3)
1. StepProfileMatch component
2. StepColumnConfirm component
3. ColumnMappingTable + AmbiguityResolver
4. ImportWizard refactoré
5. Intégration complète

### Phase 5 - Polish (Semaine 3)
1. Gestion des erreurs
2. Tests manuels
3. Historique enrichi
4. Page gestion profils

---

*Document créé le : 1er décembre 2025*
*Version : 3.0*
*Changement majeur : Système de Profils d'Import*
