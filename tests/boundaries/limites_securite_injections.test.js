const test = require('node:test');
const assert = require('node:assert/strict');
const DatabaseSimulator = require('../helpers/database_simulator.js');
const { checkPrivilegeEscalation, canAccessAgent } = require('../helpers/auth_context.js');
const { SESSIONS_FIXTURES } = require('../fixtures/index.js');

test('Tier 2 — Limites & Bornes : Sécurité, Étanchéité et Injections', async (t) => {
  let db;
  t.beforeEach(() => { db = new DatabaseSimulator(); });

  await t.test('B18: Rejet de rôles fantômes ou non autorisés (SUPER_ADMIN, ROOT, HACKER)', () => {
    const rolesInvalides = ['SUPER_ADMIN', 'ROOT', 'HACKER', 'SYSTEM_OVERRIDE', 'DIRECTEUR_GENERAL_SECRET'];
    const { ROLE_PERMISSIONS } = require('../helpers/auth_context.js');

    for (const r of rolesInvalides) {
      assert.strictEqual(ROLE_PERMISSIONS[r], undefined, `Le rôle fantôme '${r}' n'a aucune existence dans la matrice`);
    }
  });

  await t.test('B19: Rejet de tentatives d\'usurpation d\'unité via payload HTTP forgé', () => {
    const sessionChefCC = { ...SESSIONS_FIXTURES.chef_service_cc };
    const agentAli = { id: 'agt-003', matricule: 'PND-2018-00088', unite_actuelle_id: 'U-REG-ALI' };

    // Tentative d'accès malgré injection d'un header ou paramètre falsifié
    const res = canAccessAgent(sessionChefCC, agentAli);
    assert.strictEqual(res.allowed, false);
    assert.strictEqual(res.code, 403);
  });

  await t.test('B20: Rejet de toute mention de diagnostic médical même dissimulée', () => {
    const tentatives = [
      'Inapte temporaire suite à diabete sévère',
      'Dispense suite à chirurgie cardiaque',
      'Ordonnance n° 4512/2026 prescrivant repos',
      'Symptome d\'hypertension artérielle constatée'
    ];

    for (const tent of tentatives) {
      assert.throws(() => {
        db.enregistrerAptitudeAdministrative({
          agent_id: 'agt-001',
          numero_certificat: `CERT-TENT-${Date.now()}`,
          type_conclusion: 'INAPTE_TEMPORAIRE',
          date_decision: '2026-11-01',
          restrictions_operationnelles: tent
        });
      }, /Violation du secret médical/i, `La mention '${tent}' doit être bloquée`);
    }
  });

  await t.test('B21: Tentative de path traversal dans la génération de documents PDF', () => {
    const { generateOfficialDocument } = require('../helpers/contract_validator.js');
    const docMalveillant = '../../../../etc/passwd';

    assert.throws(() => {
      generateOfficialDocument({
        type_document: docMalveillant,
        agent: db.agents[0],
        donnees_acte: {}
      });
    }, /Type de document non supporté/i);
  });

  await t.test('B22: Tentative d\'altération de l\'horodatage de la chaîne d\'audit', () => {
    const audit1 = db.audit_log[0];
    const horodatageOriginal = audit1.horodatage;

    // Tentative de modification de la date dans le passé
    audit1.horodatage = '2020-01-01T00:00:00Z';

    const { verifyAuditChain } = require('../helpers/crypto_audit.js');
    const res = verifyAuditChain(db.audit_log);
    assert.strictEqual(res.valid, false, 'La falsification de date d\'audit est immédiatement détectée');

    // Restaurer
    audit1.horodatage = horodatageOriginal;
  });
});
