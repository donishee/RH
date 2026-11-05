export interface PosteOperationnelDto {
  id: string;
  code: string;
  libelle: string;
  description?: string;
  niveau_qualification_requis: 'OPJ' | 'APJ' | 'aucun';
  tir_requis: boolean;
  permis_conduire_requis: boolean;
  unite_id: string;
  effectif_cible: number;
  est_actif: boolean;
  cree_le?: string;
  modifie_le?: string;
}

export interface CreerPosteOperationnelDto {
  code: string;
  libelle: string;
  description?: string;
  niveau_qualification_requis?: 'OPJ' | 'APJ' | 'aucun';
  tir_requis?: boolean;
  permis_conduire_requis?: boolean;
  unite_id: string;
  effectif_cible?: number;
}

export interface PlanningVacationDto {
  id: string;
  unite_id: string;
  agent_id: string;
  poste_operationnel_id?: string;
  type_vacation: '3x8_matin' | '3x8_apres_midi' | '3x8_nuit' | '2x12_jour' | '2x12_nuit' | 'permanence' | 'astreinte';
  date_debut: string;
  date_fin: string;
  statut: 'planifie' | 'valide' | 'en_cours' | 'termine' | 'remplace' | 'annule';
  motif_modification?: string;
  cree_par: string;
  cree_le?: string;
  modifie_le?: string;
  agent_nom?: string;
  agent_prenom?: string;
  agent_grade?: string;
  agent_matricule?: string;
  poste_libelle?: string;
  heures_nuit?: number;
}

export interface CreerVacationDto {
  unite_id?: string;
  agent_id: string;
  poste_operationnel_id?: string;
  type_vacation: '3x8_matin' | '3x8_apres_midi' | '3x8_nuit' | '2x12_jour' | '2x12_nuit' | 'permanence' | 'astreinte';
  date_debut: string;
  date_fin: string;
  motif_modification?: string;
}

export interface ModifierVacationDto {
  poste_operationnel_id?: string;
  statut?: 'planifie' | 'valide' | 'en_cours' | 'termine' | 'remplace' | 'annule';
  motif_modification?: string;
}

export interface CandidatEligibleDto {
  agent_id: string;
  nom: string;
  prenom: string;
  matricule: string;
  grade: string;
  unite_id: string;
  score_eligibilite: number;
  repos_heures_observees: number;
  tir_valide: boolean;
  qualification_judiciaire: string;
  motifs_eligibilite: string[];
}

export interface RemplacementGardeDto {
  id: string;
  planning_vacation_id: string;
  agent_absent_id: string;
  agent_remplacant_id: string;
  motif: 'conge' | 'maladie_sans_diagnostic' | 'mission' | 'urgence' | 'indisponibilite_inopinee' | 'suspension';
  date_remplacement: string;
  valide_par: string;
  valide_le: string;
  statut: 'propose' | 'valide' | 'rejete' | 'effectue';
  commentaire?: string;
  journal_audit_id?: number;
  cree_le?: string;
}

export interface OrdonnerRemplacementDto {
  planning_vacation_id: string;
  agent_absent_id?: string;
  agent_remplacant_id: string;
  motif?: 'conge' | 'maladie_sans_diagnostic' | 'mission' | 'urgence' | 'indisponibilite_inopinee' | 'suspension';
  date_remplacement?: string;
  commentaire?: string;
}

export interface AlerteSousEffectifDto {
  unite_id: string;
  date: string;
  effectif_cible_total: number;
  effectif_planifie: number;
  ratio_presence: number;
  alerte_sous_effectif: boolean;
  seuil_critique_pct: number;
  message_alerte?: string;
}

export interface DossierDisciplinaireDto {
  id: string;
  numero_dossier: string;
  agent_id: string;
  phase_procedure: string;
  date_faits: string;
  description_sommaire: string;
  description_faits?: string;
  rapport_enquete?: string;
  officier_instructeur_id: string;
  sanction_retenue?: string;
  date_decision?: string;
  motif_decision?: string;
  statut_dossier: string;
  statut: string;
  niveau_confidentialite: string;
  degre_confidentialite: string;
  ouvert_par?: string;
  date_cloture?: string;
  cree_le: string;
  modifie_le: string;
  agent_nom?: string;
  agent_prenom?: string;
  agent_matricule?: string;
  agent_grade?: string;
  sanctions?: SanctionDisciplinaireDto[];
}

export interface CreerDossierDisciplinaireDto {
  agent_id: string;
  numero_dossier?: string;
  date_faits: string;
  description_sommaire: string;
  description_faits?: string;
  rapport_enquete?: string;
  officier_instructeur_id?: string;
  phase_procedure?: string;
}

export interface TransitionPhaseDossierDto {
  phase_procedure: 'ALLEGATION' | 'ENQUETE_INTERNE' | 'COMMISSION_DISCIPLINE' | 'SANCTION_PRONONCEE' | 'CLASSEMENT_SANS_SUITE';
  statut?: string;
  motif?: string;
  rapport_enquete?: string;
}

export interface SanctionDisciplinaireDto {
  id: string;
  dossier_id: string;
  agent_id: string;
  groupe_sanction: 'GROUPE_1' | 'GROUPE_2' | 'GROUPE_3';
  nature_sanction: string;
  duree_exclusion_jours?: number;
  date_effet: string;
  date_fin?: string;
  date_effacement_prevue?: string;
  est_amnistiee: boolean;
  reference_arrete: string;
  prononcee_par: string;
  date_decision: string;
  motif_sanction: string;
  cree_le: string;
}

export interface EnregistrerSanctionDto {
  dossier_id: string;
  agent_id?: string;
  groupe_sanction: 'GROUPE_1' | 'GROUPE_2' | 'GROUPE_3';
  nature_sanction: string;
  duree_exclusion_jours?: number;
  date_effet: string;
  date_fin?: string;
  reference_arrete: string;
  prononcee_par: string;
  date_decision?: string;
  motif_sanction: string;
}

export interface AptitudeAdministrativeDto {
  id: string;
  agent_id: string;
  numero_certificat_administratif: string;
  decision_aptitude: 'APTE_SERVICE_ACTIF' | 'INAPTE_TEMPORAIRE_PORT_ARME' | 'AMENAGEMENT_POSTE' | 'INAPTE_TEMPORAIRE_CONDUITE';
  type_conclusion: 'APTE_SANS_RESTRICTION' | 'APTE_AVEC_RESTRICTIONS' | 'INAPTE_TEMPORAIRE' | 'INAPTE_DEFINITIF';
  code_restriction: string;
  restriction_operationnelle?: string;
  date_decision: string;
  date_expiration?: string;
  date_echeance?: string;
  reference_arrete_commissariat?: string;
  identifiant_medecin_militaire_referent: string;
  reference_certificat_scelle: string;
  enregistre_par?: string;
  cree_le: string;
}

export interface EnregistrerAptitudeDto {
  agent_id: string;
  numero_certificat_administratif?: string;
  numero_certificat?: string;
  decision_aptitude?: 'APTE_SERVICE_ACTIF' | 'INAPTE_TEMPORAIRE_PORT_ARME' | 'AMENAGEMENT_POSTE' | 'INAPTE_TEMPORAIRE_CONDUITE';
  type_conclusion?: 'APTE_SANS_RESTRICTION' | 'APTE_AVEC_RESTRICTIONS' | 'INAPTE_TEMPORAIRE' | 'INAPTE_DEFINITIF';
  code_restriction?: string;
  restriction_operationnelle?: string;
  restrictions_operationnelles?: string;
  date_decision: string;
  date_expiration?: string;
  date_echeance?: string;
  reference_arrete_commissariat?: string;
  identifiant_medecin_militaire_referent?: string;
  reference_certificat_scelle?: string;
}

export interface ModeleDocumentPdfDto {
  id: string;
  code_modele: string;
  libelle: string;
  gabarit_texte: string;
  version: string;
  est_actif: boolean;
}

export interface GenererDocumentDto {
  code_modele?: string;
  type_document?: string;
  agent_id?: string;
  donnees_acte?: Record<string, any>;
  donnees_variables?: Record<string, any>;
  reference_document?: string;
}

export interface DocumentGenereDto {
  id: string;
  code_modele: string;
  agent_id?: string;
  reference_document: string;
  titre_document: string;
  contenu_base64: string;
  empreinte_sha256: string;
  donnees_variables_json: Record<string, any>;
  signe_par: string;
  genere_par_utilisateur_id: string;
  date_generation: string;
  journal_audit_id?: number;
}
