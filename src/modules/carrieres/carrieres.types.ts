// ============================================================================
// DTOs & TYPES — JALON M3 (CARRIÈRES, PROMOTIONS, POSITIONS, FORMATIONS, NOTATIONS & SOLDE)
// Direction Générale de la Police Nationale — République de Djibouti
// ============================================================================

export type CorpsPolicier = 
  | 'OFFICIERS_GENERAUX'
  | 'OFFICIERS_SUPERIEURS'
  | 'OFFICIERS_SUBALTERNES'
  | 'SOUS_OFFICIERS'
  | 'GRADES_DE_POLICE'
  | 'AGENTS_DE_POLICE'
  | 'AGENTS'
  | 'PERSONNELS_CIVILS'
  | 'SANTE_RATTACHEE';

export type TypeAvancementEchelon = 'ANCIENNETE' | 'CHOIX' | 'GRAND_CHOIX';

export interface CarriereEchelonDto {
  id: string;
  agent_id: string;
  corps: CorpsPolicier;
  grade: string;
  echelon: number;
  indice_brut: number;
  indice_majore: number;
  date_effet: string;
  date_fin: string | null;
  type_avancement: TypeAvancementEchelon;
  numero_arrete: string;
  est_actif: boolean;
  cree_par: string;
  cree_le: string;
}

export interface CreerAvancementEchelonDto {
  agent_id: string;
  echelon: number;
  indice_brut?: number;
  indice_majore?: number;
  date_effet: string;
  type_avancement: TypeAvancementEchelon;
  numero_arrete: string;
}

export type AvisCommissionPromotion = 'FAVORABLE' | 'DEFAVORABLE' | 'AJOURNE' | 'RESERVE';
export type DecisionAutoritePromotion = 'PROMU' | 'NON_RETENU' | 'EN_ATTENTE';

export interface PromotionGradeDto {
  id: string;
  agent_id: string;
  ancien_grade: string;
  nouveau_grade: string;
  date_promotion: string;
  numero_decret: string;
  commission_date: string;
  tableau_avancement_annee: number;
  note_retenue: number | null;
  avis_commission: AvisCommissionPromotion;
  decision_autorite: DecisionAutoritePromotion;
  cree_par: string;
  cree_le: string;
}

export interface EnregistrerPromotionDto {
  agent_id: string;
  nouveau_grade: string;
  date_promotion: string;
  numero_decret: string;
  commission_date: string;
  tableau_avancement_annee: number;
  note_retenue?: number;
  avis_commission: AvisCommissionPromotion;
  nouvel_echelon?: number;
  indice_brut?: number;
  indice_majore?: number;
}

export interface SimulationEligibiliteDto {
  annee: number;
  corps?: string;
  grade_actuel?: string;
}

export interface AgentEligiblePromotionDto {
  agent_id: string;
  matricule: string;
  nom_complet: string;
  corps: string;
  grade_actuel: string;
  grade_vise: string;
  echelon_actuel: number;
  anciennete_grade_mois: number;
  note_moyenne_triennale: number;
  position_active: string;
  est_promouvable: boolean;
  motif_non_promouvable?: string;
}

export type PositionStatutaireCode = 
  | 'ACTIVITE' 
  | 'DETACHEMENT' 
  | 'DISPONIBILITE' 
  | 'SOUS_LES_DRAPEAUX' 
  | 'SUSPENSION_ADMINISTRATIVE';

export interface PositionStatutaireDto {
  id: string;
  agent_id: string;
  position: PositionStatutaireCode;
  organisme_accueil: string | null;
  date_debut: string;
  date_fin: string | null;
  maintien_droits_avancement: boolean;
  reference_decision: string;
  motif: string | null;
  est_active: boolean;
  cree_par: string;
  cree_le: string;
}

export interface DeclarerPositionDto {
  agent_id: string;
  position: PositionStatutaireCode;
  organisme_accueil?: string;
  date_debut: string;
  date_fin?: string;
  reference_decision: string;
  motif?: string;
}

export type TypeQualificationCode = 
  | 'HABILITATION_OPJ' 
  | 'HABILITATION_APJ' 
  | 'HABILITATION_APJA'
  | 'CERTIFICAT_TIR_REGLEMENTAIRE' 
  | 'BREVET_ARME_FORCE_INTERMEDIAIRE' 
  | 'BREVET_CONDUITE_URGENCE' 
  | 'BREVET_MAINTIEN_ORDRE' 
  | 'BREVET_CYBERCRIMINALITE' 
  | 'BREVET_POLICE_TECHNIQUE_SCIENTIFIQUE' 
  | 'SECOURISME_TACTIQUE_STOP';

export interface FormationDto {
  id: string;
  code_formation: string;
  intitule: string;
  type: 'INITIALE' | 'CONTINUE' | 'RECYCLAGE' | 'SPECIALISATION';
  duree_heures: number;
  organisme: string;
  est_certifiante: boolean;
  duree_validite_mois: number;
  est_active: boolean;
  cree_le: string;
}

export interface QualificationAgentDto {
  id: string;
  agent_id: string;
  formation_id: string | null;
  type_qualification: TypeQualificationCode;
  numero_carte_agrement: string;
  date_obtention: string;
  date_expiration: string | null;
  autorite_delivrance: string;
  statut_actif: boolean;
  aptitude_operationnelle_associee: string | null;
  cree_le: string;
}

export interface CreerQualificationDto {
  agent_id: string;
  type_qualification: TypeQualificationCode;
  numero_carte_agrement: string;
  date_obtention: string;
  date_expiration?: string;
  autorite_delivrance: string;
  formation_id?: string;
  aptitude_operationnelle_associee?: string;
}

export interface AlertePeremptionQualificationDto {
  qualification_id: string;
  agent_id: string;
  matricule: string;
  nom_complet: string;
  unite_nom: string;
  type_qualification: TypeQualificationCode;
  numero_carte_agrement?: string;
  date_expiration: string;
  jours_restants: number;
  niveau_urgence: 'CRITIQUE' | 'URGENT' | 'ATTENTION';
}

export type StatutNotation = 'BROUILLON' | 'SOUMIS' | 'VISE_CHEF' | 'NOTIFIE' | 'RECOURS' | 'VALIDE_DEFINITIF';
export type DecisionRecoursNotation = 'MAINTIEN' | 'REVISION_HAUSSE' | 'REVISION_BAISSE' | 'ANNULATION';

export interface NotationAnnuelleDto {
  id: string;
  agent_id: string;
  annee: number;
  note_chiffree: number;
  appreciation_generale: string;
  rigueur_deontologie: number | null;
  competence_technique: number | null;
  disponibilite_operationnelle: number | null;
  sens_commandement_initiative: number | null;
  date_entretien: string;
  evaluateur_agent_id: string;
  date_notification: string | null;
  recours_depose: boolean;
  motif_recours: string | null;
  decision_recours: DecisionRecoursNotation | null;
  note_definitive: number | null;
  statut: StatutNotation;
  cree_le: string;
  modifie_le: string;
}

export interface CreerNotationDto {
  agent_id: string;
  annee: number;
  rigueur_deontologie: number;
  competence_technique: number;
  disponibilite_operationnelle: number;
  sens_commandement_initiative: number;
  appreciation_generale: string;
  date_entretien: string;
  evaluateur_agent_id?: string;
}

export interface DeposerRecoursNotationDto {
  motif_recours: string;
  date_recours?: string;
}

export interface ArbitrerRecoursNotationDto {
  decision_recours: DecisionRecoursNotation;
  note_definitive?: number;
  motif_arbitrage?: string;
}

export interface ElementSoldeDto {
  id: string;
  agent_id: string;
  mois_annee: string;
  salaire_base_indiciaire: number;
  prime_sujetion: number;
  prime_risque: number;
  indemnite_astreinte: number;
  heures_nuit_dimanche: number;
  indemnite_eloignement: number;
  total_brut: number;
  retenues_statutaires: number;
  net_a_payer: number;
  statut: 'CALCULE' | 'VALIDE' | 'CLOTURE' | 'EXPORTE';
  calcule_le: string;
  valide_par: string | null;
}

export interface ExportSoldeDto {
  id: string;
  reference_export: string;
  mois_annee: string;
  date_export: string;
  operateur_id: string;
  nombre_agents: number;
  montant_total: number;
  format: 'CSV_TRESOR_DJIBOUTI' | 'CSV' | 'TXT_SEPA' | 'XML_TRESOR';
  empreinte_sha256: string;
  journal_audit_id: string | null;
  statut: 'GENERE' | 'TRANSMIS' | 'ARCHIVE';
}
