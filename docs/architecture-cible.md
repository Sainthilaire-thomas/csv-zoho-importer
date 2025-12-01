
# Architecture Cible - CSV to Zoho Analytics Importer

*Version 2.0 - 30 novembre 2025*
*Mise à jour pour intégrer validation avancée et profils d'import*

---

## 1. Vue d'ensemble de l'architecture

### 1.1 Principes directeurs

| Principe                                 | Description                       | Impact sur l'architecture                  |
| ---------------------------------------- | --------------------------------- | ------------------------------------------ |
| **Zero Data Retention**            | Aucune donnée CSV stockée       | Traitement 100% client, pas de cache       |
| **Explicite plutôt qu'implicite** | Pas de conversion silencieuse     | Transformations visibles par l'utilisateur |
| **Separation of Concerns**         | Couches distinctes                | Domain / Infrastructure / UI séparés     |
| **Extensibilité**                 | Nouvelles règles/sources faciles | Patterns Strategy et Factory               |
| **Type Safety**                    | TypeScript strict                 | Interfaces explicites partout              |
| **Testabilité**                   | Logic métier testable isolément | Domain layer sans dépendances             |

### 1.2 Diagramme d'architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              PRESENTATION LAYER                                  │
│                           (Next.js App Router + React)                           │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  PAGES (Server Components)          COMPONENTS (Client Components)               │
│  ┌─────────────────────────┐        ┌─────────────────────────────┐             │
│  │ app/(dashboard)/        │        │ components/                  │             │
│  │   import/page.tsx       │───────▶│   import/wizard/            │             │
│  │   history/page.tsx      │        │     step-source.tsx         │             │
│  │   settings/             │        │     step-config.tsx         │             │
│  └─────────────────────────┘        │     step-validate.tsx       │             │
│                                     │     step-review.tsx         │             │
│                                     │     step-confirm.tsx        │             │
│                                     │   zoho/                      │             │
│                                     │     zoho-connect-button.tsx │             │
│                                     └─────────────────────────────┘             │
│                                              │                                   │
│                                              ▼                                   │
│  HOOKS (State Management)           ┌─────────────────────────────┐             │
│  ┌─────────────────────────┐        │ React Query                 │             │
│  │ lib/hooks/              │◀──────▶│   Queries & Mutations       │             │
│  │   use-import.ts         │        │   Cache Management          │             │
│  │   use-validation.ts     │        └─────────────────────────────┘             │
│  │   use-csv-parser.ts     │                                                    │
│  └─────────────────────────┘                                                    │
│                                                                                  │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                API LAYER                                         │
│                           (Next.js Route Handlers)                               │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  app/api/                                                                        │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐            │
│  │ /csv         │ │ /zoho        │ │ /profiles    │ │ /imports     │            │
│  │  /validate   │ │  /oauth/*    │ │  GET/POST    │ │  GET/POST    │            │
│  │  /preview    │ │  /workspaces │ │  /[id]       │ │  /[id]       │            │
│  │              │ │  /tables     │ │  /match      │ │  /history    │            │
│  │              │ │  /columns    │ │              │ │              │            │
│  │              │ │  /import     │ │              │ │              │            │
│  └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘            │
│                                                                                  │
├─────────────────────────────────────────────────────────────────────────────────┤
│                              DOMAIN LAYER                                        │
│                         (Pure Business Logic)                                    │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  lib/domain/                                                                     │
│  ┌───────────────────────────────────────────────────────────────────────┐      │
│  │                                                                        │      │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐        │      │
│  │  │ ValidationEngine│  │ SchemaValidator │  │ DataTransformer │        │      │
│  │  │ (Rule Registry) │  │ (Zoho matching) │  │ (Explicit conv) │        │      │
│  │  │                 │  │                 │  │                 │        │      │
│  │  │ ┌─────────────┐ │  │ ┌─────────────┐ │  │ ┌─────────────┐ │        │      │
│  │  │ │RequiredRule │ │  │ │ detectTypes │ │  │ │ dateTransf  │ │        │      │
│  │  │ │DateRule     │ │  │ │ matchSchema │ │  │ │ numberTransf│ │        │      │
│  │  │ │NumberRule   │ │  │ │ resolveConf │ │  │ │ textTransf  │ │        │      │
│  │  │ │EmailRule    │ │  │ └─────────────┘ │  │ └─────────────┘ │        │      │
│  │  │ └─────────────┘ │  │                 │  │                 │        │      │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────┘        │      │
│  │                                                                        │      │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐        │      │
│  │  │ ProfileManager  │  │ ImportProcessor │  │ PostImportVerif │        │      │
│  │  │ (Detect/Match)  │  │ (Orchestration) │  │ (Data check)    │        │      │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────┘        │      │
│  │                                                                        │      │
│  └───────────────────────────────────────────────────────────────────────┘      │
│                                                                                  │
├─────────────────────────────────────────────────────────────────────────────────┤
│                          INFRASTRUCTURE LAYER                                    │
│                           (External Services)                                    │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  lib/infrastructure/                                                             │
│  ┌─────────────────┐  ┌─────────────────────────────────┐  ┌─────────────────┐  │
│  │ supabase/       │  │ zoho/                           │  │ sftp/           │  │
│  │  client.ts      │  │  types.ts                       │  │  client.ts      │  │
│  │  server.ts      │  │  encryption.ts (AES-256-GCM)   │  │  (placeholder)  │  │
│  │                 │  │  auth.ts (OAuth2 flow)          │  │                 │  │
│  │                 │  │  client.ts (API calls)          │  │                 │  │
│  └────────┬────────┘  └────────────────┬────────────────┘  └────────┬────────┘  │
│           │                            │                            │           │
└───────────┼────────────────────────────┼────────────────────────────┼───────────┘
            │                            │                            │
            ▼                            ▼                            ▼
     ┌──────────────┐            ┌──────────────┐            ┌──────────────┐
     │   Supabase   │            │     Zoho     │            │    SFTP      │
     │  PostgreSQL  │            │  Analytics   │            │   Server     │
     │  - Auth      │            │     API      │            │   (futur)    │
     │  - Tokens    │            │              │            │              │
     │  - Profiles  │            │              │            │              │
     │  - Logs      │            │              │            │              │
     └──────────────┘            └──────────────┘            └──────────────┘
```

---

## 2. Couche Domain (Business Logic)

### 2.1 Structure

```
lib/domain/
├── validation/                    # Validation des données
│   ├── engine.ts                  # Moteur de validation principal
│   ├── types.ts                   # Types du domaine validation
│   ├── rules/
│   │   ├── base.ts                # Classe abstraite ValidationRule
│   │   ├── required.ts
│   │   ├── date.ts
│   │   ├── number.ts
│   │   ├── email.ts
│   │   └── index.ts               # Export et registry
│   └── index.ts
│
├── schema-validator/              # NOUVEAU - Validation schéma Zoho
│   ├── index.ts
│   ├── types.ts                   # FileSignature, SchemaValidationResult
│   ├── detector.ts                # Détection types colonnes fichier
│   ├── matcher.ts                 # Correspondance fichier ↔ Zoho
│   └── resolver.ts                # Résolution des incompatibilités
│
├── data-transformer/              # NOUVEAU - Transformations explicites
│   ├── index.ts
│   ├── types.ts                   # TransformationRule, TransformResult
│   ├── transforms/
│   │   ├── date.ts                # Conversions dates (DD/MM → YYYY-MM-DD)
│   │   ├── number.ts              # Conversions nombres (virgule → point)
│   │   ├── text.ts                # Normalisation texte (trim, etc.)
│   │   └── index.ts
│   └── engine.ts                  # Moteur de transformation
│
├── profile-manager/               # NOUVEAU - Gestion profils d'import
│   ├── index.ts
│   ├── types.ts                   # ImportProfile, ProfileMatch
│   ├── signature.ts               # Calcul signature fichier (hash colonnes)
│   ├── matcher.ts                 # Détection profil par structure
│   └── storage.ts                 # CRUD profils Supabase
│
├── import/
│   ├── processor.ts               # Orchestration du processus
│   ├── formatter.ts               # Formatage des données
│   ├── verifier.ts                # NOUVEAU - Vérification post-import
│   └── types.ts
│
└── index.ts                       # Exports publics
```

### 2.2 Schema Validator

```typescript
// lib/domain/schema-validator/types.ts

/**
 * Signature d'un fichier pour détection de profil
 */
export interface FileSignature {
  columnCount: number;
  columnNames: string[];           // Normalisés (trim, lowercase)
  columnTypes: DetectedColumnType[];
  structureHash: string;           // Hash pour comparaison rapide
}

/**
 * Type de colonne détecté dans le fichier source
 */
export interface DetectedColumnType {
  columnName: string;
  detectedType: 'date' | 'number' | 'text' | 'boolean' | 'empty';
  format?: string;                 // "DD/MM/YYYY" pour dates
  confidence: number;              // 0-100%
  sampleValues: string[];          // 3-5 exemples
  ambiguous: boolean;              // Nécessite confirmation utilisateur
}

/**
 * Résultat de validation de schéma
 */
export interface SchemaValidationResult {
  isValid: boolean;
  canProceed: boolean;             // false si problèmes bloquants
  mappings: ColumnMapping[];
  errors: SchemaError[];
  warnings: SchemaWarning[];
}

/**
 * Mapping entre colonne fichier et colonne Zoho
 */
export interface ColumnMapping {
  fileColumn: string;
  zohoColumn: string | null;
  fileType: string;
  zohoType: string | null;
  status: 'exact' | 'transform' | 'uncertain' | 'incompatible' | 'missing';
  confidence: number;
  transformRequired?: TransformationType;
  requiresUserConfirmation: boolean;
}
```

### 2.3 Data Transformer

```typescript
// lib/domain/data-transformer/types.ts

/**
 * Types de transformations supportées
 */
export type TransformationType =
  | 'date_format'           // DD/MM/YYYY → YYYY-MM-DD
  | 'decimal_separator'     // 1234,56 → 1234.56
  | 'thousand_separator'    // 1 234 567 → 1234567
  | 'scientific_notation'   // 1.5E6 → 1500000
  | 'boolean_normalize'     // Oui/Non → true/false
  | 'trim'                  // "  text  " → "text"
  | 'empty_normalize'       // "N/A", "null" → ""
  | 'none';                 // Pas de transformation

/**
 * Règle de transformation pour une colonne
 */
export interface TransformationRule {
  columnName: string;
  transformationType: TransformationType;
  sourceFormat?: string;    // Format source (ex: "DD/MM/YYYY")
  targetFormat?: string;    // Format cible (ex: "YYYY-MM-DD")
  requiresConfirmation: boolean;
}

/**
 * Résultat d'une transformation
 */
export interface TransformResult {
  originalValue: string;
  transformedValue: string;
  transformationType: TransformationType;
  success: boolean;
  error?: string;
}
```

### 2.4 Profile Manager

```typescript
// lib/domain/profile-manager/types.ts

/**
 * Profil d'import réutilisable
 */
export interface ImportProfile {
  id: string;
  name: string;
  description?: string;
  createdBy: string;
  
  // Signature fichier source
  columnNames: string[];
  columnCount: number;
  structureHash: string;
  
  // Configuration source
  dateFormat: string;              // "DD/MM/YYYY" confirmé
  decimalSeparator: ',' | '.';
  
  // Destination Zoho
  workspaceId: string;
  workspaceName: string;
  viewId: string;
  viewName: string;
  defaultImportMode: ImportMode;
  uniqueColumn?: string;           // Pour rollback
  
  // Mappings colonnes
  columnMappings: SavedColumnMapping[];
  
  // Paramètres validation
  defaultErrorThreshold: number;   // 0 = strict
  postImportCheck: boolean;
  
  // Métadonnées
  createdAt: Date;
  updatedAt: Date;
  lastUsedAt?: Date;
  useCount: number;
}

/**
 * Résultat de recherche de profil
 */
export interface ProfileMatchResult {
  found: boolean;
  profile?: ImportProfile;
  matchType: 'exact' | 'partial' | 'none';
  matchPercentage: number;
  differences?: ProfileDifference[];
}
```

---

## 3. Couche Infrastructure

### 3.1 Infrastructure Zoho (détaillée)

```
lib/infrastructure/zoho/
├── index.ts              # Exports publics
├── types.ts              # Types API Zoho
│   ├── ZohoTokens
│   ├── ZohoWorkspace
│   ├── ZohoTable (View)
│   ├── ZohoColumn
│   ├── ZohoFolder
│   ├── ZohoImportParams
│   ├── ZohoImportResponse
│   ├── ZohoApiError
│   └── ZohoAuthError
│
├── encryption.ts         # Chiffrement AES-256-GCM
│   ├── encrypt(data, key)
│   └── decrypt(encrypted, key)
│
├── auth.ts               # OAuth2 flow complet
│   ├── getAuthorizationUrl(region)
│   ├── exchangeCodeForTokens(code)
│   ├── refreshAccessToken(refreshToken)
│   ├── getTokens(userId)           # Avec auto-refresh
│   ├── saveTokens(userId, tokens)
│   ├── deleteTokens(userId)
│   └── convertToAnalyticsDomain()  # Fix domaine API
│
├── client.ts             # Client API unifié
│   ├── ZohoAnalyticsClient
│   │   ├── static forUser(userId)
│   │   ├── getOrganizations()
│   │   ├── getWorkspaces()
│   │   ├── getTables(workspaceId)
│   │   ├── getColumns(viewId)      # Via withInvolvedMetaInfo
│   │   ├── getFolders(workspaceId)
│   │   ├── importData(params)      # POST avec CONFIG
│   │   ├── readData(viewId, criteria)  # Pour vérification
│   │   └── deleteData(viewId, criteria) # Pour rollback
│   └── Helper functions
│
└── errors.ts             # Classes d'erreur
    ├── ZohoApiError
    └── ZohoAuthError
```

### 3.2 Endpoints API Zoho v2

| Action                    | Endpoint                                             | Méthode | Notes                      |
| ------------------------- | ---------------------------------------------------- | -------- | -------------------------- |
| Liste workspaces          | `/workspaces`                                      | GET      | Owned + Shared             |
| Détails workspace        | `/workspaces/{id}`                                 | GET      |                            |
| Liste tables              | `/workspaces/{id}/views`                           | GET      | Filtrer Table/QueryTable   |
| Détails table + colonnes | `/views/{id}?CONFIG={"withInvolvedMetaInfo":true}` | GET      | **Endpoint correct** |
| Liste dossiers            | `/workspaces/{id}/folders`                         | GET      | Hiérarchie                |
| Import données           | `/workspaces/{id}/views/{id}/data?CONFIG={...}`    | POST     | FormData avec FILE         |
| Lire données             | `/views/{id}/data?CONFIG={...}`                    | GET      | Pour vérification         |
| Supprimer données        | `/views/{id}/data`                                 | DELETE   | Pour rollback              |

### 3.3 Format CONFIG pour import

```typescript
interface ZohoImportConfig {
  importType: 'append' | 'truncateadd' | 'updateadd' | 'deleteupsert' | 'onlyadd';
  fileType: 'csv';
  autoIdentify: boolean;      // FALSE pour contrôle explicite
  dateFormat?: string;        // "yyyy-MM-dd" format Zoho
  matchingColumns?: string[]; // Pour updateadd/deleteupsert
}

// Exemple d'appel
const config = {
  importType: 'append',
  fileType: 'csv',
  autoIdentify: false,        // On contrôle nous-mêmes
  dateFormat: 'yyyy-MM-dd'
};

const url = `/workspaces/${wsId}/views/${viewId}/data?CONFIG=${encodeURIComponent(JSON.stringify(config))}`;

const formData = new FormData();
formData.append('FILE', csvBlob, 'import.csv');  // Champ FILE, pas ZOHO_FILE
```

---

## 4. Base de données Supabase

### 4.1 Schéma dédié

Toutes les tables sont dans le schéma **`csv_importer`** (pas `public`).

### 4.2 Tables

```sql
-- =====================================================
-- Tokens Zoho chiffrés par utilisateur
-- =====================================================
CREATE TABLE csv_importer.user_zoho_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Tokens chiffrés (AES-256-GCM)
  access_token_encrypted TEXT NOT NULL,
  refresh_token_encrypted TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  
  -- Métadonnées Zoho
  scope TEXT,
  api_domain TEXT,                -- https://analyticsapi.zoho.com
  org_id TEXT,
  zoho_user_id TEXT,
  zoho_email TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE csv_importer.user_zoho_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own tokens" ON csv_importer.user_zoho_tokens
  FOR ALL USING (auth.uid() = user_id);

-- =====================================================
-- Profils d'import (PARTAGÉS entre utilisateurs)
-- =====================================================
CREATE TABLE csv_importer.import_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Identification
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_by UUID REFERENCES auth.users(id),
  
  -- Signature du fichier source (pour détection auto)
  column_names TEXT[] NOT NULL,
  column_count INTEGER NOT NULL,
  structure_hash TEXT NOT NULL,
  
  -- Configuration source
  file_encoding TEXT DEFAULT 'UTF-8',
  csv_separator TEXT DEFAULT ',',
  date_format TEXT,                     -- "DD/MM/YYYY" confirmé par user
  decimal_separator TEXT DEFAULT ',',
  
  -- Destination Zoho
  workspace_id TEXT NOT NULL,
  workspace_name TEXT NOT NULL,
  view_id TEXT NOT NULL,
  view_name TEXT NOT NULL,
  default_import_mode TEXT DEFAULT 'append',
  
  -- Clé pour rollback (phase ultérieure)
  unique_column TEXT,
  
  -- Mappings colonnes (JSON)
  column_mappings JSONB NOT NULL,
  /*
  {
    "columns": [
      {
        "fileColumn": "Date début",
        "zohoColumn": "Date début",
        "fileType": "date",
        "zohoType": "DATE_AS_DATE",
        "sourceFormat": "DD/MM/YYYY",
        "targetFormat": "YYYY-MM-DD",
        "transformation": "date_format"
      }
    ]
  }
  */
  
  -- Paramètres validation
  default_error_threshold INTEGER DEFAULT 0,  -- 0 = strict
  post_import_check BOOLEAN DEFAULT true,
  
  -- Métadonnées
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,
  use_count INTEGER DEFAULT 0
);

-- Index pour recherche par structure
CREATE INDEX idx_profiles_structure_hash 
  ON csv_importer.import_profiles(structure_hash);

-- RLS - Tous les utilisateurs authentifiés peuvent lire/écrire
ALTER TABLE csv_importer.import_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage profiles" 
  ON csv_importer.import_profiles
  FOR ALL USING (auth.role() = 'authenticated');

-- =====================================================
-- Historique des imports (métadonnées uniquement)
-- =====================================================
CREATE TABLE csv_importer.import_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES csv_importer.import_profiles(id),
  user_id UUID REFERENCES auth.users(id),
  
  -- Fichier (métadonnées seulement, PAS le contenu)
  file_name TEXT NOT NULL,
  file_size_bytes INTEGER,
  row_count INTEGER,
  
  -- Résultat
  status TEXT NOT NULL,                 -- success, partial, error, rolled_back
  rows_sent INTEGER,
  rows_imported INTEGER,
  rows_failed INTEGER,
  error_threshold_used INTEGER,
  
  -- Vérification post-import
  post_check_performed BOOLEAN,
  post_check_passed BOOLEAN,
  post_check_differences JSONB,
  
  -- Rollback (phase ultérieure)
  was_rolled_back BOOLEAN DEFAULT false,
  rollback_reason TEXT,
  
  -- Transformations appliquées (pour audit)
  transformations_applied JSONB,
  
  -- Timing
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER,
  
  -- Erreurs détaillées
  errors JSONB
);

-- Index pour requêtes
CREATE INDEX idx_history_user ON csv_importer.import_history(user_id);
CREATE INDEX idx_history_date ON csv_importer.import_history(started_at DESC);
CREATE INDEX idx_history_profile ON csv_importer.import_history(profile_id);

-- RLS
ALTER TABLE csv_importer.import_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view all history" ON csv_importer.import_history
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Users can insert own history" ON csv_importer.import_history
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- =====================================================
-- Tables Zoho configurées (cache)
-- =====================================================
CREATE TABLE csv_importer.zoho_tables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id TEXT NOT NULL,
  view_id TEXT NOT NULL UNIQUE,
  view_name TEXT NOT NULL,
  view_type TEXT,
  folder_id TEXT,
  columns JSONB,                        -- Cache des colonnes
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- Règles de validation par table
-- =====================================================
CREATE TABLE csv_importer.validation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  view_id TEXT NOT NULL,
  rules JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 4.3 Permissions

```sql
-- Accès au schéma
GRANT USAGE ON SCHEMA csv_importer TO anon, authenticated;

-- Tables
GRANT ALL ON csv_importer.user_zoho_tokens TO authenticated;
GRANT ALL ON csv_importer.import_profiles TO authenticated;
GRANT ALL ON csv_importer.import_history TO authenticated;
GRANT ALL ON csv_importer.zoho_tables TO authenticated;
GRANT ALL ON csv_importer.validation_rules TO authenticated;
```

---

## 5. Flux de données complet

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           FLUX IMPORT COMPLET                                   │
└─────────────────────────────────────────────────────────────────────────────────┘

POSTE CLIENT (navigateur) - Zero Data Retention
═══════════════════════════════════════════════════════════════════════════════════

1. SÉLECTION FICHIER
   │
   ├── Parse CSV/Excel (Papa Parse / xlsx)
   ├── Extraire structure (colonnes, types)
   └── Calculer signature (hash)
         │
         ▼
2. DÉTECTION PROFIL ◄─────────────────────────── Supabase: import_profiles
   │
   ├── Profil trouvé ? → Charger config sauvegardée
   ├── Structure différente ? → Alerter utilisateur
   └── Nouveau fichier ? → Assistant création profil
         │
         ▼
3. VALIDATION SCHÉMA ◄────────────────────────── API Zoho: GET /views/{id}
   │
   ├── Récupérer colonnes table Zoho
   ├── Comparer fichier ↔ Zoho
   ├── Détecter incompatibilités (❌)
   ├── Résolution par utilisateur si bloquant
   └── BLOQUER si problème non résolu
         │
         ▼
4. TRANSFORMATION EXPLICITE
   │
   ├── Appliquer transformations configurées
   │   ├── Dates : JJ/MM/AAAA → AAAA-MM-JJ
   │   ├── Nombres : virgule → point
   │   └── Texte : trim, normalisation
   ├── Afficher récapitulatif transformations
   └── Confirmation utilisateur
         │
         ▼
5. PRÉVISUALISATION
   │
   ├── Afficher 10 lignes transformées
   ├── Vérifier visuellement les données
   └── Configurer seuil erreurs (utilisateur)
         │
         ▼
6. IMPORT TEST (10 lignes) ──────────────────── API Zoho: POST /views/{id}/data
   │
   ├── Envoyer 10 premières lignes
   ├── Relire depuis Zoho ◄──────────────────── API Zoho: GET /views/{id}/data
   ├── Comparer envoyé vs stocké
   └── Anomalie ? → Proposer arrêt/rollback
         │
         ▼
7. IMPORT COMPLET ───────────────────────────── API Zoho: POST /views/{id}/data
   │
   └── Envoyer lignes restantes (par batch si gros fichier)
         │
         ▼
8. VÉRIFICATION POST-IMPORT
   │
   ├── Compter lignes dans Zoho
   ├── Échantillonnage aléatoire (5 lignes)
   ├── Comparer valeurs
   └── Alerter si différence
         │
         ▼
9. RAPPORT FINAL
   │
   ├── Afficher résumé détaillé
   ├── Sauvegarder historique ────────────────► Supabase: import_history
   ├── Mettre à jour profil ──────────────────► Supabase: import_profiles
   └── Proposer téléchargement rapport

═══════════════════════════════════════════════════════════════════════════════════
```

---

## 6. Points techniques importants

### 6.1 Zero Data Retention

* **Traitement 100% côté client** (navigateur)
* **Aucun stockage de données CSV** sur serveur
* **Seules les métadonnées** sont persistées (Supabase)
* **Envoi direct** client → Zoho Analytics
* **Tokens chiffrés** AES-256-GCM en base

### 6.2 Gestion des erreurs API Zoho

```typescript
// Erreurs à gérer
class ZohoApiError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number
  ) {
    super(message);
  }
}

class ZohoAuthError extends Error {
  constructor(
    message: string,
    public code: string,
    public isRefreshable: boolean
  ) {
    super(message);
  }
}

// Retry automatique avec backoff
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3
): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await sleep(Math.pow(2, i) * 1000); // 1s, 2s, 4s
    }
  }
  throw new Error('Max retries exceeded');
}
```

### 6.3 Domaine API correct

```typescript
// ATTENTION: Zoho renvoie parfois zohoapis.com au lieu de analyticsapi.zoho.com
function convertToAnalyticsDomain(domain: string): string {
  // https://www.zohoapis.com → https://analyticsapi.zoho.com
  return domain.replace('www.zohoapis', 'analyticsapi.zoho');
}
```

---

## 7. Évolutions et roadmap

### Phase 1 - MVP (Complété)

* [X] Setup projet Next.js + Supabase
* [X] Authentification utilisateur
* [X] Wizard d'import (5 étapes)
* [X] Parsing CSV/Excel côté client
* [X] Moteur de validation basique
* [X] OAuth2 Zoho complet
* [X] Import réel vers Zoho

### Phase 2 - Validation avancée (En cours - Mission 004)

* [X] Récupération schéma Zoho (colonnes)
* [ ] Validation schéma avec résolution ❌
* [ ] Transformation explicite des données
* [ ] Prévisualisation avant import
* [ ] Vérification post-import

### Phase 3 - Profils et historique (Mission 005)

* [ ] Profils d'import réutilisables
* [ ] Détection automatique profil par structure
* [ ] Alerte si structure fichier change
* [ ] Historique enrichi des imports

### Phase 4 - Fonctionnalités avancées (Futur)

* [ ] Rollback après import test
* [ ] Import par lots avec progression
* [ ] Seuil d'erreurs configurable par utilisateur
* [ ] Export rapports PDF
* [ ] Connexion SFTP
* [ ] Multi-utilisateurs avancé

---

*Ce document d'architecture sert de référence pour tout le développement.*
*À mettre à jour lors de changements structurels majeurs.*

*Version 2.0 - 30 novembre 2025*
