/**
 * Native USCIS 2D barcode (PDF417) generator for Form I-765.
 *
 * Based on USCIS 2D Barcode Requirements spec:
 * Each page encodes form fields as pipe-delimited values in a PDF417 barcode.
 * Header: FormType|RevisionDate|PageNumber|Field1|Field2|...
 */
// @ts-ignore - bwip-js browser module
import bwipjs from "bwip-js";
import { I765Data, ELIGIBILITY_CATEGORIES } from "@/components/smartforms/i765Schema";

const FORM_TYPE = "I-765";
const FORM_REVISION = "08/21/25";

/** Format date from YYYY-MM-DD to MM/DD/YYYY */
function fmtDate(d: string | undefined | null): string {
  if (!d) return "";
  const [y, m, day] = d.split("-");
  return `${m}/${day}/${y}`;
}

/** Normalize undefined/null to empty string */
function s(val: string | undefined | null): string {
  return val?.trim() || "";
}

/** Build barcode data per page as pipe-delimited string */
function buildPageData(pageNum: number, data: I765Data): string {
  const header = [FORM_TYPE, FORM_REVISION, String(pageNum)];

  switch (pageNum) {
    case 1: {
      // Page 1: Part 1 (reason) + Part 2 start (name, other names)
      const reason = data.reasonForApplying === "initial" ? "1"
        : data.reasonForApplying === "replacement" ? "2"
        : data.reasonForApplying === "renewal" ? "3" : "";
      return [...header,
        reason,
        s(data.lastName), s(data.firstName), s(data.middleName),
        s(data.otherLastName), s(data.otherFirstName), "",
        // Lines 3 and 4 (other names) - map if available
        "", "", "", // 3a, 3b, 3c (other names set 2 — not in our schema currently)
        "", "", "", // 4a, 4b, 4c
      ].join("|");
    }

    case 2: {
      // Page 2: Mailing address, physical address, A-Number, sex, marital status, etc.
      const aptType = data.mailingAptType === "apt" ? "APT"
        : data.mailingAptType === "ste" ? "STE"
        : data.mailingAptType === "flr" ? "FLR" : "";
      const physAptType = data.physicalAptType === "apt" ? "APT"
        : data.physicalAptType === "ste" ? "STE"
        : data.physicalAptType === "flr" ? "FLR" : "";
      const sex = data.sex === "male" ? "M" : data.sex === "female" ? "F" : "";
      const marital = data.maritalStatus === "single" ? "1"
        : data.maritalStatus === "married" ? "2"
        : data.maritalStatus === "divorced" ? "3"
        : data.maritalStatus === "widowed" ? "4" : "";
      const sameAddr = data.sameAddress ? "Y" : "N";
      const prevFiled = data.previouslyFiled ? "Y" : "N";

      return [...header,
        s(data.mailingCareOf),
        s(data.mailingStreet), aptType, s(data.mailingApt),
        s(data.mailingCity), s(data.mailingState), s(data.mailingZip),
        sameAddr,
        s(data.sameAddress ? "" : data.physicalStreet),
        physAptType,
        s(data.sameAddress ? "" : data.physicalApt),
        s(data.sameAddress ? "" : data.physicalCity),
        s(data.sameAddress ? "" : data.physicalState),
        s(data.sameAddress ? "" : data.physicalZip),
        s(data.aNumber?.replace(/^A-?/i, "")),
        s(data.uscisAccountNumber),
        sex,
        marital,
        s(data.ssn),
        prevFiled,
        s(data.countryOfCitizenship1),
        s(data.countryOfCitizenship2),
      ].join("|");
    }

    case 3: {
      // Page 3: Birth info, arrival, eligibility
      const catLabel = ELIGIBILITY_CATEGORIES.find(c => c.value === data.eligibilityCategory)?.label || "";
      const arrested29 = data.c8EverArrested === true ? "Y" : data.c8EverArrested === false ? "N" : "";
      const arrested30 = data.c35EverArrested === true ? "Y" : data.c35EverArrested === false ? "N" : "";

      return [...header,
        s(data.cityOfBirth), s(data.stateOfBirth), s(data.countryOfBirth),
        fmtDate(data.dateOfBirth),
        s(data.i94Number),
        s(data.passportNumber), s(data.travelDocNumber),
        s(data.passportCountry), fmtDate(data.passportExpiration),
        fmtDate(data.lastArrivalDate), s(data.lastArrivalPlace),
        s(data.statusAtArrival), s(data.currentStatus),
        s(data.eligibilityCategory), s(data.eligibilityCategorySpecific || catLabel),
        s(data.h1bReceiptNumber),
        arrested29,
        s(data.i140ReceiptNumber),
        arrested30,
      ].join("|");
    }

    case 4: {
      // Page 4: Part 3 (applicant statement) + Part 4 (interpreter)
      const readsEng = data.applicantCanReadEnglish ? "Y" : "";
      const interp = data.interpreterUsed ? "Y" : "";
      const prep = data.preparerUsed ? "Y" : "";

      return [...header,
        readsEng, interp,
        s(data.interpreterLanguage),
        prep,
        s(data.applicantPhone), s(data.applicantMobile), s(data.applicantEmail),
        // Part 4: Interpreter info
        s(data.interpreterLastName), s(data.interpreterFirstName),
        s(data.interpreterOrg),
      ].join("|");
    }

    case 5: {
      // Page 5: Interpreter contact + Part 5 preparer
      return [...header,
        s(data.interpreterPhone), s(data.interpreterMobile), s(data.interpreterEmail),
        s(data.interpreterLanguage),
        s(data.preparerLastName), s(data.preparerFirstName),
        s(data.preparerOrg),
        s(data.preparerStreet), s(data.preparerApt),
        s(data.preparerCity), s(data.preparerState), s(data.preparerZip),
        s(data.preparerProvince), s(data.preparerPostalCode), s(data.preparerCountry),
        s(data.preparerPhone), "", // fax
        s(data.preparerEmail),
      ].join("|");
    }

    case 6: {
      // Page 6: Preparer attorney info
      const isAtty = data.preparerIsAttorney ? "Y" : "N";
      const repExtends = data.preparerRepExtends ? "Y" : "N";
      return [...header,
        isAtty, repExtends,
      ].join("|");
    }

    case 7: {
      // Page 7: Additional information (Part 6) — mostly empty
      return [...header, ""].join("|");
    }

    default:
      return header.join("|");
  }
}

/**
 * Generate a PDF417 barcode as PNG bytes for a specific page.
 */
export async function generatePageBarcode(pageNum: number, data: I765Data): Promise<Uint8Array> {
  const barcodeData = buildPageData(pageNum, data);

  // Create an offscreen canvas
  const canvas = document.createElement("canvas");

  // Use bwip-js to render the PDF417 barcode
  bwipjs.toCanvas(canvas, {
    bcid: "pdf417",
    text: barcodeData,
    scale: 2,
    height: 8,
    columns: 10,
    rowmult: 2,
    eclevel: 3,
    includetext: false,
  });

  // Convert canvas to PNG blob
  return new Promise<Uint8Array>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) { reject(new Error("Failed to create barcode blob")); return; }
      blob.arrayBuffer().then(ab => resolve(new Uint8Array(ab)));
    }, "image/png");
  });
}

/**
 * Generate barcodes for all pages (1-7).
 */
export async function generateAllBarcodes(data: I765Data): Promise<Map<number, Uint8Array>> {
  const barcodes = new Map<number, Uint8Array>();
  for (let page = 1; page <= 7; page++) {
    try {
      const png = await generatePageBarcode(page, data);
      barcodes.set(page, png);
    } catch (e) {
      console.warn(`Failed to generate barcode for page ${page}:`, e);
    }
  }
  return barcodes;
}
