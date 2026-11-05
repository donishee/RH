import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { adminConsoleService } from './admin-console.service';
import { authentifierSession } from '../../middleware/authentification';
import { exigerRoles } from '../../middleware/rbac';

export async function adminConsoleRoutes(fastify: FastifyInstance): Promise<void> {
  // Liste des champs personnalisés (consultable par tous les profils authentifiés pour le rendu dynamique des formulaires)
  fastify.get('/champs', { preHandler: [authentifierSession] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as any;
    const inclureInactifs = query.tous === 'true';
    const champs = await adminConsoleService.listerChamps(query.entite_cible, inclureInactifs);

    return reply.status(200).send({
      statut: 'SUCCES',
      total: champs.length,
      champs,
      horodatage: new Date().toISOString()
    });
  });

  // Ajout d'un champ personnalisé (réservé ADMIN_FONCTIONNEL_RH)
  fastify.post('/champs', {
    preHandler: [authentifierSession, exigerRoles('ADMIN_FONCTIONNEL_RH')]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as any;

    if (!body || !body.code_champ || !body.libelle || !body.type_donnee) {
      return reply.status(400).send({
        statut: 'ERREUR',
        code_erreur: 'PARAMETRES_MANQUANTS',
        message: 'Les champs code_champ, libelle et type_donnee sont obligatoires.',
        horodatage: new Date().toISOString()
      });
    }

    try {
      const nouveauChamp = await adminConsoleService.ajouterChamp(body, request.sessionUtilisateur!);
      return reply.status(201).send({
        statut: 'SUCCES',
        message: 'Champ personnalisé ajouté avec succès au Form Builder.',
        champ: nouveauChamp,
        horodatage: new Date().toISOString()
      });
    } catch (error: any) {
      if (error.message?.includes('INTERDICTION_SECRET_MEDICAL')) {
        return reply.status(400).send({
          statut: 'ERREUR',
          code_erreur: 'INTERDICTION_DONNEE_MEDICALE',
          message: error.message,
          horodatage: new Date().toISOString()
        });
      }
      if (error.message?.includes('COLLISION_COLONNE_SYSTEME')) {
        return reply.status(400).send({
          statut: 'ERREUR',
          code_erreur: 'COLLISION_COLONNE_SYSTEME',
          message: error.message,
          horodatage: new Date().toISOString()
        });
      }
      if (error.code === '23505') {
        return reply.status(409).send({
          statut: 'ERREUR',
          code_erreur: 'DOUBLON_CHAMP',
          message: 'Un champ avec ce code existe déjà pour cette entité.',
          horodatage: new Date().toISOString()
        });
      }
      throw error;
    }
  });

  // Modification d'un champ personnalisé
  fastify.put('/champs/:id', {
    preHandler: [authentifierSession, exigerRoles('ADMIN_FONCTIONNEL_RH')]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as any;
    const body = request.body as any;

    try {
      const champMaj = await adminConsoleService.modifierChamp(id, body, request.sessionUtilisateur!);
      return reply.status(200).send({
        statut: 'SUCCES',
        message: 'Champ personnalisé modifié avec succès.',
        champ: champMaj,
        horodatage: new Date().toISOString()
      });
    } catch (error: any) {
      if (error.message?.includes('INTERDICTION_SECRET_MEDICAL')) {
        return reply.status(400).send({
          statut: 'ERREUR',
          code_erreur: 'INTERDICTION_DONNEE_MEDICALE',
          message: error.message,
          horodatage: new Date().toISOString()
        });
      }
      throw error;
    }
  });

  // Consultation des listes de valeurs éditables
  fastify.get('/listes-valeurs', { preHandler: [authentifierSession] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const listes = await adminConsoleService.listerListesValeurs();
    return reply.status(200).send({
      statut: 'SUCCES',
      total: listes.length,
      listes,
      horodatage: new Date().toISOString()
    });
  });

  // Ajout d'un élément à une liste de valeurs
  fastify.post('/listes-valeurs/:code/elements', {
    preHandler: [authentifierSession, exigerRoles('ADMIN_FONCTIONNEL_RH')]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { code } = request.params as any;
    const body = request.body as any;

    if (!body || !body.code_element || !body.libelle) {
      return reply.status(400).send({
        statut: 'ERREUR',
        code_erreur: 'PARAMETRES_MANQUANTS',
        message: 'Les champs code_element et libelle sont obligatoires.',
        horodatage: new Date().toISOString()
      });
    }

    const element = await adminConsoleService.ajouterElementListeValeurs(code, body, request.sessionUtilisateur!);

    return reply.status(201).send({
      statut: 'SUCCES',
      message: 'Élément ajouté à la liste de valeurs.',
      element,
      horodatage: new Date().toISOString()
    });
  });

  // Consultation de l'historique des versions de configuration
  fastify.get('/versions', {
    preHandler: [authentifierSession, exigerRoles('ADMIN_FONCTIONNEL_RH', 'ADMIN_TECHNIQUE', 'AUDITEUR')]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const versions = await adminConsoleService.listerVersions();
    return reply.status(200).send({
      statut: 'SUCCES',
      total: versions.length,
      versions,
      horodatage: new Date().toISOString()
    });
  });

  // Publication d'une nouvelle version de configuration
  fastify.post('/versions/publier', {
    preHandler: [authentifierSession, exigerRoles('ADMIN_FONCTIONNEL_RH')]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { commentaire } = (request.body as any) || {};

    if (!commentaire) {
      return reply.status(400).send({
        statut: 'ERREUR',
        code_erreur: 'COMMENTAIRE_REQUIS',
        message: 'Un commentaire explicatif de l\'évolution est obligatoire.',
        horodatage: new Date().toISOString()
      });
    }

    const version = await adminConsoleService.publierVersionConfiguration(commentaire, request.sessionUtilisateur!);

    return reply.status(201).send({
      statut: 'SUCCES',
      message: 'Nouvelle version de configuration publiée avec succès.',
      version,
      horodatage: new Date().toISOString()
    });
  });

  // Rollback vers une version antérieure sans perte de données
  fastify.post('/versions/rollback', {
    preHandler: [authentifierSession, exigerRoles('ADMIN_FONCTIONNEL_RH')]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { version_cible, motif_justificatif } = (request.body as any) || {};

    if (!version_cible || !motif_justificatif) {
      return reply.status(400).send({
        statut: 'ERREUR',
        code_erreur: 'PARAMETRES_MANQUANTS',
        message: 'Les champs version_cible et motif_justificatif sont obligatoires.',
        horodatage: new Date().toISOString()
      });
    }

    try {
      const resultat = await adminConsoleService.rollbackVersVersion(
        version_cible,
        motif_justificatif,
        request.sessionUtilisateur!
      );

      return reply.status(200).send({
        statut: 'SUCCES',
        message: `Retour arrière vers la configuration ${version_cible} exécuté avec succès sans perte de données existantes.`,
        version_active: resultat.version_active,
        version_restauree: resultat.version_restauree,
        horodatage: new Date().toISOString()
      });
    } catch (error: any) {
      return reply.status(400).send({
        statut: 'ERREUR',
        code_erreur: 'ECHEC_ROLLBACK',
        message: error.message,
        horodatage: new Date().toISOString()
      });
    }
  });
}
