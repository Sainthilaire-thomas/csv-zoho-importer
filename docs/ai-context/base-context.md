
# CSV to Zoho Analytics Importer - Contexte de Base

*Mis à jour le 2025-12-05 (Mission 007 en cours - Phase 1 complète)*

---

## Vue d'ensemble

### Description du projet

Application web permettant d'automatiser l'import de fichiers CSV/Excel dans Zoho Analytics, avec  **profils d'import réutilisables** , transformations explicites et interface de contrôle complète. L'objectif est de réduire le temps d'import de ~18 minutes à ~3-4 minutes tout en garantissant l'intégrité des données (zéro erreur silencieuse).

### Utilisateurs cibles

2-3 personnes utilisant l'application pour importer des données vers Zoho Analytics de manière récurrente (quotidien/mensuel).

### Principes fondamentaux

1. **Zero Data Retention** : Aucune donnée CSV/Excel conservée. Traitement 100% côté client.
2. **Profils réutilisables** : Configurer une fois, réutiliser automatiquement.
3. **Explicite plutôt qu'implicite** : Aucune conversion silencieuse. L'utilisateur voit et valide chaque transformation.
4. **Échec rapide** : Bloquer AVANT l'import si doute sur l'intégrité des données.
5. **Accumulation intelligente** : Le profil apprend les alias et formats au fil du temps.
6. **Un profil = une table** : Relation 1:1 stricte (un profil par table Zoho).

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

## Concept central : Profils d'Import

### Paradigme

Un **Profil d'Import** est une configuration attachée à une **table Zoho** qui définit :

* Comment interpréter les colonnes des fichiers sources
* Comment transformer les données vers un format universel
* Quels alias de noms de colonnes sont acceptés
* Le mode d'import par défaut (APPEND, TRUNCATEADD, UPDATEADD...)
* La clé de matching pour les modes UPDATE*

```
Fichiers Excel          PROFIL                    Table Zoho
(formats variables)     (normalisation)           (format fixe)

┌─────────────┐                                   ┌─────────────┐
│ Fichier A   │───┐                          ┌───▶│ QUITTANCES  │
│ DD/MM/YYYY  │   │    ┌─────────────┐       │    │             │
└─────────────┘   │    │             │       │    │ YYYY-MM-DD  │
                  ├───▶│   PROFIL    │───────┤    │ HH:mm:ss    │
┌─────────────┐   │    │ QUITTANCES  │       │    │ 1234.56     │
│ Fichier B   │───┤    │             │       │    │             │
│ DD-MM-YYYY  │   │    └─────────────┘       │    └─────────────┘
└─────────────┘   │                          │
                  │                          │
┌─────────────┐   │                          │
│ Fichier C   │───┘                          │
│ Legacy      │                              │
└─────────────┘
```

### Règles métier

| #  | Règle                                                                             |
| -- | ---------------------------------------------------------------------------------- |
| R1 | Un profil = une table Zoho (relation 1:1 via view_id UNIQUE)                       |
| R2 | Le profil accumule les alias/formats au fil du temps                               |
| R3 | Les formats ambigus (dates JJ/MM vs MM/JJ) nécessitent confirmation unique        |
| R4 | La notation scientifique est toujours développée (1E6 → 1000000)                |
| R5 | Les profils sont partagés entre tous les utilisateurs                             |
| R6 | Seules les métadonnées sont stockées (zero data retention)                      |
| R7 | Un profil = une configuration complète (mode + clé non modifiables à la volée) |
| R8 | Les modes UPDATEADD, DELETEUPSERT, ONLYADD nécessitent une clé de matching       |
| R9 | La clé de matching est obligatoire à la création si le mode le requiert         |

### Modes d'import

| Mode                   | Clé requise    | Description                         |
| ---------------------- | --------------- | ----------------------------------- |
| **APPEND**       | ❌ Non          | Ajoute les lignes à la fin         |
| **TRUNCATEADD**  | ❌ Non          | Vide la table, réimporte tout      |
| **UPDATEADD**    | ✅**Oui** | Met à jour si existe, ajoute sinon |
| **DELETEUPSERT** | ✅**Oui** | Supprime absents + upsert           |
| **ONLYADD**      | ✅**Oui** | Ajoute uniquement les nouveaux      |

### Formats universels

| Type         | Formats sources                    | Format universel         | Format Zoho     |
| ------------ | ---------------------------------- | ------------------------ | --------------- |
| Date         | DD/MM/YYYY, DD-MM-YYYY, MM/DD/YYYY | `YYYY-MM-DD`(ISO)      | DATE_AS_DATE    |
| Durée       | HH:mm, H:mm, HH:mm:ss              | `HH:mm:ss`             | DURATION        |
| Nombre       | 1234,56 / 1234.56 / 1 234,56       | `1234.56`              | DECIMAL_NUMBER  |
| Scientifique | 1E6, 2.5E3                         | `1000000`(développé) | Texte ou Nombre |

---

## Architecture globale

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                     FRONTEND (Next.js App Router)                               │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐                 │
│  │  Import Wizard  │  │    Settings     │  │    History      │                 │
│  │  (10 étapes)    │  │    (Profils)    │  │    (Logs)       │                 │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘                 │
│           └────────────────────┼────────────────────┘                           │
│                                ▼                                                │
│              CLIENT-SIDE PROCESSING (Zero Data Retention)                       │
│    ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐         │
│    │  CSV/Excel   │ │   Profile    │ │    Data      │ │   Schema     │         │
│    │   Parser     │ │   Matcher    │ │ Transformer  │ │  Validator   │         │
│    └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘         │
│                                │                                                │
│                                ▼                                                │
│                   API LAYER (Route Handlers)                                    │
│   /zoho/oauth/*  /zoho/workspaces  /zoho/tables  /zoho/columns  /zoho/import   │
│   /zoho/data     /zoho/delete      /profiles/*   /profiles/match               │
└─────────────────────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
        ┌──────────┐   ┌──────────┐   ┌──────────┐
        │ Supabase │   │   Zoho   │   │   SFTP   │
        │ - Auth   │   │ Analytics│   │  Server  │
        │ - Tokens │   │   API    │   │ (futur)  │
        │ - Profiles│  │          │   │          │
        │ - History│   │          │   │          │
        └──────────┘   └──────────┘   └──────────┘
```

---

## Wizard d'import (10 étapes - Mission 007)

```
1. Sélection fichier     Upload CSV/Excel (jusqu'à 200 MB)
        ↓
2. Profil import         Parsing → Matching profil existant ou création
        ↓
3. Configuration         Sélection workspace/table Zoho + mode import
        ↓
4. Validation            Validation schéma + détection transformations
        ↓
5. Résolution            Confirmation formats ambigus (dates, notation scientifique)
        ↓
6. Aperçu                Preview des transformations source → Zoho
        ↓
7. Récapitulatif         Résumé avant test
        ↓
8. Test import           Import 5 lignes → Vérification → Tableau comparatif   ← NOUVEAU
        ↓
9. Import                Si OK: import reste | Si KO: rollback + correction    ← NOUVEAU
        ↓
10. Terminé              Confirmation finale avec lien Zoho
```

### Types de transformations

| Type                  | Affichage    | Bloquant | Exemple            |
| --------------------- | ------------ | -------- | ------------------ |
| decimal_comma         | 🔄 Info      | Non      | 1234,56 → 1234.56 |
| short_duration        | 🔄 Info      | Non      | 23:54 → 23:54:00  |
| thousands_separator   | 🔄 Info      | Non      | 1 234 → 1234      |
| ambiguous_date_format | ⚠️ Confirm | Oui      | 05/03/2025 → ?    |
| scientific_notation   | ⚠️ Confirm | Oui      | 1E6 → 1000000     |
| iso_date              | ⚠️ Confirm | Oui      | 2025-03-05 → ?    |

### Trois chemins à l'étape Profil

| Chemin          | Mode         | Comportement                                            |
| --------------- | ------------ | ------------------------------------------------------- |
| Profil existant | `existing` | Pré-remplit config, skip résolution si formats connus |
| Nouveau profil  | `new`      | Configuration complète, sauvegardé après import      |
| Sans profil     | `none`     | Config manuelle à chaque fois                          |

---

## Structure du projet

```
csv-zoho-importer/
├── app/
│   ├── (authenticated)/
│   │   ├── import/page.tsx
│   │   ├── history/page.tsx
│   │   └── settings/page.tsx
│   ├── api/
│   │   ├── zoho/
│   │   │   ├── oauth/callback/route.ts
│   │   │   ├── oauth/initiate/route.ts
│   │   │   ├── oauth/status/route.ts
│   │   │   ├── workspaces/route.ts
│   │   │   ├── tables/route.ts
│   │   │   ├── columns/route.ts
│   │   │   ├── import/route.ts
│   │   │   ├── data/route.ts
│   │   │   └── delete/route.ts        ← NOUVEAU (Mission 007)
│   │   └── profiles/
│   │       ├── route.ts
│   │       ├── match/route.ts
│   │       └── [id]/route.ts
│   └── layout.tsx
├── components/
│   ├── ui/                     # Composants réutilisables
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── alert.tsx
│   │   └── ...
│   └── import/
│       └── wizard/
│           ├── import-wizard.tsx
│           ├── wizard-progress.tsx
│           ├── step-upload.tsx
│           ├── step-profile.tsx
│           ├── step-config.tsx
│           ├── step-validate.tsx
│           ├── step-resolve.tsx
│           ├── step-preview.tsx
│           ├── step-review.tsx
│           ├── step-test-import.tsx       ← NOUVEAU (Mission 007)
│           ├── step-test-result.tsx       ← NOUVEAU (Mission 007)
│           ├── matching-column-selector.tsx ← NOUVEAU (Mission 007)
│           └── step-confirm.tsx
├── lib/
│   ├── domain/
│   │   ├── validation/
│   │   │   ├── schema-validator.ts
│   │   │   └── rules/
│   │   ├── verification/
│   │   │   ├── compare.ts
│   │   │   ├── matching-detection.ts  ← NOUVEAU (Mission 007)
│   │   │   └── index.ts
│   │   └── rollback/                  ← NOUVEAU (Mission 007)
│   │       ├── types.ts
│   │       ├── rollback-service.ts
│   │       └── index.ts
│   ├── infrastructure/
│   │   ├── supabase/
│   │   └── zoho/
│   │       └── client.ts              # Ajout deleteData()
│   ├── hooks/
│   │   └── use-import.ts              # États étendus (test-importing, test-result)
│   └── utils/
└── types/
    ├── index.ts                       # Types principaux étendus
    └── profiles.ts                    # verificationColumn ajouté
```

---

## Types principaux

```typescript
// types/index.ts

export type ImportMode = 'append' | 'truncateadd' | 'updateadd' | 'deleteupsert' | 'onlyadd';

export interface ParsedFile {
  filename: string;
  headers: string[];
  data: Record<string, string>[];
  totalRows: number;
  parseTime: number;
  extension: string;
}

export interface ImportConfig {
  workspaceId: string;
  tableId: string;
  tableName: string;
  importMode: ImportMode;
  matchingColumns: string[];
  dateFormat: string;
}

export type ImportStatus = 
  | 'idle' | 'uploading' | 'profiling' | 'configuring' 
  | 'validating' | 'resolving' | 'previewing' | 'reviewing'
  | 'test-importing' | 'test-result' | 'full-importing'  // Mission 007
  | 'importing' | 'success' | 'error';

export interface TestImportResult {
  success: boolean;
  rowsImported: number;
  matchingColumn: string;
  matchingValues: string[];
  verification: VerificationResult;
  duration: number;
}

export interface RollbackConfig {
  workspaceId: string;
  viewId: string;
  matchingColumn: string;
  matchingValues: string[];
  reason: 'verification_failed' | 'user_cancelled' | 'error_recovery';
}

export interface RollbackResult {
  success: boolean;
  deletedRows: number;
  duration: number;
  errorMessage?: string;
  remainingValues?: string[];
}
```

---

## Base de données Supabase

### Schéma : csv_importer

```sql
-- Tokens OAuth Zoho chiffrés
CREATE TABLE zoho_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  access_token_encrypted TEXT NOT NULL,
  refresh_token_encrypted TEXT NOT NULL,
  api_domain TEXT NOT NULL,
  token_type TEXT DEFAULT 'Bearer',
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Profils d'import (1 par table Zoho)
CREATE TABLE import_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  name TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  workspace_name TEXT,
  view_id TEXT NOT NULL UNIQUE,  -- Contrainte 1:1
  view_name TEXT,
  import_mode TEXT NOT NULL DEFAULT 'append',
  matching_columns TEXT[],
  date_format TEXT DEFAULT 'dd/MM/yyyy',
  column_mappings JSONB DEFAULT '[]',
  known_formats JSONB DEFAULT '{}',
  verification_column TEXT,  -- NOUVEAU (Mission 007)
  description TEXT,
  last_used_at TIMESTAMPTZ,
  use_count INTEGER DEFAULT 0
);

-- Historique des imports
CREATE TABLE import_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_id UUID REFERENCES import_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  filename TEXT NOT NULL,
  rows_imported INTEGER NOT NULL,
  duration_ms INTEGER,
  status TEXT NOT NULL,  -- 'success', 'partial', 'error'
  error_message TEXT,
  verification_result JSONB
);

-- Index
CREATE INDEX idx_profiles_view_id ON import_profiles(view_id);
CREATE INDEX idx_history_user ON import_history(user_id);
CREATE INDEX idx_history_profile ON import_history(profile_id);
```

---

## Variables d'environnement

### .env.local

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

## État d'avancement

### ✅ Complété (Missions 001-006)

* Setup projet Next.js 15 + Tailwind v4
* Authentification Supabase + Dark mode
* Base de données (schéma csv_importer)
* Wizard d'import complet (8 étapes avec preview)
* Support CSV et Excel (.xlsx, .xls) jusqu'à 200 MB
* Moteur de validation (4 règles : required, date, number, email)
* OAuth2 Zoho complet fonctionnel
* Stockage tokens chiffrés (AES-256-GCM)
* Liste workspaces, tables, dossiers
* **Import réel vers Zoho Analytics** ✅
* **Système de profils d'import complet** ✅
  * Matching intelligent (score, Levenshtein)
  * Pré-remplissage config depuis profil
  * Skip résolution si formats connus
  * Sauvegarde/mise à jour profil après import
  * Édition et suppression de profil
  * Clé de matching pour modes UPDATE*
  * Architecture 1 profil = 1 table
* **Preview des transformations** ✅ (Mission 006 Phase 1)
  * Étape "Aperçu" dans le wizard
  * Tableau source → transformé
  * Toggle colonnes transformées/toutes
* **Vérification post-import** ✅ (Mission 006 Phase 2)
  * API GET données depuis Zoho
  * Comparaison envoyé vs stocké (tableau 3 colonnes)
  * Auto-détection colonne de matching
  * Rapport d'anomalies (date inversée, troncature, arrondi)
  * Normalisation des nombres (50.0 = 50)

### 🟡 Mission 007 : Import 2 phases + Rollback (EN COURS)

**Phase 1 complète (Session 1)** :

* ✅ API DELETE Zoho (`/api/zoho/delete`)
* ✅ Service rollback (`lib/domain/rollback/`)
* ✅ Détection améliorée colonne matching (patterns + unicité)
* ✅ `step-test-import.tsx` - Import 5 lignes + attente + vérification
* ✅ `step-test-result.tsx` - Tableau comparatif Fichier/Normalisée/Zoho
* ✅ Intégration wizard (nouveaux états, handlers, transitions)
* ✅ Fix bugs React (double exécution, timing state)

**Tests réussis** :

* Import test 5 lignes ✅
* Vérification post-import ✅
* Affichage tableau comparatif ✅

**À tester (Session 2)** :

* Rollback après test
* Import complet après confirmation
* Gestion anomalies détectées
* Forcer import malgré anomalies

### 📋 Futures missions

* [ ] Mission 008 : Éditeur de règles de validation avancé
* [ ] Connexion SFTP
* [ ] Page Historique des imports enrichie
* [ ] Déploiement Vercel

---

## Données de test

### Workspace/Table QUITTANCES

```
Workspace ID: 1718953000014173074
View ID (QUITTANCES): 1718953000024195004
Org ID: 667999054
```

### Colonnes QUITTANCES (23)

```
ePV-Logique, Attachement, Journal, Date début, Heure début, 
Date fin, Heure fin, Numéro Quittance, Lecture automatique, 
Réseau, Ligne, Arrêt, Code infraction, Infraction, Matricule, 
Matricule chef, CB, Espece, Cheque, Référence Nus TPE, 
Flux Sevo, __EMPTY
```

### Formats à gérer

| Colonne      | Format fichier | Format universel |
| ------------ | -------------- | ---------------- |
| Date début  | 05/03/2025     | 2025-03-05       |
| Heure début | 23:54          | 23:54:00         |
| Montant HT   | 1 234,56       | 1234.56          |
| N° PV       | 1E6            | 1000000          |

---

## Documents de référence

| Document                                    | Description                        |
| ------------------------------------------- | ---------------------------------- |
| `docs/specs-profils-import-v2.1.md`       | Specs profils (v2.1 - 16 sections) |
| `docs/specs-fonctionnelles.md`            | Specs originales                   |
| `docs/architecture-cible-v3.md`           | Architecture technique             |
| `mission-005-profils-import.md`           | Mission terminée ✅               |
| `mission-006-COMPLETE.md`                 | Mission terminée ✅               |
| `mission-007-import-2-phases-rollback.md` | Mission en cours 🟡                |

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

# Vérifier profils existants (console navigateur)
fetch('/api/profiles').then(r => r.json()).then(console.log)
```

---

## Problèmes résolus (référence)

### Mission 003

1. **Domaine API incorrect** : `zohoapis.com` → `analyticsapi.zoho.com`
2. **Variables env serveur** : Ajouter `APP_URL` en plus de `NEXT_PUBLIC_APP_URL`
3. **Cookies OAuth** : 2 cookies séparés (state + region)
4. **Module uuid** : Utiliser `crypto.randomUUID()` natif
5. **Casse viewType** : Zoho renvoie 'Table'/'QueryTable', pas 'TABLE'
6. **Endpoint import** : `/views/{viewId}/data?CONFIG=...` avec `FILE`

### Mission 004

7. **Endpoint colonnes** : `/views/{id}?CONFIG={"withInvolvedMetaInfo":true}` (pas `/columns`)

### Mission 005 (Sessions 1-4)

8. **Écran vide étape 2** : Case 'profiling' manquante dans renderStep()
9. **Property 'id' does not exist** : ZohoTable utilise viewId/viewName, pas id/name
10. **parsedData null à l'étape profil** : Ajout parsing automatique dans case 'profiling'
11. **resolvedIssues non transmises** : Ajout prop resolvedIssues à StepReview
12. **Accolades orphelines schema-validator** : Restauration Git après suppression logs
13. **Body stream already read** : `response.json()` appelé 2 fois sur erreur 409
14. **IssueResolution type error** : Union type, accéder via `resolution?.type === 'date_format'`
15. **ColumnConfig type error** : Cast explicite après vérification `config.type === 'date'`
16. **Alert variant invalid** : `variant="default"` n'existe pas, utiliser `variant="info"`
17. **matchingColumns absent** : Ajouter matchingColumns dans body de handleImport

### Mission 006

18. **Suspense boundary** : useSearchParams() doit être wrappé dans `<Suspense>` pour build Next.js
19. **Button variant** : `variant="default"` n'existe pas, utiliser `variant="primary"`
20. **Format réponse API Zoho** : `response.data` est directement le tableau (pas `.data.rows`)
21. **Espaces dans critères SQL** : Ajout `.trim()` dans `buildInCriteria()`
22. **Normalisation nombres** : `50.0` vs `50` maintenant considérés égaux
23. **Type ImportMode** : Utiliser le type existant au lieu de redéfinir

### Mission 007 (Session 1)

24. **Double exécution React StrictMode** : Ajout `useRef` pour éviter double appel dans useEffect
25. **State timing entre fonctions** : Ajout `verificationSampleRef` pour accès immédiat à l'échantillon

---

*Ce document doit être mis à jour lorsque les types fondamentaux ou l'architecture changent.*

*Dernière mise à jour : 2025-12-05 (Session 1 Mission 007)*
