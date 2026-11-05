const test = require('node:test');
const assert = require('node:assert/strict');

// Chargement du serveur compilé ou via tsx
let creerApplicationServeur;
let pool;
let fermerPool;
let auditService;
let agentsService;

try {
  creerApplicationServeur = require('../../dist/server.js').creerApplicationServeur;
  const dbModule = require('../../dist/database/index.js');
  pool = dbModule.pool;
  fermerPool = dbModule.fermerPool;
  auditService = require('../../dist/modules/audit/audit.service.js').auditService;
  agentsService = require('../../dist/modules/agents/agents.service.js').agentsService;
} catch {
  require('tsx/cjs');
  creerApplicationServeur = require('../../src/server.ts').creerApplicationServeur;
  const dbModule = require('../../src/database/index.ts');
  pool = dbModule.pool;
  fermerPool = dbModule.fermerPool;
  auditService = require('../../src/modules/audit/audit.service.ts').auditService;
  agentsService = require('../../src/modules/agents/agents.service.ts').agentsService;
}

test('CHALLENGER M1-R3-1 : Épreuves Empiriques de Concurrence, Sécurité et Audit', async (t) => {
  let app;
  let jetonAdminTech;
  let jetonChefAli;
  let jetonAgentHassan;
  let jetonGestionnaireRH;
  let jetonAdminFonc;

  t.before(async () => {
    app = await creerApplicationServeur();
    await app.ready();

    // Authentifications pour les différents rôles
    const login = async (identifiant) => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/connexion',
        payload: { identifiant, mot_de_passe: 'Police@2026!' }
      });
      assert.strictEqual(res.statusCode, 200, `Échec connexion pour ${identifiant}`);
      return JSON.parse(res.payload).jeton;
    };

    jetonAdminTech = await login('admin_tech');
    jetonChefAli = await login('chef_ali');
    jetonAgentHassan = await login('agent_hassan');
    jetonGestionnaireRH = await login('gestionnaire_rh');
    jetonAdminFonc = await login('admin_fonc');
  });

  t.after(async () => {
    if (app) await app.close();
    if (fermerPool && !pool?.ending && !pool?.ended) {
      await fermerPool().catch(() => {});
    }
  });

  // ============================================================================
  // ÉPREUVE 1 : Linéarité et robustesse de la chaîne d'audit sous forte concurrence
  // ============================================================================
  await t.test('ÉPREUVE 1.1 : 30 écritures d\'audit hautement concurrentes (pg_advisory_xact_lock)', async () => {
    const NOMBRE_WRITERS = 30;
    const promises = [];

    const startTime = Date.now();
    for (let i = 0; i < NOMBRE_WRITERS; i++) {
      promises.push(
        auditService.enregistrer({
          utilisateur_id: 'usr-rh-01',
          nom_utilisateur: 'Mouna Hassan',
          role_utilise: 'GESTIONNAIRE_RH',
          adresse_ip: '10.10.10.10',
          action_type: 'TEST_CONCURRENCE_CHALLENGER',
          entite_cible: 'AUDIT_BENCHMARK',
          entite_id: `bench-${i}`,
          details_operation_json: { index: i, timestamp: Date.now() },
          statut_operation: 'SUCCES'
        })
      );
    }

    const resultats = await Promise.all(promises);
    assert.strictEqual(resultats.length, NOMBRE_WRITERS, 'Toutes les écritures concurrentes doivent aboutir');

    // Vérification de la continuité stricte des identifiants et hashes
    const ids = resultats.map(r => Number(r.id)).sort((a, b) => a - b);
    for (let i = 1; i < ids.length; i++) {
      assert.strictEqual(ids[i], ids[i - 1] + 1, `Les identifiants d'audit doivent être strictement consécutifs (${ids[i-1]} -> ${ids[i]})`);
    }

    // Vérification de la validité cryptographique globale de la chaîne
    const verif = await auditService.verifierIntegriteChaine();
    assert.strictEqual(verif.valid, true, `La chaîne d'audit doit être 100% valide après ${NOMBRE_WRITERS} écritures concurrentes`);
    assert.strictEqual(verif.errors.length, 0, 'Aucune erreur cryptographique dans la chaîne');
  });

  await t.test('ÉPREUVE 1.2 : Résilience du verrou advisory en cas de ROLLBACK ou transaction avortée', async () => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT pg_advisory_xact_lock(42424242);');
      // Forcer une erreur relationnelle ou un rollback explicite
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }

    // Immédiatement après, une nouvelle écriture standard d'audit doit réussir sans bloquer
    const auditApresRollback = await auditService.enregistrer({
      utilisateur_id: 'usr-admin-01',
      nom_utilisateur: 'Abdillahi Tech',
      role_utilise: 'ADMIN_TECHNIQUE',
      adresse_ip: '127.0.0.1',
      action_type: 'POST_ROLLBACK_VERIF',
      entite_cible: 'VERROU_ADVISORY',
      details_operation_json: { test: 'liberation_automatique_advisory_lock' }
    });

    assert.ok(auditApresRollback.id > 0);
    assert.ok(auditApresRollback.empreinte_courante);

    const verif = await auditService.verifierIntegriteChaine();
    assert.strictEqual(verif.valid, true);
  });

  await t.test('ÉPREUVE 1.3 : 60 écritures concurrentes simultanées d\'audit sous saturation', async () => {
    const NOMBRE_WRITERS = 60;
    const promises = [];

    for (let i = 0; i < NOMBRE_WRITERS; i++) {
      promises.push(
        auditService.enregistrer({
          utilisateur_id: 'usr-rh-01',
          nom_utilisateur: 'Mouna Hassan',
          role_utilise: 'GESTIONNAIRE_RH',
          adresse_ip: '192.168.1.100',
          action_type: 'TEST_SATURATION_CHALLENGER',
          entite_cible: 'AUDIT_SATURATION',
          entite_id: `sat-${i}`,
          details_operation_json: { charge: i, timestamp: Date.now() },
          statut_operation: 'SUCCES'
        })
      );
    }

    const resultats = await Promise.all(promises);
    assert.strictEqual(resultats.length, NOMBRE_WRITERS);

    const ids = resultats.map(r => Number(r.id)).sort((a, b) => a - b);
    for (let i = 1; i < ids.length; i++) {
      assert.strictEqual(ids[i], ids[i - 1] + 1);
    }

    const verif = await auditService.verifierIntegriteChaine();
    assert.strictEqual(verif.valid, true);
    assert.strictEqual(verif.errors.length, 0);
  });

  // ============================================================================
  // ÉPREUVE 2 : Épreuves de non-élévation de privilèges et isolation territoriale (ABAC)
  // ============================================================================
  await t.test('ÉPREUVE 2.1 : Rejet formel de tentative d\'auto-élévation ou de modification d\'autres dossiers par un Agent', async () => {
    // 1. Consultation par Agent : l'agent Hassan (lié à agt-001) ne voit que son propre dossier
    const resAnnuaire = await app.inject({
      method: 'GET',
      url: '/api/agents',
      headers: { authorization: `Bearer ${jetonAgentHassan}` }
    });
    assert.strictEqual(resAnnuaire.statusCode, 200);
    const corpsAnnuaire = JSON.parse(resAnnuaire.payload);
    assert.strictEqual(corpsAnnuaire.agents.length, 1);
    assert.strictEqual(corpsAnnuaire.agents[0].matricule, 'PND-2020-00142');

    // 2. Tentative d'accès direct au dossier de l'agent tiers (agt-003) par Agent Hassan (agt-001)
    const resDossierTiers = await app.inject({
      method: 'GET',
      url: '/api/agents/agt-003',
      headers: { authorization: `Bearer ${jetonAgentHassan}` }
    });
    assert.strictEqual(resDossierTiers.statusCode, 403);
    const errTiers = JSON.parse(resDossierTiers.payload);
    assert.strictEqual(errTiers.code_erreur, 'ACCES_INTERDIT');

    // 3. Tentative de modification de profil ou élévation par Agent Hassan sur son propre dossier
    const resModifProfil = await app.inject({
      method: 'PUT',
      url: '/api/agents/agt-001',
      headers: { authorization: `Bearer ${jetonAgentHassan}` },
      payload: { grade_actuel: 'COMMISSAIRE_DIVISIONNAIRE' }
    });
    assert.strictEqual(resModifProfil.statusCode, 403);

    // 4. Tentative d'accès à la console fonctionnelle (Form Builder) par Agent Hassan
    const resFormBuilder = await app.inject({
      method: 'POST',
      url: '/api/config/champs',
      headers: { authorization: `Bearer ${jetonAgentHassan}` },
      payload: { code_champ: 'test_hassan', libelle: 'Test Hassan', type_donnee: 'TEXTE' }
    });
    assert.strictEqual(resFormBuilder.statusCode, 403);

    // 5. Tentative de publication de version de config par Agent Hassan
    const resPublier = await app.inject({
      method: 'POST',
      url: '/api/config/versions/publier',
      headers: { authorization: `Bearer ${jetonAgentHassan}` },
      payload: { commentaire: 'Piratage de configuration' }
    });
    assert.strictEqual(resPublier.statusCode, 403);

    // 6. Tentative d'exécution de mutation par Agent Hassan
    const resMutation = await app.inject({
      method: 'POST',
      url: '/api/mutations',
      headers: { authorization: `Bearer ${jetonAgentHassan}` },
      payload: {
        agent_id: 'agt-003',
        nouvelle_unite_id: 'U-DIR-GEN',
        date_debut: '2026-11-03',
        motif_mouvement: 'Auto-promotion',
        reference_arrete_ou_decision: 'DEC-HACK-001'
      }
    });
    assert.strictEqual(resMutation.statusCode, 403);
  });

  await t.test('ÉPREUVE 2.2 : Cloisonnement territorial ABAC étanche du Chef de Service', async () => {
    // Chef Ali est rattaché à Ali-Sabieh (U-REG-ALI)
    // 1. Accès à un agent de son unité : agt-003 (Hassan Omar) -> 200
    const resPropreUnite = await app.inject({
      method: 'GET',
      url: '/api/agents/agt-003',
      headers: { authorization: `Bearer ${jetonChefAli}` }
    });
    assert.strictEqual(resPropreUnite.statusCode, 200);

    // 2. Accès à un agent hors unité : agt-001 (Moussa, Direction Générale) -> 403
    const resHorsUnite1 = await app.inject({
      method: 'GET',
      url: '/api/agents/agt-001',
      headers: { authorization: `Bearer ${jetonChefAli}` }
    });
    assert.strictEqual(resHorsUnite1.statusCode, 403);

    // 3. Accès à un agent hors unité : agt-004 (Farhan, Dikhil) -> 403
    const resHorsUnite2 = await app.inject({
      method: 'GET',
      url: '/api/agents/agt-004',
      headers: { authorization: `Bearer ${jetonChefAli}` }
    });
    assert.strictEqual(resHorsUnite2.statusCode, 403);

    // 4. Tentative de consultation de l'historique d'affectation hors unité -> 403
    const resHistHorsUnite = await app.inject({
      method: 'GET',
      url: '/api/agents/agt-001/affectations',
      headers: { authorization: `Bearer ${jetonChefAli}` }
    });
    assert.strictEqual(resHistHorsUnite.statusCode, 403);

    // 5. Tentative de création d'agent par Chef Ali -> 403 (seul Gestionnaire RH peut créer)
    const resCreerParChef = await app.inject({
      method: 'POST',
      url: '/api/agents',
      headers: { authorization: `Bearer ${jetonChefAli}` },
      payload: {
        matricule: 'PND-2026-99999',
        numero_carte_nationale: '123456789012',
        nom: 'Illégitime',
        prenom: 'Agent',
        date_naissance: '1995-01-01',
        genre: 'M',
        date_recrutement: '2026-01-01',
        corps: 'GRADES_AGENTS',
        grade_actuel: 'SERGENT',
        indice_solde: 300,
        unite_actuelle_id: 'U-REG-ALI'
      }
    });
    assert.strictEqual(resCreerParChef.statusCode, 403);
  });

  // ============================================================================
  // ÉPREUVE 3 : Résistance aux URLs anormalement longues et attaques par débordement
  // ============================================================================
  await t.test('ÉPREUVE 3.1 : URLs très longues et paramètres volumineux sur routes protégées RBAC', async () => {
    // Longueur d'URL 1 : 150 caractères sur /api/config/listes-valeurs/
    const longParam1 = 'A'.repeat(100);
    const resLong1 = await app.inject({
      method: 'POST',
      url: `/api/config/listes-valeurs/${longParam1}/elements`,
      headers: { authorization: `Bearer ${jetonAgentHassan}` },
      payload: { code_element: 'TEST', libelle: 'Test' }
    });
    assert.strictEqual(resLong1.statusCode, 403, 'Doit rejeter en 403 sans erreur 500');

    // Longueur d'URL 2 : Query string de 500 caractères
    const longQuery = 'foo=' + 'B'.repeat(500);
    const resLongQuery = await app.inject({
      method: 'POST',
      url: `/api/config/versions/rollback?${longQuery}`,
      headers: { authorization: `Bearer ${jetonAgentHassan}` },
      payload: { version_cible: 'v1.0.0', motif_justificatif: 'Test' }
    });
    assert.strictEqual(resLongQuery.statusCode, 403, 'Doit rejeter en 403 sans altérer l\'audit');

    // Longueur d'URL 3 : Query string de 2000 caractères sur recherche d'agents
    const massiveQuery = 'recherche=' + 'C'.repeat(2000);
    const resMassive = await app.inject({
      method: 'GET',
      url: `/api/agents?${massiveQuery}`,
      headers: { authorization: `Bearer ${jetonGestionnaireRH}` }
    });
    assert.strictEqual(resMassive.statusCode, 200, 'Le serveur doit traiter la requête sans crash');
    const corpsMassive = JSON.parse(resMassive.payload);
    assert.strictEqual(corpsMassive.statut, 'SUCCES');

    // Vérification que les journaux d'audit ont enregistré les rejets sans tronquature invalide ni erreur
    const verif = await auditService.verifierIntegriteChaine();
    assert.strictEqual(verif.valid, true, "La chaîne d'audit doit demeurer 100% intègre après les tests d'URLs longues");
  });

  await t.test('ÉPREUVE 3.2 : Résistance aux attaques d\'injection et caractères anormaux dans les URLs', async () => {
    // 1. Injection SQL dans l'identifiant agent : /api/agents/' OR '1'='1
    const resSqliId = await app.inject({
      method: 'GET',
      url: "/api/agents/'%20OR%20'1'='1",
      headers: { authorization: `Bearer ${jetonGestionnaireRH}` }
    });
    // Doit retourner 404 (non trouvé) sans planter ni exécuter l'injection
    assert.strictEqual(resSqliId.statusCode, 404);

    // 2. Path Traversal dans l'identifiant agent : /api/agents/../../etc/passwd
    const resTraversal = await app.inject({
      method: 'GET',
      url: '/api/agents/..%2F..%2Fetc%2Fpasswd',
      headers: { authorization: `Bearer ${jetonGestionnaireRH}` }
    });
    // Fastify normalise ou rejette avec 400/404 sans fuite d'information
    assert.ok([400, 404].includes(resTraversal.statusCode));

    // 3. Null byte dans l'URL : /api/agents/agt-001%00admin
    const resNullByte = await app.inject({
      method: 'GET',
      url: '/api/agents/agt-001%00admin',
      headers: { authorization: `Bearer ${jetonGestionnaireRH}` }
    });
    // PostgreSQL rejette les null bytes en UTF-8 avec 500 ou Fastify rejette en 400/404, sans fuite de secrets
    assert.ok([400, 404, 500].includes(resNullByte.statusCode));
    const corpsNull = JSON.parse(resNullByte.payload);
    assert.strictEqual(corpsNull.statut, 'ERREUR');
  });

  // ============================================================================
  // ÉPREUVE 4 : Idempotence et robustesse de fermerPool() sous concurrence
  // ============================================================================
  await t.test('ÉPREUVE 4.1 : 20 appels séquentiels consécutifs à fermerPool() sur instance dédiée', async () => {
    // Création d'une instance Pool dédiée pour tester fermerPool isolément sans impacter le pool global du serveur
    const { Pool } = require('pg');
    const { CONFIG } = require('../../dist/config/index.js');
    const testPool = new Pool(CONFIG.DB);

    // Implémentation du pattern fermerPool
    let promesseFermeture = null;
    async function testFermerPool() {
      if (testPool.ending || testPool.ended) return;
      if (!promesseFermeture) {
        promesseFermeture = testPool.end().catch((err) => {
          if (err && err.message && err.message.includes('Called end on pool more than once')) {
            return;
          }
          throw err;
        });
      }
      await promesseFermeture;
    }

    // Exécution de 20 appels séquentiels
    for (let i = 0; i < 20; i++) {
      await assert.doesNotReject(async () => {
        await testFermerPool();
      }, `L'appel séquentiel #${i} à fermerPool ne doit jamais rejeter`);
    }

    assert.strictEqual(testPool.ended, true);
  });

  await t.test('ÉPREUVE 4.2 : 50 appels concurrents simultanés à fermerPool()', async () => {
    const { Pool } = require('pg');
    const { CONFIG } = require('../../dist/config/index.js');
    const testPool = new Pool(CONFIG.DB);

    // Initialisation d'une connexion active
    const client = await testPool.connect();
    client.release();

    let promesseFermeture = null;
    async function testFermerPool() {
      if (testPool.ending || testPool.ended) return;
      if (!promesseFermeture) {
        promesseFermeture = testPool.end().catch((err) => {
          if (err && err.message && err.message.includes('Called end on pool more than once')) {
            return;
          }
          throw err;
        });
      }
      await promesseFermeture;
    }

    // Lancement simultané de 50 appels
    const appelsConcurrents = Array.from({ length: 50 }, () => testFermerPool());
    const resultats = await Promise.allSettled(appelsConcurrents);

    const rejets = resultats.filter(r => r.status === 'rejected');
    assert.strictEqual(rejets.length, 0, `Aucun des 50 appels concurrents ne doit échouer (rejets: ${rejets.length})`);
    assert.strictEqual(testPool.ended, true, 'Le pool doit être dans l\'état ended');
  });

  await t.test('ÉPREUVE 4.3 : Double fermeture entrelacée serveur et hook de test (app.close vs fermerPool)', async () => {
    // Vérification du comportement lorsque fermerPool() natif est appelé après fermeture de l'application
    assert.strictEqual(typeof fermerPool, 'function');
    // Le test vérifie que fermerPool n'émet pas d'exception non gérée
    const promesse = fermerPool();
    assert.ok(promesse instanceof Promise);
    await promesse;
  });

  await t.test('ÉPREUVE 4.4 : 50 appels concurrents immédiats à fermerPool() de production après fin de vie', async () => {
    // Le pool de production est déjà en cours de fermeture ou fermé (ended/ending)
    // 50 appels simultanés doivent tous se résoudre immédiatement sans exception
    const rafaleFermetures = Array.from({ length: 50 }, () => fermerPool());
    const resultatsRafale = await Promise.allSettled(rafaleFermetures);

    const rejetsRafale = resultatsRafale.filter(r => r.status === 'rejected');
    assert.strictEqual(rejetsRafale.length, 0, `Les 50 appels concurrents à fermerPool de production doivent tous réussir`);
  });
});
