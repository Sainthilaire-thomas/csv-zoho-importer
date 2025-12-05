# Structure du projet - csv-zoho-importer

*Genere le 2025-12-05 17:05:50*
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
|   |   |-- profiles/
|   |   |   |-- [id]/
|   |   |   |-- match/
|   |   |   |   +-- route.ts
|   |   |   +-- route.ts
|   |   |-- rules/
|   |   +-- zoho/
|   |       |-- columns/
|   |       |   +-- route.ts
|   |       |-- data/
|   |       |   +-- route.ts
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
|   |   |   |-- step-profile.tsx
|   |   |   |-- step-resolve.tsx
|   |   |   |-- step-review.tsx
|   |   |   |-- step-source.tsx
|   |   |   |-- step-transform-preview.tsx
|   |   |   |-- step-validate.tsx
|   |   |   |-- verification-report.tsx
|   |   |   +-- wizard-progress.tsx
|   |   |-- file-upload.tsx
|   |   |-- profile-edit-dialog.tsx
|   |   |-- table-selector.tsx
|   |   |-- table-selector-accordion.tsx
|   |   |-- transformation-preview.tsx
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
|   |   |-- dialog.tsx
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
|   |   |   |-- image/
|   |   |   |   +-- mission-005-profils-import/
|   |   |   |-- mission-001-setup-initial.md
|   |   |   |-- mission-002-wizard-import.md
|   |   |   |-- mission-003-api-zoho.md
|   |   |   |-- mission-004-validation-schema.md
|   |   |   |-- mission-004-validation-schema-PAUSE.md
|   |   |   |-- mission-005-profils-import.md
|   |   |   |-- mission-006-COMPLETE.md
|   |   |   |-- mission-006-preview-transformations.md
|   |   |   |-- mission-007-import-2-phases-rollback.md
|   |   |   +-- TEMPLATE-MISSION.md
|   |   |-- base-context.md
|   |   +-- README.md
|   |-- image/
|   |   +-- specs-fonctionnelles/
|   |       +-- 1764570677131.png
|   |-- sql/
|   |   +-- 002-user-zoho-tokens.sql
|   |-- architecture-cible.md
|   |-- architecture-cible-v3.md
|   |-- doc-session.md
|   |-- project-structure.md
|   |-- specs-fonctionnelles.md
|   |-- specs-preview-verification.md
|   |-- specs-profils-import.md
|   |-- specs-profils-import-v2.1.md
|   +-- specs-validation-avancee.md
|-- lib/
|   |-- domain/
|   |   |-- detection/
|   |   |   |-- index.ts
|   |   |   +-- type-detector.ts
|   |   |-- file-provider/
|   |   |-- profile/
|   |   |   |-- index.ts
|   |   |   +-- profile-manager.ts
|   |   |-- transformation/
|   |   |   |-- index.ts
|   |   |   +-- preview.ts
|   |   |-- validation/
|   |   |   |-- rules/
|   |   |   |   |-- base.ts
|   |   |   |   |-- date.ts
|   |   |   |   |-- email.ts
|   |   |   |   |-- index.ts
|   |   |   |   |-- number.ts
|   |   |   |   +-- required.ts
|   |   |   |-- engine.ts
|   |   |   +-- index.ts
|   |   |-- verification/
|   |   |   |-- compare.ts
|   |   |   |-- index.ts
|   |   |   +-- types.ts
|   |   |-- data-transformer.ts
|   |   +-- schema-validator.ts
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
|   |-- index.ts
|   +-- profiles.ts
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
|-- tsconfig.json
+-- tsconfig.tsbuildinfo
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
