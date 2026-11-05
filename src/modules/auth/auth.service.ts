import * as crypto from 'node:crypto';
import { pool } from '../../database';
import { hacherMotDePasse, verifierMotDePasse, genererJetonOpaque, hacherJetonSession } from './auth.crypto';
import { auditService } from '../audit/audit.service';
import { SessionUtilisateur } from '../../types/session';
import { RoleUtilisateur } from '../../types/roles';

export interface ResultatConnexion {
  succes: boolean;
  codeHttp: number;
  message: string;
  jetonOpaque?: string;
  session?: SessionUtilisateur;
  tentativesRestantes?: number;
}

export class AuthService {
  /**
   * Résout récursivement toutes les sous-unités d'une unité donnée (sans boucle / anti-cycle)
   */
  async trouverSousUnites(uniteId: string): Promise<string[]> {
    if (!uniteId) return [];
    try {
      const res = await pool.query(`
        WITH RECURSIVE sous_arbre AS (
          SELECT id, unite_parente_id, 1 AS niveau
          FROM unites
          WHERE id = $1 AND est_active = TRUE
          UNION ALL
          SELECT u.id, u.unite_parente_id, sa.niveau + 1
          FROM unites u
          JOIN sous_arbre sa ON u.unite_parente_id = sa.id
          WHERE u.est_active = TRUE AND sa.niveau < 20
        )
        SELECT id FROM sous_arbre
      `, [uniteId]);
      return res.rows.map(r => r.id);
    } catch (err) {
      console.error("Erreur résolution sous-unités :", err);
      return [uniteId];
    }
  }

  /**
   * Authentifie un utilisateur, gère le verrouillage 5 échecs et génère le jeton 256 bits
   */
  async connecter(identifiant: string, motDePasse: string, adresseIp: string, agentNavigateur?: string): Promise<ResultatConnexion> {
    const ip = adresseIp || '127.0.0.1';
    const userAgent = agentNavigateur || 'Navigateur Intranet Standard';

    // 1. Recherche du compte utilisateur
    const compteRes = await pool.query(`
      SELECT cu.*, a.nom AS agent_nom, a.prenom AS agent_prenom, a.matricule AS agent_matricule, a.unite_actuelle_id
      FROM comptes_utilisateurs cu
      LEFT JOIN agents a ON cu.agent_id = a.id
      WHERE cu.identifiant = $1
    `, [identifiant]);

    const compte = compteRes.rows[0];

    // Protection contre l'énumération d'utilisateurs par temps d'exécution constant
    if (!compte) {
      hacherMotDePasse('mot_de_passe_factice_pour_timing');
      await auditService.enregistrer({
        utilisateur_id: 'ANONYME',
        nom_utilisateur: identifiant,
        role_utilise: 'INCONNU',
        adresse_ip: ip,
        action_type: 'CONNEXION_ECHEC',
        entite_cible: 'AUTHENTIFICATION',
        statut_operation: 'ECHEC_SECURITE',
        details_operation_json: { motif: 'Identifiant introuvable', identifiant_tente: identifiant }
      });
      return {
        succes: false,
        codeHttp: 401,
        message: 'Non Authentifié : Identifiant ou mot de passe incorrect.'
      };
    }

    // 2. Vérification de l'activation du compte
    if (!compte.est_actif) {
      return {
        succes: false,
        codeHttp: 403,
        message: 'Accès Interdit : Ce compte utilisateur est actuellement désactivé.'
      };
    }

    // 3. Vérification du verrouillage actif (5 échecs consécutifs -> 30 min)
    const maintenant = new Date();
    if (compte.bloque_jusqu_a && new Date(compte.bloque_jusqu_a) > maintenant) {
      const minutesRestantes = Math.ceil((new Date(compte.bloque_jusqu_a).getTime() - maintenant.getTime()) / 60000);
      await auditService.enregistrer({
        utilisateur_id: compte.id,
        nom_utilisateur: compte.identifiant,
        role_utilise: compte.role,
        adresse_ip: ip,
        action_type: 'TENTATIVE_CONNEXION_COMPTE_VERROUILLE',
        entite_cible: 'COMPTE_UTILISATEUR',
        entite_id: compte.id,
        statut_operation: 'ECHEC_SECURITE',
        details_operation_json: { minutes_restantes: minutesRestantes }
      });
      return {
        succes: false,
        codeHttp: 423,
        message: `Compte temporairement verrouillé suite à 5 tentatives infructueuses consécutives. Veuillez réessayer dans ${minutesRestantes} minute(s) ou contacter l'administrateur technique.`
      };
    }

    // Déverrouillage automatique si le délai de blocage est écoulé
    if (compte.bloque_jusqu_a && new Date(compte.bloque_jusqu_a) <= maintenant) {
      await pool.query(`
        UPDATE comptes_utilisateurs 
        SET tentatives_echouees = 0, bloque_jusqu_a = NULL 
        WHERE id = $1
      `, [compte.id]);
      compte.tentatives_echouees = 0;
      compte.bloque_jusqu_a = null;
    }

    // 4. Vérification cryptographique du mot de passe
    const motDePasseValide = verifierMotDePasse(motDePasse, compte.mot_de_passe_hash_argon2id);

    if (!motDePasseValide) {
      const nouvellesTentatives = compte.tentatives_echouees + 1;

      if (nouvellesTentatives >= 5) {
        const blocageJusquA = new Date(Date.now() + 30 * 60 * 1000);
        await pool.query(`
          UPDATE comptes_utilisateurs 
          SET tentatives_echouees = 5, bloque_jusqu_a = $1 
          WHERE id = $2
        `, [blocageJusquA, compte.id]);

        await auditService.enregistrer({
          utilisateur_id: compte.id,
          nom_utilisateur: compte.identifiant,
          role_utilise: compte.role,
          adresse_ip: ip,
          action_type: 'VERROUILLAGE_COMPTE_AUTOMATIQUE',
          entite_cible: 'COMPTE_UTILISATEUR',
          entite_id: compte.id,
          statut_operation: 'ECHEC_SECURITE',
          details_operation_json: { tentatives: 5, bloque_jusqu_a: blocageJusquA.toISOString() }
        });

        return {
          succes: false,
          codeHttp: 423,
          message: 'Compte verrouillé après 5 tentatives infructueuses consécutives. Votre compte est bloqué pendant 30 minutes.'
        };
      } else {
        await pool.query(`
          UPDATE comptes_utilisateurs 
          SET tentatives_echouees = $1 
          WHERE id = $2
        `, [nouvellesTentatives, compte.id]);

        await auditService.enregistrer({
          utilisateur_id: compte.id,
          nom_utilisateur: compte.identifiant,
          role_utilise: compte.role,
          adresse_ip: ip,
          action_type: 'CONNEXION_ECHEC',
          entite_cible: 'AUTHENTIFICATION',
          entite_id: compte.id,
          statut_operation: 'ECHEC_SECURITE',
          details_operation_json: { tentative_numero: nouvellesTentatives, restantes: 5 - nouvellesTentatives }
        });

        return {
          succes: false,
          codeHttp: 401,
          tentativesRestantes: 5 - nouvellesTentatives,
          message: `Identifiant ou mot de passe incorrect. Tentative ${nouvellesTentatives} sur 5 avant verrouillage du compte.`
        };
      }
    }

    // 5. Authentification Réussie : Réinitialisation et création de session
    await pool.query(`
      UPDATE comptes_utilisateurs 
      SET tentatives_echouees = 0, bloque_jusqu_a = NULL, 
          derniere_connexion_le = CURRENT_TIMESTAMP, derniere_ip_connexion = $1
      WHERE id = $2
    `, [ip, compte.id]);

    const jetonOpaque = genererJetonOpaque();
    const jetonHache = hacherJetonSession(jetonOpaque);
    const expiration = new Date(Date.now() + 15 * 60 * 1000); // Expiration glissante 15 min

    // Calcul du sous-réseau /24 pour tolérance WAN
    const sousReseau = ip.includes('.') ? ip.split('.').slice(0, 3).join('.') + '.0/24' : null;
    const sessionId = crypto.randomUUID();

    await pool.query(`
      INSERT INTO sessions_actives (
        id, utilisateur_id, jeton_session_hache, adresse_ip, plage_ip_sous_reseau,
        agent_navigateur, expire_le, derniere_activite_le
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
    `, [sessionId, compte.id, jetonHache, ip, sousReseau, userAgent, expiration]);

    // Détermination des unités autorisées selon rôle
    let unitesAutorisees: string[] = [];
    const role = compte.role as RoleUtilisateur;

    if (role === 'ADMIN_TECHNIQUE') {
      unitesAutorisees = [];
    } else if (role === 'GESTIONNAIRE_RH' || role === 'AUDITEUR') {
      unitesAutorisees = ['*'];
    } else if (role === 'ADMIN_FONCTIONNEL_RH') {
      unitesAutorisees = ['U-DGPN', 'U-DRH', 'U-DSP', 'U-DPF', 'U-DPJ', 'U-ENP'];
    } else if (role === 'CHEF_DE_SERVICE') {
      const uniteChef = compte.unite_actuelle_id || 'U-CC-DJIB';
      unitesAutorisees = await this.trouverSousUnites(uniteChef);
    } else if (role === 'AGENT') {
      unitesAutorisees = compte.agent_id ? [compte.agent_id] : [];
    }

    const nomComplet = compte.agent_nom && compte.agent_prenom 
      ? `${compte.agent_prenom} ${compte.agent_nom}`
      : (compte.identifiant === 'admin_tech' ? 'Mahamoud Guelleh (Admin Tech)' 
        : (compte.identifiant === 'admin_fonc' ? 'Fatouma Ali (Admin Fonct RH)' 
        : (compte.identifiant === 'gestionnaire_rh' ? 'Yassin Barkat (Gestionnaire RH Central)'
        : (compte.identifiant === 'auditeur' ? 'Moussa Ahmed (Inspecteur Général)' : compte.identifiant))));

    const matricule = compte.agent_matricule || (
      role === 'ADMIN_TECHNIQUE' ? 'TECH-001' :
      role === 'ADMIN_FONCTIONNEL_RH' ? 'FONC-001' :
      role === 'GESTIONNAIRE_RH' ? 'RH-001' :
      role === 'AUDITEUR' ? 'AUDIT-001' : 'PND-AUTRE'
    );

    const sessionObj: SessionUtilisateur = {
      session_id: sessionId,
      utilisateur_id: compte.id,
      identifiant: compte.identifiant,
      matricule,
      nom_complet: nomComplet,
      role,
      agent_id: compte.agent_id,
      unite_id: compte.unite_actuelle_id,
      unites_autorisees: unitesAutorisees,
      adresse_ip: ip,
      expire_le: expiration
    };

    await auditService.enregistrer({
      utilisateur_id: compte.id,
      nom_utilisateur: nomComplet,
      role_utilise: role,
      adresse_ip: ip,
      action_type: 'CONNEXION_SUCCES',
      entite_cible: 'AUTHENTIFICATION',
      entite_id: sessionId,
      statut_operation: 'SUCCES',
      details_operation_json: { sous_reseau: sousReseau }
    });

    return {
      succes: true,
      codeHttp: 200,
      message: 'Connexion établie avec succès.',
      jetonOpaque,
      session: sessionObj
    };
  }

  /**
   * Valide le jeton opaque reçu, prolonge la session (expiration glissante 15 min) et retourne le profil
   */
  async validerSession(jetonOpaque: string, adresseIp?: string): Promise<SessionUtilisateur | null> {
    if (!jetonOpaque) return null;

    const jetonHache = hacherJetonSession(jetonOpaque);
    const maintenant = new Date();

    const res = await pool.query(`
      SELECT s.*, cu.identifiant, cu.role, cu.agent_id, cu.est_actif,
             a.nom AS agent_nom, a.prenom AS agent_prenom, a.matricule AS agent_matricule, a.unite_actuelle_id
      FROM sessions_actives s
      JOIN comptes_utilisateurs cu ON s.utilisateur_id = cu.id
      LEFT JOIN agents a ON cu.agent_id = a.id
      WHERE s.jeton_session_hache = $1
    `, [jetonHache]);

    const ligne = res.rows[0];
    if (!ligne) return null;

    if (!ligne.est_actif) {
      await pool.query('DELETE FROM sessions_actives WHERE id = $1', [ligne.id]);
      return null;
    }

    if (new Date(ligne.expire_le) <= maintenant) {
      await pool.query('DELETE FROM sessions_actives WHERE id = $1', [ligne.id]);
      return null;
    }

    // Prolongation glissante de 15 minutes
    const nouvelleExpiration = new Date(Date.now() + 15 * 60 * 1000);
    await pool.query(`
      UPDATE sessions_actives 
      SET derniere_activite_le = CURRENT_TIMESTAMP, expire_le = $1 
      WHERE id = $2
    `, [nouvelleExpiration, ligne.id]);

    const role = ligne.role as RoleUtilisateur;
    let unitesAutorisees: string[] = [];

    if (role === 'ADMIN_TECHNIQUE') {
      unitesAutorisees = [];
    } else if (role === 'GESTIONNAIRE_RH' || role === 'AUDITEUR') {
      unitesAutorisees = ['*'];
    } else if (role === 'ADMIN_FONCTIONNEL_RH') {
      unitesAutorisees = ['U-DGPN', 'U-DRH', 'U-DSP', 'U-DPF', 'U-DPJ', 'U-ENP'];
    } else if (role === 'CHEF_DE_SERVICE') {
      const uniteChef = ligne.unite_actuelle_id || 'U-CC-DJIB';
      unitesAutorisees = await this.trouverSousUnites(uniteChef);
    } else if (role === 'AGENT') {
      unitesAutorisees = ligne.agent_id ? [ligne.agent_id] : [];
    }

    const nomComplet = ligne.agent_nom && ligne.agent_prenom 
      ? `${ligne.agent_prenom} ${ligne.agent_nom}`
      : ligne.identifiant;

    const matricule = ligne.agent_matricule || (
      role === 'ADMIN_TECHNIQUE' ? 'TECH-001' :
      role === 'ADMIN_FONCTIONNEL_RH' ? 'FONC-001' :
      role === 'GESTIONNAIRE_RH' ? 'RH-001' :
      role === 'AUDITEUR' ? 'AUDIT-001' : 'PND-AUTRE'
    );

    return {
      session_id: ligne.id,
      utilisateur_id: ligne.utilisateur_id,
      identifiant: ligne.identifiant,
      matricule,
      nom_complet: nomComplet,
      role,
      agent_id: ligne.agent_id,
      unite_id: ligne.unite_actuelle_id,
      unites_autorisees: unitesAutorisees,
      adresse_ip: adresseIp || ligne.adresse_ip,
      expire_le: nouvelleExpiration
    };
  }

  /**
   * Clôture une session active (déconnexion)
   */
  async deconnecter(jetonOpaque: string): Promise<boolean> {
    if (!jetonOpaque) return false;
    const jetonHache = hacherJetonSession(jetonOpaque);

    const res = await pool.query(`
      SELECT s.*, cu.identifiant, cu.role 
      FROM sessions_actives s
      JOIN comptes_utilisateurs cu ON s.utilisateur_id = cu.id
      WHERE s.jeton_session_hache = $1
    `, [jetonHache]);

    const session = res.rows[0];
    if (session) {
      await pool.query('DELETE FROM sessions_actives WHERE id = $1', [session.id]);
      await auditService.enregistrer({
        utilisateur_id: session.utilisateur_id,
        nom_utilisateur: session.identifiant,
        role_utilise: session.role,
        adresse_ip: session.adresse_ip,
        action_type: 'DECONNEXION',
        entite_cible: 'AUTHENTIFICATION',
        entite_id: session.id,
        statut_operation: 'SUCCES'
      });
      return true;
    }
    return false;
  }
}

export const authService = new AuthService();
