
# CSV to Zoho Analytics Importer - Contexte de Base

*Mis à jour le 2025-11-30 (Session 5 - Specs validation avancée)*

---

## Vue d'ensemble

### Description du projet

Application web permettant d'automatiser l'import de fichiers CSV/Excel dans Zoho Analytics, avec validation configurable des données, transformations explicites et interface de contrôle complète. L'objectif est de réduire le temps d'import de ~18 minutes à ~3-4 minutes tout en garantissant l'intégrité des données (zéro erreur silencieuse).

### Utilisateurs cibles

2-3 personnes utilisant l'application pour importer des données vers Zoho Analytics de manière récurrente (quotidien/mensuel).

### Principes fondamentaux

1. **Zero Data Retention** : Aucune donnée CSV/Excel conservée. Traitement 100% côté client.
2. **Explicite plutôt qu'implicite** : Aucune conversion silencieuse. L'utilisateur voit et valide chaque transformation.
3. **Échec rapide** : Bloquer AVANT l'import si doute sur l'intégrité des données.
4. **Vérification post-import** : Contrôler que Zoho a bien importé ce qu'on a envoyé.
5. **Profils réutilisables** : Configuration sauvegardée pour imports récurrents.

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
┌─────────────────────────────────────────────────────────────────────────────────┐
│                     FRONTEND (Next.js App Router)                               │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐                 │
│  │  Import Wizard  │  │    Settings     │  │    History      │                 │
│  │  (5 étapes)     │  │    (Profils)    │  │    (Logs)       │                 │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘                 │
│           └────────────────────┼────────────────────┘                           │
│                                ▼                                                │
│              CLIENT-SIDE PROCESSING (Zero Data Retention)                       │
│    ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐         │
│    │  CSV/Excel   │ │   Schema     │ │    Data      │ │    Post      │         │
│    │   Parser     │ │  Validator   │ │ Transformer  │ │   Verifier   │         │
│    └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘         │
│                                │                                                │
│                                ▼                                                │
│                   API LAYER (Route Handlers)                                    │
│   /zoho/oauth/*  /zoho/workspaces  /zoho/tables  /zoho/columns  /zoho/import   │
│   /profiles/*    /history/*                                                     │
└─────────────────────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
        ┌──────────┐   ┌──────────┐   ┌──────────┐
        │ Supabase │   │   Zoho   │   │   SFTP   │
        │ - Auth   │   │ Analytics│   │  Server  │
        │ - Tokens │   │   API    │   │ (futur)  │
        │ - Profiles│  │          │   │          │
        │ - Logs   │   │          │   │          │
        └──────────┘   └──────────┘   └──────────┘
```

---

## Authentification Zoho Analytics

### Approche : OAuth2 flow complet dans l'app ✅ FONCTIONNEL

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

## Structure actuelle du projet

```
csv-zoho-importer/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── layout.tsx
│   ├── (dashboard)/
│   │   ├── history/page.tsx
│   │   ├── import/page.tsx
│   │   ├── settings/page.tsx
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
│   │       ├── columns/route.ts         ✅
│   │       └── import/route.ts          ✅
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── import/
│   │   ├── wizard/
│   │   │   ├── import-wizard.tsx        ✅ (avec validation schéma)
│   │   │   ├── step-config.tsx          ✅ (accordéon tables)
│   │   │   ├── step-review.tsx          ✅ (affichage validation schéma)
│   │   │   ├── step-confirm.tsx         ✅
│   │   │   ├── step-source.tsx
│   │   │   ├── step-validate.tsx
│   │   │   └── wizard-progress.tsx
│   │   ├── file-upload.tsx
│   │   ├── table-selector.tsx
│   │   ├── table-selector-accordion.tsx ✅
│   │   └── validation-results.tsx
│   ├── zoho/
│   │   ├── zoho-connect-button.tsx      ✅
│   │   └── zoho-connection-status.tsx   ✅
│   ├── layout/
│   │   ├── header.tsx
│   │   ├── sidebar.tsx
│   │   └── theme-toggle.tsx
│   ├── ui/
│   │   ├── alert.tsx
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   └── progress.tsx
│   └── theme-provider.tsx
├── lib/
│   ├── domain/
│   │   ├── schema-validator.ts          ✅ (validation schéma Zoho)
│   │   ├── validation/
│   │   │   ├── rules/
│   │   │   │   ├── base.ts
│   │   │   │   ├── date.ts
│   │   │   │   ├── email.ts
│   │   │   │   ├── number.ts
│   │   │   │   └── required.ts
│   │   │   ├── engine.ts
│   │   │   └── index.ts
│   │   └── file-provider/
│   ├── hooks/
│   │   ├── use-csv-parser.ts
│   │   ├── use-import.ts
│   │   └── use-validation.ts
│   ├── infrastructure/
│   │   ├── supabase/
│   │   │   ├── client.ts
│   │   │   └── server.ts
│   │   └── zoho/
│   │       ├── types.ts                 ✅
│   │       ├── encryption.ts            ✅
│   │       ├── auth.ts                  ✅
│   │       ├── client.ts                ✅ (getColumns corrigé)
│   │       └── index.ts
│   └── utils/
├── types/
│   └── index.ts                         ✅ (types validation schéma)
├── docs/
│   └── ai-context/
│       ├── missions/
│       │   ├── mission-001-setup-initial.md
│       │   ├── mission-002-wizard-import.md
│       │   ├── mission-003-api-zoho.md      ✅ COMPLÉTÉE
│       │   ├── mission-004-validation-schema.md  🔄 EN COURS
│       │   └── TEMPLATE-MISSION.md
│       ├── base-context.md
│       ├── architecture-cible.md
│       ├── specs-fonctionnelles.md
│       ├── specs-validation-avancee.md      ✅ NOUVEAU
│       └── README.md
├── middleware.ts
├── tailwind.config.ts
└── tsconfig.json
```

---

## Base de données Supabase

### Schéma dédié

Les tables sont dans le schéma **`csv_importer`** (pas le schéma `public`).

### Tables existantes

```sql
-- Tokens Zoho chiffrés par utilisateur ✅
csv_importer.user_zoho_tokens (
  id, user_id, access_token_encrypted, refresh_token_encrypted,
  expires_at, scope, api_domain, org_id, zoho_user_id, zoho_email,
  created_at, updated_at
)

-- Tables Zoho configurées
csv_importer.zoho_tables (...)

-- Règles de validation par table
csv_importer.validation_rules (...)

-- Logs des imports (métadonnées uniquement)
csv_importer.import_logs (...)
```

### Tables à créer (Mission 005)

```sql
-- Profils d'import partagés
csv_importer.import_profiles (...)

-- Historique enrichi
csv_importer.import_history (...)
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
* Wizard d'import complet (5 étapes)
* Support CSV et Excel (.xlsx, .xls) jusqu'à 200 MB
* Moteur de validation (4 règles : required, date, number, email)
* OAuth2 Zoho complet fonctionnel
* Stockage tokens chiffrés (AES-256-GCM)
* Liste workspaces, tables, dossiers
* Composant accordéon pour sélection tables
* **Import réel vers Zoho Analytics** ✅

### 🔄 En cours (Mission 004)

* ✅ Types validation schéma créés
* ✅ Service SchemaValidator implémenté
* ✅ Route API /zoho/columns fonctionnelle
* ✅ Intégration validation schéma dans wizard
* ✅ Affichage correspondances colonnes (✅, ⚠️, ❌)
* ⏳ Résolution des incompatibilités (interface utilisateur)
* ⏳ Transformation explicite des données
* ⏳ Prévisualisation données transformées
* ⏳ Vérification post-import

### 📋 Spécifié (Specs validation avancée)

* Détection automatique profil par structure colonnes
* Profils d'import réutilisables et partagés
* Seuil d'erreurs configurable par utilisateur
* Rollback après import test (phase ultérieure)
* Historique enrichi des imports

### 📋 À faire (Futures missions)

* Éditeur de règles de validation
* Connexion SFTP
* Page Historique des imports
* Déploiement Vercel

---

## Documents de référence

| Document                             | Description                                          |
| ------------------------------------ | ---------------------------------------------------- |
| `specs-fonctionnelles.md`          | Specs originales du projet                           |
| `specs-validation-avancee.md`      | **NOUVEAU**- Parcours de validation détaillé |
| `architecture-cible.md`            | Architecture technique v2.0                          |
| `mission-004-validation-schema.md` | Mission en cours                                     |

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

### Mission 003

1. **Domaine API incorrect** : `zohoapis.com` → `analyticsapi.zoho.com`
2. **Variables env serveur** : Ajouter `APP_URL` en plus de `NEXT_PUBLIC_APP_URL`
3. **Cookies OAuth** : 2 cookies séparés (state + region)
4. **Module uuid** : Utiliser `crypto.randomUUID()` natif
5. **Casse viewType** : Zoho renvoie 'Table'/'QueryTable', pas 'TABLE'
6. **Endpoint import** : `/views/{viewId}/data?CONFIG=...` avec `FILE`

### Mission 004

7. **Endpoint colonnes** : `/views/{id}?CONFIG={"withInvolvedMetaInfo":true}` (pas `/columns`)

---

*Ce document doit être mis à jour lorsque les types fondamentaux ou l'architecture changent.*
*Dernière mise à jour : 2025-11-30 18:00*
