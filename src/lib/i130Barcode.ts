/**
 * USCIS 2D barcode data builder for Form I-130.
 *
 * The official USCIS PDF417 barcodes contain only the header:
 * FormType|RevisionDate|PageNumber
 *
 * Field data is NOT encoded in the barcode — it lives in the
 * AcroForm fields of the PDF itself.
 *
 * I-130 Edition 04/01/24 has 12 pages, each with its own PDF417 barcode.
 */

const FORM_TYPE = "I-130";
const FORM_REVISION = "04/01/24";

/** Build barcode data for a given page (header only, per USCIS spec) */
export function buildPageData(pageNum: number, _data?: unknown): string {
  return [FORM_TYPE, FORM_REVISION, String(pageNum)].join("|");
}
