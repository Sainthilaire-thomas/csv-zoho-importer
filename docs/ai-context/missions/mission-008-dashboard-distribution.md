
# Mission 008 - Distribution Dashboards Zoho Analytics

*Créée le : 2025-12-07*
*Dernière mise à jour : 2025-12-08*
*Statut : 🔄 En cours (Phase B terminée)*

---

## Objectif

Permettre la distribution de dashboards Zoho Analytics personnalisés aux conseillers RATP :

1. **Affichage iframe** dans portails clients (Zoho Desk) ✅
2. **Génération PDF** pour impression/archivage ✅
3. **Configuration template** personnalisable ✅
4. **Filtrage dynamique** par utilisateur connecté ✅

---

## Contexte

Les conseillers RATP ont besoin d'accéder à leur bilan PQS (Prime Qualité de Service) 2025 :

* Actuellement via Zoho Analytics (accès direct = trop complexe)
* Besoin : accès simplifié via portail Zoho Desk Help Center
* Besoin : PDF imprimable avec mise en forme professionnelle

**Dashboard cible** : "Conseiller PQS 2025" dans workspace "RATP Réseaux de Bus"

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    csv-zoho-importer (Next.js)                  │
├─────────────────────────────────────────────────────────────────┤
│  INTERFACES                                                     │
│  ├── /import           → Wizard import CSV (existant)           │
│  ├── /dashboard-test   → Page test iframe + PDF ✅              │
│  ├── /pdf-config       → Configuration template PDF ✅          │
│  └── /historique       → Historique imports (existant)          │
├─────────────────────────────────────────────────────────────────┤
│  API ROUTES                                                     │
│  ├── /api/zoho/dashboard-embed  → Lookup + URL filtrée ✅       │
│  ├── /api/zoho/dashboard-pdf    → Génération PDF ✅             │
│  ├── /api/zoho/async-export     → Export async QueryTables ✅   │
│  └── /api/zoho/test-private-url → Tests techniques ✅           │
└─────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
        ┌──────────┐   ┌──────────────┐  ┌──────────┐
        │ Supabase │   │    Zoho      │  │  Zoho    │
        │ - Auth   │   │  Analytics   │  │   Desk   │
        │ - Tokens │   │  - Private   │  │  - Help  │
        │          │   │    URLs      │  │   Center │
        └──────────┘   │  - Data API  │  └──────────┘
                       │  - Bulk API  │
                       └──────────────┘
```

---

## Phase A : Affichage Iframe ✅ COMPLÉTÉ

### Résumé

* Private URL avec filtre ZOHO_CRITERIA
* Lookup agent Email → Nom via table Agents_SC
* Iframe fonctionnelle avec données filtrées

### Découvertes techniques

**Scope OAuth correct** :

```typescript
// ERREUR dans la doc Zoho : "embed.create" n'existe pas
// CORRECT :
export const ZOHO_SCOPES = [
  'ZohoAnalytics.embed.read',   // Lire Private URLs
  'ZohoAnalytics.embed.update', // Créer Private URLs (pas .create!)
] as const;
```

**Syntaxe ZOHO_CRITERIA** :

```
?ZOHO_CRITERIA=("NomColonne"='Valeur')
```

* Guillemets doubles `"` pour colonnes
* Guillemets simples `'` pour valeurs string
* URL encoding obligatoire

### Fichiers créés

* `app/(dashboard)/dashboard-test/page.tsx`
* `app/api/zoho/dashboard-embed/route.ts`
* `app/api/zoho/test-private-url/route.ts`

---

## Phase B : Génération PDF ✅ COMPLÉTÉ

### Résumé

Génération PDF complète du bilan PQS avec :

* KPIs dynamiques (prime trimestre, total annuel, jours travaillés, etc.)
* 3 graphiques barres (primes, quantité, qualité par trimestre)
* Tableau mensuel détaillé
* Interface de configuration personnalisable

### Découverte technique majeure

**QueryTables nécessitent l'API async (Bulk API)** :

* L'export sync standard retourne erreur 8133 pour QueryTables
* Solution : API asynchrone en 3 étapes (create job → poll → download)

```typescript
// Export async pour QueryTables
async exportDataAsync(workspaceId, viewId, options) {
  // 1. Créer le job
  const job = await this.request('GET', `/bulk/workspaces/${workspaceId}/views/${viewId}/data`);
  
  // 2. Polling jusqu'à completion (jobCode 1004)
  while (status !== 'JOB COMPLETED') {
    await this.request('GET', `/bulk/workspaces/${workspaceId}/exportjobs/${jobId}`);
  }
  
  // 3. Télécharger les données
  return await this.request('GET', `/bulk/workspaces/${workspaceId}/exportjobs/${jobId}/data`);
}
```

**Job Codes** :

* 1001 : Job not initiated
* 1002 : In progress
* 1003 : Failed
* 1004 : Completed ✅

### Tables Zoho identifiées

| Table       | ID                  | Type       | Usage                    |
| ----------- | ------------------- | ---------- | ------------------------ |
| Agents_SC   | 1718953000033132623 | Table      | Lookup Email→Nom (sync) |
| SC_PQS_2025 | 1718953000032998801 | QueryTable | Données PQS (async)     |

### Colonnes SC_PQS_2025 utilisées

```
Nom, Mle, Statut, Fct, Pde (période: "01-2025", "T1-2025")
JW Pointés, JW C3T (jours travaillés)
✉ Théorique €, ✉ Réelle € (primes)
Prop. € SC, Prop. € C3T (proportions %)
Moy. Qté ☎, Moy. Qté ✉@ (quantité)
Moy.Qlé ☎, Moy.Qlé ✉@ (qualité)
Bar. Qté ☎, Bar. Qté ✉@, Bar. Qlé ☎, Bar. Qlé ✉@ (barèmes)
```

### Interface de configuration

Page `/pdf-config` permettant de :

* Modifier titre et footer
* Personnaliser les couleurs (primary, secondary, accent, threshold)
* Activer/désactiver sections (KPIs, graphiques, tableau)
* Sélectionner les KPIs à afficher (7 disponibles)
* Choisir les colonnes du tableau mensuel (8 disponibles)
* Prévisualiser le PDF

### Fichiers créés

```
lib/pdf/
├── config.ts                 # Configuration template + labels
├── types.ts                  # Types TypeScript (PQSRow, etc.)
└── templates/
    └── bilan-pqs.tsx         # Template PDF React

app/(dashboard)/
├── dashboard-test/page.tsx   # + bouton téléchargement PDF
└── pdf-config/page.tsx       # Interface configuration

app/api/zoho/
├── dashboard-pdf/route.ts    # Génération PDF
├── async-export/route.ts     # Export async (debug)
├── list-views/route.ts       # Liste views (debug)
└── sql-query/route.ts        # SQL query (debug)
```

### Performance

* Temps génération PDF : **~15 secondes**
* Dont export async Zoho : ~10-12 secondes
* Dont rendu PDF : ~3 secondes

### Dépendances ajoutées

```bash
npm install @react-pdf/renderer
```

---

## Phase C : Intégration Zoho Desk 📋 À FAIRE

### Objectif

Widget dans Zoho Desk Help Center pour afficher iframe/télécharger PDF.

### Prérequis

* Récupérer email utilisateur connecté (JWT Zoho Desk)
* Configurer CORS pour domaine Zoho Desk
* Widget JavaScript custom

### Flow prévu

```javascript
// Widget Zoho Desk
const userEmail = getUserEmailFromJWT();

// Option 1: Iframe
fetch('https://app.vercel.app/api/zoho/dashboard-embed', {
  method: 'POST',
  body: JSON.stringify({ email: userEmail })
})
.then(r => r.json())
.then(data => {
  document.getElementById('dashboard').innerHTML = 
    `<iframe src="${data.embedUrl}" width="100%" height="600"></iframe>`;
});

// Option 2: PDF
fetch('https://app.vercel.app/api/zoho/dashboard-pdf', {
  method: 'POST',
  body: JSON.stringify({ email: userEmail })
})
.then(r => r.blob())
.then(blob => {
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
});
```

---

## Phase D : Améliorations 📋 À FAIRE

### Performance

* [ ] Cache des données agent (éviter lookup répété)
* [ ] Pré-génération PDF en background
* [ ] Streaming PDF (réduire temps de réponse)

### Configuration

* [ ] Sauvegarder config en base Supabase (pas localStorage)
* [ ] Profils de configuration multiples ("Bilan complet", "Résumé rapide")
* [ ] Preview live miniature

### PDF

* [ ] Corriger débordement graphique Qualité (coupé en bas)
* [ ] Améliorer mise en page tableau (éviter débordement 2 pages)
* [ ] Ajouter numéros de page si multi-pages
* [ ] Ajouter valeurs numériques sur barres graphiques

### Fonctionnalités

* [ ] Envoi PDF par email (Phase E potentielle)
* [ ] Génération batch (tous les conseillers)
* [ ] Historique des PDF générés
* [ ] Planification envoi automatique

---

## Historique des sessions

### Session 1 - 2025-12-07 (après-midi) - ~3h

**Travail accompli :**

* ✅ Investigation Private URLs Zoho Analytics
* ✅ Correction scope OAuth (`embed.update` pas `embed.create`)
* ✅ Création API `/api/zoho/dashboard-embed`
* ✅ Création page test `/dashboard-test`
* ✅ Validation affichage iframe avec filtre ZOHO_CRITERIA

**Découvertes :**

* API Zoho retourne CSV par défaut (pas JSON)
* Filtre doit utiliser `"Nom"` (pas `"Mle"`)
* Erreurs SVG dans console = bugs Zoho (pas notre code)

### Session 2 - 2025-12-08 (matin) - ~3h

**Travail accompli :**

* ✅ Découverte limitation export sync pour QueryTables (erreur 8133)
* ✅ Implémentation export async (Bulk API) dans ZohoAnalyticsClient
* ✅ Méthode `exportDataAsync()` avec polling
* ✅ API `/api/zoho/dashboard-pdf` fonctionnelle
* ✅ Template PDF complet (KPIs, 3 graphiques barres, tableau)
* ✅ Bouton téléchargement sur dashboard-test
* ✅ Interface configuration `/pdf-config`
* ✅ Configuration dynamique (couleurs, sections, colonnes, KPIs)
* ✅ Sauvegarde config localStorage

**Commits :**

1. `feat(pdf): génération PDF bilan PQS fonctionnelle`
2. `feat(dashboard-test): ajout bouton téléchargement PDF`
3. `feat(pdf): template bilan PQS style dashboard Zoho`
4. `feat(pdf-config): interface configuration template PDF`

**Durée totale Mission 008 :** ~6h (Phases A+B)

---

## Configuration Dashboard

```typescript
const DASHBOARD_CONFIG = {
  workspaceId: '1718953000016707052',  // RATP Réseaux de Bus
  viewId: '1718953000033028262',        // Conseiller PQS 2025 (dashboard)
  scPqsViewId: '1718953000032998801',   // SC_PQS_2025 (QueryTable)
  agentsTableId: '1718953000033132623', // Agents_SC (lookup)
  filterColumn: 'Nom',                  // Colonne de filtrage
  privateUrl: 'https://analytics.zoho.com/open-view/...',
};
```

---

## Commandes utiles

```bash
# Test API lookup + iframe
curl -X POST http://localhost:3000/api/zoho/dashboard-embed \
  -H "Content-Type: application/json" \
  -d '{"email": "sandrine.auberger@ratp.fr"}'

# Test génération PDF
curl -X POST http://localhost:3000/api/zoho/dashboard-pdf \
  -H "Content-Type: application/json" \
  -d '{"email": "sandrine.auberger@ratp.fr"}' \
  --output bilan-pqs.pdf

# Test export async (debug)
curl "http://localhost:3000/api/zoho/async-export?viewId=1718953000032998801"

# Lister views workspace
curl "http://localhost:3000/api/zoho/list-views"

# Console navigateur - Test PDF
fetch('/api/zoho/dashboard-pdf', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'sandrine.auberger@ratp.fr' })
})
.then(r => r.blob())
.then(blob => {
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
});
```

---

## Points de vigilance

### Sécurité

* [ ] Rate limiting sur API (10 req/min par email)
* [ ] Validation format email
* [ ] Headers CORS configurés pour origines autorisées
* [ ] Logs d'accès pour audit

### Performance

* [X] Export async pour QueryTables
* [ ] Cache Private URL (éviter recréation)
* [ ] Timeout génération PDF (actuellement ~15s, limite Vercel 60s)
* [ ] Streaming PDF (pas buffer complet en mémoire)

### Données

* [X] Zero data retention respecté
* [X] Pas de stockage intermédiaire des données PQS

---

*Dernière mise à jour : 2025-12-08*
