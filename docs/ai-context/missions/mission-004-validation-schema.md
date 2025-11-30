
# Mission 004 - Renforcement Qualité des Imports

**Statut** : 🆕 Nouvelle
**Date création** : 2025-11-30
**Prérequis** : Mission 003 complétée (import fonctionnel)

---

## 🎯 Objectif

Garantir la qualité des imports en validant les données AVANT envoi vers Zoho Analytics, en se basant sur le schéma réel de la table cible, et en offrant une prévisualisation des transformations.

---

## 📋 Contexte

### Situation actuelle

L'import vers Zoho Analytics fonctionne (Mission 003), mais :
- Aucune validation basée sur le schéma réel de la table Zoho
- Pas de vérification des types de colonnes
- Risque d'erreurs silencieuses (Zoho peut ignorer des colonnes mal formatées)
- Pas de prévisualisation avant import
- Pas de contrôle post-import

### Problèmes à résoudre

1. **Erreurs silencieuses** : Zoho peut importer partiellement sans alerter
2. **Formats incompatibles** : Dates, nombres avec mauvais séparateurs
3. **Colonnes manquantes/extra** : Fichier ne correspond pas à la table
4. **Pas de visibilité** : L'utilisateur ne sait pas ce qui sera importé

---

## 🔧 Fonctionnalités prévues

### F1 - Récupération du schéma de la table Zoho

**Description** : Obtenir les métadonnées (colonnes, types) de la table cible avant import.

**API Zoho à utiliser** :
```
GET /restapi/v2/workspaces/{workspaceId}/views/{viewId}/columns
```

**Données attendues** :
```typescript
interface ZohoColumn {
  columnName: string;
  columnId: string;
  dataType: 'PLAIN' | 'NUMBER' | 'CURRENCY' | 'PERCENT' | 'DATE' | 'EMAIL' | 'URL';
  dateFormat?: string;
  decimalPlaces?: number;
  isRequired?: boolean;
}
```

**Actions** :
- [ ] Créer route API `/api/zoho/columns`
- [ ] Ajouter méthode `getColumns()` dans `client.ts`
- [ ] Cacher le schéma en mémoire (éviter appels répétés)

---

### F2 - Validation basée sur le schéma

**Description** : Comparer les colonnes du fichier avec celles de la table Zoho.

**Vérifications** :
- [ ] Colonnes du fichier présentes dans la table Zoho
- [ ] Colonnes Zoho obligatoires présentes dans le fichier
- [ ] Types compatibles (date → date, nombre → nombre)
- [ ] Alertes pour colonnes supplémentaires (ignorées par Zoho)

**Résultat attendu** :
```typescript
interface SchemaValidationResult {
  isValid: boolean;
  matchedColumns: ColumnMapping[];
  missingRequired: string[];      // Colonnes Zoho requises absentes
  extraColumns: string[];         // Colonnes fichier non reconnues
  typeWarnings: TypeWarning[];    // Types incompatibles
}

interface ColumnMapping {
  fileColumn: string;
  zohoColumn: string;
  fileType: 'string' | 'number' | 'date';
  zohoType: ZohoDataType;
  isCompatible: boolean;
  transformNeeded?: 'date_format' | 'number_format';
}
```

**Actions** :
- [ ] Créer service `SchemaValidator`
- [ ] Intégrer dans étape "Validation" du wizard
- [ ] Afficher résultat de comparaison visuel

---

### F3 - Transformation automatique des données

**Description** : Convertir automatiquement les données au format attendu par Zoho.

**Transformations** :
- [ ] **Dates** : Détecter format source, convertir vers format Zoho
  - `01/12/2025` → `2025-12-01` (si Zoho attend ISO)
  - `December 1, 2025` → `01/12/2025`
- [ ] **Nombres** : Normaliser séparateurs
  - `1 234,56` → `1234.56`
  - `$1,234.56` → `1234.56`
- [ ] **Texte** : Trim, normalisation espaces

**Actions** :
- [ ] Créer service `DataTransformer`
- [ ] Configurer règles de transformation par type
- [ ] Permettre override manuel si besoin

---

### F4 - Prévisualisation avant import

**Description** : Afficher un aperçu des données transformées avant l'import réel.

**Interface** :
```
┌─────────────────────────────────────────────────────────────────┐
│  Prévisualisation de l'import                                   │
│                                                                 │
│  Table cible : QUITTANCES                                       │
│  Lignes à importer : 14                                         │
│                                                                 │
│  Correspondance des colonnes :                                  │
│  ┌─────────────────┬─────────────────┬────────────────────────┐│
│  │ Fichier         │ Table Zoho      │ Status                 ││
│  ├─────────────────┼─────────────────┼────────────────────────┤│
│  │ Date_Emission   │ DATE_EMISSION   │ ✅ Format: dd/MM/yyyy  ││
│  │ Montant_TTC     │ MONTANT_TTC     │ ✅ Nombre              ││
│  │ Email_Client    │ EMAIL_CLIENT    │ ✅ Email               ││
│  │ Notes           │ -               │ ⚠️ Colonne ignorée     ││
│  └─────────────────┴─────────────────┴────────────────────────┘│
│                                                                 │
│  Aperçu des données (5 premières lignes) :                      │
│  ┌─────────────┬─────────────┬────────────────────────────────┐│
│  │ DATE_EMIS.  │ MONTANT_TTC │ EMAIL_CLIENT                   ││
│  ├─────────────┼─────────────┼────────────────────────────────┤│
│  │ 01/12/2025  │ 1234.56     │ client@email.com               ││
│  │ 02/12/2025  │ 987.65      │ autre@email.com                ││
│  │ ...         │ ...         │ ...                            ││
│  └─────────────┴─────────────┴────────────────────────────────┘│
│                                                                 │
│              [Annuler]    [Confirmer l'import]                  │
└─────────────────────────────────────────────────────────────────┘
```

**Actions** :
- [ ] Créer composant `ImportPreview`
- [ ] Intégrer dans étape "Review" du wizard
- [ ] Afficher warnings visuellement

---

### F5 - Vérification post-import

**Description** : Analyser la réponse Zoho pour détecter les problèmes.

**Vérifications** :
- [ ] `successRowCount` === `totalRowCount` attendu
- [ ] `warnings` === 0 (sinon afficher détails)
- [ ] Colonnes sélectionnées === colonnes attendues

**Rapport post-import** :
```typescript
interface ImportReport {
  success: boolean;
  summary: {
    expected: number;
    imported: number;
    skipped: number;
    warnings: number;
  };
  details: {
    columnsUsed: string[];
    columnsIgnored: string[];
    warningMessages: string[];
  };
  recommendations: string[];  // Suggestions pour améliorer
}
```

**Actions** :
- [ ] Enrichir `step-confirm.tsx` avec rapport détaillé
- [ ] Afficher warnings si présents
- [ ] Proposer actions correctives

---

## 📁 Fichiers à créer/modifier

### Nouveaux fichiers

| Fichier                                    | Description                           |
| ------------------------------------------ | ------------------------------------- |
| `app/api/zoho/columns/route.ts`            | API récupération schéma table         |
| `lib/domain/schema-validator.ts`           | Service validation schéma             |
| `lib/domain/data-transformer.ts`           | Service transformation données        |
| `components/import/import-preview.tsx`     | Composant prévisualisation            |
| `components/import/column-mapping.tsx`     | Affichage correspondance colonnes     |

### Fichiers à modifier

| Fichier                                    | Modification                          |
| ------------------------------------------ | ------------------------------------- |
| `lib/infrastructure/zoho/client.ts`        | Ajouter `getColumns()`                |
| `lib/infrastructure/zoho/types.ts`         | Ajouter `ZohoColumn` interface        |
| `components/import/wizard/step-validate.tsx` | Intégrer validation schéma          |
| `components/import/wizard/step-review.tsx` | Intégrer prévisualisation             |
| `components/import/wizard/step-confirm.tsx` | Enrichir rapport                     |

---

## ✅ Critères de succès

### Fonctionnel

- [ ] Schéma de table Zoho récupéré automatiquement
- [ ] Correspondance colonnes fichier ↔ table affichée
- [ ] Alertes visuelles pour incompatibilités
- [ ] Prévisualisation des 5-10 premières lignes transformées
- [ ] Rapport post-import avec détails

### Technique

- [ ] Cache du schéma pour éviter requêtes répétées
- [ ] Transformations configurables par type
- [ ] Gestion des erreurs Zoho API

### UX

- [ ] Interface claire et intuitive
- [ ] Warnings non bloquants mais visibles
- [ ] Possibilité de forcer l'import malgré warnings

---

## 📊 Estimation

| Tâche                           | Complexité | Estimation |
| ------------------------------- | ---------- | ---------- |
| API columns + client            | Faible     | 30 min     |
| Service SchemaValidator         | Moyenne    | 1h         |
| Service DataTransformer         | Moyenne    | 1h         |
| Composant ImportPreview         | Moyenne    | 1h30       |
| Intégration wizard              | Moyenne    | 1h         |
| Rapport post-import             | Faible     | 30 min     |
| Tests et debug                  | Variable   | 1h         |
| **Total estimé**                |            | **~6-7h**  |

---

## 🔗 Documentation Zoho utile

- [Get View Columns](https://www.zoho.com/analytics/api/v2/get-view-columns.html)
- [Import Data Types](https://www.zoho.com/analytics/api/v2/bulk-api/import-data/data-types.html)
- [Date Formats](https://www.zoho.com/analytics/api/v2/bulk-api/import-data/date-formats.html)

---

*Mission créée le : 2025-11-30*
*Dernière mise à jour : 2025-11-30*
*Statut : 🆕 Nouvelle - Prête à démarrer*
