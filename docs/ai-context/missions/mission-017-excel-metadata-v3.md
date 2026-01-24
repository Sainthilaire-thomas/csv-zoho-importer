# Mission 017 : Exploitation des Métadonnées Excel pour la Détection de Types

*Date de création : 2026-01-24*
*Dernière mise à jour : 2026-01-24*
*Statut : ✅ PHASE 1 TERMINÉE - Phase 2 UI à faire*
*Prérequis : Mission 015 (UX Historique) terminée ✅*
*Priorité : Haute*

---

## 1. Contexte

### 1.1 Problème initial
Lors de l'import du fichier `REGT_04_a_12_2025.xlsx`, l'application crashait avec l'erreur :
```
TypeError: value.trim is not a function
```

**Cause** : La bibliothèque `xlsx` parse les fichiers Excel en conservant les types natifs JavaScript (number, boolean, Date), alors que le code attendait uniquement des strings (comme avec CSV/Papa Parse).

### 1.2 Problème découvert pendant l'implémentation
Les dates Excel sont stockées comme des **nombres sériels** (ex: `45088.98` = 11/06/2023). De plus, xlsx génère un format américain (`m/d/yy`) et un affichage incorrect (`w: "6/11/23"`) pour les cellules au format "Standard".

### 1.3 Découverte clé : Formats locale-aware
Le format `m/d/yy` dans Excel est un **format locale-aware** : il s'adapte aux paramètres régionaux de Windows. xlsx ne le sait pas et l'interprète toujours littéralement (américain).

| Élément | Valeur | Fiabilité |
|---------|--------|-----------|
| `v` (valeur brute) | `45088.98` | ✅ Fiable |
| `z` (format Excel) | `m/d/yy h:mm` | ℹ️ Indique que c'est une date |
| `w` (affiché par xlsx) | `6/11/23 23:35` | ❌ Non fiable (format US) |
| Affiché dans Excel FR | `11/06/2023 23:35` | ✅ Ce que l'utilisateur voit |

---

## 2. Objectifs

### 2.1 Objectif principal : Transparence totale
L'utilisateur doit comprendre **exactement** comment ses données seront transformées :
- Voir la **valeur brute** stockée dans le fichier
- Voir ce qu'il **voit dans Excel** (interprétation locale)
- Voir le **format Excel** appliqué
- Voir ce qui sera **envoyé à Zoho**
- Voir la **prévision d'affichage** dans Zoho

### 2.2 Principe fondamental
> "Explicite plutôt qu'implicite" - Toutes les transformations doivent être explicitées.

---

## 3. Solution implémentée (Phase 1)

### 3.1 Logique de parsing Excel

```
Si z contient un format date locale-aware (m/d/yy, etc.) :
    → C'est une date
    → Ignorer w (incorrect car généré en US par xlsx)
    → Convertir v (nombre sériel) en format français DD/MM/YYYY

Si z est "General" :
    → C'est un nombre normal (montant, ID)
    → Garder v tel quel

Sinon :
    → Utiliser w si disponible (format explicite fiable)
```

### 3.2 Règles de détection d'ambiguïté des dates

Une **date est ambiguë** si les deux premiers nombres (jour et mois) sont tous deux ≤ 12 :
- `11/06/2023` → 11 ≤ 12 ET 6 ≤ 12 → **Ambigu** (11 juin ou 6 novembre ?)
- `03/08/2023` → 3 ≤ 12 ET 8 ≤ 12 → **Ambigu** (3 août ou 8 mars ?)
- `25/12/2023` → 25 > 12 → **Non ambigu** (forcément 25 décembre)

Une **colonne est ambiguë** si plus de 50% de ses dates sont ambiguës.

**Fix appliqué** : Le pattern regex accepte maintenant les dates avec heure :
- Avant : `/^(\d{1,2})\/(\d{1,2})\/\d{2,4}$/` (exigeait fin de chaîne)
- Après : `/^(\d{1,2})\/(\d{1,2})\/\d{2,4}/` (accepte texte après)

---

## 4. Travaux réalisés (Phase 1) ✅

### 4.1 Types enrichis
**Fichier : `types/profiles.ts`**
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

### 4.2 Extraction métadonnées Excel
**Fichier : `lib/hooks/use-csv-parser.ts`**
- `ParseResult` inclut `columnMetadata?: Record<string, ExcelColumnMeta>`
- Fonction `extractColumnMetadata(worksheet)` extrait les infos de chaque colonne
- Fonction `isLocaleAwareDateFormat(format)` détecte les formats locale-aware
- Fonction `excelSerialToDateString(serial, format)` convertit en DD/MM/YYYY

### 4.3 Type detector modifié
**Fichier : `lib/domain/detection/type-detector.ts`**
- `detectColumns()` accepte `Record<string, unknown>[]`
- Nouvelle méthode `toStringValue(value: unknown)` pour convertir tous types en string
- Accepte `DetectionOptions` avec `excelMetadata` optionnel
- Propage `excelHint` vers `DetectedColumn` quand pertinent
- Fix regex ambiguïté pour dates avec heure

### 4.4 Propagation dans le wizard
**Fichiers modifiés :**
- `use-import-wizard-state.ts` : Ajout de `columnMetadata` dans `SchemaState`
- `import-wizard.tsx` : Stocke `columnMetadata` lors du parsing
- `step-profile.tsx` : Passe `columnMetadata` à `detectColumnTypes`
- `use-profile-management.ts` : Stocke les `detectedColumns`

### 4.5 Issues enrichies
**Fichier : `lib/infrastructure/zoho/types.ts`**
- `ResolvableIssue` inclut maintenant `excelHint?`

**Fichier : `lib/domain/schema-validator.ts`**
- `detectResolvableIssues()` propage `excelHint` depuis `detectedColumns`

### 4.6 UI de résolution avec hint Excel
**Fichier : `components/import/wizard/step-resolve.tsx`**
- `DateFormatResolver` affiche la suggestion Excel si disponible
- Pré-sélectionne le format suggéré (si confiance haute)
- Indicateur visuel "← Suggéré par Excel"

---

## 5. Résultats Phase 1

### Avant
- ❌ Crash `value.trim is not a function`
- ❌ Dates affichées comme nombres sériels (`45088.98`)
- ❌ 5 faux positifs "ambiguous_date_format" (dont montants)
- ❌ Dates avec heure non détectées comme ambiguës

### Après
- ✅ Import Excel fonctionne
- ✅ Dates en format français `11/06/2023`
- ✅ Montants restent des nombres (110, 100, 150)
- ✅ 3 vraies ambiguïtés détectées (date_pv, Date du PV, Date du règlement)
- ✅ Suggestions Excel affichées dans l'UI

---

## 6. Phase 2 : UI Transparence Totale (À faire)

### 6.1 La chaîne complète de transformation

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ 1. FICHIER EXCEL (stocké)                                                       │
│    v (valeur brute) : 45088.98                                                  │
│    z (format)       : m/d/yy h:mm                                               │
│                                                                                 │
│ 2. INTERPRÉTATION LOCALE (Windows FR)                                           │
│    Le format "m/d/yy" est un format local → interprété comme DD/MM/YYYY         │
│    Affichage Excel : 11/06/2023 23:35                                           │
│                                                                                 │
│ 3. CE QUE XLSX GÉNÈRE (⚠️ incorrectement)                                       │
│    w : "6/11/23 23:35" (xlsx lit m/d/yy littéralement)                          │
│                                                                                 │
│ 4. NOTRE TRANSFORMATION                                                         │
│    On convertit v=45088.98 en format français → "11/06/2023 23:35"              │
│                                                                                 │
│ 5. ENVOYÉ À ZOHO                                                                │
│    Format ISO : "2023-06-11 23:35:00"                                           │
│                                                                                 │
│ 6. AFFICHÉ DANS ZOHO                                                            │
│    Zoho formate selon son type DATE : "11 Jun, 2023 23:35:00"                   │
│                                                                                 │
│ 7. EXEMPLE EXISTANT DANS ZOHO (référence)                                       │
│    Une donnée déjà importée : "09 Feb, 2022 08:40:00"                           │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 6.2 UI Accordéon proposée

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ Colonne : date_pv                                    Type Zoho : DATE           │
├─────────────────────────────────────────────────────────────────────────────────┤
│ ▼ Ligne 1                                                                       │
│   ┌───────────────────────────────────────────────────────────────────────────┐ │
│   │ 📄 Source Excel                                                           │ │
│   │    Valeur brute (v)     : 45088.98263888889                               │ │
│   │    Format Excel (z)     : m/d/yy h:mm                                     │ │
│   │    ℹ️ Ce format est "locale-aware" → interprété selon Windows             │ │
│   │                                                                           │ │
│   │ 🖥️ Affichage Excel (sur ton PC FR)                                        │ │
│   │    Tu vois              : 11/06/2023 23:35                                │ │
│   │    ⚠️ xlsx génère (w)   : 6/11/23 23:35 (incorrect, ignoré)              │ │
│   │                                                                           │ │
│   │ 🔄 Transformation                                                         │ │
│   │    Règle appliquée      : DD/MM/YYYY (français) → ISO                     │ │
│   │    Valeur transformée   : 2023-06-11 23:35:00                             │ │
│   │                                                                           │ │
│   │ ☁️ Zoho Analytics                                                         │ │
│   │    Envoyé               : 2023-06-11 23:35:00                             │ │
│   │    Sera affiché         : 11 Jun, 2023 23:35:00                           │ │
│   │    Exemple existant     : 09 Feb, 2022 08:40:00                           │ │
│   └───────────────────────────────────────────────────────────────────────────┘ │
│ ▶ Ligne 2                                                                       │
│ ▶ Ligne 3                                                                       │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 6.3 Pourquoi l'accordéon ?

| Critère | Accordéon | Tooltip | Panneau latéral |
|---------|-----------|---------|-----------------|
| Mobile | ✅ Fonctionne | ❌ Hover impossible | ⚠️ Espace limité |
| Contrôle utilisateur | ✅ Explicite | ❌ Automatique | ✅ Explicite |
| Surcharge visuelle | ✅ Minimale | ✅ Minimale | ⚠️ Toujours visible |
| Accessibilité | ✅ Pas de hover | ❌ Requiert hover | ✅ Pas de hover |

### 6.4 Structure de données pour l'UI

```typescript
interface CellDebugInfo {
  // Source Excel
  v: unknown;              // Valeur brute
  z?: string;              // Format Excel
  w?: string;              // Ce que xlsx génère (peut être faux)
  
  // Interprétation
  isLocaleAwareFormat: boolean;  // true si z est "m/d/yy" etc.
  localInterpretation?: string;  // "11/06/2023 23:35" (ce que l'user voit dans Excel)
  
  // Transformation
  transformedValue: string;      // Après notre transformation
  transformationRule?: string;   // "DD/MM/YYYY → ISO"
  
  // Zoho
  zohoValue: string;             // Ce qu'on envoie
  zohoDisplay?: string;          // Prévision affichage Zoho
}

interface TransformPreviewSample {
  rowIndex: number;
  rawValue: unknown;           // cell.v
  excelDisplay?: string;       // cell.w (pour info, peut être faux)
  excelFormat?: string;        // cell.z
  transformedValue: string;    // Après transformation
  zohoPreview: string;         // Prévision affichage Zoho
  status: 'unchanged' | 'transformed' | 'error';
}
```

### 6.5 Fichiers à modifier (Phase 2)

| Fichier | Modification |
|---------|--------------|
| `lib/hooks/use-csv-parser.ts` | Exposer `CellDebugInfo` par cellule |
| `lib/domain/excel/date-converter.ts` | **NOUVEAU** - Helpers `predictZohoDisplay()` |
| `components/import/wizard/step-transform-preview.tsx` | Nouvelle UI accordéon |

---

## 7. Fichiers modifiés (récapitulatif)

| Fichier | Phase 1 | Phase 2 |
|---------|---------|---------|
| `types/profiles.ts` | ✅ | - |
| `lib/hooks/use-csv-parser.ts` | ✅ | 🔜 |
| `lib/domain/detection/type-detector.ts` | ✅ | - |
| `lib/infrastructure/zoho/types.ts` | ✅ | - |
| `lib/domain/schema-validator.ts` | ✅ | - |
| `components/import/wizard/step-profile.tsx` | ✅ | - |
| `components/import/wizard/step-resolve.tsx` | ✅ | - |
| `components/import/wizard/hooks/use-import-wizard-state.ts` | ✅ | - |
| `components/import/wizard/hooks/use-profile-management.ts` | ✅ | - |
| `components/import/wizard/import-wizard.tsx` | ✅ | - |
| `components/import/wizard/step-transform-preview.tsx` | - | 🔜 |
| `lib/domain/excel/date-converter.ts` | - | 🔜 **NOUVEAU** |

---

## 8. Tests à effectuer

| Test | Fichier | Attendu | Phase 1 |
|------|---------|---------|---------|
| Import CSV | Tout CSV | Comportement inchangé | ✅ |
| Import Excel dates | `REGT_04_a_12_2025.xlsx` | Dates en français | ✅ |
| Montants non convertis | `REGT_04_a_12_2025.xlsx` | Nombres restent nombres | ✅ |
| Ambiguïté dates avec heure | `date_pv` | Détectée comme ambiguë | ✅ |
| Hint Excel affiché | Excel avec dates | Suggestion visible | ✅ |
| UI Accordéon | Excel avec dates | Détails v/w/z visibles | 🔜 Phase 2 |

---

## 9. Principes respectés

1. **Explicite > Implicite** : Excel suggère, l'utilisateur confirme toujours
2. **CSV = baseline** : Flux CSV inchangé, Excel ajoute des hints optionnels
3. **Dégradation gracieuse** : Absence de métadonnées → comportement CSV standard
4. **Contexte français** : Formats locale-aware interprétés en DD/MM/YYYY
5. **Transparence totale** : L'utilisateur voit tout le flux de transformation

---

## 10. Commandes de commit

```powershell
cd "C:\Users\thoma\OneDrive\SONEAR_2025\csv-zoho-importer"
git add -A
git status
git commit -m "feat(excel): exploitation métadonnées Excel pour détection types (Mission 017 Phase 1)

- Fix crash value.trim pour types natifs Excel (number/boolean/Date)
- Extraction métadonnées Excel (v, w, z) par colonne
- Détection formats locale-aware (m/d/yy) et conversion en français DD/MM/YYYY
- Les montants (format General) restent des nombres (pas de faux positifs)
- Hints Excel propagés jusqu'à l'UI de résolution
- Fix regex pour détecter ambiguïté des dates avec heure

Phase 2 à faire: UI accordéon pour transparence totale"
```

---

*Mission 017 Phase 1 - Terminée le 2026-01-24*
*Phase 2 (UI Accordéon) - À planifier*
