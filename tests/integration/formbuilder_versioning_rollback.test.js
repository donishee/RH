const test = require('node:test');
const assert = require('node:assert/strict');
const DatabaseSimulator = require('../helpers/database_simulator.js');
const { verifyAuditChain } = require('../helpers/crypto_audit.js');
const { SESSIONS_FIXTURES } = require('../fixtures/index.js');

test('Tier 3 — Combinaison Multi-Fonctionnalités : Form Builder No-Code, Versioning de Schéma et Rollback Sans Perte', async (t) => {
  let db;
  t.beforeEach(() => { db = new DatabaseSimulator(); });

  await t.test('INT-04: Cycle Form Builder -> Ajout champ v2 -> Saisie -> Rollback v1 -> Préservation des données', () => {
    // 1. État initial : version 1 active, 0 champ personnalisé
    assert.strictEqual(db.configuration_active_version, 1);
    const configV1 = db.configurations.find(c => c.version_numero === 1);
    assert.strictEqual(configV1.champs_personnalises.length, 0);

    const nbAgentsInitial = db.agents.length;

    // 2. L'Administrateur Fonctionnel RH publie la version 2.0 avec 2 nouveaux champs personnalisés
    const nouveauxChamps = [
      {
        id: 'champ-01',
        cle: 'pointure_rangers',
        libelle: 'Pointure de rangers',
        type_champ: 'nombre',
        ordre_affichage: 1,
        est_obligatoire: true
      },
      {
        id: 'champ-02',
        cle: 'numero_armoire_arme',
        libelle: 'Numéro de casier d\'armurerie',
        type_champ: 'texte',
        ordre_affichage: 2,
        est_obligatoire: false
      }
    ];

    const configV2 = db.publierConfiguration({
      champs_personnalises: nouveauxChamps,
      commentaire: 'Version 2.0 : Ajout champs logistiques et armurerie',
      operateurSession: SESSIONS_FIXTURES.admin_fonctionnel
    });

    assert.strictEqual(db.configuration_active_version, 2);
    assert.strictEqual(configV2.champs_personnalises.length, 2);

    // 3. Saisie des données personnalisées sur un agent existant
    const agent = db.agents.find(a => a.id === 'agt-001');
    agent.champs_personnalises_valeurs = {
      pointure_rangers: 43,
      numero_armoire_arme: 'ARM-CC-B04'
    };

    assert.strictEqual(agent.champs_personnalises_valeurs.pointure_rangers, 43);

    // 4. Décision de retour arrière (Rollback) vers la version 1.0 par l'Admin Fonctionnel RH
    const resRollback = db.rollbackConfiguration(1, SESSIONS_FIXTURES.admin_fonctionnel);

    assert.strictEqual(resRollback.success, true);
    assert.strictEqual(db.configuration_active_version, 1);

    // 5. Vérification de l'intégrité :
    // - Les fiches agents historiques ne sont PAS corrompues
    assert.strictEqual(db.agents.length, nbAgentsInitial);
    const agentApresRollback = db.agents.find(a => a.id === 'agt-001');
    assert.strictEqual(agentApresRollback.matricule, 'PND-2020-00142');
    assert.strictEqual(agentApresRollback.nom, 'Hassan');

    // 6. Les deux événements (publication v2 et rollback v1) sont tracés dans l'audit
    const auditPub = db.audit_log.find(a => a.action_type === 'PUBLICATION_CONFIGURATION_RH');
    const auditRoll = db.audit_log.find(a => a.action_type === 'ROLLBACK_CONFIGURATION_RH');

    assert.ok(auditPub, 'Publication tracée dans l\'audit');
    assert.ok(auditRoll, 'Rollback tracé dans l\'audit');
    assert.strictEqual(auditPub.role_utilise, 'ADMIN_FONCTIONNEL_RH');
    assert.strictEqual(auditRoll.role_utilise, 'ADMIN_FONCTIONNEL_RH');

    // 7. Vérification de la chaîne SHA-256
    const auditStatus = verifyAuditChain(db.audit_log);
    assert.strictEqual(auditStatus.valid, true);
  });
});
