# Mission 015 : UX Historique des Imports

*Date de création : 2026-01-23*
*Statut : 📋 À FAIRE*
*Prérequis : Mission 013 (Historique & Rollback) terminée ✅*
*Priorité : Moyenne*
*Durée estimée : 2-3 heures*

---

## 📋 Contexte

La page Historique (`/history`) affiche actuellement tous les enregistrements de la table `import_logs`, ce qui crée plusieurs problèmes d'UX :

1. **Doublons de chunks** : Chaque chunk individuel (5000 lignes) est affiché en plus de l'import consolidé
2. **Import test visible** : L'import test de 5 lignes est affiché alors qu'il fait partie du processus en 2 phases
3. **Imports annulés** : Les imports rollbackés restent affichés sans distinction visuelle claire
4. **Confusion utilisateur** : Difficile de comprendre quel import correspond à quoi

---

## 🎯 Objectifs

### Objectif 1 : Nettoyer l'affichage
- Ne plus afficher les chunks individuels
- Ne plus afficher les imports test de 5 lignes
- Afficher uniquement les imports consolidés (complets)

### Objectif 2 : Distinguer les imports annulés
- Affichage visuel différent pour les imports rollbackés (grisé, barré, ou badge "Annulé")
- Masquer ou réduire visuellement les imports annulés
- Option de filtre pour montrer/cacher les imports annulés

### Objectif 3 : Clarifier le processus d'import
- Un seul enregistrement par fichier importé
- Inclure les infos du test dans l'import principal (optionnel)

---

## 🔧 Solutions techniques

### Solution A : Filtrage côté API (Recommandée)

Modifier `/api/imports/route.ts` pour filtrer les enregistrements :

```typescript
// Filtrer : 
// - chunks_count > 1 (imports consolidés uniquement)
// - OU rows_imported > 5 (exclure les tests de 5 lignes)
const { data, error } = await supabase
  .schema('csv_importer')
  .from('import_logs')
  .select('*', { count: 'exact' })
  .eq('user_id', user.id)
  .or('chunks_count.gt.1,rows_imported.gt.5')  // Exclure chunks et tests
  .order('created_at', { ascending: false })
  .range(offset, offset + limit - 1);
```

**Avantages** : Simple, efficace, pas de changement de schéma
**Inconvénients** : Logique de filtrage dans l'API

### Solution B : Marquage explicite dans la BDD

Ajouter des colonnes pour distinguer les types d'enregistrements :

```sql
ALTER TABLE csv_importer.import_logs 
ADD COLUMN import_type TEXT DEFAULT 'complete';
-- Valeurs possibles : 'test', 'chunk', 'complete'

ALTER TABLE csv_importer.import_logs 
ADD COLUMN parent_import_id UUID REFERENCES csv_importer.import_logs(id);
-- Lier les chunks/tests à l'import parent
```

**Avantages** : Plus propre, requêtes simples
**Inconvénients** : Migration BDD, modification du code d'import

### Solution C : Ne pas logger les chunks/tests

Modifier `use-chunked-import.ts` pour ne logger qu'une seule fois à la fin :

- Supprimer les appels à `/api/imports` dans la boucle des chunks
- Logger uniquement l'import consolidé final
- Ne pas logger l'import test (géré par le wizard)

**Avantages** : Pas de nettoyage nécessaire, données propres
**Inconvénients** : Perte de granularité pour debug

---

## 📝 Plan d'implémentation

### Sprint 1 : Nettoyage BDD existante (optionnel)

```sql
-- Supprimer les entrées de chunks (garder seulement les consolidés)
DELETE FROM csv_importer.import_logs 
WHERE chunks_count = 1 
  AND rows_imported <= 5000
  AND file_name IN (
    SELECT file_name FROM csv_importer.import_logs 
    WHERE chunks_count > 1
  );

-- Supprimer les imports test de 5 lignes
DELETE FROM csv_importer.import_logs 
WHERE rows_imported = 5 
  AND chunks_count = 1;
```

### Sprint 2 : Filtrage API

1. Modifier `/api/imports/route.ts` :
   - Ajouter paramètre `?includeChunks=false` (défaut)
   - Ajouter paramètre `?includeRolledBack=true` (défaut)
   - Filtrer les chunks et tests par défaut

2. Ajouter filtres dans l'UI :
   - Toggle "Afficher les imports annulés"

### Sprint 3 : Affichage imports annulés

1. Modifier `import-card.tsx` :
   - Style distinct pour `rolled_back: true`
   - Badge "Annulé" + date d'annulation
   - Opacité réduite ou fond grisé

2. Modifier `import-list.tsx` :
   - Section séparée ou filtre pour annulés

### Sprint 4 : Correction du logging

1. Modifier `use-chunked-import.ts` :
   - Supprimer le logging par chunk
   - Logger uniquement à la fin de `handleConfirmFullImport`

2. Modifier `use-test-import.ts` :
   - Ne pas logger l'import test (ou le marquer comme `import_type: 'test'`)

---

## 📊 Critères de succès

| Critère | Attendu |
|---------|---------|
| Un fichier = une ligne dans l'historique | ✅ |
| Chunks non visibles | ✅ |
| Tests de 5 lignes non visibles | ✅ |
| Imports annulés distingués visuellement | ✅ |
| Filtre pour montrer/cacher les annulés | ✅ |
| Pas de régression sur le rollback | ✅ |

---

## 🔗 Fichiers concernés

| Fichier | Modification |
|---------|--------------|
| `app/api/imports/route.ts` | Filtrage des résultats |
| `components/history/import-list.tsx` | Filtres UI |
| `components/history/import-card.tsx` | Style imports annulés |
| `components/import/wizard/hooks/use-chunked-import.ts` | Logging unique |
| `components/import/wizard/hooks/use-test-import.ts` | Ne pas logger test |

---

## 💡 Notes additionnelles

### Données actuelles à nettoyer

Exemple de doublons pour "QUITTANCES 12 2025.xlsx" :
- 1 entrée test : 5 lignes, chunks_count: 1
- 6 entrées chunks : 5000 lignes chacune, chunks_count: 1
- 1 entrée consolidée : 27790 lignes, chunks_count: 7

Seule l'entrée consolidée (27790 lignes) devrait être visible.

### Import en 2 phases

Le processus actuel :
1. **Phase test** : Import de 5 lignes → vérification → rollback si erreur
2. **Phase complète** : Import des lignes restantes

L'import test ne devrait pas apparaître dans l'historique car :
- Il fait partie du processus d'import
- Un rollback est déjà possible dans le wizard si échec
- Il n'a pas de valeur pour l'utilisateur dans l'historique

---

*Mission 015 - Spécification créée le 2026-01-23*
