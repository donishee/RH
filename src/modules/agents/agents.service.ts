import * as crypto from 'node:crypto';
import { pool, transaction } from '../../database';
import { auditService } from '../audit/audit.service';
import { SessionUtilisateur } from '../../types/session';

export interface CreerAgentDto {
  matricule: string;
  numero_carte_nationale: string;
  nom: string;
  prenom: string;
  date_naissance: string;
  lieu_naissance?: string;
  genre: 'MASCULIN' | 'FEMININ';
  situation_familiale?: string;
  nombre_enfants?: number;
  telephone_professionnel?: string;
  telephone_personnel?: string;
  email_professionnel?: string;
  date_recrutement: string;
  date_titularisation?: string;
  corps: string;
  grade_actuel: string;
  echelon_actuel?: number;
  indice_solde: number;
  unite_actuelle_id: string;
  poste_id?: string;
  valeurs_champs?: Record<string, any>;
}

export class AgentsService {
  /**
   * Vérifie la validité du format de matricule national policier : PND-YYYY-XXXXX
   */
  validerFormatMatricule(matricule: string): boolean {
    const regex = /^PND-\d{4}-\d{5}$/;
    return regex.test(matricule);
  }

  /**
   * Liste les agents selon les permissions RBAC/ABAC de la session
   */
  async listerAgents(session: SessionUtilisateur, options?: {
    recherche?: string;
    corps?: string;
    grade?: string;
    unite_id?: string;
    limite?: number;
    offset?: number;
  }) {
    // Règle absolue : L'Administrateur Technique n'a aucun accès nominatif
    if (session.role === 'ADMIN_TECHNIQUE') {
      throw new Error("ACCES_INTERDIT_ADMIN_TECHNIQUE");
    }

    let queryText = `
      SELECT a.*, u.nom AS nom_unite, u.code AS code_unite
      FROM agents a
      JOIN unites u ON a.unite_actuelle_id = u.id
      WHERE a.est_actif = TRUE
    `;
    const params: any[] = [];

    // Filtrage ABAC selon le rôle
    if (session.role === 'AGENT') {
      params.push(session.agent_id || 'AUCUN');
      queryText += ` AND a.id = $${params.length}`;
    } else if (session.role === 'CHEF_DE_SERVICE') {
      const unitesAutorisees = session.unites_autorisees || [];
      params.push(unitesAutorisees);
      queryText += ` AND a.unite_actuelle_id = ANY($${params.length})`;
    }

    if (options?.recherche) {
      params.push(`%${options.recherche.toLowerCase()}%`);
      const p = `$${params.length}`;
      queryText += ` AND (LOWER(a.nom) LIKE ${p} OR LOWER(a.prenom) LIKE ${p} OR LOWER(a.matricule) LIKE ${p})`;
    }

    if (options?.corps) {
      params.push(options.corps);
      queryText += ` AND a.corps = $${params.length}`;
    }

    if (options?.grade) {
      params.push(options.grade);
      queryText += ` AND a.grade_actuel = $${params.length}`;
    }

    if (options?.unite_id) {
      params.push(options.unite_id);
      queryText += ` AND a.unite_actuelle_id = $${params.length}`;
    }

    const limite = options?.limite || 50;
    const offset = options?.offset || 0;

    const countQuery = `SELECT COUNT(*) AS total FROM (${queryText}) sub`;
    const countRes = await pool.query(countQuery, params);

    queryText += ` ORDER BY a.nom ASC, a.prenom ASC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    const dataRes = await pool.query(queryText, [...params, limite, offset]);

    return {
      total: parseInt(countRes.rows[0].total, 10),
      agents: dataRes.rows
    };
  }

  /**
   * Trouve la fiche complète d'un agent avec ses affectations et champs dynamiques
   */
  async trouverAgentParId(agentId: string) {
    const agentRes = await pool.query(`
      SELECT a.*, u.nom AS nom_unite, u.code AS code_unite, u.region_administrative
      FROM agents a
      JOIN unites u ON a.unite_actuelle_id = u.id
      WHERE a.id = $1
    `, [agentId]);

    const agent = agentRes.rows[0];
    if (!agent) return null;

    // Historique des affectations
    const affRes = await pool.query(`
      SELECT aff.*, u.nom AS nom_unite, u.code AS code_unite, p.intitule AS intitule_poste
      FROM affectations aff
      JOIN unites u ON aff.unite_id = u.id
      LEFT JOIN postes p ON aff.poste_id = p.id
      WHERE aff.agent_id = $1
      ORDER BY aff.date_debut DESC
    `, [agentId]);

    // Soldes de congés
    const soldesRes = await pool.query(`
      SELECT s.*, tc.libelle AS libelle_type_conge
      FROM soldes_conges s
      JOIN types_conges tc ON s.type_conge_id = tc.id
      WHERE s.agent_id = $1 AND s.annee = EXTRACT(YEAR FROM CURRENT_DATE)
    `, [agentId]);

    // Champs personnalisés dynamiques
    const champsRes = await pool.query(`
      SELECT cp.code_champ, cp.libelle, cp.type_donnee, vcd.valeur_texte,
             vcd.valeur_nombre, vcd.valeur_date, vcd.valeur_booleen, vcd.valeur_fichier_id
      FROM valeurs_champs_dynamiques vcd
      JOIN champs_personnalises cp ON vcd.champ_id = cp.id
      WHERE vcd.entite_id = $1 AND vcd.entite_cible = 'AGENT' AND cp.est_actif = TRUE
    `, [agentId]);

    return {
      ...agent,
      affectations: affRes.rows,
      soldes: soldesRes.rows,
      champs_dynamiques: champsRes.rows
    };
  }

  /**
   * Création atomique d'un agent avec affectation initiale et solde annuel
   */
  async creerAgent(data: CreerAgentDto, session: SessionUtilisateur) {
    // 1. Validation stricte du format de matricule
    if (!this.validerFormatMatricule(data.matricule)) {
      throw new Error(`FORMAT_MATRICULE_INVALIDE: Le matricule national policier doit respecter le format standard PND-YYYY-XXXXX (reçu: ${data.matricule}).`);
    }

    const agentId = crypto.randomUUID();

    return transaction(async (client) => {
      // 2. Insertion de la fiche agent
      const agentRes = await client.query(`
        INSERT INTO agents (
          id, matricule, numero_carte_nationale, nom, prenom, date_naissance,
          lieu_naissance, genre, situation_familiale, nombre_enfants,
          telephone_professionnel, telephone_personnel, email_professionnel,
          date_recrutement, date_titularisation, corps, grade_actuel,
          echelon_actuel, indice_solde, unite_actuelle_id, statut_administratif, est_actif
        ) VALUES (
          $1, $2, $3, $4, $5, $6,
          $7, $8, $9, $10,
          $11, $12, $13,
          $14, $15, $16, $17,
          $18, $19, $20, 'EN_ACTIVITE', TRUE
        ) RETURNING *
      `, [
        agentId, data.matricule, data.numero_carte_nationale, data.nom, data.prenom, data.date_naissance,
        data.lieu_naissance || 'Djibouti', data.genre, data.situation_familiale || 'CELIBATAIRE',
        data.nombre_enfants || 0, data.telephone_professionnel || null, data.telephone_personnel || null,
        data.email_professionnel || null, data.date_recrutement, data.date_titularisation || null,
        data.corps, data.grade_actuel, data.echelon_actuel || 1, data.indice_solde, data.unite_actuelle_id
      ]);

      const nouvelAgent = agentRes.rows[0];

      // 3. Création de l'affectation initiale immuable
      const affectationId = crypto.randomUUID();
      await client.query(`
        INSERT INTO affectations (
          id, agent_id, unite_id, poste_id, type_mouvement, date_debut,
          motif_mouvement, reference_arrete_ou_decision, est_affectation_courante, cree_par
        ) VALUES ($1, $2, $3, $4, 'NOMINATION_INITIALE', $5, $6, $7, TRUE, $8)
      `, [
        affectationId, agentId, data.unite_actuelle_id, data.poste_id || null,
        data.date_recrutement, 'Recrutement et affectation initiale',
        `Arrêté ministériel n° ${new Date().getFullYear()}-REC-${data.matricule.slice(-5)}`,
        session.utilisateur_id
      ]);

      // 4. Initialisation du solde de congé annuel (30 jours)
      const anneeCourante = new Date().getFullYear();
      await client.query(`
        INSERT INTO soldes_conges (
          id, agent_id, type_conge_id, annee, jours_acquis, jours_reportes, jours_pris, jours_en_attente
        ) VALUES ($1, $2, 'tc-annuel', $3, 30.0, 0.0, 0.0, 0.0)
      `, [crypto.randomUUID(), agentId, anneeCourante]);

      // 5. Enregistrement des champs personnalisés dynamiques si fournis
      if (data.valeurs_champs && typeof data.valeurs_champs === 'object') {
        for (const [codeChamp, valeur] of Object.entries(data.valeurs_champs)) {
          const champRes = await client.query(`
            SELECT id, type_donnee FROM champs_personnalises 
            WHERE code_champ = $1 AND entite_cible = 'AGENT' AND est_actif = TRUE
          `, [codeChamp]);

          if (champRes.rows.length > 0) {
            const champ = champRes.rows[0];
            const vcdId = crypto.randomUUID();
            let valTexte: string | null = null;
            let valNombre: number | null = null;
            let valDate: string | null = null;
            let valBooleen: boolean | null = null;

            if (champ.type_donnee === 'NOMBRE') valNombre = Number(valeur);
            else if (champ.type_donnee === 'DATE') valDate = String(valeur);
            else if (champ.type_donnee === 'BOOLEEN') valBooleen = Boolean(valeur);
            else valTexte = String(valeur);

            await client.query(`
              INSERT INTO valeurs_champs_dynamiques (
                id, entite_cible, entite_id, champ_id, valeur_texte, valeur_nombre,
                valeur_date, valeur_booleen, modifie_par
              ) VALUES ($1, 'AGENT', $2, $3, $4, $5, $6, $7, $8)
            `, [vcdId, agentId, champ.id, valTexte, valNombre, valDate, valBooleen, session.utilisateur_id]);
          }
        }
      }

      // 6. Journalisation dans l'audit chaîné SHA-256
      await auditService.enregistrer({
        utilisateur_id: session.utilisateur_id,
        nom_utilisateur: session.nom_complet,
        role_utilise: session.role,
        adresse_ip: session.adresse_ip,
        action_type: 'CREATION_AGENT',
        entite_cible: 'AGENT',
        entite_id: agentId,
        statut_operation: 'SUCCES',
        details_operation_json: {
          matricule: nouvelAgent.matricule,
          nom: nouvelAgent.nom,
          prenom: nouvelAgent.prenom,
          grade: nouvelAgent.grade_actuel,
          unite_id: nouvelAgent.unite_actuelle_id
        }
      });

      return nouvelAgent;
    });
  }

  /**
   * Met à jour les informations d'un agent
   */
  async modifierAgent(agentId: string, data: Partial<{
    situation_familiale: string;
    nombre_enfants: number;
    telephone_professionnel: string;
    telephone_personnel: string;
    email_professionnel: string;
    statut_administratif: string;
  }>, session: SessionUtilisateur) {
    const champs: string[] = [];
    const params: any[] = [agentId];

    if (data.situation_familiale !== undefined) {
      params.push(data.situation_familiale);
      champs.push(`situation_familiale = $${params.length}`);
    }
    if (data.nombre_enfants !== undefined) {
      params.push(data.nombre_enfants);
      champs.push(`nombre_enfants = $${params.length}`);
    }
    if (data.telephone_professionnel !== undefined) {
      params.push(data.telephone_professionnel);
      champs.push(`telephone_professionnel = $${params.length}`);
    }
    if (data.telephone_personnel !== undefined) {
      params.push(data.telephone_personnel);
      champs.push(`telephone_personnel = $${params.length}`);
    }
    if (data.email_professionnel !== undefined) {
      params.push(data.email_professionnel);
      champs.push(`email_professionnel = $${params.length}`);
    }
    if (data.statut_administratif !== undefined) {
      params.push(data.statut_administratif);
      champs.push(`statut_administratif = $${params.length}`);
    }

    champs.push('modifie_le = CURRENT_TIMESTAMP');

    const res = await pool.query(`
      UPDATE agents 
      SET ${champs.join(', ')} 
      WHERE id = $1 
      RETURNING *
    `, params);

    const agentMaj = res.rows[0];

    await auditService.enregistrer({
      utilisateur_id: session.utilisateur_id,
      nom_utilisateur: session.nom_complet,
      role_utilise: session.role,
      adresse_ip: session.adresse_ip,
      action_type: 'MODIFICATION_AGENT',
      entite_cible: 'AGENT',
      entite_id: agentId,
      statut_operation: 'SUCCES',
      details_operation_json: data
    });

    return agentMaj;
  }
}

export const agentsService = new AgentsService();
