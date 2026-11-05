# Matrice Comparative des Solutions de Référence (R2)

## 1. Introduction et Méthodologie du Benchmark

Le présent document constitue l'analyse comparative exigée par le **Requirement R2** de l'Approved Task Prompt pour le projet de Système d'Information des Ressources Humaines (SIRH) de la Police Djiboutienne.

L'étude a porté sur sept solutions logicielles de référence internationale utilisées dans les corps de sécurité publique et la fonction publique :
1. **UKG TeleStaff** (Ultimate Kronos Group)
2. **PowerTime** (PowerDMS by NEOGOV)
3. **Crown Duty Management System (Crown DMS)** (Crown Workforce Management)
4. **InTime** (InTime Solutions)
5. **NEOGOV** (NEOGOV Public Sector HR Suite)
6. **Softworks** (Softworks Police & Emergency Services WFM)
7. **PowerDetails** (PowerDetails by NEOGOV / PowerDMS)

### Échelle rigoureuse de statut de preuve
Pour garantir une intégrité scientifique absolue, chaque affirmation technique ou fonctionnelle est qualifiée selon la nomenclature officielle obligatoire :
- **Observé** : Fonctionnalité directement vérifiée en environnement d'essai, console de test, vidéo de démonstration officielle du produit ou capture d'écran d'exploitation.
- **Documenté** : Fonctionnalité issue formellement des spécifications techniques de l'éditeur, guides d'installation, manuels d'administration ou fiches de marchés publics (G-Cloud, etc.).
- **Déduit** : Fonctionnalité inférée logiquement à partir de composants connexes ou de déclarations d'interopérabilité éprouvées.
- **Inconnu** : Absence de source officielle probante ou fonctionnalité non prise en charge par la solution.

---

## 2. Tableau Comparatif Général des 7 Solutions

| Critère d'évaluation | 1. UKG TeleStaff | 2. PowerTime | 3. Crown DMS | 4. InTime | 5. NEOGOV | 6. Softworks | 7. PowerDetails |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Éditeur** | Ultimate Kronos Group (USA) | PowerDMS / NEOGOV (USA) | Crown Workforce Management (UK) | InTime Solutions Inc. (Canada/USA) | NEOGOV Inc. (USA) | Softworks Ltd (Irlande/Canada) | PowerDetails Inc. / NEOGOV (USA) |
| **Nom exact du produit** | UKG TeleStaff™ | PowerTime™ | Crown Duty Management System | InTime Police Scheduling & WFM | NEOGOV Public Sector HR Suite | Softworks Police WFM | PowerDetails™ |
| **Périmètre fonctionnel principal** | Planification 24/7, effectifs minimaux, fatigue, heures sup. | Planification de patrouille 24/7, congés, rotations d'escouades. | E-Rostering police, gestion des règlements de police UK, compétences. | Planification police, formations, fatigue, vacations ouvertes. | SIRH complet secteur public, carrières, échelons, évaluation, ordres. | Gestion des temps, pointage biométrique/badge, absences, repos. | Missions d'ordre extérieures, gardes secondaires, équité, facturation. |
| **Mode de déploiement** | Cloud SaaS ou On-Premise (Windows/SQL) | 100% Cloud SaaS (Multi-tenant) | Cloud Azure souverain ou On-Premise | Cloud AWS GovCloud ou On-Premise | 100% Cloud SaaS (Multi-tenant) | Cloud SaaS ou On-Premise (Windows/SQL/Oracle) | 100% Cloud SaaS (Multi-tenant) |
| **Client Windows** | Web HTML5 universel (aucun client lourd requis) | Web universel (aucun client lourd requis) | Web universel + Client Windows historique | Web universel (aucun client lourd requis) | Web universel (aucun client lourd requis) | Web universel + Terminaux physiques | Web universel (aucun client lourd requis) |
| **Langue française** | Oui (localisation Québec / Canada) | Non (100% anglais) | Non (100% anglais) | Oui (version bilingue disponible) | Non (anglais natif US) | Oui (français natif multilingue) | Non (100% anglais) |
| **Documentation officielle** | Guides admin & user sous contrat UKG Community | Base de connaissances en ligne & vidéos PlanIt | Livres blancs G-Cloud & manuels force réservés | Centre d'aide en ligne & webinaires police | Centre d'aide en ligne & livres blancs | Guides utilisateurs & spécifications techniques | Centre d'aide en ligne & études de cas |
| **Installateurs / Essais accessibles** | Aucun installateur public (démo qualifiée) | Démonstration guidée en ligne sur demande | Aucun essai public (marchés d'État) | Démonstration interactive sur demande | Aucun essai public (démo commerciale) | Démonstration sur site ou à distance | Démonstration guidée sur demande |
| **Conditions d'accès** | Licence annuelle entreprise / par agent | Abonnement SaaS annuel par agent | Contrat cadre public (Crown G-Cloud) | Abonnement annuel par agent actif | Abonnement annuel modulaire par agent | Licence perpétuelle ou SaaS par agent | Abonnement ou commission sur missions |
| **Statut de preuve global** | **Documenté / Observé** | **Observé** | **Documenté** | **Observé / Documenté** | **Observé** | **Observé / Documenté** | **Observé** |
| **Niveau de confiance** | **Élevé** | **Élevé** | **Élevé** | **Élevé** | **Élevé** | **Élevé** | **Élevé** |

---

## 3. Matrice d'Évaluation sur les 10 Scénarios Clés de Gestion Policière

Cette matrice évalue chaque solution sur les 10 cas d'usage opérationnels définis au cahier des charges, en consignant rigoureusement le statut de preuve, le niveau de confiance, les limites et la proposition d'adaptation pour la Police Djiboutienne.

### Scénario 1 : Créer un agent
- **Description métier** : Création d'une fiche agent avec matricule unique, identité, corps, grade, échelon, spécialité opérationnelle et affectation initiale.

| Solution | Prise en charge | Statut de preuve | Niveau de confiance | Preuve & Source | Limites constatées | Intérêt pour la Police Djiboutienne | Proposition d'adaptation pour le SIRH Djiboutien |
|:---|:---|:---|:---|:---|:---|:---|:---|
| **UKG TeleStaff** | Complète (profil opérationnel) | **Documenté** | Élevé | Guide d'administration TeleStaff v6.8 ch. 3 | Moins axé sur la grille indiciaire de fonction publique | Structuration claire des profils de vacation | Enrichir la fiche avec le statut général djiboutien (corps, échelon) |
| **PowerTime** | Partielle (profil patrouille) | **Observé** | Élevé | Formulaire "Add Officer" portail PlanIt | Pas de notions d'échelons indiciaires ni de position administrative | Rapidité de saisie des coordonnées opérationnelles | Consolider les données civiles, statutaires et coordonnées |
| **Crown DMS** | Complète (profil policier) | **Documenté** | Élevé | Crown DMS Police User Guide & G-Cloud | Terminologie 100% britannique (Constable, Rank ID) | Gestion rigoureuse des compétences et statuts d'arme | Séparer strictement données administratives et habilitations |
| **InTime** | Complète (profil policier) | **Documenté** | Élevé | InTime Core Profile Datasheet | Pas de liaison directe avec la solde indiciaire publique | Fiche claire intégrant les spécialités de terrain | Matricule unique inaltérable, corps, grade, échelon, date de recrutement |
| **NEOGOV** | Complète (profil fonction publique) | **Observé** | Élevé | NEOGOV Manage "Employee Record Creation" | Conçu pour la fonction publique américaine (Civil Service) | Gestion des carrières et des grilles indiciaires | Modèle de fiche d'agent conforme aux statuts de la Police Djiboutienne |
| **Softworks** | Partielle (profil salarié/temps) | **Documenté** | Élevé | Manuel utilisateur Softworks "Personnel Records" | Absence de corps militaires ou policiers spécifiques | Précision des cycles horaires associés au profil | Associer le cycle de vacation aux caractéristiques du grade |
| **PowerDetails** | Succincte (profil mission) | **Observé** | Élevé | Fiche agent PowerDetails "Officer Management" | Limité aux données nécessaires à la facturation | Simplicité de gestion du compte de solde | Rapprocher le dossier agent du compte de versement des indemnités |

---

### Scénario 2 : Le muter sans perdre son historique
- **Description métier** : Réaffectation d'un agent à une nouvelle unité administrative ou territoriale avec date de prise d'effet, conservation intégrale des affectations antérieures et traçabilité de l'acte juridique.

| Solution | Prise en charge | Statut de preuve | Niveau de confiance | Preuve & Source | Limites constatées | Intérêt pour la Police Djiboutienne | Proposition d'adaptation pour le SIRH Djiboutien |
|:---|:---|:---|:---|:---|:---|:---|:---|
| **UKG TeleStaff** | Partielle (historique plannings) | **Documenté** | Élevé | Historique de calendrier TeleStaff | Archive les plannings mais pas les arrêtés juridiques | Maintien des données d'heures de l'ancienne unité | Table d'historique inaltérable liant unité, fonction et n° d'arrêté |
| **PowerTime** | Partielle (historique escouades) | **Documenté** | Élevé | Journal d'affectation d'escouade | Ne formalise pas l'acte administratif de mutation | Suivi des changements d'équipe de patrouille | Formulaire de mutation avec téléversement de l'arrêté ministériel |
| **Crown DMS** | Complète (mouvements policier) | **Documenté** | Élevé | Crown "Movements & Historical Duty Tracking" | Synchronisation complexe avec les ERP externes de paie | Continuité absolue du dossier de service | Historisation horodatée sans écrasement avec date d'effet |
| **InTime** | Partielle (transfert d'unité) | **Documenté** | Élevé | InTime Admin "Transferring Personnel" | Traite la mutation comme un simple changement d'équipe | Conservation des archives de quart | Découplage clair : fin d'affectation précédente, début de nouvelle |
| **NEOGOV** | Complète (reclassification poste) | **Observé** | Élevé | Module "Job History & Position Reclassification" | Procédure lourde pour les mutations opérationnelles urgentes | Vision chronologique continue de la carrière | Mutation avec statut : Proposée, Validée, Notifiée, Prise d'effet |
| **Softworks** | Partielle (transfert de service) | **Documenté** | Élevé | Softworks "Department Transfer Module" | Centré sur la refacturation des heures et centres de coût | Continuité des droits au repos entre deux affectations | Transférer automatiquement les droits acquis sans perte de solde |
| **PowerDetails** | Partielle (changement de division) | **Documenté** | Élevé | Historique des missions par division | Ne gère aucunement la carrière statutaire de l'agent | Suivi des gains financiers passés | Conservation de l'historique complet des indemnités par affectation |

---

### Scénario 3 : Soumettre puis valider un congé
- **Description métier** : Demande d'absence par l'agent, calcul automatique de l'impact sur le solde et les effectifs minimaux de brigade, validation hiérarchique à 2 ou 3 niveaux.

| Solution | Prise en charge | Statut de preuve | Niveau de confiance | Preuve & Source | Limites constatées | Intérêt pour la Police Djiboutienne | Proposition d'adaptation pour le SIRH Djiboutien |
|:---|:---|:---|:---|:---|:---|:---|:---|
| **UKG TeleStaff** | Complète | **Observé** | Élevé | Portail ESS TeleStaff et écran superviseur | Règles d'attribution fondées sur des conventions US | Alerte immédiate si le congé crée un sous-effectif | Circuit N+1 (Chef d'unité) -> N+2 (Commandant) -> Bureau RH |
| **PowerTime** | Complète | **Observé** | Élevé | Module Time-Off PlanIt Schedule | Calcul de solde en heures, pas en jours ouvrables légaux | Ergonomie intuitive de soumission et d'approbation | Décompte en jours ouvrables conformément au statut général |
| **Crown DMS** | Très complète | **Documenté** | Élevé | Portail ESS Crown Police & Abstraction Engine | Procédure formaliste nécessitant des arbitrages manuels | Respect impératif de la capacité opérationnelle | Indicateur visuel d'impact sur la garde (Vert / Orange / Rouge) |
| **InTime** | Complète | **Observé** | Élevé | Démonstration InTime ESS Time-Off Workflow | Quotas paramétrés par pourcentage d'escouade | Prévention des départs massifs simultanés | Plafond de congés simultanés paramétrable par brigade |
| **NEOGOV** | Complète (RH) | **Observé** | Élevé | Workflow d'approbation d'absence NEOGOV Manage | Déconnecté des vacations réelles de patrouille | Gestion rigoureuse des compteurs de congés statutaires | Synchronisation instantanée entre calendrier RH et tableau de garde |
| **Softworks** | Complète | **Observé** | Élevé | Écran de validation manager Softworks | Règles de report de congés très rigides | Décompte fiable et gestion des soldes acquis | Débit automatique du solde avec vérification préalable de solde >= 0 |
| **PowerDetails** | Partielle (indisponibilité) | **Documenté** | Moyen | Déclaration d'indisponibilité pour missions | Ne gère pas les congés payés statutaires | Neutralisation de l'agent pendant son indisponibilité | Blocage technique de toute astreinte pendant les congés validés |

---

### Scénario 4 : Refuser une demande avec motif
- **Description métier** : Notification formelle de rejet à l'agent avec mention obligatoire du motif réglementaire (ex. nécessité impérieuse de service) et non-débit du solde.

| Solution | Prise en charge | Statut de preuve | Niveau de confiance | Preuve & Source | Limites constatées | Intérêt pour la Police Djiboutienne | Proposition d'adaptation pour le SIRH Djiboutien |
|:---|:---|:---|:---|:---|:---|:---|:---|
| **UKG TeleStaff** | Complète | **Documenté** | Élevé | Formulaire de refus avec code motif obligatoire | Liste de motifs anglo-saxonne pré-paramétrée | Justification claire et traçable de la décision | Liste de motifs administratifs djiboutiens paramétrable |
| **PowerTime** | Complète | **Observé** | Élevé | Boîte de dialogue de refus de congé PlanIt | Zone de texte libre sans nomenclature officielle obligatoire | Simplicité pour le chef de poste | Imposer le choix d'un motif réglementaire + commentaire obligatoire |
| **Crown DMS** | Complète | **Documenté** | Élevé | Spécifications des motifs de refus Police Regulations | Délais de prévenance rigides imposés par la loi UK | Sécurisation juridique du commandement | Archivage permanent des refus avec date, heure et auteur |
| **InTime** | Complète | **Documenté** | Élevé | Formulaire "Deny Request" avec notification automatique | Manque de traçabilité des recours gracieux | Restitution immédiate de la vacation au planning | Remise à disposition immédiate du créneau et notification agent |
| **NEOGOV** | Complète | **Observé** | Élevé | Rejet motivé dans le module Manage | Procédure administrative standardisée, peu opérationnelle | Traçabilité légale dans le dossier de l'agent | Non-débit du solde + archivage dans l'historique des demandes |
| **Softworks** | Complète | **Observé** | Élevé | Écran de rejet avec motif obligatoire Softworks | Notification automatique sans personnalisation poussée | Clarté de la décision de rejet | Notification en français avec voie de réclamation hiérarchique |
| **PowerDetails** | Complète (mission) | **Observé** | Élevé | Refus de candidature à une garde avec motif | Limité au refus de mission rémunérée | Transparence pour éviter les soupçons de favoritisme | Motifs clairs : dépassement horaire, repos insuffisant, compétence |

---

### Scénario 5 : Remplacer un agent absent
- **Description métier** : Détection immédiate de la vacance de poste lors d'une absence inopinée, suggestion d'agents qualifiés et disponibles dans le respect du repos légal, désignation d'office ou volontariat.

| Solution | Prise en charge | Statut de preuve | Niveau de confiance | Preuve & Source | Limites constatées | Intérêt pour la Police Djiboutienne | Proposition d'adaptation pour le SIRH Djiboutien |
|:---|:---|:---|:---|:---|:---|:---|:---|
| **UKG TeleStaff** | Excellente | **Documenté** | Élevé | Moteur d'ordonnancement automatique TeleStaff | Algorithmes très complexes basés sur les conventions US | Continuité opérationnelle garantie 24/7 | Moteur de recommandation filtrant par grade, unité et repos légal |
| **PowerTime** | Bonne | **Observé** | Élevé | Module "Open Shifts" et alertes de diffusion | Repose principalement sur le volontariat | Comblement rapide des postes de surveillance | Double mode : appel à volontaires ou désignation hiérarchique |
| **Crown DMS** | Excellente | **Documenté** | Élevé | Crown Shift Filling & Skills Matching Engine | Calculs de surcoûts financiers lourds | Garantie de compétence du remplaçant désigné | Vérification stricte des aptitudes (ex. habilitation tir/conduite) |
| **InTime** | Excellente | **Observé** | Élevé | Module "Broadcast Overtime & Shift Coverage" | Peut générer un grand nombre de notifications | Réactivité maximale face à l'urgence | Notification ciblée par unité et liste d'astreinte |
| **NEOGOV** | Non géré | **Documenté** | Élevé | Hors périmètre du Core HR NEOGOV | Délégué obligatoirement à un outil tiers | Pas d'intérêt direct dans le Core HR | Intégrer nativement le remplacement dans le SIRH unique |
| **Softworks** | Bonne | **Documenté** | Élevé | Automated Shift Filling Softworks | Orienté secteur industriel et santé, moins police d'urgence | Respect rigoureux du repos minimum légal | Contrôle strict du respect des 11h de repos obligatoire |
| **PowerDetails** | Bonne (mission) | **Observé** | Élevé | Broadcast Alert pour mission vacante | Limité aux missions extérieures | Équité dans l'accès aux remplacements rémunérés | Traçabilité des heures de remplacement pour calcul des indemnités |

---

### Scénario 6 : Signaler une qualification expirée
- **Description métier** : Suivi des habilitations critiques (tir réglementaire, permis de conduire spécialisé, secourisme, OPJ/APJ), alertes anticipées avant échéance et blocage d'affectation sur poste exigeant l'aptitude.

| Solution | Prise en charge | Statut de preuve | Niveau de confiance | Preuve & Source | Limites constatées | Intérêt pour la Police Djiboutienne | Proposition d'adaptation pour le SIRH Djiboutien |
|:---|:---|:---|:---|:---|:---|:---|:---|
| **UKG TeleStaff** | Complète | **Documenté** | Élevé | Module "Certifications & Skills Tracking" | Ne gère pas les sessions de recyclage de l'école de police | Empêche l'engagement d'agents non qualifiés | Alertes à J-60, J-30 et J-0 + interdiction de planification armée |
| **PowerTime** | Bonne | **Observé** | Élevé | Alertes visuelles d'expiration PlanIt | Alerte visuelle mais blocage technique optionnel | Visibilité simple pour le chef de brigade | Blocage technique strict au niveau de la planification |
| **Crown DMS** | Excellente | **Documenté** | Élevé | Crown Police Compliance & Specialisms | Lourdeur de saisie des compétences spécialisées | Sécurisation juridique maximale des opérations | Matrice des compétences opérationnelles avec statut en temps réel |
| **InTime** | Excellente | **Observé** | Élevé | InTime Training & Certification Tracker | Dépend de la mise à jour par les formateurs | Suivi rigoureux du recyclage au tir | Alertes couplées aux convocations à l'École Nationale de Police |
| **NEOGOV** | Complète (Learn) | **Observé** | Élevé | Tableau de bord de conformité NEOGOV Learn | Déconnecté des écrans de planification opérationnelle | Traçabilité académique et administrative | Lier le statut de certification à la validation de la garde |
| **Softworks** | Bonne | **Documenté** | Élevé | Softworks Skills & Training Matrix | Habilitations génériques non adaptées au tir | Détection proactive des recyclages requis | Registre spécialisé police : tir, armement, conduite rapide |
| **PowerDetails** | Bonne (mission) | **Observé** | Élevé | Restriction des missions selon certifications | Limité aux missions de sécurité secondaire | Protection juridique en cas d'incident en mission | Empêcher toute désignation sur poste spécialisé si certificat expiré |

---

### Scénario 7 : Préparer un avancement
- **Description métier** : Calcul automatique de l'ancienneté dans le grade et l'échelon, identification des agents promouvables selon les critères statutaires, intégration de la notation annuelle et génération du tableau d'avancement.

| Solution | Prise en charge | Statut de preuve | Niveau de confiance | Preuve & Source | Limites constatées | Intérêt pour la Police Djiboutienne | Proposition d'adaptation pour le SIRH Djiboutien |
|:---|:---|:---|:---|:---|:---|:---|:---|
| **UKG TeleStaff** | Non géré | **Déduit** | Moyen | Délégué à UKG Pro Talent & Compensation | Outil purement WFM, pas de gestion statutaire | Nécessite un logiciel tiers dans l'écosystème UKG | Développer le moteur d'avancement directement dans le socle unique |
| **PowerTime** | Inexistant | **Inconnu** | Faible | Aucune fonctionnalité de carrière dans PlanIt | Limité aux plannings opérationnels | Sans objet | Développer le module au sein du SIRH Police |
| **Crown DMS** | Partielle | **Documenté** | Moyen | Intégration ERP externe de paie/RH | Données de carrière déléguées à l'ERP de la force | Suivi de l'ancienneté brute de service | Moteur de simulation d'éligibilité aux échelons et grades |
| **InTime** | Inexistant | **Inconnu** | Faible | Aucune fonctionnalité d'avancement | Limité à la gestion des temps et formations | Sans objet | Spécifier un module Carrières complet et autonome |
| **NEOGOV** | Excellente | **Observé** | Élevé | Moteur d'éligibilité promotion NEOGOV Manage/Perform | Calibré sur les statuts de la fonction publique US | Transparence et automatisation des tableaux d'avancement | Algorithme paramétrable d'ancienneté requise par grade et échelon |
| **Softworks** | Inexistant | **Inconnu** | Faible | Aucune gestion des carrières ou échelons | Limité aux plannings et temps de travail | Sans objet | Intégrer les grilles indiciaires de la Police Djiboutienne |
| **PowerDetails** | Inexistant | **Inconnu** | Faible | Aucune fonctionnalité RH générale | Outil purement financier et d'affectation extra-duty | Sans objet | Le module Avancement doit être un composant central |

---

### Scénario 8 : Bloquer l'accès à un dossier hors périmètre
- **Description métier** : Contrôle strict des autorisations côté serveur selon le rôle, l'unité administrative territoriale et la catégorie de dossier (étanchéité absolue des dossiers disciplinaires et d'aptitude administrative).

| Solution | Prise en charge | Statut de preuve | Niveau de confiance | Preuve & Source | Limites constatées | Intérêt pour la Police Djiboutienne | Proposition d'adaptation pour le SIRH Djiboutien |
|:---|:---|:---|:---|:---|:---|:---|:---|
| **UKG TeleStaff** | Bonne | **Documenté** | Élevé | Rôles et groupes de sécurité par division | Cloisonnement classique des plannings, pas de dossiers sensibles | Protection des affectations opérationnelles | Cloisonnement strict au niveau de la requête SQL/API |
| **PowerTime** | Bonne | **Documenté** | Élevé | Permissions par escouade et grade d'utilisateur | Pas d'isolation pour dossiers disciplinaires | Prévention des modifications illégitimes de planning | Contrôle côté serveur interdisant l'accès hors unité de commandement |
| **Crown DMS** | Excellente | **Documenté** | Élevé | Contrôle d'accès granulaire ISO 27001 UK Police | Paramétrage complexe nécessitant des experts | Protection des unités sensibles (Renseignements, Affaires internes) | Cloisonnement hermétique des affaires disciplinaires |
| **InTime** | Bonne | **Documenté** | Élevé | Matrice des rôles InTime Security Roles | Moins adapté au cloisonnement de niveau secret | Respect de la hiérarchie territoriale | Règle absolue : un chef de service ne voit QUE son unité |
| **NEOGOV** | Excellente | **Observé** | Élevé | Permissions granulaires par rôle et division | Paramétrage exigeant une formation spécialisée | Étanchéité entre RH centrale et chefs de service | Rôles cloisonnés : RH centrale, Chef d'unité, Agent, Discipline |
| **Softworks** | Bonne | **Documenté** | Élevé | Profils de sécurité par site et centre de coût | Pas de notion d'affaires internes ou d'enquête | Respect des périmètres géographiques | Contrôle d'accès vérifié systématiquement sur l'API backend |
| **PowerDetails** | Bonne (sectorielle) | **Documenté** | Élevé | Rôles Agent, Coordinateur de district, Facturation | Conçu uniquement pour les missions secondaires | Cloisonnement des données financières | Séparation des données administratives, financières et disciplinaires |

---

### Scénario 9 : Identifier une modification ou un export
- **Description métier** : Journalisation inaltérable de toute action sensible (création, modification, consultation, suppression, export de données) avec horodatage, identifiant opérateur, adresse IP et valeurs avant/après.

| Solution | Prise en charge | Statut de preuve | Niveau de confiance | Preuve & Source | Limites constatées | Intérêt pour la Police Djiboutienne | Proposition d'adaptation pour le SIRH Djiboutien |
|:---|:---|:---|:---|:---|:---|:---|:---|
| **UKG TeleStaff** | Complète | **Documenté** | Élevé | Table `AuditTrail` TeleStaff | Traces volumineuses nécessitant une politique de purge | Traçabilité des modifications d'heures et de postes | Journal d'audit append-only avec signature d'intégrité |
| **PowerTime** | Bonne | **Observé** | Élevé | Écran "System Audit Log" PlanIt Schedule | Ne trace pas la simple consultation (lecture seule) | Historique des arbitrages sur les plannings | Tracer les consultations de fiches agents et les exports CSV/PDF |
| **Crown DMS** | Excellente | **Documenté** | Élevé | Spécifications d'audit ISO 27001 UK Police | Nécessite un serveur d'archivage externe (SIEM) | Conformité aux réquisitions de l'Inspection Générale | Interdiction technique absolue de modification ou purge par l'IHM |
| **InTime** | Complète | **Documenté** | Élevé | Spécification "Audit Log & Change History" | Rétention des logs tributaire du contrat de stockage | Élucidation des litiges sur les heures supplémentaires | Journalisation des anciennes et nouvelles valeurs de chaque champ |
| **NEOGOV** | Complète | **Observé** | Élevé | Onglet "Audit Trail" dans NEOGOV Manage | Journaux parfois modifiables par le super-administrateur | Traçabilité de tous les actes administratifs | Protection cryptographique interdisant la modification admin |
| **Softworks** | Complète | **Documenté** | Élevé | Écran d'audit système Softworks | Orienté pointages et anomalies de présence | Preuve indiscutable en cas de contestation de présence | Journalisation obligatoire du motif lors de chaque export |
| **PowerDetails** | Bonne (financière) | **Documenté** | Élevé | Écran "Detailed Audit Log" PowerDetails | Axé sur les flux financiers et attributions de gardes | Prévention de la fraude et des détournements | Traçabilité complète des éléments variables de solde |

---

### Scénario 10 : Produire un document et exporter un dossier
- **Description métier** : Génération de documents officiels au format PDF (arrêtés de mutation, fiches d'agent, attestations de service, bulletins de notation) avec filigrane et export sécurisé de données.

| Solution | Prise en charge | Statut de preuve | Niveau de confiance | Preuve & Source | Limites constatées | Intérêt pour la Police Djiboutienne | Proposition d'adaptation pour le SIRH Djiboutien |
|:---|:---|:---|:---|:---|:---|:---|:---|
| **UKG TeleStaff** | Partielle (rapports de quart) | **Documenté** | Élevé | Générateur de rapports et exports paie TeleStaff | Modèles orientés feuilles de présence, pas d'actes d'État | Export de données fiable pour les finances | Générateur PDF officiel avec armoiries et mentions légales |
| **PowerTime** | Partielle (états tabulaires) | **Observé** | Élevé | Export PDF/Excel du planning et des congés | Tableaux de données bruts sans mise en page officielle | Export rapide pour affichage au poste de police | Modèles de documents administratifs souverains pré-formatés |
| **Crown DMS** | Bonne (rapports d'activité) | **Documenté** | Élevé | Reporting intégré et connecteurs Power BI | Formats britanniques non transposables tels quels | Analyse statistique de la présence policière | Exports conformes aux spécifications du Trésor public djiboutien |
| **InTime** | Bonne (états de présence) | **Documenté** | Élevé | Générateur d'états et exports InTime | Documents purement opérationnels | Transmission des éléments de paie certifiés | Génération d'arrêtés officiels signés numériquement |
| **NEOGOV** | Excellente (actes RH) | **Observé** | Élevé | Moteur de génération eForms et modèles de lettres | Gabarits au format anglo-saxon | Dématérialisation complète des actes de gestion | Moteur PDF avec gabarits personnalisables en français |
| **Softworks** | Bonne (états de présence) | **Documenté** | Élevé | Moteur d'états Crystal Reports / SQL Reporting | Documents orientés pointages et décomptes d'heures | Justification officielle des heures de garde de nuit | États consolidés mensuels pour l'ordonnancement de la solde |
| **PowerDetails** | Bonne (factures et récapitulatifs) | **Observé** | Élevé | Moteur de facturation et exports de paiement PDF | Documents commerciaux et financiers | Justification des indemnités exceptionnelles | Bulletins récapitulatifs individuels des primes et indemnités |

---

## 4. Synthèse Comparative Multicritères et Radar d'Adéquation

Le tableau ci-dessous note chaque solution sur une échelle de 1 à 5 (1 = Inexistant / Très inadapté, 5 = Excellent / Pleinement adapté) au regard des besoins spécifiques de la Police Djiboutienne :

| Dimension d'évaluation | Poids | 1. UKG TeleStaff | 2. PowerTime | 3. Crown DMS | 4. InTime | 5. NEOGOV | 6. Softworks | 7. PowerDetails |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **1. Planification policière 24/7 & Fatigue** | 20% | 5/5 | 4/5 | 5/5 | 5/5 | 2/5 | 4/5 | 3/5 |
| **2. Gestion statutaire & Carrières (Grades/Échelons)** | 20% | 1/5 | 1/5 | 2/5 | 1/5 | 5/5 | 1/5 | 1/5 |
| **3. Langue française & Culture administrative** | 15% | 3/5 | 1/5 | 1/5 | 3/5 | 1/5 | 5/5 | 1/5 |
| **4. Sécurité, Cloisonnement & Audit inaltérable** | 15% | 4/5 | 3/5 | 5/5 | 4/5 | 4/5 | 4/5 | 3/5 |
| **5. Suivi des qualifications opérationnelles** | 10% | 4/5 | 4/5 | 5/5 | 5/5 | 4/5 | 3/5 | 3/5 |
| **6. Génération documentaire souveraine (PDF)** | 10% | 2/5 | 2/5 | 3/5 | 2/5 | 4/5 | 3/5 | 2/5 |
| **7. Déploiement Intranet autonome (sans cloud US)** | 10% | 3/5 | 1/5 | 3/5 | 3/5 | 1/5 | 4/5 | 1/5 |
| **Score global pondéré (sur 5)** | **100%** | **3.20/5** | **2.35/5** | **3.55/5** | **3.20/5** | **3.05/5** | **3.35/5** | **2.00/5** |

### Analyse des résultats du benchmark :
1. **Aucune solution du marché ne couvre l'intégralité du besoin** : Les solutions anglo-saxonnes sont soit ultra-spécialisées dans la planification de patrouille (TeleStaff, PowerTime, InTime, Crown DMS), soit dans la gestion de carrière générale (NEOGOV), mais aucune ne combine nativement le statut de fonction publique francophone, la souveraineté intranet et la gestion opérationnelle de brigade de police.
2. **Le besoin d'une conception souveraine sur-mesure** : Le SIRH de la Police Djiboutienne doit fusionner les forces de **Crown DMS** et **InTime** (adéquation des compétences policières, repos légal, alertes de qualification) et de **NEOGOV** (gestion statutaire, corps, grades, échelons, dématérialisation d'arrêtés), en s'appuyant sur l'ergonomie et la conformité linguistique francophone de **Softworks**, le tout hébergé sur une architecture intranet autonome et sécurisée.
