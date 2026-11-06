/**
 * SUITE DE TESTS ADVERSARIAUX ET CONTRADICTOIRES — JALON M4
 * Rôle : Empirical Challenger (Vérificateur Adversarial M4)
 * Objectif : Éprouver empiriquement les surfaces de sécurité ABAC, repos 11h, tir, anti-médical POSIX et PDF SHA-256
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

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

test('Jalon M4 — Évaluation Contradictoire et Adversariale (Challenger M4)', async (t) => {
  let app;
  let jetonGestionnaireRH;
  let jetonChefCC;
  let jetonChefAli;
  let jetonAgentHassan;
  let jetonAdminTech;

  const purgeDonneesAdversariales = async () => {
    try {
      await pool.query(`
        DELETE FROM remplacements_gardes WHERE date_remplacement >= '2026-11-01';
        DELETE FROM plannings_vacations WHERE date_debut >= '2026-11-01'::timestamptz;
        DELETE FROM aptitudes_administratives WHERE numero_certificat_administratif LIKE 'CERT-ADV-%' OR id LIKE 'apt-adv-%';
        DELETE FROM documents_generes WHERE reference_document LIKE 'ACTE-ADV-%';
        DELETE FROM sanctions_disciplinaires WHERE reference_arrete LIKE 'ARR-ADV-%';
        DELETE FROM dossiers_disciplinaires WHERE description_sommaire LIKE 'Test adversarial%';
        DELETE FROM notations_annuelles WHERE id LIKE 'not-adv-%';
        DELETE FROM champs_personnalises WHERE id LIKE 'fld-adv-%';
      `);
    } catch (err) {
      // Ignorer si échec ponctuel
    }
  };

  t.before(async () => {
    app = await creerApplicationServeur();
    await app.ready();

    await purgeDonneesAdversariales();

    const login = async (identifiant) => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/connexion',
        payload: { identifiant, mot_de_passe: 'Police@2026!' }
      });
      return JSON.parse(res.payload).jeton;
    };

    jetonGestionnaireRH = await login('gestionnaire_rh');
    jetonChefCC = await login('chef_cc');
    jetonChefAli = await login('chef_ali');
    jetonAgentHassan = await login('agent_hassan');
    jetonAdminTech = await login('admin_tech');
  });

  t.after(async () => {
    await purgeDonneesAdversariales();
    if (app) await app.close();
    if (fermerPool && !pool?.ending && !pool?.ended) {
      await fermerPool().catch(() => {});
    }
  });

  // ==========================================================================
  // THÈME 1 : SÉCURITÉ ABAC & ÉTANCHÉITÉ DES CIRCONSCRIPTIONS
  // ==========================================================================

  await t.test('ADV-M4-01 : Rejet strict (HTTP 403) et audit forensique lors de tentative d\'accès aux dossiers disciplinaires par Chef de service', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/discipline/dossiers',
      headers: { authorization: `Bearer ${jetonChefCC}` }
    });

    assert.strictEqual(res.statusCode, 403);
    const corps = JSON.parse(res.payload);
    assert.strictEqual(corps.code_erreur, 'ACCES_INTERDIT');

    // Vérifier l'inscription de l'intrusion dans journaux_audit
    const auditRes = await pool.query(`
      SELECT * FROM journaux_audit
      WHERE action_type = 'TENTATIVE_CONSULTATION_DISCIPLINE_BLOQUEE'
        AND role_utilise = 'CHEF_DE_SERVICE'
      ORDER BY horodatage DESC LIMIT 1;
    `);
    assert.strictEqual(auditRes.rows.length, 1, 'La tentative d intrusion doit être enregistrée dans l audit');
  });

  await t.test('ADV-M4-02 : Rejet strict (HTTP 403) lorsqu\'un Chef de service tente de planifier un agent d\'une autre circonscription', async () => {
    // Chef CC tente de planifier agt-003 (affecté à Ali-Sabieh U-REG-ALI)
    const res = await app.inject({
      method: 'POST',
      url: '/api/plannings',
      headers: { authorization: `Bearer ${jetonChefCC}` },
      payload: {
        agent_id: 'agt-003',
        type_vacation: '3x8_matin',
        date_debut: '2026-11-20T06:00:00Z',
        date_fin: '2026-11-20T14:00:00Z'
      }
    });

    assert.strictEqual(res.statusCode, 403);
    const corps = JSON.parse(res.payload);
    assert.strictEqual(corps.code_erreur, 'ACCES_INTERDIT');
    assert.match(corps.message, /hors de votre commandement/i);
  });

  await t.test('ADV-M4-03 : Verrouillage strict ABAC territorial sur la création (unite_id) et la modification de vacation (PUT)', async () => {
    // 1. Chef CC tente de planifier son agent (agt-001) en forçant unite_id: 'U-REG-ALI' (province hors circonscription)
    const resCreerHorsUnite = await app.inject({
      method: 'POST',
      url: '/api/plannings',
      headers: { authorization: `Bearer ${jetonChefCC}` },
      payload: {
        agent_id: 'agt-001',
        unite_id: 'U-REG-ALI',
        type_vacation: '3x8_matin',
        date_debut: '2026-11-28T06:00:00Z',
        date_fin: '2026-11-28T14:00:00Z'
      }
    });

    // Rejet strict en 403 ACCES_INTERDIT
    assert.strictEqual(resCreerHorsUnite.statusCode, 403, 'La création de vacation avec unite_id hors circonscription doit être bloquée');
    const corpsCreer = JSON.parse(resCreerHorsUnite.payload);
    assert.strictEqual(corpsCreer.code_erreur, 'ACCES_INTERDIT');

    // 2. Chef CC planifie légitimement son agent dans sa propre unité
    const resCreerLegitime = await app.inject({
      method: 'POST',
      url: '/api/plannings',
      headers: { authorization: `Bearer ${jetonChefCC}` },
      payload: {
        agent_id: 'agt-001',
        unite_id: 'U-CC-DJIB',
        type_vacation: '3x8_matin',
        date_debut: '2026-11-28T06:00:00Z',
        date_fin: '2026-11-28T14:00:00Z'
      }
    });
    assert.strictEqual(resCreerLegitime.statusCode, 201);
    const vacId = JSON.parse(resCreerLegitime.payload).vacation.id;

    // 3. Chef Ali (Ali-Sabieh) tente de modifier / annuler cette vacation appartenant à U-CC-DJIB
    const resModif = await app.inject({
      method: 'PUT',
      url: `/api/plannings/${vacId}`,
      headers: { authorization: `Bearer ${jetonChefAli}` },
      payload: {
        statut: 'annule',
        motif_modification: 'Annulation trans-circonscription par Chef Ali'
      }
    });

    // Rejet strict en 403 ACCES_INTERDIT
    assert.strictEqual(resModif.statusCode, 403, 'PUT /api/plannings/:id doit bloquer toute modification hors juridiction');
    const corpsModif = JSON.parse(resModif.payload);
    assert.strictEqual(corpsModif.code_erreur, 'ACCES_INTERDIT');
  });

  // ==========================================================================
  // THÈME 2 : SANCTUAIRE ANTI-MÉDICAL & 3 CONTRAINTES POSIX POSTGRESQL
  // ==========================================================================

  await t.test('ADV-M4-04 : Rejet strict des mentions médicales par les 3 contraintes POSIX PostgreSQL (DDL)', async () => {
    // 1. chk_aptitudes_interdiction_medicale sur aptitudes_administratives
    await assert.rejects(async () => {
      await pool.query(`
        INSERT INTO aptitudes_administratives (
          id, agent_id, numero_certificat_administratif, decision_aptitude,
          type_conclusion, code_restriction, restriction_operationnelle, date_decision
        ) VALUES (
          'apt-adv-01', 'agt-001', 'CERT-ADV-MED-01', 'APTE_AVEC_RESTRICTIONS',
          'APTE_AVEC_RESTRICTIONS', 'POSTE_SEDENTAIRE', 'Exempté suite à diagnostic de diabète et tension', '2026-11-01'
        );
      `);
    }, (err) => {
      assert.strictEqual(err.constraint, 'chk_aptitudes_interdiction_medicale');
      return true;
    });

    // 2. chk_notations_interdiction_medicale sur notations_annuelles
    await assert.rejects(async () => {
      await pool.query(`
        INSERT INTO notations_annuelles (
          id, agent_id, annee, note_chiffree, rigueur_deontologie, competence_technique,
          disponibilite_operationnelle, sens_commandement_initiative, appreciation_generale,
          date_entretien, evaluateur_agent_id
        ) VALUES (
          'not-adv-01', 'agt-001', 2029, 4.0, 4.0, 4.0, 4.0, 4.0, 'Agent affaibli par une maladie chronique et chirurgie',
          '2029-11-01', 'agt-004'
        );
      `);
    }, (err) => {
      assert.strictEqual(err.constraint, 'chk_notations_interdiction_medicale');
      return true;
    });

    // 3. chk_champs_interdiction_medicale sur champs_personnalises
    await assert.rejects(async () => {
      await pool.query(`
        INSERT INTO champs_personnalises (
          id, code_champ, libelle, type_donnee, entite_cible, ordre_affichage
        ) VALUES (
          'fld-adv-01', 'statut_vih_agent', 'Dossier santé', 'TEXTE', 'AGENT', 99
        );
      `);
    }, (err) => {
      assert.strictEqual(err.constraint, 'chk_champs_interdiction_medicale');
      return true;
    });
  });

  await t.test('ADV-M4-05 : Rejet HTTP 422 (DONNEE_MEDICALE_PROHIBEE) lors de la soumission de termes médicaux via l\'API', async () => {
    const termesMedicaux = [
      'Inaptitude suite à chirurgie cardiaque',
      'Agent sous traitement psychiatrique lourd',
      'Hospitalisation pour glycémie et diabète',
      'Ordonnance médicale prescrivant du repos',
      'Séropositivité vih constatée par médecin'
    ];

    for (const phrase of termesMedicaux) {
      const res = await app.inject({
        method: 'POST',
        url: '/api/aptitude',
        headers: { authorization: `Bearer ${jetonGestionnaireRH}` },
        payload: {
          agent_id: 'agt-001',
          numero_certificat_administratif: `CERT-ADV-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          decision_aptitude: 'APTE_AVEC_RESTRICTIONS',
          type_conclusion: 'APTE_AVEC_RESTRICTIONS',
          code_restriction: 'POSTE_SEDENTAIRE',
          restriction_operationnelle: phrase,
          date_decision: '2026-11-01'
        }
      });

      assert.strictEqual(res.statusCode, 422, `La phrase "${phrase}" doit être rejetée en 422`);
      const corps = JSON.parse(res.payload);
      assert.strictEqual(corps.code_erreur, 'DONNEE_MEDICALE_PROHIBEE');
    }
  });

  // ==========================================================================
  // THÈME 3 : LIMITES TEMPORELLES & REPOS OBLIGATOIRE 11H (PLANNING)
  // ==========================================================================

  await t.test('ADV-M4-06 : Rejet des vacations de plus de 12h et de repos insuffisant (< 11h)', async () => {
    // 1. Vacation excédant 12h (13h)
    const resDuree = await app.inject({
      method: 'POST',
      url: '/api/plannings',
      headers: { authorization: `Bearer ${jetonChefCC}` },
      payload: {
        agent_id: 'agt-001',
        type_vacation: '2x12_jour',
        date_debut: '2026-11-21T06:00:00Z',
        date_fin: '2026-11-21T19:00:00Z'
      }
    });
    assert.strictEqual(resDuree.statusCode, 400);
    assert.strictEqual(JSON.parse(resDuree.payload).code_erreur, 'DUREE_VACATION_INVALIDE');

    // 2. Vacation initiale normale : 22 Nov 06:00 à 14:00
    const resBase = await app.inject({
      method: 'POST',
      url: '/api/plannings',
      headers: { authorization: `Bearer ${jetonChefCC}` },
      payload: {
        agent_id: 'agt-001',
        type_vacation: '3x8_matin',
        date_debut: '2026-11-22T06:00:00Z',
        date_fin: '2026-11-22T14:00:00Z'
      }
    });
    assert.strictEqual(resBase.statusCode, 201);

    // 3. Vacation antérieure avec seulement 6h de repos (22 Nov 20:00 à 23 Nov 04:00)
    const resRepos = await app.inject({
      method: 'POST',
      url: '/api/plannings',
      headers: { authorization: `Bearer ${jetonChefCC}` },
      payload: {
        agent_id: 'agt-001',
        type_vacation: '3x8_nuit',
        date_debut: '2026-11-22T20:00:00Z',
        date_fin: '2026-11-23T04:00:00Z'
      }
    });
    assert.strictEqual(resRepos.statusCode, 400);
    assert.strictEqual(JSON.parse(resRepos.payload).code_erreur, 'REPOS_MINIMAL_INSUFFISANT');
  });

  await t.test('ADV-M4-07 : Détection et blocage du chevauchement temporel par le serveur et par le trigger PostgreSQL', async () => {
    // Tentative de vacation chevauchante (22 Nov 10:00 à 18:00)
    const resChevauchement = await app.inject({
      method: 'POST',
      url: '/api/plannings',
      headers: { authorization: `Bearer ${jetonChefCC}` },
      payload: {
        agent_id: 'agt-001',
        type_vacation: '3x8_apres_midi',
        date_debut: '2026-11-22T10:00:00Z',
        date_fin: '2026-11-22T18:00:00Z'
      }
    });
    assert.strictEqual(resChevauchement.statusCode, 400);
    assert.strictEqual(JSON.parse(resChevauchement.payload).code_erreur, 'CHEVOUCHEMENT_DETECTE');

    // Vérification du trigger PostgreSQL au niveau base
    await assert.rejects(async () => {
      await pool.query(`
        INSERT INTO plannings_vacations (
          id, unite_id, agent_id, type_vacation, date_debut, date_fin, statut, cree_par
        ) VALUES (
          'vac-adv-trigger', 'U-CC-DJIB', 'agt-001', '3x8_matin',
          '2026-11-22T08:00:00Z', '2026-11-22T12:00:00Z', 'planifie', 'usr-chef-cc'
        );
      `);
    }, (err) => {
      assert.strictEqual(err.code, '23505');
      assert.match(err.message, /VIOLATION PLANNING/);
      return true;
    });
  });

  // ==========================================================================
  // THÈME 4 : REMPLACEMENTS & CONTROLES ARMES / APTITUDES
  // ==========================================================================

  await t.test('ADV-M4-08 : Rejet strict (HTTP 400) lors d\'une tentative de remplacement sur poste armé sans qualification de tir valide', async () => {
    // 1. Planification d'une vacation sur poste armé pop-003 pour agt-001 (qualifié tir)
    const resArmee = await app.inject({
      method: 'POST',
      url: '/api/plannings',
      headers: { authorization: `Bearer ${jetonChefCC}` },
      payload: {
        agent_id: 'agt-001',
        poste_operationnel_id: 'pop-003', // tir_requis: true
        type_vacation: '3x8_matin',
        date_debut: '2026-11-25T06:00:00Z',
        date_fin: '2026-11-25T14:00:00Z'
      }
    });
    assert.strictEqual(resArmee.statusCode, 201);
    const vacArmeeId = JSON.parse(resArmee.payload).vacation.id;

    // 2. Tentative de remplacement d'urgence par agt-002 (dont le certificat de tir a expiré le 2026-05-15)
    const resRempArme = await app.inject({
      method: 'POST',
      url: '/api/remplacements/ordonner',
      headers: { authorization: `Bearer ${jetonChefCC}` },
      payload: {
        planning_vacation_id: vacArmeeId,
        agent_remplacant_id: 'agt-002',
        motif: 'urgence',
        commentaire: 'Test adversarial tir expiré'
      }
    });

    // Remédiation validée : ordonnerRemplacement rejette formellement en HTTP 400
    assert.strictEqual(resRempArme.statusCode, 400, 'Le remplacement d un agent armé par un agent avec tir expiré doit être bloqué');
    const corps = JSON.parse(resRempArme.payload);
    assert.strictEqual(corps.code_erreur, 'CERTIFICAT_TIR_EXPIRE');
    assert.match(corps.message, /Affectation armée bloquée/i);
  });

  await t.test('ADV-M4-08b : Rejet strict (HTTP 400) lors d\'un remplacement violant le repos physiologique minimal de 11h', async () => {
    // 1. Planifier une vacation de nuit pour agt-004 se terminant à 06:00:00Z
    const resVac1 = await app.inject({
      method: 'POST',
      url: '/api/plannings',
      headers: { authorization: `Bearer ${jetonChefCC}` },
      payload: {
        agent_id: 'agt-004',
        type_vacation: '3x8_nuit',
        date_debut: '2026-11-28T22:00:00Z',
        date_fin: '2026-11-29T06:00:00Z'
      }
    });
    assert.strictEqual(resVac1.statusCode, 201);

    // 2. Planifier une vacation pour agt-001 débutant à 10:00:00Z le même jour (poste pop-005 non armé)
    const resVac2 = await app.inject({
      method: 'POST',
      url: '/api/plannings',
      headers: { authorization: `Bearer ${jetonChefCC}` },
      payload: {
        agent_id: 'agt-001',
        poste_operationnel_id: 'pop-005',
        type_vacation: '3x8_apres_midi',
        date_debut: '2026-11-29T10:00:00Z',
        date_fin: '2026-11-29T18:00:00Z'
      }
    });
    assert.strictEqual(resVac2.statusCode, 201);
    const vac2Id = JSON.parse(resVac2.payload).vacation.id;

    // 3. Tenter d'ordonner le remplacement par agt-004 (seulement 4h de repos au lieu de 11h)
    const resRempRepos = await app.inject({
      method: 'POST',
      url: '/api/remplacements/ordonner',
      headers: { authorization: `Bearer ${jetonChefCC}` },
      payload: {
        planning_vacation_id: vac2Id,
        agent_remplacant_id: 'agt-004',
        motif: 'urgence',
        commentaire: 'Test repos insuffisant lors d un remplacement'
      }
    });

    assert.strictEqual(resRempRepos.statusCode, 400);
    const corps = JSON.parse(resRempRepos.payload);
    assert.strictEqual(corps.code_erreur, 'REPOS_MINIMAL_INSUFFISANT');
    assert.match(corps.message, /temps de repos légal/i);
  });

  await t.test('ADV-M4-09 : Rejet strict ABAC (HTTP 403) lors d\'une tentative de remplacement ordonnée hors circonscription', async () => {
    // 1. Planification d'une vacation normale à CC (Djibouti)
    const resVac = await app.inject({
      method: 'POST',
      url: '/api/plannings',
      headers: { authorization: `Bearer ${jetonChefCC}` },
      payload: {
        agent_id: 'agt-001',
        type_vacation: '3x8_matin',
        date_debut: '2026-11-26T06:00:00Z',
        date_fin: '2026-11-26T14:00:00Z'
      }
    });
    assert.strictEqual(resVac.statusCode, 201);
    const vacId = JSON.parse(resVac.payload).vacation.id;

    // 2. Chef Ali (Ali-Sabieh) tente d'ordonner le remplacement sur cette vacation de Djibouti-Ville avec un agent d'Ali-Sabieh (agt-003)
    const resRempCross = await app.inject({
      method: 'POST',
      url: '/api/remplacements/ordonner',
      headers: { authorization: `Bearer ${jetonChefAli}` },
      payload: {
        planning_vacation_id: vacId,
        agent_remplacant_id: 'agt-003',
        motif: 'urgence'
      }
    });

    assert.strictEqual(resRempCross.statusCode, 403, 'ordonnerRemplacement doit valider le périmètre territorial');
    const corps = JSON.parse(resRempCross.payload);
    assert.strictEqual(corps.code_erreur, 'ACCES_INTERDIT');
  });

  // ==========================================================================
  // THÈME 5 : SCELLEMENT SHA-256 DES DOCUMENTS PDF & DÉTECTION D'ALTÉRATION
  // ==========================================================================

  await t.test('ADV-M4-10 : Vérification d\'intégrité cryptographique SHA-256 et détection immédiate de falsification', async () => {
    // 1. Génération d'une attestation PDF officielle
    const genRes = await app.inject({
      method: 'POST',
      url: '/api/documents/generer',
      headers: { authorization: `Bearer ${jetonGestionnaireRH}` },
      payload: {
        code_modele: 'ATTESTATION_PRESENCE',
        agent_id: 'agt-001',
        date_acte: '2026-11-05',
        autorite_signataire: 'Le Chef de Service des Ressources Humaines',
        qualite_signataire: 'Chef de Service RH'
      }
    });
    assert.strictEqual(genRes.statusCode, 201);
    const doc = JSON.parse(genRes.payload).document;
    const docId = doc.id;
    const docRef = doc.reference_document;
    const empreinteOriginale = doc.empreinte_sha256;

    // 2. Téléchargement et vérification byte-for-byte du SHA-256
    const dlRes = await app.inject({
      method: 'GET',
      url: `/api/documents/${docId}/telecharger`,
      headers: { authorization: `Bearer ${jetonGestionnaireRH}` }
    });
    assert.strictEqual(dlRes.statusCode, 200);
    const calculatedHash = crypto.createHash('sha256').update(dlRes.rawPayload).digest('hex');
    assert.strictEqual(calculatedHash, empreinteOriginale, 'Le SHA-256 du binaire téléchargé doit concorder exactement');

    // 3. Vérification publique avant altération : VALIDE
    const verif1 = await app.inject({
      method: 'GET',
      url: `/api/documents/verifier?doc=${encodeURIComponent(docRef)}&sig=${empreinteOriginale}`
    });
    assert.strictEqual(JSON.parse(verif1.payload).verification.valide, true);

    // 4. Altération malveillante d'un octet en base de données (simulation de falsification)
    const rawB64 = (await pool.query('SELECT contenu_base64 FROM documents_generes WHERE id = $1', [docId])).rows[0].contenu_base64;
    const buf = Buffer.from(rawB64, 'base64');
    buf[120] = buf[120] ^ 0xFF; // Inversion de bits sur le flux PDF
    await pool.query('UPDATE documents_generes SET contenu_base64 = $1 WHERE id = $2', [buf.toString('base64'), docId]);

    // 5. Vérification publique après altération : FALSIFICATION DÉTECTÉE
    const verif2 = await app.inject({
      method: 'GET',
      url: `/api/documents/verifier?doc=${encodeURIComponent(docRef)}&sig=${empreinteOriginale}`
    });
    const repVerif2 = JSON.parse(verif2.payload);
    assert.strictEqual(repVerif2.verification.valide, false, 'Le système doit détecter l altération du fichier');
    assert.match(repVerif2.message, /ALERTE : Empreinte cryptographique non conforme ou altérée/);
  });

  await t.test('ADV-M4-11 : Cloisonnement strict des documents officiels PDF (Confidentialité Agent et Chef)', async () => {
    // 1. DRH génère un arrêté de mutation pour agt-002 (Amina, rattachée à U-CC-DJIB)
    const genRes = await app.inject({
      method: 'POST',
      url: '/api/documents/generer',
      headers: { authorization: `Bearer ${jetonGestionnaireRH}` },
      payload: {
        code_modele: 'ARRETE_MUTATION',
        agent_id: 'agt-002',
        date_acte: '2026-11-05',
        autorite_signataire: 'Le Chef de Service des Ressources Humaines',
        qualiteSignataire: 'Chef de Service RH',
        donnees_variables: {
          nouvelle_unite: 'Commissariat Central de Djibouti',
          motif_mutation: 'Nécessité de service'
        }
      }
    });
    assert.strictEqual(genRes.statusCode, 201);
    const docId = JSON.parse(genRes.payload).document.id;

    // 2. Hassan (agt-001) tente de télécharger l'arrêté d'Amina (agt-002) -> HTTP 403
    const dlAgentTiers = await app.inject({
      method: 'GET',
      url: `/api/documents/${docId}/telecharger`,
      headers: { authorization: `Bearer ${jetonAgentHassan}` }
    });
    assert.strictEqual(dlAgentTiers.statusCode, 403, 'Un agent ne doit pas pouvoir télécharger l acte d un collègue');
    const corpsAgent = JSON.parse(dlAgentTiers.payload);
    assert.strictEqual(corpsAgent.code_erreur, 'ACCES_INTERDIT');

    // 3. Chef Ali (Ali-Sabieh) tente de télécharger l'acte d'Amina (Djibouti-Ville) -> HTTP 403
    const dlChefTiers = await app.inject({
      method: 'GET',
      url: `/api/documents/${docId}/telecharger`,
      headers: { authorization: `Bearer ${jetonChefAli}` }
    });
    assert.strictEqual(dlChefTiers.statusCode, 403, 'Un chef de service ne doit pas pouvoir télécharger l acte d un agent hors périmètre');
    const corpsChef = JSON.parse(dlChefTiers.payload);
    assert.strictEqual(corpsChef.code_erreur, 'ACCES_INTERDIT');

    // 4. Chef CC (Djibouti-Ville) télécharge légitimement l'acte d'Amina (dans sa circonscription) -> HTTP 200
    const dlChefLegitime = await app.inject({
      method: 'GET',
      url: `/api/documents/${docId}/telecharger`,
      headers: { authorization: `Bearer ${jetonChefCC}` }
    });
    assert.strictEqual(dlChefLegitime.statusCode, 200, 'Le chef de service de l unité doit pouvoir télécharger l acte');
    assert.strictEqual(dlChefLegitime.headers['content-type'], 'application/pdf');
  });
});
