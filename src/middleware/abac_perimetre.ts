import { FastifyRequest, FastifyReply } from 'fastify';
import { auditService } from '../modules/audit/audit.service';

export interface AgentCibleInfo {
  id: string;
  matricule: string;
  unite_actuelle_id: string;
}

export function verifierPerimetreAgent(agentCible: AgentCibleInfo, request: FastifyRequest, reply: FastifyReply): boolean {
  const session = request.sessionUtilisateur;

  if (!session) {
    reply.status(401).send({
      statut: 'ERREUR',
      code_erreur: 'NON_AUTHENTIFIE',
      message: 'Non Authentifié : Session introuvable.',
      horodatage: new Date().toISOString()
    });
    return false;
  }

  // 1. RÈGLE ADMIN TECHNIQUE : Zéro accès aux dossiers nominatifs RH
  if (session.role === 'ADMIN_TECHNIQUE') {
    auditService.enregistrer({
      utilisateur_id: session.utilisateur_id,
      nom_utilisateur: session.nom_complet,
      role_utilise: session.role,
      adresse_ip: request.ip,
      action_type: 'TENTATIVE_ACCES_NOMINATIF_ADMIN_TECHNIQUE_BLOQUEE',
      entite_cible: 'AGENT',
      entite_id: agentCible.id,
      statut_operation: 'ECHEC_DROITS'
    }).catch(console.error);

    reply.status(403).send({
      statut: 'ERREUR',
      code_erreur: 'ACCES_INTERDIT',
      message: "Accès interdit : Les administrateurs techniques ne disposent d'aucun droit d'accès aux dossiers nominatifs RH.",
      horodatage: new Date().toISOString()
    });
    return false;
  }

  // 2. GESTIONNAIRE RH & AUDITEUR : Périmètre national intégral
  if (session.role === 'GESTIONNAIRE_RH' || session.role === 'AUDITEUR') {
    return true;
  }

  // 3. AGENT : Exclusivement son propre dossier
  if (session.role === 'AGENT') {
    if (session.agent_id === agentCible.id || session.matricule === agentCible.matricule) {
      return true;
    }

    auditService.enregistrer({
      utilisateur_id: session.utilisateur_id,
      nom_utilisateur: session.nom_complet,
      role_utilise: session.role,
      adresse_ip: request.ip,
      action_type: 'TENTATIVE_ACCES_DOSSIER_TIERS_AGENT_BLOQUEE',
      entite_cible: 'AGENT',
      entite_id: agentCible.id,
      statut_operation: 'ECHEC_DROITS'
    }).catch(console.error);

    reply.status(403).send({
      statut: 'ERREUR',
      code_erreur: 'ACCES_INTERDIT',
      message: "Accès interdit : Un agent ne peut consulter que son propre dossier individuel.",
      horodatage: new Date().toISOString()
    });
    return false;
  }

  // 4. CHEF DE SERVICE : Périmètre hiérarchique arborescent
  if (session.role === 'CHEF_DE_SERVICE') {
    const unitesAutorisees = session.unites_autorisees || [];
    if (unitesAutorisees.includes(agentCible.unite_actuelle_id)) {
      return true;
    }

    auditService.enregistrer({
      utilisateur_id: session.utilisateur_id,
      nom_utilisateur: session.nom_complet,
      role_utilise: session.role,
      adresse_ip: request.ip,
      action_type: 'TENTATIVE_ACCES_HORS_UNITE_BLOQUEE',
      entite_cible: 'AGENT',
      entite_id: agentCible.id,
      statut_operation: 'ECHEC_DROITS',
      details_operation_json: {
        unite_chef: session.unite_id,
        unite_agent: agentCible.unite_actuelle_id
      }
    }).catch(console.error);

    reply.status(403).send({
      statut: 'ERREUR',
      code_erreur: 'ACCES_INTERDIT',
      message: `Accès interdit : L'agent appartient à une unité hors de votre périmètre hiérarchique autorisé (${agentCible.unite_actuelle_id}).`,
      horodatage: new Date().toISOString()
    });
    return false;
  }

  // 5. ADMIN FONCTIONNEL RH : Consultation autorisée
  if (session.role === 'ADMIN_FONCTIONNEL_RH') {
    return true;
  }

  reply.status(403).send({
    statut: 'ERREUR',
    code_erreur: 'ACCES_INTERDIT',
    message: "Accès interdit : Rôle non habilité.",
    horodatage: new Date().toISOString()
  });
  return false;
}
