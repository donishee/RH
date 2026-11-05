# Synthèse des Bonnes Pratiques et Recommandations d'Adaptation (R2)

## 1. Contexte et Finalité de la Rétro-Ingénierie Autorisée

L'étude comparative approfondie des sept solutions logicielles de référence internationale (UKG TeleStaff, PowerTime, Crown DMS, InTime, NEOGOV, Softworks, PowerDetails) permet de dégager l'état de l'art mondial en matière de gestion des effectifs de police et de sécurité publique.

Le présent document formalise les **bonnes pratiques réutilisables**, identifie les **pièges et limites des progiciels commerciaux**, et définit les **adaptations indépendantes recommandées** pour concevoir le SIRH souverain de la **Police Djiboutienne**, conformément aux exigences de l'Approved Task Prompt (Requirement R2).

---

## 2. Principes Directeurs Issus de l'État de l'Art

### 2.1. Les 6 Bonnes Pratiques Incontournables
1. **La planification sous contraintes d'effectifs de sécurité (Minimum Staffing Levels)** :
   - *Pratique observée* : Définition d'un seuil incompressible d'agents présents par vacation et par unité (ex. au moins 1 officier de quart, 1 planton, 2 patrouilles de 2 agents).
   - *Adaptation requise* : Tout départ en congé, stage ou détachement qui ferait chuter l'effectif prévisionnel sous le seuil d'alerte déclenche un voyant d'alerte visuel et nécessite une validation hiérarchique avec proposition de substitution.

2. **La gestion de la fatigue opérationnelle et le repos obligatoire** :
   - *Pratique observée* (Crown DMS, TeleStaff, InTime) : Application stricte du repos physiologique minimal (ex. 11 heures consécutives entre deux prises de service) et plafonnement des heures cumulées consécutives (ex. maximum 16h d'affilée en cas de crise).
   - *Adaptation requise* : Blocage automatique de la désignation d'un agent pour une vacation de renfort ou une astreinte s'il n'a pas bénéficié de son temps de repos légal, sauf dérogation d'urgence motivée par le Directeur Général.

3. **Le verrouillage opérationnel par les compétences critiques (Skills & Compliance Blocking)** :
   - *Pratique observée* (InTime, Crown DMS) : Une habilitation opérationnelle expirée (certificat de tir annuel, aptitude médicale d'aptitude au terrain, brevet de secourisme, permis de conduire lourd/rapide) interdit l'affectation sur un poste requérant cette compétence.
   - *Adaptation requise* : Le module Planning vérifie en temps réel le statut des qualifications enregistrées dans le module Formation/Qualifications. Si l'habilitation au tir ou le certificat d'aptitude est expiré, le système empêche l'assignation sur un poste armé ou de patrouille mobile.

4. **L'intégrité de l'historique et la non-régression de carrière** :
   - *Pratique observée* (NEOGOV, Softworks) : Aucune mutation ou promotion n'écrase la donnée antérieure. Chaque étape de la vie administrative de l'agent est un événement historisé avec date de début, date de fin, unité, fonction et référence de l'acte juridique.
   - *Adaptation requise* : Le dossier individuel de l'agent conserve une chronologie continue inaltérable, permettant de reconstituer ses états de service à toute date passée pour les droits à pension ou les promotions.

5. **La traçabilité forensique et l'audit inviolable (Audit Trail)** :
   - *Pratique observée* : Chaque opération d'écriture, modification, consultation sensible ou export de données fait l'objet d'un enregistrement immédiat comportant identifiant de l'opérateur, horodatage certifié, adresse IP, type d'action et deltas de valeurs.
   - *Adaptation requise* : Mise en place d'une table d'audit protégée (*append-only*), interdisant toute modification ou suppression, y compris par l'administrateur technique de base de données.

6. **L'étanchéité absolue des données sensibles et disciplinaires** :
   - *Pratique observée* : Les dossiers d'enquête interne ou de procédure disciplinaire ne sont jamais visibles dans le dossier administratif ordinaire partagé avec les chefs de service.
   - *Adaptation requise* : Séparation architecturale stricte côté serveur : le module Discipline dispose de son propre modèle d'habilitation restreint aux seuls membres de la commission de discipline et à la haute hiérarchie habilitée.

---

## 3. Recommandations Détaillées pour les 10 Scénarios Policiers

| # | Scénario policier | Meilleure pratique internationale constatée | Limite du marché commercial | Adaptation indépendante pour le SIRH Police Djiboutienne |
|---|-------------------|--------------------------------------------|-----------------------------|-----------------------------------------------------------|
| **1** | **Créer un agent** | Fiche unique centralisant matricule, identité, compétences et coordonnées (NEOGOV/Crown) | Manque d'intégration du statut fonction publique djiboutienne | Structurer la fiche avec : Matricule unique inaltérable, État civil complet, Corps statutaire, Grade, Échelon, Date de nomination, Date d'effet, Unité d'affectation, Emploi occupé, Pièces jointes numérisées obligatoires (Arrêté de recrutement, extrait d'acte de naissance). |
| **2** | **Le muter sans perdre son historique** | Continuité chronologique des affectations sans écrasement (Crown DMS) | Les outils de planning traitent la mutation comme un simple changement d'équipe sans acte juridique | Workflow de mutation en 4 étapes : 1. Proposition/Demande, 2. Décision du Directeur Général avec n° d'arrêté, 3. Clôture de l'affectation actuelle à date d'effet J-1, 4. Ouverture automatique de la nouvelle affectation à date d'effet J. L'historique complet reste consultable à vie. |
| **3** | **Soumettre puis valider un congé** | Libre-service agent, calcul de solde en temps réel et validation N+1/N+2 avec alerte de quota (TeleStaff) | Décomptes en heures inadaptés aux statuts de la fonction publique africaine | Décompte strict en jours ouvrables selon le statut général djiboutien. Circuit d'approbation : 1. Soumission agent avec solde prévisionnel, 2. Avis motivé du chef de brigade (contrôle effectif minimum), 3. Validation du chef de service/commissaire, 4. Enregistrement RH automatique. |
| **4** | **Refuser une demande avec motif** | Rejet motivé obligatoire avec notification instantanée (Softworks/PowerTime) | Motifs génériques en anglais sans référence légale | Obligation de sélectionner un motif réglementaire codifié (ex. Nécessité absolue de service, Quota d'absence atteint, Période d'alerte sécuritaire) + commentaire textuel obligatoire. Non-débit du solde, traçabilité dans l'historique et possibilité de recours gracieux. |
| **5** | **Remplacer un agent absent** | Diffusion d'offres de remplacement aux profils qualifiés respectant le repos légal (InTime/TeleStaff) | Dépendance exclusive au volontariat ou complexité excessive des calculs syndicaux US | Module d'aide au remplacement en cas d'absence imprévue : l'application présente la liste ordonnée des agents de même grade/qualification, rattachés à l'unité ou aux unités de réserve, ayant respecté leur repos légal de 11h. Possibilité de désignation d'office avec ordre de service. |
| **6** | **Signaler une qualification expirée** | Alerte visuelle et blocage de prise de poste armée ou spécialisée (InTime/Crown DMS) | Alertes souvent non bloquantes dans les outils généralistes | Registre des aptitudes et qualifications policières (Tir réglementaire, Habilitation arme spécifique, Permis véhicule prioritaire, Habilitation OPJ/APJ). Indicateurs à J-60 (Avertissement), J-30 (Urgence convocation), J-0 (Expiration et blocage d'assignation opérationnelle armée). |
| **7** | **Préparer un avancement** | Moteur de calcul d'éligibilité selon ancienneté d'échelon et notation (NEOGOV) | Inexistant dans 6 solutions sur 7 (délégué à des logiciels tiers) | Moteur d'avancement statutaire intégré : Détection automatique des agents remplissant les conditions d'ancienneté requise dans l'échelon ou le grade. Intégration de la note de l'évaluation annuelle. Génération de la liste des promouvables pour la commission administrative d'avancement. |
| **8** | **Bloquer l'accès hors périmètre** | Ségrégation stricte des rôles et des divisions territoriales (Crown/NEOGOV) | Paramétrage complexe, failles fréquentes sur les dossiers disciplinaires | Cloisonnement hermétique au niveau de l'API et de la base : un chef de service ne peut consulter que les agents de son unité. Cloisonnement étanche des dossiers disciplinaires (visible uniquement par la Commission de discipline et le Directeur Général) et médicaux (aucune donnée médicale dans le SIRH). |
| **9** | **Identifier modification ou export** | Piste d'audit forensique horodatée enregistrant tout delta de valeur (Crown/InTime) | Journaux purgeables par le super-administrateur dans les outils commerciaux | Table d'audit protégée en écriture seule (*append-only*). Chaque consultation de dossier sensible, chaque modification de fiche, chaque validation de congé et chaque export de données est consigné avec horodatage UTC, identifiant de l'auteur, adresse IP et motif d'exportation obligatoire. |
| **10** | **Produire un document & exporter un dossier** | Génération de récapitulatifs PDF et exports sécurisés vers la paie (NEOGOV/Softworks) | Modèles anglo-saxons incompatibles avec les normes administratives républicaines | Moteur de génération PDF conforme à la charte républicaine de Djibouti (Armoiries officielles, mentions de la République de Djibouti, timbre du Ministère de l'Intérieur, signature administrative, filigrane et QR code de vérification). Export structuré sécurisé vers la solde nationale. |

---

## 4. Spécificités Absolues et Lignes Rouges du Projet

Le benchmark des solutions internationales met en lumière plusieurs dérives ou inadéquations qu'il est impératif d'écarter formellement dans le SIRH de la Police Djiboutienne :

1. **Rejet absolu des fonctions d'enquête, de surveillance ou de renseignement** :
   - *Constat sur le marché* : Certaines solutions américaines intègrent des passerelles avec les systèmes de surveillance ou de gestion des dossiers criminels (RMS/CAD).
   - *Ligne rouge stricte* : Le présent SIRH est un système de gestion administrative des ressources humaines. Il est strictement interdit d'y intégrer la moindre fonction d'enquête judiciaire, d'écoutes, de géolocalisation permanente d'agents ou de traitement de données criminelles.
2. **Absence totale de données médicales protégées** :
   - *Constat sur le marché* : Certains outils enregistrent les diagnostics médicaux ou les ordonnances.
   - *Ligne rouge stricte* : Le secret médical est absolu. Le SIRH ne traite que l'**aptitude administrative** (Apte / Inapte temporaire / Inapte définitif / Apte avec restrictions administratives de service sans port d'arme ou de nuit). Aucun diagnostic, aucune pathologie, aucun compte-rendu médical ne doit être saisi dans l'application.
3. **Architecture intranet souveraine et déconnectée** :
   - *Constat sur le marché* : La quasi-totalité des solutions modernes (PowerTime, NEOGOV, PowerDetails) impose un hébergement Cloud public aux États-Unis ou au Royaume-Uni.
   - *Ligne rouge stricte* : Les données des fonctionnaires de police de Djibouti relèvent de la souveraineté nationale de sécurité. L'architecture doit être déployable sur un intranet centralisé sécurisé, sans dépendance à des services cloud tiers extérieurs.
4. **Interface et documentation 100% en français** :
   - *Constat sur le marché* : Les progiciels policiers sont à 90% exclusivement anglophones.
   - *Ligne rouge stricte* : 100% des interfaces, formulaires, aides contextuelles, messages d'erreur, documents officiels et journaux d'audit doivent être nativement et exclusivement rédigés en langue française.
