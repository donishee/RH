export type RoleUtilisateur =
  | 'ADMIN_TECHNIQUE'
  | 'ADMIN_FONCTIONNEL_RH'
  | 'GESTIONNAIRE_RH'
  | 'CHEF_DE_SERVICE'
  | 'AGENT'
  | 'AUDITEUR';

export const TOUS_LES_ROLES: RoleUtilisateur[] = [
  'ADMIN_TECHNIQUE',
  'ADMIN_FONCTIONNEL_RH',
  'GESTIONNAIRE_RH',
  'CHEF_DE_SERVICE',
  'AGENT',
  'AUDITEUR'
];

export const PERMISSIONS_PAR_ROLE: Record<RoleUtilisateur, string[]> = {
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
