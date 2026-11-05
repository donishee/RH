/**
 * SUITE DE VÉRIFICATION CONTRADICTOIRE & CAS LIMITES — GATE M4 ITÉRATION 2
 * Auteur : challenger_m4_r2_1 (Empirical Challenger)
 * Objectif : Éprouver empiriquement et contradictoirement la fermeture des failles M4
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

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

test('Vérification Contradictoire Challenger M4 R2 — Robustesse et Cas Limites', async (t) => {
  let app;
  let jetonChefCC;
  let jetonChefAli;
  let jetonGestionnaireRH;
  let jetonAgentHassan;

  const purge = async () => {
    try {
      await pool.query(`
        DELETE FROM remplacements_gardes WHERE motif LIKE '%CHALLENGER-R2%';
        DELETE FROM plannings_vacations WHERE motif_modification LIKE '%CHALLENGER-R2%' OR id LIKE 'vac-chall-r2-%';
        DELETE FROM aptitudes_administratives WHERE numero_certificat_administratif LIKE 'CERT-CHALL-R2-%';
      `);
    } catch (e) {
      // Ignorer
    }
  };

  t.before(async () => {
    app = await creerApplicationServeur();
    await app.ready();
    await purge();

    const login = async (identifiant) => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/connexion',
        payload: { identifiant, mot_de_passe: 'Police@2026!' }
      });
      return JSON.parse(res.payload).jeton;
    };

    jetonChefCC = await login('chef_cc');
    jetonChefAli = await login('chef_ali');
    jetonGestionnaireRH = await login('gestionnaire_rh');
    jetonAgentHassan = await login('agent_hassan');
  });

  t.after(async () => {
    await purge();
    if (app) await app.close();
    if (fermerPool && !pool?.ending && !pool?.ended) {
      await fermerPool().catch(() => {});
    }
  });

  // --------------------------------------------------------------------------
  // ÉPREUVE 1 : Remplacement par un agent valide (agt-004) -> HTTP 201 attendu
  // --------------------------------------------------------------------------
  await t.test('R2-01 : Remplacement nominal par un agent qualifié (agt-004) sur poste armé (HTTP 201)', async () => {
    // 1. Créer une vacation armée pour agt-001 (06h - 14h le 12 décembre 2026)
    const resVac = await app.inject({
      method: 'POST',
      url: '/api/plannings',
      headers: { authorization: `Bearer ${jetonChefCC}` },
      payload: {
        agent_id: 'agt-001',
        poste_operationnel_id: 'pop-003', // tir_requis: true
        type_vacation: '3x8_matin',
        date_debut: '2026-12-12T06:00:00Z',
        date_fin: '2026-12-12T14:00:00Z',
        motif_modification: 'CHALLENGER-R2-NOMINAL'
      }
    });
    assert.strictEqual(resVac.statusCode, 201);
    const vacId = JSON.parse(resVac.payload).vacation.id;

    // 2. Ordonner le remplacement par agt-004 (qualifié tir, repos > 11h, même unité U-CC-DJIB)
    const resRemp = await app.inject({
      method: 'POST',
      url: '/api/remplacements/ordonner',
      headers: { authorization: `Bearer ${jetonChefCC}` },
      payload: {
        planning_vacation_id: vacId,
        agent_remplacant_id: 'agt-004',
        motif: 'urgence',
        commentaire: 'CHALLENGER-R2-REMP-VALIDE'
      }
    });

    assert.strictEqual(resRemp.statusCode, 201, 'Le remplacement par agt-004 qualifié doit réussir en HTTP 201');
    const corps = JSON.parse(resRemp.payload);
    assert.strictEqual(corps.statut, 'SUCCES');
    assert.strictEqual(corps.remplacement.statut, 'valide');
    assert.strictEqual(corps.nouvelle_vacation.agent_id, 'agt-004');
    assert.strictEqual(corps.nouvelle_vacation.poste_operationnel_id, 'pop-003');

    // 3. Vérifier que la vacation initiale est marquée 'remplace'
    const checkAncienne = await pool.query('SELECT statut FROM plannings_vacations WHERE id = $1', [vacId]);
    assert.strictEqual(checkAncienne.rows[0].statut, 'remplace');
  });

  // --------------------------------------------------------------------------
  // ÉPREUVE 2 : Rejet de remplacement sur poste armé avec certificat de tir expiré (agt-002) -> HTTP 400
  // --------------------------------------------------------------------------
  await t.test('R2-02 : Rejet strict (HTTP 400 CERTIFICAT_TIR_EXPIRE) pour agt-002 sur poste armé', async () => {
    // 1. Créer une vacation armée pour agt-001 (14h - 22h le 13 décembre 2026)
    const resVac = await app.inject({
      method: 'POST',
      url: '/api/plannings',
      headers: { authorization: `Bearer ${jetonChefCC}` },
      payload: {
        agent_id: 'agt-001',
        poste_operationnel_id: 'pop-003', // tir_requis: true
        type_vacation: '3x8_apres_midi',
        date_debut: '2026-12-13T14:00:00Z',
        date_fin: '2026-12-13T22:00:00Z',
        motif_modification: 'CHALLENGER-R2-TIR-EXPIRE'
      }
    });
    assert.strictEqual(resVac.statusCode, 201);
    const vacId = JSON.parse(resVac.payload).vacation.id;

    // 2. agt-002 a un certificat de tir expiré depuis mai 2026
    const resRemp = await app.inject({
      method: 'POST',
      url: '/api/remplacements/ordonner',
      headers: { authorization: `Bearer ${jetonChefCC}` },
      payload: {
        planning_vacation_id: vacId,
        agent_remplacant_id: 'agt-002',
        motif: 'urgence',
        commentaire: 'CHALLENGER-R2-TEST-TIR'
      }
    });

    assert.strictEqual(resRemp.statusCode, 400);
    const corps = JSON.parse(resRemp.payload);
    assert.strictEqual(corps.code_erreur, 'CERTIFICAT_TIR_EXPIRE');
    assert.match(corps.message, /Affectation armée bloquée/i);
  });

  // --------------------------------------------------------------------------
  // ÉPREUVE 3 : Rejet de remplacement si dispense d'arme active (DISPENSE_PORT_ARME) -> HTTP 400
  // --------------------------------------------------------------------------
  await t.test('R2-03 : Rejet strict (HTTP 400 DISPENSE_ARME_ACTIVE) pour agent sous dispense administrative', async () => {
    // 1. Insérer temporairement une dispense d'arme pour agt-004
    await pool.query(`
      INSERT INTO aptitudes_administratives (
        id, agent_id, numero_certificat_administratif, decision_aptitude,
        type_conclusion, code_restriction, restriction_operationnelle, date_decision, date_expiration
      ) VALUES (
        'apt-chall-r2-disp', 'agt-004', 'CERT-CHALL-R2-DISPARME', 'APTE_AVEC_RESTRICTIONS',
        'APTE_AVEC_RESTRICTIONS', 'DISPENSE_PORT_ARME', 'Dispense administrative de port d arme en service',
        '2026-11-01', '2026-12-31'
      );
    `);

    // 2. Créer une vacation armée pour agt-001 (10h - 18h le 14 décembre 2026, repos > 11h après 22h)
    const resVac = await app.inject({
      method: 'POST',
      url: '/api/plannings',
      headers: { authorization: `Bearer ${jetonChefCC}` },
      payload: {
        agent_id: 'agt-001',
        poste_operationnel_id: 'pop-003',
        type_vacation: '3x8_apres_midi',
        date_debut: '2026-12-14T10:00:00Z',
        date_fin: '2026-12-14T18:00:00Z',
        motif_modification: 'CHALLENGER-R2-DISPENSE'
      }
    });
    assert.strictEqual(resVac.statusCode, 201);
    const vacId = JSON.parse(resVac.payload).vacation.id;

    // 3. Tenter de remplacer par agt-004 qui a maintenant une dispense d'arme
    const resRemp = await app.inject({
      method: 'POST',
      url: '/api/remplacements/ordonner',
      headers: { authorization: `Bearer ${jetonChefCC}` },
      payload: {
        planning_vacation_id: vacId,
        agent_remplacant_id: 'agt-004',
        motif: 'urgence',
        commentaire: 'CHALLENGER-R2-TEST-DISPENSE'
      }
    });

    assert.strictEqual(resRemp.statusCode, 400);
    const corps = JSON.parse(resRemp.payload);
    assert.strictEqual(corps.code_erreur, 'DISPENSE_ARME_ACTIVE');
    assert.match(corps.message, /dispense ou restriction administrative/i);

    // Nettoyer la dispense
    await pool.query("DELETE FROM aptitudes_administratives WHERE id = 'apt-chall-r2-disp'");
  });

  // --------------------------------------------------------------------------
  // ÉPREUVE 4 : Rejet de remplacement violant le repos de 11h (< 11h de repos) -> HTTP 400
  // --------------------------------------------------------------------------
  await t.test('R2-04 : Rejet strict (HTTP 400 REPOS_MINIMAL_INSUFFISANT) lors d un remplacement avec repos < 11h', async () => {
    // 1. agt-004 fait une vacation 15 décembre 06h - 14h
    const resVac1 = await app.inject({
      method: 'POST',
      url: '/api/plannings',
      headers: { authorization: `Bearer ${jetonChefCC}` },
      payload: {
        agent_id: 'agt-004',
        type_vacation: '3x8_matin',
        date_debut: '2026-12-15T06:00:00Z',
        date_fin: '2026-12-15T14:00:00Z',
        motif_modification: 'CHALLENGER-R2-REPOS-1'
      }
    });
    assert.strictEqual(resVac1.statusCode, 201);

    // 2. agt-001 est planifié le même jour de 20h à 04h (seulement 6h après la fin d agt-004)
    const resVac2 = await app.inject({
      method: 'POST',
      url: '/api/plannings',
      headers: { authorization: `Bearer ${jetonChefCC}` },
      payload: {
        agent_id: 'agt-001',
        type_vacation: '3x8_nuit',
        date_debut: '2026-12-15T20:00:00Z',
        date_fin: '2026-12-16T04:00:00Z',
        motif_modification: 'CHALLENGER-R2-REPOS-2'
      }
    });
    assert.strictEqual(resVac2.statusCode, 201);
    const vac2Id = JSON.parse(resVac2.payload).vacation.id;

    // 3. Remplacement ordonné pour assigner agt-004 sur vac2Id (repos = 6h < 11h)
    const resRemp = await app.inject({
      method: 'POST',
      url: '/api/remplacements/ordonner',
      headers: { authorization: `Bearer ${jetonChefCC}` },
      payload: {
        planning_vacation_id: vac2Id,
        agent_remplacant_id: 'agt-004',
        motif: 'urgence',
        commentaire: 'CHALLENGER-R2-TEST-REPOS'
      }
    });

    assert.strictEqual(resRemp.statusCode, 400);
    const corps = JSON.parse(resRemp.payload);
    assert.strictEqual(corps.code_erreur, 'REPOS_MINIMAL_INSUFFISANT');
    assert.match(corps.message, /minimum statutaire : 11h/i);
  });

  // --------------------------------------------------------------------------
  // ÉPREUVE 5 : Rejets stricts ABAC territoriaux (HTTP 403)
  // --------------------------------------------------------------------------
  await t.test('R2-05 : Rejets stricts ABAC territoriaux pour Chef Ali sur Djibouti et inversement (HTTP 403)', async () => {
    // 1. Chef CC planifie agt-001 à Djibouti (U-CC-DJIB)
    const resVacDjib = await app.inject({
      method: 'POST',
      url: '/api/plannings',
      headers: { authorization: `Bearer ${jetonChefCC}` },
      payload: {
        agent_id: 'agt-001',
        type_vacation: '3x8_matin',
        date_debut: '2026-12-20T06:00:00Z',
        date_fin: '2026-12-20T14:00:00Z',
        motif_modification: 'CHALLENGER-R2-ABAC-DJIB'
      }
    });
    assert.strictEqual(resVacDjib.statusCode, 201);
    const vacDjibId = JSON.parse(resVacDjib.payload).vacation.id;

    // 2. Chef Ali tente d'ordonner un remplacement sur la vacation de Djibouti -> HTTP 403
    const resRempCross = await app.inject({
      method: 'POST',
      url: '/api/remplacements/ordonner',
      headers: { authorization: `Bearer ${jetonChefAli}` },
      payload: {
        planning_vacation_id: vacDjibId,
        agent_remplacant_id: 'agt-003',
        motif: 'urgence',
        commentaire: 'CHALLENGER-R2-CROSS-UNITE'
      }
    });
    assert.strictEqual(resRempCross.statusCode, 403);
    assert.strictEqual(JSON.parse(resRempCross.payload).code_erreur, 'ACCES_INTERDIT');

    // 3. Chef Ali tente de modifier la vacation de Djibouti via PUT /api/plannings/:id -> HTTP 403
    const resModifCross = await app.inject({
      method: 'PUT',
      url: `/api/plannings/${vacDjibId}`,
      headers: { authorization: `Bearer ${jetonChefAli}` },
      payload: {
        statut: 'annule',
        motif_modification: 'Annulation illégitime cross-circonscription'
      }
    });
    assert.strictEqual(resModifCross.statusCode, 403);
    assert.strictEqual(JSON.parse(resModifCross.payload).code_erreur, 'ACCES_INTERDIT');

    // 4. Chef Ali tente de chercher des candidats pour la vacation de Djibouti -> HTTP 403
    const resCandidatsCross = await app.inject({
      method: 'GET',
      url: `/api/remplacements/candidats?vacation_id=${vacDjibId}`,
      headers: { authorization: `Bearer ${jetonChefAli}` }
    });
    assert.strictEqual(resCandidatsCross.statusCode, 403);
    assert.strictEqual(JSON.parse(resCandidatsCross.payload).code_erreur, 'ACCES_INTERDIT');

    // 5. Chef CC tente de remplacer avec un agent d'une autre unité (agt-003 d'Ali-Sabieh) -> HTTP 403
    const resRempAgentHorsUnite = await app.inject({
      method: 'POST',
      url: '/api/remplacements/ordonner',
      headers: { authorization: `Bearer ${jetonChefCC}` },
      payload: {
        planning_vacation_id: vacDjibId,
        agent_remplacant_id: 'agt-003',
        motif: 'urgence',
        commentaire: 'CHALLENGER-R2-AGENT-EXTERNE'
      }
    });
    assert.strictEqual(resRempAgentHorsUnite.statusCode, 403);
    assert.strictEqual(JSON.parse(resRempAgentHorsUnite.payload).code_erreur, 'ACCES_INTERDIT');
  });

  // --------------------------------------------------------------------------
  // ÉPREUVE 6 : Cas limites et robustesse générale du module de remplacement
  // --------------------------------------------------------------------------
  await t.test('R2-06 : Cas limites de remplacement (Agent inexistant, Agents identiques, Vacation déjà remplacée)', async () => {
    // 1. Créer une vacation de test
    const resVac = await app.inject({
      method: 'POST',
      url: '/api/plannings',
      headers: { authorization: `Bearer ${jetonChefCC}` },
      payload: {
        agent_id: 'agt-001',
        type_vacation: '3x8_matin',
        date_debut: '2026-12-22T06:00:00Z',
        date_fin: '2026-12-22T14:00:00Z',
        motif_modification: 'CHALLENGER-R2-EDGE'
      }
    });
    assert.strictEqual(resVac.statusCode, 201);
    const vacId = JSON.parse(resVac.payload).vacation.id;

    // A. Agent absent = Agent remplaçant -> HTTP 400 AGENTS_IDENTIQUES
    const resIdentiques = await app.inject({
      method: 'POST',
      url: '/api/remplacements/ordonner',
      headers: { authorization: `Bearer ${jetonChefCC}` },
      payload: {
        planning_vacation_id: vacId,
        agent_absent_id: 'agt-001',
        agent_remplacant_id: 'agt-001',
        motif: 'urgence'
      }
    });
    assert.strictEqual(resIdentiques.statusCode, 400);
    assert.strictEqual(JSON.parse(resIdentiques.payload).code_erreur, 'AGENTS_IDENTIQUES');

    // B. Vacation introuvable -> HTTP 404 VACATION_INTROUVABLE
    const resInconnuVac = await app.inject({
      method: 'POST',
      url: '/api/remplacements/ordonner',
      headers: { authorization: `Bearer ${jetonChefCC}` },
      payload: {
        planning_vacation_id: 'vac-inexistante-999',
        agent_remplacant_id: 'agt-004',
        motif: 'urgence'
      }
    });
    assert.strictEqual(resInconnuVac.statusCode, 404);
    assert.strictEqual(JSON.parse(resInconnuVac.payload).code_erreur, 'VACATION_INTROUVABLE');

    // C. Agent remplaçant inexistant -> HTTP 403 (car non trouvé dans unités autorisées)
    const resInconnuAgent = await app.inject({
      method: 'POST',
      url: '/api/remplacements/ordonner',
      headers: { authorization: `Bearer ${jetonChefCC}` },
      payload: {
        planning_vacation_id: vacId,
        agent_remplacant_id: 'agt-inexistant-888',
        motif: 'urgence'
      }
    });
    assert.strictEqual(resInconnuAgent.statusCode, 403);
    assert.strictEqual(JSON.parse(resInconnuAgent.payload).code_erreur, 'ACCES_INTERDIT');

    // D. Premier remplacement valide
    const resRemp1 = await app.inject({
      method: 'POST',
      url: '/api/remplacements/ordonner',
      headers: { authorization: `Bearer ${jetonChefCC}` },
      payload: {
        planning_vacation_id: vacId,
        agent_remplacant_id: 'agt-004',
        motif: 'urgence',
        commentaire: 'CHALLENGER-R2-PREMIER-REMP'
      }
    });
    assert.strictEqual(resRemp1.statusCode, 201);

    // E. Deuxième tentative de remplacement sur la même vacation initiale -> HTTP 409 DEJA_REMPLACE
    const resRemp2 = await app.inject({
      method: 'POST',
      url: '/api/remplacements/ordonner',
      headers: { authorization: `Bearer ${jetonChefCC}` },
      payload: {
        planning_vacation_id: vacId,
        agent_remplacant_id: 'agt-004',
        motif: 'urgence',
        commentaire: 'CHALLENGER-R2-SECOND-REMP'
      }
    });
    assert.strictEqual(resRemp2.statusCode, 409);
    assert.strictEqual(JSON.parse(resRemp2.payload).code_erreur, 'DEJA_REMPLACE');
  });
});
