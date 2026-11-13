/**
 * Stand-in pictures for the demo's seeded receipts, documents and photos, which were never
 * really uploaded. Each is a small SVG marked "demo sample", so an office has something to open.
 */

const FONT = "Segoe UI, Tahoma, Arial, sans-serif";

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function toDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

const SAMPLE_BADGE = `
  <rect x="24" y="24" width="260" height="34" rx="6" fill="#CF644B"/>
  <text x="154" y="47" font-size="16" font-weight="700" fill="#fff" text-anchor="middle">
    نموذج تجريبي · Demo sample
  </text>`;

interface SampleReceipt {
  reference: string;
  /** Already formatted, e.g. "EGP 15,000". */
  amount: string;
  payer: string;
  paidOn: string;
}

/** A bank deposit slip with the receipt's own details on it. */
export function sampleReceiptImage(receipt: SampleReceipt): string {
  const rows: [string, string][] = [
    ["Reference · رقم العملية", receipt.reference],
    ["Amount · المبلغ", receipt.amount],
    ["Depositor · اسم المودع", receipt.payer],
    ["Date · التاريخ", receipt.paidOn],
    ["Account · الحساب", "SUtech transport fees"],
  ];
  const body = rows
    .map(
      ([label, value], index) => `
  <text x="48" y="${170 + index * 62}" font-size="15" fill="#6B6475">${escapeXml(label)}</text>
  <text x="48" y="${196 + index * 62}" font-size="22" font-weight="700" fill="#2A1D33"
    direction="ltr" unicode-bidi="plaintext">${escapeXml(value)}</text>
  <line x1="48" x2="552" y1="${210 + index * 62}" y2="${210 + index * 62}" stroke="#E4DEE8"/>`,
    )
    .join("");
  return toDataUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="600" height="520"
  viewBox="0 0 600 520" font-family="${FONT}">
  <rect width="600" height="520" fill="#FBF9F6"/>
  <rect x="12" y="12" width="576" height="496" rx="10" fill="#fff" stroke="#D9D2DE" stroke-width="2"
    stroke-dasharray="10 6"/>
  ${SAMPLE_BADGE}
  <text x="300" y="110" font-size="26" font-weight="700" fill="#58286E" text-anchor="middle">
    Bank deposit slip · إيصال إيداع بنكي
  </text>
  ${body}
  <circle cx="480" cy="455" r="38" fill="none" stroke="#257988" stroke-width="3"/>
  <text x="480" y="461" font-size="15" font-weight="700" fill="#257988" text-anchor="middle">PAID</text>
</svg>`);
}

/** A scanned-looking page for a document a student attached (a medical report, say). */
export function sampleDocumentImage(fileName: string): string {
  const lines = Array.from(
    { length: 9 },
    (_, index) =>
      `<rect x="60" y="${190 + index * 30}" width="${index % 3 === 2 ? 300 : 480}" height="10" rx="5" fill="#E4DEE8"/>`,
  ).join("");
  return toDataUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="600" height="560"
  viewBox="0 0 600 560" font-family="${FONT}">
  <rect width="600" height="560" fill="#F3F0F5"/>
  <rect x="30" y="16" width="540" height="528" rx="8" fill="#fff" stroke="#D9D2DE" stroke-width="2"/>
  ${SAMPLE_BADGE}
  <text x="300" y="120" font-size="24" font-weight="700" fill="#58286E" text-anchor="middle"
    direction="ltr">${escapeXml(fileName)}</text>
  <text x="300" y="152" font-size="16" fill="#6B6475" text-anchor="middle">
    Attached document · مستند مرفق
  </text>
  ${lines}
  <rect x="60" y="480" width="160" height="10" rx="5" fill="#C9C0D0"/>
  <path d="M400 490 q20 -30 40 0 t40 0 t40 0" fill="none" stroke="#257988" stroke-width="3"/>
</svg>`);
}

/** A photo taken inside a bus: rows of seats, for violation and complaint photos. */
export function samplePhotoImage(fileName: string): string {
  const seats = [0, 1, 2]
    .flatMap((row) =>
      [0, 1, 3, 4].map((column) => {
        const x = 90 + column * 95 + row * 8;
        const y = 210 + row * 80;
        return `<rect x="${x}" y="${y}" width="70" height="60" rx="12" fill="#3D6F7A"/>
        <rect x="${x}" y="${y - 28}" width="70" height="32" rx="10" fill="#2E5963"/>`;
      }),
    )
    .join("");
  return toDataUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480"
  viewBox="0 0 640 480" font-family="${FONT}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#C7D9DD"/><stop offset="1" stop-color="#8FB0B7"/>
    </linearGradient>
  </defs>
  <rect width="640" height="480" fill="url(#g)"/>
  <rect x="0" y="60" width="640" height="70" fill="#E8F1F3" opacity="0.8"/>
  ${seats}
  ${SAMPLE_BADGE}
  <rect x="0" y="430" width="640" height="50" fill="#000" opacity="0.45"/>
  <text x="320" y="462" font-size="18" fill="#fff" text-anchor="middle" direction="ltr">
    ${escapeXml(fileName)}
  </text>
</svg>`);
}
