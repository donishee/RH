import * as crypto from 'node:crypto';
import { pool } from '../../database';
import { auditService } from '../audit/audit.service';
import { SessionUtilisateur } from '../../types/session';

export class HttpError extends Error {
  statusCode: number;
  code: number;
  code_erreur: string;

  constructor(statusCode: number, message: string, codeErreur: string = 'ERREUR') {
    super(message);
    this.name = 'HttpError';
    this.statusCode = statusCode;
    this.code = statusCode;
    this.code_erreur = codeErreur;
  }
}

export interface TypeConge {
  id: string;
  code: string;
  libelle: string;
  description: string | null;
  quota_annuel_jours: number;
  report_autorise: boolean;
  plafond_report_jours: number;
  justificatif_obligatoire: boolean;
  deductible_solde: boolean;
  est_actif: boolean;
  cree_le: string;
}

export interface SoldeConge {
  id: string;
  agent_id: string;
  type_conge_id: string;
  type_conge_code?: string;
  type_conge_libelle?: string;
  annee: number;
  jours_acquis: number;
  jours_reportes: number;
  jours_pris: number;
  jours_en_attente: number;
  jours_restants: number;
  cree_le: string;
  modifie_le: string;
}

export interface DemandeConge {
  id: string;
  agent_id: string;
  matricule?: string;
  nom_agent?: string;
  prenom_agent?: string;
  grade_agent?: string;
  unite_nom?: string;
  type_conge_id: string;
  type_conge_code?: string;
  type_conge_libelle?: string;
  date_debut: string;
  date_fin: string;
  nombre_jours: number;
  motif: string;
  statut: string;
  decision_chef_service: string | null;
  motif_refus_chef: string | null;
  date_decision_chef: string | null;
  chef_service_id: string | null;
  decision_rh: string | null;
  motif_refus_rh: string | null;
  date_decision_rh: string | null;
  gestionnaire_rh_id: string | null;
  version_optimiste: number;
  version_concurrence: number;
  motif_annulation: string | null;
  cree_le: string;
  modifie_le: string;
}

export class CongesService {
  /**
   * Retourne la liste des types de congés actifs
   */
  async listerTypes(): Promise<TypeConge[]> {
    const res = await pool.query(`
      SELECT id, code, libelle, description, quota_annuel_jours, report_autorise,
             plafond_report_jours, justificatif_obligatoire, deductible_solde, est_actif, cree_le
      FROM types_conges
      WHERE est_actif = TRUE
      ORDER BY code ASC
    `);

    return res.rows.map(r => ({
      ...r,
      quota_annuel_jours: Number(r.quota_annuel_jours),
      plafond_report_jours: Number(r.plafond_report_jours)
    }));
  }

  /**
   * Obtient ou initialise le solde d'un agent pour une année donnée
   */
  async obtenirSoldeAgent(agentId: string, annee: number = 2026): Promise<SoldeConge> {
    const res = await pool.query(`
      SELECT s.id, s.agent_id, s.type_conge_id, s.annee,
             s.jours_acquis, s.jours_reportes, s.jours_pris, s.jours_en_attente, s.jours_restants,
             s.cree_le, s.modifie_le,
             tc.code AS type_conge_code, tc.libelle AS type_conge_libelle
      FROM soldes_conges s
      JOIN types_conges tc ON s.type_conge_id = tc.id
      WHERE s.agent_id = $1 AND s.annee = $2
      ORDER BY s.cree_le ASC
      LIMIT 1
    `, [agentId, annee]);

    if (res.rows.length > 0) {
      const r = res.rows[0];
      return {
        id: r.id,
        agent_id: r.agent_id,
        type_conge_id: r.type_conge_id,
        type_conge_code: r.type_conge_code,
        type_conge_libelle: r.type_conge_libelle,
        annee: Number(r.annee),
        jours_acquis: Number(r.jours_acquis),
        jours_reportes: Number(r.jours_reportes),
        jours_pris: Number(r.jours_pris),
        jours_en_attente: Number(r.jours_en_attente),
        jours_restants: Number(r.jours_restants),
        cree_le: r.cree_le,
        modifie_le: r.modifie_le
      };
    }

    // Auto-initialisation pour l'année courante si inexistant
    const nouveauId = `solde-${crypto.randomUUID().slice(0, 8)}`;
    const resInit = await pool.query(`
      INSERT INTO soldes_conges (id, agent_id, type_conge_id, annee, jours_acquis, jours_reportes, jours_pris, jours_en_attente)
      VALUES ($1, $2, 'tc-annuel', $3, 30.0, 0.0, 0.0, 0.0)
      ON CONFLICT (agent_id, type_conge_id, annee) DO UPDATE SET modifie_le = CURRENT_TIMESTAMP
      RETURNING *
    `, [nouveauId, agentId, annee]);

    const rInit = resInit.rows[0];
    return {
      id: rInit.id,
      agent_id: rInit.agent_id,
      type_conge_id: rInit.type_conge_id,
      type_conge_code: 'ANNUEL',
      type_conge_libelle: 'Congé annuel ordinaire',
      annee: Number(rInit.annee),
      jours_acquis: Number(rInit.jours_acquis),
      jours_reportes: Number(rInit.jours_reportes),
      jours_pris: Number(rInit.jours_pris),
      jours_en_attente: Number(rInit.jours_en_attente),
      jours_restants: Number(rInit.jours_restants),
      cree_le: rInit.cree_le,
      modifie_le: rInit.modifie_le
    };
  }

  /**
   * Liste les demandes de congés selon les filtres et les habilitations ABAC
   */
  async listerDemandes(filtres: {
    agent_id?: string;
    statut?: string;
    limite?: number;
    offset?: number;
    session: SessionUtilisateur;
  }): Promise<{ total: number; demandes: DemandeConge[] }> {
    const { session, agent_id, statut, limite = 50, offset = 0 } = filtres;

    const conditions: string[] = [];
    const params: any[] = [];
    let pIdx = 1;

    // Règle 1 : L'Administrateur Technique n'a aucun accès aux données nominatives
    if (session.role === 'ADMIN_TECHNIQUE') {
      throw new HttpError(403, "Accès interdit : Les administrateurs techniques ne disposent d'aucun droit d'accès aux dossiers nominatifs RH.", "ACCES_INTERDIT");
    }

    // Règle 2 : L'Agent ne consulte que ses propres demandes
    if (session.role === 'AGENT') {
      const monId = session.agent_id || 'agt-001';
      conditions.push(`d.agent_id = $${pIdx++}`);
      params.push(monId);
    } else if (session.role === 'CHEF_DE_SERVICE') {
      // Règle 3 : Le Chef de service consulte les demandes des agents de son unité + ses propres demandes
      const unitesAutorisees = session.unites_autorisees || [];
      if (agent_id) {
        conditions.push(`d.agent_id = $${pIdx++}`);
        params.push(agent_id);
      } else {
        conditions.push(`(a.unite_actuelle_id = ANY($${pIdx++}) OR d.agent_id = $${pIdx++})`);
        params.push(unitesAutorisees, session.agent_id || '');
      }
    } else if (session.role === 'GESTIONNAIRE_RH' || session.role === 'AUDITEUR') {
      // Règle 4 : Gestionnaire RH et Auditeur ont une visibilité nationale intégrale
      if (agent_id) {
        conditions.push(`d.agent_id = $${pIdx++}`);
        params.push(agent_id);
      }
    }

    if (statut) {
      conditions.push(`d.statut = $${pIdx++}`);
      params.push(statut);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countRes = await pool.query(`
      SELECT COUNT(*) AS total
      FROM demandes_conges d
      JOIN agents a ON d.agent_id = a.id
      ${whereClause}
    `, params);

    const total = parseInt(countRes.rows[0].total, 10);

    const sql = `
      SELECT d.id, d.agent_id, d.type_conge_id, d.date_debut, d.date_fin,
             d.nombre_jours, d.motif, d.statut, d.decision_chef_service, d.motif_refus_chef,
             d.date_decision_chef, d.chef_service_id, d.decision_rh, d.motif_refus_rh,
             d.date_decision_rh, d.gestionnaire_rh_id, d.version_optimiste, d.motif_annulation,
             d.cree_le, d.modifie_le,
             a.matricule, a.nom AS nom_agent, a.prenom AS prenom_agent, a.grade_actuel AS grade_agent,
             u.nom AS unite_nom,
             tc.code AS type_conge_code, tc.libelle AS type_conge_libelle
      FROM demandes_conges d
      JOIN agents a ON d.agent_id = a.id
      LEFT JOIN unites u ON a.unite_actuelle_id = u.id
      JOIN types_conges tc ON d.type_conge_id = tc.id
      ${whereClause}
      ORDER BY d.cree_le DESC
      LIMIT $${pIdx++} OFFSET $${pIdx++}
    `;

    params.push(limite, offset);
    const listRes = await pool.query(sql, params);

    const demandes: DemandeConge[] = listRes.rows.map(r => ({
      id: r.id,
      agent_id: r.agent_id,
      matricule: r.matricule,
      nom_agent: r.nom_agent,
      prenom_agent: r.prenom_agent,
      grade_agent: r.grade_agent,
      unite_nom: r.unite_nom,
      type_conge_id: r.type_conge_id,
      type_conge_code: r.type_conge_code,
      type_conge_libelle: r.type_conge_libelle,
      date_debut: typeof r.date_debut === 'string' ? r.date_debut : r.date_debut.toISOString().slice(0, 10),
      date_fin: typeof r.date_fin === 'string' ? r.date_fin : r.date_fin.toISOString().slice(0, 10),
      nombre_jours: Number(r.nombre_jours),
      motif: r.motif,
      statut: r.statut,
      decision_chef_service: r.decision_chef_service,
      motif_refus_chef: r.motif_refus_chef,
      date_decision_chef: r.date_decision_chef,
      chef_service_id: r.chef_service_id,
      decision_rh: r.decision_rh,
      motif_refus_rh: r.motif_refus_rh,
      date_decision_rh: r.date_decision_rh,
      gestionnaire_rh_id: r.gestionnaire_rh_id,
      version_optimiste: Number(r.version_optimiste),
      version_concurrence: Number(r.version_optimiste),
      motif_annulation: r.motif_annulation,
      cree_le: r.cree_le,
      modifie_le: r.modifie_le
    }));

    return { total, demandes };
  }

  /**
   * Soumission d'une nouvelle demande avec contrôle de solde et de chevauchement
   */
  async soumettreDemande(params: {
    agent_id?: string;
    type_conge_id: string;
    date_debut: string;
    date_fin: string;
    nombre_jours?: number;
    motif?: string;
  }, session: SessionUtilisateur, clientIp: string): Promise<{ demande: DemandeConge; solde: SoldeConge }> {
    // 1. Détermination de l'agent demandeur
    let targetAgentId = session.agent_id;
    if (session.role === 'GESTIONNAIRE_RH' || session.role === 'CHEF_DE_SERVICE') {
      if (params.agent_id) {
        targetAgentId = params.agent_id;
      }
    }
    if (!targetAgentId) {
      targetAgentId = 'agt-001';
    }

    // Contrôle territorial ABAC : un Chef de service ne peut soumettre que pour un agent de son unité
    if (session.role === 'CHEF_DE_SERVICE' && params.agent_id && params.agent_id !== session.agent_id) {
      const agentRes = await pool.query('SELECT unite_actuelle_id FROM agents WHERE id = $1', [targetAgentId]);
      const agentUnite = agentRes.rows[0]?.unite_actuelle_id;
      const unitesAutorisees = session.unites_autorisees || [];
      if (!agentUnite || !unitesAutorisees.includes(agentUnite)) {
        throw new HttpError(
          403,
          `Accès interdit : Vous ne pouvez formuler de demande de congé que pour les agents de votre unité (${agentUnite || 'inconnue'}).`,
          "ACCES_INTERDIT"
        );
      }
    }

    const { type_conge_id, date_debut, date_fin, motif = '' } = params;

    // 2. Vérification de la chronologie des dates
    if (!date_debut || !date_fin) {
      throw new HttpError(400, "Les dates de début et de fin sont obligatoires.", "DATES_MANQUANTES");
    }

    const dDebut = new Date(date_debut);
    const dFin = new Date(date_fin);

    if (isNaN(dDebut.getTime()) || isNaN(dFin.getTime())) {
      throw new HttpError(400, "Format de date invalide (AAAA-MM-JJ attendu).", "DATE_INVALIDE");
    }

    if (dFin < dDebut) {
      throw new HttpError(400, "Incohérence des dates : la date de fin ne peut pas être antérieure à la date de début.", "DATES_INCOHERENTES");
    }

    // 3. Détermination du nombre de jours avec typage strict
    let nbJours = params.nombre_jours;
    if (nbJours === undefined || nbJours === null) {
      // Calcul automatique indicatif : nombre de jours calendaires inclus
      const diffMs = dFin.getTime() - dDebut.getTime();
      nbJours = Math.round(diffMs / (1000 * 60 * 60 * 24)) + 1;
    }

    if (typeof nbJours !== 'number' || Number.isNaN(nbJours) || nbJours <= 0) {
      throw new HttpError(400, "Le nombre de jours de congé demandé doit être strictement positif.", "DUREE_INVALIDE");
    }

    // 4. Résolution du type de congé
    const typeRes = await pool.query(`
      SELECT * FROM types_conges 
      WHERE (id = $1 OR code = $1 OR (code = 'ANNUEL' AND $1 = 'CONGE_ANNUEL'))
      AND est_actif = TRUE
      LIMIT 1
    `, [type_conge_id]);

    if (typeRes.rows.length === 0) {
      throw new HttpError(400, "Type de congé introuvable ou inactif.", "TYPE_CONGE_INVALIDE");
    }
    const typeConge = typeRes.rows[0];

    // 5. Transaction SQL ACID : Verrouillage, détection atomique de chevauchement et décompte de solde
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Verrouillage pessimiste de l'agent pour éliminer toute fenêtre TOCTOU sur les soumissions concurrentes
      await client.query('SELECT id FROM agents WHERE id = $1 FOR UPDATE', [targetAgentId]);

      // Détection de chevauchement de dates sous transaction atomique
      const chevauchementRes = await client.query(`
        SELECT id, date_debut, date_fin, statut
        FROM demandes_conges
        WHERE agent_id = $1
          AND statut NOT IN ('ANNULE', 'REFUSE')
          AND date_debut <= $3
          AND date_fin >= $2
        LIMIT 1
      `, [targetAgentId, date_debut, date_fin]);

      if (chevauchementRes.rows.length > 0) {
        throw new HttpError(400, "Chevauchement de dates détecté : Un congé existe déjà pour cet agent sur la période demandée.", "CHEVAUCHEMENT_CONGE");
      }

      const annee = dDebut.getFullYear();
      let soldeMaj: any;

      if (typeConge.deductible_solde) {
        // Verrou pessimiste sur le solde
        let soldeRes = await client.query(`
          SELECT * FROM soldes_conges
          WHERE agent_id = $1 AND type_conge_id = $2 AND annee = $3
          FOR UPDATE
        `, [targetAgentId, typeConge.id, annee]);

        if (soldeRes.rows.length === 0) {
          // Création initiale avec 30 jours
          const nId = `solde-${crypto.randomUUID().slice(0, 8)}`;
          await client.query(`
            INSERT INTO soldes_conges (id, agent_id, type_conge_id, annee, jours_acquis, jours_reportes, jours_pris, jours_en_attente)
            VALUES ($1, $2, $3, $4, 30.0, 0.0, 0.0, 0.0)
          `, [nId, targetAgentId, typeConge.id, annee]);

          soldeRes = await client.query(`
            SELECT * FROM soldes_conges WHERE id = $1 FOR UPDATE
          `, [nId]);
        }

        const soldeCourant = soldeRes.rows[0];
        const restants = Number(soldeCourant.jours_restants);

        if (nbJours > restants) {
          throw new HttpError(400, `Solde insuffisant : ${restants} jours disponibles, ${nbJours} demandés.`, "SOLDE_INSUFFISANT");
        }

        const updateSoldeRes = await client.query(`
          UPDATE soldes_conges
          SET jours_en_attente = jours_en_attente + $1, modifie_le = CURRENT_TIMESTAMP
          WHERE id = $2
          RETURNING *
        `, [nbJours, soldeCourant.id]);

        soldeMaj = updateSoldeRes.rows[0];
      } else {
        soldeMaj = await this.obtenirSoldeAgent(targetAgentId, annee);
      }

      // Insertion de la demande
      const demandeId = crypto.randomUUID();
      const insertDemandeRes = await client.query(`
        INSERT INTO demandes_conges (
          id, agent_id, type_conge_id, date_debut, date_fin, nombre_jours,
          motif, statut, version_optimiste, cree_le, modifie_le
        ) VALUES (
          $1, $2, $3, $4, $5, $6,
          $7, 'SOUMIS', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )
        RETURNING *
      `, [demandeId, targetAgentId, typeConge.id, date_debut, date_fin, nbJours, motif]);

      await client.query('COMMIT');

      // Journalisation d'audit inaltérable SHA-256
      await auditService.enregistrer({
        utilisateur_id: session.utilisateur_id,
        nom_utilisateur: session.nom_complet,
        role_utilise: session.role,
        adresse_ip: clientIp,
        action_type: 'SOUMISSION_CONGE',
        entite_cible: 'DEMANDE_CONGE',
        entite_id: demandeId,
        statut_operation: 'SUCCES',
        details_operation_json: {
          agent_id: targetAgentId,
          type_conge: typeConge.code,
          nombre_jours: nbJours,
          date_debut,
          date_fin
        }
      });

      const dIns = insertDemandeRes.rows[0];
      const demandeResult: DemandeConge = {
        id: dIns.id,
        agent_id: dIns.agent_id,
        type_conge_id: dIns.type_conge_id,
        type_conge_code: typeConge.code,
        type_conge_libelle: typeConge.libelle,
        date_debut: typeof dIns.date_debut === 'string' ? dIns.date_debut : dIns.date_debut.toISOString().slice(0, 10),
        date_fin: typeof dIns.date_fin === 'string' ? dIns.date_fin : dIns.date_fin.toISOString().slice(0, 10),
        nombre_jours: Number(dIns.nombre_jours),
        motif: dIns.motif,
        statut: dIns.statut,
        decision_chef_service: null,
        motif_refus_chef: null,
        date_decision_chef: null,
        chef_service_id: null,
        decision_rh: null,
        motif_refus_rh: null,
        date_decision_rh: null,
        gestionnaire_rh_id: null,
        version_optimiste: Number(dIns.version_optimiste),
        version_concurrence: Number(dIns.version_optimiste),
        motif_annulation: null,
        cree_le: dIns.cree_le,
        modifie_le: dIns.modifie_le
      };

      const soldeResult: SoldeConge = {
        id: soldeMaj.id,
        agent_id: soldeMaj.agent_id,
        type_conge_id: soldeMaj.type_conge_id,
        annee: Number(soldeMaj.annee),
        jours_acquis: Number(soldeMaj.jours_acquis),
        jours_reportes: Number(soldeMaj.jours_reportes),
        jours_pris: Number(soldeMaj.jours_pris),
        jours_en_attente: Number(soldeMaj.jours_en_attente),
        jours_restants: Number(soldeMaj.jours_restants),
        cree_le: soldeMaj.cree_le,
        modifie_le: soldeMaj.modifie_le
      };

      return { demande: demandeResult, solde: soldeResult };
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Instruction et visa Niveau 1 par le Chef de Service
   */
  async viserChef(
    demandeId: string,
    avis: 'FAVORABLE' | 'DEFAVORABLE',
    motifRefus: string | undefined,
    commentaire: string | undefined,
    session: SessionUtilisateur,
    clientIp: string
  ): Promise<{ demande: DemandeConge; solde: SoldeConge }> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Verrou pessimiste de la demande
      const resDemande = await client.query(`
        SELECT d.*, a.unite_actuelle_id, a.matricule, a.nom AS nom_agent, a.prenom AS prenom_agent,
               tc.code AS type_conge_code, tc.libelle AS type_conge_libelle, tc.deductible_solde
        FROM demandes_conges d
        JOIN agents a ON d.agent_id = a.id
        JOIN types_conges tc ON d.type_conge_id = tc.id
        WHERE d.id = $1
        FOR UPDATE OF d
      `, [demandeId]);

      if (resDemande.rows.length === 0) {
        throw new HttpError(404, "Demande de congé introuvable.", "DEMANDE_INTROUVABLE");
      }

      const demande = resDemande.rows[0];

      // 2. Anti-Auto-Approbation stricte
      if (session.agent_id && demande.agent_id && session.agent_id === demande.agent_id) {
        await auditService.enregistrer({
          utilisateur_id: session.utilisateur_id,
          nom_utilisateur: session.nom_complet,
          role_utilise: session.role,
          adresse_ip: clientIp,
          action_type: 'TENTATIVE_AUTO_APPROBATION_BLOQUEE',
          entite_cible: 'VALIDATION_DEMANDE',
          entite_id: demandeId,
          statut_operation: 'ECHEC_SECURITE',
          details_operation_json: {
            motif: "Tentative d'auto-approbation d'un supérieur sur sa propre demande",
            agent_demandeur: demande.agent_id
          }
        });

        throw new HttpError(
          403,
          "VIOLATION HIÉRARCHIQUE : Auto-approbation formellement interdite. En tant que chef de service, votre demande de congé doit obligatoirement être soumise à l'approbation de votre supérieur hiérarchique direct (N+2) ou transmise directement à la Direction des Ressources Humaines.",
          "AUTO_APPROBATION_INTERDITE"
        );
      }

      // 3. Périmètre ABAC territorial du chef de service
      if (session.role === 'CHEF_DE_SERVICE') {
        const unitesAutorisees = session.unites_autorisees || [];
        if (!unitesAutorisees.includes(demande.unite_actuelle_id)) {
          throw new HttpError(
            403,
            `Accès interdit : L'agent appartient à une unité hors de votre périmètre hiérarchique autorisé (${demande.unite_actuelle_id}).`,
            "ACCES_INTERDIT"
          );
        }
      }

      // 4. Contrôle d'état préalable : la demande doit être au statut SOUMIS
      if (demande.statut !== 'SOUMIS') {
        throw new HttpError(400, `Statut incompatible pour visa du chef de service : ${demande.statut}.`, "STATUT_INCOMPATIBLE");
      }

      const annee = new Date(demande.date_debut).getFullYear();
      const nbJours = Number(demande.nombre_jours);
      let soldeMaj: any;

      if (avis === 'FAVORABLE') {
        await client.query(`
          UPDATE demandes_conges
          SET statut = 'APPROUVE_CHEF_SERVICE', decision_chef_service = 'FAVORABLE', chef_service_id = $1,
              date_decision_chef = CURRENT_TIMESTAMP, version_optimiste = version_optimiste + 1, modifie_le = CURRENT_TIMESTAMP
          WHERE id = $2
        `, [session.utilisateur_id, demandeId]);

        const sRes = await client.query('SELECT * FROM soldes_conges WHERE agent_id = $1 AND type_conge_id = $2 AND annee = $3', [demande.agent_id, demande.type_conge_id, annee]);
        soldeMaj = sRes.rows[0];
      } else {
        // Refus : motif obligatoire
        if (!motifRefus || motifRefus.trim() === '') {
          throw new HttpError(400, "Motif de refus obligatoire : tout refus hiérarchique doit comporter un motif explicite.", "MOTIF_REFUS_OBLIGATOIRE");
        }

        // Restitution immédiate des jours en attente
        if (demande.deductible_solde) {
          const updateSolde = await client.query(`
            UPDATE soldes_conges
            SET jours_en_attente = jours_en_attente - $1, modifie_le = CURRENT_TIMESTAMP
            WHERE agent_id = $2 AND type_conge_id = $3 AND annee = $4
            RETURNING *
          `, [nbJours, demande.agent_id, demande.type_conge_id, annee]);
          soldeMaj = updateSolde.rows[0];
        }

        await client.query(`
          UPDATE demandes_conges
          SET statut = 'REFUSE', decision_chef_service = 'DEFAVORABLE', motif_refus_chef = $1, chef_service_id = $2,
              date_decision_chef = CURRENT_TIMESTAMP, version_optimiste = version_optimiste + 1, modifie_le = CURRENT_TIMESTAMP
          WHERE id = $3
        `, [motifRefus, session.utilisateur_id, demandeId]);
      }

      // 5. Inscription immuable dans validations_conges
      const valideurAgentId = session.agent_id || 'agt-004';
      await client.query(`
        INSERT INTO validations_conges (
          id, demande_id, etape, valideur_id, role_valideur, decision, motif_refus, commentaire, date_decision, cree_le
        ) VALUES (
          $1, $2, 'VISA_CHEF', $3, $4, $5, $6, $7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )
      `, [crypto.randomUUID(), demandeId, valideurAgentId, session.role, avis, motifRefus || null, commentaire || null]);

      await client.query('COMMIT');

      // 6. Journalisation d'audit SHA-256
      await auditService.enregistrer({
        utilisateur_id: session.utilisateur_id,
        nom_utilisateur: session.nom_complet,
        role_utilise: session.role,
        adresse_ip: clientIp,
        action_type: avis === 'FAVORABLE' ? 'VISA_CHEF_CONGE' : 'REFUS_CHEF_CONGE',
        entite_cible: 'DEMANDE_CONGE',
        entite_id: demandeId,
        statut_operation: 'SUCCES',
        details_operation_json: { avis, motif_refus: motifRefus }
      });

      const resDemandeUpdated = await pool.query('SELECT * FROM demandes_conges WHERE id = $1', [demandeId]);
      const dUp = resDemandeUpdated.rows[0];

      return {
        demande: {
          id: dUp.id,
          agent_id: dUp.agent_id,
          type_conge_id: dUp.type_conge_id,
          type_conge_code: demande.type_conge_code,
          type_conge_libelle: demande.type_conge_libelle,
          date_debut: typeof dUp.date_debut === 'string' ? dUp.date_debut : dUp.date_debut.toISOString().slice(0, 10),
          date_fin: typeof dUp.date_fin === 'string' ? dUp.date_fin : dUp.date_fin.toISOString().slice(0, 10),
          nombre_jours: Number(dUp.nombre_jours),
          motif: dUp.motif,
          statut: dUp.statut,
          decision_chef_service: dUp.decision_chef_service,
          motif_refus_chef: dUp.motif_refus_chef,
          date_decision_chef: dUp.date_decision_chef,
          chef_service_id: dUp.chef_service_id,
          decision_rh: dUp.decision_rh,
          motif_refus_rh: dUp.motif_refus_rh,
          date_decision_rh: dUp.date_decision_rh,
          gestionnaire_rh_id: dUp.gestionnaire_rh_id,
          version_optimiste: Number(dUp.version_optimiste),
          version_concurrence: Number(dUp.version_optimiste),
          motif_annulation: dUp.motif_annulation,
          cree_le: dUp.cree_le,
          modifie_le: dUp.modifie_le
        },
        solde: soldeMaj ? {
          id: soldeMaj.id,
          agent_id: soldeMaj.agent_id,
          type_conge_id: soldeMaj.type_conge_id,
          annee: Number(soldeMaj.annee),
          jours_acquis: Number(soldeMaj.jours_acquis),
          jours_reportes: Number(soldeMaj.jours_reportes),
          jours_pris: Number(soldeMaj.jours_pris),
          jours_en_attente: Number(soldeMaj.jours_en_attente),
          jours_restants: Number(soldeMaj.jours_restants),
          cree_le: soldeMaj.cree_le,
          modifie_le: soldeMaj.modifie_le
        } : await this.obtenirSoldeAgent(demande.agent_id, annee)
      };
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Décision finale Niveau 2 par la Direction des Ressources Humaines (Verrou optimiste)
   */
  async validerRH(
    demandeId: string,
    decision: 'VALIDE' | 'REFUS' | 'APPROUVE' | 'REFUSE',
    motifRefus: string | undefined,
    versionFournie: number | undefined,
    session: SessionUtilisateur,
    clientIp: string
  ): Promise<{ demande: DemandeConge; solde: SoldeConge }> {
    const estValidation = decision === 'VALIDE' || decision === 'APPROUVE';
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // 1. Verrou pessimiste de la demande
      const resDemande = await client.query(`
        SELECT d.*, tc.code AS type_conge_code, tc.libelle AS type_conge_libelle, tc.deductible_solde
        FROM demandes_conges d
        JOIN types_conges tc ON d.type_conge_id = tc.id
        WHERE d.id = $1
        FOR UPDATE OF d
      `, [demandeId]);

      if (resDemande.rows.length === 0) {
        throw new HttpError(404, "Demande de congé introuvable.", "DEMANDE_INTROUVABLE");
      }

      const demande = resDemande.rows[0];

      // 2. Anti-Auto-Approbation formelle au niveau DRH
      if (session.agent_id && demande.agent_id && session.agent_id === demande.agent_id) {
        await auditService.enregistrer({
          utilisateur_id: session.utilisateur_id,
          nom_utilisateur: session.nom_complet,
          role_utilise: session.role,
          adresse_ip: clientIp,
          action_type: 'TENTATIVE_AUTO_APPROBATION_BLOQUEE',
          entite_cible: 'VALIDATION_DEMANDE',
          entite_id: demandeId,
          statut_operation: 'ECHEC_SECURITE',
          details_operation_json: {
            motif: "Tentative d'auto-approbation d'un gestionnaire RH sur sa propre demande",
            agent_demandeur: demande.agent_id
          }
        });

        throw new HttpError(
          403,
          "Auto-approbation formellement interdite : Un gestionnaire RH ne peut valider sa propre demande de congé.",
          "AUTO_APPROBATION_INTERDITE"
        );
      }

      // 3. Contrôle anti-concurrence optimiste
      if (versionFournie !== undefined && versionFournie !== Number(demande.version_optimiste)) {
        await auditService.enregistrer({
          utilisateur_id: session.utilisateur_id,
          nom_utilisateur: session.nom_complet,
          role_utilise: session.role,
          adresse_ip: clientIp,
          action_type: 'TENTATIVE_VALIDATION_CONCURRENTE_CONFLIT',
          entite_cible: 'DEMANDE_CONGE',
          entite_id: demandeId,
          statut_operation: 'ECHEC_CONCURRENCE',
          details_operation_json: {
            version_attendue: Number(demande.version_optimiste),
            version_recue: versionFournie
          }
        });

        throw new HttpError(
          409,
          `Conflit de concurrence (HTTP 409) : La demande a déjà été modifiée par un autre gestionnaire. Version attendue : ${demande.version_optimiste}, reçue : ${versionFournie}.`,
          "CONFLIT_CONCURRENCE"
        );
      }

      if (demande.statut === 'VALIDE_RH') {
        await auditService.enregistrer({
          utilisateur_id: session.utilisateur_id,
          nom_utilisateur: session.nom_complet,
          role_utilise: session.role,
          adresse_ip: clientIp,
          action_type: 'TENTATIVE_VALIDATION_CONCURRENTE_CONFLIT',
          entite_cible: 'DEMANDE_CONGE',
          entite_id: demandeId,
          statut_operation: 'ECHEC_CONCURRENCE',
          details_operation_json: { message: "Demande déjà validée définitivement par la DRH" }
        });

        throw new HttpError(409, "Conflit de concurrence (HTTP 409) : La demande a déjà été validée.", "CONFLIT_CONCURRENCE");
      }

      // 3. Prérequis d'état : doit être APPROUVE_CHEF_SERVICE
      if (demande.statut !== 'APPROUVE_CHEF_SERVICE') {
        throw new HttpError(
          400,
          `Statut incompatible pour validation finale RH : ${demande.statut}. L'approbation préalable du chef de service est requise.`,
          "STATUT_INCOMPATIBLE"
        );
      }

      const annee = new Date(demande.date_debut).getFullYear();
      const nbJours = Number(demande.nombre_jours);
      let soldeMaj: any;

      if (estValidation) {
        // Débit définitif : jours_pris augmente, jours_en_attente diminue
        if (demande.deductible_solde) {
          const updateSolde = await client.query(`
            UPDATE soldes_conges
            SET jours_pris = jours_pris + $1, jours_en_attente = jours_en_attente - $1, modifie_le = CURRENT_TIMESTAMP
            WHERE agent_id = $2 AND type_conge_id = $3 AND annee = $4
            RETURNING *
          `, [nbJours, demande.agent_id, demande.type_conge_id, annee]);
          soldeMaj = updateSolde.rows[0];
        }

        await client.query(`
          UPDATE demandes_conges
          SET statut = 'VALIDE_RH', decision_rh = 'VALIDE', gestionnaire_rh_id = $1, date_decision_rh = CURRENT_TIMESTAMP,
              version_optimiste = version_optimiste + 1, modifie_le = CURRENT_TIMESTAMP
          WHERE id = $2
        `, [session.utilisateur_id, demandeId]);
      } else {
        if (!motifRefus || motifRefus.trim() === '') {
          throw new HttpError(400, "Motif de refus obligatoire : tout refus hiérarchique ou RH doit comporter un motif explicite.", "MOTIF_REFUS_OBLIGATOIRE");
        }

        // Restitution des jours en attente
        if (demande.deductible_solde) {
          const updateSolde = await client.query(`
            UPDATE soldes_conges
            SET jours_en_attente = jours_en_attente - $1, modifie_le = CURRENT_TIMESTAMP
            WHERE agent_id = $2 AND type_conge_id = $3 AND annee = $4
            RETURNING *
          `, [nbJours, demande.agent_id, demande.type_conge_id, annee]);
          soldeMaj = updateSolde.rows[0];
        }

        await client.query(`
          UPDATE demandes_conges
          SET statut = 'REFUSE', decision_rh = 'REFUSE', motif_refus_rh = $1, gestionnaire_rh_id = $2,
              date_decision_rh = CURRENT_TIMESTAMP, version_optimiste = version_optimiste + 1, modifie_le = CURRENT_TIMESTAMP
          WHERE id = $3
        `, [motifRefus, session.utilisateur_id, demandeId]);
      }

      // Trace dans validations_conges
      const valideurAgentId = session.agent_id || 'agt-rh-01';
      await client.query(`
        INSERT INTO validations_conges (
          id, demande_id, etape, valideur_id, role_valideur, decision, motif_refus, date_decision, cree_le
        ) VALUES (
          $1, $2, 'VALIDATION_RH', $3, $4, $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )
      `, [crypto.randomUUID(), demandeId, valideurAgentId, session.role, estValidation ? 'APPROUVE' : 'REFUSE', motifRefus || null]);

      await client.query('COMMIT');

      // Audit cryptographique chaîné SHA-256
      await auditService.enregistrer({
        utilisateur_id: session.utilisateur_id,
        nom_utilisateur: session.nom_complet,
        role_utilise: session.role,
        adresse_ip: clientIp,
        action_type: estValidation ? 'VALIDATION_RH_CONGE' : 'REFUS_RH_CONGE',
        entite_cible: 'DEMANDE_CONGE',
        entite_id: demandeId,
        statut_operation: 'SUCCES',
        details_operation_json: {
          decision: estValidation ? 'VALIDE' : 'REFUSE',
          nombre_jours: nbJours,
          motif_refus: motifRefus
        }
      });

      const resDemandeUpdated = await pool.query('SELECT * FROM demandes_conges WHERE id = $1', [demandeId]);
      const dUp = resDemandeUpdated.rows[0];

      return {
        demande: {
          id: dUp.id,
          agent_id: dUp.agent_id,
          type_conge_id: dUp.type_conge_id,
          type_conge_code: demande.type_conge_code,
          type_conge_libelle: demande.type_conge_libelle,
          date_debut: typeof dUp.date_debut === 'string' ? dUp.date_debut : dUp.date_debut.toISOString().slice(0, 10),
          date_fin: typeof dUp.date_fin === 'string' ? dUp.date_fin : dUp.date_fin.toISOString().slice(0, 10),
          nombre_jours: Number(dUp.nombre_jours),
          motif: dUp.motif,
          statut: dUp.statut,
          decision_chef_service: dUp.decision_chef_service,
          motif_refus_chef: dUp.motif_refus_chef,
          date_decision_chef: dUp.date_decision_chef,
          chef_service_id: dUp.chef_service_id,
          decision_rh: dUp.decision_rh,
          motif_refus_rh: dUp.motif_refus_rh,
          date_decision_rh: dUp.date_decision_rh,
          gestionnaire_rh_id: dUp.gestionnaire_rh_id,
          version_optimiste: Number(dUp.version_optimiste),
          version_concurrence: Number(dUp.version_optimiste),
          motif_annulation: dUp.motif_annulation,
          cree_le: dUp.cree_le,
          modifie_le: dUp.modifie_le
        },
        solde: soldeMaj ? {
          id: soldeMaj.id,
          agent_id: soldeMaj.agent_id,
          type_conge_id: soldeMaj.type_conge_id,
          annee: Number(soldeMaj.annee),
          jours_acquis: Number(soldeMaj.jours_acquis),
          jours_reportes: Number(soldeMaj.jours_reportes),
          jours_pris: Number(soldeMaj.jours_pris),
          jours_en_attente: Number(soldeMaj.jours_en_attente),
          jours_restants: Number(soldeMaj.jours_restants),
          cree_le: soldeMaj.cree_le,
          modifie_le: soldeMaj.modifie_le
        } : await this.obtenirSoldeAgent(demande.agent_id, annee)
      };
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Annulation d'une demande avec restitution atomique de solde
   */
  async annulerDemande(
    demandeId: string,
    motifAnnulation: string,
    session: SessionUtilisateur,
    clientIp: string
  ): Promise<{ demande: DemandeConge; solde: SoldeConge }> {
    if (!motifAnnulation || motifAnnulation.trim() === '') {
      throw new HttpError(400, "Le motif d'annulation est obligatoire.", "MOTIF_ANNULATION_OBLIGATOIRE");
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const resDemande = await client.query(`
        SELECT d.*, a.unite_actuelle_id, tc.code AS type_conge_code, tc.libelle AS type_conge_libelle, tc.deductible_solde
        FROM demandes_conges d
        JOIN agents a ON d.agent_id = a.id
        JOIN types_conges tc ON d.type_conge_id = tc.id
        WHERE d.id = $1
        FOR UPDATE OF d
      `, [demandeId]);

      if (resDemande.rows.length === 0) {
        throw new HttpError(404, "Demande de congé introuvable.", "DEMANDE_INTROUVABLE");
      }

      const demande = resDemande.rows[0];

      // Vérification des droits d'annulation (propre demande, Chef dans son unité, ou DRH)
      if (session.role === 'AGENT' && session.agent_id !== demande.agent_id) {
        throw new HttpError(403, "Accès interdit : Vous ne pouvez annuler que vos propres demandes de congé.", "ACCES_INTERDIT");
      }

      if (session.role === 'CHEF_DE_SERVICE') {
        const unitesAutorisees = session.unites_autorisees || [];
        const estDansPerimetre = unitesAutorisees.includes(demande.unite_actuelle_id);
        const estSaPropreDemande = session.agent_id && session.agent_id === demande.agent_id;
        if (!estDansPerimetre && !estSaPropreDemande) {
          throw new HttpError(
            403,
            "Accès interdit : Vous ne pouvez annuler que les demandes des agents de votre unité.",
            "ACCES_INTERDIT"
          );
        }
      }

      // Rejet si déjà annulé ou refusé
      if (demande.statut === 'ANNULE') {
        throw new HttpError(400, "Impossible d'annuler une demande déjà au statut ANNULE.", "DEMANDE_DEJA_ANNULEE");
      }

      if (demande.statut === 'REFUSE' || demande.statut.startsWith('REFUSE')) {
        throw new HttpError(400, "Impossible d'annuler une demande déjà au statut REFUSE.", "DEMANDE_DEJA_REFUSEE");
      }

      const nbJours = Number(demande.nombre_jours);
      const annee = new Date(demande.date_debut).getFullYear();
      let soldeMaj: any;

      if (demande.deductible_solde) {
        if (demande.statut === 'VALIDE_RH') {
          // Restitution des jours pris
          const updateSolde = await client.query(`
            UPDATE soldes_conges
            SET jours_pris = jours_pris - $1, modifie_le = CURRENT_TIMESTAMP
            WHERE agent_id = $2 AND type_conge_id = $3 AND annee = $4
            RETURNING *
          `, [nbJours, demande.agent_id, demande.type_conge_id, annee]);
          soldeMaj = updateSolde.rows[0];
        } else if (demande.statut === 'SOUMIS' || demande.statut === 'APPROUVE_CHEF_SERVICE') {
          // Restitution des jours réservés en attente
          const updateSolde = await client.query(`
            UPDATE soldes_conges
            SET jours_en_attente = jours_en_attente - $1, modifie_le = CURRENT_TIMESTAMP
            WHERE agent_id = $2 AND type_conge_id = $3 AND annee = $4
            RETURNING *
          `, [nbJours, demande.agent_id, demande.type_conge_id, annee]);
          soldeMaj = updateSolde.rows[0];
        }
      }

      await client.query(`
        UPDATE demandes_conges
        SET statut = 'ANNULE', motif_annulation = $1, version_optimiste = version_optimiste + 1, modifie_le = CURRENT_TIMESTAMP
        WHERE id = $2
      `, [motifAnnulation, demandeId]);

      await client.query('COMMIT');

      // Audit SHA-256
      await auditService.enregistrer({
        utilisateur_id: session.utilisateur_id,
        nom_utilisateur: session.nom_complet,
        role_utilise: session.role,
        adresse_ip: clientIp,
        action_type: 'ANNULATION_CONGE',
        entite_cible: 'DEMANDE_CONGE',
        entite_id: demandeId,
        statut_operation: 'SUCCES',
        details_operation_json: {
          motif_annulation: motifAnnulation,
          nombre_jours: nbJours,
          statut_precedent: demande.statut
        }
      });

      const resDemandeUpdated = await pool.query('SELECT * FROM demandes_conges WHERE id = $1', [demandeId]);
      const dUp = resDemandeUpdated.rows[0];

      return {
        demande: {
          id: dUp.id,
          agent_id: dUp.agent_id,
          type_conge_id: dUp.type_conge_id,
          type_conge_code: demande.type_conge_code,
          type_conge_libelle: demande.type_conge_libelle,
          date_debut: typeof dUp.date_debut === 'string' ? dUp.date_debut : dUp.date_debut.toISOString().slice(0, 10),
          date_fin: typeof dUp.date_fin === 'string' ? dUp.date_fin : dUp.date_fin.toISOString().slice(0, 10),
          nombre_jours: Number(dUp.nombre_jours),
          motif: dUp.motif,
          statut: dUp.statut,
          decision_chef_service: dUp.decision_chef_service,
          motif_refus_chef: dUp.motif_refus_chef,
          date_decision_chef: dUp.date_decision_chef,
          chef_service_id: dUp.chef_service_id,
          decision_rh: dUp.decision_rh,
          motif_refus_rh: dUp.motif_refus_rh,
          date_decision_rh: dUp.date_decision_rh,
          gestionnaire_rh_id: dUp.gestionnaire_rh_id,
          version_optimiste: Number(dUp.version_optimiste),
          version_concurrence: Number(dUp.version_optimiste),
          motif_annulation: dUp.motif_annulation,
          cree_le: dUp.cree_le,
          modifie_le: dUp.modifie_le
        },
        solde: soldeMaj ? {
          id: soldeMaj.id,
          agent_id: soldeMaj.agent_id,
          type_conge_id: soldeMaj.type_conge_id,
          annee: Number(soldeMaj.annee),
          jours_acquis: Number(soldeMaj.jours_acquis),
          jours_reportes: Number(soldeMaj.jours_reportes),
          jours_pris: Number(soldeMaj.jours_pris),
          jours_en_attente: Number(soldeMaj.jours_en_attente),
          jours_restants: Number(soldeMaj.jours_restants),
          cree_le: soldeMaj.cree_le,
          modifie_le: soldeMaj.modifie_le
        } : await this.obtenirSoldeAgent(demande.agent_id, annee)
      };
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Statistiques et indicateurs de présence pour les tableaux de bord
   */
  async obtenirStatistiques(session: SessionUtilisateur): Promise<any> {
    const role = session.role;
    let uniteFiltre: string[] = [];

    if (role === 'CHEF_DE_SERVICE') {
      uniteFiltre = session.unites_autorisees || [];
    }

    let agentCondition = '';
    const params: any[] = [];
    if (uniteFiltre.length > 0) {
      agentCondition = 'WHERE unite_actuelle_id = ANY($1)';
      params.push(uniteFiltre);
    }

    const totalAgentsRes = await pool.query(`SELECT COUNT(*) AS total FROM agents ${agentCondition}`, params);
    const totalAgents = parseInt(totalAgentsRes.rows[0].total, 10);

    // Agents en congé ce jour (VALIDE_RH)
    const enCongeRes = await pool.query(`
      SELECT COUNT(DISTINCT d.agent_id) AS total
      FROM demandes_conges d
      JOIN agents a ON d.agent_id = a.id
      WHERE d.statut = 'VALIDE_RH'
        AND d.date_debut <= CURRENT_DATE
        AND d.date_fin >= CURRENT_DATE
        ${uniteFiltre.length > 0 ? 'AND a.unite_actuelle_id = ANY($1)' : ''}
    `, uniteFiltre.length > 0 ? [uniteFiltre] : []);
    const enConge = parseInt(enCongeRes.rows[0].total, 10);

    // Demandes en attente
    const enAttenteChefRes = await pool.query(`
      SELECT COUNT(*) AS total
      FROM demandes_conges d
      JOIN agents a ON d.agent_id = a.id
      WHERE d.statut = 'SOUMIS'
        ${uniteFiltre.length > 0 ? 'AND a.unite_actuelle_id = ANY($1)' : ''}
    `, uniteFiltre.length > 0 ? [uniteFiltre] : []);
    const enAttenteChef = parseInt(enAttenteChefRes.rows[0].total, 10);

    const enAttenteRHRes = await pool.query(`
      SELECT COUNT(*) AS total
      FROM demandes_conges
      WHERE statut = 'APPROUVE_CHEF_SERVICE'
    `);
    const enAttenteRH = parseInt(enAttenteRHRes.rows[0].total, 10);

    const presents = Math.max(0, totalAgents - enConge);
    const tauxPresence = totalAgents > 0 ? Math.round((presents / totalAgents) * 100) : 100;

    return {
      effectif_total: totalAgents,
      presents,
      en_conge: enConge,
      taux_presence_pct: tauxPresence,
      seuil_securite_atteint: tauxPresence >= 40,
      en_attente_visa_chef: enAttenteChef,
      en_attente_validation_rh: enAttenteRH
    };
  }
}

export const congesService = new CongesService();
