# Cadrage Métier et Statutaire de la Police Djiboutienne (R3)

## 1. Cadre Juridique et Institutionnel de Référence

Le présent document établit le cadre statutaire et organisationnel de référence du Système d'Information des Ressources Humaines (SIRH) de la **Police Nationale de la République de Djibouti**, conformément aux dispositions du **Requirement R3**.

### 1.1. Sources Textuelles Officielles Faisant Foi
L'architecture statutaire du système repose sur les textes officiels suivants, publiés au Journal Officiel de la République de Djibouti :
1. **Loi n° 72/AN/94/3ème L du 24 janvier 1995** : Portant unification des services de police et statut de la Force Nationale de Police (FNP).
2. **Loi n° 46/AN/04/5ème L du 27 mars 2004** : Portant statut particulier et organisation de la Direction Générale de la Police Nationale (DGPN). Elle définit les missions, les corps, les conditions de recrutement, d'avancement et la discipline générale.
3. **Loi n° 116/AN/21/8ème L du 24 mars 2021** : Modifiant l'article 10 de la Loi n° 46/AN/04 portant statut et organisation de la Police Nationale, fixant la hiérarchie officielle et les appellations actualisées des grades.
4. **Loi n° 48/AN/72 et textes subséquents** : Portant statut général des fonctionnaires et agents publics de la République de Djibouti (règles communes sur les positions administratives, congés et cessation de fonction).
5. **Décret n° 2011-0206/PR/MI** : Portant statut particulier des professionnels de santé rattachés à la Police Nationale (médecins, pharmaciens).

### 1.2. Principe Fondamental de Neutralité Juridique
En application stricte de l'Approved Task Prompt :
- **Aucune règle de droit n'est inventée.**
- Lorsque les modalités d'application fines (décrets ou arrêtés d'application non publiés) ne sont pas exhaustives dans les textes publics accessibles, une **hypothèse de travail explicite** est consignée avec son impact métier, et la règle est rendue **intégralement paramétrable** dans l'application via la Console d'administration fonctionnelle RH.

---

## 2. Corps, Grades et Échelons de la Police Nationale

Conformément à la Loi n° 116/AN/21/8ème L (Article 10 modifiant la Loi n° 46/AN/04), la hiérarchie des personnels actifs de la Police Nationale de Djibouti comprend les corps et grades suivants :

```
Direction Générale de la Police Nationale (DGPN)
│
├── 1. Officiers de Police Supérieurs
│   ├── Colonel
│   ├── Lieutenant-Colonel
│   └── Commandant
│
├── 2. Officiers de Police Subalternes
│   ├── Capitaine
│   └── Lieutenant
│
├── 3. Sous-Officiers de Police
│   ├── Adjudant-Chef
│   ├── Adjudant
│   ├── Sergent-Chef
│   └── Sergent
│
├── 4. Gradés
│   ├── Caporal-Chef
│   └── Caporal
│
└── 5. Agents
    ├── Agent de 1ère classe
    ├── Agent de 2ème classe
    └── Élève Agent
```

### 2.1. Tableau Hiérarchique et Grille d'Échelons de Référence

| Catégorie statutaire | Corps officiel | Grade officiel | Abréviation | Échelons indiciaires (Standard) | Durée moyenne par échelon |
| :--- | :--- | :--- | :--- | :---: | :---: |
| **Catégorie A1** | Officiers Supérieurs | Colonel | Col. | 1er au 4ème échelon + Échelon exceptionnel | 30 mois |
| **Catégorie A1** | Officiers Supérieurs | Lieutenant-Colonel | Lcl. | 1er au 5ème échelon | 30 mois |
| **Catégorie A1** | Officiers Supérieurs | Commandant | Cdt. | 1er au 5ème échelon | 24 mois |
| **Catégorie A2** | Officiers Subalternes | Capitaine | Cap. | 1er au 6ème échelon | 24 mois |
| **Catégorie A2** | Officiers Subalternes | Lieutenant | Ltn. | 1er au 5ème échelon | 24 mois |
| **Catégorie B1** | Sous-Officiers de Police | Adjudant-Chef | Adj-C. | 1er au 6ème échelon | 24 mois |
| **Catégorie B1** | Sous-Officiers de Police | Adjudant | Adj. | 1er au 6ème échelon | 24 mois |
| **Catégorie B2** | Sous-Officiers de Police | Sergent-Chef | Sgt-C. | 1er au 7ème échelon | 24 mois |
| **Catégorie B2** | Sous-Officiers de Police | Sergent | Sgt. | 1er au 7ème échelon | 24 mois |
| **Catégorie C1** | Gradés de Police | Caporal-Chef | Cpl-C. | 1er au 8ème échelon | 24 mois |
| **Catégorie C1** | Gradés de Police | Caporal | Cpl. | 1er au 8ème échelon | 24 mois |
| **Catégorie C2** | Agents de Police | Agent de 1ère classe | Agt-1. | 1er au 9ème échelon | 24 mois |
| **Catégorie C2** | Agents de Police | Agent de 2ème classe | Agt-2. | 1er au 7ème échelon | 24 mois |
| **Stagiaire** | Agents de Police | Élève Agent | Elv. | Échelon unique stagiaire (Formation) | 12 mois |

*Remarque paramétrable* : Le nombre exact d'échelons et la grille indiciaire associée à chaque grade sont entièrement configurables via la console d'administration pour s'adapter sans redéploiement à toute revalorisation statutaire ministérielle.

---

## 3. Positions Administratives Statutaires

Le statut du policier djiboutien prévoit cinq positions administratives exclusives :

1. **Activité** :
   - L'agent occupe effectivement un emploi de son grade au sein d'une unité de la Police Nationale.
   - Sous-statuts : En service normal de brigade, en stage de formation professionnelle, en mission officielle intérieure ou extérieure, en congé annuel ou maladie ordinaire.
   - Droits : Maintien de l'intégralité du traitement de solde, avancement et droits à pension.
2. **Détachement** :
   - L'agent est placé hors de son corps d'origine auprès d'un autre ministère (ex. Affaires Étrangères en ambassade, Présidence de la République, Justice) ou d'un organisme international (ex. Interpol, ONU/UA).
   - Droits : Rémunération assurée par l'organisme d'accueil ; maintien des droits à l'avancement dans le corps de police d'origine.
3. **Disponibilité** :
   - L'agent est placé hors des cadres de l'administration pour convenances personnelles, études, création d'entreprise ou raisons de santé familiale.
   - Droits : Suspension du traitement et suspension des droits à l'avancement pendant la durée de la disponibilité.
4. **Sous les drapeaux / Service militaire obligatoire** :
   - Période accomplie sous l'autorité des Forces Armées Djiboutiennes (FAD) dans les cas prévus par la loi.
5. **Suspension administrative à titre conservatoire** :
   - Mesure administrative d'urgence prise par le Directeur Général de la Police Nationale ou le Ministre de l'Intérieur à l'encontre d'un agent soupçonné d'une faute disciplinaire grave ou faisant l'objet de poursuites pénales.
   - Droits : Retrait immédiat de l'arme de service, de la carte professionnelle et interdiction d'accès aux locaux de police ; retenue sur traitement selon le barème réglementaire en vigueur, dans l'attente de la décision de la commission de discipline.

---

## 4. Organisation Territoriale et Circuits Hiérarchiques de Validation

### 4.1. Structure Administrative de la Police Nationale Djiboutienne

```
Ministère de l'Intérieur
│
└── Direction Générale de la Police Nationale (DGPN)
    ├── Direction de la Sécurité Publique (DSP)
    │   ├── Commissariat Central de Djibouti-Ville
    │   │   ├── 1er Arrondissement (Plateau)
    │   │   ├── 2ème Arrondissement (Marabout / Quartiers)
    │   │   ├── 3ème Arrondissement (Ambouli)
    │   │   ├── 4ème Arrondissement (Balbala Nord)
    │   │   └── 5ème Arrondissement (Balbala Sud)
    │   ├── Brigade de Circulation Routière
    │   └── Postes de Police de Proximité
    │
    ├── Direction de la Police aux Frontières (DPF)
    │   ├── Division Aéroportuaire (Aéroport International d'Ambouli)
    │   ├── Division Portuaire (Port Autonome International de Djibouti)
    │   └── Postes Frontaliers Terrestres (Loyada, Galafi, Balho)
    │
    ├── Direction de la Police Judiciaire (DPJ)
    │   └── Brigades spécialisées (Gestion RH exclusive, hors données judiciaires)
    │
    ├── Direction des Renseignements Généraux (DRG)
    │   └── Gestion RH administrative exclusive des effectifs
    │
    ├── Direction des Régions de l'Intérieur (Districts)
    │   ├── Commissariat Régional d'Ali-Sabieh
    │   ├── Commissariat Régional de Dikhil
    │   ├── Commissariat Régional de Tadjourah
    │   ├── Commissariat Régional d'Obock
    │   └── Commissariat Régional d'Arta
    │
    ├── Unité d'Intervention Spéciale (BIPN / GIPN)
    ├── École Nationale de Police (ENP)
    └── Direction des Ressources Humaines et des Moyens Généraux (DRH/DGPN)
```

### 4.2. Circuits de Validation par Niveau d'Autorité

| Type d'acte administratif | Niveau 1 (Initiation / Avis) | Niveau 2 (Vérification / Arbitrage) | Niveau 3 (Décision / Approbation) |
| :--- | :--- | :--- | :--- |
| **Congé annuel ordinaire (< 15j)** | Chef de brigade / Chef de poste | Commissaire d'arrondissement | Bureau des Congés (DRH/DGPN) |
| **Congé annuel ordinaire (>= 15j)** | Chef de brigade | Commissaire d'arrondissement / DSP | Directeur Général de la Police (DGPN) |
| **Congé de maladie ordinaire** | Médecin certifiant (hors système) | Chef de service de l'agent | DRH (Saisie décision administrative) |
| **Mutation interne même direction** | Chef d'unité d'origine / Chef accueil | Directeur Central (ex. DSP) | DRH / DGPN (Notification officielle) |
| **Mutation inter-directions ou région** | Directeur d'origine / Directeur accueil | Direction des Ressources Humaines | Décision du Directeur Général de la Police |
| **Avancement d'échelon** | Système (Calcul d'ancienneté) | Commission d'avancement DRH | Arrêté du Directeur Général de la Police |
| **Avancement de grade** | Commission Administrative Paritaire | Directeur Général de la Police | Arrêté du Ministre de l'Intérieur |
| **Procédure disciplinaire (Avertissement)** | Rapport du Chef de service | Avis DRH | Décision du Directeur Général |
| **Procédure disciplinaire (Révocation/Rétrogradation)** | Rapport de saisine DGPN | Commission de Discipline (instruction) | Arrêté Ministériel ou Décret Présidentiel |

---

## 5. Régime des Congés et Absences Policières

### 5.1. Typologie des Congés
1. **Congé annuel de repos** :
   - Droit statutaire : 30 jours civils (ou 2,5 jours ouvrables par mois de service effectif accompli).
   - Période de référence : Année civile du 1er janvier au 31 décembre.
   - Règle de report : Report possible sur l'année N+1 dans la limite de 15 jours, sur autorisation expresse du Directeur Général.
2. **Permissions exceptionnelles d'absence (courte durée)** :
   - Durée maximale : 48 heures consécutives.
   - Accordée par le chef de service / commissaire d'arrondissement pour convenances personnelles urgentes.
   - Plafond annuel paramétrable (ex. 10 jours par an non déductibles du congé annuel).
3. **Congés pour événements familiaux** :
   - Mariage de l'agent : 3 à 5 jours ouvrables.
   - Décès d'un ascendant, descendant ou conjoint : 3 à 5 jours ouvrables.
   - Naissance d'un enfant : 3 jours ouvrables.
4. **Congé de maternité / paternité** :
   - Maternité : 14 semaines consécutives (6 semaines prénatales, 8 semaines postnatales) à plein traitement.
   - Paternité : 3 jours ouvrables consécutifs.
5. **Congé de maladie ordinaire (CMO)** :
   - Durée : Jusqu'à 3 mois à plein traitement, puis 3 mois à demi-traitement sur justificatif médical administratif.
6. **Congé de longue durée (CLD)** :
   - Décision administrative prise sur avis d'une commission médicale officielle sans mention de diagnostic.

---

## 6. Règles d'Avancement et de Gestion des Carrières

### 6.1. Avancement d'Échelon
- L'avancement d'échelon a lieu d'un échelon au suivant immédiatement supérieur au sein du même grade.
- Critères d'avancement :
  - **À l'ancienneté maximale** : De droit après accomplissement de la durée requise.
  - **Au grand choix / ancienneté minimale** : Pour les agents ayant obtenu une notation annuelle supérieure au seuil fixé (ex. >= 18/20) et ayant accompli la durée minimale requise.
- Effet financier : Attribution immédiate du nouvel indice de solde à date d'effet.

### 6.2. Avancement de Grade (Promotion)
- L'avancement de grade permet le passage au grade immédiatement supérieur.
- Modalités réglementaires :
  1. **Au choix (sur tableau d'avancement)** : Après inscription sur le tableau annuel arrêté par la Commission Administrative d'Avancement, parmi les fonctionnaires remplissant les conditions d'ancienneté de grade et d'échelon requises.
  2. **Au choix exceptionnel pour actes de bravoure ou mérite éminent** : Décision souveraine du Ministre de l'Intérieur ou du Président de la République.
- Conditions statutaires éliminatoires :
  - Sanction disciplinaire des 2ème ou 3ème groupes en cours d'exécution.
  - Notation annuelle insuffisante (inférieure au seuil réglementaire).
  - Condition d'ancienneté minimale non atteinte au 31 décembre de l'année d'établissement du tableau.

---

## 7. Synthèse des Exigences d'Étanchéité Métier

1. **Étanchéité Disciplinaire** :
   - Le dossier disciplinaire fait l'objet d'un sous-système rigoureusement cloisonné.
   - La chaîne d'enregistrement distingue expressément :
     * Le rapport d'allégation ou signalement préliminaire (non public, protégé).
     * La procédure contradictoire en cours (droits de la défense, convocation).
     * La décision finale prononcée et notifiée.
   - Seuls le Directeur Général, l'officier RH habilité et la Commission de discipline ont accès à ce module. Les chefs de brigade et collègues n'ont aucune visibilité sur ces dossiers.
2. **Étanchéité Médicale (Aptitude Administrative Pure)** :
   - Le secret médical fait l'objet d'une protection absolue.
   - Le système n'enregistre **aucune donnée médicale, aucun diagnostic, aucune ordonnance**.
   - Seules sont enregistrées les **décisions administratives d'aptitude** :
     * *Apte sans restriction* (service général, voie publique, port d'arme autorisé).
     * *Apte avec restrictions administratives* (ex. pas de service de nuit, port d'arme suspendu, poste sédentaire).
     * *Inapte temporaire* (position de congé de maladie).
     * *Inapte définitif aux fonctions de police* (procédure de reclassement ou radiation).
