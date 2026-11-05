export type StatutAudit = 'SUCCES' | 'ECHEC_SECURITE' | 'ECHEC_DROITS' | 'ECHEC_TECHNIQUE' | 'ECHEC_CONCURRENCE';

export interface ParametresEnregistrementAudit {
  utilisateur_id: string;
  nom_utilisateur?: string;
  role_utilise?: string;
  adresse_ip?: string;
  action_type: string;
  entite_cible: string;
  entite_id?: string | null;
  details_operation_json?: any;
  statut_operation?: StatutAudit;
}

export interface LigneAudit {
  id: number;
  horodatage: string;
  utilisateur_id: string;
  nom_utilisateur: string;
  role_utilise: string;
  adresse_ip: string;
  action_type: string;
  entite_cible: string;
  entite_id: string | null;
  details_operation_json: any;
  statut_operation: string;
  empreinte_precedente: string;
  empreinte_courante: string;
}
