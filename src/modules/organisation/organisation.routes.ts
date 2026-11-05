import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { organisationService } from './organisation.service';
import { authentifierSession } from '../../middleware/authentification';
import { exigerRoles } from '../../middleware/rbac';

export async function organisationRoutes(fastify: FastifyInstance): Promise<void> {
  // Liste des unités (accessible à tout utilisateur authentifié)
  fastify.get('/unites', { preHandler: [authentifierSession] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as any;
    const unites = await organisationService.listerUnites({
      region: query.region,
      type_unite: query.type_unite
    });

    return reply.status(200).send({
      statut: 'SUCCES',
      total: unites.length,
      unites,
      horodatage: new Date().toISOString()
    });
  });

  // Fiche d'une unité
  fastify.get('/unites/:id', { preHandler: [authentifierSession] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as any;
    const unite = await organisationService.trouverUniteParId(id);

    if (!unite) {
      return reply.status(404).send({
        statut: 'ERREUR',
        code_erreur: 'UNITE_INTROUVABLE',
        message: `L'unité avec l'identifiant ${id} est introuvable.`,
        horodatage: new Date().toISOString()
      });
    }

    return reply.status(200).send({
      statut: 'SUCCES',
      unite,
      horodatage: new Date().toISOString()
    });
  });

  // Sous-arborescence hiérarchique récursive
  fastify.get('/unites/:id/arborescence', { preHandler: [authentifierSession] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as any;
    const arborescence = await organisationService.trouverSousArborescence(id);

    return reply.status(200).send({
      statut: 'SUCCES',
      total: arborescence.length,
      arborescence,
      horodatage: new Date().toISOString()
    });
  });

  // Création d'une unité (réservée ADMIN_FONCTIONNEL_RH et ADMIN_TECHNIQUE)
  fastify.post('/unites', {
    preHandler: [authentifierSession, exigerRoles('ADMIN_FONCTIONNEL_RH', 'ADMIN_TECHNIQUE')]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as any;

    if (!body || !body.code || !body.nom || !body.type_unite) {
      return reply.status(400).send({
        statut: 'ERREUR',
        code_erreur: 'PARAMETRES_MANQUANTS',
        message: 'Les champs code, nom et type_unite sont obligatoires.',
        horodatage: new Date().toISOString()
      });
    }

    const nouvelleUnite = await organisationService.creerUnite(body, request.sessionUtilisateur);

    return reply.status(201).send({
      statut: 'SUCCES',
      message: 'Unité organisationnelle créée avec succès.',
      unite: nouvelleUnite,
      horodatage: new Date().toISOString()
    });
  });

  // Modification d'une unité
  fastify.put('/unites/:id', {
    preHandler: [authentifierSession, exigerRoles('ADMIN_FONCTIONNEL_RH', 'ADMIN_TECHNIQUE')]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as any;
    const body = request.body as any;

    const uniteMaj = await organisationService.modifierUnite(id, body, request.sessionUtilisateur);

    return reply.status(200).send({
      statut: 'SUCCES',
      message: 'Unité mise à jour avec succès.',
      unite: uniteMaj,
      horodatage: new Date().toISOString()
    });
  });

  // Liste des postes
  fastify.get('/postes', { preHandler: [authentifierSession] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as any;
    const postes = await organisationService.listerPostes({
      unite_id: query.unite_id,
      est_vacant: query.est_vacant !== undefined ? query.est_vacant === 'true' : undefined
    });

    return reply.status(200).send({
      statut: 'SUCCES',
      total: postes.length,
      postes,
      horodatage: new Date().toISOString()
    });
  });

  // Création d'un poste
  fastify.post('/postes', {
    preHandler: [authentifierSession, exigerRoles('ADMIN_FONCTIONNEL_RH', 'GESTIONNAIRE_RH')]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as any;

    if (!body || !body.code_poste || !body.intitule || !body.unite_id || !body.grade_requis) {
      return reply.status(400).send({
        statut: 'ERREUR',
        code_erreur: 'PARAMETRES_MANQUANTS',
        message: 'Les champs code_poste, intitule, unite_id et grade_requis sont obligatoires.',
        horodatage: new Date().toISOString()
      });
    }

    const poste = await organisationService.creerPoste(body, request.sessionUtilisateur);

    return reply.status(201).send({
      statut: 'SUCCES',
      message: 'Poste créé avec succès.',
      poste,
      horodatage: new Date().toISOString()
    });
  });
}
