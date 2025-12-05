# Spécification - Preview & Vérification des Données

## CSV to Zoho Analytics Importer

*Version 1.0 - 4 décembre 2025*
*Complément à specs-validation-avancee.md*

---

## 1. Objectif

Donner à l'utilisateur une **compréhension totale** de ce qui se passe avec ses données :

| Phase | Objectif | Question utilisateur |
|-------|----------|---------------------|
| **Avant import** | Preview des transformations | "Comment mes données seront-elles modifiées ?" |
| **Après import** | Vérification dans Zoho | "Les données sont-elles bien arrivées comme prévu ?" |

### Principes

1. **Transparence totale** : L'utilisateur voit exactement chaque transformation
2. **Comparaison visuelle** : Données source vs données transformées vs données Zoho (réelles)
3. **Alertes proactives** : Mise en évidence des anomalies (colonne vide, valeur tronquée, format changé)

---

## 2. Les 3 états de la donnée
```
┌─────────────────────┐     ┌─────────────────────┐     ┌─────────────────────┐
│  1. FICHIER SOURCE  │     │  2. ENVOYÉ À ZOHO   │     │  3. STOCKÉ DANS     │
│     (Excel/CSV)     │     │    (après transfo)  │     │     ZOHO (réel)     │
├─────────────────────┤     ├─────────────────────┤     ├─────────────────────┤
│                     │     │                     │     │                     │
│  Donnée brute       │ ──▶ │  Donnée transformée │ ──▶ │  Donnée réelle      │
│  telle que dans     │     │  par notre app      │     │  lue via API GET    │
│  le fichier         │     │  avant envoi        │     │  APRÈS import       │
│                     │     │                     │     │                     │
└─────────────────────┘     └─────────────────────┘     └─────────────────────┘
        │                           │                           │
        │                           │                           │
   Ex: "05/03/2025"           Ex: "2025-03-05"            Ex: "2025-03-05"
                                                          ou "2025-05-03" ← PROBLÈME!
```

### Clarification importante

> **La colonne "Stocké dans Zoho" n'est PAS ce qu'on a envoyé.**
> C'est ce que Zoho a réellement stocké, récupéré via un appel API GET après l'import.
> Cela permet de détecter si Zoho a modifié la donnée.

---

## 3. Preview des Transformations (Avant Import)

### 3.1 Vue comparative par colonne

Pour chaque colonne avec transformation, afficher un échantillon :
```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│  Prévisualisation des transformations                                               │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                     │
│  Colonne: "Date début" (type Zoho: DATE)                                           │
│  Transformation: JJ/MM/AAAA → AAAA-MM-JJ (ISO 8601)                                │
│                                                                                     │
│  #  │ Fichier source   │ Sera envoyé       │ Statut                                │
│  ───┼──────────────────┼───────────────────┼───────────────────────────────────────│
│  1  │ 05/03/2025       │ 2025-03-05        │ 🔄 Transformé                         │
│  2  │ 06/03/2025       │ 2025-03-06        │ 🔄 Transformé                         │
│  3  │ N/A              │ (vide)            │ ⚠️ Valeur vide normalisée             │
│  4  │ 07/03/2025       │ 2025-03-07        │ 🔄 Transformé                         │
│  5  │ 08/03/2025       │ 2025-03-08        │ 🔄 Transformé                         │
│                                                                                     │
└─────────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────────┐
│  Colonne: "Montant" (type Zoho: DECIMAL_NUMBER)                                    │
│  Transformation: Virgule décimale → Point décimal                                  │
│                                                                                     │
│  #  │ Fichier source   │ Sera envoyé       │ Statut                                │
│  ───┼──────────────────┼───────────────────┼───────────────────────────────────────│
│  1  │ 1 234,56         │ 1234.56           │ 🔄 Transformé                         │
│  2  │ 45,00            │ 45.00             │ 🔄 Transformé                         │
│  3  │ 1E6              │ 1000000           │ 🔄 Notation scientifique développée   │
│                                                                                     │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Types de transformations

| Type | Source | → Envoyé | Indicateur |
|------|--------|----------|------------|
| Date FR→ISO | 05/03/2025 | 2025-03-05 | 🔄 Transformé |
| Nombre FR→US | 1 234,56 | 1234.56 | 🔄 Transformé |
| Durée padding | 9:30 | 09:30:00 | 🔄 Transformé |
| Scientifique | 1E6 | 1000000 | 🔄 Développé |
| Trim espaces | "  texte  " | "texte" | 🔄 Nettoyé |
| Vide normalisé | "N/A" | "" | ⚠️ Vide |
| Aucune | "ABC123" | "ABC123" | ✅ Inchangé |

### 3.3 Résumé global
```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│  Résumé des transformations                                                         │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                     │
│  📊 14 lignes × 22 colonnes = 308 valeurs                                          │
│                                                                                     │
│  🔄 Colonnes transformées (4) :                                                     │
│     • Date début    : JJ/MM/AAAA → ISO (14 valeurs)                                │
│     • Date fin      : JJ/MM/AAAA → ISO (14 valeurs)                                │
│     • Heure début   : H:mm → HH:mm:ss (14 valeurs)                                 │
│     • Montant       : virgule → point (14 valeurs)                                 │
│                                                                                     │
│  ✅ Colonnes inchangées (18) :                                                      │
│     Journal, Numéro Quittance, Réseau, Ligne, Arrêt, Code infraction, ...          │
│                                                                                     │
│  ⚠️ Points d'attention :                                                            │
│     • 2 valeurs vides normalisées (N/A → vide)                                     │
│                                                                                     │
│  Total : 56 transformations sur 308 valeurs (18%)                                  │
│                                                                                     │
│                              [◀ Retour]  [Confirmer et importer ▶]                  │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Vérification Post-Import (Après Import)

### 4.1 Processus
```
Import terminé (API POST)
         │
         ▼
┌─────────────────────┐
│ 1. ATTENDRE         │  ~2 secondes pour que Zoho indexe
│    (délai)          │
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│ 2. RÉCUPÉRER        │  API GET /views/{viewId}/data
│    données Zoho     │  avec critère sur clé de matching
│    (appel réel)     │  = DONNÉES RÉELLES STOCKÉES
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│ 3. COMPARER         │  Pour chaque ligne et colonne :
│    envoyé vs stocké │  valeur_envoyée === valeur_zoho ?
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│ 4. RAPPORT          │  Afficher anomalies si différences
│    à l'utilisateur  │
└─────────────────────┘
```

### 4.2 Types d'anomalies détectables

| Anomalie | Ce qu'on a envoyé | Ce que Zoho a stocké | Cause probable |
|----------|-------------------|----------------------|----------------|
| **Date inversée** | 2025-03-05 | 2025-05-03 | Config dateFormat Zoho incorrecte |
| **Colonne vide** | "Texte important" | NULL | Colonne non mappée côté Zoho |
| **Texte tronqué** | "Description très longue..." | "Description tr" | Limite de caractères Zoho |
| **Décimales perdues** | 45.678 | 45.68 | Type NUMBER au lieu de DECIMAL |
| **Accents perdus** | "Référence" | "RÃ©fÃ©rence" | Problème d'encodage |
| **Valeur modifiée** | "ABC" | "abc" | Transformation Zoho auto |

### 4.3 Interface - Import réussi sans anomalie
```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│  ✅ Import terminé avec succès                                                      │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                     │
│  IMPORT                                                                             │
│  ───────────────────────────────────                                                │
│  Lignes envoyées : 14                                                              │
│  Lignes importées : 14                                                             │
│  Durée : 1.2 secondes                                                              │
│                                                                                     │
│  VÉRIFICATION (données lues depuis Zoho)                                           │
│  ───────────────────────────────────────                                            │
│  Lignes vérifiées : 14/14                                                          │
│  Anomalies : 0                                                                     │
│                                                                                     │
│  ✅ Les données dans Zoho correspondent exactement à ce qui a été envoyé.          │
│                                                                                     │
│              [Voir dans Zoho]  [Nouvel import]                                      │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

### 4.4 Interface - Anomalies détectées
```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│  ⚠️ Import terminé - Différences détectées                                          │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                     │
│  IMPORT                                                                             │
│  ───────────────────────────────────                                                │
│  Lignes envoyées : 14                                                              │
│  Lignes importées : 14                                                             │
│                                                                                     │
│  VÉRIFICATION (données lues depuis Zoho)                                           │
│  ───────────────────────────────────────                                            │
│  Lignes vérifiées : 14/14                                                          │
│  🔴 Anomalies critiques : 2                                                         │
│  🟡 Avertissements : 1                                                              │
│                                                                                     │
│  ═══════════════════════════════════════════════════════════════════════════════   │
│                                                                                     │
│  🔴 ANOMALIE 1 : Date réinterprétée par Zoho                                        │
│  ─────────────────────────────────────────────                                      │
│  Ligne #3 (Numéro Quittance: 092B5064CC)                                           │
│  Colonne : "Date début"                                                            │
│                                                                                     │
│  ┌──────────────────┬──────────────────┬──────────────────┐                        │
│  │ Fichier source   │ Envoyé à Zoho    │ Stocké dans Zoho │                        │
│  ├──────────────────┼──────────────────┼──────────────────┤                        │
│  │ 05/03/2025       │ 2025-03-05       │ 2025-05-03       │ ← JOUR/MOIS INVERSÉS   │
│  └──────────────────┴──────────────────┴──────────────────┘                        │
│                                                                                     │
│  💡 Cause probable : Le paramètre dateFormat de l'import Zoho                      │
│     interprète différemment le format ISO.                                         │
│                                                                                     │
│  ─────────────────────────────────────────────────────────────────────────────────  │
│                                                                                     │
│  🔴 ANOMALIE 2 : Colonne vide dans Zoho                                             │
│  ──────────────────────────────────────                                             │
│  Ligne #7 (Numéro Quittance: 091D5123AB)                                           │
│  Colonne : "Commentaire"                                                           │
│                                                                                     │
│  ┌──────────────────┬──────────────────┬──────────────────┐                        │
│  │ Fichier source   │ Envoyé à Zoho    │ Stocké dans Zoho │                        │
│  ├──────────────────┼──────────────────┼──────────────────┤                        │
│  │ "Note urgente"   │ "Note urgente"   │ (vide)           │ ← DONNÉE PERDUE        │
│  └──────────────────┴──────────────────┴──────────────────┘                        │
│                                                                                     │
│  💡 Cause probable : La colonne "Commentaire" n'existe pas dans la table Zoho      │
│     ou le mapping des colonnes est incorrect.                                      │
│                                                                                     │
│  ═══════════════════════════════════════════════════════════════════════════════   │
│                                                                                     │
│  [Exporter rapport détaillé]  [Voir dans Zoho]  [Contacter support]                │
│                                                                                     │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 5. API nécessaires

### 5.1 Récupérer les données depuis Zoho (GET)
```typescript
// GET /api/zoho/data
// Récupère les données réelles stockées dans Zoho

interface GetDataParams {
  workspaceId: string;
  viewId: string;
  criteria?: string;        // Ex: '"Numéro Quittance" IN (\'ABC\', \'DEF\')'
  columns?: string[];       // Colonnes à récupérer (toutes si vide)
  limit?: number;           // Max lignes (défaut: 100)
}

interface GetDataResponse {
  success: boolean;
  rows: Record<string, unknown>[];
  totalCount: number;
}
```

### 5.2 Comparaison des valeurs
```typescript
interface VerificationResult {
  status: 'success' | 'warnings' | 'errors';
  rowsVerified: number;
  anomalies: Anomaly[];
}

interface Anomaly {
  // Localisation
  rowIndex: number;
  rowIdentifier: string;      // "Numéro Quittance: 092B5064CC"
  columnName: string;
  
  // Les 3 valeurs
  sourceValue: string;        // Fichier original
  sentValue: string;          // Envoyé à Zoho (après transformation)
  zohoValue: string | null;   // Lu depuis Zoho (réalité)
  
  // Classification
  type: 'date_inverted' | 'empty_in_zoho' | 'truncated' | 'rounded' | 'encoding' | 'modified';
  severity: 'critical' | 'warning';
  message: string;
  possibleCause: string;
}
```

---

## 6. Limites et contraintes

### 6.1 Performance

- **Vérification limitée** : Max 100 lignes vérifiées (échantillon si > 100)
- **Délai API** : Attendre ~2s après import pour que Zoho indexe
- **Timeout** : 10s max pour la récupération des données

### 6.2 Prérequis

- **Clé de matching obligatoire** : Pour retrouver les lignes dans Zoho
- **Colonne accessible** : Les colonnes doivent être lisibles via API

### 6.3 Cas non couverts

- **Formules Zoho** : Si Zoho applique une formule, la valeur sera différente (normal)
- **Colonnes calculées** : Ignorées dans la comparaison
- **Lookup** : Valeurs de lookup vérifiées en texte brut

---

## 7. Implémentation

### Phase 1 : Preview transformations (Mission 006)

| Tâche | Fichier | Effort |
|-------|---------|--------|
| Composant StepTransformPreview | `components/import/wizard/step-transform-preview.tsx` | 2h |
| Logique de preview | `lib/domain/transformation/preview.ts` | 1h |
| Intégration wizard (nouvelle étape) | `import-wizard.tsx` | 30min |
| Ajuster wizard-progress (8 étapes) | `wizard-progress.tsx` | 15min |

### Phase 2 : Vérification post-import (Mission 007)

| Tâche | Fichier | Effort |
|-------|---------|--------|
| API GET données Zoho | `app/api/zoho/data/route.ts` | 1h |
| Client Zoho getData | `lib/infrastructure/zoho/client.ts` | 1h |
| Logique de comparaison | `lib/domain/verification/compare.ts` | 1h |
| Enrichir StepConfirm avec rapport | `step-confirm.tsx` | 2h |

---

*Document créé le : 4 décembre 2025*
*Statut : Spécification v1.0*
