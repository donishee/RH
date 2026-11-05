# SIRH Police Nationale — République de Djibouti
## Direction Générale de la Police Nationale (DGPN)

Système intégré de gestion des ressources humaines régalien, professionnel, sécurisé et souverain, développé exclusivement en français républicain pour l'institution policière djiboutienne.

> **Note déontologique et régalienne** : Ce système est exclusivement dédié à l'administration des carrières, des effectifs, des plannings et des compétences des fonctionnaires de police. Il ne constitue en aucun cas un outil d'enquête judiciaire, de renseignement, de surveillance citoyenne ou de traçage opérationnel.

---

## 1. Vue d'Ensemble & Périmètre Fonctionnel

Le SIRH Police Djiboutienne a été conçu selon les règles statutaires de la Police Nationale (Loi 116/AN/21) et intègre les conclusions d'un benchmarking international approfondi (7 solutions analysées et adaptées) :

### Lot 1 — Socle Applicatif, Sécurité & Console de Paramétrage RH
- **Sécurité & IAM Renforcé** : Modèle hybride RBAC 6 rôles (`ADMIN_TECH`, `ADMIN_FONCT_RH`, `DIRECTEUR_DGPN`, `CHEF_SERVICE`, `GESTIONNAIRE_RH`, `AGENT`) combiné à un contrôle d'accès contextuel ABAC territorial étanche.
- **Dossiers Agents & Affectations** : Gestion des matricules uniques, états civils, fiches individuelles et immuabilité absolue de l'historique d'affectation sans écrasement possible.
- **Console d’Administration Fonctionnelle & Form Builder** : Moteur de formulaires dynamiques permettant à l'administrateur RH de créer/modifier des champs typés (texte, date, nombre, liste déroulante, case à cocher, pièce jointe), de versionner les configurations et d'exécuter des retours arrière (*rollback*) transactionnels sans altérer les données existantes.
- **Étanchéité Médicale DDL** : Interdiction absolue et contraintes SQL rejetant toute intrusion de données médicales ou de diagnostics dans les dossiers RH généraux.

### Lot 2 — Congés, Absences, Circuits de Validation & Portails
- **Gestion des Congés** : 5 typologies de congés statutaires, contrôle automatique du quorum d'effectif minimum opérationnel (40% de présence requise par unité).
- **Double Circuit Hiérarchique** : Visa du Chef d'Unité (N+1) puis validation finale DRH, avec obligation absolue de motif motivé en cas de refus.
- **Verrouillage Anti-Concurrence** : Protection transactionnelle pessimiste (`SELECT ... FOR UPDATE` / HTTP 409) éliminant tout risque de double débit ou de solde négatif.
- **Portails Web Souverains** : 3 interfaces intranet dédiées (Portail Agent, Portail Chef d'Unité, Portail DRH) conçues en HTML5/CSS3 pur sans dépendance externe ni CDN.

### Lot 3 — Carrières, Promotions, Qualifications & Éléments de Solde
- **Carrières & Échelons** : Gestion des grilles indiciaires, avancements à double cadence (ancienneté normale vs grand choix avec note >= 16/20).
- **Promotions de Corps et de Grade** : Tableau annuel des promouvables, décrets de nomination et suivi des 5 positions administratives statutaires (Activité, Détachement, Disponibilité, Sous les drapeaux, Suspension).
- **Qualifications Régaliennes** : Suivi des habilitations judiciaires (OPJ, APJ), des certifications de tir annuel de dotation et alertes prédictives d'expiration (J-60, J-30, J-0).
- **Notations Annuelles (0 à 20.00)** : Évaluation annuelle chiffrée de la manière de servir, avec intercepteur temps réel neutralisant tout vocabulaire médical.
- **Éléments Variables de Solde** : Calcul auditable des sujétions, astreintes et heures de nuit libellées en **Francs Djibouti (DJF)**, avec scellement d'export cryptographique SHA-256.

### Lot 4 — Planning 24/7, Remplacement d'Urgence, Discipline & Actes PDF
- **Planning Opérationnel 24/7** : Cycles de vacations en 3x8, astreintes et permanences avec contrôle algorithmique strict du repos physiologique légal minimum de **11 heures consécutives**.
- **Circuit de Remplacement Armé** : Substitution d'urgence vérifiant obligatoirement la détention d'une qualification de tir valide et l'absence de restriction d'arme active.
- **Sanctuaire Disciplinaire Étanche** : Ségrégation hermétique en 3 phases procédurales (Allégation, Instruction d'enquête interne, Sanction définitive) sous contrôle exclusif du commandement habilité.
- **Moteur PDF Souverain** : Génération instantanée des arrêtés administratifs de nomination et de mutation, scellés cryptographiquement par empreinte SHA-256 dans les journaux d'audit.

---

## 2. Architecture Technique & Sécurité

- **Serveur Backend** : Node.js (v20+) avec Fastify 4 et TypeScript en mode strict.
- **Base de Données** : PostgreSQL 16 (port 5433) avec schémas partitionnés (`iam`, `rh`, `dyn`, `audit`), index partiels temporels et contraintes POSIX anti-médicales.
- **Cryptographie** : Mots de passe hachés sous scrypt, tokens de session sécurisés, scellement d'audit chaîné SHA-256 protégé par verrou exclusif `pg_advisory_xact_lock`.
- **Souveraineté Numérique Totale** : Zéro CDN distant, zéro police externe (Google Fonts banni), interfaces développées en pur HTML5, CSS3 responsive et Vanilla JS.
- **Intégrité Linguistique** : 100% en français républicain validé par linter automatisé (0 anglicisme).

---

## 3. Matrice Documentaire du Projet

L'ensemble des documents de cadrage, d'architecture, de benchmark et d'exploitation sont consignés dans le dossier [`docs/`](docs/) :

| Fichier | Objet et Contenu |
| :--- | :--- |
| [`docs/00-installation-rea.md`](docs/00-installation-rea.md) | Validation de l'environnement REA, découverte des outils et compatibilité Antigravity MCP. |
| [`docs/01-matrice-comparative.md`](docs/01-matrice-comparative.md) | Analyse comparative de 7 solutions du marché (UKG TeleStaff, Crown DMS, InTime, etc.). |
| [`docs/02-synthese-bonnes-pratiques.md`](docs/02-synthese-bonnes-pratiques.md) | Synthèse méthodologique et déclinaison sur les 10 scénarios policiers de référence. |
| [`docs/03-cadrage.md`](docs/03-cadrage.md) | Cadre institutionnel, effectifs et découpage territorial de la Police Djiboutienne. |
| [`docs/04-cahier-des-charges.md`](docs/04-cahier-des-charges.md) | Spécifications fonctionnelles détaillées et exigences régaliennes. |
| [`docs/05-regles-metier-a-valider.md`](docs/05-regles-metier-a-valider.md) | Catalogue des règles de gestion, plafonds d'absence et conditions statutaires. |
| [`docs/06-architecture.md`](docs/06-architecture.md) | Architecture intranet 3-tiers, réseau commissariats, tolérance aux pannes WAN. |
| [`docs/07-modele-de-donnees.md`](docs/07-modele-de-donnees.md) | Modèle physique de données relationnel complet et dictionnaire des tables. |
| [`docs/08-matrice-habilitations.md`](docs/08-matrice-habilitations.md) | Matrice d'habilitation RBAC 6 rôles et règles de filtrage territorial ABAC. |
| [`docs/09-securite.md`](docs/09-securite.md) | Politique de sécurité, durcissement, gestion des secrets et audit cryptographique. |
| [`docs/10-plan-de-tests.md`](docs/10-plan-de-tests.md) | Stratégie d'assurance qualité, banc 4-tiers et traçabilité des exigences R7. |
| [`docs/11-recette.md`](docs/11-recette.md) | Procès-verbal officiel et critères de recette fonctionnelle et de sécurité. |
| [`docs/12-deploiement.md`](docs/12-deploiement.md) | Manuel d'installation, configuration intranet sécurisée et durcissement OS/DB. |
| [`docs/13-guide-utilisateur.md`](docs/13-guide-utilisateur.md) | Guide d'utilisation illustré pour chaque portail (Agent, Chef de service, DRH). |
| [`docs/14-guide-administration.md`](docs/14-guide-administration.md) | Guide d'administration technique et guide fonctionnel RH (Form Builder, listes dynamiques). |
| [`docs/benchmark/`](docs/benchmark/) | 7 fiches individuelles d'analyse technique et fonctionnelle des solutions du marché. |

---

## 4. Résultats des Tests & Assurance Qualité

Le projet intègre une suite de tests automatisée à 4 niveaux :

```
================================================================================
   SUITE DE TESTS INDÉPENDANTE E2E 4-TIERS — SIRH POLICE DJIBOUTIENNE           
   Direction Générale de la Police Nationale (DGPN) — République de Djibouti    
================================================================================
 • Tier 1 (Unitaires F01-F34)   : 204/204 cas passés (100%) — VALIDE
 • Tier 2 (Limites & Sécurité)  :  26/26  cas passés (100%) — VALIDE
 • Tier 3 (Intégration & Flux)  :  10/10  cas passés (100%) — VALIDE
 • Tier 4 (Scénarios Métier)    :  18/18  cas passés (100%) — VALIDE
--------------------------------------------------------------------------------
 TOTAL GLOBAL : 258 tests passés avec succès sur 258 (100% de réussite)
 CONTRÔLES R7 : 10/10 contrôles critiques de sécurité formellement validés
================================================================================
```

Suites de tests complémentaires :
- **Tests d'intégration Fastify M1, M2, M3, M4** : 63 tests API sur base active PostgreSQL (100% passants).
- **Tests adversariaux et de charge** : 47 tests de résistance transactionnelle (`SELECT FOR UPDATE`), TOCTOU et étanchéité territoriale.
- **Sauvegarde et Restauration Chiffrée** : validation du script `backup_restore_audit.test.js` avec sinistre simulé et contrôle d'empreinte SHA-256.

---

## 5. Démarrage Rapide

### Prérequis
- Node.js v20+ et npm v10+
- PostgreSQL 16 configuré (port standard ou 5433)

### Installation & Lancement
```bash
# 1. Cloner le dépôt
git clone git@github.com:donishee/RH.git
cd RH

# 2. Installer les dépendances
npm install

# 3. Compiler le projet TypeScript
npm run build

# 4. Initialiser la base de données (migrations et données de référence)
npm run db:reset

# 5. Exécuter l'ensemble de la suite de tests
npm test

# 6. Démarrer le serveur intranet
npm start
```

L'application est accessible sur `http://localhost:3000` avec les comptes de démonstration suivants :
- **Administrateur Technique** : `admin_tech` / `Police@2026!`
- **Administrateur Fonctionnel RH** : `admin_fonct_rh` / `Police@2026!`
- **Gestionnaire DRH** : `gestionnaire_rh` / `Police@2026!`
- **Chef de Service (Commissariat Central)** : `chef_cc` / `Police@2026!`
- **Agent de Police** : `agent_cc1` / `Police@2026!`
