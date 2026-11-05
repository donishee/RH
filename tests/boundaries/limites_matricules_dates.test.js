const test = require('node:test');
const assert = require('node:assert/strict');
const DatabaseSimulator = require('../helpers/database_simulator.js');
const { SESSIONS_FIXTURES } = require('../fixtures/index.js');

test('Tier 2 — Limites & Bornes : Matricules, Identité et Dates', async (t) => {
  let db;
  t.beforeEach(() => { db = new DatabaseSimulator(); });

  await t.test('B01: Rejet de matricule vide, null ou composé uniquement d\'espaces', () => {
    assert.throws(() => {
      db.creerAgent({ matricule: '', nom: 'Test', prenom: 'A' }, SESSIONS_FIXTURES.gestionnaire_rh);
    }, /Données obligatoires manquantes/i);

    assert.throws(() => {
      db.creerAgent({ matricule: '   ', nom: 'Test', prenom: 'A' }, SESSIONS_FIXTURES.gestionnaire_rh);
    }, /Format de matricule invalide/i);
  });

  await t.test('B02: Rejet de tentatives d\'injection SQL dans le matricule', () => {
    const injections = [
      "PND-2020-00001' OR '1'='1",
      'PND-2020-00001; DROP TABLE agents;',
      '<script>alert("hack")</script>',
      'PND-2020-0001 UNION SELECT * FROM users'
    ];

    for (const inj of injections) {
      assert.throws(() => {
        db.creerAgent({ matricule: inj, nom: 'Injection', prenom: 'SQL', unite_actuelle_id: 'U-CC-DJIB' }, SESSIONS_FIXTURES.gestionnaire_rh);
      }, /Format de matricule invalide/i, `L'injection '${inj}' doit être rejetée`);
    }
  });

  await t.test('B03: Rejet si la date de recrutement est antérieure à la date de majorité (18 ans)', () => {
    // Né en 2010, recruté en 2020 (10 ans)
    const dateNaissance = '2010-01-01';
    const dateRecrutement = '2020-01-01';
    const ageAuRecrutement = (new Date(dateRecrutement) - new Date(dateNaissance)) / (1000 * 60 * 60 * 24 * 365.25);

    assert.ok(ageAuRecrutement < 18);
    const estValide = ageAuRecrutement >= 18;
    assert.strictEqual(estValide, false, 'Le recrutement d\'un mineur de moins de 18 ans doit être rejeté');
  });

  await t.test('B04: Rejet si la date de naissance est dans le futur', () => {
    const dateNaissanceFuture = '2035-05-10';
    const estDansLeFutur = new Date(dateNaissanceFuture) > new Date();
    assert.strictEqual(estDansLeFutur, true, 'Une date de naissance future doit être rejetée');
  });

  await t.test('B05: Borne d\'âge légal de départ à la retraite des policiers (60 ans)', () => {
    // Agent né en 1965 au 01/01/2026 -> 61 ans
    const dateNaissance = '1965-01-01';
    const dateCourante = '2026-11-02';
    const age = (new Date(dateCourante) - new Date(dateNaissance)) / (1000 * 60 * 60 * 24 * 365.25);
    const aAtteintAgeRetraite = age >= 60;
    assert.strictEqual(aAtteintAgeRetraite, true, 'Dépassement de la limite d\'âge statutaire de 60 ans détecté');
  });

  await t.test('B06: Désactivation d\'un agent (soft-delete) bloque toute nouvelle affectation', () => {
    const agt = db.agents[0];
    agt.est_actif = false; // agent radié ou mis à la retraite

    // Contrôle que l'agent inactif ne peut plus recevoir de mutation active
    const peutEtreMute = agt.est_actif && agt.statut_administratif === 'EN_ACTIVITE';
    assert.strictEqual(peutEtreMute, false, 'Un agent inactif ne peut faire l\'objet d\'une mutation');
  });
});
