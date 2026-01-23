# Différents moyens de récupérer les données importées dans Zoho Analytics

*Documentation technique - CSV to Zoho Importer*
*Date de création : 2026-01-23*
*Dernière mise à jour : 2026-01-23*

---

## Contexte

Cette documentation recense les différentes méthodes testées pour récupérer des données depuis Zoho Analytics, notamment pour :
- Vérifier les lignes importées (post-import verification)
- Récupérer le dernier RowID après un import
- Valider l'intégrité des données

**Table de test** : `QUITTANCES2` (~2M+ lignes)
**Workspace ID** : `1718953000014173074`

---

## Synthèse des méthodes

| Méthode | API Endpoint | Temps typique | Grosses tables (2M+) | Recommandé |
|---------|--------------|---------------|----------------------|------------|
| Bulk Async + WHERE IN | `/bulk/.../data` | 2-3s | ✅ Fonctionne | ✅ OUI |
| Bulk Async + WHERE > | `/bulk/.../data` | 2-3s | ✅ Fonctionne | ✅ OUI |
| Bulk Async + MAX() | `/bulk/.../data` | 2-3s | ✅ Fonctionne | ✅ OUI |
| Data Export Sync | `/views/{id}/data` | Timeout | ❌ Timeout 30s+ | ❌ NON |
| Probe par existence | Multiple calls | 5-10s | ✅ Fonctionne | ⚠️ Limité |

---

## Méthode 1 : API Bulk Async Export (RECOMMANDÉE)

### Description

L'API Bulk Async crée un **job d'export** qui s'exécute en arrière-plan. On poll le statut jusqu'à completion, puis on télécharge les résultats.

### Endpoint

```
GET /restapi/v2/bulk/workspaces/{workspaceId}/data?CONFIG={config}
```

### Configuration

```json
{
  "responseFormat": "csv",  // ou "json"
  "sqlQuery": "SELECT * FROM \"TABLE\" WHERE ..."
}
```

### Codes de statut du job (jobCode)

| Code | Signification | Action |
|------|---------------|--------|
| **1001** | Job en queue (waiting) | Continuer à poller |
| **1002** | Job en cours (running) | Continuer à poller |
| **1003** | Job échoué (failed) | Arrêter, retourner erreur |
| **1004** | Job terminé (completed) | Télécharger les données |

⚠️ **ATTENTION** : Le code peut être retourné en `number` ou `string` selon le contexte. Toujours vérifier les deux :
```typescript
if (jobCode === 1004 || jobCode === '1004') {
  // Job terminé
}
```

### Workflow complet

```
1. Créer le job → GET /bulk/.../data?CONFIG=...
2. Récupérer jobId
3. Poll status → GET /bulk/.../exportjobs/{jobId}
4. Attendre jobCode 1004
5. Télécharger → GET /bulk/.../exportjobs/{jobId}/data
```

### Implémentation (notre code)

**Fichier** : `app/api/zoho/verify-by-rowid/route.ts`

```typescript
async function waitForJobAndDownload(
  apiDomain: string,
  workspaceId: string,
  jobId: string,
  headers: Record<string, string>,
  maxPolls: number = 30,
  pollInterval: number = 1000
): Promise<{ success: boolean; data?: Record<string, string>[]; error?: string }> {

  for (let poll = 1; poll <= maxPolls; poll++) {
    const statusUrl = `${apiDomain}/restapi/v2/bulk/workspaces/${workspaceId}/exportjobs/${jobId}`;
    const statusResponse = await fetch(statusUrl, { method: 'GET', headers });
    const statusData = await statusResponse.json();
    const jobCode = statusData.data?.jobCode;

    // Job terminé - code 1004 (peut être string ou number)
    if (jobCode === 1004 || jobCode === '1004') {
      const downloadUrl = `${apiDomain}/restapi/v2/bulk/workspaces/${workspaceId}/exportjobs/${jobId}/data`;
      const downloadResponse = await fetch(downloadUrl, { method: 'GET', headers });
      const csvText = await downloadResponse.text();
      return { success: true, data: parseZohoCSV(csvText) };
    }

    // Job échoué - code 1003
    if (jobCode === 1003 || jobCode === '1003') {
      return { success: false, error: `Job failed with code ${jobCode}` };
    }

    // Job en cours (1001, 1002) - attendre
    await new Promise(resolve => setTimeout(resolve, pollInterval));
  }

  return { success: false, error: 'Job timeout' };
}
```

---

## Méthode 1a : Récupérer des lignes par valeurs exactes (WHERE IN)

### Cas d'usage
- Vérification post-import : comparer les données envoyées vs stockées
- Récupérer des lignes spécifiques par leur clé

### Requête SQL

```sql
SELECT * FROM "QUITTANCES2" 
WHERE "Numéro Quittance" IN ('092953096C', '092953096B', 'DC13530957') 
LIMIT 10
```

### Test réalisé (2026-01-23)

```javascript
// Console navigateur
fetch('/api/zoho/verify-data?' + new URLSearchParams({
  workspaceId: '1718953000014173074',
  tableName: 'QUITTANCES2',
  matchingColumn: 'RowID',
  matchingValues: JSON.stringify(['3122445']),
  limit: '1'
}))
```

**Résultat** :
- Temps : **3.0 secondes** ✅
- jobCode : 1004 dès le premier poll
- Données récupérées correctement

### Pourquoi ça fonctionne

Zoho optimise les requêtes `WHERE IN` avec un **index lookup** direct, sans scanner toute la table.

---

## Méthode 1b : Récupérer les N dernières lignes (WHERE > ORDER BY)

### Cas d'usage
- Récupérer les lignes ajoutées après un certain RowID
- Vérification des lignes importées

### Requête SQL

```sql
SELECT * FROM "QUITTANCES2" 
WHERE "RowID" > 3122440 
ORDER BY "RowID" ASC 
LIMIT 5
```

### Test réalisé (2026-01-23)

```javascript
fetch('/api/zoho/verify-by-rowid?' + new URLSearchParams({
  workspaceId: '1718953000014173074',
  tableName: 'QUITTANCES2',
  action: 'getAfter',
  minRowId: '3122440',
  limit: '5'
}))
```

**Résultat** :
- Temps : **2.9 secondes** ✅
- 5 lignes récupérées
- MAX RowID calculable côté client

### Pourquoi ça fonctionne

La clause `WHERE RowID > X` avec un `LIMIT` permet à Zoho de ne scanner qu'une petite portion de la table.

---

## Méthode 1c : Récupérer le MAX(RowID) directement

### Cas d'usage
- Connaître le dernier RowID après un import
- Mettre à jour la synchronisation RowID

### Requête SQL

```sql
SELECT MAX("RowID") as max_rowid 
FROM "QUITTANCES2" 
WHERE "RowID" > 3062473
```

### Test réalisé (2026-01-23)

```javascript
fetch('/api/zoho/verify-by-rowid?' + new URLSearchParams({
  workspaceId: '1718953000014173074',
  tableName: 'QUITTANCES2',
  action: 'getMaxAfter',
  minRowId: '3062473'
}))
```

**Résultat** :
- Temps : **2.3 secondes** ✅
- maxRowId : 3122445 (correct)

### Pourquoi ça fonctionne

Avec la clause `WHERE RowID > X`, Zoho ne scanne que les lignes récentes. La fonction `MAX()` sur ce sous-ensemble est rapide.

### ⚠️ ATTENTION : MAX() sans WHERE

```sql
-- ❌ NE PAS FAIRE - Timeout sur grosses tables
SELECT MAX("RowID") FROM "QUITTANCES2"
```

Sans clause `WHERE`, Zoho doit scanner toute la table (~2M lignes) → **timeout**.

---

## Méthode 2 : API Data Export Synchrone (NON RECOMMANDÉE)

### Description

API synchrone qui retourne les données directement dans la réponse HTTP.

### Endpoint

```
GET /restapi/v2/workspaces/{workspaceId}/views/{viewId}/data
```

### Problème sur grosses tables

Cette API **timeout systématiquement** sur les tables volumineuses (>100K lignes) car elle tente de charger toutes les données en mémoire avant de répondre.

### Test réalisé (2026-01-23)

```
[VerifyData] Poll 1 - jobCode: 1001
[VerifyData] Poll 6 - jobCode: 1001
... (60 polls)
504 Gateway Timeout après 73s
```

### Conclusion

❌ **Ne jamais utiliser** pour les grosses tables. Utiliser l'API Bulk Async à la place.

---

## Méthode 3 : Probe par existence de RowID

### Description

Technique de "sondage" : on teste si un RowID existe, puis on monte ou descend pour trouver la bordure.

### Cas d'usage
- Vérification pré-import : s'assurer qu'on connaît le dernier RowID
- Détecter les écarts de synchronisation

### Algorithme

```
1. Tester si RowID estimé existe
2. Si oui → monter jusqu'à trouver le premier absent
3. Si non → descendre jusqu'à trouver le premier présent
```

### Implémentation

**Fichier** : `lib/domain/rowid-sync/probe-service.ts`

```typescript
export async function probeForMaxRowId(params: ProbeParams): Promise<RowIdProbeResult> {
  const { workspaceId, tableName, estimatedRowId, tolerance = 5 } = params;

  // Tester si l'estimé existe
  const estimatedExists = await checkRowIdExists(workspaceId, tableName, estimatedRowId);

  if (estimatedExists) {
    // Monter jusqu'à trouver le premier absent
    for (let i = 1; i <= tolerance; i++) {
      const exists = await checkRowIdExists(workspaceId, tableName, estimatedRowId + i);
      if (!exists) {
        return { success: true, maxRowId: estimatedRowId + i - 1 };
      }
    }
  } else {
    // Descendre jusqu'à trouver le premier présent
    for (let i = 1; i <= tolerance; i++) {
      const exists = await checkRowIdExists(workspaceId, tableName, estimatedRowId - i);
      if (exists) {
        return { success: true, maxRowId: estimatedRowId - i };
      }
    }
  }

  return { success: false, needsResync: true };
}
```

### Limitations

- **Tolérance limitée** : Si l'écart est > 5 RowID, demande une resync manuelle
- **Nombre d'appels API** : 1 appel par RowID testé (peut être lent si beaucoup de tests)
- **Ne fonctionne pas** pour trouver le MAX absolu après un import avec "trous"

### Quand l'utiliser

✅ Vérification pré-import (écarts faibles attendus)
❌ Post-import (les "trous" dans les RowID rendent le probe inefficace)

---

## Problème des "trous" dans les RowID Zoho

### Constat

Zoho Analytics n'utilise **pas une séquence continue** pour les RowID. Pour un import de N lignes, Zoho peut "consommer" N × 1.6 RowID.

### Données mesurées (Novembre 2025)

| Métrique | Valeur |
|----------|--------|
| Lignes importées | 37 635 |
| min_rowid | 3 062 474 |
| max_rowid | 3 122 445 |
| Plage utilisée | 59 972 |
| Ratio trous | **59.4%** |

### Formule estimée

```
rowIdAfter ≈ rowIdBefore + (rowsImported × 1.6)
```

⚠️ Cette formule est une **estimation**. Pour connaître le vrai MAX, il faut interroger Zoho avec `SELECT MAX(RowID) WHERE RowID > rowIdBefore`.

### Impact sur le rollback

Le rollback utilise :
```sql
DELETE FROM table WHERE RowID > rowIdBefore AND RowID <= rowIdAfter
```

Si `rowIdAfter` est sous-estimé, certaines lignes ne seront pas supprimées. C'est pourquoi il est **crucial** de récupérer le vrai MAX après l'import.

---

## Recommandations

### Pour la vérification post-import

1. **Utiliser `getMaxAfter`** après chaque import pour obtenir le vrai MAX(RowID)
2. **Stocker le vrai MAX** dans `import_logs.row_id_after`
3. **Ne jamais calculer** `row_id_after = row_id_before + rows_imported` (incorrect à cause des trous)

### Pour récupérer des lignes spécifiques

1. **Préférer WHERE IN** avec les clés métier (Numéro Quittance, etc.)
2. **Limiter les résultats** avec `LIMIT` pour éviter les timeouts

### Pour le sondage pré-import

1. **Utiliser le probe** avec tolérance de 5 RowID
2. **Demander resync manuelle** si l'écart est trop grand

---

## Tests de référence

### Configuration des tests

- **Date** : 2026-01-23
- **Table** : QUITTANCES2 (~2M+ lignes)
- **Environnement** : localhost:3000

### Résultats

| Test | Méthode | SQL | Temps | Statut |
|------|---------|-----|-------|--------|
| 1 | verify-data WHERE IN | `WHERE "RowID" IN ('3122445')` | 3.0s | ✅ |
| 2 | verify-data WHERE IN (absent) | `WHERE "RowID" IN ('3033755')` | 73s | ❌ Timeout |
| 3 | verify-by-rowid getAfter | `WHERE "RowID" > 3122440 LIMIT 5` | 2.9s | ✅ |
| 4 | verify-by-rowid getMaxAfter | `SELECT MAX("RowID") WHERE "RowID" > 3062473` | 2.3s | ✅ |

### Observations

1. Les requêtes avec **valeurs existantes** sont rapides (~3s)
2. Les requêtes avec **valeurs inexistantes** peuvent timeout (Zoho semble faire un full scan)
3. Les requêtes avec **WHERE >** et **LIMIT** sont toujours rapides
4. **MAX()** fonctionne si filtré avec **WHERE >**

---

## Historique des bugs corrigés

### Bug 1 : Mauvais jobCode (2026-01-23)

**Symptôme** : L'API `verify-by-rowid` retournait timeout après 30 polls alors que le job était terminé.

**Cause** : Le code vérifiait `jobCode === 3010` alors que Zoho retourne `jobCode: 1004`.

**Fix** :
```typescript
// Avant (incorrect)
if (jobCode === 3010) { ... }

// Après (correct)
if (jobCode === 1004 || jobCode === '1004') { ... }
```

**Fichier** : `app/api/zoho/verify-by-rowid/route.ts`

---

## Fichiers de référence

| Fichier | Description |
|---------|-------------|
| `app/api/zoho/verify-data/route.ts` | API pour vérification par clé métier |
| `app/api/zoho/verify-by-rowid/route.ts` | API pour vérification par RowID |
| `lib/domain/rowid-sync/probe-service.ts` | Service de sondage RowID |
| `lib/domain/rowid-sync/sync-service.ts` | Service de synchronisation |

---

*Document maintenu par l'équipe CSV to Zoho Importer*
