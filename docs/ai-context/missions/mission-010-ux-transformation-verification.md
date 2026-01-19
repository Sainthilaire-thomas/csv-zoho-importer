
# Mission 010 - UX Transformation et Vérification

## 📋 Objectif

Améliorer l'expérience utilisateur pour :

1. Visualiser clairement les transformations de données (Excel → Zoho)
2. Comparer correctement les données après import (formats différents mais valeurs identiques)
3. Respecter les espaces dans les textes (demande client)
4. Afficher une ligne de référence Zoho dans le preview

---

## 🎯 Contexte

### Problème actuel

1. **Comparaison des dates** : Zoho affiche `"04 Apr, 2025 00:00:00"` mais on envoie `"2025-04-04"`. L'utilisateur ne comprend pas que c'est la même valeur.
2. **Trim automatique non souhaité** : Les espaces dans les textes sont supprimés automatiquement, mais le client a des filtres Zoho qui dépendent de ces espaces (ex: `"BUS                   "`).
3. **Manque de clarté** : L'utilisateur ne voit pas clairement le flux : Fichier → Transformation → Envoi → Affichage Zoho.
4. **Pas de référence visuelle** : L'utilisateur ne peut pas comparer avec des données existantes dans Zoho.
5. **Vérification impossible sur grosses tables** : L'API synchrone `/api/zoho/data` retourne `SYNC_EXPORT_NOT_ALLOWED` pour les tables > 1M lignes.

### Solution proposée

Améliorer l'affichage avec des colonnes explicites :

- **📄 Fichier Excel** : Valeur brute source
- **🔄 Sera envoyé à Zoho** : Après transformation
- **👁️ Zoho affichera** : Format d'affichage prévu (prédiction)
- **📋 Exemple Zoho** : Valeur réelle d'une ligne existante (référence)

---

## 🏃 Sprint 1 : Correction du trim automatique ✅ TERMINÉ

### Objectif

Supprimer le trim automatique des textes pour préserver les espaces, **tout en restant compatible avec la Mission 009** (qui corrigeait le bug des `\n` cassant le CSV).

### Fichiers modifiés

#### 1. `lib/domain/data-transformer.ts`

- **Ligne 267** : Suppression du `.trim()` dans `applyAllTransformations()`
- **Lignes 237-239** : Case 'none' modifié pour préserver les espaces

#### 2. `lib/domain/schema-validator.ts`

- **Lignes 533-534** : Changement du défaut pour les strings (`'none'` au lieu de `'trim'`)

### Comportement final

| Valeur source        | Résultat                                    |
| -------------------- | -------------------------------------------- |
| `"BUS   "`         | `"BUS   "` ✅ (espaces préservés)        |
| `"Ligne1\nLigne2"` | `"Ligne1 Ligne2"` ✅ (newlines remplacés) |

### Commit

`b42ec5e` - "fix(sprint1): préserver les espaces dans les textes - Mission 010"

---

## 🏃 Sprint 2 : Normalisation des dates pour comparaison ✅ TERMINÉ

### Objectif

Permettre la comparaison correcte entre formats de date différents (ISO vs Zoho).

### Fichier modifié

#### `lib/domain/verification/compare.ts`

1. **Ajout `MONTH_MAP`** : Mapping mois anglais → numéro
2. **Ajout `tryParseDateToCanonical()`** : Parse plusieurs formats (ISO, Zoho, FR)
3. **Modification `normalizeValue()`** : Appel du parsing date en premier

### Résultat

`"2025-04-04"` et `"04 Apr, 2025 00:00:00"` sont maintenant considérés comme identiques.

### Commit

`fc85f88` - "feat(sprint2): normalisation des dates pour comparaison - Mission 010"

---

## 🏃 Sprint 3 : Amélioration affichage Preview ✅ TERMINÉ

### Objectif

Afficher le flux 3 niveaux : 📄 Fichier → 🔄 Transformé → 👁️ Zoho affichera

### Fichier modifié

#### `components/import/wizard/step-transform-preview.tsx`

1. **Ajout `predictZohoDisplay()`** : Prédit le format d'affichage Zoho
2. **Modification rendu cellules** : Affichage des 3 niveaux avec icônes
3. **Légende mise à jour** : Explique les 3 niveaux

### Commits

- `3f4c2fa` - "feat(sprint3): amélioration affichage Preview - Mission 010"
- `80bff07` - "fix(sprint3): amélioration predictZohoDisplay pour datetime - Mission 010"

---

## 🏃 Sprint 4 : Vérification post-import pour grosses tables ✅ TERMINÉ

### Objectif

Adapter la vérification post-import pour utiliser l'API Bulk async au lieu de l'API synchrone qui échoue sur les grosses tables.

### Problème résolu

L'API `/api/zoho/data` avec export synchrone retourne une erreur pour les grosses tables (>1M lignes) :

```
"SYNC_EXPORT_NOT_ALLOWED" - Exportation synchrone non autorisée
```

### Solution implémentée

Création d'une nouvelle API `/api/zoho/verify-data` utilisant **Bulk Export Async avec SQL Query filtré** :

1. Récupère le nom de la table depuis le viewId
2. Crée un job d'export avec `SELECT * FROM "Table" WHERE "col" IN (...) LIMIT N`
3. Poll le statut du job jusqu'à completion
4. Télécharge et retourne les données filtrées

### Fichiers créés

#### `app/api/zoho/verify-data/route.ts` (NOUVEAU)

```typescript
// Endpoint
GET /api/zoho/verify-data?workspaceId=X&tableName=Y&matchingColumn=Z&matchingValues=[...]

// Flow interne
1. Construire SQL: SELECT * FROM "tableName" WHERE "matchingColumn" IN (values)
2. POST /bulk/workspaces/{id}/data?CONFIG={sqlQuery}
   → Retourne jobId
3. GET /bulk/workspaces/{id}/exportjobs/{jobId}
   → Poll jusqu'à jobCode="1004"
4. GET /bulk/workspaces/{id}/exportjobs/{jobId}/data
   → Retourne les données JSON filtrées
```

### Fichiers modifiés

#### `lib/domain/verification/compare.ts`

- **Nouvelle fonction `fetchRowsFromZoho()`** : Utilise l'API async en priorité avec fallback sync
- **Nouvelle fonction `getTableNameFromViewId()`** : Récupère le nom de table avec cache
- **Cache `tableNameCache`** : Évite les appels répétés à l'API tables

### Résultat

```
[VerifyData] SQL Query: SELECT * FROM "QUITTANCES2" WHERE "Numéro Quittance" IN ('...') LIMIT 10
[VerifyData] Job created: 1718953000034680001
[VerifyData] Poll 1 - jobCode: 1004
[VerifyData] Success - got 5 rows
```

- ✅ Fonctionne sur table QUITTANCES2 (56024+ lignes)
- ✅ Vérification post-import réussie avec Bulk API async
- ✅ Fallback automatique vers API sync pour petites tables

---

## 🏃 Sprint 5 : Ligne de référence Zoho ✅ TERMINÉ

### Objectif

Afficher une ligne existante de Zoho comme référence visuelle dans le preview.

### Fichiers créés/modifiés

#### `app/api/zoho/sample-row/route.ts`

- Utilise Bulk API async avec `SELECT * FROM "TableName" LIMIT 1`

#### `components/import/wizard/import-wizard.tsx`

- Ajout state `zohoReferenceRow`
- Appel à `/api/zoho/sample-row` avec `tableName`

#### `components/import/wizard/step-transform-preview.tsx`

- Affichage 📋 dans le header de chaque colonne avec valeur de référence

### Résultat

- ✅ Affiche les valeurs de référence en violet/rose dans les headers
- ✅ L'utilisateur voit le format exact des données existantes dans Zoho

---

## 📊 Récapitulatif des sprints

| Sprint             | Statut      | Description                                 |
| ------------------ | ----------- | ------------------------------------------- |
| **Sprint 1** | ✅ Terminé | Correction trim automatique                 |
| **Sprint 2** | ✅ Terminé | Normalisation dates pour comparaison        |
| **Sprint 3** | ✅ Terminé | Amélioration affichage Preview (3 niveaux) |
| **Sprint 4** | ✅ Terminé | Vérification post-import (Bulk API async)  |
| **Sprint 5** | ✅ Terminé | Ligne de référence Zoho                   |

---

## 📝 Commits de la mission

1. `b42ec5e` - fix(sprint1): préserver les espaces dans les textes
2. `fc85f88` - feat(sprint2): normalisation des dates pour comparaison
3. `3f4c2fa` - feat(sprint3): amélioration affichage Preview
4. `80bff07` - fix(sprint3): amélioration predictZohoDisplay pour datetime
5. `a10e61a` - feat(sprint5): ligne de référence Zoho dans preview
6. `[À FAIRE]` - feat(sprint4): API verify-data avec Bulk async pour grosses tables

---

## 🧪 Tests effectués

### ✅ Preview des transformations

- Dates `04/04/2025` → `2025-04-04` → `04 Apr, 2025 00:00:00` affichées correctement
- Les 3 niveaux (📄 → 🔄 → 👁️) s'affichent dans les cellules
- "Inchangé" affiché quand pas de transformation

### ✅ Comparaison des dates

- `"2025-04-04"` matche avec `"04 Apr, 2025 00:00:00"` ✅
- Plus de faux positifs "value_different" sur les dates

### ✅ Référence Zoho (Sprint 5)

- L'API `/api/zoho/sample-row` fonctionne avec Bulk API async
- Testé sur table QUITTANCES2 (56024 lignes) ✅

### ✅ Vérification post-import (Sprint 4)

- L'API `/api/zoho/verify-data` fonctionne avec Bulk API async
- Testé sur table QUITTANCES2 (56024 lignes) ✅
- Les 5 lignes de test sont récupérées et comparées correctement

---

## ⚠️ TODO - Prochaine mission

### Import par chunks pour gros fichiers

L'import des données restantes (après test des 5 lignes) échoue si le fichier dépasse ~10MB :

```
Request body exceeded 10MB for /api/zoho/import
```

**Solution à implémenter :**

- Découper l'import en chunks de 5000 lignes
- Afficher la progression par chunk
- Gérer les erreurs par chunk

---

## 📝 Notes techniques

### Formats de date Zoho

- **DATE** : `"04 Apr, 2025 00:00:00"` (affiche toujours l'heure 00:00:00)
- **DATETIME** : `"04 Apr, 2025 23:59:35"` (préserve l'heure)
- **Format d'import** : `yyyy-MM-dd` (ISO)

### API Zoho - Bulk Export Async

```
# Créer job
GET /restapi/v2/bulk/workspaces/{workspaceId}/data?CONFIG={sqlQuery, responseFormat}
→ Retourne { data: { jobId: "xxx" } }

# Poll statut
GET /restapi/v2/bulk/workspaces/{workspaceId}/exportjobs/{jobId}
→ Retourne { data: { jobCode: "1004", jobStatus: "JOB COMPLETED" } }

# Télécharger données
GET /restapi/v2/bulk/workspaces/{workspaceId}/exportjobs/{jobId}/data
→ Retourne { data: [...] }
```

### jobCode values

- `1001` / `1002` : En cours
- `1003` : Échec
- `1004` : Terminé ✅

---

*Mission créée le : 2025-01-19*
*Dernière mise à jour : 2025-01-19 15:30*
*Statut : ✅ TERMINÉE (Sprint 4 complété)*
