/**
 * ============================================================================
 * SIRH POLICE NATIONALE DE DJIBOUTI — COMPOSANTS IHM SOUVERAINS JALON M3
 * Lot 3 : Carrières, Promotions, Positions, Formations, Notations et Solde
 * Vanilla JS pur (ES2022) — Zéro dépendance externe — 100% Français Républicain
 * ============================================================================
 */

(function () {
  'use strict';

  // 1. LISTE DES TERMES MÉDICAUX ET DE SANTÉ FORMELLEMENT PROSCRITS
  // Strict respect du secret médical et des règles d'étanchéité SIRH Police
  const TERMES_MEDICAUX_PROSCRITS = [
    'sante', 'santé', 'medical', 'médical', 'medecin', 'médecin',
    'maladie', 'pathologie', 'traitement', 'hopital', 'hôpital',
    'clinique', 'diagnostic', 'vih', 'sida', 'diabete', 'diabète',
    'psychiatrie', 'psy', 'infirmite', 'infirmité', 'ordonnance',
    'posologie', 'sang', 'groupe_sanguin', 'groupe sanguin',
    'handicap', 'grossesse', 'medicament', 'médicament',
    'medicaments', 'médicaments', 'glycemie', 'glycémie',
    'tension', 'tension_arterielle', 'tension artérielle',
    'cancer', 'chirurgie', 'symptome', 'symptôme', 'pouls',
    'temperature', 'température', 'consultation'
  ];

  function normaliserChaine(chaine) {
    if (!chaine) return '';
    return chaine
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  }

  /**
   * Vérifie la présence de termes médicaux dans un texte donné
   * @param {string} texte
   * @returns {{contient: boolean, terme?: string}}
   */
  function detecterTermeMedical(texte) {
    if (!texte) return { contient: false };
    const texteNormalise = normaliserChaine(texte);
    const mots = texteNormalise.split(/[\s,.;:!?()'"-]+/);

    for (const terme of TERMES_MEDICAUX_PROSCRITS) {
      const termeNormalise = normaliserChaine(terme);
      if (termeNormalise.includes(' ')) {
        if (texteNormalise.includes(termeNormalise)) {
          return { contient: true, terme };
        }
      } else {
        if (mots.includes(termeNormalise)) {
          return { contient: true, terme };
        }
      }
    }
    return { contient: false };
  }

  /**
   * 2. CALCULATEUR D'EMPREINTE CRYPTOGRAPHIQUE SHA-256 EN JS PUR
   * Utilise l'API native standard Web Crypto du navigateur (crypto.subtle)
   * @param {string} donneesTexte - Chaîne ou flux CSV à sceller
   * @returns {Promise<string>} - Empreinte hexadécimale de 64 caractères
   */
  async function calculerEmpreinteSHA256(donneesTexte) {
    const encodeur = new TextEncoder();
    const tamponDonnees = encodeur.encode(donneesTexte);
    const tamponHachage = await window.crypto.subtle.digest('SHA-256', tamponDonnees);
    const tableauOctets = Array.from(new Uint8Array(tamponHachage));
    return tableauOctets.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * 3. FORMATAGE DATE ET MONNAIE RÉPUBLICAINE DJIBOUTIENNE
   */
  function formaterDateDjibouti(dateChaine) {
    if (!dateChaine) return 'Non renseignée';
    const date = new Date(dateChaine);
    if (isNaN(date.getTime())) return dateChaine;
    return new Intl.DateTimeFormat('fr-DJ', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    }).format(date);
  }

  function formaterMontantFrancsDjibouti(montant) {
    const valeur = Number(montant) || 0;
    return new Intl.NumberFormat('fr-DJ', {
      style: 'currency',
      currency: 'DJF',
      maximumFractionDigits: 0
    }).format(valeur);
  }

  /**
   * 4. CALCUL DU DÉLAI D'EXPIRATION ET COULEUR ASSOCIÉE
   * @param {string} dateExpirationISO
   * @returns {{joursRestants: number, classeCss: string, libelleStatut: string}}
   */
  function evaluerDelaiExpiration(dateExpirationISO) {
    if (!dateExpirationISO) {
      return { joursRestants: 999, classeCss: 'delai-vert', libelleStatut: 'Validité permanente' };
    }
    const aujourdhui = new Date();
    const dateExp = new Date(dateExpirationISO);
    const differenceTemps = dateExp.getTime() - aujourdhui.getTime();
    const joursRestants = Math.ceil(differenceTemps / (1000 * 3600 * 24));

    if (joursRestants <= 0) {
      return {
        joursRestants: 0,
        classeCss: 'delai-rouge',
        libelleStatut: 'EXPIRÉ — Recyclage obligatoire immédiat'
      };
    } else if (joursRestants <= 30) {
      return {
        joursRestants,
        classeCss: 'delai-rouge',
        libelleStatut: `Alerte urgente : expire dans ${joursRestants} j`
      };
    } else if (joursRestants <= 60) {
      return {
        joursRestants,
        classeCss: 'delai-orange',
        libelleStatut: `Avertissement recyclage : dans ${joursRestants} j`
      };
    } else {
      return {
        joursRestants,
        classeCss: 'delai-vert',
        libelleStatut: `Valide (${joursRestants} jours restants)`
      };
    }
  }

  /**
   * 5. RENDU DE LA FRISE CHRONOLOGIQUE DE CARRIÈRE (TIMELINE)
   * @param {Array} etapes - Liste des échelons et promotions
   * @param {string} conteneurId - ID du conteneur HTML
   */
  function rendreFriseCarriere(etapes, conteneurId) {
    const conteneur = document.getElementById(conteneurId);
    if (!conteneur) return;

    if (!etapes || etapes.length === 0) {
      conteneur.innerHTML = `
        <div style="text-align: center; color: var(--texte-clair); padding: 2rem;">
          Aucun événement d'avancement enregistré pour cet agent.
        </div>
      `;
      return;
    }

    // Calcul du pourcentage de la barre de progression active
    const indexActuel = etapes.findIndex(e => e.est_actuel);
    const pourcentageLigne = indexActuel >= 0 
      ? Math.round((indexActuel / Math.max(etapes.length - 1, 1)) * 100)
      : 50;

    let html = `
      <div class="conteneur-frise">
        <div class="frise-chronologique">
          <div class="ligne-progression-frise" style="width: ${pourcentageLigne}%;"></div>
    `;

    etapes.forEach(etape => {
      let statutClasse = 'futur';
      let etiquetteStatut = 'Prévisionnel';

      if (etape.est_passe) {
        statutClasse = 'valide';
        etiquetteStatut = 'Effectué';
      } else if (etape.est_actuel) {
        statutClasse = 'actuel';
        etiquetteStatut = 'Échelon Actuel';
      }

      html += `
        <div class="point-frise ${statutClasse}">
          <div class="pastille-marqueur" title="${etiquetteStatut}">
            ${etape.est_passe ? '✓' : (etape.numero_echelon ? 'Éch.' + etape.numero_echelon : '★')}
          </div>
          <div class="etiquette-frise">
            <span class="titre-echelon">${etape.grade} — Échelon ${etape.numero_echelon}</span>
            <span class="indice-solde">Indice ${etape.indice_solde}</span>
            <span class="date-effet">${etape.est_futur ? 'Prévision : ' : 'Date d\'effet : '}${formaterDateDjibouti(etape.date_effet)}</span>
            ${etape.reference_arrete ? `<small style="font-size:0.7rem; color:var(--texte-clair); display:block;">Réf: ${etape.reference_arrete}</small>` : ''}
          </div>
        </div>
      `;
    });

    html += `
        </div>
      </div>
    `;

    conteneur.innerHTML = html;
  }

  /**
   * 6. SIMULATEUR D'ÉLIGIBILITÉ AU TABLEAU D'AVANCEMENT ANNUEL
   * Applique les règles statutaires djiboutiennes :
   * - Grand Choix : ancienneté minimale requise (ex. 24 mois) ET note moyenne triennale >= 16.0/20 ET zéro sanction active du groupe 2 ou 3.
   * - Ancienneté maximale : ancienneté requise accomplie (ex. 30 mois).
   * @param {Array} agents
   * @param {Object} criteres
   */
  function simulerEligibiliteAvancement(agents, criteres = {}) {
    const seuilGrandChoixNote = criteres.note_minimale || 16.0;
    const dureeMinimaleMois = criteres.duree_minimale_mois || 24;

    return agents.map(agent => {
      const moisAnciennete = Number(agent.anciennete_echelon_mois) || 0;
      const noteMoyenne = Number(agent.note_moyenne_triennale) || 0;
      const aSanctionBloquante = Boolean(agent.a_sanction_active_groupe_2_3);

      let statutEligibilite = 'NON_ELIGIBLE';
      let motifStatut = 'Durée d\'ancienneté insuffisante dans l\'échelon';

      if (aSanctionBloquante) {
        statutEligibilite = 'NON_ELIGIBLE';
        motifStatut = 'Exclusion statutaire : Sanction disciplinaire active en cours';
      } else if (moisAnciennete >= dureeMinimaleMois && noteMoyenne >= seuilGrandChoixNote) {
        statutEligibilite = 'GRAND_CHOIX';
        motifStatut = `Éligible au Grand Choix (Note triennale ${noteMoyenne.toFixed(1)}/20 ≥ ${seuilGrandChoixNote}/20)`;
      } else if (moisAnciennete >= 30) {
        statutEligibilite = 'ANCIENNETE';
        motifStatut = `Éligible à l'Ancienneté Maximale (${moisAnciennete} mois accomplis)`;
      }

      return {
        ...agent,
        statut_eligibilite: statutEligibilite,
        motif_eligibilite: motifStatut
      };
    });
  }

  /**
   * 7. CALCULATEUR D'ÉLÉMENTS MENSUELS DE SOLDE DJIBOUTIENNE
   * Éléments réglementaires de la Police Nationale de Djibouti (Loi 46/AN/04 & Cadrage M3) :
   * - Traitement indiciaire de base = Indice de Solde × Valeur du point (100 DJF par défaut)
   * - Prime de sujétion policière et de risque :
   *     * Officiers : 35 000 DJF / mois
   *     * Sous-officiers : 25 000 DJF / mois
   *     * Gradés et Agents : 20 000 DJF / mois
   * - Indemnités d'heures de nuit (plage 22h00 - 06h00) : 450 DJF / heure effective
   * - Indemnités d'astreinte opérationnelle : 3 500 DJF / jour ou tranche de 24h
   * - Indemnité d'éloignement territorial (Régions de l'Intérieur) : 25 000 DJF / mois
   * - Retenues statutaires : Retraite et CNSS (7.5% sur le total brut)
   */
  function calculerElementsSolde(indiceSolde, categorieCorps = 'SOUS_OFFICIER', heuresAstreinteJours = 0, heuresNuit = 0, estRegionInterieur = false) {
    const VALEUR_POINT_INDICIAIRE = 100; // Francs Djibouti par point
    const TAUX_RETENUES = 0.075;
    const TARIF_HEURE_NUIT = 450;         // DJF par heure (22h-06h)
    const FORFAIT_JOUR_ASTREINTE = 3500;   // DJF par jour
    const FORFAIT_ELOIGNEMENT_REGIONS = 25000; // DJF par mois

    let montantPrimeRisque = 25000;
    if (categorieCorps === 'OFFICIER' || categorieCorps === 'OFFICIER_SUPERIEUR' || categorieCorps === 'OFFICIER_SUBALTERNE') {
      montantPrimeRisque = 35000;
    } else if (categorieCorps === 'GRADES_AGENTS' || categorieCorps === 'AGENT') {
      montantPrimeRisque = 20000;
    }

    const salaireBaseIndiciaire = indiceSolde * VALEUR_POINT_INDICIAIRE;
    const primeRisque = montantPrimeRisque;
    const primeEloignement = estRegionInterieur ? FORFAIT_ELOIGNEMENT_REGIONS : 0;
    const indemnitesAstreinte = heuresAstreinteJours * FORFAIT_JOUR_ASTREINTE;
    const indemnitesNuit = heuresNuit * TARIF_HEURE_NUIT;

    const totalBrut = salaireBaseIndiciaire + primeRisque + primeEloignement + indemnitesAstreinte + indemnitesNuit;
    const retenuesStatutaires = Math.round(totalBrut * TAUX_RETENUES);
    const netAPayer = totalBrut - retenuesStatutaires;

    return {
      indice: indiceSolde,
      salaire_base: Math.round(salaireBaseIndiciaire),
      prime_risque: primeRisque,
      prime_eloignement: primeEloignement,
      indemnites_astreinte: Math.round(indemnitesAstreinte),
      indemnites_nuit: Math.round(indemnitesNuit),
      total_brut: Math.round(totalBrut),
      retenues_statutaires: retenuesStatutaires,
      net_a_payer: Math.round(netAPayer)
    };
  }

  // Publication dans l'espace global window
  window.SIRH_M3 = {
    detecterTermeMedical,
    calculerEmpreinteSHA256,
    formaterDateDjibouti,
    formaterMontantFrancsDjibouti,
    evaluerDelaiExpiration,
    rendreFriseCarriere,
    simulerEligibiliteAvancement,
    calculerElementsSolde,
    TERMES_MEDICAUX_PROSCRITS
  };
})();
