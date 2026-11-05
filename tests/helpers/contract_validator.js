const { sha256 } = require('./crypto_audit.js');

// RÈGLES DE PLANNING OPÉRATIONNEL POLICIER
function validatePlanningShift({ heure_debut, heure_fin, date_vacation, derniere_fin_service, qualification_tir_valide, est_poste_arme }) {
  const errors = [];

  // 1. Calcul durée vacation
  const dDebut = new Date(`${date_vacation}T${heure_debut}:00Z`);
  const dFin = new Date(`${date_vacation}T${heure_fin}:00Z`);
  let dureeHeures = (dFin - dDebut) / (1000 * 60 * 60);
  if (dureeHeures < 0) dureeHeures += 24; // Vacation chevauchant minuit

  // Règle : Durée maximale d'une vacation normale <= 12h
  if (dureeHeures > 12) {
    errors.push({
      regle: 'planning.duree_max_vacation_heures',
      message: `Dépassement de la durée maximale de vacation : ${dureeHeures}h planifiées (plafond réglementaire : 12h).`
    });
  }

  // 2. Règle du repos physiologique minimal (11h consécutives obligatoires)
  if (derniere_fin_service) {
    const finPrecedente = new Date(derniere_fin_service);
    const intervalleReposHeures = (dDebut - finPrecedente) / (1000 * 60 * 60);
    if (intervalleReposHeures < 11) {
      errors.push({
        regle: 'planning.repos_minimal_heures',
        message: `Violation du temps de repos légal : seulement ${intervalleReposHeures.toFixed(1)}h de repos observées (minimum statutaire : 11h consécutives).`
      });
    }
  }

  // 3. Règle du verrouillage de poste armé si certificat de tir expiré
  if (est_poste_arme && qualification_tir_valide === false) {
    errors.push({
      regle: 'qualifications.bloquer_affectation_si_expire',
      message: 'Affectation armée bloquée : Le certificat annuel de tir et d\'armement réglementaire de l\'agent est expiré.'
    });
  }

  // Calcul des heures de nuit (22h00 - 06h00)
  let heuresNuit = 0;
  // Détection simplifiée pour vacation de nuit type 22h-06h (8h)
  if (heure_debut === '22:00' && heure_fin === '06:00') {
    heuresNuit = 8;
  }

  return {
    valide: errors.length === 0,
    dureeHeures,
    heuresNuit,
    errors
  };
}

// SIMULATEUR DE GÉNÉRATION DE DOCUMENTS OFFICIELS PDF
function generateOfficialDocument({ type_document, agent, donnees_acte, operateurSession }) {
  const TYPES_DOCUMENT_VALIDES = [
    'ARRETE_MUTATION',
    'TITRE_CONGE',
    'ATTESTATION_TRAVAIL',
    'ARRETE_AVANCEMENT_ECHELON',
    'TABLEAU_SERVICE_BRIGADE'
  ];

  if (!TYPES_DOCUMENT_VALIDES.includes(type_document)) {
    throw new Error(`Type de document non supporté : ${type_document}`);
  }

  const document_id = `DOC-${type_document}-${Date.now()}`;
  const horodatage_generation = new Date().toISOString();

  // En-tête républicain officiel djiboutien
  const en_tete = {
    pays: 'RÉPUBLIQUE DE DJIBOUTI',
    devise: 'Unité - Égalité - Paix',
    ministere: 'MINISTÈRE DE L\'INTÉRIEUR',
    direction: 'DIRECTION GÉNÉRALE DE LA POLICE NATIONALE'
  };

  const filigrane = 'REPRODUCTION INTERDITE - POLICE NATIONALE';

  // Empreinte cryptographique du document pour authenticité
  const signature_electronique = sha256({
    document_id,
    agent_id: agent ? agent.id : null,
    matricule: agent ? agent.matricule : null,
    horodatage: horodatage_generation,
    donnees: donnees_acte
  });

  const qr_code_verification = `https://intranet.police.dj/verifier-acte?doc=${document_id}&sig=${signature_electronique.substring(0, 16)}`;

  return {
    document_id,
    type_document,
    format: 'PDF/A',
    langue: 'FRANCAIS',
    en_tete,
    filigrane,
    agent: agent ? {
      matricule: agent.matricule,
      nom_complet: `${agent.prenom} ${agent.nom}`,
      grade: agent.grade_actuel,
      corps: agent.corps,
      unite: agent.unite_actuelle_id
    } : null,
    donnees_acte,
    horodatage_generation,
    signature_electronique_sha256: signature_electronique,
    qr_code_verification,
    genere_par: operateurSession ? operateurSession.utilisateur_id : 'SYS'
  };
}

// CALCUL DES ÉLÉMENTS VARIABLES DE SOLDE (EVS)
function calculateMonthlyPayroll({ agent, heures_nuit = 0, astreintes_jours = 0, commissariat_region = false, absence_injustifiee_jours = 0 }) {
  const INDEMNITE_NUIT_TAUX_HORAIRE = 450; // DJF par heure de nuit
  const PRIME_ASTREINTE_JOUR = 3500; // DJF par jour d'astreinte
  const PRIME_ELOIGNEMENT_REGION = 25000; // DJF mensuel pour Ali-Sabieh, Dikhil, etc.
  const RETENUE_ABSENCE_JOUR = 4000; // DJF retenue par jour injustifié

  const totalNuit = heures_nuit * INDEMNITE_NUIT_TAUX_HORAIRE;
  const totalAstreinte = astreintes_jours * PRIME_ASTREINTE_JOUR;
  const totalEloignement = commissariat_region ? PRIME_ELOIGNEMENT_REGION : 0;
  const totalRetenue = absence_injustifiee_jours * RETENUE_ABSENCE_JOUR;

  const totalNetVariables = totalNuit + totalAstreinte + totalEloignement - totalRetenue;

  return {
    agent_id: agent.id,
    matricule: agent.matricule,
    mois: '2026-11',
    devise: 'DJF',
    elements: {
      heures_nuit: { quantite: heures_nuit, montant: totalNuit },
      astreintes: { quantite: astreintes_jours, montant: totalAstreinte },
      indemnite_eloignement: { actif: commissariat_region, montant: totalEloignement },
      retenue_absences: { quantite: absence_injustifiee_jours, montant: -totalRetenue }
    },
    total_net_variables: totalNetVariables
  };
}

module.exports = {
  validatePlanningShift,
  generateOfficialDocument,
  calculateMonthlyPayroll
};
