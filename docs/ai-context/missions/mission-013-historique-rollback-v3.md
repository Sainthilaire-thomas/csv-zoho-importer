# Mission 013 : Historique des Imports & Rollback Différé

*Date de création : 2026-01-22*
*Mise à jour : 2026-01-22 (v3 - État d'avancement)*
*Statut : EN COURS (blocage API Zoho)*
*Prérequis : Mission 012 (RowID) terminée ✅*

---

## 📋 Contexte

### Problème actuel

Actuellement, une fois un import terminé, il n'y a **aucune traçabilité** :
- Pas de liste des imports effectués
- Pas de possibilité d'annuler un import après coup
- La table `import_logs` existe en base mais n'était **jamais utilisée**
- La page `/history` affichait juste "Aucun import pour le moment"

### Besoin

Permettre aux utilisateurs de :
1. **Voir l'historique** de tous leurs imports
2. **Annuler un import** à posteriori (rollback différé) - quand c'est possible
3. **Comprendre comment corriger** une erreur d'import selon le mode utilisé
4. **Tracer les opérations** pour audit/debug

### Opportunité Mission 012

Grâce à la colonne **RowID** ajoutée dans Mission 012, on peut maintenant :
- Capturer `MAX(RowID)` avant et après chaque import
- Supprimer précisément les lignes importées avec `WHERE "RowID" > X AND "RowID" <= Y`

---

## 📊 Analyse des modes d'import

### Modes rollbackables (suppression automatique possible)

| Mode | Description | Stratégie rollback |
|------|-------------|-------------------|
| **APPEND** | Ajoute lignes à la fin | `DELETE WHERE RowID > before AND RowID <= after` |
| **ONLYADD** | Ajoute uniquement nouvelles clés | `DELETE WHERE RowID > before AND RowID <= after` |

### Modes NON rollbackables (correction manuelle requise)

| Mode | Description | Message à l'utilisateur |
|------|-------------|------------------------|
| **UPDATEADD** | Modifie + ajoute | "Réimportez le fichier du mois avec les valeurs correctes" |
| **TRUNCATEADD** | Vide table puis ajoute | "Réimportez la TABLE COMPLÈTE (tout l'historique)" |
| **DELETEUPSERT** | Supprime absents + modifie | "Réimportez la TABLE COMPLÈTE. Données supprimées irrécupérables" |

### Contrainte LIFO

On ne peut rollback que le **dernier import actif** d'une table. Si des imports plus récents existent sur la même table, ils doivent être annulés d'abord.

---

## 🔧 Sprints de développement

### Sprint 1 : Migration BDD ✅ TERMINÉ

**Fichier créé** : `docs/sql/003-import-history-rollback.sql`

**Note** : La table s'appelle `import_logs` (pas `import_history` comme prévu initialement)

**Modifications table `csv_importer.import_logs`** :
- `workspace_id` TEXT
- `table_name` TEXT
- `row_id_before` BIGINT (RowID max avant import)
- `row_id_after` BIGINT (RowID max après import)
- `matching_column` TEXT
- `chunks_count` INTEGER
- `rolled_back` BOOLEAN DEFAULT FALSE
- `rolled_back_at` TIMESTAMPTZ
- `rolled_back_by` UUID
- `profile_id` UUID

**Index créés** :
- `idx_import_logs_user_id`
- `idx_import_logs_zoho_table_id`
- `idx_import_logs_created_at`
- Index composite LIFO

**RLS Policies** : SELECT, INSERT, UPDATE pour authenticated users

**Statut** : ✅ Exécuté dans Supabase

---

### Sprint 2 : Types et règles de rollback ✅ TERMINÉ

**Fichiers créés** :
- `types/imports.ts` : ImportMode, ImportLog, CreateImportLogData, ImportListResponse, RollbackResponse, LIFOError
- `lib/domain/history/rollback-rules.ts` : getRollbackInfo(), isRollbackable(), canRollbackImport(), IMPORT_MODE_LABELS
- `lib/domain/history/index.ts` : exports

**Logique implémentée** :
```typescript
const ROLLBACKABLE_MODES = ['append', 'onlyadd'];

getRollbackInfo(mode) // Retourne: canRollback, message, severity, correctionMethod, icon
```

---

### Sprint 3 : API CRUD imports ✅ TERMINÉ

**Fichiers créés** :
- `app/api/imports/route.ts` : GET (liste paginée) + POST (créer log)
- `app/api/imports/[id]/route.ts` : GET (détail)
- `app/api/imports/[id]/rollback/route.ts` : POST (exécuter rollback)

**Correction appliquée** : 
- Import `getTokens` (pas `getZohoTokens`)
- Ajout `.schema('csv_importer')` dans les requêtes Supabase (la table est dans ce schéma, pas `public`)

**API GET /api/imports** :
- Query params: `limit` (max 100), `offset`, `viewId`, `status`
- Response: `{ imports, total, hasMore }`

**API POST /api/imports** :
- Body: CreateImportLogData
- Validation: viewId, fileName, importMode requis

**API POST /api/imports/[id]/rollback** :
- Vérifie: déjà rollback, mode rollbackable, RowID disponibles, contrainte LIFO
- Exécute: `DELETE WHERE "RowID" > {before} AND "RowID" <= {after}`
- Met à jour: `rolled_back=true, rolled_back_at, rolled_back_by`

---

### Sprint 4 : Intégration Wizard ✅ TERMINÉ

**Fichier modifié** : `components/import/wizard/import-wizard.tsx`

**Modifications** :
1. Après import complet, récupérer MAX(RowID) via `/api/zoho/verify-by-rowid?action=getMax`
2. Logger l'import via `POST /api/imports` avec tous les champs
3. Calcul `totalRowsImported = testSampleSize + totalImported`

**Corrections TypeScript appliquées** : 
- `validCount → validRows`
- `errorCount → errorRows`

---

### Sprint 5 : Page Historique enrichie ✅ TERMINÉ

**Fichiers créés** :
- `components/history/import-card.tsx` : Carte affichant un import
- `components/history/import-list.tsx` : Liste avec pagination
- `components/history/rollback-dialog.tsx` : Modal confirmation rollback
- `components/history/index.ts` : exports
- `app/(dashboard)/history/page.tsx` : Page historique enrichie

**Fonctionnalités** :
- Affichage: fileName, tableName, date, stats (lignes, durée, mode)
- Statut: Actif (CheckCircle) / Annulé (RotateCcw) / Erreur (XCircle)
- Bouton "Annuler l'import" conditionnel
- Messages adaptés par mode (Info/Warning/Error avec icônes)
- Message LIFO si pas le dernier import de la table
- Pagination "Charger plus"

**Correction appliquée** : `variant="destructive" → variant="danger"` (composant Button)

---

### Sprint 6 : Contraintes LIFO ✅ TERMINÉ

**Implémenté dans** : `app/api/imports/[id]/rollback/route.ts`

**Logique** :
```typescript
// Vérifier qu'aucun import plus récent non-rollback n'existe sur cette table
const newerImports = await supabase
  .schema('csv_importer')
  .from('import_logs')
  .select('id, file_name, created_at')
  .eq('zoho_table_id', importToRollback.zoho_table_id)
  .eq('rolled_back', false)
  .gt('created_at', importToRollback.created_at);

if (newerImports.data && newerImports.data.length > 0) {
  return NextResponse.json({
    error: `Vous devez d'abord annuler l'import plus récent`,
    newerImports: newerImports.data,
  }, { status: 400 });
}
```

---

## ⚠️ Problème bloquant : Timeout sur grosses tables

### Contexte

- La table QUITTANCES2 contient **2+ millions de lignes**
- La colonne `RowID` est un **AUTO_NUMBER Zoho** (généré automatiquement à chaque insert)
- Pour le rollback, on a besoin de `MAX(RowID)` avant et après l'import

### Correction appliquée à l'API verify-by-rowid

**Problème initial** : L'API utilisait le mauvais endpoint Zoho (`/data/query` avec POST)

**Solution** : Changement vers `/data` avec GET (même approche que `/api/zoho/sample-row`)

```typescript
// Avant (ne fonctionnait pas)
const createJobUrl = `${apiDomain}/restapi/v2/bulk/workspaces/${workspaceId}/data/query`;
method: 'POST'
body: `CONFIG=${...}`

// Après (fonctionne - job créé)
const createJobUrl = `${apiDomain}/restapi/v2/bulk/workspaces/${workspaceId}/data?CONFIG=${configEncoded}`;
method: 'GET'
```

### Comportement actuel

```
[VerifyByRowID] SQL: SELECT MAX("RowID") as "maxRowId" FROM "QUITTANCES2"
[VerifyByRowID] Job created: 1718953000034725001
[VerifyByRowID] Poll 1 - jobCode: 1004
...
[VerifyByRowID] Poll 30 - jobCode: 1004
→ Job timeout after 30 polls (30 secondes)
```

### Cause racine

1. **Export synchrone interdit** : Zoho bloque les requêtes sync sur tables > 1M lignes
   ```
   SYNC_EXPORT_NOT_ALLOWED - errorCode: 8133
   ```

2. **Export async trop lent** : Les requêtes `MAX(RowID)` et `ORDER BY RowID DESC LIMIT 1` font un full table scan car la colonne RowID n'est probablement pas indexée côté Zoho

3. **API Import ne retourne pas les RowID** : La réponse Zoho contient seulement `successRowCount`, pas les RowID générés

### Conséquence actuelle

- Les imports sont correctement loggés dans l'historique ✅
- `row_id_before` et `row_id_after` sont `null` ❌
- Le bouton "Annuler l'import" n'apparaît pas (car RowID non disponibles)

---

## 🔧 Solutions envisagées pour le timeout

### Option A : Requête optimisée avec filtre sur date

Si la table a une colonne de date récente, filtrer pour réduire le scan :
```sql
SELECT MAX("RowID") FROM "QUITTANCES2" WHERE "Date début" >= '2025-08-01'
```

**Avantages** : Scan limité aux lignes récentes
**Inconvénients** : Nécessite une colonne date fiable, pas universel

### Option B : Augmenter le timeout

Passer de 30 polls à 90+ polls (90+ secondes)

**Avantages** : Simple à implémenter
**Inconvénients** : UX dégradée (attente longue), peut quand même timeout

### Option C : Requête en arrière-plan

1. Lancer la requête MAX(RowID) de manière asynchrone
2. Stocker le résultat quand il arrive
3. Mettre à jour le log d'import plus tard

**Avantages** : Pas de blocage UI
**Inconvénients** : Complexité accrue, rollback pas disponible immédiatement

### Option D : Calcul approximatif

Puisque RowID est séquentiel :
```
row_id_after = row_id_before + successRowCount
```

On a toujours besoin de `row_id_before`, mais une seule requête au lieu de deux.

### Option E : Rollback par clé de matching

Utiliser la colonne de matching (ex: "Numéro Quittance") au lieu de RowID.

**Avantages** : Pas de requête MAX(RowID) nécessaire
**Inconvénients** : Stockage potentiellement volumineux

### Option F : Index sur RowID dans Zoho

Créer un index sur la colonne RowID dans Zoho Analytics (si possible via interface)

**Avantages** : Résout le problème à la source
**Inconvénients** : Dépend des capacités de Zoho

---

## 📁 Fichiers créés/modifiés

| Fichier | Action | Sprint |
|---------|--------|--------|
| `docs/sql/003-import-history-rollback.sql` | ✅ Créé & exécuté | 1 |
| `types/imports.ts` | ✅ Créé | 2 |
| `lib/domain/history/rollback-rules.ts` | ✅ Créé | 2 |
| `lib/domain/history/index.ts` | ✅ Créé | 2 |
| `app/api/imports/route.ts` | ✅ Créé | 3 |
| `app/api/imports/[id]/route.ts` | ✅ Créé | 3 |
| `app/api/imports/[id]/rollback/route.ts` | ✅ Créé | 3 + 6 |
| `components/import/wizard/import-wizard.tsx` | ✅ Modifié | 4 |
| `app/(dashboard)/history/page.tsx` | ✅ Remplacé | 5 |
| `components/history/import-list.tsx` | ✅ Créé | 5 |
| `components/history/import-card.tsx` | ✅ Créé | 5 |
| `components/history/rollback-dialog.tsx` | ✅ Créé | 5 |
| `components/history/index.ts` | ✅ Créé | 5 |
| `app/api/zoho/verify-by-rowid/route.ts` | ✅ Corrigé (endpoint) | - |

---

## 📊 État actuel

| Fonctionnalité | Statut |
|----------------|--------|
| Sprint 1 - Migration BDD | ✅ Complété |
| Sprint 2 - Types & règles rollback | ✅ Complété |
| Sprint 3 - API CRUD `/api/imports` | ✅ Complété |
| Sprint 4 - Intégration Wizard (logging) | ✅ Complété |
| Sprint 5 - Page Historique UI | ✅ Complété |
| Sprint 6 - Contraintes LIFO | ✅ Complété |
| Capture RowID avant/après | ❌ Timeout sur grosses tables (2M+ lignes) |
| Rollback automatique | ❌ Bloqué (dépend des RowID) |

---

## 🧪 Tests à effectuer (quand RowID sera résolu)

### Test 1 : Vérifier le logging
1. Importer un fichier en mode APPEND
2. Vérifier dans Supabase que le log est créé avec `row_id_before` et `row_id_after` **remplis**

### Test 2 : Vérifier la page Historique
1. Ouvrir `/history`
2. Vérifier que les imports apparaissent
3. Vérifier les messages adaptés à chaque mode

### Test 3 : Tester le rollback (APPEND)
1. Importer un petit fichier (10 lignes) en mode APPEND
2. Aller dans l'historique
3. Vérifier que le bouton "Annuler import" apparaît
4. Cliquer dessus et confirmer
5. Vérifier dans Zoho que les lignes sont supprimées
6. Vérifier que le statut est "Annulé" dans l'historique

### Test 4 : Vérifier les modes non-rollbackables
1. Importer en mode UPDATEADD
2. Vérifier que le bouton "Annuler" n'apparaît pas
3. Vérifier que le message de correction approprié s'affiche

### Test 5 : Tester les contraintes LIFO
1. Importer fichier A en mode APPEND
2. Importer fichier B sur la même table en mode APPEND
3. Essayer d'annuler fichier A → Doit échouer avec message explicatif
4. Annuler fichier B → OK
5. Annuler fichier A → OK maintenant

---

## 📝 Commandes utiles

```powershell
# Vérifier compilation
npx tsc --noEmit

# Test API imports (console navigateur)
fetch('/api/imports?limit=1').then(r => r.json()).then(console.log)

# Test API verify-by-rowid (console navigateur)
fetch('/api/zoho/verify-by-rowid?workspaceId=1718953000014173074&tableName=QUITTANCES2&action=getMax').then(r => r.json()).then(console.log)
```

---

## 🔗 Prochaines étapes

1. **Décider de la solution** pour le problème RowID (Options A-F ci-dessus)
2. **Implémenter** la solution choisie
3. **Tester** le rollback complet sur une table de test ou petite table
4. **Valider** sur QUITTANCES2

---

*Document Mission 013*
*Estimation initiale : 4-5 heures*
*Temps passé : ~4 heures*
*Version : 3.0 - État d'avancement*
