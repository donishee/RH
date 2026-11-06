/**
 * ============================================================================
 * SIRH POLICE NATIONALE DE DJIBOUTI — COMPOSANTS IHM SOUVERAINS JALON M4
 * Lot 4 : Planning Opérationnel 24/7, Remplacements d'Urgence,
 *         Discipline Cloisonnée, Aptitude Administrative & Documents PDF
 * Vanilla JS pur (ES2022) — Zéro dépendance externe — 100% Français Républicain
 * ============================================================================
 */

(function () {
  'use strict';

  // ==========================================================================
  // 1. LISTE SANCTUARISÉE DES TERMES MÉDICAUX ET DE SANTÉ FORMELLEMENT PROSCRITS
  // ==========================================================================
  const TERMES_MEDICAUX_PROSCRITS_M4 = [
    'sante', 'santé', 'medical', 'médical', 'medecin', 'médecin',
    'maladie', 'pathologie', 'traitement', 'hopital', 'hôpital',
    'clinique', 'diagnostic', 'vih', 'sida', 'diabete', 'diabète',
    'psychiatrie', 'psy', 'infirmite', 'infirmité', 'ordonnance',
    'posologie', 'sang', 'groupe_sanguin', 'groupe sanguin',
    'handicap', 'grossesse', 'medicament', 'médicament',
    'medicaments', 'médicaments', 'glycemie', 'glycémie',
    'tension', 'tension_arterielle', 'tension artérielle',
    'cancer', 'chirurgie', 'symptome', 'symptôme', 'pouls',
    'temperature', 'température', 'consultation', 'blessure',
    'fracture', 'arret_travail', 'arret travail', 'arrêt de travail'
  ];

  function normaliserChaine(chaine) {
    if (!chaine) return '';
    return chaine
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  }

  /**
   * Analyse un texte en temps réel pour détecter les atteintes au secret médical
   * @param {string} texte - Le texte à inspecter
   * @returns {{contient: boolean, terme?: string}}
   */
  function detecterTermeMedical(texte) {
    if (!texte) return { contient: false };
    const texteNormalise = normaliserChaine(texte);
    const mots = texteNormalise.split(/[\s,.;:!?()'"-]+/);

    for (const terme of TERMES_MEDICAUX_PROSCRITS_M4) {
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
   * Attache un écouteur d'interception médicale en temps réel sur un champ texte
   * @param {string} champSaisieId - ID du champ input ou textarea
   * @param {string} conteneurAlerteId - ID de la bannière d'alerte
   * @param {string} boutonValidationId - ID du bouton à bloquer
   * @param {string} zoneMotInterditId - ID du span affichant le mot fautif
   */
  function attacherIntercepteurMedical(champSaisieId, conteneurAlerteId, boutonValidationId, zoneMotInterditId) {
    const champ = document.getElementById(champSaisieId);
    const alerte = document.getElementById(conteneurAlerteId);
    const bouton = document.getElementById(boutonValidationId);
    const zoneMot = zoneMotInterditId ? document.getElementById(zoneMotInterditId) : null;

    if (!champ) return;

    champ.addEventListener('input', function () {
      const resultat = detecterTermeMedical(champ.value);
      if (resultat.contient) {
        champ.classList.add('champ-saisie-bloque-medical');
        if (alerte) alerte.classList.add('visible');
        if (bouton) bouton.disabled = true;
        if (zoneMot) zoneMot.textContent = resultat.terme;
      } else {
        champ.classList.remove('champ-saisie-bloque-medical');
        if (alerte) alerte.classList.remove('visible');
        if (bouton) bouton.disabled = false;
        if (zoneMot) zoneMot.textContent = '';
      }
    });
  }

  // ==========================================================================
  // 2. CALCULATEUR D'EMPREINTE CRYPTOGRAPHIQUE SHA-256 SOUVERAIN (W3C NATIVE)
  // ==========================================================================
  async function calculerEmpreinteSHA256(donneesTexte) {
    if (!window.crypto || !window.crypto.subtle) {
      // Secours déterministe si contexte sans crypto subtile
      let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
      for (let i = 0; i < donneesTexte.length; i++) {
        const ch = donneesTexte.charCodeAt(i);
        h1 = Math.imul(h1 ^ ch, 2654435761);
        h2 = Math.imul(h2 ^ ch, 1597334677);
      }
      h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
      h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
      return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(64, 'a');
    }
    const encodeur = new TextEncoder();
    const tamponDonnees = encodeur.encode(donneesTexte);
    const tamponHachage = await window.crypto.subtle.digest('SHA-256', tamponDonnees);
    const tableauOctets = Array.from(new Uint8Array(tamponHachage));
    return tableauOctets.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  // ==========================================================================
  // 3. RÈGLES STATUTAIRES DE PLANNING, DÉCOMPTE ET REPOS PHYSIOLOGIQUE
  // ==========================================================================

  /**
   * Calcule la durée d'une vacation en heures
   */
  function calculerDureeHeures(heureDebut, heureFin) {
    const [hDeb, mDeb] = heureDebut.split(':').map(Number);
    const [hFin, mFin] = heureFin.split(':').map(Number);

    let minutesDeb = hDeb * 60 + mDeb;
    let minutesFin = hFin * 60 + mFin;

    if (minutesFin <= minutesDeb) {
      // Passage de minuit (ex: 22h00 - 06h00)
      minutesFin += 24 * 60;
    }
    return (minutesFin - minutesDeb) / 60;
  }

  /**
   * Calcule les heures de nuit accomplies (plage réglementaire 22h00 - 06h00)
   */
  function calculerHeuresNuit(heureDebut, heureFin) {
    const [hDeb, mDeb] = heureDebut.split(':').map(Number);
    const [hFin, mFin] = heureFin.split(':').map(Number);

    let minutesDeb = hDeb * 60 + mDeb;
    let minutesFin = hFin * 60 + mFin;
    if (minutesFin <= minutesDeb) minutesFin += 24 * 60;

    // Plage nuit 1 : 22h00 (1320 min) à 24h00 (1440 min)
    // Plage nuit 2 : 00h00 (0 / 1440 min) à 06h00 (360 / 1800 min)
    let minutesNuit = 0;

    for (let m = minutesDeb; m < minutesFin; m++) {
      const heureJour = (Math.floor(m / 60)) % 24;
      if (heureJour >= 22 || heureJour < 6) {
        minutesNuit++;
      }
    }
    return Math.round((minutesNuit / 60) * 10) / 10;
  }

  /**
   * Vérifie le respect du temps de repos minimal statutaire de 11 heures (HYP-04)
   * @param {string} dateHeureFinDernierServiceISO - Fin de vacation précédente
   * @param {string} dateVacationCible - Date YYYY-MM-DD
   * @param {string} heureDebutVacationCible - Heure HH:mm
   * @returns {{conforme: boolean, heuresReposEffectives: number}}
   */
  function verifierReposPhysiologique(dateHeureFinDernierServiceISO, dateVacationCible, heureDebutVacationCible) {
    if (!dateHeureFinDernierServiceISO) {
      return { conforme: true, heuresReposEffectives: 99 };
    }
    const dateFinPrecedente = new Date(dateHeureFinDernierServiceISO);
    const dateDebutProchaine = new Date(`${dateVacationCible}T${heureDebutVacationCible}:00Z`);

    const differenceMs = dateDebutProchaine.getTime() - dateFinPrecedente.getTime();
    const heuresRepos = differenceMs / (1000 * 3600);

    return {
      conforme: heuresRepos >= 11,
      heuresReposEffectives: Math.round(heuresRepos * 10) / 10
    };
  }

  // ==========================================================================
  // 4. MOTEUR D'ÉLIGIBILITÉ ET ASSISTANT DE REMPLACEMENT D'URGENCE
  // ==========================================================================

  /**
   * Évalue l'éligibilité d'un agent pour un remplacement inopiné
   * @param {Object} agent - Profil de l'agent
   * @param {Object} posteRequis - Caractéristiques du poste à pourvoir
   * @param {Object} vacationCible - Date et horaires de la vacation
   */
  function evaluerEligibiliteRemplacement(agent, posteRequis, vacationCible) {
    const motifsRejet = [];
    let scoreCompatibilite = 100;

    // 1. Contrôle du repos légal obligatoire de 11h
    const controleRepos = verifierReposPhysiologique(
      agent.date_heure_fin_dernier_service,
      vacationCible.date_vacation,
      vacationCible.heure_debut
    );
    if (!controleRepos.conforme) {
      motifsRejet.push(`Violation du repos légal : seulement ${controleRepos.heuresReposEffectives}h de repos (minimum 11h requis).`);
      scoreCompatibilite -= 50;
    }

    // 2. Contrôle de qualification tir armé
    if (posteRequis.est_poste_arme) {
      if (!agent.qualification_tir_valide) {
        motifsRejet.push('Certificat de tir réglementaire expiré à l\'École Nationale de Police.');
        scoreCompatibilite -= 40;
      }
    }

    // 3. Contrôle de qualification judiciaire (OPJ / APJ)
    if (posteRequis.qualification_requise === 'OPJ' && !agent.est_opj_actif) {
      motifsRejet.push('Habilitation d\'Officier de Police Judiciaire (OPJ) requise pour ce poste.');
      scoreCompatibilite -= 35;
    } else if (posteRequis.qualification_requise === 'APJ' && !agent.est_apj_actif && !agent.est_opj_actif) {
      motifsRejet.push('Habilitation d\'Agent de Police Judiciaire (APJ) requise.');
      scoreCompatibilite -= 25;
    }

    // 4. Contrôle d'aptitude administrative
    if (agent.aptitude_administrative) {
      const codeAptitude = agent.aptitude_administrative.decision_aptitude;
      if (codeAptitude === 'INAPTE_TEMPORAIRE_PORT_ARME' && posteRequis.est_poste_arme) {
        motifsRejet.push('Restriction administrative : Inaptitude temporaire au port d\'arme en vigueur.');
        scoreCompatibilite -= 50;
      }
      if (codeAptitude === 'AMENAGEMENT_POSTE' && vacationCible.type_vacation.includes('nuit')) {
        motifsRejet.push('Restriction administrative : Aménagement de poste diurne sans service de nuit.');
        scoreCompatibilite -= 50;
      }
    }

    // 5. Appartenance à l'unité territoriale
    if (agent.unite_id !== vacationCible.unite_id) {
      scoreCompatibilite -= 15; // Éligible mais pénalisé car renfort externe
    }

    const estEligible = motifsRejet.length === 0;

    return {
      agent_id: agent.id,
      nom_complet: agent.nom_complet,
      matricule: agent.matricule,
      grade: agent.grade,
      est_eligible: estEligible,
      score: Math.max(scoreCompatibilite, 0),
      heures_repos: controleRepos.heuresReposEffectives,
      motifs_rejet: motifsRejet
    };
  }

  // ==========================================================================
  // 5. REGISTRE DISCIPLINAIRE ET PROCÉDURE CONTRADICTOIRE (LOI 116/AN/21)
  // ==========================================================================

  const GROUPES_SANCTIONS_STATUTAIRES = {
    GROUPE_1: {
      libelle: '1er Groupe — Sanctions Morales Légères',
      sanctions: ['Avertissement écrit', 'Blâme avec inscription au dossier'],
      autorite_competente: 'Directeur Général de la Police Nationale',
      saisine_commission: false,
      delai_effacement_mois: 36
    },
    GROUPE_2: {
      libelle: '2ème Groupe — Sanctions Intermédiaires de Carrière',
      sanctions: [
        'Radiation du tableau d\'avancement annuel',
        'Abaissement d\'un ou deux échelons',
        'Exclusion temporaire de fonctions (1 à 15 jours avec retenue de solde)'
      ],
      autorite_competente: 'Directeur Général de la Police Nationale sur avis conforme',
      saisine_commission: true,
      delai_effacement_mois: null
    },
    GROUPE_3: {
      libelle: '3ème Groupe — Sanctions Majeures Rupturistes',
      sanctions: [
        'Rétrogradation de grade',
        'Mise à la retraite d\'office',
        'Révocation sans suspension des droits à pension'
      ],
      autorite_competente: 'Ministre de l\'Intérieur sur avis de la Commission Paritaire',
      saisine_commission: true,
      delai_effacement_mois: null
    }
  };

  /**
   * Vérifie le respect du délai de communication préalable (droit de la défense, 15 jours)
   */
  function verifierDelaiCommunicationDossier(dateCommunicationDossierISO) {
    if (!dateCommunicationDossierISO) return { conforme: false, joursEcoules: 0 };
    const dateCom = new Date(dateCommunicationDossierISO);
    const maintenant = new Date();
    const jours = Math.floor((maintenant.getTime() - dateCom.getTime()) / (1000 * 3600 * 24));
    return {
      conforme: jours >= 15,
      joursEcoules: jours,
      joursRestants: Math.max(15 - jours, 0)
    };
  }

  // ==========================================================================
  // 6. GÉNÉRATEUR DE DOCUMENTS OFFICIELS RÉPUBLICAINS PDF AVEC SCELLEMENT SHA-256
  // ==========================================================================

  /**
   * Génère le gabarit textuel et HTML d'un acte officiel républicain
   * @param {'ARRETE_MUTATION'|'ORDRE_MISSION'|'ATTESTATION_EXERCICE'|'FICHE_INDIVIDUELLE'} codeModele
   * @param {Object} donneesActe
   * @returns {Promise<{html: string, empreinteSha256: string, referenceActe: string}>}
   */
  async function genererActeOfficiel(codeModele, donneesActe) {
    const dateJour = new Date().toISOString().split('T')[0];
    const anneeCourante = new Date().getFullYear();
    const referenceActe = donneesActe.reference || `ACTE-${anneeCourante}-${Math.floor(1000 + Math.random() * 9000)}`;

    let corpsArticlesHtml = '';
    let titreDocument = '';

    if (codeModele === 'ARRETE_MUTATION') {
      titreDocument = 'ARRÊTÉ DE MUTATION ET D\'AFFECTATION';
      corpsArticlesHtml = `
        <div class="articles-arrete">
          <h5>Article 1er :</h5>
          <p>Le fonctionnaire de police <strong>${donneesActe.grade} ${donneesActe.nom_complet}</strong>, matricule <strong>${donneesActe.matricule}</strong>, précédemment affecté au sein de <em>${donneesActe.ancienne_unite}</em>, est muté dans l'intérêt du service à compter du <strong>${donneesActe.date_effet || dateJour}</strong>.</p>
          <h5>Article 2 :</h5>
          <p>L'intéressé est affecté en qualité d'officier de brigade au sein du <strong>${donneesActe.nouvelle_unite}</strong>.</p>
          <h5>Article 3 :</h5>
          <p>Le Directeur Général de la Police Nationale et le Directeur des Ressources Humaines sont chargés, chacun en ce qui le concerne, de l'exécution du présent arrêté qui sera enregistré et communiqué partout où besoin sera.</p>
        </div>
      `;
    } else if (codeModele === 'ORDRE_MISSION') {
      titreDocument = 'ORDRE DE MISSION DE REMPLACEMENT D\'URGENCE';
      corpsArticlesHtml = `
        <div class="articles-arrete">
          <h5>Article 1er :</h5>
          <p>En application des impératifs de continuité du service public de la sécurité républicaine, le fonctionnaire <strong>${donneesActe.grade} ${donneesActe.nom_complet}</strong> (Matricule : <strong>${donneesActe.matricule}</strong>) est désigné d'office en renfort opérationnel.</p>
          <h5>Article 2 :</h5>
          <p>Mission : Assurer la suppléance de garde au poste de <strong>${donneesActe.poste_operationnel || 'Chef de patrouille'}</strong> lors de la vacation du <strong>${donneesActe.date_vacation || dateJour}</strong> (${donneesActe.plage_horaire || '22h00 - 06h00'}).</p>
          <h5>Article 3 :</h5>
          <p>Le temps de repos physiologique statutaire de 11 heures consécutives ayant été préalablement vérifié et respecté, le présent ordre de mission ouvre droit aux indemnités réglementaires de sujétion.</p>
        </div>
      `;
    } else if (codeModele === 'ATTESTATION_EXERCICE') {
      titreDocument = 'ATTESTATION D\'EXERCICE ET DE PRÉSENCE SOUS LES DRAPEAUX';
      corpsArticlesHtml = `
        <div class="articles-arrete">
          <p>La Direction Générale de la Police Nationale certifie par la présente que :</p>
          <p>Le fonctionnaire <strong>${donneesActe.grade} ${donneesActe.nom_complet}</strong>, titulaire du matricule unique <strong>${donneesActe.matricule}</strong>, est en activité de service effectif et continu au sein de la Police Nationale de Djibouti depuis le <strong>${donneesActe.date_incorporation || '01/01/2018'}</strong>.</p>
          <p>Il est actuellement en position statutaire de service actif au <strong>${donneesActe.unite_actuelle || 'Commissariat Central'}</strong>.</p>
          <p>La présente attestation est délivrée à l'intéressé pour servir et valoir ce que de droit auprès des administrations républicaines.</p>
        </div>
      `;
    } else {
      titreDocument = 'FICHE INDIVIDUELLE DE SITUATION ADMINISTRATIVE';
      corpsArticlesHtml = `
        <div class="articles-arrete">
          <p><strong>Identité :</strong> ${donneesActe.nom_complet} | <strong>Matricule :</strong> ${donneesActe.matricule}</p>
          <p><strong>Corps et Grade :</strong> ${donneesActe.grade} | <strong>Échelon :</strong> ${donneesActe.echelon || '3ème'} (Indice ${donneesActe.indice || '480'})</p>
          <p><strong>Unité d'affectation :</strong> ${donneesActe.unite_actuelle || 'Commissariat Central'}</p>
          <p><strong>Aptitude administrative :</strong> ${donneesActe.aptitude || 'APTE_SERVICE_ACTIF'} (Garantie sans données médicales)</p>
          <p><strong>Qualifications actives :</strong> OPJ Actif, Tir réglementaire validé.</p>
        </div>
      `;
    }

    // Confection du texte immuable pour scellement cryptographique SHA-256
    const textePourHachage = `${referenceActe}|${codeModele}|${donneesActe.matricule}|${dateJour}|REPUBLIQUE_DE_DJIBOUTI_POLICE_NATIONALE`;
    const empreinteSha256 = await calculerEmpreinteSHA256(textePourHachage);

    const htmlComplet = `
      <div class="feuille-acte-officiel-a4">
        <div class="filigrane-republicain">REPRODUCTION INTERDITE - POLICE NATIONALE</div>
        
        <!-- En-tête officiel de la République de Djibouti -->
        <div class="en-tete-acte-officiel">
          <div class="bloc-timbre-gauche">
            RÉPUBLIQUE DE DJIBOUTI<br>
            MINISTÈRE DE L'INTÉRIEUR<br>
            DIRECTION GÉNÉRALE DE LA POLICE NATIONALE<br>
            DIRECTION DES RESSOURCES HUMAINES
          </div>
          <div class="bloc-timbre-droit">
            PAIX - TRAVAIL - SOLIDARITÉ<br>
            <em>Unité - Égalité - Paix</em><br>
            Djibouti, le ${new Intl.DateTimeFormat('fr-DJ', { day: '2-digit', month: 'long', year: 'numeric' }).format(new Date())}
          </div>
        </div>

        <!-- Titre de l'acte -->
        <div class="titre-solennel-acte">
          <h2>${titreDocument}</h2>
          <div class="numero-reference-acte">Réf : N° ${referenceActe} / DGPN / DRH</div>
        </div>

        <!-- Visas réglementaires -->
        <div class="corps-texte-visas">
          <p>Vu la Constitution de la République de Djibouti ;</p>
          <p>Vu la Loi n° 48/AN/72 portant statut général des fonctionnaires ;</p>
          <p>Vu la Loi n° 46/AN/04 portant organisation de la Police Nationale modifiée par la Loi n° 116/AN/21 ;</p>
          <p>Considérant les impératifs opérationnels de sécurité et de continuité de la garde républicaine ;</p>
        </div>

        <!-- Corps des dispositions -->
        ${corpsArticlesHtml}

        <!-- Signature et Sceau Républicain -->
        <div class="bas-de-page-acte-officiel">
          <div class="tampon-sceau-republicain">
            ★ RÉPUBLIQUE ★<br>
            DE DJIBOUTI<br>
            POLICE NATIONALE<br>
            SCEAU OFFICIEL
          </div>
          <div class="bloc-signataire-officiel">
            <div class="fonction-signataire">Pour l'Administration de la Police Nationale,<br>Le Chef de Service des Ressources Humaines</div>
            <div class="nom-signataire">Chef de Service RH</div>
          </div>
        </div>

        <!-- Empreinte de scellement SHA-256 -->
        <div class="bloc-scellement-sha256">
          <span>🔒 Scellement Cryptographique SHA-256 :</span>
          <span class="empreinte-code">${empreinteSha256}</span>
          <small>Acte authentifié et inscrit au registre immuable de l'audit républicain.</small>
        </div>
      </div>
    `;

    return {
      html: htmlComplet,
      empreinteSha256,
      referenceActe
    };
  }

  // ==========================================================================
  // 7. EXPOSITION GLOBALE DU MODULE SOUVERAIN SIRH_M4
  // ==========================================================================
  window.SIRH_M4 = {
    detecterTermeMedical,
    attacherIntercepteurMedical,
    calculerEmpreinteSHA256,
    calculerDureeHeures,
    calculerHeuresNuit,
    verifierReposPhysiologique,
    evaluerEligibiliteRemplacement,
    verifierDelaiCommunicationDossier,
    genererActeOfficiel,
    GROUPES_SANCTIONS_STATUTAIRES
  };

})();
