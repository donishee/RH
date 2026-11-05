# Modèle Relationnel et Dictionnaire de Données (R5 & R4)

## 1. Principes de Modélisation et Conventions Normalisées

Le présent document décrit l'architecture des données du Système d'Information des Ressources Humaines (SIRH) de la **Police Nationale de la République de Djibouti**, conformément aux exigences des Requirements **R4** et **R5**.

### 1.1 Conventions Techniques et Règles d'Intégrité
1. **Identifiants Primaires Universels (UUID v4)** :
   Toutes les entités du modèle utilisent un identifiant unique universel de 36 caractères (`VARCHAR(36)` ou `UUID`), garantissant l'absence de collision lors des opérations et évitant l'exposition de séquences numériques prédictibles.
2. **Nomenclature Relationnelle 100% en Français** :
   Les noms de tables, de colonnes, de contraintes et d'index sont intégralement rédigés en langue française en notation minuscule avec tiret bas (`snake_case`), au pluriel pour les tables (`agents`, `unites`, `affectations`) et au singulier pour les colonnes.
3. **Horodatage Universel et Audit** :
   Tous les champs d'horodatage sont typés en `TIMESTAMP WITH TIME ZONE` et stockés en temps universel coordonné (UTC). Chaque table maîtresse comporte au minimum `cree_le` et `modifie_le`.
4. **Conservation de l'Historique et Suppression Logique (*Soft-Delete*)** :
   Aucune donnée administrative relative aux états de service, mutations, carrières ou discipline ne fait l'objet d'une suppression physique (`DELETE`). Les entités susceptibles d'archivage disposent d'un drapeau `est_actif BOOLEAN NOT NULL DEFAULT TRUE` ou `est_supprime BOOLEAN NOT NULL DEFAULT FALSE`.
5. **Intégrité Référentielle Stricte** :
   Les relations entre tables sont protégées par des clés étrangères avec contrainte `ON DELETE RESTRICT` afin d'interdire la suppression accidentelle d'une unité ou d'un grade rattaché à des agents actifs.

---

## 2. Cartographie Globale des 21 Tables du Système

Le schéma de données s'articule autour de 11 domaines métiers étanches :

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                          DOMAINE IAM & GESTION DES ACCÈS                               │
│  [ comptes_utilisateurs ] 1 ─── 0/1 [ agents ]                                         │
│  [ comptes_utilisateurs ] 1 ─── N   [ sessions_actives ]                               │
│  [ comptes_utilisateurs ] 1 ─── N   [ registre_idempotence ]                           │
└───────────────────────────────────────────────┬────────────────────────────────────────┘
                                                │
┌───────────────────────────────────────────────┴────────────────────────────────────────┐
│                                   DOMAINE ORGANISATION                                 │
│  [ unites ] 1 ────────── N [ postes ] 0/1 ────────── 1 [ affectations ]                │
│  (Anti-cycle hiérarchique) (Clé composite id/unite)  (Intégrité poste/unité stricte)   │
└───────────────────────────────────────────────┬────────────────────────────────────────┘
                                                │ N
                                                ▼ 1
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                   DOMAINE PERSONNEL                                    │
│                                      [ agents ]                                        │
└───────┬───────────────────┬───────────────────┬───────────────────┬────────────────────┘
        │ 1                 │ 1                 │ 1                 │ 1
        ▼ N                 ▼ N                 ▼ N                 ▼ N
┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌────────────────────────────┐
│   CONGÉS &   │    │  CARRIÈRES & │    │ FORMATIONS & │    │    ÉLÉMENTS DE SOLDE &     │
│   ABSENCES   │    │  PROMOTIONS  │    │ QUALIFICAT.  │    │          EXPORTS           │
│              │    │              │    │              │    │                            │
│ soldes_      │    │ carrieres_   │    │ formations   │    │ elements_solde             │
│ conges       │    │ echelons     │    │              │    │                            │
│              │    │              │    │ qualifica-   │    │ exports_solde              │
│ demandes_    │    │ promotions_  │    │ tions_agents │    │                            │
│ conges       │    │ grades       │    │              │    │                            │
│              │    │              │    │              │    │                            │
│ types_conges │    │              │    │              │    │                            │
└──────────────┘    └──────────────┘    └──────────────┘    └────────────────────────────┘
        │ 1                                     │ 1
        ▼ N (Cloisonnement strict)               ▼ N (Sans données médicales)
┌───────────────────────────────────┐   ┌────────────────────────────────────────────────┐
│       DOSSIERS DISCIPLINAIRES     │   │          APTITUDES ADMINISTRATIVES             │
│       [ dossiers_disciplinaires ] │   │          [ aptitudes_administratives ]         │
│       (Allégat. / Enquête / Sanction) │          (Nomenclature fermée sans texte libre)│
└───────────────────────────────────┘   └────────────────────────────────────────────────┘
        │                                       │
════════╪═══════════════════════════════════════╪═════════════════════════════════════════
        ▼                                       ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        DOMAINE PARAMÉTRAGE DYNAMIQUE & FORM BUILDER                    │
│   [ listes_valeurs ] 1 ─────── N [ elements_liste_valeurs ]                            │
│   [ champs_personnalises ] 1 ── N [ valeurs_champs_dynamiques ] (Clé stable invariante)│
│   [ versions_configuration_rh ] (Snapshots immuables JSONB & Rollback sans perte)      │
└────────────────────────────────────────────────────────────────────────────────────────┘
        │
════════╪═════════════════════════════════════════════════════════════════════════════════
        ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                          SOCLE DE TRAÇABILITÉ FORENSIQUE                               │
│   [ journaux_audit ] (Table Append-Only avec Trigger d'Immuabilité & SHA-256)          │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Définition Détaillée des 21 Tables (Scripts DDL PostgreSQL)

### 3.1 Domaine Organisation et Postes

#### Table 1 : `unites` (Unités Organisationnelles et Territoriales)
Représente l'arborescence des directions, divisions, commissariats d'arrondissement, brigades et postes territoriaux.
```sql
CREATE TABLE unites (
    id VARCHAR(36) PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL, -- ex: 'DGPN-DOP', 'COMM-ARR-01', 'BRIG-INTERV'
    nom VARCHAR(150) NOT NULL,
    type_unite VARCHAR(50) NOT NULL, -- 'DIRECTION_GENERALE', 'DIRECTION', 'COMMISSARIAT', 'SERVICE', 'BRIGADE', 'POSTE'
    unite_parente_id VARCHAR(36) REFERENCES unites(id) ON DELETE RESTRICT,
    responsable_agent_id VARCHAR(36), -- Référence logique vers agents(id)
    region_administrative VARCHAR(50) NOT NULL DEFAULT 'DJIBOUTI', -- 'DJIBOUTI', 'ALI_SABIEH', 'DIKHIL', 'TADJOURAH', 'OBOCK', 'ARTA'
    adresse_geographique TEXT,
    telephone_contact VARCHAR(30),
    est_active BOOLEAN NOT NULL DEFAULT TRUE,
    cree_le TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    modifie_le TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (unite_parente_id IS NULL OR unite_parente_id <> id)
);
CREATE INDEX idx_unites_parente ON unites(unite_parente_id);
CREATE INDEX idx_unites_region ON unites(region_administrative);

-- Trigger de protection contre les boucles récursives (anti-cycle) dans l'arborescence des unités
CREATE OR REPLACE FUNCTION fn_empecher_cycle_unites()
RETURNS TRIGGER AS $$
DECLARE
    v_courant_id VARCHAR(36);
BEGIN
    IF NEW.unite_parente_id IS NOT NULL THEN
        -- Interdiction immédiate d'auto-parenté
        IF NEW.unite_parente_id = NEW.id THEN
            RAISE EXCEPTION 'VIOLATION HIERARCHIE : Une unite ne peut pas etre sa propre unite parente (id: %).', NEW.id
                USING ERRCODE = '22000';
        END IF;

        -- Détection de cycle transitif en remontant l'arbre des ancêtres
        v_courant_id := NEW.unite_parente_id;
        WHILE v_courant_id IS NOT NULL LOOP
            IF v_courant_id = NEW.id THEN
                RAISE EXCEPTION 'VIOLATION HIERARCHIE : Cycle detecte dans l arborescence des unites (l unite % apparait dans ses propres ancetres).', NEW.id
                    USING ERRCODE = '22000';
            END IF;
            SELECT unite_parente_id INTO v_courant_id FROM unites WHERE id = v_courant_id;
        END LOOP;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tg_empecher_cycle_unites
BEFORE INSERT OR UPDATE OF unite_parente_id ON unites
FOR EACH ROW
EXECUTE FUNCTION fn_empecher_cycle_unites();

-- Requête type de résolution hiérarchique avec protection intégrée PostgreSQL 14+ (CYCLE ... SET is_cycle) :
-- WITH RECURSIVE sous_arborescence AS (
--     SELECT id, code, nom, unite_parente_id, 1 AS niveau
--     FROM unites WHERE id = :unite_id
--     UNION ALL
--     SELECT u.id, u.code, u.nom, u.unite_parente_id, sa.niveau + 1
--     FROM unites u
--     JOIN sous_arborescence sa ON u.unite_parente_id = sa.id
-- )
-- CYCLE id SET is_cycle USING path
-- SELECT id, code, nom, niveau FROM sous_arborescence WHERE NOT is_cycle;
```

#### Table 2 : `postes` (Postes Opérationnels et Budgétaires)
Définit les emplois budgétés au sein de chaque unité, leur statut de vacance et les conditions de grade requises.
```sql
CREATE TABLE postes (
    id VARCHAR(36) PRIMARY KEY,
    code_poste VARCHAR(50) UNIQUE NOT NULL, -- ex: 'PST-COMM1-CHEF', 'PST-BRIG1-OFF-QUART'
    intitule VARCHAR(150) NOT NULL,
    unite_id VARCHAR(36) NOT NULL REFERENCES unites(id) ON DELETE RESTRICT,
    grade_requis VARCHAR(50) NOT NULL,
    effectif_requis INTEGER NOT NULL DEFAULT 1,
    est_vacant BOOLEAN NOT NULL DEFAULT TRUE,
    description_emploi TEXT,
    cree_le TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    modifie_le TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    -- Contrainte d'unicité composite requise pour le couplage référentiel strict avec affectations
    CONSTRAINT uq_postes_id_unite UNIQUE (id, unite_id)
);
CREATE INDEX idx_postes_unite ON postes(unite_id);
CREATE INDEX idx_postes_vacance ON postes(est_vacant);
```

---

### 3.2 Domaine Dossier Agent et Mouvements

#### Table 3 : `agents` (Dossier Individuel de l'Agent)
Enregistre les données statutaires et civiles de l'agent. Le matricule attribué est strictement unique et inaltérable.
```sql
CREATE TABLE agents (
    id VARCHAR(36) PRIMARY KEY,
    matricule VARCHAR(30) UNIQUE NOT NULL, -- Matricule national policier unique
    numero_carte_nationale VARCHAR(50) UNIQUE NOT NULL,
    nom VARCHAR(100) NOT NULL,
    prenom VARCHAR(100) NOT NULL,
    date_naissance DATE NOT NULL,
    lieu_naissance VARCHAR(100) NOT NULL,
    genre VARCHAR(10) NOT NULL CHECK (genre IN ('MASCULIN', 'FEMININ')),
    situation_familiale VARCHAR(30) NOT NULL DEFAULT 'CELIBATAIRE', -- 'CELIBATAIRE', 'MARIE', 'DIVORCE', 'VEUF'
    nombre_enfants INTEGER NOT NULL DEFAULT 0,
    telephone_professionnel VARCHAR(30),
    telephone_personnel VARCHAR(30),
    email_professionnel VARCHAR(150) UNIQUE,
    date_recrutement DATE NOT NULL,
    date_titularisation DATE,
    corps VARCHAR(50) NOT NULL, -- 'OFFICIERS_SUPERIEURS', 'OFFICIERS_SUBALTERNES', 'SOUS_OFFICIERS', 'GRADES', 'AGENTS', 'PERSONNELS_CIVILS'
    grade_actuel VARCHAR(50) NOT NULL,
    echelon_actuel INTEGER NOT NULL DEFAULT 1,
    indice_solde INTEGER NOT NULL,
    unite_actuelle_id VARCHAR(36) NOT NULL REFERENCES unites(id) ON DELETE RESTRICT,
    statut_administratif VARCHAR(50) NOT NULL DEFAULT 'EN_ACTIVITE', -- 'EN_ACTIVITE', 'DETACHEMENT', 'DISPONIBILITE', 'SUSPENSION', 'RETRAITE'
    est_actif BOOLEAN NOT NULL DEFAULT TRUE,
    cree_le TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    modifie_le TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_agents_unite ON agents(unite_actuelle_id);
CREATE INDEX idx_agents_corps_grade ON agents(corps, grade_actuel);
CREATE INDEX idx_agents_statut ON agents(statut_administratif, est_actif);
```

#### Table 4 : `affectations` (Historique Immuable des Affectations et Mutations)
Table pivot *append-only*. Chaque mutation clôture l'affectation précédente et en crée une nouvelle sans jamais écraser l'historique.
```sql
CREATE TABLE affectations (
    id VARCHAR(36) PRIMARY KEY,
    agent_id VARCHAR(36) NOT NULL REFERENCES agents(id) ON DELETE RESTRICT,
    unite_id VARCHAR(36) NOT NULL REFERENCES unites(id) ON DELETE RESTRICT,
    poste_id VARCHAR(36),
    type_mouvement VARCHAR(50) NOT NULL, -- 'NOMINATION_INITIALE', 'MUTATION', 'PROMOTION', 'AFFECTATION_TEMPORAIRE', 'INTERIM'
    date_debut DATE NOT NULL,
    date_fin DATE, -- NULL tant que l'affectation est active
    motif_mouvement TEXT NOT NULL,
    reference_arrete_ou_decision VARCHAR(100) NOT NULL, -- Référence de l'acte ministériel ou DGPN
    est_affectation_courante BOOLEAN NOT NULL DEFAULT FALSE,
    cree_par VARCHAR(36) NOT NULL,
    cree_le TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (date_fin IS NULL OR date_fin >= date_debut),
    -- Contrainte d'intégrité référentielle composite garantissant que poste.unite_id == affectation.unite_id
    CONSTRAINT fk_affectations_poste_unite FOREIGN KEY (poste_id, unite_id) 
        REFERENCES postes(id, unite_id) ON DELETE RESTRICT
);
CREATE INDEX idx_affectations_agent ON affectations(agent_id, date_debut DESC);
CREATE INDEX idx_affectations_unite ON affectations(unite_id, date_debut DESC);
-- Contrainte d'unicité garantie : 1 seule affectation courante par agent à un instant T
CREATE UNIQUE INDEX idx_unique_affectation_courante ON affectations(agent_id) 
WHERE est_affectation_courante = TRUE;

-- Trigger d'intégrité garantissant la stricte concordance entre poste_id et unite_id
CREATE OR REPLACE FUNCTION fn_verifier_poste_unite_affectation()
RETURNS TRIGGER AS $$
DECLARE
    v_unite_poste VARCHAR(36);
BEGIN
    IF NEW.poste_id IS NOT NULL THEN
        SELECT unite_id INTO v_unite_poste FROM postes WHERE id = NEW.poste_id;
        IF v_unite_poste IS NOT NULL AND v_unite_poste <> NEW.unite_id THEN
            RAISE EXCEPTION 'VIOLATION INTEGRITE : Le poste % est rattache a l unite %, incompatible avec l unite d affectation %.',
                NEW.poste_id, v_unite_poste, NEW.unite_id
                USING ERRCODE = '23503';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tg_verifier_poste_unite
BEFORE INSERT OR UPDATE ON affectations
FOR EACH ROW
EXECUTE FUNCTION fn_verifier_poste_unite_affectation();

-- Trigger d'immuabilité garantissant le caractère strictement append-only de l'historique des affectations
CREATE OR REPLACE FUNCTION fn_affectations_immuable()
RETURNS TRIGGER AS $$
BEGIN
    -- Interdiction formelle et absolue de toute suppression physique d'affectation
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'VIOLATION INTEGRITE : L historique des affectations est immuable. La suppression d une affectation est formellement interdite.'
            USING ERRCODE = '23505';
    ELSIF TG_OP = 'UPDATE' THEN
        -- Interdiction stricte de modifier une affectation passée déjà clôturée
        IF OLD.est_affectation_courante = FALSE THEN
            RAISE EXCEPTION 'VIOLATION INTEGRITE : Une affectation historique passee est scellee et ne peut etre modifiee.'
                USING ERRCODE = '23505';
        END IF;

        -- Lors de la clôture d'une affectation active, SEULES la date_fin et est_affectation_courante peuvent être modifiées
        IF (OLD.agent_id <> NEW.agent_id OR
            OLD.unite_id <> NEW.unite_id OR
            OLD.poste_id IS DISTINCT FROM NEW.poste_id OR
            OLD.type_mouvement <> NEW.type_mouvement OR
            OLD.date_debut <> NEW.date_debut OR
            OLD.motif_mouvement <> NEW.motif_mouvement OR
            OLD.reference_arrete_ou_decision <> NEW.reference_arrete_ou_decision OR
            OLD.cree_par <> NEW.cree_par OR
            OLD.cree_le <> NEW.cree_le) THEN
            RAISE EXCEPTION 'VIOLATION INTEGRITE : Modification interdite de l historique d affectation. Seules la date de fin et le statut courant peuvent etre modifies lors d une cloture de mutation.'
                USING ERRCODE = '23505';
        END IF;

        -- Vérification du passage légitime de TRUE à FALSE
        IF NEW.est_affectation_courante = TRUE AND OLD.est_affectation_courante = TRUE THEN
            RAISE EXCEPTION 'VIOLATION INTEGRITE : Une affectation courante ne peut pas etre mise a jour in-place. Une nouvelle affectation doit etre inseree.'
                USING ERRCODE = '23505';
        END IF;

        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tg_affectations_immuable
BEFORE UPDATE OR DELETE ON affectations
FOR EACH ROW
EXECUTE FUNCTION fn_affectations_immuable();
```

---

### 3.3 Domaine Congés et Absences

#### Table 5 : `types_conges` (Nomenclature et Règles de Congés)
```sql
CREATE TABLE types_conges (
    id VARCHAR(36) PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL, -- 'CONGE_ANNUEL', 'MALADIE_ORDINAIRE', 'MATERNITE', 'EVENEMENT_FAMILIAL'
    libelle VARCHAR(100) NOT NULL,
    description TEXT,
    quota_annuel_jours INTEGER NOT NULL DEFAULT 30,
    report_autorise BOOLEAN NOT NULL DEFAULT FALSE,
    plafond_report_jours INTEGER NOT NULL DEFAULT 0,
    justificatif_obligatoire BOOLEAN NOT NULL DEFAULT FALSE,
    deductible_solde BOOLEAN NOT NULL DEFAULT TRUE,
    est_actif BOOLEAN NOT NULL DEFAULT TRUE,
    cree_le TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

#### Table 6 : `soldes_conges` (Compteurs Annuels Individuels)
```sql
CREATE TABLE soldes_conges (
    id VARCHAR(36) PRIMARY KEY,
    agent_id VARCHAR(36) NOT NULL REFERENCES agents(id) ON DELETE RESTRICT,
    type_conge_id VARCHAR(36) NOT NULL REFERENCES types_conges(id) ON DELETE RESTRICT,
    annee INTEGER NOT NULL,
    jours_acquis NUMERIC(5,1) NOT NULL DEFAULT 30.0,
    jours_reportes NUMERIC(5,1) NOT NULL DEFAULT 0.0,
    jours_pris NUMERIC(5,1) NOT NULL DEFAULT 0.0,
    jours_en_attente NUMERIC(5,1) NOT NULL DEFAULT 0.0, -- Jours préemptés par demandes en cours
    jours_restants NUMERIC(5,1) GENERATED ALWAYS AS (jours_acquis + jours_reportes - jours_pris - jours_en_attente) STORED,
    cree_le TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    modifie_le TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(agent_id, type_conge_id, annee)
);
CREATE INDEX idx_soldes_agent_annee ON soldes_conges(agent_id, annee);
```

#### Table 7 : `demandes_conges` (Demandes et Circuit de Validation)
```sql
CREATE TABLE demandes_conges (
    id VARCHAR(36) PRIMARY KEY,
    agent_id VARCHAR(36) NOT NULL REFERENCES agents(id) ON DELETE RESTRICT,
    type_conge_id VARCHAR(36) NOT NULL REFERENCES types_conges(id) ON DELETE RESTRICT,
    date_debut DATE NOT NULL,
    date_fin DATE NOT NULL,
    nombre_jours NUMERIC(5,1) NOT NULL,
    motif TEXT,
    statut VARCHAR(30) NOT NULL DEFAULT 'SOUMIS', -- 'SOUMIS', 'APPROUVE_CHEF', 'VALIDE_RH', 'REFUSE', 'ANNULE'
    decision_chef_service VARCHAR(30), -- 'ACCORD', 'REFUS'
    motif_refus_chef TEXT,
    date_decision_chef TIMESTAMP WITH TIME ZONE,
    chef_service_id VARCHAR(36),
    decision_rh VARCHAR(30), -- 'ACCORD', 'REFUS'
    motif_refus_rh TEXT,
    date_decision_rh TIMESTAMP WITH TIME ZONE,
    gestionnaire_rh_id VARCHAR(36),
    version_optimiste INTEGER NOT NULL DEFAULT 1, -- Prévention stricte des doubles validations concurrentes
    cree_le TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    modifie_le TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (date_fin >= date_debut)
);
CREATE INDEX idx_demandes_agent_statut ON demandes_conges(agent_id, statut);
CREATE INDEX idx_demandes_periode ON demandes_conges(date_debut, date_fin);
```

---

### 3.4 Domaine Carrières, Échelons et Promotions

#### Table 8 : `carrieres_echelons` (Historique des Échelons Indiciaires)
```sql
CREATE TABLE carrieres_echelons (
    id VARCHAR(36) PRIMARY KEY,
    agent_id VARCHAR(36) NOT NULL REFERENCES agents(id) ON DELETE RESTRICT,
    grade VARCHAR(50) NOT NULL,
    echelon INTEGER NOT NULL,
    indice_nouveau INTEGER NOT NULL,
    date_effet DATE NOT NULL,
    mode_avancement VARCHAR(50) NOT NULL, -- 'ANCIENNETE', 'CHOIX', 'GRAND_CHOIX'
    reference_arrete VARCHAR(100) NOT NULL,
    cree_par VARCHAR(36) NOT NULL,
    cree_le TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_echelons_agent ON carrieres_echelons(agent_id, date_effet DESC);
```

#### Table 9 : `promotions_grades` (Tableau d'Avancement de Grade)
```sql
CREATE TABLE promotions_grades (
    id VARCHAR(36) PRIMARY KEY,
    agent_id VARCHAR(36) NOT NULL REFERENCES agents(id) ON DELETE RESTRICT,
    annee_promotion INTEGER NOT NULL,
    grade_origine VARCHAR(50) NOT NULL,
    grade_vise VARCHAR(50) NOT NULL,
    note_evaluation_retenue NUMERIC(4,2),
    avis_commission_avancement VARCHAR(50), -- 'FAVORABLE', 'DEFAVORABLE', 'AJOURNE'
    decision_ministre VARCHAR(50), -- 'PROMU', 'NON_RETENU'
    reference_decret_promotion VARCHAR(100),
    date_effet DATE,
    cree_le TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_promotions_annee ON promotions_grades(annee_promotion, avis_commission_avancement);
```

---

### 3.5 Domaine Formations et Qualifications Policières

#### Table 10 : `formations` (Catalogue des Formations et Stages Policiers)
```sql
CREATE TABLE formations (
    id VARCHAR(36) PRIMARY KEY,
    code_formation VARCHAR(50) UNIQUE NOT NULL, -- ex: 'TIR-REGLEMENTAIRE', 'OPJ-MODULE-1', 'SECOURISME-TACTIQUE'
    intitule VARCHAR(150) NOT NULL,
    organisme_formateur VARCHAR(100) NOT NULL DEFAULT 'ECOLE_NATIONALE_POLICE',
    duree_heures INTEGER NOT NULL,
    duree_validite_mois INTEGER NOT NULL DEFAULT 12, -- 0 si validité permanente
    recyclage_obligatoire BOOLEAN NOT NULL DEFAULT TRUE,
    est_active BOOLEAN NOT NULL DEFAULT TRUE,
    cree_le TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

#### Table 11 : `qualifications_agents` (Habilitations et Certificats Individuels)
```sql
CREATE TABLE qualifications_agents (
    id VARCHAR(36) PRIMARY KEY,
    agent_id VARCHAR(36) NOT NULL REFERENCES agents(id) ON DELETE RESTRICT,
    formation_id VARCHAR(36) NOT NULL REFERENCES formations(id) ON DELETE RESTRICT,
    numero_certificat VARCHAR(100) NOT NULL,
    date_obtention DATE NOT NULL,
    date_expiration DATE, -- Recalculée automatiquement selon duree_validite_mois
    statut_qualification VARCHAR(30) NOT NULL DEFAULT 'VALIDE', -- 'VALIDE', 'EXPIREE', 'SUSPENDUE'
    aptitude_operationnelle_associee VARCHAR(100), -- 'PORT_ARME_SERVICE', 'CONDUITE_RAPIDE', 'HABILITATION_OPJ'
    cree_le TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_qualif_agent ON qualifications_agents(agent_id, statut_qualification);
CREATE INDEX idx_qualif_expiration ON qualifications_agents(date_expiration);
```

---

### 3.6 Domaine Éléments Variables de Solde et Exports

#### Table 12 : `elements_solde` (Primes, Astreintes et Heures de Nuit)
```sql
CREATE TABLE elements_solde (
    id VARCHAR(36) PRIMARY KEY,
    agent_id VARCHAR(36) NOT NULL REFERENCES agents(id) ON DELETE RESTRICT,
    mois INTEGER NOT NULL CHECK (mois BETWEEN 1 AND 12),
    annee INTEGER NOT NULL,
    type_element VARCHAR(50) NOT NULL, -- 'HEURES_NUIT', 'ASTREINTE', 'INDEMNITE_ELOIGNEMENT', 'PRIME_FONCTION'
    quantite NUMERIC(6,2) NOT NULL,
    taux_unitaire NUMERIC(10,2) NOT NULL,
    montant_total NUMERIC(12,2) GENERATED ALWAYS AS (quantite * taux_unitaire) STORED,
    statut_validation VARCHAR(30) NOT NULL DEFAULT 'EN_ATTENTE', -- 'EN_ATTENTE', 'VALIDE', 'TRANSMIS_SOLDE'
    valide_par VARCHAR(36),
    cree_le TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_solde_periode ON elements_solde(annee, mois, statut_validation);
```

#### Table 13 : `exports_solde` (Registre d'Audit des Exports vers la Solde Nationale)
```sql
CREATE TABLE exports_solde (
    id VARCHAR(36) PRIMARY KEY,
    reference_export VARCHAR(50) UNIQUE NOT NULL,
    mois INTEGER NOT NULL,
    annee INTEGER NOT NULL,
    nombre_lignes INTEGER NOT NULL,
    montant_total_global NUMERIC(14,2) NOT NULL,
    empreinte_sha256_fichier VARCHAR(64) NOT NULL, -- Checksum forensique du fichier d'export
    genere_par VARCHAR(36) NOT NULL,
    date_export TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

---

### 3.7 Domaine Sécurisé : Discipline et Aptitude Administrative

#### Table 14 : `dossiers_disciplinaires` (Strictement Cloisonné)
Réservé exclusivement aux officiers de la Direction Générale et membres de la Commission de discipline.
```sql
CREATE TABLE dossiers_disciplinaires (
    id VARCHAR(36) PRIMARY KEY,
    agent_id VARCHAR(36) NOT NULL REFERENCES agents(id) ON DELETE RESTRICT,
    numero_dossier VARCHAR(50) UNIQUE NOT NULL,
    phase_procedure VARCHAR(50) NOT NULL, -- 'ALLEGATION', 'ENQUETE_INTERNE', 'COMMISSION_DISCIPLINE', 'SANCTION_PRONONCEE', 'CLASSEMENT_SANS_SUITE'
    date_faits DATE NOT NULL,
    description_sommaire TEXT NOT NULL,
    officier_instructeur_id VARCHAR(36) NOT NULL,
    sanction_retenue VARCHAR(100), -- 'AVERTISSEMENT', 'BLAME', 'RETROGRADATION', 'SUSPENSION_TEMPORAIRE', 'REVOCATION'
    date_decision DATE,
    motif_decision TEXT,
    statut_dossier VARCHAR(30) NOT NULL DEFAULT 'EN_COURS', -- 'EN_COURS', 'CLOS', 'EN_RECOURS'
    niveau_confidentialite VARCHAR(30) NOT NULL DEFAULT 'TRES_SECRET',
    cree_le TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    modifie_le TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_discipline_agent ON dossiers_disciplinaires(agent_id);
```

#### Table 15 : `aptitudes_administratives` (Sans Aucune Donnée Médicale — Nomenclature Fermée Stricte)
Enregistre la décision administrative d'aptitude opérationnelle à l'exclusion absolue de tout diagnostic, pathologie ou donnée médicale, conformément aux exigences R3 et R5.
```sql
CREATE TABLE aptitudes_administratives (
    id VARCHAR(36) PRIMARY KEY,
    agent_id VARCHAR(36) NOT NULL REFERENCES agents(id) ON DELETE RESTRICT,
    numero_certificat_administratif VARCHAR(100) UNIQUE NOT NULL,
    type_conclusion VARCHAR(50) NOT NULL CHECK (type_conclusion IN (
        'APTE_SANS_RESTRICTION', 'APTE_AVEC_RESTRICTIONS', 'INAPTE_TEMPORAIRE', 'INAPTE_DEFINITIF'
    )),
    date_decision DATE NOT NULL,
    date_expiration DATE,
    -- Nomenclature fermée stricte des restrictions administratives (exclusion absolue de texte libre médical)
    code_restriction VARCHAR(50) NOT NULL DEFAULT 'AUCUNE_RESTRICTION' CHECK (code_restriction IN (
        'AUCUNE_RESTRICTION',
        'DISPENSE_PORT_ARME',
        'POSTE_SEDENTAIRE',
        'EXEMPTION_PATROUILLE_NOCTURNE',
        'EXEMPTION_EFFORT_INTENSE',
        'INAPTE_CONDUITE_VEHICULE_URGENCE',
        'INAPTE_TERRAIN_OPERATIONNEL',
        'AMENAGEMENT_POSTE_INTERIEUR'
    )),
    identifiant_medecin_militaire_referent VARCHAR(100) NOT NULL, -- Référence administrative de l'officier de santé
    reference_certificat_scelle VARCHAR(100) NOT NULL, -- Identifiant du dossier scellé conservé au service de santé militaire
    cree_le TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (date_expiration IS NULL OR date_expiration >= date_decision)
);
CREATE INDEX idx_aptitude_agent ON aptitudes_administratives(agent_id);
CREATE INDEX idx_aptitude_conclusion ON aptitudes_administratives(type_conclusion, code_restriction);
```

---

### 3.8 Domaine Paramétrage Dynamique & Form Builder

#### Table 16 : `listes_valeurs` et `elements_liste_valeurs` (Nomenclatures Éditables)
```sql
CREATE TABLE listes_valeurs (
    id VARCHAR(36) PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL, -- 'GRADES_POLICE', 'MOTIFS_MUTATION', 'SPECIALITES_OPERATIONNELLES'
    libelle VARCHAR(150) NOT NULL,
    description TEXT,
    est_systeme BOOLEAN NOT NULL DEFAULT FALSE,
    cree_le TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE elements_liste_valeurs (
    id VARCHAR(36) PRIMARY KEY,
    liste_valeurs_id VARCHAR(36) NOT NULL REFERENCES listes_valeurs(id) ON DELETE CASCADE,
    code_element VARCHAR(50) NOT NULL,
    libelle VARCHAR(150) NOT NULL,
    ordre INTEGER NOT NULL DEFAULT 0,
    est_actif BOOLEAN NOT NULL DEFAULT TRUE,
    cree_le TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(liste_valeurs_id, code_element)
);
CREATE INDEX idx_elem_liste ON elements_liste_valeurs(liste_valeurs_id, est_actif, ordre);
```

#### Table 17 : `champs_personnalises` et `valeurs_champs_dynamiques` (Moteur Form Builder EAV Robuste)
La table `champs_personnalises` constitue la table maîtresse des définitions de champs. Son identifiant primaire `id` et son code technique `code_champ` sont pérennes et invariants à travers les versions de configuration, garantissant qu'aucune valeur saisie ne devienne orpheline ou invisible lors d'une montée de version ou d'un rollback.
```sql
CREATE TABLE champs_personnalises (
    id VARCHAR(36) PRIMARY KEY,
    entite_cible VARCHAR(50) NOT NULL CHECK (entite_cible IN ('AGENT', 'DEMANDE_CONGE', 'AFFECTATION', 'FORMATION', 'EVALUATION')),
    code_champ VARCHAR(50) NOT NULL,
    libelle VARCHAR(150) NOT NULL,
    type_donnee VARCHAR(30) NOT NULL CHECK (type_donnee IN ('TEXTE', 'DATE', 'NOMBRE', 'LISTE', 'BOOLEEN', 'PIECE_JOINTE')),
    sous_type VARCHAR(30),
    liste_valeurs_id VARCHAR(36) REFERENCES listes_valeurs(id),
    est_obligatoire BOOLEAN NOT NULL DEFAULT FALSE,
    est_actif BOOLEAN NOT NULL DEFAULT TRUE,
    ordre_affichage INTEGER NOT NULL DEFAULT 0,
    aide_saisie TEXT,
    version_creation_id VARCHAR(36),
    cree_le TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    modifie_le TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    -- Contrainte d'unicité invariante : le code_champ est unique par entité cible
    CONSTRAINT uq_champs_entite_code UNIQUE (entite_cible, code_champ),
    -- Interdiction stricte de collision avec les colonnes maîtresses réservées du schéma
    CONSTRAINT chk_champs_non_systeme CHECK (lower(code_champ) NOT IN (
        'id', 'matricule', 'numero_carte_nationale', 'nom', 'prenom', 
        'date_naissance', 'lieu_naissance', 'genre', 'situation_familiale', 
        'nombre_enfants', 'telephone_professionnel', 'telephone_personnel', 
        'email_professionnel', 'date_recrutement', 'date_titularisation', 
        'corps', 'grade_actuel', 'echelon_actuel', 'indice_solde', 
        'unite_actuelle_id', 'statut_administratif', 'est_actif', 
        'cree_le', 'modifie_le'
    )),
    -- Interdiction stricte de mots-clés médicaux ou de santé dans le code ou le libellé (Exigences R3 & R5)
    CONSTRAINT chk_champs_interdiction_medicale CHECK (
        lower(code_champ) !~ '(sante|medical|medecin|maladie|pathologie|traitement|hopital|clinique|diagnostic|vih|sida|diabete|psychiatrie|psy|infirmit|ordonnance|posologie|sang|groupe_sanguin|handicap|grossesse)'
        AND lower(libelle) !~ '(santé|sante|médical|medical|médecin|medecin|maladie|pathologie|traitement|hôpital|hopital|clinique|diagnostic|vih|sida|diabète|diabete|psychiatrie|psy|infirmité|infirmite|ordonnance|posologie|sang|groupe sanguin|handicap|grossesse)'
    )
);
CREATE INDEX idx_champs_entite_actif ON champs_personnalises(entite_cible, est_actif, ordre_affichage);

CREATE TABLE valeurs_champs_dynamiques (
    id VARCHAR(36) PRIMARY KEY,
    entite_cible VARCHAR(50) NOT NULL,
    entite_id VARCHAR(36) NOT NULL, -- Clé étrangère logique vers agents(id), etc.
    champ_id VARCHAR(36) NOT NULL REFERENCES champs_personnalises(id) ON DELETE RESTRICT,
    valeur_texte TEXT,
    valeur_nombre NUMERIC(14,2),
    valeur_date TIMESTAMP WITH TIME ZONE,
    valeur_booleen BOOLEAN,
    valeur_fichier_id VARCHAR(36),
    modifie_par VARCHAR(36) NOT NULL,
    modifie_le TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_valeurs_champs_dynamiques UNIQUE (entite_cible, entite_id, champ_id)
);
CREATE INDEX idx_valeurs_dynamiques ON valeurs_champs_dynamiques(entite_cible, entite_id);
CREATE INDEX idx_valeurs_champ_id ON valeurs_champs_dynamiques(champ_id);
```

#### Table 18 : `versions_configuration_rh` (Snapshots Immuables et Rollback Instantané)
```sql
CREATE TABLE versions_configuration_rh (
    id VARCHAR(36) PRIMARY KEY,
    numero_version VARCHAR(20) UNIQUE NOT NULL, -- ex: 'v1.0.0', 'v1.1.0'
    statut VARCHAR(30) NOT NULL DEFAULT 'BROUILLON', -- 'BROUILLON', 'VALIDEE', 'ACTIVE', 'ARCHIVEE'
    snapshot_configuration_json JSONB NOT NULL, -- Arbre complet sérialisé (formulaires, champs, règles)
    commentaire_evolution TEXT NOT NULL,
    auteur_id VARCHAR(36) NOT NULL,
    valide_par_id VARCHAR(36),
    date_creation TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    date_publication TIMESTAMP WITH TIME ZONE,
    est_version_courante BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE UNIQUE INDEX idx_version_courante_unique ON versions_configuration_rh(est_version_courante) 
WHERE est_version_courante = TRUE;
```

---

### 3.9 Domaine IAM, Authentification, Sessions et Résilience WAN

#### Table 19 : `comptes_utilisateurs` (Gestion des Identités et des 6 Rôles RBAC)
Matérialise les comptes d'accès, les mots de passe sécurisés par Argon2id et les compteurs de verrouillage après échecs.
```sql
CREATE TABLE comptes_utilisateurs (
    id VARCHAR(36) PRIMARY KEY,
    identifiant VARCHAR(50) UNIQUE NOT NULL, -- Login de connexion unique
    mot_de_passe_hash_argon2id VARCHAR(255) NOT NULL, -- Empreinte calculée via Argon2id (mémoire-dure)
    role VARCHAR(30) NOT NULL CHECK (role IN (
        'ADMIN_TECHNIQUE', 'ADMIN_FONCTIONNEL_RH', 'GESTIONNAIRE_RH', 
        'CHEF_DE_SERVICE', 'AGENT', 'AUDITEUR'
    )),
    agent_id VARCHAR(36) UNIQUE REFERENCES agents(id) ON DELETE RESTRICT, -- NULL pour comptes techniques/auditeurs purs
    est_actif BOOLEAN NOT NULL DEFAULT TRUE,
    tentatives_echouees INTEGER NOT NULL DEFAULT 0,
    bloque_jusqu_a TIMESTAMP WITH TIME ZONE, -- Verrouillage temporaire ou permanent après 5 échecs consécutifs
    doit_changer_mot_de_passe BOOLEAN NOT NULL DEFAULT FALSE,
    derniere_connexion_le TIMESTAMP WITH TIME ZONE,
    derniere_ip_connexion VARCHAR(45),
    cree_le TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    modifie_le TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_comptes_role ON comptes_utilisateurs(role, est_actif);
CREATE INDEX idx_comptes_agent ON comptes_utilisateurs(agent_id);
```

#### Table 20 : `sessions_actives` (Sessions Sécurisées et Tolérance WAN)
Enregistre les sessions authentifiées actives avec jetons scellés et tolérance aux bascules réseau des commissariats.
```sql
CREATE TABLE sessions_actives (
    id VARCHAR(36) PRIMARY KEY,
    utilisateur_id VARCHAR(36) NOT NULL REFERENCES comptes_utilisateurs(id) ON DELETE CASCADE,
    jeton_session_hache VARCHAR(64) UNIQUE NOT NULL, -- SHA-256 du jeton secret client
    adresse_ip VARCHAR(45) NOT NULL,
    plage_ip_sous_reseau VARCHAR(45), -- Tolérance de sous-réseau /24 pour secours 4G des régions
    agent_navigateur TEXT,
    expire_le TIMESTAMP WITH TIME ZONE NOT NULL,
    derniere_activite_le TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    cree_le TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_sessions_utilisateur ON sessions_actives(utilisateur_id);
CREATE INDEX idx_sessions_expiration ON sessions_actives(expire_le);
```

#### Table 21 : `registre_idempotence` (Résilience Réseau WAN et Prévention des Doublons)
Garantit l'idempotence des opérations critiques (mutations, soldes, congés) en cas de timeout réseau WAN.
```sql
CREATE TABLE registre_idempotence (
    cle_idempotence VARCHAR(64) PRIMARY KEY, -- En-tête HTTP 'Idempotency-Key' (UUID v4)
    utilisateur_id VARCHAR(36) NOT NULL REFERENCES comptes_utilisateurs(id) ON DELETE CASCADE,
    route_api VARCHAR(100) NOT NULL,
    code_statut_http INTEGER NOT NULL,
    corps_reponse_json JSONB NOT NULL,
    cree_le TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expire_le TIMESTAMP WITH TIME ZONE NOT NULL
);
CREATE INDEX idx_idempotence_expiration ON registre_idempotence(expire_le);
```

---

### 3.10 Table Transversale de Sécurité : `journaux_audit` (Chaînage Cryptographique SHA-256 & Trigger d'Immuabilité)

#### Table 22 : `journaux_audit` (Journal Forensique Append-Only)
```sql
CREATE TABLE journaux_audit (
    id BIGSERIAL PRIMARY KEY,
    horodatage TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    utilisateur_id VARCHAR(36) NOT NULL REFERENCES comptes_utilisateurs(id) ON DELETE RESTRICT,
    nom_utilisateur VARCHAR(100) NOT NULL,
    role_utilise VARCHAR(50) NOT NULL,
    adresse_ip VARCHAR(45) NOT NULL,
    action_type VARCHAR(50) NOT NULL, -- 'CONNEXION', 'MUTATION', 'VALIDATION_CONGE', 'EXPORT_DONNEES', 'CONSULTATION_SENSIBLE', 'ROLLBACK_CONFIG'
    entite_cible VARCHAR(50) NOT NULL,
    entite_id VARCHAR(36),
    details_operation_json JSONB NOT NULL,
    statut_operation VARCHAR(20) NOT NULL DEFAULT 'SUCCES',
    empreinte_precedente VARCHAR(64) NOT NULL, -- Hash SHA-256 de la ligne N-1
    empreinte_courante VARCHAR(64) NOT NULL -- Hash SHA-256 de la ligne N
);
CREATE INDEX idx_audit_horodatage ON journaux_audit(horodatage DESC);
CREATE INDEX idx_audit_utilisateur ON journaux_audit(utilisateur_id);
CREATE INDEX idx_audit_action ON journaux_audit(action_type);

-- Trigger d'immuabilité absolue interdisant formellement tout UPDATE et DELETE sur les journaux d'audit
CREATE OR REPLACE FUNCTION fn_audit_immuable()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'VIOLATION SECURITE : Le journal d audit est strictement immuable. Les operations UPDATE, DELETE et TRUNCATE sont formellement prohibees.'
        USING ERRCODE = '23505';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tg_audit_immuable
BEFORE UPDATE OR DELETE ON journaux_audit
FOR EACH ROW
EXECUTE FUNCTION fn_audit_immuable();
```

---

## 4. Stratégie d'Historique Immuable des Affectations et Mutations

La gestion des carrières policières impose qu'aucun événement d'affectation ne soit effacé lors d'une mutation.

### 4.1 Mécanisme Transactionnel de Mutation
Lorsqu'un arrêté ministériel ordonne la mutation d'un agent de l'Unité A vers l'Unité B :
1. **Transaction atomique** ouverte sur la base de données.
2. Clôture de l'affectation active précédente :
   - `date_fin = date_mutation_effet - 1 jour`
   - `est_affectation_courante = FALSE`
3. Création de la nouvelle affectation :
   - `date_debut = date_mutation_effet`
   - `date_fin = NULL`
   - `est_affectation_courante = TRUE`
   - `numero_decision_arrete = <référence officielle>`
4. Mise à jour de l'unité courante dans `agents` :
   - `unite_actuelle_id = B`
5. Enregistrement immédiat dans `journaux_audit` avec empreinte SHA-256.
6. Validation définitive de la transaction (*COMMIT*).

Grâce à l'index conditionnel unique `idx_unique_affectation_courante`, le moteur de base de données garantit qu'il est rigoureusement impossible pour un agent de posséder deux affectations courantes simultanées.
L'historique complet reste consultable à vie pour le calcul des pensions, des médailles d'honneur et des tableaux d'avancement.
