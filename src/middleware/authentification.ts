import { FastifyRequest, FastifyReply } from 'fastify';
import { authService } from '../modules/auth/auth.service';
import { SessionUtilisateur } from '../types/session';

declare module 'fastify' {
  interface FastifyRequest {
    sessionUtilisateur?: SessionUtilisateur;
  }
}

export async function authentifierSession(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  let jetonOpaque: string | undefined;

  // 1. Extraction depuis l'en-tête Authorization Bearer
  const authHeader = request.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    jetonOpaque = authHeader.substring(7).trim();
  }

  // 2. Extraction de secours depuis les cookies
  if (!jetonOpaque && (request as any).cookies) {
    jetonOpaque = (request as any).cookies.sirh_session;
  }

  if (!jetonOpaque) {
    reply.status(401).send({
      statut: 'ERREUR',
      code_erreur: 'NON_AUTHENTIFIE',
      message: 'Non Authentifié : Jeton de session manquant ou invalide.',
      horodatage: new Date().toISOString()
    });
    return;
  }

  const session = await authService.validerSession(jetonOpaque, request.ip);
  if (!session) {
    reply.status(401).send({
      statut: 'ERREUR',
      code_erreur: 'SESSION_EXPIREE',
      message: 'Non Authentifié : Session expirée ou invalide. Veuillez vous reconnecter.',
      horodatage: new Date().toISOString()
    });
    return;
  }

  request.sessionUtilisateur = session;
}
