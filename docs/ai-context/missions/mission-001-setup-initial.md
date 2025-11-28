# 🎯 Mission: Setup Initial du Projet

*Session prévue : Semaine 1*

---

## Objectif

Mettre en place les fondations du projet "CSV to Zoho Analytics Importer" avec :

* Projet Next.js 14 configuré avec TypeScript strict
* Authentification Supabase fonctionnelle
* Structure de dossiers selon l'architecture cible
* Types fondamentaux définis
* Layout de base avec navigation
* Page de login fonctionnelle
* Déploiement initial sur Vercel

---

## Contexte

### Documents de référence

* `docs/ai-context/base-context.md` - Contexte technique du projet
* `docs/architecture-cible.md` - Architecture détaillée
* `docs/specs-fonctionnelles.md` - Spécifications fonctionnelles

### Stack technique

* Next.js 14 (App Router)
* TypeScript 5.x (strict mode)
* Tailwind CSS 3.x
* Supabase (Auth + Database)
* Vercel (Hosting)

---

## Prérequis avant la session

### Comptes à créer

* [ ] Compte Supabase : https://supabase.com
* [ ] Compte Vercel : https://vercel.com
* [ ] Repository GitHub créé

### Informations à collecter

* [ ] Supabase Project URL
* [ ] Supabase Anon Key
* [ ] Supabase Service Role Key

### Zoho Analytics (peut être fait plus tard)

* [ ] Client ID
* [ ] Client Secret
* [ ] Refresh Token
* [ ] Workspace ID
* [ ] Organization ID

---

## Actions planifiées

### Étape 1 : Création du projet Next.js

```bash
npx create-next-app@latest csv-zoho-importer --typescript --tailwind --eslint --app --src-dir=false --import-alias="@/*"
```

**Fichiers créés/modifiés :**

* `package.json`
* `tsconfig.json`
* `tailwind.config.js`
* `next.config.js`

### Étape 2 : Installation des dépendances

```bash
# Dépendances principales
npm install @supabase/supabase-js @supabase/auth-helpers-nextjs
npm install @tanstack/react-query
npm install papaparse zod
npm install react-hook-form @hookform/resolvers
npm install lucide-react sonner

# Dev dependencies
npm install -D @types/papaparse
```

### Étape 3 : Configuration TypeScript strict

**Fichier : `tsconfig.json`**

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitReturns": true,
    // ... reste de la config
  }
}
```

### Étape 4 : Création de la structure de dossiers

```
csv-zoho-importer/
├── app/
│   ├── (auth)/
│   │   ├── login/
│   │   │   └── page.tsx
│   │   └── layout.tsx
│   ├── (dashboard)/
│   │   ├── import/
│   │   │   └── page.tsx
│   │   ├── history/
│   │   │   └── page.tsx
│   │   ├── settings/
│   │   │   └── page.tsx
│   │   └── layout.tsx
│   ├── api/
│   │   └── .gitkeep
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── ui/
│   │   └── .gitkeep
│   └── layout/
│       ├── sidebar.tsx
│       └── header.tsx
├── lib/
│   ├── domain/
│   │   └── .gitkeep
│   ├── infrastructure/
│   │   └── supabase/
│   │       ├── client.ts
│   │       └── server.ts
│   ├── hooks/
│   │   └── .gitkeep
│   └── utils/
│       └── .gitkeep
├── types/
│   ├── import.ts
│   ├── validation.ts
│   ├── zoho.ts
│   └── database.ts
├── config/
│   └── constants.ts
└── docs/
    └── ai-context/
        ├── base-context.md
        └── missions/
```

### Étape 5 : Types fondamentaux

**Fichiers à créer :**

* `types/import.ts`
* `types/validation.ts`
* `types/zoho.ts`
* `types/database.ts`

### Étape 6 : Configuration Supabase

**Fichiers à créer :**

* `lib/infrastructure/supabase/client.ts`
* `lib/infrastructure/supabase/server.ts`
* `.env.local` (avec variables)

**Base de données Supabase :**

* Créer les tables via SQL (voir architecture)
* Configurer RLS

### Étape 7 : Middleware d'authentification

**Fichier : `middleware.ts`**

```typescript
// Protection des routes /import, /history, /settings
```

### Étape 8 : Layout et Navigation

**Fichiers à créer :**

* `app/(dashboard)/layout.tsx` - Layout avec sidebar
* `components/layout/sidebar.tsx` - Navigation principale
* `components/layout/header.tsx` - Header avec user info

### Étape 9 : Page de Login

**Fichier : `app/(auth)/login/page.tsx`**

* Formulaire email/password
* Intégration Supabase Auth
* Redirection après login

### Étape 10 : Pages placeholder

**Fichiers à créer :**

* `app/(dashboard)/import/page.tsx` - "Import - Coming soon"
* `app/(dashboard)/history/page.tsx` - "History - Coming soon"
* `app/(dashboard)/settings/page.tsx` - "Settings - Coming soon"

### Étape 11 : Déploiement Vercel

* [ ] Connecter repo GitHub à Vercel
* [ ] Configurer variables d'environnement
* [ ] Premier déploiement
* [ ] Mettre à jour URLs dans Supabase

---

## Critères de succès

### Fonctionnel

* [ ] `npm run dev` démarre sans erreur
* [ ] `npm run build` compile sans erreur
* [ ] Login/Logout fonctionne
* [ ] Routes protégées redirigent vers login
* [ ] Navigation entre pages fonctionne

### Technique

* [ ] TypeScript strict sans erreurs
* [ ] Structure de dossiers conforme à l'architecture
* [ ] Variables d'environnement configurées
* [ ] Déploiement Vercel fonctionnel

### Documentation

* [ ] README.md à jour
* [ ] .env.example créé
* [ ] Fichiers de contexte IA sauvegardés

---

## Code à produire

### 1. Types fondamentaux

```typescript
// types/import.ts
export type ImportStatus = 'idle' | 'selecting' | 'configuring' | 'validating' | 'reviewing' | 'importing' | 'success' | 'error';
export type ImportMode = 'append' | 'replace';
export type FileSource = 'upload' | 'sftp';
// ... voir base-context.md pour les interfaces complètes
```

### 2. Client Supabase

```typescript
// lib/infrastructure/supabase/client.ts
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import type { Database } from '@/types/database';

export const createClient = () => createClientComponentClient<Database>();
```

### 3. Middleware

```typescript
// middleware.ts
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(req: NextRequest) {
  // ... protection des routes
}

export const config = {
  matcher: ['/(dashboard)/:path*']
};
```

### 4. Layout Dashboard

```typescript
// app/(dashboard)/layout.tsx
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';

export default function DashboardLayout({ children }) {
  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <Header />
        <main className="flex-1 p-6 overflow-auto bg-gray-50">
          {children}
        </main>
      </div>
    </div>
  );
}
```

---

## Commandes utiles

```bash
# Développement
npm run dev

# Build de vérification
npm run build

# Lint
npm run lint

# Déploiement
vercel

# Supabase CLI (optionnel)
npx supabase init
npx supabase start
```

---

## Notes importantes

### Sécurité

* Ne JAMAIS commiter `.env.local`
* Utiliser les variables d'environnement Vercel pour la prod
* Service Role Key uniquement côté serveur

### Conventions

* Composants en PascalCase
* Fichiers en kebab-case
* Types/Interfaces avec préfixe I optionnel
* Hooks avec préfixe `use`

### À ne PAS faire dans cette session

* ❌ Implémentation du wizard d'import
* ❌ Connexion à Zoho Analytics
* ❌ Moteur de validation
* ❌ Composants UI avancés

---

## Livrables attendus

1. **Repository GitHub** avec le projet initialisé
2. **Projet Supabase** avec tables créées
3. **Déploiement Vercel** fonctionnel
4. **Documentation** :
   * README.md
   * .env.example
   * Ce fichier mission mis à jour avec le bilan

---

## Template de bilan (à compléter en fin de session)

```markdown
## ✅ Travail accompli
- [x] Item 1
- [x] Item 2

## 📁 Fichiers créés/modifiés
| Fichier | Action | Description |
|---------|--------|-------------|
| ... | Créé | ... |

## ⏳ Reste à faire
- [ ] Item 1
- [ ] Item 2

## 📝 Notes pour la prochaine session
...

## 🔗 Liens utiles
- Repo: https://github.com/...
- Vercel: https://...vercel.app
- Supabase: https://...supabase.co
```

---

*Mission créée le 17 novembre 2025*
*À mettre à jour en fin de session avec le bilan*
