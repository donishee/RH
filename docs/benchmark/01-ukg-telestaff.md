# Fiche Benchmark 01 : UKG TeleStaff

## 1. Fiche d'identification
- **Éditeur** : Ultimate Kronos Group (UKG Inc.)
- **Nom exact du produit** : UKG TeleStaff™ (précédemment Kronos TeleStaff, Workforce TeleStaff)
- **Cible métier** : Sécurité publique (Police, Gendarmerie/Sheriff, Pompiers/Secours, Établissements pénitentiaires)
- **Références officielles** : `https://www.ukg.com/solutions/workforce-management/tele-staff` et portail UKG Community

## 2. Périmètre fonctionnel
UKG TeleStaff est le standard de fait nord-américain pour la planification opérationnelle et la gestion des temps des forces de l'ordre :
- **Planification automatisée sous contraintes 24/7/365** : Prise en compte des cycles de rotation continus (vacations, brigades, quarts de 8h, 10h ou 12h).
- **Règles d'effectifs minimaux (Minimum Staffing Levels)** : Calcul dynamique et alertes en cas de sous-effectif sur un secteur ou un créneau horaire.
- **Gestion équitable des heures supplémentaires (Overtime Equalization)** : Algorithmes d'attribution basée sur l'ancienneté, les listes de tour de rôle et le cumul d'heures.
- **Gestion de la fatigue opérationnelle (Fatigue Management)** : Blocage préventif des attributions en cas de dépassement du seuil d'heures consécutives ou de temps de repos insuffisant.
- **Portail en libre-service agent (ESS)** : Consultation des plannings, soumission de congés, échanges de vacations (shift swaps), enchères de quarts (shift bidding).
- **Gestion des missions exceptionnelles (Special Details / Events)** : Affectations pour événements majeurs, services d'ordre et détachements temporaires.

## 3. Architecture technique & Déploiement
- **Mode de déploiement** :
  - *SaaS Cloud* : UKG TeleStaff Cloud hébergé sur infrastructure certifiée gouvernementale.
  - *On-Premise (Historique/Hybride)* : Déploiement possible sur serveurs internes sous Windows Server avec base de données Microsoft SQL Server.
- **Architecture applicative** : Modèle 3-tiers centralisé avec serveur d'application Web, services de calcul d'ordonnancement (Engine) et base de données relationnelle unique. Pas de base locale par poste client.
- **Sécurité et conformité** : Alignement sur les standards CJIS (Criminal Justice Information Services), chiffrement TLS 1.3 en transit, chiffrement AES-256 au repos, journalisation d'audit des modifications de planning.

## 4. Existence et caractéristiques du client Windows
- **Client lourd dédié** : Inexistant dans les versions actuelles. Les versions historiques (antérieures à la v6.x) disposaient d'un client Win32, abandonné au profit d'une interface Web universelle.
- **Accès sous Windows** : 100% accessible via navigateur Web moderne (Microsoft Edge, Google Chrome, Mozilla Firefox) sur les postes de travail Windows de l'administration.
- **Client mobile** : Application responsive Web et applications natives iOS/Android pour l'accès nomade des agents.

## 5. Disponibilité de la langue française
- **Interface utilisateur** : Disponible en français (localisation réalisée notamment pour les corps de police et services de secours canadiens - Québec/fédéral).
- **Documentation et guides** : Guides utilisateurs et modules de formation disponibles en français canadien via le portail UKG Community University ; documentation technique d'administration principalement en anglais.
- **Messages et notifications** : Configurables par gabarits de messages multilingues.

## 6. Conditions d'accès et documentation officielle
- **Documentation officielle** : Manuels d'administration, guides utilisateurs et fiches techniques accessibles sous contrat de licence ou compte UKG Community.
- **Installateurs et essais** : Aucun essai public téléchargeable (logiciel propriétaire d'entreprise soumis à qualification commerciale préalable). Démonstrations guidées assurées par l'éditeur.
- **Modèle de licence** : Abonnement par agent/mois (SaaS) ou licence perpétuelle avec contrat de maintenance annuel (sur site).

## 7. Évaluation des 10 scénarios clés de gestion policière

| # | Scénario policier | Fonctionnalité & Source | Preuve | Statut de preuve | Niveau de confiance | Limites constatées | Intérêt pour la Police Djiboutienne | Proposition d'adaptation pour le SIRH Djiboutien |
|---|-------------------|-------------------------|--------|------------------|---------------------|--------------------|--------------------------------------|--------------------------------------------------|
| 1 | Créer un agent | Création de profil agent avec matricule, grade, unité et compétences (Doc technique UKG) | Guide admin TeleStaff ch. 3 "User Management" | **Documenté** | Élevé | Orienté planification horaire, moins complet qu'un dossier statutaire de fonction publique | Structuration du dossier avec identité, matricule unique et position administrative | Enrichir la fiche agent pour intégrer le statut de fonctionnaire de police et échelons indiciaires |
| 2 | Muter un agent sans perte d'historique | Réaffectation de l'agent à une nouvelle unité avec date d'effet (Release notes v6.8) | Historique des profils et changements de calendrier | **Documenté** | Élevé | L'historique porte principalement sur les shifts et plannings, archivage statutaire partiel | Traçabilité chronologique complète des affectations | Implémenter une table d'historique inaltérable liant agent, unité, fonction et arrêté de mutation |
| 3 | Soumettre puis valider un congé | Workflow de demande d'absence via portail agent avec validation superviseur (Fiche produit ESS) | Interface de validation en temps réel avec impact immédiat sur le roster | **Observé** | Élevé | Dépend des règles de quotas paramétrées, peu adapté aux circuits stricts ministériels | Workflow hiérarchique avec vérification automatique de l'effectif résiduel | Circuit à 3 niveaux (Chef de poste -> Commandant de brigade -> Bureau RH) avec blocage de quota |
| 4 | Refuser une demande avec motif | Rejet motivé de demande avec notification à l'agent (Doc utilisateur UKG) | Formulaire de refus avec champ "Reason Code" obligatoire | **Documenté** | Élevé | Motifs souvent limités à une liste fixe fermée | Transparence administrative et respect des droits de l'agent | Liste paramétrable de motifs réglementaires + champ texte libre d'explication administrative |
| 5 | Remplacer un agent absent | Mécanisme de rappel d'urgence et comblement automatique de vacance (Doc d'ordonnancement) | Moteur de recommandation d'agents selon liste de garde et ancienneté | **Documenté** | Élevé | Complexe à paramétrer ; calcul d'indemnité selon conventions collectives US | Maintien de la continuité opérationnelle des commissariats 24/7 | Module de proposition de remplaçant éligible selon grade, unité et repos légal respecté |
| 6 | Signaler qualification expirée | Module "Certifications & Skills" avec alertes d'échéance (Datasheet UKG Safety) | Notification visuelle sur le planning bloquant la prise de poste | **Documenté** | Élevé | Ne gère pas directement les convocations à l'école de police | Prévention des manquements juridiques (port d'arme, conduite, tir) | Alertes à J-60, J-30 et J-0 bloquant l'affectation sur poste armé ou spécialisé |
| 7 | Préparer un avancement | Non couvert nativement par TeleStaff (délégué au SIRH central UKG Pro) | Manuel UKG Pro Talent & Compensation | **Déduit** | Moyen | TeleStaff est un outil WFM/Planning, pas un moteur d'avancement de grade | Transposition nécessaire vers le module Carrières | Développer un module dédié d'évaluation et de calcul d'ancienneté pour tableau d'avancement |
| 8 | Bloquer accès hors périmètre | Rôles et groupes de sécurité par division/station (Guide sécurité UKG) | Contrôle d'accès basé sur les rôles (RBAC) au niveau données | **Documenté** | Élevé | Cloisonnement hiérarchique classique mais nécessite des licences additionnelles pour les silos | Protection absolue des données opérationnelles et territoriales | Contrôle strict par unité de rattachement côté serveur avec isolation hermétique |
| 9 | Identifier modification ou export | Journal d'audit complet des actions de planification et exports (Spécification d'audit) | Table de log `AuditTrail` avec horodatage, utilisateur et delta de valeurs | **Documenté** | Élevé | Journaux volumineux nécessitant des mécanismes de purge ou d'archivage externe | Traçabilité légale et transparence vis-à-vis de l'Inspection Générale | Journal d'audit append-only avec hachage cryptographique et motif obligatoire d'export |
| 10 | Produire document & exporter dossier | Génération de rapports de service et export paie/temps (Manuel reporting) | Exports CSV/PDF et connecteurs paie standards | **Documenté** | Élevé | Modèles de documents orientés feuilles d'heures et plannings, pas d'arrêtés officiels | Nécessité de produire des actes administratifs souverains | Moteur de génération PDF avec armoiries officielles de Djibouti et signature administrative |

## 8. Synthèse et enseignements pour le projet
- **Points forts à retenir** : Moteur de calcul d'effectif minimum en temps réel, alertes de fatigue opérationnelle, gestion fine des règles de vacation policière.
- **Limites à combler** : Manque d'intégration native du statut général de la fonction publique (grades, échelons, commissions de discipline, avancement indiciaire).
- **Adaptation requise** : Intégrer l'excellence de la gestion des vacations policières au sein d'un SIRH complet intégrant les spécificités statutaires de la Police Djiboutienne.
