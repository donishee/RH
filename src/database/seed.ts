import { pool } from './index';
import { hacherMotDePasse } from '../modules/auth/auth.crypto';
import { GENESIS_HASH, computeChainedHash } from '../modules/audit/audit.crypto';
import * as referentiel from '../../tests/fixtures/referentiel_djibouti.json';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { AGENTS_FIXTURES } = require('../../tests/fixtures/index.js');

export async function executerSeed(): Promise<void> {
  const client = await pool.connect();
  try {
    console.log("Démarrage du peuplement (seed) de la base de données SIRH Police Djiboutienne...");
    await client.query('BEGIN');

    // 1. Unités Organisationnelles (17 unités)
    const unitesList = (referentiel as any)['unités'] || [];
    for (const u of unitesList) {
      let region = 'DJIBOUTI';
      if (u.id.includes('ALI')) region = 'ALI_SABIEH';
      else if (u.id.includes('DIK')) region = 'DIKHIL';
      else if (u.id.includes('TAD')) region = 'TADJOURAH';
      else if (u.id.includes('OBO')) region = 'OBOCK';
      else if (u.id.includes('ART')) region = 'ARTA';

      await client.query(`
        INSERT INTO unites (id, code, nom, type_unite, unite_parente_id, region_administrative, est_active)
        VALUES ($1, $2, $3, $4, $5, $6, TRUE)
        ON CONFLICT (id) DO UPDATE SET
          code = EXCLUDED.code,
          nom = EXCLUDED.nom,
          type_unite = EXCLUDED.type_unite,
          unite_parente_id = EXCLUDED.unite_parente_id,
          region_administrative = EXCLUDED.region_administrative,
          est_active = TRUE
      `, [u.id, u.code, u.nom, u.type, u.parent_id, region]);
    }
    console.log(`✓ ${unitesList.length} unités organisationnelles insérées.`);

    // 2. Postes Opérationnels
    const postesInitiaux = [
      { id: 'PST-01', code_poste: 'PST-CC-01', intitule: 'Chef de brigade d\'intervention', unite_id: 'U-CC-DJIB', grade_requis: 'Sergent-Chef' },
      { id: 'PST-02', code_poste: 'PST-CC-02', intitule: 'Agent de patrouille et voie publique', unite_id: 'U-CC-DJIB', grade_requis: 'Agent de 1ère classe' },
      { id: 'PST-03', code_poste: 'PST-ALI-01', intitule: 'Chef de poste territorial Ali-Sabieh', unite_id: 'U-REG-ALI', grade_requis: 'Capitaine' },
      { id: 'PST-04', code_poste: 'PST-DSP-01', intitule: 'Officier de coordination des opérations', unite_id: 'U-DSP', grade_requis: 'Commandant' },
      { id: 'PST-05', code_poste: 'PST-CC-00', intitule: 'Chef de Commissariat Central', unite_id: 'U-CC-DJIB', grade_requis: 'Commandant' }
    ];

    for (const p of postesInitiaux) {
      await client.query(`
        INSERT INTO postes (id, code_poste, intitule, unite_id, grade_requis, effectif_requis, est_vacant)
        VALUES ($1, $2, $3, $4, $5, 1, FALSE)
        ON CONFLICT (id) DO UPDATE SET
          code_poste = EXCLUDED.code_poste,
          intitule = EXCLUDED.intitule,
          unite_id = EXCLUDED.unite_id,
          grade_requis = EXCLUDED.grade_requis,
          est_vacant = FALSE
      `, [p.id, p.code_poste, p.intitule, p.unite_id, p.grade_requis]);
    }
    console.log(`✓ ${postesInitiaux.length} postes opérationnels insérés.`);

    // 3. Agents de Police (4 agents initiaux)
    for (const ag of AGENTS_FIXTURES) {
      const nid = `NID-${ag.date_naissance.replace(/-/g, '').slice(2)}-${ag.id.replace('agt-', '')}`;
      const uniteId = (ag.id === 'agt-004') ? 'U-CC-DJIB' : ag.unite_actuelle_id;
      await client.query(`
        INSERT INTO agents (
          id, matricule, numero_carte_nationale, nom, prenom, date_naissance, lieu_naissance,
          genre, situation_familiale, telephone_professionnel, email_professionnel,
          date_recrutement, corps, grade_actuel, echelon_actuel, indice_solde,
          unite_actuelle_id, statut_administratif, est_actif
        ) VALUES (
          $1, $2, $3, $4, $5, $6, 'Djibouti-Ville',
          $7, $8, $9, $10,
          $11, $12, $13, $14, $15,
          $16, $17, TRUE
        )
        ON CONFLICT (id) DO UPDATE SET
          matricule = EXCLUDED.matricule,
          nom = EXCLUDED.nom,
          prenom = EXCLUDED.prenom,
          grade_actuel = EXCLUDED.grade_actuel,
          echelon_actuel = EXCLUDED.echelon_actuel,
          indice_solde = EXCLUDED.indice_solde,
          unite_actuelle_id = EXCLUDED.unite_actuelle_id
      `, [
        ag.id, ag.matricule, nid, ag.nom, ag.prenom, ag.date_naissance,
        ag.genre, ag.situation_familiale, ag.telephone_professionnel, ag.email_professionnel,
        ag.date_recrutement, ag.corps, ag.grade_actuel, ag.echelon_actuel, ag.indice_actuel,
        uniteId, ag.statut_administratif
      ]);
    }
    await client.query(`
      INSERT INTO agents (
        id, matricule, numero_carte_nationale, nom, prenom, date_naissance, lieu_naissance,
        genre, situation_familiale, telephone_professionnel, email_professionnel,
        date_recrutement, corps, grade_actuel, echelon_actuel, indice_solde,
        unite_actuelle_id, statut_administratif, est_actif
      ) VALUES (
        'agt-rh-01', 'RH-001', 'NID-800101-rh01', 'Barkat', 'Yassin', '1980-01-01', 'Djibouti-Ville',
        'MASCULIN', 'MARIE', '+253 21 35 00 20', 'yassin.barkat@police.dj',
        '2010-01-15', 'OFFICIERS_SUPERIEURS', 'Commandant', 4, 900,
        'U-DRH', 'EN_ACTIVITE', TRUE
      )
      ON CONFLICT (id) DO UPDATE SET
        matricule = EXCLUDED.matricule,
        nom = EXCLUDED.nom,
        prenom = EXCLUDED.prenom,
        grade_actuel = EXCLUDED.grade_actuel,
        echelon_actuel = EXCLUDED.echelon_actuel,
        indice_solde = EXCLUDED.indice_solde,
        unite_actuelle_id = EXCLUDED.unite_actuelle_id
    `);
    console.log(`✓ ${AGENTS_FIXTURES.length + 1} agents nominatifs de police insérés.`);

    // 4. Affectations initiales immuables
    const affectationsInitiales = [
      { id: 'aff-001', agent_id: 'agt-001', unite_id: 'U-CC-DJIB', poste_id: 'PST-01', date_debut: '2020-01-15', motif: 'Affectation initiale après formation ENP', arrete: 'Arrêté n° 2020-012/DGPN' },
      { id: 'aff-002', agent_id: 'agt-002', unite_id: 'U-CC-DJIB', poste_id: 'PST-02', date_debut: '2022-03-01', motif: 'Affectation initiale commissariat', arrete: 'Arrêté n° 2022-045/DGPN' },
      { id: 'aff-003', agent_id: 'agt-003', unite_id: 'U-REG-ALI', poste_id: 'PST-03', date_debut: '2018-02-10', motif: 'Affectation territoriale Ali-Sabieh', arrete: 'Arrêté n° 2018-089/DGPN' },
      { id: 'aff-004', agent_id: 'agt-004', unite_id: 'U-CC-DJIB', poste_id: 'PST-05', date_debut: '2015-06-01', motif: 'Affectation initiale commissariat central', arrete: 'Arrêté n° 2015-001/DGPN' }
    ];

    for (const aff of affectationsInitiales) {
      await client.query(`
        INSERT INTO affectations (
          id, agent_id, unite_id, poste_id, type_mouvement, date_debut,
          motif_mouvement, reference_arrete_ou_decision, est_affectation_courante, cree_par
        ) VALUES (
          $1, $2, $3, $4, 'NOMINATION_INITIALE', $5,
          $6, $7, TRUE, 'usr-rh-01'
        )
        ON CONFLICT (id) DO NOTHING
      `, [aff.id, aff.agent_id, aff.unite_id, aff.poste_id, aff.date_debut, aff.motif, aff.arrete]);
    }
    console.log(`✓ ${affectationsInitiales.length} affectations initiales enregistrées.`);

    // 5. Types de Congés
    const typesConges = [
      { id: 'tc-annuel', code: 'ANNUEL', libelle: 'Congé annuel ordinaire', quota: 30, deductible: true },
      { id: 'tc-maladie', code: 'MALADIE_ORDINAIRE', libelle: 'Congé de maladie ordinaire', quota: 90, deductible: false },
      { id: 'tc-maternite', code: 'MATERNITE', libelle: 'Congé de maternité', quota: 98, deductible: false },
      { id: 'tc-paternite', code: 'PATERNITE', libelle: 'Congé de paternité', quota: 3, deductible: false },
      { id: 'tc-exceptionnel', code: 'EXCEPTIONNEL', libelle: 'Permission exceptionnelle', quota: 10, deductible: false }
    ];

    for (const tc of typesConges) {
      await client.query(`
        INSERT INTO types_conges (id, code, libelle, quota_annuel_jours, deductible_solde, est_actif)
        VALUES ($1, $2, $3, $4, $5, TRUE)
        ON CONFLICT (id) DO UPDATE SET
          code = EXCLUDED.code,
          libelle = EXCLUDED.libelle,
          quota_annuel_jours = EXCLUDED.quota_annuel_jours,
          deductible_solde = EXCLUDED.deductible_solde
      `, [tc.id, tc.code, tc.libelle, tc.quota, tc.deductible]);
    }
    console.log(`✓ ${typesConges.length} types de congés insérés.`);

    // 6. Soldes de Congés Annuels (Année 2026)
    const soldesInitiaux = [
      { id: 'solde-001', agent_id: 'agt-001', type_conge_id: 'tc-annuel', annee: 2026, acquis: 30.0, pris: 0.0, attente: 0.0 },
      { id: 'solde-002', agent_id: 'agt-002', type_conge_id: 'tc-annuel', annee: 2026, acquis: 30.0, pris: 5.0, attente: 0.0 },
      { id: 'solde-003', agent_id: 'agt-003', type_conge_id: 'tc-annuel', annee: 2026, acquis: 30.0, pris: 0.0, attente: 0.0 },
      { id: 'solde-004', agent_id: 'agt-004', type_conge_id: 'tc-annuel', annee: 2026, acquis: 30.0, pris: 10.0, attente: 0.0 },
      { id: 'solde-005', agent_id: 'agt-rh-01', type_conge_id: 'tc-annuel', annee: 2026, acquis: 30.0, pris: 0.0, attente: 0.0 }
    ];

    for (const s of soldesInitiaux) {
      await client.query(`
        INSERT INTO soldes_conges (id, agent_id, type_conge_id, annee, jours_acquis, jours_pris, jours_en_attente)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (agent_id, type_conge_id, annee) DO UPDATE SET
          jours_acquis = EXCLUDED.jours_acquis,
          jours_pris = EXCLUDED.jours_pris,
          jours_en_attente = EXCLUDED.jours_en_attente
      `, [s.id, s.agent_id, s.type_conge_id, s.annee, s.acquis, s.pris, s.attente]);
    }
    console.log(`✓ ${soldesInitiaux.length} soldes de congés insérés.`);

    // 7. Listes de Valeurs et Éléments
    const listes = [
      { id: 'lv-grades', code: 'GRADES_POLICE', libelle: 'Grades de la Police Nationale' },
      { id: 'lv-motifs-mutation', code: 'MOTIFS_MUTATION', libelle: 'Motifs de mutation et mouvement' },
      { id: 'lv-specialites', code: 'SPECIALITES_OPERATIONNELLES', libelle: 'Spécialités opérationnelles' }
    ];

    for (const l of listes) {
      await client.query(`
        INSERT INTO listes_valeurs (id, code, libelle, est_systeme)
        VALUES ($1, $2, $3, TRUE)
        ON CONFLICT (id) DO UPDATE SET code = EXCLUDED.code, libelle = EXCLUDED.libelle
      `, [l.id, l.code, l.libelle]);
    }

    const gradesDetail = (referentiel as any).grades_detail || [];
    let ordreGrade = 1;
    for (const g of gradesDetail) {
      const elemId = `el-grade-${ordreGrade}`;
      await client.query(`
        INSERT INTO elements_liste_valeurs (id, liste_valeurs_id, code_element, libelle, ordre, est_actif)
        VALUES ($1, 'lv-grades', $2, $3, $4, TRUE)
        ON CONFLICT (liste_valeurs_id, code_element) DO UPDATE SET libelle = EXCLUDED.libelle, ordre = EXCLUDED.ordre
      `, [elemId, g.nom.toUpperCase().replace(/[\s-']/g, '_'), g.nom, ordreGrade++]);
    }

    const motifsMutation = [
      { code: 'NECESSITE_SERVICE', libelle: 'Nécessité de service' },
      { code: 'DEMANDE_AGENT', libelle: 'Demande expresse de l\'agent' },
      { code: 'AVANCEMENT', libelle: 'Avancement ou promotion de grade' },
      { code: 'RESTRUCTURATION', libelle: 'Restructuration de service ou unité' },
      { code: 'DISCIPLINE', libelle: 'Mesure disciplinaire statutaire' }
    ];
    let ordreMotif = 1;
    for (const m of motifsMutation) {
      const elemId = `el-motif-${ordreMotif}`;
      await client.query(`
        INSERT INTO elements_liste_valeurs (id, liste_valeurs_id, code_element, libelle, ordre, est_actif)
        VALUES ($1, 'lv-motifs-mutation', $2, $3, $4, TRUE)
        ON CONFLICT (liste_valeurs_id, code_element) DO UPDATE SET libelle = EXCLUDED.libelle, ordre = EXCLUDED.ordre
      `, [elemId, m.code, m.libelle, ordreMotif++]);
    }
    console.log(`✓ Listes de valeurs et éléments insérés.`);

    // 8. Champs personnalisés initiaux Form Builder
    const champsInitiaux = [
      { id: 'cp-01', entite_cible: 'AGENT', code_champ: 'numero_badge_dgpn', libelle: 'Numéro de badge sécurisé DGPN', type_donnee: 'TEXTE', sous_type: 'texte_court', ordre_affichage: 1, est_obligatoire: false },
      { id: 'cp-02', entite_cible: 'AGENT', code_champ: 'pointure_chaussure', libelle: 'Pointure de rangers d\'intervention', type_donnee: 'NOMBRE', sous_type: 'entier', ordre_affichage: 2, est_obligatoire: false },
      { id: 'cp-03', entite_cible: 'AGENT', code_champ: 'permis_conduire_poids_lourd', libelle: 'Titulaire du permis poids lourd', type_donnee: 'BOOLEEN', sous_type: 'booleen', ordre_affichage: 3, est_obligatoire: false },
      { id: 'cp-04', entite_cible: 'AGENT', code_champ: 'date_derniere_dotation', libelle: 'Date de dernière dotation équipement', type_donnee: 'DATE', sous_type: 'date_simple', ordre_affichage: 4, est_obligatoire: false }
    ];

    for (const cp of champsInitiaux) {
      await client.query(`
        INSERT INTO champs_personnalises (
          id, entite_cible, code_champ, libelle, type_donnee, sous_type,
          est_obligatoire, est_actif, ordre_affichage
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE, $8)
        ON CONFLICT (entite_cible, code_champ) DO UPDATE SET
          libelle = EXCLUDED.libelle,
          type_donnee = EXCLUDED.type_donnee,
          est_obligatoire = EXCLUDED.est_obligatoire,
          ordre_affichage = EXCLUDED.ordre_affichage
      `, [cp.id, cp.entite_cible, cp.code_champ, cp.libelle, cp.type_donnee, cp.sous_type, cp.est_obligatoire, cp.ordre_affichage]);
    }
    console.log(`✓ ${champsInitiaux.length} champs personnalisés du Form Builder insérés.`);

    // 9. Version de configuration initiale (v1.0.0)
    const snapshotInitial = {
      numero_version: 'v1.0.0',
      champs_personnalises: champsInitiaux,
      listes_valeurs: {
        GRADES_POLICE: gradesDetail.map((g: any) => g.nom),
        MOTIFS_MUTATION: motifsMutation.map(m => m.libelle)
      }
    };

    await client.query('UPDATE versions_configuration_rh SET est_version_courante = FALSE WHERE est_version_courante = TRUE');

    await client.query(`
      INSERT INTO versions_configuration_rh (
        id, numero_version, statut, snapshot_configuration_json,
        commentaire_evolution, auteur_id, date_publication, est_version_courante
      ) VALUES (
        'ver-001', 'v1.0.0', 'ACTIVE', $1,
        'Configuration initiale du socle RH et formulaires Police Djiboutienne',
        'usr-fonc-01', CURRENT_TIMESTAMP, TRUE
      )
      ON CONFLICT (numero_version) DO UPDATE SET
        snapshot_configuration_json = EXCLUDED.snapshot_configuration_json,
        est_version_courante = TRUE
    `, [JSON.stringify(snapshotInitial)]);
    console.log(`✓ Version de configuration initiale v1.0.0 enregistrée.`);

    // 10. Comptes Utilisateurs pour les 6 Rôles
    const motDePasseHash = hacherMotDePasse('Police@2026!');
    const comptes = [
      { id: 'usr-tech-01', login: 'admin_tech', role: 'ADMIN_TECHNIQUE', agent_id: null },
      { id: 'usr-fonc-01', login: 'admin_fonc', role: 'ADMIN_FONCTIONNEL_RH', agent_id: null },
      { id: 'usr-rh-01', login: 'gestionnaire_rh', role: 'GESTIONNAIRE_RH', agent_id: 'agt-rh-01' },
      { id: 'usr-chef-cc', login: 'chef_cc', role: 'CHEF_DE_SERVICE', agent_id: 'agt-004' },
      { id: 'usr-chef-ali', login: 'chef_ali', role: 'CHEF_DE_SERVICE', agent_id: 'agt-003' },
      { id: 'usr-agt-01', login: 'agent_hassan', role: 'AGENT', agent_id: 'agt-001' },
      { id: 'usr-audit-01', login: 'auditeur', role: 'AUDITEUR', agent_id: null }
    ];

    for (const c of comptes) {
      await client.query(`
        INSERT INTO comptes_utilisateurs (
          id, identifiant, mot_de_passe_hash_argon2id, role, agent_id, est_actif, tentatives_echouees
        ) VALUES ($1, $2, $3, $4, $5, TRUE, 0)
        ON CONFLICT (id) DO UPDATE SET
          identifiant = EXCLUDED.identifiant,
          mot_de_passe_hash_argon2id = EXCLUDED.mot_de_passe_hash_argon2id,
          role = EXCLUDED.role,
          agent_id = EXCLUDED.agent_id,
          est_actif = TRUE,
          tentatives_echouees = 0,
          bloque_jusqu_a = NULL
      `, [c.id, c.login, motDePasseHash, c.role, c.agent_id]);
    }
    console.log(`✓ ${comptes.length} comptes utilisateurs créés pour les 6 rôles avec mot de passe scellé.`);

    // 11. Bloc Genèse du Journal d'Audit Chaîné SHA-256
    const resAudit = await client.query('SELECT COUNT(*) AS total FROM journaux_audit');
    if (parseInt(resAudit.rows[0].total, 10) === 0) {
      const detailsGenese = { initialisation: "Bloc genèse initial du journal d'audit de la Police Djiboutienne" };
      const horodatageGenese = '2026-01-01T00:00:00.000Z';
      const hashGenese = computeChainedHash({
        id: 1,
        horodatage: horodatageGenese,
        utilisateur_id: 'usr-tech-01',
        action_type: 'INITIALISATION_SYSTEME',
        entite_cible: 'SYSTEME',
        entite_id: 'GENESE',
        details_operation_json: detailsGenese,
        empreinte_precedente: GENESIS_HASH
      });

      await client.query(`
        INSERT INTO journaux_audit (
          id, horodatage, utilisateur_id, nom_utilisateur, role_utilise, adresse_ip,
          action_type, entite_cible, entite_id, details_operation_json, statut_operation,
          empreinte_precedente, empreinte_courante
        ) VALUES (
          1, $1, 'usr-tech-01', 'Administrateur Technique', 'ADMIN_TECHNIQUE', '127.0.0.1',
          'INITIALISATION_SYSTEME', 'SYSTEME', 'GENESE', $2, 'SUCCES',
          $3, $4
        )
      `, [horodatageGenese, JSON.stringify(detailsGenese), GENESIS_HASH, hashGenese]);
      console.log(`✓ Bloc genèse d'audit scellé avec empreinte SHA-256.`);
    }

    // 12. Carrières & Échelons Indiciaires Initiaux (Jalon M3)
    const echelonsInitiaux = [
      { id: 'ech-001', agent_id: 'agt-001', corps: 'SOUS_OFFICIERS', grade: 'Sergent-Chef', echelon: 3, indice_brut: 520, indice_majore: 520, date_effet: '2024-01-15', type: 'ANCIENNETE', arrete: 'ARR-2024-012/DGPN' },
      { id: 'ech-002', agent_id: 'agt-002', corps: 'AGENTS', grade: 'Agent de 1ère classe', echelon: 2, indice_brut: 320, indice_majore: 320, date_effet: '2024-03-01', type: 'ANCIENNETE', arrete: 'ARR-2024-045/DGPN' },
      { id: 'ech-003', agent_id: 'agt-003', corps: 'OFFICIERS_SUBALTERNES', grade: 'Capitaine', echelon: 4, indice_brut: 850, indice_majore: 850, date_effet: '2023-02-10', type: 'GRAND_CHOIX', arrete: 'ARR-2023-089/DGPN' },
      { id: 'ech-004', agent_id: 'agt-004', corps: 'OFFICIERS_SUPERIEURS', grade: 'Commandant', echelon: 5, indice_brut: 950, indice_majore: 950, date_effet: '2022-06-01', type: 'CHOIX', arrete: 'ARR-2022-001/DGPN' },
      { id: 'ech-005', agent_id: 'agt-rh-01', corps: 'OFFICIERS_SUPERIEURS', grade: 'Commandant', echelon: 4, indice_brut: 900, indice_majore: 900, date_effet: '2023-01-15', type: 'ANCIENNETE', arrete: 'ARR-2023-015/DGPN' }
    ];

    for (const e of echelonsInitiaux) {
      await client.query(`
        INSERT INTO carrieres_echelons (
          id, agent_id, corps, grade, echelon, indice_brut, indice_majore,
          date_effet, type_avancement, numero_arrete, est_actif, cree_par
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, TRUE, 'usr-rh-01')
        ON CONFLICT (id) DO NOTHING
      `, [e.id, e.agent_id, e.corps, e.grade, e.echelon, e.indice_brut, e.indice_majore, e.date_effet, e.type, e.arrete]);
    }
    console.log(`✓ ${echelonsInitiaux.length} échelons de carrière initiaux enregistrés.`);

    // 13. Positions Statutaires Initiales (Activité de service pour tous)
    const positionsInitiales = [
      { id: 'pos-001', agent_id: 'agt-001', date_debut: '2020-01-15', arrete: 'ARR-2020-012/DGPN' },
      { id: 'pos-002', agent_id: 'agt-002', date_debut: '2022-03-01', arrete: 'ARR-2022-045/DGPN' },
      { id: 'pos-003', agent_id: 'agt-003', date_debut: '2018-02-10', arrete: 'ARR-2018-089/DGPN' },
      { id: 'pos-004', agent_id: 'agt-004', date_debut: '2015-06-01', arrete: 'ARR-2015-001/DGPN' },
      { id: 'pos-005', agent_id: 'agt-rh-01', date_debut: '2010-01-15', arrete: 'ARR-2010-001/DGPN' }
    ];

    for (const pos of positionsInitiales) {
      await client.query(`
        INSERT INTO positions_statutaires (
          id, agent_id, position, date_debut, maintien_droits_avancement,
          reference_decision, motif, est_active, cree_par
        ) VALUES ($1, $2, 'ACTIVITE', $3, TRUE, $4, 'Activité normale de service républicain', TRUE, 'usr-rh-01')
        ON CONFLICT (id) DO NOTHING
      `, [pos.id, pos.agent_id, pos.date_debut, pos.arrete]);
    }
    console.log(`✓ ${positionsInitiales.length} positions statutaires actives initialisées.`);

    // 14. Catalogue National des Formations Policières de l'ENP
    const formationsInitiales = [
      { id: 'for-001', code: 'ENP-TIR-01', intitule: 'Tir réglementaire et maniement de l arme de service', type: 'RECYCLAGE', duree: 24, organisme: 'ECOLE_NATIONALE_POLICE', validite: 12 },
      { id: 'for-002', code: 'ENP-OPJ-01', intitule: 'Formation qualifiante d Officier de Police Judiciaire', type: 'SPECIALISATION', duree: 120, organisme: 'ECOLE_NATIONALE_POLICE', validite: 60 },
      { id: 'for-003', code: 'ENP-APJ-01', intitule: 'Formation d Agent de Police Judiciaire', type: 'INITIALE', duree: 40, organisme: 'ECOLE_NATIONALE_POLICE', validite: 60 },
      { id: 'for-004', code: 'ENP-COND-01', intitule: 'Conduite opérationnelle d urgence et véhicules rapides', type: 'CONTINUE', duree: 35, organisme: 'ECOLE_NATIONALE_POLICE', validite: 36 },
      { id: 'for-005', code: 'ENP-STOP-01', intitule: 'Secourisme tactique opérationnel de police', type: 'CONTINUE', duree: 16, organisme: 'ECOLE_NATIONALE_POLICE', validite: 24 }
    ];

    for (const f of formationsInitiales) {
      await client.query(`
        INSERT INTO formations (
          id, code_formation, intitule, type, duree_heures, organisme, est_certifiante, duree_validite_mois, est_active
        ) VALUES ($1, $2, $3, $4, $5, $6, TRUE, $7, TRUE)
        ON CONFLICT (code_formation) DO UPDATE SET
          intitule = EXCLUDED.intitule,
          duree_heures = EXCLUDED.duree_heures,
          duree_validite_mois = EXCLUDED.duree_validite_mois
      `, [f.id, f.code, f.intitule, f.type, f.duree, f.organisme, f.validite]);
    }
    console.log(`✓ ${formationsInitiales.length} formations nationales de l ENP insérées.`);

    // 15. Qualifications et Habilitations Initiales
    const qualificationsInitiales = [
      { id: 'qua-001', agent_id: 'agt-001', formation_id: 'for-002', type: 'HABILITATION_OPJ', numero: 'OPJ-DJ-2021-084', obtention: '2021-06-15', expiration: null, autorite: 'Procureur Général près la Cour d Appel de Djibouti', aptitude: 'OPJ Actif' },
      { id: 'qua-002', agent_id: 'agt-001', formation_id: 'for-001', type: 'CERTIFICAT_TIR_REGLEMENTAIRE', numero: 'TIR-2025-0142', obtention: '2025-06-01', expiration: '2026-12-31', autorite: 'École Nationale de Police', aptitude: 'Port d arme autorisé' },
      { id: 'qua-003', agent_id: 'agt-002', formation_id: 'for-003', type: 'HABILITATION_APJ', numero: 'APJ-DJ-2022-105', obtention: '2022-04-10', expiration: null, autorite: 'Direction Générale de la Police Nationale', aptitude: 'APJ Actif' },
      { id: 'qua-004', agent_id: 'agt-002', formation_id: 'for-001', type: 'CERTIFICAT_TIR_REGLEMENTAIRE', numero: 'TIR-2025-0210', obtention: '2025-05-15', expiration: '2026-05-15', autorite: 'École Nationale de Police', aptitude: 'Port d arme autorisé' },
      { id: 'qua-005', agent_id: 'agt-003', formation_id: 'for-002', type: 'HABILITATION_OPJ', numero: 'OPJ-DJ-2019-031', obtention: '2019-09-20', expiration: null, autorite: 'Procureur Général près la Cour d Appel de Djibouti', aptitude: 'OPJ Actif' },
      { id: 'qua-006', agent_id: 'agt-003', formation_id: 'for-001', type: 'CERTIFICAT_TIR_REGLEMENTAIRE', numero: 'TIR-2025-0088', obtention: '2025-04-01', expiration: '2026-04-01', autorite: 'École Nationale de Police', aptitude: 'Port d arme autorisé' },
      { id: 'qua-007', agent_id: 'agt-004', formation_id: 'for-002', type: 'HABILITATION_OPJ', numero: 'OPJ-DJ-2016-004', obtention: '2016-03-12', expiration: null, autorite: 'Procureur Général près la Cour d Appel de Djibouti', aptitude: 'OPJ Actif' },
      { id: 'qua-008', agent_id: 'agt-004', formation_id: 'for-001', type: 'CERTIFICAT_TIR_REGLEMENTAIRE', numero: 'TIR-2025-0012', obtention: '2025-02-15', expiration: '2026-12-31', autorite: 'École Nationale de Police', aptitude: 'Port d arme autorisé' }
    ];

    for (const q of qualificationsInitiales) {
      await client.query(`
        INSERT INTO qualifications_agents (
          id, agent_id, formation_id, type_qualification, numero_carte_agrement,
          date_obtention, date_expiration, autorite_delivrance, statut_actif, aptitude_operationnelle_associee
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE, $9)
        ON CONFLICT (id) DO NOTHING
      `, [q.id, q.agent_id, q.formation_id, q.type, q.numero, q.obtention, q.expiration, q.autorite, q.aptitude]);
    }
    console.log(`✓ ${qualificationsInitiales.length} qualifications et habilitations initiales insérées.`);

    // 16. Notations Annuelles Antérieures (Campagne 2025 — Zéro Donnée Médicale)
    const notationsInitiales = [
      {
        id: 'not-001',
        agent_id: 'agt-001',
        annee: 2025,
        note: 17.50,
        appreciation: 'Sous-officier exemplaire, rigoureux dans l exécution des missions de voie publique et respectueux de la déontologie républicaine.',
        rigueur: 4.50,
        competence: 4.50,
        disponibilite: 4.50,
        sens: 4.00,
        entretien: '2025-11-15',
        evaluateur: 'agt-004',
        notification: '2025-11-20',
        statut: 'VALIDE_DEFINITIF'
      },
      {
        id: 'not-002',
        agent_id: 'agt-002',
        annee: 2025,
        note: 15.50,
        appreciation: 'Bonne implication opérationnelle, assidue et disciplinée au sein de la brigade.',
        rigueur: 4.00,
        competence: 4.00,
        disponibilite: 4.00,
        sens: 3.50,
        entretien: '2025-11-16',
        evaluateur: 'agt-001',
        notification: '2025-11-22',
        statut: 'VALIDE_DEFINITIF'
      },
      {
        id: 'not-003',
        agent_id: 'agt-003',
        annee: 2025,
        note: 16.50,
        appreciation: 'Commandement rigoureux du commissariat territorial d Ali-Sabieh, sens aigu des responsabilités.',
        rigueur: 4.50,
        competence: 4.00,
        disponibilite: 4.00,
        sens: 4.00,
        entretien: '2025-11-14',
        evaluateur: 'agt-004',
        notification: '2025-11-19',
        statut: 'VALIDE_DEFINITIF'
      }
    ];

    for (const n of notationsInitiales) {
      await client.query(`
        INSERT INTO notations_annuelles (
          id, agent_id, annee, note_chiffree, appreciation_generale,
          rigueur_deontologie, competence_technique, disponibilite_operationnelle, sens_commandement_initiative,
          date_entretien, evaluateur_agent_id, date_notification, statut, note_definitive
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $4)
        ON CONFLICT (agent_id, annee) DO NOTHING
      `, [n.id, n.agent_id, n.annee, n.note, n.appreciation, n.rigueur, n.competence, n.disponibilite, n.sens, n.entretien, n.evaluateur, n.notification, n.statut]);
    }
    console.log(`✓ ${notationsInitiales.length} fiches de notation annuelle républicaine insérées.`);

    // 17. Éléments de Solde Initiaux (Janvier 2026)
    const soldeJanvier = [
      { id: 'sol-001', agent_id: 'agt-001', base: 52000.00, prime_sujetion: 15000.00, prime_risque: 10000.00, astreinte: 7000.00, nuit: 3600.00, eloignement: 0.00, retenues: 3640.00 },
      { id: 'sol-002', agent_id: 'agt-002', base: 32000.00, prime_sujetion: 10000.00, prime_risque: 10000.00, astreinte: 0.00, nuit: 1800.00, eloignement: 0.00, retenues: 2240.00 },
      { id: 'sol-003', agent_id: 'agt-003', base: 85000.00, prime_sujetion: 20000.00, prime_risque: 15000.00, astreinte: 10500.00, nuit: 0.00, eloignement: 25000.00, retenues: 5950.00 },
      { id: 'sol-004', agent_id: 'agt-004', base: 95000.00, prime_sujetion: 20000.00, prime_risque: 15000.00, astreinte: 7000.00, nuit: 0.00, eloignement: 0.00, retenues: 6650.00 }
    ];

    for (const s of soldeJanvier) {
      await client.query(`
        INSERT INTO elements_solde (
          id, agent_id, mois_annee, salaire_base_indiciaire, prime_sujetion, prime_risque,
          indemnite_astreinte, heures_nuit_dimanche, indemnite_eloignement, retenues_statutaires,
          statut, valide_par
        ) VALUES ($1, $2, '2026-01', $3, $4, $5, $6, $7, $8, $9, 'VALIDE', 'agt-rh-01')
        ON CONFLICT (agent_id, mois_annee) DO NOTHING
      `, [s.id, s.agent_id, s.base, s.prime_sujetion, s.prime_risque, s.astreinte, s.nuit, s.eloignement, s.retenues]);
    }
    console.log(`✓ ${soldeJanvier.length} bulletins de solde initiaux insérés.`);

    // 18. Postes Opérationnels de Service
    const postesOperationnelsInitiaux = [
      { id: 'pop-001', code: 'OP-CHEF-POSTE-CC', libelle: 'Chef de Poste Commissariat Central', description: 'Direction et coordination opérationnelle du poste central', niveau: 'OPJ', tir: true, permis: true, unite: 'U-CC-DJIB', effectif: 1 },
      { id: 'pop-002', code: 'OP-OPJ-QUART-CC', libelle: 'OPJ de Quart Permanent', description: 'Officier de police judiciaire de permanence et traitement des urgences', niveau: 'OPJ', tir: true, permis: false, unite: 'U-CC-DJIB', effectif: 1 },
      { id: 'pop-003', code: 'OP-PATROUILLE-ARMEE-CC', libelle: 'Chef de Patrouille Armée', description: 'Surveillance et intervention motorisée en tenue d intervention', niveau: 'APJ', tir: true, permis: true, unite: 'U-CC-DJIB', effectif: 2 },
      { id: 'pop-004', code: 'OP-GARDE-STATIQUE-CC', libelle: 'Sentinelle de Garde Statique', description: 'Garde et sécurisation des accès du commissariat', niveau: 'aucun', tir: true, permis: false, unite: 'U-CC-DJIB', effectif: 2 },
      { id: 'pop-005', code: 'OP-ACCUEIL-SEDENTAIRE-CC', libelle: 'Agent d Accueil et Secrétariat', description: 'Accueil des usagers et enregistrement des mains courantes', niveau: 'aucun', tir: false, permis: false, unite: 'U-CC-DJIB', effectif: 1 },
      { id: 'pop-006', code: 'OP-PATROUILLE-ALI', libelle: 'Patrouille Territoriale Ali-Sabieh', description: 'Surveillance territoriale du district d Ali-Sabieh', niveau: 'APJ', tir: true, permis: true, unite: 'U-REG-ALI', effectif: 2 }
    ];

    for (const pop of postesOperationnelsInitiaux) {
      await client.query(`
        INSERT INTO postes_operationnels (
          id, code, libelle, description, niveau_qualification_requis, tir_requis,
          permis_conduire_requis, unite_id, effectif_cible, est_actif
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, TRUE)
        ON CONFLICT (id) DO UPDATE SET
          code = EXCLUDED.code,
          libelle = EXCLUDED.libelle,
          niveau_qualification_requis = EXCLUDED.niveau_qualification_requis,
          tir_requis = EXCLUDED.tir_requis,
          permis_conduire_requis = EXCLUDED.permis_conduire_requis,
          effectif_cible = EXCLUDED.effectif_cible
      `, [pop.id, pop.code, pop.libelle, pop.description, pop.niveau, pop.tir, pop.permis, pop.unite, pop.effectif]);
    }
    console.log(`✓ ${postesOperationnelsInitiaux.length} postes opérationnels insérés.`);

    // 19. Plannings des Vacations Opérationnelles (24/7)
    const vacationsInitiales = [
      {
        id: 'vac-001',
        unite_id: 'U-CC-DJIB',
        agent_id: 'agt-001',
        poste_id: 'pop-003',
        type_vacation: '3x8_matin',
        date_debut: '2026-11-04T06:00:00Z',
        date_fin: '2026-11-04T14:00:00Z',
        statut: 'valide',
        cree_par: 'usr-chef-cc'
      },
      {
        id: 'vac-002',
        unite_id: 'U-CC-DJIB',
        agent_id: 'agt-002',
        poste_id: 'pop-005',
        type_vacation: '3x8_apres_midi',
        date_debut: '2026-11-04T14:00:00Z',
        date_fin: '2026-11-04T22:00:00Z',
        statut: 'valide',
        cree_par: 'usr-chef-cc'
      }
    ];

    for (const v of vacationsInitiales) {
      await client.query(`
        INSERT INTO plannings_vacations (
          id, unite_id, agent_id, poste_operationnel_id, type_vacation,
          date_debut, date_fin, statut, cree_par
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (id) DO NOTHING
      `, [v.id, v.unite_id, v.agent_id, v.poste_id, v.type_vacation, v.date_debut, v.date_fin, v.statut, v.cree_par]);
    }
    console.log(`✓ ${vacationsInitiales.length} vacations opérationnelles initiales insérées.`);

    // 20. Modèles de Documents Administratifs PDF
    const modelesPdf = [
      {
        id: 'mod-001',
        code: 'ARRETE_MUTATION',
        libelle: 'Arrêté Ministériel portant Mutation de Fonctionnaire de Police',
        gabarit: 'RÉPUBLIQUE DE DJIBOUTI\nUnité - Égalité - Paix\nMINISTÈRE DE L INTERIEUR\nDIRECTION GÉNÉRALE DE LA POLICE NATIONALE\n\nARRÊTÉ N° {{reference_arrete}}\nPortant mutation de {{nom_complet}}, matricule {{matricule}}.\n\nArticle 1er : A compter du {{date_effet}}, le fonctionnaire est muté auprès de {{unite_destination}}.\nArticle 2 : Le Directeur Général de la Police Nationale est chargé de l exécution du présent arrêté.'
      },
      {
        id: 'mod-002',
        code: 'ATTESTATION_PRESENCE',
        libelle: 'Attestation de Présence sous les Drapeaux et de Service Actif',
        gabarit: 'RÉPUBLIQUE DE DJIBOUTI\nUnité - Égalité - Paix\nDIRECTION GÉNÉRALE DE LA POLICE NATIONALE\n\nATTESTATION DE PRÉSENCE SOUS LES DRAPEAUX\n\nJe soussigné, Directeur Général de la Police Nationale, certifie que {{nom_complet}}, matricule {{matricule}}, grade {{grade}}, est en service actif au sein de la Police Nationale.'
      },
      {
        id: 'mod-003',
        code: 'FICHE_INDIVIDUELLE',
        libelle: 'Fiche Individuelle de Situation Administrative et de Carrière',
        gabarit: 'RÉPUBLIQUE DE DJIBOUTI\nUnité - Égalité - Paix\nDIRECTION DES RESSOURCES HUMAINES\n\nFICHE INDIVIDUELLE DE SITUATION ADMINISTRATIVE\n\nAgent : {{nom_complet}}\nMatricule : {{matricule}}\nGrade : {{grade}}\nÉchelon : {{echelon}}\nUnité : {{unite}}'
      },
      {
        id: 'mod-004',
        code: 'ORDRE_MISSION',
        libelle: 'Ordre de Mission et de Remplacement Opérationnel d Urgence',
        gabarit: 'RÉPUBLIQUE DE DJIBOUTI\nUnité - Égalité - Paix\nCOMMANDEMENT OPÉRATIONNEL\n\nORDRE DE MISSION N° {{reference_ordre}}\n\nIl est ordonné à {{nom_complet}}, matricule {{matricule}}, de se présenter pour prise de service immédiate en remplacement opérationnel au poste de {{poste}}.'
      },
      {
        id: 'mod-005',
        code: 'TITRE_CONGE',
        libelle: 'Titre Officiel de Congé Régulier',
        gabarit: 'RÉPUBLIQUE DE DJIBOUTI\nDIRECTION GÉNÉRALE DE LA POLICE NATIONALE\n\nTITRE DE CONGÉ N° {{reference_titre}}\n\nBénéficiaire : {{nom_complet}} ({{matricule}})\nType : {{type_conge}}\nDu {{date_debut}} au {{date_fin}}.'
      },
      {
        id: 'mod-006',
        code: 'ATTESTATION_TRAVAIL',
        libelle: 'Attestation de Travail et d Exercice Professionnel',
        gabarit: 'RÉPUBLIQUE DE DJIBOUTI\nATTESTATION D EXERCICE PROFESSIONNEL\n\nCertifie que {{nom_complet}} exerce en qualité de fonctionnaire titulaire de la Police Nationale.'
      },
      {
        id: 'mod-007',
        code: 'ARRETE_AVANCEMENT_ECHELON',
        libelle: 'Arrêté d Avancement d Échelon à l Ancienneté ou au Choix',
        gabarit: 'RÉPUBLIQUE DE DJIBOUTI\nARRÊTÉ D AVANCEMENT D ÉCHELON\n\nAgent : {{nom_complet}} ({{matricule}})\nNouvel échelon : {{nouvel_echelon}}\nIndice : {{nouvel_indice}}.'
      },
      {
        id: 'mod-008',
        code: 'TABLEAU_SERVICE_BRIGADE',
        libelle: 'Tableau Officiel de Service de Brigade et Plannings 24/7',
        gabarit: 'RÉPUBLIQUE DE DJIBOUTI\nTABLEAU DE SERVICE DE BRIGADE\n\nUnité : {{unite}}\nSemaine : {{semaine}}\nCommandant de brigade : {{commandant}}.'
      }
    ];

    for (const m of modelesPdf) {
      await client.query(`
        INSERT INTO modeles_documents_pdf (
          id, code_modele, libelle, gabarit_texte, version, est_actif
        ) VALUES ($1, $2, $3, $4, 'v1.0.0', TRUE)
        ON CONFLICT (code_modele) DO UPDATE SET
          libelle = EXCLUDED.libelle,
          gabarit_texte = EXCLUDED.gabarit_texte,
          version = EXCLUDED.version
      `, [m.id, m.code, m.libelle, m.gabarit]);
    }
    console.log(`✓ ${modelesPdf.length} modèles de documents administratifs PDF insérés.`);

    // 21. Dossiers Disciplinaires Cloisonnés & Sanctions Statutaires
    await client.query(`
      INSERT INTO dossiers_disciplinaires (
        id, agent_id, numero_dossier, phase_procedure, date_faits, description_sommaire,
        description_faits, rapport_enquete, officier_instructeur_id, statut_dossier,
        statut, niveau_confidentialite, degre_confidentialite, ouvert_par
      ) VALUES (
        'dos-disc-001', 'agt-002', 'DISC-2026-001', 'COMMISSION_DISCIPLINE', '2026-01-10',
        'Manquement au devoir de réserve lors d une intervention publique',
        'L agent a tenu des propos inappropriés lors d une patrouille de sécurisation',
        'Rapport IGPN n° 2026-04 établissant les faits et auditionnant les témoins',
        'agt-004', 'EN_COURS', 'instruction', 'TRES_SECRET', 'TRES_SECRET_DISCIPLINE', 'usr-rh-01'
      )
      ON CONFLICT (numero_dossier) DO NOTHING;
    `);
    console.log(`✓ Dossier disciplinaire type inséré sous cloisonnement DGPN.`);

    // 22. Aptitudes Administratives Souveraines (Sans Aucune Donnée Médicale)
    const aptitudesInitiales = [
      {
        id: 'apt-001',
        agent_id: 'agt-001',
        numero: 'CERT-ADM-2026-001',
        decision: 'APTE_SERVICE_ACTIF',
        conclusion: 'APTE_SANS_RESTRICTION',
        restriction_code: 'AUCUNE_RESTRICTION',
        restriction_texte: 'Apte au service actif sans restriction',
        medecin: 'MED-MIL-01',
        scelle: 'SCEL-MIL-2026-001',
        date_decision: '2026-01-15',
        date_echeance: '2027-01-15'
      },
      {
        id: 'apt-002',
        agent_id: 'agt-002',
        numero: 'CERT-ADM-2026-002',
        decision: 'AMENAGEMENT_POSTE',
        conclusion: 'APTE_AVEC_RESTRICTIONS',
        restriction_code: 'POSTE_SEDENTAIRE',
        restriction_texte: 'Affectation en brigade sedentaire de jour et exemption de patrouille motorisee',
        medecin: 'MED-MIL-02',
        scelle: 'SCEL-MIL-2026-002',
        date_decision: '2026-02-01',
        date_echeance: '2026-08-01'
      }
    ];

    for (const apt of aptitudesInitiales) {
      await client.query(`
        INSERT INTO aptitudes_administratives (
          id, agent_id, numero_certificat_administratif, decision_aptitude, type_conclusion,
          code_restriction, restriction_operationnelle, identifiant_medecin_militaire_referent,
          reference_certificat_scelle, date_decision, date_expiration, date_echeance
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $11)
        ON CONFLICT (numero_certificat_administratif) DO UPDATE SET
          decision_aptitude = EXCLUDED.decision_aptitude,
          type_conclusion = EXCLUDED.type_conclusion,
          code_restriction = EXCLUDED.code_restriction,
          restriction_operationnelle = EXCLUDED.restriction_operationnelle,
          date_echeance = EXCLUDED.date_echeance,
          date_expiration = EXCLUDED.date_expiration
      `, [
        apt.id, apt.agent_id, apt.numero, apt.decision, apt.conclusion,
        apt.restriction_code, apt.restriction_texte, apt.medecin, apt.scelle,
        apt.date_decision, apt.date_echeance
      ]);
    }
    console.log(`✓ ${aptitudesInitiales.length} décisions d aptitude administrative insérées.`);

    await client.query("SELECT setval('journaux_audit_id_seq', (SELECT COALESCE(MAX(id), 1) FROM journaux_audit));");

    await client.query('COMMIT');
    console.log("Peuplement de la base de données achevé avec succès.");
  } catch (error) {
    await client.query('ROLLBACK');
    console.error("Erreur lors du peuplement de la base de données :", error);
    throw error;
  } finally {
    client.release();
  }
}

if (require.main === module) {
  executerSeed()
    .then(async () => {
      await pool.end();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error(err);
      await pool.end();
      process.exit(1);
    });
}
