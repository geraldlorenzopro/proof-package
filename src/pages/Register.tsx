import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, Building2 } from "lucide-react";
import { toast } from "sonner";
import { initializeOfficeConfig } from "@/lib/officeSetup";
import PasswordStrengthMeter from "@/components/PasswordStrengthMeter";
import { useTrackPageView } from "@/hooks/useTrackPageView";

export default function Register() {
  useTrackPageView("public.register");
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    firmName: "",
    attorneyName: "",
    email: "",
    phone: "",
    plan: "essential",
    password: "",
    confirmPassword: "",
  });

  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (form.password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres");
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError("Las contraseñas no coinciden");
      return;
    }

    setLoading(true);
    try {
      // 1. Create auth user
      const { data: authData, error: authErr } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: { emailRedirectTo: window.location.origin },
      });
      if (authErr) throw new Error(authErr.message);

      // 2. Provision account via edge function
      const { data: provData, error: provErr } = await supabase.functions.invoke("provision-account", {
        body: {
          account_name: form.firmName,
          email: form.email,
          phone: form.phone || null,
          plan: form.plan,
          attorney_name: form.attorneyName,
          __skip_auth_create: true, // Tell provision-account user already exists
        },
      });

      if (provErr || provData?.error) {
        throw new Error(provData?.error || provErr?.message || "Error al crear la cuenta");
      }

      // 3. Initialize office config
      if (provData?.account_id) {
        await initializeOfficeConfig(provData.account_id);

        // Update office_config with attorney name and firm name
        await supabase.from("office_config").update({
          firm_name: form.firmName,
          attorney_name: form.attorneyName,
          firm_email: form.email,
          firm_phone: form.phone || null,
        }).eq("account_id", provData.account_id);
      }

      // 4. Send welcome email (non-blocking)
      supabase.functions.invoke("send-email", {
        body: {
          template_type: "firm_welcome",
          to_email: form.email,
          to_name: form.attorneyName,
          account_id: provData?.account_id,
          variables: {
            attorney_name: form.attorneyName,
            firm_name: form.firmName,
          },
        },
      }).catch(() => {});

      toast.success("¡Cuenta creada exitosamente!");
      navigate("/hub");
    } catch (err: any) {
      setError(err.message || "Error al registrar");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-white/[0.03] border-white/10">
        <CardHeader className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-red-600 flex items-center justify-center">
              <Building2 className="w-4 h-4 text-white" />
            </div>
            <span className="text-lg font-bold text-white tracking-tight">NER Immigration AI</span>
          </div>
          <CardTitle className="text-white text-xl">Registra tu firma</CardTitle>
          <CardDescription className="text-white/50">
            Comienza a gestionar tus casos de inmigración
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-white/70 text-xs">Nombre de la firma *</Label>
              <Input
                required
                value={form.firmName}
                onChange={(e) => set("firmName", e.target.value)}
                placeholder="Ej: Lopez Law Group"
                className="bg-white/5 border-white/10 text-white"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-white/70 text-xs">Tu nombre *</Label>
              <Input
                required
                value={form.attorneyName}
                onChange={(e) => set("attorneyName", e.target.value)}
                placeholder="Ej: María López"
                className="bg-white/5 border-white/10 text-white"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-white/70 text-xs">Email *</Label>
              <Input
                required
                type="email"
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
                placeholder="maria@lopezlaw.com"
                className="bg-white/5 border-white/10 text-white"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-white/70 text-xs">Teléfono</Label>
              <Input
                value={form.phone}
                onChange={(e) => set("phone", e.target.value)}
                placeholder="+1 (555) 123-4567"
                className="bg-white/5 border-white/10 text-white"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-white/70 text-xs">Plan *</Label>
              <Select value={form.plan} onValueChange={(v) => set("plan", v)}>
                <SelectTrigger className="bg-white/5 border-white/10 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="essential">Essential — 1 usuario</SelectItem>
                  <SelectItem value="professional">Professional — 3 usuarios</SelectItem>
                  <SelectItem value="elite">Elite — 5 usuarios</SelectItem>
                  <SelectItem value="enterprise">Enterprise — Ilimitado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-white/70 text-xs">Contraseña * (mín. 8 caracteres)</Label>
              <Input
                required
                type="password"
                value={form.password}
                onChange={(e) => set("password", e.target.value)}
                className="bg-white/5 border-white/10 text-white"
              />
              <PasswordStrengthMeter password={form.password} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-white/70 text-xs">Confirmar contraseña *</Label>
              <Input
                required
                type="password"
                value={form.confirmPassword}
                onChange={(e) => set("confirmPassword", e.target.value)}
                className="bg-white/5 border-white/10 text-white"
              />
            </div>

            {error && (
              <p className="text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded p-2">
                {error}
              </p>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-red-600 hover:bg-red-700 text-white"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creando cuenta...
                </>
              ) : (
                "Crear cuenta"
              )}
            </Button>

            <p className="text-center text-white/40 text-xs">
              ¿Ya tienes cuenta?{" "}
              <Link to="/auth" className="text-red-400 hover:text-red-300 underline">
                Inicia sesión
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
