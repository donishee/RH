#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { scanForEnglishTerms, FORBIDDEN_ENGLISH_TERMS } = require('../tests/helpers/french_linter.js');

console.log("================================================================================");
console.log("   CONTRÔLE LINGUISTIQUE RÉPUBLICAIN — 100% FRANÇAIS SOUVERAIN                  ");
console.log("   Direction Générale de la Police Nationale — République de Djibouti           ");
console.log("================================================================================\n");

const repertoiresACouvrirs = [
  path.join(__dirname, '..', 'src', 'public')
];

let totalFichiers = 0;
let totalViolations = 0;
const violationsDetaillees = [];

function scannerFichier(cheminFichier) {
  const extension = path.extname(cheminFichier).toLowerCase();
  if (!['.html', '.js', '.css'].includes(extension)) return;

  totalFichiers++;
  const contenu = fs.readFileSync(cheminFichier, 'utf-8');

  // Ignorer les commentaires de code et scripts tiers ou sélecteurs techniques si pertinent, mais scanner le texte visible
  // On utilise scanForEnglishTerms directement
  const res = scanForEnglishTerms(contenu);
  if (!res.is100PercentFrench) {
    totalViolations += res.violationCount;
    violationsDetaillees.push({
      fichier: cheminFichier,
      violations: res.violations
    });
  }
}

function parcourirRepertoire(dossier) {
  if (!fs.existsSync(dossier)) return;
  const elements = fs.readdirSync(dossier, { withFileTypes: true });
  for (const elem of elements) {
    const cheminComplet = path.join(dossier, elem.name);
    if (elem.isDirectory()) {
      parcourirRepertoire(cheminComplet);
    } else if (elem.isFile()) {
      scannerFichier(cheminComplet);
    }
  }
}

for (const rep of repertoiresACouvrirs) {
  parcourirRepertoire(rep);
}

if (totalViolations === 0) {
  console.log(`✓ SUCCÈS : ${totalFichiers} fichiers scannés dans src/public/.`);
  console.log("✓ ZÉRO VIOLATION LINGUISTIQUE DÉTECTÉE (100% Français Républicain).");
  process.exit(0);
} else {
  console.error(`✗ ÉCHEC : ${totalViolations} violation(s) linguistique(s) trouvée(s) :`);
  for (const v of violationsDetaillees) {
    console.error(`  - Fichier : ${v.fichier}`);
    for (const d of v.violations) {
      console.error(`    * Terme interdit : "${d.term}" dans le contexte : "${d.context.trim()}"`);
    }
  }
  process.exit(1);
}
