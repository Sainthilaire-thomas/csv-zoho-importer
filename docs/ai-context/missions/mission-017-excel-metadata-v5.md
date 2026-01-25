# Mission 017 : Exploitation des Métadonnées Excel pour la Détection de Types

*Date de création : 2026-01-24*
*Dernière mise à jour : 2026-01-25 (Session 3 - Final)*
*Statut : ✅ PHASES 1, 2 & 3 TERMINÉES - Import fonctionnel, RowID Sync opérationnel*
*Prérequis : Mission 015 (UX Historique) terminée ✅*
*Priorité : Haute*

---

## 1. Contexte

### 1.1 Problème initial
Lors de l'import du fichier `REGT_04_a_12_2025.xlsx`, l'application crashait avec l'erreur :
```
TypeError: value.trim is not a function
```

**Cause** : La bibliothèque `xlsx` parse les fichiers Excel en conservant les types natifs JavaScript (number, boolean, Date), alors que le code attendait uniquement des strings (comme avec CSV/Papa Parse).

### 1.2 Problème découvert pendant l'implémentation
Les dates Excel sont stockées comme des **nombres sériels** (ex: `45088.98` = 11/06/2023). De plus, xlsx génère un format américain (`m/d/yy`) et un affichage incorrect (`w: "6/11/23"`) pour les cellules au format "Standard".

### 1.3 Découverte clé : Formats locale-aware
Le format `m/d/yy` dans Excel est un **format locale-aware** : il s'adapte aux paramètres régionaux de Windows. xlsx ne le sait pas et l'interprète toujours littéralement (américain).

---

## 2. Travaux réalisés - Session 3 (25/01/2026)

### 2.1 Problèmes résolus

#### Bug 1 : Dates envoyées en ISO mais Zoho attend son format spécifique
**Problème** : L'API Zoho retourne un `dateFormat` par colonne (ex: `"dd MMM yyyy HH:mm:ss"`, `"MM/yyyy"`). On envoyait des dates transformées vers ces formats, mais l'API Zoho préfère recevoir un format uniforme.

**Solution** : Envoyer TOUTES les dates en **format ISO** (`yyyy-MM-dd HH:mm:ss`) à l'API avec `dateFormat: 'yyyy-MM-dd HH:mm:ss'` dans le CONFIG. Zoho stocke et affiche selon son propre format configuré.

#### Bug 2 : Comparaison post-import échouait (faux positifs dates)
**Problème** : On comparait `2025-04-01 09:01:00` (envoyé) avec `01 Apr 2025 09:01:00` (retourné par Zoho) → marqué comme "Différent" alors que c'est la même date.

**Solution** : Amélioration de `tryParseDateToCanonical()` dans `compare.ts` pour reconnaître :
- Format Zoho **sans virgule** : `"01 Apr 2025 09:01:00"`
- Format période `MM/yyyy` : `"04/2025"` → `2025-04-01`

#### Bug 3 : API getLastRowId retournait 400 (RowID Sync cassé)
**Problème** : L'API CloudSQL v1 pour récupérer le vrai MAX(RowID) échouait avec erreur 400 car `zohoEmail` était `null`.

**Cause racine** : Le callback OAuth ne récupérait pas l'email Zoho de l'utilisateur lors de la connexion.

**Impact** : 
- Le code utilisait le fallback `calculateEndRowId()` (calcul approximatif)
- RowID stocké (138477) ≠ vrai MAX(RowID) dans Zoho (185652)
- Écart de 47175 RowID !

**Solution** :
1. Ajout du scope `aaaserver.profile.READ` dans `lib/infrastructure/zoho/types.ts`
2. Création de `fetchZohoUserInfo()` dans `lib/infrastructure/zoho/auth.ts` pour appeler `/oauth/user/info`
3. Stockage de `zoho_email` et `zoho_user_id` dans Supabase lors du callback OAuth

**Résultat** : Email récupéré `thomas.renaudin@sonear.com` et stocké ✅

### 2.2 Résultat final Session 3

✅ **Import de 21 633 lignes réussi en 9 secondes** (5 lignes test + 5 lots de 5000 + 1 lot de 1628)
✅ **Vérification post-import : 0 anomalie détectée**

| Colonne | Valeur envoyée (ISO) | Valeur Zoho (affichage) | Comparaison |
|---------|---------------------|------------------------|-------------|
| `date d'appel` | `2025-04-01 09:01:00` | `01 Apr 2025 09:01:00` | ✅ Égales |
| `période appel` | `2025-04-01 00:00:00` | `04/2025` | ✅ Égales |
| `période pv` | `2024-12-01 00:00:00` | `01 Dec 2024 00:00:00` | ✅ Égales |

### 2.3 Problème identifié : Encodage caractères accentués

**Symptôme** : Dans Zoho, certaines valeurs texte affichent des caractères corrompus :
- `Réponse du client` → `RÃ©ponse du client`
- `Msg répondeur-Msg laissé à un tiers` → `Msg rÃ©pondeur-Msg laissÃ© Ã  un tiers`
- `Occupé - ne répond pas` → `OccupÃ© - ne rÃ©pond pas`

**Diagnostic** : C'est un problème d'encodage UTF-8 interprété comme Latin-1 (ISO-8859-1). Le problème apparaît uniquement dans les derniers lots de données (lignes de décembre), suggérant que le fichier Excel source contient des données avec un encodage incohérent.

**État actuel** : 
- Le Blob est créé avec `charset=utf-8` ✅
- Le FileReader utilise `readAsArrayBuffer` ✅
- Le problème vient probablement du fichier Excel source lui-même

**À investiguer** :
1. Vérifier l'encodage du fichier Excel source
2. Ajouter une normalisation UTF-8 lors du parsing xlsx
3. Ou ajouter une détection/correction d'encodage avant envoi à Zoho

---

## 3. Travaux réalisés - Session 2 (24/01/2026)

### 3.1 Problèmes résolus

#### Bug 1 : Dates avec heure non transformées
**Problème** : `date_pv` contenait `11/06/2023 23:35:00` mais n'était pas détectée comme date car le regex ne supportait pas les heures.

**Solution** :
- Ajout de patterns avec heure dans `detectValueType()` (`schema-validator.ts`)
- Modification de `applyTransformation()` pour gérer `DD/MM/YYYY HH:mm:ss`

#### Bug 2 : Périodes mois-année non reconnues
**Problème** : `Période du règlement` contient `juin-25`, `août-25` → erreur Zoho "Date non valide"

**Solution** : Ajout transformation des périodes françaises dans `applyTransformation()` :
```typescript
// juin-25 → 2025-06-01 00:00:00
// août-25 → 2025-08-01 00:00:00
```

#### Bug 3 : Caractères accentués corrompus (août → ao�t)
**Problème** : Le fichier Excel contient des caractères mal encodés (`ao�t-25` au lieu de `août-25`)

**Solution** : Normalisation Unicode avant matching des mois :
```typescript
const normalizedValue = value
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')  // Supprime les accents
  .replace(/\uFFFD/g, '')           // Supprime les caractères de remplacement
```

### 3.2 Résultat Session 2

✅ **Import de 29 806 lignes réussi en ~11 secondes** (fichier REGT_04_a_12_2025.xlsx)

---

## 4. Fichiers modifiés (Toutes sessions)

### Session 3 (25/01/2026)
| Fichier | Modification |
|---------|--------------|
| `lib/infrastructure/zoho/types.ts` | Ajout `dateFormat?: string` au type `ZohoColumn` + scope `aaaserver.profile.READ` |
| `lib/infrastructure/zoho/client.ts` | Récupération `dateFormat` depuis API |
| `lib/infrastructure/zoho/auth.ts` | **NOUVEAU** `fetchZohoUserInfo()` + stockage email/userId |
| `lib/domain/schema-validator.ts` | Propagation `zohoDateFormat` dans `ColumnMapping` |
| `lib/domain/data-transformer.ts` | Fonction `formatDateForZoho()` + envoi ISO |
| `lib/domain/verification/compare.ts` | `tryParseDateToCanonical()` étendue |
| `components/import/wizard/step-transform-preview.tsx` | Passage `zohoDateFormat` au wrapper |

### Session 2 (24/01/2026)
| Fichier | Modification |
|---------|--------------|
| `lib/domain/data-transformer.ts` | Transformation dates/périodes avec normalisation Unicode |
| `lib/domain/schema-validator.ts` | Patterns date avec heure + périodes mois-année |
| `app/api/zoho/import/route.ts` | `dateFormat: 'yyyy-MM-dd HH:mm:ss'` |
| `lib/infrastructure/zoho/client.ts` | `dateFormat = 'yyyy-MM-dd HH:mm:ss'` |
| `components/import/wizard/step-transform-preview.tsx` | UI accordéon (Phase 2) |
| `lib/domain/excel/date-converter.ts` | **NOUVEAU** - Helpers conversion dates Excel |
| `lib/domain/excel/index.ts` | **NOUVEAU** - Export module |
| `types/profiles.ts` | Types `RawCellData`, `RawCellDataMap` |
| `lib/hooks/use-csv-parser.ts` | Extraction `rawCellData` avec v/z/w/t |

---

## 5. Décisions techniques

| Décision | Justification |
|----------|---------------|
| Envoyer toutes dates en ISO à Zoho | Zoho n'accepte qu'un seul `dateFormat` par import, il convertit automatiquement |
| Normaliser les accents avec `normalize('NFD')` | Gère les encodages corrompus des fichiers Excel |
| Transformer les périodes en premier du mois | `juin-25` devient une vraie date `2025-06-01` |
| Comparer dates en format canonique `YYYY-MM-DD` | Évite les faux positifs lors de la vérification post-import |
| Récupérer email Zoho via scope OAuth | L'API CloudSQL v1 nécessite l'email pour construire l'URL |
| Stocker zoho_email dans Supabase | Évite de re-demander à chaque appel API |

---

## 6. Ce qui reste à faire

### 6.1 PRIORITÉ HAUTE : Corriger l'encodage des caractères accentués

**Problème** : Certaines lignes du fichier Excel ont des caractères mal encodés qui se propagent dans Zoho.

**Solutions possibles** :
1. Ajouter une détection d'encodage avec `chardet` ou similaire
2. Forcer une re-normalisation UTF-8 des chaînes avant génération du CSV
3. Utiliser `TextDecoder` avec détection automatique
4. Ajouter une option utilisateur pour spécifier l'encodage source

### 6.2 OPTIONNEL : Afficher la prévisualisation d'affichage Zoho

Dans l'étape "Aperçu des transformations", on pourrait afficher :
- Ce qu'on envoie : `2023-06-11 23:35:00`
- Ce que Zoho affichera : `11 Jun, 2023 23:35:00`

---

## 7. Commandes de commit

```powershell
cd "C:\Users\thoma\OneDrive\SONEAR_2025\csv-zoho-importer"
git add -A
git commit -m "fix(oauth): récupération email Zoho + comparaison dates (Mission 017 Session 3)

Corrections :
- Ajout scope aaaserver.profile.READ pour récupérer email utilisateur
- Nouvelle fonction fetchZohoUserInfo() appelée lors du callback OAuth
- Stockage zoho_email et zoho_user_id dans Supabase
- API getLastRowId fonctionne maintenant (plus de 400)
- Comparaison post-import : normalisation dates en format canonique
- Import 21633 lignes avec 0 anomalie détectée

Fichiers modifiés :
- lib/infrastructure/zoho/auth.ts (fetchZohoUserInfo)
- lib/infrastructure/zoho/types.ts (scope aaaserver.profile.READ)
- lib/domain/verification/compare.ts (normalisation dates)

À faire : Corriger encodage caractères accentués (Phase 4)"

git push
```

---

## 8. Résumé de la Mission 017

| Phase | Statut | Description |
|-------|--------|-------------|
| Phase 1 | ✅ | Extraction métadonnées Excel, détection types, hints |
| Phase 2 | ✅ | UI accordéon transparence, transformation dates |
| Phase 3 | ✅ | Fix comparaison post-import (suppression faux positifs dates) |
| Phase 4 | 📋 | Corriger encodage caractères accentués |

---

## 9. Idée future : Backup/Restore par date et RowID

Thomas a suggéré une fonctionnalité pour gérer la limite de lignes Zoho (20.4M lignes) :

**Fonctionnalités proposées** :
1. **Archivage automatique** : Exporter données anciennes vers Zoho WorkDrive
2. **Restauration** : Réimporter depuis les archives
3. **Planification** : Archivage automatique mensuel/trimestriel

Cette idée sera développée dans une future mission.

---

*Mission 017 - Dernière mise à jour : 25/01/2026 22:30*
*Import fonctionnel - 21633 lignes importées avec 0 anomalie*
*Email Zoho récupéré et stocké - RowID Sync opérationnel*
