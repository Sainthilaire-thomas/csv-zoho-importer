# Structure du projet - csv-zoho-importer

*Genere le 2025-11-30 11:16:46*
```
csv-zoho-importer/
|-- .vscode/
|   +-- tasks.json
|-- app/
|   |-- (auth)/
|   |   |-- login/
|   |   |   +-- page.tsx
|   |   +-- layout.tsx
|   |-- (dashboard)/
|   |   |-- history/
|   |   |   +-- page.tsx
|   |   |-- import/
|   |   |   |-- import-page-client.tsx
|   |   |   +-- page.tsx
|   |   |-- settings/
|   |   |   |-- rules/
|   |   |   +-- page.tsx
|   |   +-- layout.tsx
|   |-- api/
|   |   |-- csv/
|   |   |   |-- import/
|   |   |   |   +-- route.ts
|   |   |   +-- validate/
|   |   |       +-- route.ts
|   |   |-- imports/
|   |   |-- rules/
|   |   +-- zoho/
|   |       |-- folders/
|   |       |   +-- route.ts
|   |       |-- import/
|   |       |   +-- route.ts
|   |       |-- oauth/
|   |       |   |-- authorize/
|   |       |   |-- callback/
|   |       |   |-- disconnect/
|   |       |   +-- status/
|   |       |-- tables/
|   |       |   +-- route.ts
|   |       +-- workspaces/
|   |           +-- route.ts
|   |-- favicon.ico
|   |-- globals.css
|   |-- layout.tsx
|   +-- page.tsx
|-- components/
|   |-- import/
|   |   |-- wizard/
|   |   |   |-- import-wizard.tsx
|   |   |   |-- index.ts
|   |   |   |-- step-config.tsx
|   |   |   |-- step-confirm.tsx
|   |   |   |-- step-review.tsx
|   |   |   |-- step-source.tsx
|   |   |   |-- step-validate.tsx
|   |   |   +-- wizard-progress.tsx
|   |   |-- file-upload.tsx
|   |   |-- table-selector.tsx
|   |   |-- table-selector-accordion.tsx
|   |   +-- validation-results.tsx
|   |-- layout/
|   |   |-- header.tsx
|   |   |-- sidebar.tsx
|   |   +-- theme-toggle.tsx
|   |-- rules/
|   |-- ui/
|   |   |-- alert.tsx
|   |   |-- button.tsx
|   |   |-- card.tsx
|   |   +-- progress.tsx
|   |-- zoho/
|   |   |-- index.ts
|   |   |-- zoho-connect-button.tsx
|   |   +-- zoho-connection-status.tsx
|   +-- theme-provider.tsx
|-- config/
|-- docs/
|   |-- ai-context/
|   |   |-- missions/
|   |   |   |-- mission-001-setup-initial.md
|   |   |   |-- mission-002-wizard-import.md
|   |   |   |-- mission-003-api-zoho.md
|   |   |   +-- TEMPLATE-MISSION.md
|   |   |-- architecture-cible.md
|   |   |-- base-context.md
|   |   +-- README.md
|   |-- sql/
|   |   +-- 002-user-zoho-tokens.sql
|   |-- architecture-cible.md
|   |-- doc-session.md
|   |-- project-structure.md
|   +-- specs-fonctionnelles.md
|-- lib/
|   |-- domain/
|   |   |-- file-provider/
|   |   +-- validation/
|   |       |-- rules/
|   |       |   |-- base.ts
|   |       |   |-- date.ts
|   |       |   |-- email.ts
|   |       |   |-- index.ts
|   |       |   |-- number.ts
|   |       |   +-- required.ts
|   |       |-- engine.ts
|   |       +-- index.ts
|   |-- hooks/
|   |   |-- use-csv-parser.ts
|   |   |-- use-import.ts
|   |   +-- use-validation.ts
|   |-- infrastructure/
|   |   |-- supabase/
|   |   |   |-- client.ts
|   |   |   +-- server.ts
|   |   +-- zoho/
|   |       |-- auth.ts
|   |       |-- client.ts
|   |       |-- encryption.ts
|   |       |-- index.ts
|   |       +-- types.ts
|   +-- utils/
|-- public/
|   |-- file.svg
|   |-- globe.svg
|   |-- next.svg
|   |-- vercel.svg
|   +-- window.svg
|-- scripts/
|   +-- generate-tree.ps1
|-- types/
|   +-- index.ts
|-- .env.local
|-- .gitignore
|-- eslint.config.mjs
|-- middleware.ts
|-- next.config.ts
|-- next-env.d.ts
|-- package.json
|-- package-lock.json
|-- postcss.config.mjs
|-- README.md
|-- tailwind.config.ts
+-- tsconfig.json
```

## Fichiers cles

| Fichier | Description |
|---------|-------------|
| app/layout.tsx | Layout racine avec ThemeProvider |
| app/(auth)/ | Pages authentification |
| app/(dashboard)/ | Pages du dashboard |
| middleware.ts | Protection des routes |
| lib/infrastructure/ | Clients Supabase, Zoho |
| components/ | Composants React |
| types/ | Types TypeScript |

---

*Genere automatiquement par scripts/generate-tree.ps1*
