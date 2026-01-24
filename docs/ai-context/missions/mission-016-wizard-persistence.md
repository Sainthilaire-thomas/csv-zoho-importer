# Mission 016 : Persistance de la Progression du Wizard

*Date de création : 2026-01-24*
*Statut : 📋 À FAIRE*
*Prérequis : Mission 014 (Refactoring Import Wizard) terminée ✅*
*Priorité : Moyenne*
*Durée estimée : 3-4 heures*

---

## 📋 Contexte

Actuellement, quand l'utilisateur navigue vers une autre page (ex: Historique, Paramètres) pendant un import en cours, puis revient sur la page Import, **tout l'état du wizard est perdu**. L'utilisateur doit recommencer depuis le début.

Ce comportement est frustrant, surtout lors des imports en 2 phases où l'utilisateur peut vouloir consulter l'historique avant de confirmer l'import complet.

---

## 🎯 Objectifs

### Objectif 1 : Persister l'état du wizard
- Sauvegarder automatiquement la progression dans `sessionStorage`
- Restaurer l'état au retour sur la page `/import`
- Nettoyer le storage après un import réussi ou un abandon explicite

### Objectif 2 : Gérer les cas limites
- Fichier volumineux : ne pas stocker les données parsées si > 1MB
- Expiration : invalider l'état après X heures
- Fichier modifié : détecter si le fichier source a changé

### Objectif 3 : UX claire
- Indicateur visuel "Progression restaurée"
- Option de "Recommencer à zéro"
- Avertissement si le fichier doit être re-uploadé

---

## 🔧 Analyse technique

### États à persister (depuis `use-import-wizard-state.ts`)

| État | Taille | Persistable | Notes |
|------|--------|-------------|-------|
| `step` (étape courante) | ~20 bytes | ✅ Oui | Priorité haute |
| `file` (métadonnées) | ~200 bytes | ✅ Oui | Nom, taille, lastModified |
| `parsedData` | Variable (KB-MB) | ⚠️ Conditionnel | Si < 1MB |
| `selectedWorkspaceId` | ~50 bytes | ✅ Oui | |
| `selectedTableId` | ~50 bytes | ✅ Oui | |
| `importMode` | ~20 bytes | ✅ Oui | |
| `profileMode` | ~20 bytes | ✅ Oui | |
| `selectedProfile` | ~500 bytes | ✅ Oui | |
| `schemaValidation` | ~1-5 KB | ✅ Oui | |
| `zohoSchema` | ~2-10 KB | ✅ Oui | |
| `resolvedIssues` | ~500 bytes | ✅ Oui | |
| `validation` (résultat) | ~1-5 KB | ✅ Oui | |
| `testResult` | ~2 KB | ✅ Oui | |
| `matchingColumns` | ~200 bytes | ✅ Oui | |
| `verificationColumn` | ~50 bytes | ✅ Oui | |
| `rowIdState` | ~200 bytes | ✅ Oui | |

### Limite sessionStorage
- **Limite navigateur** : ~5-10 MB selon le navigateur
- **Limite pratique** : Viser < 2 MB pour la performance

### Structure de stockage proposée

```typescript
interface WizardPersistedState {
  version: number;  // Pour gérer les migrations
  timestamp: number;  // Date de sauvegarde
  expiresAt: number;  // Expiration (timestamp + 4h)
  
  // Métadonnées fichier (pour vérifier si même fichier)
  file: {
    name: string;
    size: number;
    lastModified: number;
  } | null;
  
  // État du wizard
  step: ImportStatus;
  workspaceId: string;
  tableId: string;
  tableName: string;
  importMode: ImportMode;
  
  // Profil
  profileMode: ProfileMode;
  selectedProfileId: string | null;
  matchingColumns: string[];
  
  // Données (conditionnelles)
  parsedData: Record<string, unknown>[] | null;  // null si trop gros
  parsedDataTooLarge: boolean;
  
  // Validation & Schema
  schemaValidation: SchemaValidationResult | null;
  zohoSchema: ZohoTableSchema | null;
  resolvedIssues: ResolvableIssue[] | null;
  validation: ValidationResult | null;
  
  // Test import
  testResult: TestImportResult | null;
  verificationColumn: string | null;
  
  // RowID
  rowIdState: {
    maxRowIdBeforeTest: number | null;
    rowIdStartForImport: number | null;
    tableName: string | null;
  };
}
```

---

## 📝 Plan d'implémentation

### Sprint 1 : Hook de persistance

Créer `hooks/use-wizard-persistence.ts` :

```typescript
const STORAGE_KEY = 'csv-importer-wizard-state';
const MAX_DATA_SIZE = 1 * 1024 * 1024; // 1MB
const EXPIRATION_HOURS = 4;

export function useWizardPersistence() {
  // Sauvegarder l'état
  const saveState = useCallback((state: WizardPersistedState) => {
    try {
      const serialized = JSON.stringify(state);
      if (serialized.length < 5 * 1024 * 1024) { // < 5MB
        sessionStorage.setItem(STORAGE_KEY, serialized);
      }
    } catch (e) {
      console.warn('[Persistence] Failed to save:', e);
    }
  }, []);

  // Restaurer l'état
  const loadState = useCallback((): WizardPersistedState | null => {
    try {
      const serialized = sessionStorage.getItem(STORAGE_KEY);
      if (!serialized) return null;
      
      const state = JSON.parse(serialized) as WizardPersistedState;
      
      // Vérifier expiration
      if (Date.now() > state.expiresAt) {
        clearState();
        return null;
      }
      
      return state;
    } catch (e) {
      console.warn('[Persistence] Failed to load:', e);
      return null;
    }
  }, []);

  // Nettoyer
  const clearState = useCallback(() => {
    sessionStorage.removeItem(STORAGE_KEY);
  }, []);

  return { saveState, loadState, clearState };
}
```

### Sprint 2 : Intégration dans le wizard

Modifier `import-wizard.tsx` :

1. Au montage, vérifier s'il existe un état persisté
2. Si oui, proposer de restaurer ou recommencer
3. À chaque changement d'étape, sauvegarder l'état
4. Après import réussi ou abandon, nettoyer

### Sprint 3 : Gestion du fichier

Cas où `parsedData` est trop gros :

1. Ne pas stocker `parsedData`
2. Stocker `parsedDataTooLarge: true`
3. Au retour, afficher : "Veuillez re-sélectionner votre fichier pour continuer"
4. Comparer `file.name`, `file.size`, `file.lastModified` pour valider

### Sprint 4 : UI de restauration

Composant `WizardRestorationBanner` :

```tsx
<Alert variant="info">
  <RotateCcw className="h-4 w-4" />
  <AlertTitle>Progression restaurée</AlertTitle>
  <AlertDescription>
    Vous étiez à l'étape "{stepLabels[restoredStep]}" 
    pour le fichier "{fileName}".
    {needsFileReupload && (
      <p>Veuillez re-sélectionner votre fichier pour continuer.</p>
    )}
  </AlertDescription>
  <div className="flex gap-2 mt-2">
    <Button size="sm" onClick={continueFromSaved}>
      Continuer
    </Button>
    <Button size="sm" variant="outline" onClick={startFresh}>
      Recommencer
    </Button>
  </div>
</Alert>
```

---

## 📊 Critères de succès

| Critère | Attendu |
|---------|---------|
| Navigation aller-retour préserve l'état | ✅ |
| Fichiers < 1MB : données préservées | ✅ |
| Fichiers > 1MB : demande re-upload | ✅ |
| Expiration après 4h | ✅ |
| Option "Recommencer" visible | ✅ |
| Nettoyage après import réussi | ✅ |
| Pas de régression sur le wizard | ✅ |

---

## 🔗 Fichiers concernés

| Fichier | Modification |
|---------|--------------|
| `components/import/wizard/hooks/use-wizard-persistence.ts` | **NOUVEAU** - Hook de persistance |
| `components/import/wizard/hooks/index.ts` | Export du nouveau hook |
| `components/import/wizard/import-wizard.tsx` | Intégration persistance |
| `components/import/wizard/wizard-restoration-banner.tsx` | **NOUVEAU** - UI restauration |
| `app/(dashboard)/import/import-page-client.tsx` | Gestion état restauré |

---

## 💡 Notes additionnelles

### Pourquoi sessionStorage et pas localStorage ?

- `sessionStorage` : Effacé à la fermeture du navigateur → pas de données obsolètes
- `localStorage` : Persiste indéfiniment → risque de confusion avec des imports anciens

### Cas particuliers à gérer

1. **Onglet dupliqué** : Chaque onglet a son propre `sessionStorage`, pas de conflit
2. **Refresh page** : `sessionStorage` survit au refresh ✅
3. **Fermeture navigateur** : Données perdues (comportement voulu)

### Étapes critiques où persister

| Étape | Importance | Raison |
|-------|------------|--------|
| Après upload | Haute | Évite re-upload |
| Après profil | Moyenne | Config sauvée |
| Après validation | Haute | Travail de résolution |
| Après test import | **Critique** | Test consommé, rollback nécessaire si perdu |
| Pendant import complet | Non | Import en cours, ne pas interrompre |

### Sécurité

- Aucune donnée sensible dans `sessionStorage` (pas de tokens, pas de credentials)
- Les données CSV sont temporaires et appartiennent à l'utilisateur
- Conformité RGPD : données en mémoire navigateur uniquement, non transmises

---

## 🔄 Dépendances

- Mission 014 (Refactoring) : Structure des hooks en place ✅
- Mission 015 (UX Historique) : Terminée ✅

---

*Mission 016 - Spécification créée le 2026-01-24*
