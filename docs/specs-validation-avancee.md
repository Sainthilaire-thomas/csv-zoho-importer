# Spécifications Validation Avancée
## CSV to Zoho Analytics Importer

*Version 1.0 - 30 novembre 2025*
*Complément à specs-fonctionnelles.md*

---

## 1. Objectif

Garantir que **100% des données importées** correspondent exactement à ce que l'utilisateur attend, sans conversion silencieuse ni perte de données.

### Principes directeurs

1. **Explicite plutôt qu'implicite** : Aucune "magie" de conversion. L'utilisateur voit et valide chaque transformation.
2. **Échec rapide** : Bloquer AVANT l'import si un doute existe sur l'intégrité des données.
3. **Vérification post-import** : Contrôler que Zoho a bien importé ce qu'on a envoyé.
4. **Rollback si anomalie** : Annuler l'import si les premiers enregistrements révèlent un problème (phase ultérieure).
5. **Zero data retention** : Tout le traitement est côté client, seules les métadonnées sont stockées.

### Contraintes techniques

- Traitement 100% côté navigateur (pas de stockage serveur)
- Envoi direct vers Zoho Analytics API
- Profils d'import partagés entre utilisateurs
- Archivage des métadonnées uniquement (RGPD compliant)

---

## 2. Parcours de validation détaillé

### Vue d'ensemble du flow

```
┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐
│ Fichier │───▶│ Profil  │───▶│ Schéma  │───▶│ Transfo │───▶│ Preview │───▶│ Import  │
│ Source  │    │ Détecté │    │ Validé  │    │Explicite│    │ Données │    │ + Verif │
└─────────┘    └─────────┘    └─────────┘    └─────────┘    └─────────┘    └─────────┘
     │              │              │              │              │              │
     │         Optionnel      Bloquant si    Bloquant si   Confirmation    Rapport
     │         (réutilise     incompatible   non résolu     utilisateur    détaillé
     │          config)                                                         
```

---

### Étape 1 : Sélection du fichier et détection de profil

#### 1.1 Analyse du fichier source

Le système analyse automatiquement :

| Élément analysé | Détection |
|-----------------|-----------|
| Encodage | UTF-8, UTF-16, ISO-8859-1 |
| Séparateur CSV | Virgule, point-virgule, tabulation |
| Présence en-têtes | Oui/Non (heuristique) |
| Nombre de colonnes | Comptage |
| Noms des colonnes | Extraction première ligne |
| Types de données | Échantillonnage 100 lignes |

#### 1.2 Détection automatique du profil

La détection se fait **par structure des colonnes** (pas par nom de fichier) :

```typescript
interface FileSignature {
  columnCount: number;
  columnNames: string[];          // Noms normalisés (trim, lowercase)
  columnTypes: DetectedType[];    // Types détectés par colonne
  structureHash: string;          // Hash pour comparaison rapide
}

// Algorithme de matching
function findMatchingProfile(fileSignature: FileSignature): Profile | null {
  // 1. Chercher correspondance exacte (même colonnes, même ordre)
  // 2. Chercher correspondance partielle (>90% colonnes communes)
  // 3. Retourner null si aucun profil ne correspond
}
```

#### 1.3 Interface utilisateur

**Cas A : Profil trouvé**
```
┌─────────────────────────────────────────────────────────────────────────┐
│  Fichier : QUITTANCES_30112025.csv (14 lignes, 22 colonnes)            │
│                                                                         │
│  ✅ Profil reconnu : "Import Quittances Quotidien"                      │
│     Dernière utilisation : hier à 14:32 (14 lignes importées)          │
│     Structure : identique au profil                                     │
│                                                                         │
│  ○ Utiliser ce profil (recommandé)                                     │
│  ○ Créer un nouveau profil                                             │
│  ○ Import ponctuel sans profil                                         │
│                                                                         │
│              [Continuer ▶]                                              │
└─────────────────────────────────────────────────────────────────────────┘
```

**Cas B : Profil trouvé mais structure différente**
```
┌─────────────────────────────────────────────────────────────────────────┐
│  ⚠️ Changement détecté dans le format du fichier                        │
│                                                                         │
│  Profil "Import Quittances Quotidien" correspond partiellement :       │
│                                                                         │
│  ✅ 20 colonnes identiques                                              │
│  ➕ 2 nouvelles colonnes : "Code Région", "Commentaire"                 │
│  ⚠️ 1 format différent : "Date début" (était JJ/MM/AAAA, maintenant    │
│     AAAA-MM-JJ)                                                        │
│                                                                         │
│  ○ Mettre à jour le profil avec ces changements                        │
│  ○ Créer un nouveau profil                                             │
│  ○ Ignorer les différences (import ponctuel)                           │
│                                                                         │
│              [Annuler]  [Continuer]                                     │
└─────────────────────────────────────────────────────────────────────────┘
```

**Cas C : Aucun profil trouvé**
```
┌─────────────────────────────────────────────────────────────────────────┐
│  Fichier : NOUVEAU_FICHIER.csv (100 lignes, 15 colonnes)               │
│                                                                         │
│  ℹ️ Aucun profil existant ne correspond à ce fichier.                   │
│                                                                         │
│  ○ Créer un nouveau profil (pour imports récurrents)                   │
│  ○ Import ponctuel sans profil                                         │
│                                                                         │
│              [Continuer ▶]                                              │
└─────────────────────────────────────────────────────────────────────────┘
```

---

### Étape 2 : Validation du schéma (correspondance fichier ↔ Zoho)

#### 2.1 Récupération du schéma Zoho

Le système récupère automatiquement la structure de la table Zoho cible :
- Noms des colonnes
- Types de données (DATE, NUMBER, PLAIN, DURATION, etc.)
- Colonnes obligatoires
- Colonnes avec contraintes (unique, lookup)

#### 2.2 Statuts de correspondance

| Statut | Icône | Signification | Action requise |
|--------|-------|---------------|----------------|
| **Correspondance exacte** | ✅ | Même nom, même type | Aucune |
| **Transformation nécessaire** | 🔄 | Même nom, type compatible avec conversion | Afficher la transformation |
| **Correspondance incertaine** | ⚠️ | Nom similaire ou type ambigu | Confirmation utilisateur |
| **Incompatible** | ❌ | Type impossible à convertir | **BLOQUANT** - Résolution obligatoire |
| **Colonne manquante Zoho** | ➖ | Dans fichier, pas dans Zoho | Ignorer ou erreur si obligatoire |
| **Colonne manquante fichier** | ➕ | Dans Zoho, pas dans fichier | OK si non obligatoire |

#### 2.3 Cas bloquants (croix rouge ❌)

**Une croix rouge signifie : l'import ne peut PAS continuer sans action.**

Exemples de cas bloquants :

| Cas | Exemple | Pourquoi bloquant | Résolution |
|-----|---------|-------------------|------------|
| Type incompatible | Texte "ABC" → NUMBER | Conversion impossible | Exclure la colonne ou corriger le fichier |
| Format ambigu non résolu | "05/03/2025" date | Jour/Mois incertain | L'utilisateur doit choisir JJ/MM ou MM/JJ |
| Colonne obligatoire manquante | "ID Client" requis | Zoho refusera l'import | Ajouter la colonne au fichier |
| Valeurs hors plage | Nombre > MAX_INT | Overflow possible | Vérifier les données source |

#### 2.4 Interface de résolution

```
┌─────────────────────────────────────────────────────────────────────────┐
│  ❌ 2 problèmes à résoudre avant import                                 │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  PROBLÈME 1 : Format de date ambigu                                    │
│  ─────────────────────────────────────────────                          │
│  Colonne : "Date début"                                                │
│  Valeur exemple : "05/03/2025"                                         │
│                                                                         │
│  Comment interpréter cette date ?                                       │
│  ● 5 mars 2025 (format JJ/MM/AAAA - français)                          │
│  ○ 3 mai 2025 (format MM/JJ/AAAA - américain)                          │
│                                                                         │
│  ☑ Appliquer à toutes les colonnes de type date                        │
│  ☑ Mémoriser ce choix dans le profil                                   │
│                                                                         │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                         │
│  PROBLÈME 2 : Colonne obligatoire manquante                            │
│  ─────────────────────────────────────────────                          │
│  Colonne Zoho : "Code Client" (obligatoire)                            │
│  Non trouvée dans le fichier                                           │
│                                                                         │
│  ○ Cette colonne correspond à : [Sélectionner ▼]                       │
│  ○ Annuler l'import (colonne requise)                                  │
│                                                                         │
│              [Annuler]  [Résoudre et continuer]                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

### Étape 3 : Transformation explicite des données

#### 3.1 Principe

**Aucune transformation silencieuse.** L'utilisateur voit exactement ce qui va être modifié.

#### 3.2 Types de transformations

| Type | Exemple avant | Exemple après | Automatique ? |
|------|---------------|---------------|---------------|
| Date JJ/MM → AAAA-MM-JJ | 05/03/2025 | 2025-03-05 | Oui si format confirmé |
| Décimal virgule → point | 1234,56 | 1234.56 | Oui |
| Espace milliers supprimé | 1 234 567 | 1234567 | Oui |
| Notation scientifique | 1.5E6 | 1500000 | **Non - confirmation requise** |
| Booléen normalisé | Oui/Non | true/false | Oui |
| Trim espaces | "  texte  " | "texte" | Oui |
| Valeur vide normalisée | "N/A", "null", "-" | "" | Oui |

#### 3.3 Cas nécessitant confirmation

**Notation scientifique :**
```
┌─────────────────────────────────────────────────────────────────────────┐
│  ⚠️ Notation scientifique détectée                                      │
│                                                                         │
│  Colonne : "Montant"                                                   │
│  Valeur : "1.5E6"                                                      │
│                                                                         │
│  Comment interpréter ?                                                  │
│  ● Nombre : 1 500 000                                                  │
│  ○ Texte : "1.5E6" (garder tel quel)                                   │
│                                                                         │
│              [Confirmer]                                                │
└─────────────────────────────────────────────────────────────────────────┘
```

#### 3.4 Récapitulatif des transformations

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Transformations qui seront appliquées                                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ✅ Date début : JJ/MM/AAAA → AAAA-MM-JJ (14 valeurs)                  │
│  ✅ Date fin : JJ/MM/AAAA → AAAA-MM-JJ (14 valeurs)                    │
│  ✅ Montant : virgule → point (14 valeurs)                             │
│  ✅ Espaces supprimés : 3 colonnes                                     │
│                                                                         │
│  Aucune transformation :                                                │
│  • Journal, Numéro Quittance, ... (18 colonnes)                        │
│                                                                         │
│              [◀ Retour]  [Continuer ▶]                                  │
└─────────────────────────────────────────────────────────────────────────┘
```

---

### Étape 4 : Prévisualisation des données

#### 4.1 Objectif

Montrer les données **exactement comme elles seront envoyées** à Zoho.

#### 4.2 Interface

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Prévisualisation (10 premières lignes sur 14)                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  #  │ Date début  │ Heure │ Montant │ Journal      │ Statut            │
│ ────┼─────────────┼───────┼─────────┼──────────────┼───────────────────│
│  1  │ 2025-03-05  │ 23:54 │ 45.00   │ 091D06500957 │ ✅                │
│  2  │ 2025-03-05  │ 23:54 │ 45.00   │ 092B06500957 │ ✅                │
│  3  │ 2025-03-05  │ 23:27 │ 45.00   │ 110706502221 │ ✅                │
│  4  │ 2025-03-05  │ 23:29 │ 45.00   │ 110706502221 │ ✅                │
│  5  │ 2025-03-05  │ 23:51 │ 45.00   │ 110806501638 │ ✅                │
│ ... │             │       │         │              │                   │
│                                                                         │
│  Colonnes affichées : 5/22  [Afficher toutes les colonnes]             │
│                                                                         │
│  ─────────────────────────────────────────────────────────────────────  │
│  Légende : ✅ OK │ 🔄 Transformé │ ⚠️ Attention                         │
│                                                                         │
│  Résumé :                                                               │
│  • 14 lignes prêtes à importer                                         │
│  • 0 erreur                                                            │
│  • 28 transformations appliquées (dates, nombres)                      │
│                                                                         │
│              [◀ Retour]  [Lancer l'import ▶]                            │
└─────────────────────────────────────────────────────────────────────────┘
```

---

### Étape 5 : Import et vérification

#### 5.1 Seuil d'erreurs (configurable par l'utilisateur)

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Configuration de l'import                                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Mode d'import : ● Ajout (append)                                      │
│                  ○ Remplacement (truncateadd)                          │
│                  ○ Mise à jour (updateadd)                             │
│                                                                         │
│  Seuil d'erreurs acceptable :                                          │
│  ┌──────────────────────────────────────────────────────┐              │
│  │ [0%________________________________________] 0%     │              │
│  └──────────────────────────────────────────────────────┘              │
│  0% = Mode strict (aucune erreur tolérée)                              │
│  Recommandé pour imports critiques                                      │
│                                                                         │
│  ☑ Vérification post-import (comparer envoyé vs stocké)                │
│  ☐ Rollback automatique si erreur (phase ultérieure)                   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

#### 5.2 Déroulement de l'import

```
Phase 1 : Import test (10 premières lignes)
├── Envoi des 10 premières lignes
├── Lecture immédiate depuis Zoho
├── Comparaison valeur envoyée vs valeur stockée
└── Si OK → Phase 2, sinon → Alerte

Phase 2 : Import complet
├── Envoi des lignes restantes
├── Réception du rapport Zoho (succès/erreurs)
└── Vérification finale

Phase 3 : Vérification post-import
├── Comptage des lignes dans Zoho
├── Échantillonnage aléatoire (5 lignes)
├── Comparaison des valeurs
└── Rapport final
```

#### 5.3 Alerte si problème détecté

```
┌─────────────────────────────────────────────────────────────────────────┐
│  ⚠️ Anomalie détectée lors de la vérification                           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  L'import test (10 lignes) révèle des différences :                    │
│                                                                         │
│  Colonne      │ Envoyé       │ Stocké Zoho  │ Problème                 │
│  ─────────────┼──────────────┼──────────────┼─────────────────────────│
│  Date début   │ 2025-03-05   │ 2025-05-03   │ ❌ Jour/Mois inversés   │
│  Montant      │ 45.00        │ 45           │ ⚠️ Décimales perdues    │
│                                                                         │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                         │
│  ⚠️ Ces 10 lignes ont été importées dans Zoho.                          │
│                                                                         │
│  Que souhaitez-vous faire ?                                             │
│  ○ Annuler (supprimer les 10 lignes importées) - Phase ultérieure      │
│  ○ Continuer malgré les différences (non recommandé)                   │
│  ○ Arrêter ici (garder les 10 lignes, ne pas importer le reste)        │
│                                                                         │
│              [Choisir une action]                                       │
└─────────────────────────────────────────────────────────────────────────┘
```

---

### Étape 6 : Rapport final

```
┌─────────────────────────────────────────────────────────────────────────┐
│  ✅ Import terminé avec succès                                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  RÉSUMÉ                                                                 │
│  ─────────────────────────────────────────────                          │
│  Fichier : QUITTANCES_30112025.csv                                     │
│  Table Zoho : QUITTANCES                                               │
│  Mode : Ajout (append)                                                 │
│  Profil utilisé : "Import Quittances Quotidien"                        │
│                                                                         │
│  STATISTIQUES                                                           │
│  ─────────────────────────────────────────────                          │
│  Lignes envoyées : 14                                                  │
│  Lignes importées : 14                                                 │
│  Lignes en erreur : 0                                                  │
│  Durée : 1.2 secondes                                                  │
│                                                                         │
│  TRANSFORMATIONS APPLIQUÉES                                             │
│  ─────────────────────────────────────────────                          │
│  • Date début : JJ/MM/AAAA → AAAA-MM-JJ (14 valeurs)                   │
│  • Date fin : JJ/MM/AAAA → AAAA-MM-JJ (14 valeurs)                     │
│                                                                         │
│  VÉRIFICATION POST-IMPORT                                               │
│  ─────────────────────────────────────────────                          │
│  ✅ 14 lignes vérifiées dans Zoho                                       │
│  ✅ 0 différence détectée                                               │
│  ✅ Intégrité des données confirmée                                     │
│                                                                         │
│  [Voir dans Zoho]  [Télécharger rapport]  [Nouvel import]              │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Profils d'import réutilisables

### 3.1 Concept

Un **Profil d'Import** sauvegarde toute la configuration pour réutilisation :
- Configuration source (format dates, séparateurs, etc.)
- Mapping des colonnes
- Transformations à appliquer
- Destination Zoho
- Paramètres de validation

### 3.2 Partage des profils

**Tous les utilisateurs partagent les mêmes profils.**

Cela permet :
- Cohérence des imports entre utilisateurs
- Un utilisateur crée le profil, les autres le réutilisent
- Modifications visibles par tous

### 3.3 Détection automatique

Le profil est détecté **par la structure des colonnes** :
1. Extraction des noms de colonnes du fichier
2. Calcul d'un hash de structure
3. Recherche d'un profil avec structure identique ou similaire (>90%)

### 3.4 Vérification de cohérence

À chaque import, le système vérifie que le fichier correspond au profil :
- Mêmes colonnes ? (ajouts/suppressions détectés)
- Mêmes formats ? (changement de format de date détecté)
- Alerte si divergence

---

## 4. Rollback (Phase ultérieure)

### 4.1 Capacité de l'API Zoho

L'API Zoho Analytics permet de supprimer des lignes avec critères :
```
DELETE /views/{viewId}/data
Body: { "criteria": "\"Colonne_Unique\" IN ('valeur1', 'valeur2', ...)" }
```

### 4.2 Prérequis pour rollback

- Une colonne unique identifiée (ex: "Numéro Quittance")
- Sauvegarde des valeurs uniques des lignes importées
- Pour `updateadd` : sauvegarde des anciennes valeurs (complexe)

### 4.3 Implémentation prévue

1. **Import test** : Importer 10 lignes, noter leurs IDs
2. **Vérification** : Comparer envoyé vs stocké
3. **Si problème** : DELETE des 10 lignes avec critère sur colonne unique
4. **Si OK** : Continuer l'import complet

---

## 5. Cas particuliers à gérer

### 5.1 Formats de dates ambigus

| Format fichier | Interprétations possibles | Résolution |
|----------------|---------------------------|------------|
| 05/03/2025 | 5 mars OU 3 mai | Demander à l'utilisateur |
| 05/03/25 | 5 mars 2025 OU 3 mai 2025 OU 5 mars 1925 | Demander à l'utilisateur |
| 2025-03-05 | Non ambigu (ISO) | Automatique |
| March 5, 2025 | Non ambigu | Automatique |

### 5.2 Nombres avec notation scientifique

| Valeur | Risque | Action |
|--------|--------|--------|
| 1.5E6 | Importé comme texte "1.5E6" | Confirmation requise |
| 3.14e-2 | Importé comme texte | Confirmation requise |
| 1E10 | Overflow possible | Alerte si > MAX |

### 5.3 Valeurs vides

| Valeur fichier | Traitement | Résultat Zoho |
|----------------|------------|---------------|
| "" (vide) | Conserver | NULL |
| "N/A" | Convertir en vide | NULL |
| "null" | Convertir en vide | NULL |
| "-" | Convertir en vide | NULL |
| " " (espaces) | Trim → vide | NULL |

### 5.4 Caractères spéciaux

| Cas | Risque | Action |
|-----|--------|--------|
| Retour ligne dans cellule | Casse le CSV | Échapper ou supprimer |
| Guillemets dans texte | Parsing incorrect | Échapper correctement |
| Emoji | Encodage incorrect | Vérifier UTF-8 |
| Accents | Encodage incorrect | Détecter et alerter |

---

## 6. Base de données (Supabase)

### 6.1 Table des profils (partagés)

```sql
CREATE TABLE csv_importer.import_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Identification
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_by UUID REFERENCES auth.users(id),
  
  -- Signature du fichier source
  column_names TEXT[] NOT NULL,
  column_count INTEGER NOT NULL,
  structure_hash TEXT NOT NULL,
  
  -- Configuration source
  file_encoding TEXT DEFAULT 'UTF-8',
  csv_separator TEXT DEFAULT ',',
  date_format TEXT,                     -- "DD/MM/YYYY" confirmé par user
  decimal_separator TEXT DEFAULT ',',
  
  -- Destination Zoho
  workspace_id TEXT NOT NULL,
  workspace_name TEXT NOT NULL,
  view_id TEXT NOT NULL,
  view_name TEXT NOT NULL,
  default_import_mode TEXT DEFAULT 'append',
  
  -- Clé pour rollback (phase ultérieure)
  unique_column TEXT,
  
  -- Mappings colonnes (JSON)
  column_mappings JSONB NOT NULL,
  
  -- Paramètres validation
  default_error_threshold INTEGER DEFAULT 0,
  post_import_check BOOLEAN DEFAULT true,
  
  -- Métadonnées
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,
  use_count INTEGER DEFAULT 0
);

-- Index pour recherche par structure
CREATE INDEX idx_profiles_structure ON csv_importer.import_profiles(structure_hash);
```

### 6.2 Table historique (métadonnées uniquement)

```sql
CREATE TABLE csv_importer.import_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES csv_importer.import_profiles(id),
  user_id UUID REFERENCES auth.users(id),
  
  -- Fichier (métadonnées seulement, pas le contenu)
  file_name TEXT NOT NULL,
  file_size_bytes INTEGER,
  row_count INTEGER,
  
  -- Résultat
  status TEXT NOT NULL,                 -- success, partial, error
  rows_sent INTEGER,
  rows_imported INTEGER,
  rows_failed INTEGER,
  error_threshold_used INTEGER,
  
  -- Vérification post-import
  post_check_performed BOOLEAN,
  post_check_passed BOOLEAN,
  post_check_differences JSONB,
  
  -- Timing
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER,
  
  -- Transformations appliquées (pour audit)
  transformations_applied JSONB
);
```

---

## 7. Priorités d'implémentation

| Phase | Fonctionnalité | Priorité |
|-------|----------------|----------|
| **1** | Validation schéma avec résolution ❌ | 🔴 Critique |
| **1** | Transformation explicite des données | 🔴 Critique |
| **1** | Prévisualisation avant import | 🔴 Critique |
| **1** | Vérification post-import basique | 🔴 Critique |
| **2** | Profils d'import réutilisables | 🟡 Important |
| **2** | Détection automatique de profil | 🟡 Important |
| **2** | Seuil d'erreurs configurable | 🟡 Important |
| **3** | Rollback après import test | 🟢 Souhaitable |
| **3** | Historique détaillé des imports | 🟢 Souhaitable |

---

*Document créé le : 30 novembre 2025*
*Auteur : Thomas Renaudin*
*Statut : Version 1.0*
