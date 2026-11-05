-- ============================================================================
-- SCHEMA DDL COMPLET — SYSTÈME DE GESTION DES RESSOURCES HUMAINES (SIRH)
-- POLICE NATIONALE DE LA RÉPUBLIQUE DE DJIBOUTI (DGPN)
-- 24 Tables Relationnelles, Contraintes d'Intégrité Stricte, Triggers d'Immuabilité
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Unités Organisationnelles et Territoriales
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS unites (
    id VARCHAR(36) PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    nom VARCHAR(150) NOT NULL,
    type_unite VARCHAR(50) NOT NULL,
    unite_parente_id VARCHAR(36) REFERENCES unites(id) ON DELETE RESTRICT,
    responsable_agent_id VARCHAR(36),
    region_administrative VARCHAR(50) NOT NULL DEFAULT 'DJIBOUTI',
    adresse_geographique TEXT,
    telephone_contact VARCHAR(30),
    est_active BOOLEAN NOT NULL DEFAULT TRUE,
    cree_le TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    modifie_le TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (unite_parente_id IS NULL OR unite_parente_id <> id)
);

CREATE INDEX IF NOT EXISTS idx_unites_parente ON unites(unite_parente_id);
CREATE INDEX IF NOT EXISTS idx_unites_region ON unites(region_administrative);

CREATE OR REPLACE FUNCTION fn_empecher_cycle_unites()
RETURNS TRIGGER AS $$
DECLARE
    v_courant_id VARCHAR(36);
BEGIN
    IF NEW.unite_parente_id IS NOT NULL THEN
        IF NEW.unite_parente_id = NEW.id THEN
            RAISE EXCEPTION 'VIOLATION HIERARCHIE : Une unite ne peut pas etre sa propre unite parente (id: %).', NEW.id
                USING ERRCODE = '22000';
        END IF;

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

DROP TRIGGER IF EXISTS tg_empecher_cycle_unites ON unites;
CREATE TRIGGER tg_empecher_cycle_unites
BEFORE INSERT OR UPDATE OF unite_parente_id ON unites
FOR EACH ROW
EXECUTE FUNCTION fn_empecher_cycle_unites();

-- ----------------------------------------------------------------------------
-- 2. Postes Opérationnels et Budgétaires
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS postes (
    id VARCHAR(36) PRIMARY KEY,
    code_poste VARCHAR(50) UNIQUE NOT NULL,
    intitule VARCHAR(150) NOT NULL,
    unite_id VARCHAR(36) NOT NULL REFERENCES unites(id) ON DELETE RESTRICT,
    grade_requis VARCHAR(50) NOT NULL,
    effectif_requis INTEGER NOT NULL DEFAULT 1,
    est_vacant BOOLEAN NOT NULL DEFAULT TRUE,
    description_emploi TEXT,
    cree_le TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    modifie_le TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_postes_id_unite UNIQUE (id, unite_id)
);

CREATE INDEX IF NOT EXISTS idx_postes_unite ON postes(unite_id);
CREATE INDEX IF NOT EXISTS idx_postes_vacance ON postes(est_vacant);

-- ----------------------------------------------------------------------------
-- 3. Dossiers Individuels des Agents de Police
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS agents (
    id VARCHAR(36) PRIMARY KEY,
    matricule VARCHAR(30) UNIQUE NOT NULL,
    numero_carte_nationale VARCHAR(50) UNIQUE NOT NULL,
    nom VARCHAR(100) NOT NULL,
    prenom VARCHAR(100) NOT NULL,
    date_naissance DATE NOT NULL,
    lieu_naissance VARCHAR(100) NOT NULL,
    genre VARCHAR(10) NOT NULL CHECK (genre IN ('MASCULIN', 'FEMININ')),
    situation_familiale VARCHAR(30) NOT NULL DEFAULT 'CELIBATAIRE',
    nombre_enfants INTEGER NOT NULL DEFAULT 0,
    telephone_professionnel VARCHAR(30),
    telephone_personnel VARCHAR(30),
    email_professionnel VARCHAR(150) UNIQUE,
    date_recrutement DATE NOT NULL,
    date_titularisation DATE,
    corps VARCHAR(50) NOT NULL,
    grade_actuel VARCHAR(50) NOT NULL,
    echelon_actuel INTEGER NOT NULL DEFAULT 1,
    indice_solde INTEGER NOT NULL,
    unite_actuelle_id VARCHAR(36) NOT NULL REFERENCES unites(id) ON DELETE RESTRICT,
    statut_administratif VARCHAR(50) NOT NULL DEFAULT 'EN_ACTIVITE',
    est_actif BOOLEAN NOT NULL DEFAULT TRUE,
    cree_le TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    modifie_le TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_agents_unite ON agents(unite_actuelle_id);
CREATE INDEX IF NOT EXISTS idx_agents_corps_grade ON agents(corps, grade_actuel);
CREATE INDEX IF NOT EXISTS idx_agents_statut ON agents(statut_administratif, est_actif);

-- ----------------------------------------------------------------------------
-- 4. Affectations et Mutations Immuables (Append-Only)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS affectations (
    id VARCHAR(36) PRIMARY KEY,
    agent_id VARCHAR(36) NOT NULL REFERENCES agents(id) ON DELETE RESTRICT,
    unite_id VARCHAR(36) NOT NULL REFERENCES unites(id) ON DELETE RESTRICT,
    poste_id VARCHAR(36),
    type_mouvement VARCHAR(50) NOT NULL,
    date_debut DATE NOT NULL,
    date_fin DATE,
    motif_mouvement TEXT NOT NULL,
    reference_arrete_ou_decision VARCHAR(100) NOT NULL,
    est_affectation_courante BOOLEAN NOT NULL DEFAULT FALSE,
    cree_par VARCHAR(36) NOT NULL,
    cree_le TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (date_fin IS NULL OR date_fin >= date_debut),
    CONSTRAINT fk_affectations_poste_unite FOREIGN KEY (poste_id, unite_id) 
        REFERENCES postes(id, unite_id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_affectations_agent ON affectations(agent_id, date_debut DESC);
CREATE INDEX IF NOT EXISTS idx_affectations_unite ON affectations(unite_id, date_debut DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_affectation_courante ON affectations(agent_id) 
WHERE est_affectation_courante = TRUE;

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

DROP TRIGGER IF EXISTS tg_verifier_poste_unite ON affectations;
CREATE TRIGGER tg_verifier_poste_unite
BEFORE INSERT OR UPDATE ON affectations
FOR EACH ROW
EXECUTE FUNCTION fn_verifier_poste_unite_affectation();

CREATE OR REPLACE FUNCTION fn_affectations_immuable()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'VIOLATION INTEGRITE : L historique des affectations est immuable. La suppression d une affectation est formellement interdite.'
            USING ERRCODE = '23505';
    ELSIF TG_OP = 'UPDATE' THEN
        IF OLD.est_affectation_courante = FALSE THEN
            RAISE EXCEPTION 'VIOLATION INTEGRITE : Une affectation historique passee est scellee et ne peut etre modifiee.'
                USING ERRCODE = '23505';
        END IF;

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

        IF NEW.est_affectation_courante = TRUE AND OLD.est_affectation_courante = TRUE THEN
            RAISE EXCEPTION 'VIOLATION INTEGRITE : Une affectation courante ne peut pas etre mise a jour in-place. Une nouvelle affectation doit etre inseree.'
                USING ERRCODE = '23505';
        END IF;

        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tg_affectations_immuable ON affectations;
CREATE TRIGGER tg_affectations_immuable
BEFORE UPDATE OR DELETE ON affectations
FOR EACH ROW
EXECUTE FUNCTION fn_affectations_immuable();

-- ----------------------------------------------------------------------------
-- 5. Types de Congés
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS types_conges (
    id VARCHAR(36) PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
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

-- ----------------------------------------------------------------------------
-- 6. Soldes de Congés Annuels
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS soldes_conges (
    id VARCHAR(36) PRIMARY KEY,
    agent_id VARCHAR(36) NOT NULL REFERENCES agents(id) ON DELETE RESTRICT,
    type_conge_id VARCHAR(36) NOT NULL REFERENCES types_conges(id) ON DELETE RESTRICT,
    annee INTEGER NOT NULL,
    jours_acquis NUMERIC(5,1) NOT NULL DEFAULT 30.0,
    jours_reportes NUMERIC(5,1) NOT NULL DEFAULT 0.0,
    jours_pris NUMERIC(5,1) NOT NULL DEFAULT 0.0,
    jours_en_attente NUMERIC(5,1) NOT NULL DEFAULT 0.0,
    jours_restants NUMERIC(5,1) GENERATED ALWAYS AS (jours_acquis + jours_reportes - jours_pris - jours_en_attente) STORED,
    cree_le TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    modifie_le TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(agent_id, type_conge_id, annee)
);

CREATE INDEX IF NOT EXISTS idx_soldes_agent_annee ON soldes_conges(agent_id, annee);

-- ----------------------------------------------------------------------------
-- 7. Demandes de Congés
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS demandes_conges (
    id VARCHAR(36) PRIMARY KEY,
    agent_id VARCHAR(36) NOT NULL REFERENCES agents(id) ON DELETE RESTRICT,
    type_conge_id VARCHAR(36) NOT NULL REFERENCES types_conges(id) ON DELETE RESTRICT,
    date_debut DATE NOT NULL,
    date_fin DATE NOT NULL,
    nombre_jours NUMERIC(5,1) NOT NULL,
    motif TEXT,
    statut VARCHAR(30) NOT NULL DEFAULT 'SOUMIS',
    decision_chef_service VARCHAR(30),
    motif_refus_chef TEXT,
    date_decision_chef TIMESTAMP WITH TIME ZONE,
    chef_service_id VARCHAR(36),
    decision_rh VARCHAR(30),
    motif_refus_rh TEXT,
    date_decision_rh TIMESTAMP WITH TIME ZONE,
    gestionnaire_rh_id VARCHAR(36),
    version_optimiste INTEGER NOT NULL DEFAULT 1,
    motif_annulation TEXT,
    cree_le TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    modifie_le TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (date_fin >= date_debut)
);

CREATE INDEX IF NOT EXISTS idx_demandes_agent_statut ON demandes_conges(agent_id, statut);
CREATE INDEX IF NOT EXISTS idx_demandes_periode ON demandes_conges(date_debut, date_fin);

-- ----------------------------------------------------------------------------
-- 7b. Validations de Congés (Visas hiérarchiques et validations RH)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS validations_conges (
    id VARCHAR(36) PRIMARY KEY,
    demande_id VARCHAR(36) NOT NULL REFERENCES demandes_conges(id) ON DELETE CASCADE,
    etape VARCHAR(30) NOT NULL, -- 'VISA_CHEF', 'VALIDATION_RH'
    valideur_id VARCHAR(36) NOT NULL REFERENCES agents(id) ON DELETE RESTRICT,
    role_valideur VARCHAR(30) NOT NULL,
    decision VARCHAR(30) NOT NULL, -- 'FAVORABLE', 'DEFAVORABLE', 'APPROUVE', 'REFUSE'
    motif_refus TEXT,
    date_decision TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    commentaire TEXT,
    cree_le TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_validations_demande ON validations_conges(demande_id);
CREATE INDEX IF NOT EXISTS idx_validations_valideur ON validations_conges(valideur_id);

-- ----------------------------------------------------------------------------
-- 7c. Pièces Jointes de Congés
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pieces_jointes_conges (
    id VARCHAR(36) PRIMARY KEY,
    demande_id VARCHAR(36) NOT NULL REFERENCES demandes_conges(id) ON DELETE CASCADE,
    nom_fichier VARCHAR(255) NOT NULL,
    type_mime VARCHAR(100) NOT NULL,
    taille_octets INTEGER NOT NULL,
    reference_stockage VARCHAR(255) NOT NULL,
    date_televersement TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    cree_le TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pieces_jointes_demande ON pieces_jointes_conges(demande_id);

-- ----------------------------------------------------------------------------
-- 8. Carrières et Échelons Indiciaires (Historique et Échelon Actif)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS carrieres_echelons (
    id VARCHAR(36) PRIMARY KEY,
    agent_id VARCHAR(36) NOT NULL REFERENCES agents(id) ON DELETE RESTRICT,
    corps VARCHAR(50) NOT NULL CHECK (corps IN (
        'OFFICIERS_GENERAUX', 'OFFICIERS_SUPERIEURS', 'OFFICIERS_SUBALTERNES', 
        'SOUS_OFFICIERS', 'GRADES_DE_POLICE', 'AGENTS_DE_POLICE', 'AGENTS', 
        'PERSONNELS_CIVILS', 'SANTE_RATTACHEE'
    )),
    grade VARCHAR(50) NOT NULL,
    echelon INTEGER NOT NULL CHECK (echelon >= 1),
    indice_brut INTEGER NOT NULL CHECK (indice_brut > 0),
    indice_majore INTEGER NOT NULL CHECK (indice_majore > 0),
    date_effet DATE NOT NULL,
    date_fin DATE,
    type_avancement VARCHAR(50) NOT NULL CHECK (type_avancement IN ('ANCIENNETE', 'CHOIX', 'GRAND_CHOIX')),
    numero_arrete VARCHAR(100) NOT NULL,
    est_actif BOOLEAN NOT NULL DEFAULT TRUE,
    cree_par VARCHAR(36) NOT NULL,
    cree_le TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_carrieres_dates CHECK (date_fin IS NULL OR date_fin >= date_effet)
);

CREATE INDEX IF NOT EXISTS idx_carrieres_echelons_agent ON carrieres_echelons(agent_id, date_effet DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_carrieres_echelons_actif ON carrieres_echelons(agent_id) WHERE est_actif = TRUE;

-- ----------------------------------------------------------------------------
-- 9. Tableaux d'Avancement et Promotions de Grade (Décrets et Arrêtés)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS promotions_grades (
    id VARCHAR(36) PRIMARY KEY,
    agent_id VARCHAR(36) NOT NULL REFERENCES agents(id) ON DELETE RESTRICT,
    ancien_grade VARCHAR(50) NOT NULL,
    nouveau_grade VARCHAR(50) NOT NULL,
    date_promotion DATE NOT NULL,
    numero_decret VARCHAR(100) NOT NULL,
    commission_date DATE NOT NULL,
    tableau_avancement_annee INTEGER NOT NULL CHECK (tableau_avancement_annee >= 2000),
    note_retenue NUMERIC(4,2) CHECK (note_retenue IS NULL OR (note_retenue >= 0.00 AND note_retenue <= 20.00)),
    avis_commission VARCHAR(50) NOT NULL CHECK (avis_commission IN ('FAVORABLE', 'DEFAVORABLE', 'AJOURNE', 'RESERVE')),
    decision_autorite VARCHAR(50) NOT NULL DEFAULT 'PROMU' CHECK (decision_autorite IN ('PROMU', 'NON_RETENU', 'EN_ATTENTE')),
    cree_par VARCHAR(36) NOT NULL,
    cree_le TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_promotion_grades_distincts CHECK (nouveau_grade <> ancien_grade)
);

CREATE INDEX IF NOT EXISTS idx_promotions_agent ON promotions_grades(agent_id, date_promotion DESC);
CREATE INDEX IF NOT EXISTS idx_promotions_tableau ON promotions_grades(tableau_avancement_annee, avis_commission);

-- ----------------------------------------------------------------------------
-- 10. Positions Statutaires (Activité, Détachement, Disponibilité, Suspension)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS positions_statutaires (
    id VARCHAR(36) PRIMARY KEY,
    agent_id VARCHAR(36) NOT NULL REFERENCES agents(id) ON DELETE RESTRICT,
    position VARCHAR(50) NOT NULL CHECK (position IN (
        'ACTIVITE', 'DETACHEMENT', 'DISPONIBILITE', 'SOUS_LES_DRAPEAUX', 'SUSPENSION_ADMINISTRATIVE'
    )),
    organisme_accueil VARCHAR(150),
    date_debut DATE NOT NULL,
    date_fin DATE,
    maintien_droits_avancement BOOLEAN NOT NULL DEFAULT TRUE,
    reference_decision VARCHAR(100) NOT NULL,
    motif TEXT,
    est_active BOOLEAN NOT NULL DEFAULT TRUE,
    cree_par VARCHAR(36) NOT NULL,
    cree_le TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_positions_dates CHECK (date_fin IS NULL OR date_fin >= date_debut),
    CONSTRAINT chk_positions_detachement CHECK (position <> 'DETACHEMENT' OR organisme_accueil IS NOT NULL),
    CONSTRAINT chk_positions_dispo_droits CHECK (position <> 'DISPONIBILITE' OR maintien_droits_avancement = FALSE),
    CONSTRAINT chk_positions_suspension_droits CHECK (position <> 'SUSPENSION_ADMINISTRATIVE' OR maintien_droits_avancement = FALSE)
);

CREATE INDEX IF NOT EXISTS idx_positions_agent ON positions_statutaires(agent_id, date_debut DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_positions_active_unique ON positions_statutaires(agent_id) WHERE est_active = TRUE;

-- ----------------------------------------------------------------------------
-- 11. Catalogue National des Formations Policières
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS formations (
    id VARCHAR(36) PRIMARY KEY,
    code_formation VARCHAR(50) UNIQUE NOT NULL,
    intitule VARCHAR(150) NOT NULL,
    type VARCHAR(50) NOT NULL DEFAULT 'CONTINUE' CHECK (type IN ('INITIALE', 'CONTINUE', 'RECYCLAGE', 'SPECIALISATION')),
    duree_heures INTEGER NOT NULL CHECK (duree_heures > 0),
    organisme VARCHAR(150) NOT NULL DEFAULT 'ECOLE_NATIONALE_POLICE',
    est_certifiante BOOLEAN NOT NULL DEFAULT TRUE,
    duree_validite_mois INTEGER NOT NULL DEFAULT 12,
    est_active BOOLEAN NOT NULL DEFAULT TRUE,
    cree_le TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_formations_actif ON formations(est_active, type);

-- ----------------------------------------------------------------------------
-- 12. Sessions de Formations et Notes des Agents à l'ENP
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sessions_formations_agents (
    id VARCHAR(36) PRIMARY KEY,
    formation_id VARCHAR(36) NOT NULL REFERENCES formations(id) ON DELETE RESTRICT,
    agent_id VARCHAR(36) NOT NULL REFERENCES agents(id) ON DELETE RESTRICT,
    date_debut DATE NOT NULL,
    date_fin DATE NOT NULL,
    resultat VARCHAR(30) NOT NULL DEFAULT 'INSCRIT' CHECK (resultat IN (
        'INSCRIT', 'EN_COURS', 'VALIDE', 'ECHOUE', 'DISPENSE', 'ABSENT'
    )),
    note_obtenue NUMERIC(4,2) CHECK (note_obtenue IS NULL OR (note_obtenue >= 0.00 AND note_obtenue <= 20.00)),
    commentaires TEXT,
    formateur_responsable VARCHAR(150),
    cree_le TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_sessions_dates CHECK (date_fin >= date_debut),
    CONSTRAINT uq_session_agent UNIQUE (formation_id, agent_id, date_debut)
);

CREATE INDEX IF NOT EXISTS idx_sessions_agent ON sessions_formations_agents(agent_id);
CREATE INDEX IF NOT EXISTS idx_sessions_formation ON sessions_formations_agents(formation_id, date_debut DESC);

-- ----------------------------------------------------------------------------
-- 13. Qualifications et Habilitations (OPJ, APJ, Brevet Tir 365j)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS qualifications_agents (
    id VARCHAR(36) PRIMARY KEY,
    agent_id VARCHAR(36) NOT NULL REFERENCES agents(id) ON DELETE RESTRICT,
    formation_id VARCHAR(36) REFERENCES formations(id) ON DELETE RESTRICT,
    type_qualification VARCHAR(50) NOT NULL CHECK (type_qualification IN (
        'HABILITATION_OPJ', 'HABILITATION_APJ', 'HABILITATION_APJA',
        'CERTIFICAT_TIR_REGLEMENTAIRE', 'BREVET_ARME_FORCE_INTERMEDIAIRE',
        'BREVET_CONDUITE_URGENCE', 'BREVET_MAINTIEN_ORDRE',
        'BREVET_CYBERCRIMINALITE', 'BREVET_POLICE_TECHNIQUE_SCIENTIFIQUE',
        'SECOURISME_TACTIQUE_STOP'
    )),
    numero_carte_agrement VARCHAR(100) NOT NULL,
    date_obtention DATE NOT NULL,
    date_expiration DATE,
    autorite_delivrance VARCHAR(150) NOT NULL,
    statut_actif BOOLEAN NOT NULL DEFAULT TRUE,
    aptitude_operationnelle_associee VARCHAR(100),
    cree_le TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_qualifications_dates CHECK (date_expiration IS NULL OR date_expiration >= date_obtention)
);

CREATE INDEX IF NOT EXISTS idx_qualifications_agent ON qualifications_agents(agent_id, type_qualification, statut_actif);
CREATE INDEX IF NOT EXISTS idx_qualifications_expiration ON qualifications_agents(date_expiration) WHERE statut_actif = TRUE;

-- ----------------------------------------------------------------------------
-- 14. Notations Annuelles (Barème 4 Rubriques /5, Note /20, Zéro Médical)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notations_annuelles (
    id VARCHAR(36) PRIMARY KEY,
    agent_id VARCHAR(36) NOT NULL REFERENCES agents(id) ON DELETE RESTRICT,
    annee INTEGER NOT NULL CHECK (annee >= 2000),
    note_chiffree NUMERIC(4,2) NOT NULL CHECK (note_chiffree >= 0.00 AND note_chiffree <= 20.00),
    appreciation_generale TEXT NOT NULL,
    rigueur_deontologie NUMERIC(4,2) CHECK (rigueur_deontologie IS NULL OR (rigueur_deontologie >= 0.00 AND rigueur_deontologie <= 5.00)),
    competence_technique NUMERIC(4,2) CHECK (competence_technique IS NULL OR (competence_technique >= 0.00 AND competence_technique <= 5.00)),
    disponibilite_operationnelle NUMERIC(4,2) CHECK (disponibilite_operationnelle IS NULL OR (disponibilite_operationnelle >= 0.00 AND disponibilite_operationnelle <= 5.00)),
    sens_commandement_initiative NUMERIC(4,2) CHECK (sens_commandement_initiative IS NULL OR (sens_commandement_initiative >= 0.00 AND sens_commandement_initiative <= 5.00)),
    date_entretien DATE NOT NULL,
    evaluateur_agent_id VARCHAR(36) NOT NULL REFERENCES agents(id) ON DELETE RESTRICT,
    date_notification DATE,
    recours_depose BOOLEAN NOT NULL DEFAULT FALSE,
    motif_recours TEXT,
    decision_recours VARCHAR(50) CHECK (decision_recours IS NULL OR decision_recours IN (
        'MAINTIEN', 'REVISION_HAUSSE', 'REVISION_BAISSE', 'ANNULATION'
    )),
    note_definitive NUMERIC(4,2) CHECK (note_definitive IS NULL OR (note_definitive >= 0.00 AND note_definitive <= 20.00)),
    statut VARCHAR(30) NOT NULL DEFAULT 'SOUMIS' CHECK (statut IN (
        'BROUILLON', 'SOUMIS', 'VISE_CHEF', 'NOTIFIE', 'RECOURS', 'VALIDE_DEFINITIF'
    )),
    cree_le TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    modifie_le TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_notation_agent_annee UNIQUE (agent_id, annee),
    CONSTRAINT chk_notation_dates CHECK (date_notification IS NULL OR date_notification >= date_entretien),
    CONSTRAINT chk_notation_recours CHECK (recours_depose = FALSE OR motif_recours IS NOT NULL),
    CONSTRAINT chk_notations_interdiction_medicale CHECK (
        lower(appreciation_generale) !~ '\y(sante|santé|medical|médical|medecin|médecin|maladie|pathologie|traitement|hopital|hôpital|clinique|diagnostic|vih|sida|diabete|diabète|psychiatrie|psy|infirmite|infirmité|ordonnance|posologie|sang|groupe[ _]sanguin|handicap|grossesse|medicament|médicament|medicaments|médicaments|glycemie|glycémie|tension|tension[ _]artérielle|tension[ _]arterielle|cancer|chirurgie|symptome|symptôme|pouls|temperature|température|consultation)\y'
        AND (
            motif_recours IS NULL OR (
                lower(motif_recours) !~ '\y(sante|santé|medical|médical|medecin|médecin|maladie|pathologie|traitement|hopital|hôpital|clinique|diagnostic|vih|sida|diabete|diabète|psychiatrie|psy|infirmite|infirmité|ordonnance|posologie|sang|groupe[ _]sanguin|handicap|grossesse|medicament|médicament|medicaments|médicaments|glycemie|glycémie|tension|tension[ _]artérielle|tension[ _]arterielle|cancer|chirurgie|symptome|symptôme|pouls|temperature|température|consultation)\y'
            )
        )
    )
);

CREATE INDEX IF NOT EXISTS idx_notations_agent_annee ON notations_annuelles(agent_id, annee);
CREATE INDEX IF NOT EXISTS idx_notations_annee_note ON notations_annuelles(annee, note_chiffree DESC);

-- ----------------------------------------------------------------------------
-- 15. Éléments Variables de Solde (Base Indiciaire 100 DJF/pt, Primes, Nuit, Astreinte)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS elements_solde (
    id VARCHAR(36) PRIMARY KEY,
    agent_id VARCHAR(36) NOT NULL REFERENCES agents(id) ON DELETE RESTRICT,
    mois_annee VARCHAR(7) NOT NULL CHECK (mois_annee ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
    salaire_base_indiciaire NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (salaire_base_indiciaire >= 0),
    prime_sujetion NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (prime_sujetion >= 0),
    prime_risque NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (prime_risque >= 0),
    indemnite_astreinte NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (indemnite_astreinte >= 0),
    heures_nuit_dimanche NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (heures_nuit_dimanche >= 0),
    indemnite_eloignement NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (indemnite_eloignement >= 0),
    total_brut NUMERIC(12,2) GENERATED ALWAYS AS (
        salaire_base_indiciaire + prime_sujetion + prime_risque + indemnite_astreinte + heures_nuit_dimanche + indemnite_eloignement
    ) STORED,
    retenues_statutaires NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (retenues_statutaires >= 0),
    net_a_payer NUMERIC(12,2) GENERATED ALWAYS AS (
        salaire_base_indiciaire + prime_sujetion + prime_risque + indemnite_astreinte + heures_nuit_dimanche + indemnite_eloignement - retenues_statutaires
    ) STORED,
    statut VARCHAR(30) NOT NULL DEFAULT 'CALCULE' CHECK (statut IN ('CALCULE', 'VALIDE', 'CLOTURE', 'EXPORTE')),
    calcule_le TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    valide_par VARCHAR(36),
    CONSTRAINT uq_solde_agent_mois UNIQUE (agent_id, mois_annee)
);

CREATE INDEX IF NOT EXISTS idx_elements_solde_periode ON elements_solde(mois_annee, statut);
CREATE INDEX IF NOT EXISTS idx_elements_solde_agent ON elements_solde(agent_id, mois_annee DESC);

-- ----------------------------------------------------------------------------
-- 16. Registre d'Audit des Exports de Solde (Scellement SHA-256)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS exports_solde (
    id VARCHAR(36) PRIMARY KEY,
    reference_export VARCHAR(100) UNIQUE NOT NULL,
    mois_annee VARCHAR(7) NOT NULL CHECK (mois_annee ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
    date_export TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    operateur_id VARCHAR(36) NOT NULL,
    nombre_agents INTEGER NOT NULL CHECK (nombre_agents >= 0),
    montant_total NUMERIC(14,2) NOT NULL CHECK (montant_total >= 0),
    format VARCHAR(30) NOT NULL CHECK (format IN ('CSV_TRESOR_DJIBOUTI', 'CSV', 'TXT_SEPA', 'XML_TRESOR')),
    empreinte_sha256 VARCHAR(64) NOT NULL,
    contenu_export_chiffre TEXT,
    journal_audit_id BIGINT,
    statut VARCHAR(30) NOT NULL DEFAULT 'GENERE' CHECK (statut IN ('GENERE', 'TRANSMIS', 'ARCHIVE'))
);

CREATE INDEX IF NOT EXISTS idx_exports_solde_periode ON exports_solde(mois_annee, date_export DESC);

-- ----------------------------------------------------------------------------
-- 14. Postes Opérationnels de Service
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS postes_operationnels (
    id VARCHAR(36) PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    libelle VARCHAR(150) NOT NULL,
    description TEXT,
    niveau_qualification_requis VARCHAR(30) NOT NULL DEFAULT 'aucun' 
        CHECK (niveau_qualification_requis IN ('OPJ', 'APJ', 'aucun')),
    tir_requis BOOLEAN NOT NULL DEFAULT FALSE,
    permis_conduire_requis BOOLEAN NOT NULL DEFAULT FALSE,
    unite_id VARCHAR(36) NOT NULL REFERENCES unites(id) ON DELETE RESTRICT,
    effectif_cible INTEGER NOT NULL DEFAULT 1 CHECK (effectif_cible > 0),
    est_actif BOOLEAN NOT NULL DEFAULT TRUE,
    cree_le TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    modifie_le TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_postes_op_unite ON postes_operationnels(unite_id, est_actif);

-- ----------------------------------------------------------------------------
-- 15. Plannings des Vacations Opérationnelles (24/7)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS plannings_vacations (
    id VARCHAR(36) PRIMARY KEY,
    unite_id VARCHAR(36) NOT NULL REFERENCES unites(id) ON DELETE RESTRICT,
    agent_id VARCHAR(36) NOT NULL REFERENCES agents(id) ON DELETE RESTRICT,
    poste_operationnel_id VARCHAR(36) REFERENCES postes_operationnels(id) ON DELETE SET NULL,
    type_vacation VARCHAR(50) NOT NULL CHECK (type_vacation IN (
        '3x8_matin', '3x8_apres_midi', '3x8_nuit', 
        '2x12_jour', '2x12_nuit', 'permanence', 'astreinte'
    )),
    date_debut TIMESTAMP WITH TIME ZONE NOT NULL,
    date_fin TIMESTAMP WITH TIME ZONE NOT NULL,
    statut VARCHAR(30) NOT NULL DEFAULT 'planifie' CHECK (statut IN (
        'planifie', 'valide', 'en_cours', 'termine', 'remplace', 'annule'
    )),
    motif_modification TEXT,
    cree_par VARCHAR(36) NOT NULL,
    cree_le TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    modifie_le TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_vacation_dates CHECK (date_fin > date_debut),
    CONSTRAINT chk_vacation_duree_max CHECK (
        EXTRACT(EPOCH FROM (date_fin - date_debut)) / 3600.0 <= 12.0001
    )
);

CREATE INDEX IF NOT EXISTS idx_plannings_unite_dates ON plannings_vacations(unite_id, date_debut, date_fin);
CREATE INDEX IF NOT EXISTS idx_plannings_agent_dates ON plannings_vacations(agent_id, date_debut DESC);
CREATE INDEX IF NOT EXISTS idx_plannings_statut ON plannings_vacations(statut);

-- Trigger PostgreSQL Anti-Chevauchement Temporel Strict de Vacations
CREATE OR REPLACE FUNCTION fn_verifier_chevauchement_vacations()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.statut NOT IN ('annule', 'remplace') THEN
        IF EXISTS (
            SELECT 1 FROM plannings_vacations
            WHERE agent_id = NEW.agent_id
              AND id <> COALESCE(NEW.id, '')
              AND statut NOT IN ('annule', 'remplace')
              AND (NEW.date_debut, NEW.date_fin) OVERLAPS (date_debut, date_fin)
        ) THEN
            RAISE EXCEPTION 'VIOLATION PLANNING : L agent % est deja planifie sur une vacation chevauchant la periode % a %.',
                NEW.agent_id, NEW.date_debut, NEW.date_fin
                USING ERRCODE = '23505';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tg_verifier_chevauchement_vacations ON plannings_vacations;
CREATE TRIGGER tg_verifier_chevauchement_vacations
BEFORE INSERT OR UPDATE OF agent_id, date_debut, date_fin, statut ON plannings_vacations
FOR EACH ROW
EXECUTE FUNCTION fn_verifier_chevauchement_vacations();

-- ----------------------------------------------------------------------------
-- 16. Remplacements et Gardes Opérationnelles
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS remplacements_gardes (
    id VARCHAR(36) PRIMARY KEY,
    planning_vacation_id VARCHAR(36) NOT NULL REFERENCES plannings_vacations(id) ON DELETE RESTRICT,
    agent_absent_id VARCHAR(36) NOT NULL REFERENCES agents(id) ON DELETE RESTRICT,
    agent_remplacant_id VARCHAR(36) NOT NULL REFERENCES agents(id) ON DELETE RESTRICT,
    motif VARCHAR(50) NOT NULL CHECK (motif IN (
        'conge', 'maladie_sans_diagnostic', 'mission', 'urgence', 'indisponibilite_inopinee', 'suspension'
    )),
    date_remplacement DATE NOT NULL,
    valide_par VARCHAR(36) NOT NULL,
    valide_le TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    statut VARCHAR(30) NOT NULL DEFAULT 'propose' CHECK (statut IN (
        'propose', 'valide', 'rejete', 'effectue'
    )),
    commentaire TEXT,
    journal_audit_id BIGINT,
    cree_le TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_remplacement_agents_distincts CHECK (agent_absent_id <> agent_remplacant_id)
);

CREATE INDEX IF NOT EXISTS idx_remplacements_vacation ON remplacements_gardes(planning_vacation_id);
CREATE INDEX IF NOT EXISTS idx_remplacements_remplacant ON remplacements_gardes(agent_remplacant_id, date_remplacement);

-- ----------------------------------------------------------------------------
-- 17. Dossiers Disciplinaires (Strictement Cloisonnés)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS dossiers_disciplinaires (
    id VARCHAR(36) PRIMARY KEY,
    agent_id VARCHAR(36) NOT NULL REFERENCES agents(id) ON DELETE RESTRICT,
    numero_dossier VARCHAR(50) UNIQUE NOT NULL,
    phase_procedure VARCHAR(50) NOT NULL,
    date_faits DATE NOT NULL,
    description_sommaire TEXT NOT NULL,
    description_faits TEXT,
    rapport_enquete TEXT,
    officier_instructeur_id VARCHAR(36) NOT NULL,
    sanction_retenue VARCHAR(100),
    date_decision DATE,
    motif_decision TEXT,
    statut_dossier VARCHAR(30) NOT NULL DEFAULT 'EN_COURS',
    statut VARCHAR(50) NOT NULL DEFAULT 'instruction',
    niveau_confidentialite VARCHAR(30) NOT NULL DEFAULT 'TRES_SECRET',
    degre_confidentialite VARCHAR(50) NOT NULL DEFAULT 'TRES_SECRET_DISCIPLINE',
    ouvert_par VARCHAR(36),
    date_cloture DATE,
    cree_le TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    modifie_le TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_discipline_agent ON dossiers_disciplinaires(agent_id);

-- Harmonisation des colonnes pour dossiers_disciplinaires si table préexistante
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='dossiers_disciplinaires' AND column_name='rapport_enquete') THEN
        ALTER TABLE dossiers_disciplinaires ADD COLUMN rapport_enquete TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='dossiers_disciplinaires' AND column_name='description_faits') THEN
        ALTER TABLE dossiers_disciplinaires ADD COLUMN description_faits TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='dossiers_disciplinaires' AND column_name='degre_confidentialite') THEN
        ALTER TABLE dossiers_disciplinaires ADD COLUMN degre_confidentialite VARCHAR(50) NOT NULL DEFAULT 'TRES_SECRET_DISCIPLINE';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='dossiers_disciplinaires' AND column_name='ouvert_par') THEN
        ALTER TABLE dossiers_disciplinaires ADD COLUMN ouvert_par VARCHAR(36);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='dossiers_disciplinaires' AND column_name='date_cloture') THEN
        ALTER TABLE dossiers_disciplinaires ADD COLUMN date_cloture DATE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='dossiers_disciplinaires' AND column_name='statut') THEN
        ALTER TABLE dossiers_disciplinaires ADD COLUMN statut VARCHAR(50) NOT NULL DEFAULT 'instruction';
    END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 18. Sanctions Disciplinaires Statutaires (Loi 116/AN/21)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sanctions_disciplinaires (
    id VARCHAR(36) PRIMARY KEY,
    dossier_id VARCHAR(36) NOT NULL REFERENCES dossiers_disciplinaires(id) ON DELETE RESTRICT,
    agent_id VARCHAR(36) NOT NULL REFERENCES agents(id) ON DELETE RESTRICT,
    groupe_sanction VARCHAR(30) NOT NULL CHECK (groupe_sanction IN ('GROUPE_1', 'GROUPE_2', 'GROUPE_3')),
    nature_sanction VARCHAR(50) NOT NULL CHECK (nature_sanction IN (
        'avertissement', 'blame',
        'radiation_tableau_avancement', 'abaissement_echelon', 'exclusion_temporaire',
        'retrogradation', 'mise_retraite_office', 'revocation'
    )),
    duree_exclusion_jours INTEGER CHECK (duree_exclusion_jours IS NULL OR (duree_exclusion_jours >= 1 AND duree_exclusion_jours <= 15)),
    date_effet DATE NOT NULL,
    date_fin DATE,
    date_effacement_prevue DATE,
    est_amnistiee BOOLEAN NOT NULL DEFAULT FALSE,
    reference_arrete VARCHAR(100) NOT NULL,
    prononcee_par VARCHAR(150) NOT NULL,
    date_decision DATE NOT NULL,
    motif_sanction TEXT NOT NULL,
    cree_le TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_sanction_dates CHECK (date_fin IS NULL OR date_fin >= date_effet)
);

CREATE INDEX IF NOT EXISTS idx_sanctions_agent ON sanctions_disciplinaires(agent_id, date_effet DESC);
CREATE INDEX IF NOT EXISTS idx_sanctions_dossier ON sanctions_disciplinaires(dossier_id);

-- ----------------------------------------------------------------------------
-- 19. Aptitudes Administratives (Sans Aucune Donnée Médicale)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS aptitudes_administratives (
    id VARCHAR(36) PRIMARY KEY,
    agent_id VARCHAR(36) NOT NULL REFERENCES agents(id) ON DELETE RESTRICT,
    numero_certificat_administratif VARCHAR(100) UNIQUE NOT NULL,
    decision_aptitude VARCHAR(50) NOT NULL DEFAULT 'APTE_SERVICE_ACTIF',
    type_conclusion VARCHAR(50) NOT NULL DEFAULT 'APTE_SANS_RESTRICTION' CHECK (type_conclusion IN (
        'APTE_SANS_RESTRICTION', 'APTE_AVEC_RESTRICTIONS', 'INAPTE_TEMPORAIRE', 'INAPTE_DEFINITIF'
    )),
    date_decision DATE NOT NULL,
    date_expiration DATE,
    date_echeance DATE,
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
    restriction_operationnelle TEXT,
    reference_arrete_commissariat VARCHAR(100),
    identifiant_medecin_militaire_referent VARCHAR(100) NOT NULL DEFAULT 'MED-MIL-REF',
    reference_certificat_scelle VARCHAR(100) NOT NULL DEFAULT 'SCEL-REF',
    enregistre_par VARCHAR(36),
    cree_le TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (date_expiration IS NULL OR date_expiration >= date_decision)
);

CREATE INDEX IF NOT EXISTS idx_aptitude_agent ON aptitudes_administratives(agent_id);
CREATE INDEX IF NOT EXISTS idx_aptitude_conclusion ON aptitudes_administratives(type_conclusion, code_restriction);

-- Harmonisation des colonnes et contrainte POSIX anti-médicale inviolable
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='aptitudes_administratives' AND column_name='decision_aptitude') THEN
        ALTER TABLE aptitudes_administratives ADD COLUMN decision_aptitude VARCHAR(50) NOT NULL DEFAULT 'APTE_SERVICE_ACTIF';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='aptitudes_administratives' AND column_name='restriction_operationnelle') THEN
        ALTER TABLE aptitudes_administratives ADD COLUMN restriction_operationnelle TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='aptitudes_administratives' AND column_name='date_echeance') THEN
        ALTER TABLE aptitudes_administratives ADD COLUMN date_echeance DATE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='aptitudes_administratives' AND column_name='reference_arrete_commissariat') THEN
        ALTER TABLE aptitudes_administratives ADD COLUMN reference_arrete_commissariat VARCHAR(100);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='aptitudes_administratives' AND column_name='enregistre_par') THEN
        ALTER TABLE aptitudes_administratives ADD COLUMN enregistre_par VARCHAR(36);
    END IF;
END $$;

ALTER TABLE aptitudes_administratives 
    DROP CONSTRAINT IF EXISTS chk_aptitudes_interdiction_medicale;

ALTER TABLE aptitudes_administratives 
    ADD CONSTRAINT chk_aptitudes_interdiction_medicale CHECK (
        (restriction_operationnelle IS NULL OR lower(restriction_operationnelle) !~ '\y(sante|santé|medical|médical|medecin|médecin|maladie|pathologie|traitement|hopital|hôpital|clinique|diagnostic|vih|sida|diabete|diabète|psychiatrie|psy|infirmite|infirmité|ordonnance|posologie|sang|groupe[ _]sanguin|handicap|grossesse|medicament|médicament|medicaments|médicaments|glycemie|glycémie|tension|tension[ _]artérielle|tension[ _]arterielle|cancer|chirurgie|symptome|symptôme|pouls|temperature|température|consultation)\y')
    );

-- ----------------------------------------------------------------------------
-- 20. Modèles de Documents Administratifs PDF
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS modeles_documents_pdf (
    id VARCHAR(36) PRIMARY KEY,
    code_modele VARCHAR(50) UNIQUE NOT NULL CHECK (code_modele IN (
        'ARRETE_MUTATION', 'ATTESTATION_PRESENCE', 'FICHE_INDIVIDUELLE', 
        'ORDRE_MISSION', 'TITRE_CONGE', 'ATTESTATION_TRAVAIL', 
        'ARRETE_AVANCEMENT_ECHELON', 'TABLEAU_SERVICE_BRIGADE'
    )),
    libelle VARCHAR(150) NOT NULL,
    gabarit_texte TEXT NOT NULL,
    version VARCHAR(20) NOT NULL DEFAULT 'v1.0.0',
    champs_variables_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    est_actif BOOLEAN NOT NULL DEFAULT TRUE,
    cree_le TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    modifie_le TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ----------------------------------------------------------------------------
-- 21. Documents Générés & Scellement Cryptographique SHA-256
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS documents_generes (
    id VARCHAR(36) PRIMARY KEY,
    code_modele VARCHAR(50) NOT NULL,
    agent_id VARCHAR(36) REFERENCES agents(id) ON DELETE RESTRICT,
    reference_document VARCHAR(100) UNIQUE NOT NULL,
    titre_document VARCHAR(200) NOT NULL,
    contenu_base64 TEXT NOT NULL,
    empreinte_sha256 VARCHAR(64) NOT NULL,
    donnees_variables_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    signe_par VARCHAR(150) NOT NULL,
    genere_par_utilisateur_id VARCHAR(36) NOT NULL,
    date_generation TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    journal_audit_id BIGINT
);

CREATE INDEX IF NOT EXISTS idx_documents_agent ON documents_generes(agent_id, date_generation DESC);
CREATE INDEX IF NOT EXISTS idx_documents_reference ON documents_generes(reference_document);
CREATE INDEX IF NOT EXISTS idx_documents_sha256 ON documents_generes(empreinte_sha256);

-- ----------------------------------------------------------------------------
-- 16. Listes de Valeurs et Éléments Configurables
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS listes_valeurs (
    id VARCHAR(36) PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    libelle VARCHAR(150) NOT NULL,
    description TEXT,
    est_systeme BOOLEAN NOT NULL DEFAULT FALSE,
    cree_le TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS elements_liste_valeurs (
    id VARCHAR(36) PRIMARY KEY,
    liste_valeurs_id VARCHAR(36) NOT NULL REFERENCES listes_valeurs(id) ON DELETE CASCADE,
    code_element VARCHAR(50) NOT NULL,
    libelle VARCHAR(150) NOT NULL,
    ordre INTEGER NOT NULL DEFAULT 0,
    est_actif BOOLEAN NOT NULL DEFAULT TRUE,
    cree_le TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(liste_valeurs_id, code_element)
);

CREATE INDEX IF NOT EXISTS idx_elem_liste ON elements_liste_valeurs(liste_valeurs_id, est_actif, ordre);

-- ----------------------------------------------------------------------------
-- 17. Form Builder : Définitions et Valeurs des Champs Personnalisés
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS champs_personnalises (
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
    CONSTRAINT uq_champs_entite_code UNIQUE (entite_cible, code_champ),
    CONSTRAINT chk_champs_non_systeme CHECK (lower(code_champ) NOT IN (
        'id', 'matricule', 'numero_carte_nationale', 'nom', 'prenom', 
        'date_naissance', 'lieu_naissance', 'genre', 'situation_familiale', 
        'nombre_enfants', 'telephone_professionnel', 'telephone_personnel', 
        'email_professionnel', 'date_recrutement', 'date_titularisation', 
        'corps', 'grade_actuel', 'echelon_actuel', 'indice_solde', 
        'unite_actuelle_id', 'statut_administratif', 'est_actif', 
        'cree_le', 'modifie_le'
    )),
    CONSTRAINT chk_champs_interdiction_medicale CHECK (
        lower(code_champ) !~ '(sante|medical|medecin|maladie|pathologie|traitement|hopital|clinique|diagnostic|vih|sida|diabete|psychiatrie|psy|infirmite|ordonnance|posologie|sang|groupe_sanguin|handicap|grossesse|medicament|medicaments|glycemie|tension|tension_arterielle|cancer|chirurgie|symptome|pouls|temperature|consultation)'
        AND lower(libelle) !~ '(santé|sante|médical|medical|médecin|medecin|maladie|pathologie|traitement|hôpital|hopital|clinique|diagnostic|vih|sida|diabète|diabete|psychiatrie|psy|infirmité|infirmite|ordonnance|posologie|sang|groupe[ _]sanguin|handicap|grossesse|médicament|medicament|médicaments|medicaments|glycémie|glycemie|tension|tension[ _]artérielle|tension[ _]arterielle|cancer|chirurgie|symptôme|symptome|pouls|température|temperature|consultation)'
    )
);

-- Mise à jour systématique et idempotente de la contrainte médicale
ALTER TABLE champs_personnalises 
    DROP CONSTRAINT IF EXISTS chk_champs_interdiction_medicale;

ALTER TABLE champs_personnalises 
    ADD CONSTRAINT chk_champs_interdiction_medicale CHECK (
        lower(code_champ) !~ '(sante|medical|medecin|maladie|pathologie|traitement|hopital|clinique|diagnostic|vih|sida|diabete|psychiatrie|psy|infirmite|ordonnance|posologie|sang|groupe_sanguin|handicap|grossesse|medicament|medicaments|glycemie|tension|tension_arterielle|cancer|chirurgie|symptome|pouls|temperature|consultation)'
        AND lower(libelle) !~ '(santé|sante|médical|medical|médecin|medecin|maladie|pathologie|traitement|hôpital|hopital|clinique|diagnostic|vih|sida|diabète|diabete|psychiatrie|psy|infirmité|infirmite|ordonnance|posologie|sang|groupe[ _]sanguin|handicap|grossesse|médicament|medicament|médicaments|medicaments|glycémie|glycemie|tension|tension[ _]artérielle|tension[ _]arterielle|cancer|chirurgie|symptôme|symptome|pouls|température|temperature|consultation)'
    );

CREATE INDEX IF NOT EXISTS idx_champs_entite_actif ON champs_personnalises(entite_cible, est_actif, ordre_affichage);

CREATE TABLE IF NOT EXISTS valeurs_champs_dynamiques (
    id VARCHAR(36) PRIMARY KEY,
    entite_cible VARCHAR(50) NOT NULL,
    entite_id VARCHAR(36) NOT NULL,
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

CREATE INDEX IF NOT EXISTS idx_valeurs_dynamiques ON valeurs_champs_dynamiques(entite_cible, entite_id);
CREATE INDEX IF NOT EXISTS idx_valeurs_champ_id ON valeurs_champs_dynamiques(champ_id);

-- ----------------------------------------------------------------------------
-- 18. Versions de Configuration RH et Snapshots Immuables
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS versions_configuration_rh (
    id VARCHAR(36) PRIMARY KEY,
    numero_version VARCHAR(20) UNIQUE NOT NULL,
    statut VARCHAR(30) NOT NULL DEFAULT 'BROUILLON',
    snapshot_configuration_json JSONB NOT NULL,
    commentaire_evolution TEXT NOT NULL,
    auteur_id VARCHAR(36) NOT NULL,
    valide_par_id VARCHAR(36),
    date_creation TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    date_publication TIMESTAMP WITH TIME ZONE,
    est_version_courante BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_version_courante_unique ON versions_configuration_rh(est_version_courante) 
WHERE est_version_courante = TRUE;

-- ----------------------------------------------------------------------------
-- 19. Comptes Utilisateurs et IAM (6 Rôles RBAC)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS comptes_utilisateurs (
    id VARCHAR(36) PRIMARY KEY,
    identifiant VARCHAR(50) UNIQUE NOT NULL,
    mot_de_passe_hash_argon2id VARCHAR(255) NOT NULL,
    role VARCHAR(30) NOT NULL CHECK (role IN (
        'ADMIN_TECHNIQUE', 'ADMIN_FONCTIONNEL_RH', 'GESTIONNAIRE_RH', 
        'CHEF_DE_SERVICE', 'AGENT', 'AUDITEUR'
    )),
    agent_id VARCHAR(36) UNIQUE REFERENCES agents(id) ON DELETE RESTRICT,
    est_actif BOOLEAN NOT NULL DEFAULT TRUE,
    tentatives_echouees INTEGER NOT NULL DEFAULT 0,
    bloque_jusqu_a TIMESTAMP WITH TIME ZONE,
    doit_changer_mot_de_passe BOOLEAN NOT NULL DEFAULT FALSE,
    derniere_connexion_le TIMESTAMP WITH TIME ZONE,
    derniere_ip_connexion VARCHAR(45),
    cree_le TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    modifie_le TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_comptes_role ON comptes_utilisateurs(role, est_actif);
CREATE INDEX IF NOT EXISTS idx_comptes_agent ON comptes_utilisateurs(agent_id);

-- ----------------------------------------------------------------------------
-- 20. Sessions Actives et Résilience WAN
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sessions_actives (
    id VARCHAR(36) PRIMARY KEY,
    utilisateur_id VARCHAR(36) NOT NULL REFERENCES comptes_utilisateurs(id) ON DELETE CASCADE,
    jeton_session_hache VARCHAR(64) UNIQUE NOT NULL,
    adresse_ip VARCHAR(45) NOT NULL,
    plage_ip_sous_reseau VARCHAR(45),
    agent_navigateur TEXT,
    expire_le TIMESTAMP WITH TIME ZONE NOT NULL,
    derniere_activite_le TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    cree_le TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sessions_utilisateur ON sessions_actives(utilisateur_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expiration ON sessions_actives(expire_le);

-- ----------------------------------------------------------------------------
-- 21. Registre d'Idempotence WAN
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS registre_idempotence (
    cle_idempotence VARCHAR(64) PRIMARY KEY,
    utilisateur_id VARCHAR(36) NOT NULL REFERENCES comptes_utilisateurs(id) ON DELETE CASCADE,
    route_api VARCHAR(100) NOT NULL,
    code_statut_http INTEGER NOT NULL,
    corps_reponse_json JSONB NOT NULL,
    cree_le TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expire_le TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_idempotence_expiration ON registre_idempotence(expire_le);

-- ----------------------------------------------------------------------------
-- 22. Journal Forensique d'Audit (Append-Only, Chaînage SHA-256)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS journaux_audit (
    id BIGSERIAL PRIMARY KEY,
    horodatage TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    utilisateur_id VARCHAR(36) NOT NULL,
    nom_utilisateur VARCHAR(100) NOT NULL,
    role_utilise VARCHAR(50) NOT NULL,
    adresse_ip VARCHAR(45) NOT NULL,
    action_type VARCHAR(50) NOT NULL,
    entite_cible VARCHAR(50) NOT NULL,
    entite_id VARCHAR(36),
    details_operation_json JSONB NOT NULL,
    statut_operation VARCHAR(20) NOT NULL DEFAULT 'SUCCES',
    empreinte_precedente VARCHAR(64) NOT NULL,
    empreinte_courante VARCHAR(64) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_horodatage ON journaux_audit(horodatage DESC);
CREATE INDEX IF NOT EXISTS idx_audit_utilisateur ON journaux_audit(utilisateur_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON journaux_audit(action_type);

-- Triggers d'immuabilité absolue sur journaux_audit
CREATE OR REPLACE FUNCTION fn_audit_immuable()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'VIOLATION SECURITE : Le journal d audit est strictement immuable. Les operations UPDATE, DELETE et TRUNCATE sont formellement prohibees.'
        USING ERRCODE = '23505';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tg_audit_immuable ON journaux_audit;
CREATE TRIGGER tg_audit_immuable
BEFORE UPDATE OR DELETE ON journaux_audit
FOR EACH ROW
EXECUTE FUNCTION fn_audit_immuable();

-- ----------------------------------------------------------------------------
-- 23 & 24. Triggers Statement-Level Anti-Truncate sur Tables Immuables
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_interdire_truncate()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'VIOLATION SECURITE : L operation TRUNCATE est formellement interdite sur cette table protegee.'
        USING ERRCODE = '23505';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tg_affectations_truncate ON affectations;
CREATE TRIGGER tg_affectations_truncate
BEFORE TRUNCATE ON affectations
FOR EACH STATEMENT
EXECUTE FUNCTION fn_interdire_truncate();

DROP TRIGGER IF EXISTS tg_audit_truncate ON journaux_audit;
CREATE TRIGGER tg_audit_truncate
BEFORE TRUNCATE ON journaux_audit
FOR EACH STATEMENT
EXECUTE FUNCTION fn_interdire_truncate();

-- ----------------------------------------------------------------------------
-- 25. Contraintes d'Intégrité Référentielle Différées
-- ----------------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_exports_solde_audit'
    ) THEN
        ALTER TABLE exports_solde
        ADD CONSTRAINT fk_exports_solde_audit
        FOREIGN KEY (journal_audit_id) REFERENCES journaux_audit(id) ON DELETE RESTRICT;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_documents_generes_audit'
    ) THEN
        ALTER TABLE documents_generes
        ADD CONSTRAINT fk_documents_generes_audit
        FOREIGN KEY (journal_audit_id) REFERENCES journaux_audit(id) ON DELETE RESTRICT;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_remplacements_gardes_audit'
    ) THEN
        ALTER TABLE remplacements_gardes
        ADD CONSTRAINT fk_remplacements_gardes_audit
        FOREIGN KEY (journal_audit_id) REFERENCES journaux_audit(id) ON DELETE RESTRICT;
    END IF;
END $$;

