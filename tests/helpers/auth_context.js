const { SESSIONS_FIXTURES, referentiel } = require('../fixtures/index.js');

// Matrice des permissions autorisées par rôle
const ROLE_PERMISSIONS = {
  ADMIN_TECHNIQUE: [
    'infra:sauvegarder',
    'infra:restaurer',
    'infra:comptes_techniques',
    'audit:logs_systeme'
  ],
  ADMIN_FONCTIONNEL_RH: [
    'config:champs_personnalises',
    'config:listes_valeurs',
    'config:rollback',
    'config:modeles_documents',
    'organisation:gerer',
    'audit:logs_config'
  ],
  GESTIONNAIRE_RH: [
    'agents:creer',
    'agents:consulter_global',
    'agents:modifier',
    'affectations:muter',
    'conges:valider_rh',
    'carrieres:avancement',
    'formations:attribuer',
    'solde:calculer',
    'solde:exporter',
    'aptitude:enregistrer'
  ],
  CHEF_DE_SERVICE: [
    'agents:consulter_unite',
    'conges:demander_soi',
    'conges:valider_n1',
    'planning:gerer_unite',
    'planning:remplacement',
    'formations:consulter_unite',
    'evaluation:noter_unite'
  ],
  AGENT: [
    'agents:consulter_soi',
    'conges:demander_soi',
    'conges:consulter_soi',
    'planning:consulter_soi',
    'formations:consulter_soi'
  ],
  AUDITEUR: [
    'audit:consulter_global',
    'audit:exporter',
    'agents:consulter_lecture_seule'
  ]
};

// Vérifie si une unité cible est dans la hiérarchie descendante d'une unité autorisée
function isUnitAuthorized(session, targetUnitId) {
  if (!session || !session.role) return false;
  if (session.unites_autorisees && session.unites_autorisees.includes('*')) return true;
  if (session.role === 'ADMIN_TECHNIQUE') return false; // Admin technique n'a accès à aucune unité RH

  if (!session.unites_autorisees || session.unites_autorisees.length === 0) return false;
  if (session.unites_autorisees.includes(targetUnitId)) return true;

  // Parcourir la hiérarchie ascendante de targetUnitId pour vérifier si un de ses parents est autorisé
  let currentUnit = referentiel.unités.find(u => u.id === targetUnitId);
  while (currentUnit && currentUnit.parent_id) {
    if (session.unites_autorisees.includes(currentUnit.parent_id)) {
      return true;
    }
    currentUnit = referentiel.unités.find(u => u.id === currentUnit.parent_id);
  }

  return false;
}

// Vérifie si l'accès à un agent est autorisé pour la session courante
function canAccessAgent(session, agent) {
  if (!session || !agent) return { allowed: false, code: 401, message: 'Session invalide ou inexistante' };

  // Règle 1: Admin Technique n'accède JAMAIS aux dossiers nominatifs RH
  if (session.role === 'ADMIN_TECHNIQUE') {
    return {
      allowed: false,
      code: 403,
      message: 'Accès interdit : Les administrateurs techniques ne disposent d\'aucun droit d\'accès aux dossiers nominatifs RH.'
    };
  }

  // Règle 2: Auditeur a accès en lecture seule globale
  if (session.role === 'AUDITEUR') {
    return { allowed: true, code: 200, mode: 'LECTURE_SEULE' };
  }

  // Règle 3: Gestionnaire RH a un accès global
  if (session.role === 'GESTIONNAIRE_RH') {
    return { allowed: true, code: 200, mode: 'COMPLET' };
  }

  // Règle 4: Agent individuel n'accède qu'à son propre dossier
  if (session.role === 'AGENT') {
    if (session.agent_id === agent.id || session.matricule === agent.matricule) {
      return { allowed: true, code: 200, mode: 'CONSULTATION_PROPRE_DOSSIER' };
    }
    return {
      allowed: false,
      code: 403,
      message: 'Accès interdit : Un agent ne peut consulter que son propre dossier individuel.'
    };
  }

  // Règle 5: Chef de service n'accède qu'aux agents de son unité ou ses sous-unités
  if (session.role === 'CHEF_DE_SERVICE') {
    if (isUnitAuthorized(session, agent.unite_actuelle_id)) {
      return { allowed: true, code: 200, mode: 'GESTION_UNITE' };
    }
    return {
      allowed: false,
      code: 403,
      message: `Accès interdit : L'agent appartient à une unité hors de votre périmètre hiérarchique autorisé (${agent.unite_actuelle_id}).`
    };
  }

  // Règle 6: Admin fonctionnel RH
  if (session.role === 'ADMIN_FONCTIONNEL_RH') {
    return { allowed: true, code: 200, mode: 'CONSULTATION_PARAMETRAGE' };
  }

  return { allowed: false, code: 403, message: 'Accès interdit : Rôle non habilité.' };
}

// Vérifie les tentatives d'élévation de privilèges
function checkPrivilegeEscalation(session, updatePayload) {
  if (!updatePayload) return { isEscalation: false };

  const forbiddenFields = ['role', 'permissions', 'unites_autorisees', 'est_admin_technique'];
  for (const field of forbiddenFields) {
    if (updatePayload[field] !== undefined) {
      if (session.role !== 'ADMIN_TECHNIQUE' || field === 'role') {
        return {
          isEscalation: true,
          field,
          attemptedValue: updatePayload[field],
          code: 403,
          message: `Tentative d'élévation de privilèges bloquée : la modification du champ '${field}' est strictement interdite.`
        };
      }
    }
  }

  return { isEscalation: false };
}

module.exports = {
  ROLE_PERMISSIONS,
  isUnitAuthorized,
  canAccessAgent,
  checkPrivilegeEscalation
};
