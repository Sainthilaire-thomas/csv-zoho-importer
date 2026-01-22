# Mission 013 : Historique des Imports & Rollback Différé

*Date de création : 2026-01-22*
*Mise à jour : 2026-01-22 (v2 - Analyse détaillée des modes)*
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
2. **Annuler un import** à posteriori (rollback différé) - quand c'est possible
3. **Comprendre comment corriger** une erreur d'import selon le mode utilisé
4. **Tracer les opérations** pour audit/debug

### Opportunité Mission 012

Grâce à la colonne **RowID** ajoutée dans Mission 012, on peut maintenant :
- Capturer `MAX(RowID)` avant et après chaque import
- Supprimer précisément les lignes importées avec `WHERE "RowID" > X AND "RowID" <= Y`

---

## 📊 Analyse détaillée des modes d'import Zoho

### Comportement de chaque mode

| Mode | Action Zoho | Clé requise |
|------|-------------|-------------|
| **APPEND** | Ajoute toutes les lignes à la fin | Non |
| **TRUNCATEADD** | Vide la table ENTIÈREMENT, puis ajoute les lignes | Non |
| **UPDATEADD** | Si clé existe → met à jour, sinon → ajoute | Oui |
| **DELETEUPSERT** | Supprime les lignes absentes du fichier, puis UPDATEADD | Oui |
| **ONLYADD** | Ajoute uniquement les lignes dont la clé n'existe pas | Oui |

---

### 1️⃣ APPEND - Ajout simple ✅

```
Table avant:     [A, B, C]
Fichier:         [D, E]
Table après:     [A, B, C, D, E]  ← D et E ont de nouveaux RowID
```

| Aspect | Valeur |
|--------|--------|
| Rollback auto | ✅ **OUI** - `DELETE WHERE RowID > X` |
| Cas d'usage | Import mensuel de nouvelles données |
| En cas d'erreur | Rollback auto, puis réimporter le fichier du mois corrigé |
| Difficulté correction | 🟢 **Facile** |

---

### 2️⃣ ONLYADD - Ajout des nouveaux uniquement ✅

```
Table avant:     [A, B, C]     (clés: 1, 2, 3)
Fichier:         [B, D, E]     (clés: 2, 4, 5)
Table après:     [A, B, C, D, E]  ← Seuls D et E ajoutés (B ignoré car existe)
```

| Aspect | Valeur |
|--------|--------|
| Rollback auto | ✅ **OUI** - `DELETE WHERE RowID > X` |
| Cas d'usage | Import de nouvelles entrées sans doublon |
| En cas d'erreur | Rollback auto, puis réimporter le fichier corrigé |
| Difficulté correction | 🟢 **Facile** |

---

### 3️⃣ UPDATEADD - Mise à jour + Ajout ⚠️

```
Table avant:     [A=100, B=200, C=300]     (clés: 1, 2, 3)
Fichier:         [A=150, D=400]            (clés: 1, 4)
Table après:     [A=150, B=200, C=300, D=400]
                  ↑ MODIFIÉ              ↑ AJOUTÉ
```

| Aspect | Valeur |
|--------|--------|
| Rollback auto | ❌ **NON** - Les valeurs modifiées sont perdues |
| Cas d'usage | Corrections mensuelles + nouvelles données |
| En cas d'erreur | Réimporter **le fichier du mois** avec les valeurs correctes |
| Difficulté correction | 🟢 **Facile** - UPDATEADD va re-corriger les valeurs |

**Explication** : Si on importe un fichier avec `A=150` par erreur (devait être `A=120`), il suffit de réimporter avec `A=120`. UPDATEADD va mettre à jour la valeur.

---

### 4️⃣ TRUNCATEADD - Remplacement complet 🔴

```
Table avant:     [A, B, C, D, E, F, G, H]  ← 8 lignes existantes (historique)
                  ↓ TRUNCATE (tout supprimé)
Table vide:      []
                  ↓ ADD
Table après:     [X, Y, Z]  ← 3 nouvelles lignes du fichier
```

| Aspect | Valeur |
|--------|--------|
| Rollback auto | ❌ **NON** - Les données originales sont PERDUES |
| Cas d'usage | Table de référence (ex: liste agents actifs) |
| En cas d'erreur | Réimporter **la TABLE COMPLÈTE** (tout l'historique) |
| Difficulté correction | 🔴 **Difficile** - Nécessite le fichier source complet |

**⚠️ Attention** : Ce mode supprime TOUT avant d'importer. Si le fichier importé est incomplet, les données manquantes sont définitivement perdues.

---

### 5️⃣ DELETEUPSERT - Synchronisation totale 🔴

```
Table avant:     [A, B, C, D, E]     (clés: 1, 2, 3, 4, 5)
Fichier:         [A', C']            (clés: 1, 3) - valeurs modifiées
Table après:     [A', C']            ← B, D, E SUPPRIMÉS + A, C MODIFIÉS
```

| Aspect | Valeur |
|--------|--------|
| Rollback auto | ❌ **NON** - Données supprimées ET modifiées |
| Cas d'usage | Synchronisation complète (fichier = source de vérité) |
| En cas d'erreur | Réimporter **la TABLE COMPLÈTE** (tout l'historique) |
| Difficulté correction | 🔴 **Très difficile** - Données supprimées irrécupérables |

**⚠️ Mode le plus destructif** : Les lignes absentes du fichier sont supprimées de la table. Si le fichier source était incomplet par erreur, ces données sont perdues définitivement.

---

## 🎯 Règles métier : Rollback par mode

### Tableau récapitulatif

| Mode | Bouton "Annuler" | Message à afficher | Icône |
|------|------------------|-------------------|-------|
| `append` | ✅ Actif | - | - |
| `onlyadd` | ✅ Actif | - | - |
| `updateadd` | ❌ Masqué | "Pour corriger, réimportez le fichier du mois avec les valeurs correctes." | ℹ️ Info |
| `truncateadd` | ❌ Masqué | "Pour corriger, vous devez réimporter la TABLE COMPLÈTE (tout l'historique)." | ⚠️ Warning |
| `deleteupsert` | ❌ Masqué | "Pour corriger, vous devez réimporter la TABLE COMPLÈTE. Les lignes supprimées ne peuvent pas être récupérées." | 🔴 Error |

### Code TypeScript pour les règles

```typescript
type ImportMode = 'append' | 'truncateadd' | 'updateadd' | 'deleteupsert' | 'onlyadd';

interface RollbackInfo {
  canRollback: boolean;
  message: string | null;
  severity: 'info' | 'warning' | 'error' | null;
  correctionMethod: 'rollback' | 'reimport_month' | 'reimport_full';
}

const getRollbackInfo = (mode: ImportMode): RollbackInfo => {
  switch (mode) {
    case 'append':
    case 'onlyadd':
      return {
        canRollback: true,
        message: null,
        severity: null,
        correctionMethod: 'rollback',
      };
    
    case 'updateadd':
      return {
        canRollback: false,
        message: "Pour corriger, réimportez le fichier du mois avec les valeurs correctes.",
        severity: 'info',
        correctionMethod: 'reimport_month',
      };
    
    case 'truncateadd':
      return {
        canRollback: false,
        message: "Pour corriger, vous devez réimporter la TABLE COMPLÈTE (tout l'historique).",
        severity: 'warning',
        correctionMethod: 'reimport_full',
      };
    
    case 'deleteupsert':
      return {
        canRollback: false,
        message: "Pour corriger, vous devez réimporter la TABLE COMPLÈTE. Les lignes supprimées ne peuvent pas être récupérées.",
        severity: 'error',
        correctionMethod: 'reimport_full',
      };
  }
};
```

---

## 🎯 Objectifs Mission 013

1. **Logger automatiquement** chaque import réussi avec les infos de rollback
2. **Enrichir la page Historique** avec la liste des imports
3. **Permettre le rollback différé** depuis l'historique (modes `append` et `onlyadd` uniquement)
4. **Afficher les instructions de correction** adaptées à chaque mode
5. **Gérer les contraintes** (ordre LIFO pour les rollbacks)

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

### Sprint 2 : Types et utilitaires rollback

**Fichiers** :
- `types/imports.ts` - Types TypeScript
- `lib/domain/history/rollback-rules.ts` - Règles par mode d'import

**Contenu `rollback-rules.ts`** :
```typescript
export type ImportMode = 'append' | 'truncateadd' | 'updateadd' | 'deleteupsert' | 'onlyadd';

export interface RollbackInfo {
  canRollback: boolean;
  message: string | null;
  severity: 'info' | 'warning' | 'error' | null;
  correctionMethod: 'rollback' | 'reimport_month' | 'reimport_full';
}

export const getRollbackInfo = (mode: ImportMode): RollbackInfo => {
  // ... (code ci-dessus)
};

export const ROLLBACKABLE_MODES: ImportMode[] = ['append', 'onlyadd'];

export const isRollbackable = (mode: ImportMode): boolean => {
  return ROLLBACKABLE_MODES.includes(mode);
};
```

**Estimation** : 20 min

---

### Sprint 3 : API CRUD imports

**Fichiers** :
- `app/api/imports/route.ts` - GET (liste) + POST (créer)
- `app/api/imports/[id]/route.ts` - GET (détail) + DELETE (supprimer log)
- `app/api/imports/[id]/rollback/route.ts` - POST (exécuter rollback)

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
// Vérifications côté serveur :
// 1. Mode rollbackable ? (append ou onlyadd uniquement)
// 2. Pas d'import plus récent sur cette table ? (LIFO)
// 3. Pas déjà rollback ?

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

### Sprint 4 : Intégration dans le wizard

**Fichier** : `components/import/wizard/import-wizard.tsx`

**Modifications** :

1. **Capturer `maxRowIdBefore`** - Déjà fait pour le test, réutiliser
2. **Capturer `maxRowIdAfter`** après le dernier chunk
3. **Logger l'import** après succès

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
    rowIdBefore: maxRowIdBeforeTestRef.current,
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

### Sprint 5 : Page Historique enrichie

**Fichier** : `app/(dashboard)/history/page.tsx`

**UI proposée** :

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  📋 Historique des imports                                    [🔍 Filtrer]  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ 📄 QUITTANCES_05_2025.xlsx                              22/01 07:45 │   │
│  │ QUITTANCES • 61 317 lignes • 26s • Mode: APPEND                     │   │
│  │ ✅ Actif                                         [🗑️ Annuler import] │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ 📄 QUITTANCES_04_corrections.xlsx                       21/01 14:30 │   │
│  │ QUITTANCES • 2 450 lignes • 3s • Mode: UPDATEADD                    │   │
│  │ ✅ Actif                                                            │   │
│  │ ℹ️ Pour corriger : réimportez le fichier du mois corrigé            │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ 📄 Agents_SC_2025.csv                                   20/01 09:15 │   │
│  │ Agents_SC • 245 lignes • 2s • Mode: TRUNCATEADD                     │   │
│  │ ✅ Actif                                                            │   │
│  │ ⚠️ Pour corriger : réimportez la TABLE COMPLÈTE (historique)        │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ 📄 Stock_sync.xlsx                                      19/01 16:00 │   │
│  │ Stock • 1 200 lignes • 5s • Mode: DELETEUPSERT                      │   │
│  │ ✅ Actif                                                            │   │
│  │ 🔴 Pour corriger : réimportez la TABLE COMPLÈTE.                    │   │
│  │    Les lignes supprimées ne peuvent pas être récupérées.            │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ 📄 QUITTANCES_03_2025.xlsx                              18/01 10:00 │   │
│  │ QUITTANCES • 55 000 lignes • 22s • Mode: APPEND                     │   │
│  │ 🔄 Annulé le 18/01 11:30                                            │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│                        [Charger plus...]                                    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Composants** :
- `components/history/import-list.tsx` - Liste des imports
- `components/history/import-card.tsx` - Carte d'un import (avec message adapté au mode)
- `components/history/rollback-dialog.tsx` - Modal de confirmation

**Estimation** : 1h30

---

### Sprint 6 : Contraintes LIFO

**Règle** : On ne peut rollback que le dernier import actif d'une table

```typescript
// Dans POST /api/imports/[id]/rollback
const newerImports = await supabase
  .from('import_history')
  .select('id, file_name, created_at')
  .eq('view_id', importToRollback.view_id)
  .eq('rolled_back', false)
  .gt('created_at', importToRollback.created_at)
  .order('created_at', { ascending: false });

if (newerImports.data && newerImports.data.length > 0) {
  return NextResponse.json({
    error: `Vous devez d'abord annuler l'import "${newerImports.data[0].file_name}" du ${formatDate(newerImports.data[0].created_at)}`,
    newerImports: newerImports.data,
  }, { status: 400 });
}
```

**Estimation** : 30 min

---

## 📁 Fichiers à créer/modifier

| Fichier | Action | Sprint |
|---------|--------|--------|
| `docs/sql/003-import-history-migration.sql` | Créer | 1 |
| `types/imports.ts` | Créer | 2 |
| `lib/domain/history/rollback-rules.ts` | Créer | 2 |
| `app/api/imports/route.ts` | Créer | 3 |
| `app/api/imports/[id]/route.ts` | Créer | 3 |
| `app/api/imports/[id]/rollback/route.ts` | Créer | 3 |
| `components/import/wizard/import-wizard.tsx` | Modifier | 4 |
| `app/(dashboard)/history/page.tsx` | Modifier | 5 |
| `components/history/import-list.tsx` | Créer | 5 |
| `components/history/import-card.tsx` | Créer | 5 |
| `components/history/rollback-dialog.tsx` | Créer | 5 |

---

## 🧪 Tests à effectuer

### Test 1 : Vérifier le logging
1. Importer un fichier en mode APPEND
2. Vérifier dans Supabase que le log est créé avec `row_id_before` et `row_id_after`

### Test 2 : Vérifier la page Historique
1. Ouvrir `/history`
2. Vérifier que les imports apparaissent
3. Vérifier les messages adaptés à chaque mode

### Test 3 : Tester le rollback (APPEND)
1. Importer un petit fichier (10 lignes) en mode APPEND
2. Aller dans l'historique
3. Cliquer sur "Annuler import"
4. Confirmer
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
│     └─► POST /api/imports { rowIdBefore, rowIdAfter, importMode, ... }     │
│                                                                             │
│  5. Afficher succès                                                         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                           PAGE HISTORIQUE                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. Chargement des imports                                                  │
│     └─► GET /api/imports?limit=20                                          │
│                                                                             │
│  2. Pour chaque import, déterminer l'affichage :                           │
│     ├─► Mode append/onlyadd → Bouton "Annuler import" visible              │
│     ├─► Mode updateadd → Message ℹ️ "Réimportez le fichier du mois"        │
│     ├─► Mode truncateadd → Message ⚠️ "Réimportez la table complète"       │
│     └─► Mode deleteupsert → Message 🔴 "Réimportez + données perdues"      │
│                                                                             │
│  3. Si rollback demandé :                                                   │
│     ├─► Vérifier mode rollbackable (append/onlyadd)                        │
│     ├─► Vérifier pas d'import plus récent (LIFO)                           │
│     ├─► Demander confirmation                                               │
│     └─► Exécuter DELETE WHERE RowID > before AND RowID <= after            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## ⚠️ Limitations et avertissements

### Par mode d'import

| Mode | Limitation | Avertissement utilisateur |
|------|------------|--------------------------|
| **APPEND** | Aucune | - |
| **ONLYADD** | Aucune | - |
| **UPDATEADD** | Valeurs modifiées non restaurables | "Réimportez le fichier du mois avec les valeurs correctes" |
| **TRUNCATEADD** | Données originales supprimées | "Réimportez la TABLE COMPLÈTE (tout l'historique)" |
| **DELETEUPSERT** | Données supprimées + modifiées | "Réimportez la TABLE COMPLÈTE. Données supprimées irrécupérables" |

### Autres limitations

1. **Imports sans RowID** : Si la table n'a pas de colonne RowID, le rollback différé n'est pas possible
2. **Ordre LIFO** : Pour rollback un import ancien, il faut d'abord rollback les imports plus récents sur la même table
3. **Pas de restauration** : Le rollback supprime les lignes ajoutées mais ne restaure jamais les données modifiées ou supprimées

---

## 📝 Notes

- Cette mission dépend de la **Mission 012** (colonne RowID et API verify-by-rowid)
- Le `maxRowIdBefore` est déjà capturé pour le test import, on le réutilise
- Les messages de correction sont adaptés à chaque mode pour guider l'utilisateur

---

## 🔗 Fichiers de référence

| Document | Description |
|----------|-------------|
| `mission-012-verification-rowid.md` | Mission RowID (prérequis) |
| `docs/sql/002-user-zoho-tokens.sql` | Structure Supabase existante |
| `app/(dashboard)/history/page.tsx` | Page historique actuelle (vide) |
| `lib/domain/rollback/rollback-service.ts` | Service rollback existant (réutilisable) |

---

## 📊 Code existant réutilisable

Le service de rollback de la Mission 012 supporte déjà la stratégie `rowid_range` :

```typescript
// lib/domain/rollback/rollback-service.ts
executeRollback({
  workspaceId,
  viewId,
  tableName,
  rowIdRange: { min: rowIdBefore, max: rowIdAfter },
  reason: 'user_cancelled',
});
```

L'API DELETE existante (`/api/zoho/delete`) gère déjà cette stratégie :
```typescript
// Critère généré : "RowID" > 1234567 AND "RowID" <= 1295884
```

---

*Document préparé pour la Mission 013*
*Estimation totale : 4-5 heures*
*Version : 2.0 - Analyse détaillée des modes d'import*
