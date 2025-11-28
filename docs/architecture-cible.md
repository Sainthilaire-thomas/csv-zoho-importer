# Architecture Cible - CSV to Zoho Analytics Importer

*Version 1.0 - 17 novembre 2025*

---

## 1. Vue d'ensemble de l'architecture

### 1.1 Principes directeurs

| Principe                         | Description                       | Impact sur l'architecture              |
| -------------------------------- | --------------------------------- | -------------------------------------- |
| **Zero Data Retention**    | Aucune donnée CSV stockée       | Traitement streaming, pas de cache     |
| **Separation of Concerns** | Couches distinctes                | Domain / Infrastructure / UI séparés |
| **Extensibilité**         | Nouvelles règles/sources faciles | Patterns Strategy et Factory           |
| **Type Safety**            | TypeScript strict                 | Interfaces explicites partout          |
| **Testabilité**           | Logic métier testable isolément | Domain layer sans dépendances         |

### 1.2 Diagramme d'architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              PRESENTATION LAYER                              │
│                           (Next.js App Router + React)                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  PAGES (Server Components)          COMPONENTS (Client Components)          │
│  ┌─────────────────────────┐        ┌─────────────────────────────┐        │
│  │ app/(dashboard)/        │        │ components/                  │        │
│  │   import/page.tsx       │───────▶│   import/wizard/            │        │
│  │   history/page.tsx      │        │     step-source.tsx         │        │
│  │   settings/rules/       │        │     step-config.tsx         │        │
│  └─────────────────────────┘        │     step-validate.tsx       │        │
│                                     │     step-review.tsx         │        │
│                                     │     step-confirm.tsx        │        │
│                                     │   rules/rule-editor.tsx     │        │
│                                     └─────────────────────────────┘        │
│                                              │                              │
│                                              ▼                              │
│  HOOKS (State Management)           ┌─────────────────────────────┐        │
│  ┌─────────────────────────┐        │ React Query                 │        │
│  │ lib/hooks/              │◀──────▶│   Queries & Mutations       │        │
│  │   use-import.ts         │        │   Cache Management          │        │
│  │   use-validation.ts     │        └─────────────────────────────┘        │
│  │   use-rules.ts          │                                               │
│  └─────────────────────────┘                                               │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                API LAYER                                     │
│                           (Next.js Route Handlers)                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  app/api/                                                                   │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐       │
│  │ /csv         │ │ /zoho        │ │ /rules       │ │ /imports     │       │
│  │  /validate   │ │  /tables     │ │  GET/POST    │ │  GET/POST    │       │
│  │  /preview    │ │  /import     │ │  /[table]    │ │  /[id]       │       │
│  └──────┬───────┘ └──────┬───────┘ └──────┬───────┘ └──────┬───────┘       │
│         │                │                │                │                │
│         └────────────────┴────────────────┴────────────────┘                │
│                                    │                                        │
├────────────────────────────────────┼────────────────────────────────────────┤
│                              DOMAIN LAYER                                    │
│                         (Pure Business Logic)                                │
├────────────────────────────────────┼────────────────────────────────────────┤
│                                    │                                        │
│  lib/domain/                       ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────┐       │
│  │                                                                   │       │
│  │  ┌───────────────────┐  ┌───────────────────┐  ┌─────────────┐  │       │
│  │  │ FileProvider      │  │ ValidationEngine  │  │ ImportProc. │  │       │
│  │  │ (Strategy Pattern)│  │ (Rule Registry)   │  │ (Orchestr.) │  │       │
│  │  │                   │  │                   │  │             │  │       │
│  │  │ ┌───────────────┐ │  │ ┌───────────────┐ │  │ ┌─────────┐ │  │       │
│  │  │ │ UploadProvider│ │  │ │ RequiredRule  │ │  │ │ parse() │ │  │       │
│  │  │ │ SFTPProvider  │ │  │ │ DateRule      │ │  │ │validate│ │  │       │
│  │  │ │ (placeholder) │ │  │ │ NumberRule    │ │  │ │ format()│ │  │       │
│  │  │ └───────────────┘ │  │ │ EmailRule     │ │  │ │ import()│ │  │       │
│  │  │                   │  │ │ EnumRule      │ │  │ └─────────┘ │  │       │
│  │  │                   │  │ │ RegexRule     │ │  │             │  │       │
│  │  │                   │  │ │ CustomRule    │ │  │             │  │       │
│  │  └───────────────────┘  │ └───────────────┘ │  └─────────────┘  │       │
│  │                         │                   │                    │       │
│  └─────────────────────────────────────────────────────────────────┘       │
│                                    │                                        │
├────────────────────────────────────┼────────────────────────────────────────┤
│                          INFRASTRUCTURE LAYER                                │
│                           (External Services)                                │
├────────────────────────────────────┼────────────────────────────────────────┤
│                                    │                                        │
│  lib/infrastructure/               ▼                                        │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐             │
│  │ supabase/       │  │ zoho/           │  │ sftp/           │             │
│  │  client.ts      │  │  client.ts      │  │  client.ts      │             │
│  │  server.ts      │  │  auth.ts        │  │  (placeholder)  │             │
│  │  admin.ts       │  │  api.ts         │  │                 │             │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘             │
│           │                    │                    │                       │
└───────────┼────────────────────┼────────────────────┼───────────────────────┘
            │                    │                    │
            ▼                    ▼                    ▼
     ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
     │   Supabase   │    │     Zoho     │    │    SFTP      │
     │  PostgreSQL  │    │  Analytics   │    │   Server     │
     │    Auth      │    │     API      │    │   (futur)    │
     └──────────────┘    └──────────────┘    └──────────────┘
```

---

## 2. Couche Domain (Business Logic)

### 2.1 Structure

```
lib/domain/
├── validation/
│   ├── engine.ts                 # Moteur de validation principal
│   ├── types.ts                  # Types du domaine validation
│   ├── rules/
│   │   ├── base.ts               # Classe abstraite ValidationRule
│   │   ├── required.ts
│   │   ├── date.ts
│   │   ├── number.ts
│   │   ├── email.ts
│   │   ├── enum.ts
│   │   ├── regex.ts
│   │   ├── length.ts
│   │   ├── custom.ts
│   │   └── index.ts              # Export et registry
│   └── index.ts
│
├── file-provider/
│   ├── types.ts                  # Interface FileProvider
│   ├── upload-provider.ts        # Implémentation upload
│   ├── sftp-provider.ts          # Placeholder SFTP
│   ├── factory.ts                # FileProviderFactory
│   └── index.ts
│
├── import/
│   ├── processor.ts              # Orchestration du processus
│   ├── formatter.ts              # Formatage des données
│   └── types.ts
│
└── index.ts                      # Exports publics
```

### 2.2 Moteur de Validation

```typescript
// lib/domain/validation/engine.ts

/**
 * Le ValidationEngine est responsable de :
 * 1. Enregistrer les règles disponibles
 * 2. Charger la configuration d'une table
 * 3. Valider les données selon cette configuration
 * 4. Produire un rapport détaillé
 */

export class ValidationEngine {
  private rules: Map<RuleType, ValidationRuleBase> = new Map();
  
  constructor() {
    // Auto-enregistrement des règles built-in
    this.registerBuiltInRules();
  }
  
  /**
   * Enregistre une nouvelle règle de validation
   * Permet l'extension avec des règles custom
   */
  registerRule(rule: ValidationRuleBase): void {
    this.rules.set(rule.type, rule);
  }
  
  /**
   * Valide un ensemble de données contre une configuration
   * Retourne un rapport complet avec erreurs par ligne
   */
  async validate(
    data: Record<string, any>[],
    config: TableValidationConfig
  ): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const parsedRows: ParsedRow[] = [];
  
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const lineNumber = i + 2; // +2 car ligne 1 = headers
      const rowErrors = this.validateRow(row, config, lineNumber);
    
      errors.push(...rowErrors);
      parsedRows.push({
        ...row,
        _lineNumber: lineNumber,
        _isValid: rowErrors.length === 0,
        _errors: rowErrors
      });
    }
  
    return {
      isValid: errors.length === 0,
      totalRows: data.length,
      validRows: parsedRows.filter(r => r._isValid).length,
      errorRows: parsedRows.filter(r => !r._isValid).length,
      errors,
      preview: parsedRows.slice(0, 50)
    };
  }
  
  private validateRow(
    row: Record<string, any>,
    config: TableValidationConfig,
    lineNumber: number
  ): ValidationError[] {
    const errors: ValidationError[] = [];
  
    for (const columnConfig of config.columns) {
      const value = row[columnConfig.columnName];
    
      for (const ruleConfig of columnConfig.rules) {
        if (!ruleConfig.enabled) continue;
      
        const rule = this.rules.get(ruleConfig.type);
        if (!rule) continue;
      
        const context: RuleContext = {
          value,
          row,
          columnName: columnConfig.columnName,
          lineNumber
        };
      
        const result = rule.validate(context, ruleConfig.params);
      
        if (!result.isValid) {
          errors.push({
            line: lineNumber,
            column: columnConfig.columnName,
            value: String(value ?? ''),
            rule: ruleConfig.type,
            message: ruleConfig.message || result.message || 'Erreur'
          });
        }
      }
    }
  
    return errors;
  }
}
```

### 2.3 Pattern Règle de Validation

```typescript
// lib/domain/validation/rules/base.ts

/**
 * Interface du contexte passé à chaque règle
 */
export interface RuleContext {
  value: any;                      // Valeur à valider
  row: Record<string, any>;        // Ligne complète (pour règles cross-field)
  columnName: string;              // Nom de la colonne
  lineNumber: number;              // Numéro de ligne pour le rapport
}

/**
 * Résultat d'une validation de règle
 */
export interface RuleResult {
  isValid: boolean;
  message?: string;
}

/**
 * Classe abstraite pour toutes les règles de validation
 * Chaque nouvelle règle doit étendre cette classe
 */
export abstract class ValidationRuleBase {
  abstract readonly type: RuleType;
  abstract readonly displayName: string;
  abstract readonly description: string;
  
  /**
   * Méthode principale de validation
   * @param context - Contexte de validation
   * @param params - Paramètres spécifiques à la règle
   */
  abstract validate(context: RuleContext, params?: any): RuleResult;
  
  /**
   * Retourne le schéma des paramètres pour l'UI
   * Utilisé pour générer le formulaire de configuration
   */
  abstract getParamsSchema(): ParamsSchema;
  
  /**
   * Helper pour formater les messages
   */
  protected formatMessage(
    template: string, 
    replacements: Record<string, any>
  ): string {
    return Object.entries(replacements).reduce(
      (msg, [key, value]) => msg.replace(`{${key}}`, String(value)),
      template
    );
  }
}

/**
 * Schéma des paramètres d'une règle
 * Utilisé pour générer dynamiquement l'UI de configuration
 */
export interface ParamsSchema {
  fields: ParamField[];
}

export interface ParamField {
  name: string;
  label: string;
  type: 'text' | 'number' | 'select' | 'boolean' | 'date';
  required?: boolean;
  defaultValue?: any;
  options?: { label: string; value: any }[];  // Pour select
  placeholder?: string;
}
```

### 2.4 Exemple d'implémentation de règle

```typescript
// lib/domain/validation/rules/date.ts

export class DateRule extends ValidationRuleBase {
  readonly type = 'date' as const;
  readonly displayName = 'Date';
  readonly description = 'Valide que la valeur est une date au format spécifié';
  
  validate(context: RuleContext, params?: DateRuleParams): RuleResult {
    const { value } = context;
  
    // Si vide, c'est RequiredRule qui gère
    if (value === null || value === undefined || value === '') {
      return { isValid: true };
    }
  
    const parsed = this.parseDate(String(value), params?.format);
  
    if (!parsed) {
      return {
        isValid: false,
        message: this.formatMessage(
          'Date invalide, format attendu : {format}',
          { format: params?.format || 'YYYY-MM-DD' }
        )
      };
    }
  
    // Vérification min
    if (params?.min) {
      const minDate = new Date(params.min);
      if (parsed < minDate) {
        return {
          isValid: false,
          message: this.formatMessage(
            'La date doit être après le {min}',
            { min: params.min }
          )
        };
      }
    }
  
    // Vérification max
    if (params?.max) {
      const maxDate = new Date(params.max);
      if (parsed > maxDate) {
        return {
          isValid: false,
          message: this.formatMessage(
            'La date doit être avant le {max}',
            { max: params.max }
          )
        };
      }
    }
  
    return { isValid: true };
  }
  
  getParamsSchema(): ParamsSchema {
    return {
      fields: [
        {
          name: 'format',
          label: 'Format',
          type: 'select',
          required: true,
          defaultValue: 'DD/MM/YYYY',
          options: [
            { label: 'JJ/MM/AAAA', value: 'DD/MM/YYYY' },
            { label: 'AAAA-MM-JJ', value: 'YYYY-MM-DD' },
            { label: 'MM/JJ/AAAA', value: 'MM/DD/YYYY' },
            { label: 'ISO 8601', value: 'ISO' }
          ]
        },
        {
          name: 'min',
          label: 'Date minimum',
          type: 'date',
          required: false
        },
        {
          name: 'max',
          label: 'Date maximum',
          type: 'date',
          required: false
        }
      ]
    };
  }
  
  private parseDate(value: string, format?: string): Date | null {
    // Implémentation du parsing selon le format
    // ...
  }
}

interface DateRuleParams {
  format?: string;
  min?: string;
  max?: string;
}
```

### 2.5 File Provider (Abstraction des sources)

```typescript
// lib/domain/file-provider/types.ts

/**
 * Interface pour toute source de fichiers
 * Permet d'ajouter SFTP, Google Drive, etc. sans modifier le code existant
 */
export interface FileProvider {
  readonly type: FileSource;
  
  /**
   * Vérifie si la source est disponible/configurée
   */
  isAvailable(): Promise<boolean>;
  
  /**
   * Liste les fichiers disponibles
   */
  listFiles(directory?: string): Promise<FileInfo[]>;
  
  /**
   * Récupère le contenu d'un fichier
   */
  getFileContent(path: string): Promise<string>;
  
  /**
   * Retourne les métadonnées d'un fichier
   */
  getFileInfo(path: string): Promise<FileInfo>;
}

// lib/domain/file-provider/factory.ts

/**
 * Factory pour créer le bon provider selon la source
 */
export class FileProviderFactory {
  private static providers: Map<FileSource, () => FileProvider> = new Map([
    ['upload', () => new UploadFileProvider()],
    ['sftp', () => new SFTPFileProvider()]
  ]);
  
  static create(type: FileSource): FileProvider {
    const factory = this.providers.get(type);
    if (!factory) {
      throw new Error(`Unknown file source: ${type}`);
    }
    return factory();
  }
  
  /**
   * Permet d'enregistrer de nouveaux providers
   */
  static register(type: FileSource, factory: () => FileProvider): void {
    this.providers.set(type, factory);
  }
}
```

---

## 3. Couche Infrastructure

### 3.1 Client Supabase

```typescript
// lib/infrastructure/supabase/client.ts
// Pour les Client Components

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import type { Database } from '@/types/database';

export const createClient = () => {
  return createClientComponentClient<Database>();
};

// lib/infrastructure/supabase/server.ts
// Pour les Server Components et Route Handlers

import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import type { Database } from '@/types/database';

export const createServerClient = () => {
  return createServerComponentClient<Database>({ cookies });
};

// lib/infrastructure/supabase/admin.ts
// Pour les opérations admin (service role)

import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

export const createAdminClient = () => {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
};
```

### 3.2 Client Zoho Analytics

```typescript
// lib/infrastructure/zoho/client.ts

/**
 * Client pour l'API Zoho Analytics
 * Gère l'authentification OAuth et les appels API
 */
export class ZohoAnalyticsClient {
  private baseUrl: string;
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;
  
  constructor() {
    const domain = process.env.ZOHO_API_DOMAIN || 'analyticsapi.zoho.eu';
    this.baseUrl = `https://${domain}/api`;
  }
  
  /**
   * Récupère un access token valide
   * Refresh automatique si expiré
   */
  async getAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiry - 60000) {
      return this.accessToken;
    }
  
    return this.refreshToken();
  }
  
  /**
   * Refresh le token OAuth
   */
  private async refreshToken(): Promise<string> {
    const domain = process.env.ZOHO_API_DOMAIN?.replace('analyticsapi', 'accounts') 
      || 'accounts.zoho.eu';
  
    const response = await fetch(`https://${domain}/oauth/v2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        refresh_token: process.env.ZOHO_REFRESH_TOKEN!,
        client_id: process.env.ZOHO_CLIENT_ID!,
        client_secret: process.env.ZOHO_CLIENT_SECRET!,
        grant_type: 'refresh_token',
      }),
    });
  
    if (!response.ok) {
      throw new Error('Failed to refresh Zoho token');
    }
  
    const data = await response.json();
    this.accessToken = data.access_token;
    this.tokenExpiry = Date.now() + (data.expires_in * 1000);
  
    return this.accessToken;
  }
  
  /**
   * Liste les tables du workspace
   */
  async getTables(): Promise<ZohoTable[]> {
    const token = await this.getAccessToken();
    const workspaceId = process.env.ZOHO_WORKSPACE_ID;
  
    const response = await fetch(
      `${this.baseUrl}/${workspaceId}/tables`,
      {
        headers: { 
          'Authorization': `Zoho-oauthtoken ${token}`,
          'ZANALYTICS-ORGID': process.env.ZOHO_ORG_ID!
        }
      }
    );
  
    if (!response.ok) {
      throw new Error(`Zoho API error: ${response.status}`);
    }
  
    const data = await response.json();
    return this.mapTables(data);
  }
  
  /**
   * Importe des données dans une table
   */
  async importData(
    tableName: string,
    csvData: string,
    mode: ImportMode
  ): Promise<ZohoImportResult> {
    const token = await this.getAccessToken();
    const workspaceId = process.env.ZOHO_WORKSPACE_ID;
  
    const importType = mode === 'replace' ? 'TRUNCATEADD' : 'APPEND';
  
    const response = await fetch(
      `${this.baseUrl}/${workspaceId}/${tableName}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Zoho-oauthtoken ${token}`,
          'ZANALYTICS-ORGID': process.env.ZOHO_ORG_ID!,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          'ZOHO_ACTION': 'IMPORT',
          'ZOHO_IMPORT_TYPE': importType,
          'ZOHO_AUTO_IDENTIFY': 'true',
          'ZOHO_CREATE_TABLE': 'false',
          'ZOHO_IMPORT_DATA': csvData
        })
      }
    );
  
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Zoho import failed: ${error}`);
    }
  
    return response.json();
  }
}

// Singleton
export const zohoClient = new ZohoAnalyticsClient();
```

---

## 4. Couche Présentation

### 4.1 Structure des Pages (App Router)

```
app/
├── (auth)/                       # Groupe routes auth
│   ├── login/page.tsx            # Server Component
│   └── layout.tsx                # Layout sans sidebar
│
├── (dashboard)/                  # Groupe routes principales
│   ├── layout.tsx                # Layout avec sidebar + header
│   │
│   ├── import/
│   │   └── page.tsx              # ImportWizard (Client)
│   │
│   ├── history/
│   │   ├── page.tsx              # Liste imports (Server)
│   │   └── [id]/page.tsx         # Détail import (Server)
│   │
│   └── settings/
│       ├── page.tsx              # Paramètres généraux
│       └── rules/
│           ├── page.tsx          # Liste tables (Server)
│           └── [table]/page.tsx  # Éditeur règles (Client)
│
├── api/                          # Route Handlers
│   ├── csv/
│   ├── zoho/
│   ├── rules/
│   └── imports/
│
├── layout.tsx                    # Root layout
└── page.tsx                      # Redirect → /import
```

### 4.2 Composants du Wizard

```typescript
// components/import/wizard/import-wizard.tsx

/**
 * Composant principal du wizard d'import
 * Gère le flow en 5 étapes
 */
'use client';

import { useImport } from '@/lib/hooks/use-import';

const STEPS = [
  { id: 'source', label: 'Source', component: StepSource },
  { id: 'config', label: 'Configuration', component: StepConfig },
  { id: 'validate', label: 'Validation', component: StepValidate },
  { id: 'review', label: 'Revue', component: StepReview },
  { id: 'confirm', label: 'Import', component: StepConfirm }
] as const;

export function ImportWizard() {
  const { state, actions, isValidating, isImporting } = useImport();
  const currentStepIndex = getStepIndex(state.status);
  const CurrentStepComponent = STEPS[currentStepIndex].component;
  
  return (
    <div className="max-w-4xl mx-auto">
      {/* Progress Bar */}
      <WizardProgress 
        steps={STEPS} 
        currentIndex={currentStepIndex} 
      />
    
      {/* Current Step */}
      <div className="mt-8 bg-white rounded-lg shadow-md p-8">
        <CurrentStepComponent
          state={state}
          actions={actions}
          isLoading={isValidating || isImporting}
        />
      </div>
    </div>
  );
}
```

### 4.3 Hook Principal useImport

```typescript
// lib/hooks/use-import.ts

/**
 * Hook gérant tout l'état et les actions du wizard d'import
 * Utilise React Query pour les mutations API
 */
export function useImport() {
  const queryClient = useQueryClient();
  
  // État local du wizard
  const [state, setState] = useState<ImportState>(initialState);
  
  // Mutation: Validation
  const validateMutation = useMutation({
    mutationFn: validateCSV,
    onMutate: () => updateState({ status: 'validating' }),
    onSuccess: (result) => {
      updateState({
        status: 'reviewing',
        validation: result
      });
    },
    onError: (error) => {
      updateState({ status: 'error', error: error.message });
    }
  });
  
  // Mutation: Import
  const importMutation = useMutation({
    mutationFn: importToZoho,
    onMutate: () => updateState({ status: 'importing' }),
    onSuccess: (result) => {
      updateState({ status: 'success', result });
      queryClient.invalidateQueries({ queryKey: ['import-history'] });
    },
    onError: (error) => {
      updateState({ status: 'error', error: error.message });
    }
  });
  
  // Actions exposées
  const actions = {
    setFile: (file: File) => { /* ... */ },
    setTable: (id: string, name: string) => { /* ... */ },
    setImportMode: (mode: ImportMode) => { /* ... */ },
    validate: () => validateMutation.mutate(state.config),
    import: () => importMutation.mutate(state.config),
    reset: () => setState(initialState),
    goToStep: (status: ImportStatus) => updateState({ status })
  };
  
  return {
    state,
    actions,
    isValidating: validateMutation.isPending,
    isImporting: importMutation.isPending
  };
}
```

---

## 5. API Routes

### 5.1 Structure des Routes

```typescript
// app/api/csv/validate/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/infrastructure/supabase/server';
import { ValidationEngine } from '@/lib/domain/validation';
import Papa from 'papaparse';

export const maxDuration = 30; // 30s max pour validation

export async function POST(request: NextRequest) {
  try {
    // 1. Auth check
    const supabase = createServerClient();
    const { data: { session } } = await supabase.auth.getSession();
  
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  
    // 2. Parse request
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const tableId = formData.get('tableId') as string;
  
    if (!file || !tableId) {
      return NextResponse.json(
        { error: 'File and tableId required' }, 
        { status: 400 }
      );
    }
  
    // 3. Parse CSV (en mémoire)
    const content = await file.text();
    const parsed = Papa.parse(content, {
      header: true,
      skipEmptyLines: true
    });
  
    // 4. Get validation config
    const config = await getTableValidationConfig(supabase, tableId);
  
    // 5. Validate
    const engine = new ValidationEngine();
    const result = await engine.validate(parsed.data, config);
  
    return NextResponse.json(result);
  
  } catch (error) {
    console.error('Validation error:', error);
    return NextResponse.json(
      { error: 'Validation failed' },
      { status: 500 }
    );
  }
  // Note: Pas de finally ici car on ne stocke rien
}
```

### 5.2 Route Import (avec cleanup mémoire)

```typescript
// app/api/csv/import/route.ts

export const maxDuration = 60; // 60s max pour import

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  let csvContent: string | null = null;
  let parsedData: any[] | null = null;
  
  try {
    // 1. Auth + Parse (même pattern)
    // ...
  
    // 2. Parse CSV
    csvContent = await file.text();
    const parsed = Papa.parse(csvContent, { header: true });
    parsedData = parsed.data;
  
    // 3. Validate (obligatoire avant import)
    const engine = new ValidationEngine();
    const validation = await engine.validate(parsedData, config);
  
    if (!validation.isValid) {
      return NextResponse.json({
        success: false,
        errors: validation.errors
      });
    }
  
    // 4. Format pour Zoho
    const zohoCSV = Papa.unparse(parsedData);
  
    // 5. Import vers Zoho
    const result = await zohoClient.importData(
      tableName,
      zohoCSV,
      importMode
    );
  
    // 6. Log métadonnées (PAS les données)
    await logImport(supabase, {
      user_id: session.user.id,
      zoho_table_id: tableId,
      file_name: file.name,
      file_size_bytes: file.size,
      import_mode: importMode,
      status: 'success',
      rows_total: parsedData.length,
      rows_imported: parsedData.length,
      duration_ms: Date.now() - startTime
    });
  
    return NextResponse.json({
      success: true,
      rowsImported: parsedData.length,
      duration: Date.now() - startTime
    });
  
  } catch (error) {
    // Log erreur (sans données)
    await logImport(supabase, {
      status: 'error',
      error_summary: [{ message: error.message }]
    });
  
    return NextResponse.json(
      { success: false, error: 'Import failed' },
      { status: 500 }
    );
  
  } finally {
    // CRITIQUE: Cleanup mémoire
    csvContent = null;
    parsedData = null;
  }
}
```

---

## 6. Flux de Données

### 6.1 Flux Import Complet

```
┌──────────────────────────────────────────────────────────────────────────┐
│                           IMPORT FLOW                                     │
└──────────────────────────────────────────────────────────────────────────┘

User                    Frontend                 API                  External
 │                         │                      │                      │
 │  1. Select file         │                      │                      │
 │────────────────────────▶│                      │                      │
 │                         │                      │                      │
 │  2. Configure           │                      │                      │
 │────────────────────────▶│                      │                      │
 │                         │                      │                      │
 │  3. Click Validate      │                      │                      │
 │────────────────────────▶│                      │                      │
 │                         │                      │                      │
 │                         │  4. POST /csv/validate                      │
 │                         │─────────────────────▶│                      │
 │                         │                      │                      │
 │                         │                      │  5. Get rules        │
 │                         │                      │─────────────────────▶│ Supabase
 │                         │                      │◀─────────────────────│
 │                         │                      │                      │
 │                         │                      │  6. Validate in RAM  │
 │                         │                      │  (no storage)        │
 │                         │                      │                      │
 │                         │  7. ValidationResult │                      │
 │                         │◀─────────────────────│                      │
 │                         │                      │                      │
 │  8. Show errors/preview │                      │                      │
 │◀────────────────────────│                      │                      │
 │                         │                      │                      │
 │  9. Click Import        │                      │                      │
 │────────────────────────▶│                      │                      │
 │                         │                      │                      │
 │                         │  10. POST /csv/import                       │
 │                         │─────────────────────▶│                      │
 │                         │                      │                      │
 │                         │                      │  11. Import to Zoho  │
 │                         │                      │─────────────────────▶│ Zoho
 │                         │                      │◀─────────────────────│
 │                         │                      │                      │
 │                         │                      │  12. Log metadata    │
 │                         │                      │─────────────────────▶│ Supabase
 │                         │                      │                      │
 │                         │                      │  13. Cleanup RAM     │
 │                         │                      │                      │
 │                         │  14. ImportResult    │                      │
 │                         │◀─────────────────────│                      │
 │                         │                      │                      │
 │  15. Show success       │                      │                      │
 │◀────────────────────────│                      │                      │
 │                         │                      │                      │
```

### 6.2 Flux Édition des Règles

```
User                    Frontend                 API                  Supabase
 │                         │                      │                      │
 │  1. Open Rules Editor   │                      │                      │
 │────────────────────────▶│                      │                      │
 │                         │                      │                      │
 │                         │  2. GET /rules/{table}                      │
 │                         │─────────────────────▶│                      │
 │                         │                      │  3. Fetch rules      │
 │                         │                      │─────────────────────▶│
 │                         │                      │◀─────────────────────│
 │                         │◀─────────────────────│                      │
 │                         │                      │                      │
 │  4. Edit rule params    │                      │                      │
 │────────────────────────▶│                      │                      │
 │                         │                      │                      │
 │  5. Test rule (preview) │                      │                      │
 │────────────────────────▶│                      │                      │
 │                         │  (validation locale) │                      │
 │◀────────────────────────│                      │                      │
 │                         │                      │                      │
 │  6. Save rules          │                      │                      │
 │────────────────────────▶│                      │                      │
 │                         │  7. PUT /rules/{table}                      │
 │                         │─────────────────────▶│                      │
 │                         │                      │  8. Update rules     │
 │                         │                      │─────────────────────▶│
 │                         │                      │◀─────────────────────│
 │                         │◀─────────────────────│                      │
 │  9. Confirmation        │                      │                      │
 │◀────────────────────────│                      │                      │
```

---

## 7. Évolutions Prévues

### 7.1 Phase 2 : SFTP

```typescript
// Implémentation du SFTPFileProvider
// lib/domain/file-provider/sftp-provider.ts

export class SFTPFileProvider implements FileProvider {
  readonly type = 'sftp' as const;
  
  async isAvailable(): Promise<boolean> {
    // Vérifier connexion SFTP
    try {
      await this.connect();
      await this.disconnect();
      return true;
    } catch {
      return false;
    }
  }
  
  async listFiles(directory?: string): Promise<FileInfo[]> {
    const client = await this.connect();
    try {
      const files = await client.list(directory || '/');
      return files
        .filter(f => f.name.endsWith('.csv'))
        .map(f => ({
          name: f.name,
          size: f.size,
          path: `${directory}/${f.name}`,
          lastModified: new Date(f.modifyTime),
          source: 'sftp' as const
        }));
    } finally {
      await this.disconnect();
    }
  }
  
  async getFileContent(path: string): Promise<string> {
    const client = await this.connect();
    try {
      const buffer = await client.get(path);
      return buffer.toString('utf-8');
    } finally {
      await this.disconnect();
    }
  }
}
```

### 7.2 Phase 3 : Dashboards Zoho

```typescript
// app/(dashboard)/dashboards/page.tsx

// Intégration des dashboards Zoho via embed URL
// Options : iframe, PDF export, email scheduling

// lib/infrastructure/zoho/dashboards.ts
export class ZohoDashboardService {
  async getEmbedUrl(dashboardId: string): Promise<string> {
    // Générer URL d'embed avec token temporaire
  }
  
  async exportPDF(dashboardId: string): Promise<Buffer> {
    // Export PDF via API Zoho
  }
  
  async scheduleEmail(config: EmailScheduleConfig): Promise<void> {
    // Planifier envoi par email
  }
}
```

---

## 8. Checklist d'implémentation

### MVP (Phase 1)

* [ ] Setup projet Next.js + Supabase + Vercel
* [ ] Authentification (login/logout)
* [ ] Types TypeScript complets
* [ ] Moteur de validation avec règles de base
* [ ] Upload provider
* [ ] SFTP provider (placeholder)
* [ ] Client Zoho Analytics
* [ ] Wizard d'import (5 étapes)
* [ ] Éditeur de règles de validation
* [ ] Historique des imports
* [ ] Tests manuels
* [ ] Déploiement production

### Phase 2

* [ ] Implémentation SFTP complète
* [ ] Règles de validation avancées
* [ ] Export rapports PDF
* [ ] Notifications (email/Slack)

### Phase 3

* [ ] Intégration dashboards Zoho
* [ ] Multi-utilisateurs / permissions
* [ ] Import programmé (cron)
* [ ] API publique

---

*Ce document d'architecture sert de référence pour tout le développement. À mettre à jour lors de changements structurels majeurs.*
