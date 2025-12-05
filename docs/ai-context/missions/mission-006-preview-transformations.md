
# 🎯 Mission 006: Preview des Transformations

*Créée le 2025-12-04*
*Dernière mise à jour : 2025-12-05*
*Statut : 🟡 En cours - Phase 2 en développement*

---

## Objectif

Donner à l'utilisateur une compréhension totale des transformations de données :

1. **Avant import** : Preview des transformations (source → format Zoho) ✅ FAIT
2. **Après import** : Vérification des données réellement stockées dans Zoho 🔄 EN COURS

---

## ✅ Phase 1 : Preview des Transformations - TERMINÉE

### Réalisations (04/12/2025)

#### Fichiers créés :

| Fichier                                                 | Description                        |
| ------------------------------------------------------- | ---------------------------------- |
| `lib/domain/transformation/preview.ts`                | Logique de génération du preview |
| `lib/domain/transformation/index.ts`                  | Export du module                   |
| `components/import/wizard/step-transform-preview.tsx` | Composant UI complet (~300 lignes) |

#### Fichiers modifiés :

| Fichier                                          | Modification                                                          |
| ------------------------------------------------ | --------------------------------------------------------------------- |
| `types/index.ts`                               | Ajout du status `'previewing'`                                      |
| `lib/hooks/use-import.ts`                      | Navigation avec étape previewing, goBack vers previewing             |
| `components/import/wizard/wizard-progress.tsx` | 8 étapes au lieu de 7                                                |
| `components/import/wizard/import-wizard.tsx`   | Import StepTransformPreview + case 'previewing' + prop matchedColumns |
| `app/(dashboard)/import/page.tsx`              | Fix Suspense boundary (bug Next.js préexistant)                      |

#### Nouveau flow du wizard (8 étapes) :

```
1. Fichier → 2. Profil → 3. Config → 4. Validation → 5. Résolution → 6. Aperçu → 7. Vérification → 8. Terminé
```

#### Fonctionnalités implémentées :

* ✅ Résumé avec 4 statistiques (lignes, colonnes mappées, transformées, inchangées)
* ✅ Toggle pour afficher "Colonnes transformées" ou "Toutes les colonnes"
* ✅ Sélecteur nombre de lignes d'échantillon (3, 5, 10)
* ✅ Tableau avec données RÉELLES du fichier importé
* ✅ Affichage Source → Valeur transformée côte à côte par cellule
* ✅ Indicateurs visuels : flèche bleue 🔄 (transformé), check vert ✅ (inchangé)
* ✅ En-tête colonnes : nom fichier → nom Zoho + badge type transformation
* ✅ Liste des colonnes inchangées en badges
* ✅ Note explicative pour l'utilisateur
* ✅ Navigation Retour/Confirmer fonctionnelle

---

## 🔄 Phase 2 : Vérification Post-Import - EN COURS

### Objectif

Après l'import, récupérer les données depuis Zoho via API GET et les comparer à ce qu'on a envoyé.

### Décisions prises

| Question                                | Décision                                                    |
| --------------------------------------- | ------------------------------------------------------------ |
| **Stratégie d'identification**   | Option A : Échantillonnage (5 premières lignes)            |
| **Support UPDATE**                | Oui, via la colonne de matching (obligatoire pour updateadd) |
| **Timing**                        | Attendre 2 secondes après import avant lecture              |
| **Nombre de lignes à vérifier** | 5 lignes par défaut (configurable)                          |

### Les 3 états de la donnée :

```
┌─────────────────────┐     ┌─────────────────────┐     ┌─────────────────────┐
│  1. FICHIER SOURCE  │     │  2. ENVOYÉ À ZOHO   │     │  3. LU DEPUIS ZOHO  │
│  (Excel/CSV)        │     │  (API POST import)  │     │  (API GET data)     │
├─────────────────────┤     ├─────────────────────┤     ├─────────────────────┤
│  05/03/2025         │ ──▶ │  2025-03-05         │ ──▶ │  2025-05-03 ???     │
│  (donnée brute)     │     │  (transformé)       │     │  (réalité Zoho)     │
└─────────────────────┘     └─────────────────────┘     └─────────────────────┘
```

### Flow de vérification

```
1. AVANT IMPORT : Garder les 5 premières lignes en mémoire (sentRows)
   ↓
2. IMPORT : Envoyer à Zoho normalement
   ↓
3. ATTENDRE : 2 secondes (indexation Zoho)
   ↓
4. LIRE : GET /api/zoho/data avec critères
   │
   ├─ Mode APPEND : Chercher par valeurs multiples OU dernières lignes
   └─ Mode UPDATE : Critère sur matchingColumn (obligatoire)
   ↓
5. COMPARER : envoyé vs lu (colonne par colonne)
   ↓
6. AFFICHER : Rapport dans StepConfirm (intégré à l'écran de succès)
```

### Fichiers à créer :

| Fichier                                | Description                             | Estimation |
| -------------------------------------- | --------------------------------------- | ---------- |
| `lib/infrastructure/zoho/client.ts`  | Ajouter méthode `exportData()`       | 30min      |
| `app/api/zoho/data/route.ts`         | API GET données depuis Zoho            | 45min      |
| `lib/domain/verification/types.ts`   | Types pour la vérification             | 15min      |
| `lib/domain/verification/compare.ts` | Logique de comparaison envoyé vs reçu | 45min      |
| `lib/domain/verification/index.ts`   | Export du module                        | 5min       |

### Fichiers à modifier :

| Fichier                                        | Modification                                   | Estimation |
| ---------------------------------------------- | ---------------------------------------------- | ---------- |
| `types/index.ts`                             | Enrichir `ImportResult`avec `verification` | 10min      |
| `components/import/wizard/import-wizard.tsx` | Garder échantillon + appeler vérification    | 30min      |
| `components/import/wizard/step-confirm.tsx`  | Afficher rapport de vérification              | 1h         |

### API Zoho utilisée

```
GET /restapi/v2/workspaces/{workspaceId}/views/{viewId}/data?CONFIG={...}

CONFIG = {
  "responseFormat": "json",
  "criteria": "\"N° PV\" IN ('12345','12346','12347')"  // Pour UPDATE
}

Headers:
  - Authorization: Zoho-oauthtoken {token}
  - ZANALYTICS-ORGID: {orgId}
```

### Types d'anomalies détectables :

| Niveau      | Type               | Exemple                             | Détection                    |
| ----------- | ------------------ | ----------------------------------- | ----------------------------- |
| 🔴 Critique | Valeur différente | Date 05/03 → 03/05 (inversée)     | `sent !== received`         |
| 🔴 Critique | Colonne vide       | Source avait valeur, Zoho vide      | `sent && !received`         |
| 🔴 Critique | Ligne manquante    | Ligne non trouvée dans Zoho        | Count mismatch                |
| 🟡 Warning  | Troncature         | Texte coupé après 255 caractères | `received.startsWith(sent)` |
| 🟡 Warning  | Arrondi            | 1234.567 → 1234.57                 | Différence < 0.01            |
| 🟡 Warning  | Encodage           | "Café" → "Caf?"                   | Unicode check                 |

### Structure des types

```typescript
// lib/domain/verification/types.ts

export interface VerificationConfig {
  mode: 'append' | 'updateadd';
  matchingColumn?: string;        // Obligatoire pour updateadd
  sampleSize: number;             // 5 par défaut
  workspaceId: string;
  viewId: string;
}

export interface SentRow {
  index: number;                  // Index dans le fichier original
  data: Record<string, string>;   // Données envoyées
}

export type AnomalyLevel = 'critical' | 'warning';
export type AnomalyType = 
  | 'value_different' 
  | 'value_missing' 
  | 'row_missing'
  | 'truncated'
  | 'rounded'
  | 'encoding';

export interface Anomaly {
  level: AnomalyLevel;
  type: AnomalyType;
  rowIndex: number;
  column: string;
  sentValue: string;
  receivedValue: string;
  message: string;
}

export interface VerificationResult {
  success: boolean;
  checkedRows: number;
  matchedRows: number;
  anomalies: Anomaly[];
  duration: number;
  summary: {
    critical: number;
    warning: number;
  };
}

// Extension de ImportResult
export interface ImportResultWithVerification extends ImportResult {
  verification?: VerificationResult;
}
```

### UI du rapport de vérification

Intégré dans `StepConfirm`, après les stats d'import :

```
┌─────────────────────────────────────────────────────────────────────┐
│                        ✅ Import réussi !                           │
│                                                                     │
│  ┌─────────────────┐  ┌─────────────────┐                          │
│  │     1,247       │  │      2.3s       │                          │
│  │ lignes importées│  │  durée totale   │                          │
│  └─────────────────┘  └─────────────────┘                          │
│                                                                     │
│  ─────────────────────────────────────────────────────────────────  │
│                                                                     │
│  📋 VÉRIFICATION POST-IMPORT                                        │
│  ─────────────────────────────────────────────────────────────────  │
│                                                                     │
│  ✅ 5 lignes vérifiées sur 5                                       │
│  ✅ 0 anomalie détectée                                            │
│  ✅ Intégrité des données confirmée                                │
│                                                                     │
│  [Nouvel import]  [Ouvrir Zoho Analytics]                          │
└─────────────────────────────────────────────────────────────────────┘
```

Ou en cas d'anomalies :

```
┌─────────────────────────────────────────────────────────────────────┐
│  ⚠️ VÉRIFICATION POST-IMPORT                                        │
│  ─────────────────────────────────────────────────────────────────  │
│                                                                     │
│  ⚠️ 5 lignes vérifiées, 2 anomalies détectées                      │
│                                                                     │
│  🔴 Ligne 3, colonne "Date début"                                  │
│     Envoyé: 2025-03-05 → Reçu: 2025-05-03                          │
│     ⚠️ Date potentiellement inversée (jour/mois)                   │
│                                                                     │
│  🟡 Ligne 7, colonne "Observation"                                 │
│     Texte tronqué après 255 caractères                             │
│                                                                     │
│  [Voir détails]  [Nouvel import]  [Ouvrir Zoho]                    │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 📊 Métriques Phase 1

| Métrique                | Valeur |
| ------------------------ | ------ |
| Fichiers créés         | 3      |
| Fichiers modifiés       | 5      |
| Lignes de code ajoutées | ~450   |
| Durée de session        | ~1h30  |

---

## 📋 Session 05/12/2025 - Phase 2

### Ordre d'implémentation

1. ⬜ Ajouter méthode `exportData()` dans `client.ts`
2. ⬜ Créer `app/api/zoho/data/route.ts`
3. ⬜ Créer `lib/domain/verification/types.ts`
4. ⬜ Créer `lib/domain/verification/compare.ts`
5. ⬜ Créer `lib/domain/verification/index.ts`
6. ⬜ Modifier `types/index.ts` (ImportResult)
7. ⬜ Modifier `import-wizard.tsx` (garder échantillon)
8. ⬜ Modifier `step-confirm.tsx` (afficher rapport)
9. ⬜ Tests manuels
10. ⬜ Commit Git

### Estimation totale : ~4h

---

## Commit Git suggéré (Phase 2)

```bash
git add .
git commit -m "feat(mission-006): vérification post-import

- Ajout méthode exportData() dans client Zoho
- API GET /api/zoho/data pour lecture données
- Module verification/ avec compare.ts et types.ts
- Rapport de vérification intégré dans StepConfirm
- Détection anomalies: valeurs différentes, troncature, arrondi
- Support modes APPEND et UPDATE (via matchingColumn)"
```

---

*Mission créée le : 2025-12-04*
*Phase 1 terminée le : 2025-12-04*
*Phase 2 démarrée le : 2025-12-05*
