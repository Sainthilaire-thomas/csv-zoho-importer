# Mission 010 - UX Transformation et Vérification

## 📋 Objectif

Améliorer l'expérience utilisateur pour :
1. Visualiser clairement les transformations de données (Excel → Zoho)
2. Comparer correctement les données après import (formats différents mais valeurs identiques)
3. Respecter les espaces dans les textes (demande client)

---

## 🎯 Contexte

### Problème actuel

1. **Comparaison des dates** : Zoho affiche `"04 Apr, 2025 00:00:00"` mais on envoie `"2025-04-04"`. L'utilisateur ne comprend pas que c'est la même valeur.

2. **Trim automatique non souhaité** : Les espaces dans les textes sont supprimés automatiquement, mais le client a des filtres Zoho qui dépendent de ces espaces (ex: `"BUS                   "`).

3. **Manque de clarté** : L'utilisateur ne voit pas clairement le flux : Fichier → Transformation → Envoi → Affichage Zoho.

### Solution proposée

Améliorer l'affichage avec des colonnes explicites :
- **📄 Fichier Excel** : Valeur brute source
- **🔄 Sera envoyé à Zoho** : Après transformation
- **👁️ Zoho affichera** : Format d'affichage prévu
- **📥 Zoho a affiché** : Valeur vérifiée après import
- **🔍 Interprétation** : Explication humaine (identique, différent, anomalie)

---

## 🏃 Sprint 1 : Correction du trim automatique (Bug fix prioritaire)

### Objectif
Supprimer le trim automatique des textes pour préserver les espaces, **tout en restant compatible avec la Mission 009** (qui corrigeait le bug des `\n` cassant le CSV).

### ⚠️ Compatibilité Mission 009

La Mission 009 a introduit le nettoyage des `\r\n` pour éviter l'erreur :
```
"TEL-26-01-3587" - ERREUR : Valeur Date non valide
```

**Ce qu'on garde** : `value.replace(/[\r\n]+/g, ' ')` → Les sauts de ligne sont remplacés par des espaces
**Ce qu'on supprime** : `.trim()` → Les espaces en début/fin sont préservés

### Fichiers à modifier

#### 1. `lib/domain/data-transformer.ts`

**Ligne ~247** - Fonction `applyAllTransformations()` :
```typescript
// AVANT (Mission 009)
let cleaned = value.replace(/[\r\n]+/g, ' ').trim();

// APRÈS (Compatible 009 + 010) - Supprimer uniquement le .trim()
let cleaned = value.replace(/[\r\n]+/g, ' ');
// ✅ Les \r\n sont toujours remplacés (évite bug CSV - Mission 009)
// ✅ Les espaces début/fin sont préservés (demande client - Mission 010)
```

**Ligne ~206** - Case 'none' dans `transformValue()` :
```typescript
// AVANT
case 'none':
default:
  return { success: true, value: trimmed };

// APRÈS - Garder la valeur après remplacement \r\n mais sans trim
case 'none':
default:
  // Remplacer les sauts de ligne mais préserver les espaces
  const withoutNewlines = String(value).replace(/[\r\n]+/g, ' ');
  return { success: true, value: withoutNewlines };
```

#### 2. `lib/domain/schema-validator.ts`

**Ligne ~420** - Fonction `getTransformNeeded()` :
```typescript
// AVANT
if (fileType === 'string') {
  return 'trim';
}

// APRÈS - Ne plus proposer trim automatiquement
if (fileType === 'string') {
  return 'none';  // Préserver les espaces
}
```

### Récapitulatif des comportements

| Valeur source | Après Mission 009 | Après Mission 010 |
|---------------|-------------------|-------------------|
| `"BUS\n"` | `"BUS"` | `"BUS "` |
| `"  BUS  "` | `"BUS"` | `"  BUS  "` |
| `"Ligne1\nLigne2"` | `"Ligne1 Ligne2"` | `"Ligne1 Ligne2"` |
| `"\nTEL-26-01"` | `"TEL-26-01"` | `" TEL-26-01"` |

### Tests à effectuer
- [ ] Importer un fichier avec des valeurs contenant des espaces (ex: `"BUS                   "`)
- [ ] Vérifier que les espaces sont préservés dans Zoho
- [ ] Vérifier que les sauts de ligne `\r\n` sont toujours remplacés par des espaces
- [ ] **Test de non-régression** : Importer un fichier avec `\n` dans une cellule → ne doit pas créer d'erreur "Valeur Date non valide"

### Critères de validation
- ✅ Les espaces dans les textes sont préservés
- ✅ Les sauts de ligne sont convertis en espaces (évite les erreurs CSV - Mission 009)
- ✅ Les filtres Zoho existants continuent de fonctionner
- ✅ Pas de régression sur le bug de la Mission 009

---

## 🏃 Sprint 2 : Normalisation des dates pour comparaison

### Objectif
Permettre la comparaison correcte entre formats de date différents.

### Fichier à modifier

#### `lib/domain/verification/compare.ts`

**Ajouter une fonction de parsing de dates** (avant `normalizeValue`) :

```typescript
/**
 * Mapping des mois en anglais vers numéro
 */
const MONTH_MAP: Record<string, string> = {
  Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06',
  Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12',
};

/**
 * Tente de parser une chaîne comme date et retourne un format canonique YYYY-MM-DD
 * Gère plusieurs formats : ISO, Zoho, FR
 */
function tryParseDateToCanonical(str: string): string | null {
  if (!str || typeof str !== 'string') return null;
  
  const trimmed = str.trim();
  
  // Format ISO : 2025-04-04 ou 2025-04-04T00:00:00
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  }
  
  // Format Zoho : "04 Apr, 2025 00:00:00" ou "04 Apr, 2025"
  const zohoMatch = trimmed.match(/^(\d{2}) (\w{3}), (\d{4})/);
  if (zohoMatch) {
    const day = zohoMatch[1];
    const month = MONTH_MAP[zohoMatch[2]];
    const year = zohoMatch[3];
    if (month) {
      return `${year}-${month}-${day}`;
    }
  }
  
  // Format FR : 04/04/2025
  const frMatch = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (frMatch) {
    return `${frMatch[3]}-${frMatch[2]}-${frMatch[1]}`;
  }
  
  return null;
}
```

**Modifier `normalizeValue()`** :

```typescript
function normalizeValue(value: unknown): string {
  if (value === null || value === undefined) return '';

  let str = String(value).trim();

  // 1. NOUVEAU : Essayer de parser comme date
  const parsedDate = tryParseDateToCanonical(str);
  if (parsedDate) {
    return parsedDate;
  }

  // 2. Normaliser les nombres (code existant)
  const numMatch = str.match(/^-?\d+([.,]\d+)?$/);
  if (numMatch) {
    const num = parseFloat(str.replace(',', '.'));
    if (!isNaN(num)) {
      if (Number.isInteger(num)) {
        str = String(Math.round(num));
      } else {
        str = num.toFixed(6).replace(/\.?0+$/, '');
      }
    }
  }

  return str.toLowerCase();
}
```

### Tests à effectuer
- [ ] Comparer `"2025-04-04"` avec `"04 Apr, 2025 00:00:00"` → doit matcher
- [ ] Comparer `"2025-03-31"` avec `"31 Mar, 2025 00:00:00"` → doit matcher
- [ ] Comparer `"04/04/2025"` avec `"04 Apr, 2025"` → doit matcher

### Critères de validation
- ✅ Les dates en format ISO et format Zoho sont considérées identiques
- ✅ Pas de faux positifs "value_different" sur les dates

---

## 🏃 Sprint 3 : Amélioration de l'affichage Preview (avant import)

### Objectif
Afficher clairement les 3 colonnes : Excel → Transformé → Zoho affichera

### Fichier à modifier

#### `components/import/wizard/step-transform-preview.tsx`

**Modifier le header du tableau** :

```tsx
<thead>
  <tr>
    <th>Colonne</th>
    <th>📄 Fichier Excel</th>
    <th>🔄 Sera envoyé à Zoho</th>
    <th>👁️ Zoho affichera</th>
    <th>Statut</th>
  </tr>
</thead>
```

**Ajouter une fonction pour prédire l'affichage Zoho** :

```typescript
/**
 * Prédit comment Zoho affichera une valeur basé sur le type de colonne
 */
function predictZohoDisplay(value: string, zohoType: string | null): string {
  if (!value) return '';
  
  // Pour les dates, Zoho affiche en format "DD Mon, YYYY"
  if (zohoType === 'DATE' || zohoType === 'DATE_AS_DATE' || zohoType === 'DATE_TIME') {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (match) {
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const day = match[3];
      const month = months[parseInt(match[2], 10) - 1];
      const year = match[1];
      
      if (zohoType === 'DATE' || zohoType === 'DATE_AS_DATE') {
        return `${day} ${month}, ${year}`;
      } else {
        return `${day} ${month}, ${year} 00:00:00`;
      }
    }
  }
  
  return value;
}
```

**Modifier le rendu des lignes** :

```tsx
{relevantColumns.map((col) => {
  const originalValue = getOriginalValue(col.fileColumn, rowIndex);
  const transformedValue = getTransformedValue(col.fileColumn, rowIndex);
  const zohoPreview = predictZohoDisplay(transformedValue, col.zohoType);
  const isMatch = normalizeForComparison(transformedValue) === normalizeForComparison(zohoPreview);
  
  return (
    <tr key={col.fileColumn}>
      <td>{col.fileColumn}</td>
      <td className="font-mono text-sm">{originalValue}</td>
      <td className="font-mono text-sm">{transformedValue}</td>
      <td className="font-mono text-sm text-muted-foreground">{zohoPreview}</td>
      <td>{isMatch ? '✅ Prévu' : '⚠️ Attention'}</td>
    </tr>
  );
})}
```

### Critères de validation
- ✅ L'utilisateur voit les 3 colonnes clairement
- ✅ Le format Zoho prédit est affiché
- ✅ Une légende explique les colonnes

---

## 🏃 Sprint 4 : Amélioration de l'affichage Test Result (après import)

### Objectif
Afficher clairement : Envoyé → Zoho a affiché → Interprétation

### Fichier à modifier

#### `components/import/wizard/step-test-result.tsx`

**Modifier le composant `ComparedRowDetail`** :

```tsx
function ComparedRowDetail({ row, matchingColumn }: { row: ComparedRow; matchingColumn?: string }) {
  // ... code existant ...
  
  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Header avec légende */}
      <div className="bg-muted/50 p-3 border-b">
        <div className="flex gap-4 text-xs text-muted-foreground">
          <span>📤 <strong>Envoyé à Zoho</strong> : Ce qui a été envoyé</span>
          <span>📥 <strong>Zoho a affiché</strong> : Ce que Zoho a stocké</span>
          <span>🔍 <strong>Interprétation</strong> : Analyse de la correspondance</span>
        </div>
      </div>
      
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-muted/30">
            <th className="px-3 py-2 text-left">Colonne</th>
            <th className="px-3 py-2 text-left">📤 Envoyé à Zoho</th>
            <th className="px-3 py-2 text-left">📥 Zoho a affiché</th>
            <th className="px-3 py-2 text-left">🔍 Interprétation</th>
            <th className="px-3 py-2 text-center">Verdict</th>
          </tr>
        </thead>
        <tbody>
          {relevantColumns.map((col: ComparedColumn) => (
            <tr key={col.name} className={col.match ? '' : 'bg-red-50 dark:bg-red-900/10'}>
              <td className="px-3 py-2 font-medium">{col.name}</td>
              <td className="px-3 py-2 font-mono text-xs">{col.sentValue}</td>
              <td className="px-3 py-2 font-mono text-xs">{col.receivedValue}</td>
              <td className="px-3 py-2 text-xs">
                {getInterpretation(col)}
              </td>
              <td className="px-3 py-2 text-center">
                {col.match ? (
                  <span className="text-green-600">✅ Correct</span>
                ) : (
                  <span className="text-red-600">❌ Anomalie</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Génère une interprétation humaine de la comparaison
 */
function getInterpretation(col: ComparedColumn): string {
  if (col.match) {
    // Vérifier si les formats sont différents mais valeurs identiques
    if (col.sentValue !== col.receivedValue) {
      return `✅ Même valeur (formats différents)`;
    }
    return `✅ Identique`;
  }
  
  // Anomalies spécifiques
  switch (col.anomalyType) {
    case 'datetime_truncated':
      return `⚠️ Heure perdue (${col.sentValue} → ${col.receivedValue})`;
    case 'date_inverted':
      return `❌ Jour/mois inversés`;
    case 'truncated':
      return `❌ Texte tronqué`;
    case 'rounded':
      return `⚠️ Nombre arrondi`;
    case 'spaces_trimmed':
      return `⚠️ Espaces supprimés`;
    case 'value_missing':
      return `❌ Valeur manquante dans Zoho`;
    default:
      return `❌ Valeur différente`;
  }
}
```

### Critères de validation
- ✅ L'utilisateur comprend clairement ce qui a été envoyé vs reçu
- ✅ L'interprétation explique si c'est identique malgré le format différent
- ✅ Les anomalies sont clairement identifiées avec une explication

---

## 🏃 Sprint 5 : Ajout d'une ligne de référence Zoho (optionnel)

### Objectif
Récupérer une ligne existante de Zoho pour servir de référence visuelle.

### Fichiers à modifier

#### 1. `components/import/wizard/import-wizard.tsx`

**Ajouter un state pour les données de référence** :

```typescript
const [zohoReferenceRow, setZohoReferenceRow] = useState<Record<string, unknown> | null>(null);
```

**Récupérer une ligne de référence après sélection de la table** :

```typescript
const fetchZohoReferenceRow = useCallback(async (workspaceId: string, viewId: string) => {
  try {
    const response = await fetch(
      `/api/zoho/data?workspaceId=${workspaceId}&viewId=${viewId}&limit=1`
    );
    const data = await response.json();
    
    if (data.success && data.data && data.data.length > 0) {
      setZohoReferenceRow(data.data[0]);
      console.log('[Reference] Ligne Zoho de référence:', data.data[0]);
    }
  } catch (error) {
    console.error('[Reference] Erreur récupération référence:', error);
  }
}, []);
```

#### 2. `components/import/wizard/step-transform-preview.tsx`

**Ajouter une colonne "Exemple Zoho existant"** :

```tsx
<th>📋 Exemple Zoho existant</th>

// Dans le corps du tableau
<td className="font-mono text-xs text-muted-foreground">
  {zohoReferenceRow?.[col.zohoColumn] || '—'}
</td>
```

### Critères de validation
- ✅ Une ligne existante de Zoho est affichée comme référence
- ✅ L'utilisateur peut comparer visuellement ses données avec l'existant
- ✅ Si la table est vide, afficher "Aucune donnée existante"

---

## 📊 Récapitulatif des sprints

| Sprint | Priorité | Effort | Description |
|--------|----------|--------|-------------|
| **Sprint 1** | 🔴 Haute | 1h | Correction trim automatique |
| **Sprint 2** | 🔴 Haute | 2h | Normalisation dates pour comparaison |
| **Sprint 3** | 🟡 Moyenne | 3h | Amélioration affichage Preview |
| **Sprint 4** | 🟡 Moyenne | 3h | Amélioration affichage Test Result |
| **Sprint 5** | 🟢 Basse | 2h | Ligne de référence Zoho |

**Effort total estimé : ~11h**

---

## 🧪 Tests globaux à effectuer

### Scénario 1 : Import avec dates
- [ ] Fichier avec dates `04/04/2025` → transformé en `2025-04-04`
- [ ] Vérification : `"04 Apr, 2025 00:00:00"` matche avec `"2025-04-04"`

### Scénario 2 : Import avec textes et espaces
- [ ] Fichier avec `"BUS                   "` (espaces de padding)
- [ ] Les espaces sont préservés dans Zoho
- [ ] Les filtres Zoho existants fonctionnent

### Scénario 3 : Import avec datetime
- [ ] Fichier avec heure `23:59:35`
- [ ] Si colonne Zoho = DATE → alerte perte d'heure
- [ ] Si colonne Zoho = DATETIME → heure préservée

---

## 📝 Notes techniques

### Formats de date Zoho
- **DATE** : `"04 Apr, 2025"` ou `"04 Apr, 2025 00:00:00"`
- **DATETIME** : `"04 Apr, 2025 23:59:35"`
- **Format d'import** : `yyyy-MM-dd` (ISO)

### Comportement du trim
- **Sauts de ligne** (`\r\n`) : Toujours remplacés par espace (sinon casse le CSV)
- **Espaces en début/fin** : NE PLUS supprimer automatiquement
- **Espaces internes** : Préserver tels quels

---

*Mission créée le : 2025-01-19*
*Statut : 📋 À planifier*
