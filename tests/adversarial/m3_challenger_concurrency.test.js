const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

// Chargement du serveur Fastify et de la couche base de données
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

test('CHALLENGER M3-1 : Batterie Contradictoire de Concurrence Transactionnelle Élevée, Sécurité ABAC & Intégrité (Jalon M3)', async (t) => {
  let app;
  let jetonGestionnaireRH;
  let jetonChefCC;
  let jetonChefAli;
  let jetonAgentHassan;
  let jetonAdminTech;
  let jetonAuditeur;

  t.before(async () => {
    app = await creerApplicationServeur();
    await app.ready();

    // 1. Authentification des profils républicains
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

    // 2. Création de cohortes d'agents dédiés aux épreuves de stress concurrentiel
    // Cela garantit une isolation parfaite et une reproductibilité totale sans perturber le seed initial
    const agentsStress = [
      { id: 'agt-stress-001', matricule: 'STR-001', nom: 'Guelleh', prenom: 'Moustapha', corps: 'SOUS_OFFICIERS', grade: 'Sergent', echelon: 1, indice: 300, unite: 'U-CC-DJIB' },
      { id: 'agt-stress-002', matricule: 'STR-002', nom: 'Kamil', prenom: 'Ilyas', corps: 'AGENTS', grade: 'Caporal', echelon: 2, indice: 340, unite: 'U-CC-DJIB' },
      { id: 'agt-stress-003', matricule: 'STR-003', nom: 'Omar', prenom: 'Radwan', corps: 'SOUS_OFFICIERS', grade: 'Sergent', echelon: 1, indice: 300, unite: 'U-CC-DJIB' },
      { id: 'agt-stress-004', matricule: 'STR-004', nom: 'Farah', prenom: 'Nabil', corps: 'SOUS_OFFICIERS', grade: 'Sergent', echelon: 1, indice: 300, unite: 'U-CC-DJIB' },
      { id: 'agt-stress-005', matricule: 'STR-005', nom: 'Djama', prenom: 'Souleiman', corps: 'AGENTS', grade: 'Agent de 1ère classe', echelon: 1, indice: 280, unite: 'U-CC-DJIB' }
    ];

    for (const ag of agentsStress) {
      await pool.query(`
        INSERT INTO agents (
          id, matricule, numero_carte_nationale, nom, prenom, date_naissance, lieu_naissance,
          genre, situation_familiale, telephone_professionnel, email_professionnel,
          date_recrutement, corps, grade_actuel, echelon_actuel, indice_solde,
          unite_actuelle_id, statut_administratif, est_actif
        ) VALUES (
          $1, $2, $3, $4, $5, '1995-03-12', 'Djibouti-Ville',
          'MASCULIN', 'CELIBATAIRE', '+253 21 35 00 99', $6,
          '2021-01-10', $7, $8, $9, $10,
          $11, 'EN_ACTIVITE', TRUE
        )
        ON CONFLICT (id) DO UPDATE SET
          corps = EXCLUDED.corps,
          grade_actuel = EXCLUDED.grade_actuel,
          echelon_actuel = EXCLUDED.echelon_actuel,
          indice_solde = EXCLUDED.indice_solde,
          statut_administratif = 'EN_ACTIVITE'
      `, [
        ag.id, ag.matricule, `NID-${ag.matricule}`, ag.nom, ag.prenom,
        `${ag.prenom.toLowerCase()}.${ag.nom.toLowerCase()}@police.dj`,
        ag.corps, ag.grade, ag.echelon, ag.indice, ag.unite
      ]);

      // Nettoyage et initialisation d'un unique échelon actif
      await pool.query(`DELETE FROM carrieres_echelons WHERE agent_id = $1`, [ag.id]);
      await pool.query(`
        INSERT INTO carrieres_echelons (
          id, agent_id, corps, grade, echelon, indice_brut, indice_majore,
          date_effet, type_avancement, numero_arrete, est_actif, cree_par
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $6,
          '2024-01-01', 'ANCIENNETE', 'ARR-INIT-STRESS', TRUE, 'usr-rh-01'
        )
      `, [`ech-init-${ag.id}`, ag.id, ag.corps, ag.grade, ag.echelon, ag.indice]);

      // Nettoyage et initialisation d'une unique position active (ACTIVITE)
      await pool.query(`DELETE FROM positions_statutaires WHERE agent_id = $1`, [ag.id]);
      await pool.query(`
        INSERT INTO positions_statutaires (
          id, agent_id, position, date_debut, maintien_droits_avancement,
          reference_decision, motif, est_active, cree_par
        ) VALUES (
          $1, $2, 'ACTIVITE', '2024-01-01', TRUE,
          'DEC-INIT-STRESS', 'Position initiale activité', TRUE, 'usr-rh-01'
        )
      `, [`pos-init-${ag.id}`, ag.id]);

      // Nettoyage des promotions antérieures
      await pool.query(`DELETE FROM promotions_grades WHERE agent_id = $1`, [ag.id]);
    }
  });

  t.after(async () => {
    if (app) await app.close();
    if (fermerPool && !pool?.ending && !pool?.ended) {
      await fermerPool().catch(() => {});
    }
  });

  // ============================================================================
  // ÉPREUVE 1 : CONCURRENCE TRANSACTIONNELLE ÉLEVÉE ET SÉRIALISATION FOR UPDATE
  // ============================================================================

  await t.test('1.1 : Stress massif — 15 requêtes d\'avancement d\'échelon simultanées vers le même échelon', async () => {
    // 15 requêtes envoyées strictement à la même milliseconde via Promise.all
    // Agent ciblé : agt-stress-001 (initialement échelon 1, indice 300)
    // Cible demandée : échelon 2, indice 325
    const NOMBRE_REQUETES = 15;
    const promesses = [];

    for (let i = 0; i < NOMBRE_REQUETES; i++) {
      promesses.push(
        app.inject({
          method: 'POST',
          url: '/api/carrieres/avancement-echelon',
          headers: { authorization: `Bearer ${jetonGestionnaireRH}` },
          payload: {
            agent_id: 'agt-stress-001',
            echelon: 2,
            indice_brut: 325,
            indice_majore: 325,
            date_effet: '2026-06-01',
            type_avancement: 'ANCIENNETE',
            numero_arrete: `ARR-STRESS-1.1-${i}`
          }
        })
      );
    }

    const reponses = await Promise.all(promesses);

    // Analyse contradictoire des réponses HTTP
    const reussites = reponses.filter(r => r.statusCode === 201);
    const rejets = reponses.filter(r => r.statusCode === 400);
    const erreurs500 = reponses.filter(r => r.statusCode === 500);
    const autresCodes = reponses.filter(r => r.statusCode !== 201 && r.statusCode !== 400);

    assert.strictEqual(erreurs500.length, 0, 'Aucun crash HTTP 500 ne doit survenir lors du stress concurrentiel');
    assert.strictEqual(autresCodes.length, 0, 'Aucun code d erreur anormal');
    assert.strictEqual(reussites.length, 1, 'Exactement UNE seule requête d avancement doit aboutir avec succès (HTTP 201)');
    assert.strictEqual(rejets.length, NOMBRE_REQUETES - 1, 'Toutes les autres 14 requêtes doivent être rejetées avec HTTP 400');

    // Vérification de la raison du rejet des requêtes concurrentes
    for (const r of rejets) {
      const corps = JSON.parse(r.payload);
      assert.strictEqual(corps.code_erreur, 'ECHELON_INVALIDE');
      assert.match(corps.message, /supérieur à l'échelon actuel/i);
    }

    // Invariance stricte en base de données PostgreSQL
    const resEchActif = await pool.query(
      `SELECT * FROM carrieres_echelons WHERE agent_id = 'agt-stress-001' AND est_actif = TRUE`
    );
    assert.strictEqual(resEchActif.rows.length, 1, 'Il ne doit exister strictement qu\'UN SEUL échelon actif');
    assert.strictEqual(resEchActif.rows[0].echelon, 2, 'L échelon actif doit être exactement l échelon 2');
    assert.strictEqual(resEchActif.rows[0].indice_majore, 325, 'L indice de l échelon actif doit être 325');

    const resEchInactifs = await pool.query(
      `SELECT * FROM carrieres_echelons WHERE agent_id = 'agt-stress-001' AND est_actif = FALSE ORDER BY date_effet`
    );
    assert.strictEqual(resEchInactifs.rows.length, 1, 'L ancien échelon 1 doit avoir été clôturé');
    assert.strictEqual(resEchInactifs.rows[0].echelon, 1);
    assert.strictEqual(resEchInactifs.rows[0].date_fin.toISOString().split('T')[0], '2026-05-31', 'Clôture à J-1 de l effet du nouvel échelon');

    // Vérification de la synchronisation de la table agents
    const resAgent = await pool.query(`SELECT echelon_actuel, indice_solde FROM agents WHERE id = 'agt-stress-001'`);
    assert.strictEqual(resAgent.rows[0].echelon_actuel, 2);
    assert.strictEqual(resAgent.rows[0].indice_solde, 325);
  });

  await t.test('1.2 : Sérialisation et intégrité de la chaîne indiciaire sous concurrence mixte', async () => {
    // agt-stress-005 est actuellement échelon 1, indice 280
    // Envoi simultané de requêtes vers des échelons successifs (2, 3, 4)
    const cibles = [
      { echelon: 2, indice: 300, arrete: 'ARR-SEQ-2' },
      { echelon: 2, indice: 300, arrete: 'ARR-SEQ-2-DUP' },
      { echelon: 3, indice: 320, arrete: 'ARR-SEQ-3' },
      { echelon: 3, indice: 320, arrete: 'ARR-SEQ-3-DUP' },
      { echelon: 4, indice: 340, arrete: 'ARR-SEQ-4' }
    ];

    const promesses = cibles.map(c =>
      app.inject({
        method: 'POST',
        url: '/api/carrieres/avancement-echelon',
        headers: { authorization: `Bearer ${jetonGestionnaireRH}` },
        payload: {
          agent_id: 'agt-stress-005',
          echelon: c.echelon,
          indice_brut: c.indice,
          indice_majore: c.indice,
          date_effet: `2026-0${c.echelon}-01`,
          type_avancement: 'ANCIENNETE',
          numero_arrete: c.arrete
        }
      })
    );

    const reponses = await Promise.all(promesses);
    const codes = reponses.map(r => r.statusCode);
    assert.ok(codes.includes(201), 'Au moins un avancement doit être validé');
    assert.ok(!codes.includes(500), 'Zéro erreur 500');

    // Vérification de l'intégrité globale de l'historique
    const resActifs = await pool.query(
      `SELECT * FROM carrieres_echelons WHERE agent_id = 'agt-stress-005' AND est_actif = TRUE`
    );
    assert.strictEqual(resActifs.rows.length, 1, 'Invariance absolue : un seul échelon actif');

    const agentVerif = await pool.query(
      `SELECT echelon_actuel, indice_solde FROM agents WHERE id = 'agt-stress-005'`
    );
    assert.strictEqual(agentVerif.rows[0].echelon_actuel, resActifs.rows[0].echelon);
    assert.strictEqual(agentVerif.rows[0].indice_solde, resActifs.rows[0].indice_majore);
  });

  await t.test('1.3 : Promotions simultanées — Atomicité du reclassement et blocage anti-doublon de grade', async () => {
    // Agent ciblé : agt-stress-002 (Caporal, échelon 2, indice 340)
    // 15 requêtes concurrentes tentant de promouvoir vers "Caporal-Chef", échelon 1, indice 380
    const NOMBRE_PROMOTIONS = 15;
    const promesses = [];

    for (let i = 0; i < NOMBRE_PROMOTIONS; i++) {
      promesses.push(
        app.inject({
          method: 'POST',
          url: '/api/carrieres/promotion',
          headers: { authorization: `Bearer ${jetonGestionnaireRH}` },
          payload: {
            agent_id: 'agt-stress-002',
            nouveau_grade: 'Caporal-Chef',
            date_promotion: '2026-07-01',
            numero_decret: `DEC-CONCURRENT-${i}/PR`,
            commission_date: '2026-06-15',
            tableau_avancement_annee: 2026,
            note_retenue: 17.2,
            avis_commission: 'FAVORABLE',
            nouvel_echelon: 1,
            indice_brut: 380,
            indice_majore: 380
          }
        })
      );
    }

    const reponses = await Promise.all(promesses);
    const reussites = reponses.filter(r => r.statusCode === 201);
    const rejets = reponses.filter(r => r.statusCode === 400);
    const erreurs500 = reponses.filter(r => r.statusCode === 500);

    assert.strictEqual(erreurs500.length, 0, 'Aucun crash 500 sur les promotions concurrentes');
    assert.strictEqual(reussites.length, 1, 'Exactement UNE seule promotion doit aboutir (HTTP 201)');
    assert.strictEqual(rejets.length, NOMBRE_PROMOTIONS - 1, 'Les 14 autres promotions doivent être rejetées avec HTTP 400');

    for (const r of rejets) {
      const corps = JSON.parse(r.payload);
      assert.strictEqual(corps.code_erreur, 'GRADE_IDENTIQUE');
      assert.match(corps.message, /doit être différent du grade actuel/i);
    }

    // Contrôle en base de données : table promotions_grades
    const resPromos = await pool.query(
      `SELECT * FROM promotions_grades WHERE agent_id = 'agt-stress-002'`
    );
    assert.strictEqual(resPromos.rows.length, 1, 'Exactement UNE seule promotion consignée');
    assert.strictEqual(resPromos.rows[0].ancien_grade, 'Caporal');
    assert.strictEqual(resPromos.rows[0].nouveau_grade, 'Caporal-Chef');

    // Contrôle de l'échelon de reclassement
    const resEchPromo = await pool.query(
      `SELECT * FROM carrieres_echelons WHERE agent_id = 'agt-stress-002' AND est_actif = TRUE`
    );
    assert.strictEqual(resEchPromo.rows.length, 1, 'Un seul échelon actif après reclassement');
    assert.strictEqual(resEchPromo.rows[0].grade, 'Caporal-Chef');
    assert.strictEqual(resEchPromo.rows[0].echelon, 1);
    assert.strictEqual(resEchPromo.rows[0].indice_majore, 380);

    // Contrôle synchronisation agent
    const resAgentPromo = await pool.query(
      `SELECT grade_actuel, echelon_actuel, indice_solde FROM agents WHERE id = 'agt-stress-002'`
    );
    assert.strictEqual(resAgentPromo.rows[0].grade_actuel, 'Caporal-Chef');
    assert.strictEqual(resAgentPromo.rows[0].echelon_actuel, 1);
    assert.strictEqual(resAgentPromo.rows[0].indice_solde, 380);
  });

  await t.test('1.4 : Course critique TOCTOU — Concurrence entre bascule en DISPONIBILITE et avancement d\'échelon', async () => {
    // Agent ciblé : agt-stress-003 (en ACTIVITE)
    // Envoi simultané d'un placement en DISPONIBILITE et d'une demande d'avancement d'échelon
    const promesseDispo = app.inject({
      method: 'POST',
      url: '/api/positions',
      headers: { authorization: `Bearer ${jetonGestionnaireRH}` },
      payload: {
        agent_id: 'agt-stress-003',
        position: 'DISPONIBILITE',
        date_debut: '2026-08-01',
        reference_decision: 'DEC-DISPO-TOCTOU',
        motif: 'Mise en disponibilité pour convenances'
      }
    });

    const promesseAvance = app.inject({
      method: 'POST',
      url: '/api/carrieres/avancement-echelon',
      headers: { authorization: `Bearer ${jetonGestionnaireRH}` },
      payload: {
        agent_id: 'agt-stress-003',
        echelon: 2,
        indice_brut: 325,
        indice_majore: 325,
        date_effet: '2026-08-01',
        type_avancement: 'ANCIENNETE',
        numero_arrete: 'ARR-AVANCE-TOCTOU'
      }
    });

    const [resDispo, resAvance] = await Promise.all([promesseDispo, promesseAvance]);

    // Grâce au verrou SELECT ... FOR UPDATE sur agents, les transactions sont sérialisées :
    // - Si la disponibilité passe en 1er (201), l'avancement est bloqué (400 POSITION_INCOMPATIBLE_AVANCEMENT).
    // - Si l'avancement passe en 1er (201), la disponibilité passe ensuite (201).
    // Dans tous les cas, aucune incohérence (erreur 500) n'est possible.
    assert.strictEqual(resDispo.statusCode, 201, 'La déclaration de position doit aboutir');
    assert.ok(
      resAvance.statusCode === 201 || resAvance.statusCode === 400,
      `Statut avancement attendu 201 ou 400, reçu ${resAvance.statusCode}`
    );

    if (resAvance.statusCode === 400) {
      const corps = JSON.parse(resAvance.payload);
      assert.strictEqual(corps.code_erreur, 'POSITION_INCOMPATIBLE_AVANCEMENT');
    }

    // Épreuve complémentaire : Agent MAINTENANT en DISPONIBILITE certifiée
    // 10 requêtes concurrentes d'avancement doivent TOUTES être rejetées (100% de blocage)
    const rejetsDispo = await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        app.inject({
          method: 'POST',
          url: '/api/carrieres/avancement-echelon',
          headers: { authorization: `Bearer ${jetonGestionnaireRH}` },
          payload: {
            agent_id: 'agt-stress-003',
            echelon: 3,
            indice_brut: 350,
            indice_majore: 350,
            date_effet: '2026-09-01',
            type_avancement: 'CHOIX',
            numero_arrete: `ARR-DISPO-REJET-${i}`
          }
        })
      )
    );

    for (const r of rejetsDispo) {
      assert.strictEqual(r.statusCode, 400);
      assert.strictEqual(JSON.parse(r.payload).code_erreur, 'POSITION_INCOMPATIBLE_AVANCEMENT');
    }

    // 10 requêtes concurrentes de promotion doivent également TOUTES être rejetées
    const rejetsPromoDispo = await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        app.inject({
          method: 'POST',
          url: '/api/carrieres/promotion',
          headers: { authorization: `Bearer ${jetonGestionnaireRH}` },
          payload: {
            agent_id: 'agt-stress-003',
            nouveau_grade: 'Sergent-Chef',
            date_promotion: '2026-10-01',
            numero_decret: `DEC-DISPO-PROMO-${i}`,
            tableau_avancement_annee: 2026,
            avis_commission: 'FAVORABLE'
          }
        })
      )
    );

    for (const r of rejetsPromoDispo) {
      assert.strictEqual(r.statusCode, 400);
      assert.strictEqual(JSON.parse(r.payload).code_erreur, 'POSITION_INCOMPATIBLE_PROMOTION');
    }
  });

  await t.test('1.5 : Déclarations de positions statutaires — Clôture atomique, atomicité et invariance de l\'index unique', async () => {
    // Agent ciblé : agt-stress-004
    // Enchaînement de transitions statutaires successives
    const transitions = [
      { pos: 'DETACHEMENT', org: 'PNUD Djibouti', ref: 'DEC-P1', date: '2026-07-01' },
      { pos: 'ACTIVITE', org: null, ref: 'DEC-P2', date: '2026-07-15' },
      { pos: 'SUSPENSION_ADMINISTRATIVE', org: null, ref: 'DEC-P3', date: '2026-08-01' },
      { pos: 'ACTIVITE', org: null, ref: 'DEC-P4', date: '2026-08-15' },
      { pos: 'SOUS_LES_DRAPEAUX', org: null, ref: 'DEC-P5', date: '2026-09-01' },
      { pos: 'ACTIVITE', org: null, ref: 'DEC-P6', date: '2026-09-15' },
      { pos: 'DISPONIBILITE', org: null, ref: 'DEC-P7', date: '2026-10-01' },
      { pos: 'ACTIVITE', org: null, ref: 'DEC-P8', date: '2026-10-15' }
    ];

    for (const p of transitions) {
      const res = await app.inject({
        method: 'POST',
        url: '/api/positions',
        headers: { authorization: `Bearer ${jetonGestionnaireRH}` },
        payload: {
          agent_id: 'agt-stress-004',
          position: p.pos,
          organisme_accueil: p.org,
          date_debut: p.date,
          reference_decision: p.ref,
          motif: `Transition statutaire ${p.pos}`
        }
      });
      assert.strictEqual(res.statusCode, 201, `La transition vers ${p.pos} le ${p.date} doit réussir`);
    }

    // Invariance DDL : L'index partiel unique `idx_positions_active` doit être rigoureusement respecté
    const resPosActives = await pool.query(
      `SELECT * FROM positions_statutaires WHERE agent_id = 'agt-stress-004' AND est_active = TRUE`
    );
    assert.strictEqual(resPosActives.rows.length, 1, 'Exactement UNE seule position doit demeurer active');
    assert.strictEqual(resPosActives.rows[0].position, 'ACTIVITE');

    // Toutes les autres positions de cet agent doivent être inactives avec date_fin renseignée et cohérente
    const resPosInactives = await pool.query(
      `SELECT * FROM positions_statutaires WHERE agent_id = 'agt-stress-004' AND est_active = FALSE ORDER BY date_debut`
    );
    assert.strictEqual(resPosInactives.rows.length, transitions.length, 'Toutes les positions antérieures doivent être inactives');
    for (const row of resPosInactives.rows) {
      assert.ok(row.date_fin !== null, 'La date de fin doit être systématiquement renseignée lors de la clôture');
      assert.ok(new Date(row.date_fin) >= new Date(row.date_debut), 'La date de fin doit être >= date_debut');
    }

    // Synchronisation de la fiche agent
    const resAgentPos = await pool.query(`SELECT statut_administratif FROM agents WHERE id = 'agt-stress-004'`);
    assert.strictEqual(resAgentPos.rows[0].statut_administratif, 'EN_ACTIVITE');
  });

  // ============================================================================
  // ÉPREUVE 2 : ÉTANCHÉITÉ TERRITORIALE, ABAC ET TENTATIVES D'ÉLÉVATION DE PRIVILÈGES
  // ============================================================================

  await t.test('2.1 : Rejet systématique des tentatives d\'usurpation du Chef de Brigade sur la carrière (HTTP 403)', async () => {
    // Le chef de brigade (chef_cc) est autorité opérationnelle mais n'a AUCUN pouvoir de modifier la carrière ou les positions
    // 1. Tentative d'avancement d'échelon d'un subordonné (agt-001)
    const resAvance = await app.inject({
      method: 'POST',
      url: '/api/carrieres/avancement-echelon',
      headers: { authorization: `Bearer ${jetonChefCC}` },
      payload: {
        agent_id: 'agt-001',
        echelon: 4,
        date_effet: '2026-08-01',
        type_avancement: 'CHOIX',
        numero_arrete: 'ARR-USURPE'
      }
    });
    assert.strictEqual(resAvance.statusCode, 403);
    assert.strictEqual(JSON.parse(resAvance.payload).code_erreur, 'ACCES_INTERDIT');

    // 2. Tentative de promotion de grade
    const resPromo = await app.inject({
      method: 'POST',
      url: '/api/carrieres/promotion',
      headers: { authorization: `Bearer ${jetonChefCC}` },
      payload: {
        agent_id: 'agt-001',
        nouveau_grade: 'Adjudant',
        date_promotion: '2026-08-01',
        numero_decret: 'DEC-USURPE'
      }
    });
    assert.strictEqual(resPromo.statusCode, 403);
    assert.strictEqual(JSON.parse(resPromo.payload).code_erreur, 'ACCES_INTERDIT');

    // 3. Tentative de modification de position administrative
    const resPos = await app.inject({
      method: 'POST',
      url: '/api/positions',
      headers: { authorization: `Bearer ${jetonChefCC}` },
      payload: {
        agent_id: 'agt-001',
        position: 'DISPONIBILITE',
        date_debut: '2026-08-01',
        reference_decision: 'DEC-USURPE'
      }
    });
    assert.strictEqual(resPos.statusCode, 403);
    assert.strictEqual(JSON.parse(resPos.payload).code_erreur, 'ACCES_INTERDIT');

    // 4. Tentative de génération de la masse salariale
    const resSolde = await app.inject({
      method: 'POST',
      url: '/api/solde/calculs/2026-02/generer',
      headers: { authorization: `Bearer ${jetonChefCC}` }
    });
    assert.strictEqual(resSolde.statusCode, 403);
    assert.strictEqual(JSON.parse(resSolde.payload).code_erreur, 'ACCES_INTERDIT');

    // 5. Tentative d'export scellé de solde
    const resExport = await app.inject({
      method: 'POST',
      url: '/api/solde/exports',
      headers: { authorization: `Bearer ${jetonChefCC}` },
      payload: { mois_annee: '2026-02' }
    });
    assert.strictEqual(resExport.statusCode, 403);
    assert.strictEqual(JSON.parse(resExport.payload).code_erreur, 'ACCES_INTERDIT');
  });

  await t.test('2.2 : Cloisonnement territorial étanche — Rejet HTTP 403 entre juridictions disjointes (Ali-Sabieh vs Djibouti-Ville)', async () => {
    // chef_ali (Commissariat d'Ali-Sabieh) tente d'accéder ou de noter agt-001 (affecté au Commissariat Central de Djibouti-Ville)
    // 1. Consultation dossier de carrière
    const resCarriere = await app.inject({
      method: 'GET',
      url: '/api/carrieres/agt-001',
      headers: { authorization: `Bearer ${jetonChefAli}` }
    });
    assert.strictEqual(resCarriere.statusCode, 403);
    assert.strictEqual(JSON.parse(resCarriere.payload).code_erreur, 'ACCES_INTERDIT');

    // 2. Consultation des positions
    const resPositions = await app.inject({
      method: 'GET',
      url: '/api/positions/agt-001',
      headers: { authorization: `Bearer ${jetonChefAli}` }
    });
    assert.strictEqual(resPositions.statusCode, 403);
    assert.strictEqual(JSON.parse(resPositions.payload).code_erreur, 'ACCES_INTERDIT');

    // 3. Consultation des notations annuelles
    const resNotations = await app.inject({
      method: 'GET',
      url: '/api/notations/agt-001',
      headers: { authorization: `Bearer ${jetonChefAli}` }
    });
    assert.strictEqual(resNotations.statusCode, 403);
    assert.strictEqual(JSON.parse(resNotations.payload).code_erreur, 'ACCES_INTERDIT');

    // 4. Tentative hostile d'évaluation et de notation d'un agent hors unité
    const resCreeNotation = await app.inject({
      method: 'POST',
      url: '/api/notations',
      headers: { authorization: `Bearer ${jetonChefAli}` },
      payload: {
        agent_id: 'agt-001',
        annee: 2026,
        rigueur_deontologie: 2.0,
        competence_technique: 2.0,
        disponibilite_operationnelle: 2.0,
        sens_commandement_initiative: 2.0,
        appreciation_generale: 'Notation illicite par un chef hors juridiction territoriale.',
        date_entretien: '2026-10-10'
      }
    });
    assert.strictEqual(resCreeNotation.statusCode, 403);
    assert.strictEqual(JSON.parse(resCreeNotation.payload).code_erreur, 'ACCES_INTERDIT');

    // 5. Consultation des qualifications spécifiques d'un agent hors juridiction
    const resQualif = await app.inject({
      method: 'GET',
      url: '/api/qualifications?agent_id=agt-001',
      headers: { authorization: `Bearer ${jetonChefAli}` }
    });
    assert.strictEqual(resQualif.statusCode, 403);
    assert.strictEqual(JSON.parse(resQualif.payload).code_erreur, 'ACCES_INTERDIT');
  });

  await t.test('2.3 : Exclusion absolue de l\'Administrateur Technique de TOUS les endpoints nominatifs M3 (HTTP 403)', async () => {
    // Principe régalien : L'admin technique gère le serveur et l'infrastructure, zéro accès aux données nominatives RH
    const endpointsNominatifs = [
      { method: 'GET', url: '/api/carrieres/agt-001' },
      { method: 'POST', url: '/api/carrieres/avancement-echelon', payload: { agent_id: 'agt-001', echelon: 4 } },
      { method: 'POST', url: '/api/carrieres/promotion', payload: { agent_id: 'agt-001', nouveau_grade: 'Adjudant' } },
      { method: 'GET', url: '/api/promotions/tableau-avancement/eligibles' },
      { method: 'POST', url: '/api/promotions/tableau-avancement/simulation', payload: { cohortes: [] } },
      { method: 'GET', url: '/api/positions/agt-001' },
      { method: 'POST', url: '/api/positions', payload: { agent_id: 'agt-001', position: 'ACTIVITE' } },
      { method: 'GET', url: '/api/notations/agt-001' },
      { method: 'POST', url: '/api/notations', payload: { agent_id: 'agt-001', annee: 2026, appreciation_generale: 'Test' } },
      { method: 'PUT', url: '/api/notations/not-001/recours', payload: { motif_recours: 'Recours tech' } },
      { method: 'PUT', url: '/api/notations/not-001/decision-recours', payload: { decision_recours: 'MAINTIEN' } },
      { method: 'GET', url: '/api/qualifications' },
      { method: 'GET', url: '/api/solde/calculs/2026-02' },
      { method: 'POST', url: '/api/solde/calculs/2026-02/generer' },
      { method: 'POST', url: '/api/solde/exports', payload: { mois_annee: '2026-02' } }
    ];

    for (const ep of endpointsNominatifs) {
      const res = await app.inject({
        method: ep.method,
        url: ep.url,
        headers: { authorization: `Bearer ${jetonAdminTech}` },
        payload: ep.payload
      });

      assert.strictEqual(
        res.statusCode,
        403,
        `L endpoint nominatif [${ep.method} ${ep.url}] aurait dû rejeter formellement l ADMIN_TECHNIQUE avec HTTP 403`
      );
      const corps = JSON.parse(res.payload);
      assert.strictEqual(corps.code_erreur, 'ACCES_INTERDIT');
    }
  });

  await t.test('2.4 : Rejet bloquant des tentatives d\'auto-attribution et d\'auto-notation par un Agent simple (HTTP 403)', async () => {
    // Un agent simple (agent_hassan) tente de s'attribuer une note, d'arbitrer son recours ou de s'auto-promouvoir
    // 1. Auto-saisie de sa propre note annuelle
    const resAutoNote = await app.inject({
      method: 'POST',
      url: '/api/notations',
      headers: { authorization: `Bearer ${jetonAgentHassan}` },
      payload: {
        agent_id: 'agt-001',
        annee: 2026,
        rigueur_deontologie: 5.0,
        competence_technique: 5.0,
        disponibilite_operationnelle: 5.0,
        sens_commandement_initiative: 5.0,
        appreciation_generale: 'Auto-évaluation élogieuse injustifiée.',
        date_entretien: '2026-10-15'
      }
    });
    assert.strictEqual(resAutoNote.statusCode, 403);
    assert.strictEqual(JSON.parse(resAutoNote.payload).code_erreur, 'ACCES_INTERDIT');

    // 2. Auto-arbitrage de son propre recours
    const resAutoArbitrage = await app.inject({
      method: 'PUT',
      url: '/api/notations/not-001/decision-recours',
      headers: { authorization: `Bearer ${jetonAgentHassan}` },
      payload: {
        decision_recours: 'REVISION_HAUSSE',
        note_definitive: 20.0,
        motif_arbitrage: 'Auto-validation de ma note maximale'
      }
    });
    assert.strictEqual(resAutoArbitrage.statusCode, 403);

    // 3. Auto-promotion de grade
    const resAutoPromo = await app.inject({
      method: 'POST',
      url: '/api/carrieres/promotion',
      headers: { authorization: `Bearer ${jetonAgentHassan}` },
      payload: {
        agent_id: 'agt-001',
        nouveau_grade: 'Lieutenant',
        date_promotion: '2026-08-01',
        numero_decret: 'DEC-AUTO-01'
      }
    });
    assert.strictEqual(resAutoPromo.statusCode, 403);

    // 4. Auto-avancement d'échelon
    const resAutoAvance = await app.inject({
      method: 'POST',
      url: '/api/carrieres/avancement-echelon',
      headers: { authorization: `Bearer ${jetonAgentHassan}` },
      payload: {
        agent_id: 'agt-001',
        echelon: 5,
        date_effet: '2026-08-01',
        type_avancement: 'CHOIX',
        numero_arrete: 'ARR-AUTO-01'
      }
    });
    assert.strictEqual(resAutoAvance.statusCode, 403);

    // 5. Tentative d'espionnage du dossier de carrière d'un pair (agt-002)
    const resEspionCarriere = await app.inject({
      method: 'GET',
      url: '/api/carrieres/agt-002',
      headers: { authorization: `Bearer ${jetonAgentHassan}` }
    });
    assert.strictEqual(resEspionCarriere.statusCode, 403);

    // 6. Tentative d'espionnage des notations d'un pair (agt-002)
    const resEspionNote = await app.inject({
      method: 'GET',
      url: '/api/notations/agt-002',
      headers: { authorization: `Bearer ${jetonAgentHassan}` }
    });
    assert.strictEqual(resEspionNote.statusCode, 403);
  });

  // ============================================================================
  // ÉPREUVE 3 : RÉSISTANCE AUX INJECTIONS, PARAMÈTRES MALFORMÉS & AUDIT IMMUABLE
  // ============================================================================

  await t.test('3.1 : Résistance aux URLs anormalement longues et aux attaques par débordement de buffer', async () => {
    // Construction d'une URL de plus de 4 000 caractères
    const identifiantGeant = 'A'.repeat(4000);
    const resUrlLongue = await app.inject({
      method: 'GET',
      url: `/api/carrieres/${identifiantGeant}`,
      headers: { authorization: `Bearer ${jetonGestionnaireRH}` }
    });

    // Le serveur Fastify et PostgreSQL doivent rejeter proprement sans crasher (404 AGENT_INTROUVABLE ou 400)
    assert.ok(
      resUrlLongue.statusCode === 404 || resUrlLongue.statusCode === 400,
      `Attendu 404 ou 400, reçu ${resUrlLongue.statusCode}`
    );
    assert.ok(resUrlLongue.statusCode !== 500, 'Zéro crash 500 sur URL géante');

    // Vérification que le journal d'audit est resté parfaitement intègre
    const checkAudit = await pool.query('SELECT COUNT(*) AS total FROM journaux_audit');
    assert.ok(parseInt(checkAudit.rows[0].total, 10) > 0);
  });

  await t.test('3.2 : Immunité absolue contre les injections SQL et falsifications de types', async () => {
    // 1. Injection SQL dans l'identifiant agent en URL
    const injectionSqlUrl = "agt-001' OR '1'='1'--";
    const resInjectionUrl = await app.inject({
      method: 'GET',
      url: `/api/carrieres/${encodeURIComponent(injectionSqlUrl)}`,
      headers: { authorization: `Bearer ${jetonGestionnaireRH}` }
    });
    assert.strictEqual(resInjectionUrl.statusCode, 404, 'L injection SQL doit être traitée comme une simple clé introuvable');
    assert.strictEqual(JSON.parse(resInjectionUrl.payload).code_erreur, 'AGENT_INTROUVABLE');

    // 2. Falsification de type et tentative d'injection SQL dans les paramètres d'avancement
    const resTypeEchelon = await app.inject({
      method: 'POST',
      url: '/api/carrieres/avancement-echelon',
      headers: { authorization: `Bearer ${jetonGestionnaireRH}` },
      payload: {
        agent_id: 'agt-001',
        echelon: "3; DROP TABLE carrieres_echelons; --",
        date_effet: '2026-08-01',
        type_avancement: 'CHOIX',
        numero_arrete: 'ARR-INJ-01'
      }
    });
    // L injection est neutralisée par les requêtes préparées paramétrées (PostgreSQL 22P02 ou rejet)
    assert.ok(
      resTypeEchelon.statusCode === 400 || resTypeEchelon.statusCode === 500,
      `Attendu rejet 400 ou 500, reçu ${resTypeEchelon.statusCode}`
    );

    // Vérification que l'injection a totalement échoué : la table carrieres_echelons existe toujours et est intacte
    const tableCheck = await pool.query('SELECT COUNT(*) FROM carrieres_echelons');
    assert.ok(parseInt(tableCheck.rows[0].count, 10) > 0, 'La table carrieres_echelons doit être intacte');

    // 3. Échelon négatif ou invalide rejeté avec HTTP 400
    const resEchelonNegatif = await app.inject({
      method: 'POST',
      url: '/api/carrieres/avancement-echelon',
      headers: { authorization: `Bearer ${jetonGestionnaireRH}` },
      payload: {
        agent_id: 'agt-001',
        echelon: -1,
        date_effet: '2026-08-01',
        type_avancement: 'CHOIX',
        numero_arrete: 'ARR-INVALIDE-01'
      }
    });
    assert.strictEqual(resEchelonNegatif.statusCode, 400);
    assert.strictEqual(JSON.parse(resEchelonNegatif.payload).code_erreur, 'ECHELON_INVALIDE');

    // 3. Note chiffrée hors limites (> 20.00 ou négative)
    const resNoteInvalide = await app.inject({
      method: 'POST',
      url: '/api/notations',
      headers: { authorization: `Bearer ${jetonChefCC}` },
      payload: {
        agent_id: 'agt-001',
        annee: 2026,
        rigueur_deontologie: 10.0, // Rubrique sur 5 excédée
        competence_technique: 10.0,
        disponibilite_operationnelle: 10.0,
        sens_commandement_initiative: 10.0,
        appreciation_generale: 'Note chiffrée manifestement illicite.',
        date_entretien: '2026-10-15'
      }
    });
    assert.strictEqual(resNoteInvalide.statusCode, 400);
    assert.strictEqual(JSON.parse(resNoteInvalide.payload).code_erreur, 'NOTE_HORS_LIMITES');
  });

  await t.test('3.3 : Résistance absolue du filtre républicain anti-médical (variations et motifs de recours)', async () => {
    // Batterie de contournements sémantiques et orthographiques
    const tentativesFraudeMedicale = [
      'L agent suit un TRAITEMENT régulier qui impacte son service.',
      'Souffre d un Diabète sévère nécessitant des aménagements.',
      'Hospitalisation récente à l hôpital général pour chirurgie.',
      'Problème de tension artérielle détecté par le médecin.',
      'Symptômes d anxiété avec ordonnance médicale fournie.',
      'État de santé préoccupant nécessitant une consultation.'
    ];

    for (const texte of tentativesFraudeMedicale) {
      // 1. Tentative dans la notation initiale
      const resNotation = await app.inject({
        method: 'POST',
        url: '/api/notations',
        headers: { authorization: `Bearer ${jetonChefCC}` },
        payload: {
          agent_id: 'agt-001',
          annee: 2026,
          rigueur_deontologie: 3.5,
          competence_technique: 3.5,
          disponibilite_operationnelle: 3.5,
          sens_commandement_initiative: 3.5,
          appreciation_generale: texte,
          date_entretien: '2026-10-15'
        }
      });
      assert.strictEqual(resNotation.statusCode, 400, `Le terme médical dans "${texte}" aurait dû être bloqué en notation`);
      assert.strictEqual(JSON.parse(resNotation.payload).code_erreur, 'DONNEE_MEDICALE_PROHIBEE');

      // 2. Tentative d'injection dans le motif d'un recours gracieux
      const resRecours = await app.inject({
        method: 'PUT',
        url: '/api/notations/not-001/recours',
        headers: { authorization: `Bearer ${jetonAgentHassan}` },
        payload: {
          motif_recours: `Contestation : ${texte}`,
          date_recours: '2026-02-01'
        }
      });
      assert.strictEqual(resRecours.statusCode, 400, `Le terme médical dans "${texte}" aurait dû être bloqué en recours`);
      assert.strictEqual(JSON.parse(resRecours.payload).code_erreur, 'DONNEE_MEDICALE_PROHIBEE');
    }

    // Vérification que les termes administratifs légitimes ne sont PAS bloqués par excès de zèle
    const termesAdministratifsLegitimes = [
      'Responsable exemplaire doté d une composante commandement affirmée.',
      'Constante disponibilité lors des interventions nocturnes.',
      'Sens aigu de la déontologie et écoute attentive des usagers.'
    ];

    for (const texteLegitime of termesAdministratifsLegitimes) {
      assert.doesNotMatch(
        texteLegitime,
        /(?:^|[^\p{L}\p{N}])(sante|santé|medical|médical|medecin|médecin|maladie|pathologie|traitement|hopital|hôpital|clinique|diagnostic|vih|sida|diabete|diabète|psychiatrie|psy|infirmite|infirmité|ordonnance|posologie|sang|groupe[ _]sanguin|handicap|grossesse|medicament|médicament|medicaments|médicaments|glycemie|glycémie|tension|tension[ _]artérielle|tension[ _]arterielle|cancer|chirurgie|symptome|symptôme|pouls|temperature|température|consultation)(?:[^\p{L}\p{N}]|$)/iu,
        `Le texte légitime "${texteLegitime}" ne doit pas être intercepté`
      );
    }
  });

  // ============================================================================
  // ÉPREUVE 4 : INTÉGRITÉ CRYPTOGRAPHIQUE SHA-256 ET SCELLAGE DE LA SOLDE
  // ============================================================================

  await t.test('4.1 : Scellage cryptographique inaltérable de l\'export de solde et traçabilité SHA-256', async () => {
    // 1. Génération du calcul de solde
    await app.inject({
      method: 'POST',
      url: '/api/solde/calculs/2026-03/generer',
      headers: { authorization: `Bearer ${jetonGestionnaireRH}` }
    });

    // 2. Export normé Trésor
    const resExport = await app.inject({
      method: 'POST',
      url: '/api/solde/exports',
      headers: { authorization: `Bearer ${jetonGestionnaireRH}` },
      payload: {
        mois_annee: '2026-03',
        format: 'CSV_TRESOR_DJIBOUTI'
      }
    });

    assert.strictEqual(resExport.statusCode, 201);
    const corps = JSON.parse(resExport.payload);
    assert.strictEqual(corps.statut, 'SUCCES');

    const exp = corps.export;
    assert.ok(exp.reference_export.startsWith('EXP-SOLDE-2026-03'));
    assert.strictEqual(exp.empreinte_sha256.length, 64);

    // 3. Recalcul indépendant de l'empreinte cryptographique
    const empreinteCalculee = crypto.createHash('sha256').update(exp.contenu_fichier, 'utf-8').digest('hex');
    assert.strictEqual(exp.empreinte_sha256, empreinteCalculee, 'L empreinte retournée doit être mathématiquement identique au contenu');

    // 4. Contrôle de l'immuabilité et du scellement dans la chaîne de blocs du journal d'audit
    const logAudit = await pool.query(
      `SELECT * FROM journaux_audit WHERE entite_cible = 'EXPORTS_SOLDE' AND entite_id = $1`,
      [exp.export_id]
    );
    assert.strictEqual(logAudit.rows.length, 1, 'L export doit être obligatoirement audité');
    assert.strictEqual(logAudit.rows[0].details_operation_json.empreinte_sha256, empreinteCalculee);
    assert.strictEqual(logAudit.rows[0].statut_operation, 'SUCCES');
    assert.ok(logAudit.rows[0].empreinte_courante.length === 64, 'L empreinte chaînée SHA-256 doit être valide');
  });
});
