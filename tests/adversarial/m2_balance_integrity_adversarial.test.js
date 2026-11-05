const test = require('node:test');
const assert = require('node:assert/strict');

// Chargement du serveur compilé ou via tsx
let creerApplicationServeur;
let fermerPool;
let pool;
try {
  creerApplicationServeur = require('../../dist/server.js').creerApplicationServeur;
  const dbModule = require('../../dist/database/index.js');
  fermerPool = dbModule.fermerPool;
  pool = dbModule.pool;
} catch {
  require('tsx/cjs');
  creerApplicationServeur = require('../../src/server.ts').creerApplicationServeur;
  const dbModule = require('../../src/database/index.ts');
  fermerPool = dbModule.fermerPool;
  pool = dbModule.pool;
}

test('CHALLENGER M2-2 : Épreuves Adversariales d\'Invariance des Soldes, Limites et Intégrité des Données', async (t) => {
  let app;
  let jetonGestionnaireRH;
  let jetonChefCC;
  let jetonAgentHassan;
  let jetonChefAli;

  // Helpers pour vérifier l'invariance mathématique directement en base SQL
  const verifierInvarianceSQL = async (agentId = 'agt-001', annee = 2026) => {
    const res = await pool.query(`
      SELECT jours_acquis, jours_reportes, jours_pris, jours_en_attente, jours_restants
      FROM soldes_conges
      WHERE agent_id = $1 AND annee = $2 AND type_conge_id = 'tc-annuel'
    `, [agentId, annee]);
    assert.ok(res.rows.length > 0, `Solde non trouvé en base pour l'agent ${agentId}`);
    const r = res.rows[0];
    const acquis = Number(r.jours_acquis);
    const reportes = Number(r.jours_reportes);
    const pris = Number(r.jours_pris);
    const attente = Number(r.jours_en_attente);
    const restants = Number(r.jours_restants);

    const sommeAllouee = Math.round((acquis + reportes) * 10) / 10;
    const sommeDecompte = Math.round((pris + attente + restants) * 10) / 10;
    assert.strictEqual(
      sommeAllouee,
      sommeDecompte,
      `VIOLATION D'INVARIANCE SQL : acquis(${acquis}) + reportes(${reportes}) = ${sommeAllouee} !== pris(${pris}) + attente(${attente}) + restants(${restants}) = ${sommeDecompte}`
    );
    return { acquis, reportes, pris, attente, restants };
  };

  const reinitialiserSoldeAgent = async (agentId = 'agt-001', acquis = 30.0, reportes = 0.0) => {
    await pool.query(`DELETE FROM validations_conges WHERE demande_id IN (SELECT id FROM demandes_conges WHERE agent_id = $1)`, [agentId]);
    await pool.query(`DELETE FROM demandes_conges WHERE agent_id = $1`, [agentId]);
    await pool.query(`
      UPDATE soldes_conges
      SET jours_acquis = $2, jours_reportes = $3, jours_pris = 0.0, jours_en_attente = 0.0, modifie_le = CURRENT_TIMESTAMP
      WHERE agent_id = $1 AND type_conge_id = 'tc-annuel' AND annee = 2026
    `, [agentId, acquis, reportes]);
  };

  t.before(async () => {
    app = await creerApplicationServeur();
    await app.ready();

    const login = async (identifiant) => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/connexion',
        payload: { identifiant, mot_de_passe: 'Police@2026!' }
      });
      assert.strictEqual(res.statusCode, 200, `Échec de connexion pour ${identifiant}`);
      return JSON.parse(res.payload).jeton;
    };

    jetonGestionnaireRH = await login('gestionnaire_rh');
    jetonChefCC = await login('chef_cc');
    jetonAgentHassan = await login('agent_hassan');
    jetonChefAli = await login('chef_ali');
  });

  t.after(async () => {
    // Rétablissement propre des données de base
    await reinitialiserSoldeAgent('agt-001', 30.0, 0.0);
    await reinitialiserSoldeAgent('agt-002', 30.0, 0.0);
    if (app) await app.close();
    if (fermerPool && !pool?.ending && !pool?.ended) {
      await fermerPool().catch(() => {});
    }
  });

  // ==========================================================================
  // GROUPE 1 : Invariance Mathématique Absolue des Soldes à chaque transition
  // jours_acquis + jours_reportes = jours_pris + jours_en_attente + jours_restants
  // ==========================================================================
  await t.test('G1-01 : Invariance cycle nominal complet (Initial -> Soumission -> Visa Chef -> Validation DRH -> Annulation)', async () => {
    await reinitialiserSoldeAgent('agt-001', 30.0, 0.0);

    // 1. État Initial
    const sInit = await verifierInvarianceSQL('agt-001');
    assert.strictEqual(sInit.acquis, 30.0);
    assert.strictEqual(sInit.reportes, 0.0);
    assert.strictEqual(sInit.pris, 0.0);
    assert.strictEqual(sInit.attente, 0.0);
    assert.strictEqual(sInit.restants, 30.0);

    // 2. Soumission de 10 jours
    const resSoumis = await app.inject({
      method: 'POST',
      url: '/api/conges/demandes',
      headers: { Authorization: `Bearer ${jetonAgentHassan}` },
      payload: {
        type_conge_id: 'tc-annuel',
        date_debut: '2026-05-01',
        date_fin: '2026-05-10',
        nombre_jours: 10.0,
        motif: 'Congé annuel test invariance'
      }
    });
    assert.strictEqual(resSoumis.statusCode, 201);
    const dId = JSON.parse(resSoumis.payload).demande.id;

    const sSoumis = await verifierInvarianceSQL('agt-001');
    assert.strictEqual(sSoumis.pris, 0.0);
    assert.strictEqual(sSoumis.attente, 10.0);
    assert.strictEqual(sSoumis.restants, 20.0);
    assert.strictEqual(sSoumis.acquis + sSoumis.reportes, sSoumis.pris + sSoumis.attente + sSoumis.restants);

    // 3. Visa Chef Favorable
    const resVisa = await app.inject({
      method: 'PUT',
      url: `/api/conges/demandes/${dId}/viser-chef`,
      headers: { Authorization: `Bearer ${jetonChefCC}` },
      payload: { avis: 'FAVORABLE' }
    });
    assert.strictEqual(resVisa.statusCode, 200);

    const sVisa = await verifierInvarianceSQL('agt-001');
    assert.strictEqual(sVisa.pris, 0.0);
    assert.strictEqual(sVisa.attente, 10.0);
    assert.strictEqual(sVisa.restants, 20.0);
    assert.strictEqual(sVisa.acquis + sVisa.reportes, sVisa.pris + sVisa.attente + sVisa.restants);

    // 4. Validation finale DRH
    const resValide = await app.inject({
      method: 'PUT',
      url: `/api/conges/demandes/${dId}/valider-rh`,
      headers: { Authorization: `Bearer ${jetonGestionnaireRH}` },
      payload: { decision: 'VALIDE', version_concurrence: 2 }
    });
    assert.strictEqual(resValide.statusCode, 200);

    const sValide = await verifierInvarianceSQL('agt-001');
    assert.strictEqual(sValide.pris, 10.0);
    assert.strictEqual(sValide.attente, 0.0);
    assert.strictEqual(sValide.restants, 20.0);
    assert.strictEqual(sValide.acquis + sValide.reportes, sValide.pris + sValide.attente + sValide.restants);

    // 5. Annulation post-validation
    const resAnnul = await app.inject({
      method: 'POST',
      url: `/api/conges/demandes/${dId}/annuler`,
      headers: { Authorization: `Bearer ${jetonAgentHassan}` },
      payload: { motif_annulation: 'Rappel pour impératif opérationnel' }
    });
    assert.strictEqual(resAnnul.statusCode, 200);

    const sAnnul = await verifierInvarianceSQL('agt-001');
    assert.strictEqual(sAnnul.pris, 0.0);
    assert.strictEqual(sAnnul.attente, 0.0);
    assert.strictEqual(sAnnul.restants, 30.0);
    assert.strictEqual(sAnnul.acquis + sAnnul.reportes, sAnnul.pris + sAnnul.attente + sAnnul.restants);
  });

  await t.test('G1-02 : Invariance lors d\'un refus motivé du Chef de Service', async () => {
    await reinitialiserSoldeAgent('agt-001', 30.0, 0.0);

    // Soumission 12 jours
    const resSoumis = await app.inject({
      method: 'POST',
      url: '/api/conges/demandes',
      headers: { Authorization: `Bearer ${jetonAgentHassan}` },
      payload: {
        type_conge_id: 'tc-annuel',
        date_debut: '2026-06-01',
        date_fin: '2026-06-12',
        nombre_jours: 12.0,
        motif: 'Demande soumise avant refus chef'
      }
    });
    assert.strictEqual(resSoumis.statusCode, 201);
    const dId = JSON.parse(resSoumis.payload).demande.id;

    let s = await verifierInvarianceSQL('agt-001');
    assert.strictEqual(s.attente, 12.0);
    assert.strictEqual(s.restants, 18.0);

    // Refus Chef avec motif
    const resRefus = await app.inject({
      method: 'PUT',
      url: `/api/conges/demandes/${dId}/viser-chef`,
      headers: { Authorization: `Bearer ${jetonChefCC}` },
      payload: { avis: 'DEFAVORABLE', motif_refus: 'Maintien de l\'ordre public' }
    });
    assert.strictEqual(resRefus.statusCode, 200);

    s = await verifierInvarianceSQL('agt-001');
    assert.strictEqual(s.attente, 0.0);
    assert.strictEqual(s.pris, 0.0);
    assert.strictEqual(s.restants, 30.0);
    assert.strictEqual(s.acquis + s.reportes, s.pris + s.attente + s.restants);
  });

  await t.test('G1-03 : Invariance lors d\'un refus motivé de la DRH (post-visa chef)', async () => {
    await reinitialiserSoldeAgent('agt-001', 30.0, 0.0);

    // Soumission 14 jours
    const resSoumis = await app.inject({
      method: 'POST',
      url: '/api/conges/demandes',
      headers: { Authorization: `Bearer ${jetonAgentHassan}` },
      payload: {
        type_conge_id: 'tc-annuel',
        date_debut: '2026-07-01',
        date_fin: '2026-07-14',
        nombre_jours: 14.0,
        motif: 'Demande soumise avant refus DRH'
      }
    });
    assert.strictEqual(resSoumis.statusCode, 201);
    const dId = JSON.parse(resSoumis.payload).demande.id;

    // Visa chef
    await app.inject({
      method: 'PUT',
      url: `/api/conges/demandes/${dId}/viser-chef`,
      headers: { Authorization: `Bearer ${jetonChefCC}` },
      payload: { avis: 'FAVORABLE' }
    });

    let s = await verifierInvarianceSQL('agt-001');
    assert.strictEqual(s.attente, 14.0);
    assert.strictEqual(s.restants, 16.0);

    // Refus DRH avec motif
    const resRefusRH = await app.inject({
      method: 'PUT',
      url: `/api/conges/demandes/${dId}/valider-rh`,
      headers: { Authorization: `Bearer ${jetonGestionnaireRH}` },
      payload: { decision: 'REFUS', motif_refus: 'Quota national annuel dépassé pour le corps' }
    });
    assert.strictEqual(resRefusRH.statusCode, 200);

    s = await verifierInvarianceSQL('agt-001');
    assert.strictEqual(s.attente, 0.0);
    assert.strictEqual(s.pris, 0.0);
    assert.strictEqual(s.restants, 30.0);
    assert.strictEqual(s.acquis + s.reportes, s.pris + s.attente + s.restants);
  });

  await t.test('G1-04 : Invariance lors d\'une annulation en phase SOUMIS (avant avis chef)', async () => {
    await reinitialiserSoldeAgent('agt-001', 30.0, 0.0);

    const resSoumis = await app.inject({
      method: 'POST',
      url: '/api/conges/demandes',
      headers: { Authorization: `Bearer ${jetonAgentHassan}` },
      payload: {
        type_conge_id: 'tc-annuel',
        date_debut: '2026-08-01',
        date_fin: '2026-08-05',
        nombre_jours: 5.0,
        motif: 'Demande à annuler directement'
      }
    });
    assert.strictEqual(resSoumis.statusCode, 201);
    const dId = JSON.parse(resSoumis.payload).demande.id;

    let s = await verifierInvarianceSQL('agt-001');
    assert.strictEqual(s.attente, 5.0);
    assert.strictEqual(s.restants, 25.0);

    const resAnnul = await app.inject({
      method: 'POST',
      url: `/api/conges/demandes/${dId}/annuler`,
      headers: { Authorization: `Bearer ${jetonAgentHassan}` },
      payload: { motif_annulation: 'Changement d\'avis avant instruction' }
    });
    assert.strictEqual(resAnnul.statusCode, 200);

    s = await verifierInvarianceSQL('agt-001');
    assert.strictEqual(s.attente, 0.0);
    assert.strictEqual(s.pris, 0.0);
    assert.strictEqual(s.restants, 30.0);
    assert.strictEqual(s.acquis + s.reportes, s.pris + s.attente + s.restants);
  });

  await t.test('G1-05 : Invariance lors d\'une annulation en phase APPROUVE_CHEF_SERVICE (avant DRH)', async () => {
    await reinitialiserSoldeAgent('agt-001', 30.0, 0.0);

    const resSoumis = await app.inject({
      method: 'POST',
      url: '/api/conges/demandes',
      headers: { Authorization: `Bearer ${jetonAgentHassan}` },
      payload: {
        type_conge_id: 'tc-annuel',
        date_debut: '2026-08-10',
        date_fin: '2026-08-16',
        nombre_jours: 7.0,
        motif: 'Demande visée chef puis annulée'
      }
    });
    const dId = JSON.parse(resSoumis.payload).demande.id;

    await app.inject({
      method: 'PUT',
      url: `/api/conges/demandes/${dId}/viser-chef`,
      headers: { Authorization: `Bearer ${jetonChefCC}` },
      payload: { avis: 'FAVORABLE' }
    });

    let s = await verifierInvarianceSQL('agt-001');
    assert.strictEqual(s.attente, 7.0);
    assert.strictEqual(s.restants, 23.0);

    const resAnnul = await app.inject({
      method: 'POST',
      url: `/api/conges/demandes/${dId}/annuler`,
      headers: { Authorization: `Bearer ${jetonAgentHassan}` },
      payload: { motif_annulation: 'Révocation volontaire de la demande' }
    });
    assert.strictEqual(resAnnul.statusCode, 200);

    s = await verifierInvarianceSQL('agt-001');
    assert.strictEqual(s.attente, 0.0);
    assert.strictEqual(s.pris, 0.0);
    assert.strictEqual(s.restants, 30.0);
    assert.strictEqual(s.acquis + s.reportes, s.pris + s.attente + s.restants);
  });

  await t.test('G1-06 : Invariance avec jours reportés positifs (acquis 30j + reportes 10j = 40j)', async () => {
    // Initialisation avec 10 jours de report légal
    await reinitialiserSoldeAgent('agt-001', 30.0, 10.0);

    let s = await verifierInvarianceSQL('agt-001');
    assert.strictEqual(s.acquis, 30.0);
    assert.strictEqual(s.reportes, 10.0);
    assert.strictEqual(s.restants, 40.0);

    // Soumission de 25 jours (supérieur au quota annuel de 30j mais dans le solde total de 40j)
    const resSoumis = await app.inject({
      method: 'POST',
      url: '/api/conges/demandes',
      headers: { Authorization: `Bearer ${jetonAgentHassan}` },
      payload: {
        type_conge_id: 'tc-annuel',
        date_debut: '2026-09-01',
        date_fin: '2026-09-25',
        nombre_jours: 25.0,
        motif: 'Congé prolongé avec utilisation des jours reportés'
      }
    });
    assert.strictEqual(resSoumis.statusCode, 201);
    const dId = JSON.parse(resSoumis.payload).demande.id;

    s = await verifierInvarianceSQL('agt-001');
    assert.strictEqual(s.attente, 25.0);
    assert.strictEqual(s.restants, 15.0);
    assert.strictEqual(s.acquis + s.reportes, s.pris + s.attente + s.restants);

    // Visa et validation
    await app.inject({
      method: 'PUT',
      url: `/api/conges/demandes/${dId}/viser-chef`,
      headers: { Authorization: `Bearer ${jetonChefCC}` },
      payload: { avis: 'FAVORABLE' }
    });
    await app.inject({
      method: 'PUT',
      url: `/api/conges/demandes/${dId}/valider-rh`,
      headers: { Authorization: `Bearer ${jetonGestionnaireRH}` },
      payload: { decision: 'VALIDE', version_concurrence: 2 }
    });

    s = await verifierInvarianceSQL('agt-001');
    assert.strictEqual(s.pris, 25.0);
    assert.strictEqual(s.attente, 0.0);
    assert.strictEqual(s.restants, 15.0);
    assert.strictEqual(s.acquis + s.reportes, s.pris + s.attente + s.restants);

    // Annulation
    await app.inject({
      method: 'POST',
      url: `/api/conges/demandes/${dId}/annuler`,
      headers: { Authorization: `Bearer ${jetonAgentHassan}` },
      payload: { motif_annulation: 'Report de mission' }
    });

    s = await verifierInvarianceSQL('agt-001');
    assert.strictEqual(s.pris, 0.0);
    assert.strictEqual(s.attente, 0.0);
    assert.strictEqual(s.restants, 40.0);
    assert.strictEqual(s.acquis + s.reportes, s.pris + s.attente + s.restants);
  });

  // ==========================================================================
  // GROUPE 2 : Épreuves aux Limites et Bornes de Solde (B07, B08)
  // ==========================================================================
  await t.test('G2-01 : Demande de 100% du solde restant (30.0j) -> Autorisée et solde_restant = 0', async () => {
    await reinitialiserSoldeAgent('agt-001', 30.0, 0.0);

    const res100 = await app.inject({
      method: 'POST',
      url: '/api/conges/demandes',
      headers: { Authorization: `Bearer ${jetonAgentHassan}` },
      payload: {
        type_conge_id: 'tc-annuel',
        date_debut: '2026-10-01',
        date_fin: '2026-10-30',
        nombre_jours: 30.0,
        motif: 'Consommation intégrale du solde restant (100%)'
      }
    });
    assert.strictEqual(res100.statusCode, 201);
    const corps = JSON.parse(res100.payload);
    assert.strictEqual(corps.solde.jours_en_attente, 30.0);
    assert.strictEqual(corps.solde.jours_restants, 0.0);

    const s = await verifierInvarianceSQL('agt-001');
    assert.strictEqual(s.attente, 30.0);
    assert.strictEqual(s.restants, 0.0);
    assert.strictEqual(s.acquis + s.reportes, s.pris + s.attente + s.restants);

    // Nettoyage
    const dId = corps.demande.id;
    await app.inject({
      method: 'POST',
      url: `/api/conges/demandes/${dId}/annuler`,
      headers: { Authorization: `Bearer ${jetonAgentHassan}` },
      payload: { motif_annulation: 'Nettoyage épreuve 100%' }
    });
  });

  await t.test('G2-02 : Dépassement minimal de 0.5 jour (30.5j demandés pour solde de 30.0j) -> Rejeté sans altération', async () => {
    await reinitialiserSoldeAgent('agt-001', 30.0, 0.0);

    const resDepassement = await app.inject({
      method: 'POST',
      url: '/api/conges/demandes',
      headers: { Authorization: `Bearer ${jetonAgentHassan}` },
      payload: {
        type_conge_id: 'tc-annuel',
        date_debut: '2026-10-01',
        date_fin: '2026-10-31',
        nombre_jours: 30.5,
        motif: 'Tentative de dépassement de 0.5j'
      }
    });
    assert.strictEqual(resDepassement.statusCode, 400);
    const corps = JSON.parse(resDepassement.payload);
    assert.strictEqual(corps.code_erreur, 'SOLDE_INSUFFISANT');
    assert.match(corps.message, /Solde insuffisant/i);

    // Vérification que le solde est rigoureusement intact en base
    const s = await verifierInvarianceSQL('agt-001');
    assert.strictEqual(s.attente, 0.0);
    assert.strictEqual(s.pris, 0.0);
    assert.strictEqual(s.restants, 30.0);
  });

  await t.test('G2-03 : Dépassement de 0.5 jour sur solde intermédiaire restant (20j déjà engagés, reste 10j, demande 10.5j)', async () => {
    await reinitialiserSoldeAgent('agt-001', 30.0, 0.0);

    // Première demande de 20 jours
    const res20 = await app.inject({
      method: 'POST',
      url: '/api/conges/demandes',
      headers: { Authorization: `Bearer ${jetonAgentHassan}` },
      payload: {
        type_conge_id: 'tc-annuel',
        date_debut: '2026-04-01',
        date_fin: '2026-04-20',
        nombre_jours: 20.0,
        motif: 'Première tranche'
      }
    });
    assert.strictEqual(res20.statusCode, 201);
    const d20Id = JSON.parse(res20.payload).demande.id;

    // Tentative de soumettre 10.5 jours alors qu'il n'en reste que 10.0
    const resOver = await app.inject({
      method: 'POST',
      url: '/api/conges/demandes',
      headers: { Authorization: `Bearer ${jetonAgentHassan}` },
      payload: {
        type_conge_id: 'tc-annuel',
        date_debut: '2026-05-01',
        date_fin: '2026-05-11',
        nombre_jours: 10.5,
        motif: 'Dépassement de tranche'
      }
    });
    assert.strictEqual(resOver.statusCode, 400);
    assert.match(JSON.parse(resOver.payload).message, /Solde insuffisant/i);

    // Solde intermédiaire préservé
    const s = await verifierInvarianceSQL('agt-001');
    assert.strictEqual(s.attente, 20.0);
    assert.strictEqual(s.restants, 10.0);

    // Nettoyage
    await app.inject({
      method: 'POST',
      url: `/api/conges/demandes/${d20Id}/annuler`,
      headers: { Authorization: `Bearer ${jetonAgentHassan}` },
      payload: { motif_annulation: 'Nettoyage test intermédiaire' }
    });
  });

  await t.test('G2-04 : Rejet strict des durées nulles et négatives (0j, -1j, -0.5j)', async () => {
    await reinitialiserSoldeAgent('agt-001', 30.0, 0.0);

    // 1. Durée nulle
    const resZero = await app.inject({
      method: 'POST',
      url: '/api/conges/demandes',
      headers: { Authorization: `Bearer ${jetonAgentHassan}` },
      payload: {
        type_conge_id: 'tc-annuel',
        date_debut: '2026-11-01',
        date_fin: '2026-11-05',
        nombre_jours: 0,
        motif: 'Durée nulle'
      }
    });
    assert.strictEqual(resZero.statusCode, 400);
    assert.match(JSON.parse(resZero.payload).message, /strictement positif/i);

    // 2. Durée négative entière
    const resNeg = await app.inject({
      method: 'POST',
      url: '/api/conges/demandes',
      headers: { Authorization: `Bearer ${jetonAgentHassan}` },
      payload: {
        type_conge_id: 'tc-annuel',
        date_debut: '2026-11-01',
        date_fin: '2026-11-05',
        nombre_jours: -3,
        motif: 'Durée négative'
      }
    });
    assert.strictEqual(resNeg.statusCode, 400);
    assert.match(JSON.parse(resNeg.payload).message, /strictement positif/i);

    // 3. Durée négative fractionnaire
    const resNegFrac = await app.inject({
      method: 'POST',
      url: '/api/conges/demandes',
      headers: { Authorization: `Bearer ${jetonAgentHassan}` },
      payload: {
        type_conge_id: 'tc-annuel',
        date_debut: '2026-11-01',
        date_fin: '2026-11-05',
        nombre_jours: -0.5,
        motif: 'Durée fractionnaire négative'
      }
    });
    assert.strictEqual(resNegFrac.statusCode, 400);
    assert.match(JSON.parse(resNegFrac.payload).message, /strictement positif/i);

    // 4. Dates inversées (date_fin antérieure à date_debut)
    const resDatesInverses = await app.inject({
      method: 'POST',
      url: '/api/conges/demandes',
      headers: { Authorization: `Bearer ${jetonAgentHassan}` },
      payload: {
        type_conge_id: 'tc-annuel',
        date_debut: '2026-11-15',
        date_fin: '2026-11-10',
        nombre_jours: 5,
        motif: 'Dates inversées'
      }
    });
    assert.strictEqual(resDatesInverses.statusCode, 400);
    assert.match(JSON.parse(resDatesInverses.payload).message, /Incohérence des dates/i);

    const s = await verifierInvarianceSQL('agt-001');
    assert.strictEqual(s.attente, 0.0);
    assert.strictEqual(s.restants, 30.0);
  });

  // ==========================================================================
  // GROUPE 3 : Épreuves de Chevauchement Temporel (B11, B12)
  // ==========================================================================
  await t.test('G3-01 : Détection exhaustive des 5 variantes de chevauchement pour un même agent', async () => {
    await reinitialiserSoldeAgent('agt-001', 30.0, 0.0);

    // Congé de référence : du 10 au 20 juin 2026
    const resRef = await app.inject({
      method: 'POST',
      url: '/api/conges/demandes',
      headers: { Authorization: `Bearer ${jetonAgentHassan}` },
      payload: {
        type_conge_id: 'tc-annuel',
        date_debut: '2026-06-10',
        date_fin: '2026-06-20',
        nombre_jours: 11.0,
        motif: 'Période de référence'
      }
    });
    assert.strictEqual(resRef.statusCode, 201);
    const dRefId = JSON.parse(resRef.payload).demande.id;

    // Variante 1 : Inclusion totale (12 au 15 juin)
    const resV1 = await app.inject({
      method: 'POST',
      url: '/api/conges/demandes',
      headers: { Authorization: `Bearer ${jetonAgentHassan}` },
      payload: {
        type_conge_id: 'tc-annuel',
        date_debut: '2026-06-12',
        date_fin: '2026-06-15',
        nombre_jours: 4.0,
        motif: 'Inclusion totale'
      }
    });
    assert.strictEqual(resV1.statusCode, 400);
    assert.match(JSON.parse(resV1.payload).message, /Chevauchement de dates détecté/i);

    // Variante 2 : Englobement total (05 au 25 juin)
    const resV2 = await app.inject({
      method: 'POST',
      url: '/api/conges/demandes',
      headers: { Authorization: `Bearer ${jetonAgentHassan}` },
      payload: {
        type_conge_id: 'tc-annuel',
        date_debut: '2026-06-05',
        date_fin: '2026-06-25',
        nombre_jours: 21.0,
        motif: 'Englobement total'
      }
    });
    assert.strictEqual(resV2.statusCode, 400);
    assert.match(JSON.parse(resV2.payload).message, /Chevauchement de dates détecté/i);

    // Variante 3 : Chevauchement partiel gauche (05 au 12 juin)
    const resV3 = await app.inject({
      method: 'POST',
      url: '/api/conges/demandes',
      headers: { Authorization: `Bearer ${jetonAgentHassan}` },
      payload: {
        type_conge_id: 'tc-annuel',
        date_debut: '2026-06-05',
        date_fin: '2026-06-12',
        nombre_jours: 8.0,
        motif: 'Chevauchement gauche'
      }
    });
    assert.strictEqual(resV3.statusCode, 400);
    assert.match(JSON.parse(resV3.payload).message, /Chevauchement de dates détecté/i);

    // Variante 4 : Chevauchement partiel droite (18 au 25 juin)
    const resV4 = await app.inject({
      method: 'POST',
      url: '/api/conges/demandes',
      headers: { Authorization: `Bearer ${jetonAgentHassan}` },
      payload: {
        type_conge_id: 'tc-annuel',
        date_debut: '2026-06-18',
        date_fin: '2026-06-25',
        nombre_jours: 8.0,
        motif: 'Chevauchement droite'
      }
    });
    assert.strictEqual(resV4.statusCode, 400);
    assert.match(JSON.parse(resV4.payload).message, /Chevauchement de dates détecté/i);

    // Variante 5 : Chevauchement sur la date borne exacte (20 au 22 juin)
    const resV5 = await app.inject({
      method: 'POST',
      url: '/api/conges/demandes',
      headers: { Authorization: `Bearer ${jetonAgentHassan}` },
      payload: {
        type_conge_id: 'tc-annuel',
        date_debut: '2026-06-20',
        date_fin: '2026-06-22',
        nombre_jours: 3.0,
        motif: 'Borne exacte du 20'
      }
    });
    assert.strictEqual(resV5.statusCode, 400);
    assert.match(JSON.parse(resV5.payload).message, /Chevauchement de dates détecté/i);

    // Nettoyage
    await app.inject({
      method: 'POST',
      url: `/api/conges/demandes/${dRefId}/annuler`,
      headers: { Authorization: `Bearer ${jetonAgentHassan}` },
      payload: { motif_annulation: 'Nettoyage chevauchements' }
    });
  });

  await t.test('G3-02 : Autorisation des périodes contiguës strictes (J+1 et J-1)', async () => {
    await reinitialiserSoldeAgent('agt-001', 30.0, 0.0);

    // Congé 1 : du 10 au 15 juillet (6 jours)
    const res1 = await app.inject({
      method: 'POST',
      url: '/api/conges/demandes',
      headers: { Authorization: `Bearer ${jetonAgentHassan}` },
      payload: {
        type_conge_id: 'tc-annuel',
        date_debut: '2026-07-10',
        date_fin: '2026-07-15',
        nombre_jours: 6.0,
        motif: 'Période centrale'
      }
    });
    assert.strictEqual(res1.statusCode, 201);
    const d1Id = JSON.parse(res1.payload).demande.id;

    // Congé 2 contigu suivant : du 16 au 20 juillet (5 jours) -> Autorisée !
    const resSuiv = await app.inject({
      method: 'POST',
      url: '/api/conges/demandes',
      headers: { Authorization: `Bearer ${jetonAgentHassan}` },
      payload: {
        type_conge_id: 'tc-annuel',
        date_debut: '2026-07-16',
        date_fin: '2026-07-20',
        nombre_jours: 5.0,
        motif: 'Période contiguë suivante'
      }
    });
    assert.strictEqual(resSuiv.statusCode, 201, 'Une période débutant à J+1 doit être autorisée sans faux chevauchement');
    const dSuivId = JSON.parse(resSuiv.payload).demande.id;

    // Congé 3 contigu précédent : du 05 au 09 juillet (5 jours) -> Autorisée !
    const resPrec = await app.inject({
      method: 'POST',
      url: '/api/conges/demandes',
      headers: { Authorization: `Bearer ${jetonAgentHassan}` },
      payload: {
        type_conge_id: 'tc-annuel',
        date_debut: '2026-07-05',
        date_fin: '2026-07-09',
        nombre_jours: 5.0,
        motif: 'Période contiguë précédente'
      }
    });
    assert.strictEqual(resPrec.statusCode, 201, 'Une période finissant à J-1 doit être autorisée sans faux chevauchement');
    const dPrecId = JSON.parse(resPrec.payload).demande.id;

    // Invariance vérifiée pour les 3 demandes en attente (6 + 5 + 5 = 16j)
    const s = await verifierInvarianceSQL('agt-001');
    assert.strictEqual(s.attente, 16.0);
    assert.strictEqual(s.restants, 14.0);

    // Nettoyage
    for (const id of [d1Id, dSuivId, dPrecId]) {
      await app.inject({
        method: 'POST',
        url: `/api/conges/demandes/${id}/annuler`,
        headers: { Authorization: `Bearer ${jetonAgentHassan}` },
        payload: { motif_annulation: 'Nettoyage contiguïté' }
      });
    }
  });

  await t.test('G3-03 : Absence de blocage sur des dates précédemment annulées ou refusées', async () => {
    await reinitialiserSoldeAgent('agt-001', 30.0, 0.0);

    // 1. Demande sur [2026-08-01, 2026-08-05] puis annulation
    const resA = await app.inject({
      method: 'POST',
      url: '/api/conges/demandes',
      headers: { Authorization: `Bearer ${jetonAgentHassan}` },
      payload: {
        type_conge_id: 'tc-annuel',
        date_debut: '2026-08-01',
        date_fin: '2026-08-05',
        nombre_jours: 5.0,
        motif: 'Demande A'
      }
    });
    const dAId = JSON.parse(resA.payload).demande.id;
    await app.inject({
      method: 'POST',
      url: `/api/conges/demandes/${dAId}/annuler`,
      headers: { Authorization: `Bearer ${jetonAgentHassan}` },
      payload: { motif_annulation: 'Annulation A' }
    });

    // Nouvelle demande sur exactement les mêmes dates -> Doit être acceptée !
    const resA2 = await app.inject({
      method: 'POST',
      url: '/api/conges/demandes',
      headers: { Authorization: `Bearer ${jetonAgentHassan}` },
      payload: {
        type_conge_id: 'tc-annuel',
        date_debut: '2026-08-01',
        date_fin: '2026-08-05',
        nombre_jours: 5.0,
        motif: 'Demande A2 sur dates libérées'
      }
    });
    assert.strictEqual(resA2.statusCode, 201, 'Une demande annulée ne doit pas bloquer les futures demandes sur la période');
    const dA2Id = JSON.parse(resA2.payload).demande.id;

    // 2. Demande sur [2026-08-10, 2026-08-15] puis refus chef
    const resB = await app.inject({
      method: 'POST',
      url: '/api/conges/demandes',
      headers: { Authorization: `Bearer ${jetonAgentHassan}` },
      payload: {
        type_conge_id: 'tc-annuel',
        date_debut: '2026-08-10',
        date_fin: '2026-08-15',
        nombre_jours: 6.0,
        motif: 'Demande B'
      }
    });
    const dBId = JSON.parse(resB.payload).demande.id;
    await app.inject({
      method: 'PUT',
      url: `/api/conges/demandes/${dBId}/viser-chef`,
      headers: { Authorization: `Bearer ${jetonChefCC}` },
      payload: { avis: 'DEFAVORABLE', motif_refus: 'Refus temporaire' }
    });

    // Nouvelle demande sur exactement les mêmes dates -> Doit être acceptée !
    const resB2 = await app.inject({
      method: 'POST',
      url: '/api/conges/demandes',
      headers: { Authorization: `Bearer ${jetonAgentHassan}` },
      payload: {
        type_conge_id: 'tc-annuel',
        date_debut: '2026-08-10',
        date_fin: '2026-08-15',
        nombre_jours: 6.0,
        motif: 'Demande B2 après régularisation'
      }
    });
    assert.strictEqual(resB2.statusCode, 201, 'Une demande refusée ne doit pas bloquer les futures demandes sur la période');
    const dB2Id = JSON.parse(resB2.payload).demande.id;

    // Nettoyage
    await app.inject({
      method: 'POST',
      url: `/api/conges/demandes/${dA2Id}/annuler`,
      headers: { Authorization: `Bearer ${jetonAgentHassan}` },
      payload: { motif_annulation: 'Nettoyage A2' }
    });
    await app.inject({
      method: 'POST',
      url: `/api/conges/demandes/${dB2Id}/annuler`,
      headers: { Authorization: `Bearer ${jetonAgentHassan}` },
      payload: { motif_annulation: 'Nettoyage B2' }
    });
  });

  await t.test('G3-04 : Concurrence multi-agents : dates identiques autorisées entre agents distincts', async () => {
    await reinitialiserSoldeAgent('agt-001', 30.0, 0.0);
    await reinitialiserSoldeAgent('agt-002', 30.0, 0.0);

    // Agent 1 (Hassan, agt-001) dépose du 10 au 15 septembre
    const resAg1 = await app.inject({
      method: 'POST',
      url: '/api/conges/demandes',
      headers: { Authorization: `Bearer ${jetonAgentHassan}` },
      payload: {
        type_conge_id: 'tc-annuel',
        date_debut: '2026-09-10',
        date_fin: '2026-09-15',
        nombre_jours: 6.0,
        motif: 'Congé agent 1'
      }
    });
    assert.strictEqual(resAg1.statusCode, 201);
    const dAg1Id = JSON.parse(resAg1.payload).demande.id;

    // Agent 2 (agt-002) dépose exactement sur la même période via le Gestionnaire RH
    const resAg2 = await app.inject({
      method: 'POST',
      url: '/api/conges/demandes',
      headers: { Authorization: `Bearer ${jetonGestionnaireRH}` },
      payload: {
        agent_id: 'agt-002',
        type_conge_id: 'tc-annuel',
        date_debut: '2026-09-10',
        date_fin: '2026-09-15',
        nombre_jours: 6.0,
        motif: 'Congé agent 2 même dates'
      }
    });
    assert.strictEqual(resAg2.statusCode, 201, 'Deux agents distincts doivent pouvoir formuler une demande sur les mêmes dates sans interférence');
    const dAg2Id = JSON.parse(resAg2.payload).demande.id;

    // Nettoyage
    await app.inject({
      method: 'POST',
      url: `/api/conges/demandes/${dAg1Id}/annuler`,
      headers: { Authorization: `Bearer ${jetonAgentHassan}` },
      payload: { motif_annulation: 'Nettoyage multi-agent 1' }
    });
    await app.inject({
      method: 'POST',
      url: `/api/conges/demandes/${dAg2Id}/annuler`,
      headers: { Authorization: `Bearer ${jetonGestionnaireRH}` },
      payload: { motif_annulation: 'Nettoyage multi-agent 2' }
    });
  });

  // ==========================================================================
  // GROUPE 4 : Épreuves d'Annulation Interdite et Contraintes d'Intégrité (B09, B10)
  // ==========================================================================
  await t.test('G4-01 : Rejet formel de ré-annulation sur une demande déjà annulée (B09)', async () => {
    await reinitialiserSoldeAgent('agt-001', 30.0, 0.0);

    const resSoumis = await app.inject({
      method: 'POST',
      url: '/api/conges/demandes',
      headers: { Authorization: `Bearer ${jetonAgentHassan}` },
      payload: {
        type_conge_id: 'tc-annuel',
        date_debut: '2026-10-10',
        date_fin: '2026-10-12',
        nombre_jours: 3.0,
        motif: 'Demande pour test de double annulation'
      }
    });
    const dId = JSON.parse(resSoumis.payload).demande.id;

    // 1ère annulation : Succès HTTP 200
    const resAnnul1 = await app.inject({
      method: 'POST',
      url: `/api/conges/demandes/${dId}/annuler`,
      headers: { Authorization: `Bearer ${jetonAgentHassan}` },
      payload: { motif_annulation: 'Première annulation légitime' }
    });
    assert.strictEqual(resAnnul1.statusCode, 200);

    // 2ème tentative d'annulation sur la même demande : Doit échouer HTTP 400
    const resAnnul2 = await app.inject({
      method: 'POST',
      url: `/api/conges/demandes/${dId}/annuler`,
      headers: { Authorization: `Bearer ${jetonAgentHassan}` },
      payload: { motif_annulation: 'Deuxième tentative interdite' }
    });
    assert.strictEqual(resAnnul2.statusCode, 400);
    const corps = JSON.parse(resAnnul2.payload);
    assert.strictEqual(corps.code_erreur, 'DEMANDE_DEJA_ANNULEE');
    assert.match(corps.message, /Impossible d'annuler une demande déjà au statut ANNULE/i);

    // 3ème tentative via route PUT
    const resAnnul3 = await app.inject({
      method: 'PUT',
      url: `/api/conges/demandes/${dId}/annuler`,
      headers: { Authorization: `Bearer ${jetonAgentHassan}` },
      payload: { motif_annulation: 'Troisième tentative interdite' }
    });
    assert.strictEqual(resAnnul3.statusCode, 400);
  });

  await t.test('G4-02 : Rejet formel d\'annulation sur une demande déjà refusée (B10)', async () => {
    await reinitialiserSoldeAgent('agt-001', 30.0, 0.0);

    // 1. Refus Chef
    const resSoumisChef = await app.inject({
      method: 'POST',
      url: '/api/conges/demandes',
      headers: { Authorization: `Bearer ${jetonAgentHassan}` },
      payload: {
        type_conge_id: 'tc-annuel',
        date_debut: '2026-11-10',
        date_fin: '2026-11-12',
        nombre_jours: 3.0,
        motif: 'Demande à refuser par chef'
      }
    });
    const dChefId = JSON.parse(resSoumisChef.payload).demande.id;

    await app.inject({
      method: 'PUT',
      url: `/api/conges/demandes/${dChefId}/viser-chef`,
      headers: { Authorization: `Bearer ${jetonChefCC}` },
      payload: { avis: 'DEFAVORABLE', motif_refus: 'Effectif minimal non atteint' }
    });

    const resAnnulRefusChef = await app.inject({
      method: 'POST',
      url: `/api/conges/demandes/${dChefId}/annuler`,
      headers: { Authorization: `Bearer ${jetonAgentHassan}` },
      payload: { motif_annulation: 'Tentative d\'annulation sur refus chef' }
    });
    assert.strictEqual(resAnnulRefusChef.statusCode, 400);
    assert.strictEqual(JSON.parse(resAnnulRefusChef.payload).code_erreur, 'DEMANDE_DEJA_REFUSEE');
    assert.match(JSON.parse(resAnnulRefusChef.payload).message, /Impossible d'annuler une demande déjà au statut REFUSE/i);

    // 2. Refus DRH
    const resSoumisRH = await app.inject({
      method: 'POST',
      url: '/api/conges/demandes',
      headers: { Authorization: `Bearer ${jetonAgentHassan}` },
      payload: {
        type_conge_id: 'tc-annuel',
        date_debut: '2026-11-20',
        date_fin: '2026-11-22',
        nombre_jours: 3.0,
        motif: 'Demande à refuser par DRH'
      }
    });
    const dRHId = JSON.parse(resSoumisRH.payload).demande.id;

    await app.inject({
      method: 'PUT',
      url: `/api/conges/demandes/${dRHId}/viser-chef`,
      headers: { Authorization: `Bearer ${jetonChefCC}` },
      payload: { avis: 'FAVORABLE' }
    });

    await app.inject({
      method: 'PUT',
      url: `/api/conges/demandes/${dRHId}/valider-rh`,
      headers: { Authorization: `Bearer ${jetonGestionnaireRH}` },
      payload: { decision: 'REFUS', motif_refus: 'Refus DRH' }
    });

    const resAnnulRefusRH = await app.inject({
      method: 'POST',
      url: `/api/conges/demandes/${dRHId}/annuler`,
      headers: { Authorization: `Bearer ${jetonAgentHassan}` },
      payload: { motif_annulation: 'Tentative d\'annulation sur refus DRH' }
    });
    assert.strictEqual(resAnnulRefusRH.statusCode, 400);
    assert.strictEqual(JSON.parse(resAnnulRefusRH.payload).code_erreur, 'DEMANDE_DEJA_REFUSEE');
  });

  await t.test('G4-03 : Obligation formelle d\'un motif d\'annulation explicite non vide', async () => {
    await reinitialiserSoldeAgent('agt-001', 30.0, 0.0);

    const resSoumis = await app.inject({
      method: 'POST',
      url: '/api/conges/demandes',
      headers: { Authorization: `Bearer ${jetonAgentHassan}` },
      payload: {
        type_conge_id: 'tc-annuel',
        date_debut: '2026-12-01',
        date_fin: '2026-12-03',
        nombre_jours: 3.0,
        motif: 'Demande pour test de motif manquant'
      }
    });
    const dId = JSON.parse(resSoumis.payload).demande.id;

    // 1. Sans champ motif_annulation
    const resSansChamp = await app.inject({
      method: 'POST',
      url: `/api/conges/demandes/${dId}/annuler`,
      headers: { Authorization: `Bearer ${jetonAgentHassan}` },
      payload: {}
    });
    assert.strictEqual(resSansChamp.statusCode, 400);
    assert.match(JSON.parse(resSansChamp.payload).message, /motif d'annulation est obligatoire/i);

    // 2. Motif chaîne vide
    const resVide = await app.inject({
      method: 'POST',
      url: `/api/conges/demandes/${dId}/annuler`,
      headers: { Authorization: `Bearer ${jetonAgentHassan}` },
      payload: { motif_annulation: '' }
    });
    assert.strictEqual(resVide.statusCode, 400);
    assert.match(JSON.parse(resVide.payload).message, /motif d'annulation est obligatoire/i);

    // 3. Motif espaces uniquement
    const resEspaces = await app.inject({
      method: 'POST',
      url: `/api/conges/demandes/${dId}/annuler`,
      headers: { Authorization: `Bearer ${jetonAgentHassan}` },
      payload: { motif_annulation: '     ' }
    });
    assert.strictEqual(resEspaces.statusCode, 400);
    assert.match(JSON.parse(resEspaces.payload).message, /motif d'annulation est obligatoire/i);

    // 4. Motif null
    const resNull = await app.inject({
      method: 'POST',
      url: `/api/conges/demandes/${dId}/annuler`,
      headers: { Authorization: `Bearer ${jetonAgentHassan}` },
      payload: { motif_annulation: null }
    });
    assert.strictEqual(resNull.statusCode, 400);
    assert.match(JSON.parse(resNull.payload).message, /motif d'annulation est obligatoire/i);

    // Nettoyage avec motif valide
    await app.inject({
      method: 'POST',
      url: `/api/conges/demandes/${dId}/annuler`,
      headers: { Authorization: `Bearer ${jetonAgentHassan}` },
      payload: { motif_annulation: 'Nettoyage motif manquant' }
    });
  });

  await t.test('G4-04 : Rejet HTTP 403 lors d\'une tentative d\'annulation par un tiers non autorisé', async () => {
    await reinitialiserSoldeAgent('agt-001', 30.0, 0.0);
    await reinitialiserSoldeAgent('agt-002', 30.0, 0.0);

    // Création d'une demande pour l'agent agt-002
    const resAg2 = await app.inject({
      method: 'POST',
      url: '/api/conges/demandes',
      headers: { Authorization: `Bearer ${jetonGestionnaireRH}` },
      payload: {
        agent_id: 'agt-002',
        type_conge_id: 'tc-annuel',
        date_debut: '2026-12-15',
        date_fin: '2026-12-18',
        nombre_jours: 4.0,
        motif: 'Congé agent 2'
      }
    });
    const dAg2Id = JSON.parse(resAg2.payload).demande.id;

    // Agent Hassan (agt-001) tente d'annuler la demande de l'agent 2 (agt-002) -> HTTP 403
    const resVolAnnul = await app.inject({
      method: 'POST',
      url: `/api/conges/demandes/${dAg2Id}/annuler`,
      headers: { Authorization: `Bearer ${jetonAgentHassan}` },
      payload: { motif_annulation: 'Usurpation d\'annulation' }
    });
    assert.strictEqual(resVolAnnul.statusCode, 403);
    assert.match(JSON.parse(resVolAnnul.payload).message, /Vous ne pouvez annuler que vos propres demandes/i);

    // Nettoyage par le Gestionnaire RH
    await app.inject({
      method: 'POST',
      url: `/api/conges/demandes/${dAg2Id}/annuler`,
      headers: { Authorization: `Bearer ${jetonGestionnaireRH}` },
      payload: { motif_annulation: 'Annulation légitime RH' }
    });
  });

  // ==========================================================================
  // GROUPE 5 : Épreuves Adversariales Critiques & Failles d'Intégrité Découvertes
  // (NaN Injection & Contournement ABAC Annulation/Soumission par Chef hors périmètre)
  // ==========================================================================
  await t.test('G5-01 : [FAILLE CRITIQUE] Rejet impératif des entrées non-numériques ou NaN dans nombre_jours', async () => {
    await reinitialiserSoldeAgent('agt-001', 30.0, 0.0);

    // Injection de chaîne non convertible / NaN
    const resNaN = await app.inject({
      method: 'POST',
      url: '/api/conges/demandes',
      headers: { Authorization: `Bearer ${jetonAgentHassan}` },
      payload: {
        type_conge_id: 'tc-annuel',
        date_debut: '2026-11-01',
        date_fin: '2026-11-05',
        nombre_jours: 'invalide'
      }
    });

    // DOIT être rejeté avec HTTP 400 DUREE_INVALIDE pour empêcher l'injection de 'NaN' en base
    assert.strictEqual(
      resNaN.statusCode,
      400,
      `VULNÉRABILITÉ CONFIRMÉE : Une valeur nombre_jours='invalide' a été acceptée avec HTTP ${resNaN.statusCode} au lieu de HTTP 400 !`
    );

    // Vérification que le solde n'a pas été corrompu en 'NaN'
    const s = await verifierInvarianceSQL('agt-001');
    assert.strictEqual(Number.isNaN(s.attente), false, 'jours_en_attente ne doit pas devenir NaN');
    assert.strictEqual(Number.isNaN(s.restants), false, 'jours_restants ne doit pas devenir NaN');
  });

  await t.test('G5-02 : [FAILLE DE SÉCURITÉ ABAC] Rejet HTTP 403 lors d\'une annulation par un Chef de Service hors périmètre territorial', async () => {
    await reinitialiserSoldeAgent('agt-001', 30.0, 0.0);

    // Hassan (Commissariat Central de Djibouti-Ville, U-CC-DJIB) crée une demande
    const resDemande = await app.inject({
      method: 'POST',
      url: '/api/conges/demandes',
      headers: { Authorization: `Bearer ${jetonAgentHassan}` },
      payload: {
        type_conge_id: 'tc-annuel',
        date_debut: '2026-11-01',
        date_fin: '2026-11-05',
        nombre_jours: 5.0,
        motif: 'Demande de Hassan'
      }
    });
    const dId = JSON.parse(resDemande.payload).demande.id;

    // Chef Ali (Ali-Sabieh, U-REG-ALI) tente d'annuler la demande de Hassan (U-CC-DJIB)
    // DOIT être rejeté avec HTTP 403 (violation du périmètre ABAC territorial)
    const resAnnulAli = await app.inject({
      method: 'POST',
      url: `/api/conges/demandes/${dId}/annuler`,
      headers: { Authorization: `Bearer ${jetonChefAli}` },
      payload: { motif_annulation: 'Tentative d\'annulation hors périmètre par Chef Ali' }
    });

    assert.strictEqual(
      resAnnulAli.statusCode,
      403,
      `VULNÉRABILITÉ CONFIRMÉE : Un chef hors périmètre (Ali-Sabieh) a pu annuler la demande d'un agent de Djibouti-Ville avec HTTP ${resAnnulAli.statusCode} au lieu de HTTP 403 !`
    );

    // Nettoyage par Hassan
    await app.inject({
      method: 'POST',
      url: `/api/conges/demandes/${dId}/annuler`,
      headers: { Authorization: `Bearer ${jetonAgentHassan}` },
      payload: { motif_annulation: 'Nettoyage légitime' }
    });
  });

  await t.test('G5-03 : [FAILLE DE SÉCURITÉ ABAC] Rejet HTTP 403 lors de la soumission par un Chef de Service pour un agent hors périmètre', async () => {
    await reinitialiserSoldeAgent('agt-001', 30.0, 0.0);

    // Chef Ali (Ali-Sabieh, U-REG-ALI) tente de soumettre un congé au nom de Hassan (U-CC-DJIB)
    // DOIT être rejeté avec HTTP 403 (violation du périmètre ABAC territorial)
    const resSoumisHorsPerimetre = await app.inject({
      method: 'POST',
      url: '/api/conges/demandes',
      headers: { Authorization: `Bearer ${jetonChefAli}` },
      payload: {
        agent_id: 'agt-001',
        type_conge_id: 'tc-annuel',
        date_debut: '2026-11-01',
        date_fin: '2026-11-05',
        nombre_jours: 5.0,
        motif: 'Soumission illégitime hors périmètre'
      }
    });

    assert.strictEqual(
      resSoumisHorsPerimetre.statusCode,
      403,
      `VULNÉRABILITÉ CONFIRMÉE : Un chef hors périmètre (Ali-Sabieh) a pu soumettre une demande pour un agent de Djibouti-Ville avec HTTP ${resSoumisHorsPerimetre.statusCode} au lieu de HTTP 403 !`
    );
  });
});
