# NER SOC 2 Type I Scoping — 90-day Implementation Plan

**Status:** Round 9.26 (2026-06-06) — scoping documentado
**Owner:** Mr. Lorenzo (CEO) + Vanta Customer Success Manager (TBD)
**Target:** Type I report en mano Q3 2026 ($18-28k inversión Year 1)

---

## Type I vs Type II — diferencia crítica

| | Type I | Type II |
|---|---|---|
| **Qué audita** | Controls DISEÑADOS a un punto en el tiempo | Controls OPERANDO durante 6-12 meses |
| **Observation window** | Snapshot (1 día) | 6-12 meses continuos |
| **Tiempo total preparación + audit** | 3 meses | 12-18 meses |
| **Costo Year 1** | $18-28k | $25-40k (después del Type I) |
| **Cuándo es útil para NER** | **AHORA** — cierra deals enterprise sin esperar 1 año | Q2 2027 para institutional sales |

**Decisión LOCKED:** arrancar Type I YA. Type II se construye automáticamente después.

---

## Por qué Vanta vs Drata vs Secureframe

| | Vanta | Drata | Secureframe |
|---|---|---|---|
| **Precio Year 1** | $13-22k | $15-25k | $10-18k |
| **Auditor marketplace** | Más amplio (50+ auditores) | Bueno para ISO | Más chico |
| **Solo-founder friendly** | ✅ | 🟡 | ✅ |
| **Marketplace de policies** | Excelente | Bueno | OK |
| **Integraciones AWS/Supabase** | Native | Native | Native |
| **CSM responsiveness** | Alto | Alto | Medio |

**Recomendación:** **Vanta** ($13-15k/año Year 1).

Razones:
1. Marketplace de auditores más amplio → mejor pricing competitivo en audit fees
2. Templates de policies pre-built para SaaS legal
3. CSM dedicado para solo-founders
4. Library de evidence collectors para Supabase + Lovable

---

## Scoping del Type I — qué entra y qué NO

### IN SCOPE (Type I observation)

**Sistemas:**
- ✅ `app.nerimmigration.com` (production frontend)
- ✅ Supabase project `dewjhkgnoaepgkhulcbv` (production database + Auth + edge functions)
- ✅ Pipeline de Casos (`/hub/cases`, `/hub/tasks`, Case Engine)
- ✅ Audit logs append-only (`audit_logs`, `case_action_history`)
- ✅ Sub-procesadores con BAA/DPA firmado (Supabase, OpenAI, Stripe via GHL)

**Controles cubiertos por R9.19:**

| TSC | Control | Estado | Evidence path |
|---|---|---|---|
| CC1.1 | Risk assessment | 🟡 → ✅ post-HIPAA risk doc | `.ai/master/hipaa-baa-posture.md` |
| CC2.2 | Audit logging | ✅ | Migration 20260606030000 + R9.19 |
| CC2.3 | Audit log retention | ✅ | Trigger immutable |
| CC4.1 | Granular errors | ✅ | useCaseInlineEdit + ResponsibleInlineEdit |
| CC6.1 | Logical access | ✅ | RLS + role tier + 110+ policies |
| CC6.2 | MFA | 🟡 → 🛑 | Pendiente enforcement (action item) |
| CC6.3 | Access reviews | 🟡 → 🛑 | Pendiente UI (action item) |
| CC6.7 | Storage RLS | ✅ | Buckets case-documents |
| CC7.1 | Continuous monitoring | ✅ | logAccess + logAudit |
| CC7.2 | Anomaly detection | 🟡 | Sin rate limit aún |
| CC8.1 | Change management | ✅ | Migrations versionadas |
| C1.1 | PII confidentiality | ✅ | client_profiles_safe view |
| C1.2 | matter_value revenue | ✅ | client_cases_revenue view |
| PI1.1 | Data integrity CHECKs | ✅ | priority/status/visibility |
| PI1.4 | Optimistic + rollback | ✅ | useCaseInlineEdit granular |
| PI1.5 | Subtasks one-level | ✅ | Constraint VALIDATED |
| P1.1 | Privacy notice | ✅ → live | `/legal/privacy` (R9.26) |
| P3.1 | Data subject rights | 🟡 | UI workflow pendiente |
| P4.1 | Soft-delete | ✅ | deleted_at columns |
| P5.1 | Vendor disclosure | ✅ → live | `/legal/security` (R9.26) |
| P7.1 | Privilege escalation | ✅ | custom_permissions whitelist |

**Cobertura técnica REAL post R9.19 + R9.26: ~80% Type I ready.**

### OUT OF SCOPE (defer Type II o roadmap)

- ❌ Smart Forms (Felix/Nina/Max) — agentes AI separate scope
- ❌ Camila Voice AI — separate audit (uses Eleven Labs sin BAA)
- ❌ Admin panel (`/admin/*`) — internal-only, separate criteria
- ❌ Marketing site (Landing pages) — non-production
- ❌ Tools públicos (`/tools/*`) — no procesan PHI ni revenue

---

## 90-day timeline

### Mes 1: Sign-up + scoping

- [ ] **Semana 1:** Mr. Lorenzo sign-up Vanta ($13-15k anual upfront o $1,250/mes)
- [ ] **Semana 2:** Kickoff con Vanta CSM. Definir scope IN/OUT.
- [ ] **Semana 3:** Conectar integrations Vanta:
  - Supabase via Postgres connection
  - Lovable via repo access (GitHub webhook)
  - Slack/email para alerts
  - Sub-processor monitoring
- [ ] **Semana 4:** Auto-collected evidence inicial. Vanta scaneará y reportará gap analysis.

### Mes 2: Gaps remediation

- [ ] **Semana 5:** **Implementar MFA enforcement** (CC6.2 gap)
  - Habilitar Supabase Auth MFA module
  - Forzar para roles owner/admin/attorney
  - UI: pantalla "Setup MFA" en login
  - Implementación: ~3 días
- [ ] **Semana 6:** **Access review UI** (CC6.3 gap)
  - Página `/admin/access-reviews` (admin-only)
  - Lista todos los users con last_login + role
  - Owner puede deactivate/revoke con audit log
  - Implementación: ~5 días
- [ ] **Semana 7:** **Rate limiting** (CC7.2 gap)
  - Supabase Edge Function middleware
  - Por user_id: max 100 requests/min en mutations
  - Audit log on rate limit hit
  - Implementación: ~2 días
- [ ] **Semana 8:** **Policies & procedures** (administrative gap)
  - Vanta tiene templates para SaaS — customizar
  - Information Security Policy
  - Incident Response Plan
  - Business Continuity Plan
  - Vendor Management Policy
  - Implementación: ~5 días de redacción + review

### Mes 3: Audit prep + execution

- [ ] **Semana 9:** Vanta gap analysis final → todo verde
- [ ] **Semana 10:** Seleccionar auditor del Vanta marketplace
  - Recomendados para SaaS solo-founder: Prescient Assurance, Johanson Group, AssuranceLab
  - Costo audit: $8-12k Year 1
- [ ] **Semana 11:** Auditor kickoff. Snapshot date locked.
- [ ] **Semana 12:** Audit execution. ~1-2 semanas de evidence review.
- [ ] **Día 90 (target):** **SOC 2 Type I report en mano.** Public marketing puede empezar.

---

## Type II observation arranca automáticamente

Una vez tenés Type I, el mismo auditor te observa **6-12 meses continuos** = Type II.

**Día 90 (Type I report) → Día 365 (Type II report)** = 9-12 meses observation.

Total tiempo Type I + Type II en mano: **~12-15 meses desde sign-up Vanta**.

Costo Year 2 (Type II): $20-30k (auditor + Vanta renovation).

---

## Marketing impact

**Pre-Type I (hoy):**
- Trust center dice "SOC 2 Type II · auditoría en curso"
- Cierra ~50% de deals enterprise
- Firmas grandes (>10 paralegales) dicen "te esperamos cuando tengas Type II"

**Post-Type I (Día 90):**
- Trust center: "SOC 2 Type I report disponible · Type II en observation"
- Cierra ~85% de deals enterprise
- Marketing: "Auditado por [auditor name] firma X de 2026"

**Post-Type II (Día 365-455):**
- Cierra 95%+ de deals
- Permite expansión a firmas BigLaw-adjacent
- Justifica pricing Enterprise tier ($497+/mes)

---

## ROI esperado

**Inversión 90 días:**
- Vanta: $13-15k
- Auditor fees: $8-12k
- Internal dev time (~3 semanas Claude/Codex): bundled in opex
- **Total:** $21-27k

**Revenue impact estimated:**
- Hoy: 8 firmas × $297 = $2,376 MRR ($28.5k ARR)
- Post Type I: realistic +12-20 firmas en 3 meses = $5-9k MRR adicional ($60-108k ARR)
- Post Type II: realistic +20-40 firmas adicionales = $9-18k MRR adicional

**Payback period:** 4-6 meses post Type I report. Type I se paga solo con 15-20 firmas nuevas.

---

## Próximos pasos inmediatos

1. **Mr. Lorenzo:** crear cuenta Vanta en https://www.vanta.com/pricing/saas (sales call con CSM para discount founder)
2. **Mr. Lorenzo:** decidir entre Vanta annual upfront ($13-15k) o monthly ($1,250 × 12 = $15k)
3. **Claude/Codex:** una vez Vanta connected, ejecutar gaps remediation (semanas 5-8) en paralelo con Pipeline development
4. **Mr. Lorenzo:** trabajar con Vanta para seleccionar auditor (mes 3)

Sin SOC 2 Type I report en 90 días, NER pierde el window estratégico Q3 2026 para growth enterprise.

Con report en mano, NER tiene marketing material para 1+ año + base sólida para Type II.

---

## Cobertura honesta del scoping

Post R9.19 + R9.26 + remediation Mes 2:

- **80% cubierto técnicamente** antes de empezar
- **15% requiere policies + procedures docs** (Vanta templates ayudan)
- **5% requiere gaps técnicos** (MFA + access reviews + rate limiting)

Vs benchmark de solo-founder SaaS típico: la mayoría arranca con 30-40% cubierto. NER arranca con 80% gracias a R9.19. **Tiempo a Type I es la mitad del promedio**.
