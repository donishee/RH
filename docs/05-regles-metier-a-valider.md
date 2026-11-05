# Registre des Hypothèses Métier et Catalogue des Règles à Valider (R3)

## 1. Démarche de Neutralité Juridique et Traçabilité des Hypothèses

En application rigoureuse de l'Approved Task Prompt pour le projet SIRH de la Police Djiboutienne :
> *« Pour chaque information manquante, consigner une hypothèse explicite, indiquer son impact et rendre la règle paramétrable dans l'application sans inventer de règles juridiques. »*

Le présent document constitue le **catalogue officiel des hypothèses de travail** retenues lors de la phase de cadrage. Chaque hypothèse est documentée avec son impact sur le système, sa valeur par défaut proposée (fondée sur la pratique administrative djiboutienne et les standards de police), et sa **clé de configuration dynamique** au sein de la Console d'administration fonctionnelle RH.

Aucune règle n'est gravée en dur dans le code source : **100% des règles ci-dessous sont modifiables par les administrateurs fonctionnels autorisés** sans redéploiement applicatif.

---

## 2. Registre des Hypothèses Statutaires et Métier à Arbitrer

| ID | Domaine Métier | Hypothèse Explicite Formulée | Impact Métier et Système | Valeur par Défaut Proposée | Clé de Paramétrage Console RH | Statut de Validation |
|:---|:---|:---|:---|:---|:---|:---:|
| **HYP-01** | **Congés** | L'acquisition des droits au congé annuel ordinaire s'effectue sur une base de 2,5 jours ouvrables par mois de service effectif, soit 30 jours par an. | Détermine le calcul de l'incrément mensuel du compteur de congés de chaque agent. | 30 jours civils / 2,5 jours ouvrables par mois | `conges.droits_annuels_jours` = `30` | *À valider DGPN* |
| **HYP-02** | **Congés** | Le report des congés non pris sur l'année suivante est autorisé jusqu'à une limite maximale fixée, au-delà de laquelle les jours sont perdus sauf dérogation expresse. | Déclenche la procédure de purge annuelle ou de bascule sur le solde N+1 au 31 décembre. | Plafond de report de 15 jours sur N+1 | `conges.plafond_report_jours` = `15` | *À valider DGPN* |
| **HYP-03** | **Congés** | Un préavis minimal de soumission est exigé avant la date de départ en congé ordinaire, sauf cas de force majeure. | Contrôle la date minimale sélectionnable dans le calendrier de demande d'absence de l'agent. | Préavis minimal de 7 jours ouvrés | `conges.preavis_minimal_jours` = `7` | *À valider DGPN* |
| **HYP-04** | **Planning** | La durée minimale de repos physiologique obligatoire entre deux vacations de service actif consécutives est fixée à 11 heures. | Bloque l'assignation d'un agent sur une vacation si l'intervalle avec sa fin de service précédente est < seuil. | 11 heures consécutives | `planning.repos_minimal_heures` = `11` | *À valider DGPN* |
| **HYP-05** | **Planning** | La durée maximale de service continu d'un agent sans relève (en situation opérationnelle normale) ne peut excéder 12 heures consécutives. | Alerte rouge sur le planning et interdiction de prolonger la vacation au-delà de ce plafond. | 12 heures consécutives | `planning.duree_max_vacation_heures` = `12` | *À valider DGPN* |
| **HYP-06** | **Planning** | Les heures de nuit donnant droit à majoration indemnitaire et repos compensateur sont comprises entre 22h00 et 06h00. | Détermine le calcul automatisé des heures de nuit transmises au module Éléments Variables de Solde. | 22:00 - 06:00 | `planning.plage_nuit_debut` = `22:00`<br>`planning.plage_nuit_fin` = `06:00` | *À valider DGPN* |
| **HYP-07** | **Qualifications** | La validité du certificat annuel de tir et d'armement réglementaire est de 12 mois à compter de la date du dernier tir de qualification validé. | Déclenche les alertes à J-60, J-30 et le blocage de prise de poste armé à J-0. | 365 jours (1 an) | `qualifications.validite_tir_jours` = `365` | *À valider ENP / DGPN* |
| **HYP-08** | **Qualifications** | Le délai de préavis pour convoquer un agent à une session de recyclage obligatoire à l'ENP avant expiration de son certificat est de 30 jours. | Déclenche l'émission automatique d'une convocation officielle vers le chef de service de l'agent. | 30 jours calendaires | `qualifications.alerte_preavis_jours` = `30` | *À valider ENP* |
| **HYP-09** | **Avancement** | La durée d'ancienneté requise dans un échelon pour être éligible à l'avancement d'échelon à l'ancienneté moyenne est fixée à 24 mois. | Détermine la date à laquelle l'agent apparaît dans la liste des promouvables d'échelon. | 24 mois (2 ans) par défaut selon grille | `carrieres.duree_echelon_standard_mois` = `24` | *À valider Ministère* |
| **HYP-10** | **Avancement** | Pour prétendre à une promotion au grade supérieur au grand choix, la moyenne des notes des 3 dernières années doit être supérieure ou égale à 16/20. | Filtre automatique des candidats éligibles lors de l'établissement du tableau d'avancement annuel. | Note moyenne >= 16,0 / 20 | `carrieres.note_minimale_avancement` = `16.0` | *À valider DGPN* |
| **HYP-11** | **Discipline** | L'existence d'une sanction disciplinaire du 2ème ou 3ème groupe non amnistiée bloque immédiatement toute éligibilité au tableau d'avancement. | Contrôle d'exclusion automatique lors de la génération de la liste des fonctionnaires promouvables. | Blocage strict si sanction active | `discipline.exclusion_avancement_actif` = `true` | *À valider DGPN* |
| **HYP-12** | **Discipline** | Les sanctions du 1er groupe (Avertissement, Blâme) sont automatiquement effacées du dossier administratif après 3 ans de bonne conduite sans récidive. | Procédure d'amnistie administrative réhabilitant l'agent dans ses droits normaux sans mention résiduelle. | 36 mois (3 ans) | `discipline.delai_effacement_groupe1_mois` = `36` | *À valider Ministère* |
| **HYP-13** | **Aptitude** | L'expiration d'une décision administrative d'inaptitude temporaire sans nouvel avis médical entraîne par défaut le maintien de la restriction par précaution. | Évite qu'un agent déclaré inapte au port d'arme reprenne une arme par simple dépassement de délai. | Maintien conservatoire avec alerte prioritaire | `aptitude.maintien_conservatoire_defaut` = `true` | *À valider DGPN* |
| **HYP-14** | **Organisation** | Le taux d'effectif minimum incompressible d'un commissariat d'arrondissement est fixé à 40% de l'effectif théorique de la brigade de quart. | Seuil en deçà duquel le système bloque toute nouvelle validation de congé pour la période concernée. | 40% de l'effectif de brigade | `organisation.seuil_effectif_minimum_pct` = `40` | *À valider DSP* |
| **HYP-15** | **Rémunération** | Le barème des indemnités de garde de nuit et d'éloignement dans les Régions de l'Intérieur est forfaitisé par vacation et par district. | Alimentation des états récapitulatifs pour l'exportation vers la solde du Trésor national. | Grille forfaitaire mensuelle | `solde.grille_indemnites_active` = `GRILLE_2026_V1` | *À valider Budget* |

---

## 3. Catalogue des Paramètres Configurables par Domaine

La console d'administration fonctionnelle permet aux utilisateurs détenteurs du rôle **Administrateur Fonctionnel RH** de modifier l'ensemble des règles regroupées ci-dessous sans intervention technique :

### 3.1. Paramètres de Gestion des Congés & Absences
```yaml
conges:
  droits_annuels_jours: 30              # Nombre de jours ouvrables acquis par an
  increment_mensuel_jours: 2.5          # Incrément mensuel automatique
  plafond_report_jours: 15              # Nombre maximum de jours reportables sur N+1
  preavis_minimal_jours: 7              # Préavis minimal exigé pour soumettre une demande
  pieces_justificatives_obligatoires:   # Types d'absences exigeant une pièce jointe
    - "MALADIE_ORDINAIRE"
    - "DECES_FAMILLE"
    - "MARIAGE"
    - "MATERNITE"
  types_absence_autorises:
    - code: "CONGE_ANNUEL"
      libelle: "Congé annuel de repos"
      deductible_solde: true
    - code: "PERMISSION_COURTE"
      libelle: "Permission exceptionnelle (max 48h)"
      deductible_solde: false
    - code: "EVENEMENT_FAMILIAL"
      libelle: "Événement familial légal"
      deductible_solde: false
    - code: "MALADIE_ORDINAIRE"
      libelle: "Congé maladie ordinaire"
      deductible_solde: false
```

### 3.2. Paramètres de Planning & Organisation Opérationnelle
```yaml
planning:
  repos_minimal_heures: 11              # Heures de repos physiologique obligatoire
  duree_max_vacation_heures: 12         # Durée maximale d'une vacation normale
  plage_nuit_debut: "22:00"             # Heure de début de la vacation de nuit
  plage_nuit_fin: "06:00"               # Heure de fin de la vacation de nuit
  regimes_vacations_disponibles:
    - code: "3X8"
      libelle: "Trois-Huit opérationnel (Matin, Soir, Nuit)"
    - code: "4X2"
      libelle: "Quatre jours de garde / Deux jours de repos"
    - code: "ADMIN_JOUR"
      libelle: "Horaire de bureau régulier (07h30 - 15h30)"
  seuils_effectifs_minimaux:
    commissariat_arrondissement: 40     # % minimum d'effectif présent obligatoire
    poste_frontiere: 60                 # % minimum d'effectif présent obligatoire
    brigade_intervention: 75            # % minimum d'effectif présent obligatoire
```

### 3.3. Paramètres de Formation, Tir & Qualifications
```yaml
qualifications:
  validite_tir_jours: 365               # Durée de validité du contrôle de tir
  validite_secourisme_jours: 730        # Durée de validité du PSC1 (2 ans)
  delai_alerte_avertissement_jours: 60  # Alerte initiale orange
  delai_alerte_urgence_jours: 30        # Alerte prioritaire rouge
  bloquer_affectation_si_expire: true   # Verrouillage technique du planning
  qualifications_bloquantes_port_arme:
    - "CERTIFICAT_TIR_REGLEMENTAIRE"
    - "HABILITATION_ARME_DOTATION"
```

### 3.4. Paramètres d'Évaluation, Carrières & Avancement
```yaml
carrieres:
  duree_echelon_standard_mois: 24       # Durée standard par échelon
  note_minimale_avancement: 16.0        # Note annuelle minimale requise pour grand choix
  bareme_notation_max: 20.0             # Notation sur 20
  ponderation_criteres_notation:
    disponibilite_sens_devoir: 25       # % de la note finale
    discipline_deontologie: 25          # % de la note finale
    aptitude_commandement: 25           # % de la note finale
    competences_techniques: 25          # % de la note finale
```

### 3.5. Paramètres de Discipline & Confidentialité
```yaml
discipline:
  delai_effacement_groupe1_mois: 36     # Effacement automatique après 3 ans sans faute
  exclusion_avancement_actif: true      # Exclusion du tableau si sanction en cours
  sanctions_visibles_sur_dossier_public:
    - "AVERTISSEMENT"                   # Visible pendant durée active seulement
    - "BLAME"
    - "EXCLUSION_TEMPORAIRE"
    - "RETROGRADATION"
  sanctions_amnistiees_invisibles: true # Disparition complète à l'effacement
```

---

## 4. Protocole d'Arbitrage et Validation Souveraine

La mise en production définitive du paramétrage suivra le protocole d'arbitrage en 3 étapes :
1. **Atelier de validation administrative** : Présentation du catalogue des paramètres aux représentants de la Direction Générale de la Police Nationale (DGPN) et de la Direction des Ressources Humaines du Ministère de l'Intérieur.
2. **Signature du Procès-Verbal de Paramétrage** : Formalisation des valeurs validées par la commission paritaire de cadrage.
3. **Injecteur de configuration initiale (Seeders)** : Chargement des paramètres officiels dans la base de données relationnelle via la console d'administration, générant la version `V1.0.0-PROD` avec signature d'intégrité inaltérable.
