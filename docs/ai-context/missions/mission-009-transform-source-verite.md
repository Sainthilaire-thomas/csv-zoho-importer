# Mission 009 - Source de vérité unique pour les transformations

## Statut : ✅ COMPLETE

## Date : 2026-01-12

## Contexte

Lors de l'import d'un fichier Excel, une erreur Zoho apparaissait :
```
"TEL-26-01-3587" - ERREUR : Valeur Date non valide
```

Zoho interprétait des valeurs texte comme des dates.

## Analyse du problème

### Cause racine
1. Les données Excel contenaient des **retours à la ligne** (`\n`) dans certaines cellules
   - Exemple : colonne "Informations" avec valeur `"\nTEL-26-01-3587"`

2. La fonction `cleanCsvData()` dans `client.ts` faisait un `split('\n')` qui **cassait le CSV**
   - Le `\n` dans une valeur quotée créait une nouvelle ligne CSV
   - `TEL-26-01-3587` devenait la première colonne (Date) d'une ligne fantôme

3. **Désynchronisation** entre l'affichage preview et l'envoi à Zoho
   - Preview : affichait les données transformées (nettoyées)
   - Envoi : utilisait les données brutes via `Papa.unparse(parsedData)`

## Solution implémentée

### Principe : UNE SEULE SOURCE DE VÉRITÉ

Les données transformées sont appliquées **une seule fois** après le parsing, puis utilisées partout :
- Affichage preview
- Validation
- Envoi à Zoho

### Fichiers modifiés

#### 1. `lib/domain/data-transformer.ts`
Nouvelle fonction exportée :
```typescript
export function applyAllTransformations(
  data: Record<string, unknown>[],
  matchedColumns?: ColumnMapping[]
): Record<string, unknown>[]
```
- Nettoie les `\r\n` → espace
- Applique trim sur toutes les valeurs
- Applique les transformations spécifiques (date, durée, etc.)

#### 2. `components/import/wizard/import-wizard.tsx`
- Import de `applyAllTransformations`
- Dans `handleValidation()` : application des transformations après parsing
- Les données transformées sont stockées dans `parsedData`
- Tous les envois à Zoho utilisent désormais `parsedData` (déjà transformé)

#### 3. `lib/domain/verification/types.ts`
Nouveaux types d'anomalies :
```typescript
export type AnomalyType =
  | ...
  | 'datetime_truncated'  // Heure perdue (datetime → date)
  | 'spaces_trimmed'      // Espaces supprimés par Zoho
  | ...
```

Nouveaux messages :
- `datetime_truncated` : "Heure ignorée pour X (le fichier contient une date+heure, mais la colonne Zoho est de type DATE sans heure)"
- `spaces_trimmed` : "Espaces modifiés pour X (Zoho supprime les espaces autour des virgules/ponctuations)"

Ces anomalies sont classées en **warning** (pas critical).

#### 4. `lib/domain/verification/compare.ts`
Nouvelles fonctions de détection :
```typescript
function isDatetimeTruncatedToDate(sent: string, received: string): boolean
function isSpacesTrimmed(sent: string, received: string): boolean
```

Intégration dans `detectAnomalyType()` et `detectAnomaly()`.

#### 5. `components/import/wizard/step-test-result.tsx`
Nouveaux labels et couleurs dans `AnomalyBadge` :
- `datetime_truncated` : "Heure ignorée" (bleu)
- `spaces_trimmed` : "Espaces modifiés" (bleu)

## Tests effectués

1. ✅ Import du fichier Excel avec `\n` dans les cellules
2. ✅ Les valeurs `TEL-26-01-3587` sont correctement importées comme texte
3. ✅ L'anomalie "Heure ignorée" s'affiche pour les colonnes datetime → date
4. ✅ L'anomalie "Espaces modifiés" s'affiche pour `"QS, RS"` → `"QS,RS"`

## Bénéfices

1. **Fiabilité** : Ce que l'utilisateur voit = ce qui est envoyé
2. **Clarté** : Messages d'anomalies explicatifs (pas de "bug", juste des différences de format)
3. **Maintenabilité** : Transformations centralisées dans `data-transformer.ts`

## Leçons apprises

- Toujours avoir une **source de vérité unique** pour les données
- Ne pas faire de transformations "visuelles" séparées des transformations "réelles"
- Les retours à la ligne dans les cellules Excel sont un cas courant à gérer

## Commits suggérés

```bash
git add -A
git commit -m "feat(transform): source de vérité unique pour transformations

- Nouvelle fonction applyAllTransformations() centralisée
- Nettoyage des \\n dans les valeurs avant envoi
- Nouveaux types d'anomalies: datetime_truncated, spaces_trimmed
- Messages explicatifs pour différences Zoho vs fichier source

Fixes: erreur 'Valeur Date non valide' sur import Excel"
```
