const test = require('node:test');
const assert = require('node:assert/strict');
const { validatePlanningShift } = require('../helpers/contract_validator.js');

test('Tier 2 — Limites & Bornes : Planning, Repos Physiologique et Durées', async (t) => {
  await t.test('B13: Borne exacte de 11h00 de repos -> Acceptée', () => {
    const res = validatePlanningShift({
      date_vacation: '2026-11-03',
      heure_debut: '07:00',
      heure_fin: '15:00',
      derniere_fin_service: '2026-11-02T20:00:00Z', // 20h00 à 07h00 = exactement 11h
      qualification_tir_valide: true,
      est_poste_arme: false
    });
    assert.strictEqual(res.valide, true);
  });

  await t.test('B14: Infraction limite : 10h50 de repos (10 min en dessous) -> Rejetée', () => {
    const res = validatePlanningShift({
      date_vacation: '2026-11-03',
      heure_debut: '07:00',
      heure_fin: '15:00',
      derniere_fin_service: '2026-11-02T20:10:00Z', // 10h50 de repos
      qualification_tir_valide: true,
      est_poste_arme: false
    });
    assert.strictEqual(res.valide, false);
    assert.ok(res.errors.some(e => e.regle === 'planning.repos_minimal_heures'));
  });

  await t.test('B15: Borne exacte de durée de vacation maximale (12h00) -> Acceptée', () => {
    const res = validatePlanningShift({
      date_vacation: '2026-11-03',
      heure_debut: '06:00',
      heure_fin: '18:00', // exactement 12 heures
      derniere_fin_service: '2026-11-02T18:00:00Z',
      qualification_tir_valide: true,
      est_poste_arme: false
    });
    assert.strictEqual(res.valide, true);
    assert.strictEqual(res.dureeHeures, 12);
  });

  await t.test('B16: Dépassement minime de durée de vacation (12h30) -> Rejetée', () => {
    const res = validatePlanningShift({
      date_vacation: '2026-11-03',
      heure_debut: '06:00',
      heure_fin: '18:30', // 12h30
      derniere_fin_service: '2026-11-02T17:00:00Z',
      qualification_tir_valide: true,
      est_poste_arme: false
    });
    assert.strictEqual(res.valide, false);
    assert.ok(res.errors.some(e => e.regle === 'planning.duree_max_vacation_heures'));
  });

  await t.test('B17: Contrôle du seuil d\'effectif minimal incompressible de brigade (40%)', () => {
    const effectifTheorique = 20; // 20 agents requis en brigade normale
    const seuilMinimumPct = 40; // HYP-14 : 40%
    const effectifMinimumRequis = Math.ceil((effectifTheorique * seuilMinimumPct) / 100); // 8 agents

    assert.strictEqual(effectifMinimumRequis, 8);

    // Cas 1 : 9 agents présents -> Au-dessus du seuil (OK)
    const presentsCas1 = 9;
    const estOperationnelCas1 = presentsCas1 >= effectifMinimumRequis;
    assert.strictEqual(estOperationnelCas1, true);

    // Cas 2 : 7 agents présents -> En-dessous du seuil (Alerte et blocage de congés)
    const presentsCas2 = 7;
    const estOperationnelCas2 = presentsCas2 >= effectifMinimumRequis;
    assert.strictEqual(estOperationnelCas2, false, 'Le sous-effectif critique doit être détecté');
  });
});
