/**
 * USCIS 2D barcode data builder for Form I-765.
 *
 * The official USCIS PDF417 barcodes contain only the header:
 * FormType|RevisionDate|PageNumber
 *
 * Field data is NOT encoded in the barcode — it lives in the
 * AcroForm fields of the PDF itself.
 */

const FORM_TYPE = "I-765";
const FORM_REVISION = "08/21/25";

/** Build barcode data for a given page (header only, per USCIS spec) */
export function buildPageData(pageNum: number, _data?: unknown): string {
  return [FORM_TYPE, FORM_REVISION, String(pageNum)].join("|");
}
