/**
 * Logique partagée de l'application Web Intranet du SIRH Police Djiboutienne
 */

(function () {
  'use strict';

  function initialiserInterface() {
    const session = window.SIRH_API.obtenirSessionLocale();
    const estPageConnexion = window.location.pathname.endsWith('connexion.html') || window.location.pathname === '/' || window.location.pathname.endsWith('index.html');

    if (!session && !estPageConnexion) {
      window.location.href = '/connexion.html';
      return;
    }

    if (session) {
      afficherEnTeteUtilisateur(session);
      configurerNavigationRole(session);
    }
  }

  function afficherEnTeteUtilisateur(session) {
    const conteneur = document.getElementById('profil-utilisateur-connecte');
    if (!conteneur) return;

    conteneur.innerHTML = `
      <div style="text-align: right;">
        <div style="font-weight: 700; font-size: 0.9rem;">${session.nom_complet || session.identifiant}</div>
        <div style="font-size: 0.75rem; color: #CBD5E0;">Matricule: ${session.matricule || 'Non assigné'}</div>
      </div>
      <span class="badge-role">${session.role}</span>
      <button id="bouton-deconnexion" class="bouton bouton-secondaire bouton-petit" style="margin-left: 0.5rem;">
        Déconnexion
      </button>
    `;

    const btnDeconnexion = document.getElementById('bouton-deconnexion');
    if (btnDeconnexion) {
      btnDeconnexion.addEventListener('click', () => {
        window.SIRH_API.deconnexion();
      });
    }
  }

  function configurerNavigationRole(session) {
    const nav = document.getElementById('menu-navigation-laterale');
    if (!nav) return;

    const role = session.role;
    let liens = [
      { href: '/tableau-de-bord.html', libelle: 'Tableau de bord', icone: '📊' }
    ];

    if (role === 'ADMIN_TECHNIQUE') {
      liens.push(
        { href: '/audit.html', libelle: 'Journaux d\'audit SHA-256', icone: '🛡️' }
      );
    } else if (role === 'ADMIN_FONCTIONNEL_RH') {
      liens.push(
        { href: '/unites.html', libelle: 'Organigramme des unités', icone: '🏛️' },
        { href: '/admin-fonctionnel.html', libelle: 'Console Form Builder', icone: '⚙️' }
      );
    } else if (role === 'GESTIONNAIRE_RH') {
      liens.unshift(
        { href: '/portail-rh.html', libelle: 'Portail DRH (Validation & Soldes)', icone: '⚖️' },
        { href: '/portail-rh-m3.html', libelle: 'Carrières, Promotions & Solde', icone: '🎖️' },
        { href: '/maquette_planning_commandement_m4.html', libelle: 'Planning 24/7 & Remplacements', icone: '📅' },
        { href: '/maquette_discipline_cloisonnee_m4.html', libelle: 'Sanctuaire Disciplinaire', icone: '⚖️' },
        { href: '/maquette_aptitude_documents_m4.html', libelle: 'Aptitude & Documents PDF', icone: '📋' }
      );
      liens.push(
        { href: '/agents.html', libelle: 'Dossiers agents (National)', icone: '👮' },
        { href: '/agent-creation.html', libelle: 'Recruter un agent', icone: '➕' },
        { href: '/mutations.html', libelle: 'Affectations & Mutations', icone: '🔄' },
        { href: '/unites.html', libelle: 'Organigramme des unités', icone: '🏛️' }
      );
    } else if (role === 'CHEF_DE_SERVICE') {
      liens.unshift(
        { href: '/portail-chef.html', libelle: 'Commandement (Congés & Visas)', icone: '⚖️' },
        { href: '/portail-chef-m3.html', libelle: 'Qualifications & Notations', icone: '🎯' },
        { href: '/maquette_planning_commandement_m4.html', libelle: 'Planning 24/7 & Remplacements', icone: '📅' },
        { href: '/maquette_aptitude_documents_m4.html', libelle: 'Documents & Ordres de mission', icone: '📋' }
      );
      liens.push(
        { href: '/agents.html', libelle: 'Effectifs de mon unité', icone: '👮' },
        { href: '/unites.html', libelle: 'Structure de mon unité', icone: '🏛️' }
      );
    } else if (role === 'AGENT') {
      const monId = session.agent_id || 'agt-001';
      liens = [
        { href: '/portail-agent.html', libelle: 'Mon espace agent (Congés & Solde)', icone: '📝' },
        { href: '/portail-agent-m3.html', libelle: 'Ma Carrière & Avancement', icone: '🎖️' },
        { href: '/maquette_aptitude_documents_m4.html', libelle: 'Mes Attestations Officielles (PDF)', icone: '📄' },
        { href: `/agent-fiche.html?id=${monId}`, libelle: 'Mon dossier individuel', icone: '📄' }
      ];
    } else if (role === 'AUDITEUR') {
      liens.push(
        { href: '/audit.html', libelle: 'Inspection de l\'audit SHA-256', icone: '🔍' },
        { href: '/agents.html', libelle: 'Consultation agents (Lecture seule)', icone: '👁️' },
        { href: '/unites.html', libelle: 'Organigramme des unités', icone: '🏛️' }
      );
    }

    const cheminActuel = window.location.pathname;
    nav.innerHTML = liens.map(l => `
      <a href="${l.href}" class="lien-nav ${cheminActuel === l.href ? 'actif' : ''}">
        <span>${l.icone}</span>
        <span>${l.libelle}</span>
      </a>
    `).join('');
  }

  // Sauvegarde volatile des brouillons en sessionStorage (respect R5 : 0 base locale)
  window.SIRH_BROUILLONS = {
    sauvegarder(cle, donnees) {
      try {
        sessionStorage.setItem('brouillon_' + cle, JSON.stringify(donnees));
      } catch (e) {}
    },
    recuperer(cle) {
      try {
        const brute = sessionStorage.getItem('brouillon_' + cle);
        return brute ? JSON.parse(brute) : null;
      } catch (e) {
        return null;
      }
    },
    purger(cle) {
      try {
        sessionStorage.removeItem('brouillon_' + cle);
      } catch (e) {}
    }
  };

  document.addEventListener('DOMContentLoaded', initialiserInterface);
})();
