
# Mission 012 : Optimisation Vérification Post-Import avec RowID

*Date de création : 2026-01-21*
*Statut : À DÉMARRER*

---

## 📋 Contexte du problème

### Symptôme

L'import de fichiers CSV vers la table QUITTANCES2 (2 millions de lignes) échoue à l'étape de **vérification post-import** :

```
[VerifyData] Poll 56 - jobCode: 1001
GET /api/zoho/verify-data ... 504 in 73s (timeout)

=== ZOHO API ERROR ===
Status: 400
Response: {"status":"failure","summary":"SYNC_EXPORT_NOT_ALLOWED"...}
```

### Cause racine

La méthode actuelle de vérification utilise une requête SQL avec `WHERE "Numéro Quittance" IN (...)` qui :

1. **Bulk API async** : Timeout après 60s+ car Zoho scanne toute la table (2M lignes) avant de filtrer
2. **Sync API** : Refusée par Zoho (`SYNC_EXPORT_NOT_ALLOWED` sur grosses tables)

### Solution identifiée

Ajouter une colonne **"RowID" de type "Numérotation automatique"** dans Zoho Analytics, puis utiliser `ORDER BY RowID DESC` pour retrouver les dernières lignes importées.

---

## 🎯 Objectif de la mission

Modifier le système de vérification post-import pour :

1. Utiliser **RowID** pour les modes APPEND/TRUNCATEADD/ONLYADD (pas de clé de matching)
2. Utiliser la **clé de matching du profil** pour les modes UPDATEADD/DELETEUPSERT (clé obligatoire et indexée)

---

## ✅ Prérequis (À FAIRE MANUELLEMENT dans Zoho)

### Ajouter la colonne RowID dans QUITTANCES2

1. Ouvrir la table QUITTANCES2 dans Zoho Analytics
2. Cliquer sur **"Ajouter"** → **"Ajouter une colonne"**
3. Configurer :
   * **Nom de la colonne** : `RowID`
   * **Type de données** : `Numérotation automatique`
4. Cliquer **OK** puis **Enregistrer**

⚠️ Cette opération peut prendre quelques minutes (2M lignes à numéroter).

### Vérifier que la colonne est créée

```sql
SELECT "RowID" FROM "QUITTANCES2" ORDER BY "RowID" DESC LIMIT 5
```

---

## 📊 Stratégie de vérification par mode d'import

| Mode                   | Clé obligatoire ? | Stratégie       | Requête SQL                        |
| ---------------------- | ------------------ | ---------------- | ----------------------------------- |
| **APPEND**       | ❌ Non             | RowID            | `WHERE "RowID" > {maxAvant}`      |
| **TRUNCATEADD**  | ❌ Non             | RowID            | `ORDER BY "RowID" DESC LIMIT {n}` |
| **ONLYADD**      | ✅ Oui             | RowID            | `WHERE "RowID" > {maxAvant}`      |
| **UPDATEADD**    | ✅ Oui             | Clé de matching | `WHERE "{matchingCol}" IN (...)`  |
| **DELETEUPSERT** | ✅ Oui             | Clé de matching | `WHERE "{matchingCol}" IN (...)`  |

---

## 🔧 Sprint de développement

### Sprint 1 : Nouvelle API `/api/zoho/verify-by-rowid`

**Fichier** : `app/api/zoho/verify-by-rowid/route.ts`

**Fonctionnalités** :

* `GET ?workspaceId=X&tableName=Y&action=getMax` → Retourne `MAX(RowID)`
* `GET ?workspaceId=X&tableName=Y&action=getAfter&minRowId=Z` → Retourne lignes avec `RowID > Z`

**Code à créer** :

```typescript
/**
 * @file app/api/zoho/verify-by-rowid/route.ts
 * @description Récupère les données pour vérification via RowID (optimisé grosses tables)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/infrastructure/supabase/server';
import { getTokens } from '@/lib/infrastructure/zoho/auth';

function convertToAnalyticsDomain(apiDomain: string): string {
  if (apiDomain.includes('analyticsapi')) {
    return apiDomain.startsWith('https://') ? apiDomain : `https://${apiDomain}`;
  }
  const match = apiDomain.match(/zohoapis\.(\w+)/);
  const region = match ? match[1] : 'eu';
  return `https://analyticsapi.zoho.${region}`;
}

export async function GET(request: NextRequest) {
  try {
    // 1. Auth
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const tokens = await getTokens(user.id);
    if (!tokens) {
      return NextResponse.json({ error: 'Non connecté à Zoho' }, { status: 401 });
    }

    // 2. Params
    const searchParams = request.nextUrl.searchParams;
    const workspaceId = searchParams.get('workspaceId');
    const tableName = searchParams.get('tableName');
    const action = searchParams.get('action'); // 'getMax' | 'getAfter' | 'getLatest'
    const minRowId = searchParams.get('minRowId');
    const limit = searchParams.get('limit') || '10';

    if (!workspaceId || !tableName || !action) {
      return NextResponse.json(
        { error: 'Paramètres manquants: workspaceId, tableName et action requis' },
        { status: 400 }
      );
    }

    const apiDomain = convertToAnalyticsDomain(tokens.apiDomain);
    const headers = {
      'Authorization': `Zoho-oauthtoken ${tokens.accessToken}`,
      'ZANALYTICS-ORGID': tokens.orgId || '',
    };

    // 3. Construire la requête SQL selon l'action
    let sqlQuery: string;

    switch (action) {
      case 'getMax':
        // Récupérer le MAX(RowID) actuel
        sqlQuery = `SELECT MAX("RowID") as maxRowId FROM "${tableName}"`;
        break;
    
      case 'getAfter':
        // Récupérer les lignes après un certain RowID
        if (!minRowId) {
          return NextResponse.json({ error: 'minRowId requis pour action getAfter' }, { status: 400 });
        }
        sqlQuery = `SELECT * FROM "${tableName}" WHERE "RowID" > ${minRowId} ORDER BY "RowID" ASC LIMIT ${limit}`;
        break;
    
      case 'getLatest':
        // Récupérer les N dernières lignes
        sqlQuery = `SELECT * FROM "${tableName}" ORDER BY "RowID" DESC LIMIT ${limit}`;
        break;
    
      default:
        return NextResponse.json({ error: 'Action invalide' }, { status: 400 });
    }

    console.log('[VerifyByRowID] SQL Query:', sqlQuery);

    // 4. Exécuter la requête (API sync - devrait être rapide car RowID est indexé)
    const config = {
      responseFormat: 'json',
      sqlQuery: sqlQuery,
    };
    const configEncoded = encodeURIComponent(JSON.stringify(config));
    const url = `${apiDomain}/restapi/v2/workspaces/${workspaceId}/data?CONFIG=${configEncoded}`;

    const response = await fetch(url, { method: 'GET', headers });
    const responseText = await response.text();

    let data;
    try {
      data = JSON.parse(responseText);
    } catch {
      console.error('[VerifyByRowID] Non-JSON response:', responseText.substring(0, 500));
      return NextResponse.json({ success: false, error: 'Réponse non-JSON' }, { status: 500 });
    }

    // 5. Vérifier erreurs Zoho
    if (data.status === 'failure') {
      console.error('[VerifyByRowID] Zoho error:', data);
      return NextResponse.json({
        success: false,
        error: data.data?.errorMessage || data.summary || 'Erreur Zoho',
      }, { status: response.status });
    }

    // 6. Retourner les données
    const rows = data.data || [];
    console.log('[VerifyByRowID] Success -', action, '- got', rows.length, 'rows');

    return NextResponse.json({
      success: true,
      action,
      data: rows,
      rowCount: rows.length,
    });

  } catch (error) {
    console.error('[VerifyByRowID] Exception:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Erreur inconnue',
    }, { status: 500 });
  }
}
```

---

### Sprint 2 : Modifier `VerificationConfig` (types.ts)

**Fichier** : `lib/domain/verification/types.ts`

**Modifications** :

```typescript
export interface VerificationConfig {
  /** Mode d'import utilisé */
  mode: ImportMode;
  /** Colonne utilisée pour le matching (obligatoire en mode updateadd) */
  matchingColumn?: string;
  /** Nombre de lignes à vérifier */
  sampleSize: number;
  /** ID du workspace Zoho */
  workspaceId: string;
  /** ID de la vue/table Zoho */
  viewId: string;
  /** Nom de la table (pour requêtes SQL) */
  tableName?: string;  // ← NOUVEAU
  /** Délai avant lecture (ms) pour laisser Zoho indexer */
  delayBeforeRead?: number;
  /** RowID max avant import (pour stratégie RowID) */
  maxRowIdBeforeImport?: number;  // ← NOUVEAU
  /** Stratégie de vérification à utiliser */
  verificationStrategy?: 'rowid' | 'matching_key';  // ← NOUVEAU
}
```

---

### Sprint 3 : Modifier `compare.ts` (logique principale)

**Fichier** : `lib/domain/verification/compare.ts`

**Modifications principales** :

```typescript
// ==================== NOUVELLE FONCTION ====================

/**
 * Détermine la stratégie de vérification selon le mode d'import
 */
function getVerificationStrategy(mode: ImportMode, matchingColumn?: string): 'rowid' | 'matching_key' {
  // Modes UPDATE nécessitent une clé de matching (qui est indexée)
  if ((mode === 'updateadd' || mode === 'deleteupsert') && matchingColumn) {
    return 'matching_key';
  }
  // Autres modes : utiliser RowID
  return 'rowid';
}

/**
 * Récupère les lignes depuis Zoho pour comparaison
 * NOUVELLE VERSION avec support RowID
 */
async function fetchRowsFromZoho(
  sentRows: SentRow[],
  config: VerificationConfig,
  matchingColumn: string | undefined
): Promise<Record<string, unknown>[]> {
  
  const strategy = config.verificationStrategy || 
    getVerificationStrategy(config.mode, matchingColumn);
  
  console.log('[Verification] Strategy:', strategy);

  // STRATÉGIE ROWID (pour APPEND, TRUNCATEADD, ONLYADD)
  if (strategy === 'rowid' && config.maxRowIdBeforeImport !== undefined && config.tableName) {
    console.log('[Verification] Using RowID strategy, maxRowId:', config.maxRowIdBeforeImport);
  
    const params = new URLSearchParams({
      workspaceId: config.workspaceId,
      tableName: config.tableName,
      action: 'getAfter',
      minRowId: String(config.maxRowIdBeforeImport),
      limit: String(config.sampleSize * 2),
    });

    const response = await fetch(`/api/zoho/verify-by-rowid?${params.toString()}`);
    const result = await response.json();

    if (response.ok && result.success) {
      console.log('[Verification] RowID strategy returned', result.rowCount, 'rows');
      return result.data || [];
    }

    console.warn('[Verification] RowID strategy failed:', result.error);
    // Fallback vers matching_key si RowID échoue
  }

  // STRATÉGIE MATCHING KEY (pour UPDATEADD, DELETEUPSERT ou fallback)
  if (!matchingColumn) {
    console.warn('[Verification] No matching column, cannot verify');
    return [];
  }

  // ... (code existant pour matching_key)
}
```

---

### Sprint 4 : Modifier `import-wizard.tsx`

**Fichier** : `components/import/wizard/import-wizard.tsx`

**Modifications** :

1. **Avant l'import test** : Récupérer `MAX(RowID)`
2. **Passer `maxRowIdBeforeImport`** à `verifyImport()`

```typescript
// Dans executeTestImport, AVANT l'appel API d'import :

// Récupérer le MAX(RowID) actuel (pour stratégie de vérification)
let maxRowIdBeforeImport: number | undefined;
const tableName = /* récupérer le nom de la table */;

if (tableName) {
  try {
    const maxResponse = await fetch(
      `/api/zoho/verify-by-rowid?workspaceId=${selectedWorkspaceId}&tableName=${tableName}&action=getMax`
    );
    const maxResult = await maxResponse.json();
    if (maxResult.success && maxResult.data?.[0]?.maxRowId) {
      maxRowIdBeforeImport = Number(maxResult.data[0].maxRowId);
      console.log('[TestImport] Max RowID before import:', maxRowIdBeforeImport);
    }
  } catch (e) {
    console.warn('[TestImport] Could not get max RowID:', e);
  }
}

// ... faire l'import ...

// Dans executeTestVerification, passer le maxRowIdBeforeImport :
const verificationResult = await verifyImport(sampleToVerify, {
  mode: state.config.importMode,
  matchingColumn: verificationColumn || undefined,
  sampleSize: sampleToVerify.length,
  workspaceId: selectedWorkspaceId,
  viewId: state.config.tableId,
  tableName: tableName,  // ← NOUVEAU
  maxRowIdBeforeImport: maxRowIdBeforeImport,  // ← NOUVEAU
  delayBeforeRead: 2000,
});
```

---

## 📁 Fichiers à modifier

| Fichier                                        | Action           | Description                                                             |
| ---------------------------------------------- | ---------------- | ----------------------------------------------------------------------- |
| `app/api/zoho/verify-by-rowid/route.ts`      | **CRÉER** | Nouvelle API pour vérification par RowID                               |
| `lib/domain/verification/types.ts`           | Modifier         | Ajouter `tableName`,`maxRowIdBeforeImport`,`verificationStrategy` |
| `lib/domain/verification/compare.ts`         | Modifier         | Nouvelle logique avec stratégie RowID/matching_key                     |
| `components/import/wizard/import-wizard.tsx` | Modifier         | Récupérer MAX(RowID) avant import, passer au verifyImport             |

---

---

## 🔴 AUDIT : Impact sur le Rollback

### Problème identifié

Le rollback actuel repose **entièrement** sur `matchingColumn` et `matchingValues` :

```typescript
// rollback-service.ts - Code actuel
const result = await executeRollback({
  workspaceId: config.workspaceId,
  viewId: config.viewId,
  matchingColumn: column,        // ← Obligatoire actuellement
  matchingValues: values,        // ← Obligatoire actuellement
  reason: 'user_cancelled',
});

// API delete - Critère SQL
const criteria = `"${matchingColumn}" IN ('val1', 'val2', ...)`;
```

**Avec la stratégie RowID** : On n'a plus les `matchingValues` métier, on a les `RowID` !

### Solution : Support dual pour le rollback

| Stratégie vérification | Données disponibles                  | Critère de suppression                |
| ------------------------ | ------------------------------------- | -------------------------------------- |
| **matching_key**   | matchingColumn + matchingValues       | `WHERE "Numéro Quittance" IN (...)` |
| **rowid**          | minRowId + maxRowId (ou liste RowIDs) | `WHERE "RowID" > {minRowId}`         |

---

### Sprint 5 : Modifier les types de rollback

**Fichier** : `lib/domain/rollback/types.ts`

```typescript
export interface RollbackConfig {
  workspaceId: string;
  viewId: string;
  tableName?: string;  // ← NOUVEAU (pour requêtes SQL)
  reason: RollbackReason;
  
  // Stratégie 1 : Par clé de matching (mode actuel)
  matchingColumn?: string;
  matchingValues?: string[];
  
  // Stratégie 2 : Par RowID (nouveau)
  rowIdRange?: {
    min: number;  // RowID minimum (exclusif) - les lignes avec RowID > min seront supprimées
    max?: number; // RowID maximum (inclusif) - optionnel
  };
  rowIds?: number[];  // Liste explicite de RowIDs à supprimer
}

export type RollbackStrategy = 'matching_key' | 'rowid_range' | 'rowid_list';
```

---

### Sprint 6 : Modifier le service de rollback

**Fichier** : `lib/domain/rollback/rollback-service.ts`

```typescript
/**
 * Détermine la stratégie de rollback à utiliser
 */
function getRollbackStrategy(config: RollbackConfig): RollbackStrategy {
  if (config.rowIdRange) return 'rowid_range';
  if (config.rowIds && config.rowIds.length > 0) return 'rowid_list';
  if (config.matchingColumn && config.matchingValues?.length) return 'matching_key';
  throw new Error('Configuration de rollback invalide');
}

/**
 * Exécute un rollback en supprimant les lignes importées lors du test
 */
export async function executeRollback(config: RollbackConfig): Promise<RollbackResult> {
  const startTime = Date.now();
  const strategy = getRollbackStrategy(config);

  try {
    console.log('[Rollback] Strategy:', strategy);

    // Appeler l'API de suppression avec la bonne stratégie
    const response = await fetch('/api/zoho/delete', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workspaceId: config.workspaceId,
        viewId: config.viewId,
        tableName: config.tableName,
        // Stratégie matching_key
        matchingColumn: config.matchingColumn,
        matchingValues: config.matchingValues,
        // Stratégie rowid
        rowIdRange: config.rowIdRange,
        rowIds: config.rowIds,
      }),
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      return {
        success: false,
        deletedRows: 0,
        duration: Date.now() - startTime,
        errorMessage: result.error || 'Erreur lors du rollback',
      };
    }

    return {
      success: true,
      deletedRows: result.deletedRows,
      duration: Date.now() - startTime,
    };

  } catch (error) {
    console.error('[Rollback] Error:', error);
    return {
      success: false,
      deletedRows: 0,
      duration: Date.now() - startTime,
      errorMessage: error instanceof Error ? error.message : 'Erreur inconnue',
    };
  }
}
```

---

### Sprint 7 : Modifier l'API delete

**Fichier** : `app/api/zoho/delete/route.ts`

```typescript
export async function DELETE(request: NextRequest) {
  try {
    // ... auth ...

    const body = await request.json();
    const { 
      workspaceId, 
      viewId, 
      tableName,
      // Stratégie matching_key
      matchingColumn, 
      matchingValues,
      // Stratégie rowid
      rowIdRange,
      rowIds,
    } = body;

    // Construire le critère SQL selon la stratégie
    let criteria: string;

    if (rowIdRange) {
      // Stratégie RowID range
      if (rowIdRange.max) {
        criteria = `"RowID" > ${rowIdRange.min} AND "RowID" <= ${rowIdRange.max}`;
      } else {
        criteria = `"RowID" > ${rowIdRange.min}`;
      }
      console.log('[API Delete] Using RowID range strategy:', criteria);
    } else if (rowIds && rowIds.length > 0) {
      // Stratégie RowID list
      criteria = `"RowID" IN (${rowIds.join(',')})`;
      console.log('[API Delete] Using RowID list strategy:', criteria);
    } else if (matchingColumn && matchingValues?.length) {
      // Stratégie matching_key (existante)
      criteria = ZohoAnalyticsClient.buildInCriteria(matchingColumn, matchingValues);
      console.log('[API Delete] Using matching_key strategy:', criteria);
    } else {
      return NextResponse.json(
        { error: 'Critère de suppression requis (matchingColumn+values ou rowIdRange ou rowIds)' },
        { status: 400 }
      );
    }

    // Exécuter la suppression
    const client = await ZohoAnalyticsClient.forUser(user.id);
    const result = await client.deleteData(workspaceId, viewId, criteria);

    return NextResponse.json({
      success: true,
      deletedRows: result.deletedRows,
      criteria,
    });

  } catch (error) {
    // ... error handling ...
  }
}
```

---

### Sprint 8 : Modifier import-wizard.tsx pour le rollback

**Modifications dans `import-wizard.tsx`** :

1. **Stocker le maxRowId avant import test** (déjà prévu Sprint 4)
2. **Modifier handleRollback pour utiliser la bonne stratégie**

```typescript
// Nouveau state pour stocker le maxRowId
const [maxRowIdBeforeTest, setMaxRowIdBeforeTest] = useState<number | null>(null);
const maxRowIdBeforeTestRef = useRef<number | null>(null);

// Dans executeTestImport, AVANT l'import :
const maxResponse = await fetch(`/api/zoho/verify-by-rowid?...&action=getMax`);
const maxRowId = maxResult.data?.[0]?.maxRowId;
setMaxRowIdBeforeTest(maxRowId);
maxRowIdBeforeTestRef.current = maxRowId;

// Modifier handleRollback :
const handleRollback = useCallback(async (): Promise<RollbackResult> => {
  const strategy = getVerificationStrategy(state.config.importMode, verificationColumnRef.current);
  
  if (strategy === 'rowid' && maxRowIdBeforeTestRef.current !== null) {
    // Stratégie RowID : supprimer les lignes avec RowID > maxRowIdBeforeTest
    console.log('[Rollback] Using RowID strategy, deleting rows after:', maxRowIdBeforeTestRef.current);
  
    return await executeRollback({
      workspaceId: selectedWorkspaceId,
      viewId: state.config.tableId,
      tableName: tableName,
      rowIdRange: { min: maxRowIdBeforeTestRef.current },
      reason: 'user_cancelled',
    });
  } else {
    // Stratégie matching_key (comportement actuel)
    const column = verificationColumnRef.current;
    const values = testMatchingValuesRef.current;
  
    if (!column || values.length === 0) {
      return { success: false, deletedRows: 0, duration: 0, errorMessage: 'Pas de données' };
    }
  
    return await executeRollback({
      workspaceId: selectedWorkspaceId,
      viewId: state.config.tableId,
      matchingColumn: column,
      matchingValues: values,
      reason: 'user_cancelled',
    });
  }
}, [selectedWorkspaceId, state.config, tableName]);
```

---

## 📁 Fichiers à modifier (MISE À JOUR)

| Fichier                                        | Action           | Sprint | Description                                                             |
| ---------------------------------------------- | ---------------- | ------ | ----------------------------------------------------------------------- |
| `app/api/zoho/verify-by-rowid/route.ts`      | **CRÉER** | 1      | Nouvelle API pour vérification par RowID                               |
| `lib/domain/verification/types.ts`           | Modifier         | 2      | Ajouter `tableName`,`maxRowIdBeforeImport`,`verificationStrategy` |
| `lib/domain/verification/compare.ts`         | Modifier         | 3      | Nouvelle logique avec stratégie RowID/matching_key                     |
| `components/import/wizard/import-wizard.tsx` | Modifier         | 4, 8   | MAX(RowID) avant import + rollback dual                                 |
| `lib/domain/rollback/types.ts`               | Modifier         | 5      | Support `rowIdRange`et `rowIds`                                     |
| `lib/domain/rollback/rollback-service.ts`    | Modifier         | 6      | Logique dual pour rollback                                              |
| `app/api/zoho/delete/route.ts`               | Modifier         | 7      | Support critères RowID                                                 |

---

## 🧪 Tests à effectuer

### Test 1 : Vérifier que RowID fonctionne dans Zoho

```sql
SELECT MAX("RowID") FROM "QUITTANCES2"
-- Devrait retourner rapidement (< 1s)

SELECT * FROM "QUITTANCES2" ORDER BY "RowID" DESC LIMIT 5
-- Devrait retourner rapidement (< 2s)
```

### Test 2 : Import APPEND + Vérification RowID

1. Importer un fichier de 5 lignes en mode **APPEND**
2. Vérifier dans les logs : `[Verification] Strategy: rowid`
3. Vérifier que les 5 lignes sont correctement récupérées et comparées

### Test 3 : Rollback avec stratégie RowID

1. Après le test 2, cliquer sur "Annuler et corriger"
2. Vérifier dans les logs : `[Rollback] Using RowID strategy`
3. Vérifier que les 5 lignes sont supprimées
4. Vérifier dans Zoho que les lignes n'existent plus

### Test 4 : Import UPDATEADD + Vérification matching_key

1. Configurer un profil avec :
   * Mode : UPDATEADD
   * Clé de matching : "Numéro Quittance"
2. Importer en mode UPDATEADD
3. Vérifier dans les logs : `[Verification] Strategy: matching_key`
4. Vérifier que la clé de matching est utilisée

### Test 5 : Rollback avec stratégie matching_key

1. Après le test 4, cliquer sur "Annuler et corriger"
2. Vérifier dans les logs : `[Rollback] Using matching_key strategy`
3. Vérifier que les lignes sont supprimées par leur Numéro Quittance

---

## 📊 Diagramme de flux (nouvelle architecture)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           IMPORT TEST (5 lignes)                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. Déterminer la stratégie selon le mode d'import                          │
│     ┌─────────────────────────────────────────────────────────────────┐     │
│     │ APPEND / TRUNCATEADD / ONLYADD  →  Stratégie ROWID              │     │
│     │ UPDATEADD / DELETEUPSERT        →  Stratégie MATCHING_KEY       │     │
│     └─────────────────────────────────────────────────────────────────┘     │
│                                                                             │
│  2. AVANT import : Capturer les références                                  │
│     ┌─────────────────────────┬───────────────────────────────────────┐     │
│     │ Stratégie ROWID         │ Stratégie MATCHING_KEY                │     │
│     ├─────────────────────────┼───────────────────────────────────────┤     │
│     │ SELECT MAX("RowID")     │ Extraire matchingValues des 5 lignes  │     │
│     │ → maxRowIdBeforeImport  │ → testMatchingValues[]                │     │
│     └─────────────────────────┴───────────────────────────────────────┘     │
│                                                                             │
│  3. Exécuter l'import test (5 lignes)                                       │
│                                                                             │
│  4. APRÈS import : Récupérer les lignes pour vérification                   │
│     ┌─────────────────────────┬───────────────────────────────────────┐     │
│     │ Stratégie ROWID         │ Stratégie MATCHING_KEY                │     │
│     ├─────────────────────────┼───────────────────────────────────────┤     │
│     │ WHERE "RowID" >         │ WHERE "matchingCol" IN (...)          │     │
│     │   {maxRowIdBeforeImport}│ (utilise l'index de Zoho)             │     │
│     └─────────────────────────┴───────────────────────────────────────┘     │
│                                                                             │
│  5. Comparer envoyé vs reçu → Afficher résultat                             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
            ┌───────────┐   ┌───────────┐   ┌───────────┐
            │ Confirmer │   │ Rollback  │   │  Forcer   │
            │  import   │   │ & corriger│   │  import   │
            └───────────┘   └───────────┘   └───────────┘
                    │               │               │
                    ▼               ▼               ▼
            Import complet   ┌─────────────────────────────────────┐
            des lignes       │ ROLLBACK : Supprimer lignes test    │
            restantes        ├─────────────────────────────────────┤
                             │ Stratégie ROWID:                    │
                             │   DELETE WHERE "RowID" > {max}      │
                             │                                     │
                             │ Stratégie MATCHING_KEY:             │
                             │   DELETE WHERE "col" IN (...)       │
                             └─────────────────────────────────────┘
```

---

## 📝 Notes importantes

1. **La colonne RowID doit être créée manuellement** dans Zoho Analytics avant de commencer le développement
2. **RowID est auto-incrémenté** par Zoho - pas besoin de le gérer côté application
3. **Les requêtes avec RowID sont rapides** car c'est une clé primaire indexée
4. **Pour les modes UPDATE** , la clé de matching est obligatoire et devrait être indexée par Zoho (sinon le UPDATE ne fonctionnerait pas)
5. **Fallback prévu** : Si la stratégie RowID échoue (colonne absente), on tente la stratégie matching_key
6. **Rétrocompatibilité** : Les tables sans colonne RowID continueront de fonctionner avec matching_key

---

## 🔄 Ordre d'implémentation recommandé

1. **Créer la colonne RowID dans Zoho** (manuel, prérequis)
2. **Sprint 1** : API `/api/zoho/verify-by-rowid` (tester que ça marche)
3. **Sprint 5-7** : Modifier rollback (types, service, API delete)
4. **Sprint 2-3** : Modifier vérification (types, compare.ts)
5. **Sprint 4 + 8** : Modifier import-wizard (intégration complète)

---

## 🔗 Fichiers de référence actuels

| Fichier                                        | Lignes clés                                                | Rôle                                    |
| ---------------------------------------------- | ----------------------------------------------------------- | ---------------------------------------- |
| `lib/domain/verification/compare.ts`         | `fetchRowsFromZoho()`                                     | Récupération données pour comparaison |
| `lib/domain/verification/types.ts`           | `VerificationConfig`                                      | Configuration de vérification           |
| `lib/domain/rollback/rollback-service.ts`    | `executeRollback()`                                       | Service de rollback                      |
| `lib/domain/rollback/types.ts`               | `RollbackConfig`                                          | Configuration de rollback                |
| `app/api/zoho/verify-data/route.ts`          | Bulk API async                                              | API actuelle (timeout)                   |
| `app/api/zoho/delete/route.ts`               | `DELETE`                                                  | Suppression lignes Zoho                  |
| `components/import/wizard/import-wizard.tsx` | L.904 `handleRollback`, L.946 `handleConfirmFullImport` | Orchestration wizard                     |

---

*Document préparé pour la session suivante - Mission 012*
*Dernière mise à jour : 2026-01-21*
