/**
 * PrivacyPage — Política de privacidad pública de NER Immigration AI.
 *
 * Round 9.26: template legal review-ready. Mr. Lorenzo + abogado de la firma
 * deben revisar y customizar antes de publicar como definitivo.
 *
 * Status: BORRADOR — sujeto a review legal.
 *
 * Cubre: GDPR Arts. 6, 7, 13, 15-22 + CCPA §§ 1798.100, 1798.105, 1798.110, 1798.120.
 */
import { Shield, AlertCircle } from "lucide-react";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-deep-navy text-white">
      <header className="border-b border-white/[0.08] bg-deep-navy/95 backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <Shield className="w-5 h-5 text-cyan-accent" />
            <span className="font-sora font-bold text-lg">NER Immigration AI</span>
          </a>
          <div className="flex items-center gap-4 text-sm">
            <a href="/legal/privacy" className="text-cyan-accent font-semibold">Privacidad</a>
            <a href="/legal/terms" className="text-slate-400 hover:text-white">Términos</a>
            <a href="/legal/security" className="text-slate-400 hover:text-white">Seguridad</a>
          </div>
        </div>
      </header>

      <article className="max-w-3xl mx-auto px-6 py-12 prose prose-invert prose-slate">
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 mb-8 flex items-start gap-3 not-prose">
          <AlertCircle className="w-5 h-5 text-amber-300 shrink-0 mt-0.5" />
          <div className="text-[12px] text-amber-200">
            <strong>BORRADOR — review legal pendiente.</strong> Este documento es un template profesional.
            NER Immigration AI Inc. debe hacer review con abogado licenciado en USA antes de publicar como
            política definitiva. Última revisión: 2026-06-06.
          </div>
        </div>

        <h1>Política de Privacidad</h1>
        <p className="text-slate-400">Última actualización: 2026-06-06</p>

        <h2>1. Quiénes somos</h2>
        <p>
          NER Immigration AI Inc. ("NER", "nosotros") opera la plataforma SaaS de gestión de casos de
          inmigración accesible en app.nerimmigration.com. Esta política describe cómo recolectamos,
          usamos, compartimos y protegemos información personal de:
        </p>
        <ul>
          <li><strong>Firmas legales</strong> (clientes de NER) — abogados, paralegales, asistentes que usan NER para gestionar casos</li>
          <li><strong>Personas representadas</strong> (clientes finales de las firmas) — solicitantes de inmigración cuya información es ingresada por las firmas</li>
        </ul>

        <h2>2. Qué información recolectamos</h2>
        <h3>2.1 De las firmas legales</h3>
        <ul>
          <li>Información de cuenta: nombre, email, teléfono, rol</li>
          <li>Información de facturación: procesada por sub-procesador Stripe (vía GoHighLevel)</li>
          <li>Información de uso: páginas vistas, acciones realizadas, audit logs</li>
        </ul>
        <h3>2.2 De personas representadas (ingresada por las firmas)</h3>
        <ul>
          <li>Datos de identidad: nombre, fecha de nacimiento, país de origen, A-number, SSN (cuando aplique)</li>
          <li>Datos de status migratorio: tipo de petición, etapa, fechas de USCIS/NVC</li>
          <li>Información familiar: parentescos, dependientes</li>
          <li>Información médica (PHI) cuando aplique: psych evals, medical records para VAWA/U-visa</li>
          <li>Documentos cargados: actas, evidencias, certificados</li>
          <li>Comunicaciones registradas: notas internas, transcripciones de consultas</li>
        </ul>

        <h2>3. Cómo usamos la información</h2>
        <ul>
          <li><strong>Prestar el servicio</strong>: ejecutar la plataforma SaaS contratada por la firma</li>
          <li><strong>Procesamiento por AI</strong>: agentes Felix/Nina/Max/Pablo/Camila procesan datos del caso para tareas específicas (llenado de formularios, ensamble de packets, voice transcription)</li>
          <li><strong>Audit + compliance</strong>: registramos accesos y modificaciones para SOC 2, ABA 1.6, HIPAA</li>
          <li><strong>Soporte</strong>: responder consultas técnicas de la firma</li>
          <li><strong>Mejoras del servicio</strong>: análisis agregado y anónimo (no individual)</li>
        </ul>

        <h2>4. Base legal del procesamiento (GDPR Art. 6)</h2>
        <ul>
          <li><strong>Contrato</strong>: prestación del servicio acordado en el MSA con la firma</li>
          <li><strong>Interés legítimo</strong>: auditoría, seguridad, mejoras técnicas</li>
          <li><strong>Consentimiento</strong>: comunicaciones de marketing (opt-in, revocable)</li>
          <li><strong>Obligación legal</strong>: retención de audit logs por requisitos regulatorios</li>
        </ul>

        <h2>5. Con quién compartimos información (sub-procesadores)</h2>
        <p>
          NER usa sub-procesadores listados en{" "}
          <a href="/legal/security" className="text-cyan-accent">trust.nerimmigration.com/security</a>.
          Cambios materiales serán notificados con 30 días de anticipación. Todos los sub-procesadores
          firmaron DPA con compromisos de seguridad equivalentes o superiores a esta política.
        </p>
        <p>
          <strong>NO vendemos información personal a terceros.</strong>
        </p>

        <h2>6. Tus derechos</h2>
        <h3>6.1 GDPR (residentes UE)</h3>
        <ul>
          <li>Acceso (Art. 15)</li>
          <li>Rectificación (Art. 16)</li>
          <li>Eliminación / "derecho al olvido" (Art. 17)</li>
          <li>Restricción de procesamiento (Art. 18)</li>
          <li>Portabilidad de datos (Art. 20)</li>
          <li>Objeción al procesamiento (Art. 21)</li>
        </ul>
        <h3>6.2 CCPA (residentes California)</h3>
        <ul>
          <li>Derecho a saber qué datos tenemos (§ 1798.110)</li>
          <li>Derecho a eliminar datos (§ 1798.105)</li>
          <li>Derecho a opt-out de venta (no aplica — no vendemos)</li>
          <li>No discriminación por ejercer tus derechos</li>
        </ul>
        <p>
          Para ejercer cualquier derecho: <a href="mailto:privacy@nerimmigration.com" className="text-cyan-accent">privacy@nerimmigration.com</a>.
          Respondemos dentro de 30 días.
        </p>

        <h2>7. Retención de datos</h2>
        <ul>
          <li><strong>Casos activos</strong>: retención por la duración de la relación con la firma + 30 días grace</li>
          <li><strong>Casos cerrados/archivados</strong>: retención por 7 años (estándar legal USA para casos migratorios)</li>
          <li><strong>Audit logs</strong>: 7 años (SOC 2 + HIPAA requirement)</li>
          <li><strong>Backups</strong>: 7 días de retención automática (Lovable Cloud platform tier). Snapshots manuales adicionales pueden ser retenidos por períodos extendidos cuando aplique (ej. previo a migraciones de schema).</li>
          <li><strong>Eliminación bajo demanda</strong>: implementamos soft-delete inmediato + purge físico tras retention legal expiration</li>
        </ul>

        <h2>8. Seguridad</h2>
        <p>
          Ver detalles completos en{" "}
          <a href="/legal/security" className="text-cyan-accent">trust.nerimmigration.com/security</a>.
          Resumen:
        </p>
        <ul>
          <li>Encryption at-rest AES-256, in-transit TLS 1.3</li>
          <li>Row-level security (RLS) en toda tabla con datos personales</li>
          <li>Column-level access control para A-number, SSN, DOB, teléfono</li>
          <li>Audit log append-only de todo acceso a datos sensibles</li>
          <li>Hierarchical visibility model alineado con ABA Rule 1.6</li>
          <li>SOC 2 Type II auditoría en curso (Q2 2027)</li>
        </ul>

        <h2>9. Transferencias internacionales</h2>
        <p>
          NER opera principalmente en US-East (AWS) vía Supabase. Algunos sub-procesadores (Lovable Cloud,
          Anthropic, OpenAI) procesan datos en múltiples regiones AWS. Para transferencias UE→USA usamos
          Standard Contractual Clauses (SCC) de la Comisión Europea.
        </p>

        <h2>10. Menores</h2>
        <p>
          NER no recolecta información de menores de 13 años directamente. Cuando una firma ingresa
          datos de un menor representado (ej. hijo/a del peticionario en I-130), tratamos esa información
          con los mismos controles + retención reforzada de auditoría.
        </p>

        <h2>11. Cambios a esta política</h2>
        <p>
          Notificaremos cambios materiales con 30 días de anticipación vía email a firmas administradoras
          y banner persistente en la plataforma. Cambios menores (corrección tipográfica, clarificación)
          se reflejarán en la fecha de "Última actualización" sin notificación específica.
        </p>

        <h2>12. Contacto</h2>
        <p>
          <strong>Privacy Officer</strong>: <a href="mailto:privacy@nerimmigration.com" className="text-cyan-accent">privacy@nerimmigration.com</a><br />
          <strong>EU/UK Representative</strong>: (TBD post-expansión EU)<br />
          <strong>Data Protection Authority complaints</strong>: derecho a presentar queja ante tu DPA local
        </p>
      </article>

      <footer className="border-t border-white/[0.08] mt-8 py-6">
        <div className="max-w-3xl mx-auto px-6 text-[11px] text-slate-500 text-center">
          © 2026 NER Immigration AI · Esta política es un template profesional sujeto a review legal antes de publicación definitiva.
        </div>
      </footer>
    </div>
  );
}
