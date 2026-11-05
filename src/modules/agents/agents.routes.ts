import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { agentsService } from './agents.service';
import { authentifierSession } from '../../middleware/authentification';
import { exigerRoles } from '../../middleware/rbac';
import { verifierPerimetreAgent } from '../../middleware/abac_perimetre';

export async function agentsRoutes(fastify: FastifyInstance): Promise<void> {
  // Liste des agents (filtrage RBAC et ABAC automatique)
  fastify.get('/', { preHandler: [authentifierSession] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const session = request.sessionUtilisateur!;

    // Blocage absolu de l'administrateur technique
    if (session.role === 'ADMIN_TECHNIQUE') {
      return reply.status(403).send({
        statut: 'ERREUR',
        code_erreur: 'ACCES_INTERDIT',
        message: "Accès interdit : Les administrateurs techniques ne disposent d'aucun droit d'accès aux dossiers nominatifs RH.",
        horodatage: new Date().toISOString()
      });
    }

    const query = request.query as any;
    const resultat = await agentsService.listerAgents(session, {
      recherche: query.recherche,
      corps: query.corps,
      grade: query.grade,
      unite_id: query.unite_id,
      limite: query.limite ? parseInt(query.limite, 10) : 50,
      offset: query.offset ? parseInt(query.offset, 10) : 0
    });

    return reply.status(200).send({
      statut: 'SUCCES',
      total: resultat.total,
      agents: resultat.agents,
      horodatage: new Date().toISOString()
    });
  });

  // Fiche détaillée d'un agent avec vérification ABAC stricte
  fastify.get('/:id', { preHandler: [authentifierSession] }, async (request: FastifyRequest, reply: FastifyReply) => {
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

    // Contrôle d'accès ABAC
    const autorise = verifierPerimetreAgent({
      id: agent.id,
      matricule: agent.matricule,
      unite_actuelle_id: agent.unite_actuelle_id
    }, request, reply);

    if (!autorise) {
      return; // La réponse 403 a été émise par verifierPerimetreAgent
    }

    return reply.status(200).send({
      statut: 'SUCCES',
      agent,
      horodatage: new Date().toISOString()
    });
  });

  // Création d'un agent (réservée au rôle GESTIONNAIRE_RH)
  fastify.post('/', {
    preHandler: [authentifierSession, exigerRoles('GESTIONNAIRE_RH')]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as any;

    if (!body || !body.matricule || !body.numero_carte_nationale || !body.nom || !body.prenom ||
        !body.date_naissance || !body.genre || !body.date_recrutement || !body.corps ||
        !body.grade_actuel || body.indice_solde === undefined || !body.unite_actuelle_id) {
      return reply.status(400).send({
        statut: 'ERREUR',
        code_erreur: 'PARAMETRES_MANQUANTS',
        message: 'Informations obligatoires manquantes pour la création de l\'agent.',
        horodatage: new Date().toISOString()
      });
    }

    if (!agentsService.validerFormatMatricule(body.matricule)) {
      return reply.status(400).send({
        statut: 'ERREUR',
        code_erreur: 'FORMAT_MATRICULE_INVALIDE',
        message: `Le matricule national policier doit impérativement respecter le format PND-YYYY-XXXXX (reçu: ${body.matricule}).`,
        horodatage: new Date().toISOString()
      });
    }

    try {
      const nouvelAgent = await agentsService.creerAgent(body, request.sessionUtilisateur!);
      return reply.status(201).send({
        statut: 'SUCCES',
        message: 'Agent créé avec succès et affectation initiale scellée.',
        agent: nouvelAgent,
        horodatage: new Date().toISOString()
      });
    } catch (error: any) {
      if (error.code === '23505') {
        return reply.status(409).send({
          statut: 'ERREUR',
          code_erreur: 'DOUBLON_AGENT',
          message: 'Un agent avec ce matricule ou ce numéro de carte nationale existe déjà.',
          horodatage: new Date().toISOString()
        });
      }
      throw error;
    }
  });

  // Mise à jour de la fiche d'un agent
  fastify.put('/:id', {
    preHandler: [authentifierSession, exigerRoles('GESTIONNAIRE_RH')]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as any;
    const body = request.body as any;

    const agentMaj = await agentsService.modifierAgent(id, body, request.sessionUtilisateur!);

    return reply.status(200).send({
      statut: 'SUCCES',
      message: 'Fiche agent mise à jour avec succès.',
      agent: agentMaj,
      horodatage: new Date().toISOString()
    });
  });
}
