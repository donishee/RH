const test = require('node:test');
const assert = require('node:assert/strict');

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

test('Jalon M2 — Suite d\'Intégration Serveur Fastify & PostgreSQL (Congés, Absences & Validation)', async (t) => {
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
  // M2-01 : Nomenclature et Consultation des Types de Congés
  // --------------------------------------------------------------------------
  await t.test('M2-01 : Consultation des types de congés actifs et déductibilité statutaire', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/conges/types',
      headers: { Authorization: `Bearer ${jetonAgentHassan}` }
    });

    assert.strictEqual(res.statusCode, 200);
    const corps = JSON.parse(res.payload);
    assert.strictEqual(corps.statut, 'SUCCES');
    assert.ok(Array.isArray(corps.types), 'Doit retourner un tableau de types de congés');
    assert.ok(corps.types.length >= 5, 'Doit comporter au moins les 5 types légaux');

    const annuel = corps.types.find(tc => tc.code === 'ANNUEL');
    assert.ok(annuel, 'Type ANNUEL présent');
    assert.strictEqual(annuel.quota_annuel_jours, 30);
    assert.strictEqual(annuel.deductible_solde, true);

    const maladie = corps.types.find(tc => tc.code === 'MALADIE_ORDINAIRE');
    assert.ok(maladie, 'Type MALADIE_ORDINAIRE présent');
    assert.strictEqual(maladie.deductible_solde, false);
  });

  // --------------------------------------------------------------------------
  // M2-02 : Consultation des Soldes et Contrôles ABAC
  // --------------------------------------------------------------------------
  await t.test('M2-02 : Consultation des soldes individuels et étanchéité ABAC', async () => {
    // 1. Agent Hassan consulte son propre solde
    const resHassan = await app.inject({
      method: 'GET',
      url: '/api/conges/soldes',
      headers: { Authorization: `Bearer ${jetonAgentHassan}` }
    });
    assert.strictEqual(resHassan.statusCode, 200);
    const corpsHassan = JSON.parse(resHassan.payload);
    assert.strictEqual(corpsHassan.solde.agent_id, 'agt-001');
    assert.strictEqual(corpsHassan.solde.jours_acquis, 30.0);

    // 2. Admin Technique formellement refoulé (HTTP 403)
    const resTech = await app.inject({
      method: 'GET',
      url: '/api/conges/soldes/agt-001',
      headers: { Authorization: `Bearer ${jetonAdminTech}` }
    });
    assert.strictEqual(resTech.statusCode, 403);
    assert.match(JSON.parse(resTech.payload).message, /administrateurs techniques/i);

    // 3. Chef Ali (Ali-Sabieh) tente de consulter le solde de Hassan (Commissariat Central) -> HTTP 403 ABAC
    const resAliHorsPerimetre = await app.inject({
      method: 'GET',
      url: '/api/conges/soldes/agt-001',
      headers: { Authorization: `Bearer ${jetonChefAli}` }
    });
    assert.strictEqual(resAliHorsPerimetre.statusCode, 403);
    assert.match(JSON.parse(resAliHorsPerimetre.payload).message, /hors de votre périmètre/i);

    // 4. Gestionnaire RH peut consulter le solde de tout agent
    const resRH = await app.inject({
      method: 'GET',
      url: '/api/conges/soldes/agt-001',
      headers: { Authorization: `Bearer ${jetonGestionnaireRH}` }
    });
    assert.strictEqual(resRH.statusCode, 200);
  });

  // --------------------------------------------------------------------------
  // M2-03 : Contrôles de Dates, Bornes et Solde Insuffisant
  // --------------------------------------------------------------------------
  await t.test('M2-03 : Rejets stricts lors d\'incohérences de dates ou dépassement de solde', async () => {
    // 1. Date de fin antérieure à la date de début
    const resDatesIncoherentes = await app.inject({
      method: 'POST',
      url: '/api/conges/demandes',
      headers: { Authorization: `Bearer ${jetonAgentHassan}` },
      payload: {
        type_conge_id: 'tc-annuel',
        date_debut: '2026-11-20',
        date_fin: '2026-11-10',
        nombre_jours: 5,
        motif: 'Congé test'
      }
    });
    assert.strictEqual(resDatesIncoherentes.statusCode, 400);
    assert.match(JSON.parse(resDatesIncoherentes.payload).message, /Incohérence des dates/i);

    // 2. Durée négative ou nulle
    const resDureeNulle = await app.inject({
      method: 'POST',
      url: '/api/conges/demandes',
      headers: { Authorization: `Bearer ${jetonAgentHassan}` },
      payload: {
        type_conge_id: 'tc-annuel',
        date_debut: '2026-11-10',
        date_fin: '2026-11-14',
        nombre_jours: 0,
        motif: 'Congé test'
      }
    });
    assert.strictEqual(resDureeNulle.statusCode, 400);
    assert.match(JSON.parse(resDureeNulle.payload).message, /strictement positif/i);

    // 3. Dépassement de solde disponible (35 jours demandés pour solde de 30)
    const resDepassement = await app.inject({
      method: 'POST',
      url: '/api/conges/demandes',
      headers: { Authorization: `Bearer ${jetonAgentHassan}` },
      payload: {
        type_conge_id: 'tc-annuel',
        date_debut: '2026-11-01',
        date_fin: '2026-12-05',
        nombre_jours: 35.0,
        motif: 'Dépassement de solde'
      }
    });
    assert.strictEqual(resDepassement.statusCode, 400);
    assert.match(JSON.parse(resDepassement.payload).message, /Solde insuffisant/i);
  });

  // --------------------------------------------------------------------------
  // M2-04 : Détection Mathématique des Chevauchements Temporels
  // --------------------------------------------------------------------------
  await t.test('M2-04 : Détection et blocage formel des chevauchements de congés pour un même agent', async () => {
    // 1. Première demande valide du 10 au 15 novembre (6 jours)
    const res1 = await app.inject({
      method: 'POST',
      url: '/api/conges/demandes',
      headers: { Authorization: `Bearer ${jetonAgentHassan}` },
      payload: {
        type_conge_id: 'tc-annuel',
        date_debut: '2026-11-10',
        date_fin: '2026-11-15',
        nombre_jours: 6.0,
        motif: 'Première période'
      }
    });
    assert.strictEqual(res1.statusCode, 201);
    const demande1Id = JSON.parse(res1.payload).demande.id;

    // 2. Seconde demande chevauchante du 12 au 18 novembre -> Rejet 400
    const resChevauchement = await app.inject({
      method: 'POST',
      url: '/api/conges/demandes',
      headers: { Authorization: `Bearer ${jetonAgentHassan}` },
      payload: {
        type_conge_id: 'tc-annuel',
        date_debut: '2026-11-12',
        date_fin: '2026-11-18',
        nombre_jours: 7.0,
        motif: 'Période chevauchante'
      }
    });
    assert.strictEqual(resChevauchement.statusCode, 400);
    assert.match(JSON.parse(resChevauchement.payload).message, /Chevauchement de dates détecté/i);

    // Nettoyage en annulant la demande 1
    await app.inject({
      method: 'POST',
      url: `/api/conges/demandes/${demande1Id}/annuler`,
      headers: { Authorization: `Bearer ${jetonAgentHassan}` },
      payload: { motif_annulation: 'Nettoyage test chevauchement' }
    });
  });

  // --------------------------------------------------------------------------
  // M2-05 : Règle d'Or Régalien : Anti-Auto-Approbation Stricte (HTTP 403)
  // --------------------------------------------------------------------------
  await t.test('M2-05 : Verrouillage absolu de l\'auto-approbation hiérarchique d\'un chef (HTTP 403)', async () => {
    // Chef CC (Commandant Farah, agt-004) soumet une demande personnelle de 3 jours
    const resSoumission = await app.inject({
      method: 'POST',
      url: '/api/conges/demandes',
      headers: { Authorization: `Bearer ${jetonChefCC}` },
      payload: {
        type_conge_id: 'tc-annuel',
        date_debut: '2026-12-01',
        date_fin: '2026-12-03',
        nombre_jours: 3.0,
        motif: 'Congé personnel du Chef de service'
      }
    });
    assert.strictEqual(resSoumission.statusCode, 201);
    const demandeChefId = JSON.parse(resSoumission.payload).demande.id;

    // Tentative formelle du Chef CC d'approuver sa propre demande
    const resAutoApprobation = await app.inject({
      method: 'PUT',
      url: `/api/conges/demandes/${demandeChefId}/viser-chef`,
      headers: { Authorization: `Bearer ${jetonChefCC}` },
      payload: { avis: 'FAVORABLE' }
    });

    assert.strictEqual(resAutoApprobation.statusCode, 403);
    const corpsRejet = JSON.parse(resAutoApprobation.payload);
    assert.strictEqual(corpsRejet.code_erreur, 'AUTO_APPROBATION_INTERDITE');
    assert.match(corpsRejet.message, /Auto-approbation formellement interdite/i);

    // Nettoyage : annulation de la demande du chef
    await app.inject({
      method: 'POST',
      url: `/api/conges/demandes/${demandeChefId}/annuler`,
      headers: { Authorization: `Bearer ${jetonChefCC}` },
      payload: { motif_annulation: 'Annulation personnelle du chef' }
    });
  });

  // --------------------------------------------------------------------------
  // M2-06 : Refus Hiérarchique Motivé et Restitution Immédiate
  // --------------------------------------------------------------------------
  await t.test('M2-06 : Refus du chef de service exige un motif explicite et recrédite les jours réservés', async () => {
    // Hassan dépose une demande de 4 jours
    const resSoumis = await app.inject({
      method: 'POST',
      url: '/api/conges/demandes',
      headers: { Authorization: `Bearer ${jetonAgentHassan}` },
      payload: {
        type_conge_id: 'tc-annuel',
        date_debut: '2026-12-10',
        date_fin: '2026-12-13',
        nombre_jours: 4.0,
        motif: 'Demande à refuser'
      }
    });
    const demId = JSON.parse(resSoumis.payload).demande.id;

    // 1. Refus sans motif -> Rejet 400
    const resRefusSansMotif = await app.inject({
      method: 'PUT',
      url: `/api/conges/demandes/${demId}/viser-chef`,
      headers: { Authorization: `Bearer ${jetonChefCC}` },
      payload: { avis: 'DEFAVORABLE', motif_refus: '' }
    });
    assert.strictEqual(resRefusSansMotif.statusCode, 400);
    assert.match(JSON.parse(resRefusSansMotif.payload).message, /Motif de refus obligatoire/i);

    // 2. Refus avec motif circonstancié -> Statut REFUSE et restitution
    const resRefusOk = await app.inject({
      method: 'PUT',
      url: `/api/conges/demandes/${demId}/viser-chef`,
      headers: { Authorization: `Bearer ${jetonChefCC}` },
      payload: {
        avis: 'DEFAVORABLE',
        motif_refus: 'Alerte opérationnelle renforcée — effectif minimal de brigade non atteint (< 40%)'
      }
    });
    assert.strictEqual(resRefusOk.statusCode, 200);
    const corpsRefus = JSON.parse(resRefusOk.payload);
    assert.strictEqual(corpsRefus.demande.statut, 'REFUSE');
    assert.strictEqual(corpsRefus.solde.jours_en_attente, 0.0);
    assert.strictEqual(corpsRefus.solde.jours_restants, 30.0);
  });

  // --------------------------------------------------------------------------
  // M2-07 : Cycle Nominal et Invariance Mathématique Stricte
  // --------------------------------------------------------------------------
  let cycleDemandeId;
  await t.test('M2-07 : Cycle nominal complet (Soumission 8j -> Visa Chef -> Validation DRH) et invariance des compteurs', async () => {
    // 1. Soumission par Hassan de 8 jours
    const res1 = await app.inject({
      method: 'POST',
      url: '/api/conges/demandes',
      headers: { Authorization: `Bearer ${jetonAgentHassan}` },
      payload: {
        type_conge_id: 'tc-annuel',
        date_debut: '2026-11-15',
        date_fin: '2026-11-22',
        nombre_jours: 8.0,
        motif: 'Congé annuel de fin d\'année'
      }
    });
    assert.strictEqual(res1.statusCode, 201);
    const corps1 = JSON.parse(res1.payload);
    cycleDemandeId = corps1.demande.id;
    assert.strictEqual(corps1.demande.statut, 'SOUMIS');
    assert.strictEqual(corps1.solde.jours_en_attente, 8.0);
    assert.strictEqual(corps1.solde.jours_restants, 22.0);
    assert.strictEqual(corps1.solde.jours_pris, 0.0);

    // 2. Étape préalable obligatoire : la DRH ne peut pas valider une demande SOUMIS sans visa chef
    const resRHTropTot = await app.inject({
      method: 'PUT',
      url: `/api/conges/demandes/${cycleDemandeId}/valider-rh`,
      headers: { Authorization: `Bearer ${jetonGestionnaireRH}` },
      payload: { decision: 'VALIDE' }
    });
    assert.strictEqual(resRHTropTot.statusCode, 400);
    assert.match(JSON.parse(resRHTropTot.payload).message, /L'approbation préalable du chef de service est requise/i);

    // 3. Visa favorable Niveau 1 par Chef CC
    const resVisaChef = await app.inject({
      method: 'PUT',
      url: `/api/conges/demandes/${cycleDemandeId}/viser-chef`,
      headers: { Authorization: `Bearer ${jetonChefCC}` },
      payload: { avis: 'FAVORABLE' }
    });
    assert.strictEqual(resVisaChef.statusCode, 200);
    const corpsVisa = JSON.parse(resVisaChef.payload);
    assert.strictEqual(corpsVisa.demande.statut, 'APPROUVE_CHEF_SERVICE');
    assert.strictEqual(corpsVisa.demande.version_concurrence, 2);
    assert.strictEqual(corpsVisa.solde.jours_en_attente, 8.0);

    // 4. Validation finale Niveau 2 par la DRH
    const resValideRH = await app.inject({
      method: 'PUT',
      url: `/api/conges/demandes/${cycleDemandeId}/valider-rh`,
      headers: { Authorization: `Bearer ${jetonGestionnaireRH}` },
      payload: { decision: 'VALIDE', version_concurrence: 2 }
    });
    assert.strictEqual(resValideRH.statusCode, 200);
    const corpsRH = JSON.parse(resValideRH.payload);
    assert.strictEqual(corpsRH.demande.statut, 'VALIDE_RH');
    assert.strictEqual(corpsRH.demande.version_concurrence, 3);
    assert.strictEqual(corpsRH.solde.jours_pris, 8.0);
    assert.strictEqual(corpsRH.solde.jours_en_attente, 0.0);
    assert.strictEqual(corpsRH.solde.jours_restants, 22.0);

    // Vérification de l'invariance mathématique absolue
    const s = corpsRH.solde;
    assert.strictEqual(s.jours_pris + s.jours_en_attente + s.jours_restants, s.jours_acquis + s.jours_reportes);
  });

  // --------------------------------------------------------------------------
  // M2-08 : Prévention Concurrente Anti-Double Validation (HTTP 409)
  // --------------------------------------------------------------------------
  await t.test('M2-08 : Rejet HTTP 409 lors d\'une tentative de validation simultanée avec version obsolète', async () => {
    // 1. Nouvelle demande de 5 jours
    const resNouvelle = await app.inject({
      method: 'POST',
      url: '/api/conges/demandes',
      headers: { Authorization: `Bearer ${jetonAgentHassan}` },
      payload: {
        type_conge_id: 'tc-annuel',
        date_debut: '2026-12-24',
        date_fin: '2026-12-28',
        nombre_jours: 5.0,
        motif: 'Période de fête'
      }
    });
    const dConcurrenteId = JSON.parse(resNouvelle.payload).demande.id;

    // Visa chef -> passe à version 2
    await app.inject({
      method: 'PUT',
      url: `/api/conges/demandes/${dConcurrenteId}/viser-chef`,
      headers: { Authorization: `Bearer ${jetonChefCC}` },
      payload: { avis: 'FAVORABLE' }
    });

    // 2. Première validation par Opérateur A (avec version 2) -> Réussite
    const resA = await app.inject({
      method: 'PUT',
      url: `/api/conges/demandes/${dConcurrenteId}/valider-rh`,
      headers: { Authorization: `Bearer ${jetonGestionnaireRH}` },
      payload: { decision: 'VALIDE', version_concurrence: 2 }
    });
    assert.strictEqual(resA.statusCode, 200);

    // 3. Deuxième validation concurrente par Opérateur B (avec la version périmée 2) -> Rejet HTTP 409
    const resB = await app.inject({
      method: 'PUT',
      url: `/api/conges/demandes/${dConcurrenteId}/valider-rh`,
      headers: { Authorization: `Bearer ${jetonGestionnaireRH}` },
      payload: { decision: 'VALIDE', version_concurrence: 2 }
    });
    assert.strictEqual(resB.statusCode, 409, 'Doit retourner un code statut HTTP 409 Conflit');
    const corpsB = JSON.parse(resB.payload);
    assert.strictEqual(corpsB.code_erreur, 'CONFLIT_CONCURRENCE');
    assert.match(corpsB.message, /Conflit de concurrence/i);

    // 4. Vérification que le débit sur le solde n'a eu lieu qu'une seule et unique fois
    const resSoldeVerif = await app.inject({
      method: 'GET',
      url: '/api/conges/soldes/agt-001',
      headers: { Authorization: `Bearer ${jetonGestionnaireRH}` }
    });
    const soldeFinal = JSON.parse(resSoldeVerif.payload).solde;
    // 8j du test précédent + 5j = 13j pris au total
    assert.strictEqual(soldeFinal.jours_pris, 13.0);
    assert.strictEqual(soldeFinal.jours_restants, 17.0);

    // Nettoyage de la demande concurrente
    await app.inject({
      method: 'POST',
      url: `/api/conges/demandes/${dConcurrenteId}/annuler`,
      headers: { Authorization: `Bearer ${jetonGestionnaireRH}` },
      payload: { motif_annulation: 'Régularisation post-test concurrence' }
    });
  });

  // --------------------------------------------------------------------------
  // M2-09 : Annulation de Congé Validé et Restitution Intégrale
  // --------------------------------------------------------------------------
  await t.test('M2-09 : Annulation d\'un congé validé avec motif obligatoire et restitution des jours_pris', async () => {
    // 1. Annulation sans motif -> Rejet 400
    const resSansMotif = await app.inject({
      method: 'POST',
      url: `/api/conges/demandes/${cycleDemandeId}/annuler`,
      headers: { Authorization: `Bearer ${jetonAgentHassan}` },
      payload: { motif_annulation: '' }
    });
    assert.strictEqual(resSansMotif.statusCode, 400);
    assert.match(JSON.parse(resSansMotif.payload).message, /motif d'annulation est obligatoire/i);

    // 2. Annulation valide suite à rappel de service
    const resAnnulation = await app.inject({
      method: 'POST',
      url: `/api/conges/demandes/${cycleDemandeId}/annuler`,
      headers: { Authorization: `Bearer ${jetonAgentHassan}` },
      payload: { motif_annulation: 'Rappel d\'office pour sécurisation de sommet international' }
    });
    assert.strictEqual(resAnnulation.statusCode, 200);
    const corpsAnnul = JSON.parse(resAnnulation.payload);
    assert.strictEqual(corpsAnnul.demande.statut, 'ANNULE');
    assert.strictEqual(corpsAnnul.solde.jours_pris, 0.0);
    assert.strictEqual(corpsAnnul.solde.jours_en_attente, 0.0);
    assert.strictEqual(corpsAnnul.solde.jours_restants, 30.0);

    // 3. Rejet formel d'une deuxième tentative d'annulation sur la même demande
    const resReAnnulation = await app.inject({
      method: 'POST',
      url: `/api/conges/demandes/${cycleDemandeId}/annuler`,
      headers: { Authorization: `Bearer ${jetonAgentHassan}` },
      payload: { motif_annulation: 'Tentative d\'annulation récurrente' }
    });
    assert.strictEqual(resReAnnulation.statusCode, 400);
    assert.match(JSON.parse(resReAnnulation.payload).message, /Impossible d'annuler une demande déjà au statut ANNULE/i);
  });

  // --------------------------------------------------------------------------
  // M2-10 : Indicateurs de Pilotage et Taux de Présence
  // --------------------------------------------------------------------------
  await t.test('M2-10 : Statistiques de pilotage opérationnel et seuil réglementaire de 40%', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/conges/statistiques',
      headers: { Authorization: `Bearer ${jetonChefCC}` }
    });

    assert.strictEqual(res.statusCode, 200);
    const corps = JSON.parse(res.payload);
    assert.strictEqual(corps.statut, 'SUCCES');
    const s = corps.statistiques;
    assert.ok(s.effectif_total >= 1);
    assert.ok(s.taux_presence_pct >= 40, 'Le taux de présence opérationnelle doit satisfaire le seuil');
    assert.strictEqual(s.seuil_securite_atteint, true);
  });

  // --------------------------------------------------------------------------
  // M2-11 : Contrôle Territorial ABAC lors de l'Annulation (HTTP 403)
  // --------------------------------------------------------------------------
  await t.test('M2-11 : Rejet HTTP 403 lorsqu\'un chef de service hors périmètre tente d\'annuler le congé d\'un agent', async () => {
    // 1. Agent Hassan (Commissariat Central Djibouti, U-CC-DJIB) soumet une demande
    const resDemande = await app.inject({
      method: 'POST',
      url: '/api/conges/demandes',
      headers: { Authorization: `Bearer ${jetonAgentHassan}` },
      payload: {
        type_conge_id: 'tc-annuel',
        date_debut: '2026-11-25',
        date_fin: '2026-11-26',
        nombre_jours: 2.0,
        motif: 'Congé test ABAC territorial annulation'
      }
    });
    assert.strictEqual(resDemande.statusCode, 201);
    const dId = JSON.parse(resDemande.payload).demande.id;

    try {
      // 2. Chef Ali (Ali-Sabieh, U-REG-ALI, hors périmètre) tente d'annuler la demande de Hassan
      const resAnnulAli = await app.inject({
        method: 'POST',
        url: `/api/conges/demandes/${dId}/annuler`,
        headers: { Authorization: `Bearer ${jetonChefAli}` },
        payload: { motif_annulation: 'Tentative hostile d\'annulation hors périmètre' }
      });

      assert.strictEqual(resAnnulAli.statusCode, 403, 'Doit retourner HTTP 403 ACCES_INTERDIT');
      const corpsAli = JSON.parse(resAnnulAli.payload);
      assert.strictEqual(corpsAli.code_erreur, 'ACCES_INTERDIT');
      assert.match(corpsAli.message, /Vous ne pouvez annuler que les demandes des agents de votre unité/i);
    } finally {
      // 3. Nettoyage légitime par l'agent Hassan lui-même
      await app.inject({
        method: 'POST',
        url: `/api/conges/demandes/${dId}/annuler`,
        headers: { Authorization: `Bearer ${jetonAgentHassan}` },
        payload: { motif_annulation: 'Annulation légitime par l\'agent demandeur' }
      });
    }
  });

  // --------------------------------------------------------------------------
  // M2-12 : Verrouillage Anti-Auto-Approbation au Niveau DRH (HTTP 403)
  // --------------------------------------------------------------------------
  await t.test('M2-12 : Verrouillage absolu de l\'auto-validation finale DRH par un gestionnaire RH (HTTP 403)', async () => {
    // 1. Création d'une demande pour le gestionnaire RH (agt-rh-01)
    const resDemandeRH = await app.inject({
      method: 'POST',
      url: '/api/conges/demandes',
      headers: { Authorization: `Bearer ${jetonGestionnaireRH}` },
      payload: {
        type_conge_id: 'tc-annuel',
        date_debut: '2026-11-28',
        date_fin: '2026-11-29',
        nombre_jours: 2.0,
        motif: 'Congé propre du gestionnaire RH'
      }
    });
    assert.strictEqual(resDemandeRH.statusCode, 201);
    const dRHId = JSON.parse(resDemandeRH.payload).demande.id;

    try {
      // Simulation de visa chef préalable en base pour franchir le niveau 1
      await pool.query("UPDATE demandes_conges SET statut = 'APPROUVE_CHEF_SERVICE', version_optimiste = version_optimiste + 1 WHERE id = $1", [dRHId]);

      // 2. Tentative d'auto-validation finale Niveau 2 par le gestionnaire RH lui-même
      const resAutoValideRH = await app.inject({
        method: 'PUT',
        url: `/api/conges/demandes/${dRHId}/valider-rh`,
        headers: { Authorization: `Bearer ${jetonGestionnaireRH}` },
        payload: { decision: 'VALIDE' }
      });

      assert.strictEqual(resAutoValideRH.statusCode, 403, 'Doit retourner HTTP 403 AUTO_APPROBATION_INTERDITE');
      const corpsAutoRH = JSON.parse(resAutoValideRH.payload);
      assert.strictEqual(corpsAutoRH.code_erreur, 'AUTO_APPROBATION_INTERDITE');
      assert.match(corpsAutoRH.message, /Auto-approbation formellement interdite/i);

      // 3. Vérification de la journalisation d'audit de sécurité
      const resAudit = await pool.query(`
        SELECT action_type, statut_operation, entite_id
        FROM journaux_audit
        WHERE action_type = 'TENTATIVE_AUTO_APPROBATION_BLOQUEE' AND entite_id = $1
        ORDER BY id DESC LIMIT 1
      `, [dRHId]);
      assert.strictEqual(resAudit.rows.length, 1, 'Audit de tentative bloquée requis');
      assert.strictEqual(resAudit.rows[0].statut_operation, 'ECHEC_SECURITE');
    } finally {
      // 4. Nettoyage : annulation de la demande
      await app.inject({
        method: 'POST',
        url: `/api/conges/demandes/${dRHId}/annuler`,
        headers: { Authorization: `Bearer ${jetonGestionnaireRH}` },
        payload: { motif_annulation: 'Nettoyage test anti-auto-approbation DRH' }
      });
    }
  });

  // --------------------------------------------------------------------------
  // M2-13 : Typage Strict et Rejet des Valeurs Non Numériques dans nombre_jours (HTTP 400)
  // --------------------------------------------------------------------------
  await t.test('M2-13 : Rejet immédiat avec HTTP 400 DUREE_INVALIDE pour toute valeur NaN ou non-numérique', async () => {
    const resInvalide = await app.inject({
      method: 'POST',
      url: '/api/conges/demandes',
      headers: { Authorization: `Bearer ${jetonAgentHassan}` },
      payload: {
        type_conge_id: 'tc-annuel',
        date_debut: '2026-12-05',
        date_fin: '2026-12-08',
        nombre_jours: 'non_numerique',
        motif: 'Injection valeur non numérique'
      }
    });

    assert.strictEqual(resInvalide.statusCode, 400, 'Doit rejeter avec HTTP 400');
    const corpsInvalide = JSON.parse(resInvalide.payload);
    assert.strictEqual(corpsInvalide.code_erreur, 'DUREE_INVALIDE');
    assert.match(corpsInvalide.message, /strictement positif/i);
  });
});
