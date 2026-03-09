import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import {
  Search, Users, UserPlus, Filter, SortAsc, ChevronRight,
  Phone, Mail, Calendar, MapPin, FileText, Clock, Sparkles,
  AlertCircle, CheckCircle2, CircleDot
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface ClientProfile {
  id: string;
  first_name: string | null;
  middle_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  dob: string | null;
  country_of_birth: string | null;
  address_city: string | null;
  address_state: string | null;
  immigration_status: string | null;
  created_at: string;
  updated_at: string;
}

interface Props {
  onSelectClient: (clientId: string, clientName: string) => void;
}

// Calculate profile completeness
function getProfileCompleteness(client: ClientProfile): number {
  const fields = [
    client.first_name, client.last_name, client.email, client.phone,
    client.dob, client.country_of_birth, client.address_city, client.address_state,
    client.immigration_status
  ];
  const filled = fields.filter(Boolean).length;
  return Math.round((filled / fields.length) * 100);
}

function getStatusBadge(completeness: number) {
  if (completeness >= 80) return { label: "Completo", variant: "success" as const, icon: CheckCircle2 };
  if (completeness >= 50) return { label: "En progreso", variant: "warning" as const, icon: CircleDot };
  return { label: "Nuevo", variant: "default" as const, icon: AlertCircle };
}

const statusColors = {
  success: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  warning: "bg-accent/10 text-accent border-accent/20",
  default: "bg-jarvis/10 text-jarvis border-jarvis/20",
};

export default function ClientDirectory({ onSelectClient }: Props) {
  const [clients, setClients] = useState<ClientProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "recent">("recent");

  useEffect(() => {
    fetchClients();
  }, []);

  async function fetchClients() {
    setLoading(true);
    const { data, error } = await supabase
      .from("client_profiles")
      .select("id, first_name, middle_name, last_name, email, phone, dob, country_of_birth, address_city, address_state, immigration_status, created_at, updated_at")
      .order("updated_at", { ascending: false });

    if (!error && data) {
      setClients(data);
    }
    setLoading(false);
  }

  // Filter and sort
  const filtered = clients
    .filter((c) => {
      const fullName = [c.first_name, c.middle_name, c.last_name].filter(Boolean).join(" ").toLowerCase();
      const q = search.toLowerCase();
      return fullName.includes(q) || (c.email?.toLowerCase().includes(q)) || (c.phone?.includes(q));
    })
    .sort((a, b) => {
      if (sortBy === "name") {
        const nameA = [a.first_name, a.last_name].filter(Boolean).join(" ").toLowerCase();
        const nameB = [b.first_name, b.last_name].filter(Boolean).join(" ").toLowerCase();
        return nameA.localeCompare(nameB);
      }
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });

  const getClientName = (c: ClientProfile) => {
    const parts = [c.first_name, c.middle_name, c.last_name].filter(Boolean);
    return parts.length > 0 ? parts.join(" ") : "Sin nombre";
  };

  const getInitials = (c: ClientProfile) => {
    const first = c.first_name?.[0] || "";
    const last = c.last_name?.[0] || "";
    return (first + last).toUpperCase() || "?";
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-lg border-b border-border">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-jarvis/20 to-accent/20 flex items-center justify-center">
                <Users className="w-5 h-5 text-jarvis" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">Directorio de Clientes</h1>
                <p className="text-xs text-muted-foreground">
                  {clients.length} cliente{clients.length !== 1 ? "s" : ""} sincronizado{clients.length !== 1 ? "s" : ""}
                </p>
              </div>
            </div>
            <Button variant="default" size="sm" className="gap-2 bg-jarvis hover:bg-jarvis/90">
              <UserPlus className="w-4 h-4" />
              <span className="hidden sm:inline">Nuevo Cliente</span>
            </Button>
          </div>

          {/* Search & Filters */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre, email o teléfono..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 bg-muted/50 border-border focus:border-jarvis/50"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSortBy(sortBy === "recent" ? "name" : "recent")}
              className="gap-2"
            >
              <SortAsc className="w-4 h-4" />
              {sortBy === "recent" ? "Recientes" : "A-Z"}
            </Button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-6xl mx-auto px-4 py-6">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-40 rounded-xl" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-20 text-center"
          >
            <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
              <Users className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">
              {search ? "Sin resultados" : "Sin clientes"}
            </h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              {search
                ? "No encontramos clientes con esa búsqueda. Intenta con otro término."
                : "Los clientes sincronizados desde tu CRM aparecerán aquí automáticamente."
              }
            </p>
          </motion.div>
        ) : (
          <motion.div
            initial="hidden"
            animate="visible"
            variants={{ visible: { transition: { staggerChildren: 0.05 } } }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
          >
            <AnimatePresence mode="popLayout">
              {filtered.map((client) => {
                const completeness = getProfileCompleteness(client);
                const status = getStatusBadge(completeness);
                const StatusIcon = status.icon;

                return (
                  <motion.button
                    key={client.id}
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    whileHover={{ scale: 1.02, y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => onSelectClient(client.id, getClientName(client))}
                    className="group relative bg-card border border-border rounded-xl p-4 text-left transition-all hover:border-jarvis/30 hover:shadow-lg hover:shadow-jarvis/5"
                  >
                    {/* Top row: Avatar + Name + Status */}
                    <div className="flex items-start gap-3 mb-3">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-jarvis/20 to-accent/10 flex items-center justify-center text-lg font-bold text-jarvis shrink-0">
                        {getInitials(client)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-foreground truncate group-hover:text-jarvis transition-colors">
                          {getClientName(client)}
                        </h3>
                        <Badge className={`mt-1 text-xs border ${statusColors[status.variant]}`}>
                          <StatusIcon className="w-3 h-3 mr-1" />
                          {status.label}
                        </Badge>
                      </div>
                      <ChevronRight className="w-5 h-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>

                    {/* Details */}
                    <div className="space-y-1.5 text-xs text-muted-foreground">
                      {client.email && (
                        <div className="flex items-center gap-2 truncate">
                          <Mail className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">{client.email}</span>
                        </div>
                      )}
                      {client.phone && (
                        <div className="flex items-center gap-2">
                          <Phone className="w-3.5 h-3.5 shrink-0" />
                          <span>{client.phone}</span>
                        </div>
                      )}
                      {(client.address_city || client.address_state) && (
                        <div className="flex items-center gap-2">
                          <MapPin className="w-3.5 h-3.5 shrink-0" />
                          <span>{[client.address_city, client.address_state].filter(Boolean).join(", ")}</span>
                        </div>
                      )}
                    </div>

                    {/* Progress bar */}
                    <div className="mt-3 pt-3 border-t border-border/50">
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <span className="text-muted-foreground">Perfil completo</span>
                        <span className="font-medium text-foreground">{completeness}%</span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${completeness}%` }}
                          transition={{ duration: 0.8, ease: "easeOut" }}
                          className="h-full bg-gradient-to-r from-jarvis to-accent rounded-full"
                        />
                      </div>
                    </div>

                    {/* Footer */}
                    <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground/70">
                      <Clock className="w-3 h-3" />
                      <span>
                        Actualizado {format(new Date(client.updated_at), "d MMM", { locale: es })}
                      </span>
                    </div>
                  </motion.button>
                );
              })}
            </AnimatePresence>
          </motion.div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-border/50 mt-8">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <Sparkles className="w-3.5 h-3.5 text-jarvis" />
          Immigration Case Workspace · Powered by NER AI
        </div>
      </footer>
    </div>
  );
}
