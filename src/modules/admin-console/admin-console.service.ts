import * as crypto from 'node:crypto';
import { pool, transaction } from '../../database';
import { auditService } from '../audit/audit.service';
import { contientTermeMedical } from './blacklist-medicale';
import { SessionUtilisateur } from '../../types/session';

export const COLONNES_SYSTEME_RESERVEES = [
  'id', 'matricule', 'numero_carte_nationale', 'nom', 'prenom',
  'date_naissance', 'lieu_naissance', 'genre', 'situation_familiale',
  'nombre_enfants', 'telephone_professionnel', 'telephone_personnel',
  'email_professionnel', 'date_recrutement', 'date_titularisation',
  'corps', 'grade_actuel', 'echelon_actuel', 'indice_solde',
  'unite_actuelle_id', 'statut_administratif', 'est_actif',
  'cree_le', 'modifie_le'
];

export interface ChampPersonnaliseDto {
  entite_cible: 'AGENT' | 'DEMANDE_CONGE' | 'AFFECTATION' | 'FORMATION' | 'EVALUATION';
  code_champ: string;
  libelle: string;
  type_donnee: 'TEXTE' | 'DATE' | 'NOMBRE' | 'LISTE' | 'BOOLEEN' | 'PIECE_JOINTE' | 'texte' | 'date' | 'nombre' | 'liste' | 'booleen' | 'fichier';
  sous_type?: string;
  liste_valeurs_id?: string;
  est_obligatoire?: boolean;
  ordre_affichage?: number;
  aide_saisie?: string;
}

export class AdminConsoleService {
  /**
   * Normalise le type de donnée pour concorder avec la contrainte SQL CHECK
   */
  normaliserTypeDonnee(type: string): string {
    const t = type.toUpperCase();
    if (t === 'FICHIER') return 'PIECE_JOINTE';
    return t;
  }

  /**
   * Ajoute un champ personnalisé au Form Builder avec triple verrouillage de sécurité
   */
  async ajouterChamp(data: ChampPersonnaliseDto, session: SessionUtilisateur) {
    const code = data.code_champ.trim().toLowerCase();
    const libelle = data.libelle.trim();
    const typeNormalise = this.normaliserTypeDonnee(data.type_donnee);

    // 1. Contrôle anti-collision avec les colonnes maîtresses système
    if (COLONNES_SYSTEME_RESERVEES.includes(code)) {
      throw new Error(`COLLISION_COLONNE_SYSTEME: Le code '${code}' est une colonne maîtresse réservée du système.`);
    }

    // 2. Contrôle déontologique anti-données médicales
    const verifCode = contientTermeMedical(code);
    if (verifCode.contient) {
      throw new Error(`INTERDICTION_SECRET_MEDICAL: Le code du champ contient le terme médical proscrit '${verifCode.terme}'. Aucune donnée médicale ne peut être gérée dans le SIRH.`);
    }

    const verifLibelle = contientTermeMedical(libelle);
    if (verifLibelle.contient) {
      throw new Error(`INTERDICTION_SECRET_MEDICAL: Le libellé du champ contient le terme médical proscrit '${verifLibelle.terme}'. Aucune donnée médicale ne peut être gérée dans le SIRH.`);
    }

    const id = crypto.randomUUID();

    const res = await pool.query(`
      INSERT INTO champs_personnalises (
        id, entite_cible, code_champ, libelle, type_donnee, sous_type,
        liste_valeurs_id, est_obligatoire, est_actif, ordre_affichage, aide_saisie
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE, $9, $10)
      RETURNING *
    `, [
      id, data.entite_cible || 'AGENT', code, libelle, typeNormalise,
      data.sous_type || null, data.liste_valeurs_id || null,
      data.est_obligatoire || false, data.ordre_affichage || 0,
      data.aide_saisie || null
    ]);

    const champCree = res.rows[0];

    await auditService.enregistrer({
      utilisateur_id: session.utilisateur_id,
      nom_utilisateur: session.nom_complet,
      role_utilise: session.role,
      adresse_ip: session.adresse_ip,
      action_type: 'AJOUT_CHAMP_PERSONNALISE',
      entite_cible: 'FORM_BUILDER',
      entite_id: champCree.id,
      statut_operation: 'SUCCES',
      details_operation_json: { code_champ: code, libelle, type_donnee: typeNormalise }
    });

    return champCree;
  }

  /**
   * Met à jour les propriétés d'un champ personnalisé
   */
  async modifierChamp(champId: string, data: Partial<ChampPersonnaliseDto & { est_actif: boolean }>, session: SessionUtilisateur) {
    if (data.libelle) {
      const verif = contientTermeMedical(data.libelle);
      if (verif.contient) {
        throw new Error(`INTERDICTION_SECRET_MEDICAL: Le libellé contient le terme proscrit '${verif.terme}'.`);
      }
    }

    const champs: string[] = [];
    const params: any[] = [champId];

    if (data.libelle !== undefined) {
      params.push(data.libelle);
      champs.push(`libelle = $${params.length}`);
    }
    if (data.est_obligatoire !== undefined) {
      params.push(data.est_obligatoire);
      champs.push(`est_obligatoire = $${params.length}`);
    }
    if (data.est_actif !== undefined) {
      params.push(data.est_actif);
      champs.push(`est_actif = $${params.length}`);
    }
    if (data.ordre_affichage !== undefined) {
      params.push(data.ordre_affichage);
      champs.push(`ordre_affichage = $${params.length}`);
    }
    if (data.aide_saisie !== undefined) {
      params.push(data.aide_saisie);
      champs.push(`aide_saisie = $${params.length}`);
    }

    champs.push('modifie_le = CURRENT_TIMESTAMP');

    const res = await pool.query(`
      UPDATE champs_personnalises 
      SET ${champs.join(', ')} 
      WHERE id = $1 
      RETURNING *
    `, params);

    const champMaj = res.rows[0];

    await auditService.enregistrer({
      utilisateur_id: session.utilisateur_id,
      nom_utilisateur: session.nom_complet,
      role_utilise: session.role,
      adresse_ip: session.adresse_ip,
      action_type: 'MODIFICATION_CHAMP_PERSONNALISE',
      entite_cible: 'FORM_BUILDER',
      entite_id: champId,
      statut_operation: 'SUCCES',
      details_operation_json: data
    });

    return champMaj;
  }

  /**
   * Liste les champs personnalisés actifs
   */
  async listerChamps(entiteCible?: string, inclureInactifs: boolean = false) {
    let queryText = 'SELECT * FROM champs_personnalises WHERE 1=1';
    const params: any[] = [];

    if (!inclureInactifs) {
      queryText += ' AND est_actif = TRUE';
    }

    if (entiteCible) {
      params.push(entiteCible);
      queryText += ` AND entite_cible = $${params.length}`;
    }

    queryText += ' ORDER BY entite_cible ASC, ordre_affichage ASC, libelle ASC';
    const res = await pool.query(queryText, params);
    return res.rows;
  }

  /**
   * Liste les listes de valeurs éditables avec leurs éléments
   */
  async listerListesValeurs() {
    const listesRes = await pool.query('SELECT * FROM listes_valeurs ORDER BY code ASC');
    const elementsRes = await pool.query('SELECT * FROM elements_liste_valeurs WHERE est_actif = TRUE ORDER BY ordre ASC, libelle ASC');

    const listes = listesRes.rows.map(l => ({
      ...l,
      elements: elementsRes.rows.filter(e => e.liste_valeurs_id === l.id)
    }));

    return listes;
  }

  /**
   * Ajoute un élément à une liste de valeurs
   */
  async ajouterElementListeValeurs(listeCodeOuId: string, data: { code_element: string; libelle: string; ordre?: number }, session: SessionUtilisateur) {
    const listeRes = await pool.query('SELECT id, code FROM listes_valeurs WHERE id = $1 OR code = $1', [listeCodeOuId]);
    const liste = listeRes.rows[0];
    if (!liste) throw new Error("LISTE_VALEURS_INTROUVABLE");

    const elemId = crypto.randomUUID();
    const code = data.code_element.toUpperCase().replace(/[\s-']/g, '_');

    const res = await pool.query(`
      INSERT INTO elements_liste_valeurs (id, liste_valeurs_id, code_element, libelle, ordre, est_actif)
      VALUES ($1, $2, $3, $4, $5, TRUE)
      ON CONFLICT (liste_valeurs_id, code_element) DO UPDATE SET libelle = EXCLUDED.libelle
      RETURNING *
    `, [elemId, liste.id, code, data.libelle, data.ordre || 0]);

    await auditService.enregistrer({
      utilisateur_id: session.utilisateur_id,
      nom_utilisateur: session.nom_complet,
      role_utilise: session.role,
      adresse_ip: session.adresse_ip,
      action_type: 'AJOUT_ELEMENT_LISTE_VALEURS',
      entite_cible: 'LISTE_VALEURS',
      entite_id: res.rows[0].id,
      details_operation_json: { liste: liste.code, code_element: code, libelle: data.libelle }
    });

    return res.rows[0];
  }

  /**
   * Publie une nouvelle version de configuration RH (Snapshot JSON)
   */
  async publierVersionConfiguration(commentaire: string, session: SessionUtilisateur) {
    if (!commentaire || commentaire.trim().length < 5) {
      throw new Error("Un commentaire explicatif d'au moins 5 caractères est requis.");
    }

    return transaction(async (client) => {
      // Détermination du prochain numéro de version
      const derVerRes = await client.query('SELECT numero_version FROM versions_configuration_rh ORDER BY date_creation DESC LIMIT 1');
      let nouveauNumero = 1;
      if (derVerRes.rows.length > 0) {
        const match = derVerRes.rows[0].numero_version.match(/v(\d+)/);
        if (match) nouveauNumero = parseInt(match[1], 10) + 1;
      }

      const versionStr = `v${nouveauNumero}.0.0`;

      // Construction du snapshot
      const champs = await client.query('SELECT * FROM champs_personnalises WHERE est_actif = TRUE ORDER BY ordre_affichage ASC');
      const listes = await client.query('SELECT * FROM listes_valeurs');
      const elements = await client.query('SELECT * FROM elements_liste_valeurs WHERE est_actif = TRUE');

      const snapshot = {
        numero_version: versionStr,
        horodatage: new Date().toISOString(),
        champs_personnalises: champs.rows,
        listes_valeurs: listes.rows.map(l => ({
          ...l,
          elements: elements.rows.filter(e => e.liste_valeurs_id === l.id)
        }))
      };

      // Désactiver l'ancienne version courante
      await client.query('UPDATE versions_configuration_rh SET est_version_courante = FALSE WHERE est_version_courante = TRUE');

      // Insérer la nouvelle version courante
      const nouvelleVerId = crypto.randomUUID();
      const insertRes = await client.query(`
        INSERT INTO versions_configuration_rh (
          id, numero_version, statut, snapshot_configuration_json,
          commentaire_evolution, auteur_id, date_publication, est_version_courante
        ) VALUES ($1, $2, 'ACTIVE', $3, $4, $5, CURRENT_TIMESTAMP, TRUE)
        RETURNING *
      `, [nouvelleVerId, versionStr, JSON.stringify(snapshot), commentaire, session.utilisateur_id]);

      await auditService.enregistrer({
        utilisateur_id: session.utilisateur_id,
        nom_utilisateur: session.nom_complet,
        role_utilise: session.role,
        adresse_ip: session.adresse_ip,
        action_type: 'PUBLICATION_VERSION_CONFIG',
        entite_cible: 'CONFIGURATION_RH',
        entite_id: nouvelleVerId,
        details_operation_json: { version: versionStr, commentaire }
      });

      return insertRes.rows[0];
    });
  }

  /**
   * Liste les versions de configuration
   */
  async listerVersions() {
    const res = await pool.query('SELECT id, numero_version, statut, commentaire_evolution, auteur_id, date_creation, est_version_courante FROM versions_configuration_rh ORDER BY date_creation DESC');
    return res.rows;
  }

  /**
   * Algorithme de Rollback Garanti Zéro Perte de Données
   */
  async rollbackVersVersion(versionCibleNumero: string, motifJustificatif: string, session: SessionUtilisateur) {
    if (session.role !== 'ADMIN_FONCTIONNEL_RH') {
      throw new Error("Seul l'Administrateur Fonctionnel RH peut déclencher un rollback de configuration.");
    }
    if (!motifJustificatif || motifJustificatif.trim().length < 10) {
      throw new Error("Un motif justificatif d'au moins 10 caractères est obligatoire pour déclencher un retour arrière.");
    }

    const versionFormatee = versionCibleNumero.startsWith('v') ? versionCibleNumero : `v${versionCibleNumero}.0.0`;

    return transaction(async (client) => {
      // 1. Récupération du snapshot de la version cible
      const verRes = await client.query('SELECT * FROM versions_configuration_rh WHERE numero_version = $1', [versionFormatee]);
      const versionCible = verRes.rows[0];
      if (!versionCible) {
        throw new Error(`Version cible introuvable : ${versionFormatee}`);
      }

      const snapshot = versionCible.snapshot_configuration_json;
      const champsCibles = snapshot.champs_personnalises || [];

      // 2. Synchronisation de champs_personnalises sans suppression :
      // - Les champs présents dans la version cible sont activés (est_actif = TRUE)
      // - Les champs absents de la version cible sont désactivés (est_actif = FALSE)
      // - AUCUNE ligne de valeurs_champs_dynamiques n'est effacée !
      const codesCibles = champsCibles.map((c: any) => c.code_champ || c.code).filter(Boolean);

      // Désactiver les champs non présents dans la version cible
      if (codesCibles.length > 0) {
        await client.query(`
          UPDATE champs_personnalises 
          SET est_actif = FALSE, modifie_le = CURRENT_TIMESTAMP 
          WHERE NOT (code_champ = ANY($1::text[]))
        `, [codesCibles]);
      } else {
        await client.query('UPDATE champs_personnalises SET est_actif = FALSE, modifie_le = CURRENT_TIMESTAMP');
      }

      // Activer et synchroniser les champs présents
      for (const c of champsCibles) {
        const codeChamp = c.code_champ || c.code;
        const ordre = c.ordre_affichage ?? c.ordre ?? 0;
        const obligatoire = c.est_obligatoire ?? c.obligatoire ?? false;
        if (!codeChamp) continue;

        await client.query(`
          UPDATE champs_personnalises 
          SET est_actif = TRUE, libelle = $1, est_obligatoire = $2, ordre_affichage = $3, modifie_le = CURRENT_TIMESTAMP
          WHERE code_champ = $4
        `, [c.libelle, obligatoire, ordre, codeChamp]);
      }

      // 3. Création de la nouvelle version incrémentale active
      const derVerRes = await client.query('SELECT numero_version FROM versions_configuration_rh ORDER BY date_creation DESC LIMIT 1');
      let nouveauNum = 1;
      if (derVerRes.rows.length > 0) {
        const match = derVerRes.rows[0].numero_version.match(/v(\d+)/);
        if (match) nouveauNum = parseInt(match[1], 10) + 1;
      }
      const nouvelleVersionStr = `v${nouveauNum}.0.0`;

      await client.query('UPDATE versions_configuration_rh SET est_version_courante = FALSE WHERE est_version_courante = TRUE');

      const nouvelleVerId = crypto.randomUUID();
      const insertRes = await client.query(`
        INSERT INTO versions_configuration_rh (
          id, numero_version, statut, snapshot_configuration_json,
          commentaire_evolution, auteur_id, date_publication, est_version_courante
        ) VALUES ($1, $2, 'ACTIVE', $3, $4, $5, CURRENT_TIMESTAMP, TRUE)
        RETURNING *
      `, [
        nouvelleVerId, nouvelleVersionStr, JSON.stringify(snapshot),
        `Rollback vers la version ${versionFormatee} - Motif : ${motifJustificatif}`,
        session.utilisateur_id
      ]);

      // 4. Journalisation forensique
      await auditService.enregistrer({
        utilisateur_id: session.utilisateur_id,
        nom_utilisateur: session.nom_complet,
        role_utilise: session.role,
        adresse_ip: session.adresse_ip,
        action_type: 'ROLLBACK_CONFIGURATION_RH',
        entite_cible: 'CONFIGURATION_RH',
        entite_id: nouvelleVerId,
        statut_operation: 'SUCCES',
        details_operation_json: {
          version_source: versionFormatee,
          nouvelle_version: nouvelleVersionStr,
          motif: motifJustificatif
        }
      });

      return {
        succes: true,
        version_active: nouvelleVersionStr,
        version_restauree: versionFormatee,
        detail: insertRes.rows[0]
      };
    });
  }
}

export const adminConsoleService = new AdminConsoleService();
