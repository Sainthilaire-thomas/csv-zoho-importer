
# Mission 002 - Wizard Import CSV

**Statut** : ✅ Complétée
**Date début** : 2025-11-28
**Date fin** : 2025-11-28
**Durée** : 1 session

---

## 🎯 Objectif

Créer un wizard d'import CSV/Excel en 5 étapes avec validation côté client pour importer des fichiers vers Zoho Analytics.

---

## 📋 Spécifications

### Fonctionnelles

- [X] Upload de fichiers CSV et Excel (.xlsx, .xls)
- [X] Support fichiers jusqu'à 200 MB
- [X] Traitement 100% côté client (contourne limite Vercel 4.5 MB)
- [X] Wizard 5 étapes : Source → Config → Validation → Review → Confirm
- [X] Sélection de table Zoho destination
- [X] 5 modes d'import Zoho (append, updateadd, onlyadd, deleteupsert, truncateadd)
- [X] Validation en temps réel avec progression
- [X] Affichage détaillé des erreurs de validation
- [X] Zero data retention (traitement en mémoire uniquement)

### Techniques

- [X] Composants UI réutilisables (Button, Card, Progress, Alert)
- [X] Hook useImport pour gestion d'état avec useReducer
- [X] Hook useCsvParser pour parsing CSV/Excel
- [X] Hook useValidation pour validation côté client
- [X] Moteur de validation extensible avec 4 règles (required, date, number, email)
- [X] API Routes pour intégration Supabase
- [X] Schema Supabase csv_importer avec permissions

---

## 📁 Fichiers créés

### Composants UI (`components/ui/`)

| Fichier          | Description                                                |
| ---------------- | ---------------------------------------------------------- |
| `button.tsx`   | Bouton avec 5 variantes, 3 tailles, loading state          |
| `card.tsx`     | Container avec Header, Title, Description, Content, Footer |
| `progress.tsx` | Barre de progression + StepProgress pour wizard            |
| `alert.tsx`    | Alertes 4 variantes (info, success, warning, error)        |

### Composants Import (`components/import/`)

| Fichier                    | Description                                   |
| -------------------------- | --------------------------------------------- |
| `file-upload.tsx`        | Zone drag & drop, validation type/taille      |
| `table-selector.tsx`     | Dropdown sélection table Zoho avec recherche |
| `validation-results.tsx` | Tableau d'erreurs filtrable et recherchable   |

### Wizard (`components/import/wizard/`)

| Fichier                 | Description                              |
| ----------------------- | ---------------------------------------- |
| `index.ts`            | Exports                                  |
| `import-wizard.tsx`   | Orchestrateur principal                  |
| `wizard-progress.tsx` | Barre de progression 5 étapes           |
| `step-source.tsx`     | Étape 1 - Sélection fichier            |
| `step-config.tsx`     | Étape 2 - Config table + 5 modes import |
| `step-validate.tsx`   | Étape 3 - Validation en cours           |
| `step-review.tsx`     | Étape 4 - Revue résultats              |
| `step-confirm.tsx`    | Étape 5 - Succès                       |

### Hooks (`lib/hooks/`)

| Fichier               | Description                            |
| --------------------- | -------------------------------------- |
| `use-import.ts`     | Gestion état wizard avec useReducer   |
| `use-csv-parser.ts` | Parser CSV (papaparse) et Excel (xlsx) |
| `use-validation.ts` | Validation côté client par chunks    |

### Moteur de validation (`lib/domain/validation/`)

| Fichier               | Description                         |
| --------------------- | ----------------------------------- |
| `index.ts`          | Exports                             |
| `engine.ts`         | Moteur de validation extensible     |
| `rules/base.ts`     | Classe abstraite ValidationRuleBase |
| `rules/required.ts` | Règle champ requis                 |
| `rules/date.ts`     | Règle format date (multi-formats)  |
| `rules/number.ts`   | Règle format nombre                |
| `rules/email.ts`    | Règle format email                 |
| `rules/index.ts`    | Exports règles                     |

### API Routes (`app/api/`)

| Fichier                   | Description                              |
| ------------------------- | ---------------------------------------- |
| `zoho/tables/route.ts`  | GET - Liste tables Zoho depuis Supabase  |
| `csv/validate/route.ts` | POST - Validation CSV (fallback serveur) |
| `csv/import/route.ts`   | POST - Log métadonnées import          |

---

## 📦 Dépendances ajoutées

```json
{
  "xlsx": "^0.18.5"
}
```

---

## 🗄️ Configuration Supabase

### Schema `csv_importer`

Ajouté aux schemas exposés dans les settings API Supabase.

### Permissions SQL exécutées

```sql
GRANT USAGE ON SCHEMA csv_importer TO anon, authenticated;
GRANT SELECT ON csv_importer.zoho_tables TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON csv_importer.validation_rules TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON csv_importer.import_logs TO authenticated;
```

---

## 🧪 Tests effectués

| Test                                        | Résultat   |
| ------------------------------------------- | ----------- |
| Upload fichier CSV                          | ✅ OK       |
| Upload fichier Excel 6.7 MB / 57 790 lignes | ✅ OK (~8s) |
| Sélection table Zoho                       | ✅ OK       |
| 5 modes d'import affichés                  | ✅ OK       |
| Validation côté client                    | ✅ OK       |
| Progression visuelle                        | ✅ OK       |
| Navigation wizard                           | ✅ OK       |
| Dark mode                                   | ✅ OK       |

---

## ⚠️ Limitations actuelles

1. **Import simulé** : L'import vers Zoho Analytics est simulé (log métadonnées uniquement)
2. **Règles de validation** : Pas d'UI pour configurer les règles par table
3. **SFTP** : Bouton présent mais désactivé (non implémenté)
4. **Middleware deprecated** : Next.js 16 avertit de migrer vers proxy.ts

---

## 🔜 Prochaines missions

| Mission       | Description                                    | Priorité  |
| ------------- | ---------------------------------------------- | ---------- |
| **003** | Intégration API Zoho Analytics (import réel) | 🔴 Haute   |
| **004** | Éditeur de règles de validation par table    | 🟡 Moyenne |
| **005** | Connexion SFTP                                 | 🟡 Moyenne |
| **006** | Page Historique des imports                    | 🟢 Basse   |
| **007** | Migration middleware → proxy (Next.js 16)     | 🟢 Basse   |

---

## 📝 Notes techniques

- Traitement 100% côté client pour éviter limite 4.5 MB Vercel Hobby
- Librairie `xlsx` pour parsing Excel côté navigateur
- Validation par chunks avec `await setTimeout(0)` pour ne pas bloquer l'UI
- `useRef` pour éviter double-appel de validation dans StrictMode
- Zero data retention respecté : données en mémoire uniquement

---

*Mission complétée le : 2025-11-28*
