
# Mission 005 - Système de Profils d'Import

**Statut** : 🔄 En cours

**Date début** : 2025-12-02

**Sessions** : 2

**Prérequis** : Mission 003 complétée, Mission 004 en pause

**Document de référence** : `docs/specs-profils-import.md`

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

## 📋 Bilan Session 2 (2025-12-03)

### ✅ Réalisé cette session

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

### 🔄 Flow actuel fonctionnel (validé)

```
1. Sélection fichier     ✅ Upload QUITTANCES-03-25-TEST.xlsx
        ↓
2. Profil import         ✅ Parsing auto → 22 colonnes détectées → "Créer nouveau"
        ↓
3. Configuration         ✅ Sélection table QUITTANCES (viewId: 1718953000024195004)
        ↓
4. Validation            ✅ Parse + détecte 2 issues (dates ambiguës)
        ↓
5. Résolution            ✅ Choix format JJ/MM/AAAA pour Date début et Date fin
        ↓
6. Vérification          ✅ Récap : 14 lignes valides, 22 colonnes, 0 erreur
        ↓
7. Import                ✅ 14 lignes importées en 1s vers QUITTANCES
```

### ⚠️ Problème identifié : Profil non sauvegardé

**Symptôme** : Après import réussi, si on relance un import avec le même fichier, aucun profil n'est proposé.

**Cause** : Les handlers dans import-wizard.tsx ne font que `console.log()` + `goToStep('configuring')` :

```typescript
onProfileSelected={(profile, matchResult) => {
  console.log('Profile selected:', profile.name, matchResult);
  goToStep('configuring');  // ❌ Pas de sauvegarde
}}
onCreateNewProfile={(detectedColumns) => {
  console.log('Create new profile:', detectedColumns.length);
  goToStep('configuring');  // ❌ Pas de sauvegarde
}}
```

**Solution à implémenter** : Après import réussi, appeler POST /api/profiles avec les colonnes + résolutions.

### 🐛 Bugs corrigés cette session

| Bug                          | Cause                                     | Solution                                   |
| ---------------------------- | ----------------------------------------- | ------------------------------------------ |
| Écran vide étape 2         | Pas de case 'profiling' dans renderStep() | Ajouté case avec StepProfile              |
| Property 'id' does not exist | ZohoTable utilise viewId/viewName         | Corrections table-selector.tsx             |
| Accolades orphelines         | Suppression logs debug a cassé syntaxe   | Restauration Git + nettoyage propre        |
| parsedData null              | Parsing seulement à validation           | Ajouté parsing auto dans case 'profiling' |
| Issues non transmises        | resolvedIssues non passé à StepReview   | Ajouté prop resolvedIssues                |

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

### 🔄 Phase 3 - Interface (EN COURS)

| Composant                   | Statut | Fichier                                       |
| --------------------------- | ------ | --------------------------------------------- |
| step-profile.tsx            | ✅     | `components/import/wizard/step-profile.tsx` |
| import-wizard.tsx modifié  | ✅     | Case 'profiling' + parsing auto               |
| wizard-progress.tsx         | ✅     | 7 étapes                                     |
| step-review.tsx             | ✅     | AutoTransformationsSection ajoutée           |
| step-resolve.tsx            | ✅     | Nettoyé (3 types bloquants seulement)        |
| **Sauvegarde profil** | ❌     | Handlers vides, à implémenter               |

### ⏳ Phase 4 - Intégration complète (À FAIRE)

| Composant              | Statut | Description                      |
| ---------------------- | ------ | -------------------------------- |
| Sauvegarde profil      | ❌     | Persister après import réussi  |
| Matching profil        | ❌     | Proposer profils existants       |
| Réutilisation formats | ❌     | Skip résolution si format connu |
| Test accumulation      | ❌     | Vérifier ajout alias            |

---

## 🗂️ Fichiers modifiés (Session 2)

### Fichiers modifiés (à commiter)

```
components/import/table-selector.tsx       # viewId au lieu de id
components/import/wizard/import-wizard.tsx # Intégration profiling + resolvedIssues
components/import/wizard/step-resolve.tsx  # 3 types bloquants seulement
components/import/wizard/step-review.tsx   # AutoTransformationsSection
components/import/wizard/wizard-progress.tsx # 7 étapes
lib/domain/schema-validator.ts             # detectAutoTransformations()
lib/hooks/use-import.ts                    # Navigation selecting → profiling
lib/infrastructure/zoho/types.ts           # AutoTransformation type
types/index.ts                             # ImportStatus avec 'profiling'
```

### Fichiers créés (Session 1, non trackés)

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
```

---

## ⏳ Reste à faire (Prochaine session)

### Priorité 1 : Sauvegarde du profil après import

```typescript
// Dans import-wizard.tsx, modifier handleImport :
const handleImport = async () => {
  // ... import existant ...
  
  if (result.success && shouldCreateProfile) {
    // Construire l'objet profil
    const profileData = {
      name: `Import ${state.config.table?.viewName}`,
      workspaceId: state.config.workspace?.workspaceId,
      workspaceName: state.config.workspace?.workspaceName,
      viewId: state.config.table?.viewId,
      viewName: state.config.table?.viewName,
      columns: detectedColumns.map(col => ({
        ...col,
        // Inclure les résolutions (format date choisi, etc.)
        dateFormat: resolvedIssues?.find(i => i.columnName === col.name)?.resolution
      })),
      defaultImportMode: state.config.importMode
    };
  
    await fetch('/api/profiles', {
      method: 'POST',
      body: JSON.stringify(profileData)
    });
  }
};
```

### Priorité 2 : Reconnaissance de profil existant

```typescript
// Dans step-profile.tsx, au mount :
useEffect(() => {
  const findProfiles = async () => {
    const response = await fetch('/api/profiles/match', {
      method: 'POST',
      body: JSON.stringify({ fileColumns: detectedColumns })
    });
    const { data } = await response.json();
    if (data.length > 0 && data[0].score >= 0.8) {
      setMatchingProfile(data[0].profile);
    }
  };
  findProfiles();
}, [detectedColumns]);
```

### Priorité 3 : Skip résolution si format connu

```typescript
// Dans schema-validator.ts, detectIssues() :
if (profile?.columns) {
  const profileColumn = profile.columns.find(c => c.name === columnName);
  if (profileColumn?.dateFormat) {
    // Ne pas créer d'issue ambiguous_date_format
    // Appliquer directement le format du profil
    return;
  }
}
```

### Priorité 4 : Amélioration UX (plus tard)

* Afficher tableau entrée → transformation → sortie
* Preview des 5 premières lignes transformées

---

## 🔧 Commandes pour reprendre

```powershell
cd "C:\Users\thoma\OneDrive\SONEAR_2025\csv-zoho-importer"
npm run dev
```

### Commiter les modifications actuelles

```powershell
git add -A
git commit -m "feat(mission-005): intégration step-profile + flux complet import

- Ajout étape 'profiling' dans wizard (7 étapes)
- Parsing automatique avant affichage profil
- Correction viewId/viewName dans table-selector
- Correction resolvedIssues passé à StepReview
- detectAutoTransformations() dans schema-validator
- Import complet validé (14 lignes QUITTANCES)

Reste à faire: sauvegarde profil après import"
```

### Vérifier les profils existants

```javascript
// Console navigateur
fetch('/api/profiles').then(r => r.json()).then(console.log)
```

---

## 📊 Métriques

| Métrique          | Session 1 | Session 2      | Total |
| ------------------ | --------- | -------------- | ----- |
| Fichiers créés   | ~9        | 0              | ~9    |
| Fichiers modifiés | 0         | 11             | 11    |
| Lignes de code     | ~1890     | ~200           | ~2090 |
| Bugs corrigés     | 0         | 5              | 5     |
| Tests manuels      | API CRUD  | Import complet | ✅    |

---

## 📝 Notes techniques

### Transformations automatiques

Le tableau `autoTransformations` était vide lors du test car le fichier Excel avait déjà des données normalisées :

* Nombres : `35.0` (point décimal, pas virgule française)
* Durées : `23:54:50` (format complet HH:mm:ss)
* Dates : `05/03/2025` (ambiguës, nécessitent confirmation)

Pour tester les transformations automatiques, il faudrait un fichier CSV brut avec formats français.

### Types de transformations

| Type                  | Affichage    | Bloquant | Exemple            |
| --------------------- | ------------ | -------- | ------------------ |
| decimal_comma         | 🔄 Info      | Non      | 1234,56 → 1234.56 |
| short_duration        | 🔄 Info      | Non      | 23:54 → 23:54:00  |
| thousands_separator   | 🔄 Info      | Non      | 1 234 → 1234      |
| ambiguous_date_format | ⚠️ Confirm | Oui      | 05/03/2025 → ?    |
| scientific_notation   | ⚠️ Confirm | Oui      | 1E6 → 1000000     |
| iso_date              | ⚠️ Confirm | Oui      | 2025-03-05 → ?    |

---

## 🔗 Documents de référence

| Document                          | Description                             |
| --------------------------------- | --------------------------------------- |
| `docs/specs-profils-import.md`  | Spécifications complètes (945 lignes) |
| `docs/architecture-cible-v3.md` | Architecture technique                  |
| `docs/base-context.md`          | Contexte projet                         |

---

*Mission créée le : 2025-12-02*

*Dernière mise à jour : 2025-12-03 19:20*

*Statut : 🔄 En cours (Phase 1-2 terminées, Phase 3 quasi-terminée, Phase 4 à faire)*
