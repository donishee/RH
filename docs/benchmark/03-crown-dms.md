# Fiche Benchmark 03 : Crown Duty Management System (Crown DMS)

## 1. Fiche d'identification
- **Éditeur** : Crown Workforce Management (Crown Computing Ltd, Royaume-Uni)
- **Nom exact du produit** : Crown Duty Management System (Crown DMS) / Crown Police WFM
- **Cible métier** : Forces de police territoriales britanniques, Police d'Irlande du Nord (PSNI), Police Écossaise, services d'urgence
- **Références officielles** : `https://www.crownworkforcemanagement.com/` et catalogues Crown Commercial Service (G-Cloud UK)

## 2. Périmètre fonctionnel
Crown DMS est la référence institutionnelle déployée au sein d'une majorité des forces de police du Royaume-Uni :
- **Gestion des obligations statutaires policières** : Intégration native des réglementations policières britanniques (*Police Regulations*), du manuel des personnels civils de police (*Police Staff Handbook*) et de la directive sur le temps de travail (*Working Time Regulations - WTR*).
- **Planification prévisionnelle et opérationnelle (E-Rostering)** : Planification des équipes d'intervention d'urgence (Response), de police de proximité (Neighbourhood), de police judiciaire (CID), de circulation et de garde à vue (Custody).
- **Adéquation des compétences et spécialités policières (Skills & Specialisms Matching)** : Filtrage et affectation en fonction des qualifications critiques : agents armés autorisés (AFO), habilitation Taser, maintien de l'ordre public (Public Order Commanders), maîtres-chiens, officiers de police judiciaire.
- **Gestion des indisponibilités et régimes particuliers (Abstractions & Recuperative Duties)** : Suivi précis des congés annuels, arrêts maladie, récupération du temps de repos interrompu (Rest Day in Lieu - RDIL), heures supplémentaires compensées (TOIL) et régimes de service allégé ou réadapté.
- **Calcul automatisé des éléments de solde complexes** : Prise en compte automatique des majorations de nuit, de week-end, de jours fériés et des rappels imprévus en service pour transmission directe aux logiciels de paie (Oracle EBS, SAP, Microsoft Dynamics).

## 3. Architecture technique & Déploiement
- **Mode de déploiement** :
  - *Cloud Dédié* : Hébergement sur Microsoft Azure UK Sovereign Cloud certifié pour les données gouvernementales de niveau officiel-sensible (Official-Sensitive).
  - *On-Premise* : Déploiement possible dans les centres de données souverains des forces de police.
- **Architecture logicielle** : Développé sur le framework Microsoft (.NET, SQL Server, Azure App Services) avec alignement complet sur le programme national britannique *National Enabling Programme (NEP)*. Intégration étroite avec Microsoft 365, Power BI et Power Platform.
- **Sécurité et audit** : Chiffrement intégral, conformité ISO 27001, Cyber Essentials Plus, séparation étanche des profils et contrôle d'accès granulaire basé sur les rôles et habilitations de sécurité.

## 4. Existence et caractéristiques du client Windows
- **Client lourd dédié** : Historiquement basé sur une application riche Windows client-serveur (.NET WinForms/WPF), modernisé progressivement en application Web universelle.
- **Accès sous Windows** : Totalement compatible avec les postes de travail Windows standard des commissariats via les navigateurs d'entreprise (Edge, Chrome).
- **Postes mobiles et tablettes de patrouille** : Application mobile et Web responsive optimisée pour les terminaux embarqués dans les véhicules de police et les smartphones professionnels (iOS, Android, Windows 10/11 Mobile/Tablet).

## 5. Disponibilité de la langue française
- **Interface utilisateur** : Exclusivement en anglais (conçu et optimisé pour le cadre institutionnel britannique et du Commonwealth).
- **Documentation et guides** : Guides utilisateurs et spécifications rédigés intégralement en anglais.
- **Support multilingue** : Inexistant en standard, nécessiterait un projet complet de traduction et de refonte des libellés légaux.

## 6. Conditions d'accès et documentation officielle
- **Documentation officielle** : Livres blancs, études de cas policières et fiches d'architecture accessibles publiquement et via le portail gouvernemental G-Cloud britannique. Manuels détaillés réservés aux forces clientes sous accord de confidentialité (NDA).
- **Installateurs et essais** : Aucun installateur public. Démonstrations réservées aux délégations officielles et aux états-majors de police.
- **Modèle de licence** : Contrat de service public pluriannuel négocié via centrales d'achat gouvernementales.

## 7. Évaluation des 10 scénarios clés de gestion policière

| # | Scénario policier | Fonctionnalité & Source | Preuve | Statut de preuve | Niveau de confiance | Limites constatées | Intérêt pour la Police Djiboutienne | Proposition d'adaptation pour le SIRH Djiboutien |
|---|-------------------|-------------------------|--------|------------------|---------------------|--------------------|--------------------------------------|--------------------------------------------------|
| 1 | Créer un agent | Création complète du dossier policier avec grade, unité, rôle, habilitations et matricule | Fiche force de police Crown DMS & G-Cloud listing | **Documenté** | Élevé | Terminologie très spécifique au droit britannique (Warrant #, Constable, Sergeant) | Modélisation rigoureuse de la hiérarchie et des spécialités | Adopter la séparation claire entre données administratives et qualifications opérationnelles |
| 2 | Muter un agent sans perte d'historique | Gestion des mouvements d'effectifs avec traçabilité intégrale des postes antérieurs | Module "Personnel Movements & Historical Duty Tracking" | **Documenté** | Élevé | Procédures de mutation complexes à synchroniser avec l'ERP externe de paie | Continuité absolue du dossier de service du policier | Historisation automatique horodatée de chaque affectation avec référence de l'acte |
| 3 | Soumettre puis valider un congé | Circuit hiérarchique de validation d'absence avec calcul dynamique de l'effectif résiduel | Portail ESS Crown Police avec alerte de capacité opérationnelle | **Documenté** | Élevé | Très formaliste, nécessite de multiples étapes d'arbitrage en cas de tension opérationnelle | Respect impératif de la capacité opérationnelle minimale | Implémenter un voyant visuel (Vert/Orange/Rouge) sur l'impact de la demande sur l'effectif |
| 4 | Refuser une demande avec motif | Rejet motivé avec notification formelle et réintégration immédiate dans le roster | Spécifications des workflows d'absence policière Crown | **Documenté** | Élevé | Nécessite un délai de prévenance strict imposé par les règlements policiers | Encadrement des refus de congés pour nécessités de service | Imposer la sélection d'un motif statutaire (ex. Nécessité impérieuse de service) |
| 5 | Remplacer un agent absent | Remplacement automatique par filtrage d'agents qualifiés respectant le repos légal | Moteur d'adéquation de Crown DMS pour événements d'urgence | **Documenté** | Élevé | Règles de majoration financière très lourdes à paramétrer | Garantie qu'un remplaçant possède les aptitudes requises | Filtrer les remplaçants par grade compatible, possession de l'aptitude et respect des 11h de repos |
| 6 | Signaler qualification expirée | Module "Competencies & Specialisms" avec alertes proactives et blocage de mission | Fiche technique "Police Compliance & Operational Readiness" | **Documenté** | Élevé | Dépend de la mise à jour rigoureuse des données par les instructeurs de police | Éviter d'engager des agents dont le tir ou l'habilitation est périmé | Tableau de bord des qualifications avec code couleur et interdiction de planification |
| 7 | Préparer un avancement | Suivi de l'ancienneté et des évaluations annuelles pour préparer les commissions | Intégration avec les modules d'évaluation et de promotion | **Documenté** | Moyen | Délégué en partie au module Core HR ou ERP externe de la force | Transparence et équité des promotions au choix ou à l'ancienneté | Moteur de simulation d'éligibilité à l'avancement d'échelon et de grade |
| 8 | Bloquer accès hors périmètre | Sécurité par division, district et catégorie de sensibilité (Special Branch, Internal Affairs) | Contrôle d'accès granulaire conforme aux standards de sécurité UK | **Documenté** | Élevé | Configuration complexe nécessitant une équipe d'administrateurs habilités | Protection des enquêtes internes et des dossiers disciplinaires | Établir des cloisons étanches et infranchissables pour les affaires disciplinaires |
| 9 | Identifier modification ou export | Journalisation forensique inaltérable de toute transaction et extraction de données | Spécification d'audit de sécurité conforme à la norme ISO 27001 | **Documenté** | Élevé | Volume très important d'événements enregistrés nécessitant un SIEM externe | Obligation de reddition de comptes et conformité judiciaire | Table d'audit protégée interdisant toute modification ou suppression, même par admin |
| 10 | Produire document & exporter dossier | Génération de dossiers de service, feuilles d'heures et états statistiques certifiés | Outils de reporting intégrés avec Power BI et exports sécurisés | **Documenté** | Élevé | Modèles anglophones très orientés métriques de police de Sa Majesté | Production des pièces administratives nécessaires à la solde et aux mutations | Générateur PDF en français avec métadonnées d'intégrité et mise en page officielle |

## 8. Synthèse et enseignements pour le projet
- **Points forts à retenir** : Adéquation parfaite avec la culture policière (respect des règlements, adéquation des spécialités tactiques, gestion des rappels d'urgence et du repos compensatoire).
- **Limites à combler** : Rigidité culturelle et linguistique 100% britannique, dépendance à des infrastructures cloud complexes.
- **Adaptation requise** : Reprendre le modèle de gestion fine des qualifications policières (tir, intervention, commandement) et de contrôle de la fatigue dans un système intranet autonome adapté au cadre légal djiboutien.
