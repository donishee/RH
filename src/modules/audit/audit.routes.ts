import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { auditService } from './audit.service';
import { authentifierSession } from '../../middleware/authentification';
import { exigerRoles } from '../../middleware/rbac';

export async function auditRoutes(fastify: FastifyInstance): Promise<void> {
  // Consultation des journaux d'audit
  fastify.get('/journaux', {
    preHandler: [authentifierSession, exigerRoles('AUDITEUR', 'ADMIN_TECHNIQUE', 'GESTIONNAIRE_RH')]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as any;
    const limite = query.limite ? parseInt(query.limite, 10) : 50;
    const offset = query.offset ? parseInt(query.offset, 10) : 0;
    const actionType = query.action_type;

    const res = await auditService.listerLogs({ limite, offset, action_type: actionType });

    return reply.status(200).send({
      statut: 'SUCCES',
      total: res.total,
      journaux: res.logs,
      horodatage: new Date().toISOString()
    });
  });

  // Vérification cryptographique de l'intégrité de la chaîne
  fastify.get('/verifier-chaine', {
    preHandler: [authentifierSession, exigerRoles('AUDITEUR', 'ADMIN_TECHNIQUE')]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const verif = await auditService.verifierIntegriteChaine();

    return reply.status(200).send({
      statut: 'SUCCES',
      intégrité_conforme: verif.valid,
      nombre_entrees: verif.count,
      anomalies: verif.errors,
      horodatage: new Date().toISOString()
    });
  });
}
