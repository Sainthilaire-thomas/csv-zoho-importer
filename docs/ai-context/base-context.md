
# CSV to Zoho Analytics Importer - Contexte de Base

*Mis à jour le 2025-11-30 (Session 4)*

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
│   /zoho/oauth/*  /zoho/workspaces  /zoho/tables  /zoho/folders │
│   /zoho/import ✅                                               │
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

### Approche : OAuth2 flow complet dans l'app ✅ FONCTIONNEL

Chaque utilisateur connecte son propre compte Zoho via l'interface. Les tokens sont stockés chiffrés (AES-256-GCM) dans Supabase.

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

### Points techniques importants

1. **Domaine API** : Toujours utiliser `analyticsapi.zoho.com` (pas `zohoapis.com`)
2. **Variables serveur** : `APP_URL` nécessaire en plus de `NEXT_PUBLIC_APP_URL`
3. **Cookies OAuth** : 2 cookies séparés (`zoho_oauth_state` et `zoho_oauth_region`)
4. **UUID** : Utiliser `crypto.randomUUID()` (pas le package `uuid`)
5. **Casse viewType** : Zoho renvoie 'Table'/'QueryTable', pas 'TABLE'/'QUERY_TABLE'

---

## Import Zoho Analytics API v2 ✅ FONCTIONNEL

### Endpoint correct

```
POST /restapi/v2/workspaces/{workspaceId}/views/{viewId}/data?CONFIG={encoded_json}
```

### Format de la requête

```typescript
// CONFIG en JSON encodé dans query string
const config = {
  importType: 'append',      // append|truncateadd|updateadd|deleteupsert|onlyadd
  fileType: 'csv',
  autoIdentify: true,
  dateFormat: 'dd/MM/yyyy',
  matchingColumns: ['col1']  // optionnel, pour updateadd/deleteupsert
};

// FormData avec fichier
const formData = new FormData();
formData.append('FILE', csvBlob, 'import.csv');  // ⚠️ 'FILE' pas 'ZOHO_FILE'

// Headers
{
  'Authorization': 'Zoho-oauthtoken {access_token}',
  'ZANALYTICS-ORGID': '{orgId}'
}
```

### Points techniques import

1. **CONFIG** : JSON encodé avec `encodeURIComponent()` dans query string
2. **Fichier** : Champ `FILE` (pas `ZOHO_FILE`)
3. **URL** : Utilise `viewId` (pas le nom de table)
4. **importType** : En minuscules dans le CONFIG

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
│   │   │   ├── import/route.ts
│   │   │   └── validate/route.ts
│   │   └── zoho/
│   │       ├── oauth/
│   │       │   ├── authorize/route.ts   ✅
│   │       │   ├── callback/route.ts    ✅
│   │       │   ├── status/route.ts      ✅
│   │       │   └── disconnect/route.ts  ✅
│   │       ├── workspaces/route.ts      ✅
│   │       ├── tables/route.ts          ✅
│   │       ├── folders/route.ts         ✅
│   │       └── import/route.ts          ✅ FONCTIONNEL
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── import/
│   │   ├── wizard/
│   │   │   ├── import-wizard.tsx        ✅
│   │   │   ├── index.ts
│   │   │   ├── step-config.tsx          ✅ (accordéon)
│   │   │   ├── step-confirm.tsx         ✅
│   │   │   ├── step-review.tsx
│   │   │   ├── step-source.tsx
│   │   │   ├── step-validate.tsx
│   │   │   └── wizard-progress.tsx
│   │   ├── file-upload.tsx
│   │   ├── table-selector.tsx
│   │   ├── table-selector-accordion.tsx ✅
│   │   └── validation-results.tsx
│   ├── layout/
│   │   ├── header.tsx
│   │   ├── sidebar.tsx
│   │   └── theme-toggle.tsx
│   ├── zoho/
│   │   ├── zoho-connect-button.tsx      ✅
│   │   └── zoho-connection-status.tsx   ✅
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
│   │   └── zoho/                        ✅
│   │       ├── types.ts
│   │       ├── encryption.ts
│   │       ├── auth.ts
│   │       ├── client.ts                ✅ importData corrigé
│   │       └── index.ts
│   └── utils/
├── types/
│   └── index.ts                         ✅ ZohoFolder ajouté
├── docs/
│   └── ai-context/
│       ├── missions/
│       │   ├── mission-001-setup-initial.md
│       │   ├── mission-002-wizard-import.md
│       │   ├── mission-003-api-zoho.md  ✅ COMPLÉTÉE
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
  | 'append'        // APPEND - Ajouter à la fin
  | 'truncateadd'   // TRUNCATEADD - Supprimer tout et ajouter
  | 'updateadd'     // UPDATEADD - Mettre à jour ou ajouter
  | 'deleteupsert'  // DELETEUPSERT - Synchroniser (supprimer absents)
  | 'onlyadd';      // ONLYADD - Ajouter uniquement les nouveaux

export type FileSource = 'upload' | 'sftp';

export interface ImportConfig {
  source: FileSource;
  file: File | null;
  sftpPath: string | null;
  workspaceId: string;
  workspaceName: string;
  viewId: string;
  viewName: string;
  importMode: ImportMode;
}

// ==================== ZOHO ====================

export interface ZohoWorkspace {
  id: string;          // workspaceId
  name: string;        // workspaceName
  orgId?: string;
}

export interface ZohoView {
  id: string;          // viewId
  name: string;        // viewName
  displayName: string;
  workspaceId: string;
  type?: string;       // 'Table' | 'QueryTable'
  folderId?: string;   // ID du dossier parent
}

export interface ZohoFolder {
  folderId: string;
  folderName: string;
  parentFolderId: string;  // '-1' pour dossiers racine
  isDefault: boolean;
}

export interface ZohoTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  scope: string;
  apiDomain: string;
}

// ==================== ZOHO IMPORT ====================

export interface ZohoImportParams {
  workspaceId: string;
  viewId: string;
  viewName: string;
  importType: ImportMode;
  data: string;           // CSV data
  autoIdentify?: boolean;
  dateFormat?: string;
  matchingColumns?: string[];
}

export interface ZohoImportResponse {
  success: boolean;
  importSummary?: {
    importType: string;
    totalColumnCount: number;
    selectedColumnCount: number;
    totalRowCount: number;
    successRowCount: number;
    warnings: number;
  };
  error?: string;
}
```

---

## Base de données Supabase

### Schéma dédié

Les tables sont dans le schéma **`csv_importer`** (pas le schéma `public`).

### Tables existantes

```sql
-- Tokens Zoho chiffrés par utilisateur ✅
csv_importer.user_zoho_tokens (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  access_token_encrypted TEXT NOT NULL,
  refresh_token_encrypted TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  scope TEXT,
  api_domain TEXT,           -- Stocke analyticsapi.zoho.com
  zoho_user_id TEXT,
  zoho_email TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)

-- Tables Zoho configurées
csv_importer.zoho_tables (...)

-- Règles de validation par table
csv_importer.validation_rules (...)

-- Logs des imports (métadonnées uniquement)
csv_importer.import_logs (...)
```

### Permissions Supabase

```sql
GRANT USAGE ON SCHEMA csv_importer TO anon, authenticated;
GRANT ALL ON csv_importer.user_zoho_tokens TO authenticated;
GRANT ALL ON csv_importer.zoho_tables TO authenticated;
GRANT ALL ON csv_importer.validation_rules TO authenticated;
GRANT ALL ON csv_importer.import_logs TO authenticated;
```

---

## Variables d'environnement

### .env.local actuel

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...

# Zoho OAuth2 App
ZOHO_CLIENT_ID=1000.XTCYES...
ZOHO_CLIENT_SECRET=xxx...

# Zoho API Domains (région US)
ZOHO_API_DOMAIN=https://analyticsapi.zoho.com
ZOHO_ACCOUNTS_DOMAIN=https://accounts.zoho.com

# Chiffrement des tokens
ENCRYPTION_KEY=your-32-bytes-secret-key-here

# URLs Application (LES DEUX SONT NÉCESSAIRES)
NEXT_PUBLIC_APP_URL=http://localhost:3000
APP_URL=http://localhost:3000
```

---

## Configuration Tailwind CSS v4

⚠️ **Important** : Tailwind CSS v4 utilise une nouvelle syntaxe.

### globals.css

```css
@import "tailwindcss";

@variant dark (&:where(.dark, .dark *));
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

### ✅ Complété (Mission 003 - Sessions 1-4)

* OAuth2 flow complet fonctionnel
* Stockage tokens chiffrés (AES-256-GCM)
* Liste des workspaces
* Liste des tables (48 tables, filtrées Table/QueryTable)
* Liste des dossiers (13 dossiers avec hiérarchie)
* Composant accordéon pour sélection de tables
* Recherche en temps réel sur les tables
* UI connexion Zoho avec état visible
* **Import réel vers Zoho Analytics fonctionnel** ✅
  * Endpoint correct : `/views/{viewId}/data?CONFIG=...`
  * Format API v2 avec CONFIG en query string
  * Test réussi : 3 lignes → TEST_IMPORT
  * Test réussi : 14 lignes → QUITTANCES (976ms)

### 📋 À faire (Mission 004 - Prochaine session)

**Renforcement de la qualité des imports :**

1. **Récupération du schéma table Zoho**
   * API pour obtenir les colonnes et leurs types
   * Stocker en cache pour éviter appels répétés
2. **Validation basée sur le schéma cible**
   * Comparer colonnes fichier vs colonnes table Zoho
   * Valider les types (date, number, text)
   * Détecter colonnes manquantes/supplémentaires
3. **Transformation automatique des données**
   * Convertir formats de date
   * Normaliser nombres (séparateurs décimaux)
   * Mapper noms de colonnes si différents
4. **Prévisualisation avant import**
   * Afficher 5-10 lignes transformées
   * Montrer les correspondances colonnes
   * Alerter sur les problèmes potentiels
5. **Vérification post-import**
   * Comparer rowCount attendu vs importé
   * Détecter les warnings Zoho
   * Afficher rapport détaillé

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

# Nettoyer cache et redémarrer
Remove-Item -Recurse -Force .next
npm run dev

# Build
npm run build

# Générer arborescence projet
# Dans VS Code : Ctrl+Shift+P → "Run Task" → "Generate Project Tree"
```

---

## Problèmes résolus (référence)

### 1. Domaine API incorrect

**Symptôme** : `Invalid URL /restapi/v2/workspaces`
**Cause** : Zoho renvoie `zohoapis.com` par défaut au lieu de `analyticsapi.zoho.com`
**Solution** : Fonction `convertToAnalyticsDomain()` dans `auth.ts`

### 2. Variables env serveur

**Symptôme** : `URL is malformed "undefined"`
**Cause** : `NEXT_PUBLIC_*` pas disponibles côté serveur
**Solution** : Ajouter `APP_URL` en plus de `NEXT_PUBLIC_APP_URL`

### 3. Cookies OAuth invalides

**Symptôme** : `invalid_state` au callback
**Cause** : Incohérence entre 2 cookies vs 1 cookie JSON
**Solution** : Utiliser 2 cookies séparés (`state` et `region`)

### 4. Module uuid manquant

**Symptôme** : `Cannot find module 'uuid'`
**Solution** : Utiliser `crypto.randomUUID()` natif Node.js

### 5. Casse viewType

**Symptôme** : Aucune table retournée alors que 206 vues existent
**Cause** : Zoho renvoie 'Table'/'QueryTable', code filtrait 'TABLE'/'QUERY_TABLE'
**Solution** : Comparaison insensible à la casse ou correction du filtre

### 6. Double lecture Response.json()

**Symptôme** : `body stream already read`
**Cause** : Appel à `.json()` deux fois sur la même Response
**Solution** : Stocker le résultat dans une variable avant de l'utiliser

### 7. Endpoint import incorrect (Session 4) ✅ NOUVEAU

**Symptôme** : Erreur 404 `URL_RULE_NOT_CONFIGURED`
**Cause** : URL utilisait le nom de table au lieu du viewId
**Solution** : Utiliser `/views/{viewId}/data` avec CONFIG en query string

### 8. Paramètres import mal formatés (Session 4) ✅ NOUVEAU

**Symptôme** : Erreur 500 lors de l'import
**Cause** : Paramètres dans FormData au lieu de query string, `ZOHO_FILE` au lieu de `FILE`
**Solution** : CONFIG encodé en JSON dans query string, fichier avec nom `FILE`

---

*Ce document doit être mis à jour lorsque les types fondamentaux ou l'architecture changent.*
*Dernière mise à jour : 2025-11-30 12:30*
