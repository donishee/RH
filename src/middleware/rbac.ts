import { FastifyRequest, FastifyReply } from 'fastify';
import { RoleUtilisateur } from '../types/roles';
import { auditService } from '../modules/audit/audit.service';

export function exigerRoles(...rolesAutorises: RoleUtilisateur[]) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const session = request.sessionUtilisateur;

    if (!session) {
      reply.status(401).send({
        statut: 'ERREUR',
        code_erreur: 'NON_AUTHENTIFIE',
        message: 'Non Authentifié : Session introuvable.',
        horodatage: new Date().toISOString()
      });
      return;
    }

    const roleNormalise = session.role.toUpperCase() as RoleUtilisateur;
    const autorisesNormalises = rolesAutorises.map(r => r.toUpperCase());

    if (!autorisesNormalises.includes(roleNormalise)) {
      await auditService.enregistrer({
        utilisateur_id: session.utilisateur_id,
        nom_utilisateur: session.nom_complet,
        role_utilise: session.role,
        adresse_ip: request.ip,
        action_type: 'ACCES_REFUSE_ROLE_INSUFFISANT',
        entite_cible: 'ROUTE_API',
        entite_id: (request.routerPath || 'ROUTE_API').slice(0, 36),
        statut_operation: 'ECHEC_DROITS',
        details_operation_json: {
          url: request.url,
          roles_requis: autorisesNormalises,
          role_utilisateur: roleNormalise,
          methode: request.method
        }
      }).catch(console.error);

      reply.status(403).send({
        statut: 'ERREUR',
        code_erreur: 'ACCES_INTERDIT',
        message: `Accès Interdit : Votre profil (${session.role}) ne dispose pas des droits requis pour cette opération.`,
        horodatage: new Date().toISOString()
      });
      return;
    }
  };
}
