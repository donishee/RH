# Cahier des Charges Fonctionnel Détaillé du SIRH Police Djiboutienne (R3)

## 1. Vue d'Ensemble du Système et Architecture Fonctionnelle

Le présent document constitue le cahier des charges fonctionnel officiel du Système d'Information des Ressources Humaines (SIRH) de la **Police Nationale de Djibouti**.

Le système s'articule autour de **12 sous-systèmes fonctionnels métiers** et de **5 portails d'accès par rôle utilisateur**, garantissant une couverture complète de la vie professionnelle des fonctionnaires de police, de leur recrutement jusqu'à leur cessation définitive de fonction.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        PORTAILS PAR RÔLE UTILISATEUR                   │
│  [Portail Agent] [Portail Chef de Service] [Portail RH] [Portail Admin Func] [Portail Audit]
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
┌───────────────────────────────────▼────────────────────────────────────┐
│                    SOCLE DES MODULES MÉTIERS DE BASE                   │
│  1. Dossier Agent Unique (Identité, Matricule, Pièces)                 │
│  2. Organisation & Référentiel des Effectifs (Arborescence, Postes)    │
│  3. Carrières & Historique des Mutations (Actes, Promotions)           │
│  4. Congés, Absences & Soldes (Circuits hiérarchiques N+1 / N+2)       │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
┌───────────────────────────────────▼────────────────────────────────────┐
│               MODULES OPÉRATIONNELS DE POLICE & GESTION DU TEMPS       │
│  5. Planning de Service 24/7 (Vacations, Astreintes, Remplacements)    │
│  6. Formation & Qualifications Opérationnelles (Tir, Alertes Exp.)     │
│  7. Évaluation Professionnelle Annuelle (Campagnes, Notation)          │
│  8. Éléments Variables de Solde (Primes, Astreintes, Export Trésor)    │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
┌───────────────────────────────────▼────────────────────────────────────┐
│               MODULES SENSIBLES À HAUTE ÉTANCHÉITÉ                     │
│  9. Discipline & Contentieux (Allégation / Procédure / Décision)       │
│ 10. Aptitude Administrative Opérationnelle (Zéro donnée médicale)      │
│ 11. Gestion Documentaire & Générateur PDF (Arrêtés, Filigrane, QR)     │
│ 12. Console d'Administration Fonctionnelle & Form Builder Dynamique    │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Spécification Détaillée des 12 Modules Métiers

---

### Module 1 : Dossier Agent Unique
- **Objet métier** : Registre centralisé, unique et inaltérable de chaque fonctionnaire de police.
- **Règles de gestion fondamentales** :
  - **Matricule unique** : Format normé national `PND-YYYY-XXXXX` (Année de recrutement + numéro d'ordre incrémental). Le matricule est non modifiable et attribué à vie.
  - **Identité de l'agent** : Nom, prénom, nom en langue nationale/arabe si applicable, date de naissance, lieu de naissance, numéro d'identité nationale (NNI djiboutien), groupe sanguin, statut matrimonial, personnes à charge.
  - **Situation statutaire actuelle** : Corps, grade, échelon actuel, indice de solde, date d'effet dans le grade, date d'effet dans l'échelon, position administrative active (Activité, Détachement, Disponibilité, Suspension).
  - **Affectation courante** : Direction centrale, commissariat ou division, brigade ou unité, poste/emploi occupé, date de prise de poste.
  - **Gestion électronique des documents (GED) attachée** : Pièces justificatives numérisées obligatoires (Arrêté de nomination/recrutement, extrait d'acte de naissance, diplômes, permis de conduire, casier judiciaire initial).
- **Entrées (Inputs)** : Formulaire de création/édition d'agent, téléversement de documents (PDF/JPG/PNG).
- **Sorties (Outputs)** : Fiche individuelle synthétique de l'agent, export PDF du dossier administratif avec filigrane officiel.
- **Comportement en cas d'erreur** :
  - Doublon de matricule ou de NNI : Blocage immédiat de la création avec message explicite en français.
  - Format de date invalide ou date de recrutement antérieure à la date de majorité (18 ans) : Rejet avec alerte.

---

### Module 2 : Organisation & Référentiel des Effectifs
- **Objet métier** : Cartographie structurelle hiérarchique de l'institution et gestion prévisionnelle des effectifs.
- **Règles de gestion fondamentales** :
  - **Arborescence institutionnelle** : Modélisation hiérarchique à 5 niveaux (Ministère -> DGPN -> Directions Centrales -> Commissariats/Divisions -> Brigades/Unités de base).
  - **Fiche d'unité administrative** : Code unité, libellé officiel, rattachement hiérarchique parent, chef d'unité titulaire, localisation géographique (Arrondissement de Djibouti ou Région de l'Intérieur : Ali Sabieh, Dikhil, Tadjourah, Obock, Arta).
  - **Référentiel des postes et emplois** : Chaque unité dispose d'une dotation théorique en effectifs (plafond d'emplois autorisés) par grade.
  - **Gestion des vacances de poste** : Comparaison en temps réel entre effectif théorique budgétaire et effectif réel affecté, permettant d'identifier immédiatement les postes vacants pour préparer les mouvements de mutation.
  - **Organigramme dynamique** : Visualisation graphique interactive de la chaîne de commandement.
- **Entrées** : Création et modification d'unités, assignation du chef d'unité, définition des quotas de postes par unité.
- **Sorties** : Tableaux de bord d'effectifs, organigrammes interactifs, états des postes vacants par division.

---

### Module 3 : Carrières & Historique des Mutations
- **Objet métier** : Traçabilité inaltérable de tous les événements de carrière de l'agent sans écrasement de données.
- **Règles de gestion fondamentales** :
  - **Principe de conservation intégrale** : Chaque mutation, promotion, changement d'échelon ou changement de position administrative crée un enregistrement d'événement daté. Les affectations passées sont conservées à titre d'archive probante.
  - **Processus de mutation** :
    1. Demande de mutation (par l'agent) ou proposition de mutation (d'office pour nécessité de service).
    2. Avis du chef de service cédant et du chef de service accueillant.
    3. Décision du Directeur Général de la Police Nationale avec référence de l'acte (ex. `Décision n° .../DGPN/DRH`).
    4. Clôture automatique de l'affectation précédente à la date J-1 et ouverture de la nouvelle affectation à la date J.
  - **Processus de promotion** : Enregistrement de l'avancement de grade ou d'échelon avec indication de la modalité (Ancienneté / Grand Choix / Concours professionnel) et génération de l'acte d'avancement.
- **Entrées** : Formulaire de mouvement d'affectation, formulaire de changement d'échelon/grade, pièces jointes d'arrêtés.
- **Sorties** : Chronologie complète de la carrière de l'agent (Curriculum Vitae administratif officiel), états statistiques des mobilités annuelles.

---

### Module 4 : Congés, Absences & Gestion des Soldes
- **Objet métier** : Gestion dématérialisée des droits à congés, suivi des compteurs et circuit d'autorisation d'absence.
- **Règles de gestion fondamentales** :
  - **Compteurs de congés** : Calcul automatique de l'acquisition des droits (2,5 jours ouvrables par mois de service actif, soit 30 jours par an).
  - **Débit à la validation** : Le solde de congé n'est débité définitivement qu'après approbation finale de la demande.
  - **Vérification de la capacité opérationnelle** : Le système empêche ou alerte si la validation de la demande entraîne une baisse des effectifs de la brigade sous le seuil d'effectif minimum de sécurité configuré.
  - **Contrôle d'intégrité temporelle** : Impossibilité de soumettre une demande sur une période chevauchant un autre congé déjà validé, une suspension ou une mission programmée.
  - **Circuit de validation hiérarchique à double niveau** :
    1. Niveau 1 : Avis motivé du Chef de brigade / Chef de poste (Favorable / Défavorable avec motif).
    2. Niveau 2 : Approbation définitive par le Commissaire d'arrondissement ou le Bureau des Congés de la DRH.
  - **Refus motivé obligatoire** : Tout refus doit comporter la sélection d'un motif statutaire (ex. Nécessité impérieuse de service, Alerte sécuritaire renforcée) et une explication écrite.
- **Entrées** : Demande d'absence de l'agent (date début, date fin, type d'absence, justificatif éventuel).
- **Sorties** : Titre de congé officiel téléchargeable en PDF, notifications de validation/refus, planning récapitulatif des absences de l'unité.

---

### Module 5 : Planning de Service 24/7 & Gestion du Temps Opérationnel
- **Objet métier** : Planification des cycles de travail opérationnels des unités de terrain, respect du repos légal et gestion des urgences.
- **Règles de gestion fondamentales** :
  - **Modèles de cycles de travail policiers** : Prise en charge des régimes 3x8 (Matin 06h-14h, Après-midi 14h-22h, Nuit 22h-06h), régimes 4x2, permanences de week-end et régimes normaux de bureau pour les services administratifs.
  - **Contrôle des effectifs minimaux de brigade** : Chaque vacation de patrouille exige un quota minimum d'officiers et d'agents habilités (ex. au moins 1 officier de quart, 1 planton, 2 patrouilles motorisées).
  - **Gestion de la fatigue et repos légal obligatoire** : Respect d'un intervalle minimal de **11 heures consécutives de repos** entre deux vacations de service. Le système bloque automatiquement l'affectation d'un agent qui violerait cette règle, avec notification d'alerte.
  - **Procédure de remplacement d'urgence** : En cas d'absence inopinée d'un agent au rassemblement de brigade, le chef de poste déclenche la fonction « Remplacer un agent » :
    * L'application affiche la liste filtrée des agents disponibles de l'unité ou des unités de renfort, ayant satisfait à leur temps de repos légal, et disposant des habilitations requises pour le poste.
    * Le chef de service peut désigner un remplaçant d'office (avec notification d'ordre de mission) ou lancer un appel à volontaire parmi les agents d'astreinte.
- **Entrées** : Paramétrage des grilles de vacations par brigade, assignation des agents aux créneaux, saisie des substitutions d'urgence.
- **Sorties** : Tableau de service officiel (Roster de brigade) hebdomadaire et mensuel affichable à l'écran et imprimable en PDF.

---

### Module 6 : Formation Continue & Qualifications Opérationnelles
- **Objet métier** : Gestion des compétences critiques, du recyclage réglementaire et sécurisation juridique des engagements armés.
- **Règles de gestion fondamentales** :
  - **Référentiel des qualifications policières** :
    * Certificat annuel de tir et d'armement réglementaire.
    * Habilitations armes de force intermédiaire (Taser, lanceur de balles de défense).
    * Habilitation d'Officier de Police Judiciaire (OPJ) / Agent de Police Judiciaire (APJ).
    * Certificat de secourisme opérationnel de premier secours.
    * Permis de conduire véhicules d'intervention d'urgence et motocyclistes.
  - **Système d'alertes proactives** :
    * J-60 : Notification d'avertissement au gestionnaire de formation et à l'agent.
    * J-30 : Alerte prioritaire imposant la convocation à la session de recyclage à l'École Nationale de Police.
    * J-0 : Expiration de la qualification.
  - **Verrouillage opérationnel strict** : Si la qualification de tir ou d'armement d'un agent est expirée, le module Planning de service bloque formellement son affectation sur un poste armé de patrouille ou de maintien de l'ordre.
- **Entrées** : Catalogue des formations, sessions organisées à l'ENP, enregistrement des procès-verbaux de contrôle de tir avec date d'obtention et date de validité.
- **Sorties** : Registre des aptitudes et compétences de la Police Nationale, convocations officielles de formation, alertes d'expiration.

---

### Module 7 : Évaluation Professionnelle & Notation Annuelle
- **Objet métier** : Conduite annuelle de la campagne d'appréciation de la valeur professionnelle des fonctionnaires de police.
- **Règles de gestion fondamentales** :
  - **Campagne annuelle** : Ouverture et clôture de la campagne de notation par arrêté du Directeur Général.
  - **Grille d'évaluation harmonisée** : Critères d'appréciation objectifs adaptés aux métiers de la police :
    * Disponibilité opérationnelle et sens du devoir.
    * Rigueur, probité et respect de la déontologie policière.
    * Aptitude au commandement (pour les officiers et sous-officiers) ou exécution des ordres.
    * Maîtrise professionnelle et compétences techniques.
  - **Entretien professionnel et notation chiffrée** : Attribution d'une note sur 20 accompagnée d'une appréciation générale littérale rédigée par le chef de service direct (N+1).
  - **Notification et voie de recours** : Communication de la note à l'agent avec visa obligatoire. En cas de contestation, possibilité de recours gracieux devant la Commission d'évaluation dans un délai réglementaire fixé (ex. 15 jours).
  - **Liaison avec le tableau d'avancement** : La moyenne des notes des trois dernières années détermine directement l'éligibilité à la promotion au grand choix.
- **Entrées** : Grille de critères remplie par le chef de service, signature de l'agent, avis de la commission de recours.
- **Sorties** : Bulletin annuel individuel de notation au format PDF officiel, classement par ordre de mérite pour la commission d'avancement.

---

### Module 8 : Discipline & Contentieux (Hautement Cloisonné)
- **Objet métier** : Traitement déontologique et disciplinaire dans le respect scrupuleux des garanties statutaires et des droits de la défense.
- **Règles de gestion et étanchéité absolue** :
  - **Séparation hermétique** : Ce module fait l'objet d'un contrôle d'accès strict niveau Administrateur de discipline / Direction Générale. Aucun chef de brigade ni gestionnaire RH ordinaire ne peut consulter ces données.
  - **Chaîne procédurale rigoureuse à 3 phases distinctes** :
    1. *Phase d'Allégation / Signalement préliminaire* : Enregistrement confidentiel du fait signalé ou du rapport hiérarchique. Cette allégation est non publique et ne figure pas sur le dossier courant.
    2. *Phase de Procédure d'instruction* : Saisine officielle de la Commission de discipline de la Police Nationale, notification des griefs à l'agent, convocation de la défense, consultation du dossier par l'avocat ou le défenseur désigné.
    3. *Phase de Décision finale* : Avis motivé de la commission, prononcé de la sanction par l'autorité compétente (Directeur Général ou Ministre selon le groupe de sanction), notification officielle et inscription de la sanction au dossier individuel.
  - **Classification des sanctions statutaires** :
    * 1er Groupe : Avertissement, Blâme.
    * 2ème Groupe : Radiation du tableau d'avancement, Abaissement d'échelon, Exclusion temporaire de fonctions (1 à 15 jours).
    * 3ème Groupe : Rétrogradation de grade, Révocation avec ou sans suspension des droits à pension.
  - **Effacement réglementaire (Amnistié / Réhabilitation)** : Possibilité de purge automatique ou manuelle d'une sanction du 1er groupe après accomplissement d'un délai de bonne conduite (ex. 3 ans sans nouvelle sanction).
- **Entrées** : Rapports de saisine, procès-verbaux de la commission de discipline, arrêtés de sanction.
- **Sorties** : Extraits de sanctions pour l'application des retenues sur solde, procès-verbaux d'audience disciplinaire, arrêtés de sanction en PDF sécurisé.

---

### Module 9 : Aptitude Administrative Opérationnelle (Zéro Donnée Médicale)
- **Objet métier** : Enregistrement des décisions administratives d'aptitude au service de police dans le respect absolu du secret médical.
- **Règles de gestion et secret médical** :
  - **Règle d'or** : Le système ne contient **AUCUN diagnostic, AUCUNE pathologie, AUCUN détail médical, AUCUNE prescription**.
  - **Seules les conclusions administratives d'aptitude sont enregistrées** :
    * *Apte sans restriction* : Autorisation générale pour toutes missions, patrouilles de nuit, voie publique et port de l'arme de service.
    * *Apte avec restrictions administratives* : Mention des restrictions de service sans justification médicale :
      - Restriction 1 : Dispense temporaire de port d'arme de service.
      - Restriction 2 : Dispense de service de nuit (22h - 06h).
      - Restriction 3 : Affectation exclusive en poste sédentaire de bureau.
      - Restriction 4 : Dispense d'épreuves physiques et de maintien de l'ordre.
    * *Inapte temporaire* : Placement en position de congé maladie.
    * *Inapte définitif aux fonctions de police* : Enclenchement de la procédure de reclassement dans un cadre d'emploi civil ou de mise à la retraite pour invalidité.
  - **Blocage technique** : Le module Planning consulte uniquement le code d'aptitude. Si l'agent a une restriction de port d'arme ou de service de nuit, le système interdit son assignation sur ces créneaux.
- **Entrées** : Saisie par le Bureau RH habilité de l'avis administratif du médecin de police (Date de visite, Décision d'aptitude, Date de fin de restriction, Médecin signataire).
- **Sorties** : Fiche d'aptitude administrative opérationnelle, alerte d'arrivée à échéance de la restriction.

---

### Module 10 : Éléments Variables de Solde (EVS) & Interfaces Paie
- **Objet métier** : Consolidation mensuelle des indemnités et primes de sujétion policière pour transmission au système de solde de l'État.
- **Règles de gestion fondamentales** :
  - **Primes et indemnités prises en compte** :
    * Prime de sujétion policière et de risque (liée au grade et à l'affectation active).
    * Indemnités d'astreinte opérationnelle et de permanence de week-end.
    * Indemnités pour vacations de nuit effectuées (heures effectives entre 22h et 06h).
    * Indemnités d'éloignement pour affectation dans les commissariats des Régions de l'Intérieur (Ali Sabieh, Dikhil, Tadjourah, Obock).
    * Retenues pour absence non justifiée ou suspension administrative.
  - **Clôture mensuelle de paie** : Gel des données d'activité au 25 de chaque mois et génération du fichier d'ordonnancement de solde.
  - **Export normé et sécurisé** : Fichier structuré (CSV/XML chiffré) prêt à l'ingestion par le Trésor public et la Direction du Budget du Ministère des Finances.
- **Entrées** : Données consolidées issues des modules Planning (heures de nuit, astreintes) et Carrières (primes territoriales).
- **Sorties** : Récapitulatifs mensuels individuels d'indemnités (bulletin pré-solde), fichier d'export global chiffré pour la solde de l'État.

---

### Module 11 : Gestion Documentaire & Générateur PDF Souverain
- **Objet métier** : Production automatisée de documents administratifs conformes aux exigences de l'État djiboutien.
- **Règles de gestion et sécurité documentaire** :
  - **Conformité graphique nationale** : En-tête officiel de la République de Djibouti (Devise nationale : *Unité - Égalité - Paix*), timbre officiel de la Direction Générale de la Police Nationale.
  - **Sécurité et intégrité des actes générés** :
    * Filigrane dynamique républicain (« REPRODUCTION INTERDITE - POLICE NATIONALE »).
    * Horodatage certifié UTC de génération.
    * Identifiant unique du document et signature numérique (hachage SHA-256).
    * Code QR d'authenticité permettant la vérification instantanée de l'acte par scan sécurisé.
  - **Catalogue des modèles PDF officiels** :
    1. Arrêté d'affectation et de mutation.
    2. Titre de congé officiel et autorisation d'absence.
    3. Fiche de situation administrative et d'états de service.
    4. Attestation de travail et de présence sous les drapeaux.
    5. Arrêté individuel d'avancement d'échelon.
    6. Tableau de service de brigade hebdomadaire.
- **Entrées** : Données applicatives des modules métiers, gabarits de documents paramétrables.
- **Sorties** : Fichiers PDF natifs conformes à la norme PDF/A pour archivage pérenne.

---

### Module 12 : Console d'Administration Fonctionnelle & Form Builder Dynamique
- **Objet métier** : Gestion en autonomie complète des formulaires, champs personnalisés et listes de valeurs par la DRH sans intervention informatique.
- **Règles de gestion et ergonomie low-code/no-code** :
  - **Générateur de formulaires (Form Builder)** :
    * Ajout de champs personnalisés sur les dossiers agents ou formulaires de demande.
    * Typologies supportées : Texte, Date, Nombre entier/décimal, Liste déroulante à choix unique, Cases à cocher multiples, Pièce jointe téléversable.
    * Configuration du caractère obligatoire, de l'ordre d'affichage, du libellé d'aide et de la valeur par défaut.
  - **Gestion des listes de valeurs métier** : Modification dynamique des listes sans toucher au code (Unités, Spécialités policières, Types de congés, Motifs de refus, Types d'astreintes).
  - **Versionnement des configurations et Rollback** :
    * Chaque publication de configuration crée une version datée et signée par l'administrateur fonctionnel.
    * Possibilité d'effectuer un retour arrière (*Rollback*) instantané vers une version antérieure sans altération ni perte des données déjà saisies.
  - **Frontière de sécurité absolue** : Les règles de calcul de sécurité, les algorithmes de contrôle d'accès et les pistes d'audit demeurent dans le socle technique et ne peuvent être altérés par la console fonctionnelle.
- **Entrées** : Interface graphique drag-and-drop de création de champs, gestionnaire de listes de référence.
- **Sorties** : Schémas de formulaires dynamiques au format JSON versionné, journaux d'audit de modification de configuration.

---

## 3. Spécification des 5 Portails par Rôle Utilisateur

| Rôle Utilisateur | Périmètre d'Accès et Fonctionnalités Clés | Contraintes de Cloisonnement |
| :--- | :--- | :--- |
| **1. Portail Agent** *(Self-Service)* | - Consultation de son dossier individuel (identité, grade, échelon, affectation courante).<br>- Visualisation de son planning de vacation individuel et de ses astreintes.<br>- Consultation en temps réel de ses soldes de congés.<br>- Soumission dématérialisée de demandes de congés et autorisations d'absence.<br>- Téléchargement de ses attestations de présence et titres de congé en PDF certifié. | Ne peut consulter AUCUN autre dossier d'agent. Aucune modification directe sur les données administratives officielles sans validation RH. |
| **2. Portail Chef de Service** *(Commandant d'unité)* | - Gestion opérationnelle des effectifs de son unité territoriale ou divisionnaire.<br>- Validation ou refus motivé des demandes de congés de ses subordonnés directs.<br>- Établissement et révision des tableaux de service de brigade (plannings 24/7).<br>- Gestion des remplacements d'urgence en cas d'absence inopinée.<br>- Saisie des notations et évaluations professionnelles annuelles de son unité.<br>- Consultation des qualifications opérationnelles des agents de son unité (alertes tir/recyclage). | Accès strictement limité aux seuls agents affectés à son unité administrative. Aucun accès aux dossiers d'autres commissariats. Aucun accès au module Discipline. |
| **3. Portail Gestionnaire RH** *(DRH DGPN)* | - Création et gestion complète des fiches agents (matricule unique, données statutaires).<br>- Traitement des actes de mutation, arrêtés d'avancement et changements de position.<br>- Suivi de l'organigramme national et publication des postes vacants.<br>- Suivi du catalogue des formations et enregistrement des habilitations de l'ENP.<br>- Enregistrement des décisions administratives d'aptitude opérationnelle.<br>- Clôture mensuelle des éléments variables de solde (EVS) et export vers le Trésor.<br>- Production des documents officiels républicains au format PDF. | Accès global sur l'ensemble de la Police Nationale, à l'exception des affaires disciplinaires non finalisées (réservées à la commission). |
| **4. Portail Administrateur Fonctionnel RH** *(Superviseur Métier)* | - Accès exclusif à la console de paramétrage dynamique (Form Builder).<br>- Ajout et paramétrage des champs personnalisés sans code.<br>- Administration des listes de référence (grades, motifs, types d'absences).<br>- Configuration des seuils d'effectifs minimaux et des plafonds d'heures.<br>- Consultation de l'historique des versions de configuration et déclenchement de rollback.<br>- Gestion des modèles de documents administratifs. | Ne peut ni modifier le code technique du backend, ni altérer les contrôles de sécurité ou les journaux d'audit inaltérables. |
| **5. Portail Auditeur / Inspection Générale** *(Contrôle & Déontologie)* | - Consultation en lecture seule absolue de la piste d'audit forensique.<br>- Recherche et filtrage avancé des événements (qui a consulté quoi, qui a modifié un champ, qui a exporté des données, à quelle date, depuis quelle IP).<br>- Analyse des anomalies : tentatives de connexion échouées, dépassements d'heures de service, rejets massifs de congés.<br>- Export certifié des journaux d'audit pour les besoins des commissions d'enquête ou réquisitions du Directeur Général. | Accès exclusivement en LECTURE SEULE. Impossibilité absolue d'altérer, supprimer ou suspendre la journalisation. |

---

## 4. Matrice de Traçabilité des Exigences Non Fonctionnelles

- **Conformité linguistique** : 100% en français (interfaces, libellés, infobulles, messages d'erreur, documents officiels, exports et journaux d'audit).
- **Zéro fonction d'enquête ou surveillance** : Aucune donnée de filature, aucun rapport judiciaire, aucune géolocalisation permanente en dehors de la prise de service administrative.
- **Neutralité médicale absolue** : Aucune donnée médicale conservée dans le système ; prise en compte exclusive des décisions administratives d'aptitude opérationnelle.
- **Haute disponibilité intranet** : Fonctionnement autonome sur le réseau intranet centralisé de la Police Djiboutienne, sans dépendance vis-à-vis de clouds publics étrangers.
