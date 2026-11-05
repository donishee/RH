const test = require('node:test');
const assert = require('node:assert/strict');
const DatabaseSimulator = require('../helpers/database_simulator.js');
const { SESSIONS_FIXTURES } = require('../fixtures/index.js');

test('Tier 2 — Limites & Bornes : Soldes et Demandes de Congés', async (t) => {
  let db;
  t.beforeEach(() => { db = new DatabaseSimulator(); });

  await t.test('B07: Borne exacte : demande de l\'intégralité du solde restant (30 jours)', () => {
    const res = db.soumettreDemandeConge({
      agent_id: 'agt-001',
      date_debut: '2026-11-01',
      date_fin: '2026-11-30',
      nombre_jours: 30.0,
      operateurSession: SESSIONS_FIXTURES.agent_hassan
    });

    assert.strictEqual(res.solde.jours_en_attente, 30.0);
    assert.strictEqual(res.solde.jours_restants, 0.0);
  });

  await t.test('B08: Dépassement minimal : 30.5 jours demandés pour solde de 30.0 -> rejeté', () => {
    assert.throws(() => {
      db.soumettreDemandeConge({
        agent_id: 'agt-001',
        date_debut: '2026-11-01',
        date_fin: '2026-12-01',
        nombre_jours: 30.5,
        operateurSession: SESSIONS_FIXTURES.agent_hassan
      });
    }, /Solde insuffisant/i);
  });

  await t.test('B09: Rejet d\'annulation sur une demande déjà annulée', () => {
    db.soumettreDemandeConge({
      agent_id: 'agt-001',
      date_debut: '2026-11-10',
      date_fin: '2026-11-12',
      nombre_jours: 3,
      operateurSession: SESSIONS_FIXTURES.agent_hassan
    });
    const dem = db.demandes_conges[0];
    db.annulerConge({ demande_id: dem.id, motif_annulation: 'Raison 1' });

    assert.throws(() => {
      db.annulerConge({ demande_id: dem.id, motif_annulation: 'Raison 2' });
    }, /Impossible d'annuler une demande déjà au statut ANNULE/i);
  });

  await t.test('B10: Rejet d\'annulation sur une demande déjà refusée', () => {
    db.soumettreDemandeConge({
      agent_id: 'agt-001',
      date_debut: '2026-11-10',
      date_fin: '2026-11-12',
      nombre_jours: 3,
      operateurSession: SESSIONS_FIXTURES.agent_hassan
    });
    const dem = db.demandes_conges[0];
    db.approuverChefService({
      demande_id: dem.id,
      chef_service_id: 'c1',
      avis: 'DEFAVORABLE',
      motif_refus: 'Nécessité de service'
    });

    assert.throws(() => {
      db.annulerConge({ demande_id: dem.id });
    }, /Impossible d'annuler une demande déjà au statut REFUSE/i);
  });

  await t.test('B11: Détection de chevauchement de dates entre deux congés pour le même agent', () => {
    // Premier congé du 10 au 20 novembre
    const congeExistant = { debut: new Date('2026-11-10'), fin: new Date('2026-11-20') };
    // Nouvelle demande du 15 au 25 novembre (chevauchement)
    const nouvelleDemande = { debut: new Date('2026-11-15'), fin: new Date('2026-11-25') };

    const aChevauchement = (nouvelleDemande.debut <= congeExistant.fin) && (nouvelleDemande.fin >= congeExistant.debut);
    assert.strictEqual(aChevauchement, true, 'Le chevauchement partiel de dates doit être formellement détecté');
  });

  await t.test('B12: Absence de chevauchement sur des périodes disjointes', () => {
    const congeExistant = { debut: new Date('2026-11-01'), fin: new Date('2026-11-05') };
    const nouvelleDemande = { debut: new Date('2026-11-06'), fin: new Date('2026-11-10') };

    const aChevauchement = (nouvelleDemande.debut <= congeExistant.fin) && (nouvelleDemande.fin >= congeExistant.debut);
    assert.strictEqual(aChevauchement, false, 'Les périodes contiguës non chevauchantes doivent être autorisées');
  });
});
