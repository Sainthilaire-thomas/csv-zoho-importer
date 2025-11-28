# 📚 Documentation de Contexte IA

Ce dossier contient les documents nécessaires pour collaborer efficacement avec une IA sur le projet  **CSV to Zoho Analytics Importer** .

---

## 📁 Structure

```
docs/ai-context/
├── README.md                     # Ce fichier
├── base-context.md               # Contexte stable du projet
└── missions/
    ├── TEMPLATE-MISSION.md       # Template pour nouvelles missions
    ├── mission-001-setup-initial.md
    ├── mission-002-xxx.md
    └── ...
```

---

## 🔄 Workflow de Session

### Démarrer une nouvelle session

1. **Uploader les fichiers de contexte** :
   ```
   - base-context.md (toujours)
   - La mission en cours (si continuation)
   - OU décrire la nouvelle mission
   ```
2. **Dire à l'IA** :
   ```
   "Voici le contexte du projet et la mission. On continue/démarre."
   ```
3. **L'IA génère** le fichier mission si nouveau

### Pendant la session

* Travailler de manière itérative
* L'IA a accès au contexte complet
* Demander des clarifications si besoin

### Terminer une session

1. **Dire à l'IA** :
   ```
   "Génère le bilan de cette session"
   ```
2. **L'IA produit** :
   * Résumé du travail accompli
   * Liste des fichiers modifiés
   * Points restants
   * Notes pour la suite
3. **Sauvegarder** le fichier mission mis à jour

---

## 📄 Documents

### base-context.md

**Quand le mettre à jour :**

* Changement de stack technique
* Modification des types fondamentaux
* Évolution de l'architecture
* Ajout de dépendances majeures

**Fréquence** : ~1 fois par semaine ou lors de changements majeurs

### missions/mission-XXX-xxx.md

**Contenu** :

* Objectif de la session
* Fichiers concernés
* Code actuel pertinent
* Actions planifiées
* Bilan en fin de session

**Cycle de vie** :

1. 🆕 Création en début de mission
2. 🔄 Mise à jour pendant la session
3. ✅ Bilan en fin de session
4. 📦 Archivage si terminée

---

## 🚀 Commandes Types

### Début de projet

```
"Voici le base-context.md. Je veux travailler sur [description]. 
Génère le fichier mission."
```

### Reprise de session

```
"Voici base-context.md et mission-XXX.md. On continue."
```

### Fin de session

```
"Génère le bilan de cette session pour mettre à jour le fichier mission."
```

### Mise à jour du contexte

```
"Le projet a évolué. Voici les changements : [description]. 
Mets à jour le base-context.md."
```

---

## 📋 Checklist Nouvelle Session

### Avant la session

* [ ] `base-context.md` à jour
* [ ] Mission précédente complétée ou en pause
* [ ] Objectifs clairs pour la session

### Pendant la session

* [ ] Contexte uploadé à l'IA
* [ ] Travail itératif
* [ ] Notes des décisions importantes

### Après la session

* [ ] Bilan généré
* [ ] Fichier mission mis à jour
* [ ] Code commité
* [ ] Prochaines étapes identifiées

---

## 🏷️ Conventions de Nommage

### Fichiers mission

```
mission-[NNN]-[slug].md

Exemples :
- mission-001-setup-initial.md
- mission-002-validation-engine.md
- mission-003-wizard-import.md
```

### Statuts de mission

* 🆕 Nouvelle
* 🔄 En cours
* ✅ Complétée
* ⏸️ En pause
* ❌ Abandonnée

---

## 📊 Historique des Missions

| #   | Mission       | Statut | Date       | Durée |
| --- | ------------- | ------ | ---------- | ------ |
| 001 | Setup Initial | 🆕     | 2025-11-XX | -      |
| 002 | ...           | ...    | ...        | ...    |

---

## 💡 Bonnes Pratiques

### Pour l'utilisateur

* ✅ Mettre à jour `base-context.md` quand les types changent
* ✅ Nommer les missions de façon descriptive
* ✅ Conserver l'historique pour traçabilité
* ✅ Fournir des specs claires avec critères de succès

### Pour l'IA

* ✅ Demander les fichiers manquants plutôt que deviner
* ✅ Structurer les contextes de façon consistante
* ✅ Résumer le travail en fin de session
* ✅ Identifier clairement les points bloquants

---

*Dernière mise à jour : 17 novembre 2025*
