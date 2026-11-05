import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { congesService, HttpError } from './conges.service';
import { authentifierSession } from '../../middleware/authentification';
import { exigerRoles } from '../../middleware/rbac';
import { verifierPerimetreAgent } from '../../middleware/abac_perimetre';
import { agentsService } from '../agents/agents.service';

export async function congesController(fastify: FastifyInstance): Promise<void> {
  // 1. Consultation des types de congés autorisés
  fastify.get('/types', { preHandler: [authentifierSession] }, async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const types = await congesService.listerTypes();
      return reply.status(200).send({
        statut: 'SUCCES',
        total: types.length,
        types,
        horodatage: new Date().toISOString()
      });
    } catch (err: any) {
      if (err instanceof HttpError) {
        return reply.status(err.statusCode).send({
          statut: 'ERREUR',
          code_erreur: err.code_erreur,
          message: err.message,
          horodatage: new Date().toISOString()
        });
      }
      throw err;
    }
  });

  // 2. Consultation des soldes de l'agent connecté ou ciblé
  const handlerSoldes = async (request: FastifyRequest, reply: FastifyReply) => {
    const session = request.sessionUtilisateur!;
    const params = request.params as any;
    const query = request.query as any;

    if (session.role === 'ADMIN_TECHNIQUE') {
      return reply.status(403).send({
        statut: 'ERREUR',
        code_erreur: 'ACCES_INTERDIT',
        message: "Accès interdit : Les administrateurs techniques ne disposent d'aucun droit d'accès aux dossiers nominatifs RH.",
        horodatage: new Date().toISOString()
      });
    }

    let targetAgentId = params.agentId || query.agent_id || session.agent_id;
    if (!targetAgentId) {
      if (session.role === 'GESTIONNAIRE_RH' || session.role === 'AUDITEUR') {
        targetAgentId = 'agt-001';
      } else {
        targetAgentId = 'agt-001';
      }
    }

    // Contrôle de périmètre ABAC
    const agent = await agentsService.trouverAgentParId(targetAgentId);
    if (!agent) {
      return reply.status(404).send({
        statut: 'ERREUR',
        code_erreur: 'AGENT_INTROUVABLE',
        message: `L'agent ciblé (${targetAgentId}) est introuvable.`,
        horodatage: new Date().toISOString()
      });
    }

    const autorise = verifierPerimetreAgent({
      id: agent.id,
      matricule: agent.matricule,
      unite_actuelle_id: agent.unite_actuelle_id
    }, request, reply);

    if (!autorise) return;

    try {
      const annee = query.annee ? parseInt(query.annee, 10) : 2026;
      const solde = await congesService.obtenirSoldeAgent(targetAgentId, annee);

      return reply.status(200).send({
        statut: 'SUCCES',
        agent: {
          id: agent.id,
          matricule: agent.matricule,
          nom: agent.nom,
          prenom: agent.prenom,
          grade_actuel: agent.grade_actuel,
          unite_actuelle_id: agent.unite_actuelle_id
        },
        solde,
        horodatage: new Date().toISOString()
      });
    } catch (err: any) {
      if (err instanceof HttpError) {
        return reply.status(err.statusCode).send({
          statut: 'ERREUR',
          code_erreur: err.code_erreur,
          message: err.message,
          horodatage: new Date().toISOString()
        });
      }
      throw err;
    }
  };

  fastify.get('/soldes', { preHandler: [authentifierSession] }, handlerSoldes);
  fastify.get('/soldes/:agentId', { preHandler: [authentifierSession] }, handlerSoldes);

  // 3. Liste des demandes de congés (avec filtrage ABAC)
  fastify.get('/demandes', { preHandler: [authentifierSession] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const session = request.sessionUtilisateur!;
    const query = request.query as any;

    if (session.role === 'ADMIN_TECHNIQUE') {
      return reply.status(403).send({
        statut: 'ERREUR',
        code_erreur: 'ACCES_INTERDIT',
        message: "Accès interdit : Les administrateurs techniques ne disposent d'aucun droit d'accès aux dossiers nominatifs RH.",
        horodatage: new Date().toISOString()
      });
    }

    try {
      const resultat = await congesService.listerDemandes({
        agent_id: query.agent_id,
        statut: query.statut,
        limite: query.limite ? parseInt(query.limite, 10) : 50,
        offset: query.offset ? parseInt(query.offset, 10) : 0,
        session
      });

      return reply.status(200).send({
        statut: 'SUCCES',
        total: resultat.total,
        demandes: resultat.demandes,
        horodatage: new Date().toISOString()
      });
    } catch (err: any) {
      if (err instanceof HttpError) {
        return reply.status(err.statusCode).send({
          statut: 'ERREUR',
          code_erreur: err.code_erreur,
          message: err.message,
          horodatage: new Date().toISOString()
        });
      }
      throw err;
    }
  });

  // 4. Soumission d'une nouvelle demande
  fastify.post('/demandes', { preHandler: [authentifierSession] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const session = request.sessionUtilisateur!;
    const body = request.body as any;

    if (session.role === 'ADMIN_TECHNIQUE' || session.role === 'AUDITEUR') {
      return reply.status(403).send({
        statut: 'ERREUR',
        code_erreur: 'ACCES_INTERDIT',
        message: "Accès interdit : Votre rôle ne vous autorise pas à formuler des demandes de congés.",
        horodatage: new Date().toISOString()
      });
    }

    if (!body || !body.type_conge_id || !body.date_debut || !body.date_fin) {
      return reply.status(400).send({
        statut: 'ERREUR',
        code_erreur: 'PARAMETRES_MANQUANTS',
        message: "Les champs type_conge_id, date_debut et date_fin sont obligatoires.",
        horodatage: new Date().toISOString()
      });
    }

    try {
      const resultat = await congesService.soumettreDemande({
        agent_id: body.agent_id,
        type_conge_id: body.type_conge_id,
        date_debut: body.date_debut,
        date_fin: body.date_fin,
        nombre_jours: body.nombre_jours !== undefined ? parseFloat(body.nombre_jours) : undefined,
        motif: body.motif
      }, session, request.ip);

      return reply.status(201).send({
        statut: 'SUCCES',
        message: 'Demande de congé soumise avec succès, jours réservés en attente.',
        demande: resultat.demande,
        solde: resultat.solde,
        horodatage: new Date().toISOString()
      });
    } catch (err: any) {
      if (err instanceof HttpError) {
        return reply.status(err.statusCode).send({
          statut: 'ERREUR',
          code_erreur: err.code_erreur,
          message: err.message,
          horodatage: new Date().toISOString()
        });
      }
      throw err;
    }
  });

  // 5. Visa hiérarchique Niveau 1 (Chef de Service)
  const handlerViser = async (request: FastifyRequest, reply: FastifyReply) => {
    const session = request.sessionUtilisateur!;
    const { id } = request.params as any;
    const body = request.body as any;

    if (!body || !body.avis || !['FAVORABLE', 'DEFAVORABLE'].includes(body.avis)) {
      return reply.status(400).send({
        statut: 'ERREUR',
        code_erreur: 'AVIS_INVALIDE',
        message: "L'avis hiérarchique est obligatoire et doit être soit 'FAVORABLE' soit 'DEFAVORABLE'.",
        horodatage: new Date().toISOString()
      });
    }

    try {
      const resultat = await congesService.viserChef(
        id,
        body.avis,
        body.motif_refus,
        body.commentaire,
        session,
        request.ip
      );

      return reply.status(200).send({
        statut: 'SUCCES',
        message: body.avis === 'FAVORABLE' 
          ? 'Demande visée favorablement par le chef de service et transmise à la DRH.' 
          : 'Demande refusée par le chef de service et jours réservés restitués au solde.',
        demande: resultat.demande,
        solde: resultat.solde,
        horodatage: new Date().toISOString()
      });
    } catch (err: any) {
      if (err instanceof HttpError) {
        return reply.status(err.statusCode).send({
          statut: 'ERREUR',
          code_erreur: err.code_erreur,
          message: err.message,
          horodatage: new Date().toISOString()
        });
      }
      throw err;
    }
  };

  fastify.put('/demandes/:id/viser-chef', {
    preHandler: [authentifierSession, exigerRoles('CHEF_DE_SERVICE', 'GESTIONNAIRE_RH')]
  }, handlerViser);

  fastify.put('/demandes/:id/viser', {
    preHandler: [authentifierSession, exigerRoles('CHEF_DE_SERVICE', 'GESTIONNAIRE_RH')]
  }, handlerViser);

  // 6. Validation définitive Niveau 2 (Gestionnaire RH DRH avec contrôle optimiste)
  const handlerValiderRH = async (request: FastifyRequest, reply: FastifyReply) => {
    const session = request.sessionUtilisateur!;
    const { id } = request.params as any;
    const body = request.body as any;

    const decision = (body?.decision || 'VALIDE').toUpperCase();
    if (!['VALIDE', 'REFUS', 'APPROUVE', 'REFUSE'].includes(decision)) {
      return reply.status(400).send({
        statut: 'ERREUR',
        code_erreur: 'DECISION_INVALIDE',
        message: "La décision DRH doit être 'VALIDE' (ou 'APPROUVE') ou 'REFUS' (ou 'REFUSE').",
        horodatage: new Date().toISOString()
      });
    }

    const versionFournie = body.version_concurrence !== undefined 
      ? Number(body.version_concurrence) 
      : (body.version_fournie !== undefined ? Number(body.version_fournie) : undefined);

    try {
      const resultat = await congesService.validerRH(
        id,
        decision as any,
        body.motif_refus,
        versionFournie,
        session,
        request.ip
      );

      return reply.status(200).send({
        statut: 'SUCCES',
        message: decision === 'VALIDE' || decision === 'APPROUVE'
          ? 'Demande validée définitivement par la DRH et débitée du solde.'
          : 'Demande refusée par la DRH et jours en attente restitués.',
        demande: resultat.demande,
        solde: resultat.solde,
        horodatage: new Date().toISOString()
      });
    } catch (err: any) {
      if (err instanceof HttpError) {
        return reply.status(err.statusCode).send({
          statut: 'ERREUR',
          code_erreur: err.code_erreur,
          message: err.message,
          horodatage: new Date().toISOString()
        });
      }
      throw err;
    }
  };

  fastify.put('/demandes/:id/valider-rh', {
    preHandler: [authentifierSession, exigerRoles('GESTIONNAIRE_RH')]
  }, handlerValiderRH);

  fastify.put('/demandes/:id/valider', {
    preHandler: [authentifierSession, exigerRoles('GESTIONNAIRE_RH')]
  }, handlerValiderRH);

  // 7. Annulation d'une demande avec restitution atomique de solde
  const handlerAnnuler = async (request: FastifyRequest, reply: FastifyReply) => {
    const session = request.sessionUtilisateur!;
    const { id } = request.params as any;
    const body = request.body as any;

    const motif = body?.motif_annulation;
    if (!motif || motif.trim() === '') {
      return reply.status(400).send({
        statut: 'ERREUR',
        code_erreur: 'MOTIF_ANNULATION_OBLIGATOIRE',
        message: "Le motif d'annulation est obligatoire pour toute annulation de congé.",
        horodatage: new Date().toISOString()
      });
    }

    try {
      const resultat = await congesService.annulerDemande(id, motif, session, request.ip);

      return reply.status(200).send({
        statut: 'SUCCES',
        message: 'Demande de congé annulée et solde intégralement restitué avec succès.',
        demande: resultat.demande,
        solde: resultat.solde,
        horodatage: new Date().toISOString()
      });
    } catch (err: any) {
      if (err instanceof HttpError) {
        return reply.status(err.statusCode).send({
          statut: 'ERREUR',
          code_erreur: err.code_erreur,
          message: err.message,
          horodatage: new Date().toISOString()
        });
      }
      throw err;
    }
  };

  fastify.put('/demandes/:id/annuler', {
    preHandler: [authentifierSession, exigerRoles('AGENT', 'CHEF_DE_SERVICE', 'GESTIONNAIRE_RH')]
  }, handlerAnnuler);

  fastify.post('/demandes/:id/annuler', {
    preHandler: [authentifierSession, exigerRoles('AGENT', 'CHEF_DE_SERVICE', 'GESTIONNAIRE_RH')]
  }, handlerAnnuler);

  // 8. Indicateurs et statistiques de pilotage (Tableaux de bord des portails)
  fastify.get('/statistiques', { preHandler: [authentifierSession] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const session = request.sessionUtilisateur!;
    if (session.role === 'ADMIN_TECHNIQUE') {
      return reply.status(403).send({
        statut: 'ERREUR',
        code_erreur: 'ACCES_INTERDIT',
        message: "Accès interdit : Les administrateurs techniques ne disposent d'aucun droit d'accès aux indicateurs RH.",
        horodatage: new Date().toISOString()
      });
    }

    try {
      const stats = await congesService.obtenirStatistiques(session);
      return reply.status(200).send({
        statut: 'SUCCES',
        statistiques: stats,
        horodatage: new Date().toISOString()
      });
    } catch (err: any) {
      if (err instanceof HttpError) {
        return reply.status(err.statusCode).send({
          statut: 'ERREUR',
          code_erreur: err.code_erreur,
          message: err.message,
          horodatage: new Date().toISOString()
        });
      }
      throw err;
    }
  });
}
