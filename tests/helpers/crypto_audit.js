const crypto = require('crypto');

function sha256(data) {
  const content = typeof data === 'string' ? data : JSON.stringify(data);
  return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
}

const GENESIS_HASH = '0'.repeat(64);

function computeChainedHash({
  id,
  horodatage,
  utilisateur_id,
  action_type,
  entite_cible,
  entite_id,
  details_operation_json,
  empreinte_precedente
}) {
  const payload = [
    String(id),
    String(horodatage),
    String(utilisateur_id),
    String(action_type),
    String(entite_cible || ''),
    String(entite_id || ''),
    typeof details_operation_json === 'string'
      ? details_operation_json
      : JSON.stringify(details_operation_json || {}),
    String(empreinte_precedente || GENESIS_HASH)
  ].join('|');

  return sha256(payload);
}

function verifyAuditChain(entries) {
  if (!Array.isArray(entries) || entries.length === 0) {
    return { valid: true, count: 0, errors: [] };
  }

  const errors = [];
  let expectedPreviousHash = GENESIS_HASH;

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];

    // Vérifier l'empreinte précédente
    if (entry.empreinte_precedente !== expectedPreviousHash) {
      errors.push({
        index: i,
        id: entry.id,
        error: 'Rupture de chaînage : empreinte_precedente incorrecte',
        expected: expectedPreviousHash,
        actual: entry.empreinte_precedente
      });
    }

    // Calculer et vérifier l'empreinte courante
    const calculatedHash = computeChainedHash(entry);
    if (entry.empreinte_courante !== calculatedHash) {
      errors.push({
        index: i,
        id: entry.id,
        error: "Altération détectée : empreinte_courante ne correspond pas aux données de l'entrée",
        expected: calculatedHash,
        actual: entry.empreinte_courante
      });
    }

    expectedPreviousHash = entry.empreinte_courante;
  }

  return {
    valid: errors.length === 0,
    count: entries.length,
    errors
  };
}

module.exports = {
  sha256,
  GENESIS_HASH,
  computeChainedHash,
  verifyAuditChain
};
