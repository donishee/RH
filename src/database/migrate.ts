import * as fs from 'fs';
import * as path from 'path';
import { pool, fermerPool } from './index';

export async function executerMigration(): Promise<void> {
  const srcSchemaPath = path.resolve(__dirname, '../../src/database/schema.sql');
  const localSchemaPath = path.join(__dirname, 'schema.sql');
  const schemaPath = fs.existsSync(srcSchemaPath) ? srcSchemaPath : localSchemaPath;
  const ddlSql = fs.readFileSync(schemaPath, 'utf-8');

  try {
    if (fs.existsSync(srcSchemaPath) && localSchemaPath !== srcSchemaPath) {
      fs.copyFileSync(srcSchemaPath, localSchemaPath);
    }
  } catch {}

  const client = await pool.connect();
  try {
    console.log("Démarrage de la migration du schéma SIRH Police Djiboutienne...");
    await client.query(ddlSql);
    await client.query('ALTER TABLE demandes_conges ADD COLUMN IF NOT EXISTS motif_annulation TEXT;');

    // Auto-contrôle actif post-migration de la contrainte médicale
    const resVerification = await client.query(`
      SELECT pg_get_constraintdef(oid) AS def 
      FROM pg_constraint 
      WHERE conrelid = 'champs_personnalises'::regclass 
      AND conname = 'chk_champs_interdiction_medicale';
    `);

    const def = resVerification.rows[0]?.def || '';
    if (!def.includes('medicament') || !def.includes('glycemie')) {
      throw new Error("ÉCHEC MIGRATION DDL : La contrainte chk_champs_interdiction_medicale dans PostgreSQL n'intègre pas les nouveaux termes médicaux proscrits !");
    }
    console.log("Contrainte DDL chk_champs_interdiction_medicale validée avec succès dans le dictionnaire PostgreSQL.");

    // Auto-contrôle actif post-migration de la contrainte médicale sur notations_annuelles
    const resVerifNotations = await client.query(`
      SELECT pg_get_constraintdef(oid) AS def 
      FROM pg_constraint 
      WHERE conrelid = 'notations_annuelles'::regclass 
      AND conname = 'chk_notations_interdiction_medicale';
    `);

    const defNotations = resVerifNotations.rows[0]?.def || '';
    if (!defNotations.includes('medicament') || !defNotations.includes('glycemie')) {
      throw new Error("ÉCHEC MIGRATION DDL : La contrainte chk_notations_interdiction_medicale dans PostgreSQL n'intègre pas les termes médicaux proscrits !");
    }
    console.log("Contrainte DDL chk_notations_interdiction_medicale validée avec succès dans le dictionnaire PostgreSQL.");

    // Auto-contrôle actif post-migration de la contrainte médicale sur aptitudes_administratives
    const resVerifAptitudes = await client.query(`
      SELECT pg_get_constraintdef(oid) AS def 
      FROM pg_constraint 
      WHERE conrelid = 'aptitudes_administratives'::regclass 
      AND conname = 'chk_aptitudes_interdiction_medicale';
    `);

    const defAptitudes = resVerifAptitudes.rows[0]?.def || '';
    if (!defAptitudes.includes('medicament') || !defAptitudes.includes('glycemie')) {
      throw new Error("ÉCHEC MIGRATION DDL : La contrainte chk_aptitudes_interdiction_medicale dans PostgreSQL n'intègre pas les termes médicaux proscrits !");
    }
    console.log("Contrainte DDL chk_aptitudes_interdiction_medicale validée avec succès dans le dictionnaire PostgreSQL.");

    console.log("Migration du schéma de base de données effectuée avec succès (tables, contraintes POSIX et triggers installés).");
  } catch (error) {
    console.error("Erreur lors de l'exécution de la migration du schéma :", error);
    throw error;
  } finally {
    client.release();
  }
}

if (require.main === module) {
  executerMigration()
    .then(async () => {
      await fermerPool();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error(err);
      await fermerPool();
      process.exit(1);
    });
}

