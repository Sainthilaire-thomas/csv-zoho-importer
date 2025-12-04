
# CSV to Zoho Analytics Importer - Contexte de Base

*Mis à jour le 2025-12-04 (Session 3 Mission 005 - Sauvegarde profils + specs v2.1)*

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
6. **Un profil = une configuration complète** : Mode d'import et clé de matching non modifiables à la volée.

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
│  │  (7 étapes)     │  │    (Profils)    │  │    (Logs)       │                 │
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

## Wizard d'import (7 étapes)

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
6. Vérification          Récapitulatif avant import
        ↓
7. Import                Envoi à Zoho Analytics + confirmation + sauvegarde profil
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

Chaque utilisateur connecte son propre compte Zoho via l'interface. Les tokens sont stockés chiffrés (AES-256-GCM) dans Supabase.

### Points techniques importants

1. **Domaine API** : Toujours utiliser `analyticsapi.zoho.com` (pas `zohoapis.com`)
2. **Variables serveur** : `APP_URL` nécessaire en plus de `NEXT_PUBLIC_APP_URL`
3. **Cookies OAuth** : 2 cookies séparés (`zoho_oauth_state` et `zoho_oauth_region`)
4. **UUID** : Utiliser `crypto.randomUUID()` (pas le package `uuid`)

---

## API Zoho Analytics v2

### Endpoints principaux

| Action              | Endpoint                                             | Méthode |
| ------------------- | ---------------------------------------------------- | -------- |
| Liste workspaces    | `/workspaces`                                      | GET      |
| Liste tables        | `/workspaces/{id}/views`                           | GET      |
| Détails + colonnes | `/views/{id}?CONFIG={"withInvolvedMetaInfo":true}` | GET      |
| Liste dossiers      | `/workspaces/{id}/folders`                         | GET      |
| Import données     | `/workspaces/{id}/views/{id}/data?CONFIG={...}`    | POST     |
| Lire données       | `/views/{id}/data?CONFIG={...}`                    | GET      |
| Supprimer données  | `/views/{id}/data`                                 | DELETE   |

### Format import

```typescript
// CONFIG en query string
const config = {
  importType: 'append',      // append|truncateadd|updateadd|deleteupsert|onlyadd
  fileType: 'csv',
  autoIdentify: false,       // FALSE pour contrôle explicite
  dateFormat: 'yyyy-MM-dd'
};

// FormData avec fichier
const formData = new FormData();
formData.append('FILE', csvBlob, 'import.csv');  // 'FILE' pas 'ZOHO_FILE'

// Headers
{
  'Authorization': 'Zoho-oauthtoken {access_token}',
  'ZANALYTICS-ORGID': '{orgId}'
}
```

---

## Types principaux

```typescript
interface ImportProfile {
  id: string;
  name: string;
  workspaceId: string;
  workspaceName: string;
  viewId: string;
  viewName: string;
  columns: ProfileColumn[];
  defaultImportMode: ImportMode;
  matchingColumns?: string[];  // Clé pour modes UPDATE*
  createdAt: Date;
  lastUsedAt: Date;
  useCount: number;
}

interface ProfileColumn {
  zohoColumn: string;
  zohoType: ZohoDataType;
  isRequired: boolean;
  acceptedNames: string[];
  dataType: 'date' | 'duration' | 'number' | 'text' | 'boolean';
  config: ColumnConfig;
}

type ColumnConfig = 
  | DateColumnConfig      // dayMonthOrder: 'dmy' | 'mdy'
  | DurationColumnConfig  // acceptedFormats
  | NumberColumnConfig    // expandScientific
  | TextColumnConfig      // trim, emptyValues
  | BooleanColumnConfig;  // trueValues, falseValues

type ImportStatus = 
  | 'idle' 
  | 'selecting' 
  | 'profiling'      // ✅ Ajouté
  | 'configuring' 
  | 'validating' 
  | 'resolving' 
  | 'reviewing' 
  | 'importing' 
  | 'success' 
  | 'error';

type ProfileMode = 'existing' | 'new' | 'skip';
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

### ✅ Complété (Missions 001-003)

* Setup projet Next.js 15 + Tailwind v4
* Authentification Supabase + Dark mode
* Base de données (schéma csv_importer)
* Wizard d'import complet (7 étapes)
* Support CSV et Excel (.xlsx, .xls) jusqu'à 200 MB
* Moteur de validation (4 règles : required, date, number, email)
* OAuth2 Zoho complet fonctionnel
* Stockage tokens chiffrés (AES-256-GCM)
* Liste workspaces, tables, dossiers
* Composant accordéon pour sélection tables
* **Import réel vers Zoho Analytics** ✅

### ⏸️ En pause (Mission 004)

* ✅ Types validation schéma créés
* ✅ Service SchemaValidator implémenté
* ✅ Route API /zoho/columns fonctionnelle
* ✅ Intégration validation schéma dans wizard
* ✅ Affichage correspondances colonnes (✅, ⚠️, ❌)
* ⏸️ Reste : interface résolution, transformations, vérification post-import

**Raison pause** : L'approche "Profils d'Import" (Mission 005) est prioritaire.

### 🔄 En cours (Mission 005 - Profils d'Import)

**Phase 1 - Infrastructure** ✅

* ✅ Table Supabase `import_profiles`
* ✅ Types TypeScript pour profils (`types/profiles.ts`)
* ✅ API CRUD `/api/profiles/*`

**Phase 2 - Services métier** ✅

* ✅ Service TypeDetector (`lib/domain/detection/`)
* ✅ Service ProfileManager (`lib/domain/profile/`)

**Phase 3 - Interface** ✅ (90%)

* ✅ Étape wizard step-profile.tsx
* ✅ Wizard 7 étapes avec profiling
* ✅ Parsing automatique avant profil
* ✅ Transformations automatiques (detectAutoTransformations)
* ✅ Résolution issues (dates ambiguës)
* ✅ Import complet validé (14 lignes QUITTANCES)
* ✅ **Sauvegarde profil après import** (saveOrUpdateProfile)
* ✅ **Pré-remplissage config depuis profil**
* ✅ **Skip résolution si format connu dans profil**
* ❌ Fix : passer profile à validateSchema

**Phase 4 - Intégration complète** ⏳

* ❌ Fix validateSchema (ajouter `profile: selectedProfile`)
* ❌ Migration BDD (matching_columns)
* ❌ Sélecteur clé de matching dans StepConfig
* ❌ Validation mode + clé avant import
* ❌ Composant ProfileDetails (aperçu profil)

### 📋 Futures missions

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

| Document                             | Description                                           |
| ------------------------------------ | ----------------------------------------------------- |
| `docs/specs-profils-import.md`     | **RÉFÉRENCE MISSION 005**- v2.1 (16 sections) |
| `docs/specs-fonctionnelles.md`     | Specs originales                                      |
| `docs/specs-validation-avancee.md` | Validation (remplacé par profils)                    |
| `docs/architecture-cible-v3.md`    | Architecture technique                                |
| `mission-005-profils-import.md`    | Mission en cours                                      |

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

### Mission 005 (Session 2)

8. **Écran vide étape 2** : Case 'profiling' manquante dans renderStep()
9. **Property 'id' does not exist** : ZohoTable utilise viewId/viewName, pas id/name
10. **parsedData null à l'étape profil** : Ajout parsing automatique dans case 'profiling'
11. **resolvedIssues non transmises** : Ajout prop resolvedIssues à StepReview
12. **Accolades orphelines schema-validator** : Restauration Git après suppression logs

### Mission 005 (Session 3)

13. **Body stream already read** : `response.json()` appelé 2 fois sur erreur 409
14. **IssueResolution type error** : Union type, accéder via `resolution?.type === 'date_format'`
15. **ColumnConfig type error** : Cast explicite après vérification `config.type === 'date'`
16. **Alert variant invalid** : `variant="default"` n'existe pas, utiliser `variant="info"`

---

*Ce document doit être mis à jour lorsque les types fondamentaux ou l'architecture changent.*

*Dernière mise à jour : 2025-12-04*
