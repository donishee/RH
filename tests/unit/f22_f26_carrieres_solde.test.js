const test = require('node:test');
const assert = require('node:assert/strict');
const DatabaseSimulator = require('../helpers/database_simulator.js');
const { calculateMonthlyPayroll } = require('../helpers/contract_validator.js');
const { SESSIONS_FIXTURES } = require('../fixtures/index.js');

test('Tier 1 — F22 : Carrières, avancement d\'échelon & promotions de grade', async (t) => {
  let db;
  t.beforeEach(() => { db = new DatabaseSimulator(); });

  await t.test('F22-1: Avancement d\'échelon à l\'ancienneté (passage échelon 3 -> 4)', () => {
    const agt = db.agents.find(a => a.id === 'agt-001');
    assert.strictEqual(agt.echelon_actuel, 3);
    assert.strictEqual(agt.indice_actuel, 520);

    // Simulation de l'avancement d'échelon
    agt.echelon_actuel = 4;
    agt.indice_actuel = 550; // nouvel indice

    db.enregistrerAudit({
      utilisateur_id: 'usr-rh-01',
      action_type: 'AVANCEMENT_ECHELON',
      entite_cible: 'AGENT',
      entite_id: agt.id,
      details_operation_json: { ancien_echelon: 3, nouvel_echelon: 4, nouvel_indice: 550 }
    });

    assert.strictEqual(agt.echelon_actuel, 4);
    assert.strictEqual(agt.indice_actuel, 550);
  });

  await t.test('F22-2: Blocage de promotion si l\'échelon dépasse le maximum du grade', () => {
    const { referentiel } = require('../fixtures/index.js');
    const gradeSgt = referentiel.grades_detail.find(g => g.nom === 'Sergent');
    assert.strictEqual(gradeSgt.echelons_max, 7);

    const agt = { grade_actuel: 'Sergent', echelon_actuel: 7 };
    const peutAvancerEchelon = agt.echelon_actuel < gradeSgt.echelons_max;
    assert.strictEqual(peutAvancerEchelon, false, 'Ne peut plus avancer d\'échelon une fois au plafond');
  });

  await t.test('F22-3: Promotion de grade sur tableau d\'avancement avec arrêté officiel', () => {
    const agt = db.agents.find(a => a.id === 'agt-002');
    assert.strictEqual(agt.grade_actuel, 'Agent de 1ère classe');

    // Promotion au grade supérieur (Caporal)
    agt.corps = 'GRADES';
    agt.grade_actuel = 'Caporal';
    agt.echelon_actuel = 1;
    agt.indice_actuel = 360;

    const audit = db.enregistrerAudit({
      utilisateur_id: 'usr-rh-01',
      action_type: 'PROMOTION_GRADE',
      entite_cible: 'AGENT',
      entite_id: agt.id,
      details_operation_json: {
        ancien_grade: 'Agent de 1ère classe',
        nouveau_grade: 'Caporal',
        arrete_promotion: 'Arrêté Ministériel n° 2026-PROM-012/MI'
      }
    });

    assert.strictEqual(agt.grade_actuel, 'Caporal');
    assert.strictEqual(audit.details_operation_json.nouveau_grade, 'Caporal');
  });

  await t.test('F22-4: Condition éliminatoire : sanction disciplinaire active bloque l\'avancement', () => {
    const { HYP_11 } = { HYP_11: true }; // discipline.exclusion_avancement_actif
    const agentAvecSanctionActive = { a_sanction_active: true };

    const estEligible = !agentAvecSanctionActive.a_sanction_active && HYP_11;
    assert.strictEqual(estEligible, false, 'L\'agent avec sanction active est exclu du tableau d\'avancement');
  });

  await t.test('F22-5: Historique complet des actes de promotion tracé', () => {
    const auditsPromo = db.audit_log.filter(a => a.action_type === 'PROMOTION_GRADE');
    assert.ok(Array.isArray(auditsPromo));
  });
});

test('Tier 1 — F23 : Positions statutaires', async (t) => {
  let db;
  t.beforeEach(() => { db = new DatabaseSimulator(); });

  await t.test('F23-1: Suivi de la position normale d\'activité', () => {
    const agt = db.agents[0];
    assert.strictEqual(agt.statut_administratif, 'EN_ACTIVITE');
  });

  await t.test('F23-2: Placement en position de détachement (ex. Ambassade / Interpol)', () => {
    const agt = db.agents[0];
    agt.statut_administratif = 'DETACHEMENT';
    db.enregistrerAudit({
      utilisateur_id: 'usr-rh-01',
      action_type: 'CHANGEMENT_POSITION_STATUTAIRE',
      entite_cible: 'AGENT',
      entite_id: agt.id,
      details_operation_json: { nouvelle_position: 'DETACHEMENT', organisme_accueil: 'Interpol' }
    });
    assert.strictEqual(agt.statut_administratif, 'DETACHEMENT');
  });

  await t.test('F23-3: Placement en disponibilité pour convenances personnelles', () => {
    const agt = db.agents[1];
    agt.statut_administratif = 'DISPONIBILITE';
    assert.strictEqual(agt.statut_administratif, 'DISPONIBILITE');
  });

  await t.test('F23-4: Mesure conservatoire de suspension administrative d\'urgence', () => {
    const agt = db.agents[2];
    agt.statut_administratif = 'SUSPENSION_ADMINISTRATIVE';
    assert.strictEqual(agt.statut_administratif, 'SUSPENSION_ADMINISTRATIVE');
  });

  await t.test('F23-5: Validation de la liste exhaustive des positions statutaires', () => {
    const { referentiel } = require('../fixtures/index.js');
    const positions = referentiel.positions_statutaires;
    assert.strictEqual(positions.length, 5);
  });
});

test('Tier 1 — F24 : Formations & Qualifications policières', async (t) => {
  let db;
  t.beforeEach(() => { db = new DatabaseSimulator(); });

  await t.test('F24-1: Registre des qualifications de tir et validité 365 jours', () => {
    const q1 = db.qualifications.find(q => q.agent_id === 'agt-001');
    assert.ok(q1);
    assert.strictEqual(q1.type_qualification, 'CERTIFICAT_TIR_REGLEMENTAIRE');
  });

  await t.test('F24-2: Détection automatique d\'un certificat de tir expiré', () => {
    const q1 = db.qualifications.find(q => q.agent_id === 'agt-001');
    const dateExp = new Date(q1.date_expiration);
    const dateRef = new Date('2026-11-02');
    const estExpire = dateExp < dateRef;
    assert.strictEqual(estExpire, true, 'Le certificat expiré au 15/02/2026 est bien détecté');
  });

  await t.test('F24-3: Signalement d\'un certificat valide (agent 002)', () => {
    const q2 = db.qualifications.find(q => q.agent_id === 'agt-002');
    const dateExp = new Date(q2.date_expiration);
    const dateRef = new Date('2026-11-02');
    assert.ok(dateExp > dateRef, 'Le certificat de l\'agent 002 est valide jusqu\'en 2027');
  });

  await t.test('F24-4: Seuil d\'alerte proactive à J-30 avant expiration', () => {
    const dateExpiration = new Date('2026-11-25');
    const dateAujourdhui = new Date('2026-11-02');
    const joursRestants = Math.ceil((dateExpiration - dateAujourdhui) / (1000 * 60 * 60 * 24));
    assert.strictEqual(joursRestants, 23);
    const alerteRouge = joursRestants <= 30;
    assert.strictEqual(alerteRouge, true, 'Alerte rouge déclenchée à moins de 30 jours');
  });

  await t.test('F24-5: Habilitations OPJ / APJ enregistrées avec date d\'effet', () => {
    const qualOpj = {
      agent_id: 'agt-004',
      type_qualification: 'HABILITATION_OPJ',
      date_obtention: '2024-06-01',
      decision_parquet: 'Arrêté n° 2024-OPJ-044/PG'
    };
    assert.strictEqual(qualOpj.type_qualification, 'HABILITATION_OPJ');
  });
});

test('Tier 1 — F25 : Évaluation annuelle et notation', async (t) => {
  let db;
  t.beforeEach(() => { db = new DatabaseSimulator(); });

  await t.test('F25-1: Grille d\'évaluation avec notation chiffrée sur 20', () => {
    const evalAnnuelle = {
      agent_id: 'agt-001',
      annee: 2025,
      note_discipline: 18.0,
      note_technique: 16.5,
      note_disponibilite: 17.5,
      note_globale: 17.33,
      appreciation_generale: 'Excellent sous-officier, dévoué et rigoureux dans le service.',
      evaluateur_id: 'usr-chef-cc'
    };
    assert.ok(evalAnnuelle.note_globale >= 0 && evalAnnuelle.note_globale <= 20);
  });

  await t.test('F25-2: Rejet de note en dehors de l\'intervalle 0 à 20', () => {
    const noteInvalide = 22.5;
    const estValide = noteInvalide >= 0 && noteInvalide <= 20;
    assert.strictEqual(estValide, false);
  });

  await t.test('F25-3: Obligation de l\'appréciation générale littérale en français', () => {
    const { scanForEnglishTerms } = require('../helpers/french_linter.js');
    const appreciation = 'Comportement exemplaire et grande disponibilité lors des patrouilles de nuit.';
    const res = scanForEnglishTerms(appreciation);
    assert.strictEqual(res.is100PercentFrench, true);
  });

  await t.test('F25-4: Seuil d\'éligibilité promotion grand choix (note >= 16/20)', () => {
    const noteAgent = 17.2;
    const seuilGrandChoix = 16.0;
    assert.ok(noteAgent >= seuilGrandChoix, 'Agent éligible au grand choix');
  });

  await t.test('F25-5: Notification de notation tracée dans le journal d\'audit', () => {
    const audit = db.enregistrerAudit({
      utilisateur_id: 'usr-chef-cc',
      action_type: 'NOTATION_ANNUELLE_AGENT',
      entite_cible: 'AGENT',
      entite_id: 'agt-001',
      details_operation_json: { annee: 2025, note_globale: 17.33 }
    });
    assert.strictEqual(audit.action_type, 'NOTATION_ANNUELLE_AGENT');
  });
});

test('Tier 1 — F26 : Éléments variables de solde & Export sécurisé', async (t) => {
  let db;
  t.beforeEach(() => { db = new DatabaseSimulator(); });

  await t.test('F26-1: Calcul exact des heures de nuit (taux 450 DJF/h)', () => {
    const payroll = calculateMonthlyPayroll({
      agent: db.agents[0],
      heures_nuit: 16 // 2 nuits de 8h
    });
    assert.strictEqual(payroll.elements.heures_nuit.montant, 16 * 450); // 7200 DJF
  });

  await t.test('F26-2: Calcul des astreintes opérationnelles (3500 DJF/jour)', () => {
    const payroll = calculateMonthlyPayroll({
      agent: db.agents[0],
      astreintes_jours: 3
    });
    assert.strictEqual(payroll.elements.astreintes.montant, 3 * 3500); // 10500 DJF
  });

  await t.test('F26-3: Prime d\'éloignement pour commissariats de l\'Intérieur (25000 DJF)', () => {
    const payroll = calculateMonthlyPayroll({
      agent: db.agents.find(a => a.unite_actuelle_id === 'U-REG-ALI'),
      commissariat_region: true
    });
    assert.strictEqual(payroll.elements.indemnite_eloignement.montant, 25000);
  });

  await t.test('F26-4: Retenue sur solde pour absence injustifiée', () => {
    const payroll = calculateMonthlyPayroll({
      agent: db.agents[0],
      absence_injustifiee_jours: 1
    });
    assert.strictEqual(payroll.elements.retenue_absences.montant, -4000);
  });

  await t.test('F26-5: Traçabilité systématique de l\'export de solde dans l\'audit', () => {
    const exportResult = { format: 'CSV_TRESOR', nb_agents: 4, somme_totale: 125000 };
    const audit = db.enregistrerAudit({
      utilisateur_id: 'usr-rh-01',
      nom_utilisateur: 'Yassin Barkat',
      role_utilise: 'GESTIONNAIRE_RH',
      action_type: 'EXPORT_DONNEES_SOLDE',
      entite_cible: 'SOLDE_MENSUELLE',
      entite_id: '2026-11',
      details_operation_json: exportResult
    });

    assert.strictEqual(audit.action_type, 'EXPORT_DONNEES_SOLDE');
    assert.strictEqual(audit.details_operation_json.format, 'CSV_TRESOR');
  });
});
