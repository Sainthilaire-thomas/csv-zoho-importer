
# CSV to Zoho Analytics Importer - Contexte de Base

*Mis à jour le 2026-01-12 (Mission 009 terminée)*

---

## Vue d'ensemble

### Description du projet

Application web permettant d'automatiser l'import de fichiers CSV/Excel dans Zoho Analytics, avec  **profils d'import réutilisables** , transformations explicites et interface de contrôle complète. L'objectif est de réduire le temps d'import de ~18 minutes à ~3-4 minutes tout en garantissant l'intégrité des données (zéro erreur silencieuse).

**Nouvelle fonctionnalité** : Distribution de dashboards Zoho Analytics (iframe + PDF personnalisé).

### Utilisateurs cibles

2-3 personnes utilisant l'application pour importer des données vers Zoho Analytics de manière récurrente (quotidien/mensuel).

### Principes fondamentaux

1. **Zero Data Retention** : Aucune donnée CSV/Excel conservée. Traitement 100% côté client.
2. **Profils réutilisables** : Configurer une fois, réutiliser automatiquement.
3. **Explicite plutôt qu'implicite** : Aucune conversion silencieuse. L'utilisateur voit et valide chaque transformation.
4. **Échec rapide** : Bloquer AVANT l'import si doute sur l'intégrité des données.
5. **Accumulation intelligente** : Le profil apprend les alias et formats au fil du temps.
6. **Un profil = une table** : Relation 1:1 stricte (un profil par table Zoho).
7. **Source de vérité unique** : Les données affichées en preview = les données envoyées à Zoho.

### Stack technique

| Composant                | Technologie          | Version |
| ------------------------ | -------------------- | ------- |
| Framework                | Next.js (App Router) | 15.x    |
| Langage                  | TypeScript           | 5.x     |
| Styling                  | Tailwind CSS         | 4.x     |
| Auth & DB                | Supabase             | latest  |
| Dark mode                | next-themes          | latest  |
| Hosting                  | Vercel (Hobby)       | -       |
| API externe              | Zoho Analytics API   | v2      |
| Parsing CSV              | Papa Parse           | 5.x     |
| Parsing Excel            | xlsx                 | 0.18.x  |
| State management         | React hooks          | -       |
| Validation schemas       | Zod                  | 3.x     |
| Icônes                  | Lucide React         | latest  |
| Notifications            | Sonner               | 2.x     |
| **PDF Generation** | @react-pdf/renderer  | latest  |

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
│           │                    │                    │                           │
│  ┌────────┴────────┐  ┌────────┴────────┐  ┌───────┴────────┐                  │
│  │  Dashboard Test │  │   PDF Config    │  │                │                  │
│  │  (iframe+PDF)   │  │  (template)     │  │                │                  │
│  └────────┬────────┘  └────────┬────────┘  └────────────────┘                  │
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
│   /zoho/data     /zoho/delete      /zoho/dashboard-embed  /zoho/dashboard-pdf  │
│   /zoho/async-export              /profiles/*                                   │
└─────────────────────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
        ┌──────────┐   ┌──────────┐   ┌──────────┐
        │ Supabase │   │   Zoho   │   │   SFTP   │
        │ - Auth   │   │ Analytics│   │  Server  │
        │ - Tokens │   │ - Sync   │   │ (futur)  │
        │ - Profiles│  │ - Bulk   │   │          │
        │ - History│   │ - Embed  │   │          │
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
8. Test import           Import échantillon (5 lignes) + vérification
        ↓
9. Import complet        Import des données restantes (ou rollback)
        ↓
10. Confirmation         Rapport final avec statistiques
```

### États du wizard

```typescript
type WizardStatus =
  | 'selecting'      // Étape 1 : Sélection fichier
  | 'profiling'      // Étape 2 : Détection/sélection profil
  | 'configuring'    // Étape 3 : Configuration table/mode
  | 'validating'     // Étape 4 : Validation en cours
  | 'resolving'      // Étape 5 : Résolution issues
  | 'previewing'     // Étape 6 : Aperçu transformations
  | 'reviewing'      // Étape 7 : Récapitulatif
  | 'test-importing' // Étape 8 : Import test
  | 'test-result'    // Étape 8b : Résultat test
  | 'full-importing' // Étape 9 : Import complet
  | 'success'        // Étape 10 : Terminé
  | 'error';         // Erreur
```

---

## Transformation des données (Mission 009)

### Principe : Source de vérité unique

Les données sont transformées **une seule fois** après le parsing, puis utilisées partout :

* Affichage preview
* Validation
* Envoi à Zoho

```typescript
// lib/domain/data-transformer.ts
export function applyAllTransformations(
  data: Record<string, unknown>[],
  matchedColumns?: ColumnMapping[]
): Record<string, unknown>[]
```

### Transformations appliquées

1. **Nettoyage des retours à la ligne** : `\r\n` et `\n` → espace
2. **Trim** : Suppression des espaces en début/fin
3. **Transformations spécifiques** par type de colonne :
   * `date_format` : DD/MM/YYYY → YYYY-MM-DD
   * `number_format` : 1 234,56 → 1234.56
   * `duration_format` : 9:30 → 09:30:00

### Types d'anomalies détectées

| Type                   | Niveau   | Description                                      |
| ---------------------- | -------- | ------------------------------------------------ |
| `value_different`    | Critical | Valeur complètement différente                 |
| `value_missing`      | Critical | Valeur présente dans source mais vide dans Zoho |
| `row_missing`        | Critical | Ligne non trouvée dans Zoho                     |
| `date_inverted`      | Critical | Jour/mois inversés (05/03 → 03/05)             |
| `datetime_truncated` | Warning  | Heure perdue (datetime → date)                  |
| `spaces_trimmed`     | Warning  | Espaces supprimés par Zoho                      |
| `truncated`          | Warning  | Texte tronqué                                   |
| `rounded`            | Warning  | Nombre arrondi                                   |
| `encoding_issue`     | Warning  | Problème d'encodage (accents)                   |

---

## Structure du projet

```
csv-zoho-importer/
├── app/                      # Next.js App Router
│   ├── api/                  # Route handlers
│   │   ├── zoho/            # API Zoho
│   │   │   ├── oauth/       # Auth OAuth2
│   │   │   ├── workspaces/  # Liste workspaces
│   │   │   ├── tables/      # Liste tables
│   │   │   ├── columns/     # Colonnes table
│   │   │   ├── import/      # Import CSV
│   │   │   ├── data/        # Lecture données
│   │   │   ├── delete/      # Suppression lignes
│   │   │   ├── dashboard-embed/  # URL embed
│   │   │   └── dashboard-pdf/    # Export PDF
│   │   └── profiles/        # CRUD profils
│   ├── import/              # Page import
│   ├── settings/            # Page paramètres
│   ├── history/             # Page historique
│   └── dashboard-test/      # Page test dashboard
│
├── components/
│   ├── import/
│   │   └── wizard/          # Composants wizard
│   │       ├── import-wizard.tsx
│   │       ├── wizard-progress.tsx
│   │       ├── step-source.tsx
│   │       ├── step-profile.tsx
│   │       ├── step-config.tsx
│   │       ├── step-validate.tsx
│   │       ├── step-resolve.tsx
│   │       ├── step-transform-preview.tsx
│   │       ├── step-review.tsx
│   │       ├── step-test-import.tsx
│   │       ├── step-test-result.tsx
│   │       ├── step-confirm.tsx
│   │       └── verification-report.tsx
│   └── ui/                  # Composants UI réutilisables
│
├── lib/
│   ├── domain/              # Logique métier
│   │   ├── data-transformer.ts    # Transformations données
│   │   ├── schema-validator.ts    # Validation schéma
│   │   ├── rollback.ts            # Rollback import
│   │   └── verification/          # Vérification post-import
│   │       ├── index.ts
│   │       ├── types.ts
│   │       ├── compare.ts
│   │       └── matching-detection.ts
│   ├── hooks/               # React hooks
│   │   ├── use-import.ts
│   │   ├── use-csv-parser.ts
│   │   └── use-validation.ts
│   └── infrastructure/
│       └── zoho/            # Client Zoho
│           ├── client.ts
│           └── types.ts
│
├── types/                   # Types TypeScript
│   ├── index.ts
│   └── profiles.ts
│
└── docs/                    # Documentation
    ├── ai-context/
    │   └── missions/        # Historique missions
    ├── specs-profils-import-v2.1.md
    ├── specs-fonctionnelles.md
    └── architecture-cible-v3.md
```

---

## Schéma base de données (Supabase)

### Table `zoho_tokens`

```sql
CREATE TABLE csv_importer.zoho_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  region TEXT NOT NULL DEFAULT 'eu',
  org_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);
```

### Table `import_profiles`

```sql
CREATE TABLE csv_importer.import_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  workspace_name TEXT NOT NULL,
  view_id TEXT NOT NULL UNIQUE,  -- 1 profil = 1 table
  view_name TEXT NOT NULL,
  columns JSONB NOT NULL DEFAULT '[]',
  default_import_mode TEXT NOT NULL DEFAULT 'append',
  matching_columns TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,
  use_count INTEGER DEFAULT 0
);
```

### Table `import_history`

```sql
CREATE TABLE csv_importer.import_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES csv_importer.import_profiles(id),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  file_name TEXT NOT NULL,
  file_size INTEGER,
  rows_imported INTEGER,
  import_mode TEXT NOT NULL,
  status TEXT NOT NULL,  -- 'success', 'error', 'partial'
  error_message TEXT,
  duration_ms INTEGER,
  zoho_import_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

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

QueryTable: SC_PQS_2025
View ID: 1718953000032998801
Type: QueryTable (nécessite export async)
Colonnes principales: Nom, Mle, Statut, Fct, Pde, JW Pointés,
  ✉ Théorique €, ✉ Réelle €, Prop. € SC, Moy. Qté ☎, 
  Moy. Qté ✉@, Moy.Qlé ☎, Moy.Qlé ✉@, Bar. Qté ☎, etc.
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

| Document                                   | Description                        |
| ------------------------------------------ | ---------------------------------- |
| `docs/specs-profils-import-v2.1.md`      | Specs profils (v2.1 - 16 sections) |
| `docs/specs-fonctionnelles.md`           | Specs originales                   |
| `docs/architecture-cible-v3.md`          | Architecture technique             |
| `mission-005-profils-import.md`          | Mission terminée ✅               |
| `mission-006-COMPLETE.md`                | Mission terminée ✅               |
| `mission-007-COMPLETE.md`                | Mission terminée ✅               |
| `mission-008-dashboard-distribution.md`  | Mission terminée ✅               |
| `mission-009-transform-source-verite.md` | Mission terminée ✅               |

---

## Commandes utiles

```bash
# Développement
cd "C:\Users\thoma\OneDrive\SONEAR_2025\csv-zoho-importer"
npm run dev

# Nettoyer cache et redémarrer
Remove-Item -Recurse -Force .next
npm run dev

# Build (vérification avant push)
npm run build

# Vérifier profils existants (console navigateur)
fetch('/api/profiles').then(r => r.json()).then(console.log)

# Test API dashboard embed
curl -X POST http://localhost:3000/api/zoho/dashboard-embed \
  -H "Content-Type: application/json" \
  -d '{"email": "sandrine.auberger@ratp.fr"}'

# Test génération PDF
curl -X POST http://localhost:3000/api/zoho/dashboard-pdf \
  -H "Content-Type: application/json" \
  -d '{"email": "sandrine.auberger@ratp.fr"}'

# Test export async
curl "http://localhost:3000/api/zoho/async-export?viewId=1718953000032998801"
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
32. **Export sync QueryTable erreur 8133** : QueryTables nécessitent API async (Bulk API)
33. **Job async bloqué "NOT INITIATED"** : Rate limiting Zoho, attendre ou réessayer
34. **Buffer non assignable à BodyInit** : Convertir avec `new Uint8Array(pdfBuffer)`
35. **Style conditionnel @react-pdf** : `false` invalide, utiliser `condition ? style : {}`

### Mission 009

36. **Newlines dans cellules Excel** : `\n` dans valeurs cassait le CSV → `applyAllTransformations()` nettoie avant envoi
37. **Source de vérité unique** : Preview et envoi Zoho utilisaient des données différentes → transformation centralisée
38. **Heure perdue datetime→date** : Nouveau type anomalie `datetime_truncated` avec message explicatif
39. **Espaces supprimés par Zoho** : Nouveau type anomalie `spaces_trimmed` (QS, RS → QS,RS)
40. **AnomalyBadge incomplet** : Types manquants dans 3 fichiers (step-confirm, step-test-result, verification-report)

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

*Dernière mise à jour : 2026-01-12*
