import jsPDF from "jspdf";
import { I765Data, ELIGIBILITY_CATEGORIES } from "@/components/smartforms/i765Schema";

const NAVY = [26, 42, 78] as const;
const GOLD = [212, 175, 55] as const;
const WHITE = [255, 255, 255] as const;
const GRAY = [120, 130, 150] as const;
const LIGHT_BG = [240, 242, 247] as const;

export function generateI765Pdf(data: I765Data, firmName?: string) {
  const doc = new jsPDF("p", "mm", "letter");
  const W = doc.internal.pageSize.getWidth();
  let y = 0;

  const addPage = () => { doc.addPage(); y = 20; };
  const checkPage = (need: number) => { if (y + need > 260) addPage(); };

  // ─── Header ───
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, W, 38, "F");
  doc.setTextColor(...WHITE);
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text("Form I-765 — Application Summary", 14, 18);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("Employment Authorization Document (EAD)", 14, 26);
  if (firmName) {
    doc.setFontSize(8);
    doc.setTextColor(...GOLD);
    doc.text(`Prepared by: ${firmName}`, 14, 33);
  }
  doc.setFontSize(8);
  doc.setTextColor(...GOLD);
  doc.text(`Generated: ${new Date().toLocaleDateString()}`, W - 14, 33, { align: "right" });

  // Gold line
  doc.setFillColor(...GOLD);
  doc.rect(0, 38, W, 1.5, "F");
  y = 48;

  const sectionHeader = (title: string) => {
    checkPage(14);
    doc.setFillColor(...NAVY);
    doc.roundedRect(14, y, W - 28, 8, 1, 1, "F");
    doc.setTextColor(...GOLD);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text(title, 18, y + 5.5);
    y += 12;
  };

  const fieldRow = (label: string, value: string) => {
    if (!value) return;
    checkPage(8);
    if (Math.floor((y - 48) / 7) % 2 === 0) {
      doc.setFillColor(...LIGHT_BG);
      doc.rect(14, y - 1, W - 28, 7, "F");
    }
    doc.setTextColor(...GRAY);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text(label, 18, y + 3.5);
    doc.setTextColor(30, 30, 30);
    doc.setFont("helvetica", "bold");
    doc.text(value, 90, y + 3.5);
    y += 7;
  };

  // ─── Part 1 ───
  sectionHeader("PART 1 — Reason for Applying");
  const reasonMap: Record<string, string> = {
    initial: "Initial Permission",
    replacement: "Replacement (lost/stolen/damaged)",
    renewal: "Renewal",
  };
  fieldRow("Reason", reasonMap[data.reasonForApplying] || "—");

  // ─── Part 2: Personal ───
  sectionHeader("PART 2 — Personal Information");
  fieldRow("Full Name", `${data.lastName}, ${data.firstName} ${data.middleName}`.trim());
  if (data.otherLastName || data.otherFirstName) fieldRow("Other Names", `${data.otherLastName} ${data.otherFirstName}`.trim());
  fieldRow("A-Number", data.aNumber);
  fieldRow("USCIS Account #", data.uscisAccountNumber);
  fieldRow("SSN", data.ssn);

  // Address
  sectionHeader("MAILING ADDRESS");
  if (data.mailingCareOf) fieldRow("In Care Of", data.mailingCareOf);
  fieldRow("Street", `${data.mailingStreet} ${data.mailingApt}`.trim());
  fieldRow("City, State, ZIP", `${data.mailingCity}, ${data.mailingState} ${data.mailingZip}`.trim());

  if (!data.sameAddress) {
    sectionHeader("PHYSICAL ADDRESS");
    fieldRow("Street", `${data.physicalStreet} ${data.physicalApt}`.trim());
    fieldRow("City, State, ZIP", `${data.physicalCity}, ${data.physicalState} ${data.physicalZip}`.trim());
  }

  // Background
  sectionHeader("BACKGROUND");
  fieldRow("Sex", data.sex === "male" ? "Male" : data.sex === "female" ? "Female" : "—");
  fieldRow("Marital Status", data.maritalStatus || "—");
  fieldRow("Previously Filed I-765", data.previouslyFiled ? "Yes" : "No");
  fieldRow("Country of Citizenship", data.countryOfCitizenship1);
  if (data.countryOfCitizenship2) fieldRow("2nd Country", data.countryOfCitizenship2);
  fieldRow("Place of Birth", `${data.cityOfBirth}, ${data.stateOfBirth}, ${data.countryOfBirth}`.replace(/, ,/g, ",").trim());
  fieldRow("Date of Birth", data.dateOfBirth);

  // Arrival
  sectionHeader("LAST ARRIVAL");
  fieldRow("I-94 #", data.i94Number);
  fieldRow("Passport #", data.passportNumber);
  fieldRow("Travel Doc #", data.travelDocNumber);
  fieldRow("Passport Country", data.passportCountry);
  fieldRow("Passport Expiration", data.passportExpiration);
  fieldRow("Date of Last Arrival", data.lastArrivalDate);
  fieldRow("Place of Last Arrival", data.lastArrivalPlace);
  fieldRow("Status at Arrival", data.statusAtArrival);
  fieldRow("Current Status", data.currentStatus);

  // Eligibility
  sectionHeader("ELIGIBILITY CATEGORY");
  const catLabel = ELIGIBILITY_CATEGORIES.find(c => c.value === data.eligibilityCategory)?.label || data.eligibilityCategorySpecific || "—";
  fieldRow("Category", catLabel);
  if (data.h1bReceiptNumber) fieldRow("H-1B Receipt #", data.h1bReceiptNumber);
  if (data.i140ReceiptNumber) fieldRow("I-140 Receipt #", data.i140ReceiptNumber);

  // Contact
  sectionHeader("APPLICANT CONTACT");
  fieldRow("Phone", data.applicantPhone);
  fieldRow("Mobile", data.applicantMobile);
  fieldRow("Email", data.applicantEmail);

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFillColor(...NAVY);
    doc.rect(0, 270, W, 10, "F");
    doc.setTextColor(...GOLD);
    doc.setFontSize(7);
    doc.text("NER Smart Forms — I-765 Summary (Not for filing)", 14, 276);
    doc.text(`Page ${i} of ${pageCount}`, W - 14, 276, { align: "right" });
  }

  const clientName = `${data.lastName}_${data.firstName}`.replace(/\s/g, "_") || "i765";
  doc.save(`I765_${clientName}_${new Date().toISOString().slice(0, 10)}.pdf`);
}
