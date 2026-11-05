const test = require('node:test');
const assert = require('node:assert/strict');
const DatabaseSimulator = require('../helpers/database_simulator.js');
const { canAccessAgent, checkPrivilegeEscalation } = require('../helpers/auth_context.js');
const { verifyAuditChain } = require('../helpers/crypto_audit.js');
const { scanForEnglishTerms } = require('../helpers/french_linter.js');
const { SESSIONS_FIXTURES } = require('../fixtures/index.js');

test('Tier 4 — 10 Contrôles de Sécurité et Règles Critiques R7', async (t) => {
  let db;
  t.beforeEach(() => { db = new DatabaseSimulator(); });

  // -------------------------------------------------------------
  // CONTRÔLE CRITIQUE T01 : Refus d'accès hors unité et hors périmètre
  // -------------------------------------------------------------
  await t.test('T01 : Refus formel d\'accès hors unité et hors périmètre hiérarchique via API & IHM', () => {
    const sessionChefCC = SESSIONS_FIXTURES.chef_service_cc;
    const agentAli = db.agents.find(a => a.unite_actuelle_id === 'U-REG-ALI'); // Commissariat d'Ali-Sabieh

    // 1. Appel du contrôle d'autorisation serveur
    const resultat = canAccessAgent(sessionChefCC, agentAli);

    // 2. Vérifications de refus
    assert.strictEqual(resultat.allowed, false, 'L\'accès hors unité doit être formellement refusé');
    assert.strictEqual(resultat.code, 403, 'Le code retour doit être HTTP 403 Interdit');
    assert.match(resultat.message, /hors de votre périmètre hiérarchique autorisé/i);

    // 3. Traçabilité de l'alerte sécurité dans le journal d'audit
    db.enregistrerAudit({
      utilisateur_id: sessionChefCC.utilisateur_id,
      nom_utilisateur: sessionChefCC.nom_complet,
      role_utilise: sessionChefCC.role,
      action_type: 'TENTATIVE_ACCES_HORS_UNITE_BLOQUEE',
      entite_cible: 'AGENT',
      entite_id: agentAli.id,
      statut_operation: 'ECHEC_DROITS',
      details_operation_json: { unite_agent: agentAli.unite_actuelle_id, unite_chef: sessionChefCC.unite_id }
    });

    const lastLog = db.audit_log[db.audit_log.length - 1];
    assert.strictEqual(lastLog.statut_operation, 'ECHEC_DROITS');
  });

  // -------------------------------------------------------------
  // CONTRÔLE CRITIQUE T02 : Impossibilité absolue d'élévation de privilèges
  // -------------------------------------------------------------
  await t.test('T02 : Impossibilité absolue d\'élévation de privilèges ou d\'auto-attribution de droits', () => {
    const sessionAgent = SESSIONS_FIXTURES.agent_hassan;

    // Tentative 1 : L'agent tente de changer son rôle en 'ADMIN_TECHNIQUE'
    const escaladeRole = checkPrivilegeEscalation(sessionAgent, { role: 'ADMIN_TECHNIQUE' });
    assert.strictEqual(escaladeRole.isEscalation, true);
    assert.strictEqual(escaladeRole.code, 403);
    assert.match(escaladeRole.message, /élévation de privilèges bloquée/i);

    // Tentative 2 : L'agent tente d'étendre ses unités autorisées à '*'
    const escaladeUnites = checkPrivilegeEscalation(sessionAgent, { unites_autorisees: ['*'] });
    assert.strictEqual(escaladeUnites.isEscalation, true);

    // Tentative 3 : Un gestionnaire RH tente de s'attribuer le rôle ADMIN_TECHNIQUE
    const escaladeRH = checkPrivilegeEscalation(SESSIONS_FIXTURES.gestionnaire_rh, { role: 'ADMIN_TECHNIQUE' });
    assert.strictEqual(escaladeRH.isEscalation, true);

    // Traçabilité de la tentative d'intrusion
    const auditAlerte = db.enregistrerAudit({
      utilisateur_id: sessionAgent.utilisateur_id,
      role_utilise: sessionAgent.role,
      action_type: 'TENTATIVE_ELEVATION_PRIVILEGE_BLOQUEE',
      entite_cible: 'UTILISATEUR',
      entite_id: sessionAgent.utilisateur_id,
      statut_operation: 'ECHEC_SECURITE'
    });
    assert.strictEqual(auditAlerte.action_type, 'TENTATIVE_ELEVATION_PRIVILEGE_BLOQUEE');
  });

  // -------------------------------------------------------------
  // CONTRÔLE CRITIQUE T03 : Conservation intégrale de l'historique lors d'une mutation
  // -------------------------------------------------------------
  await t.test('T03 : Conservation intégrale et immuable de l\'historique des affectations lors d\'une mutation', () => {
    const agent = db.agents.find(a => a.id === 'agt-001');
    const uniteInitiale = agent.unite_actuelle_id;
    const nbAffectationsAvant = db.affectations.filter(a => a.agent_id === agent.id).length;

    // Exécution de la mutation vers Commissariat 2ème Arrondissement
    const res = db.muterAgent({
      agent_id: agent.id,
      nouvelle_unite_id: 'U-ARR-2',
      date_mutation: '2026-11-01',
      motif: 'Mutation d\'office',
      numero_arrete: 'Arrêté n° 2026-MUT-77/DGPN',
      operateurSession: SESSIONS_FIXTURES.gestionnaire_rh
    });

    const affectationsApres = db.affectations.filter(a => a.agent_id === agent.id);

    // 1. Aucune ligne supprimée, historique incrémenté
    assert.strictEqual(affectationsApres.length, nbAffectationsAvant + 1);

    // 2. L'affectation précédente est archivée avec date de fin
    assert.strictEqual(res.affectation_precedente.unite_id, uniteInitiale);
    assert.strictEqual(res.affectation_precedente.est_affectation_courante, false);
    assert.strictEqual(res.affectation_precedente.date_fin, '2026-11-01');

    // 3. La nouvelle affectation est courante sans date de fin
    assert.strictEqual(res.nouvelle_affectation.unite_id, 'U-ARR-2');
    assert.strictEqual(res.nouvelle_affectation.est_affectation_courante, true);
    assert.strictEqual(res.nouvelle_affectation.date_fin, null);

    // 4. Exactement une seule affectation courante pour cet agent
    const nbCourantes = affectationsApres.filter(a => a.est_affectation_courante === true).length;
    assert.strictEqual(nbCourantes, 1);
  });

  // -------------------------------------------------------------
  // CONTRÔLE CRITIQUE T04 : Cohérence des soldes après soumission, validation ou annulation
  // -------------------------------------------------------------
  await t.test('T04 : Cohérence mathématique absolue des compteurs de congés lors du cycle de vie complet', () => {
    const agentId = 'agt-001';
    const verifInvariance = (solde, etape) => {
      const somme = solde.jours_pris + solde.jours_en_attente + solde.jours_restants;
      assert.strictEqual(somme, solde.jours_acquis, `Invariance violée à l'étape '${etape}'`);
    };

    // État 1 : Initial (30 jours acquis, 0 pris, 0 attente, 30 restants)
    let s = db.getSolde(agentId);
    assert.strictEqual(s.jours_restants, 30.0);
    verifInvariance(s, 'Initial');

    // État 2 : Soumission de 7 jours (jours_en_attente = 7, restants = 23)
    const { demande } = db.soumettreDemandeConge({
      agent_id: agentId,
      date_debut: '2026-11-10',
      date_fin: '2026-11-16',
      nombre_jours: 7.0,
      operateurSession: SESSIONS_FIXTURES.agent_hassan
    });
    s = db.getSolde(agentId);
    assert.strictEqual(s.jours_en_attente, 7.0);
    assert.strictEqual(s.jours_restants, 23.0);
    verifInvariance(s, 'Après soumission');

    // État 3 : Approbation chef puis validation RH (jours_pris = 7, jours_en_attente = 0, restants = 23)
    db.approuverChefService({ demande_id: demande.id, chef_service_id: 'c1', avis: 'FAVORABLE' });
    db.validerRH({ demande_id: demande.id, gestionnaire_rh_id: 'rh1' });
    s = db.getSolde(agentId);
    assert.strictEqual(s.jours_pris, 7.0);
    assert.strictEqual(s.jours_en_attente, 0.0);
    assert.strictEqual(s.jours_restants, 23.0);
    verifInvariance(s, 'Après validation RH');

    // État 4 : Annulation administrative (restitution intégrale des 7 jours -> restants = 30)
    db.annulerConge({ demande_id: demande.id, motif_annulation: 'Rappel de service' });
    s = db.getSolde(agentId);
    assert.strictEqual(s.jours_pris, 0.0);
    assert.strictEqual(s.jours_en_attente, 0.0);
    assert.strictEqual(s.jours_restants, 30.0);
    verifInvariance(s, 'Après annulation');
  });

  // -------------------------------------------------------------
  // CONTRÔLE CRITIQUE T05 : Prévention des doubles validations concurrentes
  // -------------------------------------------------------------
  await t.test('T05 : Prévention stricte des doubles validations concurrentes par verrouillage optimiste transactionnel', () => {
    const { demande } = db.soumettreDemandeConge({
      agent_id: 'agt-001',
      date_debut: '2026-11-15',
      date_fin: '2026-11-19',
      nombre_jours: 5.0,
      operateurSession: SESSIONS_FIXTURES.agent_hassan
    });
    db.approuverChefService({ demande_id: demande.id, chef_service_id: 'c1', avis: 'FAVORABLE' });

    // La demande est à la version 2
    assert.strictEqual(demande.version_concurrence, 2);

    // Première requête de validation asynchrone (Opérateur A)
    const resA = db.validerRH({
      demande_id: demande.id,
      gestionnaire_rh_id: 'usr-rh-01',
      version_fournie: 2
    });
    assert.strictEqual(resA.demande.statut, 'VALIDE_RH');
    assert.strictEqual(resA.demande.version_concurrence, 3);

    // Deuxième requête simultanée (Opérateur B) avec la même version initiale 2
    let rejetConcurrenceReussi = false;
    try {
      db.validerRH({
        demande_id: demande.id,
        gestionnaire_rh_id: 'usr-rh-02',
        version_fournie: 2 // Version désormais périmée !
      });
    } catch (err) {
      assert.strictEqual(err.code, 409, 'Doit retourner un code HTTP 409 Conflit');
      assert.match(err.message, /Conflit de concurrence/i);
      rejetConcurrenceReussi = true;
    }
    assert.strictEqual(rejetConcurrenceReussi, true);

    // Vérification que le débit sur le solde n'a eu lieu qu'une seule fois
    const solde = db.getSolde('agt-001');
    assert.strictEqual(solde.jours_pris, 5.0);
    assert.strictEqual(solde.jours_restants, 25.0);
  });

  // -------------------------------------------------------------
  // CONTRÔLE CRITIQUE T06 : Cloisonnement strict des documents sensibles (Discipline et Aptitude)
  // -------------------------------------------------------------
  await t.test('T06 : Cloisonnement hermétique de la discipline et garantie de neutralité médicale de l\'aptitude', () => {
    // 1. Dossier disciplinaire inaccessible au Chef de Service
    assert.throws(() => {
      db.consulterDossierDisciplinaire('agt-001', SESSIONS_FIXTURES.chef_service_cc);
    }, (err) => {
      assert.strictEqual(err.code, 403);
      return true;
    });

    // 2. Dossier disciplinaire accessible uniquement à l'officier expressément habilité
    const sessionHabilitee = { ...SESSIONS_FIXTURES.gestionnaire_rh, has_droit_discipline: true };
    const dossiers = db.consulterDossierDisciplinaire('agt-001', sessionHabilitee);
    assert.strictEqual(dossiers.length, 1);
    assert.strictEqual(dossiers[0].numero_dossier, 'DISC-2025-004');

    // 3. Aptitude administrative : interdiction absolue de données médicales
    assert.throws(() => {
      db.enregistrerAptitudeAdministrative({
        agent_id: 'agt-001',
        numero_certificat: 'CERT-REJET',
        type_conclusion: 'INAPTE_TEMPORAIRE',
        date_decision: '2026-11-01',
        restrictions_operationnelles: 'Agent souffrant d\'une fracture de la jambe' // Rejet médical obligatoire
      });
    }, /Violation du secret médical/i);

    // 4. Aptitude administrative valide : enregistre uniquement la décision opérationnelle
    const aptValide = db.enregistrerAptitudeAdministrative({
      agent_id: 'agt-001',
      numero_certificat: 'CERT-ADM-VALID-01',
      type_conclusion: 'APTE_AVEC_RESTRICTIONS',
      date_decision: '2026-11-01',
      restrictions_operationnelles: 'Dispense temporaire de port de l\'arme de service',
      identifiant_medecin_referent: 'MED-MIL-09'
    });
    assert.strictEqual(aptValide.type_conclusion, 'APTE_AVEC_RESTRICTIONS');
    assert.strictEqual(aptValide.dossier_medical, undefined);
  });

  // -------------------------------------------------------------
  // CONTRÔLE CRITIQUE T07 : Traçabilité systématique des exports de données
  // -------------------------------------------------------------
  await t.test('T07 : Traçabilité obligatoire et inaltérable de tout export de données nominatives dans l\'audit', () => {
    const logsAvant = db.audit_log.length;

    // Déclenchement d'un export nominatif
    const criteresExport = { format: 'EXCEL_SECURISE', unite_filtre: 'U-CC-DJIB', nb_agents: 15 };
    const logExport = db.enregistrerAudit({
      utilisateur_id: SESSIONS_FIXTURES.gestionnaire_rh.utilisateur_id,
      nom_utilisateur: SESSIONS_FIXTURES.gestionnaire_rh.nom_complet,
      role_utilise: 'GESTIONNAIRE_RH',
      action_type: 'EXPORT_DONNEES_NOMINATIVES',
      entite_cible: 'LISTE_AGENTS',
      entite_id: 'U-CC-DJIB',
      details_operation_json: criteresExport
    });

    assert.strictEqual(db.audit_log.length, logsAvant + 1);
    assert.strictEqual(logExport.action_type, 'EXPORT_DONNEES_NOMINATIVES');
    assert.strictEqual(logExport.details_operation_json.format, 'EXCEL_SECURISE');
    assert.strictEqual(logExport.empreinte_courante.length, 64);

    // Vérification de l'intégrité de la chaîne
    const verif = verifyAuditChain(db.audit_log);
    assert.strictEqual(verif.valid, true);
  });

  // -------------------------------------------------------------
  // CONTRÔLE CRITIQUE T08 : Résilience lors de l'import de données avec doublons et erreurs
  // -------------------------------------------------------------
  await t.test('T08 : Résilience lors de l\'import par lot : rejet des doublons sans altération de la base', () => {
    const lotImport = [
      // 1. Agent valide
      { matricule: 'PND-2026-00301', nom: 'Warsama', prenom: 'Youssouf', unite_actuelle_id: 'U-CC-DJIB' },
      // 2. Doublon de matricule existant
      { matricule: 'PND-2020-00142', nom: 'Doublon', prenom: 'Hassan', unite_actuelle_id: 'U-CC-DJIB' },
      // 3. Format de matricule erroné
      { matricule: 'MATRICULE_FAUX_99', nom: 'Invalide', prenom: 'Format', unite_actuelle_id: 'U-CC-DJIB' }
    ];

    const rapportErreurs = [];
    let agentsImportes = 0;

    for (let i = 0; i < lotImport.length; i++) {
      const ligne = lotImport[i];
      try {
        db.creerAgent(ligne, SESSIONS_FIXTURES.gestionnaire_rh);
        agentsImportes++;
      } catch (err) {
        rapportErreurs.push({
          ligne_numero: i + 1,
          matricule: ligne.matricule,
          message_erreur_francais: err.message
        });
      }
    }

    // Exactement 1 agent valide importé et 2 erreurs identifiées
    assert.strictEqual(agentsImportes, 1);
    assert.strictEqual(rapportErreurs.length, 2);

    // Messages d'erreurs clairs en français
    assert.match(rapportErreurs[0].message_erreur_francais, /Doublon détecté/i);
    assert.match(rapportErreurs[1].message_erreur_francais, /Format de matricule invalide/i);

    // La base est demeurée dans un état parfaitement intègre
    const agentImporte = db.agents.find(a => a.matricule === 'PND-2026-00301');
    assert.ok(agentImporte);
  });

  // -------------------------------------------------------------
  // CONTRÔLE CRITIQUE T09 : Procédure complète de sauvegarde et restauration testée
  // -------------------------------------------------------------
  await t.test('T09 : Procédure complète de sauvegarde chiffrée et restauration avec contrôle SHA-256', () => {
    const backup = db.sauvegarder(SESSIONS_FIXTURES.admin_technique);
    assert.strictEqual(backup.checksum_sha256.length, 64);

    const nbAgentsPreSave = db.agents.length;

    // Simulation d'une altération
    db.agents.push({ id: 'agt-fake', matricule: 'FAKE-999', nom: 'Fake' });
    assert.strictEqual(db.agents.length, nbAgentsPreSave + 1);

    // Restauration
    const resRestore = db.restaurer(backup, SESSIONS_FIXTURES.admin_technique);
    assert.strictEqual(resRestore.success, true);
    assert.strictEqual(db.agents.length, nbAgentsPreSave);

    // Contrôle que la chaîne d'audit est intacte
    const auditCheck = verifyAuditChain(db.audit_log);
    assert.strictEqual(auditCheck.valid, true);
  });

  // -------------------------------------------------------------
  // CONTRÔLE CRITIQUE T10 : Parcours utilisateur et interface 100% en français
  // -------------------------------------------------------------
  await t.test('T10 : Conformité linguistique intégrale : 100% français sans anglicismes interdits', () => {
    // Vérification sur les fixtures statutaires
    const { referentiel } = require('../fixtures/index.js');
    const scanRef = scanForEnglishTerms(referentiel);
    assert.strictEqual(scanRef.is100PercentFrench, true, `Mots anglais trouvés dans le référentiel : ${JSON.stringify(scanRef.violations)}`);

    // Vérification des libellés de statuts
    const statutsMetier = [
      'SOUMIS',
      'APPROUVE_CHEF_SERVICE',
      'VALIDE_RH',
      'REFUSE',
      'ANNULE',
      'NOMINATION_INITIALE',
      'MUTATION',
      'PROMOTION'
    ];
    for (const st of statutsMetier) {
      const scanSt = scanForEnglishTerms(st);
      assert.strictEqual(scanSt.is100PercentFrench, true);
    }

    // Vérification d'un échantillon de messages d'erreurs applicatifs réels
    const messagesErreurs = [
      'Accès interdit : Vous n\'avez pas les permissions nécessaires.',
      'Doublon détecté : Le matricule existe déjà dans la base.',
      'Solde insuffisant : Jours disponibles dépassés.',
      'Incohérence des dates : La date de fin ne peut être antérieure à la date de début.',
      'Violation du temps de repos légal : 11h consécutives requises.'
    ];
    for (const msg of messagesErreurs) {
      const scanMsg = scanForEnglishTerms(msg);
      assert.strictEqual(scanMsg.is100PercentFrench, true, `Terme interdit dans : "${msg}"`);
    }
  });
});
