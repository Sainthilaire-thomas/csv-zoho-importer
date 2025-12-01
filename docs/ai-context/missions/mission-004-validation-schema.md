
# Mission 004 - Validation basée sur schéma Zoho

**Statut** : 🔄 En cours
**Date début** : 2025-11-30
**Sessions** : 2
**Prérequis** : Mission 003 complétée

---

## 🎯 Objectif

Garantir la qualité des imports en validant les données du fichier contre le schéma de la table Zoho cible, avec transformations explicites et vérification post-import.

---

## 📋 Bilan des sessions

### Session 1 (2025-11-30 matin)

**Travail accompli :**

* ✅ Types TypeScript créés pour validation schéma
  * `ZohoColumn`, `DetectedColumnType`, `ColumnMapping`
  * `SchemaValidationResult`, `SchemaValidationError`, `SchemaValidationWarning`
* ✅ Service `SchemaValidator` implémenté (~400 lignes)
  * Détection automatique des types de colonnes
  * Correspondance fichier ↔ Zoho avec scoring
  * Analyse de compatibilité des types
* ✅ Route API `/api/zoho/columns` créée
* ✅ Intégration dans le wizard (4 phases de validation)
* ✅ Refonte `StepReview` avec affichage validation schéma
  * Composant `ColumnMappingRow` avec icônes statut
  * Composant `SchemaValidationSection`

**Problème identifié :**

* ❌ Erreur 500 sur endpoint `/workspaces/{workspaceId}/views/{viewId}/columns`
* L'endpoint n'existe pas dans l'API Zoho v2

### Session 2 (2025-11-30 après-midi)

**Travail accompli :**

* ✅ Correction de l'endpoint API Zoho pour récupérer les colonnes
  * Ancien (incorrect) : `/workspaces/{id}/views/{id}/columns`
  * Nouveau (correct) : `/views/{id}?CONFIG={"withInvolvedMetaInfo":true}`
* ✅ Méthode `getColumns()` dans `client.ts` corrigée
* ✅ Test réussi : 23 colonnes récupérées pour table QUITTANCES
* ✅ Validation schéma testée avec succès
  * 22 colonnes mappées
  * 4 avertissements détectés (types incompatibles)
* ✅ **Spécifications validation avancée rédigées** (document complet)
  * Parcours de validation en 6 étapes
  * Profils d'import réutilisables
  * Transformation explicite des données
  * Vérification post-import
  * Stratégie de rollback (phase ultérieure)

**Décisions stratégiques prises :**

* Rollback : Spécifié mais implémenté en phase ultérieure
* Détection profil : Par structure colonnes (pas par nom fichier)
* Partage profils : Oui, tous utilisateurs partagent les profils
* Archivage : Métadonnées uniquement (RGPD compliant)
* Traitement : 100% côté client → envoi direct Zoho

---

## 🔧 Solution technique - API Colonnes

### Endpoint correct (API v2)

```typescript
// lib/infrastructure/zoho/client.ts

async getColumns(workspaceId: string, viewId: string): Promise<ZohoColumn[]> {
  const config = { withInvolvedMetaInfo: true };
  const configEncoded = encodeURIComponent(JSON.stringify(config));
  
  const response = await this.request<ViewDetailsResponse>(
    `/views/${viewId}?CONFIG=${configEncoded}`
  );

  const columns = response.data?.views?.columns || [];
  return columns.map(col => ({
    columnName: col.columnName,
    columnDesc: col.columnDesc || col.columnName,
    dataType: col.dataType,
    isUnique: col.isUnique || false,
    isLookup: col.isLookup || false,
    isMandatory: col.isMandatory || false
  }));
}
```

### Réponse API Zoho

```json
{
  "status": "success",
  "data": {
    "views": {
      "viewId": "1718953000024195004",
      "viewName": "QUITTANCES",
      "viewType": "Table",
      "columns": [
        {
          "columnName": "Journal",
          "dataType": "PLAIN",
          "isUnique": false,
          "isMandatory": false
        },
        {
          "columnName": "Date début",
          "dataType": "DATE_AS_DATE",
          "isUnique": false,
          "isMandatory": false
        }
        // ... 21 autres colonnes
      ]
    }
  }
}
```

---

## 📁 Fichiers créés/modifiés

### Session 1

| Fichier                                        | Status | Description                    |
| ---------------------------------------------- | ------ | ------------------------------ |
| `lib/infrastructure/zoho/types.ts`           | ✅     | Types ZohoColumn, etc.         |
| `lib/domain/schema-validator.ts`             | ✅     | Service validation ~400 lignes |
| `app/api/zoho/columns/route.ts`              | ✅     | Route API colonnes             |
| `components/import/wizard/import-wizard.tsx` | ✅     | Intégration 4 phases          |
| `components/import/wizard/step-review.tsx`   | ✅     | Affichage validation schéma   |
| `types/index.ts`                             | ✅     | Types validation schéma       |

### Session 2

| Fichier                               | Status | Description                     |
| ------------------------------------- | ------ | ------------------------------- |
| `lib/infrastructure/zoho/client.ts` | ✅     | Méthode getColumns() corrigée |
| `docs/specs-validation-avancee.md`  | ✅     | Document complet créé         |
| `docs/architecture-cible.md`        | 📋     | Amendements identifiés         |

---

## 📊 Résultats des tests

### Test validation schéma - Table QUITTANCES

```
Workspace: 1718953000014173074
Table: QUITTANCES (viewId: 1718953000024195004)
Colonnes Zoho: 23

Résultat validation:
- 22 colonnes mappées
- 4 avertissements détectés
- 14 lignes valides
- 0 erreurs

Incompatibilités détectées:
1. Date début (date) → DATE_AS_DATE : ❌ Type incompatible
2. Heure début (string) → DURATION : ❌ Type incompatible
3. Date fin (date) → DATE_AS_DATE : ❌ Type incompatible
4. Heure fin (string) → DURATION : ❌ Type incompatible
```

**Constat important :** L'import a fonctionné malgré les croix rouges car Zoho a converti automatiquement. C'est exactement ce comportement "boîte noire" qu'on veut éliminer.

---

## 📝 Spécifications produites

### Document specs-validation-avancee.md

Contenu complet :

1. **Objectif et principes** - Explicite, échec rapide, vérification
2. **Parcours de validation** - 6 étapes détaillées avec wireframes
3. **Profils d'import** - Détection par structure, partage, vérification cohérence
4. **Rollback** - Stratégie via API DELETE (phase ultérieure)
5. **Cas particuliers** - Dates ambiguës, notation scientifique, caractères spéciaux
6. **Base de données** - Tables import_profiles et import_history
7. **Priorités d'implémentation** - Phase 1 (critique), 2 (important), 3 (souhaitable)

---

## ⏳ Reste à faire

### Phase 1 - Critique (Mission 004 suite)

* [ ] Interface résolution des incompatibilités (❌ → action utilisateur)
* [ ] Service DataTransformer (transformations explicites)
* [ ] Prévisualisation données transformées
* [ ] Vérification post-import basique (comparaison envoyé vs stocké)
* [ ] Appliquer amendements à architecture-cible.md

### Phase 2 - Important (Mission 005)

* [ ] Tables Supabase : import_profiles, import_history
* [ ] Service ProfileManager (détection, sauvegarde, chargement)
* [ ] Interface gestion des profils
* [ ] Seuil d'erreurs configurable

### Phase 3 - Souhaitable (Future)

* [ ] Rollback après import test
* [ ] Historique enrichi avec rapport téléchargeable
* [ ] Export PDF des rapports

---

## 🔗 Documents de référence

| Document                        | Description                           |
| ------------------------------- | ------------------------------------- |
| `specs-validation-avancee.md` | Spécifications complètes validation |
| `architecture-cible.md`       | Architecture technique v2.0           |
| `base-context.md`             | Contexte projet mis à jour           |

---

## 📝 Notes pour la prochaine session

### Contexte à retenir

1. L'endpoint `/views/{id}?CONFIG={"withInvolvedMetaInfo":true}` fonctionne
2. La validation schéma affiche correctement les correspondances
3. Les specs validation avancée sont complètes et validées
4. L'architecture-cible.md a besoin d'amendements (identifiés)

### Points de départ suggérés

1. **Option A** : Implémenter résolution des incompatibilités (interface utilisateur)
2. **Option B** : Créer DataTransformer pour transformations explicites
3. **Option C** : Implémenter vérification post-import

### Données techniques

```
Workspace ID: 1718953000014173074
View ID (QUITTANCES): 1718953000024195004
Org ID: 667999054
Endpoint colonnes: /views/{viewId}?CONFIG=%7B%22withInvolvedMetaInfo%22%3Atrue%7D
```

### Commandes pour reprendre

```powershell
cd "C:\Users\thoma\OneDrive\SONEAR_2025\csv-zoho-importer"
npm run dev
```

---

*Mission créée le : 2025-11-30*
*Dernière mise à jour : 2025-11-30 18:00*
*Statut : 🔄 En cours*![1764570677131](image/specs-fonctionnelles/1764570677131.png)
