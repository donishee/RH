const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

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
  // Fallback direct si non compilé
  require('tsx/cjs');
  creerApplicationServeur = require('../../src/server.ts').creerApplicationServeur;
  const dbModule = require('../../src/database/index.ts');
  fermerPool = dbModule.fermerPool;
  pool = dbModule.pool;
}

test('Jalon M1 — Suite d\'Intégration Serveur Fastify & PostgreSQL (Port 5433)', async (t) => {
  let app;
  let jetonGestionnaireRH;
  let jetonAdminTech;
  let jetonChefAli;
  let jetonAgentHassan;
  let jetonAdminFonc;
  let agentCreeId;
  let codeChampValide;

  t.before(async () => {
    app = await creerApplicationServeur();
    await app.ready();
  });

  t.after(async () => {
    if (app) await app.close();
    if (fermerPool && !pool?.ending && !pool?.ended) {
      await fermerPool().catch(() => {});
    }
  });

  // 1. Contrôle de Santé et Persistance PostgreSQL
  await t.test('M1-01 : Contrôle de santé opérationnelle du serveur et connexion PostgreSQL', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/sante'
    });

    assert.strictEqual(res.statusCode, 200);
    const corps = JSON.parse(res.payload);
    assert.strictEqual(corps.statut, 'OPERATIONNEL');
    assert.strictEqual(corps.base_de_donnees, 'CONNECTEE');
    assert.strictEqual(corps.systeme, 'SIRH Police Nationale de Djibouti');
  });

  // 2. Authentification et Verrouillage Anti-Brute-Force
  await t.test('M1-02 : Authentification sécurisée scrypt, tolérance WAN et rejet des identifiants erronés', async () => {
    // Échec avec mot de passe invalide
    const resEchec = await app.inject({
      method: 'POST',
      url: '/api/auth/connexion',
      payload: {
        identifiant: 'gestionnaire_rh',
        mot_de_passe: 'MauvaisMotDePasse123!'
      }
    });

    assert.strictEqual(resEchec.statusCode, 401);
    const corpsEchec = JSON.parse(resEchec.payload);
    assert.strictEqual(corpsEchec.statut, 'ERREUR');
    assert.match(corpsEchec.message, /Identifiant ou mot de passe incorrect/i);

    // Connexion réussie pour Gestionnaire RH
    const resRH = await app.inject({
      method: 'POST',
      url: '/api/auth/connexion',
      payload: {
        identifiant: 'gestionnaire_rh',
        mot_de_passe: 'Police@2026!'
      }
    });

    assert.strictEqual(resRH.statusCode, 200);
    const corpsRH = JSON.parse(resRH.payload);
    assert.strictEqual(corpsRH.statut, 'SUCCES');
    assert.ok(corpsRH.jeton, 'Un jeton opaque de 256 bits doit être retourné');
    assert.strictEqual(corpsRH.session.role, 'GESTIONNAIRE_RH');
    jetonGestionnaireRH = corpsRH.jeton;

    // Connexion Admin Tech
    const resTech = await app.inject({
      method: 'POST',
      url: '/api/auth/connexion',
      payload: { identifiant: 'admin_tech', mot_de_passe: 'Police@2026!' }
    });
    jetonAdminTech = JSON.parse(resTech.payload).jeton;

    // Connexion Chef Ali-Sabieh
    const resChef = await app.inject({
      method: 'POST',
      url: '/api/auth/connexion',
      payload: { identifiant: 'chef_ali', mot_de_passe: 'Police@2026!' }
    });
    jetonChefAli = JSON.parse(resChef.payload).jeton;

    // Connexion Agent Hassan
    const resAgt = await app.inject({
      method: 'POST',
      url: '/api/auth/connexion',
      payload: { identifiant: 'agent_hassan', mot_de_passe: 'Police@2026!' }
    });
    jetonAgentHassan = JSON.parse(resAgt.payload).jeton;

    // Connexion Admin Fonctionnel RH
    const resFonc = await app.inject({
      method: 'POST',
      url: '/api/auth/connexion',
      payload: { identifiant: 'admin_fonc', mot_de_passe: 'Police@2026!' }
    });
    jetonAdminFonc = JSON.parse(resFonc.payload).jeton;
  });

  // 3. Validation de Session Active
  await t.test('M1-03 : Consultation et prolongation de session active (15 min glissantes)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/auth/session',
      headers: {
        Authorization: `Bearer ${jetonGestionnaireRH}`
      }
    });

    assert.strictEqual(res.statusCode, 200);
    const corps = JSON.parse(res.payload);
    assert.strictEqual(corps.statut, 'SUCCES');
    assert.strictEqual(corps.session.role, 'GESTIONNAIRE_RH');
    assert.strictEqual(corps.session.matricule, 'RH-001');
  });

  // 4. Référentiel des 17 Unités & Arborescence Hiérarchique
  await t.test('M1-04 : Consultation du référentiel des 17 unités et sous-arborescence descendante', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/unites',
      headers: { Authorization: `Bearer ${jetonGestionnaireRH}` }
    });

    assert.strictEqual(res.statusCode, 200);
    const corps = JSON.parse(res.payload);
    assert.strictEqual(corps.statut, 'SUCCES');
    assert.strictEqual(corps.total, 17, 'Le référentiel doit comporter exactement 17 unités');

    // Vérification de la sous-arborescence du Commissariat Central (U-CC-DJIB)
    const resArbre = await app.inject({
      method: 'GET',
      url: '/api/unites/U-CC-DJIB/arborescence',
      headers: { Authorization: `Bearer ${jetonGestionnaireRH}` }
    });

    assert.strictEqual(resArbre.statusCode, 200);
    const corpsArbre = JSON.parse(resArbre.payload);
    assert.strictEqual(corpsArbre.statut, 'SUCCES');
    // Le Commissariat Central doit englober lui-même et les 5 commissariats d'arrondissement (6 au total)
    assert.strictEqual(corpsArbre.total, 6);
    const codes = corpsArbre.arborescence.map(u => u.code);
    assert.ok(codes.includes('CC-DJIB'));
    assert.ok(codes.includes('ARR-1-PLATEAU'));
    assert.ok(codes.includes('ARR-5-BALBALA-S'));
  });

  // 5. Cloisonnement Strict de l'Administrateur Technique (Zéro Accès Nominatif)
  await t.test('M1-05 : Interdiction absolue d\'accès aux dossiers nominatifs RH pour l\'Administrateur Technique', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/agents',
      headers: { Authorization: `Bearer ${jetonAdminTech}` }
    });

    assert.strictEqual(res.statusCode, 403);
    const corps = JSON.parse(res.payload);
    assert.strictEqual(corps.statut, 'ERREUR');
    assert.strictEqual(corps.code_erreur, 'ACCES_INTERDIT');
    assert.match(corps.message, /administrateurs techniques ne disposent d'aucun droit/i);
  });

  // 6. Contrôles d'Accès ABAC par Périmètre Territorial
  await t.test('M1-06 : Contrôle ABAC territorial strict pour Chef de Service et Agent simple', async () => {
    // Chef Ali-Sabieh ne voit que les agents de sa région
    const resChefAli = await app.inject({
      method: 'GET',
      url: '/api/agents',
      headers: { Authorization: `Bearer ${jetonChefAli}` }
    });

    assert.strictEqual(resChefAli.statusCode, 200);
    const corpsChef = JSON.parse(resChefAli.payload);
    assert.ok(corpsChef.agents.length > 0);
    for (const a of corpsChef.agents) {
      assert.strictEqual(a.unite_actuelle_id, 'U-REG-ALI');
    }

    // Agent Hassan ne peut pas accéder à la fiche d'un autre policier (ex: agt-003 à Ali-Sabieh)
    const resAutre = await app.inject({
      method: 'GET',
      url: '/api/agents/agt-003',
      headers: { Authorization: `Bearer ${jetonAgentHassan}` }
    });

    assert.strictEqual(resAutre.statusCode, 403);
    const corpsAutre = JSON.parse(resAutre.payload);
    assert.match(corpsAutre.message, /ne peut consulter que son propre dossier/i);

    // Agent Hassan accède avec succès à son propre dossier (agt-001)
    const resPropre = await app.inject({
      method: 'GET',
      url: '/api/agents/agt-001',
      headers: { Authorization: `Bearer ${jetonAgentHassan}` }
    });

    assert.strictEqual(resPropre.statusCode, 200);
    const corpsPropre = JSON.parse(resPropre.payload);
    assert.strictEqual(corpsPropre.agent.matricule, 'PND-2020-00142');
  });

  // 7. Création Transactionnelle d'un Agent avec Matricule PND-YYYY-XXXXX
  await t.test('M1-07 : Création d\'un agent avec affectation initiale et rejet des matricules non conformes', async () => {
    // Rejet d'un matricule erroné
    const resInvalide = await app.inject({
      method: 'POST',
      url: '/api/agents',
      headers: { Authorization: `Bearer ${jetonGestionnaireRH}` },
      payload: {
        matricule: 'MATRICULE_ERRONE_123',
        numero_carte_nationale: 'NID-999999-001',
        nom: 'Aden',
        prenom: 'Moustapha',
        date_naissance: '1995-04-10',
        genre: 'MASCULIN',
        date_recrutement: '2026-01-01',
        corps: 'AGENTS',
        grade_actuel: 'Agent de 2ème classe',
        indice_solde: 280,
        unite_actuelle_id: 'U-CC-DJIB'
      }
    });

    assert.strictEqual(resInvalide.statusCode, 400);
    assert.strictEqual(JSON.parse(resInvalide.payload).code_erreur, 'FORMAT_MATRICULE_INVALIDE');

    // Création réussie avec matricule PND-2026-00999
    const matriculeUnique = `PND-2026-${Math.floor(10000 + Math.random() * 89999)}`;
    const nidUnique = `NID-${Date.now().toString().slice(-8)}`;

    const resCreation = await app.inject({
      method: 'POST',
      url: '/api/agents',
      headers: { Authorization: `Bearer ${jetonGestionnaireRH}` },
      payload: {
        matricule: matriculeUnique,
        numero_carte_nationale: nidUnique,
        nom: 'Robleh',
        prenom: 'Souleiman',
        date_naissance: '1998-07-20',
        lieu_naissance: 'Tadjourah',
        genre: 'MASCULIN',
        date_recrutement: '2026-02-01',
        corps: 'AGENTS',
        grade_actuel: 'Agent de 1ère classe',
        echelon_actuel: 1,
        indice_solde: 320,
        unite_actuelle_id: 'U-REG-TAD'
      }
    });

    assert.strictEqual(resCreation.statusCode, 201);
    const corpsCreation = JSON.parse(resCreation.payload);
    assert.strictEqual(corpsCreation.statut, 'SUCCES');
    assert.strictEqual(corpsCreation.agent.matricule, matriculeUnique);
    agentCreeId = corpsCreation.agent.id;

    // Vérification que l'affectation initiale a été automatiquement créée
    const resAff = await app.inject({
      method: 'GET',
      url: `/api/agents/${agentCreeId}/affectations`,
      headers: { Authorization: `Bearer ${jetonGestionnaireRH}` }
    });

    assert.strictEqual(resAff.statusCode, 200);
    const corpsAff = JSON.parse(resAff.payload);
    assert.strictEqual(corpsAff.total, 1);
    assert.strictEqual(corpsAff.affectations[0].type_mouvement, 'NOMINATION_INITIALE');
    assert.strictEqual(corpsAff.affectations[0].est_affectation_courante, true);
  });

  // 8. Mutation Atomique et Immuabilité des Affectations
  await t.test('M1-08 : Mutation atomique avec clôture de l\'ancienne affectation et rejet de suppression', async () => {
    // Muter l'agent créé en M1-07 de U-REG-TAD vers U-REG-DIK
    const dateEffet = '2026-06-01';
    const referenceArrete = 'Arrêté Ministériel n° 2026-MUT-042/DGPN';

    const resMutation = await app.inject({
      method: 'POST',
      url: '/api/mutations',
      headers: { Authorization: `Bearer ${jetonGestionnaireRH}` },
      payload: {
        agent_id: agentCreeId,
        nouvelle_unite_id: 'U-REG-DIK',
        type_mouvement: 'MUTATION',
        date_debut: dateEffet,
        motif_mouvement: 'Renforcement opérationnel région de Dikhil',
        reference_arrete_ou_decision: referenceArrete
      }
    });

    assert.strictEqual(resMutation.statusCode, 200);
    const corpsMut = JSON.parse(resMutation.payload);
    assert.strictEqual(corpsMut.statut, 'SUCCES');

    // Vérifier l'historique complet des affectations
    const resHist = await app.inject({
      method: 'GET',
      url: `/api/agents/${agentCreeId}/affectations`,
      headers: { Authorization: `Bearer ${jetonGestionnaireRH}` }
    });

    assert.strictEqual(resHist.statusCode, 200);
    const affs = JSON.parse(resHist.payload).affectations;
    assert.ok(affs.length >= 2, 'L\'historique doit conserver l\'ancienne et la nouvelle affectation');

    const affCourante = affs.find(a => a.est_affectation_courante === true);
    assert.ok(affCourante, 'Une affectation courante unique doit exister');
    assert.strictEqual(affCourante.unite_id, 'U-REG-DIK');

    const affAncienne = affs.find(a => a.est_affectation_courante === false);
    assert.ok(affAncienne, 'L\'ancienne affectation doit être clôturée et conservée sans écrasement');
    assert.strictEqual(affAncienne.unite_id, 'U-REG-TAD');
    assert.ok(affAncienne.date_fin, 'L\'ancienne affectation doit porter une date de fin');

    // Tentative de suppression d'une affectation (Interdiction absolue)
    const resDelete = await app.inject({
      method: 'DELETE',
      url: `/api/affectations/${affAncienne.id}`,
      headers: { Authorization: `Bearer ${jetonGestionnaireRH}` }
    });

    assert.strictEqual(resDelete.statusCode, 405);
  });

  // 9. Form Builder & Détection de la Liste Noire Médicale
  await t.test('M1-09 : Form Builder, 6 types de champs et blocage absolu du vocabulaire médical', async () => {
    // 1. Tentative d'ajout d'un champ avec mot-clé médical (ex: "groupe_sanguin" ou "maladie")
    const resMedical = await app.inject({
      method: 'POST',
      url: '/api/config/champs',
      headers: { Authorization: `Bearer ${jetonAdminFonc}` },
      payload: {
        entite_cible: 'AGENT',
        code_champ: 'diagnostic_medical_agent',
        libelle: 'Diagnostic médical d\'aptitude',
        type_donnee: 'TEXTE'
      }
    });

    assert.strictEqual(resMedical.statusCode, 400);
    const corpsMed = JSON.parse(resMedical.payload);
    assert.strictEqual(corpsMed.code_erreur, 'INTERDICTION_DONNEE_MEDICALE');
    assert.match(corpsMed.message, /terme médical proscrit/i);

    // Tentative d'ajout avec "medicament"
    const resMedicament = await app.inject({
      method: 'POST',
      url: '/api/config/champs',
      headers: { Authorization: `Bearer ${jetonAdminFonc}` },
      payload: {
        entite_cible: 'AGENT',
        code_champ: 'prise_de_medicament',
        libelle: 'Prise régulière de médicament',
        type_donnee: 'TEXTE'
      }
    });

    assert.strictEqual(resMedicament.statusCode, 400);
    const corpsMed2 = JSON.parse(resMedicament.payload);
    assert.strictEqual(corpsMed2.code_erreur, 'INTERDICTION_DONNEE_MEDICALE');

    // 2. Ajout réussi d'un champ légitime de type 6 (Fichier / Pièce jointe)
    codeChampValide = `permis_conduire_special_${Date.now().toString().slice(-4)}`;
    const resAjout = await app.inject({
      method: 'POST',
      url: '/api/config/champs',
      headers: { Authorization: `Bearer ${jetonAdminFonc}` },
      payload: {
        entite_cible: 'AGENT',
        code_champ: codeChampValide,
        libelle: 'Permis de conduire spécialisé véhicules blindés',
        type_donnee: 'PIECE_JOINTE',
        est_obligatoire: false,
        ordre_affichage: 20
      }
    });

    assert.strictEqual(resAjout.statusCode, 201);
    const corpsAjout = JSON.parse(resAjout.payload);
    assert.strictEqual(corpsAjout.statut, 'SUCCES');
    assert.strictEqual(corpsAjout.champ.code_champ, codeChampValide);
  });

  // 10. Versioning de Configuration RH et Rollback Garanti Sans Perte
  await t.test('M1-10 : Publication de version de configuration et rollback sans perte de données', async () => {
    // 1. Publication d'une nouvelle version v2
    const resPublier = await app.inject({
      method: 'POST',
      url: '/api/config/versions/publier',
      headers: { Authorization: `Bearer ${jetonAdminFonc}` },
      payload: {
        commentaire: 'Publication de la version de test pour validation du rollback M1'
      }
    });

    assert.strictEqual(resPublier.statusCode, 201);
    const versionPubliee = JSON.parse(resPublier.payload).version;
    assert.ok(versionPubliee.numero_version);

    // 2. Déclenchement du Rollback vers v1.0.0 avec motif obligatoire
    const resRollback = await app.inject({
      method: 'POST',
      url: '/api/config/versions/rollback',
      headers: { Authorization: `Bearer ${jetonAdminFonc}` },
      payload: {
        version_cible: 'v1.0.0',
        motif_justificatif: 'Retour arrière ordonné suite à validation de recette technique M1'
      }
    });

    assert.strictEqual(resRollback.statusCode, 200);
    const corpsRollback = JSON.parse(resRollback.payload);
    assert.strictEqual(corpsRollback.statut, 'SUCCES');
    assert.match(corpsRollback.message, /sans perte de données existantes/i);

    // 3. Vérification que le champ non présent dans v1.0.0 a bien est_actif === false après rollback
    const verifChampDb = await pool.query(
      'SELECT code_champ, est_actif FROM champs_personnalises WHERE code_champ = $1',
      [codeChampValide]
    );
    assert.strictEqual(verifChampDb.rows.length, 1, 'Le champ doit exister dans la table champs_personnalises');
    assert.strictEqual(
      verifChampDb.rows[0].est_actif,
      false,
      'Le champ absent de v1.0.0 doit être désactivé (est_actif === false) après le rollback'
    );
  });

  // 11. Vérification Cryptographique de la Chaîne d'Audit SHA-256
  await t.test('M1-11 : Vérification d\'intégrité cryptographique absolue de la chaîne d\'audit SHA-256', async () => {
    const resAudit = await app.inject({
      method: 'GET',
      url: '/api/audit/verifier-chaine',
      headers: { Authorization: `Bearer ${jetonAdminTech}` }
    });

    assert.strictEqual(resAudit.statusCode, 200);
    const corpsAudit = JSON.parse(resAudit.payload);
    assert.strictEqual(corpsAudit.statut, 'SUCCES');
    assert.strictEqual(corpsAudit.intégrité_conforme, true, 'La chaîne cryptographique doit être 100% intègre et conforme');
    assert.ok(corpsAudit.nombre_entrees >= 10, 'Toutes les opérations d\'authentification, création et mutation doivent être enregistrées');
    assert.strictEqual(corpsAudit.anomalies.length, 0, 'Aucune anomalie ni rupture de chaîne tolérée');
  });
});
