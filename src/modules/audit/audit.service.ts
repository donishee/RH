import { pool } from '../../database';
import { GENESIS_HASH, computeChainedHash, verifyAuditChain, VerificationAuditResultat } from './audit.crypto';
import { ParametresEnregistrementAudit, LigneAudit } from '../../types/audit';

export class AuditService {
  /**
   * Enregistre une entrée dans le journal d'audit avec chaînage cryptographique SHA-256
   */
  async enregistrer(params: ParametresEnregistrementAudit): Promise<LigneAudit> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      // Verrou consultatif sérialisant le calcul d'empreinte SHA-256 sans blocage de table global
      await client.query('SELECT pg_advisory_xact_lock(42424242);');


      // 1. Récupération atomique de la dernière empreinte courante
      const dernierLogRes = await client.query(`
        SELECT id, empreinte_courante 
        FROM journaux_audit 
        ORDER BY id DESC 
        LIMIT 1 
        FOR UPDATE
      `);

      const empreinte_precedente = dernierLogRes.rows.length > 0 
        ? dernierLogRes.rows[0].empreinte_courante 
        : GENESIS_HASH;

      // 2. Obtention de l'identifiant séquentiel suivant
      const nextIdRes = await client.query("SELECT nextval('journaux_audit_id_seq') AS next_id");
      const id = parseInt(nextIdRes.rows[0].next_id, 10);
      const horodatage = new Date().toISOString();

      const detailsJson = params.details_operation_json || {};

      const entiteId = params.entite_id ? String(params.entite_id).slice(0, 36) : null;

      // 3. Calcul cryptographique de l'empreinte courante
      const empreinte_courante = computeChainedHash({
        id,
        horodatage,
        utilisateur_id: params.utilisateur_id,
        action_type: params.action_type,
        entite_cible: params.entite_cible,
        entite_id: entiteId,
        details_operation_json: detailsJson,
        empreinte_precedente
      });

      const statut = params.statut_operation || 'SUCCES';
      const nomUtilisateur = params.nom_utilisateur || 'Système';
      const roleUtilise = params.role_utilise || 'AGENT';
      const adresseIp = params.adresse_ip || '127.0.0.1';

      // 4. Insertion stricte Append-Only
      const insertRes = await client.query(`
        INSERT INTO journaux_audit (
          id, horodatage, utilisateur_id, nom_utilisateur, role_utilise, adresse_ip,
          action_type, entite_cible, entite_id, details_operation_json, statut_operation,
          empreinte_precedente, empreinte_courante
        ) VALUES (
          $1, $2, $3, $4, $5, $6,
          $7, $8, $9, $10, $11,
          $12, $13
        ) RETURNING *
      `, [
        id, horodatage, params.utilisateur_id, nomUtilisateur, roleUtilise, adresseIp,
        params.action_type, params.entite_cible, entiteId,
        JSON.stringify(detailsJson), statut, empreinte_precedente, empreinte_courante
      ]);

      await client.query('COMMIT');
      return insertRes.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      console.error("Erreur lors de l'enregistrement dans le journal d'audit :", error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Interdiction absolue de modification
   */
  modifierAudit(): never {
    throw new Error("Violation de sécurité : Les journaux d'audit sont strictement immuables (Append-Only). Toute modification est interdite.");
  }

  /**
   * Interdiction absolue de suppression
   */
  supprimerAudit(): never {
    throw new Error("Violation de sécurité : Les journaux d'audit sont strictement immuables. Toute suppression est interdite.");
  }

  /**
   * Liste les entrées du journal d'audit triées par horodatage descendant
   */
  async listerLogs(options?: { limite?: number; offset?: number; action_type?: string }): Promise<{ total: number; logs: LigneAudit[] }> {
    const limite = options?.limite || 50;
    const offset = options?.offset || 0;
    const actionType = options?.action_type;

    let queryText = 'SELECT * FROM journaux_audit';
    let countText = 'SELECT COUNT(*) AS total FROM journaux_audit';
    const params: any[] = [];

    if (actionType) {
      params.push(actionType);
      queryText += ' WHERE action_type = $1';
      countText += ' WHERE action_type = $1';
    }

    queryText += ` ORDER BY id DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    const queryParams = [...params, limite, offset];

    const [logsRes, countRes] = await Promise.all([
      pool.query(queryText, queryParams),
      pool.query(countText, params)
    ]);

    return {
      total: parseInt(countRes.rows[0].total, 10),
      logs: logsRes.rows
    };
  }

  /**
   * Vérifie l'intégrité de la chaîne cryptographique SHA-256
   */
  async verifierIntegriteChaine(): Promise<VerificationAuditResultat> {
    const res = await pool.query('SELECT * FROM journaux_audit ORDER BY id ASC');
    return verifyAuditChain(res.rows);
  }
}

export const auditService = new AuditService();
