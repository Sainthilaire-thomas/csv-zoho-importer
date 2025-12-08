
# CSV to Zoho Analytics Importer - Contexte de Base

*Mis à jour le 2025-12-07 (Mission 007 terminée, Mission 008 en cours)*

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
| Notifications      | Sonner               | 2.x     |

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

| Mode                   | Clé requise | Description                         |
| ---------------------- | ------------ | ----------------------------------- |
| **APPEND**       | ❌ Non       | Ajoute les lignes à la fin         |
| **TRUNCATEADD**  | ❌ Non       | Vide la table, réimporte tout      |
| **UPDATEADD**    | ✅ Oui       | Met à jour si existe, ajoute sinon |
| **DELETEUPSERT** | ✅ Oui       | Supprime absents + upsert           |
| **ONLYADD**      | ✅ Oui       | Ajoute uniquement les nouveaux      |

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
│   /zoho/data     /zoho/delete      /zoho/dashboard-embed    /profiles/*        │
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

## Wizard d'import (10 étapes)

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
7. Récapitulatif         Vérification avant import
        ↓
8. Test Import           Import de 5 lignes test + vérification
        ↓
9. Résultat Test         Tableau comparatif + décision (confirmer/rollback)
        ↓
10. Import complet       Import des lignes restantes + succès final
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
| Import ponctuel | `skip`     | Config manuelle, aucune sauvegarde                      |

---

## Module de vérification post-import

### Architecture (Mission 006-007)

```
lib/domain/verification/
├── types.ts              # VerificationConfig, SentRow, VerificationResult,
│                         # Anomaly, ComparedRow, ComparedColumn
├── compare.ts            # verifyImport(), compareRowsDetailed(),
│                         # findBestMatchingColumn(), normalizeValue()
├── matching-detection.ts # findBestMatchingColumnEnhanced()
└── index.ts              # Exports publics

lib/domain/rollback/
├── types.ts              # RollbackConfig, RollbackResult, RollbackReason
├── rollback-service.ts   # executeRollback(), formatRollbackReason()
└── index.ts              # Exports publics
```

### Colonne de matching (auto-détection)

Priorité de sélection :

| Priorité | Source       | Description                                                    |
| --------- | ------------ | -------------------------------------------------------------- |
| 1         | Profil       | `profile.verificationColumn`si défini                       |
| 2         | Schéma Zoho | Colonne `isUnique: true`ou `AUTO_NUMBER`                   |
| 3         | Nom colonne  | Patterns :`/^id$/i`,`/num[eé]ro/i`,`/code/i`,`/ref/i` |
| 4         | Contenu      | Première colonne 100% unique et non vide                      |

### Types d'anomalies détectées

| Type                | Niveau   | Description                          |
| ------------------- | -------- | ------------------------------------ |
| `row_missing`     | Critical | Ligne non trouvée dans Zoho         |
| `value_different` | Critical | Valeur complètement différente     |
| `value_missing`   | Critical | Valeur présente → vide             |
| `date_inverted`   | Critical | Jour/mois inversés (05/03 → 03/05) |
| `truncated`       | Warning  | Texte tronqué                       |
| `rounded`         | Warning  | Nombre arrondi                       |
| `encoding_issue`  | Warning  | Accents perdus                       |

### Affichage UI (tableau 3 colonnes)

```
| Colonne | 📄 Fichier | 🔄 Normalisée | ☁️ Zoho    | Statut |
|---------|------------|---------------|------------|--------|
| CB      | 35.0       | 35            | 35         | ✅     |
| Date    | 05/03/2025 | 05/03/2025    | 2025-03-05 | ✅     |
```

---

## Structure du projet

```
csv-zoho-importer/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── register/page.tsx
│   ├── (dashboard)/
│   │   └── dashboard-test/page.tsx    # Test iframe PQS (Mission 008)
│   ├── api/
│   │   ├── zoho/
│   │   │   ├── oauth/              # Callback, status, disconnect
│   │   │   ├── workspaces/         # Liste workspaces
│   │   │   ├── tables/             # Liste tables par workspace
│   │   │   ├── columns/            # Colonnes d'une table
│   │   │   ├── import/             # Import des données
│   │   │   ├── data/               # GET données (vérification)
│   │   │   ├── delete/             # DELETE données (rollback)
│   │   │   ├── dashboard-embed/    # Lookup + URL filtrée (Mission 008)
│   │   │   └── test-private-url/   # Tests techniques (Mission 008)
│   │   └── profiles/               # CRUD profils + match
│   ├── import/page.tsx             # Wizard principal
│   ├── history/page.tsx
│   ├── settings/page.tsx
│   └── layout.tsx                  # + Toaster (sonner)
├── components/
│   ├── import/wizard/
│   │   ├── import-wizard.tsx       # Orchestrateur (10 étapes)
│   │   ├── step-upload.tsx
│   │   ├── step-profile.tsx
│   │   ├── step-schema.tsx
│   │   ├── step-validation.tsx
│   │   ├── step-transform-preview.tsx
│   │   ├── step-review.tsx
│   │   ├── step-test-import.tsx
│   │   ├── step-test-result.tsx
│   │   ├── matching-column-selector.tsx
│   │   └── step-confirm.tsx        # + rapport vérification
│   └── ui/                         # Composants réutilisables
├── lib/
│   ├── domain/
│   │   ├── validation/             # Moteur de validation
│   │   ├── transform/              # Transformations données
│   │   ├── profile/                # Gestion profils
│   │   ├── verification/           # Vérification post-import
│   │   └── rollback/               # Service rollback
│   └── infrastructure/
│       ├── supabase/
│       └── zoho/
│           ├── client.ts           # Client API (import, export, delete)
│           └── types.ts            # Inclut scopes embed.read/update
├── types/
│   └── index.ts                    # Types partagés
└── docs/                           # Documentation
```

---

## Base de données (Supabase)

### Tables

```sql
-- Tokens Zoho (chiffrés AES-256-GCM)
CREATE TABLE zoho_tokens (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  access_token TEXT NOT NULL,      -- Chiffré
  refresh_token TEXT NOT NULL,     -- Chiffré
  api_domain TEXT NOT NULL,
  org_id TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Profils d'import (1 profil = 1 table)
CREATE TABLE import_profiles (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  view_id TEXT UNIQUE NOT NULL,    -- Garantit 1 profil par table
  import_mode TEXT DEFAULT 'append',
  matching_column TEXT,            -- Pour modes UPDATE*
  verification_column TEXT,        -- Pour vérification post-import
  column_config JSONB DEFAULT '[]',
  date_formats JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,
  import_count INTEGER DEFAULT 0
);

-- Historique des imports
CREATE TABLE import_history (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  profile_id UUID REFERENCES import_profiles(id),
  file_name TEXT NOT NULL,
  rows_imported INTEGER NOT NULL,
  duration_ms INTEGER,
  status TEXT DEFAULT 'success',
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
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

### ✅ Complété (Missions 001-007)

* Setup projet Next.js 15 + Tailwind v4
* Authentification Supabase + Dark mode
* Base de données (schéma csv_importer)
* Wizard d'import complet (10 étapes avec preview)
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
* **Import 2 phases + Rollback** ✅ (Mission 007)
  * Import test de 5 lignes avec vérification
  * Tableau comparatif Fichier/Normalisée/Zoho
  * Rollback fonctionnel (API DELETE `/rows`)
  * Import complet des lignes restantes après confirmation
  * Toast notifications (sonner)
  * Détection automatique colonne de matching améliorée

### 🔄 Mission 008 : Distribution Dashboards (en cours)

Distribution dashboards Zoho Analytics vers portails clients :

**Phase A - Iframe Dashboard ✅ COMPLÉTÉ**

* Private URLs Zoho Analytics fonctionnelles
* Lookup Email → Nom agent via table Agents_SC
* Filtre ZOHO_CRITERIA dynamique
* Page test `/dashboard-test`
* API `/api/zoho/dashboard-embed`

**Phase B - Génération PDF 📋 À FAIRE**

* Récupération données temps réel via API Zoho
* Template PDF avec @react-pdf/renderer
* KPIs, tableaux, graphiques SVG
* Zero data retention (mémoire uniquement)

**Phase C - Intégration Zoho Desk 📋 FUTUR**

* Widget Help Center
* Récupération email JWT utilisateur

Fichiers créés :

* `app/(dashboard)/dashboard-test/page.tsx`
* `app/api/zoho/dashboard-embed/route.ts`
* `app/api/zoho/test-private-url/route.ts`

### 📋 Futures missions

* [ ] Éditeur de règles de validation avancé
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

### Workspace/Dashboard PQS (Mission 008)

```
Workspace: RATP Réseaux de Bus
Workspace ID: 1718953000016707052

Dashboard: Conseiller PQS 2025
View ID: 1718953000033028262
Private URL: https://analytics.zoho.com/open-view/1718953000033028262/2f22f56df5772565ad3c1e7648862c39

Table lookup: Agents_SC
View ID: 1718953000033132623
Colonnes: Nom, Courriel, Matricule, Cpte_Matriculaire
```

### Filtrage ZOHO_CRITERIA

```
Syntaxe : ?ZOHO_CRITERIA=("Colonne"='Valeur')
Exemple : ?ZOHO_CRITERIA=("Nom"='AUBERGER')
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

| Document                                  | Description                        |
| ----------------------------------------- | ---------------------------------- |
| `docs/specs-profils-import-v2.1.md`     | Specs profils (v2.1 - 16 sections) |
| `docs/specs-fonctionnelles.md`          | Specs originales                   |
| `docs/architecture-cible-v3.md`         | Architecture technique             |
| `mission-005-profils-import.md`         | Mission terminée ✅               |
| `mission-006-COMPLETE.md`               | Mission terminée ✅               |
| `mission-007-COMPLETE.md`               | Mission terminée ✅               |
| `mission-008-dashboard-distribution.md` | Mission en cours 🔄                |

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

# Test API dashboard embed
curl -X POST http://localhost:3000/api/zoho/dashboard-embed \
  -H "Content-Type: application/json" \
  -d '{"email": "sandrine.auberger@ratp.fr"}'
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

### Mission 007

24. **Double exécution React StrictMode** : `useRef` pour éviter re-mount des composants
25. **Timing state React** : `verificationSampleRef` pour accès immédiat (pas attendre setState)
26. **API DELETE Zoho "Invalid method"** : Endpoint `/views/{viewId}/rows` (pas `/data`)
27. **Refs non remplies pour rollback** : Détection colonne dans `executeTestImport` (pas avant)

### Mission 008

28. **Scope OAuth Private URL** : Zoho doc indique `embed.create` mais API requiert `embed.update`
29. **Format réponse Zoho data** : API retourne CSV par défaut (pas JSON), parser avec split('\n')
30. **Colonne filtre dashboard** : Utiliser `"Nom"` (pas `"Mle"`) pour ZOHO_CRITERIA
31. **Erreurs SVG console** : Bugs internes Zoho (dimensions négatives), n'impactent pas l'affichage

---

## Scopes OAuth Zoho

```typescript
// lib/infrastructure/zoho/types.ts
export const ZOHO_SCOPES = [
  'ZohoAnalytics.metadata.all',
  'ZohoAnalytics.data.all',
  'ZohoAnalytics.embed.read',   // Lire Private URLs
  'ZohoAnalytics.embed.update', // Créer Private URLs
] as const;
```

---

*Ce document doit être mis à jour lorsque les types fondamentaux ou l'architecture changent.*

*Dernière mise à jour : 2025-12-07*
