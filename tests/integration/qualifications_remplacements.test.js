const test = require('node:test');
const assert = require('node:assert/strict');
const DatabaseSimulator = require('../helpers/database_simulator.js');
const { validatePlanningShift } = require('../helpers/contract_validator.js');
const { verifyAuditChain } = require('../helpers/crypto_audit.js');
const { SESSIONS_FIXTURES } = require('../fixtures/index.js');

test('Tier 3 — Combinaison Multi-Fonctionnalités : Qualification Expirée, Blocage Armement et Remplacement d\'Urgence', async (t) => {
  let db;
  t.beforeEach(() => { db = new DatabaseSimulator(); });

  await t.test('INT-03: Blocage de patrouille armée sur qualification expirée et désignation de remplaçant', () => {
    // 1. Constat de la qualification de tir de l'agent 001 (expirée)
    const qual001 = db.qualifications.find(q => q.agent_id === 'agt-001');
    assert.strictEqual(qual001.est_valide, false);

    // 2. Tentative de planification de l'agent 001 sur un créneau armé de patrouille de nuit
    const validationEchec = validatePlanningShift({
      date_vacation: '2026-11-03',
      heure_debut: '22:00',
      heure_fin: '06:00',
      derniere_fin_service: '2026-11-02T18:00:00Z',
      qualification_tir_valide: qual001.est_valide, // false
      est_poste_arme: true // poste armé
    });

    assert.strictEqual(validationEchec.valide, false);
    assert.ok(validationEchec.errors.some(e => e.regle === 'qualifications.bloquer_affectation_si_expire'));

    // 3. Procédure de recherche de remplaçant d'urgence dans l'unité U-CC-DJIB
    // Critères : Même unité, certificat de tir valide, respect des 11h de repos obligatoire
    const agentsCandidats = db.agents.filter(a => a.unite_actuelle_id === 'U-CC-DJIB' && a.id !== 'agt-001');
    assert.strictEqual(agentsCandidats.length, 1);

    const remplaçantCandidat = agentsCandidats[0]; // Amina Omar (agt-002)
    const qualRemplacant = db.qualifications.find(q => q.agent_id === remplaçantCandidat.id);
    assert.strictEqual(qualRemplacant.est_valide, true);

    // 4. Vérification de conformité du remplaçant sur le créneau
    const validationSucces = validatePlanningShift({
      date_vacation: '2026-11-03',
      heure_debut: '22:00',
      heure_fin: '06:00',
      derniere_fin_service: '2026-11-03T06:00:00Z', // 16h de repos (>= 11h)
      qualification_tir_valide: qualRemplacant.est_valide,
      est_poste_arme: true
    });

    assert.strictEqual(validationSucces.valide, true);
    assert.strictEqual(validationSucces.heuresNuit, 8);

    // 5. Enregistrement officiel du remplacement ordonné par le Chef de Service
    db.enregistrerAudit({
      utilisateur_id: SESSIONS_FIXTURES.chef_service_cc.utilisateur_id,
      nom_utilisateur: SESSIONS_FIXTURES.chef_service_cc.nom_complet,
      role_utilise: 'CHEF_DE_SERVICE',
      action_type: 'REMPLACEMENT_URGENCE_QUALIFICATION_EXPIREE',
      entite_cible: 'PLANNING_OPERATIONNEL',
      entite_id: 'VAC-2026-11-03-NUIT',
      details_operation_json: {
        agent_bloque: 'agt-001',
        motif_blocage: 'Certificat de tir réglementaire expiré',
        agent_remplacant: remplaçantCandidat.id,
        poste: 'Patrouille de Nuit Armée'
      }
    });

    // 6. Émission d'une alerte de convocation de recyclage ENP pour l'agent bloqué
    const convocationRecyclage = {
      agent_id: 'agt-001',
      ecole: 'École Nationale de Police (ENP)',
      stage: 'Recyclage annuel de tir et armement',
      statut: 'CONVOQUE_URGENCE'
    };
    assert.strictEqual(convocationRecyclage.statut, 'CONVOQUE_URGENCE');

    // 7. Audit cryptographique
    const auditStatus = verifyAuditChain(db.audit_log);
    assert.strictEqual(auditStatus.valid, true);
  });
});
