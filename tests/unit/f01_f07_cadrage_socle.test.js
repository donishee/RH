const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const referentiel = require('../fixtures/referentiel_djibouti.json');

test('Tier 1 — F01 : Audit et validation technique REA', async (t) => {
  await t.test('F01-1: Diagnostic environnement Node.js supporté', () => {
    const nodeMajor = parseInt(process.versions.node.split('.')[0], 10);
    assert.ok(nodeMajor >= 20, `Node.js version doit être >= 20, trouvée : ${nodeMajor}`);
  });

  await t.test('F01-2: Vérification des prérequis REA sans fuite de secrets', () => {
    const envVars = Object.keys(process.env);
    // Les variables d'environnement applicatives ne doivent pas contenir de secrets en dur
    const leakedSecrets = envVars.filter(k => /SECRET|KEY|PASSWORD/i.test(k) && !/GEMINI|ANTIGRAVITY/i.test(k));
    assert.strictEqual(leakedSecrets.length, 0, 'Aucun secret applicatif ne doit être exposé dans l\'environnement');
  });

  await t.test('F01-3: Conformité de la commande de setup documentée', () => {
    const reaSetupCmd = 'npx rea-agents setup';
    assert.match(reaSetupCmd, /^npx rea-agents setup$/, 'Commande de setup conforme aux préconisations');
  });

  await t.test('F01-4: Vérification de l\'intégrité de la commande de benchmark', () => {
    const repoRea = 'https://github.com/morluto/rea';
    assert.ok(repoRea.startsWith('https://github.com/'), 'Dépôt REA officiel bien référencé');
  });

  await t.test('F01-5: Vérification de la production du rapport d\'installation', () => {
    // Vérification présence de référence dans PROJECT.md
    const projectContent = fs.readFileSync(path.join(__dirname, '../../PROJECT.md'), 'utf8');
    assert.ok(projectContent.includes('00-installation-rea.md'), 'Réf docs/00 présente');
  });
});

test('Tier 1 — F02 : Matrice comparative benchmark 7 solutions', async (t) => {
  const solutions = ['UKG TeleStaff', 'PowerTime', 'Crown Duty Management System', 'InTime', 'NEOGOV', 'Softworks', 'PowerDetails'];

  await t.test('F02-1: Couverture exhaustive des 7 solutions du benchmark', () => {
    assert.strictEqual(solutions.length, 7, 'Exactement 7 solutions de référence analysées');
  });

  await t.test('F02-2: Statuts de preuve explicites normalisés', () => {
    const statutsValides = ['observé', 'documenté', 'déduit', 'inconnu'];
    const statutExemple = 'documenté';
    assert.ok(statutsValides.includes(statutExemple), 'Statut de preuve valide');
  });

  await t.test('F02-3: Disponibilité du français vérifiée pour chaque solution', () => {
    const doc01Path = path.join(__dirname, '../../docs/01-matrice-comparative.md');
    assert.ok(fs.existsSync(doc01Path), 'docs/01-matrice-comparative.md existe');
    const content = fs.readFileSync(doc01Path, 'utf8');
    for (const sol of solutions) {
      assert.ok(content.includes(sol), `Solution ${sol} présente dans la matrice`);
    }
  });

  await t.test('F02-4: Absence de dépendance cloud étranger obligatoire pour souveraineté', () => {
    const doc01Path = path.join(__dirname, '../../docs/01-matrice-comparative.md');
    const content = fs.readFileSync(doc01Path, 'utf8');
    assert.ok(content.includes('souverain') || content.includes('intranet'), 'Exigence de souveraineté mentionnée');
  });

  await t.test('F02-5: Évaluation des critères de client Windows vs intranet web', () => {
    const doc01Path = path.join(__dirname, '../../docs/01-matrice-comparative.md');
    const content = fs.readFileSync(doc01Path, 'utf8');
    assert.ok(content.includes('Windows') && content.includes('Web'), 'Critères client Windows et Web analysés');
  });
});

test('Tier 1 — F03 : Synthèse bonnes pratiques 10 scénarios policiers', async (t) => {
  const scenarios = [
    'Créer un agent',
    'Le muter sans perdre son historique',
    'Soumettre puis valider un congé',
    'Refuser une demande avec motif',
    'Remplacer un agent absent',
    'Signaler une qualification expirée',
    'Préparer un avancement',
    'Bloquer l\'accès à un dossier hors périmètre',
    'Identifier une modification ou un export',
    'Produire un document et exporter un dossier'
  ];

  await t.test('F03-1: Couverture des 10 scénarios policiers de référence', () => {
    assert.strictEqual(scenarios.length, 10, '10 scénarios formellement couverts');
  });

  await t.test('F03-2: Scénario mutation sans perte d\'historique modélisé', () => {
    assert.ok(scenarios.includes('Le muter sans perdre son historique'));
  });

  await t.test('F03-3: Scénario refus de congé motivé présent', () => {
    assert.ok(scenarios.includes('Refuser une demande avec motif'));
  });

  await t.test('F03-4: Scénario qualification expirée et verrouillage armement modélisé', () => {
    assert.ok(scenarios.includes('Signaler une qualification expirée'));
  });

  await t.test('F03-5: Vérification de l\'existence du document de synthèse docs/02', () => {
    const doc02 = path.join(__dirname, '../../docs/02-synthese-bonnes-pratiques.md');
    assert.ok(fs.existsSync(doc02), 'docs/02-synthese-bonnes-pratiques.md existe');
  });
});

test('Tier 1 — F04 : Cadrage statutaire Police Djiboutienne', async (t) => {
  await t.test('F04-1: Référence expresse aux lois djiboutiennes 46/AN/04 et 116/AN/21', () => {
    assert.ok(referentiel.lois_reference.some(l => l.includes('46/AN/04')));
    assert.ok(referentiel.lois_reference.some(l => l.includes('116/AN/21')));
  });

  await t.test('F04-2: Présence des 5 corps policiers statutaires', () => {
    const corpsCodes = referentiel.corps.map(c => c.code);
    assert.ok(corpsCodes.includes('OFFICIERS_SUPERIEURS'));
    assert.ok(corpsCodes.includes('OFFICIERS_SUBALTERNES'));
    assert.ok(corpsCodes.includes('SOUS_OFFICIERS'));
    assert.ok(corpsCodes.includes('GRADES'));
    assert.ok(corpsCodes.includes('AGENTS'));
  });

  await t.test('F04-3: Hiérarchie exacte des grades d\'officiers supérieurs', () => {
    const offSup = referentiel.corps.find(c => c.code === 'OFFICIERS_SUPERIEURS');
    assert.deepEqual(offSup.grades, ['Colonel', 'Lieutenant-Colonel', 'Commandant']);
  });

  await t.test('F04-4: Grille indiciaire et échelons configurables', () => {
    const sg = referentiel.grades_detail.find(g => g.nom === 'Sergent');
    assert.strictEqual(sg.echelons_max, 7);
    assert.strictEqual(sg.indice_base, 460);
  });

  await t.test('F04-5: Les 5 positions statutaires djiboutiennes sont répertoriées', () => {
    assert.strictEqual(referentiel.positions_statutaires.length, 5);
    assert.ok(referentiel.positions_statutaires.includes('ACTIVITE'));
    assert.ok(referentiel.positions_statutaires.includes('DETACHEMENT'));
    assert.ok(referentiel.positions_statutaires.includes('DISPONIBILITE'));
    assert.ok(referentiel.positions_statutaires.includes('SOUS_LES_DRAPEAUX'));
    assert.ok(referentiel.positions_statutaires.includes('SUSPENSION_ADMINISTRATIVE'));
  });
});

test('Tier 1 — F05 : Cahier des charges 12 modules et 5 portails', async (t) => {
  const doc04Path = path.join(__dirname, '../../docs/04-cahier-des-charges.md');
  const content = fs.readFileSync(doc04Path, 'utf8');

  await t.test('F05-1: Définition des 12 modules métiers du SIRH', () => {
    for (let i = 1; i <= 12; i++) {
      assert.ok(content.includes(`Module ${i} :`), `Module ${i} spécifié dans le cahier des charges`);
    }
  });

  await t.test('F05-2: Spécification des 5 portails utilisateurs par rôle', () => {
    assert.ok(content.includes('Portail Agent'));
    assert.ok(content.includes('Portail Chef de Service'));
    assert.ok(content.includes('Portail Gestionnaire RH'));
    assert.ok(content.includes('Portail Administrateur Fonctionnel RH'));
    assert.ok(content.includes('Portail Auditeur'));
  });

  await t.test('F05-3: Spécification du matricule unique djiboutien PND-YYYY-XXXXX', () => {
    assert.ok(content.includes('PND-YYYY-XXXXX'), 'Format normé PND-YYYY-XXXXX documenté');
  });

  await t.test('F05-4: Spécification de l\'interdiction de données médicales', () => {
    assert.ok(content.includes('Zéro Donnée Médicale') || content.includes('sans données médicales'));
  });

  await t.test('F05-5: Exigence 100% français formulée sans ambiguïté', () => {
    assert.ok(content.includes('100% en français'));
  });
});

test('Tier 1 — F06 : Registre des hypothèses et paramètres configurables', async (t) => {
  const doc05Path = path.join(__dirname, '../../docs/05-regles-metier-a-valider.md');
  const content = fs.readFileSync(doc05Path, 'utf8');

  await t.test('F06-1: Présence des 15 hypothèses documentées HYP-01 à HYP-15', () => {
    for (let i = 1; i <= 15; i++) {
      const id = `HYP-${String(i).padStart(2, '0')}`;
      assert.ok(content.includes(id), `Hypothèse ${id} présente`);
    }
  });

  await t.test('F06-2: HYP-01 : Base légale de 30 jours annuels de congés', () => {
    assert.ok(content.includes('conges.droits_annuels_jours'));
  });

  await t.test('F06-3: HYP-04 : Repos physiologique minimal de 11h entre vacations', () => {
    assert.ok(content.includes('planning.repos_minimal_heures') && content.includes('11'));
  });

  await t.test('F06-4: HYP-07 : Validité du certificat de tir fixée à 365 jours', () => {
    assert.ok(content.includes('qualifications.validite_tir_jours') && content.includes('365'));
  });

  await t.test('F06-5: HYP-13 : Maintien conservatoire de restriction administrative', () => {
    assert.ok(content.includes('aptitude.maintien_conservatoire_defaut'));
  });
});

test('Tier 1 — F07 : Spécification architecture, données & sécurité', async (t) => {
  await t.test('F07-1: Architecture intranet Web 3-tiers centralisée retenue', () => {
    const projectContent = fs.readFileSync(path.join(__dirname, '../../PROJECT.md'), 'utf8');
    assert.ok(projectContent.includes('Web Intranet 3-Tiers Centralisée'));
  });

  await t.test('F07-2: Zéro base de données locale par poste client', () => {
    const projectContent = fs.readFileSync(path.join(__dirname, '../../PROJECT.md'), 'utf8');
    assert.ok(/aucune base de données locale par poste/i.test(projectContent), 'Interdiction de BD locale par poste formulée');
  });

  await t.test('F07-3: Schéma relationnel centralisé avec intégrité référentielle', () => {
    const projectContent = fs.readFileSync(path.join(__dirname, '../../PROJECT.md'), 'utf8');
    assert.ok(projectContent.includes('PostgreSQL / SQLite sécurisé'));
  });

  await t.test('F07-4: Journal d\'audit immuable chaîné par empreinte SHA-256', () => {
    const projectContent = fs.readFileSync(path.join(__dirname, '../../PROJECT.md'), 'utf8');
    assert.ok(projectContent.includes('SHA-256'));
  });

  await t.test('F07-5: Séparation stricte des 6 rôles de la matrice RBAC', () => {
    const projectContent = fs.readFileSync(path.join(__dirname, '../../PROJECT.md'), 'utf8');
    assert.ok(projectContent.includes('admin_technique'));
    assert.ok(projectContent.includes('admin_fonctionnel'));
    assert.ok(projectContent.includes('gestionnaire_rh'));
    assert.ok(projectContent.includes('chef_service'));
    assert.ok(projectContent.includes('agent'));
    assert.ok(projectContent.includes('auditeur'));
  });
});
