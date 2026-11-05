import { FastifyRequest, FastifyReply } from 'fastify';
import { auditService } from '../modules/audit/audit.service';

export function verifierAntiAutoApprobation(demandeurAgentId: string, ressourceId: string, request: FastifyRequest, reply: FastifyReply): boolean {
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

  // RÈGLE D'OR RÉGALIENNE : ANTI-AUTO-APPROBATION STRICTEMENT VERROUILLÉE
  if (session.agent_id && demandeurAgentId && session.agent_id === demandeurAgentId) {
    auditService.enregistrer({
      utilisateur_id: session.utilisateur_id,
      nom_utilisateur: session.nom_complet,
      role_utilise: session.role,
      adresse_ip: request.ip,
      action_type: 'TENTATIVE_AUTO_APPROBATION_BLOQUEE',
      entite_cible: 'VALIDATION_DEMANDE',
      entite_id: ressourceId,
      statut_operation: 'ECHEC_SECURITE',
      details_operation_json: {
        motif: "Tentative d'auto-approbation d'un supérieur sur sa propre demande",
        agent_demandeur: demandeurAgentId
      }
    }).catch(console.error);

    reply.status(403).send({
      statut: 'ERREUR',
      code_erreur: 'AUTO_APPROBATION_INTERDITE',
      message: "VIOLATION HIÉRARCHIQUE : Auto-approbation formellement interdite. En tant que chef de service, votre demande de congé doit obligatoirement être soumise à l'approbation de votre supérieur hiérarchique direct (N+2) ou transmise directement à la Direction des Ressources Humaines.",
      horodatage: new Date().toISOString()
    });
    return false;
  }

  return true;
}
