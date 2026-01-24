# Mission 017 : Exploitation des Métadonnées Excel pour la Détection de Types

*Date de création : 2026-01-24*
*Statut : 📋 À FAIRE*
*Prérequis : Mission 015 (UX Historique) terminée ✅*
*Priorité : Haute*
*Durée estimée : 3-4 heures*

---

## 📋 Contexte

### Problème rencontré
Lors de l'import du fichier `REGT_04_a_12_2025.xlsx`, l'application a crashé avec l'erreur :
```
TypeError: value.trim is not a function
```

**Cause** : La bibliothèque `xlsx` parse les fichiers Excel en conservant les types natifs JavaScript (number, boolean, Date), alors que le code attendait uniquement des strings (comme avec CSV/Papa Parse).

### Correction immédiate
Le fix du fichier `type-detector.ts` est inclus dans cette mission (Sprint 0). Il permet d'accepter des valeurs de tout type (`unknown`) et de les convertir en string pour l'analyse. Cette correction permet l'import mais **ne tire pas encore parti des métadonnées de format Excel**.

### Opportunité d'amélioration
Excel fournit des **métadonnées de format** riches qui pourraient :
- Réduire les ambiguïtés (ex: Excel sait si une date est JJ/MM ou MM/JJ)
- Guider l'utilisateur dans ses choix
- Améliorer la confiance dans la détection

---

## 🎯 Objectifs

### Objectif 1 : Extraire les métadonnées Excel
- Récupérer le type de cellule (`t`: string, number, date, boolean)
- Récupérer le format d'affichage (`z`: 'DD/MM/YYYY', '#,##0.00', etc.)
- Conserver la valeur formatée (`w`: texte affiché dans Excel)

### Objectif 2 : Enrichir la détection de types
- Utiliser les métadonnées Excel comme **suggestion** (pas comme vérité absolue)
- Garder la détection par pattern comme fallback pour CSV
- Propager l'information jusqu'à l'étape de résolution

### Objectif 3 : Améliorer l'UX de résolution des ambiguïtés
- Pré-sélectionner le format suggéré par Excel
- Afficher un message explicatif : "Excel indique le format XXX, confirmez-vous ?"
- Garder le flux identique pour CSV (pas de suggestion)

---

## 🔧 Analyse technique

### Structure d'une cellule xlsx

```javascript
// Cellule Excel complète
{
  v: 45722,           // value - valeur brute
  t: 'n',             // type - 'n'=number, 's'=string, 'd'=date, 'b'=boolean
  w: '05/03/2025',    // formatted text - texte affiché dans Excel
  z: 'DD/MM/YYYY'     // number format - format de la cellule
}
```

### Types de cellules xlsx

| Code | Type | Description |
|------|------|-------------|
| `s` | String | Texte |
| `n` | Number | Nombre (inclut les dates Excel comme nombre de jours) |
| `d` | Date | Date (si option `cellDates: true`) |
| `b` | Boolean | Booléen |
| `e` | Error | Erreur (#REF!, #N/A...) |

### Formats Excel courants

| Format Excel | Signification |
|--------------|---------------|
| `General` | Auto-détection |
| `@` | Texte forcé |
| `0` | Entier |
| `0.00` | Décimal 2 chiffres |
| `#,##0.00` | Nombre avec séparateurs milliers |
| `DD/MM/YYYY` ou `dd/mm/yyyy` | Date française |
| `MM/DD/YYYY` ou `mm/dd/yyyy` | Date américaine |
| `YYYY-MM-DD` | Date ISO |
| `HH:MM:SS` ou `hh:mm:ss` | Durée/Heure |

---

## 📝 Plan d'implémentation

### Sprint 0 : Fix type-detector pour types mixtes (prérequis)

**Problème** : Le fichier `type-detector.ts` crashe avec l'erreur `value.trim is not a function` quand xlsx retourne des valeurs non-string (nombres, dates, booléens).

**Solution** : Modifier `type-detector.ts` pour accepter `unknown` et convertir en string :

```typescript
// AVANT (crash si value n'est pas string)
private isEmpty(value: string): boolean {
  if (!value) return true;
  const normalized = value.trim().toLowerCase();
  return EMPTY_VALUES.has(normalized);
}

// APRÈS (gère tous les types)
private isEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  const strValue = String(value);
  if (strValue === '') return true;
  const normalized = strValue.trim().toLowerCase();
  return EMPTY_VALUES.has(normalized);
}
```

**Modifications** :
1. `detectColumns(data: Record<string, string>[])` → `Record<string, unknown>[]`
2. Nouvelle méthode `toStringValue(value: unknown): string`
3. `isEmpty(value: string)` → `isEmpty(value: unknown)`

Ce fix permet d'importer les fichiers Excel sans crash, en attendant l'exploitation des métadonnées.

### Sprint 1 : Extraction des métadonnées Excel

Modifier `lib/hooks/use-csv-parser.ts` :

```typescript
interface ParsedFileResult {
  data: Record<string, unknown>[];
  headers: string[];
  
  // NOUVEAU : Métadonnées Excel par colonne
  columnMetadata?: Record<string, ExcelColumnMeta>;
}

interface ExcelColumnMeta {
  // Type dominant de la colonne (le plus fréquent)
  dominantType: 'string' | 'number' | 'date' | 'boolean' | 'mixed';
  
  // Format Excel (si cohérent sur la colonne)
  excelFormat?: string;
  
  // Échantillon de valeurs formatées (w)
  formattedSamples: string[];
  
  // Fiabilité de l'info
  confidence: 'high' | 'medium' | 'low';
}
```

**Logique d'extraction** :
```typescript
function extractColumnMetadata(worksheet: XLSX.WorkSheet): Record<string, ExcelColumnMeta> {
  // 1. Parcourir les cellules de chaque colonne
  // 2. Collecter les types (t) et formats (z)
  // 3. Déterminer le type/format dominant
  // 4. Calculer la confiance (high si >90% cohérent)
}
```

### Sprint 2 : Propagation vers type-detector

Modifier `lib/domain/detection/type-detector.ts` :

```typescript
interface DetectionOptions {
  // Métadonnées Excel (optionnel, absent pour CSV)
  excelMetadata?: Record<string, ExcelColumnMeta>;
}

function detectColumnTypes(
  data: Record<string, unknown>[],
  options?: DetectionOptions
): DetectedColumn[] {
  // Si métadonnées Excel disponibles, les utiliser comme hint
}
```

**Enrichir `DetectedColumn`** :
```typescript
interface DetectedColumn {
  // ... champs existants ...
  
  // NOUVEAU : Suggestion Excel
  excelHint?: {
    suggestedFormat: string;      // Format normalisé ('DD/MM/YYYY')
    rawExcelFormat: string;       // Format brut Excel ('dd/mm/yyyy')
    confidence: 'high' | 'medium' | 'low';
  };
}
```

### Sprint 3 : Enrichir ResolvableIssue

Modifier les types dans `lib/infrastructure/zoho/types.ts` :

```typescript
interface ResolvableIssue {
  type: 'ambiguous_date_format' | 'scientific_notation' | 'iso_date';
  column: string;
  samples: string[];
  
  // NOUVEAU : Hint Excel pour guider l'utilisateur
  excelHint?: {
    suggestedFormat: string;
    rawExcelFormat: string;
    confidence: 'high' | 'medium' | 'low';
  };
}
```

### Sprint 4 : Modifier l'UI de résolution

Modifier `components/import/wizard/step-resolve.tsx` :

**Cas CSV (inchangé)** :
```tsx
<div className="space-y-2">
  <p>La colonne "{issue.column}" contient des dates ambiguës.</p>
  <RadioGroup>
    <RadioGroupItem value="DD/MM/YYYY" />
    <RadioGroupItem value="MM/DD/YYYY" />
  </RadioGroup>
</div>
```

**Cas Excel (avec hint)** :
```tsx
<div className="space-y-2">
  <p>La colonne "{issue.column}" contient des dates ambiguës.</p>
  
  {issue.excelHint && (
    <Alert variant="info" className="mb-4">
      <Lightbulb className="h-4 w-4" />
      <AlertDescription>
        Excel indique que cette colonne utilise le format 
        <strong> {issue.excelHint.suggestedFormat}</strong>.
        Confirmez-vous ce format ?
      </AlertDescription>
    </Alert>
  )}
  
  <RadioGroup defaultValue={issue.excelHint?.suggestedFormat}>
    <RadioGroupItem value="DD/MM/YYYY">
      JJ/MM/AAAA {issue.excelHint?.suggestedFormat === 'DD/MM/YYYY' && '← Suggéré par Excel'}
    </RadioGroupItem>
    <RadioGroupItem value="MM/DD/YYYY">
      MM/JJ/AAAA
    </RadioGroupItem>
  </RadioGroup>
</div>
```

### Sprint 5 : Tests et validation

1. **Test CSV** : Vérifier que le comportement est inchangé
2. **Test Excel avec format explicite** : Date DD/MM/YYYY, nombres formatés
3. **Test Excel avec format ambigu** : Date sans format clair
4. **Test Excel mixte** : Colonnes avec formats variés

---

## 📊 Critères de succès

| Critère | Attendu |
|---------|---------|
| Import CSV fonctionne (régression) | ✅ |
| Import Excel fonctionne | ✅ |
| Métadonnées Excel extraites | ✅ |
| Hint Excel affiché dans résolution | ✅ |
| Format Excel pré-sélectionné | ✅ |
| Utilisateur confirme toujours (explicite) | ✅ |
| Profil sauvegarde le choix final | ✅ |

---

## 🔗 Fichiers concernés

| Fichier | Modification |
|---------|--------------|
| `lib/hooks/use-csv-parser.ts` | Extraction métadonnées Excel |
| `lib/domain/detection/type-detector.ts` | Accepter et propager les hints |
| `lib/domain/detection/index.ts` | Export des nouveaux types |
| `lib/infrastructure/zoho/types.ts` | Enrichir ResolvableIssue |
| `components/import/wizard/step-profile.tsx` | Passer les métadonnées |
| `components/import/wizard/step-resolve.tsx` | Afficher les suggestions Excel |
| `types/index.ts` | Nouveaux types ExcelColumnMeta |

---

## 💡 Principes à respecter

### 1. Explicite plutôt qu'implicite
- L'utilisateur **confirme toujours** le format
- Excel **suggère**, ne décide pas
- Le choix final est **tracé** (source: 'user_confirmed')

### 2. CSV = référence
- Le flux CSV reste la baseline
- Excel ajoute des **informations supplémentaires**
- Pas de chemin différent, juste des hints en plus

### 3. Dégradation gracieuse
- Si métadonnées Excel absentes → comportement CSV
- Si format Excel incohérent → ignorer le hint
- Si confiance faible → ne pas pré-sélectionner

---

## 🔄 Flux comparatif

```
CSV:
Upload → Parse → Detect (patterns) → Ambiguïté? → [User choisit] → Transform

Excel:
Upload → Parse+Metadata → Detect (patterns+hints) → Ambiguïté? → [User confirme hint] → Transform
                ↑                      ↑                              ↑
           Extraction           Hint propagé              Hint affiché + pré-sélectionné
```

---

## 📎 Fichiers de test

- `QUITTANCES 12 2025.xlsx` - Excel avec dates DD/MM/YYYY
- `REGT_04_a_12_2025.xlsx` - Excel avec types mixtes
- Export CSV de QUITTANCES - Pour tester la non-régression

---

## 🔗 Dépendances

- Mission 015 (UX Historique) : Terminée ✅
- Mission 016 (Persistance wizard) : Indépendante, peut être faite avant ou après

---

*Mission 017 - Spécification créée le 2026-01-24*
