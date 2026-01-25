# Structure du projet - csv-zoho-importer

*Genere le 2026-01-25 16:41:50*
```
csv-zoho-importer/
|-- .vscode/
|   +-- tasks.json
|-- app/
|   |-- (auth)/
|   |   |-- login/
|   |   |   +-- page.tsx
|   |   |-- reset-password/
|   |   |   +-- page.tsx
|   |   +-- layout.tsx
|   |-- (dashboard)/
|   |   |-- dashboard-test/
|   |   |   +-- page.tsx
|   |   |-- history/
|   |   |   +-- page.tsx
|   |   |-- import/
|   |   |   |-- import-page-client.tsx
|   |   |   +-- page.tsx
|   |   |-- pdf-config/
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
|   |   |   |-- [id]/
|   |   |   +-- route.ts
|   |   |-- profiles/
|   |   |   |-- [id]/
|   |   |   |-- match/
|   |   |   |   +-- route.ts
|   |   |   +-- route.ts
|   |   |-- rowid-sync/
|   |   |   +-- route.ts
|   |   |-- rules/
|   |   +-- zoho/
|   |       |-- columns/
|   |       |   +-- route.ts
|   |       |-- dashboard-embed/
|   |       |   +-- route.ts
|   |       |-- dashboard-pdf/
|   |       |   +-- route.ts
|   |       |-- delete/
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
|   |       |-- sample-row/
|   |       |   +-- route.ts
|   |       |-- tables/
|   |       |   +-- route.ts
|   |       |-- test-cloudsql/
|   |       |   +-- route.ts
|   |       |-- verify-by-rowid/
|   |       |   +-- route.ts
|   |       |-- verify-data/
|   |       |   +-- route.ts
|   |       +-- workspaces/
|   |           +-- route.ts
|   |-- favicon.ico
|   |-- globals.css
|   |-- layout.tsx
|   +-- page.tsx
|-- components/
|   |-- history/
|   |   |-- import-card.tsx
|   |   |-- import-list.tsx
|   |   |-- index.ts
|   |   +-- rollback-dialog.tsx
|   |-- import/
|   |   |-- wizard/
|   |   |   |-- hooks/
|   |   |   |   |-- index.ts
|   |   |   |   |-- use-chunked-import.ts
|   |   |   |   |-- use-import-wizard-state.ts
|   |   |   |   |-- use-profile-management.ts
|   |   |   |   +-- use-test-import.ts
|   |   |   |-- import-wizard.tsx
|   |   |   |-- index.ts
|   |   |   |-- matching-column-selector.tsx
|   |   |   |-- step-config.tsx
|   |   |   |-- step-confirm.tsx
|   |   |   |-- step-profile.tsx
|   |   |   |-- step-resolve.tsx
|   |   |   |-- step-review.tsx
|   |   |   |-- step-source.tsx
|   |   |   |-- step-test-import.tsx
|   |   |   |-- step-test-result.tsx
|   |   |   |-- step-transform-preview.tsx
|   |   |   |-- step-validate.tsx
|   |   |   |-- verification-report.tsx
|   |   |   +-- wizard-progress.tsx
|   |   |-- file-upload.tsx
|   |   |-- profile-edit-dialog.tsx
|   |   |-- rowid-sync-dialog.tsx
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
|   |   |-- input.tsx
|   |   |-- label.tsx
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
|   |   |   |   |-- mission-005-profils-import/
|   |   |   |   +-- mission-013-historique-rollback-v2/
|   |   |   |-- mission-001-setup-initial.md
|   |   |   |-- mission-002-wizard-import.md
|   |   |   |-- mission-003-api-zoho.md
|   |   |   |-- mission-004-validation-schema.md
|   |   |   |-- mission-004-validation-schema-PAUSE.md
|   |   |   |-- mission-005-profils-import.md
|   |   |   |-- mission-006-COMPLETE.md
|   |   |   |-- mission-006-preview-transformations.md
|   |   |   |-- mission-007-complete.md
|   |   |   |-- mission-007-import-2-phases-rollback.md
|   |   |   |-- mission-008-dashboard-distribution.md
|   |   |   |-- mission-009-transform-source-verite.md
|   |   |   |-- mission-010-ux-transformation-verification.md
|   |   |   |-- mission-011-import-chunks.md
|   |   |   |-- mission-012-verification-rowid.md
|   |   |   |-- mission-013-historique-rollback.md
|   |   |   |-- mission-013-historique-rollback-v2.md
|   |   |   |-- mission-013-historique-rollback-v3.md
|   |   |   |-- mission-013-historique-rollback-v4.md
|   |   |   |-- mission-013-historique-rollback-v5.md
|   |   |   |-- mission-013-historique-rollback-v6.md
|   |   |   |-- mission-014-refactoring-import-wizard.md
|   |   |   |-- mission-015-COMPLETE.md
|   |   |   |-- mission-015-ux-historique.md
|   |   |   |-- mission-016-wizard-persistence.md
|   |   |   |-- mission-017-excel-metadata.md
|   |   |   |-- mission-017-excel-metadata-v2.md
|   |   |   |-- mission-017-excel-metadata-v3.md
|   |   |   |-- mission-017-excel-metadata-v4.md
|   |   |   +-- TEMPLATE-MISSION.md
|   |   |-- base-context.md
|   |   |-- README.md
|   |   +-- zoho-data-retrieval-methods.md
|   |-- image/
|   |   +-- specs-fonctionnelles/
|   |       +-- 1764570677131.png
|   |-- sql/
|   |   |-- 002-user-zoho-tokens.sql
|   |   |-- 003-import-history-rollback.sql
|   |   +-- 004-rowid-sync.sql
|   |-- architecture-cible.md
|   |-- architecture-cible-v3.md
|   |-- doc-session.md
|   |-- project-structure.md
|   |-- resume-ameliorations-csv-zoho-importer.pdf
|   |-- specs-auth-centralisee.md
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
|   |   |-- excel/
|   |   |   |-- date-converter.ts
|   |   |   +-- index.ts
|   |   |-- file-provider/
|   |   |-- history/
|   |   |   |-- index.ts
|   |   |   +-- rollback-rules.ts
|   |   |-- profile/
|   |   |   |-- index.ts
|   |   |   +-- profile-manager.ts
|   |   |-- rollback/
|   |   |   |-- index.ts
|   |   |   |-- rollback-service.ts
|   |   |   +-- types.ts
|   |   |-- rowid-sync/
|   |   |   |-- index.ts
|   |   |   |-- sync-service.ts
|   |   |   +-- types.ts
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
|   |   |   |-- matching-detection.ts
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
|   |-- pdf/
|   |   |-- templates/
|   |   |   +-- bilan-pqs.tsx
|   |   |-- config.ts
|   |   +-- types.ts
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
|   |-- imports.ts
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
