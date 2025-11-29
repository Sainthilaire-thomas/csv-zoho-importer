
# Mission 003 - Intégration API Zoho Analytics

**Statut** : 🔄 En cours
**Date début** : 2025-11-29
**Prérequis** : Mission 002 complétée

---

## 🎯 Objectif

Connecter le wizard d'import à l'API Zoho Analytics pour effectuer de vrais imports de données, avec une authentification OAuth2 complète gérée dans l'application (pas de refresh token manuel).

---

## 📋 Contexte

### Ce qui existe déjà (projet réel)

```
lib/infrastructure/zoho/     # Dossier vide - À CRÉER
```

**Fonctionnel :**

* Wizard d'import complet (5 étapes)
* Parsing CSV/Excel côté client (jusqu'à 200 MB)
* Validation côté client fonctionnelle
* Hook `useImport` pour gestion d'état
* 5 modes d'import configurés (append, updateadd, onlyadd, deleteupsert, truncateadd)
* API Route `/api/csv/import` (log métadonnées uniquement - SIMULÉ)
* API Route `/api/zoho/tables` (retourne données mockées depuis Supabase)

**Ce qui manque :**

* Client Zoho Analytics
* Authentification OAuth2 complète (flow dans l'app)
* Stockage sécurisé des tokens dans Supabase
* Appel réel à l'API Zoho pour importer les données
* UI de connexion Zoho

---

## 🔐 Architecture d'authentification OAuth2

### Approche choisie : OAuth flow complet dans l'app

Chaque utilisateur connecte son propre compte Zoho via l'interface de l'application. Les tokens sont stockés chiffrés dans Supabase.

### Flux d'authentification

```
┌─────────────────────────────────────────────────────────────────┐
│                    PREMIÈRE CONNEXION                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. User se connecte à l'app (Supabase Auth)                    │
│                          ↓                                       │
│  2. L'app détecte : pas de token Zoho pour ce user              │
│                          ↓                                       │
│  3. Page Import affiche "Connecter votre compte Zoho"           │
│                          ↓                                       │
│  4. Clic → Redirection vers Zoho login                          │
│     GET https://accounts.zoho.com/oauth/v2/auth                 │
│     ?client_id=XXX                                              │
│     &response_type=code                                         │
│     &scope=ZohoAnalytics.data.all,ZohoAnalytics.metadata.all    │
│     &redirect_uri=https://app.vercel.app/api/zoho/oauth/callback│
│     &access_type=offline                                        │
│     &prompt=consent                                             │
│                          ↓                                       │
│  5. User se connecte à Zoho + autorise l'app                    │
│                          ↓                                       │
│  6. Zoho redirige vers callback avec code                       │
│     GET /api/zoho/oauth/callback?code=XXX                       │
│                          ↓                                       │
│  7. L'app échange le code contre tokens                         │
│     POST https://accounts.zoho.com/oauth/v2/token               │
│     → access_token + refresh_token                              │
│                          ↓                                       │
│  8. Stockage chiffré dans Supabase (user_zoho_tokens)           │
│                          ↓                                       │
│  9. Redirect vers /import → User peut importer !                │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                    UTILISATIONS SUIVANTES                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. User accède à /import                                       │
│                          ↓                                       │
│  2. L'app récupère ses tokens depuis Supabase                   │
│                          ↓                                       │
│  3. Si access_token expiré → refresh automatique                │
│                          ↓                                       │
│  4. Appels API Zoho avec access_token valide                    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                    SI REFRESH TOKEN EXPIRÉ                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. Appel API échoue avec "invalid_grant"                       │
│                          ↓                                       │
│  2. L'app supprime les tokens invalides                         │
│                          ↓                                       │
│  3. Affiche : "Votre connexion Zoho a expiré"                   │
│                          ↓                                       │
│  4. Bouton "Se reconnecter à Zoho" → même flow                  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Avantages de cette approche

| Aspect                            | Bénéfice                                            |
| --------------------------------- | ----------------------------------------------------- |
| **Autonomie**               | Chaque user gère sa propre connexion Zoho            |
| **Pas de .env pour tokens** | Seuls CLIENT_ID et CLIENT_SECRET en .env              |
| **Multi-workspace**         | Chaque user accède à ses propres workspaces Zoho    |
| **Sécurité**              | Tokens chiffrés en base, liés à chaque utilisateur |
| **Maintenance**             | Zéro intervention manuelle pour les tokens           |
| **Expiration gérée**      | Reconnexion automatique demandée si nécessaire      |

---

## 📁 Fichiers à créer

### Infrastructure Zoho

| Fichier                                   | Description                         |
| ----------------------------------------- | ----------------------------------- |
| `lib/infrastructure/zoho/types.ts`      | Types TypeScript pour Zoho API      |
| `lib/infrastructure/zoho/auth.ts`       | Gestion OAuth2 (get/refresh tokens) |
| `lib/infrastructure/zoho/client.ts`     | Client API Zoho (tables, import)    |
| `lib/infrastructure/zoho/encryption.ts` | Chiffrement/déchiffrement tokens   |
| `lib/infrastructure/zoho/index.ts`      | Exports du module                   |

### Routes API OAuth

| Fichier                                    | Description                             |
| ------------------------------------------ | --------------------------------------- |
| `app/api/zoho/oauth/authorize/route.ts`  | Génère URL d'autorisation Zoho        |
| `app/api/zoho/oauth/callback/route.ts`   | Reçoit le code, échange contre tokens |
| `app/api/zoho/oauth/status/route.ts`     | Vérifie si user a un token valide      |
| `app/api/zoho/oauth/disconnect/route.ts` | Supprime les tokens (déconnexion)      |

### Routes API Zoho

| Fichier                              | Description                                |
| ------------------------------------ | ------------------------------------------ |
| `app/api/zoho/workspaces/route.ts` | Liste les workspaces du user               |
| `app/api/zoho/tables/route.ts`     | Liste les tables d'un workspace (MODIFIER) |
| `app/api/zoho/import/route.ts`     | Import des données vers Zoho              |

### Composants UI

| Fichier                                        | Description                |
| ---------------------------------------------- | -------------------------- |
| `components/zoho/zoho-connect-button.tsx`    | Bouton "Connecter à Zoho" |
| `components/zoho/zoho-connection-status.tsx` | État de connexion Zoho    |

### SQL Supabase

| Fichier                               | Description                             |
| ------------------------------------- | --------------------------------------- |
| `docs/sql/002-user-zoho-tokens.sql` | Table pour stocker les tokens chiffrés |

---

## 🗄️ Schema SQL

### Table user_zoho_tokens

```sql
-- Table pour stocker les tokens Zoho chiffrés par utilisateur
CREATE TABLE csv_importer.user_zoho_tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Tokens chiffrés (AES-256-GCM)
  access_token_encrypted TEXT NOT NULL,
  refresh_token_encrypted TEXT NOT NULL,
  
  -- Métadonnées (non chiffrées)
  token_type TEXT DEFAULT 'Zoho-oauthtoken',
  expires_at TIMESTAMPTZ NOT NULL,  -- Expiration access_token
  scope TEXT,                        -- Scopes accordés
  api_domain TEXT DEFAULT 'https://accounts.zoho.com',
  
  -- Infos Zoho user (pour affichage)
  zoho_user_id TEXT,
  zoho_email TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Un seul token par user
  UNIQUE(user_id)
);

-- Index
CREATE INDEX idx_user_zoho_tokens_user_id ON csv_importer.user_zoho_tokens(user_id);
CREATE INDEX idx_user_zoho_tokens_expires_at ON csv_importer.user_zoho_tokens(expires_at);

-- RLS
ALTER TABLE csv_importer.user_zoho_tokens ENABLE ROW LEVEL SECURITY;

-- Policy : Users ne peuvent voir/modifier que leurs propres tokens
CREATE POLICY "Users can manage their own Zoho tokens"
  ON csv_importer.user_zoho_tokens
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Trigger pour updated_at
CREATE TRIGGER update_user_zoho_tokens_updated_at
  BEFORE UPDATE ON csv_importer.user_zoho_tokens
  FOR EACH ROW
  EXECUTE FUNCTION csv_importer.update_updated_at_column();
```

---

## 🔧 Variables d'environnement

```bash
# .env.local

# Supabase (existant)
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...

# Zoho OAuth2 App (une seule app pour tous les users)
ZOHO_CLIENT_ID=1000.XXXXXXXXXXXX
ZOHO_CLIENT_SECRET=XXXXXXXXXXXX

# Zoho API Domain
ZOHO_API_DOMAIN=analyticsapi.zoho.com          # US
# ZOHO_API_DOMAIN=analyticsapi.zoho.eu         # EU
# ZOHO_API_DOMAIN=analyticsapi.zoho.in         # IN

ZOHO_ACCOUNTS_DOMAIN=accounts.zoho.com         # US
# ZOHO_ACCOUNTS_DOMAIN=accounts.zoho.eu        # EU

# Chiffrement des tokens
ENCRYPTION_KEY=your-32-bytes-secret-key-here   # 32 caractères minimum

# App URL (pour redirect OAuth)
NEXT_PUBLIC_APP_URL=http://localhost:3000      # Dev
# NEXT_PUBLIC_APP_URL=https://app.vercel.app   # Prod
```

---

## 📊 API Zoho Analytics

### Endpoints utilisés

| Endpoint                                        | Méthode | Description           |
| ----------------------------------------------- | -------- | --------------------- |
| `/oauth/v2/auth`                              | GET      | Page d'autorisation   |
| `/oauth/v2/token`                             | POST     | Échange code/refresh |
| `/restapi/v2/workspaces`                      | GET      | Liste workspaces      |
| `/restapi/v2/workspaces/{id}/views`           | GET      | Liste tables          |
| `/restapi/v2/workspaces/{id}/views/{id}/data` | POST     | Import data           |

### Scopes requis

```
ZohoAnalytics.metadata.all   # Lire workspaces, tables, colonnes
ZohoAnalytics.data.all       # Lire/écrire données (import)
```

### Mapping modes d'import

| Mode app         | Zoho IMPORT_TYPE         | Description                                       |
| ---------------- | ------------------------ | ------------------------------------------------- |
| `append`       | APPEND                   | Ajoute à la fin                                  |
| `truncateadd`  | TRUNCATEADD              | Vide la table puis ajoute                         |
| `updateadd`    | UPDATEADD                | Met à jour ou ajoute (nécessite colonnes clés) |
| `deleteupsert` | DELETEUPSERT             | Sync complète (supprime absents)                 |
| `onlyadd`      | APPEND + SKIP duplicates | Ajoute uniquement les nouveaux                    |

---

## ✅ Critères de succès

### Authentification

* [ ] Bouton "Connecter à Zoho" fonctionnel
* [ ] Flow OAuth complet (authorize → callback → stockage)
* [ ] Refresh automatique du access_token
* [ ] Gestion expiration refresh_token (redemander connexion)
* [ ] Déconnexion Zoho possible

### API Zoho

* [ ] Liste des workspaces du user
* [ ] Liste des tables d'un workspace
* [ ] Import réel de données vers Zoho
* [ ] Gestion des 5 modes d'import
* [ ] Import par lots pour gros fichiers (>5000 lignes)

### Sécurité

* [ ] Tokens chiffrés en base (AES-256)
* [ ] Zero data retention (CSV en mémoire uniquement)
* [ ] RLS sur table tokens
* [ ] Pas de tokens dans les logs

### UX

* [ ] État de connexion Zoho visible
* [ ] Progression affichée pendant import
* [ ] Messages d'erreur clairs

---

## 📝 Actions planifiées

### Phase 1 : Infrastructure OAuth (Session 1)

1. [ ] Créer `docs/sql/002-user-zoho-tokens.sql`
2. [ ] Créer `lib/infrastructure/zoho/types.ts`
3. [ ] Créer `lib/infrastructure/zoho/encryption.ts`
4. [ ] Créer `lib/infrastructure/zoho/auth.ts`
5. [ ] Créer routes OAuth (`authorize`, `callback`, `status`, `disconnect`)

### Phase 2 : Client Zoho API (Session 2)

1. [ ] Créer `lib/infrastructure/zoho/client.ts`
2. [ ] Créer/modifier `app/api/zoho/workspaces/route.ts`
3. [ ] Modifier `app/api/zoho/tables/route.ts` (vrais appels Zoho)
4. [ ] Créer `app/api/zoho/import/route.ts`

### Phase 3 : Intégration UI (Session 3)

1. [ ] Créer `components/zoho/zoho-connect-button.tsx`
2. [ ] Créer `components/zoho/zoho-connection-status.tsx`
3. [ ] Modifier wizard pour vérifier connexion Zoho
4. [ ] Modifier step-config pour charger vraies tables
5. [ ] Modifier import-wizard pour appeler vraie API

### Phase 4 : Tests et polish (Session 4)

1. [ ] Tests end-to-end
2. [ ] Gestion erreurs Zoho (quota, format, etc.)
3. [ ] Ajout sélection colonnes clés (modes update)
4. [ ] Documentation utilisateur

---

## ⚠️ Points d'attention

### 1. Région Zoho

L'utilisateur doit utiliser la même région que son compte Zoho :

* US : `accounts.zoho.com` / `analyticsapi.zoho.com`
* EU : `accounts.zoho.eu` / `analyticsapi.zoho.eu`
* IN : `accounts.zoho.in` / `analyticsapi.zoho.in`

→ Prévoir détection ou configuration par user

### 2. Limites API Zoho

| Limite                  | Valeur               |
| ----------------------- | -------------------- |
| Taille fichier/requête | 50 MB                |
| Lignes/requête         | 100 000              |
| Requêtes/jour          | 5 000 (plan gratuit) |

### 3. Chiffrement des tokens

Utiliser AES-256-GCM avec une clé stockée dans les variables d'environnement. Ne jamais logger les tokens déchiffrés.

---

## 🔗 Prérequis avant de commencer

### 1. Créer l'application Zoho (une fois)

1. Aller sur https://api-console.zoho.com (ou .eu)
2. Créer une **Web Application** (pas Self Client)
3. Configurer :
   * **Client Name** : CSV Zoho Importer
   * **Homepage URL** : https://ton-app.vercel.app
   * **Redirect URI** : https://ton-app.vercel.app/api/zoho/oauth/callback
   * Pour dev : ajouter aussi `http://localhost:3000/api/zoho/oauth/callback`
4. Noter CLIENT_ID et CLIENT_SECRET

### 2. Générer ENCRYPTION_KEY

```bash
# Générer une clé de 32 caractères
openssl rand -base64 32
```

### 3. Exécuter le SQL dans Supabase

Après création du fichier SQL, l'exécuter dans Supabase SQL Editor.

---

*Mission créée le : 2025-11-28*
*Mise à jour : 2025-11-29*
*Statut : 🔄 En cours - Phase 1*
