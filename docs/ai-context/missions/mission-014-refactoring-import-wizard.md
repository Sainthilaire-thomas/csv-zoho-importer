
# Mission 014 : Refactoring Import Wizard

*Date de création : 2026-01-23*
*Date de complétion : 2026-01-23*
*Statut : ✅ COMPLÉTÉ*

---

## 📋 Contexte

### Problème initial

Le fichier `components/import/wizard/import-wizard.tsx` était devenu **trop volumineux** :

| Métrique      | Avant          | Après        | Amélioration  |
| -------------- | -------------- | ------------- | -------------- |
| Lignes totales | **1603** | **662** | **-59%** |
| useState       | 21             | 0 (extraits)  | ✅             |
| useCallback    | 22             | ~5            | ✅             |
| useRef         | 5              | 0 (extraits)  | ✅             |

### Objectif atteint

✅ Extraire la logique en **hooks personnalisés** pour :

* Réduire `import-wizard.tsx` à ~662 lignes (orchestration uniquement)
* Permettre les tests unitaires
* Faciliter l'ajout de fonctionnalités (Mission 013 Sprint 9)
* Améliorer la lisibilité et maintenabilité

---

## 🏗️ Architecture créée

```
components/import/wizard/
├── hooks/
│   ├── index.ts                        # Exports centralisés (~35 lignes)
│   ├── use-import-wizard-state.ts      # États + refs (~250 lignes)
│   ├── use-profile-management.ts       # Gestion profils (~230 lignes)
│   ├── use-test-import.ts              # Flow test import (~350 lignes)
│   └── use-chunked-import.ts           # Import par chunks (~280 lignes)
├── import-wizard.tsx                   # Orchestrateur refactoré (662 lignes)
├── step-*.tsx                          # Composants étapes (inchangés)
└── index.ts
```

---

## ✅ Sprints complétés

### Sprint 1 : Extraction états et refs

* **Fichier** : `use-import-wizard-state.ts`
* **Contenu** : 21 useState + 5 useRef centralisés
* **API** : `useImportWizardState()` retourne un objet structuré par domaine

### Sprint 2 : Extraction gestion profils

* **Fichier** : `use-profile-management.ts`
* **Fonctions extraites** :
  * `handleProfileSelected`
  * `handleCreateNewProfile`
  * `handleSkipProfile`
  * `saveOrUpdateProfile`
  * `buildProfileColumns` (helper)

### Sprint 3 : Extraction test import

* **Fichier** : `use-test-import.ts`
* **Fonctions extraites** :
  * `handleStartTestImport`
  * `executeTestImport`
  * `executeTestVerification`
  * `handleTestComplete`
  * `handleTestError`
  * `handleRollback`
  * `handleRowIdResync`
  * `handleRowIdResyncCancel`

### Sprint 4 : Extraction import chunké

* **Fichier** : `use-chunked-import.ts`
* **Fonctions extraites** :
  * `handleConfirmFullImport` (avec logique chunking)
  * `handleForceImport`
  * `importChunk` (helper avec retry)
  * `logImportToHistory` (helper)
  * `updateRowIdSync` (helper)
* **Constantes** : `CHUNK_SIZE = 5000`, `MAX_RETRIES = 2`

### Sprint 5 : Corrections TypeScript

* Alignement des types `ImportMode`, `ImportStatus`, `ImportProgress`
* Ajout de `setWorkspaceId` dans navigation pour fix profil existant

### Sprint 6 : Refactoring import-wizard.tsx

* Réduction de 1603 → 662 lignes
* Utilisation des 4 hooks extraits
* Conservation de `renderStep()` et orchestration uniquement

---

## 🧪 Tests effectués

### Test complet d'import réussi

| Étape                         | Résultat                  |
| ------------------------------ | -------------------------- |
| Upload fichier                 | ✅                         |
| Sélection profil existant     | ✅                         |
| Configuration                  | ✅                         |
| Validation                     | ✅                         |
| Preview transformations        | ✅                         |
| Test import (5 lignes)         | ✅                         |
| Vérification                  | ✅ (fallback matching_key) |
| Import complet (37,635 lignes) | ✅                         |
| Mise à jour profil            | ✅                         |
| Log historique                 | ✅                         |
| RowID sync                     | ✅                         |

### Performance observée

* **8 chunks** de 5000 lignes max
* **~2 secondes** par chunk
* **Total** : ~18 secondes pour 37,635 lignes

---

## 🐛 Problèmes identifiés (non bloquants)

### 1. Timeout sur `verify-by-rowid`

```
GET /api/zoho/verify-by-rowid ... 500 in 22.9s
[VerifyByRowID] Poll 30 - jobCode: 1004 (timeout)
```

* **Cause** : La requête `WHERE "RowID" > X` est trop lente sur table 3M+ lignes
* **Workaround actuel** : Fallback sur stratégie `matching_key`
* **Solution** : Mission 013 Sprint 9 (probe rapide)

### 2. Décalage RowID après import

* **RowID sync** : 3071389 (calculé)
* **RowID Zoho réel** : 3122445
* **Différence** : ~51,000
* **Cause** : Calcul basé sur `startRowId + totalRows` ne reflète pas la réalité Zoho
* **Solution** : Mission 013 Sprint 9 (vérification post-import avec probe)

---

## 📁 Fichiers modifiés/créés

### Créés

* `components/import/wizard/hooks/index.ts`
* `components/import/wizard/hooks/use-import-wizard-state.ts`
* `components/import/wizard/hooks/use-profile-management.ts`
* `components/import/wizard/hooks/use-test-import.ts`
* `components/import/wizard/hooks/use-chunked-import.ts`

### Modifiés

* `components/import/wizard/import-wizard.tsx` (refactoré)
* `components/import/wizard/index.ts` (restauré)

---

## 🔗 Dépendances

### Mission 013 (à reprendre)

Le refactoring permet maintenant d'implémenter facilement le Sprint 9 dans `use-chunked-import.ts` :

```typescript
// Après import, vérifier le vrai MAX(RowID) avec probe
const probeResult = await probeMaxRowIdAfterImport(
  workspaceId,
  tableName,
  rowIdStartForImport
);
maxRowIdAfter = probeResult.maxRowId;
```

---

## 📊 Métriques finales

| Métrique                         | Valeur     |
| --------------------------------- | ---------- |
| Temps de développement           | ~4 heures  |
| Lignes de code ajoutées (hooks)  | ~1145      |
| Lignes de code réduites (wizard) | -941       |
| Fichiers créés                  | 5          |
| Tests manuels                     | ✅ Passés |
| TypeScript                        | ✅ Compile |

---

## 🎯 Commit

```
refactor(wizard): extract hooks from import-wizard.tsx - Mission 014

- Extract useImportWizardState (21 useState + 5 useRef)
- Extract useProfileManagement (profile handlers)
- Extract useTestImport (test import + rollback flow)
- Extract useChunkedImport (chunked full import)
- Add setWorkspaceId to navigation for profile selection fix
- Reduce import-wizard.tsx from 1603 to 662 lines (-59%)

Files created:
- components/import/wizard/hooks/use-import-wizard-state.ts
- components/import/wizard/hooks/use-profile-management.ts
- components/import/wizard/hooks/use-test-import.ts
- components/import/wizard/hooks/use-chunked-import.ts
- components/import/wizard/hooks/index.ts
```

---

*Mission 014 - COMPLÉTÉE*
*Prochaine étape : Mission 013 Sprint 9 (vérification RowID post-import)*
