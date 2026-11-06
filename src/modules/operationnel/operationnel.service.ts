import * as crypto from 'crypto';
import { pool, transaction } from '../../database';
import { auditService } from '../audit/audit.service';
import { genererDocumentPdf } from './pdf.generator';
import {
  PosteOperationnelDto,
  CreerPosteOperationnelDto,
  PlanningVacationDto,
  CreerVacationDto,
  ModifierVacationDto,
  CandidatEligibleDto,
  RemplacementGardeDto,
  OrdonnerRemplacementDto,
  AlerteSousEffectifDto,
  DossierDisciplinaireDto,
  CreerDossierDisciplinaireDto,
  TransitionPhaseDossierDto,
  SanctionDisciplinaireDto,
  EnregistrerSanctionDto,
  AptitudeAdministrativeDto,
  EnregistrerAptitudeDto,
  ModeleDocumentPdfDto,
  GenererDocumentDto,
  DocumentGenereDto
} from './operationnel.types';

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

export const MODELES_PDF_AUTORISES = [
  'ARRETE_MUTATION',
  'ATTESTATION_PRESENCE',
  'FICHE_INDIVIDUELLE',
  'ORDRE_MISSION',
  'TITRE_CONGE',
  'ATTESTATION_TRAVAIL',
  'ARRETE_AVANCEMENT_ECHELON',
  'TABLEAU_SERVICE_BRIGADE'
];

export class OperationnelService {

  // ==========================================================================
  // 1. POSTES OPÉRATIONNELS DE BRIGADE
  // ==========================================================================

  async listerPostesOperationnels(uniteId?: string): Promise<PosteOperationnelDto[]> {
    let sql = 'SELECT * FROM postes_operationnels WHERE est_actif = TRUE';
    const params: any[] = [];
    if (uniteId) {
      params.push(uniteId);
      sql += ' AND unite_id = $1';
    }
    sql += ' ORDER BY code ASC';

    const res = await pool.query(sql, params);
    return res.rows.map(r => ({
      id: r.id,
      code: r.code,
      libelle: r.libelle,
      description: r.description,
      niveau_qualification_requis: r.niveau_qualification_requis,
      tir_requis: r.tir_requis,
      permis_conduire_requis: r.permis_conduire_requis,
      unite_id: r.unite_id,
      effectif_cible: r.effectif_cible,
      est_actif: r.est_actif,
      cree_le: r.cree_le?.toISOString(),
      modifie_le: r.modifie_le?.toISOString()
    }));
  }

  async creerPosteOperationnel(dto: CreerPosteOperationnelDto, auteurId: string): Promise<PosteOperationnelDto> {
    const id = `pop-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
    const sql = `
      INSERT INTO postes_operationnels (
        id, code, libelle, description, niveau_qualification_requis,
        tir_requis, permis_conduire_requis, unite_id, effectif_cible, est_actif
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, TRUE)
      RETURNING *;
    `;
    const params = [
      id,
      dto.code,
      dto.libelle,
      dto.description || null,
      dto.niveau_qualification_requis || 'aucun',
      dto.tir_requis || false,
      dto.permis_conduire_requis || false,
      dto.unite_id,
      dto.effectif_cible || 1
    ];

    const res = await pool.query(sql, params);
    const r = res.rows[0];
    return {
      id: r.id,
      code: r.code,
      libelle: r.libelle,
      description: r.description,
      niveau_qualification_requis: r.niveau_qualification_requis,
      tir_requis: r.tir_requis,
      permis_conduire_requis: r.permis_conduire_requis,
      unite_id: r.unite_id,
      effectif_cible: r.effectif_cible,
      est_actif: r.est_actif,
      cree_le: r.cree_le?.toISOString()
    };
  }

  // ==========================================================================
  // 2. PLANNINGS ET VACATIONS OPÉRATIONNELLES (24/7)
  // ==========================================================================

  calculerHeuresNuit(dateDebut: Date, dateFin: Date): number {
    let heuresNuit = 0;
    const pasMs = 15 * 60 * 1000;
    let curseur = new Date(dateDebut.getTime());
    while (curseur.getTime() < dateFin.getTime()) {
      const heure = curseur.getUTCHours();
      if (heure >= 22 || heure < 6) {
        heuresNuit += 0.25;
      }
      curseur = new Date(curseur.getTime() + pasMs);
    }
    return Math.round(heuresNuit * 100) / 100;
  }

  async listerPlannings(filtres: {
    uniteId?: string;
    agentId?: string;
    dateDebut?: string;
    dateFin?: string;
    statut?: string;
    unitesAutorisees?: string[];
  }): Promise<PlanningVacationDto[]> {
    let sql = `
      SELECT pv.*, a.nom AS agent_nom, a.prenom AS agent_prenom, a.grade_actuel AS agent_grade,
             a.matricule AS agent_matricule, po.libelle AS poste_libelle
      FROM plannings_vacations pv
      JOIN agents a ON pv.agent_id = a.id
      LEFT JOIN postes_operationnels po ON pv.poste_operationnel_id = po.id
      WHERE 1=1
    `;
    const params: any[] = [];
    let idx = 1;

    if (filtres.agentId) {
      sql += ` AND pv.agent_id = $${idx++}`;
      params.push(filtres.agentId);
    }

    if (filtres.uniteId) {
      sql += ` AND pv.unite_id = $${idx++}`;
      params.push(filtres.uniteId);
    } else if (filtres.unitesAutorisees && filtres.unitesAutorisees.length > 0) {
      sql += ` AND pv.unite_id = ANY($${idx++})`;
      params.push(filtres.unitesAutorisees);
    }

    if (filtres.dateDebut) {
      sql += ` AND pv.date_fin >= $${idx++}`;
      params.push(filtres.dateDebut);
    }

    if (filtres.dateFin) {
      sql += ` AND pv.date_debut <= $${idx++}`;
      params.push(filtres.dateFin);
    }

    if (filtres.statut) {
      sql += ` AND pv.statut = $${idx++}`;
      params.push(filtres.statut);
    }

    sql += ' ORDER BY pv.date_debut ASC';

    const res = await pool.query(sql, params);
    return res.rows.map(r => ({
      id: r.id,
      unite_id: r.unite_id,
      agent_id: r.agent_id,
      poste_operationnel_id: r.poste_operationnel_id,
      type_vacation: r.type_vacation,
      date_debut: r.date_debut?.toISOString(),
      date_fin: r.date_fin?.toISOString(),
      statut: r.statut,
      motif_modification: r.motif_modification,
      cree_par: r.cree_par,
      cree_le: r.cree_le?.toISOString(),
      modifie_le: r.modifie_le?.toISOString(),
      agent_nom: r.agent_nom,
      agent_prenom: r.agent_prenom,
      agent_grade: r.agent_grade,
      agent_matricule: r.agent_matricule,
      poste_libelle: r.poste_libelle,
      heures_nuit: this.calculerHeuresNuit(new Date(r.date_debut), new Date(r.date_fin))
    }));
  }

  async creerVacation(
    dto: CreerVacationDto,
    auteurId: string,
    nomAuteur: string,
    roleAuteur: string,
    ip: string
  ): Promise<PlanningVacationDto> {
    const debut = new Date(dto.date_debut);
    const fin = new Date(dto.date_fin);

    if (isNaN(debut.getTime()) || isNaN(fin.getTime()) || fin <= debut) {
      throw new HttpError(400, "Les dates de début et de fin de vacation sont invalides ou incohérentes.", "PARAMETRES_INVALIDES");
    }

    // 1. Règle durée max de vacation (HYP-05 : 12 heures)
    const dureeHeures = (fin.getTime() - debut.getTime()) / (1000 * 3600);
    if (dureeHeures > 12.0001) {
      throw new HttpError(
        400,
        `Dépassement de la durée maximale de vacation : ${dureeHeures.toFixed(1)}h planifiées (plafond réglementaire : 12h).`,
        "DUREE_VACATION_INVALIDE"
      );
    }

    return await transaction(async (client) => {
      // 1. Verrou ligne exclusif pour sérialiser les créations concurrentes pour le même agent
      await client.query('SELECT id FROM agents WHERE id = $1 FOR UPDATE', [dto.agent_id]);

      // Récupération de l'agent pour valider son existence et unité
      const resAgent = await client.query('SELECT * FROM agents WHERE id = $1', [dto.agent_id]);
      if (resAgent.rows.length === 0) {
        throw new HttpError(404, `Agent ciblé (${dto.agent_id}) introuvable.`, "AGENT_INTROUVABLE");
      }
      const agent = resAgent.rows[0];
      const uniteId = dto.unite_id || agent.unite_actuelle_id;

      // 2. Règle du repos physiologique minimal (HYP-04 : 11 heures consécutives)
      // Vérification vacation antérieure la plus proche
      const resPrecedente = await client.query(`
        SELECT date_fin FROM plannings_vacations
        WHERE agent_id = $1 AND statut NOT IN ('annule', 'remplace')
          AND date_fin <= $2
        ORDER BY date_fin DESC LIMIT 1;
      `, [dto.agent_id, debut.toISOString()]);

      if (resPrecedente.rows.length > 0) {
        const finPrecedente = new Date(resPrecedente.rows[0].date_fin);
        const reposPrecedentHeures = (debut.getTime() - finPrecedente.getTime()) / (1000 * 3600);
        if (reposPrecedentHeures < 10.999) {
          throw new HttpError(
            400,
            `Violation du temps de repos légal : seulement ${reposPrecedentHeures.toFixed(1)}h de repos observées (minimum statutaire : 11h consécutives).`,
            "REPOS_MINIMAL_INSUFFISANT"
          );
        }
      }

      // Vérification vacation postérieure la plus proche
      const resPosterieure = await client.query(`
        SELECT date_debut FROM plannings_vacations
        WHERE agent_id = $1 AND statut NOT IN ('annule', 'remplace')
          AND date_debut >= $2
        ORDER BY date_debut ASC LIMIT 1;
      `, [dto.agent_id, fin.toISOString()]);

      if (resPosterieure.rows.length > 0) {
        const debutPosterieur = new Date(resPosterieure.rows[0].date_debut);
        const reposPosterieurHeures = (debutPosterieur.getTime() - fin.getTime()) / (1000 * 3600);
        if (reposPosterieurHeures < 10.999) {
          throw new HttpError(
            400,
            `Violation du temps de repos légal avec le service suivant : seulement ${reposPosterieurHeures.toFixed(1)}h de repos observées (minimum statutaire : 11h consécutives).`,
            "REPOS_MINIMAL_INSUFFISANT"
          );
        }
      }

      // 3. Contrôle du poste armé et des aptitudes
      if (dto.poste_operationnel_id) {
        const resPoste = await client.query('SELECT * FROM postes_operationnels WHERE id = $1', [dto.poste_operationnel_id]);
        if (resPoste.rows.length > 0) {
          const poste = resPoste.rows[0];

          if (poste.tir_requis) {
            // Vérification du certificat de tir valide (dans l'année / 365 jours)
            const resTir = await client.query(`
              SELECT * FROM qualifications_agents
              WHERE agent_id = $1 
                AND type_qualification IN ('CERTIFICAT_TIR_REGLEMENTAIRE', 'BREVET_TIR')
                AND (date_expiration IS NULL OR date_expiration >= $2)
                AND statut_actif = TRUE;
            `, [dto.agent_id, debut.toISOString().split('T')[0]]);

            if (resTir.rows.length === 0) {
              throw new HttpError(
                400,
                "Affectation armée bloquée : Le certificat annuel de tir et d'armement réglementaire de l'agent est expiré ou absent.",
                "CERTIFICAT_TIR_EXPIRE"
              );
            }

            // Vérification de l'absence de restriction d'arme administrative
            const resAptitude = await client.query(`
              SELECT * FROM aptitudes_administratives
              WHERE agent_id = $1 
                AND (code_restriction = 'DISPENSE_PORT_ARME' OR decision_aptitude = 'INAPTE_TEMPORAIRE_PORT_ARME')
                AND (date_expiration IS NULL OR date_expiration >= $2);
            `, [dto.agent_id, debut.toISOString().split('T')[0]]);

            if (resAptitude.rows.length > 0) {
              throw new HttpError(
                400,
                "Affectation armée bloquée : L'agent fait l'objet d'une dispense ou restriction administrative de port d'arme.",
                "DISPENSE_ARME_ACTIVE"
              );
            }
          }
        }
      }

      // 4. Insertion avec capture des éventuels chevauchements temporels
      const id = `vac-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
      let r;
      try {
        const sql = `
          INSERT INTO plannings_vacations (
            id, unite_id, agent_id, poste_operationnel_id, type_vacation,
            date_debut, date_fin, statut, motif_modification, cree_par
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'planifie', $8, $9)
          RETURNING *;
        `;
        const res = await client.query(sql, [
          id, uniteId, dto.agent_id, dto.poste_operationnel_id || null,
          dto.type_vacation, debut.toISOString(), fin.toISOString(),
          dto.motif_modification || null, auteurId
        ]);
        r = res.rows[0];
      } catch (err: any) {
        if (err.code === '23505' || err.message?.includes('VIOLATION PLANNING')) {
          throw new HttpError(
            400,
            "Violation planning : L'agent est déjà planifié sur une vacation chevauchant ce créneau horaire.",
            "CHEVOUCHEMENT_DETECTE"
          );
        }
        throw err;
      }

      // Audit
      await auditService.enregistrer({
        utilisateur_id: auteurId,
        nom_utilisateur: nomAuteur,
        role_utilise: roleAuteur,
        adresse_ip: ip,
        action_type: 'CREATION_VACATION_PLANNING',
        entite_cible: 'PLANNING_VACATION',
        entite_id: r.id,
        details_operation_json: {
          agent_id: dto.agent_id,
          unite_id: uniteId,
          type_vacation: dto.type_vacation,
          date_debut: debut.toISOString(),
          date_fin: fin.toISOString()
        },
        statut_operation: 'SUCCES'
      });

      return {
        id: r.id,
        unite_id: r.unite_id,
        agent_id: r.agent_id,
        poste_operationnel_id: r.poste_operationnel_id,
        type_vacation: r.type_vacation,
        date_debut: r.date_debut?.toISOString(),
        date_fin: r.date_fin?.toISOString(),
        statut: r.statut,
        cree_par: r.cree_par,
        cree_le: r.cree_le?.toISOString(),
        heures_nuit: this.calculerHeuresNuit(debut, fin)
      };
    });
  }

  /**
   * Récupère les détails complets d'une vacation opérationnelle par son identifiant
   */
  async obtenirVacation(id: string): Promise<PlanningVacationDto | null> {
    const res = await pool.query(`
      SELECT pv.*,
             a.nom AS agent_nom, a.prenom AS agent_prenom, a.grade_actuel AS agent_grade, a.matricule AS agent_matricule,
             pop.libelle AS poste_libelle
      FROM plannings_vacations pv
      LEFT JOIN agents a ON pv.agent_id = a.id
      LEFT JOIN postes_operationnels pop ON pv.poste_operationnel_id = pop.id
      WHERE pv.id = $1
    `, [id]);

    if (res.rows.length === 0) return null;
    const r = res.rows[0];
    return {
      id: r.id,
      unite_id: r.unite_id,
      agent_id: r.agent_id,
      poste_operationnel_id: r.poste_operationnel_id,
      type_vacation: r.type_vacation,
      date_debut: r.date_debut?.toISOString(),
      date_fin: r.date_fin?.toISOString(),
      statut: r.statut,
      motif_modification: r.motif_modification,
      cree_par: r.cree_par,
      cree_le: r.cree_le?.toISOString(),
      modifie_le: r.modifie_le?.toISOString(),
      agent_nom: r.agent_nom,
      agent_prenom: r.agent_prenom,
      agent_grade: r.agent_grade,
      agent_matricule: r.agent_matricule,
      poste_libelle: r.poste_libelle,
      heures_nuit: this.calculerHeuresNuit(new Date(r.date_debut), new Date(r.date_fin))
    };
  }

  async modifierVacation(
    id: string,
    dto: ModifierVacationDto,
    auteurId: string,
    nomAuteur: string,
    roleAuteur: string,
    ip: string
  ): Promise<PlanningVacationDto> {
    const res = await pool.query('SELECT * FROM plannings_vacations WHERE id = $1', [id]);
    if (res.rows.length === 0) {
      throw new HttpError(404, `Vacation (${id}) introuvable.`, "VACATION_INTROUVABLE");
    }

    const updates: string[] = ['modifie_le = CURRENT_TIMESTAMP'];
    const params: any[] = [id];
    let idx = 2;

    if (dto.statut) {
      updates.push(`statut = $${idx++}`);
      params.push(dto.statut);
    }
    if (dto.poste_operationnel_id !== undefined) {
      updates.push(`poste_operationnel_id = $${idx++}`);
      params.push(dto.poste_operationnel_id);
    }
    if (dto.motif_modification) {
      updates.push(`motif_modification = $${idx++}`);
      params.push(dto.motif_modification);
    }

    const sql = `UPDATE plannings_vacations SET ${updates.join(', ')} WHERE id = $1 RETURNING *;`;
    const resUp = await pool.query(sql, params);
    const r = resUp.rows[0];

    await auditService.enregistrer({
      utilisateur_id: auteurId,
      nom_utilisateur: nomAuteur,
      role_utilise: roleAuteur,
      adresse_ip: ip,
      action_type: 'MODIFICATION_VACATION_PLANNING',
      entite_cible: 'PLANNING_VACATION',
      entite_id: id,
      details_operation_json: dto,
      statut_operation: 'SUCCES'
    });

    return {
      id: r.id,
      unite_id: r.unite_id,
      agent_id: r.agent_id,
      poste_operationnel_id: r.poste_operationnel_id,
      type_vacation: r.type_vacation,
      date_debut: r.date_debut?.toISOString(),
      date_fin: r.date_fin?.toISOString(),
      statut: r.statut,
      motif_modification: r.motif_modification,
      cree_par: r.cree_par,
      modifie_le: r.modifie_le?.toISOString(),
      heures_nuit: this.calculerHeuresNuit(new Date(r.date_debut), new Date(r.date_fin))
    };
  }

  async obtenirAlerteSousEffectif(uniteId: string, dateStr?: string): Promise<AlerteSousEffectifDto> {
    const dateCible = dateStr ? new Date(dateStr) : new Date();
    const debutJour = new Date(Date.UTC(dateCible.getUTCFullYear(), dateCible.getUTCMonth(), dateCible.getUTCDate(), 0, 0, 0));
    const finJour = new Date(Date.UTC(dateCible.getUTCFullYear(), dateCible.getUTCMonth(), dateCible.getUTCDate(), 23, 59, 59));

    // Effectif cible = somme des effectifs cibles des postes opérationnels de l'unité
    const resPostes = await pool.query(`
      SELECT COALESCE(SUM(effectif_cible), 0) AS total_cible
      FROM postes_operationnels
      WHERE unite_id = $1 AND est_actif = TRUE;
    `, [uniteId]);

    let effectifCible = parseInt(resPostes.rows[0]?.total_cible || '0', 10);
    if (effectifCible === 0) {
      // Fallback sur le nombre d'agents affectés à l'unité
      const resAgents = await pool.query('SELECT COUNT(*) AS total FROM agents WHERE unite_actuelle_id = $1 AND est_actif = TRUE', [uniteId]);
      effectifCible = parseInt(resAgents.rows[0]?.total || '1', 10);
    }

    // Effectif planifié distinct
    const resPlanifie = await pool.query(`
      SELECT COUNT(DISTINCT agent_id) AS total_planifie
      FROM plannings_vacations
      WHERE unite_id = $1
        AND statut NOT IN ('annule', 'remplace')
        AND date_fin >= $2 AND date_debut <= $3;
    `, [uniteId, debutJour.toISOString(), finJour.toISOString()]);

    const effectifPlanifie = parseInt(resPlanifie.rows[0]?.total_planifie || '0', 10);
    const ratio = effectifCible > 0 ? (effectifPlanifie / effectifCible) : 1;
    const seuilCritique = 0.40; // 40% seuil minimal réglementaire (HYP-14)
    const enAlerte = ratio < seuilCritique;

    return {
      unite_id: uniteId,
      date: debutJour.toISOString().split('T')[0],
      effectif_cible_total: effectifCible,
      effectif_planifie: effectifPlanifie,
      ratio_presence: Math.round(ratio * 100) / 100,
      alerte_sous_effectif: enAlerte,
      seuil_critique_pct: seuilCritique * 100,
      message_alerte: enAlerte
        ? `ALERTE CRITIQUE : Taux de couverture de brigade à ${Math.round(ratio * 100)}% (seuil réglementaire minimal : 40%).`
        : `Couverture opérationnelle normale : ${Math.round(ratio * 100)}%.`
    };
  }

  // ==========================================================================
  // 3. REMPLACEMENTS D'URGENCE ET VACANCES DE POSTE
  // ==========================================================================

  async trouverCandidatsEligibles(planningVacationId: string, uniteIdFiltre?: string): Promise<CandidatEligibleDto[]> {
    const resVac = await pool.query('SELECT * FROM plannings_vacations WHERE id = $1', [planningVacationId]);
    if (resVac.rows.length === 0) {
      throw new HttpError(404, `Vacation (${planningVacationId}) introuvable.`, "VACATION_INTROUVABLE");
    }
    const vacation = resVac.rows[0];
    const debut = new Date(vacation.date_debut);
    const fin = new Date(vacation.date_fin);
    const uniteId = uniteIdFiltre || vacation.unite_id;

    // Récupération des exigences du poste opérationnel s'il existe
    let tirRequis = false;
    let qualifRequise = 'aucun';
    if (vacation.poste_operationnel_id) {
      const resPoste = await pool.query('SELECT * FROM postes_operationnels WHERE id = $1', [vacation.poste_operationnel_id]);
      if (resPoste.rows.length > 0) {
        tirRequis = resPoste.rows[0].tir_requis;
        qualifRequise = resPoste.rows[0].niveau_qualification_requis;
      }
    }

    // Récupération de tous les agents de l'unité ou rattachés, hors l'agent absent
    const resAgents = await pool.query(`
      SELECT a.* FROM agents a
      WHERE a.est_actif = TRUE
        AND a.statut_administratif = 'EN_ACTIVITE'
        AND a.id <> $1
        AND a.unite_actuelle_id = $2;
    `, [vacation.agent_id, uniteId]);

    const candidats: CandidatEligibleDto[] = [];

    for (const ag of resAgents.rows) {
      // 1. Conflit direct de vacation
      const resConflit = await pool.query(`
        SELECT 1 FROM plannings_vacations
        WHERE agent_id = $1 AND statut NOT IN ('annule', 'remplace')
          AND (date_debut, date_fin) OVERLAPS ($2, $3);
      `, [ag.id, debut.toISOString(), fin.toISOString()]);

      if (resConflit.rows.length > 0) {
        continue; // Occupé sur ce créneau
      }

      // 2. Repos préalable minimal (11h)
      const resPrecedente = await pool.query(`
        SELECT date_fin FROM plannings_vacations
        WHERE agent_id = $1 AND statut NOT IN ('annule', 'remplace')
          AND date_fin <= $2
        ORDER BY date_fin DESC LIMIT 1;
      `, [ag.id, debut.toISOString()]);

      let reposHeures = 24.0;
      if (resPrecedente.rows.length > 0) {
        const finPrec = new Date(resPrecedente.rows[0].date_fin);
        reposHeures = (debut.getTime() - finPrec.getTime()) / (1000 * 3600);
      }

      if (reposHeures < 10.999) {
        continue; // Repos insuffisant
      }

      // 3. Tir valide si requis
      let tirValide = true;
      if (tirRequis) {
        const resTir = await pool.query(`
          SELECT 1 FROM qualifications_agents
          WHERE agent_id = $1
            AND type_qualification IN ('CERTIFICAT_TIR_REGLEMENTAIRE', 'BREVET_TIR')
            AND (date_expiration IS NULL OR date_expiration >= $2)
            AND statut_actif = TRUE;
        `, [ag.id, debut.toISOString().split('T')[0]]);

        const resDispense = await pool.query(`
          SELECT 1 FROM aptitudes_administratives
          WHERE agent_id = $1 
            AND (code_restriction = 'DISPENSE_PORT_ARME' OR decision_aptitude = 'INAPTE_TEMPORAIRE_PORT_ARME')
            AND (date_expiration IS NULL OR date_expiration >= $2);
        `, [ag.id, debut.toISOString().split('T')[0]]);

        if (resTir.rows.length === 0 || resDispense.rows.length > 0) {
          tirValide = false;
        }
      }

      if (tirRequis && !tirValide) {
        continue; // Éliminé si poste armé et tir non valide
      }

      // Calcul du score d'éligibilité
      let score = 80;
      const motifs: string[] = ['Disponible et repos réglementaire de 11h respecté'];

      if (ag.unite_actuelle_id === vacation.unite_id) {
        score += 15;
        motifs.push('Agent de la même unité territoriale');
      }

      if (tirValide) {
        score += 5;
        motifs.push('Certificat de tir réglementaire valide');
      }

      candidats.push({
        agent_id: ag.id,
        nom: ag.nom,
        prenom: ag.prenom,
        matricule: ag.matricule,
        grade: ag.grade_actuel,
        unite_id: ag.unite_actuelle_id,
        score_eligibilite: Math.min(score, 100),
        repos_heures_observees: Math.round(reposHeures * 10) / 10,
        tir_valide: tirValide,
        qualification_judiciaire: qualifRequise,
        motifs_eligibilite: motifs
      });
    }

    candidats.sort((a, b) => b.score_eligibilite - a.score_eligibilite);
    return candidats;
  }

  async ordonnerRemplacement(
    dto: OrdonnerRemplacementDto,
    chefId: string,
    nomChef: string,
    roleChef: string,
    ip: string
  ): Promise<{ remplacement: RemplacementGardeDto; nouvelle_vacation: PlanningVacationDto }> {
    return await transaction(async (client) => {
      const resVac = await client.query('SELECT * FROM plannings_vacations WHERE id = $1 FOR UPDATE', [dto.planning_vacation_id]);
      if (resVac.rows.length === 0) {
        throw new HttpError(404, `Vacation initiale (${dto.planning_vacation_id}) introuvable.`, "VACATION_INTROUVABLE");
      }
      const ancienneVac = resVac.rows[0];

      if (ancienneVac.statut === 'remplace') {
        throw new HttpError(409, "Cette vacation a déjà fait l'objet d'un remplacement.", "DEJA_REMPLACE");
      }

      const agentAbsentId = dto.agent_absent_id || ancienneVac.agent_id;
      if (agentAbsentId === dto.agent_remplacant_id) {
        throw new HttpError(400, "L'agent remplaçant ne peut pas être identique à l'agent absent.", "AGENTS_IDENTIQUES");
      }

      // 1. Validation de l'existence de l'agent remplaçant
      const resRemplacant = await client.query('SELECT * FROM agents WHERE id = $1', [dto.agent_remplacant_id]);
      if (resRemplacant.rows.length === 0) {
        throw new HttpError(404, `Agent remplaçant (${dto.agent_remplacant_id}) introuvable.`, "AGENT_INTROUVABLE");
      }

      const debut = new Date(ancienneVac.date_debut);
      const fin = new Date(ancienneVac.date_fin);

      // 2. Prévention des chevauchements temporels de vacation pour le remplaçant
      const resChevauchement = await client.query(`
        SELECT 1 FROM plannings_vacations
        WHERE agent_id = $1 AND statut NOT IN ('annule', 'remplace')
          AND id <> $2
          AND (date_debut, date_fin) OVERLAPS ($3, $4);
      `, [dto.agent_remplacant_id, ancienneVac.id, debut.toISOString(), fin.toISOString()]);

      if (resChevauchement.rows.length > 0) {
        throw new HttpError(
          400,
          "Violation planning : L'agent remplaçant est déjà planifié sur une vacation chevauchant ce créneau horaire.",
          "CHEVOUCHEMENT_DETECTE"
        );
      }

      // 3. Règle du repos physiologique minimal (11 heures consécutives)
      // 3.a. Vacation antérieure la plus proche
      const resPrecedente = await client.query(`
        SELECT date_fin FROM plannings_vacations
        WHERE agent_id = $1 AND statut NOT IN ('annule', 'remplace')
          AND id <> $2
          AND date_fin <= $3
        ORDER BY date_fin DESC LIMIT 1;
      `, [dto.agent_remplacant_id, ancienneVac.id, debut.toISOString()]);

      if (resPrecedente.rows.length > 0) {
        const finPrecedente = new Date(resPrecedente.rows[0].date_fin);
        const reposPrecedentHeures = (debut.getTime() - finPrecedente.getTime()) / (1000 * 3600);
        if (reposPrecedentHeures < 10.999) {
          throw new HttpError(
            400,
            `Violation du temps de repos légal : seulement ${reposPrecedentHeures.toFixed(1)}h de repos observées (minimum statutaire : 11h consécutives).`,
            "REPOS_MINIMAL_INSUFFISANT"
          );
        }
      }

      // 3.b. Vacation postérieure la plus proche
      const resPosterieure = await client.query(`
        SELECT date_debut FROM plannings_vacations
        WHERE agent_id = $1 AND statut NOT IN ('annule', 'remplace')
          AND id <> $2
          AND date_debut >= $3
        ORDER BY date_debut ASC LIMIT 1;
      `, [dto.agent_remplacant_id, ancienneVac.id, fin.toISOString()]);

      if (resPosterieure.rows.length > 0) {
        const debutPosterieur = new Date(resPosterieure.rows[0].date_debut);
        const reposPosterieurHeures = (debutPosterieur.getTime() - fin.getTime()) / (1000 * 3600);
        if (reposPosterieurHeures < 10.999) {
          throw new HttpError(
            400,
            `Violation du temps de repos légal avec le service suivant : seulement ${reposPosterieurHeures.toFixed(1)}h de repos observées (minimum statutaire : 11h consécutives).`,
            "REPOS_MINIMAL_INSUFFISANT"
          );
        }
      }

      // 4. Contrôle strict de l'armement réglementaire et des aptitudes administratives
      if (ancienneVac.poste_operationnel_id) {
        const resPoste = await client.query(
          'SELECT * FROM postes_operationnels WHERE id = $1',
          [ancienneVac.poste_operationnel_id]
        );

        if (resPoste.rows.length > 0) {
          const poste = resPoste.rows[0];

          if (poste.tir_requis) {
            const dateRef = debut.toISOString().split('T')[0];

            // 4.a. Vérification du certificat de tir annuel réglementaire valide et actif
            const resTir = await client.query(`
              SELECT * FROM qualifications_agents
              WHERE agent_id = $1 
                AND type_qualification IN ('CERTIFICAT_TIR_REGLEMENTAIRE', 'BREVET_TIR')
                AND (date_expiration IS NULL OR date_expiration >= $2)
                AND statut_actif = TRUE;
            `, [dto.agent_remplacant_id, dateRef]);

            if (resTir.rows.length === 0) {
              throw new HttpError(
                400,
                "Affectation armée bloquée : Le certificat annuel de tir et d'armement réglementaire de l'agent remplaçant est expiré ou absent.",
                "CERTIFICAT_TIR_EXPIRE"
              );
            }

            // 4.b. Vérification de l'absence de restriction d'arme administrative
            const resAptitude = await client.query(`
              SELECT * FROM aptitudes_administratives
              WHERE agent_id = $1 
                AND (code_restriction = 'DISPENSE_PORT_ARME' OR decision_aptitude = 'INAPTE_TEMPORAIRE_PORT_ARME')
                AND (date_expiration IS NULL OR date_expiration >= $2);
            `, [dto.agent_remplacant_id, dateRef]);

            if (resAptitude.rows.length > 0) {
              throw new HttpError(
                400,
                "Affectation armée bloquée : L'agent remplaçant fait l'objet d'une dispense ou restriction administrative de port d'arme.",
                "DISPENSE_ARME_ACTIVE"
              );
            }
          }
        }
      }

      // Marquer l'ancienne vacation comme remplacée
      await client.query(`
        UPDATE plannings_vacations
        SET statut = 'remplace', motif_modification = $2, modifie_le = CURRENT_TIMESTAMP
        WHERE id = $1;
      `, [ancienneVac.id, `Remplacé par agent ${dto.agent_remplacant_id} (${dto.motif || 'urgence'})`]);

      // Créer la nouvelle vacation pour le remplaçant avec gestion d'erreur trigger
      const nouvVacId = `vac-remp-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
      let nv;
      try {
        const resNouv = await client.query(`
          INSERT INTO plannings_vacations (
            id, unite_id, agent_id, poste_operationnel_id, type_vacation,
            date_debut, date_fin, statut, motif_modification, cree_par
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'valide', $8, $9)
          RETURNING *;
        `, [
          nouvVacId, ancienneVac.unite_id, dto.agent_remplacant_id, ancienneVac.poste_operationnel_id,
          ancienneVac.type_vacation, ancienneVac.date_debut, ancienneVac.date_fin,
          `Remplacement d'office de ${ancienneVac.agent_id}`, chefId
        ]);
        nv = resNouv.rows[0];
      } catch (err: any) {
        if (err.code === '23505' || err.message?.includes('VIOLATION PLANNING')) {
          throw new HttpError(
            400,
            "Violation planning : L'agent remplaçant est déjà planifié sur une vacation chevauchant ce créneau horaire.",
            "CHEVOUCHEMENT_DETECTE"
          );
        }
        throw err;
      }

      // Enregistrer le remplacement dans remplacements_gardes
      const rempId = `remp-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
      const dateRemplacement = dto.date_remplacement || new Date(ancienneVac.date_debut).toISOString().split('T')[0];
      const resRemp = await client.query(`
        INSERT INTO remplacements_gardes (
          id, planning_vacation_id, agent_absent_id, agent_remplacant_id,
          motif, date_remplacement, valide_par, statut, commentaire
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'valide', $8)
        RETURNING *;
      `, [
        rempId, ancienneVac.id, agentAbsentId, dto.agent_remplacant_id,
        dto.motif || 'urgence', dateRemplacement, chefId, dto.commentaire || null
      ]);
      const rg = resRemp.rows[0];

      // Audit
      await auditService.enregistrer({
        utilisateur_id: chefId,
        nom_utilisateur: nomChef,
        role_utilise: roleChef,
        adresse_ip: ip,
        action_type: 'REMPLACEMENT_URGENCE_PLANNING',
        entite_cible: 'REMPLACEMENTS_GARDES',
        entite_id: rg.id,
        details_operation_json: {
          vacation_initiale_id: ancienneVac.id,
          agent_absent_id: agentAbsentId,
          agent_remplacant_id: dto.agent_remplacant_id,
          nouvelle_vacation_id: nv.id,
          motif: dto.motif || 'urgence'
        },
        statut_operation: 'SUCCES'
      });

      return {
        remplacement: {
          id: rg.id,
          planning_vacation_id: rg.planning_vacation_id,
          agent_absent_id: rg.agent_absent_id,
          agent_remplacant_id: rg.agent_remplacant_id,
          motif: rg.motif,
          date_remplacement: rg.date_remplacement?.toISOString ? rg.date_remplacement.toISOString().split('T')[0] : rg.date_remplacement,
          valide_par: rg.valide_par,
          valide_le: rg.valide_le?.toISOString(),
          statut: rg.statut,
          commentaire: rg.commentaire
        },
        nouvelle_vacation: {
          id: nv.id,
          unite_id: nv.unite_id,
          agent_id: nv.agent_id,
          poste_operationnel_id: nv.poste_operationnel_id,
          type_vacation: nv.type_vacation,
          date_debut: nv.date_debut?.toISOString(),
          date_fin: nv.date_fin?.toISOString(),
          statut: nv.statut,
          cree_par: nv.cree_par
        }
      };
    });
  }

  // ==========================================================================
  // 4. MODULE DISCIPLINAIRE STRICTEMENT CLOISONNÉ (LOIS 48/AN/72 & 116/AN/21)
  // ==========================================================================

  verifierHabilitationDiscipline(role: string, utilisateurId: string): void {
    if (role !== 'GESTIONNAIRE_RH') {
      throw new HttpError(
        403,
        "Accès interdit : La consultation des dossiers disciplinaires est strictement réservée à la Direction Générale et à la Commission de discipline.",
        "ACCES_INTERDIT"
      );
    }
  }

  async listerDossiersDisciplinaires(filtres: { agentId?: string; phase?: string; statut?: string }): Promise<DossierDisciplinaireDto[]> {
    let sql = `
      SELECT dd.*, a.nom AS agent_nom, a.prenom AS agent_prenom,
             a.matricule AS agent_matricule, a.grade_actuel AS agent_grade
      FROM dossiers_disciplinaires dd
      JOIN agents a ON dd.agent_id = a.id
      WHERE 1=1
    `;
    const params: any[] = [];
    let idx = 1;

    if (filtres.agentId) {
      sql += ` AND dd.agent_id = $${idx++}`;
      params.push(filtres.agentId);
    }
    if (filtres.phase) {
      sql += ` AND dd.phase_procedure = $${idx++}`;
      params.push(filtres.phase);
    }
    if (filtres.statut) {
      sql += ` AND dd.statut = $${idx++}`;
      params.push(filtres.statut);
    }

    sql += ' ORDER BY dd.date_faits DESC';
    const res = await pool.query(sql, params);

    return res.rows.map(r => ({
      id: r.id,
      numero_dossier: r.numero_dossier,
      agent_id: r.agent_id,
      phase_procedure: r.phase_procedure,
      date_faits: r.date_faits?.toISOString ? r.date_faits.toISOString().split('T')[0] : r.date_faits,
      description_sommaire: r.description_sommaire,
      description_faits: r.description_faits,
      rapport_enquete: r.rapport_enquete,
      officier_instructeur_id: r.officier_instructeur_id,
      sanction_retenue: r.sanction_retenue,
      date_decision: r.date_decision?.toISOString ? r.date_decision.toISOString().split('T')[0] : r.date_decision,
      motif_decision: r.motif_decision,
      statut_dossier: r.statut_dossier,
      statut: r.statut || r.statut_dossier,
      niveau_confidentialite: r.niveau_confidentialite,
      degre_confidentialite: r.degre_confidentialite,
      ouvert_par: r.ouvert_par,
      date_cloture: r.date_cloture?.toISOString ? r.date_cloture.toISOString().split('T')[0] : r.date_cloture,
      cree_le: r.cree_le?.toISOString(),
      modifie_le: r.modifie_le?.toISOString(),
      agent_nom: r.agent_nom,
      agent_prenom: r.agent_prenom,
      agent_matricule: r.agent_matricule,
      agent_grade: r.agent_grade
    }));
  }

  async obtenirDossierDisciplinaire(id: string): Promise<DossierDisciplinaireDto> {
    const res = await pool.query(`
      SELECT dd.*, a.nom AS agent_nom, a.prenom AS agent_prenom,
             a.matricule AS agent_matricule, a.grade_actuel AS agent_grade
      FROM dossiers_disciplinaires dd
      JOIN agents a ON dd.agent_id = a.id
      WHERE dd.id = $1 OR dd.numero_dossier = $1;
    `, [id]);

    if (res.rows.length === 0) {
      throw new HttpError(404, `Dossier disciplinaire (${id}) introuvable.`, "DOSSIER_INTROUVABLE");
    }
    const r = res.rows[0];

    // Sanctions rattachées
    const resSanc = await pool.query('SELECT * FROM sanctions_disciplinaires WHERE dossier_id = $1 ORDER BY date_effet DESC', [r.id]);
    const sanctions: SanctionDisciplinaireDto[] = resSanc.rows.map(s => ({
      id: s.id,
      dossier_id: s.dossier_id,
      agent_id: s.agent_id,
      groupe_sanction: s.groupe_sanction,
      nature_sanction: s.nature_sanction,
      duree_exclusion_jours: s.duree_exclusion_jours,
      date_effet: s.date_effet?.toISOString ? s.date_effet.toISOString().split('T')[0] : s.date_effet,
      date_fin: s.date_fin?.toISOString ? s.date_fin.toISOString().split('T')[0] : s.date_fin,
      date_effacement_prevue: s.date_effacement_prevue?.toISOString ? s.date_effacement_prevue.toISOString().split('T')[0] : s.date_effacement_prevue,
      est_amnistiee: s.est_amnistiee,
      reference_arrete: s.reference_arrete,
      prononcee_par: s.prononcee_par,
      date_decision: s.date_decision?.toISOString ? s.date_decision.toISOString().split('T')[0] : s.date_decision,
      motif_sanction: s.motif_sanction,
      cree_le: s.cree_le?.toISOString()
    }));

    return {
      id: r.id,
      numero_dossier: r.numero_dossier,
      agent_id: r.agent_id,
      phase_procedure: r.phase_procedure,
      date_faits: r.date_faits?.toISOString ? r.date_faits.toISOString().split('T')[0] : r.date_faits,
      description_sommaire: r.description_sommaire,
      description_faits: r.description_faits,
      rapport_enquete: r.rapport_enquete,
      officier_instructeur_id: r.officier_instructeur_id,
      sanction_retenue: r.sanction_retenue,
      date_decision: r.date_decision?.toISOString ? r.date_decision.toISOString().split('T')[0] : r.date_decision,
      motif_decision: r.motif_decision,
      statut_dossier: r.statut_dossier,
      statut: r.statut || r.statut_dossier,
      niveau_confidentialite: r.niveau_confidentialite,
      degre_confidentialite: r.degre_confidentialite,
      ouvert_par: r.ouvert_par,
      date_cloture: r.date_cloture?.toISOString ? r.date_cloture.toISOString().split('T')[0] : r.date_cloture,
      cree_le: r.cree_le?.toISOString(),
      modifie_le: r.modifie_le?.toISOString(),
      agent_nom: r.agent_nom,
      agent_prenom: r.agent_prenom,
      agent_matricule: r.agent_matricule,
      agent_grade: r.agent_grade,
      sanctions
    };
  }

  async creerDossierDisciplinaire(
    dto: CreerDossierDisciplinaireDto,
    auteurId: string,
    nomAuteur: string,
    roleAuteur: string,
    ip: string
  ): Promise<DossierDisciplinaireDto> {
    const id = `dos-disc-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
    const numeroDossier = dto.numero_dossier || `DISC-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`;

    const sql = `
      INSERT INTO dossiers_disciplinaires (
        id, agent_id, numero_dossier, phase_procedure, date_faits,
        description_sommaire, description_faits, rapport_enquete,
        officier_instructeur_id, statut_dossier, statut,
        niveau_confidentialite, degre_confidentialite, ouvert_par
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'EN_COURS', 'instruction', 'TRES_SECRET', 'TRES_SECRET_DISCIPLINE', $10)
      RETURNING *;
    `;
    const params = [
      id, dto.agent_id, numeroDossier, dto.phase_procedure || 'ALLEGATION',
      dto.date_faits, dto.description_sommaire, dto.description_faits || null,
      dto.rapport_enquete || null, dto.officier_instructeur_id || auteurId, auteurId
    ];

    const res = await pool.query(sql, params);
    const r = res.rows[0];

    await auditService.enregistrer({
      utilisateur_id: auteurId,
      nom_utilisateur: nomAuteur,
      role_utilise: roleAuteur,
      adresse_ip: ip,
      action_type: 'OUVERTURE_DOSSIER_DISCIPLINAIRE',
      entite_cible: 'DOSSIERS_DISCIPLINAIRES',
      entite_id: r.id,
      details_operation_json: {
        numero_dossier: r.numero_dossier,
        agent_id: r.agent_id,
        phase_procedure: r.phase_procedure
      },
      statut_operation: 'SUCCES'
    });

    return await this.obtenirDossierDisciplinaire(r.id);
  }

  async transitionnerPhaseDossier(
    id: string,
    dto: TransitionPhaseDossierDto,
    auteurId: string,
    nomAuteur: string,
    roleAuteur: string,
    ip: string
  ): Promise<DossierDisciplinaireDto> {
    const res = await pool.query('SELECT * FROM dossiers_disciplinaires WHERE id = $1', [id]);
    if (res.rows.length === 0) {
      throw new HttpError(404, `Dossier disciplinaire (${id}) introuvable.`, "DOSSIER_INTROUVABLE");
    }

    const updates = ['phase_procedure = $2', 'modifie_le = CURRENT_TIMESTAMP'];
    const params: any[] = [id, dto.phase_procedure];
    let idx = 3;

    if (dto.statut) {
      updates.push(`statut = $${idx++}`);
      params.push(dto.statut);
    }
    if (dto.rapport_enquete) {
      updates.push(`rapport_enquete = $${idx++}`);
      params.push(dto.rapport_enquete);
    }
    if (dto.phase_procedure === 'SANCTION_PRONONCEE' || dto.phase_procedure === 'CLASSEMENT_SANS_SUITE') {
      updates.push(`date_cloture = CURRENT_DATE`);
    }

    await pool.query(`UPDATE dossiers_disciplinaires SET ${updates.join(', ')} WHERE id = $1`, params);

    await auditService.enregistrer({
      utilisateur_id: auteurId,
      nom_utilisateur: nomAuteur,
      role_utilise: roleAuteur,
      adresse_ip: ip,
      action_type: 'TRANSITION_PHASE_DISCIPLINAIRE',
      entite_cible: 'DOSSIERS_DISCIPLINAIRES',
      entite_id: id,
      details_operation_json: dto,
      statut_operation: 'SUCCES'
    });

    return await this.obtenirDossierDisciplinaire(id);
  }

  async enregistrerSanctionDisciplinaire(
    dto: EnregistrerSanctionDto,
    auteurId: string,
    nomAuteur: string,
    roleAuteur: string,
    ip: string
  ): Promise<SanctionDisciplinaireDto> {
    const resDossier = await pool.query('SELECT * FROM dossiers_disciplinaires WHERE id = $1', [dto.dossier_id]);
    if (resDossier.rows.length === 0) {
      throw new HttpError(404, `Dossier disciplinaire (${dto.dossier_id}) introuvable.`, "DOSSIER_INTROUVABLE");
    }
    const dossier = resDossier.rows[0];
    const agentId = dto.agent_id || dossier.agent_id;

    // Validation du groupe et de la nature
    const naturesGroupe1 = ['avertissement', 'blame'];
    const naturesGroupe2 = ['radiation_tableau_avancement', 'abaissement_echelon', 'exclusion_temporaire'];
    const naturesGroupe3 = ['retrogradation', 'mise_retraite_office', 'revocation'];

    if (dto.groupe_sanction === 'GROUPE_1' && !naturesGroupe1.includes(dto.nature_sanction)) {
      throw new HttpError(400, `Nature de sanction incompatible avec le Groupe 1 : ${dto.nature_sanction}`, "NATURE_SANCTION_INCOMPATIBLE");
    }
    if (dto.groupe_sanction === 'GROUPE_2' && !naturesGroupe2.includes(dto.nature_sanction)) {
      throw new HttpError(400, `Nature de sanction incompatible avec le Groupe 2 : ${dto.nature_sanction}`, "NATURE_SANCTION_INCOMPATIBLE");
    }
    if (dto.groupe_sanction === 'GROUPE_3' && !naturesGroupe3.includes(dto.nature_sanction)) {
      throw new HttpError(400, `Nature de sanction incompatible avec le Groupe 3 : ${dto.nature_sanction}`, "NATURE_SANCTION_INCOMPATIBLE");
    }

    // Calcul date d'effacement automatique pour Groupe 1 (36 mois / 3 ans - HYP-12)
    let dateEffacement: string | null = null;
    if (dto.groupe_sanction === 'GROUPE_1') {
      const dEffet = new Date(dto.date_effet);
      dEffet.setUTCFullYear(dEffet.getUTCFullYear() + 3);
      dateEffacement = dEffet.toISOString().split('T')[0];
    }

    const sanctionId = `sanc-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
    const dateDecision = dto.date_decision || new Date().toISOString().split('T')[0];

    return await transaction(async (client) => {
      const sqlSanc = `
        INSERT INTO sanctions_disciplinaires (
          id, dossier_id, agent_id, groupe_sanction, nature_sanction,
          duree_exclusion_jours, date_effet, date_fin, date_effacement_prevue,
          est_amnistiee, reference_arrete, prononcee_par, date_decision, motif_sanction
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, FALSE, $10, $11, $12, $13)
        RETURNING *;
      `;
      const paramsSanc = [
        sanctionId, dto.dossier_id, agentId, dto.groupe_sanction, dto.nature_sanction,
        dto.duree_exclusion_jours || null, dto.date_effet, dto.date_fin || null,
        dateEffacement, dto.reference_arrete, dto.prononcee_par, dateDecision, dto.motif_sanction
      ];
      const resIns = await client.query(sqlSanc, paramsSanc);
      const s = resIns.rows[0];

      // Clôture du dossier disciplinaire en sanction prononcée
      await client.query(`
        UPDATE dossiers_disciplinaires
        SET phase_procedure = 'SANCTION_PRONONCEE',
            statut = 'sanction_prononcee',
            statut_dossier = 'CLOS',
            sanction_retenue = $2,
            date_decision = $3,
            motif_decision = $4,
            date_cloture = CURRENT_DATE,
            modifie_le = CURRENT_TIMESTAMP
        WHERE id = $1;
      `, [dto.dossier_id, dto.nature_sanction, dateDecision, dto.motif_sanction]);

      // Si sanction du Groupe 2 ou 3 : retrait du tableau d'avancement (HYP-11)
      if (dto.groupe_sanction === 'GROUPE_2' || dto.groupe_sanction === 'GROUPE_3') {
        await client.query(`
          UPDATE tableaux_avancement_propositions
          SET est_promouvable = FALSE, avis_commission = 'DEFAVORABLE_SANCTION_DISCIPLINAIRE'
          WHERE agent_id = $1 AND statut_proposition = 'PROPOSE';
        `, [agentId]);
      }

      // Audit forensique
      await auditService.enregistrer({
        utilisateur_id: auteurId,
        nom_utilisateur: nomAuteur,
        role_utilise: roleAuteur,
        adresse_ip: ip,
        action_type: 'SANCTION_DISCIPLINAIRE_PRONONCEE',
        entite_cible: 'SANCTIONS_DISCIPLINAIRES',
        entite_id: s.id,
        details_operation_json: {
          dossier_id: dto.dossier_id,
          agent_id: agentId,
          groupe_sanction: dto.groupe_sanction,
          nature_sanction: dto.nature_sanction,
          reference_arrete: dto.reference_arrete
        },
        statut_operation: 'SUCCES'
      });

      return {
        id: s.id,
        dossier_id: s.dossier_id,
        agent_id: s.agent_id,
        groupe_sanction: s.groupe_sanction,
        nature_sanction: s.nature_sanction,
        duree_exclusion_jours: s.duree_exclusion_jours,
        date_effet: s.date_effet?.toISOString ? s.date_effet.toISOString().split('T')[0] : s.date_effet,
        date_fin: s.date_fin?.toISOString ? s.date_fin.toISOString().split('T')[0] : s.date_fin,
        date_effacement_prevue: s.date_effacement_prevue?.toISOString ? s.date_effacement_prevue.toISOString().split('T')[0] : s.date_effacement_prevue,
        est_amnistiee: s.est_amnistiee,
        reference_arrete: s.reference_arrete,
        prononcee_par: s.prononcee_par,
        date_decision: s.date_decision?.toISOString ? s.date_decision.toISOString().split('T')[0] : s.date_decision,
        motif_sanction: s.motif_sanction,
        cree_le: s.cree_le?.toISOString()
      };
    });
  }

  // ==========================================================================
  // 5. APTITUDE ADMINISTRATIVE (SANCTUAIRE SANS DONNÉES MÉDICALES)
  // ==========================================================================

  verifierSecretMedical(texte?: string): void {
    if (!texte) return;
    if (REGEX_MEDICALE.test(texte)) {
      throw new HttpError(
        422,
        "Violation du secret médical : La mention de termes médicaux ou diagnostics est formellement prohibée dans le SIRH.",
        "DONNEE_MEDICALE_PROHIBEE"
      );
    }
  }

  async obtenirAptitudeAgent(agentId: string): Promise<AptitudeAdministrativeDto[]> {
    const res = await pool.query(`
      SELECT * FROM aptitudes_administratives
      WHERE agent_id = $1
      ORDER BY date_decision DESC;
    `, [agentId]);

    return res.rows.map(r => ({
      id: r.id,
      agent_id: r.agent_id,
      numero_certificat_administratif: r.numero_certificat_administratif,
      decision_aptitude: r.decision_aptitude,
      type_conclusion: r.type_conclusion,
      code_restriction: r.code_restriction,
      restriction_operationnelle: r.restriction_operationnelle,
      date_decision: r.date_decision?.toISOString ? r.date_decision.toISOString().split('T')[0] : r.date_decision,
      date_expiration: r.date_expiration?.toISOString ? r.date_expiration.toISOString().split('T')[0] : r.date_expiration,
      date_echeance: r.date_echeance?.toISOString ? r.date_echeance.toISOString().split('T')[0] : r.date_echeance,
      reference_arrete_commissariat: r.reference_arrete_commissariat,
      identifiant_medecin_militaire_referent: r.identifiant_medecin_militaire_referent,
      reference_certificat_scelle: r.reference_certificat_scelle,
      enregistre_par: r.enregistre_par,
      cree_le: r.cree_le?.toISOString()
    }));
  }

  async enregistrerAptitudeAdministrative(
    dto: EnregistrerAptitudeDto,
    auteurId: string,
    nomAuteur: string,
    roleAuteur: string,
    ip: string
  ): Promise<AptitudeAdministrativeDto> {
    const restrictionTexte = dto.restriction_operationnelle || dto.restrictions_operationnelles || '';
    this.verifierSecretMedical(restrictionTexte);
    this.verifierSecretMedical(dto.numero_certificat_administratif);
    this.verifierSecretMedical(dto.numero_certificat);

    const id = `apt-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
    const numeroCertificat = dto.numero_certificat_administratif || dto.numero_certificat || `CERT-ADM-${Date.now()}`;
    const decision = dto.decision_aptitude || 'APTE_SERVICE_ACTIF';
    const conclusion = dto.type_conclusion || 'APTE_SANS_RESTRICTION';
    const restrictionCode = dto.code_restriction || (decision === 'INAPTE_TEMPORAIRE_PORT_ARME' ? 'DISPENSE_PORT_ARME' : 'AUCUNE_RESTRICTION');
    const dateEcheance = dto.date_echeance || dto.date_expiration || null;

    try {
      const sql = `
        INSERT INTO aptitudes_administratives (
          id, agent_id, numero_certificat_administratif, decision_aptitude,
          type_conclusion, code_restriction, restriction_operationnelle,
          identifiant_medecin_militaire_referent, reference_certificat_scelle,
          date_decision, date_expiration, date_echeance,
          reference_arrete_commissariat, enregistre_par
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $11, $12, $13)
        ON CONFLICT (numero_certificat_administratif) DO UPDATE SET
          decision_aptitude = EXCLUDED.decision_aptitude,
          type_conclusion = EXCLUDED.type_conclusion,
          code_restriction = EXCLUDED.code_restriction,
          restriction_operationnelle = EXCLUDED.restriction_operationnelle,
          identifiant_medecin_militaire_referent = EXCLUDED.identifiant_medecin_militaire_referent,
          reference_certificat_scelle = EXCLUDED.reference_certificat_scelle,
          date_decision = EXCLUDED.date_decision,
          date_expiration = EXCLUDED.date_expiration,
          date_echeance = EXCLUDED.date_echeance,
          reference_arrete_commissariat = EXCLUDED.reference_arrete_commissariat,
          enregistre_par = EXCLUDED.enregistre_par
        RETURNING *;
      `;
      const params = [
        id, dto.agent_id, numeroCertificat, decision, conclusion, restrictionCode,
        restrictionTexte || null, dto.identifiant_medecin_militaire_referent || 'MED-MIL-REF',
        dto.reference_certificat_scelle || `SCEL-${Date.now()}`, dto.date_decision,
        dateEcheance, dto.reference_arrete_commissariat || null, auteurId
      ];

      const res = await pool.query(sql, params);
      const r = res.rows[0];

      await auditService.enregistrer({
        utilisateur_id: auteurId,
        nom_utilisateur: nomAuteur,
        role_utilise: roleAuteur,
        adresse_ip: ip,
        action_type: 'ENREGISTREMENT_APTITUDE_ADMINISTRATIVE',
        entite_cible: 'APTITUDES_ADMINISTRATIVES',
        entite_id: r.id,
        details_operation_json: {
          agent_id: dto.agent_id,
          decision_aptitude: decision,
          type_conclusion: conclusion,
          code_restriction: restrictionCode
        },
        statut_operation: 'SUCCES'
      });

      return {
        id: r.id,
        agent_id: r.agent_id,
        numero_certificat_administratif: r.numero_certificat_administratif,
        decision_aptitude: r.decision_aptitude,
        type_conclusion: r.type_conclusion,
        code_restriction: r.code_restriction,
        restriction_operationnelle: r.restriction_operationnelle,
        date_decision: r.date_decision?.toISOString ? r.date_decision.toISOString().split('T')[0] : r.date_decision,
        date_expiration: r.date_expiration?.toISOString ? r.date_expiration.toISOString().split('T')[0] : r.date_expiration,
        date_echeance: r.date_echeance?.toISOString ? r.date_echeance.toISOString().split('T')[0] : r.date_echeance,
        reference_arrete_commissariat: r.reference_arrete_commissariat,
        identifiant_medecin_militaire_referent: r.identifiant_medecin_militaire_referent,
        reference_certificat_scelle: r.reference_certificat_scelle,
        enregistre_par: r.enregistre_par,
        cree_le: r.cree_le?.toISOString()
      };
    } catch (err: any) {
      if (err.code === '23514' && err.constraint === 'chk_aptitudes_interdiction_medicale') {
        throw new HttpError(
          422,
          "Violation du secret médical : La mention de termes médicaux ou diagnostics est formellement prohibée dans le SIRH.",
          "DONNEE_MEDICALE_PROHIBEE"
        );
      }
      throw err;
    }
  }

  // ==========================================================================
  // 6. GÉNÉRATEUR ET SCELLEMENT DE DOCUMENTS PDF (PURE NODE.JS)
  // ==========================================================================

  async listerModelesDocuments(): Promise<ModeleDocumentPdfDto[]> {
    const res = await pool.query('SELECT * FROM modeles_documents_pdf WHERE est_actif = TRUE ORDER BY code_modele ASC');
    return res.rows.map(r => ({
      id: r.id,
      code_modele: r.code_modele,
      libelle: r.libelle,
      gabarit_texte: r.gabarit_texte,
      version: r.version,
      est_actif: r.est_actif
    }));
  }

  async genererDocumentAdministratif(
    dto: GenererDocumentDto,
    auteurId: string,
    nomAuteur: string,
    roleAuteur: string,
    ip: string
  ): Promise<DocumentGenereDto> {
    const codeModele = dto.code_modele || dto.type_document || '';

    // Contrôle contre le path traversal et validation liste blanche fermée
    if (!codeModele || !MODELES_PDF_AUTORISES.includes(codeModele) || codeModele.includes('/') || codeModele.includes('..')) {
      throw new HttpError(400, `Type de document non supporté : ${codeModele}`, "TYPE_DOCUMENT_INVALIDE");
    }

    // Récupération des données agent si renseigné
    let agent: any = null;
    if (dto.agent_id) {
      const resAg = await pool.query('SELECT a.*, u.nom AS unite_nom FROM agents a LEFT JOIN unites u ON a.unite_actuelle_id = u.id WHERE a.id = $1', [dto.agent_id]);
      if (resAg.rows.length > 0) {
        agent = resAg.rows[0];
      }
    }

    // Modèle
    const resMod = await pool.query('SELECT * FROM modeles_documents_pdf WHERE code_modele = $1', [codeModele]);
    const modele = resMod.rows[0] || { libelle: codeModele, gabarit_texte: 'Document administratif républicain' };

    const reference = dto.reference_document || `ACTE-${codeModele}-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const donnees = { ...dto.donnees_acte, ...dto.donnees_variables };

    const nomComplet = agent ? `${agent.prenom} ${agent.nom}` : (donnees.nom_complet || 'Fonctionnaire de Police');
    const matricule = agent ? agent.matricule : (donnees.matricule || 'PND-2026-000');
    const grade = agent ? agent.grade_actuel : (donnees.grade || 'Agent de Police');
    const unite = agent ? agent.unite_nom : (donnees.unite || 'Direction Générale');

    // Préparation des articles selon le type d'acte
    let articles: { numero: string; texte: string }[] = [];
    if (codeModele === 'ARRETE_MUTATION') {
      articles = [
        { numero: '1er', texte: `A compter de la date d effet fixee au ${donnees.date_effet || 'premier du mois prochain'}, Monsieur/Madame ${nomComplet}, matricule ${matricule}, grade ${grade}, est officiellement mute(e) aupres de l unite : ${donnees.unite_destination || unite}.` },
        { numero: '2', texte: 'Le fonctionnaire conserve l integralite de son anciennete de grade, de son echelon statutaire et de son indice de traitement indiciaire.' },
        { numero: '3', texte: 'Le Directeur General de la Police Nationale et le Directeur des Ressources Humaines sont charges, chacun en ce qui le concerne, de l execution du present arrete.' }
      ];
    } else if (codeModele === 'ORDRE_MISSION') {
      articles = [
        { numero: '1er', texte: `Il est ordonne a Monsieur/Madame ${nomComplet}, matricule ${matricule}, grade ${grade}, de se presenter sans delai pour prise de service operationnel d urgence au poste de : ${donnees.poste || 'Garde Statique et Securisation'}.` },
        { numero: '2', texte: `La mission s effectue sous le commandement direct de l officier de quart territorialement competent.` },
        { numero: '3', texte: 'Les autorites civiles et militaires sont requises de preter aide et assistance au porteur du present ordre de mission en cas de necessite.' }
      ];
    } else if (codeModele === 'ATTESTATION_PRESENCE' || codeModele === 'ATTESTATION_TRAVAIL') {
      articles = [
        { numero: 'Unique', texte: `Je soussigne, Directeur General de la Police Nationale, certifie que Monsieur/Madame ${nomComplet}, ne(e) le ${agent?.date_naissance || '01/01/1985'}, titulaire du matricule ${matricule}, est en activite de service sous les drapeaux en qualite de fonctionnaire titulaire de la Police Nationale Djiboutienne, affecte(e) a ${unite}.` }
      ];
    } else {
      articles = [
        { numero: '1er', texte: `Acte officiel ${modele.libelle} delivre a ${nomComplet}, matricule ${matricule}.` },
        { numero: '2', texte: 'Fait a Djibouti pour servir et valoir ce que de droit conformement a la reglementation republicaine.' }
      ];
    }

    // Génération du PDF standardisé
    const resultatPdf = genererDocumentPdf({
      titre: modele.libelle,
      sousTitre: `Concerne : ${nomComplet} (${matricule})`,
      reference,
      dateActe: new Date().toISOString().split('T')[0],
      corpsArticles: articles,
      autoriteSignataire: 'Le Chef de Service des Ressources Humaines',
      qualiteSignataire: 'Chef de Service RH — Police Nationale',
      donneesVariables: donnees
    });

    // Enregistrement de l'acte dans `documents_generes` et journalisation dans `journaux_audit`
    return await transaction(async (client) => {
      // 1. Audit forensique
      const auditEvent = await auditService.enregistrer({
        utilisateur_id: auteurId,
        nom_utilisateur: nomAuteur,
        role_utilise: roleAuteur,
        adresse_ip: ip,
        action_type: 'GENERATION_DOCUMENT_OFFICIEL',
        entite_cible: 'DOCUMENTS_OFFICIELS',
        entite_id: reference,
        details_operation_json: {
          code_modele: codeModele,
          reference_document: reference,
          agent_id: dto.agent_id || null,
          empreinte_sha256: resultatPdf.empreinteSha256
        },
        statut_operation: 'SUCCES'
      });

      const docId = `doc-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
      const sqlDoc = `
        INSERT INTO documents_generes (
          id, code_modele, agent_id, reference_document, titre_document,
          contenu_base64, empreinte_sha256, donnees_variables_json,
          signe_par, genere_par_utilisateur_id, journal_audit_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *;
      `;
      const paramsDoc = [
        docId, codeModele, dto.agent_id || null, reference, modele.libelle,
        resultatPdf.base64, resultatPdf.empreinteSha256, JSON.stringify(donnees),
        'Directeur Général de la Police Nationale', auteurId, auditEvent.id
      ];

      const resDoc = await client.query(sqlDoc, paramsDoc);
      const d = resDoc.rows[0];

      return {
        id: d.id,
        code_modele: d.code_modele,
        agent_id: d.agent_id,
        reference_document: d.reference_document,
        titre_document: d.titre_document,
        contenu_base64: d.contenu_base64,
        empreinte_sha256: d.empreinte_sha256,
        donnees_variables_json: d.donnees_variables_json,
        signe_par: d.signe_par,
        genere_par_utilisateur_id: d.genere_par_utilisateur_id,
        date_generation: d.date_generation?.toISOString(),
        journal_audit_id: d.journal_audit_id
      };
    });
  }

  /**
   * Récupère les métadonnées d'un document généré pour contrôle d'accès ABAC
   */
  async trouverDocumentParId(documentIdOuRef: string): Promise<DocumentGenereDto | null> {
    const res = await pool.query(`
      SELECT * FROM documents_generes
      WHERE id = $1 OR reference_document = $1;
    `, [documentIdOuRef]);

    if (res.rows.length === 0) {
      return null;
    }
    const d = res.rows[0];
    return {
      id: d.id,
      code_modele: d.code_modele,
      agent_id: d.agent_id,
      reference_document: d.reference_document,
      titre_document: d.titre_document,
      contenu_base64: d.contenu_base64,
      empreinte_sha256: d.empreinte_sha256,
      donnees_variables_json: d.donnees_variables_json,
      signe_par: d.signe_par,
      genere_par_utilisateur_id: d.genere_par_utilisateur_id,
      date_generation: d.date_generation?.toISOString(),
      journal_audit_id: d.journal_audit_id
    };
  }

  /**
   * Récupère les métadonnées d'un document officiel généré
   */
  async obtenirMetadonneesDocument(idOrReference: string): Promise<{ id: string; agent_id: string; reference_document: string; code_modele: string } | null> {
    const doc = await this.trouverDocumentParId(idOrReference);
    if (!doc) return null;
    return {
      id: doc.id,
      agent_id: doc.agent_id || '',
      reference_document: doc.reference_document,
      code_modele: doc.code_modele
    };
  }

  async telechargerDocumentPdf(
    documentId: string,
    utilisateurId: string,
    nomUtilisateur: string,
    roleUtilisateur: string,
    ip: string
  ): Promise<{ buffer: Buffer; reference: string; titre: string }> {
    const res = await pool.query(`
      SELECT * FROM documents_generes
      WHERE id = $1 OR reference_document = $1;
    `, [documentId]);

    if (res.rows.length === 0) {
      throw new HttpError(404, `Document (${documentId}) introuvable.`, "DOCUMENT_INTROUVABLE");
    }
    const doc = res.rows[0];
    const buffer = Buffer.from(doc.contenu_base64, 'base64');

    // Vérification d'intégrité à la volée
    const empreinteRecalculee = crypto.createHash('sha256').update(buffer).digest('hex');
    if (empreinteRecalculee !== doc.empreinte_sha256) {
      throw new HttpError(409, "Alerte de falsification : L'empreinte cryptographique du document est corrompue.", "INTEGRITE_DOCUMENT_COMPROMISE");
    }

    // Traçage de l'export dans l'audit
    await auditService.enregistrer({
      utilisateur_id: utilisateurId,
      nom_utilisateur: nomUtilisateur,
      role_utilise: roleUtilisateur,
      adresse_ip: ip,
      action_type: 'TELECHARGEMENT_DOCUMENT_OFFICIEL',
      entite_cible: 'DOCUMENTS_OFFICIELS',
      entite_id: doc.id,
      details_operation_json: {
        reference_document: doc.reference_document,
        empreinte_sha256: doc.empreinte_sha256
      },
      statut_operation: 'SUCCES'
    });

    return {
      buffer,
      reference: doc.reference_document,
      titre: doc.titre_document
    };
  }

  async verifierDocumentPdf(documentIdOrRef: string, empreinteFournie?: string): Promise<{
    valide: boolean;
    reference: string;
    titre: string;
    empreinte_enregistree: string;
    empreinte_recalculee: string;
    date_generation: string;
  }> {
    const res = await pool.query(`
      SELECT * FROM documents_generes
      WHERE id = $1 OR reference_document = $1;
    `, [documentIdOrRef]);

    if (res.rows.length === 0) {
      throw new HttpError(404, `Document (${documentIdOrRef}) introuvable.`, "DOCUMENT_INTROUVABLE");
    }
    const doc = res.rows[0];
    const buffer = Buffer.from(doc.contenu_base64, 'base64');
    const recalcul = crypto.createHash('sha256').update(buffer).digest('hex');

    const signatureConforme = recalcul === doc.empreinte_sha256;
    const correspondFournie = empreinteFournie ? (empreinteFournie === doc.empreinte_sha256) : true;

    return {
      valide: signatureConforme && correspondFournie,
      reference: doc.reference_document,
      titre: doc.titre_document,
      empreinte_enregistree: doc.empreinte_sha256,
      empreinte_recalculee: recalcul,
      date_generation: doc.date_generation?.toISOString()
    };
  }
}

export const operationnelService = new OperationnelService();
