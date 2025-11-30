
# Mission 003 - Intégration API Zoho Analytics

**Statut** : 🔄 En cours
**Date début** : 2025-11-29
**Sessions** : 3
**Prérequis** : Mission 002 complétée

---

## 🎯 Objectif

Connecter le wizard d'import à l'API Zoho Analytics pour effectuer de vrais imports de données, avec une authentification OAuth2 complète gérée dans l'application.

---

## 📋 Bilan des sessions

### Session 1 (2025-11-29 matin)

**Travail accompli :**

* ✅ Infrastructure OAuth2 complète créée
* ✅ Table `user_zoho_tokens` créée dans Supabase
* ✅ Chiffrement AES-256-GCM des tokens
* ✅ Routes OAuth : authorize, callback, status, disconnect
* ✅ Composants UI : ZohoConnectButton, ZohoConnectionStatus
* ✅ Application Zoho créée sur api-console.zoho.com

**Problèmes résolus :**

* Permissions Supabase (GRANT sur schéma csv_importer)
* Erreurs TypeScript (viewId/viewName au lieu de tableId/tableName)

### Session 2 (2025-11-29 après-midi)

**Travail accompli :**

* ✅ Correction domaine API (zohoapis.com → analyticsapi.zoho.com)
* ✅ Fonction `convertToAnalyticsDomain()` dans auth.ts
* ✅ Correction erreur "Invalid URL undefined" (variables env serveur)
* ✅ Ajout variable `APP_URL` pour routes API côté serveur
* ✅ Correction dépendance `uuid` → `crypto.randomUUID()`
* ✅ Correction cookies OAuth (2 cookies séparés state/region)
* ✅ OAuth flow complet fonctionnel !
* ✅ Liste des workspaces chargée correctement
* ⏳ Route `/api/zoho/tables` retourne erreur 400

### Session 3 (2025-11-29 après-midi - suite)

**Travail accompli :**

* ✅ Correction bug casse viewType ('Table'/'QueryTable' vs 'TABLE'/'QUERY_TABLE')
* ✅ API `/api/zoho/tables` fonctionnelle - 48 tables retournées
* ✅ API `/api/zoho/folders` créée - 13 dossiers chargés
* ✅ Composant `TableSelectorAccordion` créé avec hiérarchie de dossiers
* ✅ Intégration de l'accordéon dans `step-config.tsx`
* ✅ Recherche en temps réel sur les tables
* ✅ Dossier par défaut auto-développé (INDICATEURS GENERAUX)
* ✅ Icônes différenciées : Table (bleu), QueryTable (violet), Dossier (jaune)

**Problèmes résolus :**

* Bug casse viewType : Zoho renvoie 'Table'/'QueryTable', code filtrait sur 'TABLE'/'QUERY_TABLE'
* Bug `body stream already read` : Double appel à `.json()` sur Response dans useEffect
* Architecture accordéon : Option A choisie (composant autonome qui charge ses propres données)

---

## 🏗️ Architecture du sélecteur de tables

### Composant TableSelectorAccordion

```
TableSelectorAccordion (autonome)
├── Charge /api/zoho/folders (13 dossiers)
├── Charge /api/zoho/tables (48 tables filtrées)
├── Construit hiérarchie avec folderTree (useMemo)
├── Barre de recherche avec filtre temps réel
└── Affichage :
    ├── Mode recherche → Liste plate filtrée
    ├── Mode sans dossiers → Liste plate simple
    └── Mode avec dossiers → Arbre accordéon
```

### Structure hiérarchique RATP PV

```
Workspace: RATP PV (ID: 1718953000014173074)
├── BACKUP DONNEES (10 tables)
├── Date du passage en AFM Analyse (0 tables)
├── INDICATEURS GENERAUX (3 tables) ← Dossier par défaut, auto-développé
├── INDICATEURS SPECIFIQUES (0 tables)
├── QUITTANCES (0 tables)
│   ├── DONNEES QUITTANCES (sous-dossier)
│   └── RAPPORT QUITTANCES (sous-dossier)
├── RECLAMATIONS (1 table)
├── RELANCES (10 tables)
└── ... (13 dossiers au total)
```

---

## 📁 Fichiers créés/modifiés

### Session 3 - Nouveaux fichiers

| Fichier                                            | Status | Description                           |
| -------------------------------------------------- | ------ | ------------------------------------- |
| `app/api/zoho/folders/route.ts`                  | ✅     | API liste des dossiers d'un workspace |
| `components/import/table-selector-accordion.tsx` | ✅     | Composant accordéon hiérarchique    |
| `types/index.ts`                                 | ✅     | Type `ZohoFolder`ajouté            |

### Session 3 - Fichiers modifiés

| Fichier                                        | Modification                                               |
| ---------------------------------------------- | ---------------------------------------------------------- |
| `app/api/zoho/tables/route.ts`               | Correction casse viewType ('Table'/'QueryTable')           |
| `components/import/wizard/step-config.tsx`   | Remplacement select par TableSelectorAccordion             |
| `components/import/wizard/import-wizard.tsx` | Suppression chargement tables (délégué à l'accordéon) |

### Infrastructure Zoho (lib/infrastructure/zoho/)

| Fichier           | Status | Description                                   |
| ----------------- | ------ | --------------------------------------------- |
| `types.ts`      | ✅     | Types TypeScript pour Zoho API                |
| `encryption.ts` | ✅     | Chiffrement AES-256-GCM des tokens            |
| `auth.ts`       | ✅     | Gestion OAuth2 + convertToAnalyticsDomain     |
| `client.ts`     | ✅     | Client API Zoho (workspaces, tables, folders) |
| `index.ts`      | ✅     | Exports du module                             |

### Routes API Zoho (app/api/zoho/)

| Fichier                       | Status | Description                               |
| ----------------------------- | ------ | ----------------------------------------- |
| `oauth/authorize/route.ts`  | ✅     | Génère URL d'autorisation               |
| `oauth/callback/route.ts`   | ✅     | Échange code contre tokens               |
| `oauth/status/route.ts`     | ✅     | Vérifie connexion Zoho                   |
| `oauth/disconnect/route.ts` | ✅     | Supprime tokens                           |
| `workspaces/route.ts`       | ✅     | Liste workspaces                          |
| `tables/route.ts`           | ✅     | Liste tables (filtrées Table/QueryTable) |
| `folders/route.ts`          | ✅     | Liste dossiers                            |
| `import/route.ts`           | ⏳     | Import données - À TESTER               |

---

## ✅ État des critères de succès

### Authentification

* [X] Bouton "Connecter à Zoho" fonctionnel
* [X] Flow OAuth complet (authorize → callback → stockage)
* [X] Refresh automatique du access_token
* [ ] Gestion expiration refresh_token (à tester)
* [X] Déconnexion Zoho possible

### API Zoho

* [X] Liste des workspaces du user ✅
* [X] Liste des tables d'un workspace ✅ (48 tables)
* [X] Liste des dossiers d'un workspace ✅ (13 dossiers)
* [ ] Import réel de données vers Zoho ⏳ **PROCHAINE ÉTAPE**
* [ ] Gestion des 5 modes d'import
* [ ] Import par lots pour gros fichiers

### UX

* [X] État de connexion Zoho visible (point vert)
* [X] Sélecteur de tables avec hiérarchie de dossiers
* [X] Recherche de tables en temps réel
* [X] Dossier par défaut auto-développé
* [X] Icônes différenciées par type (Table/QueryTable/Dossier)
* [ ] Progression affichée pendant import

### Sécurité

* [X] Tokens chiffrés en base (AES-256-GCM)
* [X] Zero data retention (CSV en mémoire uniquement)
* [X] RLS sur table tokens
* [X] Pas de tokens dans les logs

---

## 🎯 Prochaine étape : Import réel vers Zoho

### Objectif

Tester et finaliser la route `/api/zoho/import` pour effectuer un vrai import de données CSV dans une table Zoho Analytics.

### Actions à faire

1. **Vérifier** le contenu de `app/api/zoho/import/route.ts`
2. **Tester** avec un petit fichier CSV (10-20 lignes)
3. **Valider** les 5 modes d'import :
   * APPEND (ajouter à la fin)
   * TRUNCATEADD (supprimer et ajouter)
   * UPDATEADD (mettre à jour ou ajouter)
   * DELETEUPSERT (synchroniser)
   * ONLYADD (ajouter uniquement nouveaux)
4. **Tester** avec un gros fichier (57 790 lignes - QUITTANCES 03 2025.xlsx)
5. **Gérer** les erreurs Zoho API

### Endpoint Zoho à utiliser

```
POST https://analyticsapi.zoho.com/restapi/v2/workspaces/{workspaceId}/{viewId}/data
Headers:
  Authorization: Zoho-oauthtoken {access_token}
  Content-Type: multipart/form-data
Body:
  ZOHO_IMPORT_TYPE: APPEND|TRUNCATEADD|UPDATEADD|DELETEUPSERT|ONLYADD
  ZOHO_IMPORT_FILETYPE: csv
  ZOHO_AUTO_IDENTIFY: true
  ZOHO_FILE: <fichier CSV>
```

---

## 📊 Métriques Session 3

| Métrique                | Valeur |
| ------------------------ | ------ |
| Fichiers créés         | 3      |
| Fichiers modifiés       | 4      |
| Lignes de code ajoutées | ~400   |
| Bugs corrigés           | 2      |
| Durée de session        | ~2h    |

---

## 🔧 Variables d'environnement requises

```bash
# .env.local

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...

# Zoho OAuth2 App
ZOHO_CLIENT_ID=1000.XTCYES...
ZOHO_CLIENT_SECRET=xxx...

# Zoho API Domains (US)
ZOHO_API_DOMAIN=https://analyticsapi.zoho.com
ZOHO_ACCOUNTS_DOMAIN=https://accounts.zoho.com

# Chiffrement des tokens
ENCRYPTION_KEY=your-32-bytes-secret-key-here

# URLs Application (les deux sont nécessaires)
NEXT_PUBLIC_APP_URL=http://localhost:3000
APP_URL=http://localhost:3000
```

---

## 📸 État actuel de l'UI

### Wizard étape 2 - Configuration

1. **Fichier sélectionné** : QUITTANCES 03 2025.xlsx (6.7 MB)
2. **Workspace** : RATP PV sélectionné
3. **Sélecteur de tables** : Accordéon fonctionnel
   * 13 dossiers avec hiérarchie
   * 48 tables disponibles
   * Recherche en temps réel
   * Dossier INDICATEURS GENERAUX développé par défaut
4. **Mode d'import** : Ajouter (APPEND) sélectionné

---

*Mission créée le : 2025-11-28*
*Dernière mise à jour : 2025-11-29 13:15*
*Statut : 🔄 En cours - Prochaine étape : Test import réel*
