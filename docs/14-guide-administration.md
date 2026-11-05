# Manuel d'Administration Technique et Fonctionnelle (R7, R5 & R4)

**République de Djibouti**  
*Unité — Égalité — Paix*  
**Ministère de l'Intérieur**  
**Direction Générale de la Police Nationale (DGPN)**  
**Direction des Ressources Humaines & Division des Systèmes d'Information (DSIT)**

---

## 1. Principes Directeurs et Cloisonnement Strict des Administrations

Conformément aux exigences fondamentales de sécurité régalienne du **Requirement R5** et aux spécifications d'administration dynamique du **Requirement R4**, le Système d'Information des Ressources Humaines (SIRH) de la **Police Nationale de la République de Djibouti** instaure une **ségrégation absolue des responsabilités d'administration**.

Le système proscrit tout compte doté de tous les pouvoirs ("Super-Utilisateur" ou "Root applicatif global") et sépare hermétiquement l'autorité technique d'infrastructure de l'autorité fonctionnelle des ressources humaines :

```
┌────────────────────────────────────────────────────────────────────────────────────────────────┐
│                       SÉPARATION ABSOLUE DES POUVOIRS D'ADMINISTRATION                         │
├───────────────────────────────────────────────┬────────────────────────────────────────────────┤
│  ADMINISTRATEUR TECHNIQUE (`ADMIN_TECHNIQUE`) │ ADMINISTRATEUR FONCTIONNEL (`ADMIN_FONCT_RH`) │
├───────────────────────────────────────────────┼────────────────────────────────────────────────┤
│  • Infrastructure physique, OS et réseau      │  • Form Builder dynamique (champs no-code)     │
│  • Moteur Node.js et service Systemd          │  • Référentiels et listes de valeurs métier   │
│  • Instance PostgreSQL (Port 5433)            │  • Versioning et publication de configuration  │
│  • Sauvegardes chiffrées & restauration testée│  • Rollback sans perte de données patrimoniales│
│  • Contrôle cryptographique de l'audit SHA-256│  • Modèles d'arrêtés et documents républicains │
│  • Comptes techniques et certificats TLS 1.3  │  • Paramétrage des motifs et quotas statutaires│
├───────────────────────────────────────────────┼────────────────────────────────────────────────┤
│  ⛔ INTERDICTIONS ABSOLUES & CONTRÔLÉES :      │  ⛔ INTERDICTIONS ABSOLUES & CONTRÔLÉES :       │
│  - Interdiction de consulter les fiches RH    │  - Aucun accès au système d'exploitation       │
│  - Interdiction d'accéder à la discipline     │  - Aucun accès à la base de données PostgreSQL │
│  - Interdiction de modifier les carrières     │  - Aucun accès aux clés de chiffrement         │
│  - Interdiction de valider des congés         │  - Interdiction de modifier le code applicatif │
└───────────────────────────────────────────────┴────────────────────────────────────────────────┘
```

---

## 2. Manuel de l'Administrateur Fonctionnel RH (`ADMIN_FONCTIONNEL_RH`)

L'Administrateur Fonctionnel RH est un cadre de la Direction des Ressources Humaines habilité à faire évoluer les formulaires, référentiels et règles de gestion directement depuis la **Console d'Administration Fonctionnelle** (`https://sirh.police.dj/admin-fonctionnel.html`), sans aucune intervention technique ni redémarrage du serveur.

### 2.1. Le Générateur de Formulaires Dynamiques (Form Builder)

Le Form Builder permet d'ajouter des champs personnalisés aux entités du système (notamment les dossiers d'agents, demandes de congés et affectations territoriales).

#### Les 6 Types de Données Supportés
1. **TEXTE** : Champ de saisie alphanumérique libre (ex : `numero_badge_dgpn`, `specialite_armee`).
2. **DATE** : Sélecteur de date calendaire normé (ex : `date_obtention_brevet`, `date_derniere_visite`).
3. **NOMBRE** : Entier ou décimal avec contrôle de bornes (ex : `pointure_chaussures`, `taille_tenue_cm`).
4. **LISTE** : Menu déroulant connecté à une liste de valeurs administrable (ex : `groupe_sanguin_militaire`, `permis_conduire_categorie`).
5. **BOOLEEN** : Case à cocher binaire (ex : `habilite_conduite_blindee`, `volontaire_mission_frontaliere`).
6. **FICHIER** : Téléversement de pièces jointes justificatives numérisées (format PDF ou image, taille max 10 Mo).

#### Procédure d'Ajout d'un Champ Personnalisé
1. Accéder à l'onglet **« Champs Personnalisés »** de la console fonctionnelle.
2. Cliquer sur **[ Ajouter un Nouveau Champ ]**.
3. Renseigner les attributs statutaires :
   - **Entité Cible** : `AGENT`, `CONGE`, ou `AFFECTATION` ;
   - **Code du Champ** : Identifiant technique en minuscules sans espace (ex : `numero_passeport_service`) ;
   - **Libellé en Français Républicain** : Intitulé affiché à l'écran (ex : *« Numéro du Passeport de Service »*) ;
   - **Type de Donnée** : Sélectionner l'un des 6 types autorisés ;
   - **Ordre d'Affichage** : Position numérique relative dans le formulaire ;
   - **Caractère Obligatoire** : Case à cocher si la saisie est impérative lors de l'enregistrement.
4. Cliquer sur **[ Enregistrer le Champ dans le Schéma ]**.

#### Sanctuarisation Inviolable : Rejet Absolu des Données Médicales
Le système intègre un filtre de contrôle d'intégrité à double niveau (applicatif et base de données PostgreSQL via la contrainte `chk_champs_interdiction_medicale`) :
- Tout code ou libellé contenant des termes médicaux (ex : *maladie, pathologie, traitement, médicament, ordonnance, glycémie, tension, diagnostic, chirurgie*) est **immédiatement et automatiquement rejeté** avec l'erreur explicite :  
  `HTTP 400 Requête Invalide — Violation de l'interdiction de données médicales ou sensibles.`

---

### 2.2. Administration No-Code des Listes de Valeurs

Les menus déroulants de l'application reposent sur des listes de valeurs dynamiques modifiables sans modification de code :
- **Listes Pré-configurées** :
  - *Spécialités de Police* : Maintien de l'Ordre, Police Judiciaire, Sécurité Publique, Motocycliste, Maître-Chien, Transmissions, Renseignement Administratif Territorial ;
  - *Motifs d'Absence Exceptionnelle* : Mariage de l'agent (5 jours), Décès conjoint/ascendant (3 jours), Pèlerinage à La Mecque (autorisation spéciale) ;
  - *Catégories de Permis de Conduire Militaire et Police* : Poids léger (B), Poids lourd (C), Transport en commun (D), Engin blindé d'intervention.

#### Procédure d'Ajout d'un Élément dans une Liste
1. Accéder à l'onglet **« Listes de Référence »**.
2. Sélectionner la liste à enrichir (ex : `SPECIALITES_POLICE`).
3. Saisir le **Code Élément** (ex : `CYBER_POLICE`) et le **Libellé Officiel** (ex : *« Enquêteur en Cybercriminalité »*).
4. Cliquer sur **[ Ajouter l'Élément ]**.
5. L'élément est immédiatement disponible pour l'ensemble des postes et commissariats sans aucun délai de rafraîchissement ni redémarrage.

---

### 2.3. Gouvernance des Versions de Configuration et Rollback Instantané

Toute modification de configuration fait l'objet d'un suivi de versioning strict dans la table `versions_configuration_rh`.

#### Publication d'une Nouvelle Version de Configuration
Dès lors que l'administrateur fonctionnel a complété une série de modifications (ajout de champs, actualisation de listes) :
1. Dans l'onglet **« Versions de Schéma »**, cliquer sur **[ Publier une Nouvelle Version ]**.
2. Saisir un **Commentaire Explicatif Obligatoire** décrivant les motifs de l'évolution (ex : *« Intégration des spécialités d'intervention côtière pour les brigades d'Obock et Tadjourah »*).
3. Cliquer sur **[ Sceller et Publier la Version ]**.
4. Le système incrémente automatiquement le numéro de version (ex : de `v1.0` à `v1.1`), crée un snapshot immuable de l'état des champs et scelle l'opération dans le journal d'audit SHA-256.

#### Procédure de Retour Arrière (Rollback) sans Perte de Données
Si une version de configuration s'avère inadaptée ou source d'anomalies sur le terrain :
1. Sélectionner dans l'historique la version stable antérieure vers laquelle revenir (ex : `v1.0`).
2. Cliquer sur **[ Déclencher le Retour Arrière ]**.
3. Renseigner obligatoirement le **Motif Justificatif Régalien** de l'annulation.
4. Confirmer l'opération.

> **Principe Cardinal de Non-Destruction des Données** :  
> Le moteur de rollback rétablit immédiatement la visibilité et l'état des formulaires de la version cible. **Aucune donnée saisie par les utilisateurs sous la version annulée n'est détruite ou tronquée en base**. Les valeurs demeurent stockées dans la colonne d'archivage `valeurs_champs_dynamiques` et redeviennent consultables si la version est ultérieurement republiée.

---

## 3. Manuel de l'Administrateur Technique (`ADMIN_TECHNIQUE`)

L'Administrateur Technique est un officier ou ingénieur de la **Division des Systèmes d'Information et Télécommunications (DSIT)** responsable de la pérennité matérielle, logicielle et cryptographique de l'infrastructure.

### 3.1. Cloisonnement d'Habilitation et Sécurité Système
- L'administrateur technique n'a accès à aucune fiche nominative de policier, aucune demande de congé et aucun dossier disciplinaire.
- Toute requête HTTP dirigée vers les endpoints RH (`/api/agents/*`, `/api/conges/*`, `/api/carrieres/*`) émise sous un jeton `ADMIN_TECHNIQUE` est systématiquement rejetée par le middleware serveur avec un code `HTTP 403 Accès Interdit`.

---

### 3.2. Procédure de Sauvegarde Chiffrée et Contrôle de Somme SHA-256

La sauvegarde de la base relationnelle PostgreSQL 16 (port 5433) est exécutée de façon automatisée chaque nuit à 01h00 UTC et peut être déclenchée manuellement avant toute opération de maintenance système.

#### Déclenchement d'une Sauvegarde Manuelle
```bash
# Exécution du script de sauvegarde chiffrée sous le compte autorisé
sudo /opt/sirh-pnd/scripts/sauvegarde_quotidienne.sh
```

**Étapes exécutées par le script** :
1. Extraction du dump logique PostgreSQL au format binaire compressé :
   `pg_dump -h 127.0.0.1 -p 5433 -U sirh_app -d sirh_djibouti -F c -b -f /var/backups/sirh/sirh_AAAAMMJJ_HHMMSS.sql`
2. Calcul de l'empreinte cryptographique SHA-256 du dump :
   `sha256sum sirh_AAAAMMJJ_HHMMSS.sql > sirh_AAAAMMJJ_HHMMSS.sql.sha256`
3. Chiffrement symétrique fort AES-256-CBC avec salt PBKDF2 :
   `openssl enc -aes-256-cbc -salt -pbkdf2 -in sirh_AAAAMMJJ_HHMMSS.sql -out sirh_AAAAMMJJ_HHMMSS.sql.enc -pass file:/etc/sirh/cle_sauvegarde.key`
4. Suppression immédiate et sécurisée du dump en clair `*.sql`.

---

### 3.3. Vérification de l'Intégrité de la Chaîne d'Audit Immuable SHA-256

Le journal d'audit (`journaux_audit`) est conçu selon un principe de **chaîne de blocs interne** : chaque enregistrement contient le hash cryptographique SHA-256 de l'entrée précédente (`hash_precedent`), lié à l'horodatage UTC, l'identifiant de l'opérateur, le type d'action et les données modifiées.

#### Commande d'Interrogation de l'État de la Chaîne
L'administrateur technique et les auditeurs peuvent contrôler à tout moment l'inviolabilité du registre d'audit via l'API sécurisée :

```bash
# Interrogation via curl authentifié
curl -s -b "session_sirh=TOKEN_ADMIN_TECH" https://sirh.police.dj/api/audit/verifier-chaine | jq .
```

**Réponse en situation nominale conforme** :
```json
{
  "statut": "SUCCES",
  "intégrité_conforme": true,
  "nombre_entrees": 1428,
  "anomalies": [],
  "horodatage": "2026-11-05T10:15:00.000Z"
}
```

#### Diagnostic d'une Altération Frauduleuse de l'Audit
Si un individu malveillant tente de modifier directement une ligne d'audit en base SQL (ex : pour masquer un export illicite de données) ou de supprimer un bloc d'historique :
```json
{
  "statut": "SUCCES",
  "intégrité_conforme": false,
  "nombre_entrees": 1428,
  "anomalies": [
    {
      "sequence": 412,
      "identifiant_log": "aud-8f2c-49a1-b8d0",
      "erreur": "RUPTURE_DE_CHAINE_SHA256 : L'empreinte recalculée ne correspond pas au hash enregistré.",
      "hash_attendu": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      "hash_constate": "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08"
    }
  ],
  "horodatage": "2026-11-05T10:16:32.000Z"
}
```

**Protocole d'intervention en cas d'alerte** :
1. Déclenchement d'une alerte immédiate transmise au Directeur Général de la Police Nationale (DGPN).
2. Isolement immédiat de la base et ouverture d'une enquête forensique par l'Inspection Générale.
3. Rétablissement de la base depuis la dernière sauvegarde chiffrée certifiée.

---

## 4. Gestion des Comptes d'Accès et Politiques de Sécurité

### 4.1. Création et Attribution des Comptes Utilisateurs
L'administration des comptes de connexion (`comptes_utilisateurs`) s'effectue dans le respect des règles suivantes :
- **Identifiant Unique** : Tout compte nominatif est obligatoirement adossé au matricule national `PND-YYYY-XXXXX` du policier.
- **Attribution d'un Rôle Unique Strict** : Choix exclusif parmi les 6 profils statutaires (`admin_technique`, `admin_fonctionnel`, `gestionnaire_rh`, `chef_service`, `agent`, `auditeur`). Les comptes cumulant plusieurs rôles sont techniquement interdits.
- **Rattachement d'Unité (ABAC)** : Tout profil `chef_service` est obligatoirement lié à une `unite_id` valide, délimitant son périmètre hiérarchique descendant.

### 4.2. Politique de Mots de Passe Républicains
- Longueur minimale : 12 caractères ;
- Composition obligatoire : 1 majuscule, 1 minuscule, 1 chiffre et 1 caractère spécial (`!@#$%^&*()_+`);
- Hachage sécurisé : Algorithme `bcrypt` avec facteur de coût (cost factor) fixé à 12, garantissant l'impossibilité d'attaque par dictionnaire ;
- Blocage automatique : Après 5 tentatives infructueuses consécutives, le compte est verrouillé temporairement pour 15 minutes avec alerte inscrite dans l'audit.

---

## 5. Synthèse des Procédures d'Exploitation Récurrentes

| Fréquence | Opération d'Administration | Responsable | Vérification Associée |
| :--- | :--- | :--- | :--- |
| **Continue** | Surveillance de l'API de santé `/api/sante` | Sonde Automatique | Statut `OPERATIONNEL` et Base `CONNECTEE`. |
| **Quotidienne** | Sauvegarde chiffrée de 01h00 UTC | `ADMIN_TECHNIQUE` | Vérification de la présence du fichier `.sql.enc` et de son hash `.sha256`. |
| **Hebdomadaire** | Contrôle de la chaîne de blocs SHA-256 | `ADMIN_TECHNIQUE` & `AUDITEUR` | Exécution de `GET /api/audit/verifier-chaine` (0 rupture). |
| **Mensuelle** | Test de restauration à blanc en environnement clos | `ADMIN_TECHNIQUE` | Restauration complète d'un snapshot et succès des tests automatisés. |
| **Trimestrielle** | Revue des comptes inactifs et départs en retraite | `ADMIN_FONCT_RH` & `DRH` | Désactivation des comptes des agents radiés ou retraités. |

*Le présent manuel assure une administration pérenne, inviolable et parfaitement ordonnée au service de la Police Nationale de la République de Djibouti.*
