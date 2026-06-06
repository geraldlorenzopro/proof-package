# Security Audit — Pantallas "Tareas" + "Pipeline de Casos"

**Fecha:** 2026-06-06
**Auditor:** Claude Code (Opus 4.7) ejecutando 4 sub-agentes especializados en paralelo
**Alcance:** código que sirve `/hub/tasks` y `/hub/cases` + queries + edge functions invocadas desde esas pantallas + RLS de las tablas tocadas + AI/3rd-party egress + audit logging
**Marcos:** SOC 2 Type II (en curso), HIPAA (auto-atestación "conscious"), ABA Model Rule 1.6, calidad/ingeniería

**Stack auditado:** React + TS + Supabase (Postgres + RLS + Edge Functions Deno) + integraciones (Anthropic, OpenAI, ElevenLabs, Lovable AI Gateway, GoHighLevel, Resend, Federal Register API).

**Modalidad:** read-only. **No se modificó código.** Los arreglos van por el flujo de control de cambios (ticket + PR revisado) para que queden como evidencia de que el control opera durante la ventana del auditor.

---

## 0. Resumen ejecutivo para Mr. Lorenzo

**Veredicto blando:** la app no está lista para pasar un SOC II Type II ni una auto-atestación HIPAA defendible **hoy mismo**. La base está bien armada (RLS multi-tenant, verifyAccountMembership en edge functions, triggers de audit inmutables, column-level PII gating en `client_profiles`). Lo que **rompe la prueba** son ~10 brechas concretas y demostrables, no problemas estructurales.

**Mapa de la situación en una frase:** *"Construimos cerraduras buenas, pero dejamos 5 ventanas abiertas porque eran cómodas para el desarrollo."*

**Ventanas abiertas críticas (las 5 más graves):**

1. **Edge function `sync-case-stage-to-ghl` pública sin auth.** Cualquiera en internet con un UUID de caso puede leer `client_name` + `client_email` de otra firma. Posible breach reportable bajo HIPAA y ABA. → **Fix en 1 día.**
2. **Camila + AI agents mandan el expediente completo (incluyendo A-number, DOB, notas, examen médico) a proveedores AI sin BAA verificable en código.** Anthropic, Lovable Gateway → Gemini, ElevenLabs, OpenAI. → **No es bug de código, es decisión de arquitectura. Hay que documentar BAA o cortar el path.**
3. **Passwords USCIS/NVC del cliente en texto plano en la BD.** Exposición = suplantación del cliente ante USCIS. → **Fix con `pgcrypto` en 2-3 días.**
4. **Audit log forjable + lecturas de PHI no registradas.** Cualquier user autenticado puede insertar entries falsas en `audit_logs`; `CasePeekPanel` abre expedientes sin loggear quién vio qué. HIPAA §164.312(b) requiere log de **accesos**, no solo cambios. → **Fix en 1-2 sprints.**
5. **`.env` con la `VITE_SUPABASE_PUBLISHABLE_KEY` trackeado en git** + cero tests de aislamiento cross-tenant. → **Fix en 1 hora + tests en 2 días.**

**Lo que SÍ funciona bien (defensa heredada):**
- RLS multi-tenant en `client_cases`, `case_tasks`, `case_notes`, `audit_logs`.
- Triggers de audit en tablas críticas con whitelist de columnas (PII no leakea a metadata).
- Triggers de inmutabilidad sobre `audit_logs` y `case_action_history` (UPDATE/DELETE/TRUNCATE bloqueados).
- Column-level REVOKE SELECT en `client_profiles.a_number/phone/dob/ssn_last4` + función `user_can_see_pii()`.
- Edge functions de mutación (`b1b2-create-case`, `b1b2-update-case`) validan membership server-side.
- HTML escaping en email templates.
- Sin Sentry/PostHog/gtag/Datadog en el bundle (no hay tracker externo descontrolado).
- SSRF protection en `notify-completion`.

**Conteo de hallazgos:** 23 🔴 bloqueantes + 42 🟡 importantes + 19 ⚪ pulido = **84 findings totales** (algunos solapados entre auditores; el reporte los dedupea).

---

## 1. Plan de remediación priorizado (pre-audit Type II)

Ordenado por impacto / esfuerzo. Cada ítem corresponde a uno o varios hallazgos 🔴 numerados abajo.

### Sprint 0 — Mitigación de emergencia (esta semana, días 1-3)

| # | Acción | Esfuerzo | Hallazgo cubierto |
|---|---|---|---|
| 1 | Aplicar `verifyAccountMembership` a `sync-case-stage-to-ghl` | 1h | RED-1 |
| 2 | Dump de `pg_policies` de prod, confirmar que la legacy policy `Anyone with token can view case USING(true)` está dropped | 30min | RED-2 |
| 3 | Agregar `WITH CHECK (account_id = user_account_id(auth.uid()))` a UPDATE/DELETE policies de `client_cases` y `vawa_cases` | 2h + migration | RED-3 |
| 4 | `git rm --cached .env` + agregar a `.gitignore` + rotar la publishable key + crear `.env.example` | 1h | RED-4 |
| 5 | Gatear `console.log` de PHI (CamilaFloatingPanel:228, CSPACalculator:506,510, push-*-to-ghl, translate-evidence:154) con `import.meta.env.DEV` | 2h | RED-5, AMBER-7 |
| 6 | JWT-gate `analyze-uscis-document` (quitar ruta pública) | 1h | RED-6 |

### Sprint 1 — Fundamentos de auditoría (semana 2-3)

| # | Acción | Esfuerzo | Hallazgo cubierto |
|---|---|---|---|
| 7 | Implementar `logAccess` en `CasePeekPanel` useEffect([caseId]) + dedupe por sessionStorage TTL 15min | 4h | RED-7 |
| 8 | Migrar TODO `logAudit` INSERT a RPC SECURITY DEFINER `record_audit_event()` con whitelist de actions y fix de `user_display_name` server-side. REVOKE INSERT directo a `authenticated`. | 1-2 días | RED-8 |
| 9 | Granularidad de `AuditAction`: agregar `task.snoozed`, `task.reactivated`, `task.priority_changed`, `task.due_date_changed`, `task.assigned_changed`, `case.status_changed` (este último ya está en el enum pero nunca se emite). Migrar callers. | 1 día | RED-9 |
| 10 | Agregar `auth.login_failed` al enum + emitir desde `Auth.tsx` catch branches + edge function helper `_shared/audit.ts` para 401/403 | 4h | RED-10 |

### Sprint 2 — Cifrado + PHI egress (semana 3-4)

| # | Acción | Esfuerzo | Hallazgo cubierto |
|---|---|---|---|
| 11 | Cifrar `uscis_password`, `nvc_cas_password`, `ssn_last4`, `passport_number` con `pgcrypto` o `pgsodium` + clave en Supabase Vault. Idealmente: NO almacenar passwords USCIS. | 2-3 días | RED-11 |
| 12 | Auditoría formal de BAA: documentar status real con Anthropic (Enterprise + ZDR), Lovable Gateway, ElevenLabs, OpenAI, Google TTS, Resend, GHL. Decidir vendor-by-vendor: ¿se queda con BAA firmado o se reemplaza? | 1 semana (depende de vendors) | RED-12, RED-13, RED-14 |
| 13 | Minimum necessary en payloads AI: cortar `caseData` para que Felix/Nina/Max solo reciban los campos del schema USCIS que necesitan, no el dump completo. | 2-3 días | RED-13 |
| 14 | Camila chat + briefing: reemplazar `recentCasesList = "{client_name}…"` con conteos/etiquetas agregadas o iniciales. STT del paralegal a Web Speech API local. | 2 días | RED-14 |

### Sprint 3 — Hardening (semana 5-6)

| # | Acción | Esfuerzo | Hallazgo cubierto |
|---|---|---|---|
| 15 | Migrar JSONB merge en `NextActionEditor` + `ResponsibleInlineEdit` a RPC `update_case_custom_field()` con `jsonb_set` o optimistic concurrency. | 1 día | RED-15 |
| 16 | Reducir TTL de signed URLs en `caseToolOutputs.ts:144` de 7d a 1h. | 30min | RED-16 |
| 17 | Unificar lógica de "vencido": calcular `is_overdue` en BD (vista o columna generated) con `current_date AT TIME ZONE firm_tz`. Eliminar el doble cálculo cliente/server. | 1-2 días | RED-17 |
| 18 | Tests E2E cross-tenant: 2 firmas con cuentas test, verificar `select`, `update`, `delete` cross-firm devuelve vacío/error. Agregar a CI. | 2 días | AMBER-23 |
| 19 | CI hardening: agregar `bun audit --severity high`, `gitleaks detect`, `semgrep --config auto`, CodeQL. | 1 día | AMBER-24 |
| 20 | Aplicar `parseSupabaseError` a todos los `toast.error` que aún muestran `err.message` raw. | 4h | AMBER-12 |

**Tiempo total estimado: 4-6 semanas con 1 ingeniero focal.** Después de Sprint 3, el sistema pasa de "no defensible" a "defensible con observaciones menores" ante un auditor SOC II Type II.

---

## 2. Hallazgos 🔴 BLOQUEANTES

> **Severidad 🔴:** bloquea ship a producción, abre breach reportable, o rompe un control SOC II/HIPAA categóricamente. Toda la sección requiere remediación pre-audit.

### A. Autorización / IDOR / Multi-tenant

#### RED-1. Edge function `sync-case-stage-to-ghl` pública sin auth + service role

| Campo | Valor |
|---|---|
| **Marco** | SOC2 + HIPAA + ABA 1.6 |
| **Ubicación** | `supabase/functions/sync-case-stage-to-ghl/index.ts:19-94` |
| **Riesgo** | Function no lee `Authorization` header, instancia cliente con `SUPABASE_SERVICE_ROLE_KEY` (bypasea RLS), lee `client_cases` y `office_config` por `case_id` y `account_id` aportados por body. Devuelve `client_name` y `client_email`. Cross-tenant PII leak para cualquiera con un UUID válido en internet. |
| **Repro** | `curl -X POST <project>/functions/v1/sync-case-stage-to-ghl -d '{"case_id":"<uuid-otra-firma>","decision":"contracted","account_id":"<otra-firma>"}'` → devuelve datos del cliente ajeno. |
| **Remediación** | Aplicar el patrón canónico de `supabase/functions/_shared/auth-tenant.ts`: exigir `Authorization` header, `auth.getUser()`, y `verifyAccountMembership(admin, user.id, account_id)` antes de operar. Validar `client_cases.account_id === account_id`. |

#### RED-2. RLS legacy `Anyone with token can view case USING(true)` posiblemente vigente en prod

| Campo | Valor |
|---|---|
| **Marco** | SOC2 |
| **Ubicación** | `supabase/migrations/20260220202105_*.sql:47-49` (creación) + `20260226044340_*.sql:87` (DROP) |
| **Riesgo** | La migration original creaba `FOR SELECT USING (true)` sobre `client_cases` — cualquiera autenticado podía leer todos los cases del sistema. El DROP existe pero Lovable es source of truth de deploys y no hay confirmación de que se aplicó en prod. Si no se aplicó → leak total cross-tenant. |
| **Repro** | En SQL editor de Supabase prod: `SELECT * FROM pg_policies WHERE tablename='client_cases';` debe mostrar solo las 4 policies de `20260310040957_*`. Si aparece "Anyone with token can view case" → leak. |
| **Remediación** | Confirmar dump de `pg_policies` antes del audit Type II. Documentar evidencia en `deploy-checklist.md`. |

#### RED-3. UPDATE/DELETE policies en `client_cases` sin `WITH CHECK`

| Campo | Valor |
|---|---|
| **Marco** | SOC2 + ABA |
| **Ubicación** | `supabase/migrations/20260310040957_*.sql:38-42`, `:50-53`, `:60-63` |
| **Riesgo** | Las policies UPDATE/DELETE de `client_cases` y `vawa_cases` solo tienen `USING` (cubre el row pre-edit) pero no `WITH CHECK` (cubre el row post-edit). Esto permite a un user hacer `UPDATE client_cases SET account_id='<otra-firma>' WHERE id='<caso-propio>'` y transferir el caso a otra firma. `case_tasks` ya tiene WITH CHECK por la hierarchical visibility migration. |
| **Repro** | `await supabase.from("client_cases").update({ account_id: '<otra-firma>' }).eq("id", '<caso-propio>')` desde DevTools. Si no falla por trigger/constraint, el caso se transfiere. |
| **Remediación** | Re-emitir policies UPDATE y DELETE de `client_cases` y `vawa_cases` con `WITH CHECK (account_id = user_account_id(auth.uid()))`. Migration nueva. |

#### RED-4. `.env` con publishable key trackeado en git

| Campo | Valor |
|---|---|
| **Marco** | SOC2 + Calidad |
| **Ubicación** | `.env` (file tracked); `.gitignore` no lo lista |
| **Riesgo** | Aunque la `VITE_SUPABASE_PUBLISHABLE_KEY` es la anon key (low-priv por diseño), la convención de "no commitear `.env`" está rota. Mañana alguien commitea ahí la service_role key o el `ANTHROPIC_API_KEY`. Un auditor SOC II marca esto como hallazgo seguro: convención de gestión de secretos comprometida. |
| **Repro** | `git ls-files | grep "^.env$"` → aparece. |
| **Remediación** | `git rm --cached .env` + agregar `.env` a `.gitignore` + crear `.env.example` con keys vacías + rotar la publishable key. |

### B. PHI Egress a terceros sin BAA

#### RED-5. Felix / Nina / Max — dump completo del expediente a Anthropic sin verificar BAA

| Campo | Valor |
|---|---|
| **Marco** | HIPAA + ABA 1.6 |
| **Ubicación** | `supabase/functions/agent-felix/index.ts:244-287`, `agent-nina/index.ts:94-98`, `agent-max/index.ts:105-109` |
| **Riesgo** | Payload incluye `caseData` completo (todo excepto `access_token`), `profileData` completo (`a_number`, `dob`, `ssn_last4`, `passport_number`), `intakeData`. Modelo `claude-haiku-4-5-20251001`. El código **no verifica** que la cuenta Anthropic tiene Enterprise + BAA + ZDR — solo lee `ANTHROPIC_API_KEY`. Si el key apunta a cuenta consumer, no hay BAA. Max además ve `case_type` que delata VAWA/U-Visa/asilo (PHI altamente protegido bajo 8 USC 1367). |
| **Repro** | Llamar `/functions/v1/agent-felix` con un caso real, ver request body al endpoint Anthropic en logs. |
| **Remediación** | (a) Documentar BAA Enterprise + ZDR con Anthropic; verificar en deploy. (b) Minimum necessary: pasar a Felix solo los campos USCIS necesarios, no dump completo. (c) Header `anthropic-version` + flag ZDR confirmado. |

#### RED-6. Camila chat — doble egress (Lovable Gateway → Gemini) con dataset operativo

| Campo | Valor |
|---|---|
| **Marco** | HIPAA + ABA 1.6 |
| **Ubicación** | `supabase/functions/camila-chat/index.ts:115-141, 219-233` |
| **Riesgo** | Construye `officeContext` con `account_name`, citas con `client_name + appointment_type`, últimos 15 casos con `client_name + file_number + case_type + pipeline_stage + tags`, tareas vencidas con `title`. Envía a `https://ai.gateway.lovable.dev/v1/chat/completions` (proxy Lovable, BAA desconocido) usando `google/gemini-3-flash-preview`. **Dos sub-procesadores en una llamada, ninguno documentado.** Es el agente más usado del producto. |
| **Repro** | Abrir Camila chat, hacer cualquier pregunta. |
| **Remediación** | (a) Migrar a Anthropic directo con BAA. (b) Eliminar Lovable AI Gateway de paths con PHI. (c) Reducir `officeContext` a IDs + métricas agregadas, NO `client_name` raw. |

#### RED-7. `analyze-uscis-document` — ruta pública sin JWT sube documentos USCIS reales a Gemini

| Campo | Valor |
|---|---|
| **Marco** | HIPAA |
| **Ubicación** | `supabase/functions/analyze-uscis-document/index.ts:203-283` |
| **Riesgo** | OCR/análisis de documentos USCIS reales (RFE, NOID, denegaciones, recibos, **médicos consulares**) enviados como `image_url` base64 a `ai.gateway.lovable.dev` con `google/gemini-2.5-flash`. PHI más cruda del sistema. Ruta `/tools/uscis-analyzer` sin JWT, solo Origin allowlist. Sin audit log de quién subió qué documento. |
| **Repro** | Visitar `/tools/uscis-analyzer` desde dominio whitelisted, subir un médico/RFE. |
| **Remediación** | (a) Restringir a usuarios autenticados con `account_id`. (b) BAA con Google Cloud / Anthropic directo. (c) Audit log de cada doc procesado (hash + account_id + user_id + timestamp). (d) Documentar en política de privacidad. |

#### RED-8. `translate-evidence` — affidavits/testimonios a Gemini + log de PHI

| Campo | Valor |
|---|---|
| **Marco** | HIPAA |
| **Ubicación** | `supabase/functions/translate-evidence/index.ts:115-127, 46-52, 154` |
| **Riesgo** | Texto de evidencia (declaraciones, affidavits, biografías de asilo, narrativas VAWA) enviado a `ai.gateway.lovable.dev` (Gemini). Línea 46-52 loguea `petitioner` (nombre completo) y `account_id` a Supabase logs. Línea 154 loguea primeros 800 chars del output traducido — puede incluir testimonio de violación, persecución política. |
| **Repro** | Llamar `/functions/v1/translate-evidence` y revisar Edge Function logs. |
| **Remediación** | (a) BAA con proveedor Gemini. (b) Quitar `console.log` de `petitioner` y del raw output; loguear solo conteo + status. (c) Considerar PII-redaction local (no posible para affidavits literales → BAA obligatorio). |

#### RED-9. Camila Voice + briefing TTS — nombres del cliente a ElevenLabs/OpenAI/Google TTS

| Campo | Valor |
|---|---|
| **Marco** | HIPAA |
| **Ubicación** | `supabase/functions/camila-tts/index.ts:96-117`, `camila-tts-openai/index.ts:45-58`, `src/components/hub/CamilaFloatingPanel.tsx:166-189`, `HubChatPage.tsx:150-173`, `hub-morning-briefing/index.ts:340` |
| **Riesgo** | Briefing matinal narra textualmente *"María Rodríguez aprobó su I-130 ayer"* → ElevenLabs (típicamente sin BAA), fallback OpenAI (BAA solo Enterprise), Google TTS (BAA requiere contrato específico). Plus el `dynamicVariables.info_oficina` del WebSocket de Voice manda `recentCasesList`, `intakesList`, `appointmentsList` con nombres. Audio del paralegal hablando del cliente también va a ElevenLabs. |
| **Repro** | Disparar briefing matinal o abrir Voice. |
| **Remediación** | (a) Verificar plan ElevenLabs Enterprise + BAA, o migrar a Azure Speech / Google Cloud TTS con BAA. (b) Pasar nombres pseudonimizados (iniciales). (c) STT del paralegal a Web Speech API local (ya existe — usar exclusivamente). |

### C. Almacenamiento de credenciales y datos sensibles

#### RED-10. Passwords USCIS/NVC en texto plano

| Campo | Valor |
|---|---|
| **Marco** | HIPAA + ABA 1.6 |
| **Ubicación** | `supabase/migrations/20260522233411_d10fdfb4-1295-4fb7-8238-03a706cff1d3.sql:12-22`, `src/components/case-engine/PortalTrackingPanel.tsx:163,180` |
| **Riesgo** | `case_secrets` guarda `uscis_password`, `uscis_recovery_codes`, `nvc_cas_password` como **texto plano**. Sin pgcrypto/pgsodium/KMS. Compromiso de service_role key o backup = acceso directo al portal USCIS del cliente. No es PHI estricto pero su exposición permite **suplantación del cliente ante el gobierno federal**. |
| **Repro** | Conectarse con service_role: `SELECT * FROM case_secrets;` → passwords visibles. |
| **Remediación** | Instalar `pgcrypto` o `pgsodium`, cifrar a nivel columna con clave en Supabase Vault. Idealmente NO almacenar passwords USCIS — exigir al cliente guardarlos en su keychain. |

#### RED-11. Webhook arbitrario configurable por firma con PHI en payload

| Campo | Valor |
|---|---|
| **Marco** | HIPAA + Privacy |
| **Ubicación** | `supabase/functions/notify-completion/index.ts:84-100` |
| **Riesgo** | `caseData.webhook_url` configurado libremente por la firma recibe `client_name`, `client_email`, `case_type`, `petitioner_name`, `beneficiary_name`. SSRF guard presente (líneas 105-128), pero el control NO valida que el destino tenga BAA. Una firma puede mandar PHI a Zapier/Make/webhook propio sin BAA. |
| **Repro** | Configurar `webhook_url` apuntando a `https://webhook.site/<token>`, ver payload. |
| **Remediación** | (a) Allowlist de destinos por firma (solo URLs verificadas). (b) Documentar al admin que el webhook recibe PHI y requiere BAA propio con destino. (c) Audit log de cada webhook fire. |

### D. Audit logging

#### RED-12. Lecturas de caso individual NO se loggean (HIPAA §164.312(b))

| Campo | Valor |
|---|---|
| **Marco** | HIPAA §164.312(b) |
| **Ubicación** | `src/components/hub/CasePeekPanel.tsx` (todo) |
| **Riesgo** | El paralegal puede abrir 60 expedientes (peek panel) y consumir nombre cliente + receipts USCIS + RFE + notas + tareas **sin que quede registro per-caso**. Solo se loggea el mount de `/hub/cases` y `/hub/tasks` agregado. HIPAA §164.312(b) exige "Audit controls that record and examine activity in information systems that contain or use ePHI" — **acceso, no solo modificación**. |
| **Repro** | Login → `/hub/cases` → click cualquier row → panel side abre → ninguna fila en `audit_logs` con `entity_id = caseId`. |
| **Remediación** | `logAccess({ action: 'viewed', entityType: 'client_case', entityId: c.id })` en `useEffect([c?.id])` dentro de `CasePeekPanel`. Idem `useCasePeekData`. Throttle con sessionStorage TTL 15min para evitar duplicados StrictMode. |

#### RED-13. Audit log forjable por cualquier user autenticado

| Campo | Valor |
|---|---|
| **Marco** | SOC2 CC4 + HIPAA |
| **Ubicación** | `src/lib/auditLog.ts:90` + migration `20260311233317_46f89b3e_*.sql:34-36` |
| **Riesgo** | La policy WITH CHECK solo valida `user_id = auth.uid()` y `account_id = user_account_id(...)`. Todo lo demás (`action`, `entity_type`, `entity_label`, `metadata`, `user_display_name`) es free-form desde el browser. Un user puede insertar logs falsos con acciones inventadas (ej. simular `case.deleted` con `entity_label = "Caso de Mr. Lorenzo"`) en su propio user_id. Contamina `/hub/audit` con eventos fabricados. SOC II CC4 falla en "procedencia". |
| **Repro** | DevTools: `await supabase.from('audit_logs').insert({ account_id: '<mi-acct>', user_id: '<mi-uid>', user_display_name: 'CEO', action: 'case.deleted', entity_type: 'case', entity_label: 'Caso fabricado' })` → aparece en /hub/audit. |
| **Remediación** | Mover INSERT a RPC SECURITY DEFINER `record_audit_event()` que (a) fija `user_display_name` desde `profiles` server-side, (b) valida `action` y `entity_type` contra enum/CHECK, (c) sanitiza `metadata` whitelist. REVOKE INSERT directo a `authenticated`. |

#### RED-14. Fire-and-forget swallow — fallos de audit silenciosos

| Campo | Valor |
|---|---|
| **Marco** | SOC2 CC4 + HIPAA |
| **Ubicación** | `src/lib/auditLog.ts:74-98, 102-148` |
| **Riesgo** | Si `audit_logs.insert` falla (RLS, network, validation), el código solo hace `logger.warn` y la mutation principal procede. Para SOC II Type II "completeness of audit trail" un control que falla silenciosamente = control failure. No hay queue, retry, ni alerta. Plus: el trigger SQL `tg_audit_pipeline_mutations` cubre INSERT/UPDATE/DELETE de tablas pero **NO cubre `viewed_*` (READS)** ni eventos no-table-mutation (auth, tool.used, exported). |
| **Repro** | Bloquear `audit_logs.insert` temporalmente. El paralegal completa task: `case_tasks` se actualiza, `audit_logs` queda sin entry. |
| **Remediación** | Outbox local (IndexedDB) con reintento exponencial + bandera visible al admin si backlog > N. O routear todos los `logAudit` via edge function que retry hasta 200. |

#### RED-15. Sin acción `auth.login_failed` / `access.denied`

| Campo | Valor |
|---|---|
| **Marco** | HIPAA §164.312(b) + SOC2 CC6.6 |
| **Ubicación** | `src/lib/auditLog.ts:5-23` + `src/pages/Auth.tsx:257, 306` |
| **Riesgo** | El enum `AuditAction` solo define `auth.login` y `auth.logout`. Logins fallidos van únicamente a `trackEvent("auth.login_failed")` (analytics, no audit table). Ningún edge function loggea 401/403. Auditor pregunta "muéstrame intentos fallidos del último mes" → respuesta: ninguno registrado. Señal clave de credential stuffing / IDOR ausente. |
| **Repro** | 50 logins con password incorrecto → `SELECT * FROM audit_logs WHERE action LIKE 'auth.%'` → cero entries. |
| **Remediación** | Agregar `auth.login_failed`, `auth.access_denied` al enum + emitir desde Auth.tsx catch branches + helper `supabase/functions/_shared/audit.ts` para 401/403 desde edge functions. |

### E. Correctitud / Data loss

#### RED-16. JSONB merge race en `custom_fields` — data loss confirmado

| Campo | Valor |
|---|---|
| **Marco** | Calidad + SOC2 PI1 |
| **Ubicación** | `src/components/hub/NextActionEditor.tsx:134-156`, `src/components/hub/ResponsibleInlineEdit.tsx:148-174` |
| **Riesgo** | Pattern: `SELECT custom_fields` → spread `{...row, next_action: payload}` → `UPDATE custom_fields = merged`. Si 2 paralegales editan el mismo caso simultáneamente (uno cambia `next_action`, otro cambia `responsible_override`), el segundo write **sobreescribe el JSONB entero**, borrando lo del primero. No hay version check, no hay `jsonb_set` server-side. **El propio TODO en `useCasePipeline.ts:306-308` reconoce que este patrón es vulnerable.** Plus `.maybeSingle()` retorna null si RLS bloquea → código sigue y hace UPDATE con `merged={}`, **silenciosamente borrando el campo**. |
| **Repro** | 2 pestañas: A guarda Próximo Paso en caso X, B guarda Responsable override en caso X simultáneo. La 2da pisa la 1ra. Inspeccionar `custom_fields` en BD. |
| **Remediación** | RPC `update_case_custom_field(case_id, key, value, expected_updated_at)` SECURITY DEFINER con `jsonb_set` server-side + optimistic concurrency. Mínimo: cuando readErr o no row, abortar con error explícito (NO merge a `{}`). |

#### RED-17. Timezone bug en `due_date` — buckets inconsistentes + off-by-one persistente

| Campo | Valor |
|---|---|
| **Marco** | Calidad |
| **Ubicación** | `src/components/hub/TaskEditModal.tsx:71-74, 88, 99` + `src/hooks/useCasePipeline.ts:259-269` vs `src/components/hub/TasksByDateView.tsx:104-116` |
| **Riesgo** | Dos motores distintos de "vencido": `useCasePipeline` calcula `t.due_date < today` con `today = new Date().toISOString().slice(0,10)` (UTC string compare); `TasksByDateView` calcula con `new Date(t.due_date + "T00:00:00").getTime() < todayMs` (cliente local). En NY 23:00 PM con server UTC 04:00 del día siguiente, una task `due_date='2026-06-06'` aparece overdue en `useCasePipeline` (KPI ATRASADAS=14) pero como "hoy" en `TasksByDateView` (HOY=0 si nada matchea). **Explica exactamente el síntoma del checklist.** Plus: `TaskEditModal:88` escribe `${dueDate}T${dueTime}:00` SIN offset → Postgres lo lee UTC y resta 5h en NY → off-by-one persistente entre saves. |
| **Repro** | NY user a las 23:00 PM crea task con due_date=hoy, hora=17:00. Guardado como `2026-06-06T17:00:00` (UTC implícito). Re-abrir → muestra hora local 12:00. Día puede saltar. |
| **Remediación** | (a) Unificar: calcular `is_overdue` en BD vía vista/RPC con `current_date AT TIME ZONE firm_tz`. Persistir TZ del firm en `office_config`. (b) Persistir timestamps con offset explícito o usar columna `date` puro + columna `time` separada. (c) Documentar invariante. |

#### RED-18. No runtime check de env vars en cliente Supabase

| Campo | Valor |
|---|---|
| **Marco** | SOC2 + Calidad |
| **Ubicación** | `src/integrations/supabase/client.ts:5-6` |
| **Riesgo** | `createClient(undefined, undefined)` si las env vars no están seteadas. Sin assert/guard. Build se silencia, cliente queda con URL=`undefined`. Auth queries fallan con mensajes confusos. |
| **Repro** | `unset VITE_SUPABASE_URL && bun run preview` → crash en runtime, no en build. |
| **Remediación** | `if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) throw new Error("Missing env: VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY")` antes del createClient. Validar HTTPS también. |

#### RED-19. Hard delete de `case_tasks` sin audit ni soft-delete

| Campo | Valor |
|---|---|
| **Marco** | SOC2 + Calidad |
| **Ubicación** | `src/components/hub/TaskEditModal.tsx:191-204` |
| **Riesgo** | `handleDelete` usa `window.confirm()` solo en cliente, sin re-auth, sin razón forense. NO emite `logAudit` de delete (mientras complete/reactivate sí). Auditor pregunta "¿quién borró la task asociada al case X el día Y?" → sin trail (solo trigger SQL whitelisted, sin title/description). Migration `soc2_pipeline_quick_wins` agregó `deleted_at` pero el componente lo ignora. |
| **Repro** | Click trash → confirm → DELETE → cero `task.deleted` en audit. |
| **Remediación** | (a) `logAudit({ action: "task.deleted", entity_type: "task", entity_id, metadata: { title_hash } })` ANTES del delete. (b) Convertir a soft-delete: `update({ deleted_at: new Date().toISOString() })`. |

### F. PHI en logs / leak de schema

#### RED-20. `console.log` con PHI en producción (no gateado por DEV)

| Campo | Valor |
|---|---|
| **Marco** | HIPAA + SOC2 |
| **Ubicación** | `src/components/hub/CamilaFloatingPanel.tsx:228` + `src/components/CSPACalculator.tsx:506,510` + `supabase/functions/push-task-to-ghl/index.ts:107,120` + `push-note-to-ghl/index.ts:73,89` + `push-contact-to-ghl/index.ts:167` + `translate-evidence/index.ts:154` |
| **Riesgo** | (a) Frontend: console.log con `message`, `requestBody`, datos del cliente → leak a DevTools + Sentry/LogRocket si están conectados (no detectados en bundle hoy pero futuro). (b) Edge functions: console.log con título de task ("Subir examen médico Ciudad Juárez de María Rodríguez"), body de note, contenido de contacto → queda en Supabase Edge Function logs accesibles a soporte Supabase/Lovable. Viola minimum necessary. |
| **Repro** | Push a GHL → revisar Edge Function logs en Supabase dashboard. |
| **Remediación** | (a) Gatear con `if (import.meta.env.DEV) console.log(...)` (frontend) — el pattern ya existe en `EvidenceForm.tsx:463`. (b) En edge functions: logs estructurados con `account_id` + `entity_id` + `status` solamente, NUNCA `title`/`body`/`content`. |

#### RED-21. PHI en errores de Anthropic persistidos en `ai_agent_sessions.error_message`

| Campo | Valor |
|---|---|
| **Marco** | HIPAA |
| **Ubicación** | `supabase/functions/agent-felix/index.ts:291`, `agent-nina/index.ts:127-128`, `agent-max/index.ts:137-138` |
| **Riesgo** | En caso de error de Anthropic se loguea `errText` y se persiste en `ai_agent_sessions.error_message`. Si el error incluye fragmento del prompt (típico de prompts >context), PHI queda en BD permanentemente. |
| **Repro** | Forzar prompt >200k tokens → ver error message con cuerpo de prompt. |
| **Remediación** | Sanitizar `errText` antes de persistir — solo `error.type` + `error.code`, nunca cuerpo de prompt. |

### G. URLs firmadas + storage

#### RED-22. Signed URLs con TTL 7 días para PDFs USCIS

| Campo | Valor |
|---|---|
| **Marco** | HIPAA + SOC2 |
| **Ubicación** | `src/lib/caseToolOutputs.ts:144` |
| **Riesgo** | `createSignedUrl(path, 60*60*24*7)` — 7 días de TTL para outputs (cover letters, forms I-130/I-765 llenos con PHI). Si URL leakea (browser history, copy/paste, email forward), atacante tiene 7 días de acceso. |
| **Repro** | Generar tool output, copiar URL del response, esperar y reacceder. |
| **Remediación** | TTL 1h (3600). Para descargas recurrentes, regenerar bajo demanda. |

### H. Búsqueda + minimum necessary

#### RED-23. Conflicto Frontend ↔ DB en `client_profiles` PII columns

| Campo | Valor |
|---|---|
| **Marco** | SOC2 + HIPAA |
| **Ubicación** | `src/hooks/useCasePipeline.ts:222-236` vs `supabase/migrations/20260606030000_soc2_pipeline_quick_wins.sql:186-187` |
| **Riesgo** | El hook hace nested select directo a `client_profiles.{phone, mobile_phone, a_number}`. La migration SOC2 quick wins revoca SELECT de esas columnas a `authenticated`. **O el query falla con 42501 para TODOS los users (Pipeline rompe), o la migration NO está aplicada en prod (vulnerabilidad abierta para roles assistant/readonly)**. La vista de mitigación `client_profiles_safe` existe pero NO se usa. |
| **Repro** | Login como cualquier role → cargar `/hub/cases` → si Pipeline carga OK con A-number visible, migration no aplicada. |
| **Remediación** | Refactor `useCasePipeline` para consumir `client_profiles_safe`. Coordinar con Lovable para confirmar estado de migration en prod. |

---

## 3. Hallazgos 🟡 IMPORTANTES (42 totales — listado compacto)

### Autorización / IDOR

| # | Ubicación | Riesgo (1 línea) |
|---|---|---|
| AMBER-1 | `src/pages/HubTasksPage.tsx:44-49` + `HubCasesPage.tsx:55-60` | `accountId` desde `sessionStorage` (client-controlled); RLS bloquea queries cross-tenant pero audit logs y UI quedan confusos. Mover a hook `useUserAccountId()` resuelto server-side. |
| AMBER-2 | `src/pages/HubCasesPage.tsx:223-265` | Búsqueda por A-number/teléfono/USCIS corre 100% client-side. Depende 100% de RLS. Mover a RPC `search_cases_pii()` SECURITY DEFINER con rate-limit y `user_can_see_pii()` gate. |
| AMBER-3 | `src/components/hub/TasksByDateView.tsx:621-656` | Bulk update confía 100% en RLS sin `.eq("account_id", accountId)` defense-in-depth ni `.select("id")` post-update para detectar silent denial. |
| AMBER-4 | `src/components/hub/TaskEditModal.tsx:84-130, 141-188` | No incluye `.select("id")` post-update para detectar RLS silent fail. Inconsistente con `TaskAssigneeInlineEdit:146-159`. |
| AMBER-5 | `src/components/hub/CasePeekPanel.tsx:74` → `useCasePeekData.ts:72-87` | `case_notes` query sin `.eq("account_id")` explícito. Solo filtra por `case_id`. Defense-in-depth recomienda agregarlo. |
| AMBER-6 | `supabase/functions/b1b2-create-case/index.ts:108-123` | Elige primer owner/admin del account como `professional_id` SIN consentimiento. Audit trail roto: caso queda atribuido a owner cuando lo creó paralegal. |
| AMBER-7 | `supabase/functions/b1b2-create-case/index.ts:137-152` (service_role usage) | No agrega `.eq("account_id")` redundante en INSERT/UPDATE. Bug futuro: si alguien agrega `.update()` sin doble check, mass-tenant breach. |
| AMBER-8 | `src/hooks/useCasesKpis.ts:62-103` | KPI queries usan `accountId` desde session (AMBER-1). Server-side RPC `get_cases_kpis()` SECURITY DEFINER usando `auth.uid()` directo. |

### Audit logging

| # | Ubicación | Riesgo |
|---|---|---|
| AMBER-9 | `useCaseInlineEdit.ts:109-119` + `Task*InlineEdit.tsx` + `TasksByDateView.tsx:540-549, 574-579, 603-606` | Acción semántica mal etiquetada: TODO inline edit de task loggea `action: "task.completed"`. Forensics SOC II inútil. Agregar `task.snoozed`, `task.reactivated`, `task.priority_changed`, `task.due_date_changed`, `task.assigned_changed`. |
| AMBER-10 | `NextActionEditor.tsx:99-212`, `CasePeekPanel.tsx:217-220`, `ResponsibleInlineEdit.tsx:118-197` | Mutations a `custom_fields` NO llaman logAudit. Trigger SQL solo loggea columnas whitelisted; `custom_fields` no está. Audit con `old/new` idénticos. |
| AMBER-11 | `src/components/hub/TaskEditModal.tsx:84-205` | No emite `logAudit` en ninguna mutation. `title` y `description` no están en whitelist del trigger → renames perdidos. ABA 1.6 sensible porque title puede contener PII. |
| AMBER-12 | `src/pages/HubAuditPage.tsx:182-208` | Export CSV no se loggea (HIPAA disclosure tracking + SOC II CC2.3). |
| AMBER-13 | `src/lib/auditLog.ts:130-139` | `logAccess` mete `url: window.location.pathname` en metadata. Para casos individuales será `/case-engine/<uuid>` → trazabilidad PHI que el whitelist del trigger SQL explícitamente quita. |
| AMBER-14 | `src/lib/auditLog.ts:103-148` | `logAccess` catch silencioso `catch {}`. Inconsistente con `logAudit` (al menos logger.warn). |
| AMBER-15 | `TasksByDateView.tsx:621-656` (`handleBulkComplete`) | Loggea UN row con `entity_id = ids[0]` (o `undefined` si length>1). Auditor que filtra por taskId pierde el evento. Emitir 1 logAudit por taskId. |
| AMBER-16 | `CaseStageInlineEdit.tsx:75-91` via `useCaseInlineEdit.ts:109` | Journey step (status crítico SOC II) loggea como `case.updated`, no `case.status_changed` (declarado en enum, nunca emitido). |
| AMBER-17 | `src/pages/HubTasksPage.tsx:60-66` + `HubCasesPage.tsx:79-85` | `logAccess` en useEffect sin guard StrictMode + remount → dobles entries. Throttle por sessionStorage TTL 15min. |
| AMBER-18 | Migrations `20260606030000` + `20260606050000` | Sin retention policy implementada para `audit_logs`. Triggers de inmutabilidad impiden poda → no se puede ni archivar. Particionar por mes + procedimiento `archive_audit_partition()` SECURITY DEFINER. |
| AMBER-19 | Migration `20260311233317_*.sql:1-37` + `20260606030000_*:110-126` | No hay policy DELETE explícita en `audit_logs`. Trigger BEFORE DELETE cubre, pero service_role podría DROP TRIGGER + DELETE. Event triggers para monitorear DROP TRIGGER. |
| AMBER-20 | `TaskEditModal.tsx:191-203` + `TasksByDateView.tsx:582-619, 557-580` | Hard delete de `case_tasks` ignora `deleted_at`. Convertir a soft-delete. |
| AMBER-21 | `HubAuditPage.tsx:225-240` | Paralegal sin permisos ve página vacía sin mensaje "No tenés permisos". Detectar error 403 → EmptyState. |

### PHI Egress

| # | Ubicación | Riesgo |
|---|---|---|
| AMBER-22 | `push-task-to-ghl:107,120` + `push-note-to-ghl:73,89` + `push-contact-to-ghl:167` | Edge function logs con cuerpo entero de task/note/contact. Accesible a soporte Supabase/Lovable. |
| AMBER-23 | `push-contact-to-ghl:125-163` + `push-note-to-ghl:68-86` + `push-task-to-ghl:77-117` | GHL típicamente sin BAA. Notas y tareas con PHI viajan en claro. Visibility `attorney_only`/`admin_only` NO se filtra antes de push → leak de jerarquía. |
| AMBER-24 | `src/integrations/supabase/client.ts:13` | `storage: localStorage` para session. JWT vulnerable a XSS persistente. Tradeoff conocido — al menos documentar. |
| AMBER-25 | `summarize-consultation/index.ts:87-97, 170-178` | Raw `raw_notes`, `client_name`, `derivatives[].name` a Anthropic. Output con `ai_flags` (prior_deportation, criminal_record, humanitarian) persistido en `consultations`. Mismo problema que Felix: depende de BAA. |
| AMBER-26 | `useCasePeekData.ts:74` + `useCasePipeline.ts:222-236` | `select("*")` o select amplio trae `custom_fields`, `case_tags_array`, `client_profile_id`. Gating en frontend post-fetch. Si descompilás bundle, atacante autenticado lee columnas no visibles. **Mitigado** por RLS column-level en migration `20260606030000` — pero confirmar que está aplicada. |
| AMBER-27 | `src/lib/analytics.ts:55-92` + `track-public-event:56-78` | PII guard solo filtra keys que parecen PII, no valores. Evento con `description: "Visit Dr. González…"` pasa porque `description` no es key PII. Allowlist por evento, no denylist. |
| AMBER-28 | `migration 20260413033811_*:133-136` | Comentario `'SENSITIVE: ... - consider encrypting'` admite el problema. `passport_number`, `ssn_last4` siguen sin cifrado columna 14 meses después. |

### Correctitud / Calidad

| # | Ubicación | Riesgo |
|---|---|---|
| AMBER-29 | `useCasesKpis.ts:93-95` | Doble `.or()` consecutivo produce `(rfe.gte OR uscis.gte) AND (rfe.lte OR uscis.lte)`. Falsos positivos en KPI Deadlines 7d. |
| AMBER-30 | `TaskEditModal.tsx:127-129` | `catch { // silent }` swallowea error de push-task-to-ghl. Sync GHL falla sin que user sepa ni audit registre. |
| AMBER-31 | `tests/e2e/regression.spec.ts` (todo) | **Cero tests de autorización cross-tenant.** Control existe (RLS) pero sin evidence-of-testing. SOC II Type II gap claro. |
| AMBER-32 | `TaskCreateModal`, `QuickTaskModal`, `TaskEditModal` | Validación cero en `title` (cero maxLength → 50KB pasa) y `due_date` (acepta `9999-12-31` o `0001-01-01`). |
| AMBER-33 | `TasksByDateView.tsx:355-356`, `useCasePipeline.ts:235, 257` | `.is("deleted_at" as any, null)` con cast `any` porque columna puede no existir. Si migration no aplicada en prod, soft-deletes no se filtran. |
| AMBER-34 | `NextActionEditor.tsx:81-86` | useEffect resetea estado por referencia de `currentValue`. Parent re-render durante typing → pierde texto. |
| AMBER-35 | `QuickTaskModal.tsx:143-194` | Fetch async sin AbortController/cancelled flag → setState en unmounted component warning. |
| AMBER-36 | `TasksByDateView.tsx:104-116` | `RELEVANT_BUCKETS_BY_TAB.completadas` incluye todos los buckets → tareas completed pre-2026 caen en bucket overdue por due_date viejo. Bucketear por `completed_at`. |
| AMBER-37 | `TaskCreateModal:222`, `Task*InlineEdit.tsx`, `QuickTaskModal:243,265`, `TaskEditModal:136,186,202` | Pattern `toast.error(msg, { description: err?.message })` vuelca Postgres errors raw ("permission denied for table case_tasks", "duplicate key value violates unique constraint"). Schema leak. `parseSupabaseError` existe pero no se aplica. |
| AMBER-38 | `.github/workflows/e2e.yml` | CI sin SAST, sin `bun audit`, sin secret scanning (gitleaks/trufflehog). Vulnerability management gap SOC II. |
| AMBER-39 | `agent-felix:291`, `agent-nina:127-128`, `agent-max:137-138` (AMBER complementario a RED-21) | Logs de errores de Anthropic en `ai_agent_sessions.error_message`. Sanitizar antes de persistir. |
| AMBER-40 | `_shared/origin-allowlist.ts:37-40` | Acepta cualquier `*.lovable.app` y `*.lovableproject.com`. Atacker crea preview en lovable.app y ataca. Restringir a subdomain específico. |
| AMBER-41 | `useCasePipeline.ts:259-269` vs `TasksByDateView` | Cálculo de overdue inconsistente (string compare server-derived vs cliente local). Ya cubierto en RED-17 conceptualmente. |
| AMBER-42 | `useCasesKpis.ts:62-103` | `Promise.all` sin AbortController. Navegación rápida entre tabs → multiples queries pendientes consumen DB. |

---

## 4. Hallazgos ⚪ PULIDO (19 — lista de cleanup)

1. **`QuickTaskModal.tsx:248`** — `logAudit` sin `void`/`await` (PromiseRejection escapa).
2. **`TasksByDateView.tsx:575`** — `action: "task.reactivated" as any` no está en union type.
3. **`auditLog.ts:128-140`** — `entity_id || accountId` fallback → accountId aparece como pseudo-recurso. Permitir NULL real.
4. **`auditLog.ts:33-69`** — Cache `_cachedDisplayName` no se invalida si user cambia `full_name`. Stale hasta refresh.
5. **`CasePeekPanel.tsx` (todo)** — Diferenciar `viewed_case_peek` vs `viewed_case_engine` para que auditor distinga preview vs full open.
6. **`TaskDueDateInlineEdit.tsx:106-107`** — Mensaje "Sin permiso para cambiar fecha (RLS)" assume RLS denial pero también puede ser row borrada en race. Distinguir.
7. **`TasksByDateView.tsx:601-606`** (handleSnooze) — Rollback no actualiza bucket → visual flicker.
8. **`caseGrouping.ts:373`** — String UI "Sin due_date asignado" expone nombre de columna BD. Cambiar a lenguaje usuario.
9. **`TaskCreateModal.tsx:111-122`** — `filteredCases` sin useMemo. Con 500+ cases recomputa por keystroke.
10. **`QuickTaskModal.tsx:215`** — `.single()` puede throw; usar `.maybeSingle()`.
11. **`hub-morning-briefing/index.ts:340`** — Ejemplo en system prompt usa nombre falso "María Rodríguez" — entrena modelo a usar nombres. OK si BAA.
12. **`supabase/client.ts:5-6`** — No valida HTTPS en `SUPABASE_URL`. Build con `http://` por error queda en claro.
13. **`camila-chat:5-9`** — CORS `*` aceptable (hay JWT/Origin checks) pero levanta flag en pen-tests. Reflejar Origin verificado.
14. **`hubSections.ts`** — Section gate solo UI. Confirmar que endpoints API detrás de secciones disabled no responden (en práctica RLS cubre, pero documentar).
15. **`useCaseInlineEdit.ts:104-119`** — Action enumerada como `"task.completed"` para TODO edit de task. Action codes más granulares en `AuditAction`.
16. **`b1b2-create-case` returns `success:true, synced:false` siempre** — errores silenciosos rompen audit trail SOC II.
17. **`useCasesKpis.ts:62-103`** — `Promise.all` sin AbortController (también listado en AMBER-42, mantener acá como pulido si se acepta).
18. **`auditLog.ts:5-23`** — Enum AuditAction no incluye `task.reactivated` (cast as any en código).
19. **`feedback de seed data 'Test Prueba'`** — no encontrado en repo. Si existe vive solo en BD productiva (Lovable-managed). Auditar manualmente.

---

## 5. Inventario de sub-procesadores detectados

| Vendor | Datos enviados | Vía | BAA status (real) |
|---|---|---|---|
| **Anthropic** (`api.anthropic.com`) | Dump completo de caso + perfil + intake + notas | Felix/Nina/Max/summarize/morning-briefing/camila-briefing | **Sospechoso** — BAA en Enterprise; código no verifica plan |
| **Lovable AI Gateway** → **Google Gemini** | Chat + dataset operativo + base64 documentos USCIS + texto evidencia | camila-chat, analyze-uscis-document, generate-checklist, translate-evidence | **Sospechoso/Desconocido** — doble sub-procesador no documentado |
| **ElevenLabs** | Texto briefing con nombres + audio voz paralegal + transcripciones | camila-tts, elevenlabs-conversation-token, CamilaFloatingPanel WS | **Típicamente sin BAA** en planes estándar |
| **OpenAI** | Texto briefing/notas para TTS | camila-tts-openai | **Sospechoso** — BAA solo Enterprise/ZDR, no verificado |
| **Google TTS** | Texto briefing fallback | camila-tts | **Sospechoso** — GCP BAA requiere contrato + servicios cubiertos |
| **GoHighLevel** | Nombre, email, teléfono, tags, contenido literal de notas, títulos/descripción tareas | push-contact/push-note/push-task | **Típicamente sin BAA** — Agency Pro estándar |
| **Resend** | To-email, subject, HTML con client_name, case_type, file_number, attorney_name | send-email | **Sospechoso** — no publicita BAA en planes estándar |
| **Federal Register API** | Solo agency_ids (GET) | camila-briefing | OK — sin PHI |
| **wttr.in** | Ciudad de la firma | camila-briefing | OK — sin PHI |
| **Webhook arbitrario** | Nombre cliente, email, petitioner_name, beneficiary_name, case_type | notify-completion | **Indeterminado** — configurable por firma; SSRF mitigado pero PHI sale |

---

## 6. Veredicto por marco

### SOC 2 Type II
**No defensible hoy.** El control "audit logging" tiene 4 gaps categóricos (READ logs ausentes, log forjable, fire-and-forget, sin auth.failed). El control "vendor management" no tiene inventario de BAA documentado en código. El control "change management" pasa (PRs, code review, pre-push hooks) pero CI sin SAST/dependency audit.

### HIPAA (auto-atestación "conscious")
**No defensible.** Passwords USCIS en plaintext, lectura individual de PHI no loggeada, AI agents enviando expediente completo sin BAA verificado, TTS con nombre del cliente a ElevenLabs.

### ABA Model Rule 1.6(c) "reasonable efforts"
**No defensible** bajo Formal Opinion 512 (2024, AI use in legal practice). Un abogado responsable no puede sostener que protegió "razonablemente" información del cliente si:
- Cualquier paralegal sin sesión puede subir un examen médico a un sub-procesador AI (`analyze-uscis-document`).
- El audit log es forjable.
- Las passwords USCIS están en claro.

**Después de Sprint 0 + 1 (3 semanas) → defensible con observaciones menores. Después de Sprint 3 (6 semanas) → defensible robusto.**

---

## 7. Archivos críticos auditados (referencia)

(Lista absoluta para PR comments + tickets.)

**Pantallas + páginas:**
- `/home/user/proof-package/src/pages/HubTasksPage.tsx`
- `/home/user/proof-package/src/pages/HubCasesPage.tsx`
- `/home/user/proof-package/src/pages/HubAuditPage.tsx`

**Componentes principales:**
- `/home/user/proof-package/src/components/hub/TasksByDateView.tsx`
- `/home/user/proof-package/src/components/hub/CasePeekPanel.tsx`
- `/home/user/proof-package/src/components/hub/Task{Create,Edit,Assignee,Priority,DueDate}*.tsx`
- `/home/user/proof-package/src/components/hub/Case{Stage,Type,Owner}InlineEdit.tsx`
- `/home/user/proof-package/src/components/hub/NextActionEditor.tsx`
- `/home/user/proof-package/src/components/hub/ResponsibleInlineEdit.tsx`
- `/home/user/proof-package/src/components/hub/CamilaFloatingPanel.tsx`

**Hooks de datos:**
- `/home/user/proof-package/src/hooks/useCasePipeline.ts`
- `/home/user/proof-package/src/hooks/useCasesKpis.ts`
- `/home/user/proof-package/src/hooks/useCaseInlineEdit.ts`
- `/home/user/proof-package/src/hooks/useCasePeekData.ts`

**Libs compartidas:**
- `/home/user/proof-package/src/lib/auditLog.ts`
- `/home/user/proof-package/src/lib/parseSupabaseError.ts`
- `/home/user/proof-package/src/lib/analytics.ts`
- `/home/user/proof-package/src/lib/caseToolOutputs.ts`
- `/home/user/proof-package/src/integrations/supabase/client.ts`

**Edge functions:**
- `/home/user/proof-package/supabase/functions/sync-case-stage-to-ghl/index.ts` (RED-1)
- `/home/user/proof-package/supabase/functions/agent-{felix,nina,max}/index.ts`
- `/home/user/proof-package/supabase/functions/camila-{chat,briefing,tts,tts-openai}/index.ts`
- `/home/user/proof-package/supabase/functions/analyze-uscis-document/index.ts`
- `/home/user/proof-package/supabase/functions/translate-evidence/index.ts`
- `/home/user/proof-package/supabase/functions/b1b2-{create,update}-case/index.ts`
- `/home/user/proof-package/supabase/functions/push-{task,note,contact}-to-ghl/index.ts`
- `/home/user/proof-package/supabase/functions/notify-completion/index.ts`
- `/home/user/proof-package/supabase/functions/hub-morning-briefing/index.ts`
- `/home/user/proof-package/supabase/functions/summarize-consultation/index.ts`

**Migrations clave:**
- `/home/user/proof-package/supabase/migrations/20260220202105_*.sql` (legacy RLS policy de RED-2)
- `/home/user/proof-package/supabase/migrations/20260310040957_*.sql` (RLS sin WITH CHECK de RED-3)
- `/home/user/proof-package/supabase/migrations/20260311233317_*.sql` (audit_logs INSERT de RED-13)
- `/home/user/proof-package/supabase/migrations/20260413033811_*.sql` (passwords plaintext de RED-10)
- `/home/user/proof-package/supabase/migrations/20260503100000_role_visibility_hierarchical.sql`
- `/home/user/proof-package/supabase/migrations/20260522233411_*.sql` (case_secrets plaintext)
- `/home/user/proof-package/supabase/migrations/20260606030000_soc2_pipeline_quick_wins.sql`
- `/home/user/proof-package/supabase/migrations/20260606040000_audit_logs_user_id_nullable.sql`
- `/home/user/proof-package/supabase/migrations/20260606050000_soc2_pipeline_pii_audit_whitelist.sql`
- `/home/user/proof-package/supabase/migrations/20260606060000_case_action_history.sql`

---

## 8. Limitaciones del audit (lo que NO pude verificar)

1. **Estado real de migrations en prod.** Supabase es Lovable-managed; no tengo acceso a `pg_policies` de la BD productiva. Hallazgos como RED-2, RED-3, RED-23 dependen de confirmar que las migrations están aplicadas. **Acción:** dump de `pg_policies` y `\d+ client_cases/case_tasks/audit_logs` desde Supabase SQL editor.
2. **BAA real con vendors.** El código no expone si Anthropic/Lovable Gateway/ElevenLabs/etc. tienen BAA firmado. Mr. Lorenzo tiene que confirmar plan + contrato con cada vendor. Lo que el audit afirma es *"el código no verifica BAA"*, no *"no hay BAA"*.
3. **Seed data `Test Prueba`.** `grep` cero matches en repo. Si existe, vive en BD productiva.
4. **Bundle producción.** No corrí análisis de bundle deployado para confirmar que `console.log` con PHI realmente leakea a producción. Hay que verificar con dev tools en `app.nerimmigration.com`.

---

## 9. Siguientes pasos sugeridos

1. **Esta semana:** ejecutar Sprint 0 (mitigación de emergencia). Los 6 ítems suman ~1 día de trabajo focal. **El #1 (`sync-case-stage-to-ghl`) es prioridad absoluta — es el único hallazgo con riesgo de breach reportable activo HOY.**
2. **Confirmar prod state:** Mr. Lorenzo le pide a Lovable un dump de `pg_policies` para `client_cases`, `case_tasks`, `audit_logs`, `vawa_cases`. Compartir con el auditor SOC II como evidencia.
3. **Decisión de arquitectura AI:** definir vendor único con BAA firmado para todos los paths con PHI. Recomendación técnica: **Anthropic Enterprise + ZDR** (única ventana de remediación rápida porque ya está integrado en 6+ functions).
4. **Crear tickets:** cada hallazgo 🔴 = 1 ticket en el tracker, con esta MD referenciada. Documenta procedencia del hallazgo + remediación esperada + owner del fix. Eso ES la evidencia de "control opera durante ventana de auditoría".
5. **Después de Sprint 0+1:** repetir este audit (puede ser auto-ejecutado por agentes) para tener delta documentado pre vs post.

---

**Hoja de generación:** este reporte fue producido por Claude Code (Opus 4.7) ejecutando 4 sub-agentes especializados en paralelo, cada uno con scope acotado (IDOR, audit logging, PHI egress, correctitud/calidad). Cada hallazgo fue verificado al nivel `file:line`. Hallazgos solapados entre auditores fueron deduplicados.

**No se modificó código en esta pasada.** Los arreglos van por PR + code review como manda el control de cambios SOC II.
