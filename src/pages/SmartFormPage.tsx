import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FileText, ArrowLeft, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import I765Wizard from "@/components/smartforms/I765Wizard";
import { I765Data } from "@/components/smartforms/i765Schema";
import { generateI765Pdf } from "@/lib/i765PdfGenerator";

export default function SmartFormPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isNew = !id || id === "new";

  const [lang, setLang] = useState<"en" | "es">("es");
  const [saving, setSaving] = useState(false);
  const [submissionId, setSubmissionId] = useState<string | null>(isNew ? null : id!);
  const [initialData, setInitialData] = useState<Partial<I765Data>>({});
  const [firmName, setFirmName] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { navigate("/auth"); return; }

      // Load firm name for PDF branding
      const { data: profile } = await supabase
        .from("profiles")
        .select("firm_name")
        .eq("user_id", session.user.id)
        .maybeSingle();
      if (profile?.firm_name) setFirmName(profile.firm_name);

      // If editing existing submission, load it
      if (!isNew && id) {
        const { data: sub, error } = await supabase
          .from("form_submissions")
          .select("id, form_data")
          .eq("id", id)
          .maybeSingle();
        if (error || !sub) {
          toast({ title: "Error", description: "Formulario no encontrado", variant: "destructive" });
          navigate("/dashboard/smart-forms");
          return;
        }
        setSubmissionId(sub.id);
        setInitialData(sub.form_data as Partial<I765Data>);
      }
      setLoaded(true);
    };
    init();
  }, [navigate, id, isNew]);

  const getAccountId = async (userId: string): Promise<string | null> => {
    const { data } = await supabase.rpc("user_account_id", { _user_id: userId });
    return data as string | null;
  };

  const handleSave = async (formData: I765Data, status: "draft" | "completed") => {
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast({ title: "Error", description: "Not authenticated", variant: "destructive" }); return; }

      const accountId = await getAccountId(session.user.id);
      if (!accountId) { toast({ title: "Error", description: "No account found", variant: "destructive" }); return; }

      const payload = {
        account_id: accountId,
        user_id: session.user.id,
        form_type: "i-765" as string,
        form_version: "08/21/25",
        status,
        form_data: JSON.parse(JSON.stringify(formData)),
        client_name: `${formData.lastName}, ${formData.firstName}`.trim() || null,
        client_email: formData.applicantEmail || null,
      };

      if (submissionId && !isNew) {
        const { error } = await supabase
          .from("form_submissions")
          .update(payload)
          .eq("id", submissionId);
        if (error) throw error;
      } else {
        const { data: inserted, error } = await supabase
          .from("form_submissions")
          .insert(payload)
          .select("id")
          .single();
        if (error) throw error;
        if (inserted) {
          setSubmissionId(inserted.id);
          // Replace URL so subsequent saves update rather than insert
          window.history.replaceState(null, "", `/dashboard/smart-forms/${inserted.id}`);
        }
      }

      if (status === "completed") {
        generateI765Pdf(formData, firmName || undefined);
        toast({ title: lang === "es" ? "✅ Formulario completado" : "✅ Form completed", description: lang === "es" ? "PDF generado y datos guardados" : "PDF generated and data saved" });
      } else {
        toast({ title: lang === "es" ? "💾 Borrador guardado" : "💾 Draft saved" });
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (!loaded) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="animate-pulse text-muted-foreground">Loading...</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border/40 bg-card/50">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard/smart-forms")} className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-accent" />
              <h1 className="text-lg font-bold">NER Smart Forms</h1>
              <span className="text-xs bg-accent/20 text-accent px-2 py-0.5 rounded-full font-medium">I-765</span>
              {!isNew && <span className="text-xs text-muted-foreground">· Editando</span>}
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setLang(l => l === "es" ? "en" : "es")} className="gap-1.5 text-xs">
            <Globe className="w-4 h-4" /> {lang === "es" ? "EN" : "ES"}
          </Button>
        </div>
      </div>

      {/* Wizard */}
      <div className="max-w-5xl mx-auto px-4 py-8">
        <I765Wizard lang={lang} initialData={initialData} onSave={handleSave} saving={saving} />
      </div>
    </div>
  );
}
