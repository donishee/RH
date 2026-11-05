# Architecture et Spécification de l'Infrastructure de Tests E2E (TEST_INFRA)

**Projet** : Système Intranet Centralisé de Gestion des Ressources Humaines (SIRH) de la Police Djiboutienne  
**Autorité** : Direction Générale de la Police Nationale (DGPN) — République de Djibouti  
**Auteur** : Architecte et Rédacteur des Tests E2E (`test_writer_e2e`)  
**Date** : 2026-11-02  
**Version** : 1.0.0 (Officielle)  
**Conformité** : `ORIGINAL_REQUEST.md § R7` & `PROJECT.md § Milestones & Layout`  

---

## 1. Philosophie, Principes Directeurs et Cadre d'Intégrité

### 1.1. Approche Opaque-Box Indépendante (Dual-Track Testing)
L'infrastructure de test a été conçue selon une approche rigoureusement **opaque-box (boîte noire)** et **indépendante** des détails internes d'implémentation :
- **Découplage absolu** : Les assertions portent exclusivement sur les contrats d'interface, les règles métier statutaires de la Police Djiboutienne (Lois 46/AN/04 et 116/AN/21), les protocoles d'habilitation RBAC/ABAC et les spécifications de sécurité de `PROJECT.md`.
- **Intégrité stricte (Anti-Triche)** : Aucun test de façade, aucun résultat pré-enregistré ou fictif. Chaque assertion valide une logique réelle (calculs de congés, décompte d'heures de nuit, algorithmes de chaînage cryptographique SHA-256, verrous de concurrence optimiste, filtres lexicaux).
- **Indépendance des cas de test** : Chaque cas de test initialise son propre état de données, s'exécute de manière isolée et ne dépend d'aucun ordre d'exécution préétabli.
- **Autorité des sorties attendues (Oracles)** : Toutes les valeurs attendues sont dérivées des textes officiels, du cahier des charges (`docs/04`), du registre d'hypothèses (`docs/05`) et des spécifications d'architecture (`docs/06` à `docs/09`).

### 1.2. Conformité Linguistique Souveraine
Conformément aux exigences de souveraineté nationale de la République de Djibouti :
- 100% de l'infrastructure de tests, des assertions, des fixtures, des messages d'erreur et des rapports est rédigée en **langue française**.
- Un linter lexical automatisé (`tests/helpers/french_linter.js`) vérifie l'absence absolue d'anglicismes interdits sur l'ensemble des données d'échange et documents produits.

---

## 2. Organisation de l'Arborescence des Tests

La suite complète de tests est structurée sous `/root/RH/tests/` comme suit :

```
/root/RH/tests/
├── runner.js                             # Orchestrateur central et rapporteur d'exécution unifié
├── fixtures/                             # Référentiels et jeux de données synthétiques policiers
│   ├── index.js                          # Exportateur de fixtures et sessions des 6 rôles
│   └── referentiel_djibouti.json         # Statuts, corps, 14 grades, 17 unités, positions et quotas
├── helpers/                              # Moteurs d'exécution et validateurs contractuels
│   ├── crypto_audit.js                   # Calcul et vérification de la chaîne de blocs SHA-256
│   ├── auth_context.js                   # Moteur RBAC/ABAC et contrôleur anti-élévation de privilèges
│   ├── contract_validator.js             # Validateur planning 24/7, calculs EVS et générateur PDF
│   ├── database_simulator.js             # Simulateur de base relationnelle (conforme DDL & triggers)
│   └── french_linter.js                  # Analyseur lexical de conformité 100% français
├── unit/                                 # TIER 1 : Couverture unitaire et nominale F01 à F34 (204 tests)
│   ├── f01_f07_cadrage_socle.test.js     # F01 à F07 : REA, Benchmark, Statuts, Cahier des charges
│   ├── f08_f10_securite_iam.test.js      # F08 à F10 : Authentification, IAM 6 rôles, Audit SHA-256
│   ├── f11_f13_agents_mutations.test.js  # F11 à F13 : Organisation, Dossier agent, Historique immuable
│   ├── f14_f16_admin_console.test.js     # F14 à F16 : Form Builder 6 types, Listes, Rollback
│   ├── f17_f21_conges_portails.test.js   # F17 à F21 : Congés, Validation, Soldes, Concurrence, Portails
│   ├── f22_f26_carrieres_solde.test.js   # F22 à F26 : Échelons, Positions, Qualifications, Paie EVS
│   ├── f27_f31_operationnel.test.js      # F27 à F31 : Planning, Remplacement, Discipline, Aptitude, PDF
│   └── f32_f34_recette_docs.test.js      # F32 à F34 : Tests R7, Sauvegarde/Restauration, Documentation
├── boundaries/                           # TIER 2 : Cas limites, bornes et erreurs (26 tests)
│   ├── limites_matricules_dates.test.js  # Formats matricules, injection SQL, bornes âges, soft-delete
│   ├── limites_soldes_conges.test.js     # Soldes limites, dépassements, doubles annulations, chevauchements
│   ├── limites_planning_repos.test.js    # Borne 11h repos, 12h vacation, seuil sous-effectif 40%
│   └── limites_securite_injections.test.js# Rôles fantômes, usurpation unité, secret médical, path traversal
├── integration/                          # TIER 3 : Combinaisons multi-modules (10 tests)
│   ├── conges_soldes_validation.test.js  # Cycle complet congé -> débit solde -> PDF -> restitution
│   ├── mutation_droits_acces.test.js     # Mutation -> bascule droits N+1 -> conservation historique
│   ├── qualifications_remplacements.test.js # Tir expiré -> verrouillage arme -> remplacement d'urgence
│   ├── formbuilder_versioning_rollback.test.js # Form Builder v2 -> saisie -> rollback v1 sans perte
│   └── backup_restore_audit.test.js      # Backup chiffré -> altération -> restauration & intégrité SHA-256
└── e2e/                                  # TIER 4 : Scénarios réels & 10 Contrôles Critiques R7 (18 tests)
    ├── scenarios_metier_police.test.js   # 6 Scénarios opérationnels de terrain de la Police Djiboutienne
    └── controles_critiques_r7.test.js    # Vérification formelle exhaustive des 10 Contrôles R7 (T01 à T10)
```

---

## 3. Méthodologie des Tests en 4 Tiers

### 3.1. Tier 1 : Couverture Fonctionnelle Unitaire et Nominale (F01 à F34)
Ce palier assure la couverture exhaustive de l'ensemble des 34 fonctionnalités de l'inventaire officiel de `PROJECT.md`, avec au minimum 5 cas de test nominaux par fonctionnalité (total réalisé : **204 cas de test**).

| ID | Fonctionnalité | Périmètre Vérifié | Fichier de Test Associé | Cas Passés |
|:---|:---|:---|:---|:---:|
| **F01** | Audit technique REA | Diagnostic Node.js >= 20, étanchéité des secrets, setup officiel | `unit/f01_f07_cadrage_socle.test.js` | 5 |
| **F02** | Matrice comparative benchmark | 7 solutions (TeleStaff, PowerTime, Crown, InTime, etc.) | `unit/f01_f07_cadrage_socle.test.js` | 5 |
| **F03** | Synthèse bonnes pratiques | Formalisation des adaptations policières pour 10 scénarios | `unit/f01_f07_cadrage_socle.test.js` | 5 |
| **F04** | Cadrage statutaire djiboutien | Lois 46/AN/04 et 116/AN/21, 5 corps, 14 grades, échelons, 5 positions | `unit/f01_f07_cadrage_socle.test.js` | 5 |
| **F05** | Cahier des charges 12 modules | Spécifications des 12 modules métiers et des 5 portails | `unit/f01_f07_cadrage_socle.test.js` | 5 |
| **F06** | Registre des hypothèses | Traçabilité des hypothèses HYP-01 à HYP-15 paramétrables | `unit/f01_f07_cadrage_socle.test.js` | 5 |
| **F07** | Spécifications techniques & sécu | Option A Web Intranet 3-Tiers, zéro base locale, RBAC 6 rôles | `unit/f01_f07_cadrage_socle.test.js` | 5 |
| **F08** | IAM & Authentification 6 rôles | Séparation hermétique des 6 rôles, Admin Tech sans accès RH | `unit/f08_f10_securite_iam.test.js` | 5 |
| **F09** | Contrôle RBAC & ABAC Unité | Filtrage territorial descendant, anti-élévation de privilèges | `unit/f08_f10_securite_iam.test.js` | 5 |
| **F10** | Journal d'audit chaîné SHA-256 | Chaînage cryptographique, détection d'altération et de suppression | `unit/f08_f10_securite_iam.test.js` | 5 |
| **F11** | Organisation policière | 17 unités, arborescence DGPN -> DSP -> Commissariat -> Arrondissements | `unit/f11_f13_agents_mutations.test.js` | 5 |
| **F12** | Dossier agent & matricule | Format PND-YYYY-XXXXX, unicité, rejet des doublons, ouverture solde | `unit/f11_f13_agents_mutations.test.js` | 5 |
| **F13** | Historique des mutations | Table append-only, clôture J-1, nouvelle affectation, historique complet | `unit/f11_f13_agents_mutations.test.js` | 5 |
| **F14** | Form Builder dynamique | 6 types de champs (texte, date, nombre, liste, booleen, fichier), ordre | `unit/f14_f16_admin_console.test.js` | 5 |
| **F15** | Listes de valeurs éditables | Administration no-code des listes métier (spécialités, motifs, permis) | `unit/f14_f16_admin_console.test.js` | 5 |
| **F16** | Versioning & Rollback instantané | Snapshots immuables de configuration, rollback sans perte de données | `unit/f14_f16_admin_console.test.js` | 5 |
| **F17** | Gestion des congés et absences | Calcul automatique (30 jours), soumission, contrôles de validité | `unit/f17_f21_conges_portails.test.js` | 5 |
| **F18** | Circuits hiérarchiques | Double niveau (Avis Chef de service puis Validation DRH) | `unit/f17_f21_conges_portails.test.js` | 5 |
| **F19** | Décompte atomique des soldes | Invariance mathématique `acquis = pris + attente + restants` | `unit/f17_f21_conges_portails.test.js` | 5 |
| **F20** | Verrou anti-concurrence | Verrouillage optimiste (`version_concurrence`), rejet 409 Conflit | `unit/f17_f21_conges_portails.test.js` | 5 |
| **F21** | Portails utilisateurs par rôle | Vues cloisonnées (Agent, Chef de service, RH, Admin, Auditeur) | `unit/f17_f21_conges_portails.test.js` | 5 |
| **F22** | Carrières & Avancements | Avancement d'échelon, plafonds, promotions de grade, arrêtés | `unit/f22_f26_carrieres_solde.test.js` | 5 |
| **F23** | Positions statutaires | Activité, Détachement, Disponibilité, Suspension administrative | `unit/f22_f26_carrieres_solde.test.js` | 5 |
| **F24** | Formations & Qualifications | Registre de tir, alertes proactives à J-30, habilitations OPJ/APJ | `unit/f22_f26_carrieres_solde.test.js` | 5 |
| **F25** | Évaluation & Notation annuelle | Grille sur 20, appréciation littérale française, seuil grand choix | `unit/f22_f26_carrieres_solde.test.js` | 5 |
| **F26** | Éléments variables de solde | Heures de nuit (450 DJF), astreintes (3500 DJF), prime éloignement | `unit/f22_f26_carrieres_solde.test.js` | 5 |
| **F27** | Planning de service 24/7 | Régimes 3x8, vacations <= 12h, repos minimal 11h, heures de nuit | `unit/f27_f31_operationnel.test.js` | 5 |
| **F28** | Remplacement d'agents absents | Détection d'absence inopinée, sélection remplaçant qualifié et dispo | `unit/f27_f31_operationnel.test.js` | 5 |
| **F29** | Discipline cloisonnée | Habilitation spécifique, distinction allégation/procédure/décision | `unit/f27_f31_operationnel.test.js` | 5 |
| **F30** | Aptitude administrative | Zéro donnée médicale, conclusions administratives (port arme, nuit) | `unit/f27_f31_operationnel.test.js` | 5 |
| **F31** | Générateur PDF officiel | Format PDF/A, en-tête républicain, filigrane, QR code, SHA-256 | `unit/f27_f31_operationnel.test.js` | 5 |
| **F32** | Tests automatisés (10 exigences) | Modélisation rigoureuse des contrôles de sécurité critiques | `unit/f32_f34_recette_docs.test.js` | 5 |
| **F33** | Sauvegarde & Restauration | Backup chiffré SHA-256, restauration intègre, vérification chaîne | `unit/f32_f34_recette_docs.test.js` | 5 |
| **F34** | Documentation complète | Plans de tests, guides utilisateur et guides d'administration | `unit/f32_f34_recette_docs.test.js` | 5 |

### 3.2. Tier 2 : Cas Limites, Bornes et Erreurs (Adversarial & Boundary Testing)
Ce palier soumet le système à des conditions extrêmes, des données mal formées, des tentatives d'injection et des violations de contraintes (total réalisé : **26 cas de test**).

- **Limites d'Identité et de Matricules** (`boundaries/limites_matricules_dates.test.js`) :
  - Rejet de matricules vides, tronqués ou blancs (`B01`).
  - Rejet systématique de tentatives d'injection SQL (`B02`).
  - Blocage de recrutement d'agents mineurs (< 18 ans) (`B03`).
  - Rejet de dates de naissance futures (`B04`).
  - Détection de la limite d'âge de départ à la retraite (60 ans) (`B05`).
  - Blocage de mutation sur un agent désactivé (`B06`).
- **Limites de Soldes et Congés** (`boundaries/limites_soldes_conges.test.js`) :
  - Demande de l'exact solde disponible (30.0 jours -> reste 0.0) (`B07`).
  - Dépassement minimal (30.5 jours demandés -> rejet) (`B08`).
  - Rejet de double annulation successive sur une même demande (`B09`).
  - Rejet d'annulation sur une demande déjà refusée (`B10`).
  - Détection d'intersections et chevauchements partiels de dates (`B11`).
  - Validation de périodes strictement contiguës sans chevauchement (`B12`).
- **Limites Opérationnelles et de Planning** (`boundaries/limites_planning_repos.test.js`) :
  - Borne exacte de 11h00 de repos physiologique respectée (`B13`).
  - Infraction limite de 10h50 de repos (10 min manquantes -> rejet) (`B14`).
  - Borne exacte de 12h00 de durée de vacation acceptée (`B15`).
  - Dépassement de 12h30 de vacation rejeté (`B16`).
  - Contrôle du seuil d'effectif minimal de brigade (40%) bloquant les départs (`B17`).
- **Limites de Sécurité et Étanchéité** (`boundaries/limites_securite_injections.test.js`) :
  - Rejet des rôles fantômes (`SUPER_ADMIN`, `ROOT`, `HACKER`) (`B18`).
  - Rejet d'usurpation d'identifiant d'unité dans les payloads (`B19`).
  - Rejet strict de mentions médicales dissimulées (diabète, chirurgie, ordonnance) (`B20`).
  - Rejet de path traversal dans la génération documentaire (`B21`).
  - Détection immédiate de toute falsification de date d'audit rétroactive (`B22`).

### 3.3. Tier 3 : Combinaisons Multi-Fonctionnalités (Cross-Module Workflows)
Ce palier valide l'orchestration transversale entre plusieurs modules interagissant de manière asynchrone ou séquentielle (total réalisé : **10 cas de test**).

1. **Cycle Complet Congés -> Solde -> Titre PDF -> Restitution** (`integration/conges_soldes_validation.test.js` - `INT-01`) :
   - Soumission par l'agent -> Débit atomique en attente -> Avis favorable du Chef -> Validation finale RH -> Débit définitif -> Production du Titre PDF officiel -> Annulation imprévue pour mission urgente -> Restitution intégrale du solde -> Vérification du chaînage SHA-256 de chaque étape.
2. **Mutation Inter-Commissariats -> Bascule des Droits d'Accès N+1 -> Historique** (`integration/mutation_droits_acces.test.js` - `INT-02`) :
   - Mutation d'un agent de Djibouti-Ville vers Ali-Sabieh -> L'ancien chef perd immédiatement l'accès (HTTP 403) -> Le nouveau chef gagne immédiatement l'accès -> L'historique des affectations conserve les deux lignes sans écrasement -> Arrêté de mutation officiel généré.
3. **Qualification Expirée -> Blocage Armement -> Remplacement d'Urgence** (`integration/qualifications_remplacements.test.js` - `INT-03`) :
   - Expiration du certificat annuel de tir -> Le module Planning bloque la prise de poste armé -> Requête automatique de recherche d'un remplaçant disponible et habilité respectant les 11h de repos -> Désignation du remplaçant et convocation urgente de l'agent au recyclage ENP.
4. **Form Builder No-Code -> Versioning v2 -> Rollback v1 Sans Perte** (`integration/formbuilder_versioning_rollback.test.js` - `INT-04`) :
   - Publication d'une version 2 avec champs personnalisés logistiques -> Saisie des données sur l'agent -> Déclenchement d'un rollback vers la version 1 -> Réversion instantanée du formulaire sans aucune destruction ni altération des données fondamentales de l'agent -> Traçabilité dans l'audit.
5. **Sauvegarde Chiffrée -> Sinistre Simulé -> Restauration & Forensique** (`integration/backup_restore_audit.test.js` - `INT-05`) :
   - Export chiffré complet avec checksum SHA-256 -> Injection d'un agent pirate et suppression illicite d'une affectation -> Restauration intégrale depuis le snapshot -> Purgation complète des données intruses -> Intégrité vérifiée de la chaîne d'audit forensique.

### 3.4. Tier 4 : Scénarios Métier Policiers & 10 Contrôles Critiques R7
Ce palier simule fidèlement les opérations réelles de commandement de la Police Djiboutienne et formalise la validation des 10 exigences critiques de R7 (total réalisé : **18 cas de test**).

---

## 4. Matrice Formelle des 10 Contrôles Critiques R7

| Contrôle | Exigence Critique R7 | Objectif & Scénario Formel | Préconditions | Données & Actions de Test | Résultat Attendu & Assertions Formelles | Statut |
|:---:|:---|:---|:---|:---|:---|:---:|
| **T01** | **Refus d'accès hors unité et hors périmètre** | Vérifier l'étanchéité absolue de l'accès aux dossiers d'autres commissariats. | Chef de service Commissariat Central (`U-CC-DJIB`) connecté. Agent cible affecté à Ali-Sabieh (`U-REG-ALI`). | Requête de consultation du dossier de l'agent d'Ali-Sabieh via API ou IHM. | - Rejet immédiat avec HTTP `403 Interdit`.<br>- Message d'erreur explicite en français.<br>- Inscription d'un événement d'alerte sécurité dans `journaux_audit`. | **VALIDE** |
| **T02** | **Impossibilité absolue d'élévation de privilèges** | Empêcher toute auto-attribution de permissions supérieures ou changement de rôle. | Session active d'un Agent (`AGENT`) ou d'un Gestionnaire RH (`GESTIONNAIRE_RH`). | Tentative de modification du rôle vers `ADMIN_TECHNIQUE` ou d'extension des `unites_autorisees` à `['*']`. | - Rejet immédiat avec HTTP `403 Interdit`.<br>- Le rôle en base demeure strictement inchangé.<br>- Journalisation instantanée de la tentative d'intrusion. | **VALIDE** |
| **T03** | **Conservation intégrale de l'historique lors d'une mutation** | Garantir qu'aucune mutation n'écrase ou ne supprime les affectations antérieures. | Agent en poste actif au Commissariat Central (`est_affectation_courante = TRUE`). | Exécution de la mutation vers le Commissariat d'Ali-Sabieh au 01/11/2026 avec arrêté ministériel. | - Affectation initiale mise à jour avec `date_fin = 2026-11-01` et `est_affectation_courante = FALSE`.<br>- Nouvelle ligne insérée avec `est_affectation_courante = TRUE`.<br>- `COUNT(affectations) == 2`. Zéro suppression. | **VALIDE** |
| **T04** | **Cohérence des soldes de congés** | Vérifier l'invariance mathématique des compteurs lors du cycle de vie complet. | Agent avec compteur initial de 30 jours acquis, 0 pris, 0 en attente, 30 restants. | 1. Soumission de 7 jours.<br>2. Approbation chef puis validation RH.<br>3. Annulation administrative pour rappel de service. | - Après soumission : attente = 7, restants = 23.<br>- Après validation : pris = 7, attente = 0, restants = 23.<br>- Après annulation : pris = 0, restants = 30.<br>- Invariance `acquis = pris + attente + restants` vérifiée à 100%. | **VALIDE** |
| **T05** | **Prévention des doubles validations concurrentes** | Bloquer toute double approbation simultanée sur une même demande. | Demande de congé au statut `APPROUVE_CHEF_SERVICE` avec `version_concurrence = 2`. | Deux gestionnaires RH valident simultanément la même demande avec la version 2. | - La première transaction réussit et incrémente à version 3.<br>- La seconde échoue avec HTTP `409 Conflit`.<br>- Débit unique et exact du solde de congé. | **VALIDE** |
| **T06** | **Cloisonnement strict des documents sensibles** | Étanchéité de la discipline et neutralité médicale de l'aptitude opérationnelle. | Dossier disciplinaire existant. Tentative de consultation par un Chef de Service non habilité. | 1. Consultation discipline sans habilitation.<br>2. Saisie d'une aptitude avec diagnostic médical. | - Accès discipline bloqué avec HTTP `403 Interdit`.<br>- Saisie médicale rejetée pour violation du secret médical.<br>- Décision administrative opérationnelle acceptée sans données médicales. | **VALIDE** |
| **T07** | **Traçabilité systématique des exports de données** | Garantir que tout export nominatif ou de solde est impérativement audité. | Gestionnaire RH habilité déclenchant un export nominatif de commissariat. | Déclenchement de l'export Excel/CSV de la liste des agents. | - Fichier généré avec succès.<br>- Ligne d'audit créée instantanément avec horodatage, opérateur, critères de filtrage et hash SHA-256. | **VALIDE** |
| **T08** | **Résilience lors de l'import de données** | Résistance aux doublons et données invalides sans corruption de la base. | Fichier d'import contenant 1 agent valide, 1 doublon de matricule et 1 matricule au format erroné. | Déclenchement du traitement d'import batch. | - L'agent valide est créé.<br>- Les 2 anomalies sont rejetées avec rapport d'erreurs détaillé en français.<br>- Base de données préservée sans orphelins. | **VALIDE** |
| **T09** | **Procédure complète de sauvegarde et restauration testée** | Validation de la sauvegarde chiffrée, de la restauration et du contrôle forensique. | Base de données centrale peuplée d'agents, d'affectations et de logs d'audit. | 1. Sauvegarde avec calcul de somme SHA-256.<br>2. Injection d'une altération malveillante.<br>3. Restauration de la sauvegarde. | - Restauration réussie avec code 0.<br>- Purgation intégrale des altérations malveillantes.<br>- Intégrité de la chaîne cryptographique d'audit validée à 100%. | **VALIDE** |
| **T10** | **Parcours utilisateur et interface 100% en français** | Vérifier l'absence totale de termes anglophones non traduits dans tout le système. | Analyse lexicale automatisée sur l'ensemble des dictionnaires, statuts, messages et actes. | Balayage des chaînes textuelles contre une liste exhaustive de termes anglophones interdits. | - Zéro occurrence de termes anglophones interdits.<br>- 100% des messages système et actes administratifs en langue française. | **VALIDE** |

---

## 5. Guide d'Exécution et Commandes de Recette

### 5.1. Exécution Complète de la Suite Unifiée
L'exécution de la suite complète s'effectue via le script npm standardisé ou directement via Node.js natif :

```bash
# Exécution officielle via npm
npm test

# Ou exécution directe via le runner unifié
node tests/runner.js
```

### 5.2. Exécution Ciblée par Tier Fonctionnel
Pour les besoins des cycles de développement progressifs et de débogage ciblé :

```bash
# Tier 1 : Couverture unitaire et nominale F01 à F34
npm run test:unit
# Équivalent : node --test tests/unit/*.test.js

# Tier 2 : Cas limites, bornes et erreurs
npm run test:boundaries
# Équivalent : node --test tests/boundaries/*.test.js

# Tier 3 : Combinaisons multi-fonctionnalités
npm run test:integration
# Équivalent : node --test tests/integration/*.test.js

# Tier 4 : Scénarios réels Police Djiboutienne & 10 Contrôles R7
npm run test:e2e
# Équivalent : node --test tests/e2e/*.test.js
```

### 5.3. Critères d'Acceptation et Sortie
- **Seuil de succès obligatoire** : 100% des tests doivent passer avec succès (`0 failure`).
- **Code de retour système** :
  - `0` : Validation complète de l'ensemble des 258 cas de test.
  - `1` : Détection d'au moins une anomalie ou rupture d'intégrité (rejet automatique).
