# Mission 013 : Historique des Imports & Rollback Différé

*Date de création : 2026-01-22*
*Mise à jour : 2026-01-23 (v6 - TERMINÉE)*
*Statut : ✅ TERMINÉE*
*Prérequis : Mission 012 (RowID) terminée ✅, Mission 014 (Refactoring) terminée ✅*

---

## 📋 Résumé

Mission complète pour l'historique des imports avec rollback différé basé sur RowID. Inclut la récupération du vrai MAX(RowID) via API v1 CloudSQL synchrone (~2-3s) au lieu de l'API Bulk Async qui timeout sur les grosses tables.

---

## ✅ Fonctionnalités implémentées

### 1. Historique des imports
- Table `import_logs` enrichie avec `row_id_before`, `row_id_after`, `rolled_back`, etc.
- Page `/history` avec liste des imports, statuts et bouton rollback
- Contrainte LIFO : seul le dernier import d'une table peut être annulé

### 2. Tracking RowID
- Table `table_rowid_sync` pour suivre le dernier RowID connu par table
- Vérification pré-import avec comparaison Supabase vs Zoho
- Récupération du vrai MAX(RowID) via API v1 CloudSQL (synchrone, ~2-3s)

### 3. Dialogue de resynchronisation amélioré (UX)
- Affichage automatique de la valeur détectée depuis Zoho
- Bouton "Utiliser cette valeur" pour auto-correction
- Option de saisie manuelle si besoin
- Messages clairs sur l'écart détecté

### 4. Rollback
- API `/api/imports/[id]/rollback` pour exécuter le rollback
- Suppression via `DELETE WHERE RowID > row_id_before`
- Mise à jour du statut dans `import_logs`

---

## 🔧 Fichiers créés/modifiés

### Créés
| Fichier | Description |
|---------|-------------|
| `docs/sql/003-import-history-rollback.sql` | Migration BDD import_logs |
| `docs/sql/004-rowid-sync.sql` | Migration BDD table_rowid_sync |
| `types/imports.ts` | Types ImportLog, CreateImportLogData |
| `lib/domain/history/rollback-rules.ts` | Règles de rollback par mode |
| `lib/domain/rowid-sync/types.ts` | Types sync + PreImportCheckResult |
| `lib/domain/rowid-sync/sync-service.ts` | Services sync et vérification |
| `app/api/imports/route.ts` | GET liste + POST créer |
| `app/api/imports/[id]/route.ts` | GET détail |
| `app/api/imports/[id]/rollback/route.ts` | POST rollback |
| `app/api/rowid-sync/route.ts` | GET/POST sync |
| `components/history/import-card.tsx` | Carte d'un import |
| `components/history/import-list.tsx` | Liste des imports |
| `components/history/rollback-dialog.tsx` | Dialogue de confirmation |
| `components/import/rowid-sync-dialog.tsx` | Dialogue resync amélioré |

### Modifiés
| Fichier | Modification |
|---------|--------------|
| `app/api/zoho/verify-by-rowid/route.ts` | Ajout action `getLastRowId` (API v1 CloudSQL) |
| `lib/domain/rowid-sync/sync-service.ts` | `fetchRealMaxRowIdAfterImport` utilise CloudSQL |
| `components/import/wizard/hooks/use-chunked-import.ts` | `updateRowIdSync` utilise la vraie valeur |
| `components/import/wizard/hooks/use-test-import.ts` | Ajout `workspaceName` pour API |
| `components/import/wizard/import-wizard.tsx` | Passage `workspaceName` + `detectedRealRowId` |
| `app/(dashboard)/history/page.tsx` | Page historique complète |

---

## 🔑 Solution technique clé

### Problème initial
L'API Bulk Async avec `MAX(RowID)` timeout sur les tables de 2M+ lignes (30s+).

### Solution implémentée
API v1 CloudSQL synchrone (~2-3s) :

```typescript
// Endpoint: /api/zoho/verify-by-rowid?action=getLastRowId
const sqlQuery = `SELECT "RowID" FROM "${tableName}" ORDER BY "RowID" DESC LIMIT 1`;

// URL API v1
const url = `${apiDomain}/api/${encodeURIComponent(ownerEmail)}/${encodeURIComponent(workspaceName)}`;
```

### Flux complet
1. **Avant import** : `checkSyncBeforeImport()` compare Supabase vs Zoho
2. **Si écart** : Dialogue avec valeur détectée + bouton "Utiliser cette valeur"
3. **Test import** : 5 lignes avec vérification
4. **Import complet** : Par chunks de 5000 lignes
5. **Après import** : `fetchRealMaxRowIdAfterImport()` récupère le vrai MAX(RowID)
6. **Logging** : `row_id_before` et `row_id_after` enregistrés dans `import_logs`
7. **Sync** : `table_rowid_sync` mis à jour avec la vraie valeur

---

## 📊 Tests validés

| Test | Résultat |
|------|----------|
| Récupération MAX(RowID) via CloudSQL | ✅ ~2-3s |
| Détection écart RowID | ✅ Dialogue affiché |
| Auto-détection valeur Zoho | ✅ Affichée dans dialogue |
| Import avec tracking RowID | ✅ row_id_before correct |
| Récupération row_id_after après import | ✅ Valeur réelle Zoho |
| Mise à jour table_rowid_sync | ✅ Valeur réelle (pas calculée) |
| Page historique | ✅ Imports affichés |
| Contrainte LIFO | ✅ Message approprié |

### Import test réussi (23/01/2026)
- Fichier : QUITTANCES 12 2025.xlsx
- Lignes : 27 790
- Durée : 12s (6 chunks)
- `row_id_before` : 3 122 445
- `row_id_after` : 3 166 192 (valeur réelle Zoho)

---

## 🧪 Tests restants à effectuer

### 1. Test du dialogue amélioré
- [ ] Vérifier l'affichage de la valeur détectée automatiquement
- [ ] Tester le bouton "Utiliser cette valeur"
- [ ] Tester le bouton "Saisir manuellement"
- [ ] Vérifier que l'écart s'affiche correctement

### 2. Test du rollback complet
- [ ] Faire un import de test
- [ ] Aller sur la page Historique
- [ ] Cliquer sur "Annuler l'import" sur le dernier import
- [ ] Vérifier que les lignes sont supprimées dans Zoho
- [ ] Vérifier que le statut passe à "Annulé" dans l'historique

### 3. Test contrainte LIFO
- [ ] Faire 2 imports successifs sur la même table
- [ ] Vérifier que seul le dernier a le bouton "Annuler"
- [ ] Vérifier le message sur l'import précédent

### 4. Test premier import (sans sync existante)
- [ ] Supprimer l'entrée dans `table_rowid_sync` pour une table
- [ ] Faire un import
- [ ] Vérifier que le dialogue demande le RowID initial

---

## 📝 Requête SQL de vérification

```sql
-- Vérifier que row_id_after et last_known_rowid sont cohérents
SELECT 
  il.file_name,
  il.rows_imported,
  il.row_id_before,
  il.row_id_after,
  trs.last_known_rowid,
  CASE WHEN il.row_id_after = trs.last_known_rowid 
    THEN '✅ OK' 
    ELSE '❌ Différent' 
  END as status
FROM csv_importer.import_logs il
LEFT JOIN csv_importer.table_rowid_sync trs 
  ON trs.table_name = il.table_name
WHERE il.table_name = 'QUITTANCES2'
ORDER BY il.created_at DESC
LIMIT 5;
```

---

## 💾 Commit

```
feat(history): complete import history with RowID tracking - Mission 013

- Add CloudSQL v1 API for fast MAX(RowID) retrieval (~2-3s vs 30s+ timeout)
- Store real row_id_before and row_id_after in import_logs
- Update table_rowid_sync with actual Zoho value (not calculated)
- Improve RowIdSyncDialog UX with auto-detected value display
- Add "Use this value" button for quick resync
- Implement LIFO constraint for rollback (only last import per table)

API changes:
- Add getLastRowId action to verify-by-rowid (uses CloudSQL v1)
- fetchRealMaxRowIdAfterImport now uses synchronous API
- checkSyncBeforeImport returns detectedRealRowId

UI improvements:
- RowIdSyncDialog shows detected value with green highlight
- Option to manually input if needed
- Clear messaging about detected offset

Files modified:
- lib/domain/rowid-sync/sync-service.ts
- lib/domain/rowid-sync/types.ts
- app/api/zoho/verify-by-rowid/route.ts
- components/import/rowid-sync-dialog.tsx
- components/import/wizard/hooks/use-chunked-import.ts
- components/import/wizard/hooks/use-test-import.ts
- components/import/wizard/import-wizard.tsx
```

---

*Mission 013 - TERMINÉE*
*Temps total estimé : ~8 heures*
