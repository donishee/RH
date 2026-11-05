# Fiche Benchmark 07 : PowerDetails (Secondary Employment & Extra-Duty Management)

## 1. Fiche d'identification
- **Éditeur** : PowerDetails Inc. (groupe NEOGOV / PowerDMS)
- **Nom exact du produit** : PowerDetails™ Extra-Duty and Secondary Employment Management Software
- **Cible métier** : Services de police municipale, départements de shérif, services de sécurité des universités et hôpitaux
- **Références officielles** : `https://www.powerdetails.com/` et portail des partenaires PowerDMS

## 2. Périmètre fonctionnel
PowerDetails est le leader spécialisé dans la gestion des missions de sécurité secondaire, des gardes d'ordre exceptionnelles et des heures de service rémunérées hors service ordinaire :
- **Gestion des missions d'ordre et de sécurité extérieure (Extra-Duty Details)** : Publication de missions demandées par des tiers (événements sportifs, chantiers, concerts, surveillance commerciale autorisée) ou réquisitions d'État.
- **Répartition équitable des missions (Fair & Equitable Distribution Rules)** : Algorithmes évitant le favoritisme grâce à des règles d'attribution transparentes (tour de rôle, cumul d'heures le plus bas, ancienneté, plafonds par période).
- **Prévention du surmenage et gestion de la fatigue (Officer Wellness & Fatigue Limits)** : Définition de plafonds stricts d'heures combinées (heures de service ordinaire + heures de mission secondaire). Blocage automatique des candidatures qui entraîneraient un dépassement de la durée maximale de travail ou une atteinte au repos obligatoire.
- **Facturation et perception des frais administratifs (Billing & Invoicing)** : Gestion des tarifs horaires différenciés par grade, facturation automatisée aux demandeurs et calcul des frais de gestion pour la collectivité.
- **Portail mobile pour agents et demandeurs tiers** : Consultation et candidature aux missions en temps réel sur mobile ; portail sécurisé pour les entreprises ou organisateurs demandeurs.

## 3. Architecture technique & Déploiement
- **Mode de déploiement** : Solution 100% Cloud multi-tenant (SaaS) hébergée sur des infrastructures cloud hautement sécurisées (AWS GovCloud / conformité CJIS).
- **Architecture applicative** : Application Web responsive développée en technologies Web modernes avec API d'intégration vers les logiciels de paie et de planification (ex. PowerTime).
- **Sécurité et intégrité** : Chiffrement des flux et des données stockées, contrôle d'accès strict, authentification multi-facteurs (MFA).

## 4. Existence et caractéristiques du client Windows
- **Client lourd dédié** : Inexistant. Pas d'application exécutable Windows à installer.
- **Accès sous Windows** : Accès direct via navigateur Web standard (Edge, Chrome) pour les coordinateurs de missions et commandants de service.
- **Application mobile native** : Applications iOS et Android pour les policiers permettant la notification push instantanée des missions disponibles, la candidature en un clic et la déclaration des heures réellement effectuées.

## 5. Disponibilité de la langue française
- **Interface utilisateur** : Exclusivement en anglais (conçu pour les départements de police américains).
- **Documentation et guides** : Guides utilisateurs, vidéos et aide en ligne exclusivement en anglais.
- **Support multilingue** : Pas de traduction officielle en français.

## 6. Conditions d'accès et documentation officielle
- **Documentation officielle** : Disponible sur le centre d'aide en ligne de PowerDetails, avec études de cas sur la réduction des risques juridiques liés aux gardes hors service.
- **Installateurs et essais** : Aucun installateur public. Démonstrations en ligne assurées par l'éditeur.
- **Modèle de licence** : Abonnement annuel ou modèle au prorata des missions gérées / pourcentage des frais de gestion administrative.

## 7. Évaluation des 10 scénarios clés de gestion policière

| # | Scénario policier | Fonctionnalité & Source | Preuve | Statut de preuve | Niveau de confiance | Limites constatées | Intérêt pour la Police Djiboutienne | Proposition d'adaptation pour le SIRH Djiboutien |
|---|-------------------|-------------------------|--------|------------------|---------------------|--------------------|--------------------------------------|--------------------------------------------------|
| 1 | Créer un agent | Création d'agent avec matricule, grade, statut actif et coordonnées bancaires pour virement | Fiche agent PowerDetails "Officer Management" | **Observé** | Élevé | Profil succinct limité aux informations nécessaires à la rémunération des missions | Simplicité de gestion des informations de paiement | Relier la fiche agent unique aux informations de paiement d'indemnités de sujétion |
| 2 | Muter un agent sans perte d'historique | Mise à jour de l'unité ou division d'appartenance avec conservation de l'historique des gains | Historique des missions et des heures déclarées par agent | **Documenté** | Élevé | Pas de suivi formel des arrêtés de nomination statutaire | Traçabilité des cumuls d'indemnités et missions antérieures | Conserver l'historique des indemnités et primes perçues lors des affectations précédentes |
| 3 | Soumettre puis valider un congé | Non pris en charge directement (gère l'indisponibilité pour mission secondaire) | Déclaration des périodes d'indisponibilité par l'agent | **Documenté** | Moyen | Ne gère pas les congés statutaires de fonction publique | Blocage des candidatures en cas de congé annuel déclaré | Bloquer automatiquement toute affectation ou astreinte si l'agent est en congé officiel |
| 4 | Refuser une demande avec motif | Refus de candidature à une mission motivé par le coordinateur (ex. quota d'heures atteint) | Message de rejet avec motif standardisé | **Observé** | Élevé | Destiné aux candidatures à des missions, non aux demandes de congés statutaires | Prévention des réclamations en cas de non-sélection pour une mission | Rendre explicite le critère de non-sélection (dépassement plafond horaire ou repos légal) |
| 5 | Remplacer un agent absent | Réassignation rapide d'une mission en cas de désistement imprévu d'un agent | Notification d'urgence d'ouverture de mission (*Broadcast Alert*) | **Observé** | Élevé | Repose sur l'acceptation volontaire rémunérée, non sur l'ordre de mission officiel | Capacité à réagir en cas d'urgence opérationnelle | Permettre la désignation hiérarchique avec alerte instantanée de l'agent remplaçant |
| 6 | Signaler qualification expirée | Vérification des compétences requises avant d'autoriser la candidature à une mission | Contrôle d'éligibilité basé sur les permis et qualifications | **Observé** | Élevé | Dépend des données renseignées dans le profil par le coordinateur | Protection juridique de l'institution en cas d'incident en service | Blocage technique absolu de toute désignation sur un poste si l'aptitude est expirée |
| 7 | Préparer un avancement | Non supporté par PowerDetails (totalement hors périmètre fonctionnel) | Absence totale de module de gestion de carrière | **Inconnu** | Faible | Spécialisé uniquement sur les missions secondaires et heures d'astreinte | Sans objet pour cet outil spécifique | Le module Carrières doit être un pilier central du SIRH global djiboutien |
| 8 | Bloquer accès hors périmètre | Rôles stricts : Agent (voit ses missions), Coordinateur (gère son district), Facturation | Matrice de droits d'accès basée sur les rôles | **Documenté** | Élevé | N'aborde pas les problématiques de discipline ou d'aptitude médicale | Cloisonnement financier et opérationnel | Isolation étanche des données de rémunération et d'évaluation |
| 9 | Identifier modification ou export | Journalisation des modifications d'attribution de mission, des heures déclarées et factures | Écran "Detailed Audit Log" de l'administrateur | **Documenté** | Élevé | Axé sur la conformité comptable et financière | Prévention de la fraude, du favoritisme et des conflits d'intérêts | Journal d'audit complet horodaté de toutes les attributions de primes et indemnités |
| 10 | Produire document & exporter dossier | Génération de factures, états récapitulatifs d'heures et exports bancaires pour virement | Moteur d'exportation de données de paie et facturation PDF | **Observé** | Élevé | Documents financiers et commerciaux, pas d'actes administratifs d'État | Exportation fiable des éléments variables de solde vers la paie publique | Export normé des éléments variables de solde vers le système de solde du Ministère des Finances |

## 8. Synthèse et enseignements pour le projet
- **Points forts à retenir** : Maîtrise absolue des algorithmes d'équité de répartition, contrôle drastique de la fatigue par cumul d'heures, automatisation du calcul des indemnités financières.
- **Limites à combler** : Spécialisation mono-fonctionnelle (missions secondaires/astreintes), absence totale de français, absence de gestion statutaire globale.
- **Adaptation requise** : Intégrer les principes d'équité d'attribution des astreintes et le calcul rigoureux des éléments variables de solde (EVS) au sein du module planning et rémunération du SIRH djiboutien.
