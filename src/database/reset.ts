import { pool, fermerPool } from './index';
import { executerMigration } from './migrate';
import { executerSeed } from './seed';
import { auditService } from '../modules/audit/audit.service';

export async function executerReset(): Promise<void> {
  const client = await pool.connect();
  try {
    console.log("================================================================================");
    console.log("   RÉINITIALISATION CONTRÔLÉE DE LA BASE DE DONNÉES — SIRH POLICE DJIBOUTIENNE  ");
    console.log("================================================================================");

    console.log("1. Purge et réinitialisation du schéma PostgreSQL 'public'...");
    await client.query(`
      DROP SCHEMA IF EXISTS public CASCADE;
      CREATE SCHEMA public;
      GRANT ALL ON SCHEMA public TO sirh_app;
      GRANT ALL ON SCHEMA public TO public;
    `);
    console.log("✓ Schéma 'public' réinitialisé à l'état vierge.");
  } finally {
    client.release();
  }

  // 2. Exécution du DDL complet (24 tables, contraintes exhaustives et triggers)
  console.log("2. Application des migrations DDL (schema.sql)...");
  await executerMigration();

  // 3. Peuplement des données initiales et scellement du bloc genèse d'audit
  console.log("3. Peuplement du référentiel initial (seed.ts)...");
  await executerSeed();

  // 4. Contrôle qualité et conformité immédiate
  console.log("4. Vérification d'intégrité post-réinitialisation...");
  const verifChaine = await auditService.verifierIntegriteChaine();
  if (!verifChaine.valid || verifChaine.count !== 1) {
    throw new Error(`ÉCHEC QUALITÉ RESET : Chaîne d'audit invalide (valide: ${verifChaine.valid}, entrées: ${verifChaine.count})`);
  }
  console.log("✓ Chaîne d'audit SHA-256 scellée et 100% intègre (1 entrée genèse).");

  // 5. Vérification de la contrainte médicale au niveau PostgreSQL
  const clientVerif = await pool.connect();
  try {
    let constraintBloquee = false;
    try {
      await clientVerif.query(`
        INSERT INTO champs_personnalises (id, entite_cible, code_champ, libelle, type_donnee, ordre_affichage, est_obligatoire, est_actif)
        VALUES ('cp-verif-reset', 'AGENT', 'medicament_agent', 'Medicament de test', 'TEXTE', 99, false, true);
      `);
    } catch (err: any) {
      if (err.code === '23514' && err.constraint === 'chk_champs_interdiction_medicale') {
        constraintBloquee = true;
      }
    }
    if (!constraintBloquee) {
      throw new Error("ÉCHEC QUALITÉ RESET : La contrainte chk_champs_interdiction_medicale ne bloque pas les termes médicaux dans PostgreSQL !");
    }
    console.log("✓ Contrainte chk_champs_interdiction_medicale active et validée sur PostgreSQL.");

    // Vérification de la contrainte médicale sur notations_annuelles
    let constraintNotationBloquee = false;
    try {
      await clientVerif.query(`
        INSERT INTO notations_annuelles (
          id, agent_id, annee, note_chiffree, appreciation_generale, date_entretien, evaluateur_agent_id
        ) VALUES (
          'not-verif-reset', 'agt-001', 2026, 14.50, 'Agent en traitement medical regulier.', '2026-02-01', 'agt-004'
        );
      `);
    } catch (err: any) {
      if (err.code === '23514' && err.constraint === 'chk_notations_interdiction_medicale') {
        constraintNotationBloquee = true;
      }
    }
    if (!constraintNotationBloquee) {
      throw new Error("ÉCHEC QUALITÉ RESET : La contrainte chk_notations_interdiction_medicale ne bloque pas les termes médicaux dans PostgreSQL !");
    }
    console.log("✓ Contrainte chk_notations_interdiction_medicale active et validée sur PostgreSQL.");

    // Vérification de la contrainte médicale sur aptitudes_administratives
    let constraintAptitudeBloquee = false;
    try {
      await clientVerif.query(`
        INSERT INTO aptitudes_administratives (
          id, agent_id, numero_certificat_administratif, decision_aptitude, type_conclusion,
          code_restriction, restriction_operationnelle, identifiant_medecin_militaire_referent,
          reference_certificat_scelle, date_decision
        ) VALUES (
          'apt-verif-reset', 'agt-001', 'CERT-VERIF-RESET', 'AMENAGEMENT_POSTE', 'APTE_AVEC_RESTRICTIONS',
          'POSTE_SEDENTAIRE', 'Agent avec medicament et traitement medical.', 'MED-MIL-01',
          'SCEL-TEST-01', '2026-02-01'
        );
      `);
    } catch (err: any) {
      if (err.code === '23514' && err.constraint === 'chk_aptitudes_interdiction_medicale') {
        constraintAptitudeBloquee = true;
      }
    }
    if (!constraintAptitudeBloquee) {
      throw new Error("ÉCHEC QUALITÉ RESET : La contrainte chk_aptitudes_interdiction_medicale ne bloque pas les termes médicaux dans PostgreSQL !");
    }
    console.log("✓ Contrainte chk_aptitudes_interdiction_medicale active et validée sur PostgreSQL.");
  } finally {
    clientVerif.release();
  }

  console.log("================================================================================");
  console.log("   BASE DE DONNÉES RÉINITIALISÉE AVEC SUCCÈS — HYGIÈNE ET INTÉGRITÉ RESTAURÉES   ");
  console.log("================================================================================\n");
}

if (require.main === module) {
  executerReset()
    .then(async () => {
      await fermerPool();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error("[ERREUR FATALE RESET]", err);
      await fermerPool();
      process.exit(1);
    });
}
