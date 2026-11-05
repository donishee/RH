const test = require('node:test');
const assert = require('node:assert/strict');

// Chargement du serveur compilé ou via tsx
let creerApplicationServeur;
let pool;
let fermerPool;
let auditService;

try {
  creerApplicationServeur = require('../../dist/server.js').creerApplicationServeur;
  const dbModule = require('../../dist/database/index.js');
  pool = dbModule.pool;
  fermerPool = dbModule.fermerPool;
  auditService = require('../../dist/modules/audit/audit.service.js').auditService;
} catch {
  require('tsx/cjs');
  creerApplicationServeur = require('../../src/server.ts').creerApplicationServeur;
  const dbModule = require('../../src/database/index.ts');
  pool = dbModule.pool;
  fermerPool = dbModule.fermerPool;
  auditService = require('../../src/modules/audit/audit.service.ts').auditService;
}

test('CHALLENGER M2-1 : Épreuves Contradictoires de Concurrence, Sécurité & Audit (Jalon M2)', async (t) => {
  let app;
  let jetonGestionnaireRH;
  let jetonAdminTech;
  let jetonChefCC;
  let jetonChefAli;
  let jetonAgentHassan;
  let jetonAuditeur;

  t.before(async () => {
    app = await creerApplicationServeur();
    await app.ready();

    // Authentification des profils
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
  });

  t.after(async () => {
    if (app) await app.close();
    if (fermerPool && !pool?.ending && !pool?.ended) {
      await fermerPool().catch(() => {});
    }
  });

  // ============================================================================
  // ÉPREUVE 1 : ATTAQUE PAR DOUBLE VALIDATION SIMULTANÉE & CONCURRENCE (RACE CONDITION)
  // ============================================================================

  await t.test('1.1 : Double validation simultanée (Promise.all) avec même version de départ', async () => {
    // 1. Soumission d'une demande de 3 jours par Hassan
    const resSoumis = await app.inject({
      method: 'POST',
      url: '/api/conges/demandes',
      headers: { Authorization: `Bearer ${jetonAgentHassan}` },
      payload: {
        type_conge_id: 'tc-annuel',
        date_debut: '2026-06-01',
        date_fin: '2026-06-03',
        nombre_jours: 3.0,
        motif: 'Congé test concurrence 1.1'
      }
    });
    assert.strictEqual(resSoumis.statusCode, 201);
    const demId = JSON.parse(resSoumis.payload).demande.id;

    // 2. Visa favorable du Chef CC -> passage au statut APPROUVE_CHEF_SERVICE (version 2)
    const resVisa = await app.inject({
      method: 'PUT',
      url: `/api/conges/demandes/${demId}/viser-chef`,
      headers: { Authorization: `Bearer ${jetonChefCC}` },
      payload: { avis: 'FAVORABLE' }
    });
    assert.strictEqual(resVisa.statusCode, 200);
    const demVisa = JSON.parse(resVisa.payload).demande;
    assert.strictEqual(demVisa.version_concurrence, 2);

    // Relevé du solde avant validation
    const resSoldeAvant = await app.inject({
      method: 'GET',
      url: '/api/conges/soldes/agt-001',
      headers: { Authorization: `Bearer ${jetonGestionnaireRH}` }
    });
    const soldeAvant = JSON.parse(resSoldeAvant.payload).solde;

    // 3. Deux requêtes de validation RH envoyées STRICTEMENT en parallèle avec version 2
    const [resA, resB] = await Promise.all([
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

    // Analyse empirique des résultats : exactement une 200 et une 409
    const codes = [resA.statusCode, resB.statusCode].sort((a, b) => a - b);
    assert.deepStrictEqual(codes, [200, 409], 'Exactement une transaction doit réussir (200) et une échouer en conflit (409)');

    const rep409 = resA.statusCode === 409 ? JSON.parse(resA.payload) : JSON.parse(resB.payload);
    assert.strictEqual(rep409.code_erreur, 'CONFLIT_CONCURRENCE');
    assert.match(rep409.message, /Conflit de concurrence/i);

    // 4. Contrôle d'invariance et absence absolue de double débit
    const resSoldeApres = await app.inject({
      method: 'GET',
      url: '/api/conges/soldes/agt-001',
      headers: { Authorization: `Bearer ${jetonGestionnaireRH}` }
    });
    const soldeApres = JSON.parse(resSoldeApres.payload).solde;

    // Seuls 3 jours doivent avoir basculé de en_attente vers jours_pris
    assert.strictEqual(soldeApres.jours_pris, soldeAvant.jours_pris + 3.0, 'Les jours pris ne doivent être débités qu\'UNE seule fois');
    assert.strictEqual(soldeApres.jours_en_attente, soldeAvant.jours_en_attente - 3.0);
    assert.strictEqual(soldeApres.jours_restants, soldeAvant.jours_restants);
    assert.strictEqual(
      soldeApres.jours_pris + soldeApres.jours_en_attente + soldeApres.jours_restants,
      soldeApres.jours_acquis + soldeApres.jours_reportes,
      'Invariance arithmétique globale du solde respectée'
    );

    // Nettoyage
    await app.inject({
      method: 'POST',
      url: `/api/conges/demandes/${demId}/annuler`,
      headers: { Authorization: `Bearer ${jetonGestionnaireRH}` },
      payload: { motif_annulation: 'Nettoyage épreuve 1.1' }
    });
  });

  await t.test('1.2 : Stress test massif — 10 validations concurrentes simultanées sur la même demande', async () => {
    // 1. Soumission d'une demande de 2 jours
    const resSoumis = await app.inject({
      method: 'POST',
      url: '/api/conges/demandes',
      headers: { Authorization: `Bearer ${jetonAgentHassan}` },
      payload: {
        type_conge_id: 'tc-annuel',
        date_debut: '2026-06-10',
        date_fin: '2026-06-11',
        nombre_jours: 2.0,
        motif: 'Congé test stress 10x'
      }
    });
    const demId = JSON.parse(resSoumis.payload).demande.id;

    // Visa chef
    await app.inject({
      method: 'PUT',
      url: `/api/conges/demandes/${demId}/viser-chef`,
      headers: { Authorization: `Bearer ${jetonChefCC}` },
      payload: { avis: 'FAVORABLE' }
    });

    const resSoldeAvant = await app.inject({
      method: 'GET',
      url: '/api/conges/soldes/agt-001',
      headers: { Authorization: `Bearer ${jetonGestionnaireRH}` }
    });
    const soldeAvant = JSON.parse(resSoldeAvant.payload).solde;

    // 2. 10 requêtes de validation RH lancées à la même milliseconde avec la version 2
    const NOMBRE_CONCURRENTS = 10;
    const promises = [];
    for (let i = 0; i < NOMBRE_CONCURRENTS; i++) {
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

    assert.strictEqual(autres.length, 0, 'Aucun code d\'erreur inattendu (500 ou autre)');
    assert.strictEqual(reussites.length, 1, 'Exactement 1 validation sur 10 doit aboutir avec succès');
    assert.strictEqual(conflits.length, NOMBRE_CONCURRENTS - 1, 'Les 9 autres requêtes doivent être rejetées avec HTTP 409');

    // Vérification de la table validations_conges : exactement 1 validation DRH enregistrée
    const verifValRes = await pool.query(
      "SELECT COUNT(*) AS total FROM validations_conges WHERE demande_id = $1 AND etape = 'VALIDATION_RH'",
      [demId]
    );
    assert.strictEqual(parseInt(verifValRes.rows[0].total, 10), 1, 'Exactement une seule ligne VALIDATION_RH en base');

    // Vérification du solde : débit unique de 2 jours
    const resSoldeApres = await app.inject({
      method: 'GET',
      url: '/api/conges/soldes/agt-001',
      headers: { Authorization: `Bearer ${jetonGestionnaireRH}` }
    });
    const soldeApres = JSON.parse(resSoldeApres.payload).solde;
    assert.strictEqual(soldeApres.jours_pris, soldeAvant.jours_pris + 2.0);

    // Nettoyage
    await app.inject({
      method: 'POST',
      url: `/api/conges/demandes/${demId}/annuler`,
      headers: { Authorization: `Bearer ${jetonGestionnaireRH}` },
      payload: { motif_annulation: 'Nettoyage épreuve 1.2' }
    });
  });

  await t.test('1.3 : Concurrence sans numéro de version transmis — 5 requêtes simultanées', async () => {
    const resSoumis = await app.inject({
      method: 'POST',
      url: '/api/conges/demandes',
      headers: { Authorization: `Bearer ${jetonAgentHassan}` },
      payload: {
        type_conge_id: 'tc-annuel',
        date_debut: '2026-06-15',
        date_fin: '2026-06-16',
        nombre_jours: 2.0,
        motif: 'Congé test sans version'
      }
    });
    const demId = JSON.parse(resSoumis.payload).demande.id;

    await app.inject({
      method: 'PUT',
      url: `/api/conges/demandes/${demId}/viser-chef`,
      headers: { Authorization: `Bearer ${jetonChefCC}` },
      payload: { avis: 'FAVORABLE' }
    });

    // 5 requêtes sans version_concurrence dans le corps
    const promises = [];
    for (let i = 0; i < 5; i++) {
      promises.push(
        app.inject({
          method: 'PUT',
          url: `/api/conges/demandes/${demId}/valider-rh`,
          headers: { Authorization: `Bearer ${jetonGestionnaireRH}` },
          payload: { decision: 'VALIDE' } // Pas de version_concurrence
        })
      );
    }

    const reponses = await Promise.all(promises);
    const reussites = reponses.filter(r => r.statusCode === 200);
    const conflits = reponses.filter(r => r.statusCode === 409);

    assert.strictEqual(reussites.length, 1, 'Même sans version explicite, une seule transaction peut valider');
    assert.strictEqual(conflits.length, 4, 'Les 4 requêtes suivantes doivent être rejetées avec HTTP 409 (demande déjà validée)');

    // Nettoyage
    await app.inject({
      method: 'POST',
      url: `/api/conges/demandes/${demId}/annuler`,
      headers: { Authorization: `Bearer ${jetonGestionnaireRH}` },
      payload: { motif_annulation: 'Nettoyage épreuve 1.3' }
    });
  });

  await t.test('1.4 : Concurrence croisée entre Validation DRH et Annulation Agent simultanées', async () => {
    const resSoumis = await app.inject({
      method: 'POST',
      url: '/api/conges/demandes',
      headers: { Authorization: `Bearer ${jetonAgentHassan}` },
      payload: {
        type_conge_id: 'tc-annuel',
        date_debut: '2026-06-20',
        date_fin: '2026-06-22',
        nombre_jours: 3.0,
        motif: 'Congé test validation vs annulation'
      }
    });
    const demId = JSON.parse(resSoumis.payload).demande.id;

    await app.inject({
      method: 'PUT',
      url: `/api/conges/demandes/${demId}/viser-chef`,
      headers: { Authorization: `Bearer ${jetonChefCC}` },
      payload: { avis: 'FAVORABLE' }
    });

    // DRH tente de valider pendant que l'agent tente d'annuler simultanément
    const [resValider, resAnnuler] = await Promise.all([
      app.inject({
        method: 'PUT',
        url: `/api/conges/demandes/${demId}/valider-rh`,
        headers: { Authorization: `Bearer ${jetonGestionnaireRH}` },
        payload: { decision: 'VALIDE', version_concurrence: 2 }
      }),
      app.inject({
        method: 'POST',
        url: `/api/conges/demandes/${demId}/annuler`,
        headers: { Authorization: `Bearer ${jetonAgentHassan}` },
        payload: { motif_annulation: 'Annulation d\'urgence simultanée' }
      })
    ]);

    // Les deux ne peuvent pas se contredire sans cohérence
    const statutCodes = [resValider.statusCode, resAnnuler.statusCode];
    assert.ok(
      statutCodes.includes(200),
      'Au moins l\'une des deux opérations doit aboutir avec succès'
    );

    // Vérification de la cohérence de l'état final en base
    const demVerif = await pool.query('SELECT statut, version_optimiste FROM demandes_conges WHERE id = $1', [demId]);
    assert.ok(
      ['VALIDE_RH', 'ANNULE'].includes(demVerif.rows[0].statut),
      `Le statut final doit être net : ${demVerif.rows[0].statut}`
    );

    // Vérification de l'invariance arithmétique stricte du solde
    const resSolde = await app.inject({
      method: 'GET',
      url: '/api/conges/soldes/agt-001',
      headers: { Authorization: `Bearer ${jetonGestionnaireRH}` }
    });
    const solde = JSON.parse(resSolde.payload).solde;
    assert.strictEqual(
      solde.jours_pris + solde.jours_en_attente + solde.jours_restants,
      solde.jours_acquis + solde.jours_reportes,
      'Solde cohérent après collision'
    );
  });

  await t.test('1.5 : Double visa simultané par Chef de Service', async () => {
    const resSoumis = await app.inject({
      method: 'POST',
      url: '/api/conges/demandes',
      headers: { Authorization: `Bearer ${jetonAgentHassan}` },
      payload: {
        type_conge_id: 'tc-annuel',
        date_debut: '2026-06-25',
        date_fin: '2026-06-26',
        nombre_jours: 2.0,
        motif: 'Congé test double visa'
      }
    });
    const demId = JSON.parse(resSoumis.payload).demande.id;

    // Deux requêtes simultanées de visa
    const [resV1, resV2] = await Promise.all([
      app.inject({
        method: 'PUT',
        url: `/api/conges/demandes/${demId}/viser-chef`,
        headers: { Authorization: `Bearer ${jetonChefCC}` },
        payload: { avis: 'FAVORABLE' }
      }),
      app.inject({
        method: 'PUT',
        url: `/api/conges/demandes/${demId}/viser-chef`,
        headers: { Authorization: `Bearer ${jetonChefCC}` },
        payload: { avis: 'FAVORABLE' }
      })
    ]);

    const codesVisa = [resV1.statusCode, resV2.statusCode].sort((a, b) => a - b);
    assert.deepStrictEqual(codesVisa, [200, 400], 'Une transaction vise avec succès (200), la concurrente est rejetée (400 statut incompatible)');

    // Nettoyage
    await app.inject({
      method: 'POST',
      url: `/api/conges/demandes/${demId}/annuler`,
      headers: { Authorization: `Bearer ${jetonAgentHassan}` },
      payload: { motif_annulation: 'Nettoyage épreuve 1.5' }
    });
  });

  await t.test('1.6 : Deux soumissions concurrentes simultanées sur les mêmes dates pour un même agent', async () => {
    // Hassan tente de soumettre simultanément deux demandes couvrant exactement les mêmes dates
    const [resSub1, resSub2] = await Promise.all([
      app.inject({
        method: 'POST',
        url: '/api/conges/demandes',
        headers: { Authorization: `Bearer ${jetonAgentHassan}` },
        payload: {
          type_conge_id: 'tc-annuel',
          date_debut: '2026-06-28',
          date_fin: '2026-06-30',
          nombre_jours: 3.0,
          motif: 'Soumission concurrente A'
        }
      }),
      app.inject({
        method: 'POST',
        url: '/api/conges/demandes',
        headers: { Authorization: `Bearer ${jetonAgentHassan}` },
        payload: {
          type_conge_id: 'tc-annuel',
          date_debut: '2026-06-28',
          date_fin: '2026-06-30',
          nombre_jours: 3.0,
          motif: 'Soumission concurrente B'
        }
      })
    ]);

    // Nettoyage de toute demande créée
    if (resSub1.statusCode === 201) {
      const d1 = JSON.parse(resSub1.payload).demande.id;
      await app.inject({
        method: 'POST',
        url: `/api/conges/demandes/${d1}/annuler`,
        headers: { Authorization: `Bearer ${jetonAgentHassan}` },
        payload: { motif_annulation: 'Nettoyage test soumission concurrente 1' }
      });
    }
    if (resSub2.statusCode === 201) {
      const d2 = JSON.parse(resSub2.payload).demande.id;
      await app.inject({
        method: 'POST',
        url: `/api/conges/demandes/${d2}/annuler`,
        headers: { Authorization: `Bearer ${jetonAgentHassan}` },
        payload: { motif_annulation: 'Nettoyage test soumission concurrente 2' }
      });
    }

    console.log(`[CHALLENGE NOTE 1.6] Statuts soumissions concurrentes: A=${resSub1.statusCode}, B=${resSub2.statusCode}`);
  });


  // ============================================================================
  // ÉPREUVE 2 : ÉPREUVE D'ANTI-AUTO-APPROBATION STRICTE (RÈGLE D'OR RÉGALIEN)
  // ============================================================================

  await t.test('2.1 : Blocage absolu HTTP 403 AUTO_APPROBATION_INTERDITE lors du visa favorable d\'un chef sur sa propre demande', async () => {
    // Commandant Farah (usr-chef-cc, agt-004) dépose une demande personnelle
    const resDemandeChef = await app.inject({
      method: 'POST',
      url: '/api/conges/demandes',
      headers: { Authorization: `Bearer ${jetonChefCC}` },
      payload: {
        type_conge_id: 'tc-annuel',
        date_debut: '2026-07-01',
        date_fin: '2026-07-05',
        nombre_jours: 5.0,
        motif: 'Congé personnel du Commandant Farah'
      }
    });
    assert.strictEqual(resDemandeChef.statusCode, 201);
    const demChefId = JSON.parse(resDemandeChef.payload).demande.id;

    // Tentative d'auto-visa favorable
    const resTentativeAuto = await app.inject({
      method: 'PUT',
      url: `/api/conges/demandes/${demChefId}/viser-chef`,
      headers: { Authorization: `Bearer ${jetonChefCC}` },
      payload: { avis: 'FAVORABLE', commentaire: 'Auto-approbation illégitime' }
    });

    assert.strictEqual(resTentativeAuto.statusCode, 403, 'Doit être rejeté avec HTTP 403 Forbidden');
    const corpsRejet = JSON.parse(resTentativeAuto.payload);
    assert.strictEqual(corpsRejet.code_erreur, 'AUTO_APPROBATION_INTERDITE');
    assert.match(corpsRejet.message, /Auto-approbation formellement interdite/i);

    // 2.2 : Vérification de la journalisation d'audit de sécurité
    const logAuditRes = await pool.query(`
      SELECT * FROM journaux_audit 
      WHERE action_type = 'TENTATIVE_AUTO_APPROBATION_BLOQUEE' 
        AND entite_id = $1
      ORDER BY id DESC LIMIT 1
    `, [demChefId]);

    assert.strictEqual(logAuditRes.rows.length, 1, 'L\'audit doit consigner l\'incident d\'auto-approbation');
    const ligneAudit = logAuditRes.rows[0];
    assert.strictEqual(ligneAudit.statut_operation, 'ECHEC_SECURITE');
    assert.strictEqual(ligneAudit.role_utilise, 'CHEF_DE_SERVICE');
    assert.strictEqual(ligneAudit.utilisateur_id, 'usr-chef-cc');

    // 2.3 : Tentative de refus de sa propre demande (doit aussi être bloquée)
    const resTentativeRefusAuto = await app.inject({
      method: 'PUT',
      url: `/api/conges/demandes/${demChefId}/viser-chef`,
      headers: { Authorization: `Bearer ${jetonChefCC}` },
      payload: { avis: 'DEFAVORABLE', motif_refus: 'Tentative d\'auto-refus' }
    });
    assert.strictEqual(resTentativeRefusAuto.statusCode, 403);
    assert.strictEqual(JSON.parse(resTentativeRefusAuto.payload).code_erreur, 'AUTO_APPROBATION_INTERDITE');

    // 2.4 : Capitaine Mohamed Kamil (usr-chef-ali, agt-003) tente également d'auto-approuver
    const resDemandeAli = await app.inject({
      method: 'POST',
      url: '/api/conges/demandes',
      headers: { Authorization: `Bearer ${jetonChefAli}` },
      payload: {
        type_conge_id: 'tc-annuel',
        date_debut: '2026-07-10',
        date_fin: '2026-07-12',
        nombre_jours: 3.0,
        motif: 'Congé personnel Chef Ali'
      }
    });
    const demAliId = JSON.parse(resDemandeAli.payload).demande.id;

    const resAliAuto = await app.inject({
      method: 'PUT',
      url: `/api/conges/demandes/${demAliId}/viser-chef`,
      headers: { Authorization: `Bearer ${jetonChefAli}` },
      payload: { avis: 'FAVORABLE' }
    });
    assert.strictEqual(resAliAuto.statusCode, 403);
    assert.strictEqual(JSON.parse(resAliAuto.payload).code_erreur, 'AUTO_APPROBATION_INTERDITE');

    // Nettoyage des deux demandes
    await app.inject({
      method: 'POST',
      url: `/api/conges/demandes/${demChefId}/annuler`,
      headers: { Authorization: `Bearer ${jetonChefCC}` },
      payload: { motif_annulation: 'Nettoyage épreuve 2' }
    });
    await app.inject({
      method: 'POST',
      url: `/api/conges/demandes/${demAliId}/annuler`,
      headers: { Authorization: `Bearer ${jetonChefAli}` },
      payload: { motif_annulation: 'Nettoyage épreuve 2' }
    });
  });

  // ============================================================================
  // ÉPREUVE 3 : ÉTANCHÉITÉ ABAC TERRITORIALE & CONTRÔLE D'ACCÈS
  // ============================================================================

  await t.test('3.1 : Rejet HTTP 403 lorsqu\'un chef de service vise une demande hors périmètre d\'unité', async () => {
    // Hassan (agt-001, U-CC-DJIB) soumet une demande
    const resDemandeHassan = await app.inject({
      method: 'POST',
      url: '/api/conges/demandes',
      headers: { Authorization: `Bearer ${jetonAgentHassan}` },
      payload: {
        type_conge_id: 'tc-annuel',
        date_debut: '2026-08-01',
        date_fin: '2026-08-04',
        nombre_jours: 4.0,
        motif: 'Congé Hassan pour test ABAC'
      }
    });
    const demId = JSON.parse(resDemandeHassan.payload).demande.id;

    // Chef Ali (U-REG-ALI) tente de viser cette demande (U-CC-DJIB)
    const resVisaAli = await app.inject({
      method: 'PUT',
      url: `/api/conges/demandes/${demId}/viser-chef`,
      headers: { Authorization: `Bearer ${jetonChefAli}` },
      payload: { avis: 'FAVORABLE' }
    });

    assert.strictEqual(resVisaAli.statusCode, 403, 'Doit être rejeté avec HTTP 403');
    const corpsAli = JSON.parse(resVisaAli.payload);
    assert.strictEqual(corpsAli.code_erreur, 'ACCES_INTERDIT');
    assert.match(corpsAli.message, /hors de votre périmètre/i);

    // 3.2 : Chef Ali tente de consulter le solde individuel d'un agent hors de son unité
    const resSoldeHorsPerimetre = await app.inject({
      method: 'GET',
      url: '/api/conges/soldes/agt-001',
      headers: { Authorization: `Bearer ${jetonChefAli}` }
    });
    assert.strictEqual(resSoldeHorsPerimetre.statusCode, 403);
    assert.strictEqual(JSON.parse(resSoldeHorsPerimetre.payload).code_erreur, 'ACCES_INTERDIT');

    // 3.3 : Chef Ali consulte la liste des demandes : la demande de Hassan ne doit pas être visible
    const resListeAli = await app.inject({
      method: 'GET',
      url: '/api/conges/demandes',
      headers: { Authorization: `Bearer ${jetonChefAli}` }
    });
    assert.strictEqual(resListeAli.statusCode, 200);
    const demandesAli = JSON.parse(resListeAli.payload).demandes;
    const demandeHassanPresente = demandesAli.some(d => d.id === demId);
    assert.strictEqual(demandeHassanPresente, false, 'Le chef ne doit voir AUCUNE demande hors de son unité');

    // 3.4 : Agent Hassan tente de viser une demande (usurpation de rôle hiérarchique)
    const resHassanVise = await app.inject({
      method: 'PUT',
      url: `/api/conges/demandes/${demId}/viser-chef`,
      headers: { Authorization: `Bearer ${jetonAgentHassan}` },
      payload: { avis: 'FAVORABLE' }
    });
    assert.strictEqual(resHassanVise.statusCode, 403, 'Agent simple refoulé par RBAC sur endpoint chef');

    // 3.5 : Agent Hassan tente de valider en tant que DRH
    const resHassanValide = await app.inject({
      method: 'PUT',
      url: `/api/conges/demandes/${demId}/valider-rh`,
      headers: { Authorization: `Bearer ${jetonAgentHassan}` },
      payload: { decision: 'VALIDE' }
    });
    assert.strictEqual(resHassanValide.statusCode, 403, 'Agent simple refoulé par RBAC sur endpoint DRH');

    // 3.6 : Agent Hassan tente de consulter le solde d'un collègue (agt-002)
    const resSoldeTiers = await app.inject({
      method: 'GET',
      url: '/api/conges/soldes/agt-002',
      headers: { Authorization: `Bearer ${jetonAgentHassan}` }
    });
    assert.strictEqual(resSoldeTiers.statusCode, 403, 'Un agent ne peut pas consulter le solde d\'un tiers');
    assert.match(JSON.parse(resSoldeTiers.payload).message, /propre dossier/i);

    // 3.7 : Admin Technique formellement refoulé de tous les endpoints nominatifs
    const [resTechSoldes, resTechDemandes, resTechStats, resTechPost] = await Promise.all([
      app.inject({ method: 'GET', url: '/api/conges/soldes', headers: { Authorization: `Bearer ${jetonAdminTech}` } }),
      app.inject({ method: 'GET', url: '/api/conges/demandes', headers: { Authorization: `Bearer ${jetonAdminTech}` } }),
      app.inject({ method: 'GET', url: '/api/conges/statistiques', headers: { Authorization: `Bearer ${jetonAdminTech}` } }),
      app.inject({
        method: 'POST',
        url: '/api/conges/demandes',
        headers: { Authorization: `Bearer ${jetonAdminTech}` },
        payload: { type_conge_id: 'tc-annuel', date_debut: '2026-08-10', date_fin: '2026-08-12' }
      })
    ]);

    assert.strictEqual(resTechSoldes.statusCode, 403);
    assert.strictEqual(resTechDemandes.statusCode, 403);
    assert.strictEqual(resTechStats.statusCode, 403);
    assert.strictEqual(resTechPost.statusCode, 403);

    // Nettoyage
    await app.inject({
      method: 'POST',
      url: `/api/conges/demandes/${demId}/annuler`,
      headers: { Authorization: `Bearer ${jetonAgentHassan}` },
      payload: { motif_annulation: 'Nettoyage épreuve 3' }
    });
  });

  // ============================================================================
  // ÉPREUVE 4 : ÉPREUVE DE REFUS ET ANNULATION SANS MOTIF (MOTIF VIDE OU ABSENT)
  // ============================================================================

  await t.test('4.1 : Rejet formel HTTP 400 sur refus ou annulation sans motif explicite', async () => {
    // 1. Dépôt d'une demande par Hassan
    const resSoumis = await app.inject({
      method: 'POST',
      url: '/api/conges/demandes',
      headers: { Authorization: `Bearer ${jetonAgentHassan}` },
      payload: {
        type_conge_id: 'tc-annuel',
        date_debut: '2026-09-01',
        date_fin: '2026-09-04',
        nombre_jours: 4.0,
        motif: 'Demande pour test de refus sans motif'
      }
    });
    const demId = JSON.parse(resSoumis.payload).demande.id;

    // 4.1.a : Chef refuse avec chaîne vide
    const resRefusVide = await app.inject({
      method: 'PUT',
      url: `/api/conges/demandes/${demId}/viser-chef`,
      headers: { Authorization: `Bearer ${jetonChefCC}` },
      payload: { avis: 'DEFAVORABLE', motif_refus: '' }
    });
    assert.strictEqual(resRefusVide.statusCode, 400);
    assert.strictEqual(JSON.parse(resRefusVide.payload).code_erreur, 'MOTIF_REFUS_OBLIGATOIRE');

    // 4.1.b : Chef refuse avec espaces blancs uniquement
    const resRefusEspaces = await app.inject({
      method: 'PUT',
      url: `/api/conges/demandes/${demId}/viser-chef`,
      headers: { Authorization: `Bearer ${jetonChefCC}` },
      payload: { avis: 'DEFAVORABLE', motif_refus: '     ' }
    });
    assert.strictEqual(resRefusEspaces.statusCode, 400);
    assert.strictEqual(JSON.parse(resRefusEspaces.payload).code_erreur, 'MOTIF_REFUS_OBLIGATOIRE');

    // 4.1.c : Chef refuse sans propriété motif_refus
    const resRefusOmission = await app.inject({
      method: 'PUT',
      url: `/api/conges/demandes/${demId}/viser-chef`,
      headers: { Authorization: `Bearer ${jetonChefCC}` },
      payload: { avis: 'DEFAVORABLE' }
    });
    assert.strictEqual(resRefusOmission.statusCode, 400);
    assert.strictEqual(JSON.parse(resRefusOmission.payload).code_erreur, 'MOTIF_REFUS_OBLIGATOIRE');

    // Vérification que la demande est TOUJOURS au statut SOUMIS
    const demVerif1 = await pool.query('SELECT statut FROM demandes_conges WHERE id = $1', [demId]);
    assert.strictEqual(demVerif1.rows[0].statut, 'SOUMIS', 'Le statut doit rester inchangé');

    // Visa chef favorable pour tester ensuite le refus DRH
    await app.inject({
      method: 'PUT',
      url: `/api/conges/demandes/${demId}/viser-chef`,
      headers: { Authorization: `Bearer ${jetonChefCC}` },
      payload: { avis: 'FAVORABLE' }
    });

    // 4.1.d : DRH refuse avec chaîne vide
    const resRefusRHVide = await app.inject({
      method: 'PUT',
      url: `/api/conges/demandes/${demId}/valider-rh`,
      headers: { Authorization: `Bearer ${jetonGestionnaireRH}` },
      payload: { decision: 'REFUS', motif_refus: '', version_concurrence: 2 }
    });
    assert.strictEqual(resRefusRHVide.statusCode, 400);
    assert.strictEqual(JSON.parse(resRefusRHVide.payload).code_erreur, 'MOTIF_REFUS_OBLIGATOIRE');

    // 4.1.e : DRH refuse avec espaces seuls
    const resRefusRHEspaces = await app.inject({
      method: 'PUT',
      url: `/api/conges/demandes/${demId}/valider-rh`,
      headers: { Authorization: `Bearer ${jetonGestionnaireRH}` },
      payload: { decision: 'REFUS', motif_refus: '   \t  ', version_concurrence: 2 }
    });
    assert.strictEqual(resRefusRHEspaces.statusCode, 400);
    assert.strictEqual(JSON.parse(resRefusRHEspaces.payload).code_erreur, 'MOTIF_REFUS_OBLIGATOIRE');

    // 4.1.f : Annulation avec motif vide
    const resAnnulVide = await app.inject({
      method: 'POST',
      url: `/api/conges/demandes/${demId}/annuler`,
      headers: { Authorization: `Bearer ${jetonAgentHassan}` },
      payload: { motif_annulation: '' }
    });
    assert.strictEqual(resAnnulVide.statusCode, 400);
    assert.strictEqual(JSON.parse(resAnnulVide.payload).code_erreur, 'MOTIF_ANNULATION_OBLIGATOIRE');

    // 4.1.g : Annulation avec espaces seuls
    const resAnnulEspaces = await app.inject({
      method: 'POST',
      url: `/api/conges/demandes/${demId}/annuler`,
      headers: { Authorization: `Bearer ${jetonAgentHassan}` },
      payload: { motif_annulation: '     ' }
    });
    assert.strictEqual(resAnnulEspaces.statusCode, 400);
    assert.strictEqual(JSON.parse(resAnnulEspaces.payload).code_erreur, 'MOTIF_ANNULATION_OBLIGATOIRE');

    // Annulation en règle avec motif circonstancié
    const resAnnulOk = await app.inject({
      method: 'POST',
      url: `/api/conges/demandes/${demId}/annuler`,
      headers: { Authorization: `Bearer ${jetonAgentHassan}` },
      payload: { motif_annulation: 'Régularisation après tests de robustesse motifs' }
    });
    assert.strictEqual(resAnnulOk.statusCode, 200);
    assert.strictEqual(JSON.parse(resAnnulOk.payload).demande.statut, 'ANNULE');
  });

  // ============================================================================
  // ÉPREUVE 5 : LINÉARITÉ & INTÉGRITÉ DE LA CHAÎNE D'AUDIT SOUS CONCURRENCE
  // ============================================================================

  await t.test('5.1 : 40 écritures d\'audit hautement concurrentes (pg_advisory_xact_lock)', async () => {
    const NOMBRE_WRITERS = 40;
    const promises = [];

    for (let i = 0; i < NOMBRE_WRITERS; i++) {
      promises.push(
        auditService.enregistrer({
          utilisateur_id: 'usr-rh-01',
          nom_utilisateur: 'Yassin Barkat',
          role_utilise: 'GESTIONNAIRE_RH',
          adresse_ip: '10.20.30.40',
          action_type: 'TEST_STRESS_CHALLENGER_M2',
          entite_cible: 'AUDIT_CONCURRENCE',
          entite_id: `m2-stress-${i}`,
          details_operation_json: { lot: 'M2', iter: i, timestamp: Date.now() },
          statut_operation: 'SUCCES'
        })
      );
    }

    const resultats = await Promise.all(promises);
    assert.strictEqual(resultats.length, NOMBRE_WRITERS);

    // Vérification de la stricte consécutivité des identifiants sans trou ni saut
    const ids = resultats.map(r => Number(r.id)).sort((a, b) => a - b);
    for (let i = 1; i < ids.length; i++) {
      assert.strictEqual(ids[i], ids[i - 1] + 1, `Les identifiants doivent être consécutifs : ${ids[i-1]} -> ${ids[i]}`);
    }

    // Vérification que les hashes sont bien chaînés entre eux
    const resLogs = await pool.query(`
      SELECT id, empreinte_precedente, empreinte_courante 
      FROM journaux_audit 
      WHERE id >= $1 AND id <= $2 
      ORDER BY id ASC
    `, [ids[0], ids[ids.length - 1]]);

    const logs = resLogs.rows;
    for (let i = 1; i < logs.length; i++) {
      assert.strictEqual(
        logs[i].empreinte_precedente,
        logs[i - 1].empreinte_courante,
        `Rupture de chaîne détectée entre log ${logs[i-1].id} et log ${logs[i].id}`
      );
    }

    // Vérification cryptographique globale sur l'intégralité de la base
    const verification = await auditService.verifierIntegriteChaine();
    assert.strictEqual(verification.valid, true, 'La chaîne cryptographique complète doit être 100% valide');
    assert.strictEqual(verification.errors.length, 0, 'Aucune anomalie ou altération détectée dans le journal');
  });

  // ============================================================================
  // ÉPREUVE 6 : INJECTIONS, ENTRÉES MALVEILLANTES & BORNES ADVERSARIALES
  // ============================================================================

  await t.test('6.1 : Résistance absolue aux injections SQL, XSS et formats aberrants', async () => {
    // 6.1.a : Injection SQL dans le motif de demande
    const motifInject = "'; DROP TABLE demandes_conges; SELECT '1'='1";
    const resSqlMotif = await app.inject({
      method: 'POST',
      url: '/api/conges/demandes',
      headers: { Authorization: `Bearer ${jetonAgentHassan}` },
      payload: {
        type_conge_id: 'tc-annuel',
        date_debut: '2026-10-01',
        date_fin: '2026-10-02',
        nombre_jours: 2.0,
        motif: motifInject
      }
    });
    assert.strictEqual(resSqlMotif.statusCode, 201, 'Requête acceptée sans exécution de l\'injection SQL');
    const demInjId = JSON.parse(resSqlMotif.payload).demande.id;

    // Vérification que la table existe toujours et que le motif est stocké littéralement
    const verifDb = await pool.query('SELECT motif FROM demandes_conges WHERE id = $1', [demInjId]);
    assert.strictEqual(verifDb.rows[0].motif, motifInject);

    // Nettoyage
    await app.inject({
      method: 'POST',
      url: `/api/conges/demandes/${demInjId}/annuler`,
      headers: { Authorization: `Bearer ${jetonAgentHassan}` },
      payload: { motif_annulation: 'Nettoyage épreuve 6.1.a' }
    });

    // 6.1.b : Date invalide non conforme
    const resDateInvalide = await app.inject({
      method: 'POST',
      url: '/api/conges/demandes',
      headers: { Authorization: `Bearer ${jetonAgentHassan}` },
      payload: {
        type_conge_id: 'tc-annuel',
        date_debut: 'date-corrompue',
        date_fin: '2026-10-10',
        nombre_jours: 2.0
      }
    });
    assert.strictEqual(resDateInvalide.statusCode, 400);
    assert.strictEqual(JSON.parse(resDateInvalide.payload).code_erreur, 'DATE_INVALIDE');

    // 6.1.c : Décision DRH aberrante (hors VALIDE/REFUS/APPROUVE/REFUSE)
    const resDecisionAberrante = await app.inject({
      method: 'PUT',
      url: `/api/conges/demandes/non-existant/valider-rh`,
      headers: { Authorization: `Bearer ${jetonGestionnaireRH}` },
      payload: { decision: 'VALIDE_DE_FORCE_PAR_HACKER' }
    });
    assert.strictEqual(resDecisionAberrante.statusCode, 400);
    assert.strictEqual(JSON.parse(resDecisionAberrante.payload).code_erreur, 'DECISION_INVALIDE');

    // 6.1.d : Avis chef aberrant
    const resAvisAberrant = await app.inject({
      method: 'PUT',
      url: `/api/conges/demandes/non-existant/viser-chef`,
      headers: { Authorization: `Bearer ${jetonChefCC}` },
      payload: { avis: 'INCERTAIN' }
    });
    assert.strictEqual(resAvisAberrant.statusCode, 400);
    assert.strictEqual(JSON.parse(resAvisAberrant.payload).code_erreur, 'AVIS_INVALIDE');

    // 6.1.e : Demande avec solde colossal dépassant le quota
    const resSoldeColossal = await app.inject({
      method: 'POST',
      url: '/api/conges/demandes',
      headers: { Authorization: `Bearer ${jetonAgentHassan}` },
      payload: {
        type_conge_id: 'tc-annuel',
        date_debut: '2026-11-01',
        date_fin: '2026-11-30',
        nombre_jours: 9999.0
      }
    });
    assert.strictEqual(resSoldeColossal.statusCode, 400);
    assert.strictEqual(JSON.parse(resSoldeColossal.payload).code_erreur, 'SOLDE_INSUFFISANT');
  });
});

