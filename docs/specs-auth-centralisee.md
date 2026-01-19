
# Spécifications : Application d'Authentification Centralisée

## Contexte

Plusieurs applications expérimentales partagent un même projet Supabase (000-CADO). La configuration actuelle pose des problèmes car le Site URL de Supabase ne peut pointer que vers une seule application, ce qui casse les flows de reset password et d'inscription pour les autres apps.

### Applications concernées

* **CSV Zoho Importer** : https://csv-zoho-importer.vercel.app
* **SoNear Transcription** : https://transcriptionnov25.netlify.app
* *(Autres apps à venir)*

## Objectif

Créer une application d'authentification centralisée qui :

1. Gère tous les flows d'auth (login, register, reset password)
2. Redirige les utilisateurs vers la bonne application après authentification
3. Contrôle les accès par application

---

## Architecture

### URL de l'app

```
https://auth-sonear.vercel.app (ou sous-domaine personnalisé)
```

### Routes principales

```
/login?app={app_slug}&redirect={url}      → Connexion
/register?app={app_slug}&redirect={url}   → Inscription
/reset-password                            → Réinitialisation (depuis email Supabase)
/select-app                                → Sélecteur d'apps (si pas de contexte)
/logout?redirect={url}                     → Déconnexion
```

### Configuration Supabase

* **Site URL** : `https://auth-sonear.vercel.app`
* **Redirect URLs** :
  * `https://auth-sonear.vercel.app`
  * `http://localhost:3000` (dev)

---

## Modèle de données

### Table `apps`

Référentiel des applications enregistrées.

```sql
CREATE TABLE apps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  url VARCHAR(255) NOT NULL,
  logo_url VARCHAR(255),
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index
CREATE INDEX idx_apps_slug ON apps(slug);

-- Données initiales
INSERT INTO apps (slug, name, url) VALUES
  ('csv-importer', 'CSV Zoho Importer', 'https://csv-zoho-importer.vercel.app'),
  ('sonear', 'SoNear Transcription', 'https://transcriptionnov25.netlify.app');
```

### Table `user_app_access`

Permissions des utilisateurs par application.

```sql
CREATE TABLE user_app_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  app_slug VARCHAR(50) NOT NULL REFERENCES apps(slug) ON DELETE CASCADE,
  role VARCHAR(20) DEFAULT 'user',
  granted_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(user_id, app_slug)
);

-- Index
CREATE INDEX idx_user_app_access_user ON user_app_access(user_id);
CREATE INDEX idx_user_app_access_app ON user_app_access(app_slug);
```

### Rôles disponibles

| Role      | Description                                              |
| --------- | -------------------------------------------------------- |
| `user`  | Accès standard à l'application                         |
| `admin` | Accès admin + peut gérer les utilisateurs de cette app |

### RLS Policies

```sql
-- Lecture : l'utilisateur voit ses propres accès
CREATE POLICY "Users can view own access"
  ON user_app_access FOR SELECT
  USING (auth.uid() = user_id);

-- Insertion : via fonction sécurisée uniquement (inscription)
-- ou admin de l'app

-- Suppression : admin de l'app uniquement
```

---

## Flows utilisateur

### Flow 1 : Connexion depuis une app

```
┌─────────────────┐     ┌─────────────────────┐     ┌─────────────────┐
│  CSV Importer   │     │   Auth Centralisée  │     │  CSV Importer   │
│                 │     │                     │     │                 │
│ Clic "Connexion"├────►│ /login?app=csv-     │     │                 │
│                 │     │ importer&redirect=  │     │                 │
│                 │     │ https://csv-...     │     │                 │
│                 │     │                     │     │                 │
│                 │     │ ✓ Vérif credentials │     │                 │
│                 │     │ ✓ Vérif accès app   │     │                 │
│                 │     │ ✓ Set session       ├────►│ Session active  │
└─────────────────┘     └─────────────────────┘     └─────────────────┘
```

### Flow 2 : Inscription depuis une app

```
┌─────────────────┐     ┌─────────────────────┐     ┌─────────────────┐
│  CSV Importer   │     │   Auth Centralisée  │     │  CSV Importer   │
│                 │     │                     │     │                 │
│ Clic "S'inscrire├────►│ /register?app=csv-  │     │                 │
│                 │     │ importer            │     │                 │
│                 │     │                     │     │                 │
│                 │     │ ✓ Crée user Supabase│     │                 │
│                 │     │ ✓ Ajoute accès app  │     │                 │
│                 │     │ ✓ Email confirmation│     │                 │
│                 │     │                     │     │                 │
│                 │     │ (après confirm)     ├────►│ Accès autorisé  │
└─────────────────┘     └─────────────────────┘     └─────────────────┘
```

### Flow 3 : Reset password

```
┌─────────────────┐     ┌─────────────────────┐     ┌─────────────────┐
│  N'importe où   │     │   Auth Centralisée  │     │  Sélection app  │
│                 │     │                     │     │                 │
│ Clic lien email ├────►│ /reset-password     │     │                 │
│ (Supabase)      │     │ #access_token=xxx   │     │                 │
│                 │     │                     │     │                 │
│                 │     │ ✓ Nouveau password  │     │                 │
│                 │     │ ✓ Liste apps user   ├────►│ Choix de l'app  │
│                 │     │                     │     │ ou redirect auto│
└─────────────────┘     └─────────────────────┘     └─────────────────┘
```

### Flow 4 : Accès refusé

Si l'utilisateur tente d'accéder à une app sans permission :

```
┌─────────────────┐     ┌─────────────────────┐
│  App X          │     │   Auth Centralisée  │
│                 │     │                     │
│ Connexion OK    ├────►│ ✓ User authentifié  │
│ mais pas accès  │     │ ✗ Pas dans          │
│                 │     │   user_app_access   │
│                 │     │                     │
│                 │◄────│ "Accès non autorisé │
│                 │     │  Contactez l'admin" │
└─────────────────┘     └─────────────────────┘
```

---

## Pages de l'application

### 1. Page Login (`/login`)

**Paramètres URL :**

* `app` : slug de l'application (optionnel)
* `redirect` : URL de redirection après login (optionnel)

**Comportement :**

1. Affiche le formulaire de connexion
2. Si `app` fourni, affiche le logo/nom de l'app
3. Après login réussi :
   * Si `app` fourni → vérifie accès → redirige vers `redirect` ou app.url
   * Si pas d'`app` → redirige vers `/select-app`

**UI :**

```
┌────────────────────────────────────┐
│         [Logo App]                 │
│     Connexion à CSV Importer       │
│                                    │
│  ┌──────────────────────────────┐  │
│  │ Email                        │  │
│  └──────────────────────────────┘  │
│  ┌──────────────────────────────┐  │
│  │ Mot de passe            [👁] │  │
│  └──────────────────────────────┘  │
│                                    │
│  [ Mot de passe oublié ? ]         │
│                                    │
│  ┌──────────────────────────────┐  │
│  │        Se connecter          │  │
│  └──────────────────────────────┘  │
│                                    │
│  ─────── ou ───────                │
│                                    │
│  Pas encore de compte ?            │
│  [ Créer un compte ]               │
└────────────────────────────────────┘
```

### 2. Page Register (`/register`)

**Paramètres URL :**

* `app` : slug de l'application (requis pour auto-grant accès)
* `redirect` : URL de redirection après confirmation

**Comportement :**

1. Crée le compte Supabase
2. Si `app` fourni → crée entrée `user_app_access` automatiquement
3. Envoie email de confirmation
4. Après confirmation → redirige vers l'app

### 3. Page Reset Password (`/reset-password`)

**Comportement :**

1. Récupère le token depuis l'URL (hash fragment)
2. Affiche formulaire nouveau mot de passe
3. Après succès :
   * Récupère les apps de l'utilisateur
   * Si 1 seule app → redirige automatiquement
   * Si plusieurs → affiche sélecteur

### 4. Page Select App (`/select-app`)

**Comportement :**

1. Récupère les apps accessibles pour l'utilisateur connecté
2. Affiche une carte par application
3. Clic → redirige vers l'app

**UI :**

```
┌────────────────────────────────────────────────┐
│           Choisissez votre application         │
│                                                │
│  ┌──────────────┐    ┌──────────────┐          │
│  │  [Logo]      │    │  [Logo]      │          │
│  │  CSV Zoho    │    │  SoNear      │          │
│  │  Importer    │    │  Transcript  │          │
│  │              │    │              │          │
│  │  [Ouvrir →]  │    │  [Ouvrir →]  │          │
│  └──────────────┘    └──────────────┘          │
│                                                │
└────────────────────────────────────────────────┘
```

---

## Intégration côté apps clientes

### Modifications requises sur chaque app

#### 1. Supprimer les pages d'auth locales

Les pages `/login`, `/register`, `/reset-password` sont supprimées de chaque app.

#### 2. Rediriger vers l'auth centralisée

```typescript
// lib/auth.ts
const AUTH_APP_URL = 'https://auth-sonear.vercel.app';
const APP_SLUG = 'csv-importer';

export const getLoginUrl = () => {
  const redirect = encodeURIComponent(window.location.origin);
  return `${AUTH_APP_URL}/login?app=${APP_SLUG}&redirect=${redirect}`;
};

export const getRegisterUrl = () => {
  const redirect = encodeURIComponent(window.location.origin);
  return `${AUTH_APP_URL}/register?app=${APP_SLUG}&redirect=${redirect}`;
};

export const getLogoutUrl = () => {
  return `${AUTH_APP_URL}/logout?redirect=${encodeURIComponent(window.location.origin)}`;
};
```

#### 3. Modifier le middleware

```typescript
// middleware.ts
export async function middleware(request: NextRequest) {
  const supabase = createServerClient(...);
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    // Rediriger vers auth centralisée
    return NextResponse.redirect(getLoginUrl());
  }

  // Optionnel : vérifier l'accès à l'app
  const { data: access } = await supabase
    .from('user_app_access')
    .select('role')
    .eq('user_id', session.user.id)
    .eq('app_slug', APP_SLUG)
    .single();

  if (!access) {
    return NextResponse.redirect(`${AUTH_APP_URL}/unauthorized?app=${APP_SLUG}`);
  }

  return NextResponse.next();
}
```

---

## Stack technique

* **Framework** : Next.js 15 (App Router)
* **Auth** : Supabase Auth
* **Database** : Supabase PostgreSQL
* **Styling** : Tailwind CSS v4
* **Déploiement** : Vercel
* **Domaine** : auth-sonear.vercel.app (ou custom)

---

## Tâches de développement

### Phase 1 : Setup & Base (2h)

* [ ] Créer le projet Next.js
* [ ] Configurer Supabase (même projet que les apps)
* [ ] Créer les tables `apps` et `user_app_access`
* [ ] Configurer les RLS policies
* [ ] Déployer sur Vercel

### Phase 2 : Pages d'auth (3h)

* [ ] Page `/login` avec gestion des paramètres
* [ ] Page `/register` avec auto-grant accès
* [ ] Page `/reset-password`
* [ ] Page `/select-app`
* [ ] Page `/unauthorized`

### Phase 3 : Intégration apps (2h)

* [ ] Modifier CSV Zoho Importer
* [ ] Modifier SoNear Transcription
* [ ] Tester les flows complets

### Phase 4 : Admin (optionnel, 2h)

* [ ] Interface admin pour gérer les accès
* [ ] Ajouter/retirer des utilisateurs par app
* [ ] Dashboard des utilisateurs

---

## Configuration finale Supabase

Après déploiement de l'app auth :

1. **Site URL** : `https://auth-sonear.vercel.app`
2. **Redirect URLs** :
   * `https://auth-sonear.vercel.app`
   * `https://csv-zoho-importer.vercel.app`
   * `https://transcriptionnov25.netlify.app`
   * `http://localhost:3000`
   * `http://localhost:5173`

---

## Séparation des responsabilités

### Principe fondamental

**L'app Auth centralisée ne gère QUE l'authentification et les accès aux apps.**
Elle ne touche pas aux mécanismes métier internes de chaque application.

### Schéma d'architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                           SUPABASE                                  │
│                                                                     │
│  ┌─────────────┐      trigger existant    ┌──────────────────────┐ │
│  │ auth.users  │ ────────────────────────►│ csv_importer.users   │ │
│  │             │      (NE PAS TOUCHER)    │ (table métier app)   │ │
│  │             │                          └──────────────────────┘ │
│  │             │                                                    │
│  │             │      trigger existant    ┌──────────────────────┐ │
│  │             │ ────────────────────────►│ sonear.profiles      │ │
│  │             │      (NE PAS TOUCHER)    │ (table métier app)   │ │
│  └─────────────┘                          └──────────────────────┘ │
│        │                                                            │
│        │ INSERT à l'inscription                                     │
│        │ (géré par Auth centralisée)                                │
│        ▼                                                            │
│  ┌─────────────────────────────────────┐                           │
│  │         user_app_access             │                           │
│  │   (schéma public ou auth_central)   │                           │
│  │                                     │                           │
│  │   - user_id (FK auth.users)         │                           │
│  │   - app_slug (FK apps)              │                           │
│  │   - role ('user', 'admin')          │                           │
│  │                                     │                           │
│  │   Gérée UNIQUEMENT par Auth App     │                           │
│  │   Lue par les apps pour autoriser   │                           │
│  └─────────────────────────────────────┘                           │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Ce qui NE CHANGE PAS dans les apps existantes

| Élément                                     | Status       |
| --------------------------------------------- | ------------ |
| Triggers `auth.users`→`app_schema.users` | ✅ Inchangé |
| Tables métier de chaque app                  | ✅ Inchangé |
| Logique interne des apps                      | ✅ Inchangé |
| RLS policies existantes                       | ✅ Inchangé |
| Schémas spécifiques (csv_importer, etc.)    | ✅ Inchangé |

### Ce qui est AJOUTÉ

| Élément                 | Description                             |
| ------------------------- | --------------------------------------- |
| Table `apps`            | Référentiel des applications          |
| Table `user_app_access` | Permissions d'accès par app            |
| App Auth centralisée     | Gère login/register/reset + accès     |
| Vérification middleware  | Chaque app vérifie `user_app_access` |

### Flux détaillé : Inscription

```
1. Utilisateur s'inscrit via Auth centralisée (?app=csv-importer)
   │
   │  ┌─────────────────────────────────────────────────────────┐
   │  │ AUTH CENTRALISÉE (ce qu'on développe)                   │
   │  └─────────────────────────────────────────────────────────┘
   │
   ├──► supabase.auth.signUp()
   │         │
   │         ▼
   │    ┌─────────────┐
   │    │ auth.users  │  ← Supabase crée l'utilisateur
   │    └─────────────┘
   │              │
   │              │  [TRIGGER EXISTANT - ON N'Y TOUCHE PAS]
   │              ▼
   │    ┌──────────────────────┐
   │    │ csv_importer.users   │  ← Créé automatiquement par trigger
   │    └──────────────────────┘
   │
   └──► INSERT INTO user_app_access (user_id, app_slug, role)
              VALUES (new_user.id, 'csv-importer', 'user')
        │
        ▼
   ┌─────────────────┐
   │ user_app_access │  ← Auth centralisée ajoute l'accès
   └─────────────────┘
```

### Flux détaillé : Connexion à une app

```
1. Utilisateur connecté tente d'accéder à CSV Importer
   │
   │  ┌─────────────────────────────────────────────────────────┐
   │  │ CSV IMPORTER - middleware.ts                            │
   │  └─────────────────────────────────────────────────────────┘
   │
   ├──► Vérif 1 : Session Supabase valide ?
   │    const { data: { session } } = await supabase.auth.getSession()
   │    │
   │    ├─ NON → Redirect vers Auth centralisée /login?app=csv-importer
   │    │
   │    └─ OUI ↓
   │
   └──► Vérif 2 : Accès à l'app autorisé ?
        SELECT * FROM user_app_access 
        WHERE user_id = session.user.id 
        AND app_slug = 'csv-importer'
        │
        ├─ NON → Redirect vers Auth centralisée /unauthorized
        │
        └─ OUI → Accès autorisé, continue vers l'app
```

---

## Gestion des permissions (Interface Admin)

### Option retenue : Hybride

**L'app Auth centralisée** gère :

* La vue globale de tous les utilisateurs
* Les super-admins
* L'ajout/suppression d'accès à n'importe quelle app

**Chaque app (optionnel)** peut gérer :

* Ses propres utilisateurs (ceux qui ont accès à cette app)
* Les rôles spécifiques à l'app

### Interface Admin dans Auth centralisée

#### Page `/admin/users`

```
┌─────────────────────────────────────────────────────────────────┐
│  Gestion des utilisateurs                        [+ Inviter]   │
│                                                                 │
│  🔍 Rechercher...                    Filtrer par app: [Toutes ▼]│
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ Email              │ Apps                    │ Actions      ││
│  ├─────────────────────────────────────────────────────────────┤│
│  │ thomas@sonear.com  │ 🏷 csv-importer (admin) │ [Modifier]   ││
│  │                    │ 🏷 sonear (user)        │              ││
│  ├─────────────────────────────────────────────────────────────┤│
│  │ test@gmail.com     │ 🏷 csv-importer (user)  │ [Modifier]   ││
│  ├─────────────────────────────────────────────────────────────┤│
│  │ fabienne@afpa.fr   │ 🏷 sonear (user)        │ [Modifier]   ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

#### Page `/admin/users/{id}`

```
┌─────────────────────────────────────────────────────────────────┐
│  ← Retour                                                       │
│                                                                 │
│  Utilisateur : thomas@sonear.com                                │
│  Créé le : 03 Apr 2024                                          │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  Accès aux applications :                                       │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ ☑ CSV Zoho Importer          Rôle: [Admin ▼]               ││
│  │ ☑ SoNear Transcription       Rôle: [User ▼]                ││
│  │ ☐ Autre App Future           Rôle: [-- ▼]                  ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│  [Enregistrer]                              [Supprimer l'accès] │
└─────────────────────────────────────────────────────────────────┘
```

### Qui peut accéder à l'admin ?

| Rôle                | Permissions                                           |
| -------------------- | ----------------------------------------------------- |
| `super_admin`      | Accès total, gère tous les users et toutes les apps |
| `admin`(d'une app) | Gère uniquement les users de son app                 |
| `user`             | Pas d'accès admin                                    |

Le `super_admin` est stocké dans `user_metadata` ou une table dédiée :

```sql
-- Option 1 : Dans user_metadata
raw_user_meta_data = { "super_admin": true }

-- Option 2 : Table dédiée
CREATE TABLE super_admins (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id)
);
```

---

## Questions ouvertes

1. **Domaine personnalisé ?**
   * `auth-sonear.vercel.app` ou `auth.sonear.com` ?
2. **Gestion des invitations ?**
   * Un admin peut-il inviter un utilisateur directement sur une app ?
   * Flow : envoi email → inscription avec accès pré-autorisé
3. **Session partagée ?**
   * Si connecté sur une app, automatiquement connecté sur les autres ?
   * Réponse probable : OUI, car même projet Supabase = même session
4. **Schéma de la table `user_app_access` ?**
   * `public` (simple) ou `auth_central` (isolé) ?

---

*Document créé le 19/01/2026*
*Dernière mise à jour : 19/01/2026*
*Projet : Authentification Centralisée SoNear*
