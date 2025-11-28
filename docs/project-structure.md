# Structure du projet - csv-zoho-importer

*Genere le 2025-11-28 11:01:35*
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
|   |   |   +-- page.tsx
|   |   |-- settings/
|   |   |   |-- rules/
|   |   |   +-- page.tsx
|   |   +-- layout.tsx
|   |-- api/
|   |   |-- csv/
|   |   |   |-- import/
|   |   |   +-- validate/
|   |   |-- imports/
|   |   |-- rules/
|   |   +-- zoho/
|   |       +-- tables/
|   |-- favicon.ico
|   |-- globals.css
|   |-- layout.tsx
|   +-- page.tsx
|-- components/
|   |-- import/
|   |   +-- wizard/
|   |-- layout/
|   |   |-- header.tsx
|   |   |-- sidebar.tsx
|   |   +-- theme-toggle.tsx
|   |-- rules/
|   |-- ui/
|   +-- theme-provider.tsx
|-- config/
|-- docs/
|   |-- ai-context/
|   |   +-- missions/
|   +-- project-structure.md
|-- lib/
|   |-- domain/
|   |   |-- file-provider/
|   |   +-- validation/
|   |       +-- rules/
|   |-- hooks/
|   |-- infrastructure/
|   |   |-- supabase/
|   |   |   |-- client.ts
|   |   |   +-- server.ts
|   |   +-- zoho/
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
