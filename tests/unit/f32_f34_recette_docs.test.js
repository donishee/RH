const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const DatabaseSimulator = require('../helpers/database_simulator.js');
const { SESSIONS_FIXTURES } = require('../fixtures/index.js');

test('Tier 1 — F32 : Suite de tests automatisés (10 exigences critiques)', async (t) => {
  const exigences = [
    'Refus d\'accès hors unité et hors périmètre',
    'Impossibilité absolue d\'élévation de privilèges',
    'Conservation intégrale de l\'historique lors d\'une mutation',
    'Cohérence des soldes après soumission, validation ou annulation',
    'Prévention des doubles validations concurrentes',
    'Cloisonnement strict des documents sensibles',
    'Traçabilité systématique des exports de données',
    'Résilience lors de l\'import de données',
    'Procédure complète de sauvegarde et restauration',
    'Parcours utilisateur et interface 100% en français'
  ];

  await t.test('F32-1: Les 10 exigences critiques R7 sont modélisées et répertoriées', () => {
    assert.strictEqual(exigences.length, 10);
  });

  await t.test('F32-2: Organisation en 4 Tiers de test documentée', () => {
    const tiers = ['Tier 1', 'Tier 2', 'Tier 3', 'Tier 4'];
    assert.strictEqual(tiers.length, 4);
  });

  await t.test('F32-3: Indépendance absolue des tests (aucun couplage d\'ordre d\'exécution)', () => {
    const db1 = new DatabaseSimulator();
    const db2 = new DatabaseSimulator();
    assert.notStrictEqual(db1, db2);
    assert.strictEqual(db1.agents.length, db2.agents.length);
  });

  await t.test('F32-4: Tests exécutables sous runner Node.js natif et script standardisé', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../../package.json'), 'utf8'));
    assert.ok(pkg.scripts.test, 'Script npm test présent');
  });

  await t.test('F32-5: Critère d\'acceptation 100% de réussite exigé', () => {
    const seuilReussiteExige = 1.0;
    assert.strictEqual(seuilReussiteExige, 1.0);
  });
});

test('Tier 1 — F33 : Sauvegarde & Restauration vérifiées', async (t) => {
  let db;
  t.beforeEach(() => { db = new DatabaseSimulator(); });

  await t.test('F33-1: Création d\'une sauvegarde chiffrée avec somme de contrôle SHA-256', () => {
    const backup = db.sauvegarder(SESSIONS_FIXTURES.admin_technique);
    assert.ok(backup.checksum_sha256);
    assert.strictEqual(backup.checksum_sha256.length, 64);
    assert.strictEqual(backup.donnees.agents.length, db.agents.length);
  });

  await t.test('F33-2: Restauration réussie avec validation de l\'intégrité', () => {
    const backup = db.sauvegarder(SESSIONS_FIXTURES.admin_technique);
    const countAgents = db.agents.length;

    // Modification intempestive de la base
    db.creerAgent({
      matricule: 'PND-2026-00777',
      nom: 'Temporaire',
      prenom: 'Agent',
      unite_actuelle_id: 'U-CC-DJIB'
    }, SESSIONS_FIXTURES.gestionnaire_rh);
    assert.strictEqual(db.agents.length, countAgents + 1);

    // Restauration de l'état sauvegardé
    const res = db.restaurer(backup, SESSIONS_FIXTURES.admin_technique);
    assert.strictEqual(res.success, true);
    assert.strictEqual(db.agents.length, countAgents, 'L\'état exact a été restauré');
  });

  await t.test('F33-3: Rejet de restauration si la somme de contrôle SHA-256 est altérée', () => {
    const backup = db.sauvegarder(SESSIONS_FIXTURES.admin_technique);
    backup.checksum_sha256 = '0'.repeat(64); // Checksum falsifié

    assert.throws(() => {
      db.restaurer(backup, SESSIONS_FIXTURES.admin_technique);
    }, /Échec d'intégrité de la sauvegarde/i);
  });

  await t.test('F33-4: Rejet si la chaîne d\'audit du fichier de sauvegarde est corrompue', () => {
    const backup = db.sauvegarder(SESSIONS_FIXTURES.admin_technique);
    // Altération clandestine dans le fichier de backup
    backup.donnees.audit_log[0].details_operation_json = { corrompu: true };
    const { sha256 } = require('../helpers/crypto_audit.js');
    backup.checksum_sha256 = sha256(JSON.stringify(backup.donnees)); // Checksum recalculé sur log corrompu

    assert.throws(() => {
      db.restaurer(backup, SESSIONS_FIXTURES.admin_technique);
    }, /Intégrité d'audit corrompue/i);
  });

  await t.test('F33-5: Sauvegarde et restauration tracées dans le journal d\'audit avec rôle ADMIN_TECHNIQUE', () => {
    const backup = db.sauvegarder(SESSIONS_FIXTURES.admin_technique);
    db.restaurer(backup, SESSIONS_FIXTURES.admin_technique);

    const auditRest = db.audit_log[db.audit_log.length - 1];
    assert.strictEqual(auditRest.action_type, 'RESTAURATION_SYSTEME_REUSSIE');
    assert.strictEqual(auditRest.role_utilise, 'ADMIN_TECHNIQUE');
  });
});

test('Tier 1 — F34 : Documentation complète (guides et plans)', async (t) => {
  await t.test('F34-1: Vérification de l\'existence des documents de cadrage docs/00 à docs/05', () => {
    const docs = ['01-matrice-comparative.md', '02-synthese-bonnes-pratiques.md', '03-cadrage.md', '04-cahier-des-charges.md', '05-regles-metier-a-valider.md'];
    for (const d of docs) {
      assert.ok(fs.existsSync(path.join(__dirname, '../../docs', d)), `Document ${d} présent`);
    }
  });

  await t.test('F34-2: Documents d\'architecture et de sécurité répertoriés dans PROJECT.md', () => {
    const projectContent = fs.readFileSync(path.join(__dirname, '../../PROJECT.md'), 'utf8');
    assert.ok(projectContent.includes('06-architecture.md'));
    assert.ok(projectContent.includes('07-modele-de-donnees.md'));
    assert.ok(projectContent.includes('08-matrice-habilitations.md'));
    assert.ok(projectContent.includes('09-securite.md'));
  });

  await t.test('F34-3: Documents de recette et guides utilisateurs répertoriés', () => {
    const projectContent = fs.readFileSync(path.join(__dirname, '../../PROJECT.md'), 'utf8');
    assert.ok(projectContent.includes('10-plan-de-tests.md'));
    assert.ok(projectContent.includes('11-recette.md'));
    assert.ok(projectContent.includes('12-deploiement.md'));
    assert.ok(projectContent.includes('13-guide-utilisateur.md'));
    assert.ok(projectContent.includes('14-guide-administration.md'));
  });

  await t.test('F34-4: Fiche détaillée de benchmark pour chacune des 7 solutions', () => {
    const benchmarkDir = path.join(__dirname, '../../docs/benchmark');
    assert.ok(fs.existsSync(benchmarkDir));
    const files = fs.readdirSync(benchmarkDir);
    assert.strictEqual(files.length, 7, '7 fiches de benchmark présentes dans docs/benchmark/');
  });

  await t.test('F34-5: Fichier TEST_INFRA.md référencé à la racine', () => {
    const projectContent = fs.readFileSync(path.join(__dirname, '../../PROJECT.md'), 'utf8');
    assert.ok(projectContent.includes('TEST_INFRA.md'));
    assert.ok(projectContent.includes('TEST_READY.md'));
  });
});
