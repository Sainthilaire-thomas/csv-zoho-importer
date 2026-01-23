# Mission 014 : Refactoring Import Wizard

*Date de création : 2026-01-23*
*Statut : 📋 À FAIRE*
*Prérequis : Mission 013 en pause*
*Bloque : Mission 013 Sprint 9 (sécuriser row_id_after)*

---

## 📋 Contexte

### Problème

Le fichier `components/import/wizard/import-wizard.tsx` est devenu **trop volumineux** :

| Métrique | Valeur actuelle | Objectif |
|----------|-----------------|----------|
| Lignes totales | **1603** | < 400 |
| useState | 21 | Regroupés en hooks |
| useCallback | 22 | Extraits en hooks |
| useRef | 5 | Regroupés avec states |

Conséquences :
- Difficile à maintenir et comprendre
- Mélange logique métier, état UI, et appels API
- Ajout de nouvelles fonctionnalités risqué (bugs, conflits)
- Tests unitaires impossibles

### Objectif

Extraire la logique en **hooks personnalisés** et **services** pour :
- Réduire `import-wizard.tsx` à ~300-400 lignes (orchestration uniquement)
- Permettre les tests unitaires
- Faciliter l'ajout de fonctionnalités (Mission 013 Sprint 9)
- Améliorer la lisibilité et maintenabilité

---

## 🔍 Analyse du fichier actuel

### Commande d'analyse

```powershell
# Compter les lignes
(Get-Content "components/import/wizard/import-wizard.tsx").Count

# Lister les fonctions/callbacks
Select-String -Path "components/import/wizard/import-wizard.tsx" -Pattern "const \w+ = useCallback|const \w+ = async|function \w+"
```

### Blocs identifiés à extraire

| Bloc | Lignes estimées | Extraction cible |
|------|-----------------|------------------|
| États (useState) | ~50 | Hook `useImportWizardState` |
| Refs | ~15 | Hook `useImportWizardState` |
| Fetch workspaces | ~30 | Hook `useWorkspaces` (existant?) |
| Fetch schema Zoho | ~40 | Service `zoho-schema-service.ts` |
| Validation schema | ~80 | Déjà dans `schema-validator.ts` |
| Profile management | ~150 | Hook `useProfileManagement` |
| Test import flow | ~200 | Hook `useTestImport` |
| Full import (chunking) | ~150 | Hook `useChunkedImport` |
| RowID sync | ~100 | Déjà dans `rowid-sync/` (à connecter) |
| Rollback | ~50 | Déjà dans `rollback/` (à connecter) |
| Verification | ~50 | Déjà dans `verification/` |
| renderStep() | ~200 | Garder dans wizard (UI) |

---

## 🏗️ Architecture cible

```
components/import/wizard/
├── import-wizard.tsx          # Orchestrateur (~300 lignes)
├── hooks/
│   ├── use-import-wizard-state.ts   # États + refs centralisés
│   ├── use-profile-management.ts    # Gestion profils
│   ├── use-test-import.ts           # Flow test import
│   └── use-chunked-import.ts        # Import par chunks
├── step-*.tsx                 # Composants étapes (inchangés)
└── index.ts

lib/domain/
├── import/
│   ├── import-orchestrator.ts       # Logique métier import
│   ├── chunk-processor.ts           # Traitement par chunks
│   └── types.ts
├── rowid-sync/                # Existant ✅
├── verification/              # Existant ✅
├── rollback/                  # Existant ✅
└── profile/                   # Existant ✅
```

---

## 📝 Plan d'exécution

### Sprint 1 : Extraction états et refs (~30 min)

**Fichier** : `components/import/wizard/hooks/use-import-wizard-state.ts`

Extraire :
- Tous les `useState` spécifiques au wizard
- Tous les `useRef`
- Setters groupés par domaine

```typescript
// Exemple de structure
export function useImportWizardState() {
  // Profile state
  const [profileMode, setProfileMode] = useState<ProfileMode>('skip');
  const [selectedProfile, setSelectedProfile] = useState<ImportProfile | null>(null);
  // ...

  // RowID state
  const [rowIdSyncCheck, setRowIdSyncCheck] = useState<PreImportCheckResult | null>(null);
  const rowIdStartForImportRef = useRef<number | null>(null);
  // ...

  return {
    profile: { mode: profileMode, setMode: setProfileMode, selected: selectedProfile, ... },
    rowId: { syncCheck: rowIdSyncCheck, startRef: rowIdStartForImportRef, ... },
    // ...
  };
}
```

### Sprint 2 : Extraction gestion profils (~45 min)

**Fichier** : `components/import/wizard/hooks/use-profile-management.ts`

Extraire :
- `handleProfileSelected`
- `handleCreateNewProfile`
- `handleSkipProfile`
- `saveOrUpdateProfile`

### Sprint 3 : Extraction test import (~45 min)

**Fichier** : `components/import/wizard/hooks/use-test-import.ts`

Extraire :
- `handleStartTestImport`
- `executeTestImport`
- `executeTestVerification`
- `handleTestComplete`
- `handleTestError`
- `handleRollback`

### Sprint 4 : Extraction import chunké (~45 min)

**Fichier** : `components/import/wizard/hooks/use-chunked-import.ts`

Extraire :
- `handleConfirmFullImport` (avec logique chunking)
- `handleForceImport`
- Constantes `CHUNK_SIZE`, `MAX_RETRIES`

### Sprint 5 : Extraction RowID sync handlers (~30 min)

**Fichier** : Connecter à `lib/domain/rowid-sync/`

Extraire :
- `handleRowIdResync`
- `handleRowIdResyncCancel`
- Logique de `checkSyncBeforeImport` call

### Sprint 6 : Refactoring import-wizard.tsx (~1h)

Réécrire le composant principal pour :
- Importer les hooks extraits
- Garder uniquement `renderStep()` et l'orchestration
- Simplifier les dépendances

### Sprint 7 : Tests et validation (~30 min)

- Vérifier compilation TypeScript
- Test manuel du flow complet
- Vérifier que tous les cas fonctionnent

---

## ✅ Critères de succès

1. `import-wizard.tsx` < 400 lignes (actuellement 1603)
2. Chaque hook < 150 lignes
3. `npx tsc --noEmit` passe sans erreur
4. Flow import complet fonctionne (test + full)
5. RowIdSyncDialog fonctionne
6. Page historique fonctionne

---

## 🔗 Dépendances

### Mission 013 (bloquée)

Une fois le refactoring terminé, implémenter dans `use-chunked-import.ts` :

```typescript
// Sprint 9 de Mission 013
const realMaxRowId = await probeMaxRowIdAfterImport(
  workspaceId,
  tableName,
  rowIdStartForImport
);
```

---

## 📊 Estimation

| Sprint | Durée | Complexité |
|--------|-------|------------|
| Sprint 1 | 30 min | Faible |
| Sprint 2 | 45 min | Moyenne |
| Sprint 3 | 45 min | Moyenne |
| Sprint 4 | 45 min | Moyenne |
| Sprint 5 | 30 min | Faible |
| Sprint 6 | 1h | Élevée |
| Sprint 7 | 30 min | Faible |
| **Total** | **~4h30** | - |

---

## 🔧 Commandes utiles

```powershell
# Analyser la structure actuelle
(Get-Content "components/import/wizard/import-wizard.tsx").Count

# Lister les useState
Select-String -Path "components/import/wizard/import-wizard.tsx" -Pattern "useState<"

# Lister les useCallback
Select-String -Path "components/import/wizard/import-wizard.tsx" -Pattern "useCallback"

# Lister les useRef
Select-String -Path "components/import/wizard/import-wizard.tsx" -Pattern "useRef<"

# Vérifier après refactoring
npx tsc --noEmit

# Compter lignes des nouveaux fichiers
Get-ChildItem "components/import/wizard/hooks/*.ts" | ForEach-Object { 
  Write-Host "$($_.Name): $((Get-Content $_.FullName).Count) lignes" 
}
```

---

## 📄 Fichiers à créer

| Fichier | Description |
|---------|-------------|
| `components/import/wizard/hooks/use-import-wizard-state.ts` | États centralisés |
| `components/import/wizard/hooks/use-profile-management.ts` | Gestion profils |
| `components/import/wizard/hooks/use-test-import.ts` | Flow test import |
| `components/import/wizard/hooks/use-chunked-import.ts` | Import par chunks |
| `components/import/wizard/hooks/index.ts` | Exports |

---

*Document Mission 014*
*Estimation : 4-5 heures*
*Priorité : Haute (bloque Mission 013)*
