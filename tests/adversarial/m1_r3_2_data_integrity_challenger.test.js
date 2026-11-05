const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

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

const TERMES_MEDICAUX = [
  'sante', 'medical', 'medecin', 'maladie', 'pathologie', 'traitement',
  'hopital', 'clinique', 'diagnostic', 'vih', 'sida', 'diabete',
  'psychiatrie', 'psy', 'infirmite', 'ordonnance', 'posologie', 'sang',
  'groupe_sanguin', 'handicap', 'grossesse', 'medicament', 'medicaments',
  'glycemie', 'tension', 'tension_arterielle', 'cancer', 'chirurgie',
  'symptome', 'pouls', 'temperature', 'consultation'
];

const VARIANTES_LIBELLE_MEDICAUX = [
  'santé', 'sante', 'SANTE', 'Santé',
  'médical', 'medical', 'MÉDICAL',
  'médecin', 'medecin', 'Médecin traitant',
  'maladie', 'Maladie chronique',
  'pathologie', 'Pathologie déclarée',
  'traitement', 'Traitement en cours',
  'hôpital', 'hopital', 'Hôpital militaire',
  'clinique', 'Clinique privée',
  'diagnostic', 'Diagnostic posé',
  'vih', 'Dépistage VIH',
  'sida', 'Stade SIDA',
  'diabète', 'diabete', 'Diabète type 2',
  'psychiatrie', 'Suivi en psychiatrie',
  'psy', 'Bilan psy',
  'infirmité', 'infirmite', 'Taux d infirmite',
  'ordonnance', 'Numéro ordonnance',
  'posologie', 'Posologie quotidienne',
  'sang', 'Analyse de sang',
  'groupe_sanguin', 'groupe sanguin', 'Groupe Sanguin ABO',
  'handicap', 'Reconnaissance handicap',
  'grossesse', 'Déclaration de grossesse',
  'médicament', 'medicament', 'médicaments', 'medicaments', 'Prise de médicaments',
  'glycémie', 'glycemie', 'Taux de glycémie',
  'tension', 'tension artérielle', 'tension_arterielle', 'Tension artérielle systolique',
  'cancer', 'Antécédent de cancer',
  'chirurgie', 'Intervention chirurgie',
  'symptôme', 'symptome', 'Symptôme observé',
  'pouls', 'Mesure du pouls',
  'température', 'temperature', 'Température corporelle',
  'consultation', 'Date de consultation'
];

test('CHALLENGER M1-R3-2 : Épreuves Empiriques d\'Intégrité et Pénétration des Données', async (t) => {
  let app;
  let jetonAdminFonc;

  t.before(async () => {
    app = await creerApplicationServeur();
    await app.ready();

    // Connexion admin fonctionnel pour tests API
    const resAuth = await app.inject({
      method: 'POST',
      url: '/api/auth/connexion',
      payload: { identifiant: 'admin_fonc', mot_de_passe: 'Police@2026!' }
    });
    assert.strictEqual(resAuth.statusCode, 200, 'Connexion admin_fonc réussie');
    jetonAdminFonc = JSON.parse(resAuth.payload).jeton;
  });

  t.after(async () => {
    if (app) await app.close();
    if (fermerPool && !pool?.ending && !pool?.ended) {
      await fermerPool().catch(() => {});
    }
  });

  // ==========================================================================
  // ÉPREUVE 1 : Introspection DDL et Présence des Gardes-Fous PostgreSQL
  // ==========================================================================
  await t.test('ÉPREUVE 1.1 : Vérification de la contrainte chk_champs_interdiction_medicale dans PostgreSQL', async () => {
    const res = await pool.query(`
      SELECT conname, pg_get_constraintdef(oid) AS def
      FROM pg_constraint
      WHERE conrelid = 'champs_personnalises'::regclass
        AND conname = 'chk_champs_interdiction_medicale'
    `);
    assert.strictEqual(res.rows.length, 1, 'La contrainte chk_champs_interdiction_medicale doit exister dans pg_constraint');
    const def = res.rows[0].def;
    assert.ok(def.includes('medicament'), 'La contrainte doit inclure medicament');
    assert.ok(def.includes('glycemie'), 'La contrainte doit inclure glycemie');
    assert.ok(def.includes('tension'), 'La contrainte doit inclure tension');
    assert.ok(def.includes('cancer'), 'La contrainte doit inclure cancer');
  });

  await t.test('ÉPREUVE 1.2 : Vérification des triggers d\'immuabilité sur affectations et journaux_audit', async () => {
    const triggers = await pool.query(`
      SELECT tgname, relname
      FROM pg_trigger t
      JOIN pg_class c ON t.tgrelid = c.oid
      WHERE tgname IN ('tg_affectations_immuable', 'tg_affectations_truncate', 'tg_audit_immuable', 'tg_audit_truncate')
    `);
    const noms = triggers.rows.map(r => `${r.relname}.${r.tgname}`);
    assert.ok(noms.includes('affectations.tg_affectations_immuable'), 'Trigger affectations.tg_affectations_immuable présent');
    assert.ok(noms.includes('affectations.tg_affectations_truncate'), 'Trigger affectations.tg_affectations_truncate présent');
    assert.ok(noms.includes('journaux_audit.tg_audit_immuable'), 'Trigger journaux_audit.tg_audit_immuable présent');
    assert.ok(noms.includes('journaux_audit.tg_audit_truncate'), 'Trigger journaux_audit.tg_audit_truncate présent');
  });

  // ==========================================================================
  // ÉPREUVE 2 : Pénétration SQL Directe — Liste Noire Médicale (Code 23514)
  // ==========================================================================
  await t.test('ÉPREUVE 2.1 : Rejet SQL 23514 de chaque terme médical dans code_champ', async () => {
    for (const terme of TERMES_MEDICAUX) {
      const codeTest = `c_${terme}`.substring(0, 50);
      let aEchoue = false;
      let codeErreur = null;
      let contrainteNom = null;

      try {
        await pool.query(`
          INSERT INTO champs_personnalises (
            id, entite_cible, code_champ, libelle, type_donnee, ordre_affichage, est_obligatoire, est_actif
          ) VALUES ($1, 'AGENT', $2, 'Libelle Inoffensif', 'TEXTE', 99, false, true)
        `, [crypto.randomUUID(), codeTest]);
      } catch (err) {
        aEchoue = true;
        codeErreur = err.code;
        contrainteNom = err.constraint;
      }

      assert.strictEqual(aEchoue, true, `L'insertion SQL directe du code_champ '${codeTest}' doit être rejetée`);
      assert.strictEqual(codeErreur, '23514', `L'erreur SQL pour '${codeTest}' doit être 23514 (check_violation), reçu: ${codeErreur}`);
      assert.strictEqual(contrainteNom, 'chk_champs_interdiction_medicale', `La contrainte violée doit être chk_champs_interdiction_medicale`);
    }
  });

  await t.test('ÉPREUVE 2.2 : Rejet SQL 23514 des variantes majuscules / camelCase dans code_champ', async () => {
    const codesAdversariaux = [
      'MEDICAMENT_AGENT',
      'GlyCemIe_MesUre',
      'TeNsIoN_ArTeRiElLe',
      'VIH_STATUT',
      'DIABETE_TYPE',
      'CANCER_HISTORIQUE'
    ];

    for (const code of codesAdversariaux) {
      let aEchoue = false;
      let codeErreur = null;
      let contrainteNom = null;

      try {
        await pool.query(`
          INSERT INTO champs_personnalises (
            id, entite_cible, code_champ, libelle, type_donnee, ordre_affichage, est_obligatoire, est_actif
          ) VALUES ($1, 'AGENT', $2, 'Libelle Inoffensif', 'TEXTE', 99, false, true)
        `, [crypto.randomUUID(), code]);
      } catch (err) {
        aEchoue = true;
        codeErreur = err.code;
        contrainteNom = err.constraint;
      }

      assert.strictEqual(aEchoue, true, `L'insertion du code majuscule/mixte '${code}' doit échouer`);
      assert.strictEqual(codeErreur, '23514', `Erreur attendue 23514 pour '${code}', reçu: ${codeErreur}`);
      assert.strictEqual(contrainteNom, 'chk_champs_interdiction_medicale');
    }
  });

  await t.test('ÉPREUVE 2.3 : Rejet SQL 23514 de chaque variante médicale dans libelle (avec accents et casse)', async () => {
    let index = 0;
    for (const libelle of VARIANTES_LIBELLE_MEDICAUX) {
      index++;
      const codeNeutre = `c_neutre_${index}`;
      let aEchoue = false;
      let codeErreur = null;
      let contrainteNom = null;

      try {
        await pool.query(`
          INSERT INTO champs_personnalises (
            id, entite_cible, code_champ, libelle, type_donnee, ordre_affichage, est_obligatoire, est_actif
          ) VALUES ($1, 'AGENT', $2, $3, 'TEXTE', 99, false, true)
        `, [crypto.randomUUID(), codeNeutre, libelle]);
      } catch (err) {
        aEchoue = true;
        codeErreur = err.code;
        contrainteNom = err.constraint;
      }

      assert.strictEqual(aEchoue, true, `L'insertion SQL du libelle médical '${libelle}' doit être rejetée`);
      assert.strictEqual(codeErreur, '23514', `L'erreur SQL pour '${libelle}' doit être 23514, reçu: ${codeErreur}`);
      assert.strictEqual(contrainteNom, 'chk_champs_interdiction_medicale', `Contrainte violée doit être chk_champs_interdiction_medicale`);
    }
  });

  await t.test('ÉPREUVE 2.4 : Rejet SQL 23514 des phrases complexes contenant du vocabulaire médical', async () => {
    const phrases = [
      'Suivi de la glycémie à jeun de l agent',
      'Prise de médicament régulière le matin',
      'Contrôle de la tension artérielle annuelle',
      'Test sérologique VIH avant mission',
      'Antécédent de cancer familial',
      'Hospitalisation pour chirurgie lourde'
    ];

    let pIdx = 0;
    for (const phrase of phrases) {
      pIdx++;
      let aEchoue = false;
      let codeErreur = null;
      let contrainteNom = null;

      try {
        await pool.query(`
          INSERT INTO champs_personnalises (
            id, entite_cible, code_champ, libelle, type_donnee, ordre_affichage, est_obligatoire, est_actif
          ) VALUES ($1, 'AGENT', $2, $3, 'TEXTE', 99, false, true)
        `, [crypto.randomUUID(), `c_phr_${pIdx}`, phrase]);
      } catch (err) {
        aEchoue = true;
        codeErreur = err.code;
        contrainteNom = err.constraint;
      }

      assert.strictEqual(aEchoue, true, `La phrase complexe '${phrase}' doit être rejetée`);
      assert.strictEqual(codeErreur, '23514', `Erreur attendue 23514 pour phrase '${phrase}', reçu: ${codeErreur}`);
      assert.strictEqual(contrainteNom, 'chk_champs_interdiction_medicale');
    }
  });

  await t.test('ÉPREUVE 2.5 : Insertion légitime de champs policiers non-médicaux (absence de faux positifs)', async () => {
    const champsLegitimes = [
      { code: 'pointure_chaussure_verif', libelle: 'Pointure de rangers de dotation', type: 'NOMBRE' },
      { code: 'taille_treillis_verif', libelle: 'Taille du pantalon de treillis', type: 'TEXTE' },
      { code: 'numero_casier_verif', libelle: 'Numéro de casier armurerie', type: 'TEXTE' }
    ];

    for (const c of champsLegitimes) {
      const testId = crypto.randomUUID();
      const res = await pool.query(`
        INSERT INTO champs_personnalises (
          id, entite_cible, code_champ, libelle, type_donnee, ordre_affichage, est_obligatoire, est_actif
        ) VALUES ($1, 'AGENT', $2, $3, $4, 50, false, true)
        RETURNING id
      `, [testId, c.code, c.libelle, c.type]);

      assert.strictEqual(res.rows.length, 1, `Le champ légitime '${c.code}' doit être inséré avec succès`);

      // Nettoyage immédiat
      await pool.query('DELETE FROM champs_personnalises WHERE id = $1', [testId]);
    }
  });

  // ==========================================================================
  // ÉPREUVE 3 : Immuabilité Absolue d'affectations (DELETE, UPDATE, TRUNCATE)
  // ==========================================================================
  await t.test('ÉPREUVE 3.1 : Blocage SQL strict de DELETE sur la table affectations', async () => {
    let aEchoue = false;
    let messageErreur = '';

    try {
      await pool.query("DELETE FROM affectations WHERE id = 'aff-001'");
    } catch (err) {
      aEchoue = true;
      messageErreur = err.message;
    }

    assert.strictEqual(aEchoue, true, 'La suppression directe DELETE FROM affectations doit lever une exception');
    assert.match(messageErreur, /VIOLATION INTEGRITE : L historique des affectations est immuable/i);
    assert.match(messageErreur, /suppression d une affectation est formellement interdite/i);
  });

  await t.test('ÉPREUVE 3.2 : Blocage SQL strict de TRUNCATE sur la table affectations', async () => {
    let aEchoue = false;
    let messageErreur = '';

    try {
      await pool.query('TRUNCATE TABLE affectations CASCADE');
    } catch (err) {
      aEchoue = true;
      messageErreur = err.message;
    }

    assert.strictEqual(aEchoue, true, 'TRUNCATE TABLE affectations doit lever une exception');
    assert.match(messageErreur, /VIOLATION SECURITE : L operation TRUNCATE est formellement interdite/i);
  });

  await t.test('ÉPREUVE 3.3 : Blocage SQL strict d\'UPDATE in-place sur une affectation active', async () => {
    let aEchoue = false;
    let messageErreur = '';

    try {
      await pool.query(`
        UPDATE affectations 
        SET unite_id = 'U-REG-ALI' 
        WHERE id = 'aff-001'
      `);
    } catch (err) {
      aEchoue = true;
      messageErreur = err.message;
    }

    assert.strictEqual(aEchoue, true, 'UPDATE in-place d\'une affectation courante doit lever une exception');
    assert.match(messageErreur, /VIOLATION INTEGRITE : Modification interdite de l historique d affectation/i);
  });

  await t.test('ÉPREUVE 3.4 : Blocage SQL strict d\'UPDATE sur une affectation passée/clôturée', async () => {
    const affPasseId = crypto.randomUUID();
    // PST-04 appartient à U-DSP (valide selon fk_affectations_poste_unite)
    await pool.query(`
      INSERT INTO affectations (
        id, agent_id, unite_id, poste_id, type_mouvement, date_debut, date_fin,
        est_affectation_courante, motif_mouvement, reference_arrete_ou_decision, cree_par
      ) VALUES (
        $1, 'agt-001', 'U-DSP', 'PST-04', 'MUTATION', '2024-01-01', '2024-12-31',
        FALSE, 'Affectation test archive', 'DEC-ARCHIVE-001', 'usr-admin-tech'
      )
    `, [affPasseId]);

    let aEchoue = false;
    let messageErreur = '';

    try {
      await pool.query(`
        UPDATE affectations 
        SET motif_mouvement = 'Modification clandestine' 
        WHERE id = $1
      `, [affPasseId]);
    } catch (err) {
      aEchoue = true;
      messageErreur = err.message;
    }

    assert.strictEqual(aEchoue, true, 'La modification d\'une affectation passée scellée doit être rejetée');
    assert.match(messageErreur, /VIOLATION INTEGRITE : Une affectation historique passee est scellee et ne peut etre modifiee/i);
  });

  await t.test('ÉPREUVE 3.5 : Seule la clôture atomique lors d\'une mutation est autorisée par trigger', async () => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Clôture légitime : est_affectation_courante devient FALSE, date_fin est renseignée
      const res = await client.query(`
        UPDATE affectations 
        SET date_fin = CURRENT_TIMESTAMP, est_affectation_courante = FALSE 
        WHERE id = 'aff-001' AND est_affectation_courante = TRUE
        RETURNING id, est_affectation_courante, date_fin
      `);

      assert.strictEqual(res.rows.length, 1, 'La clôture légitime de mutation doit réussir');
      assert.strictEqual(res.rows[0].est_affectation_courante, false);
      assert.ok(res.rows[0].date_fin !== null);

      // Rollback immédiat pour conserver l'état propre du seed
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
  });

  // ==========================================================================
  // ÉPREUVE 4 : Hygiène et Immuabilité du Journal d'Audit
  // ==========================================================================
  await t.test('ÉPREUVE 4.1 : Recherche exhaustive de termes médicaux dans journaux_audit (doit être 0 ligne)', async () => {
    const res = await pool.query(`
      SELECT id, horodatage, action_type, details_operation_json
      FROM journaux_audit
      WHERE (details_operation_json::text ~* '(medicament|maladie|sante|pathologie|glycemie|tension|medecin|hopital|clinique|diagnostic|vih|sida|diabete|psychiatrie|psy|infirmite|ordonnance|posologie|sang|groupe_sanguin|handicap|grossesse|cancer|chirurgie|symptome|pouls|temperature|consultation)')
         OR (action_type ~* '(medicament|maladie|sante|pathologie|glycemie|tension)')
    `);

    assert.strictEqual(res.rows.length, 0, `Le journal d'audit doit être 100% exempt de termes médicaux (trouvé ${res.rows.length} lignes)`);
  });

  await t.test('ÉPREUVE 4.2 : Immuabilité absolue de journaux_audit (DELETE, UPDATE, TRUNCATE bloqués)', async () => {
    // 1. DELETE
    let errDel = null;
    try {
      await pool.query('DELETE FROM journaux_audit WHERE id = 1');
    } catch (err) {
      errDel = err;
    }
    assert.ok(errDel, 'DELETE FROM journaux_audit doit échouer');
    assert.match(errDel.message, /VIOLATION SECURITE : Le journal d audit est strictement immuable/i);

    // 2. UPDATE
    let errUpd = null;
    try {
      await pool.query("UPDATE journaux_audit SET action_type = 'FRAUDE' WHERE id = 1");
    } catch (err) {
      errUpd = err;
    }
    assert.ok(errUpd, 'UPDATE sur journaux_audit doit échouer');
    assert.match(errUpd.message, /VIOLATION SECURITE : Le journal d audit est strictement immuable/i);

    // 3. TRUNCATE
    let errTrunc = null;
    try {
      await pool.query('TRUNCATE TABLE journaux_audit');
    } catch (err) {
      errTrunc = err;
    }
    assert.ok(errTrunc, 'TRUNCATE TABLE journaux_audit doit échouer');
    assert.match(errTrunc.message, /VIOLATION SECURITE : L operation TRUNCATE est formellement interdite/i);
  });

  await t.test('ÉPREUVE 4.3 : Vérification cryptographique SHA-256 de la chaîne d\'audit', async () => {
    const chaineVerif = await auditService.verifierIntegriteChaine();
    assert.strictEqual(chaineVerif.valid, true, 'La chaîne cryptographique SHA-256 doit être 100% valide');
    assert.strictEqual(chaineVerif.errors.length, 0, 'Aucune rupture de hachage dans journaux_audit');
    assert.ok(chaineVerif.count >= 1, 'Au moins le bloc genèse doit être présent');
  });

  // ==========================================================================
  // ÉPREUVE 5 : Hygiène de l'Audit après Tentatives d'Injections via API
  // ==========================================================================
  await t.test('ÉPREUVE 5.1 : Rejet API et absence de pollution du journal d\'audit après attaque Form Builder', async () => {
    // Tentative 1 : code médical via POST /api/config/champs
    const resPostCode = await app.inject({
      method: 'POST',
      url: '/api/config/champs',
      headers: { Authorization: `Bearer ${jetonAdminFonc}` },
      payload: {
        code_champ: 'medicament_agent_inject',
        libelle: 'Champ Test',
        type_donnee: 'TEXTE',
        entite_cible: 'AGENT'
      }
    });
    assert.strictEqual(resPostCode.statusCode, 400, 'Rejet HTTP 400 attendu');
    const corpsCode = JSON.parse(resPostCode.payload);
    assert.match(corpsCode.message, /INTERDICTION_SECRET_MEDICAL/i);

    // Tentative 2 : libellé médical via POST /api/config/champs
    const resPostLib = await app.inject({
      method: 'POST',
      url: '/api/config/champs',
      headers: { Authorization: `Bearer ${jetonAdminFonc}` },
      payload: {
        code_champ: 'taux_glycemie_inject',
        libelle: 'Taux de glycémie de l agent',
        type_donnee: 'TEXTE',
        entite_cible: 'AGENT'
      }
    });
    assert.strictEqual(resPostLib.statusCode, 400, 'Rejet HTTP 400 attendu');
    const corpsLib = JSON.parse(resPostLib.payload);
    assert.match(corpsLib.message, /INTERDICTION_SECRET_MEDICAL/i);

    // Vérification : Aucun terme médical n'a été enregistré dans journaux_audit
    const verifAudit = await pool.query(`
      SELECT COUNT(*) AS total_invalide
      FROM journaux_audit
      WHERE details_operation_json::text ~* '(medicament|glycemie)'
    `);
    assert.strictEqual(parseInt(verifAudit.rows[0].total_invalide, 10), 0, 'Aucun log ne doit contenir les termes médicaux rejetés');
  });
});
