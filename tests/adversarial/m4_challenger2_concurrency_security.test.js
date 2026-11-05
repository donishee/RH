const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

// Résolution dynamique du serveur et de la couche base de données
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

test('CHALLENGER M4-2 : Épreuves Adversariales de Concurrence, Idempotence, Injections & Cloisonnement Disciplinaire', async (t) => {
  let app;
  let jetonGestionnaireRH;
  let jetonChefCC;
  let jetonChefAli;
  let jetonAgentHassan;
  let jetonAdminTech;
  let jetonAdminFonc;
  let jetonAuditeur;

  const prefixTest = 'adv42';

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
      assert.strictEqual(res.statusCode, 200, `Échec connexion pour ${identifiant}`);
      return JSON.parse(res.payload).jeton;
    };

    jetonGestionnaireRH = await login('gestionnaire_rh');
    jetonChefCC = await login('chef_cc');
    jetonChefAli = await login('chef_ali');
    jetonAgentHassan = await login('agent_hassan');
    jetonAdminTech = await login('admin_tech');
    jetonAdminFonc = await login('admin_fonc');
    jetonAuditeur = await login('auditeur');

    // Nettoyage préventif
    await pool.query(`
      DELETE FROM remplacements_gardes WHERE id LIKE '${prefixTest}%' OR planning_vacation_id LIKE '${prefixTest}%' OR date_remplacement >= '2026-11-20';
      DELETE FROM plannings_vacations WHERE id LIKE '${prefixTest}%' OR motif_modification LIKE '%${prefixTest}%' OR date_debut >= '2026-11-20'::timestamptz;
      DELETE FROM aptitudes_administratives WHERE numero_certificat_administratif LIKE '%${prefixTest}%' OR id LIKE '${prefixTest}%';
      DELETE FROM sanctions_disciplinaires WHERE reference_arrete LIKE '%${prefixTest}%' OR id LIKE '${prefixTest}%';
      DELETE FROM dossiers_disciplinaires WHERE numero_dossier LIKE '%${prefixTest}%' OR id LIKE '${prefixTest}%';
      DELETE FROM documents_generes WHERE reference_document LIKE '%${prefixTest}%' OR id LIKE '${prefixTest}%';
    `).catch(() => {});
  });

  t.after(async () => {
    try {
      await pool.query(`
        DELETE FROM remplacements_gardes WHERE id LIKE '${prefixTest}%' OR planning_vacation_id LIKE '${prefixTest}%' OR date_remplacement >= '2026-11-20';
        DELETE FROM plannings_vacations WHERE id LIKE '${prefixTest}%' OR motif_modification LIKE '%${prefixTest}%' OR date_debut >= '2026-11-20'::timestamptz;
        DELETE FROM aptitudes_administratives WHERE numero_certificat_administratif LIKE '%${prefixTest}%' OR id LIKE '${prefixTest}%';
        DELETE FROM sanctions_disciplinaires WHERE reference_arrete LIKE '%${prefixTest}%' OR id LIKE '${prefixTest}%';
        DELETE FROM dossiers_disciplinaires WHERE numero_dossier LIKE '%${prefixTest}%' OR id LIKE '${prefixTest}%';
        DELETE FROM documents_generes WHERE reference_document LIKE '%${prefixTest}%' OR id LIKE '${prefixTest}%';
      `);
    } catch {}
    if (app) await app.close();
    if (fermerPool && !pool?.ending && !pool?.ended) {
      await fermerPool().catch(() => {});
    }
  });

  // ==========================================================================
  // SECTION 1 : CONCURRENCE & IDEMPOTENCE OPÉRATIONNELLE
  // ==========================================================================

  await t.test('1.1 Concurrence : Remplacement simultané sur une même vacation (Race Condition Attack)', async () => {
    // 1. Créer une vacation cible pour agt-001
    const resVac = await app.inject({
      method: 'POST',
      url: '/api/plannings',
      headers: { authorization: `Bearer ${jetonChefCC}` },
      payload: {
        agent_id: 'agt-001',
        poste_operationnel_id: 'pop-003',
        type_vacation: '3x8_matin',
        date_debut: '2026-11-23T06:00:00Z',
        date_fin: '2026-11-23T14:00:00Z',
        motif_modification: `${prefixTest} - vacation cible remplacement concurrent`
      }
    });
    assert.strictEqual(resVac.statusCode, 201, 'La vacation cible doit être créée');
    const vacationId = JSON.parse(resVac.payload).vacation.id;

    // 2. Déclencher 20 requêtes de remplacement strictement parallèles sur cette même vacation
    const nbRequetes = 20;
    const promesses = Array.from({ length: nbRequetes }).map((_, i) =>
      app.inject({
        method: 'POST',
        url: '/api/remplacements/ordonner',
        headers: { authorization: `Bearer ${jetonChefCC}` },
        payload: {
          planning_vacation_id: vacationId,
          agent_remplacant_id: 'agt-004',
          motif: 'urgence',
          commentaire: `Tentative de remplacement concurrent #${i} - ${prefixTest}`
        }
      })
    );

    const resultats = await Promise.all(promesses);

    // 3. Analyser les codes de statut
    let succesCount = 0;
    let conflitCount = 0;
    let autresErreurs = 0;

    for (const res of resultats) {
      if (res.statusCode === 201) {
        succesCount++;
      } else if (res.statusCode === 409) {
        conflitCount++;
        const corps = JSON.parse(res.payload);
        assert.strictEqual(corps.code_erreur, 'DEJA_REMPLACE');
      } else {
        autresErreurs++;
      }
    }

    assert.strictEqual(succesCount, 1, `Exactement 1 remplacement doit réussir (obtenu: ${succesCount})`);
    assert.strictEqual(conflitCount, nbRequetes - 1, `Les ${nbRequetes - 1} autres requêtes doivent être rejetées par HTTP 409 DEJA_REMPLACE`);
    assert.strictEqual(autresErreurs, 0, 'Aucun crash HTTP 500 ou erreur inattendue');

    // 4. Vérification physique en base de données
    const checkRemp = await pool.query(
      'SELECT count(*) AS total FROM remplacements_gardes WHERE planning_vacation_id = $1',
      [vacationId]
    );
    assert.strictEqual(parseInt(checkRemp.rows[0].total, 10), 1, 'Il ne doit exister qu une seule ligne de remplacement en base');

    const checkVacInit = await pool.query(
      'SELECT statut FROM plannings_vacations WHERE id = $1',
      [vacationId]
    );
    assert.strictEqual(checkVacInit.rows[0].statut, 'remplace');
  });

  await t.test('1.2 Idempotence : Enregistrements multiples du même certificat d aptitude (UPSERT séquentiel & concurrent)', async () => {
    const numCert = `CERT-ADM-${prefixTest}-999`;

    // 1. Enregistrement séquentiel 10 fois avec mise à jour du texte et échéance
    for (let i = 1; i <= 10; i++) {
      const resApt = await app.inject({
        method: 'POST',
        url: '/api/aptitude',
        headers: { authorization: `Bearer ${jetonGestionnaireRH}` },
        payload: {
          agent_id: 'agt-003',
          numero_certificat: numCert,
          decision_aptitude: 'AMENAGEMENT_POSTE',
          type_conclusion: 'APTE_AVEC_RESTRICTIONS',
          code_restriction: 'POSTE_SEDENTAIRE',
          restriction_operationnelle: `Restriction aménagée itération ${i} - ${prefixTest}`,
          date_decision: '2026-03-01',
          date_echeance: `2026-09-${String(i).padStart(2, '0')}`
        }
      });

      assert.strictEqual(resApt.statusCode, 201, `L itération séquentielle #${i} doit réussir en HTTP 201 via UPSERT`);
      const corps = JSON.parse(resApt.payload);
      assert.strictEqual(corps.statut, 'SUCCES');
      assert.strictEqual(corps.aptitude.numero_certificat_administratif, numCert);
    }

    // Vérifier qu'une seule ligne existe en base
    const resCountSeq = await pool.query(
      'SELECT count(*) AS total, restriction_operationnelle, date_echeance FROM aptitudes_administratives WHERE numero_certificat_administratif = $1 GROUP BY restriction_operationnelle, date_echeance',
      [numCert]
    );
    assert.strictEqual(resCountSeq.rows.length, 1);
    assert.strictEqual(resCountSeq.rows[0].total, '1');
    assert.match(resCountSeq.rows[0].restriction_operationnelle, /itération 10/);

    // 2. Enregistrement concurrent 15 fois en parallèle sur un autre certificat
    const numCertConc = `CERT-ADM-${prefixTest}-CONC`;
    const promessesConc = Array.from({ length: 15 }).map((_, idx) =>
      app.inject({
        method: 'POST',
        url: '/api/aptitude',
        headers: { authorization: `Bearer ${jetonGestionnaireRH}` },
        payload: {
          agent_id: 'agt-002',
          numero_certificat: numCertConc,
          decision_aptitude: 'AMENAGEMENT_POSTE',
          type_conclusion: 'APTE_AVEC_RESTRICTIONS',
          code_restriction: 'EXEMPTION_EFFORT_INTENSE',
          restriction_operationnelle: `Exemption concitoyenne concurr #${idx} - ${prefixTest}`,
          date_decision: '2026-03-15',
          date_echeance: '2026-10-15'
        }
      })
    );

    const resConc = await Promise.all(promessesConc);
    for (const r of resConc) {
      assert.strictEqual(r.statusCode, 201, 'Toutes les requêtes concurrentes doivent aboutir en 201 via UPSERT');
    }

    const resCountConc = await pool.query(
      'SELECT count(*) AS total FROM aptitudes_administratives WHERE numero_certificat_administratif = $1',
      [numCertConc]
    );
    assert.strictEqual(parseInt(resCountConc.rows[0].total, 10), 1, 'Une seule ligne finale doit exister pour le certificat concurrent');
  });

  await t.test('1.3 Concurrence & Volumétrie : Plannings opérationnels 24/7 (30 créations parallèles et consultations simultanées)', async () => {
    // Jours pairs de décembre 2026 : de 06h à 14h
    const joursPairs = [2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30];

    // Création concurrente des vacations pour agt-001
    const promessesCreations = joursPairs.map(j => {
      const jourStr = String(j).padStart(2, '0');
      return app.inject({
        method: 'POST',
        url: '/api/plannings',
        headers: { authorization: `Bearer ${jetonChefCC}` },
        payload: {
          agent_id: 'agt-001',
          poste_operationnel_id: 'pop-003',
          type_vacation: '3x8_matin',
          date_debut: `2026-12-${jourStr}T06:00:00Z`,
          date_fin: `2026-12-${jourStr}T14:00:00Z`,
          motif_modification: `${prefixTest} - charge volumétrique jour ${j}`
        }
      });
    });

    // En même temps, lancer 15 requêtes simultanées de consultation
    const promessesLectures = Array.from({ length: 15 }).map((_, i) =>
      app.inject({
        method: 'GET',
        url: `/api/plannings?unite_id=U-CC-DJIB&date_debut=2026-12-01&date_fin=2026-12-31&statut=planifie`,
        headers: { authorization: `Bearer ${jetonChefCC}` }
      })
    );

    const [resCreations, resLectures] = await Promise.all([
      Promise.all(promessesCreations),
      Promise.all(promessesLectures)
    ]);

    for (const r of resCreations) {
      assert.strictEqual(r.statusCode, 201, 'Chaque vacation planifiée sur jour pair doit être créée avec succès');
    }

    for (const r of resLectures) {
      assert.strictEqual(r.statusCode, 200, 'Les consultations concurrentes doivent toutes répondre en 200 sans deadlock');
      const corps = JSON.parse(r.payload);
      assert.strictEqual(corps.statut, 'SUCCES');
      assert.ok(Array.isArray(corps.plannings));
    }

    // Vérifier le total en base
    const resTot = await pool.query(
      `SELECT count(*) AS total FROM plannings_vacations WHERE agent_id = 'agt-001' AND date_debut >= '2026-12-01' AND date_fin <= '2026-12-31'`
    );
    assert.strictEqual(parseInt(resTot.rows[0].total, 10), joursPairs.length);
  });

  await t.test('1.4 Anti-Chevauchement : Concurrence de 10 requêtes sur le même créneau horaire pour un même agent', async () => {
    // Utiliser un agent distinct (agt-004) pour isoler rigoureusement le créneau de test
    await pool.query(
      `DELETE FROM plannings_vacations WHERE agent_id = 'agt-004' AND date_debut >= '2026-12-11T00:00:00Z' AND date_fin <= '2026-12-11T23:59:59Z'`
    );

    // 10 requêtes tentant de créer EXACTEMENT la même vacation (2026-12-11T08:00:00Z à 16:00:00Z) pour agt-004
    const promessesCollision = Array.from({ length: 10 }).map((_, i) =>
      app.inject({
        method: 'POST',
        url: '/api/plannings',
        headers: { authorization: `Bearer ${jetonChefCC}` },
        payload: {
          agent_id: 'agt-004',
          type_vacation: 'permanence',
          date_debut: '2026-12-11T08:00:00Z',
          date_fin: '2026-12-11T16:00:00Z',
          motif_modification: `${prefixTest} - collision concurrentielle #${i}`
        }
      })
    );

    const resCollision = await Promise.all(promessesCollision);

    let reussis = 0;
    let bloquesChevauchement = 0;

    for (const res of resCollision) {
      if (res.statusCode === 201) {
        reussis++;
      } else if (res.statusCode === 400) {
        const corps = JSON.parse(res.payload);
        if (corps.code_erreur === 'CHEVOUCHEMENT_DETECTE') {
          bloquesChevauchement++;
        }
      }
    }

    assert.strictEqual(reussis, 1, `Exactement 1 vacation doit être acceptée (obtenu: ${reussis})`);
    assert.strictEqual(bloquesChevauchement, 9, `Les 9 autres doivent être bloquées pour CHEVOUCHEMENT_DETECTE (obtenu: ${bloquesChevauchement})`);

    // Vérifier en base qu'une seule ligne a été insérée
    const checkNb = await pool.query(
      `SELECT count(*) AS total FROM plannings_vacations WHERE agent_id = 'agt-004' AND date_debut = '2026-12-11T08:00:00Z'`
    );
    assert.strictEqual(parseInt(checkNb.rows[0].total, 10), 1);
  });

  // ==========================================================================
  // SECTION 2 : RÉSILIENCE FACE AUX ENTRÉES MALFORMÉES & INJECTIONS SQL
  // ==========================================================================

  await t.test('2.1 Injections SQL dans les filtres de consultation des plannings (paramétrisation stricte)', async () => {
    // 1. Injections sur paramètres textuels (unite_id, agent_id, statut)
    const injectionsTextuelles = [
      { param: 'unite_id', valeur: "' OR 1=1 --" },
      { param: 'unite_id', valeur: "U-CC-DJIB' UNION SELECT * FROM utilisateurs --" },
      { param: 'agent_id', valeur: "' OR '1'='1" },
      { param: 'agent_id', valeur: "agt-001'; DROP TABLE plannings_vacations; --" },
      { param: 'statut', valeur: "' OR statut IS NOT NULL --" },
      { param: 'statut', valeur: "planifie' AND pg_sleep(2) --" }
    ];

    for (const inj of injectionsTextuelles) {
      const debutMs = Date.now();
      const res = await app.inject({
        method: 'GET',
        url: `/api/plannings?${inj.param}=${encodeURIComponent(inj.valeur)}`,
        headers: { authorization: `Bearer ${jetonGestionnaireRH}` }
      });
      const dureeMs = Date.now() - debutMs;

      // Requêtes paramétrées : pas de SQL injection, réponse HTTP 200 avec 0 ligne ou liste filtrée, jamais de délai pg_sleep
      assert.strictEqual(res.statusCode, 200, `Injection textuelle sur ${inj.param} doit être neutralisée et retourner HTTP 200`);
      assert.ok(dureeMs < 1000, `L'injection pg_sleep ne doit pas être exécutée (durée: ${dureeMs}ms)`);
      const corps = JSON.parse(res.payload);
      assert.strictEqual(corps.statut, 'SUCCES');
      for (const pl of corps.plannings) {
        assert.ok(pl.id, 'Chaque élément doit être une vacation');
        assert.strictEqual(typeof pl.agent_id, 'string');
      }
    }

    // 2. Injections sur paramètres de date (rejetées au niveau du parseur timestamp de PostgreSQL)
    const injectionsDates = [
      { param: 'date_debut', valeur: "2026-01-01' OR date_fin >= '2026-01-01" },
      { param: 'date_fin', valeur: "2026-12-31'; DELETE FROM agents; --" }
    ];

    for (const inj of injectionsDates) {
      const res = await app.inject({
        method: 'GET',
        url: `/api/plannings?${inj.param}=${encodeURIComponent(inj.valeur)}`,
        headers: { authorization: `Bearer ${jetonGestionnaireRH}` }
      });

      // Le driver PostgreSQL rejette la syntaxe de date sans exécuter de commande SQL
      // Le serveur répond par une erreur 500 contrôlée sans fuite d'injection
      assert.strictEqual(res.statusCode, 500);
      const corps = JSON.parse(res.payload);
      assert.strictEqual(corps.statut, 'ERREUR');
      assert.strictEqual(corps.code_erreur, 'ERREUR_INTERNE_SERVEUR');
      assert.match(corps.message, /invalid input syntax for type timestamp/);
    }

    // Vérifier que la table plannings_vacations et la table agents existent toujours et sont intactes
    const checkPlannings = await pool.query('SELECT count(*) FROM plannings_vacations');
    assert.ok(parseInt(checkPlannings.rows[0].count, 10) > 0);
    const checkAgents = await pool.query('SELECT count(*) FROM agents');
    assert.ok(parseInt(checkAgents.rows[0].count, 10) > 0);
  });

  await t.test('2.2 Charges atypiques et injection SQL dans les dossiers disciplinaires et sanctions', async () => {
    // 1. Description contenant balises XSS, SQL injection et caractères arabes
    const descriptionAtypique = `Attaque XSS <script>alert('pwn')</script> & SQL '; DROP TABLE dossiers_disciplinaires; -- غياب غير مبرر`;

    const resDos = await app.inject({
      method: 'POST',
      url: '/api/discipline/dossiers',
      headers: { authorization: `Bearer ${jetonGestionnaireRH}` },
      payload: {
        agent_id: 'agt-002',
        date_faits: '2026-02-18',
        description_sommaire: `${prefixTest} - ${descriptionAtypique}`,
        description_faits: `Détails complexes avec guillemets simples ' et doubles " et anti-slash \\`,
        phase_procedure: 'ALLEGATION'
      }
    });

    assert.strictEqual(resDos.statusCode, 201, 'Le dossier avec charge atypique doit être créé fidèlement sans injection');
    const corpsDos = JSON.parse(resDos.payload);
    assert.strictEqual(corpsDos.statut, 'SUCCES');
    const dossierId = corpsDos.dossier.id;

    // Vérifier en base que la description a été conservée textuellement sans altérer la table
    const checkDos = await pool.query('SELECT description_sommaire FROM dossiers_disciplinaires WHERE id = $1', [dossierId]);
    assert.strictEqual(checkDos.rows[0].description_sommaire, `${prefixTest} - ${descriptionAtypique}`);

    // 2. Prononcé de sanction avec arrêté malveillant
    const arreteMalveillant = `ARR-DISC-${prefixTest}'; UPDATE agents SET grade_actuel='Général' WHERE id='agt-002'; --`;
    const resSanc = await app.inject({
      method: 'POST',
      url: '/api/discipline/sanctions',
      headers: { authorization: `Bearer ${jetonGestionnaireRH}` },
      payload: {
        dossier_id: dossierId,
        groupe_sanction: 'GROUPE_1',
        nature_sanction: 'blame',
        date_effet: '2026-03-01',
        reference_arrete: arreteMalveillant,
        prononcee_par: 'Commission de Discipline',
        motif_sanction: `Motif avec caractères spéciaux: %_#@!$^&*() & texte arabe قرار تأديبي`
      }
    });

    assert.strictEqual(resSanc.statusCode, 201, 'La sanction doit être enregistrée sans exécution du payload SQL');
    const corpsSanc = JSON.parse(resSanc.payload);
    assert.strictEqual(corpsSanc.sanction.reference_arrete, arreteMalveillant);

    // Vérifier que le grade de agt-002 n'a PAS été modifié par l'injection SQL
    const checkGrade = await pool.query('SELECT grade_actuel FROM agents WHERE id = $1', ['agt-002']);
    assert.notStrictEqual(checkGrade.rows[0].grade_actuel, 'Général', 'Le grade de l agent ne doit pas avoir été piraté');
  });

  await t.test('2.3 Résilience face aux dates et formats malformés', async () => {
    const datesInvalides = [
      { debut: 'invalid-date', fin: '2026-11-10T14:00:00Z' },
      { debut: '2026-11-10T14:00:00Z', fin: 'invalid-date' },
      { debut: '2026-11-10T14:00:00Z', fin: '2026-11-10T06:00:00Z' }, // fin antérieure au début
      { debut: '2026-11-10T06:00:00Z', fin: '2026-11-10T06:00:00Z' }  // durée 0
    ];

    for (const d of datesInvalides) {
      const res = await app.inject({
        method: 'POST',
        url: '/api/plannings',
        headers: { authorization: `Bearer ${jetonChefCC}` },
        payload: {
          agent_id: 'agt-001',
          type_vacation: '3x8_matin',
          date_debut: d.debut,
          date_fin: d.fin
        }
      });

      assert.strictEqual(res.statusCode, 400, `La plage ${d.debut} -> ${d.fin} doit être rejetée par HTTP 400`);
      const corps = JSON.parse(res.payload);
      assert.strictEqual(corps.statut, 'ERREUR');
      assert.ok(corps.code_erreur === 'PARAMETRES_INVALIDES' || corps.code_erreur === 'DUREE_VACATION_INVALIDE');
    }
  });

  // ==========================================================================
  // SECTION 3 : CLOISONNEMENT DISCIPLINAIRE & APTITUDE ADMINISTRATIVE
  // ==========================================================================

  await t.test('3.1 Cloisonnement disciplinaire absolu : Exclusion de TOUS les profils non-habilités sur tous les verbes HTTP', async () => {
    // Les profils qui ne doivent JAMAIS avoir accès à la discipline:
    const profilsInterdits = [
      { nom: 'Admin Technique', jeton: jetonAdminTech },
      { nom: 'Admin Fonctionnel', jeton: jetonAdminFonc },
      { nom: 'Chef Commissariat Central', jeton: jetonChefCC },
      { nom: 'Chef Région Ali-Sabieh', jeton: jetonChefAli },
      { nom: 'Agent Simple Hassan', jeton: jetonAgentHassan },
      { nom: 'Auditeur', jeton: jetonAuditeur }
    ];

    // Endpoints disciplinaires à vérifier
    const endpointsDiscipline = [
      { method: 'GET', url: '/api/discipline/dossiers' },
      { method: 'GET', url: '/api/discipline/dossiers/dos-disc-001' },
      { method: 'POST', url: '/api/discipline/dossiers', payload: { agent_id: 'agt-001', date_faits: '2026-01-01', description_sommaire: 'test' } },
      { method: 'PUT', url: '/api/discipline/dossiers/dos-disc-001/phase', payload: { phase_procedure: 'ENQUETE' } },
      { method: 'POST', url: '/api/discipline/sanctions', payload: { dossier_id: 'dos-disc-001', groupe_sanction: 'GROUPE_1', nature_sanction: 'avertissement', reference_arrete: 'test' } }
    ];

    let tentativesBloquees = 0;

    for (const profil of profilsInterdits) {
      for (const ep of endpointsDiscipline) {
        const res = await app.inject({
          method: ep.method,
          url: ep.url,
          headers: { authorization: `Bearer ${profil.jeton}` },
          payload: ep.payload
        });

        assert.strictEqual(
          res.statusCode,
          403,
          `Le profil ${profil.nom} DOIT recevoir HTTP 403 sur ${ep.method} ${ep.url}`
        );
        const corps = JSON.parse(res.payload);
        assert.strictEqual(corps.code_erreur, 'ACCES_INTERDIT');
        tentativesBloquees++;
      }
    }

    // Vérifier que chaque tentative bloquée a été consignée dans l'audit
    const resAudit = await pool.query(`
      SELECT count(*) AS total FROM journaux_audit
      WHERE action_type = 'TENTATIVE_CONSULTATION_DISCIPLINE_BLOQUEE';
    `);
    assert.ok(
      parseInt(resAudit.rows[0].total, 10) >= tentativesBloquees,
      `Toutes les ${tentativesBloquees} tentatives d'intrusion doivent être tracées dans journaux_audit`
    );
  });

  await t.test('3.2 Exclusion de l Administrateur Technique de TOUTES les routes nominatives M4', async () => {
    const routesNominativesM4 = [
      { method: 'GET', url: '/api/plannings' },
      { method: 'GET', url: '/api/plannings/grille' },
      { method: 'GET', url: '/api/plannings/postes' },
      { method: 'GET', url: '/api/discipline/dossiers' },
      { method: 'GET', url: '/api/aptitude/agt-001' },
      { method: 'POST', url: '/api/aptitude', payload: { agent_id: 'agt-001', date_decision: '2026-03-01' } },
      { method: 'GET', url: '/api/documents/modeles' },
      { method: 'POST', url: '/api/documents/generer', payload: { code_modele: 'ARRETE_MUTATION', agent_id: 'agt-001' } }
    ];

    for (const r of routesNominativesM4) {
      const res = await app.inject({
        method: r.method,
        url: r.url,
        headers: { authorization: `Bearer ${jetonAdminTech}` },
        payload: r.payload
      });

      assert.strictEqual(
        res.statusCode,
        403,
        `L Administrateur Technique doit être bloqué en 403 sur ${r.method} ${r.url}`
      );
      const corps = JSON.parse(res.payload);
      assert.strictEqual(corps.code_erreur, 'ACCES_INTERDIT');
    }
  });

  await t.test('3.3 Veto Anti-médical : Robustesse sémantique et absence de faux positifs', async () => {
    // 1. Corpus de contournements médicaux à bloquer impérativement (HTTP 422)
    const contournementsMedicaux = [
      'Visite chez le MÉDECIN militaire',
      'Prescription d une ORDONNANCE de soins',
      'Diagnostic positif pour une MALADIE chronique',
      'Hospitalisation récente à l HÔPITAL Peltier',
      'Exemption suite à un TRAITEMENT lourd',
      'Affections psychiatriques et suivi PSY',
      'Problème de GLYCÉMIE et DIABÈTE'
    ];

    for (const terme of contournementsMedicaux) {
      const res = await app.inject({
        method: 'POST',
        url: '/api/aptitude',
        headers: { authorization: `Bearer ${jetonGestionnaireRH}` },
        payload: {
          agent_id: 'agt-001',
          numero_certificat: `CERT-REJET-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          decision_aptitude: 'AMENAGEMENT_POSTE',
          restriction_operationnelle: terme,
          date_decision: '2026-03-01'
        }
      });

      assert.strictEqual(res.statusCode, 422, `Le terme médical "${terme}" doit être bloqué par HTTP 422`);
      const corps = JSON.parse(res.payload);
      assert.strictEqual(corps.code_erreur, 'DONNEE_MEDICALE_PROHIBEE');
    }

    // 2. Termes administratifs et opérationnels légitimes (NE DOIVENT PAS être bloqués)
    const termesLegitimesAutorises = [
      'Affectation en brigade sédentaire de jour',
      'Exemption de patrouille motorisée nocturne',
      'Port de l arme de service réglementaire autorisé',
      'Conduite de véhicule de police en mission prioritaire',
      'Aménagement de poste intérieur de commandement'
    ];

    for (let i = 0; i < termesLegitimesAutorises.length; i++) {
      const termeOk = termesLegitimesAutorises[i];
      const resOk = await app.inject({
        method: 'POST',
        url: '/api/aptitude',
        headers: { authorization: `Bearer ${jetonGestionnaireRH}` },
        payload: {
          agent_id: 'agt-001',
          numero_certificat: `CERT-OK-${prefixTest}-${i}`,
          decision_aptitude: 'AMENAGEMENT_POSTE',
          type_conclusion: 'APTE_AVEC_RESTRICTIONS',
          code_restriction: 'POSTE_SEDENTAIRE',
          restriction_operationnelle: termeOk,
          date_decision: '2026-03-01'
        }
      });

      assert.strictEqual(
        resOk.statusCode,
        201,
        `Le terme légitime "${termeOk}" ne doit pas être bloqué à tort (obtenu: ${resOk.statusCode})`
      );
    }
  });

  // ==========================================================================
  // SECTION 4 : SCELLEMENT SHA-256 ET INTÉGRITÉ DES ACTES PDF
  // ==========================================================================

  await t.test('4.1 Génération d acte PDF républicain et épreuve d altération (Tamper Test)', async () => {
    // 1. Génération d'une attestation de présence
    const resDoc = await app.inject({
      method: 'POST',
      url: '/api/documents/generer',
      headers: { authorization: `Bearer ${jetonGestionnaireRH}` },
      payload: {
        code_modele: 'ATTESTATION_PRESENCE',
        agent_id: 'agt-001',
        donnees_acte: {
          motif_attestation: 'Dossier administratif de titularisation',
          annee_reference: '2026'
        }
      }
    });

    assert.strictEqual(resDoc.statusCode, 201);
    const corpsDoc = JSON.parse(resDoc.payload);
    assert.strictEqual(corpsDoc.statut, 'SUCCES');
    const docId = corpsDoc.document.id;
    const shaScelle = corpsDoc.document.empreinte_sha256;
    const base64Contenu = corpsDoc.document.contenu_base64;

    // 2. Vérification mathématique du hash original
    const bufferOriginal = Buffer.from(base64Contenu, 'base64');
    const hashCalcule = crypto.createHash('sha256').update(bufferOriginal).digest('hex');
    assert.strictEqual(shaScelle, hashCalcule, 'Le hash scellé doit être strictement égal au hash du buffer');

    // 3. Épreuve d'altération (Tamper Test) : altération d'un seul octet dans le buffer
    const bufferAltere = Buffer.from(bufferOriginal);
    bufferAltere[50] = bufferAltere[50] ^ 0xFF; // Inversion binaire d'un octet

    const hashAltere = crypto.createHash('sha256').update(bufferAltere).digest('hex');
    assert.notStrictEqual(
      hashAltere,
      shaScelle,
      'Une altération d un seul octet doit impérativement modifier l empreinte SHA-256'
    );

    // Calcul de la distance de Hamming (effet avalanche)
    let distanceHamming = 0;
    const bufOrigHash = Buffer.from(shaScelle, 'hex');
    const bufAltHash = Buffer.from(hashAltere, 'hex');
    for (let i = 0; i < bufOrigHash.length; i++) {
      let xor = bufOrigHash[i] ^ bufAltHash[i];
      while (xor > 0) {
        if (xor & 1) distanceHamming++;
        xor >>= 1;
      }
    }
    assert.ok(
      distanceHamming >= 80,
      `Effet avalanche cryptographique attendu (bits modifiés: ${distanceHamming}/256, minimum: 80)`
    );

    // 4. Téléchargement du binaire application/pdf
    const resDl = await app.inject({
      method: 'GET',
      url: `/api/documents/${docId}/telecharger`,
      headers: { authorization: `Bearer ${jetonGestionnaireRH}` }
    });
    assert.strictEqual(resDl.statusCode, 200);
    assert.strictEqual(resDl.headers['content-type'], 'application/pdf');
    assert.match(
      resDl.headers['content-disposition'],
      /filename="ACTE-ATTESTATION_PRESENCE-.*\.pdf"/
    );
  });
});
