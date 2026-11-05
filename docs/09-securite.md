# Politique de Sécurité du Système, Cloisonnement et Audit Immuable (R5)

## 1. Engagements de Sécurité et Cadre Règlementaire Souverain

Le présent document formalise la politique de sécurité des systèmes d'information applicable au Système d'Information des Ressources Humaines (SIRH) de la **Police Nationale de la République de Djibouti**, conformément aux dispositions impératives du **Requirement R5**.

En tant que système régalien traitant des carrières, affectations, qualifications d'armement et plannings opérationnels des forces de police, le SIRH est soumis à des règles de sécurité de niveau étatique :
1. **Intégrité Territoriale et Souveraineté** : Les données sont hébergées exclusivement sur les infrastructures centrales de l'État djiboutien, sans externalisation sur des plateformes cloud publiques étrangères.
2. **Confidentialité et Cloisonnement de Sécurité** : Étanchéité absolue entre les unités de police, entre les dossiers ordinaires et les dossiers sensibles (discipline, aptitude), et entre les fonctions d'administration technique et de gestion fonctionnelle RH.
3. **Traçabilité Forensique et Immuabilité** : Aucune transaction sensible, consultation de dossier ou exportation de données ne peut s'effectuer sans être enregistrée dans un journal d'audit protégé par chaînage cryptographique.
4. **Disponibilité Opérationnelle et Résilience** : Procédures de sauvegarde chiffrée automatisée et reprise après sinistre validées par des tests réguliers.
5. **Intégrité Linguistique et Républicaine** : 100% des interfaces, messages d'erreur, codes de diagnostic et documents officiels sont nativement et exclusivement rédigés en langue française.

---

## 2. Exigence Fondamentale : Système 100% en Français

Conformément au mandat de l'Approved Task Prompt, aucune trace de langue étrangère ou d'anglicisme technique n'est tolérée dans l'expérience utilisateur ou l'administration :
- **Interfaces et Menus** : Tous les onglets, boutons, menus déroulants, tableaux, en-têtes et textes explicatifs sont rédigés en français normé.
- **Messages Système et Diagnostics HTTP** :
  - En cas d'erreur de saisie : `HTTP 400 Requête Invalide — Le champ [Matricule] est obligatoire.`
  - En cas de défaut d'authentification : `HTTP 401 Non Authentifié — Session expirée ou jeton manquant.`
  - En cas d'accès non autorisé : `HTTP 403 Accès Interdit — Vous n'avez pas l'autorisation d'accéder à ce dossier.`
  - En cas d'entité introuvable : `HTTP 404 Ressource Introuvable — L'agent demandé n'existe pas.`
  - En cas de conflit de validation : `HTTP 409 Conflit de Données — La vacation sélectionnée chevauche une garde existante.`
  - En cas d'erreur métier : `HTTP 422 Entité Non Traitable — Solde de congés insuffisant.`
- **Documents Officiels Générés** : Les arrêtés ministériels de mutation, décisions de congés, fiches d'évaluation et états récapitulatifs pour le Trésor sont générés selon les modèles républicains de la République de Djibouti en langue française.

---

## 3. Contrôles d'Accès Côté Serveur Inviolables (Zero-Trust Interne)

L'architecture applique le principe du *Zero-Trust* : aucun appel réseau n'est considéré comme légitime a priori, même en provenance du réseau intranet interne.

### 3.1 Triple Contrôle Côté Serveur
Chaque requête HTTP adressée à l'API applicative traverse une chaîne de vérification séquentielle stricte exécutée exclusivement côté serveur :

```
Requête HTTP Entrante
       │
       ▼
[ 1. Contrôle d'Authentification ] ──── Échec ───> HTTP 401 Non Authentifié
       │ Succès (Session valide, Cookie HttpOnly Secure)
       ▼
[ 2. Contrôle de Rôle (RBAC) ]     ──── Échec ───> HTTP 403 Accès Interdit (Rôle insuffisant)
       │ Succès (Permission valide pour la ressource)
       ▼
[ 3. Contrôle de Périmètre (ABAC) ] ─── Échec ───> HTTP 403 Accès Interdit (Hors Unité)
       │                                            + Enregistrement Alerte dans l'Audit
       ▼
Exécution du Service Métier
       │
       ▼
[ 4. Enregistrement Transactionnel dans le Journal d'Audit SHA-256 ]
```

### 3.2 Interdiction Absolue d'Élévation de Privilèges
- Il est techniquement impossible pour un utilisateur de modifier son propre rôle ou d'étendre son périmètre d'habilitation via l'interface ou par manipulation de payload JSON.
- Les sessions utilisateur sont scellées et signées cryptographiquement par le serveur. Toute tentative de falsification de jeton invalide instantanément la session.
- La modification d'un rôle d'utilisateur nécessite une action délibérée de l'Administrateur Technique, obligatoirement tracée dans le journal d'audit.

---

## 4. Cloisonnement Hermétique des Données Sensibles

### 4.1 Dossiers Disciplinaires (Cloisonnement et Phases Réglementaires)
Les dossiers disciplinaires constituent des données hautement sensibles dont la divulgation porterait atteinte à la présomption d'innocence et au bon fonctionnement des services.
- **Isolement Physique et Logique** : Table dédiée `dossiers_disciplinaires` inaccessible aux requêtes générales du personnel.
- **Séparation Stricte des 3 Phases Réglementaires** :
  1. *Allégation* : Signalement initial faisant l'objet d'un examen préliminaire confidentiel.
  2. *Instruction / Enquête Interne* : Procédure confiée à un officier instructeur désigné.
  3. *Décision / Sanction* : Décision prononcée par la Commission de discipline ou le Directeur Général.
- **Accès Réservé et Traçabilité Renforcée** : L'accès est strictement restreint aux officiers détenteurs d'une habilitation nominative émise par le Directeur Général. Chaque consultation, même en simple lecture, génère une entrée d'audit prioritaire.

### 4.2 Aptitude Administrative et Secret Médical Absolu
Conformément aux lois protégeant le secret médical et aux exigences impératives des Requirements **R3** et **R5** :
- **Exclusion Totale des Données Médicales** : La base de données ne contient aucun champ relatif à des diagnostics, pathologies, traitements, ordonnances ou dossiers médicaux.
- **Nomenclature Administrative Fermée Stricte** :
  Toute zone de texte libre a été proscrite de la table `aptitudes_administratives`. Le système enregistre exclusivement la décision administrative émise par le service de santé des forces de défense et de sécurité :
  1. *Conclusion Administrative* (`type_conclusion`) :
     - `APTE_SANS_RESTRICTION` : Service général actif, port d'arme de dotation autorisé.
     - `APTE_AVEC_RESTRICTIONS` : Restrictions administratives et opérationnelles prédéfinies.
     - `INAPTE_TEMPORAIRE` : Suspension temporaire d'activité opérationnelle.
     - `INAPTE_DEFINITIF` : Procédure de reclassement civil ou de réforme.
  2. *Code de Restriction Normalisé* (`code_restriction`) :
     - `AUCUNE_RESTRICTION` : Aucune limitation d'emploi.
     - `DISPENSE_PORT_ARME` : Interdiction temporaire ou définitive du port d'arme de service.
     - `POSTE_SEDENTAIRE` : Affectation exclusive en brigade sédentaire ou bureau.
     - `EXEMPTION_PATROUILLE_NOCTURNE` : Inaptitude au service de nuit.
     - `EXEMPTION_EFFORT_INTENSE` : Exemption de maintien de l'ordre ou intervention lourde.
     - `INAPTE_CONDUITE_VEHICULE_URGENCE` : Suspension de conduite rapide en intervention.
     - `INAPTE_TERRAIN_OPERATIONNEL` : Tâches logistiques ou administratives uniquement.
     - `AMENAGEMENT_POSTE_INTERIEUR` : Aménagement ergonomique de poste intérieur.
- **Suppression Totale des Commentaires Libres** :
  Le champ de commentaire libre RH a été purement et simplement supprimé pour éliminer tout risque de fuite textuelle de diagnostics. Seul l'identifiant du certificat scellé (`reference_certificat_scelle`) est conservé, permettant aux officiers de santé de retrouver le dossier physique sous coffre-fort médical militaire sans exposition dans le SIRH.
- **Liste Noire de Mots-Clés Médicaux dans le Form Builder (DLP)** :
  Le moteur de formulaires dynamiques intègre un filtre de prévention des fuites de données (*Data Loss Prevention* / DLP) qui interdit formellement à tout Administrateur Fonctionnel de créer un champ personnalisé dont le code ou le libellé contient des termes ou racines liés à la santé (`sante`, `medical`, `medecin`, `maladie`, `pathologie`, `traitement`, `hopital`, `clinique`, `diagnostic`, `vih`, `sida`, `diabete`, `psychiatrie`, `psy`, `infirmit`, `ordonnance`, `posologie`, `sang`, `groupe_sanguin`, `handicap`, `grossesse`). Toute tentative est bloquée avec le code **HTTP 422 Entité Non Traitable** et tracée dans le journal d'audit.

---

## 5. Ségrégation Stricte des Rôles Techniques et Fonctionnels

Pour prévenir les risques de malveillance ou d'abus de pouvoir :
- **Administrateur Technique** :
  - Il détient les accès système (SSH, base de données, sauvegardes, Nginx).
  - Il n'a aucun accès aux écrans de consultation des agents, ni aux dossiers administratifs.
  - Tout accès direct à la base de données de production en ligne de commande fait l'objet d'une journalisation système externe inaltérable.
- **Administrateur Fonctionnel RH** :
  - Il gère le Form Builder et les listes de valeurs.
  - Il n'a aucun mot de passe d'infrastructure ni accès aux serveurs physiques.
- **Accès d'Urgence Exceptionnels (Compte Brise-Glace / *Break-Glass*)** :
  - L'activation d'un accès technique de secours lors d'un incident critique nécessite la saisie conjointe de deux clés de sécurité (double contrôle DGPN + DSI) et déclenche une alerte sonore et un enregistrement d'audit prioritaire.

---

## 6. Architecture Cryptographique et Gestion des Secrets

### 6.1 Chiffrement des Communications (En Transit)
- **Protocole Imposé** : HTTPS exclusivement, basé sur **TLS 1.3** (avec TLS 1.2 durci en secours pour matériels anciens certifiés).
- **Suites Cryptographiques Autorisées** :
  - `TLS_AES_256_GCM_SHA384`
  - `TLS_CHACHA20_POLY1305_SHA256`
  - `ECDHE-RSA-AES256-GCM-SHA384`
- **En-têtes HTTP de Sécurité Obligatoires** configurés sur le reverse proxy Nginx :
  ```nginx
  add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
  add_header X-Content-Type-Options "nosniff" always;
  add_header X-Frame-Options "DENY" always;
  add_header X-XSS-Protection "1; mode=block" always;
  add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self';" always;
  add_header Referrer-Policy "strict-origin-when-cross-origin" always;
  ```

### 6.2 Protection des Mots de Passe, Sessions et Résilience WAN
- **Hachage des Mots de Passe en Argon2id** :
  - Fonction cryptographique mémoire-dure **Argon2id** (standard RFC 9106) avec paramètres durcis : coût mémoire $m = 65536$ Ko (64 Mo), coût temporel $t = 3$ itérations, parallélisme $p = 4$, et sel cryptographique aléatoire unique de 16 octets généré par `crypto.randomBytes()`.
  - Résistance absolue aux attaques par dictionnaires et aux accélérateurs matériels GPU/ASIC.
- **Politique de Sécurité des Comptes et Verrouillage après 5 Échecs** :
  - Longueur minimale de 12 caractères, comprenant majuscules, minuscules, chiffres et caractères spéciaux.
  - Table `comptes_utilisateurs` avec compteur `tentatives_echouees` incrémenté à chaque mot de passe erroné.
  - Dès la 5ème tentative consécutive infructueuse, le compte est automatiquement verrouillé (`bloque_jusqu_a = CURRENT_TIMESTAMP + INTERVAL '30 minutes'`). Seul un administrateur peut procéder à un déblocage anticipé consigné dans l'audit.
- **Sécurisation des Sessions et Résilience WAN des Commissariats** :
  - Jeton de session aléatoire de 256 bits généré cryptographiquement et stocké sous forme d'empreinte SHA-256 dans la table `sessions_actives`.
  - Cookie de transport marqué `HttpOnly`, `Secure`, et `SameSite=Strict`.
  - Expiration de session après 15 minutes d'inactivité.
  - **Tolérance aux Bascules de Routeurs Secours 4G LTE** : Pour éviter les déconnexions intempestives des officiers en poste dans les régions de l'Intérieur lors des basculements de ligne télécom, le système tolère les variations d'adresse IP au sein du même sous-réseau `/24` de la Police Nationale ou opère un renouvellement transparent par jeton asymétrique Ed25519 sans perte de session.

### 6.3 Gestion des Secrets Hors du Code Source
- **Zéro Secret dans les Sources** : Aucune clé privée, mot de passe de base de données, clé d'API ou graine de chiffrement n'est présente dans les dépôts de code source ou les scripts de build.
- **Injection par Environnement Sécurisé** : Tous les secrets sont injectés au démarrage du service via des variables d'environnement lues depuis un fichier de configuration protégé `.env.production`, dont les droits d'accès système sont strictement restreints au compte d'exécution de l'application (`chmod 600`, propriétaire `rh-app:rh-group`).

---

## 7. Journal d'Audit Immuable et Chaîné SHA-256 (Anti-Falsification)

Le Requirement R5 impose un journal d'audit dont l'intégrité est mathématiquement protégée contre toute falsification, y compris par un administrateur ayant un accès direct à la base de données.

### 7.1 Architecture Append-Only et Trigger d'Immuabilité PostgreSQL
- La table `journaux_audit` est protégée contre toute modification ou suppression :
  - Les commandes SQL `UPDATE`, `DELETE`, `TRUNCATE` et `DROP` sont formellement révoquées au niveau des privilèges SQL du rôle de connexion applicatif.
  - Le trigger de base de données PostgreSQL `tg_audit_immuable` intercepte tout événement `BEFORE UPDATE OR DELETE` sur la table `journaux_audit` et lève inconditionnellement une exception SQL (`RAISE EXCEPTION 'VIOLATION SECURITE : Le journal d audit est strictement immuable.'`), rendant toute tentative d'altération techniquement impossible.

### 7.2 Algorithme de Chaînage Cryptographique (Blockchain Interne)
Chaque enregistrement d'audit calcule son empreinte numérique en intégrant l'empreinte de l'enregistrement précédent, formant une chaîne inaltérable :

$$\text{EmpreinteCourante}_n = \text{SHA256}\Big(\text{id}_n \parallel \text{horodatage}_n \parallel \text{utilisateur}_n \parallel \text{action}_n \parallel \text{entite}_n \parallel \text{details\_json}_n \parallel \text{EmpreintePrecedente}_{n-1}\Big)$$

```
┌─────────────────────────────────┐       ┌─────────────────────────────────┐
│        Ligne d'Audit N-1        │       │         Ligne d'Audit N         │
│                                 │       │                                 │
│ id: 1042                        │       │ id: 1043                        │
│ action: 'MUTATION'              │       │ action: 'VALIDATION_CONGE'      │
│ utilisateur: 'gestionnaire_rh'  │       │ utilisateur: 'chef_service'    │
│ ...                             │       │ ...                             │
│ empreinte_courante:             │──────>│ empreinte_precedente:           │
│   '7f8b9...c31e'                │       │   '7f8b9...c31e'                │
│                                 │       │ empreinte_courante:             │
│                                 │       │   'a24d1...f890'                │
└─────────────────────────────────┘       └────────────────┬────────────────┘
                                                           │
                                                           ▼ (Vers Ligne N+1)
```

### 7.3 Détection Immédiate de Falsification
Un service de contrôle d'intégrité vérifie périodiquement la cohérence de l'ensemble de la chaîne :
- Si un attaquant modifie un champ dans une ligne passée, son empreinte recalculée ne correspond plus à l'empreinte stockée.
- S'il recalcule l'empreinte de la ligne modifiée, l'empreinte précédente de la ligne suivante devient invalide.
- **Toute falsification brise la chaîne mathématique et déclenche immédiatement une alerte de sécurité critique.**

### 7.4 Traçabilité Systématique des Opérations Sensibles
Font l'objet d'un enregistrement d'audit systématique et détaillé :
1. Chaque connexion et déconnexion d'utilisateur (succès ou échec avec IP et motif).
2. Chaque création d'agent, mutation territoriale ou promotion de grade.
3. Chaque soumission, validation N+1, validation RH ou refus motivé de congé.
4. Chaque consultation d'un dossier disciplinaire ou d'aptitude médicale administrative.
5. Chaque export de données (fichiers de solde, listes d'agents, états PDF) avec calcul du hash SHA-256 du fichier produit.
6. Chaque modification de paramétrage Form Builder, publication de version ou opération de rollback.

---

## 8. Sauvegardes, Restauration et Reprise d'Activité (PRA / PCA)

### 8.1 Politique de Sauvegarde Automatisée
- **Sauvegarde Quotidienne Complète** : Export complet de la base de données PostgreSQL chaque nuit à 02h00 via `pg_dump`.
- **Archivage Continu des Journaux de Transactions (WAL)** : Permet une restauration à la seconde près en cas de sinistre (*Point-in-Time Recovery*).
- **Chiffrement Asymétrique des Fichiers de Sauvegarde** : Les fichiers d'archive sont compressés puis chiffrés à la volée avec une clé publique GPG / AES-256 avant stockage. La clé privée de déchiffrement est conservée hors site dans un coffre-fort sécurisé sous la responsabilité du Directeur Général.
- **Rétention des Sauvegardes** : 30 jours de sauvegardes quotidiennes, 12 sauvegardes mensuelles, 10 sauvegardes annuelles.

### 8.2 Procédure de Restauration Testée et Validée
Toute procédure de sauvegarde sans test de restauration est considérée comme inexistante :
1. Un test de restauration automatisé est exécuté chaque semaine dans un environnement de bac à sable isolé.
2. Le script vérifie l'intégrité de la restauration en contrôlant :
   - Le checksum SHA-256 de l'archive chiffrée.
   - Le montage réussi de l'instance PostgreSQL temporaire.
   - La cohérence de la chaîne cryptographique du journal d'audit.
   - Le nombre d'enregistrements des tables maîtresses (`agents`, `affectations`).

---

## 9. Données Fictives et Environnement de Développement

Conformément à la clause de déontologie de l'Approved Task Prompt :
- **Interdiction Formelle de Données Réelles en Développement** : Aucune donnée nominative réelle, aucun matricule réel, aucune identité d'officier de la Police Djiboutienne n'est injectée dans les bases de données de développement, de test ou de recette.
- **Génération de Données Synthétiques Réalistes** :
  - Les fixtures de tests sont constituées de jeux de données fictifs générés par programme.
  - Les patronymes, prénoms et localisations respectent la sociologie et la géographie djiboutiennes (ex: patronymes *Hassan*, *Mohamed*, *Farah*, *Barkhad*, *Ali* ; unités *Commissariat Central*, *Brigade Port*, *Poste Frontière Loyada*, *Commissariat Dikhil*), tout en étant certifiés 100% synthétiques.
