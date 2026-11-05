import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { operationnelService, HttpError } from './operationnel.service';
import { authentifierSession } from '../../middleware/authentification';
import { exigerRoles } from '../../middleware/rbac';
import { agentsService } from '../agents/agents.service';
import { auditService } from '../audit/audit.service';
import {
  CreerVacationDto,
  ModifierVacationDto,
  OrdonnerRemplacementDto,
  CreerDossierDisciplinaireDto,
  TransitionPhaseDossierDto,
  EnregistrerSanctionDto,
  EnregistrerAptitudeDto,
  GenererDocumentDto
} from './operationnel.types';

export async function operationnelController(fastify: FastifyInstance): Promise<void> {

  // ==========================================================================
  // 1. PLANNINGS ET VACATIONS OPÉRATIONNELLES (24/7)
  // ==========================================================================

  // GET /api/plannings/postes
  fastify.get('/plannings/postes', { preHandler: [authentifierSession] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const session = request.sessionUtilisateur!;
    if (session.role === 'ADMIN_TECHNIQUE') {
      return reply.status(403).send({
        statut: 'ERREUR',
        code_erreur: 'ACCES_INTERDIT',
        message: "Accès interdit : Les administrateurs techniques ne disposent d'aucun droit d'accès aux dossiers opérationnels.",
        horodatage: new Date().toISOString()
      });
    }

    const { unite_id } = request.query as { unite_id?: string };
    const postes = await operationnelService.listerPostesOperationnels(unite_id);
    return reply.status(200).send({
      statut: 'SUCCES',
      total: postes.length,
      postes,
      horodatage: new Date().toISOString()
    });
  });

  // GET /api/plannings & GET /api/plannings/grille
  const handlerListerPlannings = async (request: FastifyRequest, reply: FastifyReply) => {
    const session = request.sessionUtilisateur!;

    if (session.role === 'ADMIN_TECHNIQUE') {
      return reply.status(403).send({
        statut: 'ERREUR',
        code_erreur: 'ACCES_INTERDIT',
        message: "Accès interdit : Les administrateurs techniques ne disposent d'aucun droit d'accès aux plannings opérationnels.",
        horodatage: new Date().toISOString()
      });
    }

    const query = request.query as {
      unite_id?: string;
      agent_id?: string;
      date_debut?: string;
      date_fin?: string;
      statut?: string;
    };

    let agentIdFiltre = query.agent_id;
    let uniteIdFiltre = query.unite_id;

    // Règle ABAC : Si Agent simple, filtrage strict sur ses propres vacations
    if (session.role === 'AGENT') {
      agentIdFiltre = session.agent_id || undefined;
    } else if (session.role === 'CHEF_DE_SERVICE') {
      const unitesAutorisees = session.unites_autorisees || [];

      // Si Chef de service, restriction à son périmètre d'unités autorisées
      if (uniteIdFiltre && !unitesAutorisees.includes(uniteIdFiltre)) {
        return reply.status(403).send({
          statut: 'ERREUR',
          code_erreur: 'ACCES_INTERDIT',
          message: "Accès interdit : Vous ne pouvez consulter que les plannings relevant de votre arborescence territoriale.",
          horodatage: new Date().toISOString()
        });
      }
    }

    const unitesAutoriseesLister = session.role === 'CHEF_DE_SERVICE'
      ? session.unites_autorisees
      : undefined;

    const plannings = await operationnelService.listerPlannings({
      uniteId: uniteIdFiltre,
      agentId: agentIdFiltre,
      dateDebut: query.date_debut,
      dateFin: query.date_fin,
      statut: query.statut,
      unitesAutorisees: unitesAutoriseesLister
    });

    return reply.status(200).send({
      statut: 'SUCCES',
      total: plannings.length,
      plannings,
      horodatage: new Date().toISOString()
    });
  };

  fastify.get('/plannings', { preHandler: [authentifierSession] }, handlerListerPlannings);
  fastify.get('/plannings/grille', { preHandler: [authentifierSession] }, handlerListerPlannings);

  // POST /api/plannings & POST /api/plannings/vacations
  const handlerCreerVacation = async (request: FastifyRequest, reply: FastifyReply) => {
    const session = request.sessionUtilisateur!;
    const dto = request.body as CreerVacationDto;

    if (!dto || !dto.agent_id || !dto.date_debut || !dto.date_fin) {
      return reply.status(400).send({
        statut: 'ERREUR',
        code_erreur: 'PARAMETRES_MANQUANTS',
        message: "L'identifiant de l'agent, la date de début et la date de fin sont obligatoires.",
        horodatage: new Date().toISOString()
      });
    }

    // Contrôle ABAC pour Chef de Service : agent ET unité cible doivent appartenir à sa circonscription
    if (session.role === 'CHEF_DE_SERVICE') {
      const unitesAutorisees = session.unites_autorisees || [];

      // 1. Contrôle de l'agent affecté
      const agentCible = await agentsService.trouverAgentParId(dto.agent_id);
      if (!agentCible || !unitesAutorisees.includes(agentCible.unite_actuelle_id)) {
        return reply.status(403).send({
          statut: 'ERREUR',
          code_erreur: 'ACCES_INTERDIT',
          message: "Accès interdit : Vous ne pouvez pas planifier un agent appartenant à une unité hors de votre commandement.",
          horodatage: new Date().toISOString()
        });
      }

      // 2. Contrôle de l'unité spécifiée dans le DTO si présente
      if (dto.unite_id && !unitesAutorisees.includes(dto.unite_id)) {
        return reply.status(403).send({
          statut: 'ERREUR',
          code_erreur: 'ACCES_INTERDIT',
          message: "Accès interdit : L'unité de vacation spécifiée n'appartient pas à votre circonscription territoriale.",
          horodatage: new Date().toISOString()
        });
      }
    }

    try {
      const vacation = await operationnelService.creerVacation(
        dto,
        session.utilisateur_id,
        session.nom_complet,
        session.role,
        request.ip
      );

      return reply.status(201).send({
        statut: 'SUCCES',
        message: "Vacation opérationnelle enregistrée avec succès.",
        vacation,
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

  fastify.post('/plannings', {
    preHandler: [authentifierSession, exigerRoles('CHEF_DE_SERVICE', 'GESTIONNAIRE_RH')]
  }, handlerCreerVacation);

  fastify.post('/plannings/vacations', {
    preHandler: [authentifierSession, exigerRoles('CHEF_DE_SERVICE', 'GESTIONNAIRE_RH')]
  }, handlerCreerVacation);

  // PUT /api/plannings/:id
  const handlerModifierVacation = async (request: FastifyRequest, reply: FastifyReply) => {
    const session = request.sessionUtilisateur!;
    const { id } = request.params as { id: string };
    const dto = request.body as ModifierVacationDto;

    // 1. Vérification d'existence de la vacation
    const vacationCible = await operationnelService.obtenirVacation(id);
    if (!vacationCible) {
      return reply.status(404).send({
        statut: 'ERREUR',
        code_erreur: 'VACATION_INTROUVABLE',
        message: `Vacation opérationnelle (${id}) introuvable.`,
        horodatage: new Date().toISOString()
      });
    }

    // 2. Contrôle ABAC territorial pour Chef de Service
    if (session.role === 'CHEF_DE_SERVICE') {
      const unitesAutorisees = session.unites_autorisees || [];
      if (!unitesAutorisees.includes(vacationCible.unite_id)) {
        return reply.status(403).send({
          statut: 'ERREUR',
          code_erreur: 'ACCES_INTERDIT',
          message: "Accès interdit : Vous ne pouvez modifier que les vacations relevant de votre circonscription territoriale.",
          horodatage: new Date().toISOString()
        });
      }
    }

    try {
      const vacation = await operationnelService.modifierVacation(
        id,
        dto,
        session.utilisateur_id,
        session.nom_complet,
        session.role,
        request.ip
      );

      return reply.status(200).send({
        statut: 'SUCCES',
        message: "Vacation mise à jour avec succès.",
        vacation,
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

  fastify.put('/plannings/:id', {
    preHandler: [authentifierSession, exigerRoles('CHEF_DE_SERVICE', 'GESTIONNAIRE_RH')]
  }, handlerModifierVacation);

  fastify.put('/plannings/vacations/:id', {
    preHandler: [authentifierSession, exigerRoles('CHEF_DE_SERVICE', 'GESTIONNAIRE_RH')]
  }, handlerModifierVacation);

  // GET /api/plannings/alertes-effectifs/:uniteId & GET /api/plannings/alertes-sous-effectif
  fastify.get('/plannings/alertes-effectifs/:uniteId', {
    preHandler: [authentifierSession, exigerRoles('CHEF_DE_SERVICE', 'GESTIONNAIRE_RH', 'AUDITEUR')]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const session = request.sessionUtilisateur!;
    const { uniteId } = request.params as { uniteId: string };
    const { date } = request.query as { date?: string };

    const unitesAutorisees = session.unites_autorisees || [];

    if (session.role === 'CHEF_DE_SERVICE' && !unitesAutorisees.includes(uniteId)) {
      return reply.status(403).send({
        statut: 'ERREUR',
        code_erreur: 'ACCES_INTERDIT',
        message: "Accès interdit : Cette unité n'est pas sous votre autorité hiérarchique.",
        horodatage: new Date().toISOString()
      });
    }

    const alerte = await operationnelService.obtenirAlerteSousEffectif(uniteId, date);
    return reply.status(200).send({
      statut: 'SUCCES',
      alerte,
      horodatage: new Date().toISOString()
    });
  });

  fastify.get('/plannings/alertes-sous-effectif', {
    preHandler: [authentifierSession, exigerRoles('CHEF_DE_SERVICE', 'GESTIONNAIRE_RH', 'AUDITEUR')]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const session = request.sessionUtilisateur!;
    const { unite_id, date } = request.query as { unite_id?: string; date?: string };
    const unitesAutorisees = session.unites_autorisees || [];

    // Contrôle ABAC territorial si CHEF_DE_SERVICE
    if (session.role === 'CHEF_DE_SERVICE') {
      if (unite_id && !unitesAutorisees.includes(unite_id)) {
        return reply.status(403).send({
          statut: 'ERREUR',
          code_erreur: 'ACCES_INTERDIT',
          message: "Accès interdit : Cette unité n'est pas sous votre autorité hiérarchique.",
          horodatage: new Date().toISOString()
        });
      }
    }

    const cibleUnite = unite_id || session.unite_id || (unitesAutorisees.length > 0 ? unitesAutorisees[0] : 'U-CC-DJIB');

    const alerte = await operationnelService.obtenirAlerteSousEffectif(cibleUnite, date);
    return reply.status(200).send({
      statut: 'SUCCES',
      alerte,
      horodatage: new Date().toISOString()
    });
  });

  // ==========================================================================
  // 2. REMPLACEMENTS D'URGENCE
  // ==========================================================================

  // GET /api/remplacements/candidats & GET /api/remplacements/candidats-eligibles
  const handlerCandidatsRemplacement = async (request: FastifyRequest, reply: FastifyReply) => {
    const session = request.sessionUtilisateur!;
    const query = request.query as { vacation_id?: string; planning_vacation_id?: string; unite_id?: string };
    const vacationId = query.vacation_id || query.planning_vacation_id;

    if (!vacationId) {
      return reply.status(400).send({
        statut: 'ERREUR',
        code_erreur: 'PARAMETRE_MANQUANT',
        message: "L'identifiant de la vacation opérationnelle est requis (vacation_id).",
        horodatage: new Date().toISOString()
      });
    }

    // 1. Vérification d'existence de la vacation ciblée
    const vacationCible = await operationnelService.obtenirVacation(vacationId);
    if (!vacationCible) {
      return reply.status(404).send({
        statut: 'ERREUR',
        code_erreur: 'VACATION_INTROUVABLE',
        message: `Vacation opérationnelle (${vacationId}) introuvable.`,
        horodatage: new Date().toISOString()
      });
    }

    // 2. Contrôle ABAC territorial pour Chef de Service
    if (session.role === 'CHEF_DE_SERVICE') {
      const unitesAutorisees = session.unites_autorisees || [];

      if (!unitesAutorisees.includes(vacationCible.unite_id)) {
        return reply.status(403).send({
          statut: 'ERREUR',
          code_erreur: 'ACCES_INTERDIT',
          message: "Accès interdit : La vacation ciblée relève d'une unité hors de votre commandement.",
          horodatage: new Date().toISOString()
        });
      }

      if (query.unite_id && !unitesAutorisees.includes(query.unite_id)) {
        return reply.status(403).send({
          statut: 'ERREUR',
          code_erreur: 'ACCES_INTERDIT',
          message: "Accès interdit : Vous ne pouvez rechercher des candidats que dans les unités sous votre autorité.",
          horodatage: new Date().toISOString()
        });
      }
    }

    try {
      const candidats = await operationnelService.trouverCandidatsEligibles(vacationId, query.unite_id);
      return reply.status(200).send({
        statut: 'SUCCES',
        vacation_id: vacationId,
        total_candidats: candidats.length,
        candidats,
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

  fastify.get('/remplacements/candidats', {
    preHandler: [authentifierSession, exigerRoles('CHEF_DE_SERVICE', 'GESTIONNAIRE_RH')]
  }, handlerCandidatsRemplacement);

  fastify.get('/remplacements/candidats-eligibles', {
    preHandler: [authentifierSession, exigerRoles('CHEF_DE_SERVICE', 'GESTIONNAIRE_RH')]
  }, handlerCandidatsRemplacement);

  // POST /api/remplacements & POST /api/remplacements/ordonner & POST /api/remplacements/valider
  const handlerOrdonnerRemplacement = async (request: FastifyRequest, reply: FastifyReply) => {
    const session = request.sessionUtilisateur!;
    const dto = request.body as OrdonnerRemplacementDto;

    if (!dto || !dto.planning_vacation_id || !dto.agent_remplacant_id) {
      return reply.status(400).send({
        statut: 'ERREUR',
        code_erreur: 'PARAMETRES_MANQUANTS',
        message: "L'identifiant de la vacation et l'identifiant du remplaçant sont obligatoires.",
        horodatage: new Date().toISOString()
      });
    }

    // 1. Vérification d'existence de la vacation initiale
    const vacationInitiale = await operationnelService.obtenirVacation(dto.planning_vacation_id);
    if (!vacationInitiale) {
      return reply.status(404).send({
        statut: 'ERREUR',
        code_erreur: 'VACATION_INTROUVABLE',
        message: `Vacation initiale (${dto.planning_vacation_id}) introuvable.`,
        horodatage: new Date().toISOString()
      });
    }

    // 2. Contrôle ABAC territorial pour Chef de Service
    if (session.role === 'CHEF_DE_SERVICE') {
      const unitesAutorisees = session.unites_autorisees || [];

      // A. L'unité de la vacation à remplacer doit être sous son autorité
      if (!unitesAutorisees.includes(vacationInitiale.unite_id)) {
        return reply.status(403).send({
          statut: 'ERREUR',
          code_erreur: 'ACCES_INTERDIT',
          message: "Accès interdit : La vacation à remplacer relève d'une unité hors de votre commandement.",
          horodatage: new Date().toISOString()
        });
      }

      // B. L'agent remplaçant doit appartenir à une unité sous son autorité
      const agentRemplacant = await agentsService.trouverAgentParId(dto.agent_remplacant_id);
      if (!agentRemplacant || !unitesAutorisees.includes(agentRemplacant.unite_actuelle_id)) {
        return reply.status(403).send({
          statut: 'ERREUR',
          code_erreur: 'ACCES_INTERDIT',
          message: "Accès interdit : L'agent remplaçant relève d'une unité hors de votre commandement.",
          horodatage: new Date().toISOString()
        });
      }
    }

    try {
      const res = await operationnelService.ordonnerRemplacement(
        dto,
        session.utilisateur_id,
        session.nom_complet,
        session.role,
        request.ip
      );

      return reply.status(201).send({
        statut: 'SUCCES',
        message: "Remplacement d'urgence ordonné avec succès et planning répercuté.",
        ...res,
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

  fastify.post('/remplacements', {
    preHandler: [authentifierSession, exigerRoles('CHEF_DE_SERVICE', 'GESTIONNAIRE_RH')]
  }, handlerOrdonnerRemplacement);

  fastify.post('/remplacements/ordonner', {
    preHandler: [authentifierSession, exigerRoles('CHEF_DE_SERVICE', 'GESTIONNAIRE_RH')]
  }, handlerOrdonnerRemplacement);

  fastify.post('/remplacements/valider', {
    preHandler: [authentifierSession, exigerRoles('CHEF_DE_SERVICE', 'GESTIONNAIRE_RH')]
  }, handlerOrdonnerRemplacement);

  // ==========================================================================
  // 3. SANCTUAIRE DISCIPLINAIRE CLOISONNÉ (LOIS 48/AN/72 & 116/AN/21)
  // ==========================================================================

  // Middleware de cloisonnement disciplinaire strict
  const filtrerAccesDisciplinaire = async (request: FastifyRequest, reply: FastifyReply) => {
    const session = request.sessionUtilisateur!;
    if (session.role !== 'GESTIONNAIRE_RH') {
      // Enregistrement de la tentative d'intrusion forensique
      await auditService.enregistrer({
        utilisateur_id: session.utilisateur_id,
        nom_utilisateur: session.nom_complet,
        role_utilise: session.role,
        adresse_ip: request.ip,
        action_type: 'TENTATIVE_CONSULTATION_DISCIPLINE_BLOQUEE',
        entite_cible: 'MODULE_DISCIPLINE',
        entite_id: 'CLOISONNEMENT',
        details_operation_json: {
          route_cible: request.url,
          methode: request.method
        },
        statut_operation: 'ECHEC_DROITS'
      });

      return reply.status(403).send({
        statut: 'ERREUR',
        code_erreur: 'ACCES_INTERDIT',
        message: "Accès interdit : La consultation des dossiers disciplinaires est strictement réservée à la Direction Générale et à la Commission de discipline.",
        horodatage: new Date().toISOString()
      });
    }
  };

  // GET /api/discipline/dossiers
  fastify.get('/discipline/dossiers', {
    preHandler: [authentifierSession, filtrerAccesDisciplinaire]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as { agent_id?: string; phase?: string; statut?: string };
    const dossiers = await operationnelService.listerDossiersDisciplinaires({
      agentId: query.agent_id,
      phase: query.phase,
      statut: query.statut
    });

    return reply.status(200).send({
      statut: 'SUCCES',
      total: dossiers.length,
      dossiers,
      horodatage: new Date().toISOString()
    });
  });

  // GET /api/discipline/dossiers/:id
  fastify.get('/discipline/dossiers/:id', {
    preHandler: [authentifierSession, filtrerAccesDisciplinaire]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };

    try {
      const dossier = await operationnelService.obtenirDossierDisciplinaire(id);
      return reply.status(200).send({
        statut: 'SUCCES',
        dossier,
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

  // POST /api/discipline/dossiers
  fastify.post('/discipline/dossiers', {
    preHandler: [authentifierSession, filtrerAccesDisciplinaire]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const session = request.sessionUtilisateur!;
    const dto = request.body as CreerDossierDisciplinaireDto;

    if (!dto || !dto.agent_id || !dto.date_faits || !dto.description_sommaire) {
      return reply.status(400).send({
        statut: 'ERREUR',
        code_erreur: 'PARAMETRES_MANQUANTS',
        message: "L'agent ciblé, la date des faits et la description sommaire sont obligatoires.",
        horodatage: new Date().toISOString()
      });
    }

    try {
      const dossier = await operationnelService.creerDossierDisciplinaire(
        dto,
        session.utilisateur_id,
        session.nom_complet,
        session.role,
        request.ip
      );

      return reply.status(201).send({
        statut: 'SUCCES',
        message: "Dossier disciplinaire ouvert avec succès en phase d'instruction préliminaire.",
        dossier,
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

  // PUT /api/discipline/dossiers/:id/phase
  fastify.put('/discipline/dossiers/:id/phase', {
    preHandler: [authentifierSession, filtrerAccesDisciplinaire]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const session = request.sessionUtilisateur!;
    const { id } = request.params as { id: string };
    const dto = request.body as TransitionPhaseDossierDto;

    if (!dto || !dto.phase_procedure) {
      return reply.status(400).send({
        statut: 'ERREUR',
        code_erreur: 'PARAMETRE_MANQUANT',
        message: "La nouvelle phase de la procédure est obligatoire.",
        horodatage: new Date().toISOString()
      });
    }

    try {
      const dossier = await operationnelService.transitionnerPhaseDossier(
        id,
        dto,
        session.utilisateur_id,
        session.nom_complet,
        session.role,
        request.ip
      );

      return reply.status(200).send({
        statut: 'SUCCES',
        message: `Procédure disciplinaire passée en phase ${dto.phase_procedure}.`,
        dossier,
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

  // POST /api/discipline/sanctions & POST /api/discipline/dossiers/:id/sanctions
  const handlerEnregistrerSanction = async (request: FastifyRequest, reply: FastifyReply) => {
    const session = request.sessionUtilisateur!;
    const params = request.params as { id?: string };
    const dto = request.body as EnregistrerSanctionDto;

    if (params.id && !dto.dossier_id) {
      dto.dossier_id = params.id;
    }

    if (!dto || !dto.dossier_id || !dto.groupe_sanction || !dto.nature_sanction || !dto.reference_arrete) {
      return reply.status(400).send({
        statut: 'ERREUR',
        code_erreur: 'PARAMETRES_MANQUANTS',
        message: "Le dossier, le groupe de sanction, la nature de la sanction et la référence de l'arrêté sont obligatoires.",
        horodatage: new Date().toISOString()
      });
    }

    try {
      const sanction = await operationnelService.enregistrerSanctionDisciplinaire(
        dto,
        session.utilisateur_id,
        session.nom_complet,
        session.role,
        request.ip
      );

      return reply.status(201).send({
        statut: 'SUCCES',
        message: `Sanction statutaire du ${dto.groupe_sanction} (${dto.nature_sanction}) prononcée avec succès.`,
        sanction,
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

  fastify.post('/discipline/sanctions', {
    preHandler: [authentifierSession, filtrerAccesDisciplinaire]
  }, handlerEnregistrerSanction);

  fastify.post('/discipline/dossiers/:id/sanctions', {
    preHandler: [authentifierSession, filtrerAccesDisciplinaire]
  }, handlerEnregistrerSanction);

  // ==========================================================================
  // 4. APTITUDE ADMINISTRATIVE (SANCTUAIRE SANS DONNÉES MÉDICALES)
  // ==========================================================================

  // GET /api/aptitude/:agentId
  fastify.get('/aptitude/:agentId', { preHandler: [authentifierSession] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const session = request.sessionUtilisateur!;
    const { agentId } = request.params as { agentId: string };

    if (session.role === 'ADMIN_TECHNIQUE') {
      return reply.status(403).send({
        statut: 'ERREUR',
        code_erreur: 'ACCES_INTERDIT',
        message: "Accès interdit : Les administrateurs techniques ne disposent d'aucun droit d'accès aux dossiers d'aptitude nominatifs.",
        horodatage: new Date().toISOString()
      });
    }

    // Agent simple limité à soi-même
    if (session.role === 'AGENT' && session.agent_id !== agentId) {
      return reply.status(403).send({
        statut: 'ERREUR',
        code_erreur: 'ACCES_INTERDIT',
        message: "Accès interdit : Vous ne pouvez consulter que votre propre fiche d'aptitude administrative.",
        horodatage: new Date().toISOString()
      });
    }

    // Chef de service limité à son unité
    if (session.role === 'CHEF_DE_SERVICE') {
      const agentCible = await agentsService.trouverAgentParId(agentId);
      if (!agentCible || !session.unites_autorisees.includes(agentCible.unite_actuelle_id)) {
        return reply.status(403).send({
          statut: 'ERREUR',
          code_erreur: 'ACCES_INTERDIT',
          message: "Accès interdit : Cet agent n'appartient pas à votre unité de commandement.",
          horodatage: new Date().toISOString()
        });
      }
    }

    const aptitudes = await operationnelService.obtenirAptitudeAgent(agentId);
    return reply.status(200).send({
      statut: 'SUCCES',
      agent_id: agentId,
      total: aptitudes.length,
      aptitudes,
      horodatage: new Date().toISOString()
    });
  });

  // POST /api/aptitude & POST /api/aptitude/decisions
  const handlerEnregistrerAptitude = async (request: FastifyRequest, reply: FastifyReply) => {
    const session = request.sessionUtilisateur!;
    const dto = request.body as EnregistrerAptitudeDto;

    if (!dto || !dto.agent_id || !dto.date_decision) {
      return reply.status(400).send({
        statut: 'ERREUR',
        code_erreur: 'PARAMETRES_MANQUANTS',
        message: "L'identifiant de l'agent et la date de décision sont obligatoires.",
        horodatage: new Date().toISOString()
      });
    }

    try {
      const aptitude = await operationnelService.enregistrerAptitudeAdministrative(
        dto,
        session.utilisateur_id,
        session.nom_complet,
        session.role,
        request.ip
      );

      return reply.status(201).send({
        statut: 'SUCCES',
        message: "Décision d'aptitude administrative enregistrée avec succès (garantie sans secret médical).",
        aptitude,
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

  fastify.post('/aptitude', {
    preHandler: [authentifierSession, exigerRoles('GESTIONNAIRE_RH')]
  }, handlerEnregistrerAptitude);

  fastify.post('/aptitude/decisions', {
    preHandler: [authentifierSession, exigerRoles('GESTIONNAIRE_RH')]
  }, handlerEnregistrerAptitude);

  // ==========================================================================
  // 5. MOTEUR DE DOCUMENTS OFFICIELS PDF & SCELLEMENT SHA-256
  // ==========================================================================

  // GET /api/documents/modeles
  fastify.get('/documents/modeles', { preHandler: [authentifierSession] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const session = request.sessionUtilisateur!;
    if (session.role === 'ADMIN_TECHNIQUE') {
      return reply.status(403).send({
        statut: 'ERREUR',
        code_erreur: 'ACCES_INTERDIT',
        message: "Accès interdit : Les administrateurs techniques ne disposent d'aucun droit d'accès aux modèles de documents RH.",
        horodatage: new Date().toISOString()
      });
    }

    const modeles = await operationnelService.listerModelesDocuments();
    return reply.status(200).send({
      statut: 'SUCCES',
      total: modeles.length,
      modeles,
      horodatage: new Date().toISOString()
    });
  });

  // POST /api/documents/generer & POST /api/documents/generer-acte
  const handlerGenererDocument = async (request: FastifyRequest, reply: FastifyReply) => {
    const session = request.sessionUtilisateur!;

    if (session.role === 'ADMIN_TECHNIQUE') {
      return reply.status(403).send({
        statut: 'ERREUR',
        code_erreur: 'ACCES_INTERDIT',
        message: "Accès interdit : Les administrateurs techniques ne peuvent pas générer d'actes nominatifs.",
        horodatage: new Date().toISOString()
      });
    }

    const dto = request.body as GenererDocumentDto;
    const codeModele = dto.code_modele || dto.type_document;

    if (!codeModele) {
      return reply.status(400).send({
        statut: 'ERREUR',
        code_erreur: 'PARAMETRE_MANQUANT',
        message: "Le code modèle du document est obligatoire (code_modele).",
        horodatage: new Date().toISOString()
      });
    }

    // Agent simple ne peut générer que ses propres attestations
    if (session.role === 'AGENT') {
      if (dto.agent_id && dto.agent_id !== session.agent_id) {
        return reply.status(403).send({
          statut: 'ERREUR',
          code_erreur: 'ACCES_INTERDIT',
          message: "Accès interdit : Vous ne pouvez générer des attestations que pour votre propre compte.",
          horodatage: new Date().toISOString()
        });
      }
      dto.agent_id = session.agent_id || undefined;
    }

    // Chef de service limité à ses agents
    if (session.role === 'CHEF_DE_SERVICE' && dto.agent_id) {
      const agt = await agentsService.trouverAgentParId(dto.agent_id);
      if (!agt || !session.unites_autorisees.includes(agt.unite_actuelle_id)) {
        return reply.status(403).send({
          statut: 'ERREUR',
          code_erreur: 'ACCES_INTERDIT',
          message: "Accès interdit : Cet agent n'appartient pas à votre unité de commandement.",
          horodatage: new Date().toISOString()
        });
      }
    }

    try {
      const doc = await operationnelService.genererDocumentAdministratif(
        dto,
        session.utilisateur_id,
        session.nom_complet,
        session.role,
        request.ip
      );

      return reply.status(201).send({
        statut: 'SUCCES',
        message: `Document officiel (${doc.titre_document}) généré et scellé par empreinte SHA-256 avec succès.`,
        document: doc,
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

  fastify.post('/documents/generer', {
    preHandler: [authentifierSession, exigerRoles('GESTIONNAIRE_RH', 'CHEF_DE_SERVICE', 'AGENT')]
  }, handlerGenererDocument);

  fastify.post('/documents/generer-acte', {
    preHandler: [authentifierSession, exigerRoles('GESTIONNAIRE_RH', 'CHEF_DE_SERVICE', 'AGENT')]
  }, handlerGenererDocument);

  // GET /api/documents/:id/telecharger
  fastify.get('/documents/:id/telecharger', { preHandler: [authentifierSession] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const session = request.sessionUtilisateur!;
    const { id } = request.params as { id: string };

    // 1. Règle absolue : L'administrateur technique ne dispose d'aucun accès aux documents RH nominatifs
    if (session.role === 'ADMIN_TECHNIQUE') {
      return reply.status(403).send({
        statut: 'ERREUR',
        code_erreur: 'ACCES_INTERDIT',
        message: "Accès interdit : Les administrateurs techniques ne disposent d'aucun droit de téléchargement des documents nominatifs.",
        horodatage: new Date().toISOString()
      });
    }

    // 2. Recherche préalable du document pour vérification des métadonnées et contrôle ABAC
    const docMeta = await operationnelService.trouverDocumentParId(id);
    if (!docMeta) {
      return reply.status(404).send({
        statut: 'ERREUR',
        code_erreur: 'DOCUMENT_INTROUVABLE',
        message: `Document (${id}) introuvable.`,
        horodatage: new Date().toISOString()
      });
    }

    // 3. Contrôle de confidentialité ABAC selon le rôle
    // a) Rôle AGENT : étanchéité stricte, ne peut télécharger que ses propres documents
    if (session.role === 'AGENT') {
      if (!docMeta.agent_id || docMeta.agent_id !== session.agent_id) {
        await auditService.enregistrer({
          utilisateur_id: session.utilisateur_id,
          nom_utilisateur: session.nom_complet,
          role_utilise: session.role,
          adresse_ip: request.ip,
          action_type: 'TELECHARGEMENT_DOC_TIERS_BLOQUE',
          entite_cible: 'DOCUMENTS_OFFICIELS',
          entite_id: docMeta.id,
          statut_operation: 'ECHEC_DROITS',
          details_operation_json: {
            agent_demandeur: session.agent_id,
            agent_document: docMeta.agent_id,
            reference_document: docMeta.reference_document
          }
        }).catch(console.error);

        return reply.status(403).send({
          statut: 'ERREUR',
          code_erreur: 'ACCES_INTERDIT',
          message: "Accès interdit : Un agent ne peut télécharger que ses propres documents administratifs nominatifs.",
          horodatage: new Date().toISOString()
        });
      }
    }

    // b) Rôle CHEF_DE_SERVICE : restriction territoriale à son arborescence d'unités autorisées
    if (session.role === 'CHEF_DE_SERVICE') {
      if (docMeta.agent_id) {
        const agentCible = await agentsService.trouverAgentParId(docMeta.agent_id);
        const unitesAutorisees = session.unites_autorisees || [];
        if (!agentCible || !unitesAutorisees.includes(agentCible.unite_actuelle_id)) {
          await auditService.enregistrer({
            utilisateur_id: session.utilisateur_id,
            nom_utilisateur: session.nom_complet,
            role_utilise: session.role,
            adresse_ip: request.ip,
            action_type: 'TELECHARGEMENT_DOC_HORS_UNITE_BLOQUE',
            entite_cible: 'DOCUMENTS_OFFICIELS',
            entite_id: docMeta.id,
            statut_operation: 'ECHEC_DROITS',
            details_operation_json: {
              unite_chef: session.unite_id,
              unites_autorisees: session.unites_autorisees,
              unite_agent: agentCible?.unite_actuelle_id,
              agent_document: docMeta.agent_id,
              reference_document: docMeta.reference_document
            }
          }).catch(console.error);

          return reply.status(403).send({
            statut: 'ERREUR',
            code_erreur: 'ACCES_INTERDIT',
            message: `Accès interdit : L'agent titulaire de ce document relève d'une unité hors de votre périmètre hiérarchique autorisé (${agentCible?.unite_actuelle_id || 'inconnue'}).`,
            horodatage: new Date().toISOString()
          });
        }
      }
    }

    // c) Rôles GESTIONNAIRE_RH, AUDITEUR et ADMIN_FONCTIONNEL_RH : autorisés
    try {
      const resDoc = await operationnelService.telechargerDocumentPdf(
        id,
        session.utilisateur_id,
        session.nom_complet,
        session.role,
        request.ip
      );

      reply.header('Content-Type', 'application/pdf');
      reply.header('Content-Disposition', `inline; filename="${resDoc.reference}.pdf"`);
      return reply.status(200).send(resDoc.buffer);
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

  // GET /api/documents/verifier
  fastify.get('/documents/verifier', async (request: FastifyRequest, reply: FastifyReply) => {
    const { doc, sig } = request.query as { doc?: string; sig?: string };
    if (!doc) {
      return reply.status(400).send({
        statut: 'ERREUR',
        code_erreur: 'PARAMETRE_MANQUANT',
        message: "La référence du document est obligatoire pour la vérification.",
        horodatage: new Date().toISOString()
      });
    }

    try {
      const verif = await operationnelService.verifierDocumentPdf(doc, sig);
      return reply.status(200).send({
        statut: 'SUCCES',
        verification: verif,
        message: verif.valide
          ? "Document certifié authentique et intègre par le système républicain de scellement."
          : "ALERTE : Empreinte cryptographique non conforme ou altérée.",
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
