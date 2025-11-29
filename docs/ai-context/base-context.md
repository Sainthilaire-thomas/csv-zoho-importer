
# CSV to Zoho Analytics Importer - Contexte de Base

*Mis à jour le 2025-11-29*

---

## Vue d'ensemble

### Description du projet

Application web permettant d'automatiser l'import de fichiers CSV/Excel dans Zoho Analytics, avec validation configurable des données et interface de correction des erreurs. L'objectif est de réduire le temps d'import de ~18 minutes à ~3-4 minutes tout en éliminant les erreurs manuelles.

### Utilisateurs cibles

2-3 personnes utilisant l'application pour importer des données vers Zoho Analytics.

### Contrainte de sécurité critique

**Zero Data Retention** : Aucune donnée CSV/Excel ne doit être conservée par l'application. Traitement en mémoire uniquement (côté client), transmission directe vers Zoho Analytics, seules les métadonnées sont loggées.

### Stack technique

| Composant          | Technologie          | Version |
| ------------------ | -------------------- | ------- |
| Framework          | Next.js (App Router) | 15.x    |
| Langage            | TypeScript           | 5.x     |
| Styling            | Tailwind CSS         | 4.x     |
| Auth & DB          | Supabase             | latest  |
| Dark mode          | next-themes          | latest  |
| Hosting            | Vercel (Hobby)       | -       |
| API externe        | Zoho Analytics API   | v2      |
| Parsing CSV        | Papa Parse           | 5.x     |
| Parsing Excel      | xlsx                 | 0.18.x  |
| State management   | React hooks          | -       |
| Validation schemas | Zod                  | 3.x     |
| Icônes            | Lucide React         | latest  |

### Contrainte Vercel Hobby

* Limite requête API : **4.5 MB**
* Limite durée fonction : **10 secondes** (60s pour fonctions spéciales)
* **Solution** : Traitement 100% côté client pour les fichiers volumineux (jusqu'à 200 MB)

---

## Architecture globale

```
┌─────────────────────────────────────────────────────────────────┐
│                     FRONTEND (Next.js App Router)               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │   Import    │  │  Settings   │  │   History   │             │
│  │   Wizard    │  │   (Rules)   │  │    List     │             │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘             │
│         └────────────────┼────────────────┘                     │
│                          ▼                                      │
│              CLIENT-SIDE PROCESSING                             │
│    ┌──────────────┐ ┌──────────────┐ ┌──────────────┐          │
│    │  CSV/Excel   │ │  Validation  │ │    Batch     │          │
│    │   Parser     │ │   Engine     │ │   Upload     │          │
│    └──────────────┘ └──────────────┘ └──────────────┘          │
│                          │                                      │
│                          ▼                                      │
│                   API LAYER (Route Handlers)                    │
│      /zoho/oauth/*   /zoho/tables   /zoho/import   /csv/*      │
└─────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
        ┌──────────┐   ┌──────────┐   ┌──────────┐
        │   SFTP   │   │ Supabase │   │   Zoho   │
        │  Server  │   │  - Auth  │   │ Analytics│
        │ (futur)  │   │  - Tokens│   │   API    │
        └──────────┘   │  - Logs  │   └──────────┘
                       └──────────┘
```

---

## Authentification Zoho Analytics

### Approche : OAuth2 flow complet dans l'app

Chaque utilisateur connecte son propre compte Zoho via l'interface. Les tokens sont stockés chiffrés dans Supabase.

```
┌─────────────────────────────────────────────────────────────────┐
│  1. User clique "Connecter à Zoho"                              │
│                          ↓                                       │
│  2. Redirection vers Zoho login (OAuth2)                        │
│                          ↓                                       │
│  3. User autorise l'application                                 │
│                          ↓                                       │
│  4. Zoho renvoie un code → échangé contre tokens                │
│                          ↓                                       │
│  5. Tokens stockés chiffrés dans Supabase                       │
│                          ↓                                       │
│  6. User peut importer (tokens auto-refresh)                    │
└─────────────────────────────────────────────────────────────────┘
```

### Avantages

* **Autonomie** : Pas de gestion manuelle des refresh tokens
* **Multi-user** : Chaque user a ses propres accès Zoho
* **Sécurité** : Tokens chiffrés, jamais exposés

---

## Structure actuelle du projet

```
csv-zoho-importer/
├── app/
│   ├── (auth)/
│   │   ├── login/
│   │   │   └── page.tsx
│   │   └── layout.tsx
│   ├── (dashboard)/
│   │   ├── history/
│   │   │   └── page.tsx
│   │   ├── import/
│   │   │   └── page.tsx
│   │   ├── settings/
│   │   │   ├── rules/
│   │   │   └── page.tsx
│   │   └── layout.tsx
│   ├── api/
│   │   ├── csv/
│   │   │   ├── import/
│   │   │   │   └── route.ts        # SIMULÉ - à connecter
│   │   │   └── validate/
│   │   │       └── route.ts
│   │   ├── imports/
│   │   ├── rules/
│   │   └── zoho/
│   │       └── tables/
│   │           └── route.ts        # Retourne mock data - à connecter
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── import/
│   │   ├── wizard/
│   │   │   ├── import-wizard.tsx
│   │   │   ├── index.ts
│   │   │   ├── step-config.tsx
│   │   │   ├── step-confirm.tsx
│   │   │   ├── step-review.tsx
│   │   │   ├── step-source.tsx
│   │   │   ├── step-validate.tsx
│   │   │   └── wizard-progress.tsx
│   │   ├── file-upload.tsx
│   │   ├── table-selector.tsx
│   │   └── validation-results.tsx
│   ├── layout/
│   │   ├── header.tsx
│   │   ├── sidebar.tsx
│   │   └── theme-toggle.tsx
│   ├── rules/
│   ├── ui/
│   │   ├── alert.tsx
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   └── progress.tsx
│   └── theme-provider.tsx
├── lib/
│   ├── domain/
│   │   ├── file-provider/
│   │   └── validation/
│   │       ├── rules/
│   │       │   ├── base.ts
│   │       │   ├── date.ts
│   │       │   ├── email.ts
│   │       │   ├── index.ts
│   │       │   ├── number.ts
│   │       │   └── required.ts
│   │       ├── engine.ts
│   │       └── index.ts
│   ├── hooks/
│   │   ├── use-csv-parser.ts
│   │   ├── use-import.ts
│   │   └── use-validation.ts
│   ├── infrastructure/
│   │   ├── supabase/
│   │   │   ├── client.ts
│   │   │   └── server.ts
│   │   └── zoho/                   # VIDE - À CRÉER
│   └── utils/
├── types/
│   └── index.ts
├── docs/
│   └── ai-context/
│       ├── missions/
│       │   ├── mission-001-setup-initial.md
│       │   ├── mission-002-wizard-import.md
│       │   ├── mission-003-api-zoho.md
│       │   └── TEMPLATE-MISSION.md
│       ├── base-context.md
│       └── README.md
├── middleware.ts
├── tailwind.config.ts
└── tsconfig.json
```

---

## Types et interfaces principaux

```typescript
// types/index.ts

// ==================== IMPORT ====================

export type ImportStatus =
  | 'idle'
  | 'selecting'
  | 'configuring'
  | 'validating'
  | 'reviewing'
  | 'importing'
  | 'success'
  | 'error';

export type ImportMode = 
  | 'append'        // Ajouter à la fin
  | 'truncateadd'   // Supprimer tout et ajouter
  | 'updateadd'     // Mettre à jour ou ajouter
  | 'deleteupsert'  // Synchroniser (supprimer absents)
  | 'onlyadd';      // Ajouter uniquement les nouveaux

export type FileSource = 'upload' | 'sftp';

export interface ImportConfig {
  source: FileSource;
  file: File | null;
  sftpPath: string | null;
  tableId: string;
  tableName: string;
  importMode: ImportMode;
}

export interface ImportState {
  status: ImportStatus;
  config: ImportConfig;
  validation: ValidationResult | null;
  progress: ImportProgress | null;
  result: ImportResult | null;
  error: string | null;
}

// ==================== VALIDATION ====================

export type RuleType =
  | 'required'
  | 'date'
  | 'number'
  | 'email'
  | 'enum'
  | 'regex'
  | 'length'
  | 'custom';

export interface ValidationRule {
  type: RuleType;
  enabled: boolean;
  params?: Record<string, unknown>;
  message?: string;
}

export interface ValidationError {
  line: number;
  column: string;
  value: string;
  rule: RuleType;
  message: string;
}

export interface ValidationResult {
  isValid: boolean;
  totalRows: number;
  validRows: number;
  errorRows: number;
  errors: ValidationError[];
  preview?: ParsedRow[];
}

// ==================== ZOHO (À COMPLÉTER) ====================

export interface ZohoTable {
  id: string;
  name: string;
  displayName: string;
  workspaceId: string;
  columns?: ZohoColumn[];
}

export interface ZohoColumn {
  name: string;
  displayName: string;
  dataType: string;
  isRequired: boolean;
}

export interface ZohoWorkspace {
  id: string;
  name: string;
}
```

---

## Hooks personnalisés

### useImport

Gestion d'état du wizard d'import avec `useReducer`.

```typescript
const { 
  state,           // ImportState
  setFile,         // (file: File) => void
  removeFile,      // () => void
  setTable,        // (tableId: string, tableName: string) => void
  setImportMode,   // (mode: ImportMode) => void
  startValidation, // () => void
  setValidationResult, // (result: ValidationResult) => void
  goToStep,        // (status: ImportStatus) => void
  goNext,          // () => void
  goBack,          // () => void
  reset,           // () => void
  canGoNext,       // boolean
  isImporting,     // boolean
} = useImport();
```

### useCsvParser

Parser pour fichiers CSV et Excel côté client.

```typescript
const { parseFile } = useCsvParser();
// Retourne { data, headers, totalRows, fileName, fileType }
const result = await parseFile(file);
```

### useValidation

Validation côté client avec progression.

```typescript
const { validate, isValidating } = useValidation({
  onProgress: (percentage) => console.log(`${percentage}%`)
});
const result = await validate(data, config);
```

---

## Composants UI

### Button

```tsx
<Button 
  variant="primary|secondary|outline|ghost|danger"
  size="sm|md|lg"
  isLoading={boolean}
  leftIcon={<Icon />}
  rightIcon={<Icon />}
/>
```

### Card

```tsx
<Card variant="default|bordered|elevated" padding="none|sm|md|lg">
  <CardHeader>
    <CardTitle>Titre</CardTitle>
    <CardDescription>Description</CardDescription>
  </CardHeader>
  <CardContent>...</CardContent>
  <CardFooter>...</CardFooter>
</Card>
```

### Alert

```tsx
<Alert 
  variant="info|success|warning|error" 
  title="Titre optionnel"
  dismissible
  onDismiss={() => {}}
>
  Contenu
</Alert>
```

### Progress

```tsx
<Progress value={50} max={100} size="sm|md|lg" showLabel animated />
```

---

## Configuration Tailwind CSS v4

⚠️ **Important** : Tailwind CSS v4 utilise une nouvelle syntaxe.

### globals.css

```css
@import "tailwindcss";

@variant dark (&:where(.dark, .dark *));
```

### tailwind.config.ts

```typescript
import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: 'class',
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: { extend: {} },
  plugins: [],
};

export default config;
```

---

## Base de données Supabase

### Schéma dédié

Les tables sont dans le schéma **`csv_importer`** (pas le schéma `public`).

### Tables existantes

```sql
-- Tables Zoho configurées (mock data actuellement)
csv_importer.zoho_tables (
  id UUID PRIMARY KEY,
  zoho_table_id TEXT UNIQUE,
  name TEXT,
  display_name TEXT,
  workspace_id TEXT,
  columns JSONB,
  is_active BOOLEAN,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)

-- Règles de validation par table
csv_importer.validation_rules (
  id UUID PRIMARY KEY,
  zoho_table_id UUID REFERENCES zoho_tables(id),
  column_name TEXT,
  rules JSONB,
  is_active BOOLEAN,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)

-- Logs des imports (métadonnées uniquement)
csv_importer.import_logs (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  zoho_table_id UUID,
  file_name TEXT,
  file_size_bytes INTEGER,
  import_mode TEXT,
  status TEXT,
  rows_total INTEGER,
  rows_imported INTEGER,
  rows_errors INTEGER,
  error_summary JSONB,
  zoho_import_id TEXT,
  duration_ms INTEGER,
  created_at TIMESTAMPTZ
)
```

### Table à créer (Mission 003)

```sql
-- Tokens Zoho chiffrés par utilisateur
csv_importer.user_zoho_tokens (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  access_token_encrypted TEXT NOT NULL,
  refresh_token_encrypted TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  scope TEXT,
  api_domain TEXT,
  zoho_user_id TEXT,
  zoho_email TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
```

---

## Variables d'environnement

### Actuelles (.env.local)

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...

# Application
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### À ajouter (Mission 003)

```bash
# Zoho OAuth2 App
ZOHO_CLIENT_ID=1000.XXXXXXXXXXXX
ZOHO_CLIENT_SECRET=XXXXXXXXXXXX

# Zoho API Domains (US par défaut)
ZOHO_API_DOMAIN=analyticsapi.zoho.com
ZOHO_ACCOUNTS_DOMAIN=accounts.zoho.com

# Chiffrement des tokens
ENCRYPTION_KEY=your-32-bytes-secret-key-here
```

---

## Règles métier critiques

### 1. Zero Data Retention

```typescript
// Les données CSV/Excel ne transitent JAMAIS par le serveur pour stockage
// Traitement 100% côté client
// Seules les métadonnées sont loggées
```

### 2. Validation avant import

```typescript
// L'import n'est JAMAIS exécuté si la validation échoue
if (!validationResult.isValid) {
  return { success: false, errors: validationResult.errors };
}
```

### 3. Tokens chiffrés

```typescript
// Les tokens Zoho sont TOUJOURS chiffrés en base
// Jamais de tokens en clair dans les logs
// Déchiffrement uniquement au moment de l'utilisation
```

---

## État d'avancement

### ✅ Complété (Missions 001-002)

* Setup projet Next.js 15
* Authentification Supabase
* Dark mode toggle
* Structure de base
* Base de données (schéma csv_importer)
* Wizard d'import complet (5 étapes)
* Composants UI (Button, Card, Progress, Alert)
* Moteur de validation (4 règles : required, date, number, email)
* Support CSV et Excel (.xlsx, .xls)
* Traitement côté client (fichiers jusqu'à 200 MB)

### 🔄 En cours (Mission 003)

* **Intégration API Zoho Analytics**
  * [ ] OAuth2 flow complet dans l'app
  * [ ] Stockage tokens chiffrés
  * [ ] Client Zoho (workspaces, tables, import)
  * [ ] Routes API Zoho
  * [ ] UI connexion Zoho
  * [ ] Import réel vers Zoho

### 📋 À faire (Futures missions)

* Éditeur de règles de validation
* Connexion SFTP
* Page Historique des imports
* Déploiement Vercel

---

## Commandes utiles

```bash
# Développement
cd "C:\Users\thoma\OneDrive\SONEAR_2025\csv-zoho-importer"
npm run dev

# Build
npm run build

# Générer arborescence projet
# Dans VS Code : Ctrl+Shift+P → "Run Task" → "Generate Project Tree"
```

---

*Ce document doit être mis à jour lorsque les types fondamentaux ou l'architecture changent.*
