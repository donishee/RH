const test = require('node:test');
const assert = require('node:assert/strict');
const DatabaseSimulator = require('../helpers/database_simulator.js');
const { generateOfficialDocument, calculateMonthlyPayroll, validatePlanningShift } = require('../helpers/contract_validator.js');
const { verifyAuditChain } = require('../helpers/crypto_audit.js');
const { canAccessAgent } = require('../helpers/auth_context.js');
const { SESSIONS_FIXTURES } = require('../fixtures/index.js');

test('Tier 4 — Scénarios Métier Réels de la Police Djiboutienne', async (t) => {
  let db;
  t.beforeEach(() => { db = new DatabaseSimulator(); });

  await t.test('SCENARIO-1 : Recrutement complet d\'un nouvel agent de police djiboutien', () => {
    // Recrutement d'un nouvel élève agent suite à la promotion ENP
    const nouvelAgent = db.creerAgent({
      matricule: 'PND-2026-00124',
      nom: 'Guelleh',
      prenom: 'Abdourahman',
      date_naissance: '1999-04-12',
      genre: 'MASCULIN',
      situation_familiale: 'CELIBATAIRE',
      telephone_professionnel: '+253 21 35 10 99',
      date_recrutement: '2026-11-01',
      corps: 'AGENTS',
      grade_actuel: 'Élève Agent',
      echelon_actuel: 1,
      indice_actuel: 220,
      unite_actuelle_id: 'U-CC-DJIB',
      poste_id: 'PST-GARDE-01',
      numero_arrete: 'Arrêté Ministériel n° 2026-REC-012/MI'
    }, SESSIONS_FIXTURES.gestionnaire_rh);

    assert.strictEqual(nouvelAgent.matricule, 'PND-2026-00124');
    assert.strictEqual(nouvelAgent.unite_actuelle_id, 'U-CC-DJIB');
    assert.strictEqual(nouvelAgent.statut_administratif, 'EN_ACTIVITE');

    // Vérification du solde de congé ouvert automatiquement à 30 jours
    const solde = db.getSolde(nouvelAgent.id);
    assert.strictEqual(solde.jours_acquis, 30.0);
    assert.strictEqual(solde.jours_restants, 30.0);

    // Vérification de la première affectation enregistrée
    const affectations = db.affectations.filter(a => a.agent_id === nouvelAgent.id);
    assert.strictEqual(affectations.length, 1);
    assert.strictEqual(affectations[0].type_mouvement, 'NOMINATION_INITIALE');
    assert.strictEqual(affectations[0].est_affectation_courante, true);

    // Vérification de l'inscription dans la chaîne d'audit
    const auditRecrutement = db.audit_log[db.audit_log.length - 1];
    assert.strictEqual(auditRecrutement.action_type, 'CREATION_AGENT');
    assert.strictEqual(auditRecrutement.details_operation_json.matricule, 'PND-2026-00124');
  });

  await t.test('SCENARIO-2 : Mutation inter-districts avec arrêté ministériel et transmission de commandement', () => {
    const agent = db.agents.find(a => a.id === 'agt-001'); // Hassan Ibrahim

    // Mutation de Djibouti-Ville vers Ali-Sabieh
    const resultat = db.muterAgent({
      agent_id: agent.id,
      nouvelle_unite_id: 'U-REG-ALI',
      nouveau_poste_id: 'PST-CHEF-POSTE-01',
      date_mutation: '2026-11-15',
      motif: 'Mutation d\'office pour nécessité impérieuse de service — renfort frontière',
      numero_arrete: 'Arrêté n° 2026-MUT-045/DGPN',
      operateurSession: SESSIONS_FIXTURES.gestionnaire_rh
    });

    // L'agent est maintenant rattaché à Ali-Sabieh
    assert.strictEqual(agent.unite_actuelle_id, 'U-REG-ALI');

    // L'ancienne affectation à Djibouti-Ville est clôturée
    assert.strictEqual(resultat.affectation_precedente.est_affectation_courante, false);
    assert.strictEqual(resultat.affectation_precedente.date_fin, '2026-11-15');

    // La nouvelle affectation est courante
    assert.strictEqual(resultat.nouvelle_affectation.est_affectation_courante, true);
    assert.strictEqual(resultat.nouvelle_affectation.unite_id, 'U-REG-ALI');

    // Production de l'arrêté ministériel officiel en PDF
    const arretePDF = generateOfficialDocument({
      type_document: 'ARRETE_MUTATION',
      agent,
      donnees_acte: {
        motif: resultat.nouvelle_affectation.motif_mouvement,
        arrete_ref: resultat.nouvelle_affectation.numero_decision_arrete
      },
      operateurSession: SESSIONS_FIXTURES.gestionnaire_rh
    });

    assert.strictEqual(arretePDF.en_tete.ministere, 'MINISTÈRE DE L\'INTÉRIEUR');
    assert.strictEqual(arretePDF.signature_electronique_sha256.length, 64);
  });

  await t.test('SCENARIO-3 : Circuit de congé nominal, imputation et émission du titre', () => {
    // 1. Soumission par l'agent
    const { demande } = db.soumettreDemandeConge({
      agent_id: 'agt-001',
      date_debut: '2026-12-01',
      date_fin: '2026-12-10',
      nombre_jours: 10,
      motif: 'Congé annuel légal',
      operateurSession: SESSIONS_FIXTURES.agent_hassan
    });

    // 2. Avis favorable du chef de service
    db.approuverChefService({
      demande_id: demande.id,
      chef_service_id: 'usr-chef-cc',
      avis: 'FAVORABLE',
      operateurSession: SESSIONS_FIXTURES.chef_service_cc
    });

    // 3. Validation DRH
    const { solde } = db.validerRH({
      demande_id: demande.id,
      gestionnaire_rh_id: 'usr-rh-01',
      version_fournie: 2,
      operateurSession: SESSIONS_FIXTURES.gestionnaire_rh
    });

    assert.strictEqual(solde.jours_pris, 10.0);
    assert.strictEqual(solde.jours_restants, 20.0);

    // 4. Titre officiel
    const titre = generateOfficialDocument({
      type_document: 'TITRE_CONGE',
      agent: db.agents[0],
      donnees_acte: { date_debut: '2026-12-01', date_fin: '2026-12-10', nb_jours: 10 }
    });
    assert.strictEqual(titre.filigrane, 'REPRODUCTION INTERDITE - POLICE NATIONALE');
  });

  await t.test('SCENARIO-4 : Refus motivé d\'une demande de congé avec restitution immédiate des droits', () => {
    const { demande } = db.soumettreDemandeConge({
      agent_id: 'agt-002',
      date_debut: '2026-11-20',
      date_fin: '2026-11-25',
      nombre_jours: 5,
      motif: 'Demande de convenance personnelle',
      operateurSession: SESSIONS_FIXTURES.agent_hassan
    });

    // Solde temporairement débité en attente
    assert.strictEqual(db.getSolde('agt-002').jours_en_attente, 5.0);

    // Refus motivé du chef
    const resRefus = db.approuverChefService({
      demande_id: demande.id,
      chef_service_id: 'usr-chef-cc',
      avis: 'DEFAVORABLE',
      motif_refus: 'Alerte sécurité nationale — maintien de l\'ordre renforcé',
      operateurSession: SESSIONS_FIXTURES.chef_service_cc
    });

    assert.strictEqual(resRefus.demande.statut, 'REFUSE');
    assert.strictEqual(resRefus.solde.jours_en_attente, 0.0);
    assert.strictEqual(resRefus.solde.jours_restants, 25.0);
  });

  await t.test('SCENARIO-5 : Détection de qualification expirée et verrouillage d\'affectation opérationnelle', () => {
    const qualTirAgt1 = db.qualifications.find(q => q.agent_id === 'agt-001');
    assert.strictEqual(qualTirAgt1.est_valide, false);

    const validationPlanning = validatePlanningShift({
      date_vacation: '2026-11-04',
      heure_debut: '14:00',
      heure_fin: '22:00',
      derniere_fin_service: '2026-11-03T22:00:00Z',
      qualification_tir_valide: qualTirAgt1.est_valide,
      est_poste_arme: true
    });

    assert.strictEqual(validationPlanning.valide, false);
    assert.ok(validationPlanning.errors.some(e => e.regle === 'qualifications.bloquer_affectation_si_expire'));
  });

  await t.test('SCENARIO-6 : Calcul mensuel des variables de solde policières et export tracé', () => {
    const agentAli = db.agents.find(a => a.unite_actuelle_id === 'U-REG-ALI');
    const soldePaie = calculateMonthlyPayroll({
      agent: agentAli,
      heures_nuit: 24, // 3 vacations de nuit
      astreintes_jours: 2, // 2 week-ends d'astreinte
      commissariat_region: true // prime d'éloignement Ali-Sabieh
    });

    assert.strictEqual(soldePaie.elements.heures_nuit.montant, 24 * 450); // 10800 DJF
    assert.strictEqual(soldePaie.elements.astreintes.montant, 2 * 3500); // 7000 DJF
    assert.strictEqual(soldePaie.elements.indemnite_eloignement.montant, 25000); // 25000 DJF
    assert.strictEqual(soldePaie.total_net_variables, 10800 + 7000 + 25000); // 42800 DJF

    const auditExport = db.enregistrerAudit({
      utilisateur_id: 'usr-rh-01',
      role_utilise: 'GESTIONNAIRE_RH',
      action_type: 'EXPORT_PAIE_TRESOR',
      entite_cible: 'SOLDE',
      entite_id: '2026-11',
      details_operation_json: { matricule: agentAli.matricule, total_net: soldePaie.total_net_variables }
    });
    assert.strictEqual(auditExport.action_type, 'EXPORT_PAIE_TRESOR');
  });
});
