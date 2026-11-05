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

test('Jalon M4 — Suite d\'Intégration Serveur Fastify & PostgreSQL (Planning 24/7, Remplacements, Discipline & Documents PDF)', async (t) => {
  let app;
  let jetonGestionnaireRH;
  let jetonAdminTech;
  let jetonChefCC;
  let jetonChefAli;
  let jetonAgentHassan;
  let jetonAuditeur;

  let idVacationTest;
  let idDossierTest;
  let idDocumentTest;

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

    // Nettoyage préventif des données de test M4 pour garantir l'idempotence
    await pool.query(`
      DELETE FROM remplacements_gardes WHERE date_remplacement >= '2026-11-05';
      DELETE FROM plannings_vacations WHERE date_debut >= '2026-11-05'::timestamptz;
      DELETE FROM aptitudes_administratives WHERE numero_certificat_administratif = 'CERT-ADM-2026-089';
      DELETE FROM documents_generes WHERE agent_id = 'agt-001' AND code_modele = 'ARRETE_MUTATION';
      DELETE FROM sanctions_disciplinaires WHERE reference_arrete = 'ARR-DISC-2026-088/DGPN';
      DELETE FROM dossiers_disciplinaires WHERE description_sommaire = 'Absence injustifiée au rassemblement de brigade';
    `).catch(() => {});
  });

  t.after(async () => {
    try {
      await pool.query(`
        DELETE FROM remplacements_gardes WHERE date_remplacement >= '2026-11-05';
        DELETE FROM plannings_vacations WHERE date_debut >= '2026-11-05'::timestamptz;
        DELETE FROM aptitudes_administratives WHERE numero_certificat_administratif = 'CERT-ADM-2026-089';
        DELETE FROM documents_generes WHERE agent_id = 'agt-001' AND code_modele = 'ARRETE_MUTATION';
        DELETE FROM sanctions_disciplinaires WHERE reference_arrete = 'ARR-DISC-2026-088/DGPN';
        DELETE FROM dossiers_disciplinaires WHERE description_sommaire = 'Absence injustifiée au rassemblement de brigade';
      `);
    } catch {}
    if (app) await app.close();
    if (fermerPool && !pool?.ending && !pool?.ended) {
      await fermerPool().catch(() => {});
    }
  });

  // --------------------------------------------------------------------------
  // M4-01 : Planification d'une vacation normale 8h par le Chef de Service (U-CC-DJIB)
  // --------------------------------------------------------------------------
  await t.test('M4-01 : Planification d\'une vacation normale 8h par le Chef de Service dans son commissariat (HTTP 201)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/plannings',
      headers: { authorization: `Bearer ${jetonChefCC}` },
      payload: {
        agent_id: 'agt-001',
        poste_operationnel_id: 'pop-003', // Chef de Patrouille Armée (tir requis)
        type_vacation: '3x8_matin',
        date_debut: '2026-11-10T06:00:00Z',
        date_fin: '2026-11-10T14:00:00Z',
        motif_modification: 'Service régulier de sécurisation'
      }
    });

    assert.strictEqual(res.statusCode, 201);
    const corps = JSON.parse(res.payload);
    assert.strictEqual(corps.statut, 'SUCCES');
    assert.strictEqual(corps.vacation.agent_id, 'agt-001');
    assert.strictEqual(corps.vacation.unite_id, 'U-CC-DJIB');
    assert.strictEqual(corps.vacation.statut, 'planifie');
    idVacationTest = corps.vacation.id;
  });

  // --------------------------------------------------------------------------
  // M4-02 : Rejet lors d'une tentative de vacation excédant 12h (plafond statutaire)
  // --------------------------------------------------------------------------
  await t.test('M4-02 : Rejet lors d\'une tentative de vacation excédant 12h (14h planifiées -> HTTP 400)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/plannings',
      headers: { authorization: `Bearer ${jetonChefCC}` },
      payload: {
        agent_id: 'agt-001',
        poste_operationnel_id: 'pop-005',
        type_vacation: 'permanence',
        date_debut: '2026-11-15T06:00:00Z',
        date_fin: '2026-11-15T20:00:00Z' // 14 heures (> 12h)
      }
    });

    assert.strictEqual(res.statusCode, 400);
    const corps = JSON.parse(res.payload);
    assert.strictEqual(corps.code_erreur, 'DUREE_VACATION_INVALIDE');
    assert.match(corps.message, /durée maximale de vacation/i);
  });

  // --------------------------------------------------------------------------
  // M4-03 : Rejet lors d'une tentative de planification avec repos < 11h
  // --------------------------------------------------------------------------
  await t.test('M4-03 : Rejet de vacation avec repos physiologique insuffisant (8h de repos -> HTTP 400)', async () => {
    // 1. Création d'une première vacation de nuit se terminant à 06h00
    await app.inject({
      method: 'POST',
      url: '/api/plannings',
      headers: { authorization: `Bearer ${jetonChefCC}` },
      payload: {
        agent_id: 'agt-001',
        type_vacation: '3x8_nuit',
        date_debut: '2026-11-16T22:00:00Z',
        date_fin: '2026-11-17T06:00:00Z'
      }
    });

    // 2. Tentative d'affectation le même jour à 14h00 (seulement 8h de repos entre 06h et 14h)
    const resInfraction = await app.inject({
      method: 'POST',
      url: '/api/plannings',
      headers: { authorization: `Bearer ${jetonChefCC}` },
      payload: {
        agent_id: 'agt-001',
        type_vacation: '3x8_apres_midi',
        date_debut: '2026-11-17T14:00:00Z',
        date_fin: '2026-11-17T22:00:00Z'
      }
    });

    assert.strictEqual(resInfraction.statusCode, 400);
    const corps = JSON.parse(resInfraction.payload);
    assert.strictEqual(corps.code_erreur, 'REPOS_MINIMAL_INSUFFISANT');
    assert.match(corps.message, /temps de repos légal/i);
  });

  // --------------------------------------------------------------------------
  // M4-04 : Rejet de planification sur poste armé si certificat de tir expiré/absent
  // --------------------------------------------------------------------------
  await t.test('M4-04 : Blocage technique lors de l\'affectation sur poste armé sans qualification tir valide (HTTP 400)', async () => {
    // agt-002 n'a pas de certificat de tir valide (ou a une dispense)
    const resArmeBloque = await app.inject({
      method: 'POST',
      url: '/api/plannings',
      headers: { authorization: `Bearer ${jetonChefCC}` },
      payload: {
        agent_id: 'agt-002',
        poste_operationnel_id: 'pop-003', // tir_requis: true
        type_vacation: '3x8_matin',
        date_debut: '2026-11-20T06:00:00Z',
        date_fin: '2026-11-20T14:00:00Z'
      }
    });

    assert.strictEqual(resArmeBloque.statusCode, 400);
    const corps = JSON.parse(resArmeBloque.payload);
    assert.ok(corps.code_erreur === 'CERTIFICAT_TIR_EXPIRE' || corps.code_erreur === 'DISPENSE_ARME_ACTIVE');
    assert.match(corps.message, /Affectation armée bloquée/i);
  });

  // --------------------------------------------------------------------------
  // M4-05 : Prévention absolue des doubles vacations simultanées (anti-chevauchement)
  // --------------------------------------------------------------------------
  await t.test('M4-05 : Prévention stricte des doubles vacations simultanées pour un même agent (anti-chevauchement -> HTTP 400)', async () => {
    // 1. Création vacation A (06h - 14h)
    await app.inject({
      method: 'POST',
      url: '/api/plannings',
      headers: { authorization: `Bearer ${jetonChefCC}` },
      payload: {
        agent_id: 'agt-001',
        type_vacation: '3x8_matin',
        date_debut: '2026-11-25T06:00:00Z',
        date_fin: '2026-11-25T14:00:00Z'
      }
    });

    // 2. Tentative de création vacation B chevauchante (10h - 18h)
    const resCollision = await app.inject({
      method: 'POST',
      url: '/api/plannings',
      headers: { authorization: `Bearer ${jetonChefCC}` },
      payload: {
        agent_id: 'agt-001',
        type_vacation: '3x8_apres_midi',
        date_debut: '2026-11-25T10:00:00Z',
        date_fin: '2026-11-25T18:00:00Z'
      }
    });

    assert.strictEqual(resCollision.statusCode, 400);
    const corps = JSON.parse(resCollision.payload);
    assert.strictEqual(corps.code_erreur, 'CHEVOUCHEMENT_DETECTE');
  });

  // --------------------------------------------------------------------------
  // M4-06 : Rejet formel d'un Chef de Service tentant de planifier hors unité
  // --------------------------------------------------------------------------
  await t.test('M4-06 : Rejet formel lorsqu\'un Chef de Service tente de planifier un agent hors unité (HTTP 403)', async () => {
    // chef_cc (Djibouti-Ville) tente de planifier agt-003 (affecté à Ali-Sabieh U-REG-ALI)
    const resHorsUnite = await app.inject({
      method: 'POST',
      url: '/api/plannings',
      headers: { authorization: `Bearer ${jetonChefCC}` },
      payload: {
        agent_id: 'agt-003',
        type_vacation: '3x8_matin',
        date_debut: '2026-11-28T06:00:00Z',
        date_fin: '2026-11-28T14:00:00Z'
      }
    });

    assert.strictEqual(resHorsUnite.statusCode, 403);
    const corps = JSON.parse(resHorsUnite.payload);
    assert.strictEqual(corps.code_erreur, 'ACCES_INTERDIT');
  });

  // --------------------------------------------------------------------------
  // M4-07 : Consultation des plannings par un Agent simple (visibilité exclusive)
  // --------------------------------------------------------------------------
  await t.test('M4-07 : Consultation des plannings par Agent simple avec étanchéité stricte (HTTP 200)', async () => {
    const resAgent = await app.inject({
      method: 'GET',
      url: '/api/plannings',
      headers: { authorization: `Bearer ${jetonAgentHassan}` }
    });

    assert.strictEqual(resAgent.statusCode, 200);
    const corps = JSON.parse(resAgent.payload);
    assert.strictEqual(corps.statut, 'SUCCES');
    assert.ok(corps.plannings.length > 0);

    // Toutes les vacations retournées doivent appartenir exclusivement à agt-001
    const vacationsAutrui = corps.plannings.filter(p => p.agent_id !== 'agt-001');
    assert.strictEqual(vacationsAutrui.length, 0, 'Un agent simple ne doit voir aucune vacation tierce');
  });

  // --------------------------------------------------------------------------
  // M4-08 : Moteur de recommandation des remplaçants éligibles
  // --------------------------------------------------------------------------
  await t.test('M4-08 : Moteur de recommandation et détection des remplaçants conformes (repos 11h & qualifications)', async () => {
    const resCandidats = await app.inject({
      method: 'GET',
      url: `/api/remplacements/candidats?vacation_id=${idVacationTest}`,
      headers: { authorization: `Bearer ${jetonChefCC}` }
    });

    assert.strictEqual(resCandidats.statusCode, 200);
    const corps = JSON.parse(resCandidats.payload);
    assert.strictEqual(corps.statut, 'SUCCES');
    assert.ok(Array.isArray(corps.candidats));

    // Chaque candidat retourné doit respecter au minimum 11h de repos
    for (const c of corps.candidats) {
      assert.ok(c.repos_heures_observees >= 10.99, `Le candidat ${c.agent_id} doit avoir au moins 11h de repos`);
      assert.ok(c.score_eligibilite > 0);
    }
  });

  // --------------------------------------------------------------------------
  // M4-09 : Remplacement d'urgence atomique et traçage dans l'audit
  // --------------------------------------------------------------------------
  await t.test('M4-09 : Validation d\'un remplacement d\'urgence par le Chef de Service avec traçage audit (HTTP 201)', async () => {
    // Remplacement de agt-001 sur idVacationTest par agt-004 (Commandant de brigade disponible)
    const resRemplacement = await app.inject({
      method: 'POST',
      url: '/api/remplacements/ordonner',
      headers: { authorization: `Bearer ${jetonChefCC}` },
      payload: {
        planning_vacation_id: idVacationTest,
        agent_remplacant_id: 'agt-004',
        motif: 'urgence',
        commentaire: 'Remplacement d office au rassemblement de brigade'
      }
    });

    assert.strictEqual(resRemplacement.statusCode, 201);
    const corps = JSON.parse(resRemplacement.payload);
    assert.strictEqual(corps.statut, 'SUCCES');
    assert.strictEqual(corps.remplacement.statut, 'valide');
    assert.strictEqual(corps.nouvelle_vacation.agent_id, 'agt-004');

    // Vérifier que la vacation initiale est marquée comme remplacée
    const resVacCheck = await pool.query('SELECT statut FROM plannings_vacations WHERE id = $1', [idVacationTest]);
    assert.strictEqual(resVacCheck.rows[0].statut, 'remplace');

    // Vérifier l'inscription dans journaux_audit
    const resAudit = await pool.query(`
      SELECT * FROM journaux_audit
      WHERE action_type = 'REMPLACEMENT_URGENCE_PLANNING' AND entite_id = $1;
    `, [corps.remplacement.id]);
    assert.strictEqual(resAudit.rows.length, 1);
  });

  // --------------------------------------------------------------------------
  // M4-10 : Alerte sous-effectif critique de brigade (< 40% seuil minimal)
  // --------------------------------------------------------------------------
  await t.test('M4-10 : Alerte de sous-effectif critique de brigade sur seuil minimal réglementaire (40%)', async () => {
    // Recherche d'alerte pour une date lointaine sans vacations planifiées
    const resAlerte = await app.inject({
      method: 'GET',
      url: '/api/plannings/alertes-effectifs/U-CC-DJIB?date=2026-12-25',
      headers: { authorization: `Bearer ${jetonChefCC}` }
    });

    assert.strictEqual(resAlerte.statusCode, 200);
    const corps = JSON.parse(resAlerte.payload);
    assert.strictEqual(corps.statut, 'SUCCES');
    assert.strictEqual(corps.alerte.alerte_sous_effectif, true);
    assert.ok(corps.alerte.ratio_presence < 0.40);
  });

  // --------------------------------------------------------------------------
  // M4-11 : Cloisonnement disciplinaire absolu (rejet HTTP 403 hors DGPN/RH)
  // --------------------------------------------------------------------------
  await t.test('M4-11 : Cloisonnement hermétique de la discipline (HTTP 403 pour Chef, Agent, Admin Tech)', async () => {
    // 1. Chef de service
    const resChef = await app.inject({
      method: 'GET',
      url: '/api/discipline/dossiers',
      headers: { authorization: `Bearer ${jetonChefCC}` }
    });
    assert.strictEqual(resChef.statusCode, 403);
    assert.strictEqual(JSON.parse(resChef.payload).code_erreur, 'ACCES_INTERDIT');

    // 2. Agent simple
    const resAgent = await app.inject({
      method: 'GET',
      url: '/api/discipline/dossiers',
      headers: { authorization: `Bearer ${jetonAgentHassan}` }
    });
    assert.strictEqual(resAgent.statusCode, 403);
    assert.strictEqual(JSON.parse(resAgent.payload).code_erreur, 'ACCES_INTERDIT');

    // 3. Admin technique
    const resTech = await app.inject({
      method: 'GET',
      url: '/api/discipline/dossiers',
      headers: { authorization: `Bearer ${jetonAdminTech}` }
    });
    assert.strictEqual(resTech.statusCode, 403);
    assert.strictEqual(JSON.parse(resTech.payload).code_erreur, 'ACCES_INTERDIT');

    // Vérifier l'inscription des tentatives d'intrusion dans journaux_audit
    const resAudit = await pool.query(`
      SELECT COUNT(*) AS total FROM journaux_audit
      WHERE action_type = 'TENTATIVE_CONSULTATION_DISCIPLINE_BLOQUEE';
    `);
    assert.ok(parseInt(resAudit.rows[0].total, 10) >= 3);
  });

  // --------------------------------------------------------------------------
  // M4-12 : Consultation et ouverture de dossier disciplinaire par RH habilité
  // --------------------------------------------------------------------------
  await t.test('M4-12 : Consultation et ouverture d\'un dossier disciplinaire officiel par la DRH habilitée (HTTP 200/201)', async () => {
    // 1. Consultation du dossier type
    const resDossier = await app.inject({
      method: 'GET',
      url: '/api/discipline/dossiers/dos-disc-001',
      headers: { authorization: `Bearer ${jetonGestionnaireRH}` }
    });
    assert.strictEqual(resDossier.statusCode, 200);
    const corpsDossier = JSON.parse(resDossier.payload);
    assert.strictEqual(corpsDossier.dossier.numero_dossier, 'DISC-2026-001');

    // 2. Ouverture d'un nouveau dossier en phase préliminaire
    const resNouveau = await app.inject({
      method: 'POST',
      url: '/api/discipline/dossiers',
      headers: { authorization: `Bearer ${jetonGestionnaireRH}` },
      payload: {
        agent_id: 'agt-002',
        date_faits: '2026-02-15',
        description_sommaire: 'Absence injustifiée au rassemblement de brigade',
        description_faits: 'L agent ne s est pas presente a la prise de vacation',
        phase_procedure: 'ALLEGATION'
      }
    });

    assert.strictEqual(resNouveau.statusCode, 201);
    const corpsNouv = JSON.parse(resNouveau.payload);
    assert.strictEqual(corpsNouv.statut, 'SUCCES');
    assert.strictEqual(corpsNouv.dossier.agent_id, 'agt-002');
    idDossierTest = corpsNouv.dossier.id;
  });

  // --------------------------------------------------------------------------
  // M4-13 : Prononcé d'une sanction disciplinaire statutaire (Loi 116/AN/21)
  // --------------------------------------------------------------------------
  await t.test('M4-13 : Prononcé d\'une sanction statutaire conforme et mise à jour de la carrière (HTTP 201)', async () => {
    const resSanction = await app.inject({
      method: 'POST',
      url: '/api/discipline/sanctions',
      headers: { authorization: `Bearer ${jetonGestionnaireRH}` },
      payload: {
        dossier_id: idDossierTest,
        groupe_sanction: 'GROUPE_1',
        nature_sanction: 'avertissement',
        date_effet: '2026-03-01',
        reference_arrete: 'ARR-DISC-2026-088/DGPN',
        prononcee_par: 'Directeur Général de la Police Nationale',
        motif_sanction: 'Manquement caractérisé à la ponctualité opérationnelle'
      }
    });

    assert.strictEqual(resSanction.statusCode, 201);
    const corps = JSON.parse(resSanction.payload);
    assert.strictEqual(corps.statut, 'SUCCES');
    assert.strictEqual(corps.sanction.groupe_sanction, 'GROUPE_1');
    assert.strictEqual(corps.sanction.nature_sanction, 'avertissement');
    assert.ok(corps.sanction.date_effacement_prevue !== null, 'Une sanction du Groupe 1 doit avoir une date d effacement prévue (+36 mois)');
  });

  // --------------------------------------------------------------------------
  // M4-14 : Enregistrement d'une décision d'aptitude administrative
  // --------------------------------------------------------------------------
  await t.test('M4-14 : Enregistrement d\'une décision d\'aptitude administrative souveraine sans secret médical (HTTP 201)', async () => {
    const resAptitude = await app.inject({
      method: 'POST',
      url: '/api/aptitude',
      headers: { authorization: `Bearer ${jetonGestionnaireRH}` },
      payload: {
        agent_id: 'agt-003',
        numero_certificat: 'CERT-ADM-2026-089',
        decision_aptitude: 'AMENAGEMENT_POSTE',
        type_conclusion: 'APTE_AVEC_RESTRICTIONS',
        code_restriction: 'POSTE_SEDENTAIRE',
        restriction_operationnelle: 'Affectation en brigade sedentaire de jour et exemption de patrouille motorisee',
        date_decision: '2026-03-01',
        date_echeance: '2026-09-01'
      }
    });

    assert.strictEqual(resAptitude.statusCode, 201);
    const corps = JSON.parse(resAptitude.payload);
    assert.strictEqual(corps.statut, 'SUCCES');
    assert.strictEqual(corps.aptitude.decision_aptitude, 'AMENAGEMENT_POSTE');
    assert.strictEqual(corps.aptitude.code_restriction, 'POSTE_SEDENTAIRE');
  });

  // --------------------------------------------------------------------------
  // M4-15 : Veto anti-médical absolu (Rejet HTTP 422 si terme médical)
  // --------------------------------------------------------------------------
  await t.test('M4-15 : Veto anti-médical absolu avec rejet HTTP 422 lors de la soumission d\'un terme de santé', async () => {
    const termesMedicauxProscrits = [
      'Inapte temporaire suite à diabète sévère',
      'Dispense pour traitement médical à l hôpital',
      'Ordonnance prescrivant du repos suite à une maladie'
    ];

    for (const texte of termesMedicauxProscrits) {
      const resRejet = await app.inject({
        method: 'POST',
        url: '/api/aptitude',
        headers: { authorization: `Bearer ${jetonGestionnaireRH}` },
        payload: {
          agent_id: 'agt-001',
          numero_certificat: `CERT-ILLEGAL-${Date.now()}`,
          decision_aptitude: 'INAPTE_TEMPORAIRE_PORT_ARME',
          restriction_operationnelle: texte,
          date_decision: '2026-03-01'
        }
      });

      assert.strictEqual(resRejet.statusCode, 422, `La soumission de "${texte}" aurait dû être rejetée par HTTP 422`);
      const corps = JSON.parse(resRejet.payload);
      assert.strictEqual(corps.code_erreur, 'DONNEE_MEDICALE_PROHIBEE');
      assert.match(corps.message, /Violation du secret médical/i);
    }
  });

  // --------------------------------------------------------------------------
  // M4-16 : Génération souveraine pure Node.js d'un acte officiel PDF scellé SHA-256
  // --------------------------------------------------------------------------
  await t.test('M4-16 : Génération d\'un Arrêté officiel PDF républicain avec scellement SHA-256 (HTTP 201)', async () => {
    const resDoc = await app.inject({
      method: 'POST',
      url: '/api/documents/generer',
      headers: { authorization: `Bearer ${jetonGestionnaireRH}` },
      payload: {
        code_modele: 'ARRETE_MUTATION',
        agent_id: 'agt-001',
        donnees_acte: {
          date_effet: '2026-04-01',
          unite_destination: 'Commissariat Central de Djibouti-Ville'
        }
      }
    });

    assert.strictEqual(resDoc.statusCode, 201);
    const corps = JSON.parse(resDoc.payload);
    assert.strictEqual(corps.statut, 'SUCCES');
    assert.strictEqual(corps.document.code_modele, 'ARRETE_MUTATION');
    assert.strictEqual(corps.document.empreinte_sha256.length, 64);
    assert.ok(corps.document.contenu_base64.length > 100);

    // Décodage du Buffer pour vérifier la validité de l'en-tête PDF standardisé
    const pdfBuffer = Buffer.from(corps.document.contenu_base64, 'base64');
    assert.strictEqual(pdfBuffer.subarray(0, 8).toString('latin1'), '%PDF-1.4');

    // Vérification mathématique du hash SHA-256
    const hashVerif = crypto.createHash('sha256').update(pdfBuffer).digest('hex');
    assert.strictEqual(corps.document.empreinte_sha256, hashVerif);

    idDocumentTest = corps.document.id;
  });

  // --------------------------------------------------------------------------
  // M4-17 : Téléchargement du flux PDF et traçabilité dans l'audit
  // --------------------------------------------------------------------------
  await t.test('M4-17 : Téléchargement du binaire application/pdf et inscription de l\'export dans l\'audit', async () => {
    const resDownload = await app.inject({
      method: 'GET',
      url: `/api/documents/${idDocumentTest}/telecharger`,
      headers: { authorization: `Bearer ${jetonGestionnaireRH}` }
    });

    assert.strictEqual(resDownload.statusCode, 200);
    assert.strictEqual(resDownload.headers['content-type'], 'application/pdf');
    assert.ok(resDownload.rawPayload.length > 500);

    // Vérification du traçage dans journaux_audit
    const resAudit = await pool.query(`
      SELECT * FROM journaux_audit
      WHERE action_type = 'TELECHARGEMENT_DOCUMENT_OFFICIEL' AND entite_id = $1;
    `, [idDocumentTest]);
    assert.strictEqual(resAudit.rows.length, 1);
  });

  // --------------------------------------------------------------------------
  // M4-18 : Exclusion absolue de l'Administrateur Technique sur l'ensemble M4
  // --------------------------------------------------------------------------
  await t.test('M4-18 : Exclusion absolue de l\'Admin Technique sur les routes nominatives M4 (HTTP 403)', async () => {
    const endpointsTest = [
      { method: 'GET', url: '/api/plannings' },
      { method: 'GET', url: '/api/discipline/dossiers' },
      { method: 'GET', url: '/api/aptitude/agt-001' },
      { method: 'POST', url: '/api/documents/generer', payload: { code_modele: 'ATTESTATION_PRESENCE', agent_id: 'agt-001' } },
      { method: 'GET', url: `/api/documents/${idDocumentTest}/telecharger` }
    ];

    for (const ep of endpointsTest) {
      const res = await app.inject({
        method: ep.method,
        url: ep.url,
        headers: { authorization: `Bearer ${jetonAdminTech}` },
        payload: ep.payload
      });

      assert.strictEqual(res.statusCode, 403, `L'Admin Technique ne doit pas avoir accès à ${ep.method} ${ep.url}`);
      const corps = JSON.parse(res.payload);
      assert.strictEqual(corps.code_erreur, 'ACCES_INTERDIT');
    }
  });
});
