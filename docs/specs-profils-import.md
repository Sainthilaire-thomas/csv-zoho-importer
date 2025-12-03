# Spécifications Fonctionnelles - Système de Profils d'Import

**Version:** 2.0  
**Date:** 1er décembre 2025  
**Projet:** CSV to Zoho Analytics Importer  
**Remplace:** specs-validation-avancee.md (approche par validation répétitive)

---

## 1. Vue d'ensemble

### 1.1 Concept central

Un **Profil d'Import** est une configuration attachée à une **table Zoho Analytics** qui définit :
- Comment interpréter les colonnes des fichiers sources
- Comment transformer les données vers un format universel
- Quels alias de noms de colonnes sont acceptés

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              PARADIGME                                       │
│                                                                              │
│   Fichiers Excel          PROFIL                    Table Zoho              │
│   (formats variables)     (normalisation)           (format fixe)           │
│                                                                              │
│   ┌─────────────┐                                   ┌─────────────┐         │
│   │ Fichier A   │───┐                          ┌───▶│ QUITTANCES  │         │
│   │ DD/MM/YYYY  │   │    ┌─────────────┐       │    │             │         │
│   └─────────────┘   │    │             │       │    │ YYYY-MM-DD  │         │
│                     ├───▶│   PROFIL    │───────┤    │ HH:mm:ss    │         │
│   ┌─────────────┐   │    │ QUITTANCES  │       │    │ 1234.56     │         │
│   │ Fichier B   │───┤    │             │       │    │             │         │
│   │ DD-MM-YYYY  │   │    └─────────────┘       │    └─────────────┘         │
│   └─────────────┘   │                          │                            │
│                     │                          │                            │
│   ┌─────────────┐   │                          │                            │
│   │ Fichier C   │───┘                          │                            │
│   │ Legacy      │                              │                            │
│   └─────────────┘                              │                            │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Principes directeurs

| Principe | Description |
|----------|-------------|
| **Un profil = Une table Zoho** | Le profil est lié à la destination, pas à la source |
| **Accumulation** | Le profil enrichit ses alias/formats au fil des imports |
| **Explicite** | L'utilisateur confirme les formats ambigus une seule fois |
| **Format universel** | Transformation vers un format intermédiaire standard |
| **Réutilisation** | Les fichiers legacy sont reconnus automatiquement |

### 1.3 Objectifs

- **Réduire le temps d'import** : Configuration une fois, réutilisation automatique
- **Éliminer les erreurs** : Format confirmé explicitement, pas de conversion silencieuse
- **Supporter les variations** : Fichiers de formats légèrement différents acceptés
- **Garantir la traçabilité** : Profil versionné et partagé entre utilisateurs

---

## 2. Formats universels (couche de normalisation)

### 2.1 Tableau des formats

| Type données | Formats sources acceptés | Format universel | Format Zoho |
|--------------|-------------------------|------------------|-------------|
| **Date** | DD/MM/YYYY, DD-MM-YYYY, MM/DD/YYYY, YYYY-MM-DD | `YYYY-MM-DD` (ISO 8601) | DATE_AS_DATE |
| **Durée** | HH:mm, H:mm, HH:mm:ss | `HH:mm:ss` | DURATION |
| **Nombre décimal** | 1234,56 / 1234.56 / 1 234,56 | `1234.56` (point décimal) | DECIMAL_NUMBER |
| **Nombre entier** | 1234 / 1 234 | `1234` | NUMBER, POSITIVE_NUMBER |
| **Scientifique** | 1E6, 2.5E3 | `1000000` (développé) | Texte ou Nombre |
| **Booléen** | Oui/Non, Yes/No, 1/0, Vrai/Faux | `true/false` | - |
| **Texte** | Tout | Trimmed, UTF-8 | PLAIN, MULTI_LINE |

### 2.2 Dates

#### Formats sources supportés

| Format | Exemple | Ambiguïté |
|--------|---------|-----------|
| DD/MM/YYYY | 05/03/2025 | ⚠️ 5 mars ou 3 mai ? |
| DD-MM-YYYY | 05-03-2025 | ⚠️ Même ambiguïté |
| MM/DD/YYYY | 03/05/2025 | ⚠️ Format US |
| YYYY-MM-DD | 2025-03-05 | ✅ Non ambigu (ISO) |
| DD/MM/YY | 05/03/25 | ⚠️ Siècle + jour/mois |
| D/M/YYYY | 5/3/2025 | ⚠️ Sans zéros |

#### Règle de confirmation

Si le format contient une ambiguïté jour/mois (valeurs ≤ 12 dans les deux positions), **l'utilisateur doit confirmer** lors de la création du profil.

```
Exemple : "05/03/2025"
→ Est-ce JJ/MM/AAAA (5 mars) ou MM/JJ/AAAA (3 mai) ?
→ Confirmation utilisateur requise
→ Mémorisé dans le profil pour les imports suivants
```

### 2.3 Durées

#### Formats sources supportés

| Format | Exemple | Transformation |
|--------|---------|----------------|
| HH:mm | 23:54 | → 23:54:00 |
| H:mm | 9:30 | → 09:30:00 |
| HH:mm:ss | 23:54:00 | → (tel quel) |
| Minutes | 1434 | → 23:54:00 |

#### Règle

Format universel : `HH:mm:ss` avec padding des zéros.

### 2.4 Nombres

#### Formats sources supportés

| Format | Exemple | Région | Transformation |
|--------|---------|--------|----------------|
| Point décimal | 1234.56 | US/UK | → 1234.56 |
| Virgule décimale | 1234,56 | FR/EU | → 1234.56 |
| Espace milliers + virgule | 1 234,56 | FR | → 1234.56 |
| Point milliers + virgule | 1.234,56 | DE | → 1234.56 |
| Virgule milliers + point | 1,234.56 | US | → 1234.56 |

#### Règle de détection

```typescript
// Heuristique de détection du format
function detectNumberFormat(value: string): NumberFormat {
  // Si contient virgule ET point
  if (value.includes(',') && value.includes('.')) {
    // Le dernier séparateur est le décimal
    const lastComma = value.lastIndexOf(',');
    const lastDot = value.lastIndexOf('.');
    return lastComma > lastDot ? 'fr' : 'us';
  }
  
  // Si contient espace comme séparateur milliers
  if (/\d\s\d/.test(value)) {
    return 'fr';  // 1 234,56
  }
  
  // Si une seule virgule avec 2 chiffres après
  if (/,\d{2}$/.test(value)) {
    return 'fr';  // 1234,56
  }
  
  return 'us';  // Par défaut
}
```

### 2.5 Notation scientifique

#### Cas d'usage

| Valeur fichier | Type Zoho cible | Action | Résultat |
|----------------|-----------------|--------|----------|
| 1E6 | PLAIN (texte) | Développer → texte | "1000000" |
| 1E6 | NUMBER | Développer → nombre | 1000000 |
| 2.5E3 | DECIMAL_NUMBER | Développer | 2500 |

#### Règle

La notation scientifique est **toujours développée**. Le type Zoho cible détermine si le résultat est texte ou nombre.

**Cas typique** : Excel convertit automatiquement les numéros de PV (ex: "1000000") en notation scientifique ("1E6"). L'import doit restaurer la valeur complète.

```
Excel affiche : 1E6
Ce qu'on importe : "1000000" (si PLAIN) ou 1000000 (si NUMBER)
```

### 2.6 Texte

#### Transformations automatiques

| Transformation | Exemple | Résultat |
|----------------|---------|----------|
| Trim | "  texte  " | "texte" |
| Valeurs vides | "N/A", "null", "-" | "" (vide) |
| Encodage | ISO-8859-1 | UTF-8 |

---

## 3. Structure du Profil

### 3.1 Modèle de données

```typescript
interface ImportProfile {
  id: string;
  
  // === IDENTIFICATION ===
  name: string;                    // "Import Quittances"
  description?: string;
  
  // === TABLE ZOHO CIBLE ===
  workspaceId: string;
  workspaceName: string;
  viewId: string;
  viewName: string;                // "QUITTANCES"
  
  // === CONFIGURATION DES COLONNES ===
  columns: ProfileColumn[];
  
  // === PARAMÈTRES IMPORT ===
  defaultImportMode: 'append' | 'truncateadd' | 'updateadd';
  
  // === MÉTADONNÉES ===
  createdAt: Date;
  createdBy: string;               // userId
  updatedAt: Date;
  lastUsedAt: Date;
  useCount: number;
}

interface ProfileColumn {
  id: string;
  
  // === COLONNE ZOHO (fixe) ===
  zohoColumn: string;              // Nom exact dans Zoho
  zohoType: ZohoDataType;          // DATE_AS_DATE, PLAIN, NUMBER...
  isRequired: boolean;             // Obligatoire dans Zoho
  
  // === NOMS ACCEPTÉS (accumulation) ===
  acceptedNames: string[];         // ["Date début", "Date de début", "DateDebut"]
  
  // === TYPE DE DONNÉES ===
  dataType: 'date' | 'duration' | 'number' | 'text' | 'boolean';
  
  // === CONFIGURATION SPÉCIFIQUE ===
  config: ColumnConfig;
}

type ColumnConfig = 
  | DateColumnConfig 
  | DurationColumnConfig 
  | NumberColumnConfig 
  | TextColumnConfig
  | BooleanColumnConfig;

interface DateColumnConfig {
  type: 'date';
  acceptedFormats: string[];       // ["DD/MM/YYYY", "DD-MM-YYYY"]
  outputFormat: 'iso';             // Toujours YYYY-MM-DD
  dayMonthOrder: 'dmy' | 'mdy';    // Confirmé par l'utilisateur
}

interface DurationColumnConfig {
  type: 'duration';
  acceptedFormats: string[];       // ["HH:mm", "HH:mm:ss"]
  outputFormat: 'hms';             // Toujours HH:mm:ss
}

interface NumberColumnConfig {
  type: 'number';
  acceptedFormats: NumberFormat[];
  outputFormat: 'standard';        // Point décimal, sans séparateur milliers
  expandScientific: boolean;       // true = 1E6 → 1000000
}

interface NumberFormat {
  decimalSeparator: ',' | '.';
  thousandSeparator: ' ' | '.' | ',' | null;
}

interface TextColumnConfig {
  type: 'text';
  trim: boolean;                   // Supprimer espaces début/fin
  emptyValues: string[];           // ["N/A", "null", "-"] → ""
  expandScientific: boolean;       // true = 1E6 → "1000000"
}

interface BooleanColumnConfig {
  type: 'boolean';
  trueValues: string[];            // ["Oui", "Yes", "1", "Vrai"]
  falseValues: string[];           // ["Non", "No", "0", "Faux"]
}
```

### 3.2 Stockage Supabase

```sql
-- Table des profils d'import
CREATE TABLE csv_importer.import_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Identification
  name TEXT NOT NULL,
  description TEXT,
  
  -- Table Zoho cible (UNIQUE par table)
  workspace_id TEXT NOT NULL,
  workspace_name TEXT NOT NULL,
  view_id TEXT NOT NULL UNIQUE,    -- Un seul profil par table Zoho
  view_name TEXT NOT NULL,
  
  -- Configuration des colonnes (JSON)
  columns JSONB NOT NULL,
  
  -- Paramètres par défaut
  default_import_mode TEXT DEFAULT 'append',
  
  -- Métadonnées
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,
  use_count INTEGER DEFAULT 0
);

-- Index pour recherche
CREATE INDEX idx_profiles_view_id ON csv_importer.import_profiles(view_id);
CREATE INDEX idx_profiles_workspace ON csv_importer.import_profiles(workspace_id);

-- RLS - Tous les utilisateurs authentifiés peuvent accéder
ALTER TABLE csv_importer.import_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage profiles" 
  ON csv_importer.import_profiles
  FOR ALL USING (auth.role() = 'authenticated');
```

---

## 4. Parcours utilisateur

### 4.1 Vue d'ensemble du flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           FLOW IMPORT AVEC PROFILS                           │
└─────────────────────────────────────────────────────────────────────────────┘

1. UPLOAD FICHIER
        │
        ▼
2. EXTRACTION COLONNES
   (noms + types détectés + exemples)
        │
        ▼
3. RECHERCHE PROFILS COMPATIBLES
   Pour chaque profil : compter colonnes matchées
        │
        ▼
4. PROPOSER MEILLEUR(S) MATCH(ES)
   "Ce fichier correspond à QUITTANCES (18/22 colonnes)"
        │
        ├─────────────────────────────────────────────┐
        │                                             │
        ▼                                             ▼
┌───────────────────┐                       ┌───────────────────┐
│  PROFIL TROUVÉ    │                       │  AUCUN PROFIL     │
│  (match > 0)      │                       │  (ou choix manuel)│
└─────────┬─────────┘                       └─────────┬─────────┘
          │                                           │
          ▼                                           ▼
5a. AFFICHER MAPPING                        5b. SÉLECTION TABLE
    Colonnes matchées ✓                         + CRÉATION PROFIL
    Colonnes à confirmer ⚠️                     (assistant complet)
    Nouvelles colonnes ➕                              │
          │                                           │
          ▼                                           │
6. CONFIRMATION UTILISATEUR ◄─────────────────────────┘
   (si colonnes à confirmer)
          │
          ▼
7. MISE À JOUR PROFIL
   (nouveaux alias/formats mémorisés)
          │
          ▼
8. TRANSFORMATION DONNÉES
   (selon règles du profil)
          │
          ▼
9. PRÉVISUALISATION + IMPORT
          │
          ▼
10. RAPPORT FINAL
```

### 4.2 Scénario 1 : Premier import (création de profil)

#### Étape 1 : Upload fichier

L'utilisateur uploade un fichier Excel/CSV.

#### Étape 2 : Sélection de la table Zoho

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  📁 Fichier : QUITTANCES_01122025.xlsx (14 lignes, 22 colonnes)             │
│                                                                              │
│  Aucun profil existant ne correspond à ce fichier.                          │
│                                                                              │
│  Dans quelle table Zoho importer ces données ?                              │
│                                                                              │
│  🔍 Rechercher...                                                           │
│                                                                              │
│  📁 INDICATEURS GENERAUX                                                    │
│     ├── 📊 QUITTANCES                                                       │
│     ├── 📊 RECETTES                                                         │
│     └── 📊 STATISTIQUES                                                     │
│  📁 ARCHIVES                                                                │
│     └── 📊 QUITTANCES_2024                                                  │
│                                                                              │
│                              [Annuler]  [Sélectionner ▶]                    │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### Étape 3 : Configuration des colonnes (assistant)

Pour chaque colonne, l'utilisateur confirme le mapping et le format :

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Configuration du profil - QUITTANCES                                        │
│  Colonne 1/22                                                                │
│                                                                              │
│  ┌────────────────────────────┐    ┌────────────────────────────┐           │
│  │ 📄 FICHIER                 │    │ 🎯 ZOHO                    │           │
│  │                            │    │                            │           │
│  │ Nom : "Date début"         │    │ Colonne : [Date début ▼]   │           │
│  │ Type détecté : Date        │    │ Type : DATE_AS_DATE        │           │
│  │ Exemples :                 │    │                            │           │
│  │   • 05/03/2025             │    │ Format attendu :           │           │
│  │   • 12/03/2025             │    │ YYYY-MM-DD                 │           │
│  │   • 28/02/2025             │    │                            │           │
│  └────────────────────────────┘    └────────────────────────────┘           │
│                                                                              │
│  Comment interpréter "05/03/2025" ?                                         │
│  ● JJ/MM/AAAA (5 mars 2025)                                                 │
│  ○ MM/JJ/AAAA (3 mai 2025)                                                  │
│                                                                              │
│  Transformation : 05/03/2025 → 2025-03-05                                   │
│                                                                              │
│              [◀ Précédent]  [Suivant ▶]  [Passer les colonnes simples]      │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Note** : Les colonnes sans ambiguïté (texte simple, nombres non ambigus) peuvent être validées automatiquement avec option "Passer les colonnes simples".

#### Étape 4 : Récapitulatif et nom du profil

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Récapitulatif du profil                                                     │
│                                                                              │
│  Nom du profil : [Import Quittances                    ]                    │
│                                                                              │
│  Table cible : QUITTANCES                                                   │
│  Colonnes configurées : 22                                                  │
│                                                                              │
│  Transformations qui seront appliquées :                                    │
│  ───────────────────────────────────────────────────────────────────────    │
│  • Date début : JJ/MM/AAAA → ISO                                            │
│  • Date fin : JJ/MM/AAAA → ISO                                              │
│  • Heure début : HH:mm → HH:mm:ss                                           │
│  • Heure fin : HH:mm → HH:mm:ss                                             │
│  • Montant HT : Virgule → Point décimal                                     │
│  • CB : Virgule → Point décimal                                             │
│  • 16 colonnes : Sans transformation                                        │
│                                                                              │
│  ☑ Mémoriser ce profil pour les prochains imports                           │
│                                                                              │
│              [◀ Modifier]  [Créer le profil et importer ▶]                  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4.3 Scénario 2 : Import récurrent (profil existant, match parfait)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  ✅ Fichier reconnu                                                          │
│                                                                              │
│  📁 QUITTANCES_02122025.xlsx (18 lignes, 22 colonnes)                       │
│                                                                              │
│  Profil : "Import Quittances"                                               │
│  Table : QUITTANCES                                                         │
│  Dernière utilisation : hier (14 lignes importées)                          │
│                                                                              │
│  ✓ 22/22 colonnes reconnues                                                 │
│  ✓ Formats identiques au profil                                             │
│                                                                              │
│  [Voir le détail]                        [Importer ▶]                       │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4.4 Scénario 3 : Import avec colonnes à confirmer

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  ⚠️ Fichier partiellement reconnu                                            │
│                                                                              │
│  📁 QUITTANCES_NEW_FORMAT.xlsx (20 lignes, 24 colonnes)                     │
│                                                                              │
│  Profil : "Import Quittances"                                               │
│  Table : QUITTANCES                                                         │
│                                                                              │
│  ✓ 20 colonnes reconnues automatiquement                                    │
│  ⚠️ 2 colonnes à confirmer                                                   │
│  ➕ 2 nouvelles colonnes                                                     │
│                                                                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  COLONNES À CONFIRMER                                                        │
│  ───────────────────────────────────────────────────────────────────────    │
│                                                                              │
│  ⚠️ "Date de création"                                                       │
│     Ressemble à : "Date création" (94% similaire)                           │
│     ● C'est la même colonne → Ajouter comme alias                           │
│     ○ C'est une colonne différente                                          │
│     ☑ Mémoriser cet alias                                                   │
│                                                                              │
│  ⚠️ "Ref. client"                                                            │
│     Ressemble à : "Référence client" (87% similaire)                        │
│     ● C'est la même colonne → Ajouter comme alias                           │
│     ○ C'est une colonne différente                                          │
│     ☑ Mémoriser cet alias                                                   │
│                                                                              │
│  NOUVELLES COLONNES                                                          │
│  ───────────────────────────────────────────────────────────────────────    │
│                                                                              │
│  ➕ "Code Région"                                                            │
│     Type détecté : Texte                                                    │
│     Action : [Mapper vers... ▼]  ou  [Ignorer]                              │
│              • Code Région (PLAIN)                                          │
│              • Ignorer cette colonne                                        │
│                                                                              │
│  ➕ "Commentaire"                                                            │
│     Type détecté : Texte                                                    │
│     Action : [Ignorer ▼]                                                    │
│                                                                              │
│              [Annuler]  [Confirmer et importer ▶]                           │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4.5 Scénario 4 : Format de données différent

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  ⚠️ Format de données différent                                              │
│                                                                              │
│  Le fichier utilise un format différent pour certaines colonnes.            │
│                                                                              │
│  ───────────────────────────────────────────────────────────────────────    │
│                                                                              │
│  Colonne : "Date début"                                                     │
│                                                                              │
│  Format du profil : DD/MM/YYYY (ex: 05/03/2025)                             │
│  Format du fichier : DD-MM-YYYY (ex: 05-03-2025)                            │
│                                                                              │
│  ● Accepter ce format (ajouter au profil)                                   │
│  ○ Ce fichier est une exception (ne pas mémoriser)                          │
│                                                                              │
│              [Continuer ▶]                                                   │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4.6 Scénario 5 : Notation scientifique détectée

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  ⚠️ Notation scientifique détectée                                           │
│                                                                              │
│  Colonne : "Numéro PV"                                                      │
│  Type Zoho : PLAIN (texte)                                                  │
│                                                                              │
│  Valeurs détectées : 1E6, 2E10, 3E8                                         │
│                                                                              │
│  Ces valeurs semblent être des codes convertis par Excel en notation        │
│  scientifique.                                                              │
│                                                                              │
│  ● Développer et importer comme texte                    ← Recommandé       │
│      1E6 → "1000000"                                                        │
│      2E10 → "20000000000"                                                   │
│                                                                              │
│  ○ Garder la notation scientifique                                          │
│      1E6 → "1E6"                                                            │
│                                                                              │
│              [Confirmer ▶]                                                   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Algorithme de matching

### 5.1 Recherche du profil

```typescript
interface MatchResult {
  profile: ImportProfile;
  score: number;                   // Colonnes matchées
  totalFileColumns: number;
  mappings: ColumnMapping[];
  needsConfirmation: boolean;
}

interface ColumnMapping {
  fileColumn: string;
  fileType: DetectedType;
  profileColumn: ProfileColumn | null;
  status: 'exact' | 'similar' | 'format_different' | 'new';
  similarity?: number;             // 0-100 pour 'similar'
  needsConfirmation: boolean;
}

function findBestProfiles(
  fileColumns: DetectedColumn[],
  profiles: ImportProfile[]
): MatchResult[] {
  
  return profiles.map(profile => {
    const mappings: ColumnMapping[] = [];
    let score = 0;
    
    for (const fileCol of fileColumns) {
      // 1. Chercher correspondance exacte dans les alias
      const exactMatch = profile.columns.find(pc =>
        pc.acceptedNames.some(alias =>
          normalize(alias) === normalize(fileCol.name)
        )
      );
      
      if (exactMatch) {
        // Vérifier si le format est connu
        const formatKnown = isFormatKnown(fileCol, exactMatch);
        
        mappings.push({
          fileColumn: fileCol.name,
          fileType: fileCol.detectedType,
          profileColumn: exactMatch,
          status: formatKnown ? 'exact' : 'format_different',
          needsConfirmation: !formatKnown
        });
        score += formatKnown ? 1 : 0.8;
        continue;
      }
      
      // 2. Chercher correspondance similaire (fuzzy)
      const fuzzyMatch = findFuzzyMatch(fileCol.name, profile.columns);
      
      if (fuzzyMatch && fuzzyMatch.similarity > 80) {
        mappings.push({
          fileColumn: fileCol.name,
          fileType: fileCol.detectedType,
          profileColumn: fuzzyMatch.column,
          status: 'similar',
          similarity: fuzzyMatch.similarity,
          needsConfirmation: true
        });
        score += 0.5;
        continue;
      }
      
      // 3. Nouvelle colonne
      mappings.push({
        fileColumn: fileCol.name,
        fileType: fileCol.detectedType,
        profileColumn: null,
        status: 'new',
        needsConfirmation: true
      });
    }
    
    return {
      profile,
      score,
      totalFileColumns: fileColumns.length,
      mappings,
      needsConfirmation: mappings.some(m => m.needsConfirmation)
    };
  })
  .filter(r => r.score > 0)           // Au moins une colonne matche
  .sort((a, b) => b.score - a.score); // Meilleur score en premier
}
```

### 5.2 Normalisation pour comparaison

```typescript
function normalize(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')  // Supprimer accents
    .replace(/[^a-z0-9]/g, '');       // Garder que alphanumérique
}

function calculateSimilarity(str1: string, str2: string): number {
  const n1 = normalize(str1);
  const n2 = normalize(str2);
  
  // Levenshtein normalisé
  const maxLen = Math.max(n1.length, n2.length);
  const distance = levenshteinDistance(n1, n2);
  const levenshteinScore = (1 - distance / maxLen) * 100;
  
  // Bonus pour mots communs
  const words1 = n1.match(/[a-z]+/g) || [];
  const words2 = n2.match(/[a-z]+/g) || [];
  const commonWords = words1.filter(w => words2.includes(w)).length;
  const wordBonus = (commonWords / Math.max(words1.length, words2.length)) * 20;
  
  return Math.min(100, levenshteinScore + wordBonus);
}
```

---

## 6. Mise à jour du profil

### 6.1 Règles de mise à jour

| Action utilisateur | Mise à jour profil |
|--------------------|-------------------|
| Confirme alias similaire | Ajouter aux `acceptedNames` |
| Confirme nouveau format | Ajouter aux `acceptedFormats` |
| Mappe nouvelle colonne | Ajouter nouveau `ProfileColumn` |
| Ignore colonne | Aucune modification |

### 6.2 Exemple d'accumulation

```
ÉTAT INITIAL DU PROFIL (janvier)
────────────────────────────────
Colonne "Date début":
  acceptedNames: ["Date début"]
  acceptedFormats: ["DD/MM/YYYY"]

APRÈS IMPORT MARS (nouveau nom)
────────────────────────────────
Colonne "Date début":
  acceptedNames: ["Date début", "Date de début"]  ← Ajouté
  acceptedFormats: ["DD/MM/YYYY"]

APRÈS IMPORT JUIN (nouveau format)
────────────────────────────────
Colonne "Date début":
  acceptedNames: ["Date début", "Date de début", "DateDebut"]  ← Ajouté
  acceptedFormats: ["DD/MM/YYYY", "DD-MM-YYYY"]  ← Ajouté

FICHIER LEGACY (janvier) IMPORTÉ EN DÉCEMBRE
────────────────────────────────────────────
→ "Date début" est dans acceptedNames ✓
→ "DD/MM/YYYY" est dans acceptedFormats ✓
→ Match automatique, aucune confirmation requise
```

---

## 7. Prévisualisation et import

### 7.1 Écran de prévisualisation

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Prévisualisation de l'import                                                │
│                                                                              │
│  Table : QUITTANCES                                                         │
│  Mode : Ajout (append)                                                      │
│  Lignes : 14                                                                │
│                                                                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  TRANSFORMATIONS APPLIQUÉES                                                  │
│  ───────────────────────────────────────────────────────────────────────    │
│                                                                              │
│  📅 Date début : DD/MM/YYYY → ISO                                           │
│     05/03/2025 → 2025-03-05                                                 │
│                                                                              │
│  ⏱️ Heure début : HH:mm → HH:mm:ss                                          │
│     23:54 → 23:54:00                                                        │
│                                                                              │
│  💰 Montant HT : Virgule → Point                                            │
│     1 234,56 → 1234.56                                                      │
│                                                                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  APERÇU DES DONNÉES (5 premières lignes)                                    │
│  ───────────────────────────────────────────────────────────────────────    │
│                                                                              │
│  Date début  │ Heure début │ Montant HT │ Journal      │ ...                │
│  ────────────┼─────────────┼────────────┼──────────────┼─────               │
│  2025-03-05  │ 23:54:00    │ 45.00      │ 091D06500957 │                    │
│  2025-03-05  │ 23:54:00    │ 45.00      │ 092B06500957 │                    │
│  2025-03-05  │ 23:27:00    │ 45.00      │ 110706502221 │                    │
│                                                                              │
│              [◀ Modifier]  [Importer ▶]                                     │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 7.2 Rapport final

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  ✅ Import terminé avec succès                                               │
│                                                                              │
│  Table : QUITTANCES                                                         │
│  Lignes importées : 14                                                      │
│  Durée : 1.2 secondes                                                       │
│                                                                              │
│  Profil mis à jour :                                                        │
│  • 1 nouvel alias ajouté : "Date de création"                               │
│  • 1 nouveau format ajouté : DD-MM-YYYY                                     │
│                                                                              │
│  [Voir dans Zoho]  [Nouvel import]                                          │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 8. Cas particuliers

### 8.1 Plusieurs profils avec même score

Si plusieurs profils ont un score similaire, proposer le choix :

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Plusieurs tables correspondent                                              │
│                                                                              │
│  Ce fichier peut être importé dans :                                        │
│                                                                              │
│  ○ QUITTANCES (18/22 colonnes)           Dernier import : hier              │
│  ○ QUITTANCES_ARCHIVE (18/22 colonnes)   Dernier import : il y a 3 mois    │
│  ○ Autre table...                                                           │
│                                                                              │
│              [Continuer ▶]                                                   │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 8.2 Colonne obligatoire manquante

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  ❌ Colonne obligatoire manquante                                            │
│                                                                              │
│  La table QUITTANCES requiert la colonne "Date début" qui n'est pas         │
│  présente dans votre fichier.                                               │
│                                                                              │
│  Colonnes du fichier qui pourraient correspondre :                          │
│  ○ "DateDebut" (86% similaire)                                              │
│  ○ "Date" (45% similaire)                                                   │
│  ○ Aucune correspondance                                                    │
│                                                                              │
│              [Annuler]  [Mapper et continuer ▶]                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 8.3 Import sans profil (ponctuel)

Option toujours disponible pour imports exceptionnels :

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  ☐ Import ponctuel (ne pas créer/modifier de profil)                        │
│                                                                              │
│  Les paramètres de cet import ne seront pas mémorisés.                      │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 9. Historique des imports

### 9.1 Données enregistrées (métadonnées uniquement)

```sql
CREATE TABLE csv_importer.import_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Références
  profile_id UUID REFERENCES csv_importer.import_profiles(id),
  user_id UUID REFERENCES auth.users(id),
  
  -- Fichier (métadonnées, PAS le contenu)
  file_name TEXT NOT NULL,
  file_size_bytes INTEGER,
  row_count INTEGER,
  column_count INTEGER,
  
  -- Résultat
  status TEXT NOT NULL,             -- success, error
  rows_imported INTEGER,
  error_message TEXT,
  
  -- Transformations appliquées (audit)
  transformations_applied JSONB,
  
  -- Évolutions du profil
  profile_changes JSONB,            -- Alias/formats ajoutés
  
  -- Timing
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER
);
```

---

## 10. Permissions et partage

### 10.1 Modèle de permissions

| Action | Qui peut |
|--------|----------|
| Voir les profils | Tous les utilisateurs authentifiés |
| Créer un profil | Tous les utilisateurs authentifiés |
| Modifier un profil | Tous les utilisateurs authentifiés |
| Supprimer un profil | Créateur ou admin |

### 10.2 Justification

Les profils sont **partagés** entre tous les utilisateurs car :
- Cohérence des imports entre utilisateurs
- Un utilisateur configure, les autres réutilisent
- Évite les doublons de configuration

---

## 11. Résumé des règles métier

| # | Règle |
|---|-------|
| R1 | Un profil est lié à UNE table Zoho (relation 1:1) |
| R2 | Le profil accumule les alias et formats au fil du temps |
| R3 | Les formats ambigus (dates, notation scientifique) nécessitent confirmation |
| R4 | La confirmation est mémorisée pour les imports suivants |
| R5 | Le fichier legacy (ancien format) est reconnu si ses alias sont dans le profil |
| R6 | La notation scientifique est toujours développée (1E6 → 1000000) |
| R7 | Les transformations produisent un format universel intermédiaire |
| R8 | L'utilisateur peut toujours forcer un import ponctuel sans profil |
| R9 | Les profils sont partagés entre tous les utilisateurs |
| R10 | Seules les métadonnées sont stockées (zero data retention) |

---

*Document créé le : 1er décembre 2025*
*Statut : Version 2.0*
