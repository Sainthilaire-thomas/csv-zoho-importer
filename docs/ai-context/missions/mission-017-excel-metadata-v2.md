# Mission 017 : Exploitation des Métadonnées Excel pour la Détection de Types

*Date de création : 2026-01-24*
*Dernière mise à jour : 2026-01-24*
*Statut : 🔄 EN COURS (Phase 1 terminée, Phase 2 à faire)*
*Prérequis : Mission 015 (UX Historique) terminée ✅*
*Priorité : Haute*

---

## 📋 Contexte

### Problème initial
Lors de l'import du fichier `REGT_04_a_12_2025.xlsx`, l'application crashait avec l'erreur :
```
TypeError: value.trim is not a function
```

**Cause** : La bibliothèque `xlsx` parse les fichiers Excel en conservant les types natifs JavaScript (number, boolean, Date), alors que le code attendait uniquement des strings (comme avec CSV/Papa Parse).

### Problème découvert pendant l'implémentation
Les dates Excel sont stockées comme des **nombres sériels** (ex: `45088.98` = 09/02/2022). Le parsing actuel retourne ces nombres bruts au lieu des strings formatées que l'utilisateur voit dans Excel.

---

## 🎯 Objectifs révisés

### Objectif principal : Transparence totale
L'utilisateur doit comprendre **exactement** comment ses données seront transformées :
- Voir la **valeur brute** stockée dans le fichier
- Voir la **valeur formatée** (ce qu'il voit dans Excel)
- Voir le **format Excel** appliqué
- Voir ce qui sera **envoyé à Zoho**
- Voir la **prévision d'affichage** dans Zoho

### Principe fondamental
> "Explicite plutôt qu'implicite" - Toutes les transformations doivent être explicitées.

---

## ✅ Ce qui a été fait (Phase 1)

### 1. Types enrichis

**Fichier : `types/profiles.ts`**
- Ajout de `ExcelColumnMeta` (métadonnées par colonne)
- Ajout de `ExcelHint` (suggestion de format)
- Enrichissement de `DetectedColumn` avec `excelHint?`

```typescript
export interface ExcelColumnMeta {
  dominantCellType: 'string' | 'number' | 'date' | 'boolean' | 'mixed';
  rawExcelFormat?: string;
  normalizedFormat?: string;
  formattedSamples: string[];
  confidence: 'high' | 'medium' | 'low';
}

export interface ExcelHint {
  suggestedFormat: string;
  rawExcelFormat: string;
  confidence: 'high' | 'medium' | 'low';
}
```

### 2. Extraction des métadonnées Excel

**Fichier : `lib/hooks/use-csv-parser.ts`**
- `ParseResult` inclut maintenant `columnMetadata?: Record<string, ExcelColumnMeta>`
- Fonction `extractColumnMetadata(worksheet)` extrait les infos de chaque colonne
- Fonction `analyzeColumnCells()` détermine le type/format dominant
- Fonction `normalizeExcelFormat()` convertit les formats Excel vers notre système

### 3. Type detector modifié

**Fichier : `lib/domain/detection/type-detector.ts`**
- `detectColumns()` accepte `Record<string, unknown>[]` (plus seulement `string[]`)
- Nouvelle méthode `toStringValue(value: unknown)` pour convertir tous types en string
- Accepte `DetectionOptions` avec `excelMetadata` optionnel
- Propage `excelHint` vers `DetectedColumn` quand pertinent

### 4. Propagation dans le wizard

**Fichiers modifiés :**
- `use-import-wizard-state.ts` : Ajout de `columnMetadata` dans `SchemaState`
- `import-wizard.tsx` : Stocke `columnMetadata` lors du parsing, passe `detectedColumns` à `validateSchema`
- `step-profile.tsx` : Reçoit et passe `columnMetadata` à `detectColumnTypes`
- `use-profile-management.ts` : `handleProfileSelected` stocke aussi les `detectedColumns`

### 5. Issues enrichies

**Fichier : `lib/infrastructure/zoho/types.ts`**
- `ResolvableIssue` inclut maintenant `excelHint?`

**Fichier : `lib/domain/schema-validator.ts`**
- `detectResolvableIssues()` reçoit `detectedColumns` et propage `excelHint`

### 6. UI de résolution avec hint Excel

**Fichier : `components/import/wizard/step-resolve.tsx`**
- `DateFormatResolver` affiche la suggestion Excel si disponible
- Pré-sélectionne le format suggéré (si confiance haute)
- Indicateur visuel "← Suggéré par Excel"

---

## ❌ Problème restant

### Les dates Excel sont des nombres sériels

Dans l'écran d'aperçu (`StepTransformPreview`), les colonnes date affichent :
- `45088.98263888889` (nombre sériel) au lieu de `09/02/2022` (ce que voit l'utilisateur)

**Cause** : Le parsing actuel utilise `cell.v` (valeur brute) au lieu de `cell.w` (valeur formatée).

**Solution identifiée** : Extraire `cell.w` pour les données, tout en conservant `cell.v` et `cell.z` pour l'affichage détaillé.

---

## 🔧 Phase 2 : À implémenter

### Sprint 2.1 : Corriger l'extraction des données Excel

**Fichier : `lib/hooks/use-csv-parser.ts`**

Modifier `extractFormattedData()` pour :
1. Utiliser `cell.w` (valeur formatée) comme valeur principale
2. Si `cell.w` absent et `cell.t === 'n'` avec format date → convertir le nombre sériel
3. Conserver `cell.v`, `cell.w`, `cell.z` dans les métadonnées pour l'affichage

```typescript
function extractFormattedData(worksheet: XLSX.WorkSheet): {
  data: Record<string, unknown>[];
  cellDetails: Record<string, CellDetail[]>;  // Pour l'UI détaillée
}

interface CellDetail {
  v: unknown;      // Valeur brute
  w?: string;      // Valeur formatée (ce que voit l'utilisateur)
  z?: string;      // Format Excel
}
```

### Sprint 2.2 : Nouvelle UI d'aperçu avec accordéon

**Fichier : `components/import/wizard/step-transform-preview.tsx`**

Remplacer le tableau actuel par une vue accordéon :

```
┌─────────────────────────────────────────────────────────────────────────┐
│ date_pv                          Format Zoho: DATE_AS_DATE              │
│                                  Exemple Zoho: 09 Feb 2022 08:40:00     │
├─────────────────────────────────────────────────────────────────────────┤
│ ▶ Ligne 1: 09/02/2022 08:40:00  →  2022-02-09 08:40:00  ✓              │
├─────────────────────────────────────────────────────────────────────────┤
│ ▼ Ligne 2: 03/04/2022 15:30:00  →  2022-04-03 15:30:00  ✓              │
│   ┌─────────────────────────────────────────────────────────────────┐   │
│   │ Valeur brute (stockée)     │ 45141.6461111111                   │   │
│   │ Vue Excel (affichée)       │ 03/04/2022 15:30:00                │   │
│   │ Format Excel               │ dd/mm/yyyy hh:mm:ss                │   │
│   │ ─────────────────────────────────────────────────────────────── │   │
│   │ Transformation             │ dd/mm/yyyy → yyyy-mm-dd            │   │
│   │ Valeur envoyée à Zoho      │ 2022-04-03 15:30:00                │   │
│   │ Prévu dans Zoho (affichage)│ 03 Apr 2022 15:30:00               │   │
│   └─────────────────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────────────┤
│ ▶ Ligne 3: 15/06/2022 09:00:00  →  2022-06-15 09:00:00  ✓              │
└─────────────────────────────────────────────────────────────────────────┘
```

**Informations affichées dans l'accordéon :**

| Champ | Source | Description |
|-------|--------|-------------|
| Valeur brute | `cell.v` | Ce qui est stocké dans le fichier |
| Vue Excel | `cell.w` | Ce que l'utilisateur voit dans Excel |
| Format Excel | `cell.z` | Le format d'affichage Excel |
| Transformation | Notre logique | Règle appliquée |
| Valeur envoyée | Après transform | Ce qui part vers Zoho |
| Prévu dans Zoho | Format Zoho | Prévision de l'affichage final |

### Sprint 2.3 : Helpers de conversion

**Nouveau fichier : `lib/domain/excel/date-converter.ts`**

```typescript
/**
 * Convertit un nombre sériel Excel en date
 */
export function excelSerialToDate(serial: number): Date;

/**
 * Formate une date selon un format Excel
 */
export function formatExcelDate(date: Date, format: string): string;

/**
 * Prédit l'affichage dans Zoho selon le type de colonne
 */
export function predictZohoDisplay(value: string, zohoType: ZohoDataType): string;
```

---

## 📊 Données à propager

### Structure enrichie pour l'UI

```typescript
interface TransformPreviewData {
  columns: TransformPreviewColumn[];
}

interface TransformPreviewColumn {
  name: string;
  
  // Mapping Zoho
  zohoColumn?: string;
  zohoType?: ZohoDataType;
  zohoExample?: string;  // Valeur existante dans Zoho
  
  // Métadonnées Excel (si fichier Excel)
  excelFormat?: string;
  
  // Échantillons avec détails
  samples: TransformPreviewSample[];
  
  // Statut
  hasTransformation: boolean;
  transformationType?: string;
}

interface TransformPreviewSample {
  rowIndex: number;
  
  // Valeurs à chaque étape
  rawValue: unknown;           // cell.v - valeur brute
  excelDisplay?: string;       // cell.w - affichage Excel
  excelFormat?: string;        // cell.z - format Excel
  transformedValue: string;    // Après notre transformation
  zohoPreview: string;         // Prévision affichage Zoho
  
  // Statut
  status: 'unchanged' | 'transformed' | 'error';
  transformationApplied?: string;
}
```

---

## 📁 Fichiers à modifier (Phase 2)

| Fichier | Modification |
|---------|--------------|
| `lib/hooks/use-csv-parser.ts` | Extraire `cell.w` + conserver détails |
| `lib/domain/excel/date-converter.ts` | **NOUVEAU** - Helpers conversion dates |
| `components/import/wizard/step-transform-preview.tsx` | Nouvelle UI accordéon |
| `lib/domain/transformation/preview.ts` | Enrichir avec détails cellules |

---

## 🧪 Tests à effectuer

| Test | Fichier | Attendu |
|------|---------|---------|
| Import CSV | Tout CSV | Comportement inchangé |
| Import Excel dates | `REGT_04_a_12_2025.xlsx` | Dates affichées comme dans Excel |
| Accordéon | Excel avec dates | Détails v/w/z visibles |
| Prévision Zoho | Toute colonne date | Affichage prédit correct |

---

## 💡 Décisions prises

### 1. Transparence totale
L'utilisateur doit voir **tout le flux** de transformation, pas juste le résultat.

### 2. UI accordéon
Choix de l'accordéon plutôt que tooltip ou panneau latéral car :
- Fonctionne sur mobile
- L'utilisateur contrôle ce qu'il veut voir
- Pas de surcharge visuelle par défaut
- Accessible (pas besoin de hover)

### 3. Principe CSV = référence
Le flux CSV reste la baseline. Excel ajoute des informations supplémentaires mais ne change pas le comportement fondamental.

---

## 🔗 Fichiers modifiés (récapitulatif Phase 1)

| Fichier | Statut |
|---------|--------|
| `types/profiles.ts` | ✅ Modifié |
| `lib/hooks/use-csv-parser.ts` | ✅ Modifié (à compléter Phase 2) |
| `lib/domain/detection/type-detector.ts` | ✅ Modifié |
| `lib/domain/detection/index.ts` | ✅ Exports OK |
| `lib/infrastructure/zoho/types.ts` | ✅ Modifié |
| `lib/domain/schema-validator.ts` | ✅ Modifié |
| `components/import/wizard/step-profile.tsx` | ✅ Modifié |
| `components/import/wizard/step-resolve.tsx` | ✅ Modifié |
| `components/import/wizard/hooks/use-import-wizard-state.ts` | ✅ Modifié |
| `components/import/wizard/hooks/use-profile-management.ts` | ✅ Modifié |
| `components/import/wizard/import-wizard.tsx` | ✅ Modifié |

---

## 📎 Fichiers de test

- `REGT_04_a_12_2025.xlsx` - Excel avec dates comme nombres sériels
- `QUITTANCES 12 2025.xlsx` - Excel avec dates DD/MM/YYYY
- Export CSV de QUITTANCES - Pour tester la non-régression

---

*Mission 017 - Mise à jour le 2026-01-24*
