const test = require('node:test');
const assert = require('node:assert/strict');

// Chargement de l'application serveur compilée ou tsx
let creerApplicationServeur;
let fermerPool;
let pool;
let auditService;

try {
  creerApplicationServeur = require('../../dist/server.js').creerApplicationServeur;
  const dbModule = require('../../dist/database/index.js');
  fermerPool = dbModule.fermerPool;
  pool = dbModule.pool;
  auditService = require('../../dist/modules/audit/audit.service.js').auditService;
} catch {
  require('tsx/cjs');
  creerApplicationServeur = require('../../src/server.ts').creerApplicationServeur;
  const dbModule = require('../../src/database/index.ts');
  fermerPool = dbModule.fermerPool;
  pool = dbModule.pool;
  auditService = require('../../src/modules/audit/audit.service.ts').auditService;
}

test('CHALLENGER DEEP STRESS HARNESS — JALON M2 (Concurrence, Anti-Auto-Approbation, ABAC, Audit SHA-256)', async (t) => {
  let app;
  let jetonGestionnaireRH;
  let jetonChefCC;
  let jetonChefAli;
  let jetonAgentHassan;
  let jetonAdminTech;
  let jetonAuditeur;

  const verifierInvarianceSQL = async (agentId, annee = 2026) => {
    const res = await pool.query(
      `SELECT jours_acquis, jours_reportes, jours_pris, jours_en_attente, jours_restants
       FROM soldes_conges
       WHERE agent_id = $1 AND annee = $2 AND type_conge_id = 'tc-annuel'`,
      [agentId, annee]
    );
    assert.ok(res.rows.length > 0, `Solde non trouvé pour agent ${agentId}`);
    const r = res.rows[0];
    const acquis = Number(r.jours_acquis);
    const reportes = Number(r.jours_reportes);
    const pris = Number(r.jours_pris);
    const attente = Number(r.jours_en_attente);
    const restants = Number(r.jours_restants);

    const totalAlloue = Math.round((acquis + reportes) * 10) / 10;
    const totalDecompte = Math.round((pris + attente + restants) * 10) / 10;
    assert.strictEqual(
      totalAlloue,
      totalDecompte,
      `INVARIANCE VIOLÉE [agent=${agentId}]: alloué=${totalAlloue} != décompté=${totalDecompte} (pris=${pris}, attente=${attente}, restants=${restants})`
    );
    return { acquis, reportes, pris, attente, restants };
  };

  const reinitialiserSoldeAgent = async (agentId, acquis = 30.0, reportes = 0.0) => {
    await pool.query('DELETE FROM validations_conges WHERE demande_id IN (SELECT id FROM demandes_conges WHERE agent_id = $1)', [agentId]);
    await pool.query('DELETE FROM demandes_conges WHERE agent_id = $1', [agentId]);
    await pool.query(
      `UPDATE soldes_conges
       SET jours_acquis = $2, jours_reportes = $3, jours_pris = 0.0, jours_en_attente = 0.0, modifie_le = CURRENT_TIMESTAMP
       WHERE agent_id = $1 AND type_conge_id = 'tc-annuel' AND annee = 2026`,
      [agentId, acquis, reportes]
    );
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
    jetonChefAli = await login('chef_ali');
    jetonAgentHassan = await login('agent_hassan');
    jetonAdminTech = await login('admin_tech');
    jetonAuditeur = await login('auditeur');

    await reinitialiserSoldeAgent('agt-001', 30.0, 0.0);
    await reinitialiserSoldeAgent('agt-003', 30.0, 0.0);
    await reinitialiserSoldeAgent('agt-004', 30.0, 0.0);
    await reinitialiserSoldeAgent('agt-rh-01', 30.0, 0.0);
  });

  t.after(async () => {
    await reinitialiserSoldeAgent('agt-001', 30.0, 0.0);
    await reinitialiserSoldeAgent('agt-003', 30.0, 0.0);
    await reinitialiserSoldeAgent('agt-004', 30.0, 0.0);
    await reinitialiserSoldeAgent('agt-rh-01', 30.0, 0.0);
    if (app) await app.close();
    if (fermerPool && !pool?.ending && !pool?.ended) {
      await fermerPool().catch(() => {});
    }
  });

  // ==========================================================================
  // SECTION 1 : ATTAQUE PAR DOUBLE VALIDATION SIMULTANÉE & STRESS CONCURRENCE
  // ==========================================================================

  await t.test('1.1 : Validation concurrente 2x simultanée avec version périmée -> 1x 200, 1x 409 CONFLIT_CONCURRENCE', async () => {
    await reinitialiserSoldeAgent('agt-001', 30.0, 0.0);

    // Demande de 4 jours par Hassan
    const resSub = await app.inject({
      method: 'POST',
      url: '/api/conges/demandes',
      headers: { Authorization: `Bearer ${jetonAgentHassan}` },
      payload: {
        type_conge_id: 'tc-annuel',
        date_debut: '2026-05-01',
        date_fin: '2026-05-04',
        nombre_jours: 4.0,
        motif: 'Test 1.1 double validation'
      }
    });
    assert.strictEqual(resSub.statusCode, 201);
    const demId = JSON.parse(resSub.payload).demande.id;

    // Visa chef -> passe à version 2
    const resVisa = await app.inject({
      method: 'PUT',
      url: `/api/conges/demandes/${demId}/viser-chef`,
      headers: { Authorization: `Bearer ${jetonChefCC}` },
      payload: { avis: 'FAVORABLE' }
    });
    assert.strictEqual(resVisa.statusCode, 200);

    // 2 validations RH simultanées avec version 2
    const [res1, res2] = await Promise.all([
      app.inject({
        method: 'PUT',
        url: `/api/conges/demandes/${demId}/valider-rh`,
        headers: { Authorization: `Bearer ${jetonGestionnaireRH}` },
        payload: { decision: 'VALIDE', version_concurrence: 2 }
      }),
      app.inject({
        method: 'PUT',
        url: `/api/conges/demandes/${demId}/valider-rh`,
        headers: { Authorization: `Bearer ${jetonGestionnaireRH}` },
        payload: { decision: 'VALIDE', version_concurrence: 2 }
      })
    ]);

    const codes = [res1.statusCode, res2.statusCode].sort((a, b) => a - b);
    assert.deepStrictEqual(codes, [200, 409], 'Exactement une requête doit réussir (200) et une échouer en conflit (409)');

    const rep409 = res1.statusCode === 409 ? JSON.parse(res1.payload) : JSON.parse(res2.payload);
    assert.strictEqual(rep409.code_erreur, 'CONFLIT_CONCURRENCE');
    assert.match(rep409.message, /Conflit de concurrence/i);

    // Contrôle d'invariance et absence absolue de double débit
    const s = await verifierInvarianceSQL('agt-001');
    assert.strictEqual(s.pris, 4.0, 'Débit unique strict de 4 jours');
    assert.strictEqual(s.attente, 0.0);
    assert.strictEqual(s.restants, 26.0);

    // Nettoyage
    await app.inject({
      method: 'POST',
      url: `/api/conges/demandes/${demId}/annuler`,
      headers: { Authorization: `Bearer ${jetonGestionnaireRH}` },
      payload: { motif_annulation: 'Nettoyage 1.1' }
    });
  });

  await t.test('1.2 : Stress massif de 20 requêtes simultanées de validation RH sur la même demande', async () => {
    await reinitialiserSoldeAgent('agt-001', 30.0, 0.0);

    const resSub = await app.inject({
      method: 'POST',
      url: '/api/conges/demandes',
      headers: { Authorization: `Bearer ${jetonAgentHassan}` },
      payload: {
        type_conge_id: 'tc-annuel',
        date_debut: '2026-05-10',
        date_fin: '2026-05-12',
        nombre_jours: 3.0,
        motif: 'Test 1.2 stress 20x'
      }
    });
    const demId = JSON.parse(resSub.payload).demande.id;

    await app.inject({
      method: 'PUT',
      url: `/api/conges/demandes/${demId}/viser-chef`,
      headers: { Authorization: `Bearer ${jetonChefCC}` },
      payload: { avis: 'FAVORABLE' }
    });

    const N = 20;
    const promises = [];
    for (let i = 0; i < N; i++) {
      promises.push(
        app.inject({
          method: 'PUT',
          url: `/api/conges/demandes/${demId}/valider-rh`,
          headers: { Authorization: `Bearer ${jetonGestionnaireRH}` },
          payload: { decision: 'VALIDE', version_concurrence: 2 }
        })
      );
    }

    const reponses = await Promise.all(promises);
    const reussites = reponses.filter(r => r.statusCode === 200);
    const conflits = reponses.filter(r => r.statusCode === 409);
    const autres = reponses.filter(r => r.statusCode !== 200 && r.statusCode !== 409);

    assert.strictEqual(autres.length, 0, 'Aucun code inattendu (500 ou autre)');
    assert.strictEqual(reussites.length, 1, 'Exactement 1 validation sur 20 doit réussir');
    assert.strictEqual(conflits.length, N - 1, 'Les 19 autres doivent retourner HTTP 409');

    // Vérification du solde : débit unique de 3 jours
    const s = await verifierInvarianceSQL('agt-001');
    assert.strictEqual(s.pris, 3.0);
    assert.strictEqual(s.attente, 0.0);
    assert.strictEqual(s.restants, 27.0);

    // Vérification de la table validations_conges : exactement 1 seule validation RH
    const valRes = await pool.query(
      "SELECT COUNT(*) AS total FROM validations_conges WHERE demande_id = $1 AND etape = 'VALIDATION_RH'",
      [demId]
    );
    assert.strictEqual(parseInt(valRes.rows[0].total, 10), 1);

    // Nettoyage
    await app.inject({
      method: 'POST',
      url: `/api/conges/demandes/${demId}/annuler`,
      headers: { Authorization: `Bearer ${jetonGestionnaireRH}` },
      payload: { motif_annulation: 'Nettoyage 1.2' }
    });
  });

  await t.test('1.3 : Concurrence de 5 soumissions simultanées sur la même plage de dates (TOCTOU elimination)', async () => {
    await reinitialiserSoldeAgent('agt-001', 30.0, 0.0);

    // 5 soumissions concurrentes pour les mêmes dates
    const promises = [];
    for (let i = 0; i < 5; i++) {
      promises.push(
        app.inject({
          method: 'POST',
          url: '/api/conges/demandes',
          headers: { Authorization: `Bearer ${jetonAgentHassan}` },
          payload: {
            type_conge_id: 'tc-annuel',
            date_debut: '2026-06-01',
            date_fin: '2026-06-05',
            nombre_jours: 5.0,
            motif: `Soumission concurrente ${i}`
          }
        })
      );
    }

    const reponses = await Promise.all(promises);
    const crees = reponses.filter(r => r.statusCode === 201);
    const bloques = reponses.filter(r => r.statusCode === 400);

    assert.strictEqual(crees.length, 1, 'Exactement une seule demande doit être créée (201)');
    assert.strictEqual(bloques.length, 4, 'Les 4 autres doivent être rejetées pour chevauchement (400)');

    for (const b of bloques) {
      const body = JSON.parse(b.payload);
      assert.strictEqual(body.code_erreur, 'CHEVAUCHEMENT_CONGE');
    }

    // Le solde doit avoir exactement 5 jours réservés, pas 25 jours
    const s = await verifierInvarianceSQL('agt-001');
    assert.strictEqual(s.attente, 5.0);
    assert.strictEqual(s.restants, 25.0);

    // Nettoyage
    const demCreeId = JSON.parse(crees[0].payload).demande.id;
    await app.inject({
      method: 'POST',
      url: `/api/conges/demandes/${demCreeId}/annuler`,
      headers: { Authorization: `Bearer ${jetonAgentHassan}` },
      payload: { motif_annulation: 'Nettoyage 1.3' }
    });
  });

  await t.test('1.4 : Concurrence de soumission avec dépassement potentiel de solde (Solde=20j, 3x 15j demandés)', async () => {
    await reinitialiserSoldeAgent('agt-001', 20.0, 0.0);

    // 3 requêtes de 15 jours sur des dates DIFFÉRENTES (sans chevauchement)
    // 15j + 15j = 30j > 20j disponibles !
    const [r1, r2, r3] = await Promise.all([
      app.inject({
        method: 'POST',
        url: '/api/conges/demandes',
        headers: { Authorization: `Bearer ${jetonAgentHassan}` },
        payload: { type_conge_id: 'tc-annuel', date_debut: '2026-06-01', date_fin: '2026-06-15', nombre_jours: 15.0 }
      }),
      app.inject({
        method: 'POST',
        url: '/api/conges/demandes',
        headers: { Authorization: `Bearer ${jetonAgentHassan}` },
        payload: { type_conge_id: 'tc-annuel', date_debut: '2026-07-01', date_fin: '2026-07-15', nombre_jours: 15.0 }
      }),
      app.inject({
        method: 'POST',
        url: '/api/conges/demandes',
        headers: { Authorization: `Bearer ${jetonAgentHassan}` },
        payload: { type_conge_id: 'tc-annuel', date_debut: '2026-08-01', date_fin: '2026-08-15', nombre_jours: 15.0 }
      })
    ]);

    const statuts = [r1.statusCode, r2.statusCode, r3.statusCode];
    const nb201 = statuts.filter(s => s === 201).length;
    const nb400 = statuts.filter(s => s === 400).length;

    assert.strictEqual(nb201, 1, 'Exactement une seule demande de 15j doit passer');
    assert.strictEqual(nb400, 2, 'Les deux autres doivent échouer pour solde insuffisant');

    const s = await verifierInvarianceSQL('agt-001');
    assert.strictEqual(s.attente, 15.0, 'Seuls 15 jours doivent être en attente');
    assert.strictEqual(s.restants, 5.0, 'Il doit rester 5 jours');

    // Nettoyage
    const okResp = [r1, r2, r3].find(r => r.statusCode === 201);
    const okId = JSON.parse(okResp.payload).demande.id;
    await app.inject({
      method: 'POST',
      url: `/api/conges/demandes/${okId}/annuler`,
      headers: { Authorization: `Bearer ${jetonAgentHassan}` },
      payload: { motif_annulation: 'Nettoyage 1.4' }
    });
  });

  await t.test('1.5 : Double annulation concurrente d\'un congé validé -> Débit/Crédit unique sans double restitution', async () => {
    await reinitialiserSoldeAgent('agt-001', 30.0, 0.0);

    // Création + Visa + Validation RH de 6 jours
    const resSub = await app.inject({
      method: 'POST',
      url: '/api/conges/demandes',
      headers: { Authorization: `Bearer ${jetonAgentHassan}` },
      payload: { type_conge_id: 'tc-annuel', date_debut: '2026-09-01', date_fin: '2026-09-06', nombre_jours: 6.0 }
    });
    const demId = JSON.parse(resSub.payload).demande.id;

    await app.inject({
      method: 'PUT',
      url: `/api/conges/demandes/${demId}/viser-chef`,
      headers: { Authorization: `Bearer ${jetonChefCC}` },
      payload: { avis: 'FAVORABLE' }
    });

    await app.inject({
      method: 'PUT',
      url: `/api/conges/demandes/${demId}/valider-rh`,
      headers: { Authorization: `Bearer ${jetonGestionnaireRH}` },
      payload: { decision: 'VALIDE' }
    });

    const sApresVal = await verifierInvarianceSQL('agt-001');
    assert.strictEqual(sApresVal.pris, 6.0);
    assert.strictEqual(sApresVal.restants, 24.0);

    // 2 annulations simultanées par l'agent
    const [resA1, resA2] = await Promise.all([
      app.inject({
        method: 'POST',
        url: `/api/conges/demandes/${demId}/annuler`,
        headers: { Authorization: `Bearer ${jetonAgentHassan}` },
        payload: { motif_annulation: 'Annulation concurrente 1' }
      }),
      app.inject({
        method: 'POST',
        url: `/api/conges/demandes/${demId}/annuler`,
        headers: { Authorization: `Bearer ${jetonAgentHassan}` },
        payload: { motif_annulation: 'Annulation concurrente 2' }
      })
    ]);

    const codes = [resA1.statusCode, resA2.statusCode].sort((a, b) => a - b);
    assert.deepStrictEqual(codes, [200, 400], 'Une annulation réussit (200), la seconde est rejetée (400 DEMANDE_DEJA_ANNULEE)');

    const rep400 = resA1.statusCode === 400 ? JSON.parse(resA1.payload) : JSON.parse(resA2.payload);
    assert.strictEqual(rep400.code_erreur, 'DEMANDE_DEJA_ANNULEE');

    // Le solde doit avoir récupéré EXACTEMENT 6 jours (jours_pris=0, jours_restants=30), PAS 12 jours !
    const sApresAnnul = await verifierInvarianceSQL('agt-001');
    assert.strictEqual(sApresAnnul.pris, 0.0, 'Les jours pris ne doivent pas être négatifs');
    assert.strictEqual(sApresAnnul.restants, 30.0, 'Pas de double restitution de jours');
  });

  // ==========================================================================
  // SECTION 2 : ÉPREUVES D'ANTI-AUTO-APPROBATION STRICTE MULTI-NIVEAUX
  // ==========================================================================

  await t.test('2.1 : Chef de Service (Chef Ali) tentant d\'auto-viser sa propre demande (FAVORABLE & DÉFAVORABLE)', async () => {
    await reinitialiserSoldeAgent('agt-003', 30.0, 0.0);

    // Chef Ali (usr-chef-ali, agt-003) formule sa propre demande
    const resDemandeAli = await app.inject({
      method: 'POST',
      url: '/api/conges/demandes',
      headers: { Authorization: `Bearer ${jetonChefAli}` },
      payload: {
        type_conge_id: 'tc-annuel',
        date_debut: '2026-07-01',
        date_fin: '2026-07-04',
        nombre_jours: 4.0,
        motif: 'Congé personnel Chef Ali'
      }
    });
    assert.strictEqual(resDemandeAli.statusCode, 201);
    const demAliId = JSON.parse(resDemandeAli.payload).demande.id;

    // Tentative d'auto-visa FAVORABLE
    const resAutoFavorable = await app.inject({
      method: 'PUT',
      url: `/api/conges/demandes/${demAliId}/viser-chef`,
      headers: { Authorization: `Bearer ${jetonChefAli}` },
      payload: { avis: 'FAVORABLE' }
    });
    assert.strictEqual(resAutoFavorable.statusCode, 403);
    const corpsFav = JSON.parse(resAutoFavorable.payload);
    assert.strictEqual(corpsFav.code_erreur, 'AUTO_APPROBATION_INTERDITE');

    // Vérification de l'audit de tentative bloquée
    const auditFav = await pool.query(
      "SELECT * FROM journaux_audit WHERE action_type = 'TENTATIVE_AUTO_APPROBATION_BLOQUEE' AND entite_id = $1 ORDER BY id DESC LIMIT 1",
      [demAliId]
    );
    assert.strictEqual(auditFav.rows.length, 1);
    assert.strictEqual(auditFav.rows[0].statut_operation, 'ECHEC_SECURITE');
    assert.strictEqual(auditFav.rows[0].role_utilise, 'CHEF_DE_SERVICE');

    // Tentative d'auto-visa DÉFAVORABLE (doit aussi être bloquée)
    const resAutoDefavorable = await app.inject({
      method: 'PUT',
      url: `/api/conges/demandes/${demAliId}/viser-chef`,
      headers: { Authorization: `Bearer ${jetonChefAli}` },
      payload: { avis: 'DEFAVORABLE', motif_refus: 'Tentative auto-refus' }
    });
    assert.strictEqual(resAutoDefavorable.statusCode, 403);
    assert.strictEqual(JSON.parse(resAutoDefavorable.payload).code_erreur, 'AUTO_APPROBATION_INTERDITE');

    // Nettoyage légitime par annulation personnelle
    await app.inject({
      method: 'POST',
      url: `/api/conges/demandes/${demAliId}/annuler`,
      headers: { Authorization: `Bearer ${jetonChefAli}` },
      payload: { motif_annulation: 'Nettoyage 2.1' }
    });
  });

  await t.test('2.2 : Gestionnaire RH (Yassin Barkat) tentant d\'auto-valider sa propre demande (validerRH)', async () => {
    await reinitialiserSoldeAgent('agt-rh-01', 30.0, 0.0);

    // Gestionnaire RH (usr-rh-01, agt-rh-01) formule sa propre demande
    const resDemandeRH = await app.inject({
      method: 'POST',
      url: '/api/conges/demandes',
      headers: { Authorization: `Bearer ${jetonGestionnaireRH}` },
      payload: {
        type_conge_id: 'tc-annuel',
        date_debut: '2026-08-01',
        date_fin: '2026-08-05',
        nombre_jours: 5.0,
        motif: 'Congé personnel Gestionnaire RH'
      }
    });
    assert.strictEqual(resDemandeRH.statusCode, 201);
    const demRHId = JSON.parse(resDemandeRH.payload).demande.id;

    // Simulation de visa chef (étape 1 validée)
    await pool.query("UPDATE demandes_conges SET statut = 'APPROUVE_CHEF_SERVICE', version_optimiste = version_optimiste + 1 WHERE id = $1", [demRHId]);

    // Tentative d'auto-validation finale DRH avec VALIDE
    const resAutoValide = await app.inject({
      method: 'PUT',
      url: `/api/conges/demandes/${demRHId}/valider-rh`,
      headers: { Authorization: `Bearer ${jetonGestionnaireRH}` },
      payload: { decision: 'VALIDE' }
    });
    assert.strictEqual(resAutoValide.statusCode, 403);
    const corpsVal = JSON.parse(resAutoValide.payload);
    assert.strictEqual(corpsVal.code_erreur, 'AUTO_APPROBATION_INTERDITE');
    assert.match(corpsVal.message, /Auto-approbation formellement interdite/i);

    // Vérification de la journalisation d'audit inaltérable
    const auditRes = await pool.query(
      "SELECT * FROM journaux_audit WHERE action_type = 'TENTATIVE_AUTO_APPROBATION_BLOQUEE' AND entite_id = $1 ORDER BY id DESC LIMIT 1",
      [demRHId]
    );
    assert.strictEqual(auditRes.rows.length, 1);
    assert.strictEqual(auditRes.rows[0].statut_operation, 'ECHEC_SECURITE');
    assert.strictEqual(auditRes.rows[0].role_utilise, 'GESTIONNAIRE_RH');

    // Tentative d'auto-validation finale DRH avec REFUS (doit aussi être bloquée)
    const resAutoRefus = await app.inject({
      method: 'PUT',
      url: `/api/conges/demandes/${demRHId}/valider-rh`,
      headers: { Authorization: `Bearer ${jetonGestionnaireRH}` },
      payload: { decision: 'REFUS', motif_refus: 'Auto-refus' }
    });
    assert.strictEqual(resAutoRefus.statusCode, 403);
    assert.strictEqual(JSON.parse(resAutoRefus.payload).code_erreur, 'AUTO_APPROBATION_INTERDITE');

    // Nettoyage légitime par annulation
    await app.inject({
      method: 'POST',
      url: `/api/conges/demandes/${demRHId}/annuler`,
      headers: { Authorization: `Bearer ${jetonGestionnaireRH}` },
      payload: { motif_annulation: 'Nettoyage 2.2' }
    });
  });

  await t.test('2.3 : Tentatives d\'usurpation RBAC : Chef appelant validerRH ou Agent appelant viserChef', async () => {
    // 1. Demande de Hassan
    const resSub = await app.inject({
      method: 'POST',
      url: '/api/conges/demandes',
      headers: { Authorization: `Bearer ${jetonAgentHassan}` },
      payload: { type_conge_id: 'tc-annuel', date_debut: '2026-08-10', date_fin: '2026-08-12', nombre_jours: 2.0 }
    });
    const demId = JSON.parse(resSub.payload).demande.id;

    // Chef Ali tente d'appeler directement valider-rh -> 403
    const resChefValideRH = await app.inject({
      method: 'PUT',
      url: `/api/conges/demandes/${demId}/valider-rh`,
      headers: { Authorization: `Bearer ${jetonChefAli}` },
      payload: { decision: 'VALIDE' }
    });
    assert.strictEqual(resChefValideRH.statusCode, 403);

    // Agent Hassan tente d'appeler viser-chef -> 403
    const resAgentVise = await app.inject({
      method: 'PUT',
      url: `/api/conges/demandes/${demId}/viser-chef`,
      headers: { Authorization: `Bearer ${jetonAgentHassan}` },
      payload: { avis: 'FAVORABLE' }
    });
    assert.strictEqual(resAgentVise.statusCode, 403);

    // Admin Technique tente de viser ou valider -> 403
    const resTechVise = await app.inject({
      method: 'PUT',
      url: `/api/conges/demandes/${demId}/viser-chef`,
      headers: { Authorization: `Bearer ${jetonAdminTech}` },
      payload: { avis: 'FAVORABLE' }
    });
    assert.strictEqual(resTechVise.statusCode, 403);

    // Nettoyage
    await app.inject({
      method: 'POST',
      url: `/api/conges/demandes/${demId}/annuler`,
      headers: { Authorization: `Bearer ${jetonAgentHassan}` },
      payload: { motif_annulation: 'Nettoyage 2.3' }
    });
  });

  // ==========================================================================
  // SECTION 3 : ÉTANCHÉITÉ ABAC TERRITORIALE (ANNULATION & SOUMISSION HORS PÉRIMÈTRE)
  // ==========================================================================

  await t.test('3.1 : Rejet HTTP 403 lorsqu\'un Chef de Service tente d\'annuler une demande hors unité', async () => {
    // Hassan (U-CC-DJIB) a une demande
    const resSub = await app.inject({
      method: 'POST',
      url: '/api/conges/demandes',
      headers: { Authorization: `Bearer ${jetonAgentHassan}` },
      payload: { type_conge_id: 'tc-annuel', date_debut: '2026-09-10', date_fin: '2026-09-12', nombre_jours: 2.0 }
    });
    const demId = JSON.parse(resSub.payload).demande.id;

    // Chef Ali (U-REG-ALI) tente d'annuler la demande de Hassan (U-CC-DJIB)
    const resAnnulAli = await app.inject({
      method: 'POST',
      url: `/api/conges/demandes/${demId}/annuler`,
      headers: { Authorization: `Bearer ${jetonChefAli}` },
      payload: { motif_annulation: 'Annulation hostile par Chef Ali' }
    });
    assert.strictEqual(resAnnulAli.statusCode, 403);
    const corpsAli = JSON.parse(resAnnulAli.payload);
    assert.strictEqual(corpsAli.code_erreur, 'ACCES_INTERDIT');
    assert.match(corpsAli.message, /Vous ne pouvez annuler que les demandes des agents de votre unité/i);

    // Nettoyage par l'agent légitime
    await app.inject({
      method: 'POST',
      url: `/api/conges/demandes/${demId}/annuler`,
      headers: { Authorization: `Bearer ${jetonAgentHassan}` },
      payload: { motif_annulation: 'Nettoyage 3.1' }
    });
  });

  await t.test('3.2 : Rejet HTTP 403 lorsqu\'un Chef de Service tente de soumettre pour un agent hors unité', async () => {
    // Chef Ali (U-REG-ALI) tente de soumettre pour Hassan (agt-001, U-CC-DJIB)
    const resSubAli = await app.inject({
      method: 'POST',
      url: '/api/conges/demandes',
      headers: { Authorization: `Bearer ${jetonChefAli}` },
      payload: {
        agent_id: 'agt-001',
        type_conge_id: 'tc-annuel',
        date_debut: '2026-09-15',
        date_fin: '2026-09-18',
        nombre_jours: 3.0,
        motif: 'Tentative de soumission hors unité'
      }
    });
    assert.strictEqual(resSubAli.statusCode, 403);
    const corpsAli = JSON.parse(resSubAli.payload);
    assert.strictEqual(corpsAli.code_erreur, 'ACCES_INTERDIT');
    assert.match(corpsAli.message, /agents de votre unité/i);
  });

  await t.test('3.3 : Un Chef de Service PEUT annuler sa propre demande (droit personnel régalien préservé)', async () => {
    await reinitialiserSoldeAgent('agt-003', 30.0, 0.0);

    const resSub = await app.inject({
      method: 'POST',
      url: '/api/conges/demandes',
      headers: { Authorization: `Bearer ${jetonChefAli}` },
      payload: { type_conge_id: 'tc-annuel', date_debut: '2026-09-20', date_fin: '2026-09-22', nombre_jours: 2.0 }
    });
    assert.strictEqual(resSub.statusCode, 201);
    const demId = JSON.parse(resSub.payload).demande.id;

    // Chef Ali annule sa propre demande
    const resAnnulPropre = await app.inject({
      method: 'POST',
      url: `/api/conges/demandes/${demId}/annuler`,
      headers: { Authorization: `Bearer ${jetonChefAli}` },
      payload: { motif_annulation: 'Annulation légitime personnelle de Chef Ali' }
    });
    assert.strictEqual(resAnnulPropre.statusCode, 200);
    assert.strictEqual(JSON.parse(resAnnulPropre.payload).demande.statut, 'ANNULE');
  });

  // ==========================================================================
  // SECTION 4 : LINÉARITÉ & INTÉGRITÉ DE LA CHAÎNE D'AUDIT SOUS FORTE CHARGE
  // ==========================================================================

  await t.test('4.1 : 60 écritures concurrentes d\'audit sous pg_advisory_xact_lock et validation SHA-256', async () => {
    const N_AUDIT = 60;
    const promises = [];

    for (let i = 0; i < N_AUDIT; i++) {
      promises.push(
        auditService.enregistrer({
          utilisateur_id: 'usr-rh-01',
          nom_utilisateur: 'Yassin Barkat',
          role_utilise: 'GESTIONNAIRE_RH',
          adresse_ip: `192.168.1.${10 + (i % 20)}`,
          action_type: 'STRESS_CHALLENGER_DEEP',
          entite_cible: 'AUDIT_TRAIL',
          entite_id: `deep-stress-${i}`,
          details_operation_json: { idx: i, timestamp: Date.now() },
          statut_operation: 'SUCCES'
        })
      );
    }

    const logsInserts = await Promise.all(promises);
    assert.strictEqual(logsInserts.length, N_AUDIT);

    // Vérification de la consécutivité des identifiants (zéro trou, zéro doublon)
    const ids = logsInserts.map(l => Number(l.id)).sort((a, b) => a - b);
    for (let i = 1; i < ids.length; i++) {
      assert.strictEqual(ids[i], ids[i - 1] + 1, `Trou d'identifiant détecté : ${ids[i - 1]} -> ${ids[i]}`);
    }

    // Vérification du chaînage des empreintes
    const minId = ids[0];
    const maxId = ids[ids.length - 1];
    const resDbLogs = await pool.query(
      'SELECT id, empreinte_precedente, empreinte_courante FROM journaux_audit WHERE id >= $1 AND id <= $2 ORDER BY id ASC',
      [minId, maxId]
    );
    const dbLogs = resDbLogs.rows;

    for (let i = 1; i < dbLogs.length; i++) {
      assert.strictEqual(
        dbLogs[i].empreinte_precedente,
        dbLogs[i - 1].empreinte_courante,
        `Rupture de chaînage SHA-256 entre log ${dbLogs[i - 1].id} et log ${dbLogs[i].id}`
      );
    }

    // Vérification cryptographique sur la totalité de la table
    const verifTotale = await auditService.verifierIntegriteChaine();
    assert.strictEqual(verifTotale.valid, true, 'Chaîne d\'audit globale altérée ou corrompue !');
    assert.strictEqual(verifTotale.errors.length, 0);
  });

  await t.test('4.2 : Protection absolue contre la modification et suppression des logs d\'audit', async () => {
    assert.throws(
      () => auditService.modifierAudit(),
      /immuables/i,
      'modifierAudit() doit lever une exception formelle'
    );
    assert.throws(
      () => auditService.supprimerAudit(),
      /immuables/i,
      'supprimerAudit() doit lever une exception formelle'
    );
  });

  // ==========================================================================
  // SECTION 5 : SÉCURISATION DU TYPAGE, INJECTIONS ET BORNES LIMITES
  // ==========================================================================

  await t.test('5.1 : Rejet formel des formats invalides et injections dans nombre_jours (NaN, 0, négatif, string)', async () => {
    const payloadInvalides = [
      { nombre_jours: 'non_numerique' },
      { nombre_jours: NaN },
      { nombre_jours: 0 },
      { nombre_jours: -1 },
      { nombre_jours: -0.5 },
      { nombre_jours: Infinity },
      { nombre_jours: -Infinity }
    ];

    for (const p of payloadInvalides) {
      const res = await app.inject({
        method: 'POST',
        url: '/api/conges/demandes',
        headers: { Authorization: `Bearer ${jetonAgentHassan}` },
        payload: {
          type_conge_id: 'tc-annuel',
          date_debut: '2026-10-01',
          date_fin: '2026-10-05',
          motif: 'Test borne invalide',
          ...p
        }
      });
      assert.strictEqual(
        res.statusCode,
        400,
        `La valeur nombre_jours=${p.nombre_jours} aurait dû être rejetée avec 400 mais a retourné ${res.statusCode}`
      );
    }
  });

  await t.test('5.2 : Invariance arithmétique globale de l\'ensemble des agents en base', async () => {
    const agents = ['agt-001', 'agt-002', 'agt-003', 'agt-004', 'agt-rh-01'];
    for (const ag of agents) {
      const s = await verifierInvarianceSQL(ag);
      assert.ok(s.acquis >= 0);
      assert.ok(s.pris >= 0);
      assert.ok(s.attente >= 0);
      assert.ok(s.restants >= 0);
    }
  });
});
