const test = require('node:test');
const assert = require('node:assert/strict');
const { SESSIONS_FIXTURES } = require('../fixtures/index.js');
const { canAccessAgent, checkPrivilegeEscalation, ROLE_PERMISSIONS } = require('../helpers/auth_context.js');
const { computeChainedHash, verifyAuditChain, GENESIS_HASH } = require('../helpers/crypto_audit.js');
const DatabaseSimulator = require('../helpers/database_simulator.js');

test('Tier 1 — F08 : Authentification renforcée & IAM 6 rôles', async (t) => {
  await t.test('F08-1: Les 6 rôles obligatoires sont distincts et définis', () => {
    const rolesAttendus = [
      'ADMIN_TECHNIQUE',
      'ADMIN_FONCTIONNEL_RH',
      'GESTIONNAIRE_RH',
      'CHEF_DE_SERVICE',
      'AGENT',
      'AUDITEUR'
    ];
    for (const r of rolesAttendus) {
      assert.ok(ROLE_PERMISSIONS[r], `Permissions définies pour le rôle ${r}`);
      assert.ok(ROLE_PERMISSIONS[r].length > 0, `Au moins une permission pour ${r}`);
    }
  });

  await t.test('F08-2: Admin Technique n\'a AUCUN droit de consultation des dossiers agents', () => {
    const agent = { id: 'agt-001', matricule: 'PND-2020-00142', unite_actuelle_id: 'U-CC-DJIB' };
    const res = canAccessAgent(SESSIONS_FIXTURES.admin_technique, agent);
    assert.strictEqual(res.allowed, false);
    assert.strictEqual(res.code, 403);
    assert.match(res.message, /administrateurs techniques ne disposent d'aucun droit/i);
  });

  await t.test('F08-3: Agent simple ne peut consulter QUE son propre dossier', () => {
    const propreAgent = { id: 'agt-001', matricule: 'PND-2020-00142', unite_actuelle_id: 'U-CC-DJIB' };
    const autreAgent = { id: 'agt-002', matricule: 'PND-2022-00305', unite_actuelle_id: 'U-CC-DJIB' };

    const resPropre = canAccessAgent(SESSIONS_FIXTURES.agent_hassan, propreAgent);
    assert.strictEqual(resPropre.allowed, true);
    assert.strictEqual(resPropre.mode, 'CONSULTATION_PROPRE_DOSSIER');

    const resAutre = canAccessAgent(SESSIONS_FIXTURES.agent_hassan, autreAgent);
    assert.strictEqual(resAutre.allowed, false);
    assert.strictEqual(resAutre.code, 403);
  });

  await t.test('F08-4: Gestionnaire RH dispose d\'un droit global de consultation', () => {
    const agentAli = { id: 'agt-003', matricule: 'PND-2018-00088', unite_actuelle_id: 'U-REG-ALI' };
    const res = canAccessAgent(SESSIONS_FIXTURES.gestionnaire_rh, agentAli);
    assert.strictEqual(res.allowed, true);
    assert.strictEqual(res.code, 200);
    assert.strictEqual(res.mode, 'COMPLET');
  });

  await t.test('F08-5: Auditeur accède en lecture seule stricte', () => {
    const agent = { id: 'agt-001', matricule: 'PND-2020-00142', unite_actuelle_id: 'U-CC-DJIB' };
    const res = canAccessAgent(SESSIONS_FIXTURES.auditeur, agent);
    assert.strictEqual(res.allowed, true);
    assert.strictEqual(res.mode, 'LECTURE_SEULE');
  });
});

test('Tier 1 — F09 : Contrôle d\'accès serveur RBAC & ABAC Unité', async (t) => {
  await t.test('F09-1: Chef de service accède à un agent de sa propre unité', () => {
    const agentCC = { id: 'agt-001', matricule: 'PND-2020-00142', unite_actuelle_id: 'U-CC-DJIB' };
    const res = canAccessAgent(SESSIONS_FIXTURES.chef_service_cc, agentCC);
    assert.strictEqual(res.allowed, true);
    assert.strictEqual(res.code, 200);
  });

  await t.test('F09-2: Chef de service accède à un agent d\'une sous-unité hiérarchique', () => {
    const agentArr1 = { id: 'agt-arr1', matricule: 'PND-2023-00099', unite_actuelle_id: 'U-ARR-1' };
    const res = canAccessAgent(SESSIONS_FIXTURES.chef_service_cc, agentArr1);
    assert.strictEqual(res.allowed, true);
    assert.strictEqual(res.code, 200);
  });

  await t.test('F09-3: Chef de service bloqué s\'il tente d\'accéder à une autre unité hors périmètre', () => {
    const agentAli = { id: 'agt-003', matricule: 'PND-2018-00088', unite_actuelle_id: 'U-REG-ALI' };
    const res = canAccessAgent(SESSIONS_FIXTURES.chef_service_cc, agentAli);
    assert.strictEqual(res.allowed, false);
    assert.strictEqual(res.code, 403);
    assert.match(res.message, /hors de votre périmètre hiérarchique autorisé/i);
  });

  await t.test('F09-4: Blocage absolu de tentative d\'élévation de privilèges', () => {
    const tentativeEscalade = { role: 'ADMIN_TECHNIQUE' };
    const res = checkPrivilegeEscalation(SESSIONS_FIXTURES.agent_hassan, tentativeEscalade);
    assert.strictEqual(res.isEscalation, true);
    assert.strictEqual(res.code, 403);
    assert.match(res.message, /élévation de privilèges bloquée/i);
  });

  await t.test('F09-5: Blocage de tentative d\'auto-attribution d\'unités autorisées', () => {
    const tentativeUnites = { unites_autorisees: ['*'] };
    const res = checkPrivilegeEscalation(SESSIONS_FIXTURES.chef_service_ali, tentativeUnites);
    assert.strictEqual(res.isEscalation, true);
    assert.strictEqual(res.field, 'unites_autorisees');
  });
});

test('Tier 1 — F10 : Journal d\'audit immuable chaîné SHA-256', async (t) => {
  let db;

  t.beforeEach(() => {
    db = new DatabaseSimulator();
  });

  await t.test('F10-1: Initialisation avec bloc genèse valide et empreinte SHA-256', () => {
    assert.ok(db.audit_log.length >= 1);
    const genesis = db.audit_log[0];
    assert.strictEqual(genesis.empreinte_precedente, GENESIS_HASH);
    assert.strictEqual(genesis.empreinte_courante.length, 64);
  });

  await t.test('F10-2: Chaînage cryptographique inviolable de chaque entrée', () => {
    db.enregistrerAudit({
      utilisateur_id: 'usr-rh-01',
      nom_utilisateur: 'Yassin Barkat',
      role_utilise: 'GESTIONNAIRE_RH',
      action_type: 'CONSULTATION_DOSSIER',
      entite_cible: 'AGENT',
      entite_id: 'agt-001',
      details_operation_json: { motif: 'Vérification administrative' }
    });

    db.enregistrerAudit({
      utilisateur_id: 'usr-rh-01',
      nom_utilisateur: 'Yassin Barkat',
      role_utilise: 'GESTIONNAIRE_RH',
      action_type: 'EXPORT_DONNEES',
      entite_cible: 'LISTE_AGENTS',
      entite_id: 'U-CC-DJIB',
      details_operation_json: { format: 'CSV', nb_lignes: 25 }
    });

    assert.strictEqual(db.audit_log.length, 3);
    const verif = verifyAuditChain(db.audit_log);
    assert.strictEqual(verif.valid, true);
    assert.strictEqual(verif.errors.length, 0);
  });

  await t.test('F10-3: Détection immédiate d\'une altération frauduleuse sur un log intermédiaire', () => {
    db.enregistrerAudit({
      utilisateur_id: 'usr-01',
      action_type: 'TEST_1',
      details_operation_json: { val: 1 }
    });
    db.enregistrerAudit({
      utilisateur_id: 'usr-02',
      action_type: 'TEST_2',
      details_operation_json: { val: 2 }
    });

    // Altération clandestine du contenu de l'entrée 1
    db.audit_log[1].details_operation_json = { val: 'MODIFIE_FRAUDULEUSEMENT' };

    const verif = verifyAuditChain(db.audit_log);
    assert.strictEqual(verif.valid, false);
    assert.ok(verif.errors.length > 0);
    assert.match(verif.errors[0].error, /Altération détectée/i);
  });

  await t.test('F10-4: Détection immédiate d\'une suppression intermédiaire dans l\'audit', () => {
    db.enregistrerAudit({ utilisateur_id: 'u1', action_type: 'A1' });
    db.enregistrerAudit({ utilisateur_id: 'u2', action_type: 'A2' });
    db.enregistrerAudit({ utilisateur_id: 'u3', action_type: 'A3' });

    // Suppression illicite de l'entrée n°2
    db.audit_log.splice(1, 1);

    const verif = verifyAuditChain(db.audit_log);
    assert.strictEqual(verif.valid, false);
    assert.match(verif.errors[0].error, /Rupture de chaînage/i);
  });

  await t.test('F10-5: Interdiction formelle d\'écriture d\'UPDATE ou DELETE sur les journaux d\'audit', () => {
    assert.throws(() => {
      db.modifierAuditInterdit(1);
    }, /Violation de sécurité : Les journaux d'audit sont strictement inaltérables/i);

    assert.throws(() => {
      db.supprimerAuditInterdit(1);
    }, /Violation de sécurité : Les journaux d'audit sont strictement inaltérables/i);
  });
});
