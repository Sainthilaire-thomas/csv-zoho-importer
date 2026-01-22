# Mission 013 : Historique des Imports & Rollback Différé

*Date de création : 2026-01-22*
*Statut : À DÉMARRER*
*Prérequis : Mission 012 (RowID) terminée ✅*

---

## 📋 Contexte

### Problème actuel

Actuellement, une fois un import terminé, il n'y a **aucune traçabilité** :
- Pas de liste des imports effectués
- Pas de possibilité d'annuler un import après coup
- La table `import_history` existe en base mais n'est **jamais utilisée**
- La page `/history` affiche juste "Aucun import pour le moment"

### Besoin

Permettre aux utilisateurs de :
1. **Voir l'historique** de tous leurs imports
2. **Annuler un import** à posteriori (rollback différé)
3. **Tracer les opérations** pour audit/debug

### Opportunité Mission 012

Grâce à la colonne **RowID** ajoutée dans Mission 012, on peut maintenant :
- Capturer `MAX(RowID)` avant et après chaque import
- Supprimer précisément les lignes importées avec `WHERE "RowID" > X AND "RowID" <= Y`

---

## 🎯 Objectifs

1. **Logger automatiquement** chaque import réussi avec les infos de rollback
2. **Enrichir la page Historique** avec la liste des imports
3. **Permettre le rollback différé** depuis l'historique
4. **Gérer les contraintes** (ordre LIFO, modes non-rollbackables)

---

## 📊 Schéma de données

### Table `import_history` (à migrer)

```sql
-- Migration : Enrichir la table existante
ALTER TABLE csv_importer.import_history 
ADD COLUMN IF NOT EXISTS workspace_id TEXT,
ADD COLUMN IF NOT EXISTS view_id TEXT,
ADD COLUMN IF NOT EXISTS table_name TEXT,
ADD COLUMN IF NOT EXISTS import_mode TEXT DEFAULT 'append',
ADD COLUMN IF NOT EXISTS row_id_before BIGINT,
ADD COLUMN IF NOT EXISTS row_id_after BIGINT,
ADD COLUMN IF NOT EXISTS matching_column TEXT,
ADD COLUMN IF NOT EXISTS chunks_count INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS rolled_back BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS rolled_back_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS rolled_back_by UUID REFERENCES auth.users(id);

-- Index pour les requêtes fréquentes
CREATE INDEX IF NOT EXISTS idx_import_history_user_id ON csv_importer.import_history(user_id);
CREATE INDEX IF NOT EXISTS idx_import_history_view_id ON csv_importer.import_history(view_id);
CREATE INDEX IF NOT EXISTS idx_import_history_created_at ON csv_importer.import_history(created_at DESC);

-- Commentaires
COMMENT ON COLUMN csv_importer.import_history.row_id_before IS 'MAX(RowID) avant import - pour rollback';
COMMENT ON COLUMN csv_importer.import_history.row_id_after IS 'MAX(RowID) après import - pour rollback';
COMMENT ON COLUMN csv_importer.import_history.rolled_back IS 'Import annulé ?';
```

### Structure finale

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | UUID | PK |
| `user_id` | UUID | FK → auth.users |
| `profile_id` | UUID | FK → import_profiles (optionnel) |
| `workspace_id` | TEXT | ID workspace Zoho |
| `view_id` | TEXT | ID table Zoho |
| `table_name` | TEXT | Nom de la table |
| `import_mode` | TEXT | append, truncateadd, updateadd... |
| `file_name` | TEXT | Nom du fichier importé |
| `rows_imported` | INTEGER | Nombre de lignes importées |
| `row_id_before` | BIGINT | MAX(RowID) AVANT l'import |
| `row_id_after` | BIGINT | MAX(RowID) APRÈS l'import |
| `matching_column` | TEXT | Colonne de matching (modes UPDATE) |
| `chunks_count` | INTEGER | Nombre de chunks |
| `duration_ms` | INTEGER | Durée totale |
| `status` | TEXT | success, partial, failed |
| `error_message` | TEXT | Message d'erreur si échec |
| `rolled_back` | BOOLEAN | Import annulé ? |
| `rolled_back_at` | TIMESTAMPTZ | Date du rollback |
| `rolled_back_by` | UUID | Utilisateur qui a rollback |
| `created_at` | TIMESTAMPTZ | Date de l'import |

---

## 🔧 Sprints de développement

### Sprint 1 : Migration base de données

**Fichier** : `docs/sql/003-import-history-migration.sql`

**Actions** :
1. Créer le script de migration
2. Exécuter dans Supabase
3. Vérifier la structure

**Estimation** : 15 min

---

### Sprint 2 : API CRUD imports

**Fichiers** :
- `app/api/imports/route.ts` - GET (liste) + POST (créer)
- `app/api/imports/[id]/route.ts` - GET (détail) + DELETE (supprimer log)
- `app/api/imports/[id]/rollback/route.ts` - POST (exécuter rollback)
- `types/imports.ts` - Types TypeScript

**Endpoints** :

#### `GET /api/imports`
```typescript
// Query params
?limit=20&offset=0&viewId=xxx&status=success

// Response
{
  imports: ImportLog[],
  total: number,
  hasMore: boolean
}
```

#### `POST /api/imports`
```typescript
// Body
{
  workspaceId: string,
  viewId: string,
  tableName: string,
  importMode: string,
  fileName: string,
  rowsImported: number,
  rowIdBefore: number,
  rowIdAfter: number,
  matchingColumn?: string,
  chunksCount: number,
  durationMs: number,
  status: 'success' | 'partial' | 'failed',
  errorMessage?: string,
  profileId?: string,
}

// Response
{ success: true, importId: string }
```

#### `POST /api/imports/[id]/rollback`
```typescript
// Response
{
  success: boolean,
  deletedRows: number,
  duration: number,
  errorMessage?: string
}
```

**Estimation** : 1h

---

### Sprint 3 : Intégration dans le wizard

**Fichier** : `components/import/wizard/import-wizard.tsx`

**Modifications** :

1. **Capturer `maxRowIdBefore`** au début de `handleConfirmFullImport` :
```typescript
// Avant le premier chunk
const maxRowIdBefore = maxRowIdBeforeTestRef.current; // Déjà capturé pour le test
```

2. **Capturer `maxRowIdAfter`** après le dernier chunk :
```typescript
// Après tous les chunks
let maxRowIdAfter = maxRowIdBefore;
if (tableName) {
  const response = await fetch(`/api/zoho/verify-by-rowid?...&action=getMax`);
  const result = await response.json();
  if (result.success) {
    maxRowIdAfter = Number(result.data[0]?.maxRowId || 0);
  }
}
```

3. **Logger l'import** après succès :
```typescript
// Après setImportSuccess()
await fetch('/api/imports', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    workspaceId: selectedWorkspaceId,
    viewId: state.config.tableId,
    tableName: tableName,
    importMode: state.config.importMode,
    fileName: state.config.file?.name,
    rowsImported: totalImported,
    rowIdBefore: maxRowIdBefore,
    rowIdAfter: maxRowIdAfter,
    matchingColumn: verificationColumnRef.current,
    chunksCount: chunks.length,
    durationMs: Date.now() - startTime,
    status: 'success',
    profileId: selectedProfile?.id,
  }),
});
```

**Estimation** : 30 min

---

### Sprint 4 : Page Historique enrichie

**Fichier** : `app/(dashboard)/history/page.tsx`

**UI proposée** :

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  📋 Historique des imports                                    [🔍 Filtrer]  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ 📄 QUITTANCES_05_2025.xlsx                              22/01 07:45 │   │
│  │ QUITTANCES2 • 61 317 lignes • 26s • Mode: APPEND                    │   │
│  │ ✅ Actif                                         [🗑️ Annuler]       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ 📄 QUITTANCES_04_2025.xlsx                              21/01 14:30 │   │
│  │ QUITTANCES2 • 58 421 lignes • 24s • Mode: APPEND                    │   │
│  │ 🔄 Annulé le 21/01 15:00                                            │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ 📄 Agents_SC.csv                                        20/01 09:15 │   │
│  │ Agents_SC • 245 lignes • 2s • Mode: TRUNCATEADD                     │   │
│  │ ✅ Actif                                         [🗑️ Annuler]       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│                        [Charger plus...]                                    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Composants** :
- `components/history/import-list.tsx` - Liste des imports
- `components/history/import-card.tsx` - Carte d'un import
- `components/history/rollback-dialog.tsx` - Modal de confirmation

**Estimation** : 1h30

---

### Sprint 5 (optionnel) : Contraintes de rollback

**Règles métier** :

1. **Ordre LIFO** : On ne peut rollback que le dernier import actif d'une table
   ```typescript
   // Vérifier qu'aucun import plus récent n'existe sur cette table
   const newerImports = await getNewerActiveImports(viewId, importDate);
   if (newerImports.length > 0) {
     throw new Error('Vous devez d\'abord annuler les imports plus récents');
   }
   ```

2. **Modes non-rollbackables** : 
   - `updateadd` et `deleteupsert` : Rollback impossible (données modifiées, pas ajoutées)
   - Afficher un warning dans l'UI

3. **Délai limite** : Optionnel - empêcher rollback après X jours
   ```typescript
   const maxRollbackDays = 30;
   const importAge = Date.now() - importDate.getTime();
   if (importAge > maxRollbackDays * 24 * 60 * 60 * 1000) {
     throw new Error('Import trop ancien pour être annulé');
   }
   ```

**Estimation** : 45 min

---

## 📁 Fichiers à créer/modifier

| Fichier | Action | Sprint |
|---------|--------|--------|
| `docs/sql/003-import-history-migration.sql` | Créer | 1 |
| `types/imports.ts` | Créer | 2 |
| `app/api/imports/route.ts` | Créer | 2 |
| `app/api/imports/[id]/route.ts` | Créer | 2 |
| `app/api/imports/[id]/rollback/route.ts` | Créer | 2 |
| `components/import/wizard/import-wizard.tsx` | Modifier | 3 |
| `app/(dashboard)/history/page.tsx` | Modifier | 4 |
| `components/history/import-list.tsx` | Créer | 4 |
| `components/history/import-card.tsx` | Créer | 4 |
| `components/history/rollback-dialog.tsx` | Créer | 4 |

---

## 🧪 Tests à effectuer

### Test 1 : Vérifier le logging
1. Importer un fichier
2. Vérifier dans Supabase que le log est créé avec `row_id_before` et `row_id_after`

### Test 2 : Vérifier la page Historique
1. Ouvrir `/history`
2. Vérifier que les imports apparaissent
3. Vérifier les détails affichés

### Test 3 : Tester le rollback
1. Importer un petit fichier (10 lignes)
2. Aller dans l'historique
3. Cliquer sur "Annuler"
4. Confirmer
5. Vérifier dans Zoho que les lignes sont supprimées
6. Vérifier que le statut est "Annulé" dans l'historique

### Test 4 : Tester les contraintes LIFO
1. Importer fichier A
2. Importer fichier B sur la même table
3. Essayer d'annuler fichier A → Doit échouer
4. Annuler fichier B → OK
5. Annuler fichier A → OK maintenant

---

## 📊 Diagramme de flux

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           IMPORT COMPLET                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. Début import complet                                                    │
│     └─► maxRowIdBefore = maxRowIdBeforeTestRef.current (déjà capturé)      │
│                                                                             │
│  2. Import des chunks (1 à N)                                               │
│     └─► POST /api/zoho/import (pour chaque chunk)                          │
│                                                                             │
│  3. Fin import complet                                                      │
│     └─► GET /api/zoho/verify-by-rowid?action=getMax                        │
│     └─► maxRowIdAfter = résultat                                           │
│                                                                             │
│  4. Logger l'import                                                         │
│     └─► POST /api/imports { rowIdBefore, rowIdAfter, ... }                 │
│                                                                             │
│  5. Afficher succès                                                         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                           ROLLBACK DIFFÉRÉ                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. Utilisateur clique "Annuler" sur un import                              │
│                                                                             │
│  2. Vérifications                                                           │
│     ├─► Mode rollbackable ? (pas updateadd/deleteupsert)                   │
│     ├─► Pas d'import plus récent sur cette table ?                         │
│     └─► Délai pas dépassé ?                                                │
│                                                                             │
│  3. Confirmation utilisateur                                                │
│     └─► "Supprimer 61 317 lignes ?"                                        │
│                                                                             │
│  4. Exécution rollback                                                      │
│     └─► DELETE WHERE "RowID" > rowIdBefore AND "RowID" <= rowIdAfter       │
│                                                                             │
│  5. Mise à jour log                                                         │
│     └─► UPDATE import_history SET rolled_back = true, rolled_back_at = NOW │
│                                                                             │
│  6. Afficher confirmation                                                   │
│     └─► "61 317 lignes supprimées"                                         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## ⚠️ Limitations connues

1. **TRUNCATEADD** : Le rollback supprime les nouvelles lignes mais **ne restaure pas** les anciennes données supprimées

2. **UPDATEADD / DELETEUPSERT** : Rollback **impossible** car les lignes existantes ont été modifiées, pas ajoutées

3. **Imports sans RowID** : Si la table n'a pas de colonne RowID, le rollback différé n'est pas possible (fallback vers matching_key si disponible)

4. **Ordre LIFO** : Pour rollback un import ancien, il faut d'abord rollback les imports plus récents sur la même table

---

## 📝 Notes

- Cette mission dépend de la **Mission 012** (colonne RowID et API verify-by-rowid)
- Le `maxRowIdBefore` est déjà capturé pour le test import, on le réutilise
- La rétention automatique des logs (Sprint 5) est optionnelle et peut être faite plus tard

---

## 🔗 Fichiers de référence

| Document | Description |
|----------|-------------|
| `mission-012-verification-rowid.md` | Mission RowID (prérequis) |
| `docs/sql/002-user-zoho-tokens.sql` | Structure Supabase existante |
| `app/(dashboard)/history/page.tsx` | Page historique actuelle (vide) |

---

*Document préparé pour la prochaine session - Mission 013*
*Estimation totale : 4-5 heures*
