# Architecture Intranet Centralisée et Moteur Dynamique (R5 & R4)

## 1. Contexte, Enjeux et Principes Directeurs

Le présent document définit l'architecture logicielle, matérielle et réseau du Système d'Information des Ressources Humaines (SIRH) réservé à la **Police Nationale de la République de Djibouti**, conformément aux exigences **R4** et **R5** du cahier des charges.

Le système a pour finalité d'assurer une gestion administrative moderne, rigoureuse et pérenne de l'ensemble des personnels actifs et civils de la Police Nationale, sur tout le territoire djiboutien (District de Djibouti, Commissariats d'Arrondissement, Régions de l'Intérieur : Ali-Sabieh, Dikhil, Tadjourah, Obock, Arta).

### 1.1 Principes Directeurs Incontournables
1. **Centralisation Totale et Souveraineté des Données** :
   Toutes les données résident sur une infrastructure centrale sécurisée sous contrôle exclusif de la Police Nationale.
2. **Zéro Base de Données Locale sur les Postes Clients** :
   Conformément au mandat R5, aucun poste client de travail ne dispose d'une base de données locale autonome (interdiction formelle de fichiers SQLite locaux, bases Access ou réplications décentralisées par poste).
3. **Séparation Stricte des Pouvoirs** :
   - L'**Administrateur Technique** administre le système, le réseau, les sauvegardes et la sécurité globale, sans jamais accéder au contenu des dossiers nominatifs RH.
   - L'**Administrateur Fonctionnel RH** administre les formulaires dynamiques, les champs personnalisés et les listes de valeurs, sans toucher au code ni à l'infrastructure.
   - Les **Utilisateurs Métier** (Gestionnaires RH, Chefs de service, Agents, Auditeurs) agissent strictement dans la limite de leurs attributions et de leur périmètre territorial.
4. **Intégrité et Traçabilité Forensique Immuable** :
   Chaque opération sensible, modification de configuration ou export de données fait l'objet d'un enregistrement inaltérable dans un journal d'audit chaîné cryptographiquement en SHA-256.
5. **Ergonomie 100% Francophone** :
   L'ensemble des interfaces, formulaires, messages de guidage, alertes et documents administratifs produits est nativement et exclusivement rédigé en langue française.
6. **Absence de Fonctions de Surveillance ou de Renseignement** :
   Le système est strictement dédié à la gestion des carrières, plannings, congés, formations et rémunérations. Il exclut formellement tout dispositif d'enquête, d'écoutes ou de surveillance policière.

---

## 2. Étude Comparative des Deux Options Techniques

Conformément à l'exigence R5, deux options techniques viables ont été rigoureusement analysées pour concilier accessibilité depuis les postes de travail autorisés et maintenabilité pérenne.

### 2.1 Présentation des Deux Options

#### Option A : Architecture Web Intranet 3-Tiers Centralisée (Recommandée)
- **Tier 1 (Client)** : Navigateur Web standard d'entreprise (Google Chrome, Mozilla Firefox ESR, Microsoft Edge) s'exécutant sur les postes autorisés des commissariats et directions. Client léger HTML5/CSS3/JavaScript sécurisé, sans binaire propriétaire à installer sur le poste client.
- **Tier 2 (Serveur Applicatif)** : Serveur d'application centralisé sous environnement Node.js / TypeScript (Fastify / Express), exposant des API REST sécurisées, assurant la validation des schémas de données, le contrôle d'accès RBAC/ABAC et le moteur de formulaires dynamiques.
- **Tier 3 (Persistance Centrale)** : Serveur de base de données relationnelle unique PostgreSQL 16+ avec chiffrement au repos, réplication et sauvegardes automatiques.
- **Réseau** : Intranet sécurisé de la Police Djiboutienne ou réseau VPN d'État chiffré en TLS 1.3.

#### Option B : Architecture Hybride avec Client Lourd / Léger Windows Packagé
- **Tier 1 (Client)** : Application cliente packagée pour le système d'exploitation Windows (Tauri, Electron ou .NET WPF), installée localement sur chaque poste de travail des commissariats.
- **Tier 2 (Serveur Applicatif)** : Même serveur applicatif centralisé qu'en Option A, fournissant les mêmes API REST.
- **Tier 3 (Persistance Centrale)** : Même base centrale PostgreSQL unique (puisque l'exigence R5 proscrit toute base de données locale indépendante par poste).
- **Déploiement** : Télédiffusion de paquets MSI / installateurs Windows avec politiques de groupe GPO sur le parc de machines.

---

### 2.2 Matrice Évaluative Comparative

| Critère d'Évaluation | Option A : Web Intranet 3-Tiers | Option B : Client Windows Packagé | Analyse et Impact Opérationnel pour la Police |
|---|---|---|---|
| **Simplicité de Déploiement** | **Excellente (5/5)** : Zéro installation locale. Disponibilité immédiate sur tout poste relié à l'intranet. | **Faible (2/5)** : Nécessite l'installation manuelle ou par GPO d'un package logiciel sur des centaines de postes distants. | L'Option A permet de rendre un commissariat distant immédiatement opérationnel sans intervention physique. |
| **Maintenance et Mises à Jour (MCO)** | **Optimale (5/5)** : Déploiement instantané en 1 point unique (le serveur central). 100% des agents accèdent à la même version. | **Complexe (2/5)** : Risque de versions disparates sur le terrain, échecs de scripts de mise à jour, postes hors ligne. | L'Option A supprime le risque d'incohérence logicielle entre la Direction Générale et les régions. |
| **Sécurité du Poste Client** | **Maximale (5/5)** : Aucun binaire spécifique résident, aucune donnée stockée sur le disque dur local du poste. | **Vulnérable (2/5)** : Présence d'exécutables locaux, risque de décompilation, fichiers temporaires locaux sur le disque. | En cas de cambriolage ou de perte d'un ordinateur de brigade, l'Option A garantit qu'aucune donnée ne subsiste sur le disque. |
| **Résilience Réseau** | Identique : L'application dépend du lien réseau vers le serveur central. | Identique : La base locale étant interdite par R5, le client Windows ne peut fonctionner sans liaison réseau. | L'Option B n'apporte aucun avantage de mode déconnecté du fait de l'interdiction stricte de base locale. |
| **Charge de Support Technique** | **Minimale** : L'équipe informatique centrale concentre ses efforts sur les serveurs applicatifs. | **Élevée** : Nécessite des interventions de dépannage régulières sur les systèmes Windows clients distants. | L'Option A libère les techniciens informatiques pour la sécurité et l'infrastructure. |
| **Respect Strict du Mandat R5** | **100% Conforme par nature** : Aucune base locale n'est installée. | **Conforme sous contrainte** : Risque permanent de mise en cache locale non autorisée de données sensibles. | L'Option A garantit une architecture purement centralisée. |
| **Expérience Utilisateur** | Ergonomie moderne, fluide, réactive et conforme aux standards Web actuels. | Interface native Windows. | Les technologies Web actuelles offrent une réactivité équivalente aux clients lourds. |

---

### 2.3 Décision Formelle Argumentée et Tranchée

**Le projet adopte formellement l'Option A : Architecture Web Intranet 3-Tiers Centralisée.**

Cette décision repose sur des arguments techniques et opérationnels indiscutables :
1. **Élimination de la maintenance sur sites distants** : Les brigades et commissariats régionaux (Dikhil, Tadjourah, Obock) peuvent être connectés instantanément au réseau sécurisé sans requérir l'envoi d'équipes techniques pour installer ou patcher des logiciels Windows.
2. **Sécurité maximale contre le vol de matériel** : Puisqu'aucune base locale ni fichier de données confidentielles n'est stocké sur le disque dur des postes clients, la perte physique d'un poste de travail n'entraîne aucune compromission de données.
3. **Pérennité technologique** : Les protocoles Web standards (HTTP/2, TLS 1.3, HTML5) garantissent l'interopérabilité sur le long terme, indépendamment des futures montées de version du système d'exploitation Windows des postes de travail.

---

## 3. Schéma Directeur d'Architecture et Topologie Réseau

L'infrastructure intranet de la Police Djiboutienne est organisée en 3 zones réseau étanches protégées par pare-feu :

```
                  POSTES CLIENTS AUTORISÉS (COMMISSARIATS & DIRECTIONS)
  [ Poste District Djibouti ]     [ Poste Commissariat Arrondissement ]     [ Poste Région Intérieur ]
           │                                      │                                      │
           └──────────────────────────────────────┼──────────────────────────────────────┘
                                                  │ Réseau Intranet Police / VPN IPsec Dédié
                                                  ▼
═══════════════════════════════════════════════════════════════════════════════════════════════════
  ZONE DÉMILITARISÉE (DMZ INTRANET)
                                                  │
                                                  ▼ [ Port HTTPS 443 / TLS 1.3 ]
                                    ┌───────────────────────────┐
                                    │    Serveur Nginx Durci    │
                                    │  (Reverse Proxy / WAF)    │
                                    │  - Terminaison SSL        │
                                    │  - En-têtes CSP / HSTS    │
                                    │  - Filtrage IP autorisé   │
                                    └─────────────┬─────────────┘
══════════════════════════════════════════════════╪════════════════════════════════════════════════
  ZONE APPLICATIVE INTERNE                        │
                                                  ▼ [ Socket UNIX / Port Local 3000 ]
                                    ┌───────────────────────────┐
                                    │    Serveur Applicatif     │
                                    │    Node.js / Fastify      │
                                    │                           │
                                    │  ┌─────────────────────┐  │
                                    │  │ Couche Contrôleurs  │  │ (Routage HTTP REST 100% français)
                                    │  └──────────┬──────────┘  │
                                    │  ┌──────────▼──────────┐  │
                                    │  │  Middlewares Auth   │  │ (Session, RBAC 6 rôles, ABAC Unité)
                                    │  └──────────┬──────────┘  │
                                    │  ┌──────────▼──────────┐  │
                                    │  │   Services Métier   │  │ (Congés, Mutations, Carrières, Solde)
                                    │  └──────────┬──────────┘  │
                                    │  ┌──────────▼──────────┐  │
                                    │  │ Moteur Form Builder │  │ (Métadonnées dynamiques, Versioning)
                                    │  └──────────┬──────────┘  │
                                    │  ┌──────────▼──────────┐  │
                                    │  │  Moteur Audit SHA   │  │ (Chaînage cryptographique inviolable)
                                    │  └─────────────────────┘  │
                                    └─────────────┬─────────────┘
══════════════════════════════════════════════════╪════════════════════════════════════════════════
  ZONE BASE DE DONNÉES (HAUTE SÉCURITÉ)           │
                                                  ▼ [ Port Sécurisé PostgreSQL ]
                                    ┌───────────────────────────┐
                                    │    Serveur Base de        │
                                    │  Données PostgreSQL 16+   │
                                    │  - Chiffrement au repos   │
                                    │  - Contraintes intégrité  │
                                    │  - Triggers immutabilité  │
                                    │  - Tablespaces étanches   │
                                    └─────────────┬─────────────┘
                                                  │ Réplication WAL & Sauvegarde Chiffrée
                                                  ▼
                                    ┌───────────────────────────┐
                                    │   Serveur de Sauvegarde   │
                                    │   Archive Chiffrée GPG    │
                                    └───────────────────────────┘
```

### 3.1 Description des Couches Applicatives

1. **Couche Présentation (Tier 1)** :
   - Interface Web dynamique construite selon une architecture composable et réactive.
   - Les formulaires dynamiques sont restitués à la volée par interprétation des métadonnées publiées par le serveur applicatif.
   - Respect strict des critères d'accessibilité et d'ergonomie policière : formulaires épurés, saisie rapide au clavier, infobulles contextuelles explicatives.
2. **Couche Métier et Contrôle d'Accès (Tier 2)** :
   - Moteur backend exécutant la logique métier en TypeScript avec typage strict.
   - Vérification systématique côté serveur de la triple contrainte de sécurité :
     1. L'opérateur est-il authentifié avec une session valide ?
     2. L'opérateur possède-t-il le rôle requis (RBAC) ?
     3. L'agent cible fait-il partie du périmètre hiérarchique autorisé de l'opérateur (ABAC Unité) ?
3. **Couche de Persistance et d'Intégrité (Tier 3)** :
   - Base de données PostgreSQL centralisée garantissant le respect des propriétés ACID.
   - Clés primaires UUID v4 et contraintes d'intégrité référentielle interdisant toute incohérence orpheline.
   - Triggers SQL d'immuabilité sur l'historique des affectations et sur le journal d'audit chaîné.

---

## 4. Moteur de Métadonnées Dynamiques & Form Builder (R4)

Le Requirement **R4** exige la mise en œuvre d'une Console d'administration fonctionnelle et de paramétrage RH adossée à un générateur de formulaires (Form Builder) low-code / no-code.

### 4.1 Typologie Complète des 6 Types de Champs Personnalisés
Le Form Builder permet à l'Administrateur Fonctionnel RH d'adjoindre des champs personnalisés sans aucune intervention de l'équipe de développement sur les entités cibles du système (`AGENT`, `DEMANDE_CONGE`, `AFFECTATION`, `FORMATION`, `EVALUATION`).

Les 6 types prescrits par le cahier des charges sont intégralement pris en charge :

| # | Type de Champ | Sous-types Configurables | Propriétés de Contrôle | Format de Stockage Physique |
|---|---|---|---|---|
| **1** | **Texte** | `texte_court` (max 255 car.), `texte_long` (zone de texte), `numero_telephone`, `email` | Longueur minimale/maximale, masque de saisie, expression régulière (Regex), transformation majuscules/minuscules | `valeur_texte TEXT` |
| **2** | **Date** | `date_simple` (JJ/MM/AAAA), `date_heure`, `date_periode` | Borne minimale, borne maximale, interdiction des dates futures ou antérieures | `valeur_date TIMESTAMP WITH TIME ZONE` |
| **3** | **Nombre** | `entier`, `decimal`, `monnaie_djf` (Francs de Djibouti) | Valeur minimale, valeur maximale, nombre de décimales, unité affichée | `valeur_nombre NUMERIC(14,2)` |
| **4** | **Liste déroulante** | `selection_unique`, `selection_multiple` | Référence vers une liste de valeurs administrée, ordre alphabétique ou personnalisé | `valeur_liste_code VARCHAR(100)` ou tableau JSONB |
| **5** | **Case à cocher** | `booleen` (Oui / Non, Vrai / Faux) | Libellé explicite, valeur par défaut | `valeur_booleen BOOLEAN` |
| **6** | **Pièce jointe** | `document_pdf`, `image_scan`, `archive` | Types MIME autorisés (`application/pdf`, `image/jpeg`, `image/png`), taille maximale (ex: 5 Mo) | `valeur_piece_jointe_id VARCHAR(36)` (lien vers document chiffré) |

### 4.2 Fonctionnalités du Form Builder Fonctionnel
L'administrateur fonctionnel RH dispose des capacités suivantes :
- **Ajout de champs** à un formulaire existant avec attribution d'un libellé clair en français et génération automatique d'un code technique normalisé.
- **Réordonnancement** visuel des champs (ordre d'affichage séquentiel).
- **Modification du caractère obligatoire** (`est_obligatoire = TRUE/FALSE`) avec message de validation personnalisé en français.
- **Activation / Désactivation** instantanée d'un champ (`est_actif = TRUE/FALSE`). Un champ désactivé est masqué des nouveaux formulaires sans que ses valeurs historiques ne soient effacées.
- **Ajout d'aides contextuelles** (infobulles d'explication métier).

### 4.3 Architecture EAV Robuste et Pérennité des Identifiants Invariants
Pour garantir qu'aucune donnée saisie ne devienne orpheline ou invisible lors de la publication d'une nouvelle version ou d'une opération de rollback, l'architecture EAV (*Entity-Attribute-Value*) repose sur les règles strictes suivantes :
1. **Dissociation Totale entre Définition de Champ et Version de Configuration** :
   - Chaque champ personnalisé dispose d'un identifiant universel permanent (`id` UUID stable) et d'un code invariant pérenne (`code_champ`, ex: `'pointure_rangers'`, `'numero_casier'`).
   - L'unicité du champ est garantie au niveau de l'entité cible par la contrainte `UNIQUE(entite_cible, code_champ)`.
   - La table `valeurs_champs_dynamiques` référence directement et exclusivement cet identifiant stable (`champ_id REFERENCES champs_personnalises(id)`).
2. **Continuité Parfaite des Données Lors des Montées de Version et Rollbacks** :
   - Lorsqu'une nouvelle version de configuration est publiée ou rétablie, les enregistrements de `champs_personnalises` conservent rigoureusement leur clé primaire `id`.
   - Les modifications fonctionnelles (activation, libellé, ordre, caractère obligatoire) sont appliquées sur la définition maîtresse, tandis que l'état historique complet est scellé dans l'instantané JSON `snapshot_configuration_json` de la table `versions_configuration_rh`.
   - Ainsi, toute requête joignant `valeurs_champs_dynamiques` à `champs_personnalises` restitue instantanément et sans amnésie les données de l'agent, même après de multiples publications ou retours arrière.
3. **Protection Contre les Collisions avec les Colonnes Natives du Schéma** :
   - Le moteur du Form Builder bloque formellement la création de tout champ dont le `code_champ` entrerait en collision avec une colonne maîtresse de l'entité cible (ex: `'matricule'`, `'nom'`, `'prenom'`, `'date_naissance'`, `'corps'`, `'grade_actuel'`, `'echelon_actuel'`, `'indice_solde'`, `'unite_actuelle_id'`, `'statut_administratif'`).
   - Cette règle est garantie au double niveau applicatif (contrôleur Fastify) et relationnel (contrainte SQL `CHECK`).
4. **Liste Noire de Mots-Clés Médicaux (Conformité Stricte R3 & R5)** :
   - Afin de garantir l'absence totale de données médicales dans le SIRH, le Form Builder intègre une liste noire de contrôle interdisant la création de champs relatifs à la santé, aux maladies, aux pathologies, aux traitements ou au groupe sanguin.

---

## 5. Moteur de Versioning et Algorithme de Rollback Instantané

### 5.1 Cycle de Vie des Versions de Configuration
Pour prévenir toute régression en production, la configuration fonctionnelle obéit à un cycle de vie strict :
```
[ Brouillon ] ────(Validation de cohérence)────> [ Validée ] ────(Publication)────> [ Active ]
                                                                                       │
                                                                   (Lors de publication suivante)
                                                                                       ▼
                                                                                 [ Archivée ]
```

1. **Brouillon (`BROUILLON`)** : L'Administrateur Fonctionnel RH ajuste les formulaires et listes dans un espace de travail isolé.
2. **Validation (`VALIDEE`)** : Le moteur contrôle l'absence de conflits de nommage, l'intégrité des listes de valeurs référencées, l'absence de mots-clés médicaux et la conformité des règles de validation.
3. **Publication (`ACTIVE`)** : La configuration est scellée sous forme d'un instantané JSON immuable (`snapshot_configuration_json`) avec un numéro de version incrémental (ex: `v1.0.0` -> `v1.1.0`), horodatage et identité de l'auteur.
4. **Archivage (`ARCHIVEE`)** : Toutes les anciennes versions sont conservées indéfiniment en base.

### 5.2 Algorithme de Rollback Sans Perte de Données
Si une configuration `v2.0.0` nouvellement publiée entraîne une perturbation opérationnelle :
1. L'administrateur fonctionnel sélectionne la version antérieure stable (ex: `v1.3.0`) dans le catalogue des versions.
2. Il déclenche la commande « Rétablir cette version » en saisissant obligatoirement un motif justificatif.
3. Le système crée immédiatement une nouvelle version active `v2.1.0` dont les paramètres sont restaurés à partir du snapshot immuable de `v1.3.0`.
4. **Garantie d'intégrité absolue (zéro perte de données)** :
   - Comme `valeurs_champs_dynamiques` pointe sur l'identifiant invariant du champ (`champ_id`), les données saisies par les agents sous la version `v2.0.0` demeurent intégralement préservées en base.
   - Les champs qui n'existaient pas en `v1.3.0` voient leur attribut `est_actif` positionné à `FALSE` : ils sont immédiatement masqués des nouveaux formulaires de saisie, mais leurs valeurs passées demeurent parfaitement consultables dans les dossiers historiques et les pistes d'audit.
5. L'opération de rollback est immédiatement consignée dans le journal d'audit immuable SHA-256 avec mention de la version source, de la version cible, de l'opérateur et de la date.

---

## 6. Dimensionnement, Performance et Haute Disponibilité

### 6.1 Dimensionnement pour la Police Djiboutienne
- **Effectifs cibles** : ~5 000 à 10 000 agents actifs et civils.
- **Utilisateurs simultanés estimés en heure de pointe** : ~300 à 500 connexions concurrentes (prise de service de brigade, validation de vacations, consultation de soldes).
- **Volume transactionnel journalier** : ~25 000 requêtes HTTP/jour.
- **Ressources serveur requises** :
  - Serveur applicatif : 4 vCPU, 8 Go RAM.
  - Serveur de base de données : 4 vCPU, 16 Go RAM, stockage SSD NVMe 100 Go avec réplication.

### 6.2 Engagements de Performance
- **Temps de réponse API** : < 150 ms en moyenne sur le réseau local, < 300 ms sur les liaisons intranet interurbaines (Régions de l'Intérieur).
- **Temps de génération d'un arrêté ou état de service PDF** : < 1 500 ms.
- **Mise en cache applicative** : Cache en mémoire locale (TTL court) pour les listes de valeurs, l'arborescence des unités et les métadonnées de formulaires, invalidé automatiquement à chaque publication de nouvelle version de configuration.

---

## 7. Résilience Face aux Contraintes Réseau WAN Djiboutiennes

L'architecture Web Intranet 3-Tiers Centralisée (Option A) adoptée pour le projet répond strictement à l'exigence R5 (aucune base locale par poste). Cependant, l'infrastructure réseau nationale de la République de Djibouti présente des spécificités géographiques et techniques qui imposent un durcissement approfondi des échanges HTTP.

### 7.1 Typologie et Contraintes du Réseau WAN Djiboutien
- **Liaisons Interurbaines à Forte Latence** : Les commissariats et brigades situés dans les régions de l'Intérieur (Ali-Sabieh, Dikhil, Tadjourah, Obock, Arta) sont reliés au centre de données de la Direction Générale à Djibouti-Ville par des liaisons télécoms présentant un temps d'aller-retour (*Round-Trip Time* ou RTT) compris entre 150 ms et 300 ms, avec des variations de gigue (*jitter*) et des pertes ponctuelles de paquets lors des intempéries.
- **Basculements Fréquents sur Secours 4G LTE** : En cas de coupure de la liaison filaire principale dans un commissariat régional, les routeurs réseau basculent automatiquement sur un lien de secours mobile 4G LTE national (Djibouti Telecom). Cette bascule modifie dynamiquement l'adresse IP publique source du poste client.

### 7.2 Protocole d'Idempotence par En-tête `Idempotency-Key`
Pour prévenir tout risque de double mutation, de double décompte de congé ou de double saisie d'indemnité lors d'un renvoi intempestif de requête consécutif à un timeout réseau WAN :
1. **Génération Client Obligatoire** : Toute requête HTTP modifiant l'état du système (`POST /api/affectations`, `POST /api/conges/valider`, `POST /api/solde/elements`, `POST /api/carrieres/echelons`) doit obligatoirement inclure un en-tête standardisé :
   ```http
   Idempotency-Key: 9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d
   ```
   Cet identifiant est un UUID v4 généré par le navigateur client au moment du clic de confirmation de l'opérateur.
2. **Table de Registre d'Idempotence Côté Serveur** :
   - Le serveur applicatif intercepte l'en-tête via un middleware dédié.
   - Si la clé est reçue pour la première fois, la transaction métier est exécutée au sein d'une transaction PostgreSQL ACID, et la réponse HTTP complète (code statut et payload JSON) est scellée dans la table `registre_idempotence` avec une durée de validité de 24 heures.
   - Si la clé a déjà été traitée (cas typique d'un accusé de réception perdu sur le WAN ayant conduit le navigateur à réémettre la requête), le serveur ne ré-exécute pas l'opération : il retourne immédiatement la réponse enregistrée avec le code HTTP d'origine.
   - Tout risque de double écriture transactionnelle est ainsi formellement éliminé.

### 7.3 Budget de Charge Utile et Stratégie de Mise en Cache HTTP
Afin de minimiser le volume de données transféré sur les liaisons interurbaines :
1. **Budget de Charge Utile (*Payload Budget*)** :
   - Le poids total combiné des ressources initiales (DOM HTML, feuilles de style CSS et scripts JavaScript client) est strictement bridé à **moins de 100 Ko** après compression.
   - Aucun framework lourd ou dépendance externe volumineuse n'est chargé côté client.
2. **Compression Native Brotli et Gzip** :
   - Le reverse proxy Nginx est configuré pour appliquer systématiquement la compression **Brotli** (`br`) de niveau 6 pour les réponses textuelles et JSON, avec repli automatique sur **Gzip** (`gzip`) pour les clients ne supportant pas Brotli.
   - Cette compression divise par 4 à 6 la taille des flux JSON transmis sur le réseau WAN.
3. **Mise en Cache HTTP Agressive des Composants Statiques** :
   - Les fichiers statiques (scripts JS, icônes, styles CSS) sont versionnés par empreinte de contenu (*cache-busting hash*) et servis avec l'en-tête :
     ```http
     Cache-Control: public, max-age=31536000, immutable
     ```
   - Les postes clients des commissariats ne rechargent ces fichiers qu'une seule fois, éliminant tout trafic statique répétitif.
4. **Validation Conditionnelle par ETag pour les Métadonnées** :
   - Les listes de valeurs et les définitions de formulaires dynamiques sont servies avec un en-tête `ETag` calculé à partir de l'identifiant de version courante.
   - Le navigateur envoie `If-None-Match` ; si la configuration n'a pas évolué, le serveur répond instantanément par un code **HTTP 304 Non Modifié** (charge utile de 0 octet).

### 7.4 Sauvegarde Temporaire des Brouillons en `sessionStorage` du Navigateur
Le mandat R5 prohibe formellement toute base de données locale installée sur les postes clients. Pour autant, la rédaction de dossiers administratifs longs (motivations de mutations, fiches d'évaluation annuelle, descriptions disciplinaires) ne doit pas être perdue lors d'une micro-coupure réseau WAN :
1. **Mécanisme de Sauvegarde Volatile en Mémoire d'Onglet** :
   - L'interface Web sauvegarde automatiquement la saisie en cours toutes les 5 secondes dans l'objet standard du navigateur `window.sessionStorage`.
   - `sessionStorage` réside exclusivement dans la mémoire vive de l'onglet de navigation : **aucun fichier n'est écrit sur le disque dur du poste client**, garantissant la conformité stricte avec l'exigence R5 en cas de vol de l'ordinateur.
2. **Restauration Automatique après Coupure Réseau** :
   - En cas de coupure du lien WAN, de rafraîchissement d'écran ou de reconnexion après une bascule de réseau, le formulaire détecte la présence d'un brouillon non validé en mémoire et propose à l'opérateur de restaurer instantanément sa saisie.
3. **Destruction Systématique après Soumission ou Déconnexion** :
   - Dès la validation définitive de la requête par le serveur (réponse HTTP 200/201), ou lors de la déconnexion explicite de la session, le brouillon en mémoire `sessionStorage` est immédiatement et irréversiblement purgé.

### 7.5 Tolérance aux Bascules d'Adresses IP des Commissariats Régionaux
Lors de la bascule d'un commissariat sur routeur 4G LTE de secours :
- L'adresse IP publique change instantanément, ce qui provoquerait une rupture brutale de service sous une politique naïve de verrouillage d'IP stricte.
- Le système concilie sécurité régalienne et continuité opérationnelle grâce à une validation à double niveau :
  1. Le jeton de session cryptographique est signé asymétriquement par le serveur et transporté sous cookie sécurisé `HttpOnly; SameSite=Strict`.
  2. Le serveur autorise la poursuite de session si la nouvelle adresse IP appartient à la même plage réseau autorisée de la Police Nationale ou du sous-réseau régional `/24`.
  3. Si la bascule implique un sous-réseau différent, le système effectue une vérification transparente par jeton de rafraîchissement (*Refresh Token*) sans déconnecter l'opérateur ni perdre sa saisie en cours, tout en consignant l'événement de bascule IP dans le journal d'audit SHA-256.

