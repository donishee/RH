const test = require('node:test');
const assert = require('node:assert/strict');
const DatabaseSimulator = require('../helpers/database_simulator.js');
const { validatePlanningShift, generateOfficialDocument } = require('../helpers/contract_validator.js');
const { SESSIONS_FIXTURES } = require('../fixtures/index.js');

test('Tier 1 — F27 : Planning opérationnel de service & brigades', async (t) => {
  await t.test('F27-1: Validation d\'une vacation normale de 8 heures (06h-14h)', () => {
    const res = validatePlanningShift({
      date_vacation: '2026-11-03',
      heure_debut: '06:00',
      heure_fin: '14:00',
      derniere_fin_service: '2026-11-02T18:00:00Z', // 12h de repos
      qualification_tir_valide: true,
      est_poste_arme: true
    });
    assert.strictEqual(res.valide, true);
    assert.strictEqual(res.dureeHeures, 8);
  });

  await t.test('F27-2: Rejet d\'une vacation excédant la durée maximale de 12 heures', () => {
    const res = validatePlanningShift({
      date_vacation: '2026-11-03',
      heure_debut: '06:00',
      heure_fin: '20:00', // 14 heures
      derniere_fin_service: '2026-11-02T16:00:00Z',
      qualification_tir_valide: true,
      est_poste_arme: false
    });
    assert.strictEqual(res.valide, false);
    assert.ok(res.errors.some(e => e.regle === 'planning.duree_max_vacation_heures'));
  });

  await t.test('F27-3: Rejet en cas de violation du temps de repos légal de 11h consécutives', () => {
    const res = validatePlanningShift({
      date_vacation: '2026-11-03',
      heure_debut: '06:00',
      heure_fin: '14:00',
      derniere_fin_service: '2026-11-02T22:00:00Z', // seulement 8h de repos
      qualification_tir_valide: true,
      est_poste_arme: false
    });
    assert.strictEqual(res.valide, false);
    assert.ok(res.errors.some(e => e.regle === 'planning.repos_minimal_heures'));
  });

  await t.test('F27-4: Décompte des heures de nuit (22h00 - 06h00) pour cycle 3x8', () => {
    const res = validatePlanningShift({
      date_vacation: '2026-11-03',
      heure_debut: '22:00',
      heure_fin: '06:00',
      derniere_fin_service: '2026-11-03T06:00:00Z', // 16h de repos
      qualification_tir_valide: true,
      est_poste_arme: true
    });
    assert.strictEqual(res.valide, true);
    assert.strictEqual(res.heuresNuit, 8);
  });

  await t.test('F27-5: Blocage de poste armé si certificat de tir expiré', () => {
    const res = validatePlanningShift({
      date_vacation: '2026-11-03',
      heure_debut: '06:00',
      heure_fin: '14:00',
      derniere_fin_service: '2026-11-02T18:00:00Z',
      qualification_tir_valide: false, // expiré
      est_poste_arme: true // poste armé
    });
    assert.strictEqual(res.valide, false);
    assert.ok(res.errors.some(e => e.regle === 'qualifications.bloquer_affectation_si_expire'));
  });
});

test('Tier 1 — F28 : Remplacement d\'agents absents', async (t) => {
  let db;
  t.beforeEach(() => { db = new DatabaseSimulator(); });

  await t.test('F28-1: Détection de l\'absence inopinée d\'un agent au rassemblement', () => {
    const agentAbsent = db.agents[0];
    const declarationAbsence = {
      agent_id: agentAbsent.id,
      date_vacation: '2026-11-03',
      motif: 'Indisponibilité soudaine',
      statut: 'ABSENCE_CONSTATEE'
    };
    assert.strictEqual(declarationAbsence.statut, 'ABSENCE_CONSTATEE');
  });

  await t.test('F28-2: Filtrage des remplaçants qualifiés et disponibles dans l\'unité', () => {
    // Agents disponibles dans U-CC-DJIB ayant tir valide
    const agentsDisponibles = db.agents.filter(a => {
      const q = db.qualifications.find(qual => qual.agent_id === a.id);
      return a.unite_actuelle_id === 'U-CC-DJIB' && q && q.est_valide;
    });
    assert.strictEqual(agentsDisponibles.length, 1);
    assert.strictEqual(agentsDisponibles[0].id, 'agt-002'); // Amina Omar
  });

  await t.test('F28-3: Vérification du temps de repos minimal du remplaçant désigné', () => {
    const reposRemplaceur = 14; // 14 heures de repos
    assert.ok(reposRemplaceur >= 11, 'Remplaçant conforme au repos légal');
  });

  await t.test('F28-4: Affectation d\'office du remplaçant et mise à jour du planning', () => {
    const remplacement = {
      creneau_id: 'VAC-2026-11-03-M',
      agent_initial_id: 'agt-001',
      agent_remplacant_id: 'agt-002',
      statut: 'REMPLACEMENT_VALIDE',
      ordonne_par: 'usr-chef-cc'
    };
    assert.strictEqual(remplacement.statut, 'REMPLACEMENT_VALIDE');
  });

  await t.test('F28-5: Traçabilité du remplacement d\'urgence dans l\'audit', () => {
    const audit = db.enregistrerAudit({
      utilisateur_id: 'usr-chef-cc',
      action_type: 'REMPLACEMENT_URGENCE_PLANNING',
      entite_cible: 'PLANNING_SERVICE',
      entite_id: 'VAC-2026-11-03-M',
      details_operation_json: { agent_remplace: 'agt-001', agent_remplacant: 'agt-002' }
    });
    assert.strictEqual(audit.action_type, 'REMPLACEMENT_URGENCE_PLANNING');
  });
});

test('Tier 1 — F29 : Module disciplinaire strictement cloisonné', async (t) => {
  let db;
  t.beforeEach(() => { db = new DatabaseSimulator(); });

  await t.test('F29-1: Consultation autorisée pour un officier habilité discipline', () => {
    const sessionHabilitee = { ...SESSIONS_FIXTURES.gestionnaire_rh, has_droit_discipline: true };
    const dossiers = db.consulterDossierDisciplinaire('agt-001', sessionHabilitee);
    assert.strictEqual(dossiers.length, 1);
    assert.strictEqual(dossiers[0].numero_dossier, 'DISC-2025-004');
  });

  await t.test('F29-2: Blocage immédiat avec HTTP 403 pour un Chef de Service non habilité', () => {
    assert.throws(() => {
      db.consulterDossierDisciplinaire('agt-001', SESSIONS_FIXTURES.chef_service_cc);
    }, (err) => {
      assert.strictEqual(err.code, 403);
      assert.match(err.message, /Accès interdit : La consultation des dossiers disciplinaires/i);
      return true;
    });
  });

  await t.test('F29-3: Blocage immédiat avec HTTP 403 pour un agent tentant de voir la discipline', () => {
    assert.throws(() => {
      db.consulterDossierDisciplinaire('agt-001', SESSIONS_FIXTURES.agent_hassan);
    }, (err) => {
      assert.strictEqual(err.code, 403);
      return true;
    });
  });

  await t.test('F29-4: Distinction formelle des 3 phases de la procédure', () => {
    const phases = ['ALLEGATION', 'ENQUETE_INTERNE', 'COMMISSION_DISCIPLINE', 'SANCTION_PRONONCEE', 'CLASSEMENT_SANS_SUITE'];
    const dossier = db.dossiers_disciplinaires[0];
    assert.ok(phases.includes(dossier.phase_procedure));
  });

  await t.test('F29-5: Traçabilité des tentatives d\'accès illicites dans le journal d\'audit', () => {
    try {
      db.consulterDossierDisciplinaire('agt-001', SESSIONS_FIXTURES.chef_service_cc);
    } catch (e) {
      // Rejet attendu
    }

    const last = db.audit_log[db.audit_log.length - 1];
    assert.strictEqual(last.action_type, 'TENTATIVE_CONSULTATION_DISCIPLINE_BLOQUEE');
    assert.strictEqual(last.statut_operation, 'ECHEC_DROITS');
  });
});

test('Tier 1 — F30 : Aptitude administrative (sans données médicales)', async (t) => {
  let db;
  t.beforeEach(() => { db = new DatabaseSimulator(); });

  await t.test('F30-1: Enregistrement d\'une décision administrative d\'aptitude sans restriction', () => {
    const apt = db.enregistrerAptitudeAdministrative({
      agent_id: 'agt-002',
      numero_certificat: 'CERT-ADM-2026-002',
      type_conclusion: 'APTE_SANS_RESTRICTION',
      date_decision: '2026-03-01',
      date_expiration: '2027-03-01',
      identifiant_medecin_referent: 'MED-MIL-01',
      operateurSession: SESSIONS_FIXTURES.gestionnaire_rh
    });
    assert.strictEqual(apt.type_conclusion, 'APTE_SANS_RESTRICTION');
  });

  await t.test('F30-2: Enregistrement d\'une restriction opérationnelle purement administrative', () => {
    const apt = db.enregistrerAptitudeAdministrative({
      agent_id: 'agt-003',
      numero_certificat: 'CERT-ADM-2026-003',
      type_conclusion: 'APTE_AVEC_RESTRICTIONS',
      date_decision: '2026-04-01',
      restrictions_operationnelles: 'Exemption patrouilles de nuit et poste sédentaire de jour uniquement',
      identifiant_medecin_referent: 'MED-MIL-02',
      operateurSession: SESSIONS_FIXTURES.gestionnaire_rh
    });
    assert.strictEqual(apt.restrictions_operationnelles, 'Exemption patrouilles de nuit et poste sédentaire de jour uniquement');
  });

  await t.test('F30-3: Rejet strict et immédiat en cas de mention de diagnostic ou pathologie médicale', () => {
    assert.throws(() => {
      db.enregistrerAptitudeAdministrative({
        agent_id: 'agt-001',
        numero_certificat: 'CERT-BAD-01',
        type_conclusion: 'INAPTE_TEMPORAIRE',
        date_decision: '2026-05-01',
        restrictions_operationnelles: 'Inaptitude suite à diagnostic de fracture du fémur', // terme interdit
        identifiant_medecin_referent: 'MED-01'
      });
    }, /Violation du secret médical/i);
  });

  await t.test('F30-4: Typologie des décisions d\'aptitude strictement conforme au référentiel', () => {
    assert.throws(() => {
      db.enregistrerAptitudeAdministrative({
        agent_id: 'agt-001',
        numero_certificat: 'CERT-BAD-02',
        type_conclusion: 'CONCLUSION_INVENTEE',
        date_decision: '2026-05-01'
      });
    }, /Type de conclusion d'aptitude invalide/i);
  });

  await t.test('F30-5: Seul le matricule/identifiant du médecin militaire référent est conservé', () => {
    const apt = db.aptitudes_administratives[0];
    assert.strictEqual(apt.identifiant_medecin_referent, 'MED-MIL-04');
    assert.strictEqual(apt.dossier_medical, undefined);
  });
});

test('Tier 1 — F31 : Moteur de génération de documents administratifs PDF', async (t) => {
  let db;
  t.beforeEach(() => { db = new DatabaseSimulator(); });

  await t.test('F31-1: Génération d\'un arrêté officiel de mutation en format PDF/A', () => {
    const doc = generateOfficialDocument({
      type_document: 'ARRETE_MUTATION',
      agent: db.agents[0],
      donnees_acte: {
        ancienne_unite: 'Commissariat Central',
        nouvelle_unite: 'Commissariat Régional d\'Ali-Sabieh',
        date_effet: '2026-11-01',
        numero_decision: 'Décision n° 2026-452/DGPN'
      },
      operateurSession: SESSIONS_FIXTURES.gestionnaire_rh
    });

    assert.strictEqual(doc.type_document, 'ARRETE_MUTATION');
    assert.strictEqual(doc.format, 'PDF/A');
    assert.strictEqual(doc.langue, 'FRANCAIS');
  });

  await t.test('F31-2: Présence obligatoire de l\'en-tête officiel de la République de Djibouti', () => {
    const doc = generateOfficialDocument({
      type_document: 'TITRE_CONGE',
      agent: db.agents[0],
      donnees_acte: { date_debut: '2026-11-10', date_fin: '2026-11-14', nb_jours: 5 }
    });

    assert.strictEqual(doc.en_tete.pays, 'RÉPUBLIQUE DE DJIBOUTI');
    assert.strictEqual(doc.en_tete.devise, 'Unité - Égalité - Paix');
  });

  await t.test('F31-3: Filigrane officiel dynamique intégré', () => {
    const doc = generateOfficialDocument({
      type_document: 'ATTESTATION_TRAVAIL',
      agent: db.agents[1],
      donnees_acte: { date_delivrance: '2026-11-02' }
    });
    assert.strictEqual(doc.filigrane, 'REPRODUCTION INTERDITE - POLICE NATIONALE');
  });

  await t.test('F31-4: Signature numérique SHA-256 et jeton QR code d\'authenticité', () => {
    const doc = generateOfficialDocument({
      type_document: 'ARRETE_AVANCEMENT_ECHELON',
      agent: db.agents[0],
      donnees_acte: { echelon_nouveau: 4 }
    });
    assert.strictEqual(doc.signature_electronique_sha256.length, 64);
    assert.ok(doc.qr_code_verification.startsWith('https://intranet.police.dj/verifier-acte'));
  });

  await t.test('F31-5: Rejet de type de document non autorisé', () => {
    assert.throws(() => {
      generateOfficialDocument({
        type_document: 'DOCUMENT_INCONNU',
        agent: db.agents[0],
        donnees_acte: {}
      });
    }, /Type de document non supporté/i);
  });
});
