const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

// Chargement du serveur compilé ou via tsx
let creerApplicationServeur;
let fermerPool;
let pool;
try {
  creerApplicationServeur = require('../../dist/server.js').creerApplicationServeur;
  const dbModule = require('../../dist/database/index.js');
  fermerPool = dbModule.fermerPool;
  pool = dbModule.pool;
} catch {
  require('tsx/cjs');
  creerApplicationServeur = require('../../src/server.ts').creerApplicationServeur;
  const dbModule = require('../../src/database/index.ts');
  fermerPool = dbModule.fermerPool;
  pool = dbModule.pool;
}

test('Jalon M3 — Suite d\'Intégration Serveur Fastify & PostgreSQL (Carrières, Promotions, Notations & Solde)', async (t) => {
  let app;
  let jetonGestionnaireRH;
  let jetonAdminTech;
  let jetonChefCC;
  let jetonChefAli;
  let jetonAgentHassan;
  let jetonAuditeur;

  t.before(async () => {
    app = await creerApplicationServeur();
    await app.ready();

    // Authentification des profils de test
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

  // --------------------------------------------------------------------------
  // M3-01 : Consultation de carrière et exclusion de l'Administrateur Technique
  // --------------------------------------------------------------------------
  await t.test('M3-01 : Consultation de carrière et exclusion absolue de l\'Admin Technique (HTTP 403)', async () => {
    // 1. Rejet formel pour ADMIN_TECHNIQUE
    const resTech = await app.inject({
      method: 'GET',
      url: '/api/carrieres/agt-001',
      headers: { authorization: `Bearer ${jetonAdminTech}` }
    });
    assert.strictEqual(resTech.statusCode, 403);
    const corpsTech = JSON.parse(resTech.payload);
    assert.strictEqual(corpsTech.code_erreur, 'ACCES_INTERDIT');

    // 2. Succès pour GESTIONNAIRE_RH
    const resRH = await app.inject({
      method: 'GET',
      url: '/api/carrieres/agt-001',
      headers: { authorization: `Bearer ${jetonGestionnaireRH}` }
    });
    assert.strictEqual(resRH.statusCode, 200);
    const corpsRH = JSON.parse(resRH.payload);
    assert.strictEqual(corpsRH.statut, 'SUCCES');
    assert.strictEqual(corpsRH.agent.id, 'agt-001');
    assert.ok(Array.isArray(corpsRH.echelons));
    assert.ok(Array.isArray(corpsRH.positions));
    assert.ok(Array.isArray(corpsRH.qualifications));
  });

  // --------------------------------------------------------------------------
  // M3-02 : Contrôle d'accès ABAC territorial et personnel sur le dossier de carrière
  // --------------------------------------------------------------------------
  await t.test('M3-02 : Contrôle ABAC territorial strict pour Chef de Service et Agent simple', async () => {
    // 1. Agent simple consultant son propre dossier -> Autorisé
    const resAgentSoi = await app.inject({
      method: 'GET',
      url: '/api/carrieres/agt-001',
      headers: { authorization: `Bearer ${jetonAgentHassan}` }
    });
    assert.strictEqual(resAgentSoi.statusCode, 200);

    // 2. Agent simple tentant de consulter le dossier d'un tiers (agt-002) -> HTTP 403
    const resAgentTiers = await app.inject({
      method: 'GET',
      url: '/api/carrieres/agt-002',
      headers: { authorization: `Bearer ${jetonAgentHassan}` }
    });
    assert.strictEqual(resAgentTiers.statusCode, 403);

    // 3. Chef de brigade Central (chef_cc) consultant un subordonné de son unité (agt-001) -> Autorisé
    const resChefUnite = await app.inject({
      method: 'GET',
      url: '/api/carrieres/agt-001',
      headers: { authorization: `Bearer ${jetonChefCC}` }
    });
    assert.strictEqual(resChefUnite.statusCode, 200);

    // 4. Chef de brigade Ali-Sabieh tentant de consulter un agent de Djibouti-Ville (agt-001) -> HTTP 403
    const resChefHorsUnite = await app.inject({
      method: 'GET',
      url: '/api/carrieres/agt-001',
      headers: { authorization: `Bearer ${jetonChefAli}` }
    });
    assert.strictEqual(resChefHorsUnite.statusCode, 403);
  });

  // --------------------------------------------------------------------------
  // M3-03 : Avancement d'échelon (ancienneté / grand choix) avec clôture atomique
  // --------------------------------------------------------------------------
  await t.test('M3-03 : Avancement d\'échelon avec clôture atomique de l\'ancien et mise à jour de la fiche', async () => {
    // agt-002 est actuellement à l'échelon 2, indice 320
    const resAvancement = await app.inject({
      method: 'POST',
      url: '/api/carrieres/avancement-echelon',
      headers: { authorization: `Bearer ${jetonGestionnaireRH}` },
      payload: {
        agent_id: 'agt-002',
        echelon: 3,
        indice_brut: 338,
        indice_majore: 338,
        date_effet: '2026-03-01',
        type_avancement: 'ANCIENNETE',
        numero_arrete: 'ARR-2026-033/DGPN'
      }
    });

    assert.strictEqual(resAvancement.statusCode, 201);
    const corpsAvancement = JSON.parse(resAvancement.payload);
    assert.strictEqual(corpsAvancement.statut, 'SUCCES');
    assert.strictEqual(corpsAvancement.echelon.echelon, 3);
    assert.strictEqual(corpsAvancement.echelon.est_actif, true);

    // Vérification de la synchronisation de l'agent
    const resAgentVerif = await app.inject({
      method: 'GET',
      url: '/api/carrieres/agt-002',
      headers: { authorization: `Bearer ${jetonGestionnaireRH}` }
    });
    const dossier = JSON.parse(resAgentVerif.payload);
    assert.strictEqual(dossier.agent.echelon_actuel, 3);
    assert.strictEqual(dossier.agent.indice_solde, 338);

    // Vérification qu'il n'y a qu'UN SEUL échelon actif
    const echelonsActifs = dossier.echelons.filter(e => e.est_actif === true);
    assert.strictEqual(echelonsActifs.length, 1);
  });

  // --------------------------------------------------------------------------
  // M3-04 : Blocage de dépassement du plafond d'échelon sommital
  // --------------------------------------------------------------------------
  await t.test('M3-04 : Rejet lors d\'une tentative d\'avancement au-delà de l\'échelon sommital (HTTP 400)', async () => {
    // agt-004 est Commandant, plafond échelon 5 (PLAFONDS_ECHELONS['Commandant'] = 5)
    const resDepassement = await app.inject({
      method: 'POST',
      url: '/api/carrieres/avancement-echelon',
      headers: { authorization: `Bearer ${jetonGestionnaireRH}` },
      payload: {
        agent_id: 'agt-004',
        echelon: 6, // Excède le plafond de 5
        date_effet: '2026-07-01',
        type_avancement: 'CHOIX',
        numero_arrete: 'ARR-2026-999/DGPN'
      }
    });

    assert.strictEqual(resDepassement.statusCode, 400);
    const corps = JSON.parse(resDepassement.payload);
    assert.strictEqual(corps.code_erreur, 'ECHELON_SOMMITAL_ATTEINT');
  });

  // --------------------------------------------------------------------------
  // M3-05 : Éligibilité au tableau d'avancement annuel
  // --------------------------------------------------------------------------
  await t.test('M3-05 : Établissement du tableau d\'avancement avec critères d\'éligibilité statutaires', async () => {
    const resTableau = await app.inject({
      method: 'GET',
      url: '/api/promotions/tableau-avancement/eligibles?annee=2026',
      headers: { authorization: `Bearer ${jetonGestionnaireRH}` }
    });

    assert.strictEqual(resTableau.statusCode, 200);
    const corps = JSON.parse(resTableau.payload);
    assert.strictEqual(corps.statut, 'SUCCES');
    assert.ok(corps.total > 0);

    // agt-001 (Sergent-Chef, échelon 3, note 2025 = 17.5) doit être promouvable
    const agt1 = corps.eligibles.find(e => e.agent_id === 'agt-001');
    assert.ok(agt1, 'agt-001 doit être présent dans le tableau');
    assert.strictEqual(agt1.est_promouvable, true);
    assert.strictEqual(agt1.grade_vise, 'Adjudant');
  });

  // --------------------------------------------------------------------------
  // M3-06 : Simulation budgétaire de promotion de grade
  // --------------------------------------------------------------------------
  await t.test('M3-06 : Simulation d\'avancement et calcul d\'impact sur la masse salariale en DJF', async () => {
    const resSimulation = await app.inject({
      method: 'POST',
      url: '/api/promotions/tableau-avancement/simulation',
      headers: { authorization: `Bearer ${jetonGestionnaireRH}` },
      payload: {
        cohortes: [
          { agent_id: 'agt-001', nouveau_grade: 'Adjudant', nouvel_echelon: 1, indice_actuel: 520, nouvel_indice: 580 },
          { agent_id: 'agt-002', nouveau_grade: 'Caporal', nouvel_echelon: 1, indice_actuel: 338, nouvel_indice: 360 }
        ]
      }
    });

    assert.strictEqual(resSimulation.statusCode, 200);
    const corps = JSON.parse(resSimulation.payload);
    assert.strictEqual(corps.nombre_promotions_simulees, 2);
    // Différentiel indiciaire : (580-520 = 60) + (360-338 = 22) = 82 points
    // 82 pts * 100 DJF = 8 200 DJF/mois * 12 = 98 400 DJF/an
    assert.strictEqual(corps.impact_masse_salariale_annuelle_djf, 98400);
  });

  // --------------------------------------------------------------------------
  // M3-07 : Enregistrement d'une promotion de grade
  // --------------------------------------------------------------------------
  await t.test('M3-07 : Enregistrement d\'une promotion de grade, reclassement et arrêté officiel', async () => {
    const resPromotion = await app.inject({
      method: 'POST',
      url: '/api/carrieres/promotion',
      headers: { authorization: `Bearer ${jetonGestionnaireRH}` },
      payload: {
        agent_id: 'agt-001',
        nouveau_grade: 'Adjudant',
        date_promotion: '2026-07-01',
        numero_decret: 'DEC-2026-084/PR',
        commission_date: '2026-06-15',
        tableau_avancement_annee: 2026,
        note_retenue: 17.50,
        avis_commission: 'FAVORABLE',
        nouvel_echelon: 1,
        indice_brut: 580,
        indice_majore: 580
      }
    });

    assert.strictEqual(resPromotion.statusCode, 201);
    const corps = JSON.parse(resPromotion.payload);
    assert.strictEqual(corps.promotion.nouveau_grade, 'Adjudant');
    assert.strictEqual(corps.promotion.numero_decret, 'DEC-2026-084/PR');

    // Vérifier la mise à jour de l'agent
    const resVerif = await app.inject({
      method: 'GET',
      url: '/api/carrieres/agt-001',
      headers: { authorization: `Bearer ${jetonGestionnaireRH}` }
    });
    const dossier = JSON.parse(resVerif.payload);
    assert.strictEqual(dossier.agent.grade_actuel, 'Adjudant');
    assert.strictEqual(dossier.agent.echelon_actuel, 1);
    assert.strictEqual(dossier.agent.indice_solde, 580);
  });

  // --------------------------------------------------------------------------
  // M3-08 : Changement de position statutaire (Activité -> Détachement -> Suspension)
  // --------------------------------------------------------------------------
  await t.test('M3-08 : Déclaration de changement de position statutaire et clôture automatique de la précédente', async () => {
    // 1. Placement en Détachement d'agt-003 auprès d'Interpol
    const resDetachement = await app.inject({
      method: 'POST',
      url: '/api/positions',
      headers: { authorization: `Bearer ${jetonGestionnaireRH}` },
      payload: {
        agent_id: 'agt-003',
        position: 'DETACHEMENT',
        organisme_accueil: 'INTERPOL Bureau Régional Nairobi',
        date_debut: '2026-04-01',
        reference_decision: 'ARRETE-DET-2026-01',
        motif: 'Mission de coopération policière internationale'
      }
    });

    assert.strictEqual(resDetachement.statusCode, 201);
    const corpsDet = JSON.parse(resDetachement.payload);
    assert.strictEqual(corpsDet.position.position, 'DETACHEMENT');
    assert.strictEqual(corpsDet.position.maintien_droits_avancement, true);

    // Vérifier la synchronisation du statut_administratif de l'agent
    const resVerif = await app.inject({
      method: 'GET',
      url: '/api/carrieres/agt-003',
      headers: { authorization: `Bearer ${jetonGestionnaireRH}` }
    });
    const dossier = JSON.parse(resVerif.payload);
    assert.strictEqual(dossier.agent.statut_administratif, 'DETACHE');

    // 2. Vérification qu'il n'y a qu'une seule position active
    const positionsActives = dossier.positions.filter(p => p.est_active === true);
    assert.strictEqual(positionsActives.length, 1);
  });

  // --------------------------------------------------------------------------
  // M3-09 : Verrouillage d'avancement pour agent en Disponibilité ou Suspension
  // --------------------------------------------------------------------------
  await t.test('M3-09 : Interdiction formelle d\'avancement pour un agent en position de disponibilité', async () => {
    // Placement en DISPONIBILITE d'agt-002
    await app.inject({
      method: 'POST',
      url: '/api/positions',
      headers: { authorization: `Bearer ${jetonGestionnaireRH}` },
      payload: {
        agent_id: 'agt-002',
        position: 'DISPONIBILITE',
        date_debut: '2026-05-01',
        reference_decision: 'DEC-DISPO-2026-02',
        motif: 'Convenances personnelles'
      }
    });

    // Tentative d'avancement d'échelon pour agt-002 pendant sa disponibilité -> Doit échouer
    const resAvanceBloque = await app.inject({
      method: 'POST',
      url: '/api/carrieres/avancement-echelon',
      headers: { authorization: `Bearer ${jetonGestionnaireRH}` },
      payload: {
        agent_id: 'agt-002',
        echelon: 4,
        date_effet: '2026-06-01',
        type_avancement: 'ANCIENNETE',
        numero_arrete: 'ARR-ILLICITE'
      }
    });

    assert.strictEqual(resAvanceBloque.statusCode, 400);
    const corps = JSON.parse(resAvanceBloque.payload);
    assert.strictEqual(corps.code_erreur, 'POSITION_INCOMPATIBLE_AVANCEMENT');

    // Réintégration en ACTIVITE pour la suite des tests
    await app.inject({
      method: 'POST',
      url: '/api/positions',
      headers: { authorization: `Bearer ${jetonGestionnaireRH}` },
      payload: {
        agent_id: 'agt-002',
        position: 'ACTIVITE',
        date_debut: '2026-06-01',
        reference_decision: 'DEC-REINT-2026-03',
        motif: 'Réintégration d office en activité'
      }
    });
  });

  // --------------------------------------------------------------------------
  // M3-10 : Catalogue des formations et qualifications (OPJ/APJ, Brevet Tir)
  // --------------------------------------------------------------------------
  await t.test('M3-10 : Consultation du catalogue national des formations et registre des qualifications', async () => {
    // 1. Catalogue formations
    const resFormations = await app.inject({
      method: 'GET',
      url: '/api/formations',
      headers: { authorization: `Bearer ${jetonGestionnaireRH}` }
    });
    assert.strictEqual(resFormations.statusCode, 200);
    const corpsForm = JSON.parse(resFormations.payload);
    assert.ok(corpsForm.formations.length >= 5);

    // 2. Qualifications
    const resQualifications = await app.inject({
      method: 'GET',
      url: '/api/qualifications',
      headers: { authorization: `Bearer ${jetonGestionnaireRH}` }
    });
    assert.strictEqual(resQualifications.statusCode, 200);
    const corpsQualif = JSON.parse(resQualifications.payload);
    assert.ok(corpsQualif.qualifications.length >= 8);
  });

  // --------------------------------------------------------------------------
  // M3-11 : Alertes d'expiration des qualifications (J-60, J-30, J-0)
  // --------------------------------------------------------------------------
  await t.test('M3-11 : Détection et surveillance des alertes d\'expiration de tir et qualifications opérationnelles', async () => {
    // Création d'une qualification expirant dans 15 jours pour agt-001 (URGENT)
    const dateDans15Jours = new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0];
    await app.inject({
      method: 'POST',
      url: '/api/qualifications',
      headers: { authorization: `Bearer ${jetonGestionnaireRH}` },
      payload: {
        agent_id: 'agt-001',
        type_qualification: 'BREVET_ARME_FORCE_INTERMEDIAIRE',
        numero_carte_agrement: 'AFI-2024-TEST',
        date_obtention: '2024-01-01',
        date_expiration: dateDans15Jours,
        autorite_delivrance: 'ENP Djibouti',
        aptitude_operationnelle_associee: 'Taser & LBD'
      }
    });

    const resAlertes = await app.inject({
      method: 'GET',
      url: '/api/qualifications/alertes-peremption',
      headers: { authorization: `Bearer ${jetonChefCC}` }
    });

    assert.strictEqual(resAlertes.statusCode, 200);
    const corps = JSON.parse(resAlertes.payload);
    assert.ok(corps.alertes.length > 0);

    const alerteAfi = corps.alertes.find(a => a.numero_carte_agrement === 'AFI-2024-TEST' || a.type_qualification === 'BREVET_ARME_FORCE_INTERMEDIAIRE');
    assert.ok(alerteAfi, 'L alerte AFI doit être signalée');
    assert.strictEqual(alerteAfi.niveau_urgence, 'URGENT');
  });

  // --------------------------------------------------------------------------
  // M3-12 : Saisie d'une notation annuelle conforme (barème 4 critères sur 5)
  // --------------------------------------------------------------------------
  await t.test('M3-12 : Enregistrement d\'une notation annuelle chiffrée 0-20 avec 4 critères pondérés', async () => {
    const resNotation = await app.inject({
      method: 'POST',
      url: '/api/notations',
      headers: { authorization: `Bearer ${jetonChefCC}` },
      payload: {
        agent_id: 'agt-001',
        annee: 2026,
        rigueur_deontologie: 4.80,
        competence_technique: 4.70,
        disponibilite_operationnelle: 4.90,
        sens_commandement_initiative: 4.60,
        appreciation_generale: 'Officier d une loyauté républicaine absolue, grande maîtrise opérationnelle lors des missions sensibles et exemplarité auprès des brigades.',
        date_entretien: '2026-10-15'
      }
    });

    assert.strictEqual(resNotation.statusCode, 201);
    const corps = JSON.parse(resNotation.payload);
    // Somme 4.80 + 4.70 + 4.90 + 4.60 = 19.00
    assert.strictEqual(parseFloat(corps.notation.note_chiffree), 19.00);
    assert.strictEqual(corps.notation.statut, 'SOUMIS');
  });

  // --------------------------------------------------------------------------
  // M3-13 : Rejet bloquant absolu de toute mention médicale dans les notations
  // --------------------------------------------------------------------------
  await t.test('M3-13 : Rejet bloquant HTTP 400 et contrainte SQL lors de saisie d\'un terme médical', async () => {
    const termesMedicauxProscrits = [
      'Agent souvent absent pour cause de traitement médical régulier.',
      'Souffre de diabète et ne peut assurer les patrouilles.',
      'Hospitalisé à l hôpital de Djibouti suite à une maladie.'
    ];

    for (const texte of termesMedicauxProscrits) {
      const resRejet = await app.inject({
        method: 'POST',
        url: '/api/notations',
        headers: { authorization: `Bearer ${jetonChefCC}` },
        payload: {
          agent_id: 'agt-002',
          annee: 2026,
          rigueur_deontologie: 3.0,
          competence_technique: 3.0,
          disponibilite_operationnelle: 3.0,
          sens_commandement_initiative: 3.0,
          appreciation_generale: texte,
          date_entretien: '2026-10-20'
        }
      });

      assert.strictEqual(resRejet.statusCode, 400, `Le terme médical dans "${texte}" aurait dû être rejeté`);
      const corps = JSON.parse(resRejet.payload);
      assert.strictEqual(corps.code_erreur, 'DONNEE_MEDICALE_PROHIBEE');
    }
  });

  // --------------------------------------------------------------------------
  // M3-14 : Procédure de recours gracieux et arbitrage par la Commission
  // --------------------------------------------------------------------------
  await t.test('M3-14 : Dépôt de recours gracieux et arbitrage souverain par la Commission paritaire', async () => {
    // 1. Dépôt de recours par agt-001 sur sa notation 2025 (not-001)
    const resRecours = await app.inject({
      method: 'PUT',
      url: '/api/notations/not-001/recours',
      headers: { authorization: `Bearer ${jetonAgentHassan}` },
      payload: {
        motif_recours: 'Demande de revalorisation au titre de la composante commandement suite à la direction réussie des opérations de sécurisation.',
        date_recours: '2026-01-10'
      }
    });

    assert.strictEqual(resRecours.statusCode, 200);
    const corpsRecours = JSON.parse(resRecours.payload);
    assert.strictEqual(corpsRecours.notation.recours_depose, true);
    assert.strictEqual(corpsRecours.notation.statut, 'RECOURS');

    // 2. Arbitrage par le Gestionnaire RH
    const resArbitrage = await app.inject({
      method: 'PUT',
      url: '/api/notations/not-001/decision-recours',
      headers: { authorization: `Bearer ${jetonGestionnaireRH}` },
      payload: {
        decision_recours: 'REVISION_HAUSSE',
        note_definitive: 18.00,
        motif_arbitrage: 'Commission d accord pour rehausser la note à 18.00'
      }
    });

    assert.strictEqual(resArbitrage.statusCode, 200);
    const corpsArbitrage = JSON.parse(resArbitrage.payload);
    assert.strictEqual(corpsArbitrage.notation.decision_recours, 'REVISION_HAUSSE');
    assert.strictEqual(parseFloat(corpsArbitrage.notation.note_definitive), 18.00);
    assert.strictEqual(corpsArbitrage.notation.statut, 'VALIDE_DEFINITIF');
  });

  // --------------------------------------------------------------------------
  // M3-15 : Calcul mensuel des éléments de solde indiciaire et primes
  // --------------------------------------------------------------------------
  await t.test('M3-15 : Calcul des éléments de solde (base indiciaire 100 DJF/pt, primes de risque et éloignement)', async () => {
    const resCalculSolde = await app.inject({
      method: 'POST',
      url: '/api/solde/calculs/2026-02/generer',
      headers: { authorization: `Bearer ${jetonGestionnaireRH}` }
    });

    assert.strictEqual(resCalculSolde.statusCode, 200);
    const corps = JSON.parse(resCalculSolde.payload);
    assert.strictEqual(corps.statut, 'SUCCES');
    assert.ok(corps.nombre_bulletins >= 4);

    // Vérification détaillée pour agt-003 (affecté à Ali-Sabieh -> Prime éloignement 25 000 DJF)
    const soldeAgt3 = corps.elements.find(e => e.agent_id === 'agt-003');
    assert.ok(soldeAgt3, 'Solde agt-003 doit être calculée');
    assert.strictEqual(parseFloat(soldeAgt3.indemnite_eloignement), 25000.00);
    assert.strictEqual(parseFloat(soldeAgt3.prime_risque), 15000.00);
    assert.strictEqual(parseFloat(soldeAgt3.prime_sujetion), 20000.00);
  });

  // --------------------------------------------------------------------------
  // M3-16 : Génération et scellement d'export de solde par empreinte SHA-256
  // --------------------------------------------------------------------------
  await t.test('M3-16 : Export de solde normé, scellement SHA-256 et inscription inaltérable dans l\'audit', async () => {
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
    assert.strictEqual(corps.export.empreinte_sha256.length, 64);

    // Vérification de la conformité mathématique du hash SHA-256
    const hashRecalcule = crypto.createHash('sha256').update(corps.export.contenu_fichier, 'utf-8').digest('hex');
    assert.strictEqual(corps.export.empreinte_sha256, hashRecalcule, 'L empreinte retournée doit correspondre exactement au flux');

    // Vérification que le journal d'audit contient bien cet enregistrement avec le même hash
    const resAudit = await pool.query(
      `SELECT * FROM journaux_audit WHERE entite_cible = 'EXPORTS_SOLDE' AND entite_id = $1`,
      [corps.export.export_id]
    );
    assert.strictEqual(resAudit.rows.length, 1);
    const auditRecord = resAudit.rows[0];
    assert.strictEqual(auditRecord.details_operation_json.empreinte_sha256, hashRecalcule);
    assert.strictEqual(auditRecord.statut_operation, 'SUCCES');
  });

  // --------------------------------------------------------------------------
  // M3-17 : Concurrence et sérialisation transactionnelle FOR UPDATE
  // --------------------------------------------------------------------------
  await t.test('M3-17 : Concurrence transactionnelle sérialisée sans perte d\'intégrité', async () => {
    // Tentative concurrente de deux requêtes d'avancement pour agt-003
    const req1 = app.inject({
      method: 'POST',
      url: '/api/carrieres/avancement-echelon',
      headers: { authorization: `Bearer ${jetonGestionnaireRH}` },
      payload: {
        agent_id: 'agt-003',
        echelon: 5,
        date_effet: '2026-08-01',
        type_avancement: 'ANCIENNETE',
        numero_arrete: 'ARR-CONCURRENT-1'
      }
    });

    const req2 = app.inject({
      method: 'POST',
      url: '/api/carrieres/avancement-echelon',
      headers: { authorization: `Bearer ${jetonGestionnaireRH}` },
      payload: {
        agent_id: 'agt-003',
        echelon: 5,
        date_effet: '2026-08-01',
        type_avancement: 'ANCIENNETE',
        numero_arrete: 'ARR-CONCURRENT-2'
      }
    });

    const [res1, res2] = await Promise.all([req1, req2]);
    // L'une des deux requêtes doit réussir (201) et l'autre échouer (400 - échelon déjà atteint ou échelon <= actuel)
    const statuts = [res1.statusCode, res2.statusCode].sort();
    assert.deepStrictEqual(statuts, [201, 400]);
  });
});
