import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import {
  FolderOpen, Plus, Download, Trash2, Loader2, FileText, Image, File
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";

interface CaseDocument {
  id: string;
  file_name: string;
  file_url: string;
  file_size: number | null;
  file_type: string | null;
  category: string;
  uploaded_by_name: string | null;
  created_at: string;
}

const CATEGORIES = [
  { value: "identificacion", label: "Identificación", color: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  { value: "estatus_migratorio", label: "Estatus migratorio", color: "bg-purple-500/10 text-purple-400 border-purple-500/20" },
  { value: "civil", label: "Civil (actas)", color: "bg-pink-500/10 text-pink-400 border-pink-500/20" },
  { value: "financiero", label: "Financiero", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
  { value: "medico", label: "Médico", color: "bg-red-500/10 text-red-400 border-red-500/20" },
  { value: "evidencia", label: "Evidencia adicional", color: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
  { value: "formularios_uscis", label: "Formularios USCIS", color: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20" },
  { value: "correspondencia", label: "Correspondencia USCIS", color: "bg-teal-500/10 text-teal-400 border-teal-500/20" },
  { value: "otro", label: "Otro", color: "bg-muted text-muted-foreground border-border" },
];

const getCategoryConfig = (cat: string) =>
  CATEGORIES.find(c => c.value === cat) || CATEGORIES[CATEGORIES.length - 1];

interface Props {
  caseId: string;
  accountId: string;
}

export default function CaseDocumentsPanel({ caseId, accountId }: Props) {
  const [docs, setDocs] = useState<CaseDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [category, setCategory] = useState("otro");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { loadDocs(); }, [caseId]);

  async function loadDocs() {
    const { data } = await supabase
      .from("case_documents")
      .select("*")
      .eq("case_id", caseId)
      .order("created_at", { ascending: false });
    setDocs((data as CaseDocument[]) || []);
    setLoading(false);
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      toast.error("El archivo no puede superar 10MB");
      return;
    }

    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No autenticado");

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("user_id", user.id)
        .maybeSingle();

      const timestamp = Date.now();
      const path = `${accountId}/${caseId}/${timestamp}-${file.name}`;

      const { error: uploadError } = await supabase.storage
        .from("case-documents")
        .upload(path, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("case-documents")
        .getPublicUrl(path);

      // For private buckets we use the path, not public URL
      const { error: insertError } = await supabase.from("case_documents").insert({
        account_id: accountId,
        case_id: caseId,
        uploaded_by: user.id,
        uploaded_by_name: profile?.full_name || "Staff",
        file_name: file.name,
        file_url: path,
        file_size: file.size,
        file_type: file.type,
        category,
      });

      if (insertError) throw insertError;

      toast.success("Documento subido");
      loadDocs();
    } catch (err: any) {
      toast.error(err.message || "Error al subir documento");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleDownload(doc: CaseDocument) {
    try {
      const { data, error } = await supabase.storage
        .from("case-documents")
        .download(doc.file_url);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = doc.file_name;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Error al descargar");
    }
  }

  async function handleDelete(doc: CaseDocument) {
    if (!confirm(`¿Eliminar "${doc.file_name}"?`)) return;

    try {
      await supabase.storage.from("case-documents").remove([doc.file_url]);
      await supabase.from("case_documents").delete().eq("id", doc.id);
      const { logAudit } = await import("@/lib/auditLog");
      logAudit({ action: "document.deleted" as any, entity_type: "document" as any, entity_id: doc.id, entity_label: doc.file_name });
      toast.success("Documento eliminado");
      loadDocs();
    } catch {
      toast.error("Error al eliminar");
    }
  }

  const getFileIcon = (type: string | null) => {
    if (!type) return File;
    if (type.startsWith("image/")) return Image;
    if (type.includes("pdf")) return FileText;
    return File;
  };

  const formatSize = (bytes: number | null) => {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 text-jarvis animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FolderOpen className="w-4 h-4 text-jarvis" />
          <h3 className="text-sm font-bold text-foreground">Documentos del Caso</h3>
          <Badge variant="outline" className="text-[9px]">{docs.length}</Badge>
        </div>
        <div className="flex items-center gap-2">
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="h-7 w-[160px] text-[11px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map(c => (
                <SelectItem key={c.value} value={c.value} className="text-xs">{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs gap-1"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
          >
            {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
            Subir documento
          </Button>
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx"
            onChange={handleUpload}
          />
        </div>
      </div>

      {docs.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-8 text-center">
          <FolderOpen className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No hay documentos en este caso</p>
          <p className="text-xs text-muted-foreground/60 mt-1">Sube identificaciones, actas, documentos migratorios y más.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {docs.map((doc, i) => {
            const FileIcon = getFileIcon(doc.file_type);
            const catCfg = getCategoryConfig(doc.category);
            return (
              <motion.div
                key={doc.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 hover:border-jarvis/20 transition-all group"
              >
                <div className="w-9 h-9 rounded-lg bg-muted/50 flex items-center justify-center shrink-0">
                  <FileIcon className="w-4 h-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{doc.file_name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Badge variant="outline" className={`text-[8px] ${catCfg.color}`}>
                      {catCfg.label}
                    </Badge>
                    {doc.file_size && (
                      <span className="text-[10px] text-muted-foreground">{formatSize(doc.file_size)}</span>
                    )}
                    <span className="text-[10px] text-muted-foreground">
                      {format(new Date(doc.created_at), "d MMM yyyy", { locale: es })}
                    </span>
                    {doc.uploaded_by_name && (
                      <span className="text-[10px] text-muted-foreground">· {doc.uploaded_by_name}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0"
                    onClick={() => handleDownload(doc)}
                  >
                    <Download className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                    onClick={() => handleDelete(doc)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
