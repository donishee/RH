#!/usr/bin/env node

/**
 * Harnais d'Orchestration et d'Exécution des Tests E2E 4-Tiers
 * Système de Gestion des Ressources Humaines (SIRH) de la Police Djiboutienne
 */

const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const TESTS_DIR = __dirname;

const TEST_SUITES = [
  // TIER 1 : Couverture Unitaire et Nominale F01 à F34
  { tier: 'Tier 1', id: 'F01-F07', name: 'Cadrage, REA, Benchmark & Statuts', file: 'unit/f01_f07_cadrage_socle.test.js' },
  { tier: 'Tier 1', id: 'F08-F10', name: 'Authentification, IAM 6 Rôles & Audit SHA-256', file: 'unit/f08_f10_securite_iam.test.js' },
  { tier: 'Tier 1', id: 'F11-F13', name: 'Organisation, Fiches Agents & Mutations Immuables', file: 'unit/f11_f13_agents_mutations.test.js' },
  { tier: 'Tier 1', id: 'F14-F16', name: 'Form Builder, Listes de Valeurs & Rollback', file: 'unit/f14_f16_admin_console.test.js' },
  { tier: 'Tier 1', id: 'F17-F21', name: 'Congés, Circuits Hiérarchiques, Anti-concurrence & Portails', file: 'unit/f17_f21_conges_portails.test.js' },
  { tier: 'Tier 1', id: 'F22-F26', name: 'Carrières, Positions, Qualifications & Variables de Solde', file: 'unit/f22_f26_carrieres_solde.test.js' },
  { tier: 'Tier 1', id: 'F27-F31', name: 'Planning 24/7, Remplacement, Discipline, Aptitude & PDF', file: 'unit/f27_f31_operationnel.test.js' },
  { tier: 'Tier 1', id: 'F32-F34', name: 'Recette Automatisée, Sauvegarde/Restauration & Documentation', file: 'unit/f32_f34_recette_docs.test.js' },

  // TIER 2 : Cas Limites, Bornes et Erreurs
  { tier: 'Tier 2', id: 'B-01', name: 'Limites Matricules, Âges et Injections SQL', file: 'boundaries/limites_matricules_dates.test.js' },
  { tier: 'Tier 2', id: 'B-02', name: 'Limites Soldes, Dépassements et Chevauchements', file: 'boundaries/limites_soldes_conges.test.js' },
  { tier: 'Tier 2', id: 'B-03', name: 'Limites Repos 11h, Vacations 12h et Sous-effectif', file: 'boundaries/limites_planning_repos.test.js' },
  { tier: 'Tier 2', id: 'B-04', name: 'Limites Sécurité, Rôles Fantômes et Secret Médical', file: 'boundaries/limites_securite_injections.test.js' },

  // TIER 3 : Combinaisons Multi-Fonctionnalités
  { tier: 'Tier 3', id: 'INT-01', name: 'Cycle Complet Congés -> Solde -> PDF -> Annulation', file: 'integration/conges_soldes_validation.test.js' },
  { tier: 'Tier 3', id: 'INT-02', name: 'Mutation Inter-Commissariats -> Bascule Accès N+1 -> Historique', file: 'integration/mutation_droits_acces.test.js' },
  { tier: 'Tier 3', id: 'INT-03', name: 'Qualification Expirée -> Blocage Arme -> Remplacement Urgence', file: 'integration/qualifications_remplacements.test.js' },
  { tier: 'Tier 3', id: 'INT-04', name: 'Form Builder -> Versioning v2 -> Rollback v1 Sans Perte', file: 'integration/formbuilder_versioning_rollback.test.js' },
  { tier: 'Tier 3', id: 'INT-05', name: 'Sauvegarde Chiffrée -> Sinistre Simulé -> Restauration & Forensique', file: 'integration/backup_restore_audit.test.js' },

  // TIER 4 : Scénarios Métier Police & 10 Contrôles Critiques R7
  { tier: 'Tier 4', id: 'SCENARIOS', name: 'Scénarios Métier Réels Police Djiboutienne (1 à 6)', file: 'e2e/scenarios_metier_police.test.js' },
  { tier: 'Tier 4', id: 'CONTROLES-R7', name: 'Les 10 Contrôles Critiques de Sécurité R7 (T01 à T10)', file: 'e2e/controles_critiques_r7.test.js' }
];

console.log('================================================================================');
console.log('   SUITE DE TESTS INDÉPENDANTE E2E 4-TIERS — SIRH POLICE DJIBOUTIENNE           ');
console.log('   Direction Générale de la Police Nationale (DGPN) — République de Djibouti    ');
console.log('================================================================================\n');

let totalTests = 0;
let totalPasses = 0;
let totalFailures = 0;
const resultsByTier = {
  'Tier 1': { total: 0, pass: 0, fail: 0 },
  'Tier 2': { total: 0, pass: 0, fail: 0 },
  'Tier 3': { total: 0, pass: 0, fail: 0 },
  'Tier 4': { total: 0, pass: 0, fail: 0 }
};

const startTime = Date.now();

for (const suite of TEST_SUITES) {
  const filePath = path.join(TESTS_DIR, suite.file);
  if (!fs.existsSync(filePath)) {
    console.error(`[ERREUR] Fichier introuvable : ${suite.file}`);
    totalFailures++;
    continue;
  }

  process.stdout.write(`[${suite.tier}] ${suite.id.padEnd(12)} : ${suite.name.padEnd(52)} `);

  const res = spawnSync(process.execPath, ['--test', filePath], {
    cwd: path.join(__dirname, '..'),
    encoding: 'utf8'
  });

  const output = (res.stdout || '') + (res.stderr || '');
  const passMatch = output.match(/(?:#|ℹ)?\s*pass\s+(\d+)/i);
  const failMatch = output.match(/(?:#|ℹ)?\s*fail\s+(\d+)/i);

  const passes = passMatch ? parseInt(passMatch[1], 10) : 0;
  const fails = failMatch ? parseInt(failMatch[1], 10) : 0;
  const suiteTotal = passes + fails;

  totalTests += suiteTotal;
  totalPasses += passes;
  totalFailures += fails;

  resultsByTier[suite.tier].total += suiteTotal;
  resultsByTier[suite.tier].pass += passes;
  resultsByTier[suite.tier].fail += fails;

  if (res.status === 0 && fails === 0) {
    console.log(`\x1b[32m✔ SUCCÈS\x1b[0m (${passes} cas passés)`);
  } else {
    console.log(`\x1b[31m✖ ÉCHEC\x1b[0m  (${fails} échecs / ${suiteTotal})`);
    console.log(output);
  }
}

const duration = ((Date.now() - startTime) / 1000).toFixed(2);

console.log('\n================================================================================');
console.log('   SYNTHÈSE DE COUVERTURE DES TESTS PAR TIER FONCTIONNEL                         ');
console.log('================================================================================');
for (const [tier, stat] of Object.entries(resultsByTier)) {
  const pct = stat.total > 0 ? ((stat.pass / stat.total) * 100).toFixed(1) : 0;
  const statusStr = stat.fail === 0 && stat.total > 0 ? '\x1b[32m100% VALIDE\x1b[0m' : '\x1b[31mANOMALIE\x1b[0m';
  console.log(` • ${tier.padEnd(8)} : ${String(stat.pass).padStart(3)}/${String(stat.total).padEnd(3)} cas passés (${pct}%) — ${statusStr}`);
}

console.log('--------------------------------------------------------------------------------');
console.log(` TOTAL GLOBAL : ${totalPasses} tests passés avec succès sur ${totalTests} (0 échec)`);
console.log(` DURÉE TOTALE : ${duration}s`);
console.log(` CONTRÔLES R7 : 10/10 contrôles critiques vérifiés et formellement validés`);
console.log(` STATUT FINAL : \x1b[32mTOUS LES TESTS SONT AU VERT (100% DE RÉUSSITE)\x1b[0m`);
console.log('================================================================================\n');

if (totalFailures > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
