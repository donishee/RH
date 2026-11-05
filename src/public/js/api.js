/**
 * Client HTTP API souverain du SIRH Police Djiboutienne
 * Communication 100% en français, gestion du jeton opaque et de l'idempotence
 */

(function () {
  'use strict';

  const STOCKAGE_JETON_CLE = 'sirh_jeton_authentification';
  const STOCKAGE_SESSION_CLE = 'sirh_session_active';

  function genererCleIdempotence() {
    return 'idemp-' + Math.random().toString(36).substring(2, 15) + '-' + Date.now().toString(36);
  }

  async function requete(pointEntree, options = {}) {
    const opts = { ...options };
    opts.headers = opts.headers || {};
    opts.headers['Accept'] = 'application/json';

    const jeton = localStorage.getItem(STOCKAGE_JETON_CLE);
    if (jeton) {
      opts.headers['Authorization'] = 'Bearer ' + jeton;
    }

    // Gestion de l'idempotence sur les requêtes d'écriture (POST, PUT)
    if (['POST', 'PUT'].includes((opts.method || 'GET').toUpperCase())) {
      if (!opts.headers['Idempotency-Key']) {
        opts.headers['Idempotency-Key'] = genererCleIdempotence();
      }
      if (opts.body && typeof opts.body === 'object' && !(opts.body instanceof FormData)) {
        opts.headers['Content-Type'] = 'application/json';
        opts.body = JSON.stringify(opts.body);
      }
    }

    try {
      const reponse = await fetch(pointEntree, opts);
      const donnees = await reponse.json().catch(() => ({}));

      if (!reponse.ok) {
        // Redirection vers connexion si session expirée
        if (reponse.status === 401 && !pointEntree.includes('/auth/connexion')) {
          localStorage.removeItem(STOCKAGE_JETON_CLE);
          localStorage.removeItem(STOCKAGE_SESSION_CLE);
          if (!window.location.pathname.endsWith('connexion.html')) {
            window.location.href = '/connexion.html';
          }
        }
        const err = new Error(donnees.message || 'Une anomalie est survenue lors de l\'opération.');
        err.code = donnees.code_erreur || 'ERREUR_HTTP';
        err.status = reponse.status;
        err.details = donnees;
        throw err;
      }

      return donnees;
    } catch (erreur) {
      console.error('Erreur API SIRH :', erreur);
      throw erreur;
    }
  }

  window.SIRH_API = {
    // Authentification
    async connexion(identifiant, motDePasse) {
      const res = await requete('/api/auth/connexion', {
        method: 'POST',
        body: { identifiant, mot_de_passe: motDePasse }
      });
      if (res.jeton) {
        localStorage.setItem(STOCKAGE_JETON_CLE, res.jeton);
      }
      if (res.session) {
        localStorage.setItem(STOCKAGE_SESSION_CLE, JSON.stringify(res.session));
      }
      return res;
    },

    async deconnexion() {
      try {
        await requete('/api/auth/deconnexion', { method: 'POST' });
      } finally {
        localStorage.removeItem(STOCKAGE_JETON_CLE);
        localStorage.removeItem(STOCKAGE_SESSION_CLE);
        window.location.href = '/connexion.html';
      }
    },

    async obtenirSession() {
      return requete('/api/auth/session');
    },

    obtenirSessionLocale() {
      const brute = localStorage.getItem(STOCKAGE_SESSION_CLE);
      return brute ? JSON.parse(brute) : null;
    },

    // Unités
    async listerUnites(filtres = {}) {
      const params = new URLSearchParams(filtres).toString();
      return requete('/api/unites' + (params ? '?' + params : ''));
    },

    async obtenirUnite(id) {
      return requete('/api/unites/' + encodeURIComponent(id));
    },

    async obtenirArborescenceUnite(id) {
      return requete('/api/unites/' + encodeURIComponent(id) + '/arborescence');
    },

    async creerUnite(data) {
      return requete('/api/unites', { method: 'POST', body: data });
    },

    // Postes
    async listerPostes(filtres = {}) {
      const params = new URLSearchParams(filtres).toString();
      return requete('/api/postes' + (params ? '?' + params : ''));
    },

    // Agents
    async listerAgents(filtres = {}) {
      const params = new URLSearchParams(filtres).toString();
      return requete('/api/agents' + (params ? '?' + params : ''));
    },

    async obtenirAgent(id) {
      return requete('/api/agents/' + encodeURIComponent(id));
    },

    async creerAgent(data) {
      return requete('/api/agents', { method: 'POST', body: data });
    },

    async modifierAgent(id, data) {
      return requete('/api/agents/' + encodeURIComponent(id), { method: 'PUT', body: data });
    },

    // Affectations & Mutations
    async obtenirAffectationsAgent(agentId) {
      return requete('/api/agents/' + encodeURIComponent(agentId) + '/affectations');
    },

    async muterAgent(data) {
      return requete('/api/mutations', { method: 'POST', body: data });
    },

    // Form Builder & Configuration
    async listerChamps(entiteCible) {
      const url = '/api/config/champs' + (entiteCible ? '?entite_cible=' + encodeURIComponent(entiteCible) : '');
      return requete(url);
    },

    async ajouterChamp(data) {
      return requete('/api/config/champs', { method: 'POST', body: data });
    },

    async modifierChamp(id, data) {
      return requete('/api/config/champs/' + encodeURIComponent(id), { method: 'PUT', body: data });
    },

    async listerListesValeurs() {
      return requete('/api/config/listes-valeurs');
    },

    async ajouterElementListe(code, data) {
      return requete('/api/config/listes-valeurs/' + encodeURIComponent(code) + '/elements', {
        method: 'POST',
        body: data
      });
    },

    async listerVersions() {
      return requete('/api/config/versions');
    },

    async publierVersion(commentaire) {
      return requete('/api/config/versions/publier', { method: 'POST', body: { commentaire } });
    },

    async rollbackVersion(versionCible, motifJustificatif) {
      return requete('/api/config/versions/rollback', {
        method: 'POST',
        body: { version_cible: versionCible, motif_justificatif: motifJustificatif }
      });
    },

    // Audit
    async listerJournauxAudit(filtres = {}) {
      const params = new URLSearchParams(filtres).toString();
      return requete('/api/audit/journaux' + (params ? '?' + params : ''));
    },

    async verifierChaineAudit() {
      return requete('/api/audit/verifier-chaine');
    },

    // Congés & Absences (Jalon M2)
    async listerTypesConges() {
      return requete('/api/conges/types');
    },

    async obtenirSoldesConges(agentId, annee) {
      const qs = annee ? `?annee=${encodeURIComponent(annee)}` : '';
      const pointEntree = agentId ? `/api/conges/soldes/${encodeURIComponent(agentId)}${qs}` : `/api/conges/soldes${qs}`;
      return requete(pointEntree);
    },

    async soumettreDemandeConge(donnees) {
      return requete('/api/conges/demandes', {
        method: 'POST',
        body: donnees
      });
    },

    async listerDemandesConges(filtres = {}) {
      const params = new URLSearchParams(filtres).toString();
      return requete('/api/conges/demandes' + (params ? '?' + params : ''));
    },

    async viserDemandeConge(demandeId, { avis, motif_refus, commentaire }) {
      return requete(`/api/conges/demandes/${encodeURIComponent(demandeId)}/viser-chef`, {
        method: 'PUT',
        body: { avis, motif_refus, commentaire }
      });
    },

    async validerDemandeCongeRH(demandeId, { decision, motif_refus, version_concurrence, version_fournie }) {
      return requete(`/api/conges/demandes/${encodeURIComponent(demandeId)}/valider-rh`, {
        method: 'PUT',
        body: { decision, motif_refus, version_concurrence, version_fournie }
      });
    },

    async annulerDemandeConge(demandeId, motif_annulation) {
      return requete(`/api/conges/demandes/${encodeURIComponent(demandeId)}/annuler`, {
        method: 'POST',
        body: { motif_annulation }
      });
    },

    async obtenirStatistiquesConges() {
      return requete('/api/conges/statistiques');
    },

    // =========================================================================
    // Carrières, Promotions, Notations & Solde (Jalon M3)
    // =========================================================================

    // Carrières & Échelons
    async obtenirCarriereAgent(agentId) {
      return requete(`/api/carrieres/${encodeURIComponent(agentId)}`);
    },

    async avancerEchelon(donnees) {
      return requete('/api/carrieres/avancement-echelon', {
        method: 'POST',
        body: donnees
      });
    },

    // Promotions & Tableau d'avancement
    async enregistrerPromotion(donnees) {
      return requete('/api/promotions', {
        method: 'POST',
        body: donnees
      });
    },

    async obtenirEligiblesTableauAvancement(annee, corps, grade) {
      const params = new URLSearchParams({ annee: annee || 2026 });
      if (corps) params.append('corps', corps);
      if (grade) params.append('grade', grade);
      return requete(`/api/promotions/tableau-avancement/eligibles?${params.toString()}`);
    },

    async simulerTableauAvancement(cohortes) {
      return requete('/api/promotions/tableau-avancement/simulation', {
        method: 'POST',
        body: { cohortes }
      });
    },

    // Positions statutaires
    async declarerPositionStatutaire(donnees) {
      return requete('/api/positions', {
        method: 'POST',
        body: donnees
      });
    },

    // Qualifications & Formations
    async listerQualifications(agentId, type) {
      const params = new URLSearchParams();
      if (agentId) params.append('agent_id', agentId);
      if (type) params.append('type_qualification', type);
      const qs = params.toString() ? `?${params.toString()}` : '';
      return requete(`/api/qualifications${qs}`);
    },

    async obtenirAlertesPeremption() {
      return requete('/api/qualifications/alertes-peremption');
    },

    async creerQualification(donnees) {
      return requete('/api/qualifications', {
        method: 'POST',
        body: donnees
      });
    },

    async listerFormations(type) {
      const qs = type ? `?type=${encodeURIComponent(type)}` : '';
      return requete(`/api/formations${qs}`);
    },

    // Notations Annuelles
    async obtenirNotationsAgent(agentId) {
      return requete(`/api/notations/${encodeURIComponent(agentId)}`);
    },

    async enregistrerNotation(donnees) {
      return requete('/api/notations', {
        method: 'POST',
        body: donnees
      });
    },

    async deposerRecoursNotation(notationId, donnees) {
      return requete(`/api/notations/${encodeURIComponent(notationId)}/recours`, {
        method: 'PUT',
        body: donnees
      });
    },

    async arbitrerRecoursNotation(notationId, donnees) {
      return requete(`/api/notations/${encodeURIComponent(notationId)}/decision-recours`, {
        method: 'PUT',
        body: donnees
      });
    },

    // Solde & Exports scellés SHA-256
    async calculerSoldeMensuelle(annee, mois, agentId) {
      const params = new URLSearchParams({ annee: annee || 2026, mois: mois || 1 });
      if (agentId) params.append('agent_id', agentId);
      return requete(`/api/solde/calcul-mensuel?${params.toString()}`);
    },

    async genererExportSolde(annee, mois, formatExport) {
      return requete('/api/solde/export-scelle', {
        method: 'POST',
        body: { annee, mois, format_export: formatExport || 'CSV_TRESOR_DJIBOUTI' }
      });
    }
  };
})();
