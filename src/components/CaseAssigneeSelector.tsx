import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { UserRound, ChevronDown, Check } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { logAudit } from "@/lib/auditLog";

interface TeamMember {
  user_id: string;
  full_name: string | null;
  role: string;
}

interface CaseAssigneeSelectorProps {
  caseId: string;
  table: "client_cases" | "vawa_cases";
  currentAssignee: string | null;
  onAssigned?: (newAssigneeId: string, name: string) => void;
  compact?: boolean;
}

export default function CaseAssigneeSelector({
  caseId,
  table,
  currentAssignee,
  onAssigned,
  compact = false,
}: CaseAssigneeSelectorProps) {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(currentAssignee);

  useEffect(() => {
    setSelected(currentAssignee);
  }, [currentAssignee]);

  useEffect(() => {
    if (!open || members.length > 0) return;
    loadMembers();
  }, [open]);

  const loadMembers = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: accountId } = await supabase.rpc("user_account_id", { _user_id: user.id });
    if (!accountId) return;

    const { data: membersData } = await supabase
      .from("account_members")
      .select("user_id, role")
      .eq("account_id", accountId);

    if (!membersData) return;

    // Get profiles for display names
    const userIds = membersData.map((m) => m.user_id);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, full_name")
      .in("user_id", userIds);

    const profileMap = new Map(profiles?.map((p) => [p.user_id, p.full_name]) || []);

    setMembers(
      membersData.map((m) => ({
        user_id: m.user_id,
        full_name: profileMap.get(m.user_id) || null,
        role: m.role,
      }))
    );
  };

  const handleAssign = async (memberId: string) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from(table)
        .update({ assigned_to: memberId } as any)
        .eq("id", caseId);

      if (error) throw error;

      setSelected(memberId);
      setOpen(false);

      const member = members.find((m) => m.user_id === memberId);
      const name = member?.full_name || "Miembro";
      toast.success(`Caso asignado a ${name}`);
      onAssigned?.(memberId, name);
    } catch {
      toast.error("Error al reasignar");
    } finally {
      setLoading(false);
    }
  };

  const selectedMember = members.find((m) => m.user_id === selected);
  const displayName = selectedMember?.full_name || (selected ? "Miembro" : "Sin asignar");

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size={compact ? "sm" : "default"}
          className={cn(
            "gap-2 font-normal",
            compact && "h-7 text-xs px-2",
            !selected && "text-muted-foreground"
          )}
        >
          <UserRound className={cn("shrink-0", compact ? "w-3 h-3" : "w-4 h-4")} />
          <span className="truncate max-w-[120px]">{displayName}</span>
          <ChevronDown className={cn("shrink-0 opacity-50", compact ? "w-3 h-3" : "w-4 h-4")} />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-1" align="start">
        <p className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
          Asignar a
        </p>
        {members.length === 0 && (
          <p className="px-2 py-3 text-xs text-muted-foreground text-center">
            Cargando equipo...
          </p>
        )}
        {members.map((m) => (
          <button
            key={m.user_id}
            disabled={loading}
            onClick={() => handleAssign(m.user_id)}
            className={cn(
              "w-full flex items-center gap-2 px-2 py-2 text-sm rounded-md transition-colors",
              "hover:bg-accent/10 text-foreground",
              selected === m.user_id && "bg-accent/10 font-medium"
            )}
          >
            <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary shrink-0">
              {(m.full_name || "?")[0].toUpperCase()}
            </div>
            <div className="flex-1 text-left min-w-0">
              <p className="truncate">{m.full_name || "Sin nombre"}</p>
              <p className="text-[10px] text-muted-foreground capitalize">{m.role}</p>
            </div>
            {selected === m.user_id && (
              <Check className="w-4 h-4 text-primary shrink-0" />
            )}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}
