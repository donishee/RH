const test = require('node:test');
const assert = require('node:assert/strict');
const DatabaseSimulator = require('../helpers/database_simulator.js');
const { generateOfficialDocument } = require('../helpers/contract_validator.js');
const { verifyAuditChain } = require('../helpers/crypto_audit.js');
const { SESSIONS_FIXTURES } = require('../fixtures/index.js');

test('Tier 3 — Combinaison Multi-Fonctionnalités : Cycle Complet Congés, Soldes Atomiques, Arrêté PDF et Restitution', async (t) => {
  let db;
  t.beforeEach(() => { db = new DatabaseSimulator(); });

  await t.test('INT-01: Cycle complet soumission -> avis chef -> validation RH -> PDF -> annulation', () => {
    const agentId = 'agt-001';

    // 1. Vérification du solde initial
    const solde0 = db.getSolde(agentId);
    assert.strictEqual(solde0.jours_acquis, 30.0);
    assert.strictEqual(solde0.jours_pris, 0.0);
    assert.strictEqual(solde0.jours_en_attente, 0.0);
    assert.strictEqual(solde0.jours_restants, 30.0);

    // 2. Soumission par l'agent de 10 jours de congé
    const { demande, solde: soldeApresSoumission } = db.soumettreDemandeConge({
      agent_id: agentId,
      date_debut: '2026-11-10',
      date_fin: '2026-11-19',
      nombre_jours: 10.0,
      motif: 'Congé annuel légal de repos',
      operateurSession: SESSIONS_FIXTURES.agent_hassan
    });

    assert.strictEqual(demande.statut, 'SOUMIS');
    assert.strictEqual(soldeApresSoumission.jours_en_attente, 10.0);
    assert.strictEqual(soldeApresSoumission.jours_restants, 20.0);
    assert.strictEqual(soldeApresSoumission.jours_pris, 0.0);

    // 3. Approbation hiérarchique Niveau 1 (Chef de Service Commissariat Central)
    const { demande: demChef, solde: soldeChef } = db.approuverChefService({
      demande_id: demande.id,
      chef_service_id: 'usr-chef-cc',
      avis: 'FAVORABLE',
      operateurSession: SESSIONS_FIXTURES.chef_service_cc
    });

    assert.strictEqual(demChef.statut, 'APPROUVE_CHEF_SERVICE');
    assert.strictEqual(demChef.decision_chef_service, 'FAVORABLE');
    assert.strictEqual(soldeChef.jours_en_attente, 10.0);

    // 4. Validation finale Niveau 2 (Gestionnaire RH DRH)
    const { demande: demRH, solde: soldeRH } = db.validerRH({
      demande_id: demande.id,
      gestionnaire_rh_id: 'usr-rh-01',
      version_fournie: demChef.version_concurrence,
      operateurSession: SESSIONS_FIXTURES.gestionnaire_rh
    });

    assert.strictEqual(demRH.statut, 'VALIDE_RH');
    assert.strictEqual(soldeRH.jours_pris, 10.0);
    assert.strictEqual(soldeRH.jours_en_attente, 0.0);
    assert.strictEqual(soldeRH.jours_restants, 20.0);

    // 5. Génération automatique du Titre de Congé officiel en PDF certifié
    const agentObj = db.agents.find(a => a.id === agentId);
    const titrePDF = generateOfficialDocument({
      type_document: 'TITRE_CONGE',
      agent: agentObj,
      donnees_acte: {
        date_debut: demRH.date_debut,
        date_fin: demRH.date_fin,
        nb_jours: demRH.nombre_jours,
        reference_validation: `VAL-RH-${demRH.id}`
      },
      operateurSession: SESSIONS_FIXTURES.gestionnaire_rh
    });

    assert.strictEqual(titrePDF.type_document, 'TITRE_CONGE');
    assert.strictEqual(titrePDF.en_tete.pays, 'RÉPUBLIQUE DE DJIBOUTI');
    assert.strictEqual(titrePDF.filigrane, 'REPRODUCTION INTERDITE - POLICE NATIONALE');
    assert.strictEqual(titrePDF.signature_electronique_sha256.length, 64);

    // 6. Annulation administrative imprévue pour rappel d'urgence de service
    const { demande: demAnnulee, solde: soldeFinal } = db.annulerConge({
      demande_id: demande.id,
      motif_annulation: 'Rappel d\'office pour sécurisation de sommet international',
      operateurSession: SESSIONS_FIXTURES.gestionnaire_rh
    });

    assert.strictEqual(demAnnulee.statut, 'ANNULE');
    assert.strictEqual(soldeFinal.jours_pris, 0.0);
    assert.strictEqual(soldeFinal.jours_en_attente, 0.0);
    assert.strictEqual(soldeFinal.jours_restants, 30.0);

    // 7. Vérification de la chaîne d'audit de l'ensemble du cycle
    const auditStatus = verifyAuditChain(db.audit_log);
    assert.strictEqual(auditStatus.valid, true, 'L\'ensemble de la chaîne d\'audit cryptographique est valide');
  });
});
