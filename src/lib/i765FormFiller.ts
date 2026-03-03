import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { I765Data, ELIGIBILITY_CATEGORIES } from "@/components/smartforms/i765Schema";

const I765_PDF_URL = "/forms/i-765.pdf";

/**
 * Fill the official USCIS I-765 PDF by overlaying text on the correct coordinates.
 * This approach works even with encrypted PDFs since we embed pages as-is
 * and draw text on top rather than relying on AcroForm fields.
 */
export async function fillI765Pdf(data: I765Data) {
  const pdfBytes = await fetch(I765_PDF_URL).then(r => r.arrayBuffer());
  
  let srcPdf: PDFDocument;
  try {
    srcPdf = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  } catch {
    srcPdf = await PDFDocument.load(pdfBytes);
  }

  // Create a fresh PDF and copy pages from the original
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdf.embedFont(StandardFonts.HelveticaBold);

  // Copy all pages from source
  const pageIndices = srcPdf.getPageIndices();
  const copiedPages = await pdf.copyPages(srcPdf, pageIndices);
  copiedPages.forEach(page => pdf.addPage(page));

  const pages = pdf.getPages();
  const fontSize = 9;
  const smallFont = 7.5;
  const color = rgb(0, 0, 0);
  const checkMark = "X";

  // Helper: draw text at position (x from left, y from TOP of page)
  const drawText = (pageIdx: number, x: number, yFromTop: number, text: string | undefined | null, size = fontSize) => {
    if (!text || pageIdx >= pages.length) return;
    const page = pages[pageIdx];
    const { height } = page.getSize();
    page.drawText(text, { x, y: height - yFromTop, size, font, color });
  };

  // Helper: draw check mark
  const drawCheck = (pageIdx: number, x: number, yFromTop: number, checked: boolean) => {
    if (!checked || pageIdx >= pages.length) return;
    const page = pages[pageIdx];
    const { height } = page.getSize();
    page.drawText(checkMark, { x, y: height - yFromTop, size: 10, font: boldFont, color });
  };

  // Format date from YYYY-MM-DD to MM/DD/YYYY
  const fmtDate = (d: string) => {
    if (!d) return "";
    const [y, m, day] = d.split("-");
    return `${m}/${day}/${y}`;
  };

  // ══════════════════════════════════════════════════════
  // PAGE 1 — Part 1 & Part 2 (top section)
  // ══════════════════════════════════════════════════════
  // Note: Coordinates are approximate and based on the I-765 (08/25/21 edition).
  // They may need fine-tuning after visual inspection.

  // Part 1: Reason for applying (checkboxes)
  drawCheck(0, 36, 195, data.reasonForApplying === "initial");
  drawCheck(0, 36, 213, data.reasonForApplying === "replacement");
  drawCheck(0, 36, 231, data.reasonForApplying === "renewal");

  // Part 2: Information About You
  // 1.a Family Name
  drawText(0, 200, 298, data.lastName);
  // 1.b Given Name
  drawText(0, 200, 318, data.firstName);
  // 1.c Middle Name
  drawText(0, 200, 338, data.middleName);

  // 2.a Other Last Name
  drawText(0, 200, 371, data.otherLastName);
  // 2.b Other First Name
  drawText(0, 200, 391, data.otherFirstName);

  // A-Number (right column, top)
  drawText(0, 430, 298, data.aNumber?.replace(/^A-?/i, ""));
  // USCIS Online Account Number
  drawText(0, 430, 338, data.uscisAccountNumber);

  // Mailing address
  // In Care Of
  drawText(0, 200, 441, data.mailingCareOf);
  // Street
  drawText(0, 200, 461, data.mailingStreet);
  // Apt/Ste/Flr
  drawCheck(0, 400, 475, data.mailingAptType === "apt" || !!data.mailingApt);
  drawText(0, 470, 461, data.mailingApt);
  // City
  drawText(0, 200, 501, data.mailingCity);
  // State
  drawText(0, 400, 501, data.mailingState);
  // ZIP
  drawText(0, 500, 501, data.mailingZip);

  // Same address checkbox
  drawCheck(0, 36, 530, data.sameAddress);

  // SSN
  drawText(0, 430, 391, data.ssn);

  // ══════════════════════════════════════════════════════
  // PAGE 2 — Physical Address, Background, Arrival
  // ══════════════════════════════════════════════════════
  if (!data.sameAddress) {
    drawText(1, 200, 82, data.physicalStreet);
    drawText(1, 470, 82, data.physicalApt);
    drawText(1, 200, 118, data.physicalCity);
    drawText(1, 400, 118, data.physicalState);
    drawText(1, 500, 118, data.physicalZip);
  }

  // Sex
  drawCheck(1, 36, 177, data.sex === "male");
  drawCheck(1, 100, 177, data.sex === "female");

  // Marital Status
  drawCheck(1, 36, 202, data.maritalStatus === "single");
  drawCheck(1, 100, 202, data.maritalStatus === "married");
  drawCheck(1, 175, 202, data.maritalStatus === "divorced");
  drawCheck(1, 250, 202, data.maritalStatus === "widowed");

  // Previously filed
  drawCheck(1, 400, 202, data.previouslyFiled);
  drawCheck(1, 450, 202, !data.previouslyFiled);

  // Country of Citizenship
  drawText(1, 200, 234, data.countryOfCitizenship1);
  drawText(1, 200, 254, data.countryOfCitizenship2);

  // Place of Birth
  drawText(1, 200, 289, data.cityOfBirth);
  drawText(1, 200, 309, data.stateOfBirth);
  drawText(1, 200, 329, data.countryOfBirth);

  // Date of Birth
  drawText(1, 430, 329, fmtDate(data.dateOfBirth));

  // I-94 Number
  drawText(1, 200, 382, data.i94Number);
  // Passport #
  drawText(1, 200, 402, data.passportNumber);
  // Travel Doc #
  drawText(1, 200, 422, data.travelDocNumber);
  // Country issued passport
  drawText(1, 200, 442, data.passportCountry);
  // Passport Expiration
  drawText(1, 430, 442, fmtDate(data.passportExpiration));
  // Date of last arrival
  drawText(1, 200, 462, fmtDate(data.lastArrivalDate));
  // Place of last arrival
  drawText(1, 430, 462, data.lastArrivalPlace);
  // Status at arrival
  drawText(1, 200, 497, data.statusAtArrival);
  // Current status
  drawText(1, 200, 517, data.currentStatus);

  // ══════════════════════════════════════════════════════
  // PAGE 3 — Eligibility Category
  // ══════════════════════════════════════════════════════
  const catLabel = ELIGIBILITY_CATEGORIES.find(c => c.value === data.eligibilityCategory)?.label || data.eligibilityCategorySpecific || "";
  drawText(2, 200, 95, data.eligibilityCategory);
  drawText(2, 200, 115, catLabel, smallFont);

  // Contact info (Part 3)
  drawText(2, 200, 510, data.applicantPhone);
  drawText(2, 200, 530, data.applicantMobile);
  drawText(2, 200, 550, data.applicantEmail);

  // Applicant statement checkboxes
  drawCheck(2, 36, 450, data.applicantCanReadEnglish);
  drawCheck(2, 36, 470, data.interpreterUsed);
  drawCheck(2, 36, 490, data.preparerUsed);

  // ══════════════════════════════════════════════════════
  // PAGE 4+ — Interpreter & Preparer (if present)
  // ══════════════════════════════════════════════════════
  if (data.interpreterUsed && pages.length > 3) {
    drawText(3, 200, 120, data.interpreterLastName);
    drawText(3, 200, 140, data.interpreterFirstName);
    drawText(3, 200, 160, data.interpreterOrg);
    drawText(3, 200, 310, data.interpreterPhone);
    drawText(3, 200, 330, data.interpreterMobile);
    drawText(3, 200, 350, data.interpreterEmail);
    drawText(3, 200, 370, data.interpreterLanguage);
  }

  if (data.preparerUsed && pages.length > 4) {
    drawText(4, 200, 120, data.preparerLastName);
    drawText(4, 200, 140, data.preparerFirstName);
    drawText(4, 200, 160, data.preparerOrg);
    drawText(4, 200, 200, data.preparerStreet);
    drawText(4, 470, 200, data.preparerApt);
    drawText(4, 200, 235, data.preparerCity);
    drawText(4, 400, 235, data.preparerState);
    drawText(4, 500, 235, data.preparerZip);
    drawText(4, 200, 310, data.preparerPhone);
    drawText(4, 200, 330, data.preparerMobile);
    drawText(4, 200, 350, data.preparerEmail);
  }

  // Save and download
  const filledBytes = await pdf.save();
  const blob = new Blob([filledBytes as unknown as ArrayBuffer], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const clientName = `${data.lastName}_${data.firstName}`.replace(/\s/g, "_") || "i765";
  a.download = `I765_USCIS_${clientName}_${new Date().toISOString().slice(0, 10)}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Debug: discover fields in the PDF (may fail on encrypted PDFs).
 */
export async function discoverI765Fields() {
  try {
    const pdfBytes = await fetch(I765_PDF_URL).then(r => r.arrayBuffer());
    const pdf = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
    const form = pdf.getForm();
    const fields = form.getFields();
    console.table(fields.map(f => ({ name: f.getName(), type: f.constructor.name })));
    return fields.map(f => ({ name: f.getName(), type: f.constructor.name }));
  } catch (e) {
    console.warn("Could not discover fields (PDF may be encrypted):", e);
    return [];
  }
}
