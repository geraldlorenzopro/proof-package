/**
 * Single source of truth for immigration status values.
 * Used in: ClientProfileEditor (dropdown), CaseWorkspace (badge), any future reference.
 */

export interface ImmigrationStatus {
  value: string;
  label: string;
  color: string;       // Tailwind text class
  bgColor: string;     // Tailwind bg class
  borderColor: string; // Tailwind border class
}

export const IMMIGRATION_STATUSES: ImmigrationStatus[] = [
  { value: "undocumented",        label: "Sin Estatus",            color: "text-destructive",    bgColor: "bg-destructive/5",    borderColor: "border-destructive/20" },
  { value: "overstay",            label: "Visa Vencida",           color: "text-destructive",    bgColor: "bg-destructive/5",    borderColor: "border-destructive/20" },
  { value: "lpr",                 label: "Residente Permanente",   color: "text-emerald-400",    bgColor: "bg-emerald-500/5",    borderColor: "border-emerald-500/20" },
  { value: "conditional_resident",label: "Residente Condicional",  color: "text-accent",         bgColor: "bg-accent/5",         borderColor: "border-accent/20" },
  { value: "us_citizen",          label: "Ciudadano US",           color: "text-emerald-400",    bgColor: "bg-emerald-500/5",    borderColor: "border-emerald-500/20" },
  { value: "asylee",              label: "Asilado",                color: "text-jarvis",         bgColor: "bg-jarvis/5",         borderColor: "border-jarvis/20" },
  { value: "refugee",             label: "Refugiado",              color: "text-jarvis",         bgColor: "bg-jarvis/5",         borderColor: "border-jarvis/20" },
  { value: "tps",                 label: "TPS",                    color: "text-accent",         bgColor: "bg-accent/5",         borderColor: "border-accent/20" },
  { value: "daca",                label: "DACA",                   color: "text-accent",         bgColor: "bg-accent/5",         borderColor: "border-accent/20" },
  { value: "parolee",             label: "Parolee",                color: "text-accent",         bgColor: "bg-accent/5",         borderColor: "border-accent/20" },
  { value: "visa",                label: "Visa No-Inmigrante",     color: "text-jarvis",         bgColor: "bg-jarvis/5",         borderColor: "border-jarvis/20" },
  { value: "ead",                 label: "Permiso de Trabajo",     color: "text-jarvis",         bgColor: "bg-jarvis/5",         borderColor: "border-jarvis/20" },
  { value: "other",               label: "Otro",                   color: "text-muted-foreground",bgColor: "bg-muted",           borderColor: "border-border" },
];

const statusMap = new Map(IMMIGRATION_STATUSES.map(s => [s.value, s]));

/** Resolve an immigration status value to its full definition */
export function getImmigrationStatus(value: string | null | undefined): ImmigrationStatus | null {
  if (!value) return null;
  return statusMap.get(value) || {
    value,
    label: value,
    color: "text-muted-foreground",
    bgColor: "bg-muted",
    borderColor: "border-border",
  };
}
