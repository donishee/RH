# Plan Stratégique de Tests et d'Assurance Qualité Logicielle (R7)

**République de Djibouti**  
*Unité — Égalité — Paix*  
**Ministère de l'Intérieur**  
**Direction Générale de la Police Nationale (DGPN)**  
**Direction des Ressources Humaines & Division des Systèmes d'Information**

---

## 1. Introduction et Stratégie Globale des Tests

Le présent **Plan Stratégique de Tests et d'Assurance Qualité Logicielle** définit l'ensemble des principes, protocoles, méthodes et critères d'évaluation régissant la validation exhaustive du Système d'Information des Ressources Humaines (SIRH) de la **Police Nationale de la République de Djibouti**, conformément aux dispositions contractuelles du **Requirement R7** et de l'inventaire des fonctionnalités **F01 à F34** établi dans `PROJECT.md`.

En tant que système d'information régalien traitant des carrières, affectations territoriales, qualifications d'armement, plannings de service 24/7 et rémunérations des forces de police djiboutiennes, le logiciel est soumis aux critères de rigueur, de fiabilité et de sécurité les plus stricts.

### 1.1. Philosophie Directrice : Dual-Track Testing et Approche Opaque-Box

Pour garantir une impartialité absolue et prévenir tout risque d'auto-satisfaction ou de biais de développement, l'assurance qualité repose sur deux principes cardinaux :

1. **Dual-Track Testing (Double Voie de Validation)** :
   - Une étanchéité méthodologique sépare les équipes de conception/développement des équipes de test et de recette.
   - Les spécifications de test sont dérivées directement des textes légaux régissant la Police Nationale (notamment la **Loi n° 46/AN/04/5ème L** et la **Loi n° 116/AN/21/8ème L**), des exigences d'architecture (`docs/06`), du schéma relationnel (`docs/07`) et de la politique de sécurité républicaine (`docs/09`).
2. **Approche Opaque-Box (Boîte Noire Indépendante)** :
   - Les scénarios de tests ne reposent sur aucun artefact interne d'implémentation spécifique.
   - Toutes les vérifications sont opérées par l'intermédiaire des interfaces publiques (API REST contractuelles, schémas de données stricts, formats d'échange JSON, codes de retour HTTP et interfaces web).
   - Aucun résultat n'est simulé ou pré-calculé : chaque test sollicite une logique algorithmique réelle (décompte de congés avec fractions de journée, verrous de concurrence optimiste, hachage chaîné SHA-256 de chaque entrée d'audit, etc.).

---

### 1.2. Pyramide des Tests Régalienne et Architecture en 4 Tiers

L'organisation des tests rompt avec les approches monolithiques pour déployer une pyramide de tests en **4 Tiers fonctionnels et de sécurité**, cumulant un total officiel de **258 cas de test automatisés** :

```
                        ┌────────────────────────┐
                        │        TIER 4          │
                        │    Scénarios Métier    │
                        │  & Contrôles Critiques  │
                        │      R7 (T01-T10)      │
                        │      (18 tests)        │
                        ├────────────────────────┤
                        │        TIER 3          │
                        │      Intégration       │
                        │     Multi-Modules      │
                        │      (10 tests)        │
                        ├────────────────────────┤
                        │        TIER 2          │
                        │  Bornes, Cas Limites   │
                        │   & Injections Secu    │
                        │      (26 tests)        │
                        ├────────────────────────┤
                        │        TIER 1          │
                        │  Couverture Unitaire   │
                        │   & Nominale F01-F34   │
                        │      (204 tests)       │
                        └────────────────────────┘
```

#### Répartition Synthétique des Paliers de Tests

| Tier de Test | Dénomination Officielle | Objectif Qualité et Périmètre d'Évaluation | Nombre de Cas | Taux de Succès |
| :--- | :--- | :--- | :---: | :---: |
| **Tier 1** | **Couverture Unitaire & Nominale** | Validation unitaire et nominale de chacune des 34 fonctionnalités de l'inventaire officiel (F01 à F34), avec au minimum 5 assertions exhaustives par fonctionnalité. | 204 | 100.0% (204/204) |
| **Tier 2** | **Cas Limites, Bornes & Injections** | Évaluation de la résilience du système aux frontières de validité : formats de matricules, limites d'âge (18/60 ans), calculs de congés, repos obligatoire 11h, vacations 12h, injections SQL et détection de fuite médicale. | 26 | 100.0% (26/26) |
| **Tier 3** | **Combinaisons Multi-Modules** | Validation des enchaînements transversaux complexes : cycle de congé de bout en bout, bascule de droits après mutation, qualification d'armement échue avec remplacement d'urgence, Form Builder v2 avec rollback v1 sans perte, et sauvegarde chiffrée avec sinistre simulé. | 10 | 100.0% (10/10) |
| **Tier 4** | **Scénarios Réels & Contrôles R7** | Simulation en conditions réelles de 6 scénarios de commandement policier et validation formelle des 10 exigences critiques de sécurité de la prescription ministérielle R7 (T01 à T10). | 18 | 100.0% (18/18) |
| **TOTAL** | **Suite Complète Unifiée** | **Couverture intégrale de l'application SIRH Police Nationale** | **258** | **100.0% (258/258)** |

---

### 1.3. Matrice des 10 Contrôles Critiques de Sécurité R7 (T01 à T10)

L'Approved Task Prompt (`ORIGINAL_REQUEST.md § R7`) impose la vérification sans compromis de dix points de contrôle hautement critiques. Le tableau ci-dessous formalise leur gouvernance :

| Réf. | Contrôle Critique R7 | Objectif Opérationnel | Démarche de Validation | Résultat d'Assertion Attendu |
| :---: | :--- | :--- | :--- | :--- |
| **T01** | **Refus d'accès hors unité et hors périmètre** | Empêcher un chef de brigade ou commissaire de visualiser ou traiter des dossiers d'un autre commissariat. | Tentative d'accès par le Chef du Commissariat Central de Djibouti (`U-CC-DJIB`) sur le dossier d'un agent affecté à Ali-Sabieh (`U-REG-ALI`). | Code HTTP `403 Interdit`, rejet immédiat, message explicite en français et écriture d'une alerte sécurité dans `journaux_audit`. |
| **T02** | **Impossibilité absolue d'élévation de privilèges** | Empêcher tout utilisateur d'élargir ses droits ou de modifier son rôle dans son profil ou via API. | Injection d'un payload par un `AGENT` ou `GESTIONNAIRE_RH` tentant de s'octroyer le rôle `ADMIN_TECHNIQUE` ou le périmètre global `*`. | Code HTTP `403 Interdit`, rôle inchangé en base de données, alerte de tentative d'intrusion scellée en audit. |
| **T03** | **Conservation intégrale de l'historique lors d'une mutation** | Garantir la traçabilité inaltérable des affectations sans écrasement lors des changements d'unité. | Exécution d'une mutation de l'agent `PND-2015-01001` du Commissariat Central vers le Commissariat d'Ali-Sabieh au 01/11/2026. | L'ancienne affectation est clôturée (`date_fin = 2026-11-01`, `est_courante = FALSE`), une nouvelle est créée, `COUNT(affectations) = 2`. Zéro écrasement. |
| **T04** | **Cohérence des soldes de congés** | Vérifier l'invariance mathématique des compteurs lors de la soumission, validation ou annulation. | Dépôt de 7 jours sur un solde initial de 30 jours, approbation Chef, validation DRH, puis annulation pour rappel de service. | Invariance `acquis = pris + attente + restants` vérifiée à chaque étape. Restitution intégrale du solde à 30 jours après annulation. |
| **T05** | **Prévention des doubles validations concurrentes** | Bloquer tout risque d'approbation simultanée en double par deux gestionnaires ou chefs. | Deux requêtes concurrentes simultanées de validation portant sur le même congé avec le même jeton de concurrence (`version = 2`). | Une requête réussit (version portée à 3), la seconde est rejetée avec HTTP `409 Conflit`. Solde débité une seule et unique fois. |
| **T06** | **Cloisonnement strict des documents sensibles** | Étanchéité absolue de la discipline et neutralité médicale stricte des aptitudes administratives. | Tentative d'accès aux sanctions par un chef non habilité, et tentative d'enregistrement d'un diagnostic médical dans une aptitude. | Rejet HTTP `403` sur la discipline sans habilitation DGPN. Rejet immédiat par contrainte DDL de tout terme médical (diabète, chirurgie, etc.). |
| **T07** | **Traçabilité systématique des exports de données** | Garantir qu'aucune fuite de fichier nominatif ou de solde ne peut avoir lieu sans audit. | Déclenchement d'un export nominatif Excel/CSV ou de solde par un gestionnaire RH. | Enregistrement instantané d'une ligne d'audit avec horodatage UTC, opérateur, volume exporté et empreinte cryptographique SHA-256. |
| **T08** | **Résilience lors de l'import de données** | Résistance aux doublons de matricules et anomalies de format sans corrompre la base. | Traitement d'un lot contenant 1 agent valide, 1 doublon de matricule existant et 1 matricule au format invalide. | Création exclusive de l'agent valide, rejet ciblé des anomalies avec rapport explicatif en français, intégrité référentielle préservée. |
| **T09** | **Sauvegarde et restauration vérifiées** | Garantir la reprise après sinistre sans perte d'intégrité ni corruption d'audit. | Sauvegarde chiffrée de la base centrale, altération malveillante d'une ligne, puis déclenchement de la restauration. | Restauration réussie, élimination intégrale des données corrompues, chaîne cryptographique d'audit vérifiée 100% conforme. |
| **T10** | **Parcours et interface 100% en langue française** | Bannir rigoureusement tout terme anglophone dans l'interface, les messages et les documents. | Balayage lexical automatisé via `french_linter.js` sur tous les écrans, API, messages d'erreur et arrêtés officiels. | Zéro violation linguistique détectée. Conformité souveraine républicaine absolue (100% français). |

---

## 2. Méthodologie et Techniques de Test

Pour atteindre un niveau de rigueur optimal, quatre méthodologies scientifiques de test ont été déployées et combinées :

### 2.1. Category-Partition Method (Méthode de Partitionnement par Catégories)

Chaque fonction métier fait l'objet d'un découpage en catégories fonctionnelles indépendantes, subdivisées en classes d'équivalence :
- **Domaine des Identités Policières** :
  - *Classe Valide* : Matricule normalisé `PND-YYYY-XXXXX` (ex : `PND-2026-00101`), nom et prénom en français républicain, date de naissance cohérente.
  - *Classes Invalides* : Matricule vide, matricule sans préfixe national, matricule avec caractères spéciaux interdits, matricule en doublon.
- **Domaine des Droits d'Accès et Rôles** :
  - *Classes Légitimes* : Les 6 rôles statutaires (`admin_technique`, `admin_fonctionnel`, `gestionnaire_rh`, `chef_service`, `agent`, `auditeur`).
  - *Classes Illégitimes* : Rôles fantômes (`SUPER_ADMIN`, `ROOT`, `HACKER`), tentative de désignation d'un rôle multiple non autorisé.

### 2.2. Boundary Value Analysis (BVA — Analyse des Valeurs Limites)

Les erreurs logicielles se concentrant statistiquement sur les frontières des domaines de définition, une attention particulière est portée aux valeurs aux bornes :
- **Limites d'Âge Opérationnel** :
  - *Âge Minimal de Recrutement* : 18 ans révolus. Un candidat né à `Date_Courante - 17 ans 364 jours` est immédiatement rejeté (Test `B03`). Un candidat né à `Date_Courante - 18 ans 0 jour` est accepté.
  - *Âge Limite de Retraite Active* : 60 ans statutaires. Alerte et blocage de maintien en brigade au-delà de 60 ans (Test `B05`).
- **Limites de Droits à Congés** :
  - *Borne Haute* : Solde annuel légal de 30.0 jours.
  - *Demande à la Limite* : Dépôt de exactement 30.0 jours sur 30.0 disponibles -> acceptation, nouveau solde restant égal à 0.0 jour (Test `B07`).
  - *Dépassement Minimal* : Demande de 30.5 jours sur 30.0 disponibles -> rejet immédiat pour dépassement de 0.5 jour (Test `B08`).
- **Limites Physiologiques et Réglementaires de Planning 24/7** :
  - *Repos Quotidien Incompressible* : 11h00 consécutives requises entre deux vacations. Un intervalle de 11h00 est validé (Test `B13`). Un intervalle de 10h50 (10 minutes manquantes) déclenche un blocage strict (Test `B14`).
  - *Durée Maximale de Vacation* : 12h00 consécutives autorisées en régime exceptionnel 2x12. Une garde de 12h00 est admise (Test `B15`). Une garde de 12h30 est bloquée (Test `B16`).
  - *Seuil de Sous-Effectif de Brigade* : Seuil critique d'armement fixé à 40% de l'effectif nominal. Tout départ en congé ou repos faisant passer l'effectif sous 40% est automatiquement bloqué (Test `B17`).

### 2.3. Pairwise Combinatorial Testing (Tests Combinatoires par Paires)

Pour couvrir efficacement les interactions multidimensionnelles sans explosion combinatoire, les tests combinent les variables suivantes :
- Corps statutaire (Officiers Supérieurs, Officiers Subalternes, Sous-Officiers, Gradés, Agents) ;
- Unité d'affectation (Direction Centrale, Commissariat de District, Brigade Territoriale Régionale) ;
- Position statutaire (Activité, Détachement, Disponibilité, Sous les drapeaux, Suspension) ;
- Régime horaire (Service général hebdomadaire, 3x8 permanent, 2x12 d'intervention, astreinte opérationnelle).

### 2.4. Real-World Workloads (Scénarios Policiers Réels de Terrain)

Six scénarios complets représentatifs de la vie quotidienne des commissariats djiboutiens sont exécutés dans le **Tier 4** (`tests/e2e/scenarios_metier_police.test.js`) :
1. *Scénario 1* : Recrutement d'une promotion de 10 élèves-agents à l'École Nationale de Police (ENP) d'Idda, attribution des matricules nationaux, création des fiches et initialisation des droits à congés.
2. *Scénario 2* : Mutation d'urgence d'une brigade suite à un renfort territorial vers le Commissariat d'Ali-Sabieh, transfert des habilitations et génération de l'arrêté ministériel.
3. *Scénario 3* : Gestion d'un cycle de congés complet avec arbitrage de sous-effectif en période de fête nationale du 27 Juin.
4. *Scénario 4* : Détection proactive à J-30 de l'expiration du certificat annuel de tir d'un brigadier-chef, suspension immédiate de son autorisation de port d'arme de service et remplacement d'urgence pour la patrouille de nuit.
5. *Scénario 5* : Tenue de la Commission Administrative Paritaire d'avancement, promotion d'échelon à l'ancienneté et promotion de grade au choix avec calcul automatique du rappel indiciaire en Francs Djibouti (DJF).
6. *Scénario 6* : Ouverture d'une enquête administrative interne sous scellé disciplinaire par l'Inspection Générale, étanchéité absolue du dossier vis-à-vis du chef de service direct de l'agent.

---

## 3. Environnement de Test, Outillage et Données Synthétiques

### 3.1. Environnement Technique de Test

L'infrastructure de test opère dans un environnement parfaitement conforme à la cible de production souveraine :
- **Système d'Exploitation** : Linux Ubuntu 22.04 LTS / Debian 12 souverain ;
- **Moteur d'Exécution** : Node.js version 20.x LTS / 22.x LTS natif ;
- **Gestionnaire de Base de Données** : PostgreSQL 16.x hébergé localement sur le port dédié `5433` (base `sirh_djibouti`, rôle d'exploitation `sirh_app`), complété par un simulateur relationnel en mémoire (`tests/helpers/database_simulator.js`) garantissant une indépendance absolue d'exécution sans latence réseau ;
- **Protocole de Communication** : HTTP/1.1 et HTTP/2 sous chiffrement TLS 1.3 ;
- **Isolation des Exécutions** : Chaque suite instancie son propre jeu de données en mémoire ou transaction PostgreSQL éphémère avec rollback automatique, prévenant toute pollution croisée.

### 3.2. Outillage et Helpers Dédiés

La suite de test s'appuie sur cinq modules d'assistance spécialisés développés sur mesure :
1. `tests/helpers/crypto_audit.js` :
   - Calcule l'empreinte cryptographique SHA-256 de chaque événement ;
   - Vérifie le chaînage mathématique `Hash(n) = SHA256(Record(n) + Hash(n-1))` pour détecter toute suppression, insertion clandestine ou altération d'audit.
2. `tests/helpers/auth_context.js` :
   - Simule les sessions authentifiées des 6 profils statutaires ;
   - Injecte les périmètres territoriaux et valide le blocage des requêtes hors unité ou avec élévation de rôle.
3. `tests/helpers/contract_validator.js` :
   - Vérifie la conformité des flux d'éléments variables de solde (heures de nuit à 450 DJF, astreintes à 3 500 DJF, prime d'éloignement à 25 000 DJF) ;
   - Valide la conformité structurelle des fichiers PDF/A générés (en-tête républicain, filigrane officiel, QR code d'authentification).
4. `tests/helpers/database_simulator.js` :
   - Implémente fidèlement les contraintes d'intégrité relationnelle, triggers de vérification et règles d'exclusion de `schema.sql`.
5. `tests/helpers/french_linter.js` :
   - Analyseur syntaxique et lexical balayant l'ensemble des réponses HTTP, pages HTML et documents générés pour vérifier l'absence totale de vocabulaire anglophone banni (ex : *submit, cancel, pending, dashboard, delete*).

### 3.3. Référentiel et Fixtures Synthétiques Djiboutiennes

Conformément à l'engagement éthique et de sécurité R5, **aucune donnée réelle ou nominative de policiers en service n'est utilisée**. Les tests opèrent sur le référentiel synthétique complet `/root/RH/tests/fixtures/referentiel_djibouti.json` :
- **17 Unités Administratives Réelles** : DGPN, Direction de la Sécurité Publique (DSP), Direction de la Police Judiciaire (DPJ), Commissariat Central de Djibouti, 5 Commissariats d'Arrondissement (1er au 5ème), 5 Directions Régionales (Ali-Sabieh, Dikhil, Tadjourah, Obock, Arta), École Nationale de Police (ENP) d'Idda, et Groupement d'Intervention de la Police Nationale (GIPN).
- **14 Grades Statutaires Réels** : Du Colonel à l'Élève-Agent, répartis selon les 5 corps de la Loi n° 116/AN/21.
- **Grille Indiciaire en Francs Djibouti (DJF)** : Barèmes de soldes, indemnités de sujétion et primes d'éloignement conformes aux décrets d'application djiboutiens.

---

## 4. Procédures d'Exécution et Commandes Opérationnelles

### 4.1. Commande d'Exécution Globale

La commande officielle standardisée exécute l'intégralité des 258 cas de tests via le test runner unifié :

```bash
# Exécution complète de la suite de tests (racine /root/RH)
npm test

# Commande alternative directe Node.js
node tests/runner.js
```

### 4.2. Exécution Ciblée par Palier Méthodologique

Pour les opérations de maintenance ou de vérification ciblée, chaque palier peut être exécuté isolément :

```bash
# Tier 1 : Couverture unitaire et nominale F01 à F34 (204 cas)
npm run test:unit
# Équivalent : node --test tests/unit/*.test.js

# Tier 2 : Cas limites, bornes réglementaires et injections (26 cas)
npm run test:boundaries
# Équivalent : node --test tests/boundaries/*.test.js

# Tier 3 : Combinaisons multi-modules transversales (10 cas)
npm run test:integration
# Équivalent : node --test tests/integration/*.test.js

# Tier 4 : Scénarios opérationnels et 10 contrôles critiques R7 (18 cas)
npm run test:e2e
# Équivalent : node --test tests/e2e/*.test.js
```

### 4.3. Validation Linguistique Républicaine

Le contrôle automatisé du strict respect de la langue française s'exécute via le script dédié :

```bash
# Analyse lexicale 100% français républicain
node scripts/french_linter.js
```

### 4.4. Performances et Temps d'Exécution en Intégration Continue (CI)

- **Durée Totale d'Exécution** : Moins de 5 secondes (mesurée à 4,75s sur environnement standard) pour l'intégralité des 258 tests.
- **Empreinte Mémoire** : Inférieure à 50 Mo de RAM.
- **Autonomie** : Zéro dépendance réseau externe, zéro appel API cloud distant.

---

## 5. Seuils de Succès, Critères d'Arrêt et Gestion des Défaillances

### 5.1. Critères d'Acceptation Incompressibles

L'homologation formelle du jalon M5 est conditionnée aux critères stricts suivants :
1. **Taux de Réussite de 100% Exigé** : La totalité des 258 cas de test doit passer avec succès (`0 failure`). Le moindre échec unitaire invalide immédiatement la campagne de test.
2. **Code de Sortie Système Égal à 0** : Le processus de test doit renvoyer un code de sortie `exit code = 0`. Tout code différent de 0 déclenche le blocage du pipeline de déploiement.
3. **Validation Totale des 10 Contrôles R7** : Les contrôles T01 à T10 doivent être individuellement validés avec trace d'audit conforme.
4. **Zéro Violation Lexicale** : Aucune détection de terme anglophone non traduit dans les interfaces ou documents générés.

### 5.2. Protocole de Traitement d'une Défaillance de Test

En cas de détection d'une régression lors d'un cycle de test :
1. *Isolement Immédiat* : Identification du fichier de test et de l'assertion défaillante via le rapport d'exécution colorisé ANSI.
2. *Qualification de l'Anomalie* : Distinction entre régression de code applicatif (correctif immédiat) et évolution statutaire (mise à jour concertée avec l'autorité DRH).
3. *Interdiction Formelle de Contournement* : Il est strictement proscrit de modifier une assertion ou de supprimer un cas de test pour masquer une anomalie logicielle.
4. *Re-validation Complète* : Toute correction apportée impose la ré-exécution intégrale des 258 cas de tests pour confirmer l'absence d'effet de bord.

---

## 6. Conclusion et Approbation Technique

Le présent Plan de Tests garantit à la **Direction Générale de la Police Nationale** un dispositif de vérification automatisé exhaustif, souverain et inaltérable, apportant la preuve mathématique et opérationnelle de la conformité du SIRH aux plus hautes exigences de sécurité républicaine.

*Document établi et validé pour la Police Nationale de la République de Djibouti.*
