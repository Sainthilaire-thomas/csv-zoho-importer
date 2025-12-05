
# 🎯 Mission 006: Preview des Transformations

*Créée le 2025-12-04*
*Dernière mise à jour : 2025-12-04 (soir)*
*Statut : 🟡 En cours - Phase 1 terminée*

---

## Objectif

Donner à l'utilisateur une compréhension totale des transformations de données :

1. **Avant import** : Preview des transformations (source → format Zoho) ✅ FAIT
2. **Après import** : Vérification des données réellement stockées dans Zoho 🔜 À FAIRE

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

### Capture d'écran fonctionnelle :

L'interface affiche :

* 4 stats en haut : lignes à importer, colonnes mappées, avec transformation, sans modification
* 2 boutons toggle : "Transformées (N)" et "Toutes les colonnes (N)"
* Sélecteur : 3/5/10 lignes
* Tableau avec données réelles et indicateurs visuels

---

## 🔜 Phase 2 : Vérification Post-Import - À FAIRE

### Objectif

Après l'import, récupérer les données depuis Zoho via API GET et les comparer à ce qu'on a envoyé.

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

### Permet de détecter si Zoho a :

* Réinterprété une date (jour/mois inversés : 05/03 → 03/05)
* Tronqué un texte trop long
* Arrondi un nombre (décimales perdues)
* Changé l'encodage (accents perdus : é → ?)
* Ignoré une colonne

### Fichiers à créer :

| Fichier                                                   | Description                             | Estimation |
| --------------------------------------------------------- | --------------------------------------- | ---------- |
| `app/api/zoho/data/route.ts`                            | API GET données depuis Zoho            | 1h         |
| `lib/domain/verification/compare.ts`                    | Logique de comparaison envoyé vs reçu | 1h         |
| `components/import/wizard/step-result-verification.tsx` | Composant rapport anomalies             | 2h         |

### API Zoho nécessaire :

```typescript
// GET https://analyticsapi.zoho.eu/restapi/v2/workspaces/{workspaceId}/views/{viewId}/data
// Avec critères pour filtrer sur les lignes importées

async function fetchImportedRows(
  workspaceId: string,
  viewId: string,
  matchingColumn: string,
  matchingValues: string[]
): Promise<Record<string, unknown>[]>
```

### Types d'anomalies détectables :

| Niveau      | Type               | Exemple                             |
| ----------- | ------------------ | ----------------------------------- |
| 🔴 Critique | Valeur différente | Date 05/03 → 03/05 (inversée)     |
| 🔴 Critique | Colonne vide       | Source avait valeur, Zoho vide      |
| 🟡 Warning  | Troncature         | Texte coupé après 255 caractères |
| 🟡 Warning  | Arrondi            | 1234.567 → 1234.57                 |
| 🟡 Warning  | Encodage           | "Café" → "Caf?"                   |

### Questions ouvertes :

1. **Performance** : Limiter vérification aux N premières lignes ?
2. **Clé matching** : Comment identifier lignes importées sans clé unique ?
3. **Timing** : Attendre combien de temps après import ? (indexation Zoho ~2s)
4. **Rollback** : Proposer suppression automatique si anomalies critiques ?

---

## 📊 Métriques Phase 1

| Métrique                | Valeur |
| ------------------------ | ------ |
| Fichiers créés         | 3      |
| Fichiers modifiés       | 5      |
| Lignes de code ajoutées | ~450   |
| Durée de session        | ~1h30  |

---

## 📋 Prochaine Session (05/12/2025)

### Priorité 1 : Git et documentation

* [ ] Commit Git de la Phase 1
* [ ] Vérifier que tout fonctionne en dev

### Priorité 2 : Phase 2 - Vérification Post-Import

* [ ] Rechercher documentation API Zoho GET data
* [ ] Créer `app/api/zoho/data/route.ts`
* [ ] Implémenter la logique de comparaison
* [ ] Créer le composant de rapport de vérification
* [ ] Intégrer après l'écran de succès

### Optionnel : Améliorations Phase 1

* [ ] Utiliser les vraies transformations du schéma (pas simulation)
* [ ] Améliorer le responsive mobile
* [ ] Ajouter export du preview en CSV

---

## Commit Git suggéré

```bash
git add .
git commit -m "feat(mission-006): étape preview transformations dans wizard

- Ajout status 'previewing' dans types/index.ts
- Navigation 8 étapes dans use-import.ts
- Composant StepTransformPreview avec tableau données réelles
- Toggle colonnes transformées/toutes + sélecteur nb lignes
- Indicateurs visuels source → transformé
- Fix Suspense boundary page import (bug Next.js)"
```

---

*Mission créée le : 2025-12-04*
*Phase 1 terminée le : 2025-12-04*
*Prochaine session : 05/12/2025 - Phase 2 Vérification Post-Import*
