# Spécifications Fonctionnelles

## Application d'Import CSV vers Zoho Analytics

**Version:** 1.0
**Date:** 17 novembre 2025
**Projet:** Automatisation des imports CSV dans Zoho Analytics

---

## 1. Contexte et Objectifs

### 1.1 Problématique

Actuellement, l'import de fichiers CSV dans Zoho Analytics est un processus manuel, chronophage et source d'erreurs :

- Vérification manuelle des formats de données
- Correction des erreurs une par une dans l'interface Zoho
- Mapping manuel des colonnes à chaque import
- Processus répétitif pour des imports récurrents
- Temps estimé : **18 minutes par import** (6h/mois pour des imports quotidiens)

### 1.2 Objectif du projet

Développer une application web qui automatise et sécurise le processus d'import CSV vers Zoho Analytics, réduisant le temps nécessaire à **3-4 minutes par import** (gain de ~5h/mois par utilisateur).

### 1.3 Contraintes techniques

- **Sécurité prioritaire** : Aucune donnée CSV ne doit être conservée (approche "zero data retention")
- **Source des fichiers** : Système tiers utilisant SFTP, SSH ou SCP uniquement
- **Plateforme** : Application Next.js hébergée sur Vercel
- **Base de données** : Supabase (pour métadonnées uniquement)

---

## 2. Périmètre Fonctionnel

### 2.1 Fonctionnalités Principales (MVP)

#### F1 - Sélection du fichier CSV

**En tant qu'utilisateur**, je veux pouvoir sélectionner un fichier CSV depuis deux sources :

- **Upload direct** : Sélectionner un fichier depuis mon ordinateur
- **Sélection SFTP** : Choisir un fichier déjà présent sur le serveur SFTP

**Critères d'acceptation :**

- Interface simple avec deux options clairement distinctes
- Taille maximale de fichier : 50 MB
- Formats acceptés : .csv uniquement
- Message d'erreur clair si le fichier est invalide

#### F2 - Configuration de l'import

**En tant qu'utilisateur**, je veux configurer les paramètres d'import :

- Sélectionner la **table Zoho Analytics de destination** (liste déroulante)
- Choisir le **mode d'import** :
  - "Ajouter à la fin" (APPEND)
  - "Remplacer tout" (TRUNCATEADD)

**Critères d'acceptation :**

- Liste des tables chargée dynamiquement depuis Zoho Analytics
- Valeurs par défaut intelligentes (dernière table utilisée)
- Confirmation obligatoire pour le mode "Remplacer tout"

#### F3 - Validation automatique des données

**En tant qu'utilisateur**, je veux que mes données soient validées avant l'import pour éviter les erreurs.

**Règles de validation par type de champ :**

- **Dates** : Format DD/MM/YYYY, YYYY-MM-DD ou ISO 8601
- **Nombres** : Valeurs numériques valides, gestion des séparateurs décimaux
- **Emails** : Format email valide (regex)
- **Champs requis** : Vérification de présence
- **Énumérations** : Valeurs dans la liste autorisée
- **Longueur** : Respect des limites de caractères

**Critères d'acceptation :**

- Validation ligne par ligne
- Rapport d'erreurs détaillé avec numéro de ligne et colonne
- Affichage des erreurs AVANT tentative d'import
- Interface permettant de comprendre et corriger rapidement

#### F4 - Formatage automatique

**En tant qu'utilisateur**, je veux que mes données soient automatiquement formatées pour Zoho Analytics.

**Transformations automatiques :**

- Conversion des dates au format attendu par Zoho
- Normalisation des séparateurs décimaux
- Suppression des espaces superflus
- Gestion de l'encodage (UTF-8)
- Mapping automatique des colonnes (mémorisé par table)

**Critères d'acceptation :**

- Aucune intervention manuelle nécessaire pour le formatage
- Configuration des règles de formatage par table
- Prévisualisation des transformations appliquées

#### F5 - Import vers Zoho Analytics

**En tant qu'utilisateur**, je veux que l'import se fasse automatiquement après validation.

**Processus :**

1. Validation réussie
2. Envoi direct vers Zoho Analytics via API
3. Suivi en temps réel de la progression
4. Confirmation de succès avec nombre de lignes importées

**Critères d'acceptation :**

- Gestion des imports par lots pour gros fichiers (>1000 lignes)
- Gestion des erreurs Zoho avec retry automatique
- Rollback en cas d'échec critique
- Durée maximale : 60 secondes

#### F6 - Rapport d'import

**En tant qu'utilisateur**, je veux voir un rapport détaillé après chaque import.

**Informations affichées :**

- Statut : Succès / Échec / Partiel
- Nombre de lignes traitées
- Nombre de lignes importées avec succès
- Liste des erreurs éventuelles (ligne, colonne, erreur)
- Durée du traitement
- Date et heure de l'import

**Critères d'acceptation :**

- Rapport affiché immédiatement après import
- Export du rapport en PDF
- Possibilité de consulter l'historique des rapports

### 2.2 Fonctionnalités Secondaires (Post-MVP)

#### F7 - Gestion des règles de validation personnalisées

**En tant qu'administrateur**, je veux configurer des règles métier spécifiques par table.

**Exemples de règles :**

- "Montant TTC = Montant HT × (1 + Taux TVA)"
- "Code postal cohérent avec ville"
- Détection de doublons sur colonnes spécifiques

#### F8 - Prévisualisation avant import

**En tant qu'utilisateur**, je veux prévisualiser mes données avant import.

**Affichage :**

- Aperçu des 50 premières lignes
- Résumé statistique (nombre de lignes, colonnes)
- Détection automatique des types de données
- Mise en évidence des transformations appliquées

#### F9 - Import programmé

**En tant qu'utilisateur**, je veux planifier des imports automatiques.

**Configuration :**

- Fréquence : quotidienne, hebdomadaire, mensuelle
- Heure d'exécution
- Table source et destination
- Notification par email/Slack en cas d'erreur

#### F10 - Historique et audit

**En tant qu'utilisateur**, je veux consulter l'historique de mes imports.

**Dashboard avec :**

- Liste de tous les imports (filtrables par date, table, statut)
- Statistiques : taux de succès, temps moyen, volume traité
- Possibilité de re-télécharger les rapports d'erreur
- Export CSV de l'historique

#### F11 - Gestion multi-utilisateurs

**En tant qu'administrateur**, je veux gérer les permissions par utilisateur.

**Rôles :**

- **Admin** : Accès complet, configuration des règles
- **Utilisateur** : Import dans tables autorisées
- **Lecture seule** : Consultation de l'historique uniquement

---

## 3. Règles de Gestion

### 3.1 Sécurité et confidentialité

#### RG1 - Zero Data Retention

**Règle :** Aucune donnée contenue dans les fichiers CSV ne doit être conservée par l'application.

**Mise en œuvre :**

- Traitement des données en mémoire uniquement (RAM)
- Transmission directe vers Zoho Analytics sans stockage intermédiaire
- Nettoyage explicite de la mémoire après traitement
- Pas de cache, pas de logs contenant des données sensibles

#### RG2 - Audit et traçabilité

**Règle :** Seules les métadonnées des imports peuvent être conservées.

**Métadonnées autorisées :**

- Identifiant de l'utilisateur
- Nom du fichier (pas son contenu)
- Table de destination
- Nombre de lignes traitées
- Statut de l'import (succès/échec)
- Messages d'erreur génériques
- Date et heure
- Durée du traitement

**Métadonnées interdites :**

- Contenu du CSV (même échantillon)
- Valeurs des champs
- URL de stockage du fichier

#### RG3 - Authentification et autorisation

**Règle :** Tous les utilisateurs doivent être authentifiés via Supabase Auth.

**Vérifications :**

- Token JWT valide pour chaque requête API
- Permissions vérifiées avant chaque import
- Session expirée après 24h d'inactivité

### 3.2 Validation des données

#### RG4 - Validation avant import

**Règle :** Aucun import ne peut être effectué si la validation échoue.

**Process :**

1. Validation complète du fichier
2. Si erreurs détectées : affichage et blocage
3. Si validation OK : import autorisé
4. Pas d'import partiel (tout ou rien par défaut)

#### RG5 - Gestion des erreurs de validation

**Règle :** Les erreurs doivent être claires et actionnables.

**Format des messages d'erreur :**

```
Ligne 47, colonne "email" : Format email invalide
Ligne 89, colonne "date_commande" : Date doit être au format DD/MM/YYYY
Ligne 120, colonne "montant" : Valeur doit être un nombre positif
```

#### RG6 - Seuil d'erreurs acceptable

**Règle :** Configuration optionnelle d'un seuil d'erreurs.

**Options :**

- **Mode strict** (défaut) : 0 erreur tolérée
- **Mode tolérant** : < 5% d'erreurs → import des lignes valides uniquement
- L'utilisateur choisit le mode avant l'import

### 3.3 Performance et limites

#### RG7 - Limites de taille

**Règle :** Limites techniques pour garantir la performance.

**Limites :**

- Taille maximale de fichier : 50 MB
- Nombre maximum de lignes : 100 000 par fichier
- Nombre maximum de colonnes : 100
- Timeout de traitement : 60 secondes

#### RG8 - Traitement par lots

**Règle :** Les gros fichiers sont traités par lots pour éviter les timeouts.

**Configuration :**

- Batch de 1 000 lignes pour l'import vers Zoho
- Feedback en temps réel sur la progression
- Possibilité d'annuler pendant le traitement

### 3.4 Intégration Zoho Analytics

#### RG9 - Configuration Zoho

**Règle :** Connexion à Zoho Analytics via OAuth 2.0.

**Paramètres requis :**

- Client ID et Client Secret
- Workspace ID
- Refresh token stocké de manière sécurisée (Supabase)

#### RG10 - Gestion des erreurs Zoho

**Règle :** Retry automatique en cas d'erreur temporaire.

**Stratégie :**

- 3 tentatives maximum avec backoff exponentiel (1s, 2s, 4s)
- Si échec après 3 tentatives : notification utilisateur
- Erreurs de quota : message spécifique à l'utilisateur

---

## 4. Parcours Utilisateurs

### 4.1 Parcours Principal - Import réussi

```
1. Connexion à l'application (authentification Supabase)
   ↓
2. Page d'accueil avec deux options :
   - "Uploader un fichier CSV"
   - "Choisir depuis le serveur SFTP"
   ↓
3a. [Si upload] : Sélection du fichier local
3b. [Si SFTP] : Affichage de la liste des fichiers disponibles → Sélection
   ↓
4. Configuration :
   - Sélection de la table Zoho de destination
   - Choix du mode d'import (Ajouter / Remplacer)
   ↓
5. Clic sur "Analyser et valider"
   ↓
6. Validation automatique (loader animé)
   ↓
7. Affichage du résultat de validation :
   - ✅ "Validation réussie : 1 247 lignes prêtes à être importées"
   - Prévisualisation (optionnel)
   ↓
8. Clic sur "Importer dans Zoho Analytics"
   ↓
9. Import en cours (barre de progression)
   ↓
10. Rapport de succès :
    - "✅ Import réussi !"
    - "1 247 lignes importées dans la table 'Ventes'"
    - "Durée : 8 secondes"
    - Bouton "Voir dans Zoho Analytics" (lien direct)
    - Bouton "Nouvel import"
```

### 4.2 Parcours Alternatif - Erreurs de validation

```
1-6. [Identique au parcours principal]
   ↓
7. Affichage des erreurs de validation :
   - ⚠️ "3 erreurs détectées sur 1 247 lignes"
   - Liste détaillée :
     • Ligne 47, colonne "email" : Format invalide
     • Ligne 89, colonne "date" : Format attendu DD/MM/YYYY
     • Ligne 120, colonne "montant" : Doit être un nombre
   ↓
8. Options pour l'utilisateur :
   - "Télécharger le rapport d'erreurs" (CSV avec les lignes en erreur)
   - "Corriger et re-uploader"
   - "Annuler"
   ↓
9. Correction du fichier CSV en local
   ↓
10. Retour à l'étape 3 avec le fichier corrigé
```

### 4.3 Parcours Alternatif - Échec de l'import Zoho

```
1-9. [Identique au parcours principal]
   ↓
10. Erreur lors de l'import :
    - ❌ "Échec de l'import"
    - "Erreur : Quota API Zoho dépassé (réessayez dans 1h)"
    - OU "Erreur : Table 'Ventes' introuvable dans Zoho Analytics"
    ↓
11. Options :
    - "Réessayer"
    - "Contacter le support"
    - "Retour à l'accueil"
```

---

## 5. Interfaces Utilisateur

### 5.1 Wireframes des écrans principaux

#### Écran 1 : Page d'accueil

```
┌─────────────────────────────────────────────┐
│  🏠 Accueil          [Historique] [Déconnexion] │
├─────────────────────────────────────────────┤
│                                             │
│     Importer un fichier CSV dans Zoho       │
│                                             │
│  ┌───────────────────────────────────────┐  │
│  │  📤  Uploader un fichier CSV          │  │
│  │                                       │  │
│  │  Glissez un fichier ou cliquez ici   │  │
│  └───────────────────────────────────────┘  │
│                                             │
│                   OU                        │
│                                             │
│  ┌───────────────────────────────────────┐  │
│  │  📁  Choisir depuis le serveur SFTP   │  │
│  └───────────────────────────────────────┘  │
│                                             │
└─────────────────────────────────────────────┘
```

#### Écran 2 : Configuration de l'import

```
┌─────────────────────────────────────────────┐
│  ← Retour                                   │
├─────────────────────────────────────────────┤
│  Fichier sélectionné : ventes_nov_2024.csv │
│  Taille : 2.3 MB • 1 247 lignes             │
│                                             │
│  Table de destination *                     │
│  ┌───────────────────────────────────────┐  │
│  │ Ventes                            ▼  │  │
│  └───────────────────────────────────────┘  │
│                                             │
│  Mode d'import *                            │
│  ○ Ajouter à la fin                         │
│  ○ Remplacer toutes les données             │
│                                             │
│              [Analyser et valider]          │
│                                             │
└─────────────────────────────────────────────┘
```

#### Écran 3 : Résultat de validation (Succès)

```
┌─────────────────────────────────────────────┐
│  Validation terminée                        │
├─────────────────────────────────────────────┤
│                                             │
│  ✅  Validation réussie !                   │
│                                             │
│  • 1 247 lignes analysées                   │
│  • 0 erreur détectée                        │
│  • Prêt pour l'import                       │
│                                             │
│  ┌───────────────────────────────────────┐  │
│  │ 📊 Aperçu des données (50 premières)  │  │
│  │                                       │  │
│  │ [Tableau avec preview]                │  │
│  └───────────────────────────────────────┘  │
│                                             │
│       [Retour]  [Importer dans Zoho]        │
│                                             │
└─────────────────────────────────────────────┘
```

#### Écran 4 : Résultat de validation (Erreurs)

```
┌─────────────────────────────────────────────┐
│  Validation terminée                        │
├─────────────────────────────────────────────┤
│                                             │
│  ⚠️  3 erreurs détectées                    │
│                                             │
│  • 1 247 lignes analysées                   │
│  • 1 244 lignes valides                     │
│  • 3 lignes avec erreurs                    │
│                                             │
│  ┌───────────────────────────────────────┐  │
│  │ Liste des erreurs :                   │  │
│  │                                       │  │
│  │ ❌ Ligne 47 • email                   │  │
│  │    Format email invalide              │  │
│  │                                       │  │
│  │ ❌ Ligne 89 • date_commande           │  │
│  │    Date doit être au format DD/MM/YYYY│  │
│  │                                       │  │
│  │ ❌ Ligne 120 • montant                │  │
│  │    Valeur doit être un nombre positif │  │
│  └───────────────────────────────────────┘  │
│                                             │
│  [📥 Télécharger rapport]  [Retour]         │
│                                             │
└─────────────────────────────────────────────┘
```

#### Écran 5 : Import en cours

```
┌─────────────────────────────────────────────┐
│  Import en cours...                         │
├─────────────────────────────────────────────┤
│                                             │
│  Envoi des données vers Zoho Analytics      │
│                                             │
│  ████████████████░░░░░░░░░░  65%            │
│                                             │
│  810 / 1 247 lignes importées               │
│                                             │
│  Temps écoulé : 5 secondes                  │
│                                             │
│                                             │
│              [Annuler l'import]             │
│                                             │
└─────────────────────────────────────────────┘
```

#### Écran 6 : Rapport de succès

```
┌─────────────────────────────────────────────┐
│  Import terminé                             │
├─────────────────────────────────────────────┤
│                                             │
│  ✅  Import réussi !                        │
│                                             │
│  Résumé :                                   │
│  • 1 247 lignes importées                   │
│  • Table : Ventes                           │
│  • Mode : Ajout à la fin                    │
│  • Durée : 8 secondes                       │
│                                             │
│  ┌───────────────────────────────────────┐  │
│  │  📊 Voir dans Zoho Analytics          │  │
│  └───────────────────────────────────────┘  │
│                                             │
│       [Nouvel import]  [Voir l'historique]  │
│                                             │
└─────────────────────────────────────────────┘
```

### 5.2 Design System

#### Palette de couleurs

- **Primaire** : #3B82F6 (bleu)
- **Succès** : #10B981 (vert)
- **Erreur** : #EF4444 (rouge)
- **Warning** : #F59E0B (orange)
- **Neutre** : #6B7280 (gris)
- **Background** : #F9FAFB (gris très clair)

#### Typographie

- **Titres** : Inter, Bold, 24-32px
- **Sous-titres** : Inter, Semibold, 18-20px
- **Corps** : Inter, Regular, 14-16px
- **Caption** : Inter, Regular, 12px

#### Composants

- **Boutons** : Arrondis (8px), padding 12px 24px
- **Inputs** : Bordure grise, focus bleu, hauteur 48px
- **Cards** : Shadow légère, bordure arrondie 12px
- **Notifications** : Toast en haut à droite, auto-dismiss 5s

---

## 6. Exigences Non Fonctionnelles

### 6.1 Performance

- **Temps de validation** : < 5 secondes pour 10 000 lignes
- **Temps d'import** : < 30 secondes pour 10 000 lignes
- **Chargement de la page** : < 2 secondes
- **Time to Interactive** : < 3 secondes

### 6.2 Disponibilité

- **Uptime** : 99.5% (objectif via Vercel)
- **Maintenance** : Fenêtre hebdomadaire le dimanche 2h-4h

### 6.3 Sécurité

- **HTTPS** : Obligatoire (TLS 1.3)
- **Authentification** : JWT avec expiration
- **Zero data retention** : Aucune donnée CSV conservée
- **Logs** : Métadonnées uniquement, sans données sensibles
- **API Keys** : Stockées dans variables d'environnement sécurisées

### 6.4 Compatibilité

- **Navigateurs** : Chrome, Firefox, Safari, Edge (2 dernières versions)
- **Mobile** : Responsive design, support iOS/Android
- **CSV** : Support UTF-8, UTF-16, encodages principaux

### 6.5 Scalabilité

- **Utilisateurs concurrent** : 50 (phase 1)
- **Imports simultanés** : 10
- **Croissance** : Architecture serverless permettant scale automatique

### 6.6 Conformité

- **RGPD** : Conforme (zero data retention)
- **ISO 27001** : Best practices de sécurité appliquées
- **Audit** : Logs de traçabilité conservés 12 mois

---

## 7. Dépendances et Intégrations

### 7.1 Dépendances externes

#### Zoho Analytics API

- **Documentation** : https://www.zoho.com/analytics/api/
- **Endpoints utilisés** :
  - `POST /api/{workspace-id}/tables/{table-name}/import`
  - `GET /api/{workspace-id}/tables`
  - OAuth 2.0 pour authentification
- **Rate limits** : 200 requêtes/heure
- **Contraintes** : Nécessite workspace-id et table-id

#### Serveur SFTP

- **Protocole** : SFTP/SSH (port 22)
- **Authentification** : Clé SSH ou mot de passe
- **Permissions** : Lecture seule sur dossier spécifique
- **Contraintes** : Connexion depuis IP fixe de préférence

### 7.2 Services tiers

#### Vercel

- **Hosting** : Application Next.js
- **Serverless Functions** : Traitement API
- **Edge Network** : CDN pour assets statiques

#### Supabase

- **Auth** : Authentification utilisateurs
- **Database** : PostgreSQL pour métadonnées
- **Row Level Security** : Sécurité au niveau données

### 7.3 Bibliothèques principales

- **Next.js 14+** : Framework React
- **Papa Parse** : Parsing CSV
- **ssh2-sftp-client** : Connexion SFTP
- **Tailwind CSS** : Styling
- **React Hook Form** : Gestion des formulaires
- **Zod** : Validation des schémas

---

## 8. Plan de Développement

### Phase 1 - MVP (4 semaines)

**Semaine 1 :**

- Configuration projet Next.js + Vercel + Supabase
- Authentification utilisateur
- Interface d'upload de fichier

**Semaine 2 :**

- Parser CSV avec Papa Parse
- Système de validation (règles de base)
- Affichage des erreurs

**Semaine 3 :**

- Intégration Zoho Analytics API
- Import de base (append/replace)
- Gestion des erreurs

**Semaine 4 :**

- Interface complète
- Tests utilisateurs
- Déploiement production

### Phase 2 - Améliorations (3 semaines)

- Connexion SFTP et sélection fichiers
- Règles de validation avancées
- Prévisualisation des données
- Dashboard historique

### Phase 3 - Fonctionnalités avancées (4 semaines)

- Import programmé
- Multi-utilisateurs et permissions
- Notifications email/Slack
- Export rapports PDF

---

## 9. Critères de Succès

### 9.1 Métriques quantitatives

- **Gain de temps** : ≥ 70% de réduction du temps d'import
- **Taux de succès** : ≥ 95% des imports sans erreur
- **Adoption** : 80% des utilisateurs cibles utilisent l'app après 1 mois
- **Satisfaction** : Note ≥ 4/5 dans les feedbacks utilisateurs

### 9.2 Métriques qualitatives

- Réduction significative des erreurs de saisie
- Processus perçu comme simple et intuitif
- Confiance dans la sécurité des données
- Autonomie accrue des utilisateurs

---

## 10. Risques et Mitigations

### Risque 1 : Rate limiting Zoho API

**Impact** : Import échoue pour les utilisateurs fréquents**Probabilité** : Moyenne**Mitigation** :

- Implémenter système de queue avec retry
- Alerter utilisateur si quota proche
- Prévoir upgrade du plan Zoho si nécessaire

### Risque 2 : Fichiers CSV mal formatés

**Impact** : Nombreux échecs de validation**Probabilité** : Élevée**Mitigation** :

- Documentation claire des formats attendus
- Template CSV téléchargeable
- Messages d'erreur très explicites

### Risque 3 : Performance avec gros fichiers

**Impact** : Timeouts sur fichiers > 50 MB**Probabilité** : Faible**Mitigation** :

- Limite stricte à 50 MB
- Traitement par chunks
- Feedback temps réel sur progression

### Risque 4 : Sécurité - accès SFTP compromis

**Impact** : Accès non autorisé aux fichiers**Probabilité** : Faible**Mitigation** :

- Clés SSH avec rotation régulière
- Accès en lecture seule
- Logs d'accès détaillés
- IP whitelisting si possible

### Risque 5 : Changement API Zoho

**Impact** : Breaking changes nécessitant adaptation**Probabilité** : Faible**Mitigation** :

- Monitoring des releases Zoho
- Architecture découplée (adapter pattern)
- Tests automatisés sur intégration

---

## 11. Glossaire

**CSV** : Comma-Separated Values, format de fichier texte pour données tabulaires

**SFTP** : SSH File Transfer Protocol, protocole sécurisé de transfert de fichiers

**Zoho Analytics** : Plateforme BI et analytics de Zoho Corporation

**Workspace** : Espace de travail dans Zoho Analytics contenant tables et rapports

**APPEND** : Mode d'import ajoutant les données à la fin de la table existante

**TRUNCATEADD** : Mode d'import supprimant toutes les données avant ajout

**Zero Data Retention** : Principe de ne conserver aucune donnée utilisateur

**Métadonnées** : Données sur les données (date, taille, statut) sans le contenu

**Rate Limiting** : Limitation du nombre de requêtes API par période

**JWT** : JSON Web Token, standard pour tokens d'authentification

**Row Level Security** : Sécurité au niveau des lignes dans une base de données

**Serverless** : Architecture où le serveur est géré automatiquement par le provider

---

## 12. Annexes

### Annexe A : Exemples de règles de validation

```typescript
// Table "Ventes"
{
  "date_commande": {
    "type": "date",
    "format": "DD/MM/YYYY",
    "required": true,
    "min": "01/01/2020"
  },
  "montant_ht": {
    "type": "number",
    "required": true,
    "min": 0,
    "max": 1000000
  },
  "email_client": {
    "type": "email",
    "required": true
  },
  "statut": {
    "type": "enum",
    "values": ["en_attente", "validee", "livree", "annulee"],
    "required": true
  }
}
```

### Annexe B : Format des logs de métadonnées

```json
{
  "import_id": "uuid-v4",
  "user_id": "uuid-v4",
  "timestamp": "2025-11-17T10:30:00Z",
  "file_name": "ventes_nov_2024.csv",
  "file_size_mb": 2.3,
  "table_name": "Ventes",
  "import_mode": "append",
  "rows_total": 1247,
  "rows_success": 1247,
  "rows_errors": 0,
  "duration_ms": 8340,
  "status": "success",
  "zoho_import_id": "123456789"
}
```

### Annexe C : API Endpoints de l'application

```
POST   /api/auth/login          - Connexion utilisateur
POST   /api/auth/logout         - Déconnexion
GET    /api/sftp/files          - Liste fichiers SFTP
POST   /api/csv/validate        - Valider un CSV
POST   /api/csv/import          - Importer dans Zoho
GET    /api/zoho/tables         - Liste des tables Zoho
GET    /api/imports/history     - Historique des imports
GET    /api/imports/:id         - Détails d'un import
```

---

**Document approuvé par :** [À compléter]
**Date d'approbation :** [À compléter]
**Version :** 1.0
