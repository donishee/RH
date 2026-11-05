const test = require('node:test');
const assert = require('node:assert/strict');
const DatabaseSimulator = require('../helpers/database_simulator.js');
const { SESSIONS_FIXTURES } = require('../fixtures/index.js');

test('Tier 1 — F11 : Organisation et effectifs policiers', async (t) => {
  let db;
  t.beforeEach(() => { db = new DatabaseSimulator(); });

  await t.test('F11-1: Arborescence complète des 17 unités policières djiboutiennes', () => {
    assert.strictEqual(db.unites.length, 17);
    const dgpn = db.unites.find(u => u.code === 'DGPN');
    assert.ok(dgpn);
    assert.strictEqual(dgpn.parent_id, null);
  });

  await t.test('F11-2: Rattachement hiérarchique des commissariats à la DSP', () => {
    const cc = db.unites.find(u => u.code === 'CC-DJIB');
    assert.strictEqual(cc.parent_id, 'U-DSP');
  });

  await t.test('F11-3: Rattachement hiérarchique des 5 arrondissements de Djibouti au Commissariat Central', () => {
    const arrondissements = db.unites.filter(u => u.code.startsWith('ARR-'));
    assert.strictEqual(arrondissements.length, 5);
    for (const arr of arrondissements) {
      assert.strictEqual(arr.parent_id, 'U-CC-DJIB');
    }
  });

  await t.test('F11-4: Rattachement des 5 commissariats régionaux de l\'Intérieur', () => {
    const regions = ['REG-ALI-SABIEH', 'REG-DIKHIL', 'REG-TADJOURAH', 'REG-OBOCK', 'REG-ARTA'];
    for (const reg of regions) {
      const u = db.unites.find(item => item.code === reg);
      assert.ok(u, `Unité régionale ${reg} existe`);
      assert.strictEqual(u.parent_id, 'U-DSP');
    }
  });

  await t.test('F11-5: Identification des effectifs actifs par unité', () => {
    const agentsCC = db.agents.filter(a => a.unite_actuelle_id === 'U-CC-DJIB');
    assert.strictEqual(agentsCC.length, 2);
  });
});

test('Tier 1 — F12 : Dossier agent & matricule unique', async (t) => {
  let db;
  t.beforeEach(() => { db = new DatabaseSimulator(); });

  await t.test('F12-1: Création réussie d\'un agent avec matricule normé PND-YYYY-XXXXX', () => {
    const nouvelAgent = db.creerAgent({
      matricule: 'PND-2026-00450',
      nom: 'Aden',
      prenom: 'Moustapha',
      date_naissance: '1998-07-20',
      corps: 'SOUS_OFFICIERS',
      grade_actuel: 'Sergent',
      unite_actuelle_id: 'U-ARR-1'
    }, SESSIONS_FIXTURES.gestionnaire_rh);

    assert.strictEqual(nouvelAgent.matricule, 'PND-2026-00450');
    assert.strictEqual(nouvelAgent.unite_actuelle_id, 'U-ARR-1');
    assert.strictEqual(nouvelAgent.statut_administratif, 'EN_ACTIVITE');
  });

  await t.test('F12-2: Rejet immédiat en cas de doublon de matricule', () => {
    assert.throws(() => {
      db.creerAgent({
        matricule: 'PND-2020-00142', // Existe déjà (Hassan Ibrahim)
        nom: 'Autre',
        prenom: 'Agent',
        unite_actuelle_id: 'U-CC-DJIB'
      }, SESSIONS_FIXTURES.gestionnaire_rh);
    }, /Doublon détecté/i);
  });

  await t.test('F12-3: Rejet immédiat en cas de format de matricule non conforme', () => {
    assert.throws(() => {
      db.creerAgent({
        matricule: 'MATRICULE_INVALIDE_123',
        nom: 'Test',
        prenom: 'Format',
        unite_actuelle_id: 'U-CC-DJIB'
      }, SESSIONS_FIXTURES.gestionnaire_rh);
    }, /Format de matricule invalide/i);
  });

  await t.test('F12-4: Initialisation automatique du compteur de congés à la création', () => {
    const nouvelAgent = db.creerAgent({
      matricule: 'PND-2026-00999',
      nom: 'Guelleh',
      prenom: 'Souleiman',
      unite_actuelle_id: 'U-CC-DJIB'
    }, SESSIONS_FIXTURES.gestionnaire_rh);

    const solde = db.getSolde(nouvelAgent.id);
    assert.strictEqual(solde.jours_acquis, 30.0);
    assert.strictEqual(solde.jours_pris, 0.0);
    assert.strictEqual(solde.jours_en_attente, 0.0);
    assert.strictEqual(solde.jours_restants, 30.0);
  });

  await t.test('F12-5: Traçabilité de la création de l\'agent dans le journal d\'audit', () => {
    const countAvant = db.audit_log.length;
    db.creerAgent({
      matricule: 'PND-2026-00888',
      nom: 'Osman',
      prenom: 'Ali',
      unite_actuelle_id: 'U-CC-DJIB'
    }, SESSIONS_FIXTURES.gestionnaire_rh);

    assert.strictEqual(db.audit_log.length, countAvant + 1);
    const lastAudit = db.audit_log[db.audit_log.length - 1];
    assert.strictEqual(lastAudit.action_type, 'CREATION_AGENT');
    assert.strictEqual(lastAudit.entite_cible, 'AGENT');
  });
});

test('Tier 1 — F13 : Historique immuable des affectations & mutations', async (t) => {
  let db;
  t.beforeEach(() => { db = new DatabaseSimulator(); });

  await t.test('F13-1: Mutation réussie clôturant l\'affectation précédente et créant la nouvelle', () => {
    const res = db.muterAgent({
      agent_id: 'agt-001',
      nouvelle_unite_id: 'U-REG-ALI',
      date_mutation: '2026-11-01',
      motif: 'Mutation d\'office à Ali-Sabieh',
      numero_arrete: 'Arrêté n° 2026-MUT-089/DGPN',
      operateurSession: SESSIONS_FIXTURES.gestionnaire_rh
    });

    assert.strictEqual(res.agent.unite_actuelle_id, 'U-REG-ALI');
    assert.strictEqual(res.affectation_precedente.est_affectation_courante, false);
    assert.strictEqual(res.affectation_precedente.date_fin, '2026-11-01');
    assert.strictEqual(res.nouvelle_affectation.est_affectation_courante, true);
    assert.strictEqual(res.nouvelle_affectation.unite_id, 'U-REG-ALI');
  });

  await t.test('F13-2: Conservation intégrale : aucune affectation passée n\'est supprimée', () => {
    const countInitial = db.affectations.filter(a => a.agent_id === 'agt-001').length;
    assert.strictEqual(countInitial, 1);

    db.muterAgent({
      agent_id: 'agt-001',
      nouvelle_unite_id: 'U-ARR-2',
      date_mutation: '2026-05-01',
      operateurSession: SESSIONS_FIXTURES.gestionnaire_rh
    });

    db.muterAgent({
      agent_id: 'agt-001',
      nouvelle_unite_id: 'U-REG-DIK',
      date_mutation: '2026-11-01',
      operateurSession: SESSIONS_FIXTURES.gestionnaire_rh
    });

    const affectationsFinales = db.affectations.filter(a => a.agent_id === 'agt-001');
    assert.strictEqual(affectationsFinales.length, 3, 'Exactement 3 lignes conservées sans écrasement');
  });

  await t.test('F13-3: Exactement une seule affectation active (courante) à tout instant', () => {
    const courantes = db.affectations.filter(a => a.agent_id === 'agt-001' && a.est_affectation_courante === true);
    assert.strictEqual(courantes.length, 1);
  });

  await t.test('F13-4: Les motifs et numéros d\'arrêtés ministériels sont enregistrés avec intégrité', () => {
    const res = db.muterAgent({
      agent_id: 'agt-002',
      nouvelle_unite_id: 'U-DPF',
      date_mutation: '2026-11-15',
      motif: 'Renfort Division Aéroportuaire',
      numero_arrete: 'Arrêté n° 2026-AIR-042/DGPN',
      operateurSession: SESSIONS_FIXTURES.gestionnaire_rh
    });

    assert.strictEqual(res.nouvelle_affectation.motif_mouvement, 'Renfort Division Aéroportuaire');
    assert.strictEqual(res.nouvelle_affectation.numero_decision_arrete, 'Arrêté n° 2026-AIR-042/DGPN');
  });

  await t.test('F13-5: Mutation journalisée dans la chaîne d\'audit', () => {
    db.muterAgent({
      agent_id: 'agt-001',
      nouvelle_unite_id: 'U-REG-TAD',
      date_mutation: '2026-12-01',
      operateurSession: SESSIONS_FIXTURES.gestionnaire_rh
    });

    const lastAudit = db.audit_log[db.audit_log.length - 1];
    assert.strictEqual(lastAudit.action_type, 'MUTATION_AGENT');
    assert.strictEqual(lastAudit.details_operation_json.nouvelle_unite_id, 'U-REG-TAD');
  });
});
