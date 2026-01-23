# Mission 013 : Historique des Imports & Rollback Différé

*Date de création : 2026-01-22*
*Mise à jour : 2026-01-23 (v5 - Tests validés, problème RowID identifié)*
*Statut : ⏸️ EN PAUSE - En attente Mission 014 (refactoring)*
*Prérequis : Mission 012 (RowID) terminée ✅*

---

## 📋 Contexte

### Problème initial

Actuellement, une fois un import terminé, il n'y a **aucune traçabilité** :
- Pas de liste des imports effectués
- Pas de possibilité d'annuler un import après coup
- La table `import_logs` existe en base mais n'était **jamais utilisée**
- La page `/history` affichait juste "Aucun import pour le moment"

### Solution implémentée

1. **Historique complet** des imports avec tous les détails
2. **Rollback différé** possible pour les modes APPEND/ONLYADD
3. **Sondage RowID rapide** (~5s) au lieu de MAX() qui timeout (30s+)
4. **Synchronisation table_rowid_sync** pour tracking des RowID par table

---

## ✅ Ce qui a été fait

### Sprint 1 : Migration BDD ✅

**Fichier** : `docs/sql/003-import-history-rollback.sql` + `docs/sql/004-rowid-sync.sql`

**Tables modifiées/créées** :
- `csv_importer.import_logs` : colonnes ajoutées (workspace_id, table_name, row_id_before, row_id_after, matching_column, chunks_count, rolled_back, rolled_back_at, rolled_back_by, profile_id)
- `csv_importer.table_rowid_sync` : nouvelle table pour tracking RowID par table Zoho

### Sprint 2 : Types et règles rollback ✅

**Fichiers créés** :
- `types/imports.ts` : ImportMode, ImportLog, CreateImportLogData, etc.
- `lib/domain/history/rollback-rules.ts` : getRollbackInfo(), isRollbackable(), canRollbackImport()

### Sprint 3 : API CRUD imports ✅

**Fichiers créés** :
- `app/api/imports/route.ts` : GET (liste) + POST (créer)
- `app/api/imports/[id]/route.ts` : GET (détail)
- `app/api/imports/[id]/rollback/route.ts` : POST (exécuter rollback)
- `app/api/rowid-sync/route.ts` : GET/POST pour sync RowID

### Sprint 4 : Intégration Wizard ✅

**Fichier modifié** : `components/import/wizard/import-wizard.tsx`

**Fonctionnalités ajoutées** :
1. `checkSyncBeforeImport()` avant test import (sondage rapide RowID)
2. `RowIdSyncDialog` si resync manuelle nécessaire
3. Calcul `maxRowIdAfter` sans appel API (évite timeout)
4. Mise à jour `table_rowid_sync` après import réussi
5. Logging dans `import_logs` avec tous les champs

### Sprint 5 : Page Historique UI ✅

**Fichiers créés** :
- `components/history/import-card.tsx`
- `components/history/import-list.tsx`
- `components/history/rollback-dialog.tsx`
- `app/(dashboard)/history/page.tsx`

**Fonctionnalités** :
- Liste des imports avec pagination
- Statut : Actif / Annulé / Erreur
- Bouton "Annuler l'import" conditionnel
- Message LIFO si pas le dernier import de la table
- Messages adaptés par mode d'import

### Sprint 6 : Contraintes LIFO ✅

Implémenté dans l'API rollback : vérification qu'aucun import plus récent n'existe sur la même table.

### Sprint 7 : Module RowID Sync ✅

**Fichiers créés** :
- `lib/domain/rowid-sync/types.ts`
- `lib/domain/rowid-sync/probe-service.ts` : sondage rapide par existence RowID
- `lib/domain/rowid-sync/sync-service.ts` : checkSyncBeforeImport(), updateSyncAfterImport()
- `components/import/rowid-sync-dialog.tsx`

### Sprint 8 : Nettoyage API Zoho ✅

**Routes supprimées** :
- `/api/zoho/sql-query` (WORKSPACE_ID hardcodé, non utilisé)
- `/api/zoho/async-export` (WORKSPACE_ID hardcodé, dev only)
- `/api/zoho/list-views` (WORKSPACE_ID hardcodé, dev only)
- `/api/zoho/test-private-url` (route de test dev)
- `/api/zoho/data` (sync, timeout grosses tables, remplacé par verify-data)

**Code nettoyé** :
- `compare.ts` : fallback sync supprimé
- `verify-by-rowid` : actions `getMax` et `getLatest` supprimées (garde seulement `getAfter`)

---

## 📊 Tests validés (23/01/2026)

| Fonctionnalité | Statut | Notes |
|----------------|--------|-------|
| Sondage RowID rapide | ✅ | ~5s au lieu de 30s+ timeout |
| RowIdSyncDialog | ✅ | S'affiche si écart > 5 RowID |
| Import avec tracking RowID | ✅ | row_id_before rempli correctement |
| Mise à jour table_rowid_sync | ✅ | Après chaque import réussi |
| Page Historique | ✅ | Imports affichés correctement |
| Message LIFO | ✅ | "Pour annuler cet import, vous devez d'abord annuler les imports plus récents" |
| Bouton Annuler | ✅ | Apparaît sur le dernier import |

### Test import réussi (23/01/2026 10:24)

- Import : QUITTANCES 10 2025.xlsx
- Table : QUITTANCES2
- Lignes : 45 888
- Durée : 20s
- RowID sync : 3 033 754 (calculé) → **3 062 473** (réel Zoho)

---

## 🐛 Problème identifié : row_id_after incorrect

### Constat

| Valeur | Notre calcul | Réalité Zoho |
|--------|--------------|--------------|
| row_id_after | 3 033 754 | 3 062 473 |
| Écart | - | ~28 700 RowID |

### Cause

Zoho Analytics introduit des **"trous"** dans la séquence des RowID :
- Les RowID supprimés ne sont jamais réutilisés
- L'auto-incrémentation peut sauter des valeurs pour des raisons internes

### Impact

La formule actuelle `row_id_after = row_id_before + nb_lignes` est **incorrecte**.

Le rollback utilise `WHERE RowID > row_id_before AND RowID <= row_id_after`, donc avec un `row_id_after` sous-estimé, **toutes les lignes ne seront pas supprimées**.

### Bonne nouvelle

Les RowID sont **continus entre imports** (pas de chevauchement) :
- Septembre se termine à 2 987 866
- Octobre commence à 2 987 867

Donc `WHERE RowID > row_id_before` fonctionne pour le rollback du **dernier** import.

### Solution à implémenter (Sprint 9)

Après l'import complet, utiliser le **probe-service** pour trouver le vrai MAX RowID au lieu de calculer.

```typescript
// Dans handleConfirmFullImport, après les chunks
const realMaxRowId = await probeMaxRowIdAfterImport(
  selectedWorkspaceId,
  state.config.tableName,
  rowIdStartForImportRef.current
);
```

**⚠️ BLOQUÉ** : Le fichier `import-wizard.tsx` est trop volumineux (~1100 lignes). 
→ Refactoring nécessaire avant d'ajouter du code (voir Mission 014)

---

## 📄 Fichiers créés/modifiés

| Fichier | Action |
|---------|--------|
| `docs/sql/003-import-history-rollback.sql` | ✅ Créé & exécuté |
| `docs/sql/004-rowid-sync.sql` | ✅ Créé & exécuté |
| `types/imports.ts` | ✅ Créé |
| `lib/domain/history/rollback-rules.ts` | ✅ Créé |
| `lib/domain/history/index.ts` | ✅ Créé |
| `lib/domain/rowid-sync/types.ts` | ✅ Créé |
| `lib/domain/rowid-sync/probe-service.ts` | ✅ Créé |
| `lib/domain/rowid-sync/sync-service.ts` | ✅ Créé |
| `lib/domain/rowid-sync/index.ts` | ✅ Créé |
| `app/api/imports/route.ts` | ✅ Créé |
| `app/api/imports/[id]/route.ts` | ✅ Créé |
| `app/api/imports/[id]/rollback/route.ts` | ✅ Créé |
| `app/api/rowid-sync/route.ts` | ✅ Créé |
| `components/history/import-card.tsx` | ✅ Créé |
| `components/history/import-list.tsx` | ✅ Créé |
| `components/history/rollback-dialog.tsx` | ✅ Créé |
| `components/history/index.ts` | ✅ Créé |
| `components/import/rowid-sync-dialog.tsx` | ✅ Créé |
| `components/import/wizard/import-wizard.tsx` | ✅ Modifié (trop volumineux) |
| `app/(dashboard)/history/page.tsx` | ✅ Remplacé |

---

## 🔜 Prochaines étapes

1. **Mission 014** : Refactoring import-wizard.tsx (extraction hooks/services)
2. **Sprint 9** : Implémenter `probeMaxRowIdAfterImport()` pour sécuriser row_id_after
3. **Tests rollback** : Valider la suppression effective dans Zoho

---

## 🔧 Commandes utiles

```powershell
# Vérifier compilation
npx tsc --noEmit

# Test API imports (console navigateur)
fetch('/api/imports?limit=10').then(r => r.json()).then(console.log)

# Vérifier table_rowid_sync dans Supabase
SELECT * FROM csv_importer.table_rowid_sync;

# Vérifier import_logs dans Supabase
SELECT id, file_name, rows_imported, row_id_before, row_id_after, rolled_back 
FROM csv_importer.import_logs 
ORDER BY created_at DESC;

# Vérifier RowID réel dans Zoho (Query Table)
SELECT MIN("RowID"), MAX("RowID"), COUNT(*) FROM QUITTANCES2 WHERE "RowID" > 2987866
```

---

*Document Mission 013*
*Estimation initiale : 4-5 heures*
*Temps passé : ~6 heures*
*Version : 5.0 - Tests validés, en attente refactoring*
