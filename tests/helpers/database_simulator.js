const { sha256, GENESIS_HASH, computeChainedHash, verifyAuditChain } = require('./crypto_audit.js');
const { referentiel, AGENTS_FIXTURES } = require('../fixtures/index.js');

class DatabaseSimulator {
  constructor() {
    this.reset();
  }

  reset() {
    this.unites = JSON.parse(JSON.stringify(referentiel.unités));
    this.agents = JSON.parse(JSON.stringify(AGENTS_FIXTURES));
    
    // Affectations initiales immuables
    this.affectations = [
      {
        id: 'aff-001',
        agent_id: 'agt-001',
        unite_id: 'U-CC-DJIB',
        poste_id: 'PST-01',
        type_mouvement: 'NOMINATION_INITIALE',
        date_debut: '2020-01-15',
        date_fin: null,
        est_affectation_courante: true,
        motif_mouvement: 'Affectation initiale après formation ENP',
        numero_decision_arrete: 'Arrêté n° 2020-012/DGPN',
        cree_par: 'usr-rh-01',
        cree_le: '2020-01-15T08:00:00Z'
      },
      {
        id: 'aff-002',
        agent_id: 'agt-002',
        unite_id: 'U-CC-DJIB',
        poste_id: 'PST-02',
        type_mouvement: 'NOMINATION_INITIALE',
        date_debut: '2022-03-01',
        date_fin: null,
        est_affectation_courante: true,
        motif_mouvement: 'Affectation initiale commissariat',
        numero_decision_arrete: 'Arrêté n° 2022-045/DGPN',
        cree_par: 'usr-rh-01',
        cree_le: '2022-03-01T08:00:00Z'
      },
      {
        id: 'aff-003',
        agent_id: 'agt-003',
        unite_id: 'U-REG-ALI',
        poste_id: 'PST-03',
        type_mouvement: 'NOMINATION_INITIALE',
        date_debut: '2018-02-10',
        date_fin: null,
        est_affectation_courante: true,
        motif_mouvement: 'Affectation territoriale Ali-Sabieh',
        numero_decision_arrete: 'Arrêté n° 2018-089/DGPN',
        cree_par: 'usr-rh-01',
        cree_le: '2018-02-10T08:00:00Z'
      }
    ];

    // Soldes de congés (base 30 jours annuels)
    this.soldes = {
      'agt-001': { annee: 2026, jours_acquis: 30.0, jours_pris: 0.0, jours_en_attente: 0.0 },
      'agt-002': { annee: 2026, jours_acquis: 30.0, jours_pris: 5.0, jours_en_attente: 0.0 },
      'agt-003': { annee: 2026, jours_acquis: 30.0, jours_pris: 0.0, jours_en_attente: 0.0 },
      'agt-004': { annee: 2026, jours_acquis: 30.0, jours_pris: 10.0, jours_en_attente: 0.0 }
    };

    // Demandes de congés
    this.demandes_conges = [];
    this.demandes_conges_sequence = 1;

    // Dossiers disciplinaires cloisonnés
    this.dossiers_disciplinaires = [
      {
        id: 'disc-001',
        agent_id: 'agt-001',
        numero_dossier: 'DISC-2025-004',
        phase_procedure: 'CLASSEMENT_SANS_SUITE',
        date_faits: '2025-06-10',
        description_sommaire: 'Rapport interne relatif au respect des consignes de garde',
        officier_rapporteur_id: 'usr-chef-cc',
        sanction_retenue: null,
        date_decision: '2025-07-01',
        statut_dossier: 'CLOS',
        niveau_confidentialite: 'TRES_SECRET'
      }
    ];

    // Aptitudes administratives (Zéro données médicales)
    this.aptitudes_administratives = [
      {
        id: 'apt-001',
        agent_id: 'agt-001',
        numero_certificat: 'CERT-ADM-2026-001',
        type_conclusion: 'APTE_SANS_RESTRICTION',
        date_decision: '2026-01-10',
        date_expiration: '2027-01-10',
        restrictions_operationnelles: null,
        identifiant_medecin_referent: 'MED-MIL-04',
        cree_le: '2026-01-10T10:00:00Z'
      }
    ];

    // Qualifications policières (Tir, Armement, OPJ, Secourisme)
    this.qualifications = [
      {
        id: 'qual-001',
        agent_id: 'agt-001',
        type_qualification: 'CERTIFICAT_TIR_REGLEMENTAIRE',
        date_obtention: '2025-02-15',
        date_expiration: '2026-02-15', // Expiré au 02/11/2026 !
        est_valide: false
      },
      {
        id: 'qual-002',
        agent_id: 'agt-002',
        type_qualification: 'CERTIFICAT_TIR_REGLEMENTAIRE',
        date_obtention: '2026-04-10',
        date_expiration: '2027-04-10',
        est_valide: true
      }
    ];

    // Form Builder & Configurations dynamiques (snapshots)
    this.configurations = [
      {
        version_numero: 1,
        cree_le: '2026-01-01T00:00:00Z',
        cree_par: 'usr-fonc-01',
        commentaire: 'Configuration initiale standard',
        champs_personnalises: [],
        listes_valeurs: {
          specialites: ['Circulation', 'Ordre Public', 'Enquête', 'Frontières'],
          motifs_refus_conges: ['Nécessité de service', 'Effectif insuffisant', 'Période bloquée']
        }
      }
    ];
    this.configuration_active_version = 1;

    // Journal d'audit inviolable (chaîné SHA-256)
    this.audit_log = [];
    this.audit_sequence = 1;
    this.dernier_hash_audit = GENESIS_HASH;

    // Initialiser une entrée d'audit genèse
    this.enregistrerAudit({
      utilisateur_id: 'SYS-INIT',
      nom_utilisateur: 'Système Initialisation',
      role_utilise: 'ADMIN_TECHNIQUE',
      adresse_ip: '127.0.0.1',
      action_type: 'INITIALISATION_SYSTEME',
      entite_cible: 'SYSTEME',
      entite_id: '0',
      details_operation_json: { version: '1.0.0', statut: 'OPERATIONNEL' }
    });
  }

  // --- MOTEUR D'AUDIT IMMUABLE ---
  enregistrerAudit({
    utilisateur_id,
    nom_utilisateur,
    role_utilise,
    adresse_ip,
    action_type,
    entite_cible,
    entite_id,
    details_operation_json,
    statut_operation = 'SUCCES'
  }) {
    const id = this.audit_sequence++;
    const horodatage = new Date().toISOString();
    const empreinte_precedente = this.dernier_hash_audit;

    const empreinte_courante = computeChainedHash({
      id,
      horodatage,
      utilisateur_id,
      action_type,
      entite_cible,
      entite_id,
      details_operation_json,
      empreinte_precedente
    });

    const entry = {
      id,
      horodatage,
      utilisateur_id,
      nom_utilisateur: nom_utilisateur || 'Utilisateur inconnu',
      role_utilise: role_utilise || 'AGENT',
      adresse_ip: adresse_ip || '127.0.0.1',
      action_type,
      entite_cible: entite_cible || 'GENERAL',
      entite_id: entite_id || null,
      details_operation_json: details_operation_json || {},
      statut_operation,
      empreinte_precedente,
      empreinte_courante
    };

    this.audit_log.push(entry);
    this.dernier_hash_audit = empreinte_courante;
    return entry;
  }

  // Empêche toute mise à jour ou suppression de log d'audit
  modifierAuditInterdit(id) {
    throw new Error('Violation de sécurité : Les journaux d\'audit sont strictement inaltérables (Append-Only). Toute modification est interdite.');
  }

  supprimerAuditInterdit(id) {
    throw new Error('Violation de sécurité : Les journaux d\'audit sont strictement inaltérables. Toute suppression est interdite.');
  }

  // --- GESTION DES AGENTS ---
  creerAgent(agentData, operateurSession) {
    if (!agentData.matricule || !agentData.nom || !agentData.prenom) {
      throw new Error('Données obligatoires manquantes pour la création de l\'agent.');
    }

    // Vérifier l'unicité du matricule
    const existant = this.agents.find(a => a.matricule === agentData.matricule);
    if (existant) {
      throw new Error(`Doublon détecté : Le matricule ${agentData.matricule} est déjà attribué.`);
    }

    // Vérifier le format du matricule PND-YYYY-XXXXX
    const regexMatricule = /^PND-\d{4}-\d{5}$/;
    if (!regexMatricule.test(agentData.matricule)) {
      throw new Error(`Format de matricule invalide : '${agentData.matricule}'. Format requis : PND-YYYY-XXXXX.`);
    }

    const id = agentData.id || `agt-${Date.now()}`;
    const agent = {
      id,
      matricule: agentData.matricule,
      nom: agentData.nom,
      prenom: agentData.prenom,
      date_naissance: agentData.date_naissance,
      genre: agentData.genre || 'MASCULIN',
      situation_familiale: agentData.situation_familiale || 'CELIBATAIRE',
      telephone_professionnel: agentData.telephone_professionnel || null,
      email_professionnel: agentData.email_professionnel || `${agentData.prenom.toLowerCase()}.${agentData.nom.toLowerCase()}@police.dj`,
      date_recrutement: agentData.date_recrutement || new Date().toISOString().split('T')[0],
      corps: agentData.corps,
      grade_actuel: agentData.grade_actuel,
      echelon_actuel: agentData.echelon_actuel || 1,
      indice_actuel: agentData.indice_actuel || 300,
      unite_actuelle_id: agentData.unite_actuelle_id,
      statut_administratif: agentData.statut_administratif || 'EN_ACTIVITE',
      est_actif: true
    };

    this.agents.push(agent);

    // Initialiser le solde de congés (30 jours)
    this.soldes[id] = {
      annee: 2026,
      jours_acquis: 30.0,
      jours_pris: 0.0,
      jours_en_attente: 0.0
    };

    // Créer l'affectation initiale
    this.affectations.push({
      id: `aff-${Date.now()}`,
      agent_id: id,
      unite_id: agent.unite_actuelle_id,
      poste_id: agentData.poste_id || 'PST-DEF',
      type_mouvement: 'NOMINATION_INITIALE',
      date_debut: agent.date_recrutement,
      date_fin: null,
      est_affectation_courante: true,
      motif_mouvement: 'Nomination et affectation initiale',
      numero_decision_arrete: agentData.numero_arrete || 'Arrêté n° 2026-REC/DGPN',
      cree_par: operateurSession ? operateurSession.utilisateur_id : 'SYS',
      cree_le: new Date().toISOString()
    });

    this.enregistrerAudit({
      utilisateur_id: operateurSession ? operateurSession.utilisateur_id : 'SYS',
      nom_utilisateur: operateurSession ? operateurSession.nom_complet : 'Système',
      role_utilise: operateurSession ? operateurSession.role : 'GESTIONNAIRE_RH',
      action_type: 'CREATION_AGENT',
      entite_cible: 'AGENT',
      entite_id: id,
      details_operation_json: { matricule: agent.matricule, nom: agent.nom, unite_id: agent.unite_actuelle_id }
    });

    return agent;
  }

  // --- HISTORIQUE IMMUABLE DES MUTATIONS ---
  muterAgent({ agent_id, nouvelle_unite_id, nouveau_poste_id, date_mutation, motif, numero_arrete, operateurSession }) {
    const agent = this.agents.find(a => a.id === agent_id);
    if (!agent) throw new Error('Agent introuvable');

    const ancienneUniteId = agent.unite_actuelle_id;

    // 1. Clôturer l'affectation active sans jamais la supprimer
    const affectationCourante = this.affectations.find(
      aff => aff.agent_id === agent_id && aff.est_affectation_courante === true
    );

    if (affectationCourante) {
      // Clôture la veille de la prise d'effet
      affectationCourante.est_affectation_courante = false;
      affectationCourante.date_fin = date_mutation;
    }

    // 2. Créer la nouvelle affectation
    const nouvelleAffId = `aff-mut-${Date.now()}`;
    const nouvelleAffectation = {
      id: nouvelleAffId,
      agent_id,
      unite_id: nouvelle_unite_id,
      poste_id: nouveau_poste_id || null,
      type_mouvement: 'MUTATION',
      date_debut: date_mutation,
      date_fin: null,
      est_affectation_courante: true,
      motif_mouvement: motif || 'Mutation pour nécessité de service',
      numero_decision_arrete: numero_arrete || `Arrêté n° ${Date.now()}/DGPN`,
      cree_par: operateurSession ? operateurSession.utilisateur_id : 'SYS',
      cree_le: new Date().toISOString()
    };
    this.affectations.push(nouvelleAffectation);

    // 3. Mettre à jour l'unité actuelle de l'agent
    agent.unite_actuelle_id = nouvelle_unite_id;

    this.enregistrerAudit({
      utilisateur_id: operateurSession ? operateurSession.utilisateur_id : 'SYS',
      nom_utilisateur: operateurSession ? operateurSession.nom_complet : 'Système',
      role_utilise: operateurSession ? operateurSession.role : 'GESTIONNAIRE_RH',
      action_type: 'MUTATION_AGENT',
      entite_cible: 'AGENT',
      entite_id: agent_id,
      details_operation_json: {
        ancienne_unite_id: ancienneUniteId,
        nouvelle_unite_id,
        numero_arrete: nouvelleAffectation.numero_decision_arrete
      }
    });

    return {
      agent,
      affectation_precedente: affectationCourante,
      nouvelle_affectation: nouvelleAffectation,
      total_affectations_historique: this.affectations.filter(a => a.agent_id === agent_id).length
    };
  }

  // --- GESTION ATOMIQUE DES CONGÉS ET VERROUILLAGE OPTIMISTE ---
  getSolde(agent_id) {
    const s = this.soldes[agent_id];
    if (!s) return null;
    return {
      ...s,
      jours_restants: s.jours_acquis - s.jours_pris - s.jours_en_attente
    };
  }

  soumettreDemandeConge({ agent_id, type_conge_id, date_debut, date_fin, nombre_jours, motif, operateurSession }) {
    const solde = this.getSolde(agent_id);
    if (!solde) throw new Error('Solde de congés introuvable pour cet agent');

    if (nombre_jours <= 0) {
      throw new Error('Le nombre de jours de congé demandé doit être strictement positif.');
    }

    if (solde.jours_restants < nombre_jours) {
      throw new Error(`Solde insuffisant : ${solde.jours_restants} jours disponibles, ${nombre_jours} demandés.`);
    }

    // Contrôle d'intégrité temporelle
    if (new Date(date_fin) < new Date(date_debut)) {
      throw new Error('Incohérence des dates : la date de fin ne peut pas être antérieure à la date de début.');
    }

    // Incrémenter atomiquement les jours en attente
    this.soldes[agent_id].jours_en_attente += nombre_jours;

    const demandeId = `dem-cong-${this.demandes_conges_sequence++}`;
    const demande = {
      id: demandeId,
      agent_id,
      type_conge_id: type_conge_id || 'ANNUEL',
      date_debut,
      date_fin,
      nombre_jours,
      motif: motif || 'Congé annuel légal',
      statut: 'SOUMIS',
      version_concurrence: 1,
      decision_chef_service: null,
      motif_refus_chef: null,
      decision_rh: null,
      motif_refus_rh: null,
      cree_le: new Date().toISOString()
    };

    this.demandes_conges.push(demande);

    this.enregistrerAudit({
      utilisateur_id: operateurSession ? operateurSession.utilisateur_id : agent_id,
      nom_utilisateur: operateurSession ? operateurSession.nom_complet : 'Agent',
      role_utilise: operateurSession ? operateurSession.role : 'AGENT',
      action_type: 'SOUMISSION_CONGE',
      entite_cible: 'DEMANDE_CONGE',
      entite_id: demandeId,
      details_operation_json: { nombre_jours, date_debut, date_fin }
    });

    return { demande, solde: this.getSolde(agent_id) };
  }

  approuverChefService({ demande_id, chef_service_id, avis, motif_refus, operateurSession }) {
    const demande = this.demandes_conges.find(d => d.id === demande_id);
    if (!demande) throw new Error('Demande de congé introuvable');

    if (demande.statut !== 'SOUMIS') {
      throw new Error(`Statut incompatible pour validation chef : ${demande.statut}`);
    }

    if (avis === 'FAVORABLE') {
      demande.statut = 'APPROUVE_CHEF_SERVICE';
      demande.decision_chef_service = 'FAVORABLE';
      demande.chef_service_id = chef_service_id;
    } else if (avis === 'DEFAVORABLE') {
      if (!motif_refus || motif_refus.trim() === '') {
        throw new Error('Motif de refus obligatoire : tout refus hiérarchique doit comporter un motif explicite.');
      }
      demande.statut = 'REFUSE';
      demande.decision_chef_service = 'DEFAVORABLE';
      demande.motif_refus_chef = motif_refus;
      demande.chef_service_id = chef_service_id;

      // Restituer immédiatement les jours en attente
      this.soldes[demande.agent_id].jours_en_attente -= demande.nombre_jours;
    } else {
      throw new Error('Avis invalide : doit être FAVORABLE ou DEFAVORABLE.');
    }

    demande.version_concurrence++;

    this.enregistrerAudit({
      utilisateur_id: operateurSession ? operateurSession.utilisateur_id : chef_service_id,
      nom_utilisateur: operateurSession ? operateurSession.nom_complet : 'Chef de service',
      role_utilise: 'CHEF_DE_SERVICE',
      action_type: avis === 'FAVORABLE' ? 'AVIS_CHEF_FAVORABLE' : 'REFUS_CHEF_CONGE',
      entite_cible: 'DEMANDE_CONGE',
      entite_id: demande_id,
      details_operation_json: { avis, motif_refus }
    });

    return { demande, solde: this.getSolde(demande.agent_id) };
  }

  validerRH({ demande_id, gestionnaire_rh_id, version_fournie, operateurSession }) {
    const demande = this.demandes_conges.find(d => d.id === demande_id);
    if (!demande) throw new Error('Demande de congé introuvable');

    // CONTRÔLE DE CONCURRENCE OPTIMISTE
    if (version_fournie !== undefined && version_fournie !== demande.version_concurrence) {
      const err = new Error(`Conflit de concurrence (HTTP 409) : La demande a déjà été modifiée par un autre gestionnaire. Version attendue : ${demande.version_concurrence}, reçue : ${version_fournie}.`);
      err.code = 409;
      throw err;
    }

    if (demande.statut === 'VALIDE_RH') {
      const err = new Error('Conflit de concurrence (HTTP 409) : La demande a déjà été validée.');
      err.code = 409;
      throw err;
    }

    if (demande.statut !== 'APPROUVE_CHEF_SERVICE') {
      throw new Error(`Statut incompatible pour validation finale RH : ${demande.statut}. L'approbation préalable du chef de service est requise.`);
    }

    // Débit définitif : jours_pris augmente, jours_en_attente diminue
    this.soldes[demande.agent_id].jours_pris += demande.nombre_jours;
    this.soldes[demande.agent_id].jours_en_attente -= demande.nombre_jours;

    demande.statut = 'VALIDE_RH';
    demande.decision_rh = 'VALIDE';
    demande.gestionnaire_rh_id = gestionnaire_rh_id;
    demande.version_concurrence++;

    this.enregistrerAudit({
      utilisateur_id: operateurSession ? operateurSession.utilisateur_id : gestionnaire_rh_id,
      nom_utilisateur: operateurSession ? operateurSession.nom_complet : 'Gestionnaire RH',
      role_utilise: 'GESTIONNAIRE_RH',
      action_type: 'VALIDATION_FINALE_CONGE',
      entite_cible: 'DEMANDE_CONGE',
      entite_id: demande_id,
      details_operation_json: { nombre_jours_debites: demande.nombre_jours }
    });

    return { demande, solde: this.getSolde(demande.agent_id) };
  }

  annulerConge({ demande_id, motif_annulation, operateurSession }) {
    const demande = this.demandes_conges.find(d => d.id === demande_id);
    if (!demande) throw new Error('Demande de congé introuvable');

    if (demande.statut === 'ANNULE' || demande.statut === 'REFUSE') {
      throw new Error(`Impossible d'annuler une demande déjà au statut ${demande.statut}.`);
    }

    if (demande.statut === 'VALIDE_RH') {
      // Restituer les jours pris
      this.soldes[demande.agent_id].jours_pris -= demande.nombre_jours;
    } else if (demande.statut === 'SOUMIS' || demande.statut === 'APPROUVE_CHEF_SERVICE') {
      // Restituer les jours en attente
      this.soldes[demande.agent_id].jours_en_attente -= demande.nombre_jours;
    }

    demande.statut = 'ANNULE';
    demande.motif_annulation = motif_annulation || 'Annulation administrative';
    demande.version_concurrence++;

    this.enregistrerAudit({
      utilisateur_id: operateurSession ? operateurSession.utilisateur_id : 'SYS',
      nom_utilisateur: operateurSession ? operateurSession.nom_complet : 'Gestionnaire RH',
      role_utilise: operateurSession ? operateurSession.role : 'GESTIONNAIRE_RH',
      action_type: 'ANNULATION_CONGE',
      entite_cible: 'DEMANDE_CONGE',
      entite_id: demande_id,
      details_operation_json: { motif_annulation }
    });

    return { demande, solde: this.getSolde(demande.agent_id) };
  }

  // --- MODULE DISCIPLINAIRE CLOISONNÉ ---
  consulterDossierDisciplinaire(agent_id, session) {
    if (!session || (!session.has_droit_discipline && session.role !== 'AUDITEUR')) {
      this.enregistrerAudit({
        utilisateur_id: session ? session.utilisateur_id : 'ANONYME',
        nom_utilisateur: session ? session.nom_complet : 'Inconnu',
        role_utilise: session ? session.role : 'INCONNU',
        action_type: 'TENTATIVE_CONSULTATION_DISCIPLINE_BLOQUEE',
        entite_cible: 'DOSSIER_DISCIPLINAIRE',
        entite_id: agent_id,
        statut_operation: 'ECHEC_DROITS'
      });
      const err = new Error('Accès interdit : La consultation des dossiers disciplinaires est strictement réservée aux officiers habilités.');
      err.code = 403;
      throw err;
    }

    const dossiers = this.dossiers_disciplinaires.filter(d => d.agent_id === agent_id);
    this.enregistrerAudit({
      utilisateur_id: session.utilisateur_id,
      nom_utilisateur: session.nom_complet,
      role_utilise: session.role,
      action_type: 'CONSULTATION_DOSSIER_DISCIPLINAIRE',
      entite_cible: 'DOSSIER_DISCIPLINAIRE',
      entite_id: agent_id
    });
    return dossiers;
  }

  // --- MODULE APTITUDE ADMINISTRATIVE (SANS DONNÉES MÉDICALES) ---
  enregistrerAptitudeAdministrative({ agent_id, numero_certificat, type_conclusion, date_decision, date_expiration, restrictions_operationnelles, identifiant_medecin_referent, operateurSession }) {
    const TYPES_VALIDES = ['APTE_SANS_RESTRICTION', 'APTE_AVEC_RESTRICTIONS', 'INAPTE_TEMPORAIRE', 'INAPTE_DEFINITIF'];
    if (!TYPES_VALIDES.includes(type_conclusion)) {
      throw new Error(`Type de conclusion d'aptitude invalide : ${type_conclusion}`);
    }

    // FILTRE STRICT ANTI-DONNÉES MÉDICALES
    const motsMedicauxInterdits = ['maladie', 'pathologie', 'cancer', 'diabete', 'fracture', 'depression', 'diagnostic', 'medicament', 'ordonnance', 'chirurgie', 'symptome'];
    const texteVerif = `${restrictions_operationnelles || ''} ${numero_certificat || ''}`.toLowerCase();
    for (const mot of motsMedicauxInterdits) {
      if (texteVerif.includes(mot)) {
        throw new Error(`Violation du secret médical : La mention de données médicales ou pathologies ('${mot}') est strictement interdite dans le SIRH.`);
      }
    }

    const record = {
      id: `apt-${Date.now()}`,
      agent_id,
      numero_certificat,
      type_conclusion,
      date_decision,
      date_expiration: date_expiration || null,
      restrictions_operationnelles: restrictions_operationnelles || null,
      identifiant_medecin_referent: identifiant_medecin_referent || 'MED-REF-01',
      cree_le: new Date().toISOString()
    };

    this.aptitudes_administratives.push(record);

    this.enregistrerAudit({
      utilisateur_id: operateurSession ? operateurSession.utilisateur_id : 'SYS',
      nom_utilisateur: operateurSession ? operateurSession.nom_complet : 'Gestionnaire RH',
      role_utilise: operateurSession ? operateurSession.role : 'GESTIONNAIRE_RH',
      action_type: 'ENREGISTREMENT_APTITUDE_ADMINISTRATIVE',
      entite_cible: 'APTITUDE_ADMINISTRATIVE',
      entite_id: record.id,
      details_operation_json: { type_conclusion, restrictions: restrictions_operationnelles }
    });

    return record;
  }

  // --- FORM BUILDER DYNAMIQUE ET ROLLBACK ---
  publierConfiguration({ champs_personnalises, listes_valeurs, commentaire, operateurSession }) {
    const TYPES_CHAMPS_VALIDES = ['texte', 'date', 'nombre', 'liste', 'booleen', 'fichier'];
    for (const champ of (champs_personnalises || [])) {
      if (!TYPES_CHAMPS_VALIDES.includes(champ.type_champ)) {
        throw new Error(`Type de champ personnalisé invalide : '${champ.type_champ}'. Types supportés : ${TYPES_CHAMPS_VALIDES.join(', ')}.`);
      }
    }

    const nouvelleVersion = this.configuration_active_version + 1;
    const nouvelleConfig = {
      version_numero: nouvelleVersion,
      cree_le: new Date().toISOString(),
      cree_par: operateurSession ? operateurSession.utilisateur_id : 'usr-fonc-01',
      commentaire: commentaire || `Publication version ${nouvelleVersion}`,
      champs_personnalises: champs_personnalises || [],
      listes_valeurs: listes_valeurs || {}
    };

    this.configurations.push(nouvelleConfig);
    this.configuration_active_version = nouvelleVersion;

    this.enregistrerAudit({
      utilisateur_id: operateurSession ? operateurSession.utilisateur_id : 'SYS',
      nom_utilisateur: operateurSession ? operateurSession.nom_complet : 'Admin Fonctionnel RH',
      role_utilise: 'ADMIN_FONCTIONNEL_RH',
      action_type: 'PUBLICATION_CONFIGURATION_RH',
      entite_cible: 'CONFIGURATION_RH',
      entite_id: String(nouvelleVersion),
      details_operation_json: { version_numero: nouvelleVersion, commentaire }
    });

    return nouvelleConfig;
  }

  rollbackConfiguration(versionCible, operateurSession) {
    const config = this.configurations.find(c => c.version_numero === versionCible);
    if (!config) {
      throw new Error(`Version de configuration cible introuvable : v${versionCible}`);
    }

    this.configuration_active_version = versionCible;

    this.enregistrerAudit({
      utilisateur_id: operateurSession ? operateurSession.utilisateur_id : 'SYS',
      nom_utilisateur: operateurSession ? operateurSession.nom_complet : 'Admin Fonctionnel RH',
      role_utilise: 'ADMIN_FONCTIONNEL_RH',
      action_type: 'ROLLBACK_CONFIGURATION_RH',
      entite_cible: 'CONFIGURATION_RH',
      entite_id: String(versionCible),
      details_operation_json: { version_restauree: versionCible }
    });

    return {
      success: true,
      version_active: versionCible,
      configuration: config
    };
  }

  // --- PROCÉDURE DE SAUVEGARDE ET RESTAURATION ---
  sauvegarder(operateurSession) {
    const rawDonnees = {
      unites: this.unites,
      agents: this.agents,
      affectations: this.affectations,
      soldes: this.soldes,
      demandes_conges: this.demandes_conges,
      dossiers_disciplinaires: this.dossiers_disciplinaires,
      aptitudes_administratives: this.aptitudes_administratives,
      qualifications: this.qualifications,
      configurations: this.configurations,
      configuration_active_version: this.configuration_active_version,
      audit_log: this.audit_log,
      audit_sequence: this.audit_sequence,
      dernier_hash_audit: this.dernier_hash_audit
    };
    const donnees = JSON.parse(JSON.stringify(rawDonnees));

    const snapshot = {
      version_format: '1.0',
      horodatage_sauvegarde: new Date().toISOString(),
      donnees,
      checksum_sha256: sha256(JSON.stringify(donnees))
    };

    this.enregistrerAudit({
      utilisateur_id: operateurSession ? operateurSession.utilisateur_id : 'SYS',
      nom_utilisateur: operateurSession ? operateurSession.nom_complet : 'Admin Technique',
      role_utilise: 'ADMIN_TECHNIQUE',
      action_type: 'SAUVEGARDE_SYSTEME_COMPLETE',
      entite_cible: 'SYSTEME',
      entite_id: 'BACKUP',
      details_operation_json: { checksum: snapshot.checksum_sha256 }
    });

    return snapshot;
  }

  restaurer(snapshot, operateurSession) {
    if (!snapshot || !snapshot.donnees || !snapshot.checksum_sha256) {
      throw new Error('Fichier de sauvegarde invalide ou corrompu : structure incomplète.');
    }

    const calculatedChecksum = sha256(JSON.stringify(snapshot.donnees));
    if (calculatedChecksum !== snapshot.checksum_sha256) {
      throw new Error('Échec d\'intégrité de la sauvegarde : la somme de contrôle SHA-256 ne correspond pas.');
    }

    // Vérifier l'intégrité de la chaîne d'audit restaurée
    const auditCheck = verifyAuditChain(snapshot.donnees.audit_log);
    if (!auditCheck.valid) {
      throw new Error(`Intégrité d'audit corrompue dans la sauvegarde : ${auditCheck.errors.length} anomalie(s) détectée(s).`);
    }

    // Restaurer l'état
    this.unites = JSON.parse(JSON.stringify(snapshot.donnees.unites));
    this.agents = JSON.parse(JSON.stringify(snapshot.donnees.agents));
    this.affectations = JSON.parse(JSON.stringify(snapshot.donnees.affectations));
    this.soldes = JSON.parse(JSON.stringify(snapshot.donnees.soldes));
    this.demandes_conges = JSON.parse(JSON.stringify(snapshot.donnees.demandes_conges));
    this.dossiers_disciplinaires = JSON.parse(JSON.stringify(snapshot.donnees.dossiers_disciplinaires));
    this.aptitudes_administratives = JSON.parse(JSON.stringify(snapshot.donnees.aptitudes_administratives));
    this.qualifications = JSON.parse(JSON.stringify(snapshot.donnees.qualifications));
    this.configurations = JSON.parse(JSON.stringify(snapshot.donnees.configurations));
    this.configuration_active_version = snapshot.donnees.configuration_active_version;
    this.audit_log = JSON.parse(JSON.stringify(snapshot.donnees.audit_log));
    this.audit_sequence = snapshot.donnees.audit_sequence;
    this.dernier_hash_audit = snapshot.donnees.dernier_hash_audit;

    // Enregistrer l'événement de restauration
    this.enregistrerAudit({
      utilisateur_id: operateurSession ? operateurSession.utilisateur_id : 'SYS',
      nom_utilisateur: operateurSession ? operateurSession.nom_complet : 'Admin Technique',
      role_utilise: 'ADMIN_TECHNIQUE',
      action_type: 'RESTAURATION_SYSTEME_REUSSIE',
      entite_cible: 'SYSTEME',
      entite_id: 'RESTORE',
      details_operation_json: { checksum: snapshot.checksum_sha256, horodatage_backup: snapshot.horodatage_sauvegarde }
    });

    return {
      success: true,
      agents_restaures: this.agents.length,
      affectations_restaurees: this.affectations.length,
      audit_entrees_validees: this.audit_log.length
    };
  }
}

module.exports = DatabaseSimulator;
