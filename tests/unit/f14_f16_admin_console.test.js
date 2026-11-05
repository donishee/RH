const test = require('node:test');
const assert = require('node:assert/strict');
const DatabaseSimulator = require('../helpers/database_simulator.js');
const { SESSIONS_FIXTURES } = require('../fixtures/index.js');

test('Tier 1 — F14 : Form Builder dynamique (6 types de champs)', async (t) => {
  let db;
  t.beforeEach(() => { db = new DatabaseSimulator(); });

  await t.test('F14-1: Prise en charge des 6 types de champs obligatoires', () => {
    const champs = [
      { id: 'c1', cle: 'pointure', libelle: 'Pointure rangers', type_champ: 'nombre', est_obligatoire: true },
      { id: 'c2', cle: 'permis_conduire', libelle: 'Numéro permis', type_champ: 'texte', est_obligatoire: false },
      { id: 'c3', cle: 'date_visite', libelle: 'Date visite médicale', type_champ: 'date', est_obligatoire: true },
      { id: 'c4', cle: 'specialite', libelle: 'Spécialité d\'intervention', type_champ: 'liste', est_obligatoire: true },
      { id: 'c5', cle: 'apte_arme', libelle: 'Port d\'arme autorisé', type_champ: 'booleen', est_obligatoire: true },
      { id: 'c6', cle: 'scan_diplome', libelle: 'Copie du diplôme', type_champ: 'fichier', est_obligatoire: false }
    ];

    const config = db.publierConfiguration({
      champs_personnalises: champs,
      commentaire: 'Ajout des 6 types de champs',
      operateurSession: SESSIONS_FIXTURES.admin_fonctionnel
    });

    assert.strictEqual(config.champs_personnalises.length, 6);
    assert.strictEqual(db.configuration_active_version, 2);
  });

  await t.test('F14-2: Rejet immédiat en cas de type de champ non supporté', () => {
    assert.throws(() => {
      db.publierConfiguration({
        champs_personnalises: [
          { id: 'c_bad', cle: 'invalide', libelle: 'Champ invalide', type_champ: 'TYPE_NON_RECONNU' }
        ],
        operateurSession: SESSIONS_FIXTURES.admin_fonctionnel
      });
    }, /Type de champ personnalisé invalide/i);
  });

  await t.test('F14-3: Paramétrage du caractère obligatoire et ordre d\'affichage', () => {
    const champs = [
      { id: 'c1', cle: 'ordre_1', libelle: 'Premier', type_champ: 'texte', ordre_affichage: 1, est_obligatoire: true },
      { id: 'c2', cle: 'ordre_2', libelle: 'Second', type_champ: 'texte', ordre_affichage: 2, est_obligatoire: false }
    ];
    const config = db.publierConfiguration({ champs_personnalises: champs, operateurSession: SESSIONS_FIXTURES.admin_fonctionnel });
    assert.strictEqual(config.champs_personnalises[0].ordre_affichage, 1);
    assert.strictEqual(config.champs_personnalises[0].est_obligatoire, true);
    assert.strictEqual(config.champs_personnalises[1].est_obligatoire, false);
  });

  await t.test('F14-4: Seul l\'Admin Fonctionnel RH a le droit de publier une configuration', () => {
    // Vérification de la permission dans auth_context
    const { ROLE_PERMISSIONS } = require('../helpers/auth_context.js');
    assert.ok(ROLE_PERMISSIONS.ADMIN_FONCTIONNEL_RH.includes('config:champs_personnalises'));
    assert.ok(!ROLE_PERMISSIONS.ADMIN_TECHNIQUE.includes('config:champs_personnalises'));
    assert.ok(!ROLE_PERMISSIONS.GESTIONNAIRE_RH.includes('config:champs_personnalises'));
  });

  await t.test('F14-5: Publication sans redémarrage serveur', () => {
    // Dans l'architecture métadonnées, la publication incrémente la version à chaud
    const versionInit = db.configuration_active_version;
    db.publierConfiguration({
      champs_personnalises: [{ id: 'cx', cle: 'x', libelle: 'X', type_champ: 'texte' }],
      operateurSession: SESSIONS_FIXTURES.admin_fonctionnel
    });
    assert.strictEqual(db.configuration_active_version, versionInit + 1);
  });
});

test('Tier 1 — F15 : Gestion des listes de valeurs éditables', async (t) => {
  let db;
  t.beforeEach(() => { db = new DatabaseSimulator(); });

  await t.test('F15-1: Consultation des listes de valeurs par défaut', () => {
    const cfg = db.configurations.find(c => c.version_numero === db.configuration_active_version);
    assert.ok(cfg.listes_valeurs.specialites.includes('Circulation'));
    assert.ok(cfg.listes_valeurs.specialites.includes('Frontières'));
  });

  await t.test('F15-2: Ajout dynamique d\'une nouvelle valeur dans une liste', () => {
    const cfgInit = db.configurations[0];
    const nouvellesListes = JSON.parse(JSON.stringify(cfgInit.listes_valeurs));
    nouvellesListes.specialites.push('Cybersécurité');

    db.publierConfiguration({
      champs_personnalises: [],
      listes_valeurs: nouvellesListes,
      commentaire: 'Ajout spécialité Cybersécurité',
      operateurSession: SESSIONS_FIXTURES.admin_fonctionnel
    });

    const activeConfig = db.configurations.find(c => c.version_numero === db.configuration_active_version);
    assert.ok(activeConfig.listes_valeurs.specialites.includes('Cybersécurité'));
  });

  await t.test('F15-3: Création d\'une nouvelle liste de référence personnalisée', () => {
    const listes = {
      types_permis_police: ['Véhicule léger', 'Motocyclette', 'Poids lourd', 'Vedette côtière']
    };
    db.publierConfiguration({
      champs_personnalises: [],
      listes_valeurs: listes,
      commentaire: 'Nouvelle liste de permis',
      operateurSession: SESSIONS_FIXTURES.admin_fonctionnel
    });

    const activeConfig = db.configurations.find(c => c.version_numero === db.configuration_active_version);
    assert.deepEqual(activeConfig.listes_valeurs.types_permis_police, ['Véhicule léger', 'Motocyclette', 'Poids lourd', 'Vedette côtière']);
  });

  await t.test('F15-4: Traçabilité de la mise à jour des listes de valeurs dans l\'audit', () => {
    db.publierConfiguration({
      champs_personnalises: [],
      listes_valeurs: { test: ['A', 'B'] },
      commentaire: 'Audit test',
      operateurSession: SESSIONS_FIXTURES.admin_fonctionnel
    });

    const lastAudit = db.audit_log[db.audit_log.length - 1];
    assert.strictEqual(lastAudit.action_type, 'PUBLICATION_CONFIGURATION_RH');
    assert.strictEqual(lastAudit.role_utilise, 'ADMIN_FONCTIONNEL_RH');
  });

  await t.test('F15-5: Les listes sont verrouillées contre les modifications non autorisées', () => {
    const { ROLE_PERMISSIONS } = require('../helpers/auth_context.js');
    assert.ok(!ROLE_PERMISSIONS.CHEF_DE_SERVICE.includes('config:listes_valeurs'));
    assert.ok(!ROLE_PERMISSIONS.AGENT.includes('config:listes_valeurs'));
  });
});

test('Tier 1 — F16 : Versioning des configurations & Rollback instantané', async (t) => {
  let db;
  t.beforeEach(() => { db = new DatabaseSimulator(); });

  await t.test('F16-1: Historique complet des versions conservé dans le registre de snapshots', () => {
    db.publierConfiguration({ champs_personnalises: [], listes_valeurs: {}, commentaire: 'v2', operateurSession: SESSIONS_FIXTURES.admin_fonctionnel });
    db.publierConfiguration({ champs_personnalises: [], listes_valeurs: {}, commentaire: 'v3', operateurSession: SESSIONS_FIXTURES.admin_fonctionnel });

    assert.strictEqual(db.configurations.length, 3);
    assert.strictEqual(db.configuration_active_version, 3);
  });

  await t.test('F16-2: Rollback instantané vers une version antérieure', () => {
    // Config initiale v1
    assert.strictEqual(db.configuration_active_version, 1);

    // Publication v2 avec un champ
    db.publierConfiguration({
      champs_personnalises: [{ id: 'cf-v2', cle: 'v2_field', libelle: 'V2', type_champ: 'texte' }],
      commentaire: 'Ajout v2',
      operateurSession: SESSIONS_FIXTURES.admin_fonctionnel
    });
    assert.strictEqual(db.configuration_active_version, 2);

    // Rollback vers v1
    const res = db.rollbackConfiguration(1, SESSIONS_FIXTURES.admin_fonctionnel);
    assert.strictEqual(res.success, true);
    assert.strictEqual(db.configuration_active_version, 1);
  });

  await t.test('F16-3: Préservation des données agents existantes après rollback', () => {
    const nbAgentsInitial = db.agents.length;
    db.publierConfiguration({ champs_personnalises: [], commentaire: 'v2', operateurSession: SESSIONS_FIXTURES.admin_fonctionnel });
    db.rollbackConfiguration(1, SESSIONS_FIXTURES.admin_fonctionnel);

    assert.strictEqual(db.agents.length, nbAgentsInitial, 'Aucun agent n\'a été perdu pendant le rollback');
  });

  await t.test('F16-4: Rejet de rollback vers une version inexistante', () => {
    assert.throws(() => {
      db.rollbackConfiguration(999, SESSIONS_FIXTURES.admin_fonctionnel);
    }, /Version de configuration cible introuvable/i);
  });

  await t.test('F16-5: Enregistrement dans le journal d\'audit avec auteur et horodatage', () => {
    db.publierConfiguration({ champs_personnalises: [], commentaire: 'v2', operateurSession: SESSIONS_FIXTURES.admin_fonctionnel });
    db.rollbackConfiguration(1, SESSIONS_FIXTURES.admin_fonctionnel);

    const lastAudit = db.audit_log[db.audit_log.length - 1];
    assert.strictEqual(lastAudit.action_type, 'ROLLBACK_CONFIGURATION_RH');
    assert.strictEqual(lastAudit.details_operation_json.version_restauree, 1);
  });
});
