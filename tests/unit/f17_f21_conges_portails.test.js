const test = require('node:test');
const assert = require('node:assert/strict');
const DatabaseSimulator = require('../helpers/database_simulator.js');
const { SESSIONS_FIXTURES } = require('../fixtures/index.js');

test('Tier 1 — F17 : Gestion des congés et absences', async (t) => {
  let db;
  t.beforeEach(() => { db = new DatabaseSimulator(); });

  await t.test('F17-1: Calcul automatique des droits annuels à 30 jours', () => {
    const solde = db.getSolde('agt-001');
    assert.strictEqual(solde.jours_acquis, 30.0);
  });

  await t.test('F17-2: Soumission valide d\'une demande de congé annuel de 5 jours', () => {
    const res = db.soumettreDemandeConge({
      agent_id: 'agt-001',
      date_debut: '2026-11-10',
      date_fin: '2026-11-14',
      nombre_jours: 5,
      motif: 'Congé annuel de repos',
      operateurSession: SESSIONS_FIXTURES.agent_hassan
    });

    assert.strictEqual(res.demande.statut, 'SOUMIS');
    assert.strictEqual(res.demande.nombre_jours, 5);
    assert.strictEqual(res.solde.jours_en_attente, 5.0);
    assert.strictEqual(res.solde.jours_restants, 25.0);
  });

  await t.test('F17-3: Rejet de soumission avec nombre de jours négatif ou nul', () => {
    assert.throws(() => {
      db.soumettreDemandeConge({
        agent_id: 'agt-001',
        date_debut: '2026-11-10',
        date_fin: '2026-11-10',
        nombre_jours: 0,
        operateurSession: SESSIONS_FIXTURES.agent_hassan
      });
    }, /strictement positif/i);
  });

  await t.test('F17-4: Rejet de soumission en cas de dépassement du solde disponible', () => {
    assert.throws(() => {
      db.soumettreDemandeConge({
        agent_id: 'agt-001',
        date_debut: '2026-11-01',
        date_fin: '2026-12-15',
        nombre_jours: 35, // Solde dispo = 30
        operateurSession: SESSIONS_FIXTURES.agent_hassan
      });
    }, /Solde insuffisant/i);
  });

  await t.test('F17-5: Rejet de soumission si date_fin antérieure à date_debut', () => {
    assert.throws(() => {
      db.soumettreDemandeConge({
        agent_id: 'agt-001',
        date_debut: '2026-11-20',
        date_fin: '2026-11-10',
        nombre_jours: 5,
        operateurSession: SESSIONS_FIXTURES.agent_hassan
      });
    }, /Incohérence des dates/i);
  });
});

test('Tier 1 — F18 : Circuits de validation hiérarchiques', async (t) => {
  let db;
  t.beforeEach(() => {
    db = new DatabaseSimulator();
    db.soumettreDemandeConge({
      agent_id: 'agt-001',
      date_debut: '2026-11-10',
      date_fin: '2026-11-14',
      nombre_jours: 5,
      operateurSession: SESSIONS_FIXTURES.agent_hassan
    });
  });

  await t.test('F18-1: Étape 1 : Avis favorable du chef de service (statut APPROUVE_CHEF_SERVICE)', () => {
    const demande = db.demandes_conges[0];
    const res = db.approuverChefService({
      demande_id: demande.id,
      chef_service_id: 'usr-chef-cc',
      avis: 'FAVORABLE',
      operateurSession: SESSIONS_FIXTURES.chef_service_cc
    });

    assert.strictEqual(res.demande.statut, 'APPROUVE_CHEF_SERVICE');
    assert.strictEqual(res.demande.decision_chef_service, 'FAVORABLE');
  });

  await t.test('F18-2: Étape 1 : Refus du chef de service exige un motif obligatoire', () => {
    const demande = db.demandes_conges[0];
    assert.throws(() => {
      db.approuverChefService({
        demande_id: demande.id,
        chef_service_id: 'usr-chef-cc',
        avis: 'DEFAVORABLE',
        motif_refus: '', // Motif vide interdit
        operateurSession: SESSIONS_FIXTURES.chef_service_cc
      });
    }, /Motif de refus obligatoire/i);
  });

  await t.test('F18-3: Refus du chef de service restitue immédiatement les jours en attente', () => {
    const demande = db.demandes_conges[0];
    const res = db.approuverChefService({
      demande_id: demande.id,
      chef_service_id: 'usr-chef-cc',
      avis: 'DEFAVORABLE',
      motif_refus: 'Alerte opérationnelle renforcée — effectif minimal non atteint',
      operateurSession: SESSIONS_FIXTURES.chef_service_cc
    });

    assert.strictEqual(res.demande.statut, 'REFUSE');
    assert.strictEqual(res.solde.jours_en_attente, 0.0);
    assert.strictEqual(res.solde.jours_restants, 30.0);
  });

  await t.test('F18-4: Étape 2 : Validation RH centrale requiert l\'approbation préalable du chef', () => {
    const demande = db.demandes_conges[0]; // Encore au statut SOUMIS
    assert.throws(() => {
      db.validerRH({
        demande_id: demande.id,
        gestionnaire_rh_id: 'usr-rh-01',
        operateurSession: SESSIONS_FIXTURES.gestionnaire_rh
      });
    }, /Statut incompatible pour validation finale RH/i);
  });

  await t.test('F18-5: Étape 2 : Validation finale RH réussie après avis chef', () => {
    const demande = db.demandes_conges[0];
    db.approuverChefService({
      demande_id: demande.id,
      chef_service_id: 'usr-chef-cc',
      avis: 'FAVORABLE',
      operateurSession: SESSIONS_FIXTURES.chef_service_cc
    });

    const res = db.validerRH({
      demande_id: demande.id,
      gestionnaire_rh_id: 'usr-rh-01',
      operateurSession: SESSIONS_FIXTURES.gestionnaire_rh
    });

    assert.strictEqual(res.demande.statut, 'VALIDE_RH');
    assert.strictEqual(res.demande.decision_rh, 'VALIDE');
  });
});

test('Tier 1 — F19 : Décompte atomique & cohérence des soldes', async (t) => {
  let db;
  t.beforeEach(() => { db = new DatabaseSimulator(); });

  await t.test('F19-1: État initial : solde acquis = 30, pris = 0, attente = 0, restant = 30', () => {
    const s = db.getSolde('agt-001');
    assert.strictEqual(s.jours_acquis, 30.0);
    assert.strictEqual(s.jours_pris, 0.0);
    assert.strictEqual(s.jours_en_attente, 0.0);
    assert.strictEqual(s.jours_restants, 30.0);
  });

  await t.test('F19-2: Après soumission (8 jours) : attente = 8, restant = 22, pris = 0', () => {
    const res = db.soumettreDemandeConge({
      agent_id: 'agt-001',
      date_debut: '2026-11-01',
      date_fin: '2026-11-08',
      nombre_jours: 8,
      operateurSession: SESSIONS_FIXTURES.agent_hassan
    });
    assert.strictEqual(res.solde.jours_en_attente, 8.0);
    assert.strictEqual(res.solde.jours_pris, 0.0);
    assert.strictEqual(res.solde.jours_restants, 22.0);
  });

  await t.test('F19-3: Après validation finale RH : pris = 8, attente = 0, restant = 22', () => {
    db.soumettreDemandeConge({
      agent_id: 'agt-001',
      date_debut: '2026-11-01',
      date_fin: '2026-11-08',
      nombre_jours: 8,
      operateurSession: SESSIONS_FIXTURES.agent_hassan
    });
    const dem = db.demandes_conges[0];
    db.approuverChefService({ demande_id: dem.id, chef_service_id: 'c1', avis: 'FAVORABLE' });
    const res = db.validerRH({ demande_id: dem.id, gestionnaire_rh_id: 'rh1' });

    assert.strictEqual(res.solde.jours_pris, 8.0);
    assert.strictEqual(res.solde.jours_en_attente, 0.0);
    assert.strictEqual(res.solde.jours_restants, 22.0);
  });

  await t.test('F19-4: Après annulation du congé validé : jours_pris restitués, solde = 30', () => {
    db.soumettreDemandeConge({
      agent_id: 'agt-001',
      date_debut: '2026-11-01',
      date_fin: '2026-11-08',
      nombre_jours: 8,
      operateurSession: SESSIONS_FIXTURES.agent_hassan
    });
    const dem = db.demandes_conges[0];
    db.approuverChefService({ demande_id: dem.id, chef_service_id: 'c1', avis: 'FAVORABLE' });
    db.validerRH({ demande_id: dem.id, gestionnaire_rh_id: 'rh1' });

    const resAnnul = db.annulerConge({ demande_id: dem.id, motif_annulation: 'Rappel pour mission urgente' });
    assert.strictEqual(resAnnul.demande.statut, 'ANNULE');
    assert.strictEqual(resAnnul.solde.jours_pris, 0.0);
    assert.strictEqual(resAnnul.solde.jours_en_attente, 0.0);
    assert.strictEqual(resAnnul.solde.jours_restants, 30.0);
  });

  await t.test('F19-5: Conservation de la formule invariante : acquis = pris + en_attente + restants', () => {
    const s = db.getSolde('agt-001');
    assert.strictEqual(s.jours_acquis, s.jours_pris + s.jours_en_attente + s.jours_restants);
  });
});

test('Tier 1 — F20 : Verrouillage anti-concurrence de validation', async (t) => {
  let db;
  t.beforeEach(() => {
    db = new DatabaseSimulator();
    db.soumettreDemandeConge({
      agent_id: 'agt-001',
      date_debut: '2026-11-10',
      date_fin: '2026-11-15',
      nombre_jours: 5,
      operateurSession: SESSIONS_FIXTURES.agent_hassan
    });
    const dem = db.demandes_conges[0];
    db.approuverChefService({ demande_id: dem.id, chef_service_id: 'c1', avis: 'FAVORABLE' });
  });

  await t.test('F20-1: Version de concurrence initialisée à 1 puis incrémentée à 2 après approbation chef', () => {
    const dem = db.demandes_conges[0];
    assert.strictEqual(dem.version_concurrence, 2);
  });

  await t.test('F20-2: Première validation avec version 2 réussit et passe à version 3', () => {
    const dem = db.demandes_conges[0];
    const res = db.validerRH({
      demande_id: dem.id,
      gestionnaire_rh_id: 'usr-rh-01',
      version_fournie: 2
    });
    assert.strictEqual(res.demande.statut, 'VALIDE_RH');
    assert.strictEqual(res.demande.version_concurrence, 3);
  });

  await t.test('F20-3: Deuxième validation concurrente avec version obsolète (2) rejetée avec HTTP 409', () => {
    const dem = db.demandes_conges[0];
    // Gestionnaire 1 valide
    db.validerRH({ demande_id: dem.id, gestionnaire_rh_id: 'rh-1', version_fournie: 2 });

    // Gestionnaire 2 tente de valider simultanément avec la version obsolète 2
    assert.throws(() => {
      db.validerRH({ demande_id: dem.id, gestionnaire_rh_id: 'rh-2', version_fournie: 2 });
    }, (err) => {
      assert.strictEqual(err.code, 409);
      assert.match(err.message, /Conflit de concurrence/i);
      return true;
    });
  });

  await t.test('F20-4: Le solde n\'est débité qu\'une seule et unique fois (aucun double débit)', () => {
    const dem = db.demandes_conges[0];
    db.validerRH({ demande_id: dem.id, gestionnaire_rh_id: 'rh-1', version_fournie: 2 });

    try {
      db.validerRH({ demande_id: dem.id, gestionnaire_rh_id: 'rh-2', version_fournie: 2 });
    } catch (e) {
      // Rejet attendu
    }

    const soldeFinal = db.getSolde('agt-001');
    assert.strictEqual(soldeFinal.jours_pris, 5.0, 'Débité exactement de 5 jours');
    assert.strictEqual(soldeFinal.jours_restants, 25.0);
  });

  await t.test('F20-5: La tentative de double validation est journalisée avec échec', () => {
    const dem = db.demandes_conges[0];
    db.validerRH({ demande_id: dem.id, gestionnaire_rh_id: 'rh-1', version_fournie: 2 });
    const nbAuditAvant = db.audit_log.length;

    try {
      db.validerRH({ demande_id: dem.id, gestionnaire_rh_id: 'rh-2', version_fournie: 2 });
    } catch (e) {
      db.enregistrerAudit({
        utilisateur_id: 'rh-2',
        role_utilise: 'GESTIONNAIRE_RH',
        action_type: 'TENTATIVE_VALIDATION_CONCURRENTE_CONFLIT',
        entite_cible: 'DEMANDE_CONGE',
        entite_id: dem.id,
        statut_operation: 'ECHEC_CONCURRENCE'
      });
    }

    assert.strictEqual(db.audit_log.length, nbAuditAvant + 1);
    const last = db.audit_log[db.audit_log.length - 1];
    assert.strictEqual(last.statut_operation, 'ECHEC_CONCURRENCE');
  });
});

test('Tier 1 — F21 : Portails utilisateurs par rôle & Tableaux de bord', async (t) => {
  const { canAccessAgent } = require('../helpers/auth_context.js');

  await t.test('F21-1: Portail Agent : accès strictement restreint à son propre profil', () => {
    const agt = { id: 'agt-001', matricule: 'PND-2020-00142', unite_actuelle_id: 'U-CC-DJIB' };
    const res = canAccessAgent(SESSIONS_FIXTURES.agent_hassan, agt);
    assert.strictEqual(res.allowed, true);
    assert.strictEqual(res.mode, 'CONSULTATION_PROPRE_DOSSIER');
  });

  await t.test('F21-2: Portail Chef de Service : tableau de bord des effectifs de sa brigade', () => {
    const agt = { id: 'agt-001', matricule: 'PND-2020-00142', unite_actuelle_id: 'U-CC-DJIB' };
    const res = canAccessAgent(SESSIONS_FIXTURES.chef_service_cc, agt);
    assert.strictEqual(res.allowed, true);
    assert.strictEqual(res.mode, 'GESTION_UNITE');
  });

  await t.test('F21-3: Portail Gestionnaire RH : indicateurs nationaux et effectifs globaux', () => {
    const agtAli = { id: 'agt-003', matricule: 'PND-2018-00088', unite_actuelle_id: 'U-REG-ALI' };
    const res = canAccessAgent(SESSIONS_FIXTURES.gestionnaire_rh, agtAli);
    assert.strictEqual(res.allowed, true);
    assert.strictEqual(res.mode, 'COMPLET');
  });

  await t.test('F21-4: Portail Admin Fonctionnel : accès exclusif Form Builder et listes', () => {
    const { ROLE_PERMISSIONS } = require('../helpers/auth_context.js');
    assert.ok(ROLE_PERMISSIONS.ADMIN_FONCTIONNEL_RH.includes('config:champs_personnalises'));
    assert.ok(ROLE_PERMISSIONS.ADMIN_FONCTIONNEL_RH.includes('config:listes_valeurs'));
  });

  await t.test('F21-5: Portail Auditeur : lecture seule sur les métriques et journaux', () => {
    const { ROLE_PERMISSIONS } = require('../helpers/auth_context.js');
    assert.ok(ROLE_PERMISSIONS.AUDITEUR.includes('audit:consulter_global'));
    assert.ok(!ROLE_PERMISSIONS.AUDITEUR.includes('agents:creer'));
  });
});
