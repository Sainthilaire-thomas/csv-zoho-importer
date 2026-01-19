# Mission 011 - Import par Chunks pour Gros Fichiers

## 📋 Objectif

Implémenter l'import par lots (chunks) pour supporter les fichiers volumineux (>10MB) qui dépassent la limite de body size de Next.js.

---

## 🎯 Contexte

### Problème actuel

Lors de l'import complet (après validation des 5 lignes test), les gros fichiers échouent avec l'erreur :

```
Request body exceeded 10MB for /api/zoho/import
Unterminated string in JSON at position 10427815
```

**Cause** : Next.js limite par défaut la taille du body des requêtes API. Même en augmentant cette limite, envoyer des fichiers de plusieurs dizaines de MB en une seule requête n'est pas fiable.

### Solution proposée

Découper l'import en **chunks de 5000 lignes** :

1. Diviser les données restantes en lots
2. Envoyer chaque lot séquentiellement à `/api/zoho/import`
3. Afficher la progression par chunk
4. Gérer les erreurs par chunk avec possibilité de retry

---

## 📁 Fichiers à modifier

| Fichier                                        | Modifications                                                |
| ---------------------------------------------- | ------------------------------------------------------------ |
| `components/import/wizard/import-wizard.tsx` | Fonction `handleConfirmFullImport` avec chunking           |
| `types/index.ts`                             | Ajouter type `ChunkProgress` si nécessaire                |
| `next.config.ts`                             | Optionnel : augmenter légèrement la limite pour sécurité |

---

## 🔧 Spécifications techniques

### Constantes

```typescript
const CHUNK_SIZE = 5000;  // Lignes par chunk (~ 1-2MB selon les données)
const MAX_RETRIES = 2;    // Tentatives par chunk en cas d'erreur
```

### Algorithme de chunking

```typescript
// 1. Calculer le nombre de chunks
const totalChunks = Math.ceil(remainingData.length / CHUNK_SIZE);

// 2. Pour chaque chunk
for (let i = 0; i < totalChunks; i++) {
  const start = i * CHUNK_SIZE;
  const end = Math.min(start + CHUNK_SIZE, remainingData.length);
  const chunk = remainingData.slice(start, end);
  
  // 3. Convertir en CSV
  const csvData = Papa.unparse(chunk);
  
  // 4. Mettre à jour la progression
  updateProgress({
    phase: 'full-importing',
    current: start,
    total: remainingData.length,
    percentage: Math.round((i / totalChunks) * 100),
    chunk: { current: i + 1, total: totalChunks }
  });
  
  // 5. Envoyer à Zoho (avec retry)
  let success = false;
  let lastError = null;
  
  for (let retry = 0; retry <= MAX_RETRIES && !success; retry++) {
    try {
      const response = await fetch('/api/zoho/import', { ... });
      const result = await response.json();
    
      if (response.ok) {
        success = true;
      } else {
        lastError = result.error;
      }
    } catch (error) {
      lastError = error.message;
    }
  
    if (!success && retry < MAX_RETRIES) {
      await sleep(1000 * (retry + 1)); // Backoff exponentiel
    }
  }
  
  if (!success) {
    throw new Error(`Échec chunk ${i + 1}/${totalChunks}: ${lastError}`);
  }
}
```

### Interface de progression améliorée

```typescript
// Dans types/index.ts
export interface ImportProgress {
  phase: 'parsing' | 'validating' | 'importing' | 'test-importing' | 'verifying' | 'full-importing';
  current: number;
  total: number;
  percentage: number;
  chunk?: {
    current: number;
    total: number;
  };
}
```

### Affichage de la progression

Dans `StepValidate` ou un nouveau composant, afficher :

```
Import en cours...
Lot 3/12 (25%)
15 000 / 60 000 lignes
[████████░░░░░░░░░░░░] 25%
```

---

## 🏃 Sprints

### Sprint 1 : Chunking basique

- [ ] Modifier `handleConfirmFullImport` pour découper en chunks
- [ ] Envoyer les chunks séquentiellement
- [ ] Mettre à jour la progression entre chaque chunk

### Sprint 2 : Gestion d'erreurs et retry

- [ ] Ajouter retry automatique par chunk (max 2 tentatives)
- [ ] Backoff exponentiel entre les retries
- [ ] Message d'erreur précis indiquant le chunk en échec

### Sprint 3 : Amélioration UX

- [ ] Afficher "Lot X/Y" dans la barre de progression
- [ ] Optionnel : permettre de reprendre un import interrompu
- [ ] Optionnel : estimation du temps restant

---

## 🧪 Tests à effectuer

| Scénario                 | Résultat attendu                             |
| ------------------------- | --------------------------------------------- |
| Fichier < 5000 lignes     | Import en 1 chunk, pas de découpage          |
| Fichier 15 000 lignes     | Import en 3 chunks (5000 + 5000 + 5000)       |
| Fichier 56 000 lignes     | Import en 12 chunks avec progression          |
| Erreur réseau chunk 3    | Retry automatique, puis erreur claire         |
| Annulation pendant import | Les chunks déjà importés restent dans Zoho |

---

## 📝 Code à implémenter

### `handleConfirmFullImport` modifié

```typescript
const handleConfirmFullImport = useCallback(async () => {
  if (!parsedData || !state.config.tableId || !state.validation) return;

  startFullImport();

  try {
    // Filtrer les données valides
    const validData = parsedData.filter((_, index) => {
      const lineNumber = index + 2;
      return !state.validation!.errors.some((err) => err.line === lineNumber);
    });

    // Prendre les données RESTANTES (après l'échantillon test)
    const remainingData = validData.slice(testSampleSize);

    if (remainingData.length === 0) {
      setImportSuccess({
        success: true,
        importId: `imp_${Date.now()}`,
        rowsImported: testSampleSize,
        duration: 0,
        verification: state.testResult?.verification,
      });
      return;
    }

    // ==================== CHUNKING ====================
    const CHUNK_SIZE = 5000;
    const MAX_RETRIES = 2;
    const totalChunks = Math.ceil(remainingData.length / CHUNK_SIZE);
    let totalImported = 0;
    const startTime = Date.now();

    console.log(`[Import] Démarrage import par chunks: ${remainingData.length} lignes en ${totalChunks} lots`);

    for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
      const start = chunkIndex * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, remainingData.length);
      const chunk = remainingData.slice(start, end);

      // Mise à jour progression
      updateProgress({
        phase: 'full-importing',
        current: start,
        total: remainingData.length,
        percentage: Math.round((chunkIndex / totalChunks) * 100),
      });

      console.log(`[Import] Chunk ${chunkIndex + 1}/${totalChunks}: lignes ${start + 1}-${end}`);

      // Convertir en CSV
      const csvData = Papa.unparse(chunk);

      // Retry loop
      let success = false;
      let lastError: string | null = null;

      for (let retry = 0; retry <= MAX_RETRIES && !success; retry++) {
        if (retry > 0) {
          console.log(`[Import] Retry ${retry}/${MAX_RETRIES} pour chunk ${chunkIndex + 1}`);
          await new Promise(resolve => setTimeout(resolve, 1000 * retry));
        }

        try {
          const response = await fetch('/api/zoho/import', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              workspaceId: selectedWorkspaceId,
              tableId: state.config.tableId,
              tableName: state.config.tableName,
              importMode: 'append',
              csvData: csvData,
              fileName: state.config.file?.name,
              totalRows: chunk.length,
              matchingColumns: matchingColumns.length > 0 ? matchingColumns : undefined,
              columnTypes: getColumnTypesFromSchema(),
            }),
          });

          const result = await response.json();

          if (response.ok && result.success) {
            success = true;
            totalImported += chunk.length;
            console.log(`[Import] Chunk ${chunkIndex + 1} OK: ${chunk.length} lignes importées`);
          } else {
            lastError = result.error || 'Erreur inconnue';
          }
        } catch (error) {
          lastError = error instanceof Error ? error.message : 'Erreur réseau';
        }
      }

      if (!success) {
        throw new Error(
          `Échec à l'import du lot ${chunkIndex + 1}/${totalChunks} (lignes ${start + 1}-${end}): ${lastError}`
        );
      }
    }
    // ==================== FIN CHUNKING ====================

    const duration = Date.now() - startTime;
    console.log(`[Import] Terminé: ${totalImported} lignes en ${duration}ms`);

    // Sauvegarder/mettre à jour le profil
    if (profileMode !== 'skip') {
      try {
        await saveOrUpdateProfile();
      } catch (profileError) {
        console.error('Erreur sauvegarde profil (non bloquant):', profileError);
      }
    }

    setImportSuccess({
      success: true,
      importId: `imp_${Date.now()}`,
      rowsImported: testSampleSize + totalImported,
      duration,
      verification: state.testResult?.verification,
    });

    // Reset states...
    setParsedData(null);
    setSchemaValidation(null);
    setZohoSchema(null);
    setResolvedIssues(null);
    setIssuesResolved(false);
    setSelectedProfile(null);
    setSelectedMatchResult(null);
    setDetectedColumns([]);
    setProfileMode('skip');
    setVerificationSample([]);
    setTestMatchingValues([]);
    testMatchingValuesRef.current = [];
    setVerificationColumn(null);
    verificationColumnRef.current = null;

  } catch (error) {
    console.error('Erreur import complet:', error);
    setImportError(
      error instanceof Error ? error.message : "Erreur lors de l'import"
    );
  }
}, [
  parsedData,
  state.config,
  state.validation,
  state.testResult,
  testSampleSize,
  selectedWorkspaceId,
  matchingColumns,
  profileMode,
  saveOrUpdateProfile,
  startFullImport,
  updateProgress,
  setImportSuccess,
  setImportError,
  getColumnTypesFromSchema,
]);
```

---

## ⚠️ Points d'attention

1. **Ordre des chunks** : Les chunks doivent être envoyés séquentiellement (pas en parallèle) pour éviter les problèmes de concurrence côté Zoho.
2. **Mode append uniquement** : Après le test des 5 premières lignes, tous les chunks suivants utilisent `importMode: 'append'`.
3. **Pas de rollback partiel** : Si un chunk échoue après que d'autres aient réussi, les données déjà importées restent dans Zoho. L'utilisateur devra les supprimer manuellement si nécessaire.
4. **Taille du chunk** : 5000 lignes est un bon compromis. Trop petit = trop de requêtes, trop grand = risque de timeout.

---

## 📊 Estimation

| Sprint          | Durée estimée   |
| --------------- | ----------------- |
| Sprint 1        | 1h                |
| Sprint 2        | 30min             |
| Sprint 3        | 30min (optionnel) |
| **Total** | **~2h**     |

---

*Mission créée le : 2025-01-19*
*Statut : 📋 À FAIRE*
*Priorité : 🔴 Haute (bloquant pour gros fichiers)*
