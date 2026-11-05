# Fiche Benchmark 06 : Softworks (Workforce Management & Police Rostering)

## 1. Fiche d'identification
- **Éditeur** : Softworks Ltd (Bray, Irlande / Bureaux au Royaume-Uni, Canada, États-Unis)
- **Nom exact du produit** : Softworks Workforce Management / Softworks Police & Emergency Services Rostering
- **Cible métier** : Police, services d'urgence, santé publique, administrations d'État
- **Références officielles** : `https://www.softworks.com/` et études de cas sectorielles police

## 2. Périmètre fonctionnel
Softworks propose une plateforme intégrée de gestion des temps, de planification d'équipes et de contrôle des présences adaptée aux contraintes des services d'urgence :
- **Planification des vacations sous contraintes réglementaires (Advanced Rostering)** : Prise en charge des cycles continus de brigade, horaires décalés, astreintes et permanences de nuit.
- **Gestion des présences et contrôle d'accès (Time & Attendance)** : Suivi du temps réel de présence, compatibilité avec terminaux biométriques (empreinte/visage), badges RFID et pointage virtuel sécurisé.
- **Contrôle de la législation du travail et conventions (Compliance Engine)** : Respect strict des durées maximales de travail, des temps de repos quotidien (ex. 11h consécutives) et des règles syndicales.
- **Gestion des absences et congés (Absence Management)** : Workflow dématérialisé de demande et d'autorisation de congés, suivi des absences pour maladie et accidents de service.
- **Gestion des heures supplémentaires et des coûts (Overtime Tracking)** : Calcul automatique des majorations (dimanches, nuits, jours fériés) et équilibrage des heures supplémentaires.
- **Portail et application mobile en libre-service (ESS Mobile)** : Consultation des plannings, déclaration de disponibilités, échanges de vacations et demandes de congés depuis smartphone ou PC.

## 3. Architecture technique & Déploiement
- **Mode de déploiement** :
  - *Cloud Dédié / SaaS* : Hébergement en centre de données sécurisé européen (conforme RGPD / ISO 27001).
  - *On-Premise* : Déploiement classique sur serveurs dédiés de l'administration cliente sous Windows Server avec base de données Microsoft SQL Server ou Oracle.
- **Architecture logicielle** : Modèle 3-tiers modulaire avec services d'intégration pour pointeuses physiques et systèmes de paie centraux.
- **Sécurité et intégrité** : Chiffrement des communications, journalisation complète des accès et modifications, gestion fine des habilitations d'accès aux données de présence.

## 4. Existence et caractéristiques du client Windows
- **Client lourd dédié** : Historiquement disponible sous Windows (client d'administration Win32), désormais remplacé par un client riche d'administration Web responsive.
- **Accès sous Windows** : Accès transparent pour les utilisateurs et gestionnaires via les navigateurs Web sur postes Windows d'entreprise.
- **Terminaux physiques compatibles Windows** : Intégration possible avec des postes de pointage fixes et tablettes Windows durcies pour postes de contrôle ou entrées de commissariats.
- **Application mobile** : Application native pour smartphones Android et iOS.

## 5. Disponibilité de la langue française
- **Interface utilisateur** : Disponible en français (plateforme multilingue éprouvée déployée au Canada, en Belgique et en Suisse : français, anglais, espagnol, allemand).
- **Documentation et guides** : Guides utilisateurs et supports de formation disponibles en français ; documentations techniques d'architecture disponibles en français et anglais.
- **Support technique** : Équipes de support francophones disponibles.

## 6. Conditions d'accès et documentation officielle
- **Documentation officielle** : Manuels d'utilisation, guides d'installation et fiches de spécification disponibles via le portail client Softworks et lors des appels d'offres publics.
- **Installateurs et essais** : Aucun installateur public en libre téléchargement. Démonstrations guidées assurées par l'équipe avant-vente.
- **Modèle de licence** : Licence par utilisateur (On-Premise avec maintenance annuelle) ou abonnement SaaS mensuel/annuel.

## 7. Évaluation des 10 scénarios clés de gestion policière

| # | Scénario policier | Fonctionnalité & Source | Preuve | Statut de preuve | Niveau de confiance | Limites constatées | Intérêt pour la Police Djiboutienne | Proposition d'adaptation pour le SIRH Djiboutien |
|---|-------------------|-------------------------|--------|------------------|---------------------|--------------------|--------------------------------------|--------------------------------------------------|
| 1 | Créer un agent | Fiche complète collaborateur avec matricule, unité, régime horaire et droits | Manuel utilisateur Softworks "Personnel Records" | **Documenté** | Élevé | Très axé gestion du temps et pointage, pas de corps statutaire militaire/policier | Précision du paramétrage des cycles de travail | Intégrer les cycles de travail Softworks avec la classification statutaire de la Police Nationale |
| 2 | Muter un agent sans perte d'historique | Changement de département et de groupe de roulement avec conservation des pointages | Module "Department Transfers & Multi-Contract Tracking" | **Documenté** | Élevé | Historique conservé principalement sous l'angle du cumul d'heures et des plannings | Continuité des droits acquis et des pointages | Historiser conjointement les données de carrière et les droits acquis au repos |
| 3 | Soumettre puis valider un congé | Workflow hiérarchique avec calcul dynamique du solde restant et validation N+1/N+2 | Écran de validation des congés portail manager Softworks | **Observé** | Élevé | Règles de report de congés parfois complexes à adapter aux décrets locaux | Fiabilité du décompte des congés et réduction des erreurs | Décompte automatique en jours ouvrables avec blocage en cas de dépassement de solde |
| 4 | Refuser une demande avec motif | Motif de rejet obligatoire sélectionné dans une liste et champ libre d'explication | Formulaire de décision de refus avec notification e-mail | **Observé** | Élevé | Notification impersonnelle sans référence à l'article réglementaire applicable | Transparence et formalisation du refus pour nécessités de service | Prévoir un modèle de notification de refus mentionnant la continuité du service public |
| 5 | Remplacer un agent absent | Remplacement automatique par détection des agents qualifiés en repos non astreints | Module "Automated Shift Filling & Roster Balancing" | **Documenté** | Élevé | Repose sur l'acceptation volontaire de l'agent via application mobile | Réactivité pour compléter les effectifs d'un poste de police | Permettre l'arbitrage hiérarchique : volontariat prioritaire ou réquisition de service |
| 6 | Signaler qualification expirée | Module de suivi des compétences avec matrice de polyvalence et alertes d'échéance | Matrice de compétences Softworks Skills & Training Matrix | **Documenté** | Élevé | Lié aux habilitations professionnelles génériques, pas aux habilitations judiciaires | Contrôle des aptitudes au tir, conduite rapide et armement | Alertes configurables à 60, 30 et 7 jours avec notification au bureau de formation |
| 7 | Préparer un avancement | Non pris en charge par Softworks (limité à la gestion du temps et de la présence) | Absence de module de promotion et d'échelons indiciaires | **Inconnu** | Faible | L'outil ne gère pas les commissions administratives paritaires ni les notations | Nécessité d'une couverture globale de la carrière | Développer le moteur d'évaluation et de promotion statutaire dans le SIRH |
| 8 | Bloquer accès hors périmètre | Sécurité par centre de coût, département, site géographique et rôle système | Matrice des permissions et profils de sécurité Softworks | **Documenté** | Élevé | Pas de cloisonnement spécifique pour les dossiers d'enquête interne ou discipline | Contrôle d'accès rigoureux selon l'affectation territoriale | Isolation stricte par commissariat et direction centrale dans l'architecture |
| 9 | Identifier modification ou export | Journal d'audit complet de toutes les modifications de plannings, pointages et droits | Écran d'audit système avec horodatage, auteur et modifications | **Documenté** | Élevé | Les journaux sont orientés traçabilité des temps et pointages | Intégrité probante face aux contestations de temps de service | Piste d'audit inaltérable couvrant l'ensemble des modules RH et administratifs |
| 10 | Produire document & exporter dossier | Génération de récapitulatifs d'heures, états d'absentéisme et interfaces paie | Moteur d'états intégrés Crystal Reports / SQL Reporting | **Documenté** | Élevé | Orienté feuilles de paie et temps de travail, pas d'actes juridiques statutaires | Justification financière des indemnités de garde et de sujétion | Générer des arrêtés administratifs officiels et des exports structurés pour le Trésor public |

## 8. Synthèse et enseignements pour le projet
- **Points forts à retenir** : Disponibilité complète en français, excellence du moteur de gestion des temps et des pointages, respect scrupuleux des temps de repos légaux.
- **Limites à combler** : Spécialisation temps de travail/présence sans gestion de carrière, notation, discipline ou statuts des fonctionnaires de police.
- **Adaptation requise** : Reprendre la rigueur du calcul du temps et des alertes de repos en langue française, tout en concevant un cœur de gestion administrative statutaire complet.
