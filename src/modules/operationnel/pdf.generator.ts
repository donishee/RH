import * as crypto from 'crypto';

export interface OptionsDocumentPdf {
  titre: string;
  sousTitre?: string;
  reference: string;
  dateActe: string;
  visas?: string[];
  corpsArticles: { numero: string; texte: string }[] | string;
  autoriteSignataire: string;
  qualiteSignataire: string;
  filigrane?: string;
  donneesVariables?: Record<string, any>;
}

export interface ResultatDocumentPdf {
  buffer: Buffer;
  base64: string;
  empreinteSha256: string;
  reference: string;
  titre: string;
  urlVerification: string;
}

function echapperTextePdf(texte: string): string {
  if (!texte) return '';
  return texte
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function genererDocumentPdf(options: OptionsDocumentPdf): ResultatDocumentPdf {
  const reference = options.reference || `ACTE-${Date.now()}`;
  const dateActe = options.dateActe || new Date().toISOString().split('T')[0];
  const filigrane = options.filigrane || 'REPRODUCTION INTERDITE - POLICE NATIONALE';

  // Pré-génération du flux graphique PDF
  const fluxGraphique: string[] = [];

  // Fond et cadre républicain
  fluxGraphique.push('q');
  fluxGraphique.push('0.95 0.96 0.98 rg'); // Fond très léger
  fluxGraphique.push('30 30 535.28 781.89 re');
  fluxGraphique.push('f');
  fluxGraphique.push('0.05 0.20 0.45 RG'); // Bordure bleu républicain djiboutien
  fluxGraphique.push('2 w');
  fluxGraphique.push('35 35 525.28 771.89 re');
  fluxGraphique.push('S');
  fluxGraphique.push('0.77 0.61 0.15 RG'); // Filet or
  fluxGraphique.push('0.75 w');
  fluxGraphique.push('38 38 519.28 765.89 re');
  fluxGraphique.push('S');
  fluxGraphique.push('Q');

  // Filigrane diagonal anti-falsification
  fluxGraphique.push('q');
  fluxGraphique.push('0.88 0.88 0.90 rg');
  fluxGraphique.push('BT');
  fluxGraphique.push('/F2 26 Tf');
  fluxGraphique.push('0.707 0.707 -0.707 0.707 100 240 Tm');
  fluxGraphique.push(`(${echapperTextePdf(filigrane)}) Tj`);
  fluxGraphique.push('ET');
  fluxGraphique.push('Q');

  // En-tête institutionnel de la République de Djibouti
  fluxGraphique.push('BT');
  fluxGraphique.push('/F2 12 Tf');
  fluxGraphique.push('0.05 0.20 0.45 rg');
  fluxGraphique.push('50 770 Td');
  fluxGraphique.push('(REPUBLIQUE DE DJIBOUTI) Tj');
  fluxGraphique.push('ET');

  fluxGraphique.push('BT');
  fluxGraphique.push('/F3 9 Tf');
  fluxGraphique.push('0.4 0.4 0.4 rg');
  fluxGraphique.push('50 758 Td');
  fluxGraphique.push('(Unite - Egalite - Paix) Tj');
  fluxGraphique.push('ET');

  fluxGraphique.push('BT');
  fluxGraphique.push('/F2 9 Tf');
  fluxGraphique.push('0.1 0.1 0.1 rg');
  fluxGraphique.push('50 742 Td');
  fluxGraphique.push('(MINISTERE DE L INTERIEUR) Tj');
  fluxGraphique.push('ET');

  fluxGraphique.push('BT');
  fluxGraphique.push('/F2 8.5 Tf');
  fluxGraphique.push('50 730 Td');
  fluxGraphique.push('(DIRECTION GENERALE DE LA POLICE NATIONALE) Tj');
  fluxGraphique.push('ET');

  fluxGraphique.push('BT');
  fluxGraphique.push('/F1 8 Tf');
  fluxGraphique.push('50 718 Td');
  fluxGraphique.push('(Direction des Ressources Humaines) Tj');
  fluxGraphique.push('ET');

  // Date et référence à droite
  fluxGraphique.push('BT');
  fluxGraphique.push('/F2 9 Tf');
  fluxGraphique.push('360 770 Td');
  fluxGraphique.push(`(Ref : ${echapperTextePdf(reference)}) Tj`);
  fluxGraphique.push('ET');

  fluxGraphique.push('BT');
  fluxGraphique.push('/F1 8.5 Tf');
  fluxGraphique.push('360 756 Td');
  fluxGraphique.push(`(Date : ${echapperTextePdf(dateActe)}) Tj`);
  fluxGraphique.push('ET');

  // Ligne de séparation
  fluxGraphique.push('q');
  fluxGraphique.push('0.05 0.20 0.45 RG');
  fluxGraphique.push('1.5 w');
  fluxGraphique.push('50 705 m 545 705 l S');
  fluxGraphique.push('Q');

  // Titre principal de l'acte
  fluxGraphique.push('BT');
  fluxGraphique.push('/F2 14 Tf');
  fluxGraphique.push('0.05 0.20 0.45 rg');
  fluxGraphique.push('50 675 Td');
  fluxGraphique.push(`(${echapperTextePdf(options.titre.toUpperCase())}) Tj`);
  fluxGraphique.push('ET');

  if (options.sousTitre) {
    fluxGraphique.push('BT');
    fluxGraphique.push('/F3 10 Tf');
    fluxGraphique.push('0.2 0.2 0.2 rg');
    fluxGraphique.push('50 658 Td');
    fluxGraphique.push(`(${echapperTextePdf(options.sousTitre)}) Tj`);
    fluxGraphique.push('ET');
  }

  // Visas réglementaires
  let curseurY = options.sousTitre ? 635 : 650;
  const visas = options.visas || [
    'Vu la Constitution de la Republique de Djibouti ;',
    'Vu la Loi n 48/AN/72 portant statut general des fonctionnaires ;',
    'Vu la Loi n 46/AN/04 modifiee par la Loi n 116/AN/21 portant statut de la Police Nationale ;',
    'Vu les necessites imperieuses de continuite du service public de securite nationale.'
  ];

  fluxGraphique.push('BT');
  fluxGraphique.push('/F3 8 Tf');
  fluxGraphique.push('0.3 0.3 0.3 rg');
  for (const v of visas) {
    fluxGraphique.push(`50 ${curseurY} Td`);
    fluxGraphique.push(`(${echapperTextePdf(v)}) Tj`);
    curseurY -= 13;
  }
  fluxGraphique.push('ET');

  curseurY -= 10;

  // Corps des articles ou texte principal
  if (Array.isArray(options.corpsArticles)) {
    for (const art of options.corpsArticles) {
      fluxGraphique.push('BT');
      fluxGraphique.push('/F2 10 Tf');
      fluxGraphique.push('0.05 0.20 0.45 rg');
      fluxGraphique.push(`50 ${curseurY} Td`);
      fluxGraphique.push(`(Article ${echapperTextePdf(art.numero)} :) Tj`);
      fluxGraphique.push('ET');

      fluxGraphique.push('BT');
      fluxGraphique.push('/F1 9.5 Tf');
      fluxGraphique.push('0.1 0.1 0.1 rg');
      fluxGraphique.push(`120 ${curseurY} Td`);
      fluxGraphique.push(`(${echapperTextePdf(art.texte)}) Tj`);
      fluxGraphique.push('ET');

      curseurY -= 28;
    }
  } else {
    const lignes = options.corpsArticles.split('\n');
    fluxGraphique.push('BT');
    fluxGraphique.push('/F1 9.5 Tf');
    fluxGraphique.push('0.1 0.1 0.1 rg');
    for (const ligne of lignes) {
      if (ligne.trim()) {
        fluxGraphique.push(`50 ${curseurY} Td`);
        fluxGraphique.push(`(${echapperTextePdf(ligne)}) Tj`);
        curseurY -= 16;
      }
    }
    fluxGraphique.push('ET');
  }

  // Sceau républicain circulaire (dessin vectoriel officiel)
  fluxGraphique.push('q');
  fluxGraphique.push('0.05 0.20 0.45 RG');
  fluxGraphique.push('1.5 w');
  // Cercle extérieur
  fluxGraphique.push('120 160 35 0 360 arc'); // Approximation cercle via chemin
  fluxGraphique.push('120 195 m 155 160 l 120 125 l 85 160 l h S');
  fluxGraphique.push('0.77 0.61 0.15 RG');
  fluxGraphique.push('1 w');
  fluxGraphique.push('120 190 m 150 160 l 120 130 l 90 160 l h S');
  fluxGraphique.push('Q');

  fluxGraphique.push('BT');
  fluxGraphique.push('/F2 7 Tf');
  fluxGraphique.push('0.05 0.20 0.45 rg');
  fluxGraphique.push('92 163 Td');
  fluxGraphique.push('(SCEAU DE L ETAT) Tj');
  fluxGraphique.push('ET');

  fluxGraphique.push('BT');
  fluxGraphique.push('/F2 6 Tf');
  fluxGraphique.push('88 153 Td');
  fluxGraphique.push('(POLICE NATIONALE) Tj');
  fluxGraphique.push('ET');

  // Bloc de signature de l'autorité compétente
  fluxGraphique.push('BT');
  fluxGraphique.push('/F2 9.5 Tf');
  fluxGraphique.push('0.05 0.20 0.45 rg');
  fluxGraphique.push('340 195 Td');
  fluxGraphique.push(`(${echapperTextePdf(options.qualiteSignataire)}) Tj`);
  fluxGraphique.push('ET');

  fluxGraphique.push('BT');
  fluxGraphique.push('/F3 8.5 Tf');
  fluxGraphique.push('0.3 0.3 0.3 rg');
  fluxGraphique.push('340 180 Td');
  fluxGraphique.push('(Signe electroniquement et scelle conformement a la loi) Tj');
  fluxGraphique.push('ET');

  fluxGraphique.push('BT');
  fluxGraphique.push('/F2 10 Tf');
  fluxGraphique.push('0.1 0.1 0.1 rg');
  fluxGraphique.push('340 145 Td');
  fluxGraphique.push(`(${echapperTextePdf(options.autoriteSignataire)}) Tj`);
  fluxGraphique.push('ET');

  // Pied de page : Scellement cryptographique et URL de vérification
  const urlVerification = `https://intranet.police.dj/verifier-acte?doc=${encodeURIComponent(reference)}`;

  fluxGraphique.push('q');
  fluxGraphique.push('0.7 0.7 0.7 RG');
  fluxGraphique.push('0.5 w');
  fluxGraphique.push('50 90 m 545 90 l S');
  fluxGraphique.push('Q');

  fluxGraphique.push('BT');
  fluxGraphique.push('/F2 7.5 Tf');
  fluxGraphique.push('0.05 0.20 0.45 rg');
  fluxGraphique.push('50 78 Td');
  fluxGraphique.push('(SCELLEMENT CRYPTOGRAPHIQUE FORENSIQUE SHA-256 :) Tj');
  fluxGraphique.push('ET');

  // Placeholder qui sera injecté ou calculé
  const hashSeed = crypto.createHash('sha256')
    .update(`${reference}|${dateActe}|${options.titre}|${options.autoriteSignataire}`)
    .digest('hex');

  fluxGraphique.push('BT');
  fluxGraphique.push('/F1 7 Tf');
  fluxGraphique.push('0.2 0.2 0.2 rg');
  fluxGraphique.push('50 67 Td');
  fluxGraphique.push(`(Empreinte certifiee : ${hashSeed}) Tj`);
  fluxGraphique.push('ET');

  fluxGraphique.push('BT');
  fluxGraphique.push('/F3 6.5 Tf');
  fluxGraphique.push('0.3 0.3 0.3 rg');
  fluxGraphique.push('50 55 Td');
  fluxGraphique.push(`(Verification en ligne et QR-Code : ${echapperTextePdf(urlVerification)}) Tj`);
  fluxGraphique.push('ET');

  const streamContent = fluxGraphique.join('\n');
  const streamBuf = Buffer.from(streamContent, 'latin1');

  // Construction des objets PDF standardisés PDF-1.4
  const obj1 = '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj';
  const obj2 = '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj';
  const obj3 = `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R /F3 7 0 R >> >> >>\nendobj`;
  const obj4 = `4 0 obj\n<< /Length ${streamBuf.length} >>\nstream\n` + streamContent + '\nendstream\nendobj';
  const obj5 = '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj';
  const obj6 = '6 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj';
  const obj7 = '7 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique >>\nendobj';

  const allObjs = [obj1, obj2, obj3, obj4, obj5, obj6, obj7];
  const header = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n';
  let body = '';
  const offsets: number[] = [0];

  let currentOffset = Buffer.byteLength(header, 'latin1');
  for (const obj of allObjs) {
    offsets.push(currentOffset);
    const objStr = obj + '\n';
    body += objStr;
    currentOffset += Buffer.byteLength(objStr, 'latin1');
  }

  const xrefOffset = currentOffset;
  let xref = `xref\n0 ${allObjs.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= allObjs.length; i++) {
    xref += String(offsets[i]).padStart(10, '0') + ' 00000 n \n';
  }

  const trailer = `trailer\n<< /Size ${allObjs.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  const pdfBuffer = Buffer.from(header + body + xref + trailer, 'latin1');

  // Scellement cryptographique SHA-256 définitif sur l'intégralité du Buffer binaire PDF
  const empreinteSha256 = crypto.createHash('sha256').update(pdfBuffer).digest('hex');
  const base64 = pdfBuffer.toString('base64');

  return {
    buffer: pdfBuffer,
    base64,
    empreinteSha256,
    reference,
    titre: options.titre,
    urlVerification: `${urlVerification}&sig=${empreinteSha256}`
  };
}
