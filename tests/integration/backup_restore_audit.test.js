const test = require('node:test');
const assert = require('node:assert/strict');
const DatabaseSimulator = require('../helpers/database_simulator.js');
const { verifyAuditChain } = require('../helpers/crypto_audit.js');
const { SESSIONS_FIXTURES } = require('../fixtures/index.js');

test('Tier 3 — Combinaison Multi-Fonctionnalités : Procédure de Sauvegarde Chiffrée, Restauration et Audit Forensique', async (t) => {
  let db;
  t.beforeEach(() => { db = new DatabaseSimulator(); });

  await t.test('INT-05: Procédure complète de sauvegarde, sinistre simulé, restauration et contrôle forensique SHA-256', () => {
    // 1. État stable de référence
    const agentsDepart = db.agents.length;
    const affectationsDepart = db.affectations.length;
    const auditDepart = db.audit_log.length;

    // 2. Déclenchement de la sauvegarde complète par l'Admin Technique
    const backupSnapshot = db.sauvegarder(SESSIONS_FIXTURES.admin_technique);

    assert.strictEqual(backupSnapshot.version_format, '1.0');
    assert.strictEqual(backupSnapshot.checksum_sha256.length, 64);
    assert.ok(backupSnapshot.donnees.agents.length === agentsDepart);

    // 3. Sinistre ou altération malveillante simulée :
    // - Injection d'un faux agent
    db.agents.push({
      id: 'agt-malveillant',
      matricule: 'PND-9999-00000',
      nom: 'Intrus',
      prenom: 'Pirate'
    });
    // - Suppression illicite d'une affectation
    db.affectations.pop();

    assert.strictEqual(db.agents.length, agentsDepart + 1);
    assert.strictEqual(db.affectations.length, affectationsDepart - 1);

    // 4. Déclenchement de la procédure de restauration par l'Admin Technique
    const resultatRestauration = db.restaurer(backupSnapshot, SESSIONS_FIXTURES.admin_technique);

    assert.strictEqual(resultatRestauration.success, true);
    assert.strictEqual(resultatRestauration.agents_restaures, agentsDepart);
    assert.strictEqual(resultatRestauration.affectations_restaurees, affectationsDepart);

    // 5. Vérification de la disparition complète des données corrompues
    const intrus = db.agents.find(a => a.id === 'agt-malveillant');
    assert.strictEqual(intrus, undefined, 'L\'agent intrus a été complètement purgé par la restauration');
    assert.strictEqual(db.agents.length, agentsDepart);
    assert.strictEqual(db.affectations.length, affectationsDepart);

    // 6. Vérification de l'intégrité intégrale de la chaîne cryptographique SHA-256 après restauration
    const verifAudit = verifyAuditChain(db.audit_log);
    assert.strictEqual(verifAudit.valid, true, 'La chaîne cryptographique d\'audit est 100% intègre');
    assert.strictEqual(verifAudit.errors.length, 0);

    // 7. L'événement de restauration est le dernier log d'audit
    const dernierLog = db.audit_log[db.audit_log.length - 1];
    assert.strictEqual(dernierLog.action_type, 'RESTAURATION_SYSTEME_REUSSIE');
    assert.strictEqual(dernierLog.role_utilise, 'ADMIN_TECHNIQUE');
  });
});
