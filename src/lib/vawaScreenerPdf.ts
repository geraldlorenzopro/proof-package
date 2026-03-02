import jsPDF from "jspdf";
import nerLogo from "@/assets/ner-logo.png";
import { VawaAnswers, EligibilityResult } from "@/components/vawa/vawaEngine";

export function generateScreenerPdf(answers: VawaAnswers, result: EligibilityResult) {
  const pdf = new jsPDF("p", "mm", "letter");
  const W = pdf.internal.pageSize.getWidth();
  const marginL = 18;
  const marginR = 18;
  const contentW = W - marginL - marginR;
  let y = 0;

  const addPage = () => { pdf.addPage(); y = 18; };
  const checkSpace = (need: number) => { if (y + need > 260) addPage(); };

  // Header
  const headerH = 28;
  pdf.setFillColor(15, 23, 42);
  pdf.rect(0, 0, W, headerH, "F");
  pdf.setFillColor(217, 168, 46);
  pdf.rect(0, headerH, W, 2, "F");
  try { pdf.addImage(nerLogo, "PNG", marginL, 5, 18, 18); } catch {}
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(14);
  pdf.setTextColor(255, 255, 255);
  pdf.text("VAWA I-360 Eligibility Screening Report", marginL + 22, 14);
  pdf.setFontSize(8);
  pdf.setTextColor(200, 200, 200);
  pdf.text("NER Immigration AI", marginL + 22, 20);
  y = headerH + 8;

  // Client info
  pdf.setFontSize(9);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(15, 23, 42);
  pdf.text(`Client: ${answers.clientName || "N/A"}`, marginL, y);
  pdf.setFont("helvetica", "normal");
  pdf.text(`DOB: ${answers.clientDob || "N/A"}  |  Country: ${answers.countryOfBirth || "N/A"}`, marginL + contentW * 0.5, y);
  y += 5;
  pdf.text(`Date: ${new Date().toLocaleDateString()}`, marginL, y);
  pdf.text(`Petitioner Type: ${answers.petitionerType.charAt(0).toUpperCase() + answers.petitionerType.slice(1)}`, marginL + contentW * 0.5, y);
  y += 8;

  // Overall result
  const overallColor = result.overall === "eligible" ? [16, 185, 129] : result.overall === "not_eligible" ? [239, 68, 68] : [245, 158, 11];
  pdf.setFillColor(overallColor[0], overallColor[1], overallColor[2]);
  pdf.roundedRect(marginL, y, contentW, 12, 3, 3, "F");
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(12);
  pdf.setTextColor(255, 255, 255);
  const overallText = result.overall === "eligible" ? "ELIGIBLE FOR VAWA I-360" : result.overall === "not_eligible" ? "NOT ELIGIBLE FOR VAWA I-360" : "REQUIRES ATTORNEY REVIEW";
  pdf.text(overallText, W / 2, y + 8, { align: "center" });
  y += 18;

  if (result.classification) {
    pdf.setFontSize(8.5);
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(100, 100, 100);
    pdf.text(`Immigration Classification: ${result.classification}`, marginL, y);
    y += 7;
  }

  // Criteria
  pdf.setFontSize(10);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(15, 23, 42);
  pdf.text("Eligibility Criteria Analysis", marginL, y);
  y += 6;

  for (const c of result.criteria) {
    checkSpace(18);
    const statusColor = c.status === "eligible" ? [16, 185, 129] : c.status === "not_eligible" ? [239, 68, 68] : [245, 158, 11];
    pdf.setFillColor(statusColor[0], statusColor[1], statusColor[2]);
    pdf.circle(marginL + 2, y + 1.5, 1.5, "F");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8.5);
    pdf.setTextColor(15, 23, 42);
    pdf.text(c.label, marginL + 6, y + 2);
    const statusLabel = c.status === "eligible" ? "PASS" : c.status === "not_eligible" ? "FAIL" : "REVIEW";
    pdf.setFontSize(7);
    pdf.setTextColor(statusColor[0], statusColor[1], statusColor[2]);
    pdf.text(statusLabel, marginL + contentW - 2, y + 2, { align: "right" });
    y += 5;
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7.5);
    pdf.setTextColor(80, 80, 80);
    const detailLines = pdf.splitTextToSize(c.detail, contentW - 8);
    pdf.text(detailLines, marginL + 6, y);
    y += detailLines.length * 3.5;
    pdf.setFontSize(6.5);
    pdf.setTextColor(140, 140, 140);
    pdf.text(c.legalRef, marginL + 6, y);
    y += 5;
  }

  // Recommendations
  if (result.recommendations.length > 0) {
    checkSpace(15);
    y += 3;
    pdf.setFontSize(10);
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(15, 23, 42);
    pdf.text("Recommendations", marginL, y);
    y += 5;
    for (const rec of result.recommendations) {
      checkSpace(8);
      pdf.setFontSize(8);
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(60, 60, 60);
      const lines = pdf.splitTextToSize(`• ${rec}`, contentW - 4);
      pdf.text(lines, marginL + 4, y);
      y += lines.length * 3.5 + 1;
    }
  }

  // Alternatives
  if (result.alternativeOptions.length > 0) {
    checkSpace(15);
    y += 3;
    pdf.setFontSize(10);
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(15, 23, 42);
    pdf.text("Alternative Options", marginL, y);
    y += 5;
    for (const alt of result.alternativeOptions) {
      checkSpace(8);
      pdf.setFontSize(8);
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(60, 60, 60);
      const lines = pdf.splitTextToSize(`→ ${alt}`, contentW - 4);
      pdf.text(lines, marginL + 4, y);
      y += lines.length * 3.5 + 1;
    }
  }

  // Legal basis
  checkSpace(15);
  y += 3;
  pdf.setFontSize(10);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(15, 23, 42);
  pdf.text("Legal Basis", marginL, y);
  y += 5;
  for (const ref of result.legalBasis) {
    checkSpace(6);
    pdf.setFontSize(7);
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(100, 100, 100);
    pdf.text(`• ${ref}`, marginL + 4, y);
    y += 3.5;
  }

  // Footer
  const pages = pdf.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    pdf.setPage(i);
    pdf.setFontSize(6);
    pdf.setFont("helvetica", "italic");
    pdf.setTextColor(150, 150, 150);
    pdf.text("This screening report is for informational purposes only and does not constitute legal advice.", W / 2, 272, { align: "center" });
    pdf.text(`Page ${i} of ${pages}`, W - marginR, 272, { align: "right" });
  }

  const safeName = (answers.clientName || "Client").replace(/[^a-zA-Z0-9]/g, "_");
  pdf.save(`VAWA_Screening_${safeName}_${new Date().toISOString().slice(0, 10)}.pdf`);
}
