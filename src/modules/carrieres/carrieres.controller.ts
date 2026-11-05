import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { carrieresService, HttpError } from './carrieres.service';
import { authentifierSession } from '../../middleware/authentification';
import { exigerRoles } from '../../middleware/rbac';
import { verifierPerimetreAgent } from '../../middleware/abac_perimetre';
import { agentsService } from '../agents/agents.service';
import {
  CreerAvancementEchelonDto,
  EnregistrerPromotionDto,
  DeclarerPositionDto,
  CreerQualificationDto,
  CreerNotationDto,
  DeposerRecoursNotationDto,
  ArbitrerRecoursNotationDto
} from './carrieres.types';

export async function carrieresController(fastify: FastifyInstance): Promise<void> {

  // ==========================================================================
  // 1. CARRIÈRES & ÉCHELONS
  // ==========================================================================

  // GET /api/carrieres/:agentId
  fastify.get('/carrieres/:agentId', { preHandler: [authentifierSession] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const session = request.sessionUtilisateur!;
    const { agentId } = request.params as { agentId: string };

    if (session.role === 'ADMIN_TECHNIQUE') {
      return reply.status(403).send({
        statut: 'ERREUR',
        code_erreur: 'ACCES_INTERDIT',
        message: "Accès interdit : Les administrateurs techniques ne disposent d'aucun droit d'accès aux dossiers nominatifs RH.",
        horodatage: new Date().toISOString()
      });
    }

    const agent = await agentsService.trouverAgentParId(agentId);
    if (!agent) {
      return reply.status(404).send({
        statut: 'ERREUR',
        code_erreur: 'AGENT_INTROUVABLE',
        message: `L'agent ciblé (${agentId}) est introuvable.`,
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
      const carriere = await carrieresService.obtenirCarriereAgent(agentId);
      return reply.status(200).send({
        statut: 'SUCCES',
        ...carriere
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

  // POST /api/carrieres/avancement-echelon
  fastify.post('/carrieres/avancement-echelon', {
    preHandler: [authentifierSession, exigerRoles('GESTIONNAIRE_RH', 'ADMIN_FONCTIONNEL_RH')]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const session = request.sessionUtilisateur!;
    const dto = request.body as CreerAvancementEchelonDto;

    try {
      const nouvelEchelon = await carrieresService.avancerEchelon(
        dto,
        session.utilisateur_id,
        session.nom_complet,
        session.role,
        request.ip
      );

      return reply.status(201).send({
        statut: 'SUCCES',
        message: `Avancement d'échelon validé : Échelon ${nouvelEchelon.echelon} attribué avec succès.`,
        echelon: nouvelEchelon,
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

  // POST /api/carrieres/promotion & POST /api/promotions
  const handlerPromotion = async (request: FastifyRequest, reply: FastifyReply) => {
    const session = request.sessionUtilisateur!;
    const dto = request.body as EnregistrerPromotionDto;

    try {
      const promo = await carrieresService.enregistrerPromotion(
        dto,
        session.utilisateur_id,
        session.nom_complet,
        session.role,
        request.ip
      );

      return reply.status(201).send({
        statut: 'SUCCES',
        message: `Promotion au grade de ${promo.nouveau_grade} enregistrée avec succès sous la référence ${promo.numero_decret}.`,
        promotion: promo,
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

  fastify.post('/carrieres/promotion', {
    preHandler: [authentifierSession, exigerRoles('GESTIONNAIRE_RH', 'ADMIN_FONCTIONNEL_RH')]
  }, handlerPromotion);

  fastify.post('/promotions', {
    preHandler: [authentifierSession, exigerRoles('GESTIONNAIRE_RH', 'ADMIN_FONCTIONNEL_RH')]
  }, handlerPromotion);

  // ==========================================================================
  // 2. PROMOTIONS & TABLEAU D'AVANCEMENT
  // ==========================================================================

  // GET /api/promotions/tableau-avancement/eligibles & GET /api/promotions/eligibles
  const handlerEligibles = async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as any;
    const annee = query.annee ? parseInt(query.annee, 10) : 2026;

    try {
      const eligibles = await carrieresService.obtenirEligiblesTableauAvancement(annee, query.corps, query.grade_actuel);
      return reply.status(200).send({
        statut: 'SUCCES',
        annee,
        total: eligibles.length,
        eligibles,
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

  fastify.get('/promotions/tableau-avancement/eligibles', {
    preHandler: [authentifierSession, exigerRoles('GESTIONNAIRE_RH', 'ADMIN_FONCTIONNEL_RH', 'AUDITEUR')]
  }, handlerEligibles);

  fastify.get('/promotions/eligibles', {
    preHandler: [authentifierSession, exigerRoles('GESTIONNAIRE_RH', 'ADMIN_FONCTIONNEL_RH', 'AUDITEUR')]
  }, handlerEligibles);

  // POST /api/promotions/tableau-avancement/simulation
  fastify.post('/promotions/tableau-avancement/simulation', {
    preHandler: [authentifierSession, exigerRoles('GESTIONNAIRE_RH', 'ADMIN_FONCTIONNEL_RH')]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as any;
    const cohortes = body.cohortes || [];

    const simulation = cohortes.map((c: any) => {
      const deltaIndice = (c.nouvel_indice || 500) - (c.indice_actuel || 450);
      const impactMensuelDjf = deltaIndice * 100.0;
      const impactAnnuelDjf = impactMensuelDjf * 12;
      return {
        agent_id: c.agent_id,
        nouveau_grade: c.nouveau_grade,
        nouvel_echelon: c.nouvel_echelon,
        delta_indice: deltaIndice,
        impact_mensuel_djf: impactMensuelDjf,
        impact_annuel_djf: impactAnnuelDjf
      };
    });

    const masseSalarialeAdditionnelle = simulation.reduce((acc: number, s: any) => acc + s.impact_annuel_djf, 0);

    return reply.status(200).send({
      statut: 'SUCCES',
      nombre_promotions_simulees: simulation.length,
      impact_masse_salariale_annuelle_djf: masseSalarialeAdditionnelle,
      simulation,
      horodatage: new Date().toISOString()
    });
  });

  // ==========================================================================
  // 3. POSITIONS STATUTAIRES
  // ==========================================================================

  // GET /api/positions/:agentId
  fastify.get('/positions/:agentId', { preHandler: [authentifierSession] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const session = request.sessionUtilisateur!;
    const { agentId } = request.params as { agentId: string };

    if (session.role === 'ADMIN_TECHNIQUE') {
      return reply.status(403).send({
        statut: 'ERREUR',
        code_erreur: 'ACCES_INTERDIT',
        message: "Accès interdit : Les administrateurs techniques ne disposent d'aucun droit d'accès aux dossiers nominatifs RH.",
        horodatage: new Date().toISOString()
      });
    }

    const agent = await agentsService.trouverAgentParId(agentId);
    if (!agent) {
      return reply.status(404).send({
        statut: 'ERREUR',
        code_erreur: 'AGENT_INTROUVABLE',
        message: `L'agent ciblé (${agentId}) est introuvable.`,
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
      const carriere = await carrieresService.obtenirCarriereAgent(agentId);
      return reply.status(200).send({
        statut: 'SUCCES',
        agent_id: agentId,
        positions: carriere.positions,
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

  // POST /api/positions
  fastify.post('/positions', {
    preHandler: [authentifierSession, exigerRoles('GESTIONNAIRE_RH', 'ADMIN_FONCTIONNEL_RH')]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const session = request.sessionUtilisateur!;
    const dto = request.body as DeclarerPositionDto;

    try {
      const nouvellePos = await carrieresService.declarerPosition(
        dto,
        session.utilisateur_id,
        session.nom_complet,
        session.role,
        request.ip
      );

      return reply.status(201).send({
        statut: 'SUCCES',
        message: `Position statutaire [${nouvellePos.position}] enregistrée avec succès.`,
        position: nouvellePos,
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

  // ==========================================================================
  // 4. FORMATIONS & QUALIFICATIONS
  // ==========================================================================

  // GET /api/formations
  fastify.get('/formations', { preHandler: [authentifierSession] }, async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const formations = await carrieresService.listerFormations();
      return reply.status(200).send({
        statut: 'SUCCES',
        total: formations.length,
        formations,
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

  // GET /api/qualifications
  fastify.get('/qualifications', { preHandler: [authentifierSession] }, async (request: FastifyRequest, reply: FastifyReply) => {
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

    // Si filtré par agent, vérification ABAC
    if (query.agent_id) {
      const agent = await agentsService.trouverAgentParId(query.agent_id);
      if (agent) {
        const autorise = verifierPerimetreAgent({
          id: agent.id,
          matricule: agent.matricule,
          unite_actuelle_id: agent.unite_actuelle_id
        }, request, reply);
        if (!autorise) return;
      }
    } else if (session.role === 'AGENT') {
      query.agent_id = session.agent_id;
    }

    try {
      const qualifications = await carrieresService.listerQualifications(query.agent_id, query.type_qualification);
      return reply.status(200).send({
        statut: 'SUCCES',
        total: qualifications.length,
        qualifications,
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

  // GET /api/qualifications/alertes-peremption
  fastify.get('/qualifications/alertes-peremption', {
    preHandler: [authentifierSession, exigerRoles('GESTIONNAIRE_RH', 'ADMIN_FONCTIONNEL_RH', 'CHEF_DE_SERVICE')]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const session = request.sessionUtilisateur!;
    const unitesAutorisees = session.role === 'CHEF_DE_SERVICE' ? session.unites_autorisees : undefined;

    try {
      const alertes = await carrieresService.obtenirAlertesPeremption(unitesAutorisees);
      return reply.status(200).send({
        statut: 'SUCCES',
        total_alertes: alertes.length,
        alertes,
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

  // POST /api/qualifications
  fastify.post('/qualifications', {
    preHandler: [authentifierSession, exigerRoles('GESTIONNAIRE_RH', 'ADMIN_FONCTIONNEL_RH')]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const session = request.sessionUtilisateur!;
    const dto = request.body as CreerQualificationDto;

    try {
      const qualif = await carrieresService.creerQualification(
        dto,
        session.utilisateur_id,
        session.nom_complet,
        session.role,
        request.ip
      );

      return reply.status(201).send({
        statut: 'SUCCES',
        message: `Habilitation/Qualification [${qualif.type_qualification}] enregistrée avec succès.`,
        qualification: qualif,
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

  // ==========================================================================
  // 5. NOTATIONS & ÉVALUATIONS ANNUELLES
  // ==========================================================================

  // GET /api/notations/:agentId
  fastify.get('/notations/:agentId', { preHandler: [authentifierSession] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const session = request.sessionUtilisateur!;
    const { agentId } = request.params as { agentId: string };

    if (session.role === 'ADMIN_TECHNIQUE') {
      return reply.status(403).send({
        statut: 'ERREUR',
        code_erreur: 'ACCES_INTERDIT',
        message: "Accès interdit : Les administrateurs techniques ne disposent d'aucun droit d'accès aux dossiers nominatifs RH.",
        horodatage: new Date().toISOString()
      });
    }

    const agent = await agentsService.trouverAgentParId(agentId);
    if (!agent) {
      return reply.status(404).send({
        statut: 'ERREUR',
        code_erreur: 'AGENT_INTROUVABLE',
        message: `L'agent ciblé (${agentId}) est introuvable.`,
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
      const carriere = await carrieresService.obtenirCarriereAgent(agentId);
      return reply.status(200).send({
        statut: 'SUCCES',
        agent_id: agentId,
        notations: carriere.notations,
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

  // POST /api/notations
  fastify.post('/notations', {
    preHandler: [authentifierSession, exigerRoles('CHEF_DE_SERVICE', 'GESTIONNAIRE_RH', 'ADMIN_FONCTIONNEL_RH')]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const session = request.sessionUtilisateur!;
    const dto = request.body as CreerNotationDto;

    // Si CHEF_DE_SERVICE, contrôle de périmètre sur l'agent évalué
    if (session.role === 'CHEF_DE_SERVICE') {
      const agent = await agentsService.trouverAgentParId(dto.agent_id);
      if (!agent) {
        return reply.status(404).send({
          statut: 'ERREUR',
          code_erreur: 'AGENT_INTROUVABLE',
          message: `L'agent ciblé (${dto.agent_id}) est introuvable.`,
          horodatage: new Date().toISOString()
        });
      }
      const autorise = verifierPerimetreAgent({
        id: agent.id,
        matricule: agent.matricule,
        unite_actuelle_id: agent.unite_actuelle_id
      }, request, reply);
      if (!autorise) return;
    }

    try {
      const notation = await carrieresService.creerNotation(
        dto,
        session.agent_id || session.utilisateur_id,
        session.nom_complet,
        session.role,
        request.ip
      );

      return reply.status(201).send({
        statut: 'SUCCES',
        message: `Notation annuelle enregistrée : Note globale ${notation.note_chiffree} / 20.00.`,
        notation,
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
      // Interception des erreurs de contrainte PostgreSQL
      if (err.code === '23514' && err.constraint === 'chk_notations_interdiction_medicale') {
        return reply.status(400).send({
          statut: 'ERREUR',
          code_erreur: 'DONNEE_MEDICALE_PROHIBEE',
          message: "VIOLATION_CONFIDENTIALITE_MEDICALE : L'évaluation administrative ne doit comporter aucune appréciation relative à la santé, aux traitements ou à l'état médical de l'agent.",
          horodatage: new Date().toISOString()
        });
      }
      throw err;
    }
  });

  // PUT /api/notations/:id/recours
  fastify.put('/notations/:id/recours', { preHandler: [authentifierSession] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const session = request.sessionUtilisateur!;
    const { id } = request.params as { id: string };
    const dto = request.body as DeposerRecoursNotationDto;

    if (session.role === 'ADMIN_TECHNIQUE') {
      return reply.status(403).send({
        statut: 'ERREUR',
        code_erreur: 'ACCES_INTERDIT',
        message: "Accès interdit : Les administrateurs techniques ne disposent d'aucun droit d'accès aux dossiers nominatifs RH.",
        horodatage: new Date().toISOString()
      });
    }

    try {
      const notation = await carrieresService.deposerRecours(
        id,
        dto,
        session.utilisateur_id,
        session.nom_complet,
        session.role,
        request.ip
      );

      return reply.status(200).send({
        statut: 'SUCCES',
        message: 'Recours administratif gracieux enregistré avec succès auprès de la Commission d Évaluation de la DGPN.',
        notation,
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
      if (err.code === '23514' && err.constraint === 'chk_notations_interdiction_medicale') {
        return reply.status(400).send({
          statut: 'ERREUR',
          code_erreur: 'DONNEE_MEDICALE_PROHIBEE',
          message: "VIOLATION_CONFIDENTIALITE_MEDICALE : Le motif de recours administratif ne doit comporter aucune donnée de santé ou médicale.",
          horodatage: new Date().toISOString()
        });
      }
      throw err;
    }
  });

  // PUT /api/notations/:id/decision-recours
  fastify.put('/notations/:id/decision-recours', {
    preHandler: [authentifierSession, exigerRoles('GESTIONNAIRE_RH', 'ADMIN_FONCTIONNEL_RH')]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const session = request.sessionUtilisateur!;
    const { id } = request.params as { id: string };
    const dto = request.body as ArbitrerRecoursNotationDto;

    try {
      const notation = await carrieresService.arbitrerRecours(
        id,
        dto,
        session.utilisateur_id,
        session.nom_complet,
        session.role,
        request.ip
      );

      return reply.status(200).send({
        statut: 'SUCCES',
        message: `Arbitrage du recours validé : Décision [${notation.decision_recours}], note définitive ${notation.note_definitive}/20.`,
        notation,
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

  // ==========================================================================
  // 6. SOLDE & EXPORTS SCELLÉS SHA-256
  // ==========================================================================

  // GET /api/solde/calculs/:moisAnnee & GET /api/solde/elements/:moisAnnee
  const handlerConsultationSolde = async (request: FastifyRequest, reply: FastifyReply) => {
    const { moisAnnee } = request.params as { moisAnnee: string };

    try {
      const solde = await carrieresService.obtenirSoldeMensuelle(moisAnnee);
      return reply.status(200).send({
        statut: 'SUCCES',
        ...solde
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

  fastify.get('/solde/calculs/:moisAnnee', {
    preHandler: [authentifierSession, exigerRoles('GESTIONNAIRE_RH', 'ADMIN_FONCTIONNEL_RH', 'AUDITEUR')]
  }, handlerConsultationSolde);

  fastify.get('/solde/elements/:moisAnnee', {
    preHandler: [authentifierSession, exigerRoles('GESTIONNAIRE_RH', 'ADMIN_FONCTIONNEL_RH', 'AUDITEUR')]
  }, handlerConsultationSolde);

  // POST /api/solde/calculs/:moisAnnee/generer & POST /api/solde/calculer
  const handlerGenererSolde = async (request: FastifyRequest, reply: FastifyReply) => {
    const session = request.sessionUtilisateur!;
    const params = request.params as any;
    const body = request.body as any;
    const moisAnnee = params.moisAnnee || (body && body.mois_annee) || '2026-02';

    try {
      const elements = await carrieresService.calculerSoldeMensuelle(moisAnnee, session.utilisateur_id);
      return reply.status(200).send({
        statut: 'SUCCES',
        message: `Calcul de solde mensuel achevé pour la période ${moisAnnee} (${elements.length} bulletins générés).`,
        mois_annee: moisAnnee,
        nombre_bulletins: elements.length,
        elements,
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

  fastify.post('/solde/calculs/:moisAnnee/generer', {
    preHandler: [authentifierSession, exigerRoles('GESTIONNAIRE_RH', 'ADMIN_FONCTIONNEL_RH')]
  }, handlerGenererSolde);

  fastify.post('/solde/calculer', {
    preHandler: [authentifierSession, exigerRoles('GESTIONNAIRE_RH', 'ADMIN_FONCTIONNEL_RH')]
  }, handlerGenererSolde);

  // GET /api/solde/exports
  fastify.get('/solde/exports', {
    preHandler: [authentifierSession, exigerRoles('GESTIONNAIRE_RH', 'ADMIN_FONCTIONNEL_RH', 'AUDITEUR')]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as any;

    try {
      const exportsList = await carrieresService.listerExportsSolde(query.mois_annee);
      return reply.status(200).send({
        statut: 'SUCCES',
        total: exportsList.length,
        exports: exportsList,
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

  // POST /api/solde/exports & POST /api/solde/export-scelle
  const handlerExportSolde = async (request: FastifyRequest, reply: FastifyReply) => {
    const session = request.sessionUtilisateur!;
    const body = request.body as any;
    const moisAnnee = body.mois_annee || '2026-01';
    const format = body.format || 'CSV_TRESOR_DJIBOUTI';

    try {
      const exportResult = await carrieresService.genererExportSolde(
        moisAnnee,
        format,
        session.utilisateur_id,
        session.nom_complet,
        session.role,
        request.ip
      );

      return reply.status(201).send({
        statut: 'SUCCES',
        message: `Export de solde scellé par empreinte SHA-256 avec succès (${exportResult.reference_export}).`,
        export: exportResult,
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

  fastify.post('/solde/exports', {
    preHandler: [authentifierSession, exigerRoles('GESTIONNAIRE_RH', 'ADMIN_FONCTIONNEL_RH')]
  }, handlerExportSolde);

  fastify.post('/solde/export-scelle', {
    preHandler: [authentifierSession, exigerRoles('GESTIONNAIRE_RH', 'ADMIN_FONCTIONNEL_RH')]
  }, handlerExportSolde);
}
