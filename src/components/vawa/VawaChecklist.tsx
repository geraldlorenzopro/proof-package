import { useState, useEffect, useMemo } from "react";
import { CheckCircle2, Circle, ChevronDown, ChevronRight, Info, Download, Save, FileText, MessageSquare, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { ChecklistCategory } from "./vawaChecklistEngine";
import { VawaAnswers } from "./vawaEngine";
import jsPDF from "jspdf";
import nerLogo from "@/assets/ner-logo.png";

interface Props {
  categories: ChecklistCategory[];
  answers: VawaAnswers;
  lang: "es" | "en";
  progress: Record<string, boolean>;
  onProgressChange: (progress: Record<string, boolean>) => void;
  notes: Record<string, string>;
  onNotesChange: (notes: Record<string, string>) => void;
  onSave?: () => void;
  saving?: boolean;
}

export default function VawaChecklist({ categories, answers, lang, progress, onProgressChange, notes, onNotesChange, onSave, saving }: Props) {
  const t = (es: string, en: string) => (lang === "es" ? es : en);
  const [expandedCats, setExpandedCats] = useState<Record<string, boolean>>({});
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);

  // Auto-expand first incomplete category on mount
  useEffect(() => {
    const first = categories.find(cat => cat.items.some(item => !progress[item.id]));
    if (first) setExpandedCats({ [first.id]: true });
  }, []);

  const toggleCat = (catId: string) => {
    setExpandedCats(prev => ({ ...prev, [catId]: !prev[catId] }));
  };

  const toggleItem = (itemId: string) => {
    onProgressChange({ ...progress, [itemId]: !progress[itemId] });
  };

  const handleNoteChange = (itemId: string, value: string) => {
    if (value.trim()) {
      onNotesChange({ ...notes, [itemId]: value });
    } else {
      const next = { ...notes };
      delete next[itemId];
      onNotesChange(next);
    }
  };

  const totalItems = useMemo(() => categories.reduce((sum, cat) => sum + cat.items.length, 0), [categories]);
  const completedItems = useMemo(() => Object.values(progress).filter(Boolean).length, [progress]);
  const progressPct = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

  const catProgress = (cat: ChecklistCategory) => {
    const done = cat.items.filter(i => progress[i.id]).length;
    return { done, total: cat.items.length, pct: cat.items.length > 0 ? Math.round((done / cat.items.length) * 100) : 0 };
  };

  // ── PDF EXPORT ──
  const handleExportPdf = () => {
    const pdf = new jsPDF("p", "mm", "letter");
    const W = pdf.internal.pageSize.getWidth();
    const mL = 18, mR = 18;
    const cW = W - mL - mR;
    let y = 0;

    const addPage = () => { pdf.addPage(); y = 18; };
    const checkSpace = (need: number) => { if (y + need > 260) addPage(); };

    // Header
    const headerH = 28;
    pdf.setFillColor(15, 23, 42);
    pdf.rect(0, 0, W, headerH, "F");
    pdf.setFillColor(217, 168, 46);
    pdf.rect(0, headerH, W, 2, "F");
    try { pdf.addImage(nerLogo, "PNG", mL, 5, 18, 18); } catch {}
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(13);
    pdf.setTextColor(255, 255, 255);
    pdf.text("VAWA I-360 Document Checklist", mL + 22, 14);
    pdf.setFontSize(8);
    pdf.setTextColor(200, 200, 200);
    pdf.text("NER Immigration AI", mL + 22, 20);
    y = headerH + 8;

    // Client info
    pdf.setFontSize(9);
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(15, 23, 42);
    pdf.text(`Client: ${answers.clientName || "N/A"}`, mL, y);
    pdf.setFont("helvetica", "normal");
    pdf.text(`Date: ${new Date().toLocaleDateString()}  |  Progress: ${completedItems}/${totalItems} (${progressPct}%)`, mL + cW * 0.45, y);
    y += 8;

    // Categories
    for (const cat of categories) {
      checkSpace(18);
      const cp = catProgress(cat);

      // Category header
      pdf.setFillColor(241, 245, 249);
      pdf.roundedRect(mL, y, cW, 8, 2, 2, "F");
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(9);
      pdf.setTextColor(15, 23, 42);
      pdf.text(cat.title[lang === "es" ? "es" : "en"], mL + 3, y + 5.5);
      pdf.setFontSize(7);
      pdf.setTextColor(100, 100, 100);
      pdf.text(`${cp.done}/${cp.total}`, mL + cW - 3, y + 5.5, { align: "right" });
      y += 11;

      // Info note
      if (cat.infoNote) {
        checkSpace(12);
        pdf.setFontSize(7);
        pdf.setFont("helvetica", "italic");
        pdf.setTextColor(120, 120, 120);
        const noteLines = pdf.splitTextToSize(cat.infoNote[lang === "es" ? "es" : "en"], cW - 8);
        pdf.text(noteLines, mL + 4, y);
        y += noteLines.length * 3 + 3;
      }

      // Items
      for (const item of cat.items) {
        checkSpace(14);
        const checked = progress[item.id];
        const itemNote = notes[item.id];
        
        // Checkbox
        if (checked) {
          pdf.setFillColor(217, 168, 46);
          pdf.roundedRect(mL + 3, y - 1.5, 4, 4, 1, 1, "F");
          pdf.setFont("helvetica", "bold");
          pdf.setFontSize(8);
          pdf.setTextColor(255, 255, 255);
          pdf.text("✓", mL + 3.8, y + 1.5);
        } else {
          pdf.setDrawColor(180, 180, 180);
          pdf.roundedRect(mL + 3, y - 1.5, 4, 4, 1, 1, "S");
        }

        pdf.setFont("helvetica", checked ? "normal" : "normal");
        pdf.setFontSize(8);
        pdf.setTextColor(checked ? 150 : 50, checked ? 150 : 50, checked ? 150 : 50);
        const itemLines = pdf.splitTextToSize(item.text[lang === "es" ? "es" : "en"], cW - 14);
        pdf.text(itemLines, mL + 10, y + 1);
        y += itemLines.length * 3.5 + 2;

        if (item.legalRef) {
          pdf.setFontSize(6);
          pdf.setTextColor(160, 160, 160);
          pdf.text(item.legalRef, mL + 10, y);
          y += 3;
        }

        // Note in PDF
        if (itemNote) {
          checkSpace(8);
          pdf.setFillColor(255, 250, 235);
          const noteTextLines = pdf.splitTextToSize(`📝 ${itemNote}`, cW - 18);
          const noteBlockH = noteTextLines.length * 3 + 3;
          pdf.roundedRect(mL + 10, y - 1, cW - 14, noteBlockH, 1, 1, "F");
          pdf.setFontSize(6.5);
          pdf.setFont("helvetica", "italic");
          pdf.setTextColor(120, 100, 50);
          pdf.text(noteTextLines, mL + 12, y + 1.5);
          y += noteBlockH + 1;
        }
      }
      y += 3;
    }

    // Footer
    const pages = pdf.getNumberOfPages();
    for (let i = 1; i <= pages; i++) {
      pdf.setPage(i);
      pdf.setFontSize(6);
      pdf.setFont("helvetica", "italic");
      pdf.setTextColor(150, 150, 150);
      pdf.text("This checklist is for organizational purposes only. Consult with an immigration attorney.", W / 2, 272, { align: "center" });
      pdf.text(`Page ${i} of ${pages}`, W - mR, 272, { align: "right" });
    }

    const safeName = (answers.clientName || "Client").replace(/[^a-zA-Z0-9]/g, "_");
    pdf.save(`VAWA_Checklist_${safeName}_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  return (
    <div className="space-y-5 p-4">
      {/* Progress Header */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
            <FileText className="w-4 h-4 text-accent" />
            {t("Checklist de Documentos", "Document Checklist")}
          </h2>
          <span className="text-xs text-muted-foreground">
            {completedItems}/{totalItems} ({progressPct}%)
          </span>
        </div>
        <Progress value={progressPct} className="h-2" />
        <p className="text-xs text-muted-foreground">
          {t(`Cliente: ${answers.clientName}`, `Client: ${answers.clientName}`)}
        </p>
      </div>

      {/* Categories */}
      <div className="space-y-2">
        {categories.map(cat => {
          const cp = catProgress(cat);
          const isExpanded = expandedCats[cat.id];
          const isComplete = cp.done === cp.total;

          return (
            <div key={cat.id} className={cn("rounded-lg border transition-colors", isComplete ? "border-accent/40 bg-accent/5" : "border-border")}>
              {/* Category Header */}
              <button
                onClick={() => toggleCat(cat.id)}
                className="w-full flex items-center justify-between p-3 text-left"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  {isComplete ? (
                    <CheckCircle2 className="w-4.5 h-4.5 text-accent shrink-0" />
                  ) : (
                    <div className="w-4.5 h-4.5 rounded-full border-2 border-muted-foreground/30 shrink-0 flex items-center justify-center">
                      <span className="text-[8px] font-bold text-muted-foreground">{cp.done}</span>
                    </div>
                  )}
                  <span className={cn("text-sm font-medium truncate", isComplete ? "text-accent" : "text-foreground")}>
                    {cat.title[lang]}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[10px] text-muted-foreground">{cp.done}/{cp.total}</span>
                  {isExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                </div>
              </button>

              {/* Expanded Items */}
              {isExpanded && (
                <div className="px-3 pb-3 space-y-1">
                  {/* Info Note */}
                  {cat.infoNote && (
                    <div className="flex items-start gap-2 p-2.5 rounded-md bg-accent/10 border border-accent/20 mb-2">
                      <Info className="w-3.5 h-3.5 text-accent mt-0.5 shrink-0" />
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {cat.infoNote[lang]}
                      </p>
                    </div>
                  )}

                  {cat.items.map(item => {
                    const checked = progress[item.id];
                    const itemNote = notes[item.id];
                    const isNoteActive = activeNoteId === item.id;

                    return (
                      <div key={item.id} className={cn("rounded-md transition-colors", checked ? "bg-accent/5" : "hover:bg-muted/50")}>
                        <div className="flex items-start gap-2.5 p-2">
                          {/* Checkbox */}
                          <button onClick={() => toggleItem(item.id)} className="mt-0.5 shrink-0">
                            {checked ? (
                              <CheckCircle2 className="w-4 h-4 text-accent" />
                            ) : (
                              <Circle className="w-4 h-4 text-muted-foreground/40" />
                            )}
                          </button>

                          {/* Content */}
                          <div className="min-w-0 flex-1">
                            <span className={cn("text-xs leading-relaxed", checked ? "text-muted-foreground line-through" : "text-foreground")}>
                              {item.text[lang]}
                            </span>
                            {item.detail && (
                              <p className="text-[10px] text-muted-foreground/70 mt-0.5 leading-relaxed">
                                {item.detail[lang]}
                              </p>
                            )}
                            {item.legalRef && (
                              <p className="text-[10px] text-muted-foreground/50 font-mono mt-0.5">{item.legalRef}</p>
                            )}

                            {/* Existing note badge */}
                            {itemNote && !isNoteActive && (
                              <button
                                onClick={() => setActiveNoteId(item.id)}
                                className="mt-1 flex items-center gap-1 px-2 py-0.5 rounded bg-accent/10 border border-accent/20 text-[10px] text-accent hover:bg-accent/20 transition-colors"
                              >
                                <MessageSquare className="w-2.5 h-2.5" />
                                <span className="truncate max-w-[180px]">{itemNote}</span>
                              </button>
                            )}

                            {/* Note editor */}
                            {isNoteActive && (
                              <div className="mt-1.5 space-y-1">
                                <Textarea
                                  value={itemNote || ""}
                                  onChange={e => handleNoteChange(item.id, e.target.value)}
                                  placeholder={t("Ej: Pendiente traducción...", "E.g.: Pending translation...")}
                                  className="text-xs min-h-[48px] resize-none bg-muted/30 border-accent/20 focus:border-accent/50"
                                  rows={2}
                                />
                                <button
                                  onClick={() => setActiveNoteId(null)}
                                  className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                                >
                                  {t("Cerrar", "Close")}
                                </button>
                              </div>
                            )}
                          </div>

                          {/* Note toggle button */}
                          <button
                            onClick={() => setActiveNoteId(isNoteActive ? null : item.id)}
                            className={cn(
                              "mt-0.5 shrink-0 p-1 rounded transition-colors",
                              itemNote ? "text-accent hover:bg-accent/10" : "text-muted-foreground/30 hover:text-muted-foreground hover:bg-muted/50"
                            )}
                            title={t("Agregar nota", "Add note")}
                          >
                            <MessageSquare className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-3 pt-2">
        {onSave && (
          <Button onClick={onSave} disabled={saving} className="gap-2 bg-accent text-accent-foreground hover:bg-accent/90">
            <Save className="w-4 h-4" />
            {saving ? t("Guardando...", "Saving...") : t("Guardar Progreso", "Save Progress")}
          </Button>
        )}
        <Button variant="outline" onClick={handleExportPdf} className="gap-2">
          <Download className="w-4 h-4" />
          {t("Exportar PDF", "Export PDF")}
        </Button>
      </div>
    </div>
  );
}
