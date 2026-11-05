# Project: SIRH Police Djiboutienne

Système Intranet Centralisé de Gestion des Ressources Humaines réservé à la Police Djiboutienne, 100% en français, professionnel, sécurisé et maintenable, sans fonctionnalités de surveillance, de renseignement ou d'enquête.

---

## Architecture

### 1. Vue d'Ensemble
L'architecture retenue est une architecture **Web Intranet 3-Tiers Centralisée (Option A)** hautement maintenable :
- **Client (Tier 1)** : Navigateur Web standard (Chrome, Firefox, Edge) sur les postes clients autorisés des commissariats et directions. Aucune installation logicielle locale, aucune base de données locale par poste. Interface 100% en français.
- **Serveur d'Application (Tier 2)** : Backend Node.js / TypeScript (Fastify / Express) fournissant les API REST sécurisées, le contrôle d'accès RBAC/ABAC serveur, le moteur de validation de schémas, le générateur de formulaires dynamiques, le moteur de templates de documents et l'audit chaîné SHA-256.
- **Base de Données Centrale (Tier 3)** : Instance relationnelle centrale (PostgreSQL / SQLite sécurisé pour développement et tests unitaires) assurant l'intégrité référentielle stricte, l'historique immuable des affectations (`affectations`), l'étanchéité des dossiers sensibles et le stockage hybride (relationnel + JSONB) pour les champs personnalisés.

### 2. Cloisonnement et Sécurité
- **Séparation stricte des 6 Rôles** :
  1. `admin_technique` : Infrastructure, comptes techniques, sauvegardes/restaurations, audits système. Aucun accès aux dossiers nominatifs RH.
  2. `admin_fonctionnel` : Form Builder, champs personnalisés, listes de valeurs, versioning des configurations, modèles de documents.
  3. `gestionnaire_rh` : Gestion globale des dossiers agents, carrières, soldes, arrêtés de mutation sur l'ensemble de la police.
  4. `chef_service` : Consultation et gestion des agents et plannings de sa propre unité (arborescence descendante stricte).
  5. `agent` : Portail en libre-service (consultation de son propre dossier, soumission de demandes de congés, attestations).
  6. `auditeur` : Consultation en lecture seule des journaux d'audit et registres d'export sans droit de modification.
- **Cloisonnement Disciplinaire et Aptitude** :
  - Les dossiers disciplinaires sont isolés sous une table dédiée avec habilitation explicite de la Direction Générale / Commission.
  - Le module aptitude administrative gère exclusivement les décisions administratives (apte/inapte/aménagé pour service, arme, conduite) à l'exclusion absolue de toute donnée médicale, pathologie ou secret médical.
- **Journal d'Audit Immuable** :
  - Chaque action sensible, connexion, modification de configuration et export de données est journalisée avec horodatage UTC, identifiant de l'opérateur, adresse IP et empreinte cryptographique chaînée SHA-256 (blockchain interne).

---

## Feature Inventory

| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| F01 | Audit et validation technique REA | Analyse environnement, diagnostic Node 20 vs 22+, exécution d'analyse minimale sur démo JS avec preuve cryptographique, rapport docs/00 | M0 | R1 / Survey 1 |
| F02 | Matrice comparative benchmark 7 solutions | Analyse UKG TeleStaff, PowerTime, Crown DMS, InTime, NEOGOV, Softworks, PowerDetails avec statut de preuve explicite | M0 | R2 / Survey 2 |
| F03 | Synthèse bonnes pratiques 10 scénarios policiers | Formalisation des adaptations policières souveraines et fiches benchmark | M0 | R2 / Survey 2 |
| F04 | Cadrage statutaire Police Djiboutienne | Statuts, corps (Officiers, Sous-officiers, Gradés/Agents, Civils), grades, échelons, positions administratives fondés sur Lois 46/AN/04 et 116/AN/21 | M0 | R3 / Survey 2 |
| F05 | Cahier des charges 12 modules et 5 portails | Spécifications fonctionnelles détaillées du SIRH pour la Police Djiboutienne | M0 | R3 / Survey 2 |
| F06 | Registre des hypothèses et paramètres configurables | 15 hypothèses documentées et catalogue de paramètres métier configurables | M0 | R3 / Survey 2 |
| F07 | Spécification architecture, données & sécurité | Rédaction formelle des livrables docs/06, docs/07, docs/08, docs/09 | M0 | R5 / Survey 3 |
| F08 | Authentification renforcée & IAM 6 rôles | Gestion des comptes, sessions sécurisées, tokens, hachage bcrypt, politique de mots de passe, 100% français | M1 | R5 / Survey 3 |
| F09 | Contrôle d'accès serveur RBAC & ABAC Unité | Vérification systématique côté serveur par rôle, périmètre hiérarchique et catégorie de données | M1 | R5 / Survey 3 |
| F10 | Journal d'audit immuable chaîné SHA-256 | Journalisation inaltérable des connexions, modifications de données, configs et exports | M1 | R5 / Survey 3 |
| F11 | Organisation et effectifs policiers | Arborescence des directions, divisions, commissariats, brigades, postes vacants, organigramme | M1 | R3, R6 / Survey 2,3 |
| F12 | Dossier agent & matricule unique | Identité, matricule unique djiboutien, corps, grade, échelon, situation familiale, pièces jointes | M1 | R3, R6 / Survey 2,3 |
| F13 | Historique immuable des affectations & mutations | Table `affectations` append-only, conservation intégrale de l'historique lors de mutations | M1 | R3, R5, R7 / Survey 3 |
| F14 | Form Builder dynamique (6 types de champs) | Ajout/édition de champs personnalisés (texte, date, nombre, liste, case à cocher, pièce jointe), ordre, obligation | M1 | R4 / Survey 3 |
| F15 | Gestion des listes de valeurs éditables | Administration dynamique des grades, unités, motifs, types d'absence | M1 | R4 / Survey 3 |
| F16 | Versioning des configurations & Rollback instantané | Snapshots immuables de configuration RH, historique complet et rollback sans perte de données | M1 | R4 / Survey 3 |
| F17 | Gestion des congés et absences | Types de congés (annuel, maladie ordinaire, maternité, exceptionnel), calcul automatique des droits | M2 | R3, R6 / Survey 2,3 |
| F18 | Circuits de validation hiérarchiques | Circuit Agent -> Chef de service -> Validation RH avec motifs de refus obligatoires | M2 | R3, R6 / Survey 2,3 |
| F19 | Décompte atomique & cohérence des soldes | Prévention stricte des incohérences de soldes après soumission, validation ou annulation | M2 | R7 / Survey 3 |
| F20 | Verrouillage anti-concurrence de validation | Prévention absolue des doubles validations simultanées | M2 | R7 / Survey 3 |
| F21 | Portails utilisateurs par rôle & Tableaux de bord | Vues et portails dédiés (Agent, Chef de service, RH, Admin, Auditeur) avec indicateurs d'effectifs | M2 | R3, R6 / Survey 2,3 |
| F22 | Carrières, avancement d'échelon & promotions de grade | Gestion des échelons à l'ancienneté, tableaux d'avancement au choix, commissions administratives | M3 | R3, R6 / Survey 2,3 |
| F23 | Positions statutaires | Suivi des positions : activité, détachement, disponibilité, congé parental | M3 | R3, R6 / Survey 2,3 |
| F24 | Formations & Qualifications policières | Registre des stages, tirs, habilitations OPJ/APJ, alertes automatiques d'expiration | M3 | R3, R6 / Survey 2,3 |
| F25 | Évaluation annuelle et notation | Fiches de notation périodique, appréciations littérales, entretien annuel | M3 | R3, R6 / Survey 2,3 |
| F26 | Éléments variables de solde & Export sécurisé | Calcul des primes, astreintes, heures de nuit et export sécurisé tracé dans l'audit | M3 | R3, R6, R7 / Survey 2,3 |
| F27 | Planning opérationnel de service & brigades | Gestion des vacations (3x8, 2x12), permanences, astreintes opérationnelles | M4 | R3, R6 / Survey 2,3 |
| F28 | Remplacement d'agents absents | Détection d'absence et affectation de remplaçant qualifié avec contrôle des aptitudes | M4 | R2, R3, R6 / Survey 2 |
| F29 | Module disciplinaire strictement cloisonné | Gestion étanche : allégations, enquêtes administratives internes, commissions de discipline, sanctions | M4 | R3, R5, R6 / Survey 2,3 |
| F30 | Aptitude administrative (sans données médicales) | Décisions administratives d'aptitude (service actif, port d'arme, conduite) garanties sans secret médical | M4 | R3, R5 / Survey 2,3 |
| F31 | Moteur de génération de documents administratifs PDF | Génération automatique d'arrêtés de mutation, attestations de présence, fiches individuelles en français | M4 | R3, R5 / Survey 2,3 |
| F32 | Suite de tests automatisés (10 exigences critiques) | Tests T01 à T10 (accès hors unité, élévation, historique mutation, soldes, concurrence, etc.) | M5 | R7 / Survey 3 |
| F33 | Sauvegarde & Restauration vérifiées | Procédures automatisées de backup chiffré et restauration testée avec vérification d'intégrité | M5 | R5, R7 / Survey 3 |
| F34 | Documentation complète (guides et plans) | Finalisation de docs/10, docs/11, docs/12, docs/13, docs/14 | M5 | R7 / Survey 3 |

---

## Milestones

| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M0 | REA & Benchmark Integration & Cadrage Documentation | Livrables `docs/00` à `docs/09` finalisés, formalisés et validés | none | COMPLETED |
| M1 | Socle Applicatif, Sécurité & Console d'Administration Dynamique (Lot 1) | IAM, RBAC 6 rôles, audit SHA-256, organisation, dossiers agents, affectations immuables, Form Builder dynamique, versioning & rollback | M0 | COMPLETED (PASS unanime) |
| M2 | Congés, Absences, Circuits de Validation & Portails (Lot 2) | Congés, workflows de validation, soldes atomiques, anti-concurrence, portails par rôle et tableaux de bord | M1 | COMPLETED (PASS unanime) |
| M3 | Carrières, Promotions, Formation & Solde (Lot 3) | Avancement, promotions, positions statutaires, qualifications, notation, éléments de solde et exports | M1 | COMPLETED (PASS unanime) |
| M4 | Planning Opérationnel, Discipline Cloisonnée & Documents (Lot 4) | Planning en brigades, remplacements, discipline étanche, aptitude administrative sans données médicales, génération PDF | M1, M2 | COMPLETED (PASS unanime) |
| M5 | Recette E2E, Durcissement & Livraison Finale | Phase 1 (100% tests E2E Tiers 1-4), Phase 2 (Hardening Tier 5), guides docs/10 à docs/14, backup/restore testé | M1, M2, M3, M4 | COMPLETED (PASS unanime) |

---

## Interface Contracts

### Moteur de Métadonnées (Form Builder) ↔ Modules Applicatifs
```typescript
interface ChampPersonnalise {
  id: string;
  cle: string; // ex: 'pointure_chaussure', 'numero_badge'
  libelle: string; // en français
  type_champ: 'texte' | 'date' | 'nombre' | 'liste' | 'booleen' | 'fichier';
  ordre_affichage: number;
  est_obligatoire: boolean;
  est_actif: boolean;
  liste_valeurs_id?: string;
  regles_validation?: Record<string, any>;
}

interface VersionConfiguration {
  version_numero: number;
  champs: ChampPersonnalise[];
  listes_valeurs: Record<string, string[]>;
  cree_par: string;
  cree_le: string;
  commentaire: string;
}
```

### IAM & Sécurité ↔ Contrôleurs HTTP
```typescript
interface SessionUtilisateur {
  utilisateur_id: string;
  matricule: string;
  nom_complet: string;
  role: 'admin_technique' | 'admin_fonctionnel' | 'gestionnaire_rh' | 'chef_service' | 'agent' | 'auditeur';
  unite_id?: string;
  unites_autorisees: string[]; // Arborescence hiérarchique autorisée
}

// Règle d'or : Tout contrôleur vérifie role + périmètre unité côté serveur
```

### Registre des Affectations (Historique Immuable)
```typescript
interface Affectation {
  id: string;
  agent_id: string;
  unite_id: string;
  poste_id: string;
  date_debut: string; // ISO-8601
  date_fin?: string;  // Nullable tant que courante
  est_affectation_courante: boolean;
  motif: string;
  reference_arrete: string;
  cree_par: string;
  cree_le: string;
}
```

---

## Code Layout

```
/root/RH/
├── docs/                             # Documentation officielle complète
│   ├── 00-installation-rea.md        # R1 : Validation et guide REA
│   ├── 01-matrice-comparative.md     # R2 : Matrice comparative des 7 solutions
│   ├── 02-synthese-bonnes-pratiques.md # R2 : Synthèse et recommandations policières
│   ├── 03-cadrage.md                 # R3 : Cadrage statutaire Police Djiboutienne
│   ├── 04-cahier-des-charges.md      # R3 : Cahier des charges 12 modules & 5 portails
│   ├── 05-regles-metier-a-valider.md # R3 : Registre hypothèses & paramètres configurables
│   ├── 06-architecture.md            # R5 : Architecture intranet centralisée
│   ├── 07-modele-de-donnees.md       # R5 : Schéma relationnel 21 tables
│   ├── 08-matrice-habilitations.md   # R5 : Matrice RBAC / ABAC 6 rôles
│   ├── 09-securite.md                # R5 : Politique de sécurité et audit chaîné
│   ├── 10-plan-de-tests.md           # R7 : Plan de tests et recette
│   ├── 11-recette.md                 # R7 : Procès-verbal et critères d'acceptation
│   ├── 12-deploiement.md             # R7 : Guide d'installation et exploitation
│   ├── 13-guide-utilisateur.md       # R7 : Guide utilisateur par rôle (100% français)
│   ├── 14-guide-administration.md    # R7 : Guide admin technique et fonctionnel
│   └── benchmark/                    # Fiches détaillées des 7 solutions
├── src/                              # Code source applicatif
│   ├── config/                       # Configuration applicative et environnement
│   ├── database/                     # Connexion BD, migrations DDL, seeders synthétiques
│   ├── modules/                      # Modules fonctionnels par domaine
│   │   ├── auth/                     # Authentification, sessions, RBAC
│   │   ├── audit/                    # Journal d'audit immuable SHA-256
│   │   ├── admin-console/            # Form Builder, métadonnées, versioning, rollback
│   │   ├── organisation/             # Unités, postes, organigramme
│   │   ├── agents/                   # Dossiers agents, matricule, identité
│   │   ├── affectations/             # Mutations et historique immuable
│   │   ├── conges/                   # Demandes, soldes atomiques, anti-concurrence
│   │   ├── carrieres/                # Échelons, promotions, positions
│   │   ├── formation/                # Stages, qualifications, alertes expiration
│   │   ├── planning/                 # Brigades, vacations, astreintes, remplacements
│   │   ├── discipline/               # Dossiers disciplinaires cloisonnés
│   │   ├── aptitude/                 # Aptitude administrative (sans données médicales)
│   │   ├── solde/                    # Primes, astreintes, exports sécurisés
│   │   └── documents/                # Génération PDF / arrêtés
│   ├── public/                       # Frontend Web intranet (HTML5 / CSS / JS Vanilla / Alpine) 100% français
│   └── server.ts                     # Point d'entrée serveur HTTP centralisé
├── tests/                            # Suite complète de tests automatisés
│   ├── unit/                         # Tests unitaires règles de gestion
│   ├── integration/                  # Tests d'intégration API & sécurité (T01 à T10)
│   ├── e2e/                          # Tests de bout en bout parcours utilisateur
│   └── fixtures/                     # Jeux de données synthétiques fictifs
├── package.json                      # Dépendances Node.js / scripts de build et test
├── tsconfig.json                     # Configuration TypeScript
├── TEST_INFRA.md                     # Index de l'orchestration des tests E2E
└── TEST_READY.md                     # Signal de disponibilité de la suite de tests E2E
```
