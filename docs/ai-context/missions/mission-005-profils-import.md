
# Mission 005 - Système de Profils d'Import

**Statut** : 🔄 En cours

**Date début** : 2025-12-02

**Sessions** : 3

**Prérequis** : Mission 003 complétée, Mission 004 en pause

**Document de référence** : `docs/specs-profils-import.md` (v2.1)

---

## 🎯 Objectif

Implémenter le système de **Profils d'Import** qui permettra de :

* Configurer une fois les règles de transformation pour chaque table Zoho
* Réutiliser automatiquement ces règles lors des imports suivants
* Accumuler les alias et formats au fil du temps (apprentissage)
* Garantir des transformations explicites et traçables

### Pourquoi cette mission avant de finir la 004 ?

La mission 004 abordait la validation colonne par colonne à chaque import. L'approche **Profils** est plus efficace :

* Configuration une fois → réutilisation automatique
* Moins de friction utilisateur lors des imports récurrents
* Meilleure gestion des variations de format entre fichiers

---

## 📋 Bilan Session 3 (2025-12-04)

### ✅ Réalisé cette session

| Composant               | Statut | Description                                           |
| ----------------------- | ------ | ----------------------------------------------------- |
| saveOrUpdateProfile()   | ✅     | Fonction complète dans import-wizard.tsx             |
| Gestion 409             | ✅     | Si profil existe, PUT pour enrichir au lieu d'ignorer |
| Pré-remplissage config | ✅     | handleProfileSelected remplit workspace/table/mode    |
| Skip dates connues      | ✅     | detectResolvableIssues() accepte profile optionnel    |
| Specs v2.1 validées    | ✅     | Modes d'import, clé matching, workflows documentés  |
| Types corrigés         | ✅     | Erreurs TypeScript IssueResolution, ColumnConfig      |

### 🔧 Modifications techniques

**import-wizard.tsx :**

* Nouveaux états : `profileMode`, `selectedProfile`, `selectedMatchResult`, `detectedColumns`
* `handleProfileSelected()` : pré-remplit config, skip vers validation si match parfait
* `handleCreateNewProfile()` : stocke colonnes détectées, mode 'new'
* `handleSkipProfile()` : import ponctuel sans profil
* `saveOrUpdateProfile()` : ~150 lignes, gère création/mise à jour/409
* Appel après `setImportSuccess` dans `handleImport`

**schema-validator.ts :**

* Import `ImportProfile` ajouté
* `ValidateSchemaParams.profile?: ImportProfile` ajouté
* `detectResolvableIssues()` accepte `profile` optionnel
* Logique skip : si `profileColumn.config.dayMonthOrder` existe, pas d'issue créée

### ⚠️ Fix à appliquer

Dans `handleValidation` (~ligne 215), ajouter le profil :

```typescript
const schemaResult = validateSchema({
  fileHeaders: headers,
  sampleData,
  zohoSchema: schema,
  profile: selectedProfile || undefined,  // ← MANQUANT
});
```

### 📝 Specs mises à jour (v2.1)

Nouvelles sections ajoutées à `specs-profils-import.md` :

| Section                   | Contenu                                        |
| ------------------------- | ---------------------------------------------- |
| 12. Modes d'import        | Matrice APPEND/TRUNCATE/UPDATE*, clé matching |
| 13. Workflows détaillés | 3 chemins (profil existant, nouveau, ponctuel) |
| 14. Aperçu du profil     | Composant ProfileDetails (à implémenter)     |
| 15. Flux mise à jour     | Comportement implémenté (accumulation, 409)  |
| 16. Messages d'erreur     | Textes erreurs profil incomplet                |
| Règles R11-R15           | Nouvelles règles métier                      |

### Règle d'or validée

> **Un profil = une configuration complète**
>
> Mode d'import + clé de matching non modifiables à la volée.
> Pour un mode différent → créer nouveau profil ou import ponctuel.

---

## 📋 Bilan Session 2 (2025-12-03)

### ✅ Réalisé

| Composant                  | Statut | Description                             |
| -------------------------- | ------ | --------------------------------------- |
| step-profile.tsx intégré | ✅     | Étape profil affichée dans le wizard  |
| wizard-progress.tsx        | ✅     | 7 étapes (avec Profil import)          |
| use-import.ts              | ✅     | Navigation selecting → profiling       |
| import-wizard.tsx          | ✅     | Case 'profiling' avec parsing auto      |
| resolvedIssues passé      | ✅     | StepReview reçoit les issues résolues |
| table-selector.tsx         | ✅     | Correction viewId/viewName              |
| schema-validator.ts        | ✅     | detectAutoTransformations() ajouté     |
| types.ts                   | ✅     | AutoTransformation type ajouté         |
| Import complet             | ✅     | Flux fonctionnel jusqu'à l'import Zoho |

### 🐛 Bugs corrigés

| Bug                          | Cause                           | Solution                           |
| ---------------------------- | ------------------------------- | ---------------------------------- |
| Écran vide étape 2         | Pas de case 'profiling'         | Ajouté case avec StepProfile      |
| Property 'id' does not exist | ZohoTable utilise viewId        | Corrections table-selector.tsx     |
| Accolades orphelines         | Suppression logs debug          | Restauration Git                   |
| parsedData null              | Parsing seulement à validation | Parsing auto dans case 'profiling' |
| Issues non transmises        | resolvedIssues non passé       | Ajouté prop resolvedIssues        |

---

## 📋 Bilan Session 1 (2025-12-02)

### ✅ Phase 1 - Infrastructure (TERMINÉE)

| Composant                 | Statut | Fichier                              |
| ------------------------- | ------ | ------------------------------------ |
| Types TypeScript          | ✅     | `types/profiles.ts`                |
| Script SQL                | ✅     | `docs/sql/003-import-profiles.sql` |
| Table Supabase            | ✅     | Exécuté + permissions GRANT        |
| API GET /profiles         | ✅     | `app/api/profiles/route.ts`        |
| API POST /profiles        | ✅     | `app/api/profiles/route.ts`        |
| API GET /profiles/[id]    | ✅     | `app/api/profiles/[id]/route.ts`   |
| API PUT /profiles/[id]    | ✅     | `app/api/profiles/[id]/route.ts`   |
| API DELETE /profiles/[id] | ✅     | `app/api/profiles/[id]/route.ts`   |
| API POST /profiles/match  | ✅     | `app/api/profiles/match/route.ts`  |

### ✅ Phase 2 - Services métier (TERMINÉE)

| Composant       | Statut | Fichier                                   |
| --------------- | ------ | ----------------------------------------- |
| TypeDetector    | ✅     | `lib/domain/detection/type-detector.ts` |
| Index detection | ✅     | `lib/domain/detection/index.ts`         |
| ProfileManager  | ✅     | `lib/domain/profile/profile-manager.ts` |
| Index profile   | ✅     | `lib/domain/profile/index.ts`           |

---

## 📊 État actuel des phases

### ✅ Phase 1 - Infrastructure (TERMINÉE)

### ✅ Phase 2 - Services métier (TERMINÉE)

### 🔄 Phase 3 - Interface (90% TERMINÉE)

| Composant                    | Statut | Description                         |
| ---------------------------- | ------ | ----------------------------------- |
| step-profile.tsx             | ✅     | Composant complet                   |
| import-wizard.tsx            | ✅     | Intégration profiling + sauvegarde |
| wizard-progress.tsx          | ✅     | 7 étapes                           |
| step-review.tsx              | ✅     | AutoTransformationsSection          |
| step-resolve.tsx             | ✅     | 3 types bloquants                   |
| Sauvegarde profil            | ✅     | saveOrUpdateProfile()               |
| Pré-remplissage             | ✅     | handleProfileSelected()             |
| **Fix validateSchema** | ❌     | Passer profile à validateSchema    |

### ⏳ Phase 4 - Intégration complète (À FAIRE)

| Composant                | Statut | Description                                 |
| ------------------------ | ------ | ------------------------------------------- |
| Fix validateSchema       | ❌     | Ajouter `profile: selectedProfile`        |
| Migration BDD            | ❌     | `ALTER TABLE ADD matching_columns TEXT[]` |
| Sélecteur clé matching | ❌     | Dans StepConfig si mode UPDATE*             |
| Validation mode + clé   | ❌     | Bloquer si profil UPDATE* sans clé         |
| Composant ProfileDetails | ❌     | Modale aperçu profil                       |
| Test accumulation alias  | ❌     | Vérifier ajout automatique                 |

---

## ⏳ Reste à faire (Prochaine session)

### Priorité 1 : Fix validateSchema (5 min)

```typescript
// Dans handleValidation, ligne ~215
const schemaResult = validateSchema({
  fileHeaders: headers,
  sampleData,
  zohoSchema: schema,
  profile: selectedProfile || undefined,  // ← AJOUTER
});
```

### Priorité 2 : Migration BDD (10 min)

```sql
ALTER TABLE csv_importer.import_profiles 
ADD COLUMN matching_columns TEXT[] DEFAULT NULL;

COMMENT ON COLUMN csv_importer.import_profiles.matching_columns IS 
  'Colonnes formant la clé unique pour les modes UPDATEADD, DELETEUPSERT, ONLYADD';
```

### Priorité 3 : Sélecteur clé matching (30 min)

Dans StepConfig, si mode UPDATEADD/DELETEUPSERT/ONLYADD :

* Afficher liste de checkboxes avec colonnes du fichier
* Stocker dans `matchingColumns` local
* Passer à la sauvegarde du profil

### Priorité 4 : Validation mode + clé (30 min)

Dans handleProfileSelected :

* Si profil.defaultImportMode est UPDATE* et matchingColumns vide
* Afficher erreur "Profil incomplet"
* Proposer : créer nouveau profil ou import ponctuel

### Priorité 5 : Composant ProfileDetails (1h)

Modale affichant :

* Informations générales (nom, table, dates)
* Configuration import (mode, clé matching)
* Colonnes configurées (tableau)
* Compatibilité avec fichier actuel

---

## 🗂️ Fichiers modifiés (Session 3)

### Fichiers modifiés

```
components/import/wizard/import-wizard.tsx  # +150 lignes (sauvegarde profil)
lib/domain/schema-validator.ts              # +30 lignes (skip dates connues)
```

### Fichiers créés

```
docs/specs-profils-import.md                # v2.1 (sections 12-16 ajoutées)
```

---

## 🗂️ Fichiers créés/modifiés (Sessions 1-2)

### Fichiers créés (Session 1)

```
app/api/profiles/route.ts
app/api/profiles/[id]/route.ts
app/api/profiles/match/route.ts
components/import/wizard/step-profile.tsx
lib/domain/detection/type-detector.ts
lib/domain/detection/index.ts
lib/domain/profile/profile-manager.ts
lib/domain/profile/index.ts
types/profiles.ts
docs/sql/003-import-profiles.sql
```

### Fichiers modifiés (Session 2)

```
components/import/table-selector.tsx
components/import/wizard/import-wizard.tsx
components/import/wizard/step-resolve.tsx
components/import/wizard/step-review.tsx
components/import/wizard/wizard-progress.tsx
lib/domain/schema-validator.ts
lib/hooks/use-import.ts
lib/infrastructure/zoho/types.ts
types/index.ts
```

---

## 🔧 Commandes pour reprendre

```powershell
cd "C:\Users\thoma\OneDrive\SONEAR_2025\csv-zoho-importer"
npm run dev
```

### Commiter les modifications

```powershell
git add -A
git commit -m "feat(mission-005): sauvegarde profil + skip formats connus

- saveOrUpdateProfile() après import réussi
- Gestion 409 : PUT pour enrichir profil existant
- handleProfileSelected() pré-remplit config
- detectResolvableIssues() accepte profile pour skip dates
- Specs v2.1 : modes import, clé matching, workflows

Reste: fix validateSchema, migration matching_columns, ProfileDetails"
```

### Vérifier profil en base

```javascript
// Console navigateur
fetch('/api/profiles').then(r => r.json()).then(console.log)
```

---

## 📊 Métriques

| Métrique          | Session 1 | Session 2      | Session 3      | Total |
| ------------------ | --------- | -------------- | -------------- | ----- |
| Fichiers créés   | ~9        | 0              | 1              | ~10   |
| Fichiers modifiés | 0         | 11             | 2              | 13    |
| Lignes de code     | ~1890     | ~200           | ~180           | ~2270 |
| Bugs corrigés     | 0         | 5              | 3              | 8     |
| Tests manuels      | API CRUD  | Import complet | Profil reconnu | ✅    |

---

## 📝 Notes techniques

### Flow profil implémenté

```
Upload fichier
     ↓
Étape Profil → Matching profils existants
     ↓
┌────────────────────┬────────────────────┬────────────────────┐
│ Profil existant    │ Nouveau profil     │ Import ponctuel    │
│ handleProfileSelected│ handleCreateNewProfile│ handleSkipProfile │
│ profileMode='existing'│ profileMode='new' │ profileMode='skip' │
└────────────────────┴────────────────────┴────────────────────┘
     ↓
Étape Config (pré-remplie si profil existant)
     ↓
Validation → Résolution (skip si format connu)
     ↓
Import Zoho
     ↓
saveOrUpdateProfile() si profileMode !== 'skip'
```

### Gestion des conflits 409

Quand POST /api/profiles retourne 409 (profil existe déjà pour cette table) :

1. Récupérer `existingProfileId` de la réponse
2. Faire PUT /api/profiles/{id} avec les colonnes
3. Log "Profil existant mis à jour"
4. Continuer normalement (non bloquant)

### Types corrigés (Session 3)

```typescript
// IssueResolution est un union type
issue.resolution?.type === 'date_format' ? issue.resolution.format : 'DD/MM/YYYY'

// ColumnConfig est un union type - cast après vérification
if (profileColumn?.config.type === 'date') {
  const dateConfig = profileColumn.config as { dayMonthOrder?: 'dmy' | 'mdy' };
  formatKnownInProfile = !!dateConfig.dayMonthOrder;
}
```

---

## 🔗 Documents de référence

| Document                          | Description                        |
| --------------------------------- | ---------------------------------- |
| `docs/specs-profils-import.md`  | Spécifications v2.1 (16 sections) |
| `docs/architecture-cible-v3.md` | Architecture technique             |
| `docs/base-context.md`          | Contexte projet                    |

---

*Mission créée le : 2025-12-02*

*Dernière mise à jour : 2025-12-04 11:30*

*Statut : 🔄 En cours (Phase 1-2 ✅, Phase 3 90%, Phase 4 ⏳)*
