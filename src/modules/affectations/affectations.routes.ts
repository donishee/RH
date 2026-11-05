import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { affectationsService } from './affectations.service';
import { authentifierSession } from '../../middleware/authentification';
import { exigerRoles } from '../../middleware/rbac';
import { verifierPerimetreAgent } from '../../middleware/abac_perimetre';
import { agentsService } from '../agents/agents.service';

export async function affectationsRoutes(fastify: FastifyInstance): Promise<void> {
  // Historique des affectations d'un agent
  fastify.get('/agents/:id/affectations', { preHandler: [authentifierSession] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as any;
    const session = request.sessionUtilisateur!;

    if (session.role === 'ADMIN_TECHNIQUE') {
      return reply.status(403).send({
        statut: 'ERREUR',
        code_erreur: 'ACCES_INTERDIT',
        message: "Accès interdit : Les administrateurs techniques ne disposent d'aucun droit d'accès aux dossiers nominatifs RH.",
        horodatage: new Date().toISOString()
      });
    }

    const agent = await agentsService.trouverAgentParId(id);
    if (!agent) {
      return reply.status(404).send({
        statut: 'ERREUR',
        code_erreur: 'AGENT_INTROUVABLE',
        message: `L'agent avec l'identifiant ${id} est introuvable.`,
        horodatage: new Date().toISOString()
      });
    }

    const autorise = verifierPerimetreAgent({
      id: agent.id,
      matricule: agent.matricule,
      unite_actuelle_id: agent.unite_actuelle_id
    }, request, reply);

    if (!autorise) return;

    const historique = await affectationsService.listerHistoriqueAgent(id);

    return reply.status(200).send({
      statut: 'SUCCES',
      total: historique.length,
      affectations: historique,
      horodatage: new Date().toISOString()
    });
  });

  // Exécution d'une mutation (réservée GESTIONNAIRE_RH)
  fastify.post('/mutations', {
    preHandler: [authentifierSession, exigerRoles('GESTIONNAIRE_RH')]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as any;

    if (!body || !body.agent_id || !body.nouvelle_unite_id || !body.date_debut ||
        !body.motif_mouvement || !body.reference_arrete_ou_decision) {
      return reply.status(400).send({
        statut: 'ERREUR',
        code_erreur: 'PARAMETRES_MANQUANTS',
        message: 'Les champs agent_id, nouvelle_unite_id, date_debut, motif_mouvement et reference_arrete_ou_decision sont obligatoires.',
        horodatage: new Date().toISOString()
      });
    }

    try {
      const resultat = await affectationsService.muterAgent(body, request.sessionUtilisateur!);

      return reply.status(200).send({
        statut: 'SUCCES',
        message: 'Mutation exécutée avec succès, ancienne affectation clôturée et nouvel enregistrement scellé.',
        nouvelle_affectation: resultat.nouvelle_affectation,
        horodatage: new Date().toISOString()
      });
    } catch (error: any) {
      if (error.message === 'AGENT_INTROUVABLE') {
        return reply.status(404).send({
          statut: 'ERREUR',
          code_erreur: 'AGENT_INTROUVABLE',
          message: 'L\'agent à muter est introuvable.',
          horodatage: new Date().toISOString()
        });
      }
      if (error.message === 'UNITE_DESTINATION_INTROUVABLE_OU_INACTIVE') {
        return reply.status(400).send({
          statut: 'ERREUR',
          code_erreur: 'UNITE_INVALIDE',
          message: 'L\'unité de destination est introuvable ou inactive.',
          horodatage: new Date().toISOString()
        });
      }
      if (error.message?.includes('INCOMPATIBILITE_POSTE_UNITE')) {
        return reply.status(400).send({
          statut: 'ERREUR',
          code_erreur: 'INCOMPATIBILITE_POSTE_UNITE',
          message: error.message,
          horodatage: new Date().toISOString()
        });
      }
      throw error;
    }
  });

  // Rejet formel de toute tentative de suppression d'affectation
  fastify.delete('/affectations/:id', {
    preHandler: [authentifierSession]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return reply.status(405).send({
      statut: 'ERREUR',
      code_erreur: 'OPERATION_INTERDITE',
      message: 'Violation d\'intégrité : L\'historique des affectations est strictement immuable. La suppression d\'une affectation est formellement interdite.',
      horodatage: new Date().toISOString()
    });
  });
}
