import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, UserPlus } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (clientId: string, clientName: string) => void;
}

export default function NewClientModal({ open, onOpenChange, onCreated }: Props) {
  const [loading, setLoading] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [immigrationStatus, setImmigrationStatus] = useState("");

  const handleCreate = async () => {
    if (!firstName.trim() || !lastName.trim()) {
      toast.error("Nombre y apellido son requeridos");
      return;
    }

    setLoading(true);

    try {
      // Get current user + account
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Debes iniciar sesión");
        setLoading(false);
        return;
      }

      // Get account_id via RPC
      const { data: accountId, error: accountError } = await supabase.rpc("user_account_id", { _user_id: user.id });
      if (accountError || !accountId) {
        toast.error("No se pudo determinar la cuenta");
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("client_profiles")
        .insert({
          account_id: accountId,
          created_by: user.id,
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          email: email.trim() || null,
          phone: phone.trim() || null,
          immigration_status: immigrationStatus || null,
        })
        .select("id")
        .single();

      if (error) {
        console.error(error);
        toast.error("Error al crear cliente");
        setLoading(false);
        return;
      }

      const clientName = `${firstName.trim()} ${lastName.trim()}`;
      toast.success(`Cliente "${clientName}" creado`);
      
      // Reset form
      setFirstName("");
      setLastName("");
      setEmail("");
      setPhone("");
      setImmigrationStatus("");
      
      onOpenChange(false);
      onCreated(data.id, clientName);
    } catch (err) {
      console.error(err);
      toast.error("Error inesperado");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-jarvis" />
            Nuevo Cliente
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="firstName">Nombre *</Label>
              <Input
                id="firstName"
                placeholder="María"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Apellido *</Label>
              <Input
                id="lastName"
                placeholder="García"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                disabled={loading}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="maria@ejemplo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Teléfono</Label>
            <Input
              id="phone"
              type="tel"
              placeholder="+1 555 123 4567"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">Estatus Migratorio</Label>
            <Select value={immigrationStatus} onValueChange={setImmigrationStatus} disabled={loading}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="lpr">Residente Permanente (LPR)</SelectItem>
                <SelectItem value="ead">Permiso de Trabajo (EAD)</SelectItem>
                <SelectItem value="visa">Visa de No-Inmigrante</SelectItem>
                <SelectItem value="asylee">Asilado</SelectItem>
                <SelectItem value="refugee">Refugiado</SelectItem>
                <SelectItem value="tps">TPS</SelectItem>
                <SelectItem value="daca">DACA</SelectItem>
                <SelectItem value="undocumented">Sin estatus</SelectItem>
                <SelectItem value="other">Otro</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleCreate} disabled={loading} className="bg-jarvis hover:bg-jarvis/90 gap-2">
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            Crear Cliente
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
