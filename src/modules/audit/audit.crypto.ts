import * as crypto from 'node:crypto';

export const GENESIS_HASH = '0'.repeat(64);

export interface EntreeAuditPayload {
  id: number | string;
  horodatage: string;
  utilisateur_id: string;
  action_type: string;
  entite_cible?: string;
  entite_id?: string | null;
  details_operation_json: any;
  empreinte_precedente: string;
}

export function sha256(data: any): string {
  const content = typeof data === 'string' ? data : JSON.stringify(data);
  return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
}

export function sortJsonKeys(obj: any): any {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(sortJsonKeys);
  const sorted: Record<string, any> = {};
  for (const k of Object.keys(obj).sort()) {
    sorted[k] = sortJsonKeys(obj[k]);
  }
  return sorted;
}

export function computeChainedHash(entry: EntreeAuditPayload): string {
  const horodatageStr = (entry.horodatage as any) instanceof Date
    ? (entry.horodatage as any).toISOString()
    : String(entry.horodatage);

  let detailsStr = '';
  if (typeof entry.details_operation_json === 'string') {
    try {
      const parsed = JSON.parse(entry.details_operation_json);
      detailsStr = JSON.stringify(sortJsonKeys(parsed));
    } catch {
      detailsStr = entry.details_operation_json;
    }
  } else {
    detailsStr = JSON.stringify(sortJsonKeys(entry.details_operation_json || {}));
  }

  const payload = [
    String(entry.id),
    horodatageStr,
    String(entry.utilisateur_id),
    String(entry.action_type),
    String(entry.entite_cible || ''),
    String(entry.entite_id || ''),
    detailsStr,
    String(entry.empreinte_precedente || GENESIS_HASH)
  ].join('|');

  return sha256(payload);
}

export interface VerificationAuditResultat {
  valid: boolean;
  count: number;
  errors: Array<{
    index: number;
    id: number | string;
    error: string;
    expected: string;
    actual: string;
  }>;
}

export function verifyAuditChain(entries: any[]): VerificationAuditResultat {
  if (!Array.isArray(entries) || entries.length === 0) {
    return { valid: true, count: 0, errors: [] };
  }

  const errors: any[] = [];
  let expectedPreviousHash = GENESIS_HASH;

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];

    if (entry.empreinte_precedente !== expectedPreviousHash) {
      errors.push({
        index: i,
        id: entry.id,
        error: 'Rupture de chaînage : empreinte_precedente incorrecte',
        expected: expectedPreviousHash,
        actual: entry.empreinte_precedente
      });
    }

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
