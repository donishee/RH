import { FastifyError, FastifyRequest, FastifyReply } from 'fastify';

export function gestionnaireErreursFrancais(error: FastifyError, request: FastifyRequest, reply: FastifyReply) {
  const code = (error as any).statusCode || 500;
  let codeErreur = 'ERREUR_INTERNE_SERVEUR';
  let message = 'Une erreur inattendue est survenue lors du traitement de la requête.';

  // Traduction des erreurs d'intégrité et contraintes PostgreSQL
  if ((error as any).code === '23505') {
    codeErreur = 'VIOLATION_UNICITE_OU_IMMUABILITE';
    message = 'Violation d\'intégrité : Cette ressource existe déjà ou est protégée par une règle d\'immuabilité inaltérable.';
  } else if ((error as any).code === '23503') {
    codeErreur = 'VIOLATION_INTEGRITE_REFERENTIELLE';
    message = 'Violation d\'intégrité référentielle : Une des références (unité, poste, agent) est introuvable ou incompatible.';
  } else if ((error as any).code === '22000') {
    codeErreur = 'VIOLATION_HIERARCHIE';
    message = error.message || 'Violation de contrainte hiérarchique : Un cycle ou une parenté invalide a été détecté.';
  } else if ((error as any).validation) {
    codeErreur = 'REQUETE_INVALIDE';
    message = 'Paramètres de requête non conformes aux spécifications du système.';
  } else if (error.message) {
    message = error.message;
  }

  reply.status(code >= 400 && code < 600 ? code : 500).send({
    statut: 'ERREUR',
    code_erreur: codeErreur,
    message,
    horodatage: new Date().toISOString()
  });
}
