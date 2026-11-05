const test = require('node:test');
const assert = require('node:assert/strict');
const DatabaseSimulator = require('../helpers/database_simulator.js');
const { canAccessAgent } = require('../helpers/auth_context.js');
const { generateOfficialDocument } = require('../helpers/contract_validator.js');
const { verifyAuditChain } = require('../helpers/crypto_audit.js');
const { SESSIONS_FIXTURES } = require('../fixtures/index.js');

test('Tier 3 — Combinaison Multi-Fonctionnalités : Mutation, Bascule des Droits d\'Accès et Conservation d\'Historique', async (t) => {
  let db;
  t.beforeEach(() => { db = new DatabaseSimulator(); });

  await t.test('INT-02: Mutation de Commissariat Central vers Ali-Sabieh avec bascule de supervision N+1', () => {
    const agent = db.agents.find(a => a.id === 'agt-001'); // Hassan Ibrahim au CC-DJIB
    assert.strictEqual(agent.unite_actuelle_id, 'U-CC-DJIB');

    // 1. Avant la mutation :
    // - Le chef du Commissariat Central a accès
    const accesChefAvant = canAccessAgent(SESSIONS_FIXTURES.chef_service_cc, agent);
    assert.strictEqual(accesChefAvant.allowed, true);

    // - Le chef d'Ali-Sabieh est bloqué (403 Forbidden)
    const accesChefAliAvant = canAccessAgent(SESSIONS_FIXTURES.chef_service_ali, agent);
    assert.strictEqual(accesChefAliAvant.allowed, false);
    assert.strictEqual(accesChefAliAvant.code, 403);

    // 2. Exécution de la mutation officielle vers le Commissariat d'Ali-Sabieh
    const resultatMutation = db.muterAgent({
      agent_id: agent.id,
      nouvelle_unite_id: 'U-REG-ALI',
      nouveau_poste_id: 'PST-BRIG-01',
      date_mutation: '2026-11-01',
      motif: 'Mutation pour renfort des effectifs frontaliers',
      numero_arrete: 'Arrêté n° 2026-MUT-550/DGPN',
      operateurSession: SESSIONS_FIXTURES.gestionnaire_rh
    });

    assert.strictEqual(resultatMutation.agent.unite_actuelle_id, 'U-REG-ALI');

    // 3. Après la mutation :
    // - L'ancien chef (Commissariat Central) PERD immédiatement l'accès de gestion (403 Forbidden)
    const accesChefApres = canAccessAgent(SESSIONS_FIXTURES.chef_service_cc, agent);
    assert.strictEqual(accesChefApres.allowed, false);
    assert.strictEqual(accesChefApres.code, 403);
    assert.match(accesChefApres.message, /hors de votre périmètre hiérarchique autorisé/i);

    // - Le nouveau chef (Commissariat Ali-Sabieh) GAGNE immédiatement l'accès de gestion
    const accesChefAliApres = canAccessAgent(SESSIONS_FIXTURES.chef_service_ali, agent);
    assert.strictEqual(accesChefAliApres.allowed, true);
    assert.strictEqual(accesChefAliApres.mode, 'GESTION_UNITE');

    // 4. Vérification de l'intégrité immuable de l'historique
    const historique = db.affectations.filter(aff => aff.agent_id === agent.id);
    assert.strictEqual(historique.length, 2, 'Les 2 affectations (passée et courante) sont conservées');

    const affectationPasse = historique.find(aff => aff.unite_id === 'U-CC-DJIB');
    assert.strictEqual(affectationPasse.est_affectation_courante, false);
    assert.strictEqual(affectationPasse.date_fin, '2026-11-01');

    const affectationNouvelle = historique.find(aff => aff.unite_id === 'U-REG-ALI');
    assert.strictEqual(affectationNouvelle.est_affectation_courante, true);
    assert.strictEqual(affectationNouvelle.date_debut, '2026-11-01');
    assert.strictEqual(affectationNouvelle.date_fin, null);

    // 5. Génération de l'Arrêté officiel de Mutation PDF
    const arretePDF = generateOfficialDocument({
      type_document: 'ARRETE_MUTATION',
      agent,
      donnees_acte: {
        ancienne_unite: 'Commissariat Central de Djibouti',
        nouvelle_unite: 'Commissariat Régional d\'Ali-Sabieh',
        date_prise_effet: '2026-11-01',
        reference_arrete: resultatMutation.nouvelle_affectation.numero_decision_arrete
      },
      operateurSession: SESSIONS_FIXTURES.gestionnaire_rh
    });

    assert.strictEqual(arretePDF.type_document, 'ARRETE_MUTATION');
    assert.strictEqual(arretePDF.signature_electronique_sha256.length, 64);

    // 6. Audit cryptographique
    const auditStatus = verifyAuditChain(db.audit_log);
    assert.strictEqual(auditStatus.valid, true);
  });
});
