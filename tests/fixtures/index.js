const referentiel = require('./referentiel_djibouti.json');

const AGENTS_FIXTURES = [
  {
    id: 'agt-001',
    matricule: 'PND-2020-00142',
    nom: 'Hassan',
    prenom: 'Ibrahim',
    date_naissance: '1992-05-14',
    genre: 'MASCULIN',
    situation_familiale: 'MARIE',
    telephone_professionnel: '+253 21 35 10 01',
    email_professionnel: 'ibrahim.hassan@police.dj',
    date_recrutement: '2020-01-15',
    corps: 'SOUS_OFFICIERS',
    grade_actuel: 'Sergent-Chef',
    echelon_actuel: 3,
    indice_actuel: 520,
    unite_actuelle_id: 'U-CC-DJIB',
    statut_administratif: 'EN_ACTIVITE',
    est_actif: true
  },
  {
    id: 'agt-002',
    matricule: 'PND-2022-00305',
    nom: 'Amina',
    prenom: 'Omar',
    date_naissance: '1996-09-22',
    genre: 'FEMININ',
    situation_familiale: 'CELIBATAIRE',
    telephone_professionnel: '+253 21 35 10 02',
    email_professionnel: 'amina.omar@police.dj',
    date_recrutement: '2022-03-01',
    corps: 'AGENTS',
    grade_actuel: 'Agent de 1ère classe',
    echelon_actuel: 2,
    indice_actuel: 320,
    unite_actuelle_id: 'U-CC-DJIB',
    statut_administratif: 'EN_ACTIVITE',
    est_actif: true
  },
  {
    id: 'agt-003',
    matricule: 'PND-2018-00088',
    nom: 'Mohamed',
    prenom: 'Kamil',
    date_naissance: '1988-11-03',
    genre: 'MASCULIN',
    situation_familiale: 'MARIE',
    telephone_professionnel: '+253 21 35 20 01',
    email_professionnel: 'kamil.mohamed@police.dj',
    date_recrutement: '2018-02-10',
    corps: 'OFFICIERS_SUBALTERNES',
    grade_actuel: 'Capitaine',
    echelon_actuel: 4,
    indice_actuel: 850,
    unite_actuelle_id: 'U-REG-ALI',
    statut_administratif: 'EN_ACTIVITE',
    est_actif: true
  },
  {
    id: 'agt-004',
    matricule: 'PND-2015-00021',
    nom: 'Farah',
    prenom: 'Abdi',
    date_naissance: '1982-04-12',
    genre: 'MASCULIN',
    situation_familiale: 'MARIE',
    telephone_professionnel: '+253 21 35 00 10',
    email_professionnel: 'abdi.farah@police.dj',
    date_recrutement: '2015-06-01',
    corps: 'OFFICIERS_SUPERIEURS',
    grade_actuel: 'Commandant',
    echelon_actuel: 5,
    indice_actuel: 950,
    unite_actuelle_id: 'U-DSP',
    statut_administratif: 'EN_ACTIVITE',
    est_actif: true
  }
];

const SESSIONS_FIXTURES = {
  admin_technique: {
    utilisateur_id: 'usr-tech-01',
    matricule: 'TECH-001',
    nom_complet: 'Mahamoud Guelleh (Admin Tech)',
    role: 'ADMIN_TECHNIQUE',
    unite_id: 'U-DGPN',
    unites_autorisees: [] // Aucun accès aux dossiers nominatifs RH
  },
  admin_fonctionnel: {
    utilisateur_id: 'usr-fonc-01',
    matricule: 'FONC-001',
    nom_complet: 'Fatouma Ali (Admin Fonct RH)',
    role: 'ADMIN_FONCTIONNEL_RH',
    unite_id: 'U-DRH',
    unites_autorisees: ['U-DGPN', 'U-DRH', 'U-DSP', 'U-DPF', 'U-DPJ', 'U-ENP']
  },
  gestionnaire_rh: {
    utilisateur_id: 'usr-rh-01',
    matricule: 'RH-001',
    nom_complet: 'Yassin Barkat (Gestionnaire RH Central)',
    role: 'GESTIONNAIRE_RH',
    unite_id: 'U-DRH',
    unites_autorisees: ['*'] // Accès global sur l'ensemble de la Police
  },
  chef_service_cc: {
    utilisateur_id: 'usr-chef-cc',
    matricule: 'PND-2015-00021',
    nom_complet: 'Commandant Farah Abdi (Chef Commissariat Central)',
    role: 'CHEF_DE_SERVICE',
    unite_id: 'U-CC-DJIB',
    unites_autorisees: ['U-CC-DJIB', 'U-ARR-1', 'U-ARR-2', 'U-ARR-3', 'U-ARR-4', 'U-ARR-5']
  },
  chef_service_ali: {
    utilisateur_id: 'usr-chef-ali',
    matricule: 'PND-2018-00088',
    nom_complet: 'Capitaine Mohamed Kamil (Chef Commissariat Ali-Sabieh)',
    role: 'CHEF_DE_SERVICE',
    unite_id: 'U-REG-ALI',
    unites_autorisees: ['U-REG-ALI']
  },
  agent_hassan: {
    utilisateur_id: 'usr-agt-01',
    matricule: 'PND-2020-00142',
    nom_complet: 'Sergent-Chef Hassan Ibrahim',
    role: 'AGENT',
    agent_id: 'agt-001',
    unite_id: 'U-CC-DJIB',
    unites_autorisees: ['agt-001'] // Uniquement soi-même
  },
  auditeur: {
    utilisateur_id: 'usr-audit-01',
    matricule: 'AUDIT-001',
    nom_complet: 'Moussa Ahmed (Inspecteur Général)',
    role: 'AUDITEUR',
    unite_id: 'U-DGPN',
    unites_autorisees: ['*'] // Lecture seule globale
  }
};

module.exports = {
  referentiel,
  AGENTS_FIXTURES,
  SESSIONS_FIXTURES
};
