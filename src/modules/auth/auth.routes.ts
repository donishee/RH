import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authService } from './auth.service';
import { authentifierSession } from '../../middleware/authentification';

export async function authRoutes(fastify: FastifyInstance): Promise<void> {
  // Connexion
  fastify.post('/connexion', async (request: FastifyRequest, reply: FastifyReply) => {
    const { identifiant, mot_de_passe } = (request.body as any) || {};

    if (!identifiant || !mot_de_passe) {
      return reply.status(400).send({
        statut: 'ERREUR',
        code_erreur: 'CHAMPS_MANQUANTS',
        message: 'L\'identifiant et le mot de passe sont obligatoires.',
        horodatage: new Date().toISOString()
      });
    }

    const resultat = await authService.connecter(
      identifiant,
      mot_de_passe,
      request.ip,
      request.headers['user-agent']
    );

    if (!resultat.succes) {
      return reply.status(resultat.codeHttp).send({
        statut: 'ERREUR',
        code_erreur: resultat.codeHttp === 423 ? 'COMPTE_VERROUILLE' : 'ECHEC_AUTHENTIFICATION',
        message: resultat.message,
        tentatives_restantes: resultat.tentativesRestantes,
        horodatage: new Date().toISOString()
      });
    }

    // Déposer le cookie de session sécurisé HttpOnly
    if (resultat.jetonOpaque && (reply as any).setCookie) {
      (reply as any).setCookie('sirh_session', resultat.jetonOpaque, {
        path: '/',
        httpOnly: true,
        secure: false, // Local intranet
        sameSite: 'strict',
        maxAge: 900 // 15 minutes
      });
    }

    return reply.status(200).send({
      statut: 'SUCCES',
      jeton: resultat.jetonOpaque,
      session: resultat.session,
      message: resultat.message,
      horodatage: new Date().toISOString()
    });
  });

  // Déconnexion
  fastify.post('/deconnexion', { preHandler: [authentifierSession] }, async (request: FastifyRequest, reply: FastifyReply) => {
    let jetonOpaque: string | undefined;
    const authHeader = request.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      jetonOpaque = authHeader.substring(7).trim();
    }
    if (!jetonOpaque && (request as any).cookies) {
      jetonOpaque = (request as any).cookies.sirh_session;
    }

    if (jetonOpaque) {
      await authService.deconnecter(jetonOpaque);
    }

    if ((reply as any).clearCookie) {
      (reply as any).clearCookie('sirh_session', { path: '/' });
    }

    return reply.status(200).send({
      statut: 'SUCCES',
      message: 'Déconnexion effectuée avec succès.',
      horodatage: new Date().toISOString()
    });
  });

  // Consultation de la session active
  fastify.get('/session', { preHandler: [authentifierSession] }, async (request: FastifyRequest, reply: FastifyReply) => {
    return reply.status(200).send({
      statut: 'SUCCES',
      session: request.sessionUtilisateur,
      horodatage: new Date().toISOString()
    });
  });
}
