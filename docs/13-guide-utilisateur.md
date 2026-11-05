# Manuel d'Utilisation des Profils Opérationnels (R7, R6 & R3)

**République de Djibouti**  
*Unité — Égalité — Paix*  
**Ministère de l'Intérieur**  
**Direction Générale de la Police Nationale (DGPN)**  
**Direction des Ressources Humaines & Division de l'Organisation et des Méthodes**

---

## 1. Présentation Générale et Principes d'Accès

Le présent **Manuel d'Utilisation** a pour objet de guider les fonctionnaires et gradés de la **Police Nationale de la République de Djibouti** dans l'exploitation quotidienne du Système d'Information des Ressources Humaines (SIRH).

### 1.1. Finalité Républicaine et Déontologie
Le SIRH est un instrument d'administration moderne, transparent et équitable, dédié à la gestion des carrières, plannings, congés, formations et rémunérations.
Conformément aux directives présidentielles et ministérielles :
- **Absence de surveillance policière** : Le système exclut formellement toute fonctionnalité de renseignement, d'écoutes ou d'enquête judiciaire.
- **Souveraineté et 100% en Français** : Tous les écrans, formulaires, messages d'information et documents officiels sont intégralement rédigés en français républicain.
- **Traçabilité inaltérable** : Toute action sensible (validation de congé, mutation, export de solde) est automatiquement horodatée et scellée dans le journal d'audit cryptographique SHA-256.

### 1.2. Authentification et Sécurité des Postes de Travail
L'accès s'effectue via le navigateur web standard des postes connectés à l'Intranet sécurisé de la Police Nationale (`https://sirh.police.dj/connexion.html`).

```
┌────────────────────────────────────────────────────────────────────────┐
│                      POLICE NATIONALE DE DJIBOUTI                      │
│             Système Intranet Centralisé de Gestion des RH              │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│   Identifiant ou Matricule : [ PND-2020-00451                        ] │
│   Mot de passe             : [ ••••••••••••••••••                    ] │
│                                                                        │
│                 [ Se Connecter au Système Républicain ]                │
│                                                                        │
│   Avertissement : Tout accès non autorisé ou tentative d'élévation     │
│   de droits fait l'objet d'un scellement immédiat dans l'audit légal.   │
└────────────────────────────────────────────────────────────────────────┘
```

1. **Saisie du Matricule National** : Format officiel `PND-YYYY-XXXXX`.
2. **Mot de Passe Sécurisé** : Respectant la politique de complexité (12 caractères minimum, majuscules, minuscules, chiffres et caractères spéciaux).
3. **Session HttpOnly Protégée** : Déconnexion automatique après 30 minutes d'inactivité.

---

## 2. Guide Opérationnel du Profil AGENT (Libre-Service Policier)

Le profil **Agent** s'adresse à tout fonctionnaire de police (du corps des Officiers jusqu'aux Élèves-Agents) souhaitant consulter sa situation statutaire et formuler ses demandes administratives en toute autonomie.

### 2.1. Tableau de Bord Personnel de l'Agent (`/portail-agent.html`)

Dès sa connexion, le policier accède à sa fiche récapitulative et à ses compteurs statutaires :

```
┌────────────────────────────────────────────────────────────────────────────────────────────────┐
│  POLICE NATIONALE DE DJIBOUTI                        Espace Personnel de l'Agent (PND)         │
├────────────────────────────────────────────────────────────────────────────────────────────────┤
│  Agent de 1ère classe : Daher Hassan Robleh | Matricule : PND-2021-00842                       │
│  Corps : Agents de Police | Grade : Agent de 1ère classe | Échelon : 2ème échelon              │
│  Affectation courante : Commissariat du 3ème Arrondissement (Djibouti-Ville)                   │
│  Statut statutaire : EN ACTIVITÉ DE SERVICE ACTIF                                              │
├────────────────────────────────────────────────────────────────────────────────────────────────┤
│  COMPTEURS DE CONGÉS ANNUELS (Année de Référence 2026) :                                       │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐        │
│  │ Droit Annuel Acquis│  │  Jours Consommés │  │ En Cours d'Avis  │  │   SOLDE RESTANT  │        │
│  │    30.0 Jours    │  │     7.0 Jours    │  │     0.0 Jour     │  │    23.0 JOURS    │        │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘  └──────────────────┘        │
└────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 2.2. Soumission d'une Demande de Congé Annuel ou d'Absence

Pour déposer une demande d'absence :
1. Dans le bloc **« Déposer une Demande d'Absence »**, sélectionner le type d'absence :
   - *Congé Annuel Régulier* (décompté sur le solde de 30 jours) ;
   - *Congé pour Événement Familial* (naissance, mariage, décès selon le statut) ;
   - *Congé de Maternité / Paternité* ;
   - *Absence Exceptionnelle pour Motif Impérieux*.
2. Renseigner la **Date de début** et la **Date de fin** souhaitées (avec précision matin/après-midi si demi-journée).
3. Indiquer le **Lieu de séjour prévu** (Djibouti-Ville, Régions de l'Intérieur ou Étranger avec autorisation ministérielle).
4. Le système calcule instantanément le nombre de jours ouvrés décomptés et vérifie l'invariance mathématique : `Solde Restant >= Jours Demandés`.
5. Joindre obligatoirement une pièce justificative numérisée le cas échéant (ex : acte d'état civil, convocation officielle).
6. Cliquer sur **[ Transmettre ma Demande au Chef de Service ]**.

> **Règle de gestion inviolable** : Dès la soumission, les jours demandés basculent immédiatement en *« Jours en attente d'instruction »*. Le solde disponible est gelé de manière atomique, empêchant toute double demande concurrente sur les mêmes jours.

### 2.3. Suivi du Circuit d'Instruction et Notification

L'agent peut suivre à tout instant le statut d'avancement de son dossier :
- **EN ATTENTE AVIS CHEF SERVICE** : Demande transmise au commandant de brigade ou commissaire ;
- **APPROUVÉ PAR CHEF DE SERVICE** : Avis favorable N+1 émis, transmis au Directeur des Ressources Humaines ;
- **VALIDÉ DÉFINITIVEMENT PAR DRH** : Arrêté de congé approuvé, solde définitivement déduit ;
- **REFUSÉ** : Motif de refus explicite en français consigné par la hiérarchie ;
- **ANNULÉ** : Demande annulée avant départ, réintégration immédiate et intégrale des jours dans le solde disponible.

### 2.4. Téléchargement des Attestations Officielles PDF/A (`/maquette_aptitude_documents_m4.html`)

L'agent peut télécharger en temps réel ses documents administratifs en format PDF/A sécurisé :
- **Titre Officiel de Congé Régulier** : Document officiel revêtu des armoiries de la République de Djibouti et du QR code d'authentification ;
- **Attestation Individuelle de Présence au Corps** : Faisant foi de l'affectation active auprès des administrations publiques, banques ou organismes sociaux.

---

## 3. Guide Opérationnel du Profil CHEF DE SERVICE (Commandement d'Unité)

Le profil **Chef de Service** est attribué aux officiers commandant une unité opérationnelle : Commissaires Centraux, Commissaires d'Arrondissement, Chefs de Brigade et Directeurs Régionaux (Ali-Sabieh, Dikhil, Tadjourah, Obock, Arta).

### 3.1. Poste de Commandement d'Unité (`/portail-chef.html`)

Le chef de service dispose d'un périmètre d'action strictement cloisonné à sa propre unité et à sa descendance hiérarchique :

```
┌────────────────────────────────────────────────────────────────────────────────────────────────┐
│  POSTE DE COMMANDEMENT — COMMISSARIAT DU 1ER ARRONDISSEMENT (DJIBOUTI-VILLE)                   │
├────────────────────────────────────────────────────────────────────────────────────────────────┤
│  Effectif Total Sous Ordres : 42 Policiers | En Service Ce Jour : 36 | En Congé Autorisé : 4   │
│  En Arrêt / Stage : 2 | Demandes en Attente d'Avis : 3                                         │
│  JAUGE OPÉRATIONNELLE DE PRÉSENCE : [██████████████████░░░░] 85.7% (Seuil d'Alerte : 40.0%)    │
└────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 3.2. Instruction Hiérarchique des Demandes de Congés (Avis N+1)

1. Dans la section **« Demandes en Attente d'Instruction »**, examiner chaque demande soumise par les personnels de l'unité.
2. Le système affiche automatiquement l'impact prévisionnel sur la brigade :
   - *Alerte rouge* si le départ sollicité fait chuter l'effectif présent sous le seuil critique de sécurité publique (40% de l'effectif nominal) ;
   - *Avertissement orange* en cas de coïncidence avec un dispositif de maintien de l'ordre planifié.
3. Pour chaque demande, le Chef de Service choisit :
   - **Émettre un Avis Favorable** : La demande est transmise instantanément à la Direction des Ressources Humaines ;
   - **Émettre un Avis Défavorable (Refus)** : Saisie obligatoire d'un **Motif de Refus Régalien** (ex : *« Nécessité absolue de service — Dispositif renforcé Fête Nationale du 27 Juin »*). L'agent est immédiatement notifié et ses jours réservés lui sont automatiquement restitués.

### 3.3. Gestion des Plannings 24/7 et Tableaux de Service (`/maquette_planning_commandement_m4.html`)

Le chef de brigade planifie les vacations selon les cycles réglementaires de la Police Djiboutienne :
- **Régime 3x8 Permanent** : Brigade A (Matin : 06h-14h), Brigade B (Soir : 14h-22h), Brigade C (Nuit : 22h-06h) ;
- **Régime 2x12 d'Intervention** : Garde diurne (07h-19h) et Garde nocturne (19h-07h) pour les unités d'intervention ;
- **Astreintes Opérationnelles de Fin de Semaine**.

```
┌────────────────────────────────────────────────────────────────────────────────────────────────┐
│  TABLEAU DE SERVICE OPÉRATIONNEL — VENDREDI 5 NOVEMBRE 2026                                    │
├─────────────────────────┬──────────────────────┬──────────────────────┬────────────────────────┤
│ BRIGADE / VACATION      │ HORAIRES STATUTAIRES │ EFFECTIF REQUIS      │ EFFECTIF ASSIGNÉ       │
├─────────────────────────┼──────────────────────┼──────────────────────┼────────────────────────┤
│ Brigade A (Matin)       │ 06h00 — 14h00        │ 8 Fonctionnaires     │ 8 Affectés (Complet)   │
│ Brigade B (Après-midi)  │ 14h00 — 22h00        │ 8 Fonctionnaires     │ 8 Affectés (Complet)   │
│ Brigade C (Nuit)        │ 22h00 — 06h00 (Heures│ 6 Fonctionnaires armés│ 5 Affectés [ALERTE]    │
│                         │ de Nuit : 450 DJF/h) │                      │ 1 Absence Inopinée     │
└─────────────────────────┴──────────────────────┴──────────────────────┴────────────────────────┘
```

### 3.4. Remplacement d'Urgence et Contrôles Automatisés

Lorsqu'un policier déclare une absence inopinée (ex : accident, rappel impérieux) :
1. Cliquer sur **[ Déclarer Absence Inopinée & Remplacer ]**.
2. Le moteur algorithmique souverain balaye instantanément les agents de l'unité et applique **deux filtres de sécurité stricts** :
   - **Contrôle du Repos Physiologique Légal (11 heures consécutives)** : Tout agent ayant terminé une vacation moins de 11h avant le début de la garde est écarté pour prévenir la fatigue opérationnelle et les accidents de tir ;
   - **Contrôle du Certificat d'Aptitude au Tir (Validité < 365 jours)** : Tout policier dont le tir annuel obligatoire est échu est interdit d'affectation sur un poste armé de nuit.
3. Le système présente la liste ordonnée des agents remplaçants éligibles et disponibles.
4. Sélectionner l'agent remplaçant et valider : le planning est mis à jour, les heures d'astreinte et de nuit sont imputées sur sa solde, et la trace de l'incident est inscrite en audit.

---

## 4. Guide Opérationnel du Profil GESTIONNAIRE RH (Direction des Ressources Humaines)

Le profil **Gestionnaire RH** est réservé aux officiers et cadres de la Direction Générale de la Police Nationale (DGPN) chargés de la gestion nationale du personnel, des carrières, de la paie et des mouvements statutaires.

### 4.1. Recrutement et Création d'un Nouveau Fonctionnaire (`/agent-creation.html`)

1. Renseigner l'état civil républicain : Nom, Prénom, Sexe, Date et Lieu de naissance (contrôle automatique de la majorité légale >= 18 ans).
2. Le système attribue automatiquement le **Matricule Unique National** selon la nomenclature djiboutienne : `PND-YYYY-XXXXX`.
3. Assigner le corps statutaire, le grade de départ (ex : Élève-Agent ou Lieutenant stagiaire) et l'échelon initial.
4. Enregistrer la première affectation (ex : École Nationale de Police d'Idda).
5. Le système initialise automatiquement le compteur de congés annuels au prorata de l'année en cours et scelle l'ouverture du dossier dans la chaîne d'audit SHA-256.

### 4.2. Mutations Territoriales et Historique Immuable (`/mutations.html`)

Conformément à la prescription **R7**, toute mutation conserve intégralement l'historique sans écrasement :

```
┌────────────────────────────────────────────────────────────────────────────────────────────────┐
│  DOSSIER DE MUTATION — HISTORIQUE IMMUABLE DE L'AGENT PND-2015-01001                           │
├────────────────────────────────────────────────────────────────────────────────────────────────┤
│  Affectation n° 1 : Commissariat Central de Djibouti                                           │
│  - Du 01/01/2015 au 31/10/2026 | Statut : CLÔTURÉE PAR MUTATION                               │
│  - Motif : Arrêté Ministériel n° ARR-2015-012 | Poste : Enquêteur Judiciaire                   │
├────────────────────────────────────────────────────────────────────────────────────────────────┤
│  Affectation n° 2 (Courante) : Direction Régionale de Police d'Ali-Sabieh                      │
│  - Depuis le 01/11/2026 | Statut : COURANTE ET ACTIVE                                          │
│  - Motif : Arrêté Ministériel n° ARR-2026-089 (Renfort Frontalier) | Poste : Chef de Poste     │
└────────────────────────────────────────────────────────────────────────────────────────────────┘
```

**Procédure pour effectuer une mutation** :
1. Sélectionner l'agent dans le registre national.
2. Cliquer sur **[ Prononcer une Mutation ]**.
3. Renseigner l'unité de destination, le poste d'accueil, la date d'effet et la référence de l'arrêté ministériel.
4. Valider l'opération :
   - L'ancienne affectation reçoit automatiquement une `date_fin` égale à la veille de la prise de poste et passe à `est_courante = FALSE` ;
   - La nouvelle affectation est insérée avec `est_courante = TRUE` ;
   - Les habilitations d'accès du chef d'unité d'origine sont révoquées à la date d'effet au profit du chef d'unité d'accueil ;
   - Le système génère automatiquement l'**Arrêté Officiel de Mutation en format PDF/A** signé numériquement.

### 4.3. Gestion des Carrières, Échelons et Promotions (`/portail-rh-m3.html`)

1. **Avancements d'Échelon à l'Ancienneté** :
   - Le système surveille en continu la durée de séjour dans l'échelon (24 à 30 mois selon la grille statutaire) ;
   - Détection automatique des agents atteignant l'ancienneté requise ;
   - Proposition d'avancement automatique au grade supérieur avec calcul du nouveau traitement de base.
2. **Promotions de Grade au Choix (Commissions Paritaires)** :
   - Vérification des critères légaux : ancienneté de grade, notation annuelle supérieure ou égale à 16/20 (« Grand Choix »), et **absence totale de sanction disciplinaire du 2ème ou 3ème groupe en cours de validité**.
   - Émission du tableau officiel d'avancement soumis au Directeur Général et au Ministre de l'Intérieur.

### 4.4. Calcul des Éléments Variables de Solde (EVS) en Francs Djibouti (DJF)

Le module solde centralise et calcule automatiquement les indemnités opérationnelles :
- **Heures de Nuit Réalisées (22h00 - 06h00)** : Tarif républicain certifié à **450 DJF / heure** ;
- **Astreintes Opérationnelles de Fin de Semaine** : Forfait certifié à **3 500 DJF / cycle** ;
- **Indemnité Spécifique d'Éloignement Territorial** : Prime mensuelle de **25 000 DJF** accordée aux personnels affectés dans les régions de l'intérieur (Ali-Sabieh, Dikhil, Tadjourah, Obock).
- **Exportation Sécurisée pour le Trésor National** :
  - Cliquer sur **[ Exporter l'État Récapitulatif de Paie Mensuelle ]** ;
  - Le système produit le fichier de virement bancaire certifié et horodaté ;
  - Une trace indélébile avec le total en DJF et le hash SHA-256 du fichier est scellée dans le registre d'audit (satisfaction du contrôle critique T07).

### 4.5. Sanctuaire Disciplinaire Strictement Cloisonné (`/maquette_discipline_cloisonnee_m4.html`)

Pour garantir l'honneur des personnels et la sérénité des procédures, le module disciplinaire est **totalement hermétique** :
- **Accès Réservé** : Exclusivement accessible au Directeur Général de la Police Nationale (DGPN), aux membres assermentés de la Commission Spéciale de Discipline et à l'Inspection Générale. Tout autre agent ou chef territorial reçoit une interdiction formelle `HTTP 403`.
- **Instruction Contradictoire en 3 Phases Distinctes** :
  1. *Phase 1 : Enregistrement de l'Allégation ou du Signalement* (dossier confidentiel sous scellé d'enquête préliminaire) ;
  2. *Phase 2 : Procédure Contradictoire Formelle* (notification écrite à l'agent, respect obligatoire du délai de défense de 15 jours francs pour consultation de son dossier et assistance par un défenseur) ;
  3. *Phase 3 : Décision de la Commission et Sanction* (groupe 1 : avertissement/blâme ; groupe 2 : radiation du tableau d'avancement/exclusion temporaire ; groupe 3 : révocation sans suspension des droits à pension).

### 4.6. Aptitude Administrative et Protection Absolue du Secret Médical (`/maquette_aptitude_documents_m4.html`)

Le SIRH respecte scrupuleusement la séparation entre l'aptitude opérationnelle administrative et le secret médical :
- **Conclusions Administratives Uniquement** : Le gestionnaire saisit uniquement :
  - *Apte ou Inapte au port et à l'usage de l'arme de service* ;
  - *Apte ou Inapte à la conduite des véhicules de police (véhicules légers, blindés)* ;
  - *Apte ou Inapte aux vacations de nuit et aux efforts physiques intenses*.
- **Interdiction Absolue des Données Médicales** :
  - Le système interdit formellement la saisie d'un diagnostic, d'une pathologie, d'un traitement médicamenteux ou d'un compte-rendu médical d'hospitalisation.
  - Tout terme médical détecté dans un champ de saisie déclenche un rejet immédiat par contrainte d'intégrité de la base de données PostgreSQL (`chk_aptitudes_interdiction_medicale`).

---

## 5. Synthèse des Bonnes Pratiques Opérationnelles

| Situation Rencontrée | Action Immédiate du Policier | Contrôle Automatisé du Système |
| :--- | :--- | :--- |
| **Fin de vacation de nuit à 06h00** | L'agent quitte son service pour son repos obligatoire. | Blocage strict de toute reprise avant 17h00 (11h00 de repos physiologique respectées). |
| **Certificat de tir venant à expiration dans 30 jours** | L'agent reçoit une convocation proactive pour recyclage à l'ENP d'Idda. | Alerte jaune au tableau de bord du Chef de Brigade. Blocage de prise de poste armé si échu. |
| **Mutation prononcée par arrêté ministériel** | Le gestionnaire saisit la date de prise de poste et l'arrêté. | Clôture de l'ancienne affectation, création de la nouvelle, bascule automatique des accès du N+1. |
| **Demande de congé en période d'alerte** | L'agent transmet sa demande au commissariat. | Vérification automatique du seuil minimal d'effectif de brigade (40% maintenus requis). |
| **Exportation des soldes pour le Ministère des Finances** | Le gestionnaire RH génère l'état mensuel en DJF. | Enregistrement instantané d'une ligne d'audit avec empreinte SHA-256 du fichier produit. |

*Le présent manuel assure à chaque fonctionnaire de police une utilisation fluide, sécurisée et digne des traditions républicaines de la Police Nationale de Djibouti.*
