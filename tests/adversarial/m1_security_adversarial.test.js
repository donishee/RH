const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

// Chargement du serveur compilé ou via tsx
let creerApplicationServeur;
let pool;
let fermerPool;
let hacherMotDePasse;
let verifierAntiAutoApprobation;

try {
  creerApplicationServeur = require('../../dist/server.js').creerApplicationServeur;
  const dbModule = require('../../dist/database/index.js');
  pool = dbModule.pool;
  fermerPool = dbModule.fermerPool;
  hacherMotDePasse = require('../../dist/modules/auth/auth.crypto.js').hacherMotDePasse;
  verifierAntiAutoApprobation = require('../../dist/middleware/anti_auto_approbation.js').verifierAntiAutoApprobation;
} catch {
  require('tsx/cjs');
  creerApplicationServeur = require('../../src/server.ts').creerApplicationServeur;
  const dbModule = require('../../src/database/index.ts');
  pool = dbModule.pool;
  fermerPool = dbModule.fermerPool;
  hacherMotDePasse = require('../../src/modules/auth/auth.crypto.ts').hacherMotDePasse;
  verifierAntiAutoApprobation = require('../../src/middleware/anti_auto_approbation.ts').verifierAntiAutoApprobation;
}

test('CHALLENGER M1 : Épreuves Adversariales de Sécurité et Contrôle d\'Accès Serveur', async (t) => {
  let app;
  let jetonAdminTech;
  let jetonChefAli;
  let jetonChefCC;
  let jetonAgentHassan;
  let jetonGestionnaireRH;
  let jetonAdminFonc;

  t.before(async () => {
    app = await creerApplicationServeur();
    await app.ready();

    // 1. Authentification Admin Tech
    const resTech = await app.inject({
      method: 'POST',
      url: '/api/auth/connexion',
      payload: { identifiant: 'admin_tech', mot_de_passe: 'Police@2026!' }
    });
    assert.strictEqual(resTech.statusCode, 200);
    jetonAdminTech = JSON.parse(resTech.payload).jeton;

    // 2. Authentification Chef Ali-Sabieh (U-REG-ALI)
    const resChefAli = await app.inject({
      method: 'POST',
      url: '/api/auth/connexion',
      payload: { identifiant: 'chef_ali', mot_de_passe: 'Police@2026!' }
    });
    assert.strictEqual(resChefAli.statusCode, 200);
    jetonChefAli = JSON.parse(resChefAli.payload).jeton;

    // 3. Authentification Chef CC (U-CC-DJIB / U-DSP)
    const resChefCC = await app.inject({
      method: 'POST',
      url: '/api/auth/connexion',
      payload: { identifiant: 'chef_cc', mot_de_passe: 'Police@2026!' }
    });
    assert.strictEqual(resChefCC.statusCode, 200);
    jetonChefCC = JSON.parse(resChefCC.payload).jeton;

    // 4. Authentification Agent Hassan
    const resAgt = await app.inject({
      method: 'POST',
      url: '/api/auth/connexion',
      payload: { identifiant: 'agent_hassan', mot_de_passe: 'Police@2026!' }
    });
    assert.strictEqual(resAgt.statusCode, 200);
    jetonAgentHassan = JSON.parse(resAgt.payload).jeton;

    // 5. Authentification Gestionnaire RH
    const resRH = await app.inject({
      method: 'POST',
      url: '/api/auth/connexion',
      payload: { identifiant: 'gestionnaire_rh', mot_de_passe: 'Police@2026!' }
    });
    assert.strictEqual(resRH.statusCode, 200);
    jetonGestionnaireRH = JSON.parse(resRH.payload).jeton;

    // 6. Authentification Admin Fonctionnel
    const resFonc = await app.inject({
      method: 'POST',
      url: '/api/auth/connexion',
      payload: { identifiant: 'admin_fonc', mot_de_passe: 'Police@2026!' }
    });
    assert.strictEqual(resFonc.statusCode, 200);
    jetonAdminFonc = JSON.parse(resFonc.payload).jeton;
  });

  t.after(async () => {
    if (app) await app.close();
    if (fermerPool && !pool?.ending && !pool?.ended) {
      await fermerPool().catch(() => {});
    }
  });

  // ============================================================================
  // ÉPREUVE 1 : Interdiction d'accès nominatif RH pour l'Administrateur Technique
  // ============================================================================
  await t.test('ÉPREUVE 1.1 : Rejet HTTP 403 STRICT de GET /api/agents pour Admin Technique', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/agents',
      headers: { Authorization: `Bearer ${jetonAdminTech}` }
    });

    assert.strictEqual(res.statusCode, 403, 'Admin technique doit recevoir strictement un HTTP 403 Forbidden sur /api/agents');
    const corps = JSON.parse(res.payload);
    assert.strictEqual(corps.statut, 'ERREUR');
    assert.strictEqual(corps.code_erreur, 'ACCES_INTERDIT');
    assert.match(corps.message, /administrateurs techniques ne disposent d'aucun droit/i);
  });

  await t.test('ÉPREUVE 1.2 : Rejet HTTP 403 STRICT de GET /api/agents/:id pour Admin Technique', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/agents/agt-001',
      headers: { Authorization: `Bearer ${jetonAdminTech}` }
    });

    assert.strictEqual(res.statusCode, 403, 'Admin technique doit recevoir strictement un HTTP 403 Forbidden sur /api/agents/:id');
    const corps = JSON.parse(res.payload);
    assert.strictEqual(corps.statut, 'ERREUR');
    assert.strictEqual(corps.code_erreur, 'ACCES_INTERDIT');
    assert.match(corps.message, /administrateurs techniques ne disposent d'aucun droit/i);
  });

  await t.test('ÉPREUVE 1.3 : Rejet HTTP 403 STRICT de GET /api/agents/:id/affectations pour Admin Technique', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/agents/agt-001/affectations',
      headers: { Authorization: `Bearer ${jetonAdminTech}` }
    });

    assert.strictEqual(res.statusCode, 403, 'Admin technique doit recevoir strictement un HTTP 403 Forbidden sur les affectations nominatives');
    const corps = JSON.parse(res.payload);
    assert.strictEqual(corps.statut, 'ERREUR');
    assert.strictEqual(corps.code_erreur, 'ACCES_INTERDIT');
    assert.match(corps.message, /administrateurs techniques ne disposent d'aucun droit/i);
  });

  await t.test('ÉPREUVE 1.4 : Rejet HTTP 403 STRICT de POST /api/mutations pour Admin Technique', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/mutations',
      headers: { Authorization: `Bearer ${jetonAdminTech}` },
      payload: {
        agent_id: 'agt-001',
        nouvelle_unite_id: 'U-REG-ALI',
        date_debut: '2026-12-01',
        motif_mouvement: 'Tentative illicite admin tech',
        reference_arrete_ou_decision: 'DEC-HACK-001'
      }
    });

    assert.strictEqual(res.statusCode, 403, 'Admin technique doit recevoir strictement un HTTP 403 Forbidden sur /api/mutations');
    const corps = JSON.parse(res.payload);
    assert.strictEqual(corps.statut, 'ERREUR');
    assert.strictEqual(corps.code_erreur, 'ACCES_INTERDIT');
  });

  await t.test('ÉPREUVE 1.5 : Constat empirique sur la route non nominative GET /api/affectations', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/affectations',
      headers: { Authorization: `Bearer ${jetonAdminTech}` }
    });

    // Constat empirique : La route nominative implémentée est /api/agents/:id/affectations (testée en 1.3 -> 403).
    // /api/affectations n'est pas exposée en GET dans l'API REST (Fastify renvoie 404).
    assert.strictEqual(res.statusCode, 404, 'La route /api/affectations non paramétrée n\'existe pas (404 Not Found), la route officielle nominative est /api/agents/:id/affectations');
  });

  // ============================================================================
  // ÉPREUVE 2 : Test d'élévation de privilèges (Agent & Chef de Service)
  // ============================================================================
  await t.test('ÉPREUVE 2.1 : Rejet HTTP 403 STRICT de POST /api/agents pour Agent Hassan', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/agents',
      headers: { Authorization: `Bearer ${jetonAgentHassan}` },
      payload: {
        matricule: 'PND-2026-99999',
        numero_carte_nationale: 'NID-99999',
        nom: 'Hacker',
        prenom: 'Bob',
        date_naissance: '1990-01-01',
        genre: 'MASCULIN',
        date_recrutement: '2026-01-01',
        corps: 'AGENTS',
        grade_actuel: 'Agent de 1ère classe',
        indice_solde: 320,
        unite_actuelle_id: 'U-CC-DJIB'
      }
    });

    assert.strictEqual(res.statusCode, 403, 'Un agent simple ne peut jamais créer d\'agent (HTTP 403 requis)');
    const corps = JSON.parse(res.payload);
    assert.strictEqual(corps.statut, 'ERREUR');
    assert.strictEqual(corps.code_erreur, 'ACCES_INTERDIT');
  });

  await t.test('ÉPREUVE 2.2 : Rejet HTTP 403 STRICT de POST /api/agents pour Chef Ali', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/agents',
      headers: { Authorization: `Bearer ${jetonChefAli}` },
      payload: {
        matricule: 'PND-2026-88888',
        numero_carte_nationale: 'NID-88888',
        nom: 'Subordonne',
        prenom: 'Nouveau',
        date_naissance: '1995-01-01',
        genre: 'MASCULIN',
        date_recrutement: '2026-01-01',
        corps: 'AGENTS',
        grade_actuel: 'Agent de 1ère classe',
        indice_solde: 320,
        unite_actuelle_id: 'U-REG-ALI'
      }
    });

    assert.strictEqual(res.statusCode, 403, 'Un chef de service ne peut jamais créer d\'agent (réservé GESTIONNAIRE_RH)');
    const corps = JSON.parse(res.payload);
    assert.strictEqual(corps.statut, 'ERREUR');
    assert.strictEqual(corps.code_erreur, 'ACCES_INTERDIT');
  });

  await t.test('ÉPREUVE 2.3 : Rejet HTTP 403 STRICT de PUT /api/agents/:id pour Agent Hassan (modification rôles/dossier)', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/api/agents/agt-001',
      headers: { Authorization: `Bearer ${jetonAgentHassan}` },
      payload: {
        grade_actuel: 'Colonel',
        indice_solde: 1200,
        role: 'ADMIN_TECHNIQUE'
      }
    });

    assert.strictEqual(res.statusCode, 403, 'Un agent simple ne peut jamais modifier son propre dossier ou son rôle');
    const corps = JSON.parse(res.payload);
    assert.strictEqual(corps.statut, 'ERREUR');
    assert.strictEqual(corps.code_erreur, 'ACCES_INTERDIT');
  });

  await t.test('ÉPREUVE 2.4 : Rejet HTTP 403 STRICT de PUT /api/agents/:id pour Chef Ali', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/api/agents/agt-003',
      headers: { Authorization: `Bearer ${jetonChefAli}` },
      payload: {
        grade_actuel: 'Commandant',
        indice_solde: 950
      }
    });

    assert.strictEqual(res.statusCode, 403, 'Un chef de service ne peut jamais modifier statutairement un agent (réservé GESTIONNAIRE_RH)');
    const corps = JSON.parse(res.payload);
    assert.strictEqual(corps.statut, 'ERREUR');
    assert.strictEqual(corps.code_erreur, 'ACCES_INTERDIT');
  });

  await t.test('ÉPREUVE 2.5 : Rejet HTTP 403 STRICT d\'accès au Form Builder (POST /api/config/champs) pour Agent & Chef', async () => {
    // 1. Agent
    const resAgt = await app.inject({
      method: 'POST',
      url: '/api/config/champs',
      headers: { Authorization: `Bearer ${jetonAgentHassan}` },
      payload: {
        entite_cible: 'AGENT',
        code_champ: 'piratage_champ',
        libelle: 'Champ pirate',
        type_donnee: 'TEXTE'
      }
    });
    assert.strictEqual(resAgt.statusCode, 403, 'Un agent ne peut pas ajouter de champ dans le Form Builder');

    // 2. Chef
    const resChef = await app.inject({
      method: 'POST',
      url: '/api/config/champs',
      headers: { Authorization: `Bearer ${jetonChefAli}` },
      payload: {
        entite_cible: 'AGENT',
        code_champ: 'piratage_champ_chef',
        libelle: 'Champ pirate chef',
        type_donnee: 'TEXTE'
      }
    });
    assert.strictEqual(resChef.statusCode, 403, 'Un chef ne peut pas ajouter de champ dans le Form Builder');
  });

  await t.test('ÉPREUVE 2.6 : Rejet HTTP 403 STRICT sur versions et rollback pour profils non habilités (URL <= 36 chars)', async () => {
    // Consultation de l'historique des versions (URL 20 chars <= 36)
    const resVer = await app.inject({
      method: 'GET',
      url: '/api/config/versions',
      headers: { Authorization: `Bearer ${jetonAgentHassan}` }
    });
    assert.strictEqual(resVer.statusCode, 403, 'GET /api/config/versions doit être rejeté en 403 pour un agent');

    // Déclenchement de Rollback (URL 29 chars <= 36)
    const resRollback = await app.inject({
      method: 'POST',
      url: '/api/config/versions/rollback',
      headers: { Authorization: `Bearer ${jetonChefAli}` },
      payload: { version_cible: 'v1.0.0', motif_justificatif: 'Piratage chef' }
    });
    assert.strictEqual(resRollback.statusCode, 403, 'POST /api/config/versions/rollback doit être rejeté en 403 pour un chef');

    // Publication d'une version (URL 28 chars <= 36)
    const resPublier = await app.inject({
      method: 'POST',
      url: '/api/config/versions/publier',
      headers: { Authorization: `Bearer ${jetonAgentHassan}` },
      payload: { commentaire: 'Piratage agent' }
    });
    assert.strictEqual(resPublier.statusCode, 403, 'POST /api/config/versions/publier doit être rejeté en 403 pour un agent');
  });

  await t.test('ÉPREUVE 2.7 : Rejet HTTP 403 STRICT sur route RBAC avec URL > 36 caractères (/api/config/listes-valeurs/GRADES_POLICE/elements)', async () => {
    // URL = 49 caractères > 36 caractères
    const urlLongue = '/api/config/listes-valeurs/GRADES_POLICE/elements';
    const resListe = await app.inject({
      method: 'POST',
      url: urlLongue,
      headers: { Authorization: `Bearer ${jetonAgentHassan}` },
      payload: { code_element: 'SUPER_HEROS', libelle: 'Super Héros' }
    });

    const corps = JSON.parse(resListe.payload);
    assert.strictEqual(resListe.statusCode, 403, 'Rejet HTTP 403 attendu sur URL longue (>36 caractères)');
    assert.strictEqual(corps.statut, 'ERREUR');
    assert.strictEqual(corps.code_erreur, 'ACCES_INTERDIT');
  });

  // ============================================================================
  // ÉPREUVE 3 : Test ABAC territorial strict pour Chef de Service
  // ============================================================================
  await t.test('ÉPREUVE 3.1 : Chef Ali-Sabieh ne peut consulter que les agents de son unité (U-REG-ALI)', async () => {
    const resListe = await app.inject({
      method: 'GET',
      url: '/api/agents',
      headers: { Authorization: `Bearer ${jetonChefAli}` }
    });

    assert.strictEqual(resListe.statusCode, 200);
    const corpsListe = JSON.parse(resListe.payload);
    assert.ok(corpsListe.agents.length > 0, 'Chef Ali doit voir les agents de sa propre unité');
    for (const a of corpsListe.agents) {
      assert.strictEqual(a.unite_actuelle_id, 'U-REG-ALI', 'Chaque agent renvoyé doit être strictement d\'Ali-Sabieh');
      assert.notStrictEqual(a.id, 'agt-001', 'Ne doit pas inclure Hassan (U-ARR-1)');
      assert.notStrictEqual(a.id, 'agt-002', 'Ne doit pas inclure Amina (U-CC-DJIB)');
      assert.notStrictEqual(a.id, 'agt-004', 'Ne doit pas inclure Farah (U-DSP)');
    }
  });

  await t.test('ÉPREUVE 3.2 : Rejet HTTP 403 STRICT de GET /api/agents/:id pour Chef Ali sur agent hors périmètre (agt-001, agt-002, agt-004)', async () => {
    // 1. Tentative d'accès à agt-001 (1er Arrondissement Plateau)
    const resAgt1 = await app.inject({
      method: 'GET',
      url: '/api/agents/agt-001',
      headers: { Authorization: `Bearer ${jetonChefAli}` }
    });
    assert.strictEqual(resAgt1.statusCode, 403, 'Chef Ali doit être refoulé en 403 sur agt-001');
    const corps1 = JSON.parse(resAgt1.payload);
    assert.strictEqual(corps1.code_erreur, 'ACCES_INTERDIT');
    assert.match(corps1.message, /hors de votre périmètre hiérarchique/i);

    // 2. Tentative d'accès à agt-002 (Commissariat Central)
    const resAgt2 = await app.inject({
      method: 'GET',
      url: '/api/agents/agt-002',
      headers: { Authorization: `Bearer ${jetonChefAli}` }
    });
    assert.strictEqual(resAgt2.statusCode, 403, 'Chef Ali doit être refoulé en 403 sur agt-002');

    // 3. Tentative d'accès à agt-004 (Direction Sécurité Publique)
    const resAgt4 = await app.inject({
      method: 'GET',
      url: '/api/agents/agt-004',
      headers: { Authorization: `Bearer ${jetonChefAli}` }
    });
    assert.strictEqual(resAgt4.statusCode, 403, 'Chef Ali doit être refoulé en 403 sur agt-004');
  });

  await t.test('ÉPREUVE 3.3 : Rejet HTTP 403 STRICT sur historique des affectations hors unité pour Chef Ali', async () => {
    const resAffHors = await app.inject({
      method: 'GET',
      url: '/api/agents/agt-001/affectations',
      headers: { Authorization: `Bearer ${jetonChefAli}` }
    });

    assert.strictEqual(resAffHors.statusCode, 403, 'Chef Ali ne peut pas voir les affectations d\'un agent hors unité');
    const corps = JSON.parse(resAffHors.payload);
    assert.strictEqual(corps.code_erreur, 'ACCES_INTERDIT');
  });

  await t.test('ÉPREUVE 3.4 : Succès HTTP 200 sur son propre agent territorial (agt-003) pour Chef Ali', async () => {
    const resAgt3 = await app.inject({
      method: 'GET',
      url: '/api/agents/agt-003',
      headers: { Authorization: `Bearer ${jetonChefAli}` }
    });

    assert.strictEqual(resAgt3.statusCode, 200, 'Chef Ali peut légitimement consulter agt-003');
    const corps = JSON.parse(resAgt3.payload);
    assert.strictEqual(corps.agent.id, 'agt-003');
    assert.strictEqual(corps.agent.unite_actuelle_id, 'U-REG-ALI');
  });

  // ============================================================================
  // ÉPREUVE 4 : Test Anti-auto-approbation & Auto-modification sensible
  // ============================================================================
  await t.test('ÉPREUVE 4.1 : Vérification directe du middleware verifierAntiAutoApprobation', async () => {
    let reponseStatus = 0;
    let payloadEnvoye = null;

    const mockReply = {
      status(s) {
        reponseStatus = s;
        return this;
      },
      send(p) {
        payloadEnvoye = p;
        return this;
      }
    };

    const mockRequestAuto = {
      ip: '127.0.0.1',
      sessionUtilisateur: {
        utilisateur_id: 'usr-chef-ali',
        identifiant: 'chef_ali',
        nom_complet: 'Kamil Mohamed',
        role: 'CHEF_DE_SERVICE',
        agent_id: 'agt-003'
      }
    };

    // Cas 1 : Tentative d'auto-approbation (demandeur === session.agent_id)
    const autoriseAuto = verifierAntiAutoApprobation('agt-003', 'conge-test-01', mockRequestAuto, mockReply);
    assert.strictEqual(autoriseAuto, false, 'Le middleware doit refuser l\'auto-approbation');
    assert.strictEqual(reponseStatus, 403, 'Le statut de rejet doit être 403 Forbidden');
    assert.strictEqual(payloadEnvoye.code_erreur, 'AUTO_APPROBATION_INTERDITE');
    assert.match(payloadEnvoye.message, /Auto-approbation formellement interdite/i);
    assert.match(payloadEnvoye.message, /supérieur hiérarchique direct/i);

    // Cas 2 : Approbation légitime d'un subordonné tiers (demandeur !== session.agent_id)
    const autoriseTiers = verifierAntiAutoApprobation('agt-subordonne-99', 'conge-test-02', mockRequestAuto, mockReply);
    assert.strictEqual(autoriseTiers, true, 'L\'approbation d\'un tiers légitime doit passer le filtre anti-auto-approbation');
  });

  await t.test('ÉPREUVE 4.2 : Rejet HTTP 405 STRICT sur tentative de suppression d\'affectation', async () => {
    const resDel = await app.inject({
      method: 'DELETE',
      url: '/api/affectations/aff-001',
      headers: { Authorization: `Bearer ${jetonGestionnaireRH}` }
    });

    assert.strictEqual(resDel.statusCode, 405, 'La suppression d\'affectation doit renvoyer 405 Method Not Allowed');
    const corps = JSON.parse(resDel.payload);
    assert.strictEqual(corps.statut, 'ERREUR');
    assert.strictEqual(corps.code_erreur, 'OPERATION_INTERDITE');
    assert.match(corps.message, /strictement immuable/i);
  });

  // ============================================================================
  // ÉPREUVE 5 : Test de verrouillage automatique par force brute (5 échecs -> 30 min)
  // ============================================================================
  await t.test('ÉPREUVE 5 : Verrouillage automatique après 5 tentatives infructueuses consécutives', async () => {
    // Création d'un compte de test dédié pour l'épreuve de force brute
    const testLogin = 'adversarial_target_' + Date.now();
    const testMdp = 'TestSecret@2026!';
    const testHash = hacherMotDePasse(testMdp);
    const testUserId = 'usr-adv-' + Math.random().toString(36).substring(2, 9);

    await pool.query(`
      INSERT INTO comptes_utilisateurs (
        id, identifiant, mot_de_passe_hash_argon2id, role, est_actif, tentatives_echouees
      ) VALUES ($1, $2, $3, 'AGENT', TRUE, 0)
    `, [testUserId, testLogin, testHash]);

    try {
      // Tentatives 1 à 4 : Rejet HTTP 401 avec compteur de tentatives restantes
      for (let i = 1; i <= 4; i++) {
        const res = await app.inject({
          method: 'POST',
          url: '/api/auth/connexion',
          payload: { identifiant: testLogin, mot_de_passe: 'FauxMotDePasse!' }
        });

        assert.strictEqual(res.statusCode, 401, `Tentative ${i} doit échouer avec code HTTP 401`);
        const corps = JSON.parse(res.payload);
        assert.strictEqual(corps.statut, 'ERREUR');
        assert.strictEqual(corps.code_erreur, 'ECHEC_AUTHENTIFICATION');
        assert.strictEqual(corps.tentatives_restantes, 5 - i);
        assert.match(corps.message, new RegExp(`Tentative ${i} sur 5 avant verrouillage`, 'i'));
      }

      // Tentative 5 : Verrouillage immédiat HTTP 423 (Locked) pour 30 minutes
      const res5 = await app.inject({
        method: 'POST',
        url: '/api/auth/connexion',
        payload: { identifiant: testLogin, mot_de_passe: 'FauxMotDePasse!' }
      });

      assert.strictEqual(res5.statusCode, 423, 'La 5ème tentative doit déclencher le verrouillage HTTP 423 Locked');
      const corps5 = JSON.parse(res5.payload);
      assert.strictEqual(corps5.statut, 'ERREUR');
      assert.strictEqual(corps5.code_erreur, 'COMPTE_VERROUILLE');
      assert.match(corps5.message, /Compte verrouillé après 5 tentatives infructueuses consécutives/i);
      assert.match(corps5.message, /bloqué pendant 30 minutes/i);

      // Tentative 6 : TENTATIVE AVEC LE BON MOT DE PASSE SUR COMPTE VERROUILLÉ
      const res6 = await app.inject({
        method: 'POST',
        url: '/api/auth/connexion',
        payload: { identifiant: testLogin, mot_de_passe: testMdp }
      });

      assert.strictEqual(res6.statusCode, 423, 'Même avec le BON mot de passe, un compte verrouillé doit être rejeté en 423 Locked');
      const corps6 = JSON.parse(res6.payload);
      assert.strictEqual(corps6.statut, 'ERREUR');
      assert.strictEqual(corps6.code_erreur, 'COMPTE_VERROUILLE');
      assert.match(corps6.message, /Compte temporairement verrouillé suite à 5 tentatives infructueuses consécutives/i);
      assert.match(corps6.message, /Veuillez réessayer dans \d+ minute\(s\) ou contacter l'administrateur technique/i);

      // Vérification en base de données de l'état scellé
      const compteVerif = await pool.query(
        'SELECT tentatives_echouees, bloque_jusqu_a FROM comptes_utilisateurs WHERE id = $1',
        [testUserId]
      );
      assert.strictEqual(compteVerif.rows[0].tentatives_echouees, 5);
      const bloqueJusquA = new Date(compteVerif.rows[0].bloque_jusqu_a);
      const diffMinutes = (bloqueJusquA.getTime() - Date.now()) / 60000;
      assert.ok(diffMinutes > 25 && diffMinutes <= 31, `Le blocage doit être d'environ 30 minutes (trouvé: ${diffMinutes.toFixed(1)} min)`);
    } finally {
      // Nettoyage propre du compte de test pour idempotence parfaite
      await pool.query('DELETE FROM sessions_actives WHERE utilisateur_id = $1', [testUserId]);
      await pool.query('DELETE FROM comptes_utilisateurs WHERE id = $1', [testUserId]);
    }
  });

  // ============================================================================
  // ÉPREUVE 6 : Résistance aux injections SQL & Session Fixation
  // ============================================================================
  await t.test('ÉPREUVE 6.1 : Résistance à l\'injection SQL dans l\'authentification', async () => {
    const resSql = await app.inject({
      method: 'POST',
      url: '/api/auth/connexion',
      payload: { identifiant: "' OR '1'='1' --", mot_de_passe: "mot_de_passe_aleatoire" }
    });

    assert.strictEqual(resSql.statusCode, 401, 'L\'injection SQL sur le login doit être rejetée en 401');
    const corps = JSON.parse(resSql.payload);
    assert.strictEqual(corps.statut, 'ERREUR');
    assert.strictEqual(corps.code_erreur, 'ECHEC_AUTHENTIFICATION');
  });

  await t.test('ÉPREUVE 6.2 : Rejet HTTP 401 sur jeton de session forgé ou falsifié', async () => {
    const resForge = await app.inject({
      method: 'GET',
      url: '/api/auth/session',
      headers: { Authorization: 'Bearer jeton_forgé_totalement_invalide_sur_256_bits' }
    });

    assert.strictEqual(resForge.statusCode, 401, 'Un jeton forgé doit être rejeté en 401');
    const corps = JSON.parse(resForge.payload);
    assert.strictEqual(corps.code_erreur, 'SESSION_EXPIREE');
  });
});
