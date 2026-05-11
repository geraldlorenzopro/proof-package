// SECURITY 2026-05-10: Origin allowlist para edge functions que consumen
// créditos pagados (LOVABLE_API_KEY, ELEVENLABS_API_KEY). Bloquea abuso
// directo vía curl/Postman desde internet abierta sin romper público legítimo
// (browser requests envían Origin header correcto).
//
// Permite también requests sin Origin (Supabase internal calls, server-to-server)
// — el riesgo se cubre con auth checks adicionales en la función.

const DEFAULT_ALLOWED = [
  "https://ner.recursosmigratorios.com",
  "https://app.nerimmigration.com",
  "http://localhost:5173",
  "http://localhost:3000",
  "http://localhost:8080",
];

function getAllowed(): string[] {
  const extra = Deno.env.get("ALLOWED_ORIGINS");
  if (!extra) return DEFAULT_ALLOWED;
  return [...DEFAULT_ALLOWED, ...extra.split(",").map((s) => s.trim()).filter(Boolean)];
}

/**
 * Verifica que el Origin header del request esté en la allowlist.
 * Permite también requests sin Origin (server-to-server) — solo bloquea
 * el caso "browser/curl con Origin de dominio random".
 *
 * @returns null si OK, o un objeto error si bloqueado
 */
export function checkOrigin(req: Request): { blocked: false } | { blocked: true; reason: string; origin: string } {
  const origin = req.headers.get("Origin");
  if (!origin) return { blocked: false }; // server-to-server, OK

  const allowed = getAllowed();
  const lowerOrigin = origin.toLowerCase();

  // Permitir cualquier subdominio *.lovable.app y *.lovableproject.com (preview deployments)
  if (lowerOrigin.endsWith(".lovable.app") || lowerOrigin.endsWith(".lovableproject.com")) {
    return { blocked: false };
  }

  if (allowed.some((a) => a.toLowerCase() === lowerOrigin)) {
    return { blocked: false };
  }

  return { blocked: true, reason: "origin_not_allowed", origin };
}
