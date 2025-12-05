
# CSV to Zoho Analytics Importer - Contexte de Base

*Mis à jour le 2025-12-04 (Mission 006 Phase 1 terminée)*

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
│  │  (8 étapes)     │  │    (Profils)    │  │    (Logs)       │                 │
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
│   /profiles/*    /profiles/match   /profiles/[id]                               │
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

## Wizard d'import (8 étapes) ← MODIFIÉ Mission 006

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
6. Aperçu                ← NOUVELLE ÉTAPE (Mission 006)
        ↓                Preview des transformations source → Zoho
7. Vérification          Récapitulatif avant import
        ↓
8. Import                Envoi à Zoho Analytics + confirmation + sauvegarde profil
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

## Authentification Zoho Analytics

### Approche : OAuth2 flow complet ✅ FONCTIONNEL

```
1. Utilisateur clique "Connecter Zoho"
2. Redirection vers Zoho (authorization)
3. Retour avec code d'autorisation
4. Échange code → tokens (access + refresh)
5. Stockage chiffré (AES-256-GCM) dans Supabase
6. Refresh automatique si access_token expiré
```

### Endpoints API utilisés

| Endpoint                              | Usage                        |
| ------------------------------------- | ---------------------------- |
| `/oauth/authorize`                  | Initier connexion            |
| `/oauth/token`                      | Échanger code/refresh token |
| `/restapi/v2/orgs`                  | Lister organisations         |
| `/restapi/v2/workspaces`            | Lister workspaces            |
| `/restapi/v2/workspaces/{id}/views` | Lister tables                |
| `/restapi/v2/views/{id}?CONFIG=...` | Récupérer colonnes         |
| `/restapi/v2/views/{id}/data`       | Import données              |

---

## Structure de fichiers principale

```
csv-zoho-importer/
├── app/
│   ├── (auth)/                    # Pages auth (login, etc.)
│   ├── (dashboard)/               # Pages protégées
│   │   ├── import/                # Page import principale
│   │   ├── parametres/            # Page paramètres (profils)
│   │   └── historique/            # Page historique
│   └── api/
│       ├── zoho/                  # Routes API Zoho
│       │   ├── oauth/             # OAuth flow
│       │   ├── workspaces/        # Liste workspaces
│       │   ├── tables/            # Liste tables
│       │   ├── columns/           # Colonnes d'une table
│       │   └── import/            # Import données
│       └── profiles/              # Routes API Profils
│           ├── route.ts           # GET/POST profils
│           ├── [id]/route.ts      # PUT/DELETE profil
│           └── match/route.ts     # Matching profil
├── components/
│   ├── import/
│   │   └── wizard/                # Composants wizard
│   │       ├── step-source.tsx
│   │       ├── step-profile.tsx
│   │       ├── step-config.tsx
│   │       ├── step-validate.tsx
│   │       ├── step-resolve.tsx
│   │       ├── step-transform-preview.tsx  ← NOUVEAU
│   │       ├── step-review.tsx
│   │       ├── step-confirm.tsx
│   │       ├── wizard-progress.tsx
│   │       └── import-wizard.tsx
│   └── ui/                        # Composants UI réutilisables
├── lib/
│   ├── domain/
│   │   ├── detection/             # Détection types
│   │   ├── file-provider/         # Parsing fichiers
│   │   ├── profile/               # Services profils
│   │   ├── transformation/        # Transformation + preview  ← NOUVEAU
│   │   └── validation/            # Validation schéma
│   ├── hooks/                     # React hooks personnalisés
│   └── infrastructure/
│       └── zoho/                  # Client API Zoho
└── types/                         # Types TypeScript
    ├── index.ts
    └── profiles.ts
```

---

## Types principaux

### ImportProfile (Supabase)

```typescript
interface ImportProfile {
  id: string;
  name: string;
  org_id: string;
  workspace_id: string;
  view_id: string;           // UNIQUE - 1 profil = 1 table
  view_name: string;
  import_mode: ImportMode;
  matching_columns?: string[];  // Pour modes UPDATE*
  column_configs: ColumnConfig[];
  created_at: string;
  updated_at: string;
  last_used_at?: string;
  import_count: number;
}
```

### ColumnConfig

```typescript
interface ColumnConfig {
  zohoColumnName: string;
  type: 'string' | 'number' | 'date' | 'duration' | 'boolean';
  aliases: string[];           // Noms acceptés dans les fichiers
  dateFormats?: string[];      // Formats de date confirmés
  transformations?: string[];  // Transformations validées
}
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

### ✅ Complété (Missions 001-005)

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

### 🟡 En cours (Mission 006 - Preview Transformations)

**Phase 1 terminée** : Étape "Aperçu" dans le wizard

* ✅ Composant StepTransformPreview créé
* ✅ Tableau avec données réelles source → transformé
* ✅ Toggle colonnes transformées / toutes
* ✅ Navigation 8 étapes fonctionnelle

**Phase 2 à faire** : Vérification post-import

* 🔜 API GET données depuis Zoho après import
* 🔜 Comparaison envoyé vs stocké
* 🔜 Rapport d'anomalies

### ⏸️ En pause (Mission 004)

* ✅ Types validation schéma créés
* ✅ Service SchemaValidator implémenté
* ⏸️ Reste : interface résolution, vérification post-import

**Raison pause** : Intégré dans Mission 005/006.

### 📋 Futures missions

* [ ] Mission 007 : Vérification post-import (comparaison avec données Zoho réelles)
* [ ] Éditeur de règles de validation avancé
* [ ] Connexion SFTP
* [ ] Page Historique des imports enrichie
* [ ] Rollback après import test
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
Journal, Date début, Heure début, Date fin, Heure fin,
Temps réel, Absence, Date création, N° PV, Nom,
Code postal, Ville, Observation, N° FPS, Montant HT,
CB, TVA, TTC, Motif, Exonération, Vu BCA, ACO, Véhicule
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

| Document                                   | Description                                |
| ------------------------------------------ | ------------------------------------------ |
| `docs/specs-profils-import-v2.1.md`      | Specs profils (v2.1 - 16 sections)         |
| `docs/specs-preview-verification.md`     | Specs preview et vérification post-import |
| `docs/specs-fonctionnelles.md`           | Specs originales                           |
| `docs/architecture-cible-v3.md`          | Architecture technique                     |
| `mission-005-profils-import.md`          | Mission terminée ✅                       |
| `mission-006-preview-transformations.md` | Mission en cours 🟡                        |

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

---

*Ce document doit être mis à jour lorsque les types fondamentaux ou l'architecture changent.*

*Dernière mise à jour : 2025-12-04 (soir)*
