# Mission 013 : Historique des Imports & Rollback Différé

*Date de création : 2026-01-22*
*Mise à jour : 2026-01-22 (v4 - Intégration Wizard complète)*
*Statut : ✅ FONCTIONNEL - Tests en cours*
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

---

## 📊 État actuel vérifié

| Fonctionnalité | Statut | Notes |
|----------------|--------|-------|
| Sondage RowID rapide | ✅ | ~5s au lieu de 30s+ timeout |
| Import avec tracking RowID | ✅ | row_id_before et row_id_after remplis |
| Mise à jour table_rowid_sync | ✅ | Après chaque import réussi |
| Page Historique | ✅ | 2 imports affichés correctement |
| Message LIFO | ✅ | "Pour annuler cet import, vous devez d'abord annuler les imports plus récents" |
| Bouton Annuler | ⏳ | À tester sur le dernier import |

### Test réussi (22/01/2026 19:35)

- Import : QUITTANCES 09 2025.xlsx
- Table : QUITTANCES2
- Lignes : 36 764
- Durée : 15s
- RowID sync : 2965527 (mis à jour)

---

## 🔄 Ce qui reste à faire

### Tests à effectuer

1. **Test rollback** sur le dernier import (QUITTANCES 09 2025.xlsx)
   - Vérifier que le bouton "Annuler" apparaît
   - Cliquer et confirmer
   - Vérifier suppression dans Zoho
   - Vérifier statut "Annulé" dans l'historique

2. **Test contrainte LIFO**
   - Importer un nouveau fichier
   - Essayer d'annuler l'ancien → doit échouer
   - Annuler le nouveau → OK
   - Annuler l'ancien → OK maintenant

3. **Test modes non-rollbackables**
   - Importer en mode UPDATEADD
   - Vérifier que le bouton "Annuler" n'apparaît pas
   - Vérifier message de correction approprié

### Améliorations possibles (futur)

- [ ] Afficher les détails de l'import (colonnes, transformations)
- [ ] Export CSV de l'historique
- [ ] Filtres par date/table/statut
- [ ] Notifications push après import long

---

## 📁 Fichiers créés/modifiés

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
| `components/import/wizard/import-wizard.tsx` | ✅ Modifié |
| `app/(dashboard)/history/page.tsx` | ✅ Remplacé |

---

## 🏗️ Architecture finale

```
┌─────────────────────────────────────────────────────────────────┐
│                     FLUX D'IMPORT                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. Sélection table → checkSyncBeforeImport()                  │
│         │                                                       │
│         ▼                                                       │
│  ┌─────────────────┐     ┌─────────────────┐                   │
│  │ Synchro OK ?    │─Non→│ RowIdSyncDialog │                   │
│  │ (sondage ±5)    │     │ (saisie manuelle)│                   │
│  └────────┬────────┘     └────────┬────────┘                   │
│           │ Oui                   │                             │
│           ▼                       ▼                             │
│  2. rowid_debut = lastKnownRowid + 1                           │
│                                                                 │
│  3. Test import (5 lignes)                                     │
│                                                                 │
│  4. Import complet (chunks de 5000)                            │
│         │                                                       │
│         ▼                                                       │
│  5. rowid_fin = rowid_debut + nb_lignes - 1                    │
│                                                                 │
│  6. Sauvegarder :                                              │
│     - import_logs (rowid_debut, rowid_fin)                     │
│     - table_rowid_sync (lastKnownRowid = rowid_fin)            │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                     ROLLBACK                                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  DELETE FROM table WHERE "RowID" >= rowid_debut                │
│                     AND "RowID" <= rowid_fin                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📝 Commandes utiles

```powershell
# Vérifier compilation
npx tsc --noEmit

# Test API imports (console navigateur)
fetch('/api/imports?limit=10').then(r => r.json()).then(console.log)

# Test rollback (console navigateur)
fetch('/api/imports/[ID]/rollback', { method: 'POST' }).then(r => r.json()).then(console.log)

# Vérifier table_rowid_sync dans Supabase
SELECT * FROM csv_importer.table_rowid_sync;

# Vérifier import_logs dans Supabase
SELECT id, file_name, rows_imported, row_id_before, row_id_after, rolled_back 
FROM csv_importer.import_logs 
ORDER BY created_at DESC;
```

---

*Document Mission 013*
*Estimation initiale : 4-5 heures*
*Temps passé : ~5 heures*
*Version : 4.0 - Intégration Wizard complète*
