
# Mission 008 - Distribution Dashboards Zoho Analytics

*Créée le : 2025-12-07*
*Statut : 🔄 En cours*

---

## Objectif

Permettre la distribution de dashboards Zoho Analytics personnalisés aux conseillers RATP :

1. **Affichage iframe** dans portails clients (Zoho Desk)
2. **Génération PDF** pour impression/archivage
3. **Filtrage dynamique** par utilisateur connecté

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
│  ├── /dashboard-test   → Page test iframe/PDF (nouveau)         │
│  └── /historique       → Historique imports (existant)          │
├─────────────────────────────────────────────────────────────────┤
│  API ROUTES                                                     │
│  ├── /api/zoho/dashboard-embed  → Lookup + URL filtrée          │
│  ├── /api/zoho/dashboard-pdf    → Génération PDF (à faire)      │
│  └── /api/zoho/test-private-url → Tests techniques              │
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
                       └──────────────┘
```

---

## Phase A : Affichage Iframe ✅ COMPLÉTÉ

### Objectif

Afficher le dashboard PQS filtré par conseiller dans une iframe.

### Solution technique

1. **Private URL** : URL semi-publique générée par Zoho Analytics
2. **Filtre ZOHO_CRITERIA** : Paramètre URL pour filtrer les données
3. **Lookup agent** : Table `Agents_SC` pour mapper Email → Nom

### Découvertes techniques

#### Scope OAuth correct

```typescript
// ERREUR dans la doc Zoho : "embed.create" n'existe pas
// CORRECT :
export const ZOHO_SCOPES = [
  'ZohoAnalytics.metadata.all',
  'ZohoAnalytics.data.all',
  'ZohoAnalytics.embed.read',   // Lire Private URLs
  'ZohoAnalytics.embed.update', // Créer Private URLs (pas .create!)
] as const;
```

#### Syntaxe ZOHO_CRITERIA

```
?ZOHO_CRITERIA=("NomColonne"='Valeur')
```

* Guillemets doubles `"` pour colonnes
* Guillemets simples `'` pour valeurs string
* URL encoding obligatoire

#### Configuration dashboard

```typescript
const DASHBOARD_CONFIG = {
  workspaceId: '1718953000016707052',  // RATP Réseaux de Bus
  viewId: '1718953000033028262',        // Conseiller PQS 2025
  agentsTableId: '1718953000033132623', // Agents_SC (lookup)
  filterColumn: 'Nom',                  // Colonne de filtrage
  privateUrl: 'https://analytics.zoho.com/open-view/1718953000033028262/2f22f56df5772565ad3c1e7648862c39',
};
```

### Fichiers créés (à intégrer dans Git)

| Fichier source (outputs)      | Destination projet                          | Statut       |
| ----------------------------- | ------------------------------------------- | ------------ |
| `dashboard-test-page.tsx`   | `app/(dashboard)/dashboard-test/page.tsx` | ⏳ À copier |
| `dashboard-embed-route.ts`  | `app/api/zoho/dashboard-embed/route.ts`   | ⏳ À copier |
| `test-private-url-route.ts` | `app/api/zoho/test-private-url/route.ts`  | ⏳ À copier |

**Important** : Ces fichiers ont été générés et testés mais doivent être copiés manuellement dans le repo Git avant commit.

### Flow validé

```
1. Utilisateur saisit email (ex: sandrine.auberger@ratp.fr)
2. API lookup dans Agents_SC → trouve "AUBERGER"
3. Construit URL : privateUrl + ?ZOHO_CRITERIA=("Nom"='AUBERGER')
4. Iframe affiche dashboard filtré ✅
```

---

## Phase B : Génération PDF 📋 À FAIRE

### Objectif

Générer un PDF du bilan PQS avec mise en forme personnalisée.

### Approche retenue

**Reconstruction à partir des données** (pas capture d'écran)

```
1. Récupérer données via API Zoho Analytics (temps réel)
   GET /workspaces/{id}/views/{id}/data avec filtre
   
2. Données en MÉMOIRE uniquement (zero data retention)

3. Générer PDF avec @react-pdf/renderer
   - Header personnalisé
   - KPIs en cards
   - Graphiques (SVG)
   - Tableaux détaillés
   - Footer

4. Retourner PDF en stream (download direct)
```

### Avantages

* ✅ Zero data retention (données en mémoire uniquement)
* ✅ Compatible Vercel Hobby (serverless)
* ✅ Contrôle total du rendu
* ✅ Pas de dépendance externe (Puppeteer/Browserless)
* ✅ Évolutif (facile d'ajouter des widgets)

### Éléments à reproduire (basé sur screenshots dashboard)

#### Section Header

* Bandeau jaune "Bienvenue" + bandeau cyan "Votre Bilan Prime de Qualité de Service 2025"
* Nom agent en bleu : "Mme AUBERGER"
* Filtre "Pde: Tous" (optionnel en PDF)

#### Section KPIs (6 cards) - Valeurs exemple AUBERGER

| Widget                      | Valeur exemple              | Description                     |
| --------------------------- | --------------------------- | ------------------------------- |
| PQS du Trimestre            | 844.22 €                   | Montant prime trimestre courant |
| Proportion Prime            | 71.30%                      | Pourcentage d'atteinte          |
| TOTAL 2025                  | 844.22 €                   | Badge bleu, montant annuel      |
| Total Prime PQS année      | 844.22 €                   | Avec jauge circulaire jaune     |
| Prime Max/Moy/Min (T1-2025) | 306.18 / 281.41 / 266.85 € | Trois valeurs empilées         |
| Total Jours Travaillés     | 148 / 148 jours             | Barre de progression jaune      |

#### Section Graphiques (3 charts)

**1. Primes_PQS_Trim_Conseiller_2025** (Barres simples)

* Axe X : T1-2025, T2-2025, T3-2025
* Axe Y : Total Prime PQS €
* Seuil : ligne orange à 456.00 € (Maxi PQS Dyn)
* Valeurs : 306.18, 271.19, 266.85
* Couleur : barres cyan

**2. Quantité_Trim_Conseiller_2025** (Barres groupées)

* Axe X : T1-2025, T2-2025, T3-2025
* 2 séries : Baromètre Qté 😀 (cyan) + Baromètre Qté ✉️ (jaune)
* Seuil : ligne à 100
* Valeurs cyan : 30, 30, 30, 40
* Valeurs jaune : 55, 55, 40

**3. Qualité_Trim_Conseiller_2025** (Barres groupées)

* Axe X : T1-2025, T2-2025, T3-2025
* 2 séries : Baromètre Qualité 😀 (cyan) + Baromètre Qualité ✉️ (jaune)
* Seuil : ligne à 100
* Valeurs cyan : ~80, 100, 100, 100
* Valeurs jaune : 100, 100, 50

#### Section Footer (à ajouter)

* Mentions légales RATP
* "Document confidentiel - Ne pas diffuser"
* Date/heure génération

### Tables Zoho sources (à investiguer)

Pour la Phase B, il faudra identifier quelles Query Tables alimentent ces widgets :

```
Workspace: RATP Réseaux de Bus (1718953000016707052)
├── Agents_SC (1718953000033132623) → Lookup Email/Nom ✅ Identifié
├── SC_PQS_2025 (?) → KPIs principaux (à identifier)
├── Primes_PQS_Trim_Conseiller_2025 (?) → Graphique 1
├── Quantité_Trim_Conseiller_2025 (?) → Graphique 2
└── Qualité_Trim_Conseiller_2025 (?) → Graphique 3
```

**Action Phase B** : Lister les views du workspace pour trouver les IDs des Query Tables

### Tables Zoho à interroger

```
Workspace: RATP Réseaux de Bus (1718953000016707052)
├── SC_PQS_2025 (Query Table) - Données calculées
├── Agents_SC - Lookup Email → Nom/Matricule
└── [À identifier] - Détails trimestriels Quantité/Qualité
```

### Estimation

* API route `/api/zoho/dashboard-pdf` : 2h
* Template PDF base : 3h
* Graphiques SVG : 4h
* Tests et ajustements : 2h
* **Total : ~11h**

---

## Phase C : Intégration Zoho Desk 📋 FUTUR

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

fetch('https://app.vercel.app/api/zoho/dashboard-embed', {
  method: 'POST',
  body: JSON.stringify({ email: userEmail })
})
.then(r => r.json())
.then(data => {
  document.getElementById('dashboard').innerHTML = 
    `<iframe src="${data.embedUrl}" width="100%" height="600"></iframe>`;
});
```

---

## Fichiers du projet

### Créés (Phase A)

```
app/
├── (dashboard)/
│   └── dashboard-test/
│       └── page.tsx              # Page test iframe
├── api/
│   └── zoho/
│       ├── dashboard-embed/
│       │   └── route.ts          # API lookup + URL
│       └── test-private-url/
│           └── route.ts          # Tests techniques
```

### À créer (Phase B)

```
app/
├── api/
│   └── zoho/
│       └── dashboard-pdf/
│           └── route.ts          # Génération PDF
lib/
├── pdf/
│   ├── templates/
│   │   └── bilan-pqs.tsx         # Template PDF
│   └── components/
│       ├── header.tsx
│       ├── kpi-card.tsx
│       └── bar-chart.tsx
```

---

## Dépendances à ajouter

```bash
npm install @react-pdf/renderer
```

---

## Points de vigilance

### Sécurité

* [ ] Rate limiting sur API (10 req/min par email)
* [ ] Validation format email
* [ ] Headers CORS configurés pour origines autorisées
* [ ] Logs d'accès pour audit

### Performance

* [ ] Cache Private URL (éviter recréation)
* [ ] Timeout génération PDF (< 10s pour Vercel)
* [ ] Streaming PDF (pas buffer complet en mémoire)

### Données

* [ ] Zero data retention respecté
* [ ] Pas de stockage intermédiaire des données PQS

---

## Historique des sessions

### Session 1 - 2025-12-07 (après-midi)

**Travail accompli :**

* ✅ Investigation Private URLs Zoho Analytics
* ✅ Correction scope OAuth (`embed.update` pas `embed.create`)
* ✅ Création API `/api/zoho/dashboard-embed`
* ✅ Création page test `/dashboard-test`
* ✅ Validation lookup Email → Nom agent
* ✅ Validation filtre ZOHO_CRITERIA
* ✅ Affichage iframe fonctionnel avec données

**Découvertes :**

* API Zoho retourne CSV par défaut (pas JSON)
* Filtre doit utiliser `"Nom"` (pas `"Mle"`)
* Erreurs SVG dans console = bugs Zoho (pas notre code)

**Prochaines étapes :**

* Phase B : Génération PDF
* Identifier tables sources pour données détaillées

---

## Commandes utiles

```bash
# Test API lookup
curl -X POST http://localhost:3000/api/zoho/dashboard-embed \
  -H "Content-Type: application/json" \
  -d '{"email": "sandrine.auberger@ratp.fr"}'

# Test Private URL directe
curl "http://localhost:3000/api/zoho/test-private-url?action=get"

# Lister colonnes table
curl "http://localhost:3000/api/zoho/test-private-url?action=columns&viewId=1718953000033132623"
```

---

*Dernière mise à jour : 2025-12-07*
