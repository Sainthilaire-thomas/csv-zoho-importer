# Documentation de Session

## Mise en Place et Développement - Application Import CSV vers Zoho Analytics

**Date de création :** 17 novembre 2025

**Projet :** CSV to Zoho Analytics Automation

**Stack :** Next.js 14, Vercel, Supabase, Zoho Analytics API

---

## Table des Matières

1. [Configuration Initiale](https://claude.ai/chat/79e60ca8-4d6a-4a53-9b06-011df74fd769#1-configuration-initiale)
2. [Setup du Projet](https://claude.ai/chat/79e60ca8-4d6a-4a53-9b06-011df74fd769#2-setup-du-projet)
3. [Configuration des Services Externes](https://claude.ai/chat/79e60ca8-4d6a-4a53-9b06-011df74fd769#3-configuration-des-services-externes)
4. [Développement Phase par Phase](https://claude.ai/chat/79e60ca8-4d6a-4a53-9b06-011df74fd769#4-d%C3%A9veloppement-phase-par-phase)
5. [Tests et Validation](https://claude.ai/chat/79e60ca8-4d6a-4a53-9b06-011df74fd769#5-tests-et-validation)
6. [Déploiement](https://claude.ai/chat/79e60ca8-4d6a-4a53-9b06-011df74fd769#6-d%C3%A9ploiement)
7. [Maintenance et Évolutions](https://claude.ai/chat/79e60ca8-4d6a-4a53-9b06-011df74fd769#7-maintenance-et-%C3%A9volutions)

---

## 1. Configuration Initiale

### 1.1 Prérequis

Avant de commencer, assurez-vous d'avoir :

```bash
# Node.js et npm
node --version  # v18.0.0 ou supérieur
npm --version   # v9.0.0 ou supérieur

# Git
git --version

# Compte GitHub (pour le repo)
# Compte Vercel (pour le déploiement)
# Compte Supabase (pour auth + DB)
# Compte Zoho Analytics avec API access
```

### 1.2 Comptes et Accès Nécessaires

**À créer/vérifier :**

* [ ] Compte Vercel : https://vercel.com
* [ ] Compte Supabase : https://supabase.com
* [ ] Compte Zoho Analytics avec droits admin
* [ ] Accès au serveur SFTP (credentials)
* [ ] Compte GitHub pour versioning

### 1.3 Informations à Collecter

**Zoho Analytics :**

```
- Client ID
- Client Secret
- Workspace ID
- Organization ID
- API Domain (zoho.com ou zoho.eu)
```

**Serveur SFTP :**

```
- Hostname
- Port (généralement 22)
- Username
- Clé SSH ou Password
- Chemin du dossier des fichiers CSV
```

**Supabase :**

```
- Project URL
- Anon Public Key
- Service Role Key (pour opérations backend)
```

---

## 2. Setup du Projet

### 2.1 Création du Projet Next.js

```bash
# Créer le projet
npx create-next-app@latest csv-zoho-importer

# Options recommandées lors du setup :
# ✓ TypeScript: Yes
# ✓ ESLint: Yes
# ✓ Tailwind CSS: Yes
# ✓ src/ directory: No
# ✓ App Router: Yes
# ✓ Import alias: Yes (@/*)

cd csv-zoho-importer
```

### 2.2 Installation des Dépendances

```bash
# Dépendances principales
npm install @supabase/supabase-js @supabase/auth-helpers-nextjs
npm install papaparse
npm install ssh2-sftp-client
npm install zod
npm install react-hook-form @hookform/resolvers

# Dépendances de développement
npm install -D @types/papaparse
npm install -D @types/ssh2-sftp-client

# Dépendances UI (optionnelles mais recommandées)
npm install lucide-react
npm install @radix-ui/react-dialog @radix-ui/react-select
npm install sonner # Pour les notifications toast
```

### 2.3 Structure du Projet

```bash
# Créer la structure de dossiers
mkdir -p app/api/auth
mkdir -p app/api/csv
mkdir -p app/api/zoho
mkdir -p app/api/sftp
mkdir -p app/import
mkdir -p app/history
mkdir -p lib/validators
mkdir -p lib/zoho
mkdir -p lib/sftp
mkdir -p components/ui
mkdir -p components/import
mkdir -p types
mkdir -p config
```

**Structure finale attendue :**

```
csv-zoho-importer/
├── app/
│   ├── api/
│   │   ├── auth/
│   │   │   └── [...nextauth]/route.ts
│   │   ├── csv/
│   │   │   ├── validate/route.ts
│   │   │   └── import/route.ts
│   │   ├── zoho/
│   │   │   ├── tables/route.ts
│   │   │   └── import/route.ts
│   │   └── sftp/
│   │       └── files/route.ts
│   ├── import/
│   │   └── page.tsx
│   ├── history/
│   │   └── page.tsx
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── ui/
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   └── ...
│   └── import/
│       ├── file-upload.tsx
│       ├── sftp-picker.tsx
│       ├── table-selector.tsx
│       └── validation-results.tsx
├── lib/
│   ├── validators/
│   │   ├── csv-validator.ts
│   │   └── schemas.ts
│   ├── zoho/
│   │   ├── client.ts
│   │   └── api.ts
│   ├── sftp/
│   │   └── client.ts
│   ├── supabase/
│   │   ├── client.ts
│   │   └── server.ts
│   └── utils.ts
├── types/
│   ├── csv.ts
│   ├── zoho.ts
│   └── import.ts
├── config/
│   └── validation-rules.ts
├── .env.local
└── package.json
```

### 2.4 Configuration des Variables d'Environnement

Créer le fichier `.env.local` :

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Zoho Analytics
ZOHO_CLIENT_ID=your_client_id
ZOHO_CLIENT_SECRET=your_client_secret
ZOHO_REFRESH_TOKEN=your_refresh_token
ZOHO_WORKSPACE_ID=your_workspace_id
ZOHO_ORG_ID=your_org_id
ZOHO_API_DOMAIN=analyticsapi.zoho.eu # ou .com

# SFTP
SFTP_HOST=your_sftp_host
SFTP_PORT=22
SFTP_USERNAME=your_username
SFTP_PASSWORD=your_password # OU utiliser clé SSH
SFTP_UPLOAD_DIR=/path/to/csv/files

# Application
NEXT_PUBLIC_APP_URL=http://localhost:3000
NODE_ENV=development
```

Créer aussi `.env.example` pour la documentation :

```bash
cp .env.local .env.example
# Puis remplacer les valeurs par des placeholders
```

### 2.5 Configuration Git

```bash
# Initialiser Git si pas déjà fait
git init

# Créer .gitignore (normalement déjà créé par create-next-app)
# Vérifier qu'il contient :
echo "
.env*.local
.vercel
node_modules/
.next/
" >> .gitignore

# Premier commit
git add .
git commit -m "Initial setup: Next.js project with dependencies"

# Créer le repo sur GitHub et lier
git remote add origin https://github.com/votre-username/csv-zoho-importer.git
git branch -M main
git push -u origin main
```

---

## 3. Configuration des Services Externes

### 3.1 Configuration Supabase

#### Étape 1 : Créer le Projet Supabase

1. Aller sur https://supabase.com
2. Créer un nouveau projet
3. Choisir région Europe (pour RGPD)
4. Noter les credentials (URL, anon key, service role key)

#### Étape 2 : Créer les Tables

```sql
-- Table pour les logs d'import (métadonnées uniquement)
CREATE TABLE import_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  table_name TEXT NOT NULL,
  import_mode TEXT NOT NULL CHECK (import_mode IN ('append', 'replace')),
  rows_total INTEGER NOT NULL,
  rows_success INTEGER NOT NULL,
  rows_errors INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('success', 'error', 'partial')),
  error_message TEXT,
  duration_ms INTEGER,
  zoho_import_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index pour optimiser les requêtes
CREATE INDEX idx_import_logs_user_id ON import_logs(user_id);
CREATE INDEX idx_import_logs_created_at ON import_logs(created_at DESC);
CREATE INDEX idx_import_logs_status ON import_logs(status);

-- Row Level Security (RLS)
ALTER TABLE import_logs ENABLE ROW LEVEL SECURITY;

-- Policy : Les utilisateurs ne voient que leurs propres logs
CREATE POLICY "Users can view their own import logs"
  ON import_logs
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own import logs"
  ON import_logs
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Table pour les règles de validation par table
CREATE TABLE validation_rules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  table_name TEXT NOT NULL UNIQUE,
  rules JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Exemple de règles par défaut
INSERT INTO validation_rules (table_name, rules) VALUES
('Ventes', '{
  "date_commande": {
    "type": "date",
    "format": "DD/MM/YYYY",
    "required": true
  },
  "montant_ht": {
    "type": "number",
    "required": true,
    "min": 0
  },
  "email_client": {
    "type": "email",
    "required": true
  },
  "statut": {
    "type": "enum",
    "values": ["en_attente", "validee", "livree", "annulee"],
    "required": true
  }
}');
```

#### Étape 3 : Configurer l'Authentification

1. Dans Supabase Dashboard → Authentication → Providers
2. Activer "Email" provider
3. Configurer les URLs :
   * Site URL : `http://localhost:3000` (dev) puis `https://votre-app.vercel.app` (prod)
   * Redirect URLs : Ajouter `/auth/callback`

#### Étape 4 : Créer les Helpers Supabase

Créer `lib/supabase/client.ts` :

```typescript
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Database } from '@/types/supabase';

export const createClient = () => {
  return createClientComponentClient<Database>();
};
```

Créer `lib/supabase/server.ts` :

```typescript
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { Database } from '@/types/supabase';

export const createServerClient = () => {
  return createServerComponentClient<Database>({ cookies });
};
```

### 3.2 Configuration Zoho Analytics

#### Étape 1 : Créer une Application OAuth

1. Aller sur https://api-console.zoho.eu (ou .com)
2. Créer une nouvelle "Server-based Application"
3. Noter le Client ID et Client Secret
4. Configurer Redirect URI : `http://localhost:3000/auth/zoho/callback`

#### Étape 2 : Obtenir le Refresh Token

```bash
# Construire l'URL d'autorisation (remplacer CLIENT_ID)
https://accounts.zoho.eu/oauth/v2/auth?scope=ZohoAnalytics.data.create,ZohoAnalytics.metadata.read&client_id=YOUR_CLIENT_ID&response_type=code&access_type=offline&redirect_uri=http://localhost:3000/auth/zoho/callback

# 1. Ouvrir cette URL dans le navigateur
# 2. Autoriser l'application
# 3. Copier le code dans l'URL de redirection
# 4. Échanger le code contre un refresh token
```

Script pour obtenir le refresh token :

```bash
curl -X POST https://accounts.zoho.eu/oauth/v2/token \
  -d "code=YOUR_CODE" \
  -d "client_id=YOUR_CLIENT_ID" \
  -d "client_secret=YOUR_CLIENT_SECRET" \
  -d "redirect_uri=http://localhost:3000/auth/zoho/callback" \
  -d "grant_type=authorization_code"
```

Sauvegarder le `refresh_token` dans `.env.local`

#### Étape 3 : Créer le Client Zoho

Créer `lib/zoho/client.ts` :

```typescript
export class ZohoAnalyticsClient {
  private baseUrl: string;
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  constructor() {
    this.baseUrl = `https://${process.env.ZOHO_API_DOMAIN}/api`;
  }

  async getAccessToken(): Promise<string> {
    // Si le token existe et n'est pas expiré, le retourner
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    // Sinon, rafraîchir le token
    const response = await fetch('https://accounts.zoho.eu/oauth/v2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        refresh_token: process.env.ZOHO_REFRESH_TOKEN!,
        client_id: process.env.ZOHO_CLIENT_ID!,
        client_secret: process.env.ZOHO_CLIENT_SECRET!,
        grant_type: 'refresh_token',
      }),
    });

    const data = await response.json();
    this.accessToken = data.access_token;
    this.tokenExpiry = Date.now() + (data.expires_in * 1000);

    return this.accessToken;
  }

  async getTables(): Promise<any[]> {
    const token = await this.getAccessToken();
    const response = await fetch(
      `${this.baseUrl}/${process.env.ZOHO_WORKSPACE_ID}/tables`,
      {
        headers: { 'Authorization': `Zoho-oauthtoken ${token}` },
      }
    );
    return response.json();
  }

  async importData(
    tableName: string,
    data: any[],
    mode: 'append' | 'replace'
  ): Promise<any> {
    const token = await this.getAccessToken();
    const csvData = this.convertToCSV(data);

    const response = await fetch(
      `${this.baseUrl}/${process.env.ZOHO_WORKSPACE_ID}/tables/${tableName}/import`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Zoho-oauthtoken ${token}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          'ZOHO_ACTION': 'IMPORT',
          'ZOHO_IMPORT_TYPE': mode === 'replace' ? 'TRUNCATEADD' : 'APPEND',
          'ZOHO_AUTO_IDENTIFY': 'true',
          'ZOHO_CREATE_TABLE': 'false',
          'ZOHO_IMPORT_DATA': csvData,
        }),
      }
    );

    return response.json();
  }

  private convertToCSV(data: any[]): string {
    // Utiliser Papa Parse pour convertir en CSV
    const Papa = require('papaparse');
    return Papa.unparse(data);
  }
}

export const zohoClient = new ZohoAnalyticsClient();
```

### 3.3 Configuration SFTP

Créer `lib/sftp/client.ts` :

```typescript
import Client from 'ssh2-sftp-client';

export class SFTPClient {
  private client: Client;

  constructor() {
    this.client = new Client();
  }

  async connect(): Promise<void> {
    await this.client.connect({
      host: process.env.SFTP_HOST!,
      port: parseInt(process.env.SFTP_PORT || '22'),
      username: process.env.SFTP_USERNAME!,
      password: process.env.SFTP_PASSWORD,
      // OU pour clé SSH :
      // privateKey: fs.readFileSync('/path/to/private/key'),
    });
  }

  async listFiles(directory?: string): Promise<any[]> {
    const dir = directory || process.env.SFTP_UPLOAD_DIR || '/';
    const files = await this.client.list(dir);
  
    // Filtrer uniquement les fichiers CSV
    return files.filter(file => 
      file.type === '-' && file.name.endsWith('.csv')
    );
  }

  async getFile(filePath: string): Promise<Buffer> {
    return await this.client.get(filePath);
  }

  async disconnect(): Promise<void> {
    await this.client.end();
  }
}

export const sftpClient = new SFTPClient();
```

---

## 4. Développement Phase par Phase

### Phase 1 : Authentification et Layout (Semaine 1)

#### Jour 1-2 : Setup Authentification

**1. Créer le middleware d'authentification**

Créer `middleware.ts` à la racine :

```typescript
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req, res });

  const {
    data: { session },
  } = await supabase.auth.getSession();

  // Protéger les routes /import et /history
  if (!session && (req.nextUrl.pathname.startsWith('/import') || 
                    req.nextUrl.pathname.startsWith('/history'))) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  return res;
}

export const config = {
  matcher: ['/import/:path*', '/history/:path*'],
};
```

**2. Créer les pages d'authentification**

Créer `app/login/page.tsx` :

```typescript
'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      alert(error.message);
    } else {
      router.push('/import');
    }

    setLoading(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8">
        <h1 className="text-2xl font-bold mb-6">Connexion</h1>
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Mot de passe</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg"
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
          >
            {loading ? 'Connexion...' : 'Se connecter'}
          </button>
        </form>
      </div>
    </div>
  );
}
```

**3. Créer le layout avec navigation**

Modifier `app/layout.tsx` :

```typescript
import { Inter } from 'next/font/google';
import './globals.css';
import Navigation from '@/components/navigation';

const inter = Inter({ subsets: ['latin'] });

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <body className={inter.className}>
        <Navigation />
        <main className="min-h-screen bg-gray-50">
          {children}
        </main>
      </body>
    </html>
  );
}
```

Créer `components/navigation.tsx` :

```typescript
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

export default function Navigation() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/login');
  }

  if (pathname === '/login') return null;

  return (
    <nav className="bg-white shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex space-x-8">
            <Link 
              href="/import"
              className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                pathname === '/import'
                  ? 'border-blue-500 text-gray-900'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Importer
            </Link>
            <Link 
              href="/history"
              className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                pathname === '/history'
                  ? 'border-blue-500 text-gray-900'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Historique
            </Link>
          </div>
          <div className="flex items-center">
            <button
              onClick={handleLogout}
              className="text-gray-500 hover:text-gray-700 text-sm font-medium"
            >
              Déconnexion
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
```

#### Jour 3-5 : Page d'Import de Base

**Créer `app/import/page.tsx` :**

```typescript
'use client';

import { useState } from 'react';
import FileUpload from '@/components/import/file-upload';
import SftpPicker from '@/components/import/sftp-picker';

export default function ImportPage() {
  const [mode, setMode] = useState<'upload' | 'sftp' | null>(null);

  return (
    <div className="max-w-4xl mx-auto py-12 px-4">
      <h1 className="text-3xl font-bold mb-8">
        Importer un fichier CSV dans Zoho Analytics
      </h1>

      {!mode && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <button
            onClick={() => setMode('upload')}
            className="p-8 bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow border-2 border-transparent hover:border-blue-500"
          >
            <div className="text-4xl mb-4">📤</div>
            <h2 className="text-xl font-semibold mb-2">Uploader un fichier</h2>
            <p className="text-gray-600">
              Sélectionnez un fichier CSV depuis votre ordinateur
            </p>
          </button>

          <button
            onClick={() => setMode('sftp')}
            className="p-8 bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow border-2 border-transparent hover:border-blue-500"
          >
            <div className="text-4xl mb-4">📁</div>
            <h2 className="text-xl font-semibold mb-2">Serveur SFTP</h2>
            <p className="text-gray-600">
              Choisir un fichier depuis le serveur SFTP
            </p>
          </button>
        </div>
      )}

      {mode === 'upload' && (
        <div>
          <button 
            onClick={() => setMode(null)}
            className="mb-4 text-blue-600 hover:text-blue-700"
          >
            ← Retour
          </button>
          <FileUpload />
        </div>
      )}

      {mode === 'sftp' && (
        <div>
          <button 
            onClick={() => setMode(null)}
            className="mb-4 text-blue-600 hover:text-blue-700"
          >
            ← Retour
          </button>
          <SftpPicker />
        </div>
      )}
    </div>
  );
}
```

### Phase 2 : Validation et Import (Semaine 2)

#### Jour 1-2 : Parser et Validator

**Créer `lib/validators/csv-validator.ts` :**

```typescript
import Papa from 'papaparse';
import { z } from 'zod';

export interface ValidationError {
  line: number;
  field: string;
  error: string;
  value?: any;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  data: any[];
  rowCount: number;
}

export class CSVValidator {
  async validateFile(
    file: File | string,
    tableName: string
  ): Promise<ValidationResult> {
    // 1. Parser le CSV
    const parsed = await this.parseCSV(file);
  
    if (parsed.errors.length > 0) {
      return {
        valid: false,
        errors: parsed.errors.map((err, idx) => ({
          line: idx + 1,
          field: 'parsing',
          error: err.message,
        })),
        data: [],
        rowCount: 0,
      };
    }

    // 2. Récupérer les règles de validation
    const rules = await this.getValidationRules(tableName);

    // 3. Valider chaque ligne
    const errors: ValidationError[] = [];
    const validatedData: any[] = [];

    parsed.data.forEach((row: any, index: number) => {
      const rowErrors = this.validateRow(row, rules, index + 1);
    
      if (rowErrors.length > 0) {
        errors.push(...rowErrors);
      } else {
        validatedData.push(row);
      }
    });

    return {
      valid: errors.length === 0,
      errors,
      data: validatedData,
      rowCount: parsed.data.length,
    };
  }

  private async parseCSV(file: File | string): Promise<any> {
    return new Promise((resolve) => {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => resolve(results),
        error: (error) => resolve({ data: [], errors: [error] }),
      });
    });
  }

  private async getValidationRules(tableName: string): Promise<any> {
    // Récupérer depuis Supabase
    const { createClient } = await import('@/lib/supabase/client');
    const supabase = createClient();
  
    const { data } = await supabase
      .from('validation_rules')
      .select('rules')
      .eq('table_name', tableName)
      .single();

    return data?.rules || {};
  }

  private validateRow(
    row: any,
    rules: any,
    lineNumber: number
  ): ValidationError[] {
    const errors: ValidationError[] = [];

    Object.entries(rules).forEach(([field, rule]: [string, any]) => {
      const value = row[field];

      // Required
      if (rule.required && !value) {
        errors.push({
          line: lineNumber,
          field,
          error: 'Champ requis',
        });
        return;
      }

      if (!value) return; // Skip validation si pas de valeur et pas required

      // Type validation
      switch (rule.type) {
        case 'date':
          if (!this.isValidDate(value, rule.format)) {
            errors.push({
              line: lineNumber,
              field,
              error: `Date invalide, format attendu: ${rule.format}`,
              value,
            });
          }
          break;

        case 'number':
          const num = Number(value);
          if (isNaN(num)) {
            errors.push({
              line: lineNumber,
              field,
              error: 'Doit être un nombre',
              value,
            });
          } else {
            if (rule.min !== undefined && num < rule.min) {
              errors.push({
                line: lineNumber,
                field,
                error: `Doit être >= ${rule.min}`,
                value,
              });
            }
            if (rule.max !== undefined && num > rule.max) {
              errors.push({
                line: lineNumber,
                field,
                error: `Doit être <= ${rule.max}`,
                value,
              });
            }
          }
          break;

        case 'email':
          if (!this.isValidEmail(value)) {
            errors.push({
              line: lineNumber,
              field,
              error: 'Format email invalide',
              value,
            });
          }
          break;

        case 'enum':
          if (!rule.values.includes(value)) {
            errors.push({
              line: lineNumber,
              field,
              error: `Valeur doit être parmi: ${rule.values.join(', ')}`,
              value,
            });
          }
          break;
      }
    });

    return errors;
  }

  private isValidDate(value: string, format?: string): boolean {
    // Implémenter la validation de date selon le format
    // Pour simplifier, on accepte plusieurs formats
    const date = new Date(value);
    return !isNaN(date.getTime());
  }

  private isValidEmail(value: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(value);
  }
}

export const csvValidator = new CSVValidator();
```

#### Jour 3-4 : API Routes

**Créer `app/api/csv/validate/route.ts` :**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { csvValidator } from '@/lib/validators/csv-validator';
import { createServerClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    // Vérifier l'authentification
    const supabase = createServerClient();
    const { data: { session } } = await supabase.auth.getSession();
  
    if (!session) {
      return NextResponse.json(
        { error: 'Non authentifié' },
        { status: 401 }
      );
    }

    // Récupérer les données
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const tableName = formData.get('tableName') as string;

    if (!file || !tableName) {
      return NextResponse.json(
        { error: 'Fichier et nom de table requis' },
        { status: 400 }
      );
    }

    // Valider le fichier
    const result = await csvValidator.validateFile(file, tableName);

    return NextResponse.json(result);

  } catch (error) {
    console.error('Erreur validation:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la validation' },
      { status: 500 }
    );
  }
}
```

**Créer `app/api/csv/import/route.ts` :**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { csvValidator } from '@/lib/validators/csv-validator';
import { zohoClient } from '@/lib/zoho/client';
import { createServerClient } from '@/lib/supabase/server';

export const maxDuration = 60; // 60 secondes max

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  let fileContent: string | null = null;
  let parsedData: any[] | null = null;

  try {
    // Authentification
    const supabase = createServerClient();
    const { data: { session } } = await supabase.auth.getSession();
  
    if (!session) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    // Récupérer les données
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const tableName = formData.get('tableName') as string;
    const importMode = formData.get('importMode') as 'append' | 'replace';

    // Validation
    const validationResult = await csvValidator.validateFile(file, tableName);
  
    if (!validationResult.valid) {
      return NextResponse.json({
        success: false,
        errors: validationResult.errors,
      });
    }

    parsedData = validationResult.data;

    // Import vers Zoho Analytics
    const zohoResult = await zohoClient.importData(
      tableName,
      parsedData,
      importMode
    );

    const duration = Date.now() - startTime;

    // Logger les métadonnées (PAS les données)
    await supabase.from('import_logs').insert({
      user_id: session.user.id,
      file_name: file.name,
      table_name: tableName,
      import_mode: importMode,
      rows_total: validationResult.rowCount,
      rows_success: parsedData.length,
      rows_errors: validationResult.errors.length,
      status: 'success',
      duration_ms: duration,
      zoho_import_id: zohoResult.import_id,
    });

    return NextResponse.json({
      success: true,
      rowsImported: parsedData.length,
      duration,
    });

  } catch (error: any) {
    console.error('Erreur import:', error);

    // Logger l'erreur (sans les données)
    const supabase = createServerClient();
    const { data: { session } } = await supabase.auth.getSession();
  
    if (session) {
      await supabase.from('import_logs').insert({
        user_id: session.user.id,
        file_name: 'unknown',
        table_name: 'unknown',
        import_mode: 'append',
        rows_total: parsedData?.length || 0,
        rows_success: 0,
        rows_errors: parsedData?.length || 0,
        status: 'error',
        error_message: error.message,
        duration_ms: Date.now() - startTime,
      });
    }

    return NextResponse.json(
      { success: false, error: 'Erreur lors de l\'import' },
      { status: 500 }
    );

  } finally {
    // CRITIQUE : Nettoyer la mémoire
    fileContent = null;
    parsedData = null;
  }
}
```

### Phase 3 : Interface Complète (Semaine 3-4)

#### Composant FileUpload

**Créer `components/import/file-upload.tsx` :**

```typescript
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function FileUpload() {
  const [file, setFile] = useState<File | null>(null);
  const [tableName, setTableName] = useState('');
  const [importMode, setImportMode] = useState<'append' | 'replace'>('append');
  const [status, setStatus] = useState<'idle' | 'validating' | 'importing' | 'success' | 'error'>('idle');
  const [validationResult, setValidationResult] = useState<any>(null);
  const [importResult, setImportResult] = useState<any>(null);

  async function handleValidate() {
    if (!file || !tableName) return;

    setStatus('validating');

    const formData = new FormData();
    formData.append('file', file);
    formData.append('tableName', tableName);

    const response = await fetch('/api/csv/validate', {
      method: 'POST',
      body: formData,
    });

    const result = await response.json();
    setValidationResult(result);
    setStatus(result.valid ? 'idle' : 'error');
  }

  async function handleImport() {
    if (!file || !tableName) return;

    setStatus('importing');

    const formData = new FormData();
    formData.append('file', file);
    formData.append('tableName', tableName);
    formData.append('importMode', importMode);

    const response = await fetch('/api/csv/import', {
      method: 'POST',
      body: formData,
    });

    const result = await response.json();
    setImportResult(result);
    setStatus(result.success ? 'success' : 'error');
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-8">
      {/* Upload du fichier */}
      <div className="mb-6">
        <label className="block text-sm font-medium mb-2">
          Fichier CSV *
        </label>
        <input
          type="file"
          accept=".csv"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          className="w-full"
        />
        {file && (
          <p className="mt-2 text-sm text-gray-600">
            {file.name} • {(file.size / 1024).toFixed(1)} KB
          </p>
        )}
      </div>

      {/* Sélection de la table */}
      <div className="mb-6">
        <label className="block text-sm font-medium mb-2">
          Table de destination *
        </label>
        <select
          value={tableName}
          onChange={(e) => setTableName(e.target.value)}
          className="w-full px-4 py-2 border rounded-lg"
        >
          <option value="">Sélectionner une table</option>
          <option value="Ventes">Ventes</option>
          <option value="Clients">Clients</option>
          <option value="Commandes">Commandes</option>
        </select>
      </div>

      {/* Mode d'import */}
      <div className="mb-6">
        <label className="block text-sm font-medium mb-2">
          Mode d'import *
        </label>
        <div className="space-y-2">
          <label className="flex items-center">
            <input
              type="radio"
              value="append"
              checked={importMode === 'append'}
              onChange={() => setImportMode('append')}
              className="mr-2"
            />
            Ajouter à la fin
          </label>
          <label className="flex items-center">
            <input
              type="radio"
              value="replace"
              checked={importMode === 'replace'}
              onChange={() => setImportMode('replace')}
              className="mr-2"
            />
            Remplacer toutes les données
          </label>
        </div>
      </div>

      {/* Boutons d'action */}
      <div className="flex gap-4">
        <button
          onClick={handleValidate}
          disabled={!file || !tableName || status === 'validating'}
          className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
        >
          {status === 'validating' ? 'Validation...' : 'Analyser et valider'}
        </button>
      
        {validationResult?.valid && (
          <button
            onClick={handleImport}
            disabled={status === 'importing'}
            className="flex-1 bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 disabled:bg-gray-400"
          >
            {status === 'importing' ? 'Import en cours...' : 'Importer dans Zoho'}
          </button>
        )}
      </div>

      {/* Résultats de validation */}
      {validationResult && (
        <div className={`mt-6 p-4 rounded-lg ${
          validationResult.valid ? 'bg-green-50' : 'bg-red-50'
        }`}>
          {validationResult.valid ? (
            <div>
              <div className="text-green-800 font-semibold mb-2">
                ✅ Validation réussie !
              </div>
              <p className="text-green-700 text-sm">
                {validationResult.rowCount} lignes prêtes à être importées
              </p>
            </div>
          ) : (
            <div>
              <div className="text-red-800 font-semibold mb-2">
                ⚠️ {validationResult.errors.length} erreur(s) détectée(s)
              </div>
              <div className="max-h-60 overflow-y-auto">
                {validationResult.errors.slice(0, 10).map((err: any, idx: number) => (
                  <div key={idx} className="text-red-700 text-sm mb-1">
                    Ligne {err.line} • {err.field} : {err.error}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Résultat d'import */}
      {importResult && (
        <div className={`mt-6 p-4 rounded-lg ${
          importResult.success ? 'bg-green-50' : 'bg-red-50'
        }`}>
          {importResult.success ? (
            <div>
              <div className="text-green-800 font-semibold mb-2">
                ✅ Import réussi !
              </div>
              <p className="text-green-700 text-sm">
                {importResult.rowsImported} lignes importées en {(importResult.duration / 1000).toFixed(1)}s
              </p>
            </div>
          ) : (
            <div className="text-red-800">
              ❌ Erreur lors de l'import
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

---

## 5. Tests et Validation

### 5.1 Tests Manuels

**Checklist de tests :**

```markdown
## Authentification
- [ ] Connexion avec email/password
- [ ] Déconnexion
- [ ] Redirection si non authentifié
- [ ] Session persiste après refresh

## Upload et Validation
- [ ] Upload fichier CSV valide
- [ ] Refus fichier non-CSV
- [ ] Refus fichier > 50 MB
- [ ] Validation détecte erreurs de format
- [ ] Messages d'erreur clairs et précis
- [ ] Validation réussie pour fichier conforme

## Import Zoho
- [ ] Import mode "append" fonctionne
- [ ] Import mode "replace" fonctionne (avec confirmation)
- [ ] Gestion des erreurs API Zoho
- [ ] Timeout si fichier trop gros
- [ ] Logs créés dans Supabase
- [ ] Aucune donnée CSV conservée

## SFTP (si implémenté)
- [ ] Liste des fichiers SFTP s'affiche
- [ ] Sélection d'un fichier fonctionne
- [ ] Erreur de connexion gérée

## Sécurité
- [ ] Variables d'environnement non exposées
- [ ] Tokens Zoho régénérés automatiquement
- [ ] RLS Supabase fonctionne
- [ ] Aucune donnée CSV dans les logs
```

### 5.2 Tests de Performance

```bash
# Tester avec différentes tailles de fichiers
- 100 lignes : < 2s
- 1 000 lignes : < 5s
- 10 000 lignes : < 30s
- 50 000 lignes : < 60s
```

---

## 6. Déploiement

### 6.1 Configuration Vercel

**1. Connecter le repo GitHub à Vercel**

```bash
# Depuis le terminal
vercel

# OU via l'interface web Vercel
# - Importer le projet depuis GitHub
# - Configurer les variables d'environnement
```

**2. Variables d'environnement Vercel**

Dans Vercel Dashboard → Settings → Environment Variables, ajouter :

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
ZOHO_CLIENT_ID
ZOHO_CLIENT_SECRET
ZOHO_REFRESH_TOKEN
ZOHO_WORKSPACE_ID
ZOHO_ORG_ID
ZOHO_API_DOMAIN
SFTP_HOST
SFTP_PORT
SFTP_USERNAME
SFTP_PASSWORD
NEXT_PUBLIC_APP_URL (mettre l'URL Vercel)
```

**3. Configuration du domaine**

* Vercel fournit un domaine par défaut : `votre-app.vercel.app`
* Optionnel : Configurer un domaine personnalisé

**4. Mettre à jour Supabase**

Dans Supabase Dashboard → Authentication → URL Configuration :

* Site URL : `https://votre-app.vercel.app`
* Redirect URLs : Ajouter `https://votre-app.vercel.app/auth/callback`

**5. Deploy**

```bash
git push origin main
# Vercel déploie automatiquement
```

### 6.2 Configuration du Serveur VPS (pour SFTP)

Si vous utilisez un VPS pour recevoir les fichiers SFTP :

**1. Louer un VPS**

* Recommandé : OVH, Scaleway, DigitalOcean
* Configuration minimale : 1 CPU, 1 GB RAM, 20 GB SSD

**2. Installer et configurer SSH/SFTP**

```bash
# Se connecter au VPS
ssh root@votre-vps-ip

# Créer un utilisateur dédié pour SFTP
sudo adduser sftpuser
sudo passwd sftpuser

# Configurer SSH pour SFTP uniquement
sudo nano /etc/ssh/sshd_config

# Ajouter à la fin :
Match User sftpuser
    ForceCommand internal-sftp
    PasswordAuthentication yes
    ChrootDirectory /home/sftpuser
    PermitTunnel no
    AllowAgentForwarding no
    AllowTcpForwarding no
    X11Forwarding no

# Redémarrer SSH
sudo systemctl restart sshd

# Créer le dossier d'upload
sudo mkdir -p /home/sftpuser/uploads
sudo chown sftpuser:sftpuser /home/sftpuser/uploads
```

**3. Tester la connexion SFTP**

```bash
sftp sftpuser@votre-vps-ip
# Entrer le mot de passe
# Tester upload d'un fichier
put test.csv uploads/
```

---

## 7. Maintenance et Évolutions

### 7.1 Monitoring

**1. Configurer les alertes Vercel**

* Analytics → Enable
* Alerter si erreur rate > 5%
* Alerter si temps de réponse > 5s

**2. Monitoring Supabase**

* Database → Performance
* Vérifier les requêtes lentes
* Surveiller l'utilisation du stockage

**3. Logs Zoho API**

* Surveiller le rate limiting
* Logger les erreurs API

### 7.2 Sauvegardes

**Supabase :**

* Sauvegardes automatiques quotidiennes (incluses)
* Export manuel hebdomadaire recommandé

**Code :**

* Git commits réguliers
* Tags pour chaque release : `git tag v1.0.0`

### 7.3 Roadmap des Évolutions

**Phase 4 (optionnelle) - Fonctionnalités avancées :**

1. **Dashboard historique complet**
   * Statistiques d'import
   * Graphiques de performance
   * Export des rapports
2. **Imports programmés**
   * Cron jobs via Vercel Cron
   * Configuration des plannings
   * Notifications automatiques
3. **Multi-utilisateurs**
   * Rôles (admin, user, viewer)
   * Permissions par table
   * Gestion des équipes
4. **Règles de validation avancées**
   * Interface de configuration
   * Règles métier personnalisées
   * Tests de cohérence inter-colonnes

---

## 8. Checklist Finale de Mise en Production

```markdown
## Setup Technique
- [ ] Repository Git créé et pushé
- [ ] Dépendances installées et à jour
- [ ] Variables d'environnement configurées
- [ ] Supabase projet créé et tables configurées
- [ ] Zoho OAuth configuré et refresh token obtenu
- [ ] SFTP serveur configuré (si applicable)

## Développement
- [ ] Authentification fonctionnelle
- [ ] Upload de fichiers fonctionne
- [ ] Validation CSV opérationnelle
- [ ] Import vers Zoho réussi
- [ ] Logs de métadonnées créés
- [ ] Aucune donnée CSV conservée (vérifié)

## Tests
- [ ] Tests manuels passés (checklist complète)
- [ ] Tests avec différentes tailles de fichiers
- [ ] Tests des cas d'erreur
- [ ] Tests de sécurité (RLS, auth, etc.)

## Déploiement
- [ ] Application déployée sur Vercel
- [ ] Variables d'environnement production configurées
- [ ] Domaine configuré (si applicable)
- [ ] URLs de redirection Supabase mises à jour
- [ ] SSL/HTTPS actif

## Documentation
- [ ] README.md à jour
- [ ] Documentation utilisateur créée
- [ ] Guide de maintenance rédigé

## Monitoring
- [ ] Alertes Vercel configurées
- [ ] Monitoring Supabase actif
- [ ] Logs accessibles et exploitables

## Go Live
- [ ] Tests en production réussis
- [ ] Formation des utilisateurs effectuée
- [ ] Support technique en place
```

---

## 9. Commandes Utiles

```bash
# Développement
npm run dev              # Lancer en local
npm run build            # Build de production
npm run lint             # Vérifier le code

# Supabase
npx supabase init        # Initialiser Supabase localement
npx supabase start       # Démarrer Supabase local
npx supabase db push     # Pousser le schéma DB

# Vercel
vercel                   # Déployer en preview
vercel --prod            # Déployer en production
vercel logs              # Voir les logs

# Git
git add .
git commit -m "message"
git push origin main
git tag v1.0.0           # Créer un tag de version
```

---

## 10. Ressources et Documentation

**Next.js :**

* https://nextjs.org/docs

**Supabase :**

* https://supabase.com/docs
* https://supabase.com/docs/guides/auth

**Zoho Analytics API :**

* https://www.zoho.com/analytics/api/
* https://help.zoho.com/portal/en/kb/analytics/developer-guide

**Papa Parse :**

* https://www.papaparse.com/docs

**Vercel :**

* https://vercel.com/docs

---

**Bonne chance avec le développement ! 🚀**

Pour toute question ou problème, n'hésitez pas à consulter cette documentation ou à demander de l'aide.
