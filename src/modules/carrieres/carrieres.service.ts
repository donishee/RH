import * as crypto from 'crypto';
import { pool, transaction } from '../../database';
import { auditService } from '../audit/audit.service';
import {
  CarriereEchelonDto,
  CreerAvancementEchelonDto,
  PromotionGradeDto,
  EnregistrerPromotionDto,
  AgentEligiblePromotionDto,
  PositionStatutaireDto,
  DeclarerPositionDto,
  FormationDto,
  QualificationAgentDto,
  CreerQualificationDto,
  AlertePeremptionQualificationDto,
  NotationAnnuelleDto,
  CreerNotationDto,
  DeposerRecoursNotationDto,
  ArbitrerRecoursNotationDto,
  ElementSoldeDto,
  ExportSoldeDto
} from './carrieres.types';

export class HttpError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public code_erreur: string
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export const REGEX_MEDICALE = /(?:^|[^\p{L}\p{N}])(sante|santé|medical|médical|medecin|médecin|maladie|pathologie|traitement|hopital|hôpital|clinique|diagnostic|vih|sida|diabete|diabète|psychiatrie|psy|infirmite|infirmité|ordonnance|posologie|sang|groupe[ _]sanguin|handicap|grossesse|medicament|médicament|medicaments|médicaments|glycemie|glycémie|tension|tension[ _]artérielle|tension[ _]arterielle|cancer|chirurgie|symptome|symptôme|pouls|temperature|température|consultation)(?:[^\p{L}\p{N}]|$)/iu;

const PLAFONDS_ECHELONS: Record<string, number> = {
  'Contrôleur Général de Police': 3,
  'Colonel': 5,
  'Lieutenant-Colonel': 5,
  'Commandant': 5,
  'Capitaine': 6,
  'Lieutenant': 5,
  'Sous-Lieutenant': 3,
  'Adjudant-Major': 4,
  'Adjudant-Chef': 6,
  'Adjudant': 6,
  'Sergent-Chef': 7,
  'Sergent': 7,
  'Caporal-Chef': 8,
  'Caporal': 8,
  'Agent de 1ère classe': 9,
  'Agent de 2ème classe': 7,
  'Élève Agent': 1
};

export class CarrieresService {
  /**
   * Consultation du dossier de carrière complet d'un agent
   */
  async obtenirCarriereAgent(agentId: string) {
    const resAgent = await pool.query(
      `SELECT id, matricule, nom, prenom, corps, grade_actuel, echelon_actuel, indice_solde, unite_actuelle_id, statut_administratif
       FROM agents WHERE id = $1`,
      [agentId]
    );

    if (resAgent.rows.length === 0) {
      throw new HttpError(404, `L'agent ciblé (${agentId}) est introuvable.`, 'AGENT_INTROUVABLE');
    }

    const agent = resAgent.rows[0];

    const resEchelons = await pool.query(
      `SELECT id, agent_id, corps, grade, echelon, indice_brut, indice_majore, date_effet, date_fin, type_avancement, numero_arrete, est_actif, cree_par, cree_le
       FROM carrieres_echelons WHERE agent_id = $1 ORDER BY date_effet DESC`,
      [agentId]
    );

    const resPromotions = await pool.query(
      `SELECT id, agent_id, ancien_grade, nouveau_grade, date_promotion, numero_decret, commission_date, tableau_avancement_annee, note_retenue, avis_commission, decision_autorite, cree_par, cree_le
       FROM promotions_grades WHERE agent_id = $1 ORDER BY date_promotion DESC`,
      [agentId]
    );

    const resPositions = await pool.query(
      `SELECT id, agent_id, position, organisme_accueil, date_debut, date_fin, maintien_droits_avancement, reference_decision, motif, est_active, cree_par, cree_le
       FROM positions_statutaires WHERE agent_id = $1 ORDER BY date_debut DESC`,
      [agentId]
    );

    const resQualifications = await pool.query(
      `SELECT q.id, q.agent_id, q.formation_id, q.type_qualification, q.numero_carte_agrement, q.date_obtention, q.date_expiration, q.autorite_delivrance, q.statut_actif, q.aptitude_operationnelle_associee, f.intitule as formation_intitule
       FROM qualifications_agents q
       LEFT JOIN formations f ON q.formation_id = f.id
       WHERE q.agent_id = $1 ORDER BY q.date_obtention DESC`,
      [agentId]
    );

    const resNotations = await pool.query(
      `SELECT id, agent_id, annee, note_chiffree, appreciation_generale, rigueur_deontologie, competence_technique, disponibilite_operationnelle, sens_commandement_initiative, date_entretien, date_notification, statut, note_definitive
       FROM notations_annuelles WHERE agent_id = $1 ORDER BY annee DESC`,
      [agentId]
    );

    return {
      agent,
      echelons: resEchelons.rows,
      promotions: resPromotions.rows,
      positions: resPositions.rows,
      qualifications: resQualifications.rows,
      notations: resNotations.rows,
      horodatage: new Date().toISOString()
    };
  }

  /**
   * Avancement d'échelon (ancienneté ou grand choix)
   * ACID transaction avec SELECT ... FOR UPDATE
   */
  async avancerEchelon(
    dto: CreerAvancementEchelonDto,
    operateurId: string,
    nomOperateur: string,
    roleOperateur: string,
    ip: string
  ): Promise<CarriereEchelonDto> {
    return await transaction(async (client) => {
      // 1. Verrouillage de la ligne agent
      const resAgent = await client.query(
        `SELECT id, matricule, nom, prenom, corps, grade_actuel, echelon_actuel, indice_solde, statut_administratif
         FROM agents WHERE id = $1 FOR UPDATE`,
        [dto.agent_id]
      );

      if (resAgent.rows.length === 0) {
        throw new HttpError(404, `L'agent ciblé (${dto.agent_id}) est introuvable.`, 'AGENT_INTROUVABLE');
      }

      const agent = resAgent.rows[0];

      // 2. Vérification de la position statutaire active
      const resPos = await client.query(
        `SELECT position, maintien_droits_avancement FROM positions_statutaires WHERE agent_id = $1 AND est_active = TRUE`,
        [dto.agent_id]
      );

      if (resPos.rows.length > 0) {
        const posActive = resPos.rows[0];
        if (!posActive.maintien_droits_avancement || posActive.position === 'DISPONIBILITE' || posActive.position === 'SUSPENSION_ADMINISTRATIVE') {
          throw new HttpError(
            400,
            `Avancement d'échelon impossible : L'agent est en position de ${posActive.position}, ses droits à l'avancement sont suspendus ou gelés.`,
            'POSITION_INCOMPATIBLE_AVANCEMENT'
          );
        }
      }

      // 3. Vérification du plafond d'échelon
      const plafond = PLAFONDS_ECHELONS[agent.grade_actuel] || 10;
      if (dto.echelon > plafond) {
        throw new HttpError(
          400,
          `Échelon maximum atteint : Le grade ${agent.grade_actuel} comporte au maximum ${plafond} échelons. L'échelon demandé (${dto.echelon}) excède ce plafond.`,
          'ECHELON_SOMMITAL_ATTEINT'
        );
      }

      if (dto.echelon <= agent.echelon_actuel) {
        throw new HttpError(
          400,
          `Échelon invalide : Le nouvel échelon (${dto.echelon}) doit être supérieur à l'échelon actuel (${agent.echelon_actuel}).`,
          'ECHELON_INVALIDE'
        );
      }

      // 4. Calcul indiciaire
      const indiceBrut = dto.indice_brut || (agent.indice_solde + 25);
      const indiceMajore = dto.indice_majore || indiceBrut;

      // 5. Clôture de l'échelon actif précédent
      const resAncien = await client.query(
        `SELECT id, date_effet FROM carrieres_echelons WHERE agent_id = $1 AND est_actif = TRUE FOR UPDATE`,
        [dto.agent_id]
      );

      if (resAncien.rows.length > 0) {
        const ancien = resAncien.rows[0];
        const dateFin = new Date(new Date(dto.date_effet).getTime() - 86400000).toISOString().split('T')[0];
        await client.query(
          `UPDATE carrieres_echelons SET est_actif = FALSE, date_fin = $1 WHERE id = $2`,
          [dateFin, ancien.id]
        );
      }

      // 6. Insertion du nouvel échelon
      const idNouvelEchelon = `ech-${crypto.randomUUID().slice(0, 8)}`;
      const resNouveau = await client.query(
        `INSERT INTO carrieres_echelons (
          id, agent_id, corps, grade, echelon, indice_brut, indice_majore,
          date_effet, type_avancement, numero_arrete, est_actif, cree_par
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, TRUE, $11)
        RETURNING *`,
        [
          idNouvelEchelon,
          dto.agent_id,
          agent.corps,
          agent.grade_actuel,
          dto.echelon,
          indiceBrut,
          indiceMajore,
          dto.date_effet,
          dto.type_avancement,
          dto.numero_arrete,
          operateurId
        ]
      );

      // 7. Synchronisation de la fiche agent
      await client.query(
        `UPDATE agents SET echelon_actuel = $1, indice_solde = $2, modifie_le = CURRENT_TIMESTAMP WHERE id = $3`,
        [dto.echelon, indiceMajore, dto.agent_id]
      );

      // 8. Journalisation d'audit inaltérable
      await auditService.enregistrer({
        utilisateur_id: operateurId,
        action_type: 'AVANCEMENT_ECHELON',
        entite_cible: 'CARRIERES_ECHELONS',
        entite_id: idNouvelEchelon,
        nom_utilisateur: nomOperateur,
        role_utilise: roleOperateur,
        adresse_ip: ip,
        statut_operation: 'SUCCES',
        details_operation_json: {
          agent_id: dto.agent_id,
          matricule: agent.matricule,
          ancien_echelon: agent.echelon_actuel,
          nouvel_echelon: dto.echelon,
          nouvel_indice: indiceMajore,
          type_avancement: dto.type_avancement,
          numero_arrete: dto.numero_arrete
        }
      });

      return resNouveau.rows[0];
    });
  }

  /**
   * Enregistrement d'une promotion de grade
   * ACID transaction avec SELECT ... FOR UPDATE
   */
  async enregistrerPromotion(
    dto: EnregistrerPromotionDto,
    operateurId: string,
    nomOperateur: string,
    roleOperateur: string,
    ip: string
  ): Promise<PromotionGradeDto> {
    return await transaction(async (client) => {
      // 1. Verrouillage agent
      const resAgent = await client.query(
        `SELECT id, matricule, nom, prenom, corps, grade_actuel, echelon_actuel, indice_solde, statut_administratif
         FROM agents WHERE id = $1 FOR UPDATE`,
        [dto.agent_id]
      );

      if (resAgent.rows.length === 0) {
        throw new HttpError(404, `L'agent ciblé (${dto.agent_id}) est introuvable.`, 'AGENT_INTROUVABLE');
      }

      const agent = resAgent.rows[0];

      if (agent.grade_actuel === dto.nouveau_grade) {
        throw new HttpError(400, `Le nouveau grade doit être différent du grade actuel (${agent.grade_actuel}).`, 'GRADE_IDENTIQUE');
      }

      // 2. Vérification position statutaire
      const resPos = await client.query(
        `SELECT position, maintien_droits_avancement FROM positions_statutaires WHERE agent_id = $1 AND est_active = TRUE`,
        [dto.agent_id]
      );

      if (resPos.rows.length > 0) {
        const posActive = resPos.rows[0];
        if (posActive.position === 'DISPONIBILITE' || posActive.position === 'SUSPENSION_ADMINISTRATIVE') {
          throw new HttpError(
            400,
            `Promotion impossible : L'agent est en position de ${posActive.position}, ses droits à promotion sont suspendus ou gelés.`,
            'POSITION_INCOMPATIBLE_PROMOTION'
          );
        }
      }

      // 3. Clôture de l'échelon dans l'ancien grade
      const resAncienEch = await client.query(
        `SELECT id FROM carrieres_echelons WHERE agent_id = $1 AND est_actif = TRUE FOR UPDATE`,
        [dto.agent_id]
      );

      if (resAncienEch.rows.length > 0) {
        const dateFin = new Date(new Date(dto.date_promotion).getTime() - 86400000).toISOString().split('T')[0];
        await client.query(
          `UPDATE carrieres_echelons SET est_actif = FALSE, date_fin = $1 WHERE id = $2`,
          [dateFin, resAncienEch.rows[0].id]
        );
      }

      // 4. Insertion de la promotion dans promotions_grades
      const idPromotion = `pro-${crypto.randomUUID().slice(0, 8)}`;
      const resPromo = await client.query(
        `INSERT INTO promotions_grades (
          id, agent_id, ancien_grade, nouveau_grade, date_promotion, numero_decret,
          commission_date, tableau_avancement_annee, note_retenue, avis_commission,
          decision_autorite, cree_par
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'PROMU', $11)
        RETURNING *`,
        [
          idPromotion,
          dto.agent_id,
          agent.grade_actuel,
          dto.nouveau_grade,
          dto.date_promotion,
          dto.numero_decret,
          dto.commission_date,
          dto.tableau_avancement_annee,
          dto.note_retenue || null,
          dto.avis_commission,
          operateurId
        ]
      );

      // 5. Ouverture du nouvel échelon de reclassement
      const nouvelEchelon = dto.nouvel_echelon || 1;
      const nouvelIndiceBrut = dto.indice_brut || (agent.indice_solde + 50);
      const nouvelIndiceMajore = dto.indice_majore || nouvelIndiceBrut;
      const idEchelonPromo = `ech-${crypto.randomUUID().slice(0, 8)}`;

      await client.query(
        `INSERT INTO carrieres_echelons (
          id, agent_id, corps, grade, echelon, indice_brut, indice_majore,
          date_effet, type_avancement, numero_arrete, est_actif, cree_par
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'CHOIX', $9, TRUE, $10)`,
        [
          idEchelonPromo,
          dto.agent_id,
          agent.corps,
          dto.nouveau_grade,
          nouvelEchelon,
          nouvelIndiceBrut,
          nouvelIndiceMajore,
          dto.date_promotion,
          dto.numero_decret,
          operateurId
        ]
      );

      // 6. Mise à jour synchronisée de la table agents
      await client.query(
        `UPDATE agents SET grade_actuel = $1, echelon_actuel = $2, indice_solde = $3, modifie_le = CURRENT_TIMESTAMP WHERE id = $4`,
        [dto.nouveau_grade, nouvelEchelon, nouvelIndiceMajore, dto.agent_id]
      );

      // 7. Audit log
      await auditService.enregistrer({
        utilisateur_id: operateurId,
        action_type: 'PROMOTION_GRADE',
        entite_cible: 'PROMOTIONS_GRADES',
        entite_id: idPromotion,
        nom_utilisateur: nomOperateur,
        role_utilise: roleOperateur,
        adresse_ip: ip,
        statut_operation: 'SUCCES',
        details_operation_json: {
          agent_id: dto.agent_id,
          matricule: agent.matricule,
          ancien_grade: agent.grade_actuel,
          nouveau_grade: dto.nouveau_grade,
          numero_decret: dto.numero_decret,
          avis_commission: dto.avis_commission
        }
      });

      return resPromo.rows[0];
    });
  }

  /**
   * Calcul des agents éligibles au tableau d'avancement annuel
   */
  async obtenirEligiblesTableauAvancement(annee: number, corpsFilter?: string, gradeFilter?: string): Promise<AgentEligiblePromotionDto[]> {
    const conditions: string[] = ['a.est_actif = TRUE'];
    const params: any[] = [];

    if (corpsFilter) {
      params.push(corpsFilter);
      conditions.push(`a.corps = $${params.length}`);
    }
    if (gradeFilter) {
      params.push(gradeFilter);
      conditions.push(`a.grade_actuel = $${params.length}`);
    }

    const sql = `SELECT a.id, a.matricule, a.nom, a.prenom, a.corps, a.grade_actuel, a.echelon_actuel, a.indice_solde, a.date_recrutement,
              p.position as position_active, p.maintien_droits_avancement
       FROM agents a
       LEFT JOIN positions_statutaires p ON a.id = p.agent_id AND p.est_active = TRUE
       WHERE ${conditions.join(' AND ')}`;

    const resAgents = await pool.query(sql, params);

    const resultats: AgentEligiblePromotionDto[] = [];

    for (const ag of resAgents.rows) {
      // 1. Calcul de la moyenne des notes triennales
      const resNotes = await pool.query(
        `SELECT note_chiffree FROM notations_annuelles
         WHERE agent_id = $1 AND annee >= ($2 - 3) AND annee < $2`,
        [ag.id, annee]
      );

      let moyenneTriennale = 0;
      if (resNotes.rows.length > 0) {
        const sum = resNotes.rows.reduce((acc: number, r: any) => acc + parseFloat(r.note_chiffree), 0);
        moyenneTriennale = Number((sum / resNotes.rows.length).toFixed(2));
      } else {
        moyenneTriennale = 15.0; // Note indicative si nouvelle recrue
      }

      // 2. Détermination de la promouvabilité statutaire
      let estPromouvable = true;
      let motif: string | undefined = undefined;

      const posActive = ag.position_active || 'ACTIVITE';
      if (posActive === 'DISPONIBILITE' || posActive === 'SUSPENSION_ADMINISTRATIVE') {
        estPromouvable = false;
        motif = `Position statutaire incompatible : ${posActive}`;
      } else if (ag.echelon_actuel < 2) {
        estPromouvable = false;
        motif = `Échelon insuffisant (${ag.echelon_actuel} < 2)`;
      } else if (moyenneTriennale < 16.0) {
        estPromouvable = false;
        motif = `Note triennale insuffisante (${moyenneTriennale}/20 < 16.0/20)`;
      }

      // Déduction du grade visé
      let gradeVise = ag.grade_actuel;
      if (ag.grade_actuel === 'Agent de 2ème classe') gradeVise = 'Agent de 1ère classe';
      else if (ag.grade_actuel === 'Agent de 1ère classe') gradeVise = 'Caporal';
      else if (ag.grade_actuel === 'Caporal') gradeVise = 'Caporal-Chef';
      else if (ag.grade_actuel === 'Caporal-Chef') gradeVise = 'Sergent';
      else if (ag.grade_actuel === 'Sergent') gradeVise = 'Sergent-Chef';
      else if (ag.grade_actuel === 'Sergent-Chef') gradeVise = 'Adjudant';
      else if (ag.grade_actuel === 'Adjudant') gradeVise = 'Adjudant-Chef';
      else if (ag.grade_actuel === 'Adjudant-Chef') gradeVise = 'Adjudant-Major';
      else if (ag.grade_actuel === 'Adjudant-Major') gradeVise = 'Sous-Lieutenant';
      else if (ag.grade_actuel === 'Sous-Lieutenant') gradeVise = 'Lieutenant';
      else if (ag.grade_actuel === 'Lieutenant') gradeVise = 'Capitaine';
      else if (ag.grade_actuel === 'Capitaine') gradeVise = 'Commandant';
      else if (ag.grade_actuel === 'Commandant') gradeVise = 'Lieutenant-Colonel';
      else if (ag.grade_actuel === 'Lieutenant-Colonel') gradeVise = 'Colonel';

      resultats.push({
        agent_id: ag.id,
        matricule: ag.matricule,
        nom_complet: `${ag.prenom} ${ag.nom}`,
        corps: ag.corps,
        grade_actuel: ag.grade_actuel,
        grade_vise: gradeVise,
        echelon_actuel: ag.echelon_actuel,
        anciennete_grade_mois: 36,
        note_moyenne_triennale: moyenneTriennale,
        position_active: posActive,
        est_promouvable: estPromouvable,
        motif_non_promouvable: motif
      });
    }

    return resultats;
  }

  /**
   * Déclaration d'un changement de position statutaire
   * Clôture la précédente et synchronise agents.statut_administratif
   */
  async declarerPosition(
    dto: DeclarerPositionDto,
    operateurId: string,
    nomOperateur: string,
    roleOperateur: string,
    ip: string
  ): Promise<PositionStatutaireDto> {
    return await transaction(async (client) => {
      // 1. Verrouillage agent
      const resAgent = await client.query(
        `SELECT id, matricule, nom, prenom, statut_administratif FROM agents WHERE id = $1 FOR UPDATE`,
        [dto.agent_id]
      );

      if (resAgent.rows.length === 0) {
        throw new HttpError(404, `L'agent ciblé (${dto.agent_id}) est introuvable.`, 'AGENT_INTROUVABLE');
      }

      const agent = resAgent.rows[0];

      // 2. Contrôle de cohérence
      if (dto.position === 'DETACHEMENT' && !dto.organisme_accueil) {
        throw new HttpError(400, "Le détachement exige obligatoirement la désignation de l'organisme d'accueil.", 'ORGANISME_ACCUEIL_REQUIS');
      }

      const maintienDroits = (dto.position !== 'DISPONIBILITE' && dto.position !== 'SUSPENSION_ADMINISTRATIVE');

      // 3. Clôture de la position active précédente
      const resAncienne = await client.query(
        `SELECT id, date_debut FROM positions_statutaires WHERE agent_id = $1 AND est_active = TRUE FOR UPDATE`,
        [dto.agent_id]
      );

      if (resAncienne.rows.length > 0) {
        const dateFin = new Date(new Date(dto.date_debut).getTime() - 86400000).toISOString().split('T')[0];
        await client.query(
          `UPDATE positions_statutaires SET est_active = FALSE, date_fin = $1 WHERE id = $2`,
          [dateFin, resAncienne.rows[0].id]
        );
      }

      // 4. Insertion de la nouvelle position
      const idPos = `pos-${crypto.randomUUID().slice(0, 8)}`;
      const resPos = await client.query(
        `INSERT INTO positions_statutaires (
          id, agent_id, position, organisme_accueil, date_debut, date_fin,
          maintien_droits_avancement, reference_decision, motif, est_active, cree_par
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, TRUE, $10)
        RETURNING *`,
        [
          idPos,
          dto.agent_id,
          dto.position,
          dto.organisme_accueil || null,
          dto.date_debut,
          dto.date_fin || null,
          maintienDroits,
          dto.reference_decision,
          dto.motif || null,
          operateurId
        ]
      );

      // 5. Synchronisation de la table agents
      let nouveauStatutAdmin = 'EN_ACTIVITE';
      if (dto.position === 'DETACHEMENT') nouveauStatutAdmin = 'DETACHE';
      else if (dto.position === 'DISPONIBILITE') nouveauStatutAdmin = 'DISPONIBILITE';
      else if (dto.position === 'SOUS_LES_DRAPEAUX') nouveauStatutAdmin = 'SOUS_LES_DRAPEAUX';
      else if (dto.position === 'SUSPENSION_ADMINISTRATIVE') nouveauStatutAdmin = 'SUSPENDU';

      await client.query(
        `UPDATE agents SET statut_administratif = $1, modifie_le = CURRENT_TIMESTAMP WHERE id = $2`,
        [nouveauStatutAdmin, dto.agent_id]
      );

      // 6. Audit
      await auditService.enregistrer({
        utilisateur_id: operateurId,
        action_type: 'CHANGEMENT_POSITION_STATUTAIRE',
        entite_cible: 'POSITIONS_STATUTAIRES',
        entite_id: idPos,
        nom_utilisateur: nomOperateur,
        role_utilise: roleOperateur,
        adresse_ip: ip,
        statut_operation: 'SUCCES',
        details_operation_json: {
          agent_id: dto.agent_id,
          matricule: agent.matricule,
          position: dto.position,
          date_debut: dto.date_debut,
          reference_decision: dto.reference_decision,
          organisme_accueil: dto.organisme_accueil
        }
      });

      return resPos.rows[0];
    });
  }

  /**
   * Catalogue des formations
   */
  async listerFormations(): Promise<FormationDto[]> {
    const res = await pool.query(
      `SELECT id, code_formation, intitule, type, duree_heures, organisme, est_certifiante, duree_validite_mois, est_active, cree_le
       FROM formations WHERE est_active = TRUE ORDER BY code_formation`
    );
    return res.rows;
  }

  /**
   * Qualifications & Habilitations (avec alertes péremption)
   */
  async listerQualifications(agentId?: string, typeQualification?: string): Promise<QualificationAgentDto[]> {
    const res = await pool.query(
      `SELECT id, agent_id, formation_id, type_qualification, numero_carte_agrement, date_obtention, date_expiration, autorite_delivrance, statut_actif, aptitude_operationnelle_associee, cree_le
       FROM qualifications_agents
       WHERE statut_actif = TRUE
       ${agentId ? 'AND agent_id = $1' : ''}
       ${typeQualification ? (agentId ? 'AND type_qualification = $2' : 'AND type_qualification = $1') : ''}
       ORDER BY date_obtention DESC`,
      [...(agentId ? [agentId] : []), ...(typeQualification ? [typeQualification] : [])]
    );
    return res.rows;
  }

  /**
   * Détection des alertes d'expiration de qualifications (J-60, J-30, J-0)
   */
  async obtenirAlertesPeremption(unitesAutorisees?: string[]): Promise<AlertePeremptionQualificationDto[]> {
    const hasFilter = unitesAutorisees && unitesAutorisees.length > 0 && !unitesAutorisees.includes('*');
    const res = await pool.query(
      `SELECT q.id as qualification_id, q.agent_id, q.type_qualification, q.date_expiration,
              q.numero_carte_agrement,
              a.matricule, a.nom, a.prenom, u.nom as unite_nom,
              (q.date_expiration - CURRENT_DATE)::integer as jours_restants
       FROM qualifications_agents q
       JOIN agents a ON q.agent_id = a.id
       JOIN unites u ON a.unite_actuelle_id = u.id
       WHERE q.statut_actif = TRUE
         AND q.date_expiration IS NOT NULL
         AND q.date_expiration <= (CURRENT_DATE + INTERVAL '60 days')
         ${hasFilter ? 'AND a.unite_actuelle_id = ANY($1::varchar[])' : ''}
       ORDER BY q.date_expiration ASC`,
      hasFilter ? [unitesAutorisees] : []
    );

    return res.rows.map(r => {
      let niveauUrgence: 'CRITIQUE' | 'URGENT' | 'ATTENTION' = 'ATTENTION';
      if (r.jours_restants <= 0) {
        niveauUrgence = 'CRITIQUE';
      } else if (r.jours_restants <= 30) {
        niveauUrgence = 'URGENT';
      }

      return {
        qualification_id: r.qualification_id,
        agent_id: r.agent_id,
        matricule: r.matricule,
        nom_complet: `${r.prenom} ${r.nom}`,
        unite_nom: r.unite_nom,
        type_qualification: r.type_qualification,
        numero_carte_agrement: r.numero_carte_agrement,
        date_expiration: r.date_expiration,
        jours_restants: r.jours_restants,
        niveau_urgence: niveauUrgence
      };
    });
  }

  /**
   * Création d'une qualification ou habilitation
   */
  async creerQualification(
    dto: CreerQualificationDto,
    operateurId: string,
    nomOperateur: string,
    roleOperateur: string,
    ip: string
  ): Promise<QualificationAgentDto> {
    const id = `qua-${crypto.randomUUID().slice(0, 8)}`;
    const res = await pool.query(
      `INSERT INTO qualifications_agents (
        id, agent_id, formation_id, type_qualification, numero_carte_agrement,
        date_obtention, date_expiration, autorite_delivrance, statut_actif, aptitude_operationnelle_associee
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE, $9)
      RETURNING *`,
      [
        id,
        dto.agent_id,
        dto.formation_id || null,
        dto.type_qualification,
        dto.numero_carte_agrement,
        dto.date_obtention,
        dto.date_expiration || null,
        dto.autorite_delivrance,
        dto.aptitude_operationnelle_associee || null
      ]
    );

    await auditService.enregistrer({
      utilisateur_id: operateurId,
      action_type: 'CREATION_QUALIFICATION',
      entite_cible: 'QUALIFICATIONS_AGENTS',
      entite_id: id,
      nom_utilisateur: nomOperateur,
      role_utilise: roleOperateur,
      adresse_ip: ip,
      statut_operation: 'SUCCES',
      details_operation_json: {
        agent_id: dto.agent_id,
        type_qualification: dto.type_qualification,
        numero: dto.numero_carte_agrement,
        date_expiration: dto.date_expiration
      }
    });

    return res.rows[0];
  }

  /**
   * Enregistrement d'une notation annuelle avec validation anti-médicale bloquante
   */
  async creerNotation(
    dto: CreerNotationDto,
    operateurId: string,
    nomOperateur: string,
    roleOperateur: string,
    ip: string
  ): Promise<NotationAnnuelleDto> {
    // 1. Validation sémantique anti-médicale absolue
    if (REGEX_MEDICALE.test(dto.appreciation_generale)) {
      throw new HttpError(
        400,
        "VIOLATION_CONFIDENTIALITE_MEDICALE : L'évaluation administrative ne doit comporter aucune appréciation relative à la santé, aux traitements ou à l'état médical de l'agent.",
        'DONNEE_MEDICALE_PROHIBEE'
      );
    }

    // 2. Calcul et validation de la note chiffrée sur 20
    const noteChiffree = Number(
      (dto.rigueur_deontologie + dto.competence_technique + dto.disponibilite_operationnelle + dto.sens_commandement_initiative).toFixed(2)
    );

    if (noteChiffree < 0 || noteChiffree > 20) {
      throw new HttpError(400, `La note globale doit être comprise entre 0.00 et 20.00 (calculé: ${noteChiffree}).`, 'NOTE_HORS_LIMITES');
    }

    const evaluateurId = dto.evaluateur_agent_id || operateurId;
    const id = `not-${crypto.randomUUID().slice(0, 8)}`;

    const res = await pool.query(
      `INSERT INTO notations_annuelles (
        id, agent_id, annee, note_chiffree, appreciation_generale,
        rigueur_deontologie, competence_technique, disponibilite_operationnelle, sens_commandement_initiative,
        date_entretien, evaluateur_agent_id, statut, note_definitive
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'SOUMIS', $4)
      RETURNING *`,
      [
        id,
        dto.agent_id,
        dto.annee,
        noteChiffree,
        dto.appreciation_generale,
        dto.rigueur_deontologie,
        dto.competence_technique,
        dto.disponibilite_operationnelle,
        dto.sens_commandement_initiative,
        dto.date_entretien,
        evaluateurId
      ]
    );

    await auditService.enregistrer({
      utilisateur_id: operateurId,
      action_type: 'CREATION_NOTATION_ANNUELLE',
      entite_cible: 'NOTATIONS_ANNUELLES',
      entite_id: id,
      nom_utilisateur: nomOperateur,
      role_utilise: roleOperateur,
      adresse_ip: ip,
      statut_operation: 'SUCCES',
      details_operation_json: {
        agent_id: dto.agent_id,
        annee: dto.annee,
        note_chiffree: noteChiffree
      }
    });

    return res.rows[0];
  }

  /**
   * Dépôt d'un recours gracieux contre une notation
   */
  async deposerRecours(
    notationId: string,
    dto: DeposerRecoursNotationDto,
    operateurId: string,
    nomOperateur: string,
    roleOperateur: string,
    ip: string
  ): Promise<NotationAnnuelleDto> {
    if (REGEX_MEDICALE.test(dto.motif_recours)) {
      throw new HttpError(
        400,
        "VIOLATION_CONFIDENTIALITE_MEDICALE : Le motif de recours administratif ne doit comporter aucune donnée de santé ou médicale.",
        'DONNEE_MEDICALE_PROHIBEE'
      );
    }

    const res = await pool.query(
      `UPDATE notations_annuelles
       SET recours_depose = TRUE, motif_recours = $1, statut = 'RECOURS', modifie_le = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`,
      [dto.motif_recours, notationId]
    );

    if (res.rows.length === 0) {
      throw new HttpError(404, `La fiche de notation (${notationId}) est introuvable.`, 'NOTATION_INTROUVABLE');
    }

    await auditService.enregistrer({
      utilisateur_id: operateurId,
      action_type: 'DEPOT_RECOURS_NOTATION',
      entite_cible: 'NOTATIONS_ANNUELLES',
      entite_id: notationId,
      nom_utilisateur: nomOperateur,
      role_utilise: roleOperateur,
      adresse_ip: ip,
      statut_operation: 'SUCCES',
      details_operation_json: {
        notation_id: notationId,
        date_recours: dto.date_recours || new Date().toISOString()
      }
    });

    return res.rows[0];
  }

  /**
   * Arbitrage souverain d'un recours
   */
  async arbitrerRecours(
    notationId: string,
    dto: ArbitrerRecoursNotationDto,
    operateurId: string,
    nomOperateur: string,
    roleOperateur: string,
    ip: string
  ): Promise<NotationAnnuelleDto> {
    const resVerif = await pool.query(`SELECT note_chiffree FROM notations_annuelles WHERE id = $1`, [notationId]);
    if (resVerif.rows.length === 0) {
      throw new HttpError(404, `La fiche de notation (${notationId}) est introuvable.`, 'NOTATION_INTROUVABLE');
    }

    const noteDefinitive = dto.note_definitive !== undefined ? dto.note_definitive : resVerif.rows[0].note_chiffree;

    const res = await pool.query(
      `UPDATE notations_annuelles
       SET decision_recours = $1, note_definitive = $2, statut = 'VALIDE_DEFINITIF', modifie_le = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING *`,
      [dto.decision_recours, noteDefinitive, notationId]
    );

    await auditService.enregistrer({
      utilisateur_id: operateurId,
      action_type: 'ARBITRAGE_RECOURS_NOTATION',
      entite_cible: 'NOTATIONS_ANNUELLES',
      entite_id: notationId,
      nom_utilisateur: nomOperateur,
      role_utilise: roleOperateur,
      adresse_ip: ip,
      statut_operation: 'SUCCES',
      details_operation_json: {
        notation_id: notationId,
        decision_recours: dto.decision_recours,
        note_definitive: noteDefinitive
      }
    });

    return res.rows[0];
  }

  /**
   * Calcul mensuel des éléments de solde indiciaire et primes
   */
  async calculerSoldeMensuelle(moisAnnee: string, operateurId: string): Promise<ElementSoldeDto[]> {
    const resAgents = await pool.query(
      `SELECT a.id, a.matricule, a.corps, a.grade_actuel, a.indice_solde, a.unite_actuelle_id,
              u.region_administrative,
              p.position as position_active
       FROM agents a
       LEFT JOIN unites u ON a.unite_actuelle_id = u.id
       LEFT JOIN positions_statutaires p ON a.id = p.agent_id AND p.est_active = TRUE
       WHERE a.est_actif = TRUE`
    );

    const elementsCalcules: ElementSoldeDto[] = [];

    for (const ag of resAgents.rows) {
      const position = ag.position_active || 'ACTIVITE';

      let baseIndiciaire = 0;
      let primeSujetion = 0;
      let primeRisque = 0;
      let indemniteAstreinte = 0;
      let heuresNuit = 0;
      let primeEloignement = 0;
      let retenues = 0;

      if (position === 'DISPONIBILITE') {
        // En disponibilité : 0 DJF sur tous les postes
        baseIndiciaire = 0;
      } else if (position === 'SUSPENSION_ADMINISTRATIVE') {
        // Suspension administrative : 50% du traitement indiciaire, 0% primes
        baseIndiciaire = Number(((ag.indice_solde * 100.0) * 0.5).toFixed(2));
        retenues = Number((baseIndiciaire * 0.07).toFixed(2));
      } else {
        // Position ACTIVITE ou DETACHEMENT (si géré)
        baseIndiciaire = ag.indice_solde * 100.0;

        // Primes de sujétion et risque policier
        if (ag.corps === 'OFFICIERS_SUPERIEURS' || ag.corps === 'OFFICIERS_SUBALTERNES' || ag.corps === 'OFFICIERS_GENERAUX') {
          primeSujetion = 20000.0;
          primeRisque = 15000.0;
        } else if (ag.corps === 'SOUS_OFFICIERS') {
          primeSujetion = 15000.0;
          primeRisque = 10000.0;
        } else if (ag.corps === 'AGENTS_DE_POLICE' || ag.corps === 'AGENTS' || ag.corps === 'GRADES_DE_POLICE') {
          primeSujetion = 10000.0;
          primeRisque = 10000.0;
        }

        // Prime d'éloignement régional (Commissariats hors Djibouti-Ville)
        if (ag.region_administrative && ag.region_administrative !== 'DJIBOUTI') {
          primeEloignement = 25000.0;
        }

        // Retenues statutaires (7% sur la base indiciaire)
        retenues = Number((baseIndiciaire * 0.07).toFixed(2));
      }

      const idSolde = `sol-${crypto.randomUUID().slice(0, 16)}`;
      const res = await pool.query(
        `INSERT INTO elements_solde (
          id, agent_id, mois_annee, salaire_base_indiciaire, prime_sujetion, prime_risque,
          indemnite_astreinte, heures_nuit_dimanche, indemnite_eloignement, retenues_statutaires,
          statut, valide_par
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'VALIDE', $11)
        ON CONFLICT (agent_id, mois_annee) DO UPDATE SET
          salaire_base_indiciaire = EXCLUDED.salaire_base_indiciaire,
          prime_sujetion = EXCLUDED.prime_sujetion,
          prime_risque = EXCLUDED.prime_risque,
          indemnite_astreinte = EXCLUDED.indemnite_astreinte,
          heures_nuit_dimanche = EXCLUDED.heures_nuit_dimanche,
          indemnite_eloignement = EXCLUDED.indemnite_eloignement,
          retenues_statutaires = EXCLUDED.retenues_statutaires,
          statut = 'VALIDE'
        RETURNING *`,
        [
          idSolde,
          ag.id,
          moisAnnee,
          baseIndiciaire,
          primeSujetion,
          primeRisque,
          indemniteAstreinte,
          heuresNuit,
          primeEloignement,
          retenues,
          operateurId
        ]
      );

      elementsCalcules.push(res.rows[0]);
    }

    return elementsCalcules;
  }

  /**
   * Consultation des éléments de solde pour un mois donné
   */
  async obtenirSoldeMensuelle(moisAnnee: string) {
    const res = await pool.query(
      `SELECT s.*, a.matricule, a.nom, a.prenom, a.grade_actuel, a.corps
       FROM elements_solde s
       JOIN agents a ON s.agent_id = a.id
       WHERE s.mois_annee = $1
       ORDER BY a.matricule ASC`,
      [moisAnnee]
    );

    const totalMontant = res.rows.reduce((acc, r) => acc + parseFloat(r.net_a_payer), 0);

    return {
      mois_annee: moisAnnee,
      total_agents: res.rows.length,
      montant_global_net: Number(totalMontant.toFixed(2)),
      elements: res.rows,
      horodatage: new Date().toISOString()
    };
  }

  /**
   * Génération de l'export de solde sécurisé et scellement SHA-256 dans l'audit
   */
  async genererExportSolde(
    moisAnnee: string,
    format = 'CSV_TRESOR_DJIBOUTI',
    operateurId: string,
    nomOperateur: string,
    roleOperateur: string,
    ip: string
  ) {
    const resElements = await pool.query(
      `SELECT s.*, a.matricule, a.nom, a.prenom, a.grade_actuel, a.corps
       FROM elements_solde s
       JOIN agents a ON s.agent_id = a.id
       WHERE s.mois_annee = $1
       ORDER BY a.matricule ASC`,
      [moisAnnee]
    );

    if (resElements.rows.length === 0) {
      throw new HttpError(404, `Aucun élément de solde validé pour la période ${moisAnnee}. Effectuez d'abord le calcul de solde.`, 'AUCUNE_DONNEE_SOLDE');
    }

    const refExport = `EXP-SOLDE-${moisAnnee}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    const dateExport = new Date().toISOString();

    // Construction du fichier normé délimité par point-virgule
    let contenuFichier = `DGPN_DJIBOUTI;EXPORT_SOLDE_NATIONAL;${refExport};${moisAnnee};${dateExport}\n`;
    contenuFichier += `MATRICULE;NOM_COMPLET;GRADE;CORPS;BASE_INDICIAIRE;PRIME_SUJETION;PRIME_RISQUE;ASTREINTE;NUIT;ELOIGNEMENT;RETENUES;NET_A_PAYER\n`;

    let totalMontantGlobal = 0;
    for (const r of resElements.rows) {
      const net = parseFloat(r.net_a_payer);
      totalMontantGlobal += net;
      contenuFichier += `${r.matricule};${r.prenom} ${r.nom};${r.grade_actuel};${r.corps};${r.salaire_base_indiciaire};${r.prime_sujetion};${r.prime_risque};${r.indemnite_astreinte};${r.heures_nuit_dimanche};${r.indemnite_eloignement};${r.retenues_statutaires};${r.net_a_payer}\n`;
    }

    contenuFichier += `TOTAL_LIGNES;${resElements.rows.length};TOTAL_NET_DJF;${totalMontantGlobal.toFixed(2)}\n`;

    // Calcul de l'empreinte cryptographique SHA-256
    const empreinteSha256 = crypto.createHash('sha256').update(contenuFichier, 'utf-8').digest('hex');

    const idExport = `exp-${crypto.randomUUID().slice(0, 8)}`;

    return await transaction(async (client) => {
      // Inscription inaltérable dans les journaux d'audit
      const logAudit = await auditService.enregistrer({
        utilisateur_id: operateurId,
        action_type: 'EXPORT_SOLDE_SCELLE',
        entite_cible: 'EXPORTS_SOLDE',
        entite_id: idExport,
        nom_utilisateur: nomOperateur,
        role_utilise: roleOperateur,
        adresse_ip: ip,
        statut_operation: 'SUCCES',
        details_operation_json: {
          reference_export: refExport,
          mois_annee: moisAnnee,
          nombre_agents: resElements.rows.length,
          montant_total: Number(totalMontantGlobal.toFixed(2)),
          format,
          empreinte_sha256: empreinteSha256
        }
      });

      // Insertion dans exports_solde
      await client.query(
        `INSERT INTO exports_solde (
          id, reference_export, mois_annee, date_export, operateur_id,
          nombre_agents, montant_total, format, empreinte_sha256,
          contenu_export_chiffre, journal_audit_id, statut
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'GENERE')`,
        [
          idExport,
          refExport,
          moisAnnee,
          dateExport,
          operateurId,
          resElements.rows.length,
          totalMontantGlobal,
          format,
          empreinteSha256,
          contenuFichier,
          logAudit.id
        ]
      );

      // Marquer les éléments de solde comme exportés
      await client.query(`UPDATE elements_solde SET statut = 'EXPORTE' WHERE mois_annee = $1`, [moisAnnee]);

      return {
        export_id: idExport,
        reference_export: refExport,
        mois_annee: moisAnnee,
        nombre_agents: resElements.rows.length,
        montant_total: Number(totalMontantGlobal.toFixed(2)),
        empreinte_sha256: empreinteSha256,
        format,
        date_export: dateExport,
        contenu_fichier: contenuFichier
      };
    });
  }

  /**
   * Consultation des exports de solde
   */
  async listerExportsSolde(moisAnnee?: string): Promise<ExportSoldeDto[]> {
    const res = await pool.query(
      `SELECT id, reference_export, mois_annee, date_export, operateur_id, nombre_agents, montant_total, format, empreinte_sha256, journal_audit_id, statut
       FROM exports_solde
       ${moisAnnee ? 'WHERE mois_annee = $1' : ''}
       ORDER BY date_export DESC`,
      moisAnnee ? [moisAnnee] : []
    );
    return res.rows;
  }
}

export const carrieresService = new CarrieresService();
