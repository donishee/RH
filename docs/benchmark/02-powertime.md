# Fiche Benchmark 02 : PowerTime (PowerDMS by NEOGOV)

## 1. Fiche d'identification
- **Éditeur** : PowerDMS (filiale du groupe NEOGOV Inc.)
- **Nom exact du produit** : PowerTime™ (auparavant connu sous la marque PlanIt Schedule)
- **Cible métier** : Agences de sécurité publique, forces de police municipale et d'État, répartiteurs 911, shérifs
- **Références officielles** : `https://www.powerdms.com/powertime` et portail de support PlanIt Schedule (`planitschedule.com`)

## 2. Périmètre fonctionnel
PowerTime est une plateforme cloud dédiée à la planification des horaires de patrouille et à la gestion du temps pour les services de police :
- **Gestion des roulements 24/7 (Shift Management)** : Modèles préconfigurés de rotations policières (ex. 4 jours de travail / 4 jours de repos, cycles Pitman de 12 heures, 3x8).
- **Règles d'effectifs de sécurité (Minimum Staffing Levels)** : Contrôle continu des effectifs minimums par poste et brigade avec alertes automatiques.
- **Gestion des congés et échanges de service (Time-off & Shift Swaps)** : Soumission en ligne des demandes de congés et d'échanges entre pairs avec validation superviseur.
- **Suivi des heures supplémentaires et des vacations ouvertes (Overtime Distribution)** : Diffusion des vacations supplémentaires non pourvues selon règles d'équité ou d'ancienneté.
- **Suivi des formations et habilitations (Training & Expirations)** : Suivi des dates limites de recyclage pour le tir, les premiers secours et les habilitations de conduite.
- **Intégration d'écosystème** : Liaison native avec PowerPolicy (diffusion des ordres généraux et procédures permanentes) et PowerDetails.

## 3. Architecture technique & Déploiement
- **Mode de déploiement** : 100% Cloud SaaS multi-tenant sécurisé. Aucun serveur local requis au sein du commissariat. Hébergement AWS GovCloud aux États-Unis.
- **Architecture applicative** : Application Web moderne HTML5/React avec API REST en backend.
- **Sécurité et conformité** : Conformité CJIS, authentification unique (SSO) SAML 2.0 / Azure AD, chiffrement TLS 1.3 et stockage chiffré des données sensibles. Sauvegardes automatisées quotidiennes.

## 4. Existence et caractéristiques du client Windows
- **Client lourd dédié** : Inexistant. Pas d'application exécutable Windows (.exe / .msi).
- **Accès sous Windows** : Accès direct via navigateur Web (Edge, Chrome, Firefox) à l'URL dédiée de l'institution (`institution.planitschedule.com`).
- **Affichage sur écrans de poste** : Prise en charge des tableaux de bord grand écran (Digital Signage / First Arriving) pour l'affichage mural du statut de la garde dans le hall de commandement.
- **Application mobile** : Applications iOS et Android pour les agents sur le terrain.

## 5. Disponibilité de la langue française
- **Interface utilisateur** : Exclusivement en anglais (conçu initialement pour le marché nord-américain).
- **Documentation et guides** : Guides utilisateurs, vidéos explicatives et base de connaissances intégralement en anglais.
- **Support linguistique** : Pas de pack de langue français officiel disponible à ce jour.

## 6. Conditions d'accès et documentation officielle
- **Documentation officielle** : Disponible publiquement en ligne via la base d'aide de PowerDMS / PlanIt Schedule et chaînes de formation vidéo officielles.
- **Installateurs et essais** : Pas d'installateur téléchargeable. Démonstrations guidées en ligne proposées aux directions de police.
- **Modèle de licence** : Abonnement annuel facturé selon le nombre d'agents actifs sous contrat d'engagement pluriannuel.

## 7. Évaluation des 10 scénarios clés de gestion policière

| # | Scénario policier | Fonctionnalité & Source | Preuve | Statut de preuve | Niveau de confiance | Limites constatées | Intérêt pour la Police Djiboutienne | Proposition d'adaptation pour le SIRH Djiboutien |
|---|-------------------|-------------------------|--------|------------------|---------------------|--------------------|--------------------------------------|--------------------------------------------------|
| 1 | Créer un agent | Fiche agent avec matricule (Badge #), grade, escouade, coordonnées et rôle (Guide PlanIt) | Formulaire d'ajout agent dans "Personnel Administration" | **Observé** | Élevé | Absence de notion de corps administratif ou de statut fonction publique | Gestion rapide des effectifs opérationnels | Combiner l'ergonomie de la fiche agent avec la rigueur statutaire djiboutienne (corps, grade, échelon) |
| 2 | Muter un agent sans perte d'historique | Modification de l'assignation de brigade avec conservation des heures passées | Historique des vacations et des rapports de patrouille | **Documenté** | Élevé | Ne conserve pas d'historique formel des arrêtés de nomination ou de mutation | Maintien de l'historique d'affectation opérationnelle | Associer à chaque changement d'unité un numéro d'acte administratif et archiver la décision |
| 3 | Soumettre puis valider un congé | Demande par portail agent, calcul du solde et validation par le superviseur | Flux d'approbation à 2 niveaux dans le module Time-Off | **Observé** | Élevé | Règles de solde simplifiées (heures cumulées plutôt que droits annuels statutaires) | Décharge administrative pour les chefs de brigade | Automatiser le calcul des soldes en jours ouvrables selon le statut général djiboutien |
| 4 | Refuser une demande avec motif | Rejet motivé avec commentaire obligatoire et notification automatique | Boîte de dialogue de refus avec notification par courriel/push | **Observé** | Élevé | Historique des refus consultable par l'administrateur, visibilité agent variable | Traçabilité des décisions de commandement | Journaliser chaque refus avec motif réglementaire et voie de recours gracieux |
| 5 | Remplacer un agent absent | Module "Open Shifts" permettant de proposer le quart aux agents disponibles | Notification de remplacement envoyée aux profils éligibles | **Observé** | Élevé | Repose sur le volontariat ou l'ancienneté, moins sur l'ordre de service hiérarchique | Comblement rapide des vacances de poste imprévues | Permettre à la fois l'appel à volontaires et la désignation d'office par le chef de service |
| 6 | Signaler qualification expirée | Module d'alertes "Certifications" avec indicateur visuel d'expiration | Bannière d'alerte rouge sur le profil agent et le planning | **Observé** | Élevé | Ne bloque pas toujours formellement la prise de service sauf configuration stricte | Sécurisation juridique de l'usage des armes et moyens de police | Blocage strict de toute affectation sur un poste nécessitant une certification échue |
| 7 | Préparer un avancement | Non supporté par PowerTime (nécessite l'extension NEOGOV Perform) | Absence de fonctionnalité de carrière dans PlanIt/PowerTime | **Inconnu** | Faible | Outil strictement circonscrit au temps et planning de service | Nécessité d'une couverture globale de la carrière | Développer le module avancement au sein du même socle applicatif unifié |
| 8 | Bloquer accès hors périmètre | Permissions basées sur les escouades et les grades (Superviseur vs Agent) | Matrice de droits utilisateur dans le panneau d'administration | **Documenté** | Élevé | Pas de cloisonnement strict pour les affaires disciplinaires (non prévues) | Étanchéité entre commissariats et unités spécialisées | Cloisonnement strict au niveau serveur par unité et module ultrasensible |
| 9 | Identifier modification ou export | Journal d'activité enregistrant les créations, suppressions et modifications | Écran "System Audit Log" avec date, utilisateur et action | **Observé** | Élevé | Pas de traçabilité fine sur le simple acte de consultation (lecture seule) | Respect de la vie privée des fonctionnaires de police | Enregistrer les consultations de dossiers ainsi que les exports de données |
| 10 | Produire document & exporter dossier | Export des plannings et feuilles de présence en formats PDF et Excel | Fonction d'export dans chaque tableau de bord | **Observé** | Élevé | Exports sous forme tabulaire brute, pas de mise en page administrative officielle | Traçabilité des présences pour la solde | Modèles PDF conformes à la charte graphique officielle de la Police Djiboutienne |

## 8. Synthèse et enseignements pour le projet
- **Points forts à retenir** : Ergonomie moderne, simplicité de prise en main pour les chefs de brigade, visibilité temps réel sur les effectifs en patrouille.
- **Limites à combler** : Dépendance au cloud public US, absence totale de français, absence de module carrière/avancement/discipline.
- **Adaptation requise** : Développer une solution intranet souveraine en français offrant la même fluidité d'ordonnancement opérationnel tout en intégrant le cycle complet RH de la police.
