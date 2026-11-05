# Matrice des Habilitations et Contrôle d'Accès RBAC / ABAC (R5)

## 1. Principes Directeurs et Séparation des Pouvoirs

Le contrôle d'accès au Système d'Information des Ressources Humaines (SIRH) de la **Police Nationale de la République de Djibouti** repose sur une combinaison de deux modèles de sécurité complémentaires :
1. **RBAC (Contrôle d'Accès Fondé sur les Rôles)** : Définit les actions autorisées (créer, lire, modifier, valider, exporter) selon le profil attribué à l'utilisateur.
2. **ABAC (Contrôle d'Accès Fondé sur les Attributs et Périmètres)** : Restreint l'exécution de l'action à un périmètre organisationnel précis (l'unité d'affectation de l'opérateur et sa descendance hiérarchique directe).

### 1.1 Séparation Absolue des Pouvoirs (Ségrégation des Tâches)
Conformément à l'exigence R5, une cloison étanche sépare l'autorité technique, l'autorité fonctionnelle et les prérogatives opérationnelles :
- **L'Administrateur Technique** administre les serveurs, la base de données, les sauvegardes et les certificats réseau. **Il lui est formellement interdit de consulter ou d'altérer les données nominatives des dossiers de police ou les dossiers disciplinaires.**
- **L'Administrateur Fonctionnel RH** configure les champs personnalisés, les formulaires dynamiques et les listes de valeurs via la console dédiée. **Il n'a aucun accès aux configurations de serveurs, aux clés privées ou aux journaux d'audit système.**
- **Le Gestionnaire RH** gère administrativement les fonctionnaires de police sur l'ensemble du territoire national selon les arrêtés légaux.
- **Le Chef de Service** commande son unité (commissariat, brigade) et ne peut sous aucun prétexte consulter ou modifier les données des agents d'une autre unité.
- **L'Agent** consulte son propre dossier en libre-service sans accès aux informations de ses collègues.
- **L'Auditeur** vérifie l'intégrité et la conformité en lecture seule stricte sans aucun pouvoir de modification.

---

## 2. Fiches de Définition des 6 Profils Obligatoires

### 2.1 Profil 1 : Administrateur Technique (`ADMIN_TECHNIQUE`)
- **Finalité** : Maintien en conditions opérationnelles et sécurité de l'infrastructure informatique de la Police Nationale.
- **Périmètre d'action** : Système d'exploitation, serveur Nginx, moteur Node.js, instance PostgreSQL, sauvegardes chiffrées, gestion des certificats SSL/TLS.
- **Droits accordés** :
  - Déclenchement manuel ou planifié des sauvegardes système et tests de restauration.
  - Surveillance des performances, de la mémoire et de l'espace disque.
  - Gestion des comptes techniques de service (comptes API, tâches d'arrière-plan).
  - Consultation des journaux techniques système (erreurs serveur, logs de requêtes HTTP).
- **Interdictions formelles et absolues** :
  - Interdiction de consulter les fiches nominatives des agents de police.
  - Interdiction de consulter ou de valider des congés ou des mutations.
  - Interdiction d'accéder aux dossiers disciplinaires ou d'aptitude.
  - Interdiction d'accéder au Form Builder ou de modifier les règles métier.

---

### 2.2 Profil 2 : Administrateur Fonctionnel RH (`ADMIN_FONCTIONNEL_RH`)
- **Finalité** : Paramétrage dynamique de l'application et gouvernance du Form Builder sans intervention informatique.
- **Périmètre d'action** : Console d'administration fonctionnelle, métadonnées des formulaires, listes de valeurs, modèles de documents.
- **Droits accordés** :
  - Ajout, modification, réordonnancement et activation/désactivation de champs personnalisés (6 types : texte, date, nombre, liste, case à cocher, pièce jointe).
  - Gestion des listes de valeurs (grades, motifs d'absence, unités administratives, spécialités).
  - Validation et publication de nouvelles versions de configuration (`v1.0` -> `v1.1`).
  - Déclenchement de la procédure de retour arrière (rollback) vers une version antérieure en cas d'anomalie.
  - Paramétrage des seuils réglementaires (plafonds de congés, repos minimal de 11h).
- **Interdictions formelles et absolues** :
  - Interdiction de modifier le code source de l'application ou les tables système.
  - Interdiction de modifier les droits des utilisateurs ou d'élever ses propres privilèges.
  - Interdiction d'accéder aux dossiers disciplinaires.

---

### 2.3 Profil 3 : Gestionnaire RH National (`GESTIONNAIRE_RH`)
- **Finalité** : Gestion administrative centrale des effectifs de la Police Nationale à la Direction Générale.
- **Périmètre d'action** : Ensemble des effectifs actifs et civils de la Police Djiboutienne sur tout le territoire national.
- **Droits accordés** :
  - Création et mise à jour des dossiers administratifs d'agents (avec attribution du matricule unique).
  - Saisie et enregistrement des mutations et arrêtés d'affectation avec conservation intégrale de l'historique.
  - Arbitrage et validation finale des demandes de congés et d'absences après accord du chef de service.
  - Suivi des avancements d'échelons et préparation des tableaux de promotion de grade.
  - Enregistrement des stages et suivi des qualifications opérationnelles (tir réglementaire, habilitation OPJ).
  - Saisie des primes et indemnités mensuelles et génération des exports officiels vers le Trésor national.
  - Génération des attestations administratives officielles et arrêtés au format PDF.
- **Interdictions formelles** :
  - Interdiction de modifier la structure des formulaires ou les listes de valeurs.
  - Interdiction d'accéder aux dossiers disciplinaires sans habilitation spéciale émise par le Directeur Général.

---

### 2.4 Profil 4 : Chef de Service / Commandant de Brigade (`CHEF_DE_SERVICE`)
- **Finalité** : Commandement opérationnel et encadrement direct des effectifs d'un commissariat ou d'une unité spécialisée.
- **Périmètre d'action** : Exclusivement limité à son unité d'affectation et aux sous-unités directes (filtrage territorial strict).
- **Droits accordés** :
  - Consultation des dossiers administratifs des agents placés sous ses ordres directs.
  - Validation ou refus motivé obligatoire (N+1) des demandes de congés de ses subordonnés, avec contrôle visuel de l'effectif minimum de sécurité.
  - Gestion du tableau de service prévisionnel de son unité (vacations, permanences, astreintes).
  - Signalement des absences inopinées et proposition de remplaçants qualifiés ayant respecté le repos légal de 11h.
  - Consultation des alertes d'expiration des qualifications opérationnelles de ses effectifs (tir, port d'arme).
  - Évaluation annuelle de premier niveau des agents de son unité.
- **Interdictions formelles et absolues** :
  - **Interdiction formelle de consulter un agent hors de son unité d'affectation.**
  - Interdiction de valider définitivement une mutation ou une promotion (prérogative du Ministère / DGPN).
  - Interdiction d'accéder aux éléments de solde globaux ou aux dossiers disciplinaires d'autres unités.

---

### 2.5 Profil 5 : Agent de Police (`AGENT`)
- **Finalité** : Portail individuel en libre-service (*Self-Service* policier).
- **Périmètre d'action** : Strictement circonscrit à son propre dossier individuel (`agent_id == session.agent_id`).
- **Droits accordés** :
  - Consultation de son dossier administratif, de son état civil et de son historique d'affectations.
  - Consultation en temps réel de ses compteurs de congés (jours acquis, jours pris, jours restants).
  - Soumission d'une demande de congé avec téléversement de justificatif légal (certificat de mariage, etc.).
  - Suivi en temps réel de l'état d'avancement de ses demandes (Soumis, Accord Chef, Validé RH, Rejeté).
  - Consultation de son planning de service individuel et de ses dates de vacations.
  - Consultation de la date de validité de ses qualifications et convocations aux sessions de tir.
  - Téléchargement de son relevé individuel de carrière ou d'attestation de présence.
- **Interdictions formelles et absolues** :
  - Interdiction totale de visualiser la moindre donnée relative à un autre agent.
  - Interdiction de modifier unilatéralement ses coordonnées administratives statutaires.

---

### 2.6 Profil 6 : Auditeur / Inspecteur Général (`AUDITEUR`)
- **Finalité** : Contrôle de conformité légale, inspection générale des services et traçabilité des opérations sensibles.
- **Périmètre d'action** : Lecture seule transversale sur l'ensemble du système et des journaux d'audit.
- **Droits accordés** :
  - Consultation intégrale du journal d'audit immuable avec recherche multi-critères (par date, par opérateur, par type d'action).
  - Vérification de l'intégrité cryptographique de la chaîne SHA-256 du journal d'audit.
  - Consultation du registre des exports de données et des sommes de contrôle de fichiers.
  - Consultation en lecture seule des dossiers agents et historiques d'affectation dans le cadre d'une mission d'inspection.
- **Interdictions formelles et absolues** :
  - **Incapacité absolue de créer, modifier ou supprimer la moindre donnée dans le système.**
  - Interdiction d'accéder aux dossiers disciplinaires sans ordre de mission spécifique signé de l'autorité supérieure.

---

## 3. Matrice Croisée Complète des Droits (Rôles × Ressources × Actions)

| Domaine / Ressource Applicative | Action Spécifique | Admin Technique | Admin Fonct. RH | Gestionnaire RH | Chef de Service | Agent (Soi-même) | Auditeur |
|---|---|:---:|:---:|:---:|:---:|:---:|:---:|
| **Infrastructure & Serveurs** | Sauvegarder / Restaurer | **OUI** | NON | NON | NON | NON | NON |
| **Comptes Techniques Système** | Créer / Révoquer | **OUI** | NON | NON | NON | NON | NON |
| **Form Builder : Métadonnées** | Ajouter / Modifier champs | NON | **OUI** | NON | NON | NON | Lecture |
| **Form Builder : Versioning** | Publier / Rollback | NON | **OUI** | NON | NON | NON | Lecture |
| **Listes de Valeurs** | Éditer nomenclatures | NON | **OUI** | NON | NON | NON | Lecture |
| **Organisation : Unités** | Créer / Modifier structure | NON | **OUI** | Lecture | Lecture | NON | Lecture |
| **Dossier Agent : Création** | Créer fiche + matricule | NON | NON | **OUI (Global)**| NON | NON | NON |
| **Dossier Agent : Consultation** | Consulter fiche complète | NON | NON | **OUI (Global)**| **OUI (Unité)**| **OUI (Soi)** | **OUI (Lecture)**|
| **Affectations & Mutations** | Enregistrer mutation | NON | NON | **OUI (Global)**| NON | NON | NON |
| **Affectations : Historique** | Consulter antériorité | NON | NON | **OUI (Global)**| **OUI (Unité)**| **OUI (Soi)** | **OUI (Lecture)**|
| **Congés : Demande** | Soumettre pour soi | NON | NON | OUI (Soi) | OUI (Soi) | **OUI (Soi)** | NON |
| **Congés : Validation N+1** | Avis Chef avec motif | NON | NON | NON | **OUI (Subordonnés uniquement - Auto-approbation STRICTEMENT INTERDITE)**| NON | NON |
| **Congés : Validation Finale**| Arbitrer et valider RH | NON | NON | **OUI (Global)**| NON | NON | NON |
| **Carrières & Échelons** | Saisir avancement échelon| NON | NON | **OUI (Global)**| NON | NON | Lecture |
| **Promotions de Grade** | Établir tableau avancement| NON | NON | **OUI (Global)**| Proposer avis | NON | Lecture |
| **Qualifications Policières** | Valider stage / Tir ENP | NON | NON | **OUI (Global)**| Suivre unité | Suivre soi | Lecture |
| **Planning & Brigades** | Établir tableau de garde | NON | NON | NON | **OUI (Unité)**| Consulter soi | NON |
| **Remplacement Inopiné** | Désigner remplaçant | NON | NON | NON | **OUI (Unité)**| NON | NON |
| **Éléments de Solde** | Saisir primes et nuits | NON | NON | **OUI (Global)**| Saisir unité | NON | Lecture |
| **Exports Solde Trésor** | Générer fichier sécurisé | NON | NON | **OUI (Global)**| NON | NON | Traçabilité |
| **Dossier Disciplinaire** | Instruire et enregistrer | NON | NON | Habilitation SP| NON | NON | Habilitation SP |
| **Aptitude Administrative** | Enregistrer avis apte/inapte| NON | NON | **OUI (Global)**| Consulter avis| Consulter avis| Lecture |
| **Journal d'Audit SHA-256** | Consulter et vérifier | Logs système | Logs config | NON | NON | NON | **OUI (Global)**|
| **Journal d'Audit SHA-256** | Altérer ou purger | **INTERDIT** | **INTERDIT** | **INTERDIT** | **INTERDIT** | **INTERDIT** | **INTERDIT** |

---

## 4. Politique d'Isolation Territoriale et Filtrage ABAC Côté Serveur

### 4.1 Règle d'Étanchéité Inter-Unités
Un principe cardinal du SIRH policier est l'étanchéité territoriale stricte :
- Un commissaire du 1er Arrondissement de Djibouti ne peut sous aucun prétexte consulter la fiche d'un policier affecté au 3ème Arrondissement ou à la brigade de Dikhil.
- Une tentative d'accès via l'interface est masquée (les listes ne présentent que les subordonnés légitimes).
- Une tentative d'accès direct par injection d'URL ou appel direct de l'API REST (`GET /api/agents/:id`) est **interceptée côté serveur** et sanctionnée par :
  1. Rejet immédiat de la requête avec le code statut **HTTP 403 Accès Interdit**.
  2. Enregistrement instantané d'une alerte de sécurité dans `journaux_audit` avec mention de l'auteur, de l'adresse IP et de la ressource visée.

### 4.2 Algorithme de Résolution Hiérarchique Côté Serveur
Chaque requête d'un Chef de Service est soumise à un contrôle de périmètre par l'algorithme suivant :

```typescript
// Algorithme de filtrage récursif de périmètre unité
function verifierAccesUnite(utilisateur: SessionUtilisateur, agentCible: Agent): boolean {
  // 1. Les gestionnaires RH et auditeurs ont un périmètre national
  if (utilisateur.role === 'gestionnaire_rh' || utilisateur.role === 'auditeur') {
    return true;
  }
  
  // 2. L'agent ne peut accéder qu'à son propre dossier
  if (utilisateur.role === 'agent') {
    return utilisateur.agent_id === agentCible.id;
  }
  
  // 3. Le Chef de Service ne peut accéder qu'aux agents de son arborescence
  if (utilisateur.role === 'chef_service') {
    // Liste des identifiants d'unités sous l'autorité du chef (unité directe + sous-unités)
    const unitesAutorisees = recupererSousArborescenceUnite(utilisateur.unite_id);
    return unitesAutorisees.includes(agentCible.unite_actuelle_id);
  }
  
  return false;
}
```

### 4.3 Règle Formelle d'Anti-Auto-Approbation des Demandes de Congés
Dans l'organisation de la Police Nationale, aucun fonctionnaire, quel que soit son grade ou son niveau de responsabilité opérationnelle (y compris commissaire, commandant de brigade ou chef de division), ne peut approuver ses propres congés, absences ou autorisations de service.

L'algorithme de contrôle côté serveur applique la règle impérative suivante :

```typescript
// Algorithme ABAC de validation des demandes de congés avec anti-auto-approbation obligatoire
interface ResultatControleABAC {
  autorise: boolean;
  codeStatutHttp: number;
  motifRejet?: string;
}

function verifierAutorisationValidationConge(
  utilisateur: SessionUtilisateur,
  agentDemandeur: Agent,
  demandeConge: DemandeConge
): ResultatControleABAC {
  // RÈGLE D'OR RÉGALIENNE : ANTI-AUTO-APPROBATION STRICTEMENT VERROUILLÉE
  // Un chef ne peut en aucun cas être son propre approbateur
  if (agentDemandeur.id === utilisateur.agent_id) {
    return {
      autorise: false,
      codeStatutHttp: 403,
      motifRejet: "VIOLATION HIÉRARCHIQUE : Auto-approbation formellement interdite. En tant que chef de service, votre demande de congé doit obligatoirement être soumise à l'approbation de votre supérieur hiérarchique direct (N+2, Directeur de Division ou Directeur Général) ou transmise directement à la Direction des Ressources Humaines."
    };
  }

  // 1. Le Gestionnaire RH national détient l'autorité d'arbitrage et de validation finale
  if (utilisateur.role === 'gestionnaire_rh') {
    return { autorise: true, codeStatutHttp: 200 };
  }

  // 2. Le Chef de Service ne peut valider QUE les agents placés sous son autorité directe
  if (utilisateur.role === 'chef_service') {
    const sousArborescenceUnites = recupererSousArborescenceUnite(utilisateur.unite_id);
    
    // Vérification de la présence de l'agent dans l'arborescence territoriale
    if (!sousArborescenceUnites.includes(agentDemandeur.unite_actuelle_id)) {
      return {
        autorise: false,
        codeStatutHttp: 403,
        motifRejet: "ACCÈS INTERDIT : L'agent demandeur n'appartient pas à l'arborescence d'unités sous votre commandement."
      };
    }

    return { autorise: true, codeStatutHttp: 200 };
  }

  // Tout autre rôle est expressément refoulé
  return {
    autorise: false,
    codeStatutHttp: 403,
    motifRejet: "ACCÈS INTERDIT : Votre rôle ne vous autorise pas à instruire des demandes de congés."
  };
}
```

---

## 5. Cloisonnement Hermétique des Dossiers Sensibles

### 5.1 Cloisonnement Disciplinaire
- Les procédures disciplinaires sont stockées dans la table dédiée `dossiers_disciplinaires`.
- Elles ne sont **JAMAIS exposées** dans les endpoints d'API généraux de gestion des dossiers agents.
- Seul un utilisateur détenant expressément l'habilitation `DROIT_DISCIPLINE_CONSULTER` (attribuée nominativement par le Directeur Général de la Police Nationale) peut accéder aux routes correspondantes (`/api/discipline/*`).
- Les trois phases de la procédure (Allégation, Instruction d'enquête interne, Sanction prononcée) font l'objet d'un suivi étanche.

### 5.2 Protection Absolue du Secret Médical (Aptitude Administrative)
- Conformément à la déontologie médicale et aux exigences impératives des Requirements **R3** et **R5**, le SIRH ne stocke **aucune donnée médicale, diagnostic, pathologie ou secret de santé**.
- **Nomenclature Fermée Obligatoire** : Les conclusions administratives d'aptitude sont strictement bornées à des énumérations fermées (`APTE_SANS_RESTRICTION`, `APTE_AVEC_RESTRICTIONS`, `INAPTE_TEMPORAIRE`, `INAPTE_DEFINITIF`) associées à des restrictions opérationnelles normalisées :
  - `AUCUNE_RESTRICTION`
  - `DISPENSE_PORT_ARME`
  - `POSTE_SEDENTAIRE`
  - `EXEMPTION_PATROUILLE_NOCTURNE`
  - `EXEMPTION_EFFORT_INTENSE`
  - `INAPTE_CONDUITE_VEHICULE_URGENCE`
  - `INAPTE_TERRAIN_OPERATIONNEL`
  - `AMENAGEMENT_POSTE_INTERIEUR`
- **Suppression Absolue des Zones Textuelles Libres** : Tout champ de type texte libre non filtré a été banni de la table `aptitudes_administratives`. Le numéro d'archive scellé (`reference_certificat_scelle`) renvoie exclusivement au dossier physique conservé sous clé par le service de santé des armées.
- **Liste Noire Sémantique dans le Form Builder** : Le générateur de formulaires bloque systématiquement la création de champs relatifs à la santé, aux maladies, aux traitements ou au groupe sanguin.

