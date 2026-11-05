import * as crypto from 'node:crypto';
import { pool, transaction } from '../../database';
import { auditService } from '../audit/audit.service';
import { SessionUtilisateur } from '../../types/session';

export interface MutationDto {
  agent_id: string;
  nouvelle_unite_id: string;
  nouveau_poste_id?: string;
  type_mouvement?: string;
  date_debut: string;
  motif_mouvement: string;
  reference_arrete_ou_decision: string;
}

export class AffectationsService {
  /**
   * Exécute une mutation d'agent dans une transaction atomique ACID
   * Clôture l'affectation active précédente sans jamais écraser l'historique
   */
  async muterAgent(data: MutationDto, session: SessionUtilisateur) {
    if (!data.agent_id || !data.nouvelle_unite_id || !data.date_debut ||
        !data.motif_mouvement || !data.reference_arrete_ou_decision) {
      throw new Error("PARAMETRES_MUTATION_MANQUANTS");
    }

    return transaction(async (client) => {
      // 1. Vérification de l'agent
      const agentRes = await client.query('SELECT * FROM agents WHERE id = $1 FOR UPDATE', [data.agent_id]);
      const agent = agentRes.rows[0];
      if (!agent) {
        throw new Error("AGENT_INTROUVABLE");
      }

      // 2. Vérification de la nouvelle unité
      const uniteRes = await client.query('SELECT * FROM unites WHERE id = $1 AND est_active = TRUE', [data.nouvelle_unite_id]);
      const nouvelleUnite = uniteRes.rows[0];
      if (!nouvelleUnite) {
        throw new Error("UNITE_DESTINATION_INTROUVABLE_OU_INACTIVE");
      }

      // 3. Vérification du poste si spécifié
      if (data.nouveau_poste_id) {
        const posteRes = await client.query('SELECT * FROM postes WHERE id = $1', [data.nouveau_poste_id]);
        const poste = posteRes.rows[0];
        if (!poste) {
          throw new Error("POSTE_DESTINATION_INTROUVABLE");
        }
        if (poste.unite_id !== data.nouvelle_unite_id) {
          throw new Error(`INCOMPATIBILITE_POSTE_UNITE: Le poste ${data.nouveau_poste_id} est rattaché à l'unité ${poste.unite_id}, différent de l'unité de mutation ${data.nouvelle_unite_id}.`);
        }
      }

      // 4. Récupération de l'affectation courante active
      const affCouranteRes = await client.query(`
        SELECT * FROM affectations 
        WHERE agent_id = $1 AND est_affectation_courante = TRUE 
        FOR UPDATE
      `, [data.agent_id]);

      const affCourante = affCouranteRes.rows[0];

      // 5. Clôture de l'affectation active précédente
      if (affCourante) {
        // Calcul de la date de fin = date_debut de mutation - 1 jour
        const dateFin = new Date(new Date(data.date_debut).getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        await client.query(`
          UPDATE affectations 
          SET est_affectation_courante = FALSE, date_fin = $1 
          WHERE id = $2
        `, [dateFin, affCourante.id]);

        // Libération de l'ancien poste si vacant
        if (affCourante.poste_id) {
          await client.query('UPDATE postes SET est_vacant = TRUE WHERE id = $1', [affCourante.poste_id]);
        }
      }

      // 6. Insertion de la nouvelle affectation
      const nouvelleAffectationId = crypto.randomUUID();
      const typeMouvement = data.type_mouvement || 'MUTATION';

      const nouvelleAffRes = await client.query(`
        INSERT INTO affectations (
          id, agent_id, unite_id, poste_id, type_mouvement, date_debut,
          motif_mouvement, reference_arrete_ou_decision, est_affectation_courante, cree_par
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE, $9)
        RETURNING *
      `, [
        nouvelleAffectationId, data.agent_id, data.nouvelle_unite_id,
        data.nouveau_poste_id || null, typeMouvement, data.date_debut,
        data.motif_mouvement, data.reference_arrete_ou_decision, session.utilisateur_id
      ]);

      const nouvelleAff = nouvelleAffRes.rows[0];

      // 7. Occupation du nouveau poste si spécifié
      if (data.nouveau_poste_id) {
        await client.query('UPDATE postes SET est_vacant = FALSE WHERE id = $1', [data.nouveau_poste_id]);
      }

      // 8. Mise à jour de l'unité actuelle dans la table maîtresse agents
      await client.query(`
        UPDATE agents 
        SET unite_actuelle_id = $1, modifie_le = CURRENT_TIMESTAMP 
        WHERE id = $2
      `, [data.nouvelle_unite_id, data.agent_id]);

      // 9. Journalisation forensique dans l'audit chaîné SHA-256
      await auditService.enregistrer({
        utilisateur_id: session.utilisateur_id,
        nom_utilisateur: session.nom_complet,
        role_utilise: session.role,
        adresse_ip: session.adresse_ip,
        action_type: 'MUTATION_AGENT',
        entite_cible: 'AFFECTATION',
        entite_id: nouvelleAffectationId,
        statut_operation: 'SUCCES',
        details_operation_json: {
          agent_id: data.agent_id,
          matricule: agent.matricule,
          ancienne_unite_id: affCourante ? affCourante.unite_id : agent.unite_actuelle_id,
          nouvelle_unite_id: data.nouvelle_unite_id,
          reference_arrete: data.reference_arrete_ou_decision,
          date_effet: data.date_debut
        }
      });

      return {
        affectation_precedente_id: affCourante ? affCourante.id : null,
        nouvelle_affectation: nouvelleAff
      };
    });
  }

  /**
   * Retourne tout l'historique chronologique des affectations d'un agent
   */
  async listerHistoriqueAgent(agentId: string) {
    const res = await pool.query(`
      SELECT aff.*, u.nom AS nom_unite, u.code AS code_unite, u.region_administrative,
             p.intitule AS intitule_poste
      FROM affectations aff
      JOIN unites u ON aff.unite_id = u.id
      LEFT JOIN postes p ON aff.poste_id = p.id
      WHERE aff.agent_id = $1
      ORDER BY aff.date_debut DESC
    `, [agentId]);

    return res.rows;
  }

  /**
   * Interdiction absolue de suppression d'affectation
   */
  supprimerAffectation(): never {
    throw new Error("Violation d'intégrité : L'historique des affectations est strictement immuable. La suppression d'une affectation est formellement interdite.");
  }
}

export const affectationsService = new AffectationsService();
