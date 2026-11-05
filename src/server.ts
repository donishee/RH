import fastify, { FastifyInstance } from 'fastify';
import fastifyCors from '@fastify/cors';
import fastifyCookie from '@fastify/cookie';
import fastifyStatic from '@fastify/static';
import * as path from 'path';
import * as fs from 'fs';
import { CONFIG } from './config';
import { testerConnexion, fermerPool, pool } from './database';
import { gestionnaireErreursFrancais } from './middleware/reponses_francais';
import { authRoutes } from './modules/auth/auth.routes';
import { auditRoutes } from './modules/audit/audit.routes';
import { organisationRoutes } from './modules/organisation/organisation.routes';
import { agentsRoutes } from './modules/agents/agents.routes';
import { affectationsRoutes } from './modules/affectations/affectations.routes';
import { adminConsoleRoutes } from './modules/admin-console/admin-console.routes';
import { congesController } from './modules/conges/conges.controller';
import { carrieresController } from './modules/carrieres/carrieres.controller';
import { operationnelController } from './modules/operationnel/operationnel.controller';

export async function creerApplicationServeur(): Promise<FastifyInstance> {
  const app = fastify({
    logger: false, // Logging contrôlé
    trustProxy: true
  });

  // Gestionnaire global d'erreurs 100% en français républicain
  app.setErrorHandler(gestionnaireErreursFrancais);

  // Fermeture propre des connexions de données à la clôture du serveur
  app.addHook('onClose', async () => {
    if (!pool.ending && !pool.ended) {
      await fermerPool().catch(() => {});
    }
  });

  // Plugins de sécurité et cookies
  await app.register(fastifyCors, {
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
  });

  await app.register(fastifyCookie, {
    secret: CONFIG.SESSION_SECRET,
    hook: 'onRequest'
  });

  // Distribution des fichiers statiques du frontend intranet (HTML5/CSS/JS)
  // Résolution automatique du répertoire public selon le mode d'exécution (tsx direct ou dist/ compilé)
  const repertoirePublic = fs.existsSync(path.join(__dirname, 'public'))
    ? path.join(__dirname, 'public')
    : path.resolve(__dirname, '..', 'src', 'public');

  await app.register(fastifyStatic, {
    root: repertoirePublic,
    prefix: '/'
  });

  // Route de contrôle de santé du serveur et de la base de données
  app.get('/api/sante', async (_request, reply) => {
    const dbOk = await testerConnexion();
    if (!dbOk) {
      return reply.status(503).send({
        statut: 'DEGRADE',
        base_de_donnees: 'INACCESSIBLE',
        message: 'Le serveur central est actif mais la base de données PostgreSQL est injoignable.',
        horodatage: new Date().toISOString()
      });
    }

    return reply.status(200).send({
      statut: 'OPERATIONNEL',
      systeme: 'SIRH Police Nationale de Djibouti',
      version: '1.0.0',
      base_de_donnees: 'CONNECTEE',
      horodatage: new Date().toISOString()
    });
  });

  // Enregistrement des modules fonctionnels
  await app.register(authRoutes, { prefix: '/api/auth' });
  await app.register(auditRoutes, { prefix: '/api/audit' });
  await app.register(organisationRoutes, { prefix: '/api' });
  await app.register(agentsRoutes, { prefix: '/api/agents' });
  await app.register(affectationsRoutes, { prefix: '/api' });
  await app.register(adminConsoleRoutes, { prefix: '/api/config' });
  await app.register(congesController, { prefix: '/api/conges' });
  await app.register(carrieresController, { prefix: '/api' });
  await app.register(operationnelController, { prefix: '/api' });

  return app;
}

export async function demarrerServeur(): Promise<FastifyInstance> {
  const app = await creerApplicationServeur();

  try {
    const adresse = await app.listen({ port: CONFIG.PORT, host: CONFIG.HOST });
    console.log(`Serveur SIRH Police Djiboutienne démarré avec succès sur ${adresse}`);
    console.log(`Interface Web Intranet accessible sur http://${CONFIG.HOST}:${CONFIG.PORT}/`);
  } catch (err) {
    console.error('Erreur critique lors du démarrage du serveur :', err);
    process.exit(1);
  }

  // Arrêt propre du serveur et libération des ressources (Graceful Shutdown)
  const signaux = ['SIGINT', 'SIGTERM'];
  for (const sig of signaux) {
    process.on(sig, async () => {
      console.log(`Signal ${sig} reçu : fermeture ordonnée du serveur...`);
      await app.close();
      await fermerPool();
      console.log('Serveur arrêté et pool de connexions libéré.');
      process.exit(0);
    });
  }

  return app;
}

if (require.main === module) {
  demarrerServeur();
}
