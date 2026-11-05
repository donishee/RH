/**
 * ============================================================================
 * BATTERIE D'ÉPREUVES ADVERSARIALES & CONTRADICTOIRES — JALON M3 (DGPN DJIBOUTI)
 * INVARIANCE MATHÉMATIQUE DE LA SOLDE, LIMITES STATUTAIRES & SCELLEMENT SHA-256
 * ============================================================================
 * Fichier : tests/adversarial/m3_payroll_integrity.test.js
 * Auteur : Challenger M3-2 (Intégrité des Données, Invariance & Cryptographie)
 * Rôles : critic, specialist
 *
 * Périmètre d'épreuves empiriques :
 *  1. Invariance Mathématique de la Solde (Équation indiciaire, primes, éloignement,
 *     heures nuit 450 DJF/h, astreintes 3500 DJF/j, retenues 7%, colonnes STORED).
 *  2. Régimes d'incompatibilité et d'exception (Disponibilité 0 DJF, Suspension 50% base).
 *  3. Analyse aux Limites (BVA) : Plafonds sommitaux des 17 grades policiers (rejet 400).
 *  4. Incompatibilités statutaires sur avancement et promotions (rejets 400).
 *  5. Limites et étanchéité des notations : bornes 0.00-20.00, injections SQL, détection
 *     médicale complexe (33 termes, accents, ponctuation, casse) et recours gracieux.
 *  6. Intégrité Cryptographique SHA-256 de l'Export de Solde : altération contradictoire,
 *     effet avalanche, concordance avec journaux_audit et validation de blockchain audit.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

// Chargement du serveur et de la couche base de données
let creerApplicationServeur;
let fermerPool;
let pool;
let executerReset;
let verifyAuditChain;
let computeChainedHash;
let GENESIS_HASH;

try {
  // S'assurer que schema.sql est présent dans dist/database si compilation tsc
  const srcSchema = path.join(__dirname, '../../src/database/schema.sql');
  const distSchema = path.join(__dirname, '../../dist/database/schema.sql');
  if (fs.existsSync(srcSchema) && !fs.existsSync(distSchema)) {
    fs.mkdirSync(path.dirname(distSchema), { recursive: true });
    fs.copyFileSync(srcSchema, distSchema);
  }

  creerApplicationServeur = require('../../dist/server.js').creerApplicationServeur;
  const dbModule = require('../../dist/database/index.js');
  fermerPool = dbModule.fermerPool;
  pool = dbModule.pool;
  executerReset = require('../../dist/database/reset.js').executerReset;
  const cryptoAudit = require('../../dist/modules/audit/audit.crypto.js');
  verifyAuditChain = cryptoAudit.verifyAuditChain;
  computeChainedHash = cryptoAudit.computeChainedHash;
  GENESIS_HASH = cryptoAudit.GENESIS_HASH;
} catch {
  require('tsx/cjs');
  creerApplicationServeur = require('../../src/server.ts').creerApplicationServeur;
  const dbModule = require('../../src/database/index.ts');
  fermerPool = dbModule.fermerPool;
  pool = dbModule.pool;
  executerReset = require('../../src/database/reset.ts').executerReset;
  const cryptoAudit = require('../../src/modules/audit/audit.crypto.ts');
  verifyAuditChain = cryptoAudit.verifyAuditChain;
  computeChainedHash = cryptoAudit.computeChainedHash;
  GENESIS_HASH = cryptoAudit.GENESIS_HASH;
}

test('BATTERIE CONTRADICTOIRE M3 : Invariance de la Solde, Limites & Scellement Cryptographique SHA-256', async (t) => {
  let app;
  let jetonGestionnaireRH;
  let jetonAdminTech;
  let jetonChefCC;
  let jetonChefAli;
  let jetonAgentHassan;
  let jetonAuditeur;

  t.before(async () => {
    // Réinitialisation intégrale pour garantir un environnement propre et reproductible
    await executerReset();

    app = await creerApplicationServeur();
    await app.ready();

    // Authentification des différents profils opérationnels
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
    jetonAuditeur = await login('auditeur');
  });

  t.after(async () => {
    if (app) await app.close();
    if (fermerPool && !pool?.ending && !pool?.ended) {
      await fermerPool().catch(() => {});
    }
  });

  // ==========================================================================
  // SECTION 1 : ÉPREUVES D'INVARIANCE MATHÉMATIQUE DE LA SOLDE
  // ==========================================================================

  await t.test('1.1 : Vérification formelle de l\'équation indiciaire de base (base = indice_majore * 100 DJF)', async () => {
    const resCalcul = await app.inject({
      method: 'POST',
      url: '/api/solde/calculs/2026-02/generer',
      headers: { authorization: `Bearer ${jetonGestionnaireRH}` }
    });
    assert.strictEqual(resCalcul.statusCode, 200);
    const corpsCalcul = JSON.parse(resCalcul.payload);
    assert.strictEqual(corpsCalcul.statut, 'SUCCES');

    // Récupérer les indices réels des agents depuis la base
    const resAgents = await pool.query('SELECT id, matricule, corps, grade_actuel, indice_solde FROM agents WHERE est_actif = TRUE');
    assert.ok(resAgents.rows.length >= 4);

    for (const ag of resAgents.rows) {
      const solde = corpsCalcul.elements.find(e => e.agent_id === ag.id);
      assert.ok(solde, `Bulletin de solde introuvable pour agent ${ag.matricule}`);

      const baseAttendue = ag.indice_solde * 100.0;
      const baseCalculee = parseFloat(solde.salaire_base_indiciaire);
      assert.strictEqual(
        baseCalculee,
        baseAttendue,
        `Discordance équation indiciaire pour ${ag.matricule}: attendu ${baseAttendue} DJF, obtenu ${baseCalculee} DJF`
      );
    }
  });

  await t.test('1.2 : Vérification du calcul précis des primes de sujétion et risque selon les corps républicains', async () => {
    const resConsult = await app.inject({
      method: 'GET',
      url: '/api/solde/elements/2026-02',
      headers: { authorization: `Bearer ${jetonGestionnaireRH}` }
    });
    assert.strictEqual(resConsult.statusCode, 200);
    const corps = JSON.parse(resConsult.payload);

    // Profil Officiers Supérieurs (Commandant - agt-004) : Sujétion 20 000 DJF, Risque 15 000 DJF
    const soldeOffSup = corps.elements.find(e => e.agent_id === 'agt-004');
    assert.strictEqual(parseFloat(soldeOffSup.prime_sujetion), 20000.00);
    assert.strictEqual(parseFloat(soldeOffSup.prime_risque), 15000.00);

    // Profil Officiers Subalternes (Capitaine - agt-003) : Sujétion 20 000 DJF, Risque 15 000 DJF
    const soldeOffSub = corps.elements.find(e => e.agent_id === 'agt-003');
    assert.strictEqual(parseFloat(soldeOffSub.prime_sujetion), 20000.00);
    assert.strictEqual(parseFloat(soldeOffSub.prime_risque), 15000.00);

    // Profil Sous-Officiers (Sergent-Chef - agt-001) : Sujétion 15 000 DJF, Risque 10 000 DJF
    const soldeSousOff = corps.elements.find(e => e.agent_id === 'agt-001');
    assert.strictEqual(parseFloat(soldeSousOff.prime_sujetion), 15000.00);
    assert.strictEqual(parseFloat(soldeSousOff.prime_risque), 10000.00);

    // Profil Agents de Police (Agent de 1ère classe - agt-002) : Sujétion 10 000 DJF, Risque 10 000 DJF
    const soldeAgent = corps.elements.find(e => e.agent_id === 'agt-002');
    assert.strictEqual(parseFloat(soldeAgent.prime_sujetion), 10000.00);
    assert.strictEqual(parseFloat(soldeAgent.prime_risque), 10000.00);
  });

  await t.test('1.3 : Vérification formelle de l\'indemnité d\'éloignement (25 000 DJF hors Djibouti-Ville)', async () => {
    const resConsult = await app.inject({
      method: 'GET',
      url: '/api/solde/elements/2026-02',
      headers: { authorization: `Bearer ${jetonGestionnaireRH}` }
    });
    const corps = JSON.parse(resConsult.payload);

    // agt-003 est affecté à Ali-Sabieh (région ALI_SABIEH != DJIBOUTI) -> 25 000 DJF
    const soldeAli = corps.elements.find(e => e.agent_id === 'agt-003');
    assert.strictEqual(parseFloat(soldeAli.indemnite_eloignement), 25000.00);

    // agt-001 et agt-002 sont à Djibouti-Ville (région DJIBOUTI) -> 0 DJF
    const soldeDjib1 = corps.elements.find(e => e.agent_id === 'agt-001');
    const soldeDjib2 = corps.elements.find(e => e.agent_id === 'agt-002');
    assert.strictEqual(parseFloat(soldeDjib1.indemnite_eloignement), 0.00);
    assert.strictEqual(parseFloat(soldeDjib2.indemnite_eloignement), 0.00);
  });

  await t.test('1.4 : Vérification du barème heures de nuit (450 DJF/h) et astreintes (3 500 DJF/j)', async () => {
    // Vérification sur les données de référence de Janvier 2026
    const resJanv = await app.inject({
      method: 'GET',
      url: '/api/solde/elements/2026-01',
      headers: { authorization: `Bearer ${jetonGestionnaireRH}` }
    });
    assert.strictEqual(resJanv.statusCode, 200);
    const corpsJanv = JSON.parse(resJanv.payload);

    // agt-001 : 2 jours d'astreinte (2 * 3 500 = 7 000 DJF) et 8h de nuit (8 * 450 = 3 600 DJF)
    const soldeAgt1 = corpsJanv.elements.find(e => e.agent_id === 'agt-001');
    assert.strictEqual(parseFloat(soldeAgt1.indemnite_astreinte), 7000.00);
    assert.strictEqual(parseFloat(soldeAgt1.heures_nuit_dimanche), 3600.00);

    // agt-002 : 0 jour d'astreinte, 4h de nuit (4 * 450 = 1 800 DJF)
    const soldeAgt2 = corpsJanv.elements.find(e => e.agent_id === 'agt-002');
    assert.strictEqual(parseFloat(soldeAgt2.indemnite_astreinte), 0.00);
    assert.strictEqual(parseFloat(soldeAgt2.heures_nuit_dimanche), 1800.00);

    // agt-003 : 3 jours d'astreinte (3 * 3 500 = 10 500 DJF)
    const soldeAgt3 = corpsJanv.elements.find(e => e.agent_id === 'agt-003');
    assert.strictEqual(parseFloat(soldeAgt3.indemnite_astreinte), 10500.00);
  });

  await t.test('1.5 : Déduction exacte des retenues statutaires (7% sur salaire de base indiciaire)', async () => {
    const resConsult = await app.inject({
      method: 'GET',
      url: '/api/solde/elements/2026-02',
      headers: { authorization: `Bearer ${jetonGestionnaireRH}` }
    });
    const corps = JSON.parse(resConsult.payload);

    for (const e of corps.elements) {
      const base = parseFloat(e.salaire_base_indiciaire);
      const retenueAttendue = Number((base * 0.07).toFixed(2));
      const retenueReelle = parseFloat(e.retenues_statutaires);
      assert.strictEqual(
        retenueReelle,
        retenueAttendue,
        `Retenue erronée pour agent ${e.agent_id}: attendu ${retenueAttendue}, obtenu ${retenueReelle}`
      );
    }
  });

  await t.test('1.6 : Invariance mathématique stricte PostgreSQL (total_brut = base + primes et net = brut - retenues)', async () => {
    const resSQL = await pool.query('SELECT * FROM elements_solde WHERE mois_annee = $1', ['2026-02']);
    assert.ok(resSQL.rows.length >= 4);

    for (const row of resSQL.rows) {
      const base = parseFloat(row.salaire_base_indiciaire);
      const suj = parseFloat(row.prime_sujetion);
      const ris = parseFloat(row.prime_risque);
      const ast = parseFloat(row.indemnite_astreinte);
      const nuit = parseFloat(row.heures_nuit_dimanche);
      const eloign = parseFloat(row.indemnite_eloignement);
      const totalBrut = parseFloat(row.total_brut);
      const ret = parseFloat(row.retenues_statutaires);
      const net = parseFloat(row.net_a_payer);

      // Invariance 1 : Total Brut
      const brutAttendu = Number((base + suj + ris + ast + nuit + eloign).toFixed(2));
      assert.strictEqual(
        totalBrut,
        brutAttendu,
        `Violation d'invariance total_brut pour bulletin ${row.id} : ${totalBrut} !== ${brutAttendu}`
      );

      // Invariance 2 : Net à Payer
      const netAttendu = Number((brutAttendu - ret).toFixed(2));
      assert.strictEqual(
        net,
        netAttendu,
        `Violation d'invariance net_a_payer pour bulletin ${row.id} : ${net} !== ${netAttendu}`
      );
    }
  });

  await t.test('1.7 : Régime d\'incompatibilité de solde — Agent en DISPONIBILITE : solde 0 DJF', async () => {
    // 1. Déclarer agt-002 en DISPONIBILITE pour la période 2026-03
    const resDispo = await app.inject({
      method: 'POST',
      url: '/api/positions',
      headers: { authorization: `Bearer ${jetonGestionnaireRH}` },
      payload: {
        agent_id: 'agt-002',
        position: 'DISPONIBILITE',
        date_debut: '2026-03-01',
        reference_decision: 'DEC-DISPO-2026-001',
        motif: 'Convenances personnelles avec suspension de traitement'
      }
    });
    assert.strictEqual(resDispo.statusCode, 201);

    // 2. Calculer la solde de Mars 2026
    const resCalcul = await app.inject({
      method: 'POST',
      url: '/api/solde/calculs/2026-03/generer',
      headers: { authorization: `Bearer ${jetonGestionnaireRH}` }
    });
    assert.strictEqual(resCalcul.statusCode, 200);
    const corpsCalcul = JSON.parse(resCalcul.payload);

    // 3. Vérifier que agt-002 a une solde nulle (0 DJF sur tous les postes)
    const soldeDispo = corpsCalcul.elements.find(e => e.agent_id === 'agt-002');
    assert.ok(soldeDispo, 'Bulletin agt-002 introuvable');
    assert.strictEqual(parseFloat(soldeDispo.salaire_base_indiciaire), 0.00);
    assert.strictEqual(parseFloat(soldeDispo.prime_sujetion), 0.00);
    assert.strictEqual(parseFloat(soldeDispo.prime_risque), 0.00);
    assert.strictEqual(parseFloat(soldeDispo.indemnite_eloignement), 0.00);
    assert.strictEqual(parseFloat(soldeDispo.indemnite_astreinte), 0.00);
    assert.strictEqual(parseFloat(soldeDispo.heures_nuit_dimanche), 0.00);
    assert.strictEqual(parseFloat(soldeDispo.total_brut), 0.00);
    assert.strictEqual(parseFloat(soldeDispo.retenues_statutaires), 0.00);
    assert.strictEqual(parseFloat(soldeDispo.net_a_payer), 0.00);
  });

  await t.test('1.8 : Régime d\'incompatibilité de solde — Agent SUSPENDU : demi-traitement indiciaire, 0% primes', async () => {
    // 1. Déclarer agt-001 en SUSPENSION_ADMINISTRATIVE pour la période 2026-04
    const resSusp = await app.inject({
      method: 'POST',
      url: '/api/positions',
      headers: { authorization: `Bearer ${jetonGestionnaireRH}` },
      payload: {
        agent_id: 'agt-001',
        position: 'SUSPENSION_ADMINISTRATIVE',
        date_debut: '2026-04-01',
        reference_decision: 'DEC-SUSP-2026-002',
        motif: 'Mesure conservatoire disciplinaire'
      }
    });
    assert.strictEqual(resSusp.statusCode, 201);

    // 2. Calculer la solde d'Avril 2026
    const resCalcul = await app.inject({
      method: 'POST',
      url: '/api/solde/calculs/2026-04/generer',
      headers: { authorization: `Bearer ${jetonGestionnaireRH}` }
    });
    assert.strictEqual(resCalcul.statusCode, 200);
    const corpsCalcul = JSON.parse(resCalcul.payload);

    // agt-001 a indice_solde 520 -> Base normale 52 000 DJF.
    // Demi-solde = 26 000 DJF. Primes = 0 DJF. Retenue 7% = 1 820 DJF. Net = 24 180 DJF.
    const soldeSusp = corpsCalcul.elements.find(e => e.agent_id === 'agt-001');
    assert.ok(soldeSusp, 'Bulletin agt-001 introuvable');
    assert.strictEqual(parseFloat(soldeSusp.salaire_base_indiciaire), 26000.00);
    assert.strictEqual(parseFloat(soldeSusp.prime_sujetion), 0.00);
    assert.strictEqual(parseFloat(soldeSusp.prime_risque), 0.00);
    assert.strictEqual(parseFloat(soldeSusp.indemnite_eloignement), 0.00);
    assert.strictEqual(parseFloat(soldeSusp.total_brut), 26000.00);
    assert.strictEqual(parseFloat(soldeSusp.retenues_statutaires), 1820.00);
    assert.strictEqual(parseFloat(soldeSusp.net_a_payer), 24180.00);
  });

  // ==========================================================================
  // SECTION 2 : ÉPREUVES DE LIMITES ET CAS FRONTIÈRES (BOUNDARY VALUE ANALYSIS)
  // ==========================================================================

  await t.test('2.1 : Plafonds sommitaux d\'échelon : tentative de dépassement rejetée pour les 17 grades policiers', async () => {
    // Matrice réglementaire des plafonds d'échelons de la Police Djiboutienne
    const plafondsGrades = [
      { grade: 'Contrôleur Général de Police', plafond: 3 },
      { grade: 'Colonel', plafond: 5 },
      { grade: 'Lieutenant-Colonel', plafond: 5 },
      { grade: 'Commandant', plafond: 5 },
      { grade: 'Capitaine', plafond: 6 },
      { grade: 'Lieutenant', plafond: 5 },
      { grade: 'Sous-Lieutenant', plafond: 3 },
      { grade: 'Adjudant-Major', plafond: 4 },
      { grade: 'Adjudant-Chef', plafond: 6 },
      { grade: 'Adjudant', plafond: 6 },
      { grade: 'Sergent-Chef', plafond: 7 },
      { grade: 'Sergent', plafond: 7 },
      { grade: 'Caporal-Chef', plafond: 8 },
      { grade: 'Caporal', plafond: 8 },
      { grade: 'Agent de 1ère classe', plafond: 9 },
      { grade: 'Agent de 2ème classe', plafond: 7 },
      { grade: 'Élève Agent', plafond: 1 }
    ];

    // Utilisation d'un agent cobaye (agt-rh-01) avec réinitialisation de son positionnement en activité
    await pool.query(`UPDATE positions_statutaires SET est_active = FALSE WHERE agent_id = 'agt-rh-01'`);
    await pool.query(`
      INSERT INTO positions_statutaires (id, agent_id, position, date_debut, maintien_droits_avancement, reference_decision, est_active, cree_par)
      VALUES ('pos-bva-test', 'agt-rh-01', 'ACTIVITE', '2020-01-01', TRUE, 'ARR-BVA', TRUE, 'usr-rh-01')
    `);

    for (const { grade, plafond } of plafondsGrades) {
      // Configurer temporairement l'agent au grade testé, à l'échelon 1
      await pool.query(`UPDATE agents SET grade_actuel = $1, echelon_actuel = 1 WHERE id = 'agt-rh-01'`, [grade]);

      // Tentative d'avancement à l'échelon (plafond + 1) -> DOIT ÊTRE REJETÉ PAR HTTP 400
      const echelonTropEleve = plafond + 1;
      const resRejet = await app.inject({
        method: 'POST',
        url: '/api/carrieres/avancement-echelon',
        headers: { authorization: `Bearer ${jetonGestionnaireRH}` },
        payload: {
          agent_id: 'agt-rh-01',
          echelon: echelonTropEleve,
          date_effet: '2026-05-01',
          type_avancement: 'ANCIENNETE',
          numero_arrete: `ARR-BVA-${plafond}`
        }
      });

      assert.strictEqual(
        resRejet.statusCode,
        400,
        `Échec BVA pour le grade ${grade} : l'échelon ${echelonTropEleve} (plafond: ${plafond}) n'a pas été rejeté avec code 400 !`
      );
      const corps = JSON.parse(resRejet.payload);
      assert.strictEqual(corps.code_erreur, 'ECHELON_SOMMITAL_ATTEINT');
    }
  });

  await t.test('2.2 : Rejet formel lors d\'une tentative d\'avancement avec échelon inférieur ou égal à l\'actuel', async () => {
    // agt-004 est à l'échelon 5
    const resEchelonInferieur = await app.inject({
      method: 'POST',
      url: '/api/carrieres/avancement-echelon',
      headers: { authorization: `Bearer ${jetonGestionnaireRH}` },
      payload: {
        agent_id: 'agt-004',
        echelon: 3, // < 5
        date_effet: '2026-06-01',
        type_avancement: 'ANCIENNETE',
        numero_arrete: 'ARR-INFERIEUR'
      }
    });
    assert.strictEqual(resEchelonInferieur.statusCode, 400);
    assert.strictEqual(JSON.parse(resEchelonInferieur.payload).code_erreur, 'ECHELON_INVALIDE');

    const resEchelonEgal = await app.inject({
      method: 'POST',
      url: '/api/carrieres/avancement-echelon',
      headers: { authorization: `Bearer ${jetonGestionnaireRH}` },
      payload: {
        agent_id: 'agt-004',
        echelon: 5, // == 5
        date_effet: '2026-06-01',
        type_avancement: 'ANCIENNETE',
        numero_arrete: 'ARR-EGAL'
      }
    });
    assert.strictEqual(resEchelonEgal.statusCode, 400);
    assert.strictEqual(JSON.parse(resEchelonEgal.payload).code_erreur, 'ECHELON_INVALIDE');
  });

  await t.test('2.3 : Incompatibilité de position statutaire : Avancement interdit en DISPONIBILITE et SUSPENSION', async () => {
    // agt-002 a été placé en DISPONIBILITE au test 1.7
    const resAvanceDispo = await app.inject({
      method: 'POST',
      url: '/api/carrieres/avancement-echelon',
      headers: { authorization: `Bearer ${jetonGestionnaireRH}` },
      payload: {
        agent_id: 'agt-002',
        echelon: 3,
        date_effet: '2026-07-01',
        type_avancement: 'ANCIENNETE',
        numero_arrete: 'ARR-ILLEGAL-DISPO'
      }
    });
    assert.strictEqual(resAvanceDispo.statusCode, 400);
    assert.strictEqual(JSON.parse(resAvanceDispo.payload).code_erreur, 'POSITION_INCOMPATIBLE_AVANCEMENT');

    // agt-001 a été placé en SUSPENSION_ADMINISTRATIVE au test 1.8
    const resAvanceSusp = await app.inject({
      method: 'POST',
      url: '/api/carrieres/avancement-echelon',
      headers: { authorization: `Bearer ${jetonGestionnaireRH}` },
      payload: {
        agent_id: 'agt-001',
        echelon: 4,
        date_effet: '2026-07-01',
        type_avancement: 'ANCIENNETE',
        numero_arrete: 'ARR-ILLEGAL-SUSP'
      }
    });
    assert.strictEqual(resAvanceSusp.statusCode, 400);
    assert.strictEqual(JSON.parse(resAvanceSusp.payload).code_erreur, 'POSITION_INCOMPATIBLE_AVANCEMENT');
  });

  await t.test('2.4 : Incompatibilité de position statutaire : Avancement interdit en DÉTACHEMENT sans droits maintenus', async () => {
    // Créer une position de détachement avec droits gelés (maintien_droits_avancement = FALSE)
    await pool.query(`UPDATE positions_statutaires SET est_active = FALSE WHERE agent_id = 'agt-rh-01'`);
    await pool.query(`
      INSERT INTO positions_statutaires (id, agent_id, position, organisme_accueil, date_debut, maintien_droits_avancement, reference_decision, est_active, cree_par)
      VALUES ('pos-det-gel', 'agt-rh-01', 'DETACHEMENT', 'MINISTERE_INTERIEUR', '2026-01-01', FALSE, 'DEC-DET-01', TRUE, 'usr-rh-01')
    `);

    const resAvanceDetache = await app.inject({
      method: 'POST',
      url: '/api/carrieres/avancement-echelon',
      headers: { authorization: `Bearer ${jetonGestionnaireRH}` },
      payload: {
        agent_id: 'agt-rh-01',
        echelon: 2,
        date_effet: '2026-07-01',
        type_avancement: 'ANCIENNETE',
        numero_arrete: 'ARR-ILLEGAL-DET'
      }
    });
    assert.strictEqual(resAvanceDetache.statusCode, 400);
    assert.strictEqual(JSON.parse(resAvanceDetache.payload).code_erreur, 'POSITION_INCOMPATIBLE_AVANCEMENT');
  });

  await t.test('2.5 : Rejet formel de promotion de grade pour un agent en disponibilité ou suspendu', async () => {
    // agt-002 est en disponibilité
    const resPromoDispo = await app.inject({
      method: 'POST',
      url: '/api/promotions',
      headers: { authorization: `Bearer ${jetonGestionnaireRH}` },
      payload: {
        agent_id: 'agt-002',
        nouveau_grade: 'Caporal',
        date_promotion: '2026-08-01',
        numero_decret: 'DEC-PROMO-DISPO',
        commission_date: '2026-07-15',
        tableau_avancement_annee: 2026,
        avis_commission: 'FAVORABLE'
      }
    });
    assert.strictEqual(resPromoDispo.statusCode, 400);
    assert.strictEqual(JSON.parse(resPromoDispo.payload).code_erreur, 'POSITION_INCOMPATIBLE_PROMOTION');
  });

  await t.test('2.6 : Rejet formel d\'une déclaration de détachement sans organisme d\'accueil désigné', async () => {
    const resRejetDet = await app.inject({
      method: 'POST',
      url: '/api/positions',
      headers: { authorization: `Bearer ${jetonGestionnaireRH}` },
      payload: {
        agent_id: 'agt-004',
        position: 'DETACHEMENT',
        date_debut: '2026-08-01',
        reference_decision: 'DEC-DETACHEMENT-SANS-ORGANISME'
        // organisme_accueil intentionnellement omis
      }
    });
    assert.strictEqual(resRejetDet.statusCode, 400);
    assert.strictEqual(JSON.parse(resRejetDet.payload).code_erreur, 'ORGANISME_ACCUEIL_REQUIS');
  });

  await t.test('2.7 : Bornes chiffrées de notation annuelle : rejet strict des notes < 0.00 et > 20.00', async () => {
    // Tentative note excessive (> 20.00 : 5 + 5 + 5 + 6 = 21.00)
    const resNoteHaute = await app.inject({
      method: 'POST',
      url: '/api/notations',
      headers: { authorization: `Bearer ${jetonGestionnaireRH}` },
      payload: {
        agent_id: 'agt-004',
        annee: 2026,
        rigueur_deontologie: 5.0,
        competence_technique: 5.0,
        disponibilite_operationnelle: 5.0,
        sens_commandement_initiative: 6.0,
        appreciation_generale: 'Prestation exceptionnelle hors barème.',
        date_entretien: '2026-10-10'
      }
    });
    assert.strictEqual(resNoteHaute.statusCode, 400);
    assert.strictEqual(JSON.parse(resNoteHaute.payload).code_erreur, 'NOTE_HORS_LIMITES');

    // Tentative note négative (< 0.00 : -2.00)
    const resNoteBasse = await app.inject({
      method: 'POST',
      url: '/api/notations',
      headers: { authorization: `Bearer ${jetonGestionnaireRH}` },
      payload: {
        agent_id: 'agt-004',
        annee: 2026,
        rigueur_deontologie: -2.0,
        competence_technique: 0.0,
        disponibilite_operationnelle: 0.0,
        sens_commandement_initiative: 0.0,
        appreciation_generale: 'Sanction déontologique grave.',
        date_entretien: '2026-10-10'
      }
    });
    assert.strictEqual(resNoteBasse.statusCode, 400);
    assert.strictEqual(JSON.parse(resNoteBasse.payload).code_erreur, 'NOTE_HORS_LIMITES');
  });

  await t.test('2.8 : Acceptation légitime des notes frontières 0.00 et 20.00', async () => {
    // Note minimale exacte 0.00
    const resZero = await app.inject({
      method: 'POST',
      url: '/api/notations',
      headers: { authorization: `Bearer ${jetonGestionnaireRH}` },
      payload: {
        agent_id: 'agt-rh-01',
        annee: 2026,
        rigueur_deontologie: 0.0,
        competence_technique: 0.0,
        disponibilite_operationnelle: 0.0,
        sens_commandement_initiative: 0.0,
        appreciation_generale: 'Notation minimale suite à abandon de poste prolongé constaté par procès-verbal.',
        date_entretien: '2026-10-15'
      }
    });
    assert.strictEqual(resZero.statusCode, 201);
    assert.strictEqual(parseFloat(JSON.parse(resZero.payload).notation.note_chiffree), 0.00);

    // Note maximale exacte 20.00
    const resVingt = await app.inject({
      method: 'POST',
      url: '/api/notations',
      headers: { authorization: `Bearer ${jetonGestionnaireRH}` },
      payload: {
        agent_id: 'agt-003',
        annee: 2026,
        rigueur_deontologie: 5.0,
        competence_technique: 5.0,
        disponibilite_operationnelle: 5.0,
        sens_commandement_initiative: 5.0,
        appreciation_generale: 'Prestation républicaine parfaite, commandement exemplaire et dévouement absolu au service de la nation.',
        date_entretien: '2026-10-16'
      }
    });
    assert.strictEqual(resVingt.statusCode, 201);
    assert.strictEqual(parseFloat(JSON.parse(resVingt.payload).notation.note_chiffree), 20.00);
  });

  await t.test('2.9 : Neutralisation intégrale des tentatives d\'injections SQL dans les fiches de notation', async () => {
    const payloadsInjection = [
      "'; DROP TABLE notations_annuelles CASCADE; --",
      "' OR '1'='1",
      "Robert'); TRUNCATE TABLE elements_solde; --",
      "Appréciation normale'; UPDATE agents SET grade_actuel = 'Colonel'; --"
    ];

    for (let i = 0; i < payloadsInjection.length; i++) {
      const injection = payloadsInjection[i];
      // Nettoyer la notation 2026 de agt-004 pour éviter le conflit d'unicité annuel
      await pool.query('DELETE FROM notations_annuelles WHERE agent_id = $1 AND annee = $2', ['agt-004', 2026]);

      const resInj = await app.inject({
        method: 'POST',
        url: '/api/notations',
        headers: { authorization: `Bearer ${jetonGestionnaireRH}` },
        payload: {
          agent_id: 'agt-004',
          annee: 2026,
          rigueur_deontologie: 4.0,
          competence_technique: 4.0,
          disponibilite_operationnelle: 4.0,
          sens_commandement_initiative: 4.0,
          appreciation_generale: `Evaluation operationnelle : ${injection}`,
          date_entretien: '2026-10-18'
        }
      });

      // L'injection doit être neutralisée par requête préparée (code 201 avec chaîne littérale stockée)
      assert.strictEqual(resInj.statusCode, 201, `L'insertion préparée de "${injection}" aurait dû réussir en tant que texte littéral`);
      const corps = JSON.parse(resInj.payload);
      assert.strictEqual(corps.notation.appreciation_generale, `Evaluation operationnelle : ${injection}`);
    }

    // Vérifier formellement que la table notations_annuelles et la table elements_solde sont toujours intactes
    const checkTableNotations = await pool.query('SELECT COUNT(*) FROM notations_annuelles');
    assert.ok(parseInt(checkTableNotations.rows[0].count, 10) > 0, 'La table notations_annuelles a été corrompue !');

    const checkTableSolde = await pool.query('SELECT COUNT(*) FROM elements_solde');
    assert.ok(parseInt(checkTableSolde.rows[0].count, 10) > 0, 'La table elements_solde a été vidée !');

    // Vérifier que agt-004 n'a pas vu son grade altéré par l'injection
    const checkAgent = await pool.query(`SELECT grade_actuel FROM agents WHERE id = 'agt-004'`);
    assert.strictEqual(checkAgent.rows[0].grade_actuel, 'Commandant', 'Le grade de agt-004 a été frauduleusement modifié par injection !');
  });

  await t.test('2.10 : Batterie d\'attaques sémantiques médicales complexes : rejet systématique HTTP 400', async () => {
    // Corpus de tentatives d'injection de termes médicaux avec variations typographiques, casse, accents et ponctuation
    const corpusMedicalAdversarial = [
      'Agent souvent indisponible suite à un traitement médical lourd.',
      'Sujet présentant un symptôme aigu et fatigue au poste.',
      'Suivi régulier en clinique pour pathologie du foie.',
      'Présence à l hôpital suite à diagnostic défavorable.',
      'Prise quotidienne de médicament prescrit sur ordonnance.',
      'Contrôle médical de la glycémie et du diabète.',
      'Surveillance stricte de la tension artérielle en service.',
      'Information transmise relative au groupe sanguin de l agent.',
      'Examen clinique demandé auprès du médecin chef.'
    ];

    for (const phraseProscrite of corpusMedicalAdversarial) {
      const resMedical = await app.inject({
        method: 'POST',
        url: '/api/notations',
        headers: { authorization: `Bearer ${jetonGestionnaireRH}` },
        payload: {
          agent_id: 'agt-003',
          annee: 2027,
          rigueur_deontologie: 3.5,
          competence_technique: 3.5,
          disponibilite_operationnelle: 3.5,
          sens_commandement_initiative: 3.5,
          appreciation_generale: phraseProscrite,
          date_entretien: '2027-10-10'
        }
      });

      assert.strictEqual(
        resMedical.statusCode,
        400,
        `Échec filtrage secret médical pour la phrase : "${phraseProscrite}" (reçu ${resMedical.statusCode})`
      );
      const corps = JSON.parse(resMedical.payload);
      assert.strictEqual(corps.code_erreur, 'DONNEE_MEDICALE_PROHIBEE');
    }
  });

  await t.test('2.11 : Filtrage médical sur recours gracieux et préservation des homographes administratifs', async () => {
    // 1. Rejet médical sur motif_recours
    const resRecoursMedical = await app.inject({
      method: 'PUT',
      url: '/api/notations/not-002/recours',
      headers: { authorization: `Bearer ${jetonGestionnaireRH}` },
      payload: {
        motif_recours: 'Je sollicite la révision car mon médecin m a mis sous traitement.',
        date_recours: '2026-02-01'
      }
    });
    assert.strictEqual(resRecoursMedical.statusCode, 400);
    assert.strictEqual(JSON.parse(resRecoursMedical.payload).code_erreur, 'DONNEE_MEDICALE_PROHIBEE');

    // 2. Acceptation de termes administratifs légitimes contenant des sous-chaînes (ex: composante, responsable)
    const resRecoursLegitime = await app.inject({
      method: 'PUT',
      url: '/api/notations/not-002/recours',
      headers: { authorization: `Bearer ${jetonGestionnaireRH}` },
      payload: {
        motif_recours: 'Demande de réévaluation au titre de la composante commandement et en ma qualité de responsable de brigade.',
        date_recours: '2026-02-01'
      }
    });
    assert.strictEqual(resRecoursLegitime.statusCode, 200);
    assert.strictEqual(JSON.parse(resRecoursLegitime.payload).statut, 'SUCCES');
  });

  // ==========================================================================
  // SECTION 3 : ÉPREUVES D'INTÉGRITÉ CRYPTOGRAPHIQUE SHA-256 DE L'EXPORT SOLDE
  // ==========================================================================

  await t.test('3.1 : Génération de l\'export de solde officiel, scellement SHA-256 et concordance mathématique', async () => {
    const resExport = await app.inject({
      method: 'POST',
      url: '/api/solde/exports',
      headers: { authorization: `Bearer ${jetonGestionnaireRH}` },
      payload: {
        mois_annee: '2026-02',
        format: 'CSV_TRESOR_DJIBOUTI'
      }
    });

    assert.strictEqual(resExport.statusCode, 201);
    const corps = JSON.parse(resExport.payload);
    assert.strictEqual(corps.statut, 'SUCCES');
    assert.ok(corps.export.reference_export.startsWith('EXP-SOLDE-2026-02'));
    assert.strictEqual(corps.export.format, 'CSV_TRESOR_DJIBOUTI');
    assert.strictEqual(corps.export.empreinte_sha256.length, 64);
    assert.ok(/^[0-9a-f]{64}$/.test(corps.export.empreinte_sha256), 'Le hash doit être en hexadécimal minuscule');

    // Vérification de concordance directe
    const hashDirect = crypto.createHash('sha256').update(corps.export.contenu_fichier, 'utf-8').digest('hex');
    assert.strictEqual(
      corps.export.empreinte_sha256,
      hashDirect,
      'L empreinte SHA-256 renvoyée ne correspond pas au hash du flux généré !'
    );
  });

  await t.test('3.2 : Épreuve contradictoire d\'altération de contenu (Tamper Test) & Effet Avalanche SHA-256', async () => {
    // Récupérer le dernier export généré en base
    const resDB = await pool.query(`SELECT * FROM exports_solde ORDER BY date_export DESC LIMIT 1`);
    assert.strictEqual(resDB.rows.length, 1);
    const exportRow = resDB.rows[0];

    const contenuOriginal = exportRow.contenu_export_chiffre;
    const hashOriginal = exportRow.empreinte_sha256;

    // Altération contradictoire : mutation d'un seul caractère dans le corps du fichier CSV (ex: '0' -> '9')
    const indexVirgule = contenuOriginal.indexOf(';');
    assert.ok(indexVirgule > 0);
    const contenuAltere = contenuOriginal.slice(0, indexVirgule) + 'X' + contenuOriginal.slice(indexVirgule + 1);

    // Recalcul du hash sur le contenu altéré
    const hashAltere = crypto.createHash('sha256').update(contenuAltere, 'utf-8').digest('hex');

    // Vérification 1 : Invalidation cryptographique immédiate
    assert.notStrictEqual(
      hashAltere,
      hashOriginal,
      'ÉCHEC CRYPTOGRAPHIQUE : Le hash du contenu altéré est identique au hash scellé !'
    );

    // Vérification 2 : Mesure de l'effet avalanche (distance de Hamming sur les 256 bits)
    let bitsDifferents = 0;
    for (let i = 0; i < 64; i += 2) {
      const byteOriginal = parseInt(hashOriginal.substr(i, 2), 16);
      const byteAltere = parseInt(hashAltere.substr(i, 2), 16);
      let xor = byteOriginal ^ byteAltere;
      while (xor > 0) {
        bitsDifferents += (xor & 1);
        xor >>= 1;
      }
    }

    // Dans un hachage cryptographique SHA-256 intègre, modifier 1 seul octet entraîne la bascule d'environ 50% des bits (128 bits ± 40)
    assert.ok(
      bitsDifferents >= 90 && bitsDifferents <= 165,
      `Effet avalanche non conforme : ${bitsDifferents} bits modifiés sur 256 (attendu entre 90 et 165 bits)`
    );
  });

  await t.test('3.3 : Concordance stricte au caractère près entre exports_solde et journaux_audit', async () => {
    const resExport = await pool.query(`SELECT * FROM exports_solde ORDER BY date_export DESC LIMIT 1`);
    const exp = resExport.rows[0];

    const resAudit = await pool.query(`SELECT * FROM journaux_audit WHERE id = $1`, [exp.journal_audit_id]);
    assert.strictEqual(resAudit.rows.length, 1);
    const auditRecord = resAudit.rows[0];

    assert.strictEqual(auditRecord.action_type, 'EXPORT_SOLDE_SCELLE');
    assert.strictEqual(auditRecord.statut_operation, 'SUCCES');
    assert.strictEqual(auditRecord.entite_cible, 'EXPORTS_SOLDE');
    assert.strictEqual(auditRecord.entite_id, exp.id);

    const details = auditRecord.details_operation_json;
    assert.strictEqual(
      details.empreinte_sha256,
      exp.empreinte_sha256,
      'Discordance d empreinte entre exports_solde et journaux_audit !'
    );
    assert.strictEqual(details.reference_export, exp.reference_export);
    assert.strictEqual(details.nombre_agents, exp.nombre_agents);
    assert.strictEqual(parseFloat(details.montant_total), parseFloat(exp.montant_total));
  });

  await t.test('3.4 : Vérification de la continuité et intégrité de la chaîne de blocs d\'audit (Audit Chain)', async () => {
    // Récupérer tous les journaux d'audit
    const resLogs = await pool.query('SELECT * FROM journaux_audit ORDER BY id ASC');
    assert.ok(resLogs.rows.length >= 2, 'Il doit y avoir au moins le bloc genèse et des entrées subséquentes');

    // Valider la chaîne cryptographique complète
    const auditEntries = resLogs.rows.map(r => ({
      id: r.id,
      horodatage: r.horodatage,
      utilisateur_id: r.utilisateur_id,
      action_type: r.action_type,
      entite_cible: r.entite_cible,
      entite_id: r.entite_id,
      details_operation_json: r.details_operation_json,
      empreinte_precedente: r.empreinte_precedente,
      empreinte_courante: r.empreinte_courante
    }));

    const verification = verifyAuditChain(auditEntries);
    assert.strictEqual(
      verification.valid,
      true,
      `Rupture d intégrité détectée dans la chaîne d audit : ${JSON.stringify(verification.errors)}`
    );
    assert.strictEqual(verification.errors.length, 0);
  });

  await t.test('3.5 : Détection forensique immédiate lors d\'une tentative d\'altération dans les journaux d\'audit', async () => {
    const resLogs = await pool.query('SELECT * FROM journaux_audit ORDER BY id ASC');
    const auditEntries = resLogs.rows.map(r => ({
      id: r.id,
      horodatage: r.horodatage,
      utilisateur_id: r.utilisateur_id,
      action_type: r.action_type,
      entite_cible: r.entite_cible,
      entite_id: r.entite_id,
      details_operation_json: { ...r.details_operation_json },
      empreinte_precedente: r.empreinte_precedente,
      empreinte_courante: r.empreinte_courante
    }));

    // Simuler une falsification malveillante du dernier log (ex: altérer l'identifiant utilisateur ou le statut)
    const dernierIndex = auditEntries.length - 1;
    auditEntries[dernierIndex].details_operation_json.altération_frauduleuse = true;

    // La vérification doit obligatoirement échouer
    const verificationAltered = verifyAuditChain(auditEntries);
    assert.strictEqual(verificationAltered.valid, false, 'La falsification de l audit aurait dû être détectée !');
    assert.ok(verificationAltered.errors.length > 0);
    assert.strictEqual(verificationAltered.errors[0].id, auditEntries[dernierIndex].id);
  });
});
