# Fiche Benchmark 04 : InTime (InTime Solutions)

## 1. Fiche d'identification
- **Éditeur** : InTime Solutions Inc. (Vancouver, Canada / États-Unis)
- **Nom exact du produit** : InTime Police Scheduling and Workforce Management Software
- **Cible métier** : Forces de police municipales, comtés, police d'État, détachements de gendarmerie, centres de communication d'urgence
- **Références officielles** : `https://intime.com/` et études de cas Police1

## 2. Périmètre fonctionnel
InTime est une solution conçue par et pour les policiers, couvrant l'ensemble du cycle de gestion opérationnelle des effectifs :
- **Planification avancée et modèles de service (Smart Scheduling)** : Gestion de plannings complexes 24/7, rotations personnalisées, découpage par commissariats, secteurs et brigades de roulement.
- **Gestion automatisée des heures supplémentaires et du temps (Overtime & Timekeeping)** : Traçabilité des heures de vacation, des gardes, des comparutions au tribunal (*Court Appearances*) et distribution équitable des heures supplémentaires.
- **Enchères de postes et de congés (Shift & Vacation Bidding)** : Attribution transparente des vacations et des périodes de congés prioritaires selon l'ancienneté ou les points d'équité.
- **Suivi des formations et maintien des qualifications (Training & Compliance)** : Gestion du catalogue de formation, suivi des présences en stage, suivi des dates de fin de validité des certifications (tir, taser, défibrillateur, conduite d'urgence).
- **Surveillance de la fatigue et bien-être policier (Wellness & Fatigue Monitoring)** : Outils analytiques prévenant le surmenage par limitation automatique du cumul d'heures consécutives de service et de surveillance.
- **Gestion des missions extérieures (Extra Duty / Special Events)** : Planification des services d'ordre rémunérés et des réquisitions exceptionnelles.

## 3. Architecture technique & Déploiement
- **Mode de déploiement** :
  - *Cloud Dédié* : Hébergement sur AWS GovCloud (certifié CJIS, FedRAMP, SOC 2 Type II).
  - *On-Premise (Historique)* : Possibilité d'installation sur infrastructure de serveurs locaux sous Windows Server / Linux pour les forces de police exigeant une stricte souveraineté de données.
- **Architecture logicielle** : Architecture Web moderne avec base de données relationnelle sécurisée (PostgreSQL / Microsoft SQL Server) et services d'API sécurisés.
- **Haute disponibilité et intégrité** : Redondance des données, bascule automatique et politique de sauvegarde rigoureuse.

## 4. Existence et caractéristiques du client Windows
- **Client lourd dédié** : Inexistant dans les versions actuelles (anciennes versions client lourd Windows migrées vers le Web).
- **Accès sous Windows** : Interface Web universelle accessible sur tout poste Windows via navigateur d'entreprise (Edge, Chrome, Firefox) sans installation de plug-in ni de client lourd.
- **Application mobile native** : Applications téléchargeables pour smartphones policiers (iOS et Android) offrant la consultation de planning, la réception des alertes d'heures supplémentaires et la soumission d'absences.

## 5. Disponibilité de la langue française
- **Interface utilisateur** : Disponible en version bilingue anglais/français (déployé auprès de plusieurs services de police bilingues canadiens).
- **Documentation et guides** : Guides de prise en main disponibles en français pour les utilisateurs finaux ; documentations d'administration avancée principalement en anglais.
- **Terminologie policière** : Traduction adaptée aux terminologies de commandement et d'unités de police.

## 6. Conditions d'accès et documentation officielle
- **Documentation officielle** : Manuels d'utilisation, webinaires, fiches fonctionnelles et livres blancs accessibles en ligne via le centre d'aide InTime.
- **Installateurs et essais** : Pas d'installateur téléchargeable publiquement. Démonstration interactive personnalisée sur demande qualifiée.
- **Modèle de licence** : Tarification annuelle basée sur le volume d'agents actifs déclarés dans le système.

## 7. Évaluation des 10 scénarios clés de gestion policière

| # | Scénario policier | Fonctionnalité & Source | Preuve | Statut de preuve | Niveau de confiance | Limites constatées | Intérêt pour la Police Djiboutienne | Proposition d'adaptation pour le SIRH Djiboutien |
|---|-------------------|-------------------------|--------|------------------|---------------------|--------------------|--------------------------------------|--------------------------------------------------|
| 1 | Créer un agent | Création d'agent avec matricule d'insigne, unité, brigade, qualifications et statut | Fiche technique "InTime Core Employee Profile" | **Documenté** | Élevé | Très orienté profil de patrouille et planning, moins axé sur la gestion des carrières de fonctionnaires | Clarté et lisibilité de la fiche opérationnelle du policier | Consolider les informations opérationnelles et les données de gestion administrative statutaire |
| 2 | Muter un agent sans perte d'historique | Déplacement d'un agent vers une autre escouade ou unité avec conservation des plannings | Guide d'administration InTime "Transferring Personnel" | **Documenté** | Élevé | La mutation est traitée comme un changement d'assignation opérationnelle sans acte juridique lié | Conservation des états de service passés de l'agent | Lier chaque mouvement d'affectation à un arrêté ministériel ou décision du Directeur Général |
| 3 | Soumettre puis valider un congé | Soumission sur mobile/web, contrôle d'impact sur le quota de brigade, validation superviseur | Démonstration du workflow de congé InTime ESS | **Observé** | Élevé | Quotas de congés configurés par pourcentage d'escouade plutôt que par réglementation nationale | Éviter la paralysie des commissariats en période de congés | Permettre la définition d'un seuil minimal d'effectif infranchissable par brigade |
| 4 | Refuser une demande avec motif | Rejet motivé avec commentaire obligatoire et réouverture automatique de la vacation | Spécification fonctionnelle du module de temps InTime | **Documenté** | Élevé | Les motifs de refus sont libres, sans nomenclature réglementaire stricte | Justification légale des décisions hiérarchiques | Mettre en place un menu déroulant de motifs réglementaires + champ d'observation obligatoire |
| 5 | Remplacer un agent absent | Envoi automatique d'offres de remplacement aux policiers qualifiés et disponibles | Module "Overtime & Open Shift Broadcast" via SMS/App | **Observé** | Élevé | Risque d'inondation de notifications si le périmètre n'est pas ciblé | Réactivité maximale face aux absences imprévues ou renforts | Proposer les remplaçants par ordre d'éligibilité (disponibilité, repos suffisant, grade adéquat) |
| 6 | Signaler qualification expirée | Indicateur visuel d'expiration des certificats de tir, conduite et armement | Module "Training & Certification Tracker" InTime | **Observé** | Élevé | Nécessite la saisie manuelle préalable des dates de validité par les instructeurs | Maintien de l'aptitude opérationnelle et prévention des risques | Système d'alerte à 60 jours avant échéance + notification au chef d'unité |
| 7 | Préparer un avancement | Non pris en charge par InTime (limité à la gestion du temps et des qualifications) | Absence de module d'avancement indiciaire ou de notation | **Inconnu** | Faible | Outil de gestion opérationnelle, pas de gestion prévisionnelle des carrières | Indispensable pour un SIRH complet de la Police Nationale | Développer un module complet d'évaluation et de gestion des avancements de grade |
| 8 | Bloquer accès hors périmètre | Gestion des droits par groupe de sécurité, unité territoriale et fonction | Matrice de droits de sécurité InTime Security Roles | **Documenté** | Élevé | Moins étanche sur les dossiers hautement sensibles (ex. discipline) | Cloisonnement strict des données entre commissariats | Cloisonnement hermétique au niveau applicatif et API basé sur l'unité et le rôle |
| 9 | Identifier modification ou export | Journal d'audit détaillé horodaté traçant les créations, éditions et suppressions | Spécification "Audit Log & Change History" InTime | **Documenté** | Élevé | Rétention des logs dépendante de la capacité de stockage allouée | Transparence totale et conformité lors d'inspections | Journal d'audit infalsifiable avec archivage des paramètres avant/après modification |
| 10 | Produire document & exporter dossier | Rapports de présence, feuilles d'heures certifiées et export vers la paie | Générateur d'états intégrés et formats d'export CSV/PDF | **Documenté** | Élevé | Rapports préformatés orientés comptabilité des heures, peu de modèles juridiques | Exportation fidèle des données vers la direction financière | Moteur de modèles PDF émettant des fiches d'agent et attestations officielles de service |

## 8. Synthèse et enseignements pour le projet
- **Points forts à retenir** : Ergonomie éprouvée pour la police, gestion proactive des qualifications critiques, algorithmes de distribution équitable des vacations et des rappels.
- **Limites à combler** : Absence de couverture du statut général de la fonction publique (avancements, discipline, arrêtés administratifs).
- **Adaptation requise** : Intégrer les mécanismes de suivi des qualifications policières et de planification sous contraintes au sein du système complet djiboutien.
