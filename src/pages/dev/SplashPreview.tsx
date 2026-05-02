import { useState } from "react";
import HubSplash from "@/components/hub/HubSplash";

/**
 * Dev-only preview de HubSplash para review visual SIN auth.
 * Ruta: /dev/splash-preview
 */
export default function SplashPreview() {
  const [showSplash, setShowSplash] = useState(false);
  const [showLoading, setShowLoading] = useState(false);
  const [showError, setShowError] = useState<string | null>(null);
  const [firmName, setFirmName] = useState("Lexis Hispanic Law");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [runs, setRuns] = useState(0);

  const simulateError = (msg: string) => {
    setShowSplash(false);
    setShowLoading(false);
    setShowError(msg);
  };

  const playSplash = () => {
    setShowSplash(false);
    setTimeout(() => {
      setShowSplash(true);
      setRuns((r) => r + 1);
    }, 80);
  };

  const playFullFlow = () => {
    // Simula: loading 1.2s → splash 2.7s (flujo completo como producción)
    setShowSplash(false);
    setShowLoading(true);
    setTimeout(() => {
      setShowLoading(false);
      setShowSplash(true);
      setRuns((r) => r + 1);
    }, 1200);
  };

  const initials = (() => {
    const parts = firmName.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "NE";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  })();

  const presets = [
    {
      label: "🏢 Lexis Hispanic Law (genérico)",
      name: "Lexis Hispanic Law",
      logo: null,
    },
    {
      label: "🦅 Mr Visa — Logo Color (perfil)",
      name: "Mr Visa Immigration",
      logo: "/brand/firms/mrvisa-logo-color.png",
    },
    {
      label: "⚫ Mr Visa — Logo Mono",
      name: "Mr Visa Immigration",
      logo: "/brand/firms/mrvisa-logo-mono.png",
    },
    {
      label: "🆕 Mr Visa — Logo 2025",
      name: "Mr Visa Immigration",
      logo: "/brand/firms/mrvisa-logo-2025.jpg",
    },
    {
      label: "📝 Sin logo (solo iniciales)",
      name: "Mr Visa Immigration",
      logo: null,
    },
  ];

  const applyPreset = (preset: typeof presets[number]) => {
    setFirmName(preset.name);
    setLogoUrl(preset.logo);
    setTimeout(() => playFullFlow(), 50);
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0a0e14",
        color: "#e8edf5",
        fontFamily: "Inter, sans-serif",
        padding: "32px 16px",
      }}
    >
      {showLoading && (
        <>
          <style>{`
            @keyframes preview-loading-dot {
              0%, 100% { opacity: 0.3; transform: scale(1); }
              50%      { opacity: 1; transform: scale(1.45); }
            }
          `}</style>
          <div
            style={{
              position: "fixed",
              inset: 0,
              background:
                "linear-gradient(135deg, #1d4ed8 0%, #2563EB 28%, #0f2d52 60%, #0B1F3A 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: "'Sora', sans-serif",
              zIndex: 9998,
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
              <div style={{ display: "flex", gap: 8 }}>
                <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#2563EB", animation: "preview-loading-dot 600ms ease 0ms infinite" }} />
                <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#22D3EE", animation: "preview-loading-dot 600ms ease 200ms infinite" }} />
                <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#2563EB", animation: "preview-loading-dot 600ms ease 400ms infinite" }} />
              </div>
              <span style={{ fontSize: 12, fontWeight: 500, color: "rgba(243,244,246,0.7)", letterSpacing: "0.08em" }}>
                Conectando con tu firma...
              </span>
            </div>
          </div>
        </>
      )}
      {showSplash && (
        <HubSplash
          key={runs}
          firmName={firmName}
          firmInitials={initials}
          firmLogoUrl={logoUrl}
          onComplete={() => setShowSplash(false)}
        />
      )}
      {showError && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background:
              "linear-gradient(135deg, #1d4ed8 0%, #2563EB 28%, #0f2d52 60%, #0B1F3A 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px",
            fontFamily: "'Sora', sans-serif",
            zIndex: 9999,
          }}
          onClick={() => setShowError(null)}
        >
          <div
            style={{
              maxWidth: "420px",
              width: "100%",
              background: "rgba(11,31,58,0.6)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: "16px",
              padding: "32px 28px",
              textAlign: "center",
              backdropFilter: "blur(8px)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                width: "56px",
                height: "56px",
                margin: "0 auto 20px",
                borderRadius: "50%",
                background: "rgba(217,119,6,0.12)",
                border: "1px solid rgba(217,119,6,0.30)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "22px",
              }}
            >
              ⚠️
            </div>
            <h2
              style={{
                fontSize: "18px",
                fontWeight: 600,
                color: "#F3F4F6",
                marginBottom: "8px",
                letterSpacing: "0.01em",
              }}
            >
              Acceso no disponible
            </h2>
            <p
              style={{
                fontSize: "14px",
                color: "rgba(243,244,246,0.7)",
                lineHeight: 1.55,
                marginBottom: "20px",
              }}
            >
              {showError}
            </p>
            <p
              style={{
                fontSize: "11px",
                color: "rgba(243,244,246,0.45)",
                letterSpacing: "0.06em",
                marginBottom: "16px",
              }}
            >
              Si el problema persiste, contactá al administrador de tu firma.
            </p>
            <button
              onClick={() => setShowError(null)}
              style={{
                background: "transparent",
                border: "1px solid rgba(255,255,255,0.20)",
                color: "rgba(243,244,246,0.7)",
                padding: "8px 16px",
                borderRadius: "8px",
                fontSize: "12px",
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              Cerrar preview
            </button>
          </div>
        </div>
      )}

      <div style={{ maxWidth: "640px", margin: "0 auto" }}>
        <h1 style={{ fontSize: "24px", fontWeight: 700, marginBottom: "8px" }}>
          🎬 NER HubSplash — Dev Preview
        </h1>
        <p style={{ color: "rgba(232,237,245,0.65)", marginBottom: "24px", fontSize: "14px", lineHeight: 1.5 }}>
          Para ver el splash, hacé click en el botón grande de abajo.
          Va a tomar toda la pantalla por <strong>~2.7 segundos</strong>,
          después se cierra solo y volvés acá.
        </p>

        {/* CTA principal — flujo completo (simula loading + splash) */}
        <button
          onClick={playFullFlow}
          style={{
            width: "100%",
            background: "linear-gradient(135deg, #2563EB 0%, #1d4ed8 100%)",
            color: "#fff",
            border: "none",
            padding: "20px 24px",
            borderRadius: "12px",
            fontSize: "17px",
            fontWeight: 700,
            cursor: "pointer",
            fontFamily: "inherit",
            boxShadow: "0 4px 16px rgba(37,99,235,0.35)",
            marginBottom: "8px",
            transition: "transform 100ms",
            letterSpacing: "0.02em",
          }}
          onMouseDown={(e) => (e.currentTarget.style.transform = "scale(0.98)")}
          onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
        >
          ▶ Ver flujo completo (loading → splash) ← REAL
        </button>

        <button
          onClick={playSplash}
          style={{
            width: "100%",
            background: "transparent",
            color: "#e8edf5",
            border: "1px solid rgba(255,255,255,0.20)",
            padding: "12px 24px",
            borderRadius: "10px",
            fontSize: "13px",
            fontWeight: 500,
            cursor: "pointer",
            fontFamily: "inherit",
            marginBottom: "12px",
          }}
        >
          ▶ Solo splash (sin loading) {runs > 0 ? `(${runs} runs)` : ""}
        </button>

        <p style={{ color: "rgba(232,237,245,0.45)", fontSize: "12px", marginBottom: "16px", textAlign: "center" }}>
          ⚠️ El flujo completo: loading 1.2s + splash 2.7s = ~4 segundos total
        </p>

        {/* Botones para testear estados de error (acceso denegado) */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "8px",
            marginBottom: "24px",
          }}
        >
          <button
            onClick={() =>
              simulateError(
                "Enlace inválido o incompleto. Por favor usa el enlace desde tu CRM.",
              )
            }
            style={{
              background: "rgba(217,119,6,0.08)",
              border: "1px solid rgba(217,119,6,0.25)",
              color: "rgba(243,244,246,0.85)",
              padding: "10px 14px",
              borderRadius: "8px",
              fontSize: "12px",
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            ⚠️ Error: enlace inválido
          </button>
          <button
            onClick={() =>
              simulateError(
                "No se encontró una cuenta asociada a tu usuario.",
              )
            }
            style={{
              background: "rgba(217,119,6,0.08)",
              border: "1px solid rgba(217,119,6,0.25)",
              color: "rgba(243,244,246,0.85)",
              padding: "10px 14px",
              borderRadius: "8px",
              fontSize: "12px",
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            ⚠️ Error: sin permisos
          </button>
        </div>

        {/* Presets — atajos para probar diferentes firmas */}
        <div
          style={{
            background: "rgba(34,211,238,0.05)",
            border: "1px solid rgba(34,211,238,0.15)",
            borderRadius: "12px",
            padding: "16px",
            marginBottom: "16px",
          }}
        >
          <div style={{ fontSize: "13px", fontWeight: 600, marginBottom: "12px", color: "#22D3EE" }}>
            ⚡ Atajos — probar con firma real
          </div>
          <div style={{ display: "grid", gap: "8px" }}>
            {presets.map((preset) => (
              <button
                key={preset.label}
                onClick={() => applyPreset(preset)}
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.10)",
                  color: "#e8edf5",
                  padding: "10px 14px",
                  borderRadius: "8px",
                  fontSize: "13px",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  textAlign: "left",
                  transition: "background 100ms, border-color 100ms",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "rgba(34,211,238,0.08)";
                  e.currentTarget.style.borderColor = "rgba(34,211,238,0.30)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "rgba(255,255,255,0.04)";
                  e.currentTarget.style.borderColor = "rgba(255,255,255,0.10)";
                }}
              >
                {preset.label}
              </button>
            ))}
          </div>
          <p style={{ fontSize: "11px", color: "rgba(232,237,245,0.4)", marginTop: "10px" }}>
            Click en cualquiera para aplicar y reproducir el splash con esa configuración.
          </p>
        </div>

        {/* Configuración white-label */}
        <div
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: "12px",
            padding: "20px",
            marginBottom: "16px",
          }}
        >
          <div style={{ fontSize: "13px", fontWeight: 600, marginBottom: "12px", color: "#22D3EE" }}>
            🎨 White-label (cómo se ve para cada firma)
          </div>
          <label style={{ display: "block", fontSize: "12px", marginBottom: "6px", color: "rgba(232,237,245,0.7)" }}>
            Nombre de la firma
          </label>
          <input
            type="text"
            value={firmName}
            onChange={(e) => setFirmName(e.target.value)}
            placeholder="Lexis Hispanic Law"
            style={{
              width: "100%",
              padding: "10px 12px",
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: "8px",
              color: "#e8edf5",
              fontSize: "14px",
              fontFamily: "inherit",
              boxSizing: "border-box",
            }}
          />
          <p style={{ fontSize: "11px", color: "rgba(232,237,245,0.5)", marginTop: "8px", marginBottom: "16px" }}>
            Iniciales calculadas (badge dorado): <strong style={{ color: "#22D3EE" }}>{initials}</strong>
          </p>

          <label style={{ display: "block", fontSize: "12px", marginBottom: "6px", color: "rgba(232,237,245,0.7)" }}>
            Logo URL (opcional — override iniciales)
          </label>
          <input
            type="text"
            value={logoUrl ?? ""}
            placeholder="https://... (vacío = iniciales)"
            onChange={(e) => setLogoUrl(e.target.value || null)}
            style={{
              width: "100%",
              padding: "10px 12px",
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: "8px",
              color: "#e8edf5",
              fontSize: "14px",
              fontFamily: "inherit",
              boxSizing: "border-box",
            }}
          />
        </div>

        {/* Specs */}
        <div
          style={{
            padding: "16px",
            background: "rgba(34,211,238,0.05)",
            border: "1px solid rgba(34,211,238,0.15)",
            borderRadius: "8px",
            fontSize: "12px",
            color: "rgba(232,237,245,0.7)",
            lineHeight: 1.7,
          }}
        >
          <strong style={{ color: "#22D3EE" }}>Specs aprobadas:</strong>
          <ul style={{ marginTop: "10px", paddingLeft: "20px", margin: "10px 0 0 0" }}>
            <li>Duración: ~2.7 segundos (loader visible 1.2s para que se lea cómodo)</li>
            <li>Tagline: <em>"Cada caso, una estrategia."</em></li>
            <li>Logo NER real (con flecha en la R)</li>
            <li>Paleta brandbook: AI Blue + Deep Navy + Cyan 20% accent</li>
            <li>Tipografía: Sora</li>
            <li>Soporta <code style={{ background: "rgba(255,255,255,0.08)", padding: "1px 5px", borderRadius: "3px" }}>prefers-reduced-motion</code></li>
            <li>1 vez por sesión en producción (no se ve en cada navegación)</li>
          </ul>
        </div>

        <p style={{ marginTop: "24px", fontSize: "11px", color: "rgba(232,237,245,0.4)", textAlign: "center" }}>
          Esta página es <strong>dev-only</strong> en <code>/dev/splash-preview</code>. NO existe en producción.
        </p>
      </div>
    </div>
  );
}
