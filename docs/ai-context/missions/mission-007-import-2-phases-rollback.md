
# Mission 007 : Import en 2 phases avec Rollback

## 📋 Résumé

Transformer le flux d'import actuel (import total puis vérification) en un flux sécurisé en 2 phases :

1. **Phase Test** : Import d'un échantillon (5 lignes par défaut) + vérification
2. **Phase Finale** : Si OK → import du reste, Si KO → rollback + correction

## 🎯 Objectifs

* Éviter d'importer des milliers de lignes avec des erreurs de transformation
* Permettre de corriger le profil AVANT l'import complet
* Garantir la qualité des données dans Zoho

---

## ✅ État d'avancement

| Phase                         | Statut       | Description                         |
| ----------------------------- | ------------ | ----------------------------------- |
| Phase 1 : Infrastructure      | ✅ Complète | API DELETE, service rollback, types |
| Phase 2 : Détection matching | ✅ Complète | Auto-détection colonne, patterns   |
| Phase 3 : UI Import Test      | ✅ Complète | step-test-import, step-test-result  |
| Phase 4 : Intégration Wizard | ✅ Complète | Nouveaux états, flux 2 phases      |
| Phase 5 : Tests               | 🟡 Partiel   | Test succès OK, rollback à tester |

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

## 📁 Fichiers créés (Session 1)

### Infrastructure Rollback

```
lib/domain/rollback/
├── types.ts              # RollbackConfig, RollbackResult, RollbackReason, RollbackLog
├── rollback-service.ts   # executeRollback(), formatRollbackReason(), createRollbackLog()
└── index.ts              # Exports publics
```

### API DELETE

```
app/api/zoho/delete/route.ts   # DELETE /api/zoho/delete - suppression via critère SQL
```

### Détection Matching

```
lib/domain/verification/matching-detection.ts   # findBestMatchingColumnEnhanced()
```

### Composants UI

```
components/import/wizard/
├── step-test-import.tsx           # Étapes: Import → Attente → Vérification
├── step-test-result.tsx           # Résultat avec tableau comparatif 3 colonnes
└── matching-column-selector.tsx   # Sélection manuelle si auto-détection échoue
```

---

## 📁 Fichiers modifiés (Session 1)

| Fichier                                          | Modification                                                                   |
| ------------------------------------------------ | ------------------------------------------------------------------------------ |
| `lib/infrastructure/zoho/client.ts`            | Ajout `deleteData(workspaceId, viewId, criteria)`                            |
| `types/index.ts`                               | Nouveaux types `TwoPhaseImportConfig`,`TestImportResult`, nouveaux statuts |
| `types/profiles.ts`                            | Ajout `verificationColumn?: string`                                          |
| `lib/domain/verification/index.ts`             | Export matching-detection                                                      |
| `lib/hooks/use-import.ts`                      | Réécriture complète : nouveaux états, actions, transitions                 |
| `components/import/wizard/import-wizard.tsx`   | Intégration flux 2 phases, 7 nouveaux handlers                                |
| `components/import/wizard/wizard-progress.tsx` | Nouvelles étapes visuelles (testing, importing)                               |

---

## 🔑 Colonne de matching

### Priorité de sélection (implémentée)

| Priorité | Source                 | Description                                                                                                                                                                                       |
| --------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1         | **Profil**       | `profile.verificationColumn`si défini                                                                                                                                                          |
| 2         | **Schéma Zoho** | Colonne avec `isUnique: true`ou type `AUTO_NUMBER`                                                                                                                                            |
| 3         | **Nom colonne**  | Patterns :`/^id$/i`,`/num[eé]ro.*quittance/i`,`/quittance/i`,`/^n°/i`,`/num[eé]ro/i`,`/code/i`,`/ref[eé]rence/i`,`/matricule/i`,`/identifiant/i`,`/^sku$/i`,`/^uuid$/i` |
| 4         | **Contenu**      | Première colonne avec valeurs 100% uniques et non vides                                                                                                                                          |
| 5         | **Manuel**       | L'utilisateur choisit dans une liste                                                                                                                                                              |

### Résultat retourné

```typescript
interface MatchingColumnResult {
  column: string;
  source: 'profile' | 'schema_unique' | 'schema_auto_number' | 'name_pattern' | 'content_analysis' | 'manual';
  confidence: number;  // 0-100
  alternatives: ColumnMatchingStats[];
}
```

---

## 🖥️ Écran Résultat Test (implémenté)

### Tableau comparatif 3 colonnes

```
┌─────────────────────────────────────────────────────────────────────┐
│  📊 Comparaison détaillée des données                              │
│                                                                     │
│  Sélectionnez une ligne pour voir le détail complet :              │
│  [Ligne 2 ✓] [Ligne 3 ✓] [Ligne 4 ✓] [Ligne 5 ✓] [Ligne 6 ✓]     │
│                                                                     │
│  Ligne 2 — Clé : 092B5064CC                                        │
│                                                                     │
│  ┌───────────┬──────────────┬──────────────┬──────────────┬─────┐ │
│  │ Colonne   │ 📄 Fichier   │ 🔄 Normalisée │ ☁️ Zoho     │ OK  │ │
│  ├───────────┼──────────────┼──────────────┼──────────────┼─────┤ │
│  │ ePV-Logic │ 092B         │ 092b *       │ 092B         │ ✓   │ │
│  │ Attachem. │ CT BELLIARD  │ ct belliard *│ CT BELLIARD  │ ✓   │ │
│  │ Date déb. │ 05/03/2025   │ 05/03/2025   │ 05/03/2025   │ ✓   │ │
│  │ ...       │ ...          │ ...          │ ...          │ ✓   │ │
│  └───────────┴──────────────┴──────────────┴──────────────┴─────┘ │
│                                                                     │
│  * = Valeur modifiée par normalisation                             │
│  ≈ = Valeur équivalente après normalisation                        │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 🐛 Bugs résolus (Session 1)

### Bug 1 : Double exécution React StrictMode

**Problème** : Import exécuté 2 fois en mode dev (erreur "Une autre importation est en cours")

**Cause** : React StrictMode monte les composants 2x pour détecter les effets de bord

**Solution** : Ajout `useRef` dans `step-test-import.tsx` :

```typescript
const hasStartedRef = useRef(false);

useEffect(() => {
  if (!isRunning && !hasStartedRef.current) {
    hasStartedRef.current = true;
    runTestImport();
  }
}, []);
```

### Bug 2 : Échantillon vide lors de la vérification

**Problème** : "Pas d'échantillon à vérifier" malgré import réussi

**Cause** : State React pas encore mis à jour entre `executeTestImport` et `executeTestVerification`

**Solution** : Ajout d'une ref pour accès immédiat dans `import-wizard.tsx` :

```typescript
const verificationSampleRef = useRef<SentRow[]>([]);

// Dans executeTestImport:
verificationSampleRef.current = sampleRows; // Stockage immédiat

// Dans executeTestVerification:
const sampleToVerify = verificationSampleRef.current;
```

---

## ✅ Tests effectués (Session 1)

| Scénario                     | Résultat                                  |
| ----------------------------- | ------------------------------------------ |
| Import test 5 lignes          | ✅ Succès (5 lignes dans Zoho QUITTANCES) |
| Attente indexation 2s         | ✅ OK                                      |
| Vérification post-import     | ✅ 5/5 lignes trouvées                    |
| Détection colonne matching   | ✅ "Numéro Quittance" auto-détecté      |
| Affichage tableau comparatif  | ✅ Fichier/Normalisée/Zoho                |
| Sélection ligne individuelle | ✅ Détail par ligne                       |

---

## 📋 Tests restants (Prochaine session)

| Scénario                            | À tester                                          |
| ------------------------------------ | -------------------------------------------------- |
| Rollback après test                 | Clic "Annuler et rollback" → Suppression 5 lignes |
| Import complet après confirmation   | Clic "Confirmer l'import" → 9 lignes restantes    |
| Anomalies détectées                | Affichage erreurs, recommandation rollback         |
| Forcer import malgré anomalies      | Import avec warnings                               |
| Échec rollback                      | Affichage valeurs à supprimer manuellement        |
| Sélection manuelle colonne matching | Si auto-détection échoue                         |

---

## 🔧 Types TypeScript ajoutés

```typescript
// types/index.ts

/** Statuts étendus */
export type ImportStatus = 
  | 'idle' | 'uploading' | 'profiling' | 'configuring' 
  | 'validating' | 'resolving' | 'previewing' | 'reviewing'
  | 'test-importing' | 'test-result' | 'full-importing'  // NOUVEAUX
  | 'importing' | 'success' | 'error';

/** Phases de progression */
export type ImportPhase = 
  | 'upload' | 'parse' | 'validate' | 'preview' 
  | 'test-importing' | 'verifying' | 'full-importing'  // NOUVEAUX
  | 'import';

/** Résultat de l'import test */
export interface TestImportResult {
  success: boolean;
  rowsImported: number;
  matchingColumn: string;
  matchingValues: string[];
  verification: VerificationResult;
  duration: number;
}

/** Configuration du rollback */
export interface RollbackConfig {
  workspaceId: string;
  viewId: string;
  matchingColumn: string;
  matchingValues: string[];
  reason: RollbackReason;
}

/** Résultat du rollback */
export interface RollbackResult {
  success: boolean;
  deletedRows: number;
  duration: number;
  errorMessage?: string;
  remainingValues?: string[];
}
```

---

## 📊 Logs de test réussi

```
Workspace: 1718953000014173074
Table: QUITTANCES (1718953000024195004)
Import test: 5 lignes, successRowCount: 5
Colonnes détectées: 23
Format date: dd/MM/yyyy
Mode: append

[Verification] Auto-detected matching column: Numéro Quittance
[Verification] Using matching column: Numéro Quittance
[Verification] Criteria: "Numéro Quittance" IN ('092B5064CC','091D506472','09155064AA','1108506478','110F50647A')
[Wizard] Test import complete, success: true
```

---

## ⏱️ Temps réel vs Estimation

| Tâche                         | Estimé       | Réel         |
| ------------------------------ | ------------- | ------------- |
| API DELETE Zoho + client       | 1h            | 0.5h          |
| Service rollback               | 1h            | 0.5h          |
| Améliorer détection matching | 1h            | 1h            |
| step-test-import.tsx           | 1h            | 1h            |
| step-test-result.tsx           | 2h            | 2h            |
| matching-column-selector.tsx   | 1h            | 0.5h          |
| Refactoring import-wizard.tsx  | 2h            | 2.5h          |
| Fix bugs React                 | -             | 1h            |
| **Session 1 Total**      | **~9h** | **~9h** |

---

## 🚀 Prochaines étapes

1. **Tester rollback** : Vérifier suppression des 5 lignes de test
2. **Tester import complet** : Confirmer et importer les 9 lignes restantes
3. **Tester anomalies** : Créer un cas avec erreur de format pour voir l'affichage
4. **Table Supabase** : `rollback_logs` (optionnel, pour historique)
5. **Documentation** : Marquer mission comme COMPLETE

---

*Mission créée le : 2025-12-05*
*Session 1 : 2025-12-05 - Infrastructure + UI + Intégration complètes*
*Statut : 🟡 En cours - Tests partiels*
*Dépend de : Mission 006 (complète)*
