import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Loader2, Sparkles, Lock, Search, X } from "lucide-react";
import {
  USCIS_FORMS_CATALOG,
  CATEGORY_LABELS,
  ICON_OPTIONS,
  COLOR_OPTIONS,
  type UscisFormDef,
} from "@/lib/uscisForms";

interface FormInTemplate {
  form_type: string;
  required: boolean;
  sort_order: number;
}

interface SmartProcessTemplate {
  id: string;
  account_id: string | null;
  name: string;
  description: string | null;
  icon: string;
  color: string;
  case_type: string | null;
  forms_included: FormInTemplate[];
  is_active: boolean;
  sort_order: number;
}

interface Props {
  accountId: string;
  canEdit: boolean; // owner or admin
}

const COLOR_CLASSES: Record<string, string> = {
  blue: "bg-blue-500/15 text-blue-300 border-blue-500/30",
  emerald: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  cyan: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30",
  red: "bg-red-500/15 text-red-300 border-red-500/30",
  amber: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  pink: "bg-pink-500/15 text-pink-300 border-pink-500/30",
  purple: "bg-purple-500/15 text-purple-300 border-purple-500/30",
  sky: "bg-sky-500/15 text-sky-300 border-sky-500/30",
  orange: "bg-orange-500/15 text-orange-300 border-orange-500/30",
  violet: "bg-violet-500/15 text-violet-300 border-violet-500/30",
};

const emptyDraft = (): SmartProcessTemplate => ({
  id: "",
  account_id: "",
  name: "",
  description: "",
  icon: "📋",
  color: "blue",
  case_type: "",
  forms_included: [],
  is_active: true,
  sort_order: 100,
});

export default function SmartProcessesPanel({ accountId, canEdit }: Props) {
  const [templates, setTemplates] = useState<SmartProcessTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [editorOpen, setEditorOpen] = useState(false);
  const [draft, setDraft] = useState<SmartProcessTemplate>(emptyDraft());
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("smart_process_templates" as any)
      .select("*")
      .or(`account_id.is.null,account_id.eq.${accountId}`)
      .order("account_id", { ascending: true, nullsFirst: true })
      .order("sort_order", { ascending: true });
    if (error) {
      toast.error("Error cargando Smart Processes");
      setLoading(false);
      return;
    }
    setTemplates((data as any) || []);
    setLoading(false);
  }, [accountId]);

  useEffect(() => { load(); }, [load]);

  function openNew() {
    setDraft({ ...emptyDraft(), account_id: accountId });
    setEditorOpen(true);
  }

  function openEdit(t: SmartProcessTemplate) {
    setDraft({ ...t, forms_included: [...(t.forms_included || [])] });
    setEditorOpen(true);
  }

  function toggleForm(code: string) {
    setDraft(prev => {
      const exists = prev.forms_included.find(f => f.form_type === code);
      if (exists) {
        return { ...prev, forms_included: prev.forms_included.filter(f => f.form_type !== code) };
      }
      return {
        ...prev,
        forms_included: [
          ...prev.forms_included,
          { form_type: code, required: true, sort_order: prev.forms_included.length + 1 },
        ],
      };
    });
  }

  function toggleRequired(code: string) {
    setDraft(prev => ({
      ...prev,
      forms_included: prev.forms_included.map(f =>
        f.form_type === code ? { ...f, required: !f.required } : f
      ),
    }));
  }

  async function handleSave() {
    if (!draft.name.trim()) { toast.error("El nombre es obligatorio"); return; }
    if (draft.forms_included.length === 0) { toast.error("Agregá al menos un formulario"); return; }

    setSaving(true);
    const payload = {
      account_id: accountId,
      name: draft.name.trim(),
      description: draft.description?.trim() || null,
      icon: draft.icon,
      color: draft.color,
      case_type: draft.case_type?.trim() || null,
      forms_included: draft.forms_included.map((f, i) => ({ ...f, sort_order: i + 1 })),
      is_active: draft.is_active,
      sort_order: draft.sort_order,
    };

    const isNew = !draft.id;
    const res = isNew
      ? await supabase.from("smart_process_templates" as any).insert(payload as any)
      : await supabase.from("smart_process_templates" as any).update(payload as any).eq("id", draft.id);

    setSaving(false);
    if (res.error) {
      toast.error(res.error.message);
      return;
    }
    toast.success(isNew ? "Smart Process creado" : "Smart Process actualizado");
    setEditorOpen(false);
    load();
  }

  async function handleDelete(id: string) {
    if (!confirm("¿Eliminar este Smart Process? Los casos ya creados con él no se modifican.")) return;
    const { error } = await supabase.from("smart_process_templates" as any).delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Eliminado");
    load();
  }

  const globalTemplates = templates.filter(t => t.account_id === null);
  const customTemplates = templates.filter(t => t.account_id === accountId);

  const filteredCatalog = USCIS_FORMS_CATALOG.filter(f =>
    !search || f.code.toLowerCase().includes(search.toLowerCase()) || f.name.toLowerCase().includes(search.toLowerCase())
  );

  const groupedCatalog = filteredCatalog.reduce<Record<string, UscisFormDef[]>>((acc, f) => {
    (acc[f.category] = acc[f.category] || []).push(f);
    return acc;
  }, {});

  if (loading) {
    return (
      <Card className="bg-card/60 border-border/30 p-8 flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <Card className="bg-card/60 border-border/30 p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" /> Smart Processes
            </h2>
            <p className="text-sm text-muted-foreground max-w-xl">
              Plantillas que agrupan varios formularios USCIS en un solo proceso legal. Cuando un cliente contrata, el paralegal elige una plantilla y NER crea el caso con todos los formularios listos.
            </p>
          </div>
          {canEdit && (
            <Button onClick={openNew} className="gap-2 shrink-0">
              <Plus className="w-4 h-4" /> Nuevo Smart Process
            </Button>
          )}
        </div>
      </Card>

      {/* Custom templates (firm-specific) */}
      <Card className="bg-card/60 border-border/30 p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">Tus Smart Processes</h3>
          <Badge variant="outline" className="text-[10px]">{customTemplates.length}</Badge>
        </div>
        {customTemplates.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border/40 p-6 text-center">
            <p className="text-sm text-muted-foreground mb-3">No has creado Smart Processes propios todavía.</p>
            {canEdit && (
              <Button variant="outline" size="sm" onClick={openNew} className="gap-2">
                <Plus className="w-3.5 h-3.5" /> Crear el primero
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {customTemplates.map(t => (
              <TemplateRow
                key={t.id}
                template={t}
                canEdit={canEdit}
                onEdit={() => openEdit(t)}
                onDelete={() => handleDelete(t.id)}
              />
            ))}
          </div>
        )}
      </Card>

      {/* Global NER templates */}
      <Card className="bg-card/60 border-border/30 p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            Plantillas NER (globales)
            <Lock className="w-3 h-3 text-muted-foreground" />
          </h3>
          <Badge variant="outline" className="text-[10px]">{globalTemplates.length}</Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          Mantenidas por NER y disponibles para todas las firmas. Podés duplicarlas para personalizarlas.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {globalTemplates.map(t => (
            <TemplateRow
              key={t.id}
              template={t}
              canEdit={false}
              isGlobal
              onDuplicate={canEdit ? () => {
                setDraft({
                  ...t,
                  id: "",
                  account_id: accountId,
                  name: `${t.name} (copia)`,
                  forms_included: [...(t.forms_included || [])],
                });
                setEditorOpen(true);
              } : undefined}
            />
          ))}
        </div>
      </Card>

      {/* Editor dialog */}
      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="bg-card border-border max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-foreground">
              {draft.id ? "Editar Smart Process" : "Nuevo Smart Process"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Name + description */}
            <div className="grid grid-cols-[80px_1fr] gap-3 items-start">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Icono</label>
                <select
                  value={draft.icon}
                  onChange={e => setDraft({ ...draft, icon: e.target.value })}
                  className="w-full h-10 rounded-md border border-border bg-muted/30 text-2xl text-center"
                >
                  {ICON_OPTIONS.map(i => <option key={i} value={i}>{i}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Nombre *</label>
                <Input
                  value={draft.name}
                  onChange={e => setDraft({ ...draft, name: e.target.value })}
                  placeholder="Ej: Premium Processing H-1B"
                  className="bg-muted/30"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Descripción corta</label>
              <Textarea
                value={draft.description || ""}
                onChange={e => setDraft({ ...draft, description: e.target.value })}
                placeholder="Una línea sobre qué es este proceso"
                className="bg-muted/30 min-h-[60px] text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Color</label>
                <select
                  value={draft.color}
                  onChange={e => setDraft({ ...draft, color: e.target.value })}
                  className="w-full h-10 rounded-md border border-border bg-muted/30 px-3 text-sm capitalize"
                >
                  {COLOR_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Tipo de caso (principal)</label>
                <Input
                  value={draft.case_type || ""}
                  onChange={e => setDraft({ ...draft, case_type: e.target.value })}
                  placeholder="Ej: I-485"
                  className="bg-muted/30"
                />
              </div>
            </div>

            {/* Forms selected */}
            <div className="space-y-2 border-t border-border pt-4">
              <div className="flex items-center justify-between">
                <label className="text-sm font-semibold text-foreground">Formularios incluidos</label>
                <Badge variant="outline" className="text-[10px]">{draft.forms_included.length} seleccionados</Badge>
              </div>

              {draft.forms_included.length > 0 && (
                <div className="space-y-1.5 rounded-md border border-border/40 bg-muted/20 p-2">
                  {draft.forms_included.map(f => (
                    <div key={f.form_type} className="flex items-center justify-between gap-2 text-xs bg-card/60 rounded px-2 py-1.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-mono font-semibold text-primary">{f.form_type}</span>
                        <span className="text-muted-foreground truncate">
                          {USCIS_FORMS_CATALOG.find(x => x.code === f.form_type)?.name || ""}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => toggleRequired(f.form_type)}
                          className={`text-[10px] px-2 py-0.5 rounded-full border ${
                            f.required
                              ? "bg-primary/15 text-primary border-primary/30"
                              : "bg-muted/40 text-muted-foreground border-border"
                          }`}
                        >
                          {f.required ? "Obligatorio" : "Opcional"}
                        </button>
                        <button onClick={() => toggleForm(f.form_type)} className="text-muted-foreground hover:text-red-400">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Catalog with search */}
              <div className="relative pt-2">
                <Search className="absolute left-2.5 top-3 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Buscar formulario..."
                  className="pl-8 bg-muted/30 h-9 text-sm"
                />
              </div>

              <div className="max-h-[260px] overflow-y-auto space-y-3 pr-1">
                {Object.entries(groupedCatalog).map(([cat, forms]) => (
                  <div key={cat}>
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1.5">
                      {CATEGORY_LABELS[cat as UscisFormDef["category"]]}
                    </p>
                    <div className="grid grid-cols-1 gap-1">
                      {forms.map(f => {
                        const selected = !!draft.forms_included.find(x => x.form_type === f.code);
                        return (
                          <button
                            key={f.code}
                            type="button"
                            onClick={() => toggleForm(f.code)}
                            className={`flex items-center gap-2 text-xs text-left px-2 py-1.5 rounded border transition ${
                              selected
                                ? "bg-primary/10 border-primary/40 text-foreground"
                                : "bg-muted/20 border-border/30 hover:bg-muted/40 text-muted-foreground"
                            }`}
                          >
                            <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center ${
                              selected ? "bg-primary border-primary" : "border-border"
                            }`}>
                              {selected && <span className="text-[8px] text-primary-foreground">✓</span>}
                            </span>
                            <span className="font-mono font-semibold w-16 shrink-0">{f.code}</span>
                            <span className="truncate">{f.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-border pt-3">
              <label className="flex items-center gap-2 text-sm text-foreground">
                <Switch checked={draft.is_active} onCheckedChange={v => setDraft({ ...draft, is_active: v })} />
                Activo
              </label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditorOpen(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving} className="gap-2">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {draft.id ? "Guardar cambios" : "Crear Smart Process"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TemplateRow({
  template,
  canEdit,
  isGlobal,
  onEdit,
  onDelete,
  onDuplicate,
}: {
  template: SmartProcessTemplate;
  canEdit: boolean;
  isGlobal?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
  onDuplicate?: () => void;
}) {
  const colorClass = COLOR_CLASSES[template.color] || COLOR_CLASSES.blue;
  return (
    <div className="rounded-lg border border-border/40 bg-card/60 p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 min-w-0">
          <div className={`w-9 h-9 rounded-md border flex items-center justify-center text-lg shrink-0 ${colorClass}`}>
            {template.icon}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">{template.name}</p>
            {template.description && (
              <p className="text-[11px] text-muted-foreground line-clamp-2">{template.description}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {isGlobal && onDuplicate && (
            <Button size="sm" variant="ghost" onClick={onDuplicate} className="h-7 px-2 text-[10px]">
              Duplicar
            </Button>
          )}
          {canEdit && onEdit && (
            <Button size="icon" variant="ghost" onClick={onEdit} className="h-7 w-7">
              <Pencil className="w-3.5 h-3.5" />
            </Button>
          )}
          {canEdit && onDelete && (
            <Button size="icon" variant="ghost" onClick={onDelete} className="h-7 w-7 text-red-400 hover:text-red-300">
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      </div>
      <div className="flex flex-wrap gap-1">
        {(template.forms_included || []).map(f => (
          <span
            key={f.form_type}
            className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${
              f.required
                ? "bg-primary/10 border-primary/30 text-primary"
                : "bg-muted/30 border-border text-muted-foreground"
            }`}
            title={f.required ? "Obligatorio" : "Opcional"}
          >
            {f.form_type}
          </span>
        ))}
      </div>
    </div>
  );
}
