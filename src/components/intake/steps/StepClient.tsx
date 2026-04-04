import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Search, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { IntakeData } from "../IntakeWizard";

interface Props {
  data: IntakeData;
  update: (partial: Partial<IntakeData>) => void;
  accountId: string;
}

interface ClientResult {
  id: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  email: string | null;
}

export default function StepClient({ data, update, accountId }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ClientResult[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (query.length < 2 || !accountId) { setResults([]); return; }
    const timer = setTimeout(() => searchClients(query), 300);
    return () => clearTimeout(timer);
  }, [query, accountId]);

  async function searchClients(q: string) {
    setSearching(true);
    const { data: clients } = await supabase
      .from("client_profiles")
      .select("id, first_name, last_name, phone, email")
      .eq("account_id", accountId)
      .or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,phone.ilike.%${q}%,email.ilike.%${q}%`)
      .limit(5);
    setResults(clients || []);
    setSearching(false);
  }

  function selectClient(client: ClientResult) {
    update({
      client_profile_id: client.id,
      is_existing_client: true,
      client_first_name: client.first_name || "",
      client_last_name: client.last_name || "",
      client_phone: client.phone || "",
      client_email: client.email || "",
    });
    setQuery("");
    setResults([]);
  }

  function clearClient() {
    update({
      client_profile_id: null,
      is_existing_client: false,
      client_first_name: "",
      client_last_name: "",
      client_phone: "",
      client_email: "",
    });
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-bold text-foreground mb-1">¿Quién es el cliente?</h3>
        <p className="text-sm text-muted-foreground">Busca un cliente existente o ingresa los datos</p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Buscar cliente existente..."
          className="w-full border border-input bg-background rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
        {searching && <RefreshCw className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground animate-spin" />}
      </div>

      {results.length > 0 && (
        <div className="border border-border rounded-xl overflow-hidden divide-y divide-border">
          {results.map(c => (
            <button
              key={c.id}
              onClick={() => selectClient(c)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-secondary/50 transition-colors text-left"
            >
              <div className="w-8 h-8 rounded-full bg-jarvis/10 flex items-center justify-center text-jarvis text-xs font-bold">
                {(c.first_name?.[0] || "?").toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">
                  {c.first_name} {c.last_name}
                </p>
                <p className="text-xs text-muted-foreground truncate">{c.phone || c.email}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Existing client badge */}
      {data.is_existing_client && (
        <div className="flex items-center gap-2">
          <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
            ♻️ Cliente existente
          </Badge>
          <button onClick={clearClient} className="text-xs text-muted-foreground hover:text-foreground">
            Cambiar
          </button>
        </div>
      )}

      {/* Form fields */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Nombre *</label>
          <input
            type="text"
            value={data.client_first_name}
            onChange={e => update({ client_first_name: e.target.value })}
            placeholder="Juan"
            className="w-full border border-input bg-background rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          {data.client_first_name.length > 0 && data.client_first_name.length < 2 && (
            <p className="text-[10px] text-rose-400 mt-1">Mínimo 2 caracteres</p>
          )}
        </div>
        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Apellido *</label>
          <input
            type="text"
            value={data.client_last_name}
            onChange={e => update({ client_last_name: e.target.value })}
            placeholder="Pérez"
            className="w-full border border-input bg-background rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>

      <div>
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Teléfono *</label>
        <input
          type="tel"
          value={data.client_phone}
          onChange={e => update({ client_phone: e.target.value })}
          placeholder="+1 (555) 123-4567"
          className="w-full border border-input bg-background rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      <div>
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Email (opcional)</label>
        <input
          type="email"
          value={data.client_email}
          onChange={e => update({ client_email: e.target.value })}
          placeholder="cliente@email.com"
          className="w-full border border-input bg-background rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {/* Language */}
      <div>
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Idioma preferido</label>
        <div className="flex gap-3">
          {[
            { key: "es", label: "🇪🇸 Español" },
            { key: "en", label: "🇺🇸 English" },
          ].map(lang => (
            <button
              key={lang.key}
              onClick={() => update({ client_language: lang.key })}
              className={`flex-1 py-2.5 rounded-xl border text-sm font-semibold transition-all ${
                data.client_language === lang.key
                  ? "border-jarvis bg-jarvis/10 text-jarvis"
                  : "border-border text-muted-foreground hover:border-foreground/20"
              }`}
            >
              {lang.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
