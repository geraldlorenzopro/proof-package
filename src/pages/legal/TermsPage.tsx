/**
 * TermsPage — Términos de servicio público de NER Immigration AI.
 *
 * Round 9.26: template legal review-ready. Review obligatorio con abogado
 * antes de publicar como definitivo.
 */
import { Shield, AlertCircle } from "lucide-react";

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-deep-navy text-white">
      <header className="border-b border-white/[0.08] bg-deep-navy/95 backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <Shield className="w-5 h-5 text-cyan-accent" />
            <span className="font-sora font-bold text-lg">NER Immigration AI</span>
          </a>
          <div className="flex items-center gap-4 text-sm">
            <a href="/legal/privacy" className="text-slate-400 hover:text-white">Privacidad</a>
            <a href="/legal/terms" className="text-cyan-accent font-semibold">Términos</a>
            <a href="/legal/security" className="text-slate-400 hover:text-white">Seguridad</a>
          </div>
        </div>
      </header>

      <article className="max-w-3xl mx-auto px-6 py-12 prose prose-invert prose-slate">
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 mb-8 flex items-start gap-3 not-prose">
          <AlertCircle className="w-5 h-5 text-amber-300 shrink-0 mt-0.5" />
          <div className="text-[12px] text-amber-200">
            <strong>BORRADOR — review legal pendiente.</strong> Este template debe customizarse con abogado
            licenciado en USA (Delaware C-Corp recommended) antes de publicar como definitivo.
          </div>
        </div>

        <h1>Términos de Servicio</h1>
        <p className="text-slate-400">Última actualización: 2026-06-06</p>

        <h2>1. Aceptación</h2>
        <p>
          Al crear una cuenta o usar la plataforma NER Immigration AI ("Servicio"), aceptás estos Términos
          y nuestra <a href="/legal/privacy" className="text-cyan-accent">Política de Privacidad</a>.
          Si no estás de acuerdo, no uses el Servicio.
        </p>

        <h2>2. Quiénes pueden usar el Servicio</h2>
        <ul>
          <li>Firmas legales licenciadas para practicar inmigración en USA</li>
          <li>Personal autorizado por una firma cliente (paralegales, asistentes, abogados)</li>
          <li>Mayor de 18 años</li>
        </ul>
        <p>NER NO presta servicios legales. NER es una herramienta tecnológica que firmas legales usan para gestionar casos.</p>

        <h2>3. Cuenta y responsabilidades del usuario</h2>
        <ul>
          <li>Mantener credenciales seguras (password + MFA cuando disponible)</li>
          <li>No compartir cuentas entre múltiples personas</li>
          <li>Notificar inmediatamente compromisos de seguridad</li>
          <li>Cumplir con leyes USA aplicables (immigration, privacy, attorney conduct)</li>
        </ul>

        <h2>4. Servicio y SLA</h2>
        <ul>
          <li>NER se esfuerza por mantener <strong>99.5% uptime mensual</strong>, excluyendo mantenimientos programados</li>
          <li>Mantenimientos programados anunciados con 48h anticipación</li>
          <li>Soporte vía email (privacy@nerimmigration.com, security@nerimmigration.com) — respuesta dentro de 1 día hábil para issues críticos</li>
          <li>NER puede actualizar features, modificar UI, o retirar funciones obsoletas con aviso</li>
        </ul>

        <h2>5. Pricing y facturación</h2>
        <ul>
          <li>Pricing actual: planes Essential ($197), Professional ($297), Elite ($497), Enterprise (custom) por firma/mes</li>
          <li>Facturación mensual o anual via GoHighLevel → Stripe</li>
          <li>AI credits incluidos según plan; consumo adicional sujeto a cargos overage</li>
          <li>Cambios de precio comunicados con 30 días anticipación</li>
          <li>Reembolsos prorrateados por cancelación durante período de facturación</li>
        </ul>

        <h2>6. Tu contenido</h2>
        <h3>6.1 Ownership</h3>
        <p>
          Vos (la firma) mantenés ownership total de tu contenido — casos, notas, documentos, comunicaciones.
          NER NO reclama ownership.
        </p>
        <h3>6.2 Licencia a NER</h3>
        <p>
          Nos otorgás una licencia limitada para procesar tu contenido únicamente para prestarte el Servicio,
          incluyendo procesamiento por agentes AI cuando vos lo invoques explícitamente.
        </p>
        <h3>6.3 Backups y portabilidad</h3>
        <p>
          Podés exportar tu contenido en cualquier momento. Tras cancelación, contenido permanece accesible
          por 30 días grace + 60 días en backup antes de purge físico.
        </p>

        <h2>7. AI agents y limitaciones</h2>
        <ul>
          <li>NER usa Claude (Anthropic), GPT (OpenAI), y modelos especializados para automatizar tareas</li>
          <li>Output de AI agents requiere <strong>validación humana</strong> antes de uso oficial — NER NO da asesoría legal</li>
          <li>Vos sos responsable de verificar precisión de cualquier output AI antes de submission a USCIS/courts</li>
          <li>NER no se hace responsable por errores en formularios USCIS llenados por Felix u otros agentes — son sugerencias, no documentos finales</li>
        </ul>

        <h2>8. Prohibiciones</h2>
        <p>NO usar el Servicio para:</p>
        <ul>
          <li>Actividades ilegales o fraudulentas</li>
          <li>Violación de attorney-client privilege ajeno</li>
          <li>Scraping, reverse-engineering, o automatizar abuso del API</li>
          <li>Compartir credentials con personas no autorizadas</li>
          <li>Subir malware, virus, o contenido prohibido</li>
        </ul>

        <h2>9. Cancelación</h2>
        <ul>
          <li>Podés cancelar en cualquier momento desde tu panel</li>
          <li>NER puede suspender o terminar cuentas por violación de estos Términos con aviso (excepto casos de emergencia de seguridad)</li>
          <li>Tras terminación, retención de datos según política descrita en Privacidad</li>
        </ul>

        <h2>10. Limitación de responsabilidad</h2>
        <p>
          NER es una herramienta tecnológica. <strong>NER NO presta servicios legales</strong>. NO somos
          responsables por:
        </p>
        <ul>
          <li>Decisiones legales tomadas por la firma usando NER</li>
          <li>Resultados de submissions a USCIS, courts, o agencias gubernamentales</li>
          <li>Errores cometidos por personal de la firma</li>
          <li>Pérdida de datos debido a acciones del usuario (delete intencional, contraseñas perdidas, etc.)</li>
          <li>Servicios de terceros (GHL, Stripe, etc.) o sub-procesadores</li>
        </ul>
        <p>
          Responsabilidad máxima de NER: monto pagado por la firma en los 12 meses anteriores al incidente.
        </p>

        <h2>11. Indemnización</h2>
        <p>
          Vos (la firma) acordás indemnizar a NER de reclamos derivados de tu uso del Servicio en violación
          de estos Términos, leyes aplicables, o derechos de terceros.
        </p>

        <h2>12. Modificaciones a estos Términos</h2>
        <p>
          NER puede modificar estos Términos. Cambios materiales con 30 días aviso. Uso continuado tras
          modificaciones implica aceptación. Si no estás de acuerdo, podés cancelar.
        </p>

        <h2>13. Ley aplicable y jurisdicción</h2>
        <p>
          Estos Términos se rigen por ley del estado de <strong>Delaware, USA</strong> (jurisdicción de
          incorporación). Disputas serán resueltas por arbitraje vinculante en Wilmington, DE, bajo reglas
          de AAA Commercial Arbitration.
        </p>

        <h2>14. Contacto</h2>
        <p>
          <strong>Operations</strong>: <a href="mailto:hello@nerimmigration.com" className="text-cyan-accent">hello@nerimmigration.com</a><br />
          <strong>Legal</strong>: <a href="mailto:legal@nerimmigration.com" className="text-cyan-accent">legal@nerimmigration.com</a><br />
          <strong>Domicilio</strong>: NER Immigration AI Inc., Delaware, USA
        </p>
      </article>

      <footer className="border-t border-white/[0.08] mt-8 py-6">
        <div className="max-w-3xl mx-auto px-6 text-[11px] text-slate-500 text-center">
          © 2026 NER Immigration AI · Template profesional sujeto a review legal definitivo.
        </div>
      </footer>
    </div>
  );
}
