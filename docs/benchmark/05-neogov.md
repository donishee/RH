# Fiche Benchmark 05 : NEOGOV (Insight, HRIS/Manage, Onboard, Perform, Learn, Policy)

## 1. Fiche d'identification
- **Éditeur** : NEOGOV Inc. (El Segundo, Californie, États-Unis)
- **Nom exact du produit** : NEOGOV Public Sector HR Suite (comprenant les modules Insight, Core HR/Manage, Onboard, Perform, Learn, PowerPolicy, eForms)
- **Cible métier** : Secteur public, gouvernements locaux, ministères, départements de police et de sécurité publique
- **Références officielles** : `https://www.neogov.com/` et portail des carrières du secteur public GovernmentJobs.com

## 2. Périmètre fonctionnel
NEOGOV est la suite logicielle la plus répandue dans le secteur public américain pour la gestion globale des ressources humaines :
- **Recrutement spécialisé pour la sécurité publique (Insight & Vetted)** : Gestion des concours administratifs, enquêtes d'habilitation et d'antécédents pour policiers, épreuves physiques et commissions de sélection.
- **Dossier central de l'agent et gestion statutaire (Core HR / Manage)** : Dossier électronique unique de l'agent, gestion des grilles indiciaires (Step-and-Grade scales), corps, grades, échelons et positions administratives.
- **Intégration et dématérialisation documentaire (Onboard & eForms)** : Dématérialisation des actes administratifs, transmission électronique des dossiers et formulaires internes de mutation ou de déclaration.
- **Évaluation de la performance (Perform)** : Évaluation périodique et notation des agents, suivi des objectifs annuels de service, revues d'aptitude et de discipline préliminaire.
- **Gestion de la formation et conformité policière (Learn)** : Suivi des obligations de formation continue, conformité aux standards de police (ex. POST - Peace Officer Standards and Training), délivrance d'attestations.
- **Diffusion et traçabilité des règlements et ordres (Policy / PowerPolicy)** : Diffusion sécurisée des règlements intérieurs, ordres généraux et consignes opérationnelles avec émargement électronique obligatoire traçable.

## 3. Architecture technique & Déploiement
- **Mode de déploiement** : Solution 100% Cloud multi-tenant (SaaS) hébergée sur une infrastructure conforme aux exigences gouvernementales américaines (SOC 2, ISO 27001, alignement CJIS).
- **Architecture modulaire** : Socle de données unifié interconnectant les modules spécialisés via une couche d'API interne.
- **Sécurité et intégrité** : Contrôle d'accès basé sur les rôles (RBAC), SSO, chiffrement systématique des données au repos et en transit, piste d'audit inviolable adaptée aux réquisitions judiciaires et demandes d'accès aux documents administratifs (*Freedom of Information Act*).

## 4. Existence et caractéristiques du client Windows
- **Client lourd dédié** : Inexistant. NEOGOV est entièrement conçu comme une application Web native (SaaS).
- **Accès sous Windows** : Totalement compatible avec tous les postes Windows via les navigateurs d'entreprise (Microsoft Edge, Google Chrome). Aucune installation sur poste client.
- **Portails dédiés** : Portail d'administration pour la DRH, portail superviseur pour les chefs de service, portail en libre-service agent (Employee Self-Service) accessible sur PC et mobile.

## 5. Disponibilité de la langue française
- **Interface utilisateur** : Essentiellement en anglais (conçu pour le secteur public américain). Possibilité de personnaliser les libellés de champs et les formulaires personnalisés en français.
- **Documentation et guides** : Guides de support, livres blancs et assistance technique exclusivement en anglais.
- **Traduction native** : Pas de pack de langue française officiel complet couvrant l'ensemble des modules.

## 6. Conditions d'accès et documentation officielle
- **Documentation officielle** : Disponible sur le centre d'aide en ligne NEOGOV et portails clients. Nombreux livres blancs méthodologiques sur les carrières publiques et la conformité policière.
- **Installateurs et essais** : Aucun accès libre ni installateur disponible. Démonstrations guidées sur rendez-vous pour les directeurs des ressources humaines.
- **Modèle de licence** : Abonnement annuel par module sélectionné, indexé sur l'effectif total de l'organisation.

## 7. Évaluation des 10 scénarios clés de gestion policière

| # | Scénario policier | Fonctionnalité & Source | Preuve | Statut de preuve | Niveau de confiance | Limites constatées | Intérêt pour la Police Djiboutienne | Proposition d'adaptation pour le SIRH Djiboutien |
|---|-------------------|-------------------------|--------|------------------|---------------------|--------------------|--------------------------------------|--------------------------------------------------|
| 1 | Créer un agent | Création dans Core HR avec matricule unique, grade sur grille indiciaire et affectation | Module NEOGOV Manage "Employee Record Creation" | **Observé** | Élevé | Conçu pour les statuts de la fonction publique US (Civil Service tiers) | Gestion rigoureuse des corps, grades et échelons | Adapter le dossier agent aux corps et grades de la Police Djiboutienne |
| 2 | Muter un agent sans perte d'historique | Changement de poste et d'unité avec conservation de tout le dossier de carrière | Module "Job History & Position Reclassification" | **Observé** | Élevé | Les mouvements sont parfois lourds à enregistrer pour des détachements temporaires | Traçabilité continue de l'ensemble de la carrière du fonctionnaire | Enregistrer les mutations avec date d'effet, unité d'origine, unité d'accueil et acte |
| 3 | Soumettre puis valider un congé | Module Time-Off avec calcul de solde et validation hiérarchique configurable | Workflow d'approbation d'absence dans NEOGOV Manage | **Observé** | Élevé | Moins interconnecté en temps réel avec les vacations opérationnelles de patrouille | Gestion unifiée des droits statutaires à congés | Intégrer la validation des congés avec le planning prévisionnel de service |
| 4 | Refuser une demande avec motif | Motif de refus obligatoire avec journalisation et retour d'information à l'agent | Boîte de validation de rejet dans l'interface superviseur | **Observé** | Élevé | La notification est standardisée, peu de souplesse pour motivation juridique poussée | Clarté de la chaîne de commandement administratif | Fournir un motif réglementaire codifié et une zone de texte motivant le refus |
| 5 | Remplacer un agent absent | Non géré directement (nécessite l'intégration de la solution soeur PowerTime) | Séparation fonctionnelle entre NEOGOV Core HR et PowerTime | **Documenté** | Élevé | La frontière entre gestion statutaire et gestion opérationnelle impose deux outils | Éviter la rupture de charge entre le bureau RH et le commissariat de terrain | Intégrer directement le module de remplacement au sein de l'outil unique SIRH |
| 6 | Signaler qualification expirée | Module "Learn" avec alertes automatiques d'expiration des compétences réglementaires | Tableau de bord de conformité des formations obligatoires | **Observé** | Élevé | Ne bloque pas directement les systèmes de patrouille opérationnelle | Prévention des manquements aux formations obligatoires de police | Lier les qualifications du module Formation aux autorisations de prise de poste |
| 7 | Préparer un avancement | Module "Perform" croisant notation annuelle, ancienneté d'échelon et éligibilité | Grilles de calcul d'éligibilité à la promotion dans Manage | **Observé** | Élevé | Les règles américaines d'avancement diffèrent du cadre administratif francophone | Automatisation de la préparation des tableaux d'avancement de grade | Moteur automatisé de détection des agents promouvables selon les critères djiboutiens |
| 8 | Bloquer accès hors périmètre | Rôles granulaires définis par groupe d'utilisateurs, département et niveau d'accès | Matrice des permissions et profils de sécurité dans Manage | **Observé** | Élevé | Paramétrage exigeant une expertise technique initiale | Cloisonnement strict des données personnelles et d'évaluation | Implémenter un cloisonnement strict par rôle et unité dès la conception du backend |
| 9 | Identifier modification ou export | Journal d'audit complet retraçant les modifications de profil, de solde et exports | Onglet "Audit Trail" présent sur chaque fiche agent et table | **Observé** | Élevé | Les journaux d'audit ne sont pas toujours protégés contre des purges administratives | Garantie d'intégrité face aux recours et contentieux administratifs | Table d'audit inaltérable (*append-only*) non modifiable même par l'administrateur |
| 10 | Produire document & exporter dossier | Génération de documents personnalisés, arrêtés types et exports personnalisables | Moteur de formulaires et de génération documentaire eForms | **Observé** | Élevé | Les gabarits par défaut sont au format américain sans mise en page officielle africaine | Édition instantanée des actes d'avancement et de mutation | Modèles de documents officiels au format PDF avec signature et entête souverain |

## 8. Synthèse et enseignements pour le projet
- **Points forts à retenir** : Exhaustivité de la couverture de la carrière publique (recrutement, gestion statutaire, échelons, formation, notation, diffusion d'ordres).
- **Limites à combler** : Déconnexion historique avec la planification opérationnelle des vacations de patrouille, solution 100% cloud américain, absence de langue française.
- **Adaptation requise** : Fusionner la richesse de la gestion statutaire de carrière publique (type NEOGOV) avec la planification opérationnelle de police (type TeleStaff) dans une solution 100% française et souveraine.
