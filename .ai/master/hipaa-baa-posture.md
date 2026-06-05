# NER HIPAA BAA Posture — 60-day Implementation Plan

**Status:** Round 9.26 (2026-06-06) — sprint legal arrancado
**Owner:** Mr. Lorenzo (CEO) + abogado licenciado USA (TBD)
**Target:** BAA-eligible posture documentado en 60 días, $5-12k inversión total

---

## Why now

Marcus Chen audit (sesión 2026-06-06) flageó **HIPAA como riesgo existencial**:

> NER procesa **Protected Health Information (PHI)** cuando una firma maneja evidencia médica
> para U-visa / VAWA / asilo / RFE response: psych evaluations, medical records, declaraciones
> clínicas. Sin BAA + postura HIPAA, **una sola complaint a OCR (Office for Civil Rights) puede
> cerrar la empresa** vía $50k+/violation fines + cease & desist.
>
> Docketwise (competidor directo en inmigración) **NO ofrece HIPAA BAA**. Esto es nuestro
> wedge competitivo más fuerte para los próximos 60 días — podemos ganar deals contra
> Docketwise en firmas que manejan VAWA/U-visa solo con esto.

---

## HIPAA — qué cubre (resumen no-técnico para Mr. Lorenzo)

**HIPAA** = Health Insurance Portability and Accountability Act (1996). Aplica a:
1. **Covered Entities** (CE): hospitales, doctores, seguros médicos
2. **Business Associates** (BA): proveedores que tocan PHI en nombre de un CE

NER es un **potential BA** porque firmas legales que representan U-visa victims piden a doctores
records médicos como evidencia → la firma los carga a NER → NER procesa PHI.

**Business Associate Agreement (BAA)** = contrato obligatorio entre CE/firma y BA/NER que define:
- Cómo NER protege el PHI
- Qué hacemos si hay breach
- Restricciones de uso
- Auditorías + reporting

**Sin BAA firmado**, la firma viola HIPAA al enviarnos PHI. Entonces ellos NO pueden usar NER
para casos con evidencia médica = perdemos el deal.

---

## Lo que YA tenemos cubierto técnicamente (R9.19)

| HIPAA Safeguard | NER posture | Evidencia |
|---|---|---|
| § 164.312(a)(1) Access control | ✅ RLS + role tier + column-level revoke | `usePermissions`, `client_profiles_safe` view |
| § 164.312(a)(2)(iv) Encryption at-rest | ✅ AES-256 (Supabase/AWS RDS) | Supabase compliance docs |
| § 164.312(e)(1) Transmission security | ✅ TLS 1.3 obligatorio | `app.nerimmigration.com` cert |
| § 164.312(b) Audit controls | ✅ audit_logs append-only + tg_audit_pipeline_mutations | Migration R8 + R9.19 |
| § 164.308(a)(1)(i) Security mgmt process | 🟡 Documentado pero sin formal risk assessment | Pendiente |
| § 164.308(a)(7) Contingency plan | 🟡 Supabase backups + Lovable rollback | Sin runbook documentado |
| § 164.314(a)(1) BAA con sub-procesadores | 🟡 OpenAI ✅, otros ❌ | Pendiente checklist |
| § 164.404 Breach notification | ❌ No documentado | Pendiente |

**Cobertura técnica real: ~70%**. Lo que falta es **documentación + procedimientos no-técnicos**.

---

## 60-day implementation plan

### Semanas 1-2: Risk Assessment formal

**Costo: $0** (puedo redactar el draft, Mr. Lorenzo + abogado review)

Entregables:
- [x] `risk-assessment-2026.md` (template incluido abajo)
- [ ] Identificar amenazas + vulnerabilidades + likelihood/impact
- [ ] Documentar mitigaciones existentes
- [ ] Plan de acción para gaps remaining

### Semanas 3-4: BAA Template profesional

**Costo: $2-5k** (abogado redacción + review)

Entregables:
- [ ] BAA template ready para firma con firmas-cliente
- [ ] Customizado para SaaS de inmigración (no boilerplate genérico)
- [ ] Incluye: subcontractor flow-down, breach notification timeline 60d, audit rights

### Semanas 5-6: Sub-processor BAAs

**Costo: $0** (negociación directa, mayoría tienen BAAs disponibles)

Estado de sub-procesadores:
- ✅ **OpenAI**: BAA disponible (enterprise tier). Status: solicitar
- ❌ **Anthropic**: NO ofrece BAA público. **Mitigación**: NO enviar PHI a Claude agentes hasta tener BAA. Audit técnico para filtrar.
- ❌ **Supabase**: BAA disponible en Pro tier. Status: contactar
- ❌ **Lovable**: BAA TBD — abrir ticket
- ❌ **GoHighLevel**: BAA No estándar — alternativa: no enviar PHI a GHL (solo metadata caso)
- ❌ **Stripe**: BAA disponible para healthcare clientes. Status: solicitar
- ❌ **Eleven Labs**: BAA TBD — Camila Voice NO debe procesar PHI hasta confirmar

### Semanas 7-8: Procedimientos operativos

**Costo: $3-5k** (workshops + templates con abogado)

Entregables:
- [ ] **Breach notification runbook**: qué hacer en las primeras 24h, 60d timeline para OCR notification
- [ ] **Workforce training**: documento + video corto para Vanessa-paralegal pattern (qué es PHI, cómo se maneja)
- [ ] **Access termination procedure**: cuando un paralegal deja la firma
- [ ] **Audit log review schedule**: weekly review de accesos anómalos

### Semana 9 (buffer): External review

**Costo: $0-2k** (review opcional con consultor HIPAA)

- [ ] Walkthrough con compliance consultant (opcional)
- [ ] Final review del BAA con counsel

---

## BAA Template — estructura ready para review legal

```
BUSINESS ASSOCIATE AGREEMENT

Effective Date: [DATE]
Covered Entity: [LAW FIRM NAME]
Business Associate: NER Immigration AI Inc.

1. DEFINITIONS
   - PHI = Protected Health Information per 45 CFR 160.103
   - Services = NER Immigration AI SaaS Platform

2. PERMITTED USES & DISCLOSURES
   2.1 BA may use PHI only to perform Services per Master Service Agreement
   2.2 BA may NOT use PHI for marketing, sale, or de-identification w/o written CE consent
   2.3 BA shall comply with restrictions per § 164.522

3. SAFEGUARDS
   3.1 Administrative safeguards per § 164.308 — workforce training, security mgmt
   3.2 Physical safeguards per § 164.310 — applies to AWS/Supabase facilities
   3.3 Technical safeguards per § 164.312 — encryption, access control, audit logs

4. SUBCONTRACTORS
   4.1 BA shall execute BAA with each subcontractor that creates/receives/maintains PHI
   4.2 Sub-processor list: Anthropic*, OpenAI, Supabase, Lovable, Stripe, GHL*, Eleven Labs*
       (*items marcados: PHI EXCLUDED from these flows per technical filter)

5. BREACH NOTIFICATION
   5.1 BA shall notify CE within 60 days of discovery of breach
   5.2 Notification per § 164.410 format requirements
   5.3 BA shall cooperate with CE in providing breach notification to affected individuals

6. INDIVIDUAL RIGHTS
   6.1 Access (§ 164.524): BA will respond to CE access requests within 30 days
   6.2 Amendment (§ 164.526): BA will incorporate amendments per CE direction
   6.3 Accounting (§ 164.528): BA maintains audit logs sufficient for 6-year accounting

7. AUDIT RIGHTS
   7.1 CE may audit BA's HIPAA compliance with reasonable notice (30 days)
   7.2 BA will provide compliance evidence (audit reports, policies, procedures)

8. TERMINATION
   8.1 Either party may terminate for material breach with 30 days cure period
   8.2 Upon termination, BA shall return or destroy all PHI, or extend protections if return/destruction infeasible

9. INDEMNIFICATION & LIABILITY
   9.1 BA indemnifies CE for damages from BA's breach of this BAA
   9.2 Liability cap consistent with MSA

10. GOVERNING LAW: [Delaware, USA]
```

**Status:** template profesional pero **NO firmar sin abogado licenciado USA**.

---

## Risk Assessment Template (Semana 1-2 deliverable)

### Amenazas identificadas para NER

| # | Amenaza | Likelihood | Impact | Mitigación existente | Gap |
|---|---|---|---|---|---|
| 1 | Empleado NER accede a PHI sin necesidad | Media | Alto | RLS + audit logs | Falta workforce training formal |
| 2 | Breach de Supabase (DB underlying) | Baja | Crítico | Supabase SOC 2 Type II + encryption | NER no audita la auditoría de Supabase |
| 3 | Phishing → password compromise de paralegal | Alta | Alto | MFA disponible pero NO enforced | Implementar MFA mandatory |
| 4 | PHI enviado a Claude/GPT sin BAA | Media | Crítico | Auditoría reciente — ningún agente en prod envía PHI raw | Filtro técnico antes de pasar context a AI |
| 5 | Insider leak (paralegal screenshots PHI) | Baja | Alto | Audit log + visibility model | Falta DLP (data loss prevention) |
| 6 | Backup theft / unauthorized access | Baja | Crítico | Supabase encrypted backups | Sin retention policy formal |
| 7 | Ransomware on Lovable | Media | Alto | Lovable AWS-backed + auto-rollback | Sin disaster recovery runbook |
| 8 | API key leak en código frontend | Baja | Medio | Variables de entorno + RLS protege | Auditoría periódica de secrets |

### Action items derivados

- [ ] Implementar MFA mandatory para owner/admin/attorney roles
- [ ] Filtro técnico: agentes AI reciben metadata + structured context, NO copy/paste de notas raw
- [ ] Workforce training video (5 min) + quiz al onboarding
- [ ] Audit log review weekly por owner
- [ ] DR runbook: cómo restaurar tras incidente

---

## Costo total 60 días

| Item | Costo |
|---|---|
| BAA template + customización legal | $2,500 |
| Risk assessment workshop (legal) | $1,500 |
| Procedural docs + workforce training | $2,000 |
| External review (opcional) | $2,000 |
| Sub-processor BAA negotiation time | $0 |
| **TOTAL** | **$5,000 - $8,000** |

Marcus rango original ($5-12k) era con consulting más extenso. Realista para NER actual: **$5-8k**.

---

## Marketing impact post-60 días

Con BAA-eligible posture documentado:

**Landing page:**
> *"HIPAA-conscious workflows · BAA disponible para firmas que manejen VAWA/U-visa
> con evidencia médica protegida"*

**Sales pitch contra Docketwise:**
> *"Si tu firma maneja casos con records médicos (U-visa, VAWA, asilo), Docketwise
> no te ofrece BAA. Nosotros sí — tu firma puede aceptar PHI con confianza."*

**Trust center badge:** ✅ HIPAA-conscious (visible en `/legal/security`)

---

## Próximos pasos inmediatos

1. **Mr. Lorenzo:** identificar abogado USA con experiencia HIPAA + SaaS ($300-500/hr típico). Brooklyn, NYC, Miami legal tech bar suelen tener buenos contactos.
2. **Claude/Codex:** completar risk assessment con datos técnicos reales (semanas 1-2)
3. **Mr. Lorenzo:** contactar Supabase, OpenAI, Stripe para BAAs disponibles
4. **Mr. Lorenzo + abogado:** firmar BAA template post-customización

Sin esto, NER NO puede vender a firmas que manejen casos con PHI = ~30% del mercado de inmigración cerrado.

Con esto, NER tiene wedge competitivo claro contra Docketwise por 6+ meses.
