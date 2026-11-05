const FORBIDDEN_ENGLISH_TERMS = [
  'submit',
  'cancel',
  'save',
  'delete',
  'edit',
  'first name',
  'last name',
  'date of birth',
  'pending',
  'approved',
  'rejected',
  'forbidden',
  'unauthorized',
  'not found',
  'internal server error',
  'leave request',
  'annual leave',
  'sick leave',
  'dashboard',
  'user management',
  'settings',
  'profile',
  'success'
];

function scanForEnglishTerms(textOrObj) {
  const matches = [];

  function inspect(str, context = '') {
    if (typeof str !== 'string') return;
    const lower = str.toLowerCase();
    for (const term of FORBIDDEN_ENGLISH_TERMS) {
      // Vérification mot entier ou expression
      const regex = new RegExp(`\\b${term}\\b`, 'i');
      if (regex.test(lower)) {
        matches.push({ term, context: str.substring(0, 100), path: context });
      }
    }
  }

  function traverse(node, currentPath = '') {
    if (node === null || node === undefined) return;
    if (typeof node === 'string') {
      inspect(node, currentPath);
    } else if (Array.isArray(node)) {
      node.forEach((item, idx) => traverse(item, `${currentPath}[${idx}]`));
    } else if (typeof node === 'object') {
      for (const [key, val] of Object.entries(node)) {
        inspect(key, `${currentPath}.${key}`);
        traverse(val, `${currentPath}.${key}`);
      }
    }
  }

  traverse(textOrObj);
  return {
    is100PercentFrench: matches.length === 0,
    violationCount: matches.length,
    violations: matches
  };
}

module.exports = {
  FORBIDDEN_ENGLISH_TERMS,
  scanForEnglishTerms
};
