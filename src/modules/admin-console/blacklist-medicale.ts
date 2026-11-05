export const TERMES_MEDICAUX_INTERDITS = [
  'sante',
  'medical',
  'medecin',
  'maladie',
  'pathologie',
  'traitement',
  'hopital',
  'clinique',
  'diagnostic',
  'vih',
  'sida',
  'diabete',
  'psychiatrie',
  'psy',
  'infirmite',
  'ordonnance',
  'posologie',
  'sang',
  'groupe_sanguin',
  'handicap',
  'grossesse',
  'medicament',
  'medicaments',
  'glycemie',
  'tension',
  'tension_arterielle',
  'cancer',
  'chirurgie',
  'symptome',
  'pouls',
  'temperature',
  'consultation'
];

/**
 * Normalise un texte (suppression des accents et mise en minuscules)
 */
export function normaliserTexte(texte: string): string {
  if (!texte) return '';
  return texte
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

/**
 * Vérifie si un texte contient un terme de santé ou secret médical proscrit
 */
export function contientTermeMedical(texte: string): { contient: boolean; terme?: string } {
  if (!texte) return { contient: false };
  const normalise = normaliserTexte(texte);
  const normaliseEspaces = normalise.replace(/[\s_-]+/g, ' ');

  for (const terme of TERMES_MEDICAUX_INTERDITS) {
    const termeNormalise = normaliserTexte(terme);
    const termeEspaces = termeNormalise.replace(/[\s_-]+/g, ' ');

    const motifRegex = termeNormalise.replace(/[\s_-]+/g, '[\\s_-]+');
    const regex = new RegExp(`(^|[\\s_-])${motifRegex}([\\s_-]|$)`, 'i');

    if (
      regex.test(normalise) ||
      normalise.includes(termeNormalise) ||
      normaliseEspaces.includes(termeEspaces)
    ) {
      return { contient: true, terme };
    }
  }

  return { contient: false };
}

