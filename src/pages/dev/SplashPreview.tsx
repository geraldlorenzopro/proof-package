import { useState } from "react";
import HubSplash from "@/components/hub/HubSplash";

/**
 * Dev-only preview de HubSplash para review visual SIN auth.
 * Ruta: /dev/splash-preview
 */
export default function SplashPreview() {
  const [showSplash, setShowSplash] = useState(false);
  const [firmName, setFirmName] = useState("Lexis Hispanic Law");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [runs, setRuns] = useState(0);

  const playSplash = () => {
    setShowSplash(false);
    setTimeout(() => {
      setShowSplash(true);
      setRuns((r) => r + 1);
    }, 80);
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
    setTimeout(() => playSplash(), 50);
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
      {showSplash && (
        <HubSplash
          key={runs}
          firmName={firmName}
          firmInitials={initials}
          firmLogoUrl={logoUrl}
          onComplete={() => setShowSplash(false)}
        />
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

        {/* CTA principal — más visible y claro */}
        <button
          onClick={playSplash}
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
            marginBottom: "12px",
            transition: "transform 100ms",
            letterSpacing: "0.02em",
          }}
          onMouseDown={(e) => (e.currentTarget.style.transform = "scale(0.98)")}
          onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
        >
          {runs === 0 ? "▶ Ver splash ahora" : `▶ Reproducir de nuevo (${runs} ejecuciones)`}
        </button>

        <p style={{ color: "rgba(232,237,245,0.45)", fontSize: "12px", marginBottom: "24px", textAlign: "center" }}>
          ⚠️ El splash tomará TODA la pantalla por 2.7 segundos
        </p>

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
