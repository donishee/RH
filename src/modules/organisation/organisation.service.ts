import { pool } from '../../database';
import { auditService } from '../audit/audit.service';
import { SessionUtilisateur } from '../../types/session';

export class OrganisationService {
  /**
   * Liste toutes les unités organisationnelles avec décompte d'effectifs actifs
   */
  async listerUnites(filtres?: { region?: string; type_unite?: string }) {
    let queryText = `
      SELECT u.*,
             (SELECT COUNT(*) FROM agents a WHERE a.unite_actuelle_id = u.id AND a.est_actif = TRUE) AS effectif_actif,
             (SELECT COUNT(*) FROM postes p WHERE p.unite_id = u.id) AS total_postes,
             (SELECT COUNT(*) FROM postes p WHERE p.unite_id = u.id AND p.est_vacant = TRUE) AS postes_vacants,
             up.nom AS nom_unite_parente
      FROM unites u
      LEFT JOIN unites up ON u.unite_parente_id = up.id
      WHERE u.est_active = TRUE
    `;
    const params: any[] = [];

    if (filtres?.region) {
      params.push(filtres.region);
      queryText += ` AND u.region_administrative = $${params.length}`;
    }

    if (filtres?.type_unite) {
      params.push(filtres.type_unite);
      queryText += ` AND u.type_unite = $${params.length}`;
    }

    queryText += ' ORDER BY u.type_unite ASC, u.code ASC';
    const res = await pool.query(queryText, params);
    return res.rows;
  }

  /**
   * Trouve une unité spécifique avec son détail et ses postes
   */
  async trouverUniteParId(id: string) {
    const uniteRes = await pool.query(`
      SELECT u.*, up.nom AS nom_unite_parente,
             (SELECT COUNT(*) FROM agents a WHERE a.unite_actuelle_id = u.id AND a.est_actif = TRUE) AS effectif_actif
      FROM unites u
      LEFT JOIN unites up ON u.unite_parente_id = up.id
      WHERE u.id = $1
    `, [id]);

    const unite = uniteRes.rows[0];
    if (!unite) return null;

    const postesRes = await pool.query(`
      SELECT * FROM postes WHERE unite_id = $1 ORDER BY code_poste ASC
    `, [id]);

    return {
      ...unite,
      postes: postesRes.rows
    };
  }

  /**
   * Résout la sous-arborescence hiérarchique récursive
   */
  async trouverSousArborescence(uniteId: string) {
    const res = await pool.query(`
      WITH RECURSIVE sous_arbre AS (
        SELECT id, code, nom, type_unite, unite_parente_id, region_administrative, 1 AS niveau
        FROM unites
        WHERE id = $1 AND est_active = TRUE
        UNION ALL
        SELECT u.id, u.code, u.nom, u.type_unite, u.unite_parente_id, u.region_administrative, sa.niveau + 1
        FROM unites u
        JOIN sous_arbre sa ON u.unite_parente_id = sa.id
        WHERE u.est_active = TRUE AND sa.niveau < 20
      )
      SELECT sa.*,
             (SELECT COUNT(*) FROM agents a WHERE a.unite_actuelle_id = sa.id AND a.est_actif = TRUE) AS effectif_actif
      FROM sous_arbre sa
      ORDER BY sa.niveau ASC, sa.code ASC
    `, [uniteId]);

    return res.rows;
  }

  /**
   * Crée une nouvelle unité avec vérification d'unicité et audit
   */
  async creerUnite(data: {
    id?: string;
    code: string;
    nom: string;
    type_unite: string;
    unite_parente_id?: string | null;
    region_administrative?: string;
    adresse_geographique?: string;
    telephone_contact?: string;
  }, operateurSession?: SessionUtilisateur) {
    const id = data.id || `U-${data.code.toUpperCase().replace(/[\s_]/g, '-')}`;
    const region = data.region_administrative || 'DJIBOUTI';

    const res = await pool.query(`
      INSERT INTO unites (
        id, code, nom, type_unite, unite_parente_id, region_administrative,
        adresse_geographique, telephone_contact, est_active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE)
      RETURNING *
    `, [
      id, data.code, data.nom, data.type_unite, data.unite_parente_id || null,
      region, data.adresse_geographique || null, data.telephone_contact || null
    ]);

    const nouvelleUnite = res.rows[0];

    if (operateurSession) {
      await auditService.enregistrer({
        utilisateur_id: operateurSession.utilisateur_id,
        nom_utilisateur: operateurSession.nom_complet,
        role_utilise: operateurSession.role,
        adresse_ip: operateurSession.adresse_ip,
        action_type: 'CREATION_UNITE',
        entite_cible: 'UNITE',
        entite_id: nouvelleUnite.id,
        details_operation_json: { code: nouvelleUnite.code, nom: nouvelleUnite.nom, type: nouvelleUnite.type_unite }
      });
    }

    return nouvelleUnite;
  }

  /**
   * Met à jour une unité (avec interception des cycles par le trigger SQL)
   */
  async modifierUnite(id: string, data: Partial<{
    nom: string;
    unite_parente_id: string | null;
    region_administrative: string;
    adresse_geographique: string;
    telephone_contact: string;
    est_active: boolean;
  }>, operateurSession?: SessionUtilisateur) {
    const champs: string[] = [];
    const params: any[] = [id];

    if (data.nom !== undefined) {
      params.push(data.nom);
      champs.push(`nom = $${params.length}`);
    }
    if (data.unite_parente_id !== undefined) {
      params.push(data.unite_parente_id);
      champs.push(`unite_parente_id = $${params.length}`);
    }
    if (data.region_administrative !== undefined) {
      params.push(data.region_administrative);
      champs.push(`region_administrative = $${params.length}`);
    }
    if (data.adresse_geographique !== undefined) {
      params.push(data.adresse_geographique);
      champs.push(`adresse_geographique = $${params.length}`);
    }
    if (data.telephone_contact !== undefined) {
      params.push(data.telephone_contact);
      champs.push(`telephone_contact = $${params.length}`);
    }
    if (data.est_active !== undefined) {
      params.push(data.est_active);
      champs.push(`est_active = $${params.length}`);
    }

    champs.push(`modifie_le = CURRENT_TIMESTAMP`);

    const queryText = `
      UPDATE unites 
      SET ${champs.join(', ')} 
      WHERE id = $1 
      RETURNING *
    `;

    const res = await pool.query(queryText, params);
    const uniteMaj = res.rows[0];

    if (operateurSession && uniteMaj) {
      await auditService.enregistrer({
        utilisateur_id: operateurSession.utilisateur_id,
        nom_utilisateur: operateurSession.nom_complet,
        role_utilise: operateurSession.role,
        adresse_ip: operateurSession.adresse_ip,
        action_type: 'MODIFICATION_UNITE',
        entite_cible: 'UNITE',
        entite_id: uniteMaj.id,
        details_operation_json: data
      });
    }

    return uniteMaj;
  }

  /**
   * Liste les postes
   */
  async listerPostes(filtres?: { unite_id?: string; est_vacant?: boolean }) {
    let queryText = `
      SELECT p.*, u.nom AS nom_unite, u.code AS code_unite
      FROM postes p
      JOIN unites u ON p.unite_id = u.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (filtres?.unite_id) {
      params.push(filtres.unite_id);
      queryText += ` AND p.unite_id = $${params.length}`;
    }

    if (filtres?.est_vacant !== undefined) {
      params.push(filtres.est_vacant);
      queryText += ` AND p.est_vacant = $${params.length}`;
    }

    queryText += ' ORDER BY u.code ASC, p.code_poste ASC';
    const res = await pool.query(queryText, params);
    return res.rows;
  }

  /**
   * Crée un nouveau poste budgétaire
   */
  async creerPoste(data: {
    id?: string;
    code_poste: string;
    intitule: string;
    unite_id: string;
    grade_requis: string;
    effectif_requis?: number;
    description_emploi?: string;
  }, operateurSession?: SessionUtilisateur) {
    const id = data.id || `PST-${Date.now().toString().slice(-6)}`;

    const res = await pool.query(`
      INSERT INTO postes (
        id, code_poste, intitule, unite_id, grade_requis, effectif_requis,
        est_vacant, description_emploi
      ) VALUES ($1, $2, $3, $4, $5, $6, TRUE, $7)
      RETURNING *
    `, [
      id, data.code_poste, data.intitule, data.unite_id, data.grade_requis,
      data.effectif_requis || 1, data.description_emploi || null
    ]);

    const poste = res.rows[0];

    if (operateurSession) {
      await auditService.enregistrer({
        utilisateur_id: operateurSession.utilisateur_id,
        nom_utilisateur: operateurSession.nom_complet,
        role_utilise: operateurSession.role,
        adresse_ip: operateurSession.adresse_ip,
        action_type: 'CREATION_POSTE',
        entite_cible: 'POSTE',
        entite_id: poste.id,
        details_operation_json: { code_poste: poste.code_poste, unite_id: poste.unite_id, grade: poste.grade_requis }
      });
    }

    return poste;
  }
}

export const organisationService = new OrganisationService();
