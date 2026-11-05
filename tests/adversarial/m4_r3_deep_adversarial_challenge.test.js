/**
 * SUITE ADVERSARIALE DE HAUTE INTENSITÉ — JALON M4 ITÉRATION 3
 * Rôle : Empirical Challenger (challenger_m4_r3_1)
 * Objectif : Éprouver sans concession la robustesse des garde-fous métier et sécuritaires M4 :
 *   1. Contrôle des aptitudes au tir annuel et restriction d'arme active
 *   2. Respect impératif du repos physiologique de 11h (limites exactes, antérieures/postérieures, remplacements)
 *   3. Étanchéité ABAC territoriale (frontières inter-commissariats, arborescence descendante, cross-unit replacement)
 *   4. Cloisonnement disciplinaire absolu et confidentialité de l'aptitude
 *   5. Résilience sous haute concurrence (sérialisation des verrous de ligne PostgreSQL)
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

test('CHALLENGER M4 R3 : Épreuves Adversariales et Contradictoires Approfondies', async (t) => {
  let app;
  let jetonGestionnaireRH;
  let jetonChefCC;
  let jetonChefAli;
  let jetonAgentHassan;
  let jetonAdminTech;
  let jetonAdminFonc;
  let jetonAuditeur;

  const prefix = 'adv-m4r3';

  const purgerDonneesTest = async () => {
    try {
      await pool.query(`
        DELETE FROM remplacements_gardes WHERE motif LIKE '%${prefix}%' OR commentaire LIKE '%${prefix}%' OR date_remplacement >= '2026-12-01';
        DELETE FROM plannings_vacations WHERE id LIKE '${prefix}%' OR motif_modification LIKE '%${prefix}%' OR date_debut >= '2026-12-01'::timestamptz;
        DELETE FROM aptitudes_administratives WHERE numero_certificat_administratif LIKE 'CERT-${prefix}%' OR id LIKE 'apt-${prefix}%';
        DELETE FROM qualifications_agents WHERE id LIKE 'qua-${prefix}%';
        DELETE FROM documents_generes WHERE reference_document LIKE 'DOC-${prefix}%';
        DELETE FROM dossiers_disciplinaires WHERE numero_dossier LIKE 'DISC-${prefix}%';
      `);
    } catch (e) {
      // Ignorer
    }
  };

  t.before(async () => {
    app = await creerApplicationServeur();
    await app.ready();
    await purgerDonneesTest();

    const login = async (identifiant) => {
      let tentatives = 0;
      while (tentatives < 5) {
        tentatives++;
        const res = await app.inject({
          method: 'POST',
          url: '/api/auth/connexion',
          payload: { identifiant, mot_de_passe: 'Police@2026!' }
        });
        if (res.statusCode === 200) {
          return JSON.parse(res.payload).jeton;
        }
        await new Promise((r) => setTimeout(r, 200));
      }
      throw new Error(`Échec de connexion persistant pour ${identifiant}`);
    };

    jetonGestionnaireRH = await login('gestionnaire_rh');
    jetonChefCC = await login('chef_cc');
    jetonChefAli = await login('chef_ali');
    jetonAgentHassan = await login('agent_hassan');
    jetonAdminTech = await login('admin_tech');
    jetonAdminFonc = await login('admin_fonc');
    jetonAuditeur = await login('auditeur');
  });

  t.after(async () => {
    await purgerDonneesTest();
    if (app) await app.close();
    if (fermerPool && !pool?.ending && !pool?.ended) {
      await fermerPool().catch(() => {});
    }
  });

  // ==========================================================================
  // THÈME 1 : CONTRÔLE DE L'APTITUDE AU TIR ET RESTRICTIONS D'ARMES
  // ==========================================================================

  await t.test('1.1 Épreuve Tir : Rejet de planification directe (POST /api/plannings) pour agent sans certificat valide sur poste armé', async () => {
    // Cas A : Agent sans aucun certificat de tir (agt-rh-01)
    const resSansCert = await app.inject({
      method: 'POST',
      url: '/api/plannings',
      headers: { authorization: `Bearer ${jetonChefCC}` },
      payload: {
        agent_id: 'agt-rh-01',
        poste_operationnel_id: 'pop-003', // Chef de Patrouille Armée (tir_requis: true)
        type_vacation: '3x8_matin',
        date_debut: '2026-12-05T06:00:00Z',
        date_fin: '2026-12-05T14:00:00Z',
        motif_modification: `${prefix}-tir-absent`
      }
    });
    // agt-rh-01 est en plus hors unité de Chef CC, mais même si géré par DRH :
    const resSansCertDRH = await app.inject({
      method: 'POST',
      url: '/api/plannings',
      headers: { authorization: `Bearer ${jetonGestionnaireRH}` },
      payload: {
        agent_id: 'agt-rh-01',
        poste_operationnel_id: 'pop-003',
        type_vacation: '3x8_matin',
        date_debut: '2026-12-05T06:00:00Z',
        date_fin: '2026-12-05T14:00:00Z',
        motif_modification: `${prefix}-tir-absent`
      }
    });
    assert.strictEqual(resSansCertDRH.statusCode, 400);
    assert.strictEqual(JSON.parse(resSansCertDRH.payload).code_erreur, 'CERTIFICAT_TIR_EXPIRE');

    // Cas B : Agent avec certificat expiré (agt-002, expiré le 2026-05-15) sur poste armé
    const resTirExpire = await app.inject({
      method: 'POST',
      url: '/api/plannings',
      headers: { authorization: `Bearer ${jetonChefCC}` },
      payload: {
        agent_id: 'agt-002',
        poste_operationnel_id: 'pop-003',
        type_vacation: '3x8_matin',
        date_debut: '2026-12-05T06:00:00Z',
        date_fin: '2026-12-05T14:00:00Z',
        motif_modification: `${prefix}-tir-expire`
      }
    });
    assert.strictEqual(resTirExpire.statusCode, 400);
    assert.strictEqual(JSON.parse(resTirExpire.payload).code_erreur, 'CERTIFICAT_TIR_EXPIRE');

    // Cas C : Même agent sur poste NON armé (pop-005, tir_requis: false) -> DOIT RÉUSSIR HTTP 201
    const resPosteNonArme = await app.inject({
      method: 'POST',
      url: '/api/plannings',
      headers: { authorization: `Bearer ${jetonChefCC}` },
      payload: {
        agent_id: 'agt-002',
        poste_operationnel_id: 'pop-005', // Accueil Sédentaire
        type_vacation: '3x8_matin',
        date_debut: '2026-12-05T06:00:00Z',
        date_fin: '2026-12-05T14:00:00Z',
        motif_modification: `${prefix}-poste-non-arme`
      }
    });
    assert.strictEqual(resPosteNonArme.statusCode, 201, 'Un poste non armé ne doit pas exiger de certificat de tir');
  });

  await t.test('1.2 Épreuve Restriction Arme Active : Rejet lors de dispense administrative active (DISPENSE_PORT_ARME)', async () => {
    // Créer une décision d'aptitude avec restriction d'arme active pour agt-001 (qui a par ailleurs un tir valide)
    const certNum = `CERT-${prefix}-DISP-${Date.now()}`;
    await pool.query(`
      INSERT INTO aptitudes_administratives (
        id, agent_id, numero_certificat_administratif, decision_aptitude,
        type_conclusion, code_restriction, restriction_operationnelle,
        date_decision, date_expiration
      ) VALUES (
        'apt-${prefix}-01', 'agt-001', '${certNum}', 'APTE_AVEC_RESTRICTIONS',
        'APTE_AVEC_RESTRICTIONS', 'DISPENSE_PORT_ARME', 'Exemption temporaire de port de l arme de service',
        '2026-11-01', '2026-12-31'
      );
    `);

    // Tentative de planification directe sur pop-003 pour agt-001 -> DOIT ÉCHOUER HTTP 400 DISPENSE_ARME_ACTIVE
    const resPlanArme = await app.inject({
      method: 'POST',
      url: '/api/plannings',
      headers: { authorization: `Bearer ${jetonChefCC}` },
      payload: {
        agent_id: 'agt-001',
        poste_operationnel_id: 'pop-003',
        type_vacation: '3x8_matin',
        date_debut: '2026-12-06T06:00:00Z',
        date_fin: '2026-12-06T14:00:00Z',
        motif_modification: `${prefix}-dispense-arme`
      }
    });
    assert.strictEqual(resPlanArme.statusCode, 400);
    const corps = JSON.parse(resPlanArme.payload);
    assert.strictEqual(corps.code_erreur, 'DISPENSE_ARME_ACTIVE');
    assert.match(corps.message, /dispense ou restriction administrative/i);

    // Tentative de remplacement d'urgence : créer une vacation armée pour agt-004
    const resVac4 = await app.inject({
      method: 'POST',
      url: '/api/plannings',
      headers: { authorization: `Bearer ${jetonChefCC}` },
      payload: {
        agent_id: 'agt-004',
        poste_operationnel_id: 'pop-003',
        type_vacation: '3x8_matin',
        date_debut: '2026-12-07T06:00:00Z',
        date_fin: '2026-12-07T14:00:00Z',
        motif_modification: `${prefix}-remp-dispense-arme`
      }
    });
    assert.strictEqual(resVac4.statusCode, 201);
    const vac4Id = JSON.parse(resVac4.payload).vacation.id;

    // Tenter de remplacer par agt-001 (qui a la dispense active)
    const resRempDispense = await app.inject({
      method: 'POST',
      url: '/api/remplacements/ordonner',
      headers: { authorization: `Bearer ${jetonChefCC}` },
      payload: {
        planning_vacation_id: vac4Id,
        agent_remplacant_id: 'agt-001',
        motif: 'urgence'
      }
    });
    assert.strictEqual(resRempDispense.statusCode, 400);
    assert.strictEqual(JSON.parse(resRempDispense.payload).code_erreur, 'DISPENSE_ARME_ACTIVE');

    // Nettoyage de la dispense temporaire pour les tests suivants
    await pool.query(`DELETE FROM aptitudes_administratives WHERE id = 'apt-${prefix}-01'`);
  });

  // ==========================================================================
  // THÈME 2 : RESPECT IMPÉRATIF DU REPOS PHYSIOLOGIQUE DE 11 HEURES
  // ==========================================================================

  await t.test('2.1 Épreuve Repos : Limites strictes à la minute près (11h00 vs 10h59)', async () => {
    // Vacation initiale : 08 décembre de 06:00:00Z à 14:00:00Z pour agt-004
    const resInit = await app.inject({
      method: 'POST',
      url: '/api/plannings',
      headers: { authorization: `Bearer ${jetonChefCC}` },
      payload: {
        agent_id: 'agt-004',
        type_vacation: '3x8_matin',
        date_debut: '2026-12-08T06:00:00Z',
        date_fin: '2026-12-08T14:00:00Z',
        motif_modification: `${prefix}-repos-base`
      }
    });
    assert.strictEqual(resInit.statusCode, 201);

    // Cas 1 : Tentative à 10h59 de repos (00:59:00Z le lendemain, soit 10h59m après 14h)
    const resRefus10h59 = await app.inject({
      method: 'POST',
      url: '/api/plannings',
      headers: { authorization: `Bearer ${jetonChefCC}` },
      payload: {
        agent_id: 'agt-004',
        type_vacation: '3x8_matin',
        date_debut: '2026-12-09T00:59:00Z',
        date_fin: '2026-12-09T08:59:00Z',
        motif_modification: `${prefix}-repos-10h59`
      }
    });
    assert.strictEqual(resRefus10h59.statusCode, 400, 'Un repos de 10h59m doit être formellement rejeté');
    assert.strictEqual(JSON.parse(resRefus10h59.payload).code_erreur, 'REPOS_MINIMAL_INSUFFISANT');

    // Cas 2 : Tentative à exactement 11h00 de repos (01:00:00Z le lendemain, soit 11h00m après 14h)
    const resAccepte11h = await app.inject({
      method: 'POST',
      url: '/api/plannings',
      headers: { authorization: `Bearer ${jetonChefCC}` },
      payload: {
        agent_id: 'agt-004',
        type_vacation: '3x8_matin',
        date_debut: '2026-12-09T01:00:00Z',
        date_fin: '2026-12-09T09:00:00Z',
        motif_modification: `${prefix}-repos-11h00`
      }
    });
    assert.strictEqual(resAccepte11h.statusCode, 201, 'Un repos d exactement 11h00 doit être validé');
  });

  await t.test('2.2 Épreuve Repos : Contrôle du repos avec le service POSTÉRIEUR lors d\'un remplacement', async () => {
    // 1. Agt-004 a une vacation future prévue le 10 décembre de 20:00:00Z à 04:00:00Z (nuit)
    const resPost = await app.inject({
      method: 'POST',
      url: '/api/plannings',
      headers: { authorization: `Bearer ${jetonChefCC}` },
      payload: {
        agent_id: 'agt-004',
        type_vacation: '3x8_nuit',
        date_debut: '2026-12-10T20:00:00Z',
        date_fin: '2026-12-11T04:00:00Z',
        motif_modification: `${prefix}-repos-post-futur`
      }
    });
    assert.strictEqual(resPost.statusCode, 201);

    // 2. Une vacation a besoin d'un remplacement le 10 décembre de 06:00:00Z à 14:00:00Z pour agt-001
    // (Entre 14:00:00Z et 20:00:00Z il n'y a que 6h de repos avant la vacation de nuit d'agt-004 !)
    const resCible = await app.inject({
      method: 'POST',
      url: '/api/plannings',
      headers: { authorization: `Bearer ${jetonChefCC}` },
      payload: {
        agent_id: 'agt-001',
        poste_operationnel_id: 'pop-005',
        type_vacation: '3x8_matin',
        date_debut: '2026-12-10T06:00:00Z',
        date_fin: '2026-12-10T14:00:00Z',
        motif_modification: `${prefix}-repos-post-cible`
      }
    });
    assert.strictEqual(resCible.statusCode, 201);
    const vacCibleId = JSON.parse(resCible.payload).vacation.id;

    // 3. Ordonner le remplacement par agt-004 : Doit être rejeté car repos postérieur = 6h (< 11h)
    const resRempPost = await app.inject({
      method: 'POST',
      url: '/api/remplacements/ordonner',
      headers: { authorization: `Bearer ${jetonChefCC}` },
      payload: {
        planning_vacation_id: vacCibleId,
        agent_remplacant_id: 'agt-004',
        motif: 'urgence'
      }
    });

    assert.strictEqual(resRempPost.statusCode, 400);
    const corps = JSON.parse(resRempPost.payload);
    assert.strictEqual(corps.code_erreur, 'REPOS_MINIMAL_INSUFFISANT');
    assert.match(corps.message, /service suivant/i);
  });

  // ==========================================================================
  // THÈME 3 : ÉTANCHÉITÉ ABAC TERRITORIALE (CIRCONSCRIPTIONS & HIÉRARCHIE)
  // ==========================================================================

  await t.test('3.1 Épreuve ABAC : Tentatives multiples d\'ingérence territoriale par Chef Ali', async () => {
    // 1. Chef Ali tente d'obtenir les candidats remplaçants pour une vacation de Djibouti (U-CC-DJIB)
    // Créer d'abord une vacation à U-CC-DJIB
    const resVacCC = await app.inject({
      method: 'POST',
      url: '/api/plannings',
      headers: { authorization: `Bearer ${jetonChefCC}` },
      payload: {
        agent_id: 'agt-001',
        type_vacation: '3x8_matin',
        date_debut: '2026-12-15T06:00:00Z',
        date_fin: '2026-12-15T14:00:00Z',
        motif_modification: `${prefix}-abac-cc`
      }
    });
    assert.strictEqual(resVacCC.statusCode, 201);
    const vacCCId = JSON.parse(resVacCC.payload).vacation.id;

    // Chef Ali interroge /api/remplacements/candidats sur cette vacation
    const resCandidatsHorsTerritoire = await app.inject({
      method: 'GET',
      url: `/api/remplacements/candidats?planning_vacation_id=${vacCCId}`,
      headers: { authorization: `Bearer ${jetonChefAli}` }
    });
    assert.strictEqual(resCandidatsHorsTerritoire.statusCode, 403, 'Chef Ali ne doit pas pouvoir sonder les candidats d une vacation de Djibouti');
    assert.strictEqual(JSON.parse(resCandidatsHorsTerritoire.payload).code_erreur, 'ACCES_INTERDIT');

    // 2. Chef Ali tente d'obtenir les alertes de sous-effectif de Djibouti (U-CC-DJIB)
    const resAlertesHorsTerritoire = await app.inject({
      method: 'GET',
      url: '/api/plannings/alertes-sous-effectif?unite_id=U-CC-DJIB',
      headers: { authorization: `Bearer ${jetonChefAli}` }
    });
    assert.strictEqual(resAlertesHorsTerritoire.statusCode, 403, 'Chef Ali ne doit pas pouvoir voir les alertes de sous-effectif de Djibouti');
    assert.strictEqual(JSON.parse(resAlertesHorsTerritoire.payload).code_erreur, 'ACCES_INTERDIT');

    // 3. Chef Ali tente de lister les plannings avec filtre sur Djibouti (unite_id=U-CC-DJIB)
    const resListeHorsTerritoire = await app.inject({
      method: 'GET',
      url: '/api/plannings?unite_id=U-CC-DJIB',
      headers: { authorization: `Bearer ${jetonChefAli}` }
    });
    assert.strictEqual(resListeHorsTerritoire.statusCode, 403, 'Chef Ali ne doit pas pouvoir filtrer sur les plannings de Djibouti');
    assert.strictEqual(JSON.parse(resListeHorsTerritoire.payload).code_erreur, 'ACCES_INTERDIT');
  });

  await t.test('3.2 Épreuve ABAC : Arborescence descendante légitime pour Chef CC (U-CC-DJIB -> U-ARR-1)', async () => {
    // Chef CC a autorité sur U-CC-DJIB et tous les arrondissements U-ARR-1 à U-ARR-5
    // Créer une vacation avec unite_id: 'U-ARR-1' pour agt-001 doit RÉUSSIR HTTP 201
    const resArr1 = await app.inject({
      method: 'POST',
      url: '/api/plannings',
      headers: { authorization: `Bearer ${jetonChefCC}` },
      payload: {
        agent_id: 'agt-001',
        unite_id: 'U-ARR-1', // Sous-unité du Commissariat Central
        type_vacation: '3x8_matin',
        date_debut: '2026-12-16T06:00:00Z',
        date_fin: '2026-12-16T14:00:00Z',
        motif_modification: `${prefix}-abac-arr1`
      }
    });
    assert.strictEqual(resArr1.statusCode, 201, 'Chef CC doit pouvoir planifier dans un arrondissement sous son autorité');
    const vacArr1Id = JSON.parse(resArr1.payload).vacation.id;

    // Chef CC doit pouvoir modifier cette vacation
    const resModifArr1 = await app.inject({
      method: 'PUT',
      url: `/api/plannings/${vacArr1Id}`,
      headers: { authorization: `Bearer ${jetonChefCC}` },
      payload: {
        statut: 'valide',
        motif_modification: 'Validation opérationnelle Arrondissement 1'
      }
    });
    assert.strictEqual(resModifArr1.statusCode, 200);

    // En revanche, Chef Ali tentant de modifier cette même vacation U-ARR-1 -> REJET HTTP 403
    const resChefAliModifArr1 = await app.inject({
      method: 'PUT',
      url: `/api/plannings/${vacArr1Id}`,
      headers: { authorization: `Bearer ${jetonChefAli}` },
      payload: {
        statut: 'annule'
      }
    });
    assert.strictEqual(resChefAliModifArr1.statusCode, 403, 'Chef Ali ne doit pas pouvoir modifier une vacation du 1er Arrondissement');
    assert.strictEqual(JSON.parse(resChefAliModifArr1.payload).code_erreur, 'ACCES_INTERDIT');
  });

  // ==========================================================================
  // THÈME 4 : CLOISONNEMENT DISCIPLINAIRE ET ÉTANCHÉITÉ APTITUDE
  // ==========================================================================

  await t.test('4.1 Épreuve Discipline : Étanchéité absolue de TOUS les profils non-habilités (Audit Forensic)', async () => {
    const profils = [
      { jeton: jetonAgentHassan, nom: 'Agent Hassan' },
      { jeton: jetonChefCC, nom: 'Chef CC' },
      { jeton: jetonChefAli, nom: 'Chef Ali' },
      { jeton: jetonAdminTech, nom: 'Admin Tech' },
      { jeton: jetonAdminFonc, nom: 'Admin Fonc' },
      { jeton: jetonAuditeur, nom: 'Auditeur' }
    ];

    for (const p of profils) {
      // 1. Consultation liste dossiers disciplinaires
      const resListe = await app.inject({
        method: 'GET',
        url: '/api/discipline/dossiers',
        headers: { authorization: `Bearer ${p.jeton}` }
      });
      assert.strictEqual(resListe.statusCode, 403, `${p.nom} ne doit pas pouvoir accéder aux dossiers disciplinaires`);
      assert.strictEqual(JSON.parse(resListe.payload).code_erreur, 'ACCES_INTERDIT');

      // 2. Consultation d'un dossier spécifique
      const resDossier = await app.inject({
        method: 'GET',
        url: '/api/discipline/dossiers/dos-disc-001',
        headers: { authorization: `Bearer ${p.jeton}` }
      });
      assert.strictEqual(resDossier.statusCode, 403, `${p.nom} ne doit pas pouvoir ouvrir un dossier disciplinaire`);

      // 3. Tentative de création d'un dossier disciplinaire
      const resCreer = await app.inject({
        method: 'POST',
        url: '/api/discipline/dossiers',
        headers: { authorization: `Bearer ${p.jeton}` },
        payload: {
          agent_id: 'agt-001',
          date_faits: '2026-11-01',
          description_sommaire: `${prefix}-intrusion-${p.nom}`
        }
      });
      assert.strictEqual(resCreer.statusCode, 403, `${p.nom} ne doit pas pouvoir créer un dossier disciplinaire`);

      // 4. Tentative de prononcé de sanction
      const resSanction = await app.inject({
        method: 'POST',
        url: '/api/discipline/sanctions',
        headers: { authorization: `Bearer ${p.jeton}` },
        payload: {
          dossier_disciplinaire_id: 'dos-disc-001',
          nature_sanction: 'BLAME',
          date_effet: '2026-11-01'
        }
      });
      assert.strictEqual(resSanction.statusCode, 403, `${p.nom} ne doit pas pouvoir prononcer de sanction`);
    }

    // Vérifier la journalisation forensique dans journaux_audit
    const auditRes = await pool.query(`
      SELECT count(*) as nb FROM journaux_audit
      WHERE action_type = 'TENTATIVE_CONSULTATION_DISCIPLINE_BLOQUEE';
    `);
    assert(parseInt(auditRes.rows[0].nb, 10) >= profils.length, 'Chaque intrusion doit être consignée en audit');
  });

  await t.test('4.2 Épreuve Aptitude : Confidentialité stricte des dossiers d\'aptitude nominatifs', async () => {
    // 1. Admin Tech bloqué en 403 sur /api/aptitude/:agentId
    const resTechApt = await app.inject({
      method: 'GET',
      url: '/api/aptitude/agt-001',
      headers: { authorization: `Bearer ${jetonAdminTech}` }
    });
    assert.strictEqual(resTechApt.statusCode, 403);
    assert.strictEqual(JSON.parse(resTechApt.payload).code_erreur, 'ACCES_INTERDIT');

    // 2. Agent Hassan (agt-001) interroge le dossier d'Amina (agt-002) -> 403
    const resAgentAmina = await app.inject({
      method: 'GET',
      url: '/api/aptitude/agt-002',
      headers: { authorization: `Bearer ${jetonAgentHassan}` }
    });
    assert.strictEqual(resAgentAmina.statusCode, 403);

    // 3. Agent Hassan interroge son propre dossier (agt-001) -> 200
    const resAgentSoi = await app.inject({
      method: 'GET',
      url: '/api/aptitude/agt-001',
      headers: { authorization: `Bearer ${jetonAgentHassan}` }
    });
    assert.strictEqual(resAgentSoi.statusCode, 200);
    assert.strictEqual(JSON.parse(resAgentSoi.payload).statut, 'SUCCES');

    // 4. Chef Ali interroge le dossier d'un agent de Djibouti (agt-001) -> 403
    const resChefAliAgt1 = await app.inject({
      method: 'GET',
      url: '/api/aptitude/agt-001',
      headers: { authorization: `Bearer ${jetonChefAli}` }
    });
    assert.strictEqual(resChefAliAgt1.statusCode, 403);

    // 5. Chef CC interroge son agent (agt-001) -> 200
    const resChefCCAgt1 = await app.inject({
      method: 'GET',
      url: '/api/aptitude/agt-001',
      headers: { authorization: `Bearer ${jetonChefCC}` }
    });
    assert.strictEqual(resChefCCAgt1.statusCode, 200);
  });

  // ==========================================================================
  // THÈME 5 : HAUTE CONCURRENCE & SÉRIALISATION TRANSACTIONNELLE
  // ==========================================================================

  await t.test('5.1 Concurrence Haute : 15 requêtes simultanées de création de vacation pour le même agent', async () => {
    const debut = '2026-12-20T06:00:00Z';
    const fin = '2026-12-20T14:00:00Z';
    const nbRequetes = 15;

    const promesses = Array.from({ length: nbRequetes }, (_, i) =>
      app.inject({
        method: 'POST',
        url: '/api/plannings',
        headers: { authorization: `Bearer ${jetonChefCC}` },
        payload: {
          agent_id: 'agt-004',
          poste_operationnel_id: 'pop-005',
          type_vacation: '3x8_matin',
          date_debut: debut,
          date_fin: fin,
          motif_modification: `${prefix}-concurrence-${i}`
        }
      })
    );

    const resultats = await Promise.all(promesses);
    const succes = resultats.filter(r => r.statusCode === 201);
    const chevauchements = resultats.filter(r => r.statusCode === 400 && JSON.parse(r.payload).code_erreur === 'CHEVOUCHEMENT_DETECTE');

    assert.strictEqual(succes.length, 1, `Exactement 1 vacation doit être créée parmi les 15 (obtenu: ${succes.length})`);
    assert.strictEqual(chevauchements.length, nbRequetes - 1, `Les 14 autres requêtes doivent être rejetées pour chevauchement (obtenu: ${chevauchements.length})`);

    // Vérification en base de données : exactement 1 ligne enregistrée
    const dbCount = await pool.query(`
      SELECT count(*) as total FROM plannings_vacations
      WHERE agent_id = 'agt-004' AND date_debut = $1 AND date_fin = $2 AND statut = 'planifie';
    `, [debut, fin]);
    assert.strictEqual(parseInt(dbCount.rows[0].total, 10), 1, 'Exactement 1 ligne en base de données');
  });

  await t.test('5.2 Concurrence Haute : 10 requêtes simultanées de remplacement sur la même vacation', async () => {
    // 1. Créer une vacation à remplacer pour agt-001
    const resVac = await app.inject({
      method: 'POST',
      url: '/api/plannings',
      headers: { authorization: `Bearer ${jetonChefCC}` },
      payload: {
        agent_id: 'agt-001',
        poste_operationnel_id: 'pop-005',
        type_vacation: '3x8_matin',
        date_debut: '2026-12-22T06:00:00Z',
        date_fin: '2026-12-22T14:00:00Z',
        motif_modification: `${prefix}-concurrence-remp`
      }
    });
    assert.strictEqual(resVac.statusCode, 201);
    const vacId = JSON.parse(resVac.payload).vacation.id;

    // 2. Lancer 10 requêtes simultanées pour remplacer cette même vacation par agt-004
    const nbTentatives = 10;
    const promessesRemp = Array.from({ length: nbTentatives }, (_, i) =>
      app.inject({
        method: 'POST',
        url: '/api/remplacements/ordonner',
        headers: { authorization: `Bearer ${jetonChefCC}` },
        payload: {
          planning_vacation_id: vacId,
          agent_remplacant_id: 'agt-004',
          motif: 'urgence',
          commentaire: `${prefix}-remp-conc-${i}`
        }
      })
    );

    const reponses = await Promise.all(promessesRemp);
    const rempSucces = reponses.filter(r => r.statusCode === 201);
    const rempConflits = reponses.filter(r => r.statusCode === 409 || (r.statusCode === 400 && JSON.parse(r.payload).code_erreur === 'CHEVOUCHEMENT_DETECTE'));

    assert.strictEqual(rempSucces.length, 1, `Exactement 1 remplacement doit réussir (obtenu: ${rempSucces.length})`);
    assert.strictEqual(rempSucces.length + rempConflits.length, nbTentatives, 'Toutes les requêtes doivent être soit validées soit rejetées en conflit');

    // Vérifier l'état en base : vacation initiale marquée 'remplace'
    const vacCheck = await pool.query('SELECT statut FROM plannings_vacations WHERE id = $1', [vacId]);
    assert.strictEqual(vacCheck.rows[0].statut, 'remplace');

    // Vérifier qu'exactement 1 remplacement est enregistré dans remplacements_gardes
    const rempCheck = await pool.query('SELECT count(*) as total FROM remplacements_gardes WHERE planning_vacation_id = $1', [vacId]);
    assert.strictEqual(parseInt(rempCheck.rows[0].total, 10), 1);
  });
});
