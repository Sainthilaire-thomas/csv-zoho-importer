# Mission 007 : Import en 2 phases avec Rollback

## 📋 Résumé

Transformer le flux d'import actuel (import total puis vérification) en un flux sécurisé en 2 phases :
1. **Phase Test** : Import d'un échantillon (5 lignes par défaut) + vérification
2. **Phase Finale** : Si OK → import du reste, Si KO → rollback + correction

## 🎯 Objectifs

- Éviter d'importer des milliers de lignes avec des erreurs de transformation
- Permettre de corriger le profil AVANT l'import complet
- Garantir la qualité des données dans Zoho

---

## 🔄 Nouveau flux utilisateur

```
Upload → Profil → Schéma → Preview 
                              ↓
                    ┌─────────────────┐
                    │  IMPORT TEST    │ ← 5 lignes (configurable)
                    │  (échantillon)  │
                    └────────┬────────┘
                             ↓
                    ┌─────────────────┐
                    │  VÉRIFICATION   │ ← Compare envoyé vs Zoho
                    └────────┬────────┘
                             ↓
                    ┌────────┴────────┐
                    ↓                 ↓
              ✅ Succès          ❌ Anomalies
                    ↓                 ↓
           ┌───────────────┐  ┌───────────────┐
           │ IMPORT RESTE  │  │   ROLLBACK    │
           │ (N-5 lignes)  │  │ + Correction  │
           └───────┬───────┘  └───────┬───────┘
                   ↓                  ↓
              CONFIRMATION      Retour Preview
                                      ↓
                               Modifier profil
                                      ↓
                                 Re-tester
```

---

## 🔑 Colonne de matching

### Priorité de sélection

| Priorité | Source | Description |
|----------|--------|-------------|
| 1 | **Profil** | `profile.matchingColumn` si défini |
| 2 | **Schéma Zoho** | Colonne avec `isUnique: true` ou type `AUTO_NUMBER` |
| 3 | **Nom colonne** | Patterns : `/^id$/i`, `/num[eé]ro/i`, `/code/i`, `/ref/i`, `/n°/i` |
| 4 | **Contenu** | Première colonne avec valeurs 100% uniques et non vides |
| 5 | **Manuel** | L'utilisateur choisit dans une liste |
| 6 | **Aucune** | Avertissement, import sans vérification possible |

### Interface de sélection manuelle

Si aucune colonne n'est détectée automatiquement :

```
┌─────────────────────────────────────────────────────────────┐
│  ⚠️ Aucune colonne de matching détectée                     │
│                                                             │
│  Pour vérifier l'intégrité des données après import,       │
│  sélectionnez une colonne avec des valeurs uniques :       │
│                                                             │
│  ○ ePV-Logique (92% unique)                                │
│  ○ Journal (100% unique) ← Recommandé                      │
│  ○ Matricule (78% unique)                                  │
│  ○ Aucune - Continuer sans vérification                    │
│                                                             │
│  [Continuer]                                                │
└─────────────────────────────────────────────────────────────┘
```

### Stockage dans le profil

```typescript
interface ImportProfile {
  // ... existant
  
  /** Colonne utilisée pour identifier les lignes de façon unique */
  matchingColumn?: string;
  
  /** Taille de l'échantillon de test (défaut: 5) */
  testSampleSize?: number;
}
```

---

## 📊 Configuration de l'échantillon

| Paramètre | Défaut | Min | Max | Description |
|-----------|--------|-----|-----|-------------|
| `testSampleSize` | 5 | 1 | 50 | Nombre de lignes pour le test |

### Interface de configuration

```
┌─────────────────────────────────────────────────────────────┐
│  ⚙️ Options d'import                                        │
│                                                             │
│  Taille de l'échantillon de test : [5] lignes              │
│  ℹ️ Ces lignes seront importées puis vérifiées avant       │
│     d'importer le reste du fichier.                        │
│                                                             │
│  Colonne de matching : [Numéro Quittance ▼] (auto-détecté) │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 🖥️ Nouveaux écrans

### Écran 1 : Import Test (step-test-import)

```
┌─────────────────────────────────────────────────────────────┐
│                    🧪 Import de test                        │
│                                                             │
│  Nous allons d'abord importer 5 lignes pour vérifier       │
│  que les transformations sont correctes.                    │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ ✅ Import de 5 lignes                    0.8s       │   │
│  │ ✅ Attente indexation Zoho               2.0s       │   │
│  │ 🔄 Vérification des données...                      │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Colonne de matching : Numéro Quittance                    │
│  Valeurs testées : 092B5064CC, 091D506472, ...             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Écran 2a : Vérification OK (step-test-result)

```
┌─────────────────────────────────────────────────────────────┐
│              ✅ Test réussi !                               │
│                                                             │
│  5 lignes importées et vérifiées avec succès.              │
│                                                             │
│  📊 Résumé de la vérification                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Lignes testées    : 5                               │   │
│  │ Lignes trouvées   : 5                               │   │
│  │ Anomalies         : 0                               │   │
│  │ Durée vérification: 347ms                           │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  [Voir le détail des données ▼]                            │
│                                                             │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━   │
│                                                             │
│  Voulez-vous importer les 9 lignes restantes ?             │
│                                                             │
│  [Annuler et rollback]        [✅ Confirmer l'import]      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Écran 2b : Vérification KO

```
┌─────────────────────────────────────────────────────────────┐
│              ⚠️ Anomalies détectées                         │
│                                                             │
│  Le test a révélé des problèmes sur 2 lignes.              │
│                                                             │
│  🔴 2 anomalies critiques                                  │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Ligne 3 - Date inversée                             │   │
│  │   Date début: 05/03/2025 → Zoho: 2025-05-03        │   │
│  │                                                     │   │
│  │ Ligne 5 - Valeur tronquée                          │   │
│  │   Arrêt: "SAINT GERMAIN-OUEST" → "SAINT GER"       │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  💡 Recommandation :                                        │
│  Annulez le test, corrigez le profil (format de date,      │
│  longueur max), puis relancez l'import.                    │
│                                                             │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━   │
│                                                             │
│  [🔄 Rollback + Corriger]     [⚠️ Forcer l'import quand    │
│                                    même]                    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Écran 3 : Import complet en cours

```
┌─────────────────────────────────────────────────────────────┐
│              📤 Import en cours...                          │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ ████████████████████░░░░░░░░ 65%                    │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  9 / 14 lignes importées                                   │
│  (5 lignes déjà importées lors du test)                    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔙 Spécification du Rollback

### Déclenchement

| Situation | Action |
|-----------|--------|
| Vérification KO + clic "Rollback" | Supprimer les N lignes de test |
| Vérification OK + clic "Annuler" | Supprimer les N lignes de test |
| Import complet réussi | Pas de rollback possible |

### Mécanisme technique

```typescript
interface RollbackConfig {
  workspaceId: string;
  viewId: string;
  matchingColumn: string;
  matchingValues: string[];  // Les N valeurs de l'échantillon
}

interface RollbackResult {
  success: boolean;
  deletedRows: number;
  errors?: string[];
  duration: number;
}
```

### API Zoho pour suppression

```
DELETE /restapi/v2/workspaces/{workspaceId}/views/{viewId}/data
  ?CONFIG={"criteria": "\"Numéro Quittance\" IN ('val1','val2','val3')"}
```

### Flux de rollback

```
┌─────────────────────────────────────────────────────────────┐
│  🔄 Rollback en cours...                                    │
│                                                             │
│  ✅ Construction du critère de suppression                 │
│  ✅ Envoi requête DELETE à Zoho                            │
│  ✅ 5 lignes supprimées                                    │
│                                                             │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━   │
│                                                             │
│  Vous pouvez maintenant corriger le profil et relancer.    │
│                                                             │
│  [Modifier le profil]           [Retour à l'accueil]       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Cas d'échec du rollback

```
┌─────────────────────────────────────────────────────────────┐
│  ❌ Échec du rollback                                       │
│                                                             │
│  Impossible de supprimer les lignes de test :              │
│  "Erreur API Zoho : Permission denied"                     │
│                                                             │
│  ⚠️ Les 5 lignes de test sont toujours dans Zoho.         │
│  Vous devrez les supprimer manuellement.                   │
│                                                             │
│  Valeurs à supprimer (Numéro Quittance) :                  │
│  • 092B5064CC                                              │
│  • 091D506472                                              │
│  • 09155064AA                                              │
│  • 1108506478                                              │
│  • 110F50647A                                              │
│                                                             │
│  [Copier les valeurs]           [Fermer]                   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 📝 Logging des rollbacks

### Table Supabase : import_history (modification)

```sql
-- Ajouter colonnes pour le rollback
ALTER TABLE import_history ADD COLUMN IF NOT EXISTS 
  rollback_at TIMESTAMPTZ,
  rollback_reason TEXT,
  rollback_rows INTEGER;
```

### Ou nouvelle table : rollback_logs

```sql
CREATE TABLE rollback_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Contexte
  workspace_id TEXT NOT NULL,
  view_id TEXT NOT NULL,
  profile_id UUID REFERENCES import_profiles(id),
  
  -- Données rollback
  matching_column TEXT NOT NULL,
  matching_values TEXT[] NOT NULL,
  rows_deleted INTEGER NOT NULL,
  
  -- Raison
  reason TEXT NOT NULL, -- 'verification_failed', 'user_cancelled', 'error_recovery'
  anomalies_detected JSONB, -- Détail des anomalies si applicable
  
  -- Résultat
  success BOOLEAN NOT NULL,
  error_message TEXT,
  duration_ms INTEGER
);

-- Index
CREATE INDEX idx_rollback_logs_user ON rollback_logs(user_id);
CREATE INDEX idx_rollback_logs_profile ON rollback_logs(profile_id);
```

---

## 📁 Structure des fichiers

### Nouveaux fichiers à créer

```
lib/domain/
├── verification/
│   └── (existant)
└── rollback/                          # NOUVEAU
    ├── index.ts
    ├── types.ts
    └── rollback-service.ts

app/api/zoho/
├── (existants)
└── delete/                            # NOUVEAU
    └── route.ts

components/import/wizard/
├── (existants)
├── step-test-import.tsx               # NOUVEAU
├── step-test-result.tsx               # NOUVEAU
└── matching-column-selector.tsx       # NOUVEAU
```

### Fichiers à modifier

```
lib/infrastructure/zoho/client.ts      # Ajouter deleteData()
lib/domain/verification/compare.ts     # Améliorer détection matching
types/index.ts                         # Nouveaux types
components/import/wizard/
├── import-wizard.tsx                  # Nouveau flux étapes
└── step-confirm.tsx                   # Simplifier
```

---

## 🔧 Types TypeScript

```typescript
// types/index.ts - Ajouts

/** Configuration de l'import en 2 phases */
export interface TwoPhaseImportConfig {
  testSampleSize: number;        // Défaut: 5
  matchingColumn?: string;       // Auto-détecté ou manuel
  skipVerification?: boolean;    // Passer outre la vérification
}

/** Résultat de l'import test */
export interface TestImportResult {
  success: boolean;
  rowsImported: number;
  matchingColumn: string;
  matchingValues: string[];      // Pour le rollback
  verification: VerificationResult;
  duration: number;
}

/** Configuration du rollback */
export interface RollbackConfig {
  workspaceId: string;
  viewId: string;
  matchingColumn: string;
  matchingValues: string[];
  reason: 'verification_failed' | 'user_cancelled' | 'error_recovery';
}

/** Résultat du rollback */
export interface RollbackResult {
  success: boolean;
  deletedRows: number;
  duration: number;
  errorMessage?: string;
}

/** Étapes du wizard mises à jour */
export type WizardStep = 
  | 'upload' 
  | 'profiling' 
  | 'schema' 
  | 'validation'
  | 'preview' 
  | 'test-import'       // NOUVEAU
  | 'test-result'       // NOUVEAU
  | 'full-import'       // NOUVEAU
  | 'confirm';
```

---

## ⏱️ Estimation

| Tâche | Effort |
|-------|--------|
| API DELETE Zoho + client | 1h |
| Service rollback | 1h |
| Améliorer détection matching | 1h |
| step-test-import.tsx | 1h |
| step-test-result.tsx | 2h |
| matching-column-selector.tsx | 1h |
| Refactoring import-wizard.tsx | 2h |
| Table Supabase rollback_logs | 0.5h |
| Tests et debug | 1.5h |
| **TOTAL** | **~11h** |

---

## 🚀 Plan d'implémentation

### Phase 1 : Infrastructure (3h)
1. API DELETE Zoho
2. Méthode `deleteData()` dans client.ts
3. Service rollback
4. Types TypeScript
5. Table Supabase

### Phase 2 : Détection matching (1h)
1. Améliorer `findBestMatchingColumn()`
2. Utiliser le schéma Zoho (isUnique)
3. Ajouter matchingColumn au profil

### Phase 3 : UI Import Test (3h)
1. step-test-import.tsx
2. step-test-result.tsx
3. matching-column-selector.tsx

### Phase 4 : Intégration Wizard (3h)
1. Nouvelles étapes dans import-wizard.tsx
2. Flux conditionnel (OK → full import, KO → rollback)
3. Bouton "Forcer l'import"

### Phase 5 : Finalisation (1h)
1. Logging rollbacks
2. Tests end-to-end
3. Documentation

---

## ✅ Critères de validation

- [ ] Import test de 5 lignes fonctionne
- [ ] Vérification détecte les anomalies
- [ ] Rollback supprime exactement les lignes de test
- [ ] Import du reste fonctionne après validation
- [ ] "Forcer l'import" fonctionne avec avertissement
- [ ] Colonne de matching auto-détectée ou sélectionnable
- [ ] Rollbacks loggés en base
- [ ] Gestion des erreurs (rollback impossible, etc.)

---

## 📚 Prérequis Mission 006

- ✅ Vérification post-import fonctionnelle
- ✅ Comparaison envoyé vs Zoho
- ✅ Affichage tableau 3 colonnes (Fichier/Normalisé/Zoho)
- ✅ Détection anomalies (date inversée, troncature, etc.)

---

*Mission créée le : 2025-12-05*
*Statut : 📋 Spécifiée - Prête à démarrer*
*Dépend de : Mission 006 (complète)*
