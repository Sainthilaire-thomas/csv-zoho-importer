# Mission 015 : UX Historique des Imports - TERMINÉE ✅

*Date de création : 2026-01-23*
*Date de clôture : 2026-01-24*
*Statut : ✅ TERMINÉE*
*Durée effective : ~2 heures*

---

## 📋 Résumé

La page Historique (`/history`) affichait tous les enregistrements de la table `import_logs`, créant de la confusion avec les doublons de chunks et les imports test.

---

## ✅ Objectifs atteints

### Objectif 1 : Nettoyer l'affichage
- ✅ Chunks individuels masqués (filtre `chunks_count > 1`)
- ✅ Imports test de 5 lignes masqués
- ✅ Seuls les imports consolidés sont affichés

### Objectif 2 : Distinguer les imports annulés
- ✅ Style visuel différencié (opacité 60%, fond gris)
- ✅ Badge "Import annulé" avec date
- ✅ Nom du fichier barré
- ✅ Toggle "Masquer annulés" / "Voir annulés"

### Objectif 3 : Clarifier le processus d'import
- ✅ Un seul enregistrement par fichier importé
- ✅ Compteur "(dont X annulé(s))" dans le header

---

## 🔧 Modifications effectuées

### Fichiers modifiés

| Fichier | Modification |
|---------|--------------|
| `app/api/imports/route.ts` | Filtre `chunks_count > 1` pour n'afficher que les imports consolidés |
| `components/history/import-list.tsx` | Toggle afficher/masquer annulés + compteur |
| `components/history/import-card.tsx` | Style visuel amélioré pour imports annulés |

### Nettoyage BDD

Suppression de 27 enregistrements obsolètes (chunks et tests) :
```sql
DELETE FROM csv_importer.import_logs
WHERE chunks_count = 1
  AND file_name IN (
    SELECT file_name 
    FROM csv_importer.import_logs 
    WHERE chunks_count > 1
  );
```

---

## 📊 Résultats

### Avant Mission 015
- 32 entrées dans l'historique
- Confusion entre chunks, tests et imports réels
- Imports annulés peu distinguables

### Après Mission 015
- 6 entrées dans l'historique (imports consolidés uniquement)
- Interface claire et compréhensible
- Imports annulés visuellement distincts avec toggle

---

## 🧪 Tests effectués

| Test | Résultat |
|------|----------|
| Import complet de décembre (27 790 lignes) | ✅ |
| Affichage historique filtré | ✅ |
| Toggle annulés fonctionne | ✅ |
| Style import annulé visible | ✅ |
| Sync RowID après import | ✅ |
| Cohérence Supabase/Zoho | ✅ |

### Vérification finale
- Zoho MAX(RowID) : **3 209 939**
- Supabase `import_logs.row_id_after` : **3 209 939**
- Supabase `table_rowid_sync.last_known_rowid` : **3 209 939**

---

## 📝 Notes techniques

### Logique de filtrage
Un import est considéré comme "consolidé" s'il a `chunks_count > 1`, ce qui signifie :
- L'import a été loggué à la fin du processus complet
- Il inclut le total de toutes les lignes importées (test + chunks)

### Chunks individuels
Les chunks individuels (`chunks_count = 1`) ne sont plus loggués séparément depuis la Mission 013. Les anciens enregistrements ont été nettoyés manuellement.

---

## 🔗 Documents liés

- `docs/ai-context/missions/mission-015-ux-historique.md` - Spécification originale
- `docs/ai-context/missions/mission-013-historique-rollback-v6.md` - Mission prérequise

---

*Mission 015 - Clôturée le 2026-01-24*
