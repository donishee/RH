import { RoleUtilisateur } from './roles';

export interface SessionUtilisateur {
  session_id: string;
  utilisateur_id: string;
  identifiant: string;
  matricule: string;
  nom_complet: string;
  role: RoleUtilisateur;
  agent_id?: string | null;
  unite_id?: string | null;
  unites_autorisees: string[];
  adresse_ip: string;
  expire_le: Date | string;
}
