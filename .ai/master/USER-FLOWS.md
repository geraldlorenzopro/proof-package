# 🚶 NER Immigration AI · USER FLOWS

**Última actualización:** 2026-05-14
**Owner:** Mr. Lorenzo
**Status:** PLANO FUNDACIONAL · define cómo cada rol navega el producto

---

## 1. POR QUÉ ESTE DOCUMENTO EXISTE

Este documento define **CÓMO** cada tipo de usuario usa NER. Sin esto, los features se construyen ciegamente.

Cada flujo aquí documentado debe tener:
- Un **trigger** (qué hace al usuario abrir NER)
- Una **secuencia de pantallas** (qué ve en qué orden)
- Un **outcome** (qué logró al final)
- Un **tiempo esperado** (cuánto debería tomar)

Si un flujo en producción no termina en su outcome o toma 2x más de lo esperado, hay un bug de UX.

---

## 2. LOS 4 ROLES + 1 (cliente del cliente)

| # | Rol | USCIS authorization | Quien firma G-28 | Acceso NER |
|--:|---|:--:|:--:|---|
| 1 | **Abogado** | Attorney (J.D., admitted to practice) | ✅ Sí | Full + admin posible |
| 2 | **Representante Acreditado BIA** | Recognized organization rep | ✅ Sí | Full + admin posible |
| 3 | **Preparador autorizado** | Preparer (firma propio nombre G-1145) | ❌ No (firma G-1145 self) | Full work, sin sign G-28 |
| 4 | **Aplicante Self-Petitioner** | Pro se | ❌ No (no G-28) | Portal limitado a SU caso |
| 5 | **Platform Admin** (Mr. Lorenzo) | N/A | N/A | Cross-firmas, ops SaaS |

**Nota legal:** Los roles 1, 2, 3 son los **clientes pagantes** del SaaS. El rol 4 es el **beneficiario invitado** del cliente pagante. El rol 5 es el dueño del SaaS.

---

## 3. ESCENARIOS CANÓNICOS — 14 flows que cubren 95% del uso

Los flows están organizados por rol. Cada flow tiene un código (F-XX) para referenciar desde wireframes y código.

### ROL 1 + 2 + 3 — Profesional pagante (paralegal típico)

| Código | Flow | Frecuencia |
|--:|---|---|
| F-01 | Mañana operativa del paralegal | Diaria |
| F-02 | Nuevo lead llega de GHL | Diaria |
| F-03 | Lead → consulta agendada | 3-5x/semana |
| F-04 | Consulta sucede + decisión tomar caso | 3-5x/semana |
| F-05 | Caso nuevo iniciado + enviar cuestionario | 2-3x/semana |
| F-06 | Recibir docs del cliente + revisar | Diaria |
| F-07 | Llenar Smart Form (I-130) + descargar PDF | 2-3x/semana |
| F-08 | RFE/NOID llega → analizar + responder | 1-2x/semana |
| F-09 | Caso aprobado → cerrar + cobrar siguiente paso | 1-2x/semana |
| F-10 | Caso entra a NVC → consular processing | 1-2x/mes |

### ROL 4 — Aplicante (cliente del paralegal)

| Código | Flow | Frecuencia |
|--:|---|---|
| F-11 | Recibe link de pre-intake + completa | 1x por caso |
| F-12 | Completa cuestionario detallado del caso | 1x por caso |
| F-13 | Sube documentos solicitados | 1-3x por caso |
| F-14 | Revisa estado del caso periódicamente | Recurrente |

### ROL 5 — Platform Admin (Mr. Lorenzo)

| Código | Flow | Frecuencia |
|--:|---|---|
| F-15 | Onboardear firma nueva | 1x/mes |
| F-16 | Revisar salud SaaS (MRR, churn, problemas) | Semanal |
| F-17 | Activar/desactivar feature flag por firma | Esporádico |
| F-18 | Soporte: impersonate firma para debugger | 1-3x/mes |

---

## 4. FLOWS DETALLADOS — ROL PROFESIONAL

### F-01 · Mañana operativa del paralegal

**Persona:** Vanessa, paralegal, 33 años, 15 años de experiencia
**Trigger:** llega al estudio a las 7:30am, abre laptop, click bookmark `app.nerimmigration.com`
**Outcome esperado:** en 5 minutos sabe los 3 fuegos del día
**Tiempo target:** 3-5 minutos

```
┌─────────────────────────────────────────────────────────────┐
│  PASO 1: Login                                              │
│  Pantalla: /auth                                            │
│  Acción: ingresa email + password                           │
│  (Si MFA habilitado: ingresa código TOTP)                   │
│  Tiempo: 30s                                                │
└─────────────────────────────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────────────┐
│  PASO 2: Splash (2.7s)                                      │
│  Pantalla: HubSplash con logo de la firma                   │
│  Tagline: "Cada caso, una estrategia."                      │
│  Auto-redirect a /hub                                       │
└─────────────────────────────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────────────┐
│  PASO 3: Hub Dashboard                                      │
│  Pantalla: /hub                                             │
│  Ve:                                                         │
│  ⚠️ CRISIS BAR (rojo) si hay algo urgente                   │
│  📊 Briefing Camila personalizado:                          │
│     "Buenos días Vanessa. Tienes 3 cosas urgentes:          │
│      1. García I-797 RFE vence en 3 días                    │
│      2. Pérez biometrics mañana 9am                         │
│      3. Sánchez consulta 11am, sin pre-intake completado"   │
│                                                              │
│  📁 4 widgets focus:                                        │
│     - Para firmar (signatures pending)                      │
│     - Para revisar (RFE/NOID drafts)                        │
│     - Consultas hoy                                         │
│     - Entrevistas 7d (USCIS biometrics/interviews)          │
│                                                              │
│  📈 Pulse strip (casos activos, leads hoy, aprobación 30d)  │
│  Tiempo: 30-60s para leer                                   │
└─────────────────────────────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────────────┐
│  PASO 4: Acción según prioridad                             │
│  Vanessa decide:                                            │
│  - Click "García I-797" en briefing → F-08 (RFE response)   │
│  - Click "Sánchez consulta" → F-04 (consulta sucede)        │
│  - Sidebar "Casos" → ver pipeline → click caso específico   │
└─────────────────────────────────────────────────────────────┘
```

**Pantallas tocadas:** `/auth`, `/hub`
**Datos consumidos:** ner_accounts, account_members, client_cases (count), case_tasks (urgent), case_notes (recent), appointments (today), morning briefing (edge function)

**Lo que DEBE pasar para que este flow funcione:**
- ✅ Login funciona (LIVE)
- ✅ Splash carga en <3s (LIVE)
- ⚠️ Briefing nombra clientes REALES (hoy es genérico — P0 fix)
- ⚠️ Widgets "Para firmar/revisar" tienen data real (hoy son placeholders parciales — P0 fix)
- ✅ Pulse strip muestra números reales (LIVE)

---

### F-02 · Nuevo lead llega de GHL

**Trigger:** Vanessa nota badge rojo "5 nuevos" en sidebar "Leads"
**Outcome:** lead asignado a consulta + paralegal contactó
**Tiempo target:** 2-3 min por lead

```
1. Click sidebar "Leads" → /hub/leads
2. Lista muestra contactos auto-sincronizados de GHL
3. Filter por "channel: WhatsApp" o "fuente: ad Facebook"
4. Click lead → modal/drawer con detalles GHL (notes, history)
5. Botón "Agendar consulta" → modal StartConsultationModal
6. Selecciona fecha/hora, attorney asignado
7. Submit → consulta creada en /hub/consultations (Kanban col 1)
8. (Opcional) Click "Enviar pre-intake" → email/SMS con link /intake/:token
```

**Pantallas:** `/hub/leads`, modal StartConsultationModal
**Datos:** leads (sync GHL), appointments (crear)

---

### F-03 · Lead → consulta agendada

**Trigger:** lead respondió, quiere consultar
**Outcome:** consulta scheduled + pre-intake enviado al cliente
**Tiempo:** 3 min

(Continuación de F-02 paso 5-8)

---

### F-04 · Consulta sucede + decisión tomar caso

**Persona:** Vanessa o Abogada
**Trigger:** llega la hora de la consulta agendada
**Outcome:** decisión "tomamos el caso" → caso creado + contrato enviado
**Tiempo:** 30-60 min (la consulta misma) + 5 min post-consulta para crear caso

```
1. Sidebar "Consultas" → /hub/consultations
2. Kanban: ve "Sánchez · 11am · I-130 cónyuge"
3. Click → drawer con detalles + botón "Empezar consulta"
4. Click → /hub/consultations/:id → ConsultationRoom
5. Pantalla muestra:
   - Pre-intake del cliente (lo que llenó en F-11)
   - Botón "Empezar grabación Camila"
6. Camila graba + transcribe en tiempo real
7. Vanessa hace preguntas, cliente responde
8. Al final: Camila genera resumen ejecutivo automático
9. Vanessa marca decisión: ✅ Tomar / ⚠️ Pensarlo / ❌ Rechazar / ↗️ Referir
10. Si ✅ Tomar:
    - Sistema crea client_cases row automáticamente
    - Pre-fill con datos de la consulta + pre-intake
    - Genera access_token para portal del aplicante
    - (Futuro) auto-genera contrato y lo envía via GHL
11. Aterriza en /hub/cases/:caseId (Case Engine)
```

**Pantallas:** `/hub/consultations`, `/hub/consultations/:id` (ConsultationRoom)
**Datos:** consultations, intake_sessions, client_cases (crear), client_profiles (crear o update)

---

### F-05 · Caso nuevo iniciado + enviar cuestionario al cliente

**Trigger:** caso recién creado (continuación de F-04)
**Outcome:** cliente recibe link al cuestionario detallado
**Tiempo:** 2-3 min

```
1. Aterriza en /hub/cases/:caseId tab "Resumen"
2. Ve:
   - Decision Panel sidebar: "Stage: Caso iniciado · 0 días"
   - Sidebar Top 3 Tareas: vacío (caso recién creado)
   - "Tools del caso" dropdown disponible
3. Click tab "Strategic Pack" (si case_type es i-130/i-485/i-765)
4. Doc 01 "Cuestionario Cliente"
5. Click "Generar link cliente"
6. Copia URL: app.nerimmigration.com/q/{token}?pack=i130
7. Envía vía WhatsApp/SMS al cliente
8. (Cliente sigue flow F-12)
```

**Pantallas:** `/hub/cases/:caseId?tab=strategy&doc=01-cuestionario`
**Datos:** form_submissions (create draft), case_pack_state (cuando migration aplique)

---

### F-06 · Recibir docs del cliente + revisar

**Trigger:** notification "García subió 8 documentos al portal"
**Outcome:** docs revisados, evidencia organizada, evidencia faltante solicitada
**Tiempo:** 15-30 min por caso

```
1. Notification badge en sidebar "Casos"
2. Click caso → /hub/cases/:caseId tab "Documentos"
3. Ve los 8 nuevos uploads:
   - Acta matrimonio.pdf
   - Pasaporte.pdf
   - Cuenta conjunta_3meses.pdf
   - etc.
4. Por cada doc:
   - Preview inline
   - Aprobar / Solicitar mejor calidad / Marcar para traducir
5. Click "Tools del caso" (sidebar) → "USCIS Document Analyzer" (si es RFE)
6. O click tab "Strategic Pack" → Doc 03 Evidence Checklist
7. Marca check en items recibidos
8. Identifica gaps (ej: faltan tax returns 3y)
9. Click "Enviar lista al cliente" → cliente recibe link /upload/:token con items pendientes
```

**Pantallas:** `/hub/cases/:caseId?tab=documentos`, `?tab=strategy&doc=03-evidence-checklist`, `/tools/uscis-analyzer?case_id=X`
**Datos:** case_documents, evidence_items

---

### F-07 · Llenar Smart Form (I-130) + descargar PDF

**Trigger:** evidencia completa, hora de armar el packet
**Outcome:** PDF I-130 official de USCIS rellenado, listo para firmar y enviar
**Tiempo:** 20-45 min (con Felix: 10-15 min)

```
1. /hub/cases/:caseId tab "Formularios"
2. Ve forms del caso (si los hay)
3. Click "Nuevo formulario" → modal selector tipo
4. Selecciona "I-130 Petition for Alien Relative"
5. Si feature flag "felix-autofill" activo + cliente completó cuestionario:
   - Modal: "Felix puede auto-llenar 70% basado en tu cuestionario (5 créditos AI)"
   - Click "Sí, usar Felix"
   - Loading 10-15s
   - Wizard arranca con campos pre-llenados
6. Vanessa revisa cada paso (9 pasos para I-130):
   - Step 1: Relación familiar
   - Step 2: Datos peticionario
   - Step 3: Address peticionario
   - Step 4: Contacto peticionario
   - Step 5: Datos beneficiario
   - Step 6: Address beneficiario
   - Step 7: Documentos beneficiario
   - Step 8: Matrimonio/familia
   - Step 9: Preparador (G-28)
7. Auto-save cada 30s
8. Step final: "Descargar PDF USCIS"
9. PDF descargado: I-130_García_2026-05-14.pdf
10. Vanessa imprime, lo firma el peticionario, arma packet, envía a USCIS
```

**Pantallas:** `/hub/cases/:caseId?tab=formularios`, `/hub/forms/:formId` (wizard)
**Datos:** form_submissions, ai_agent_sessions (Felix), ai_credits (debit)

---

### F-08 · RFE/NOID llega → analizar + responder

**Trigger:** USCIS envía RFE por mail físico o e-noticing
**Outcome:** análisis del RFE + estrategia de respuesta + draft enviado al cliente
**Tiempo:** 45-90 min

```
1. Mr. Lorenzo / Vanessa escanea el RFE (PDF)
2. /hub/cases/:caseId tab "Documentos"
3. Upload del PDF del RFE
4. Click "Tools del caso" → "USCIS Document Analyzer"
5. Tab nueva: /tools/uscis-analyzer?case_id=X
6. Banner cyan arriba "Vinculado al caso García"
7. Upload el PDF del RFE en el analyzer
8. Loading 10-30s (Claude Vision analiza)
9. Output detallado en markdown:
   - Tipo de documento: RFE
   - Razones citadas por USCIS (1, 2, 3...)
   - Análisis punto por punto con base legal (INA, CFR)
   - Recomendación de evidencia a presentar
10. Click "Guardar al expediente"
11. Output queda en /hub/cases/:caseId sección "Outputs guardados"
12. Vuelve al case → tab "Strategic Pack" → Doc 03 Evidence Checklist
13. Marca items específicos solicitados por el RFE
14. Click "Enviar lista al cliente" → cliente recibe lista con items específicos
```

**Pantallas:** `/hub/cases/:caseId?tab=documentos`, `/tools/uscis-analyzer?case_id=X`, `?tab=strategy&doc=03-evidence-checklist`
**Datos:** case_documents (RFE upload), case_tool_outputs (analysis), evidence_items (request to client)

---

### F-09 · Caso aprobado → cerrar + cobrar siguiente paso

**Trigger:** USCIS aprueba el I-130 (e-notice)
**Outcome:** stage cambiado a APROBADO + notificar cliente + iniciar siguiente fase (I-485 o consular)
**Tiempo:** 10 min

```
1. /hub/cases/:caseId
2. Stage changer en header: cambiar de "USCIS · Petición en proceso" → "APROBADO · Caso resuelto"
3. Sistema dispara:
   - Notificación al cliente vía /case-track/:token
   - Tarea automática: "Próximo paso: ¿adjustment o consular?"
   - (Futuro) Auto-invoice del siguiente trabajo
4. Vanessa decide siguiente fase:
   - Si beneficiary en USA: tab "Strategic Pack" → cambiar a i485-pack
   - Si beneficiary outside USA: tab "Consular" (DS-260, NVC)
5. Crea nuevo Smart Form (I-485 o DS-260)
6. Workflow continúa
```

**Pantallas:** `/hub/cases/:caseId`, stage changer
**Datos:** client_cases (UPDATE process_stage), notifications, case_tasks (auto-create)

---

### F-10 · Caso entra a NVC → consular processing

**Trigger:** I-130 aprobado, beneficiary outside USA, caso passes to NVC
**Outcome:** NVC case number registrado + fees pagadas + civil docs uploaded
**Tiempo:** En la realidad 6-12 meses · en NER, gestión por etapas

```
1. /hub/cases/:caseId → stage = NVC
2. Tab "Consular" aparece automáticamente
3. Vanessa ingresa NVC case number
4. NVC tracker widget (futuro: auto-poll NVC website)
5. Checklist NVC:
   - Pay AOS fee (I-864)
   - Pay IV fee
   - Submit DS-260
   - Submit civil documents (birth cert, marriage cert, police clearance, etc.)
6. Cuando NVC dice "documentarily qualified":
   - Stage → "EMBAJADA · Entrevista consular"
7. Tab "Consular" muestra Embassy details + interview prep
```

**Pantallas:** `/hub/cases/:caseId?tab=consular`
**Datos:** client_cases (process_stage='nvc'/'embajada'), NVC tracking fields (futuro)

---

## 5. FLOWS DETALLADOS — ROL APLICANTE

### F-11 · Aplicante recibe link de pre-intake

**Persona:** Patricia, beneficiaria I-130, recién contactó la firma
**Trigger:** llega WhatsApp/email: "Hola Patricia, antes de tu consulta del jueves, completa este formulario: [link]"
**Outcome:** pre-intake completado, firma tiene contexto antes de la consulta
**Tiempo:** 10-15 min para Patricia

```
1. Patricia click link → /intake/:token
2. Ve:
   - Logo firma (genera confianza)
   - "Hola Patricia, este formulario nos ayuda a entender tu situación"
   - Toggle ES/EN
   - "Toma 10 minutos · solo tú vas a leer esto"
3. 5 secciones de preguntas:
   - Sección 1: Situación migratoria actual
   - Sección 2: Familia (esposo/a, padres, hijos)
   - Sección 3: Objetivo (qué quieres lograr)
   - Sección 4: Documentos disponibles
   - Sección 5: Notas extras
4. Submit → success screen "Nos vemos en tu consulta"
5. Sistema notifica al paralegal: "Patricia completó pre-intake"
```

**Pantallas:** `/intake/:token`, success
**Datos:** appointments.pre_intake_data (JSONB)

---

### F-12 · Aplicante completa cuestionario detallado del caso

**Trigger:** caso ya iniciado, firma envía cuestionario más profundo
**Outcome:** form_submissions del caso pre-llenado por el cliente, paralegal solo revisa
**Tiempo:** 30-60 min para Patricia

```
1. Patricia click link → /q/:token?pack=i130
2. Ve:
   - Banner branding firma
   - "Cuestionario I-130 · 35 preguntas · 30 minutos"
   - Toggle ES/EN
   - Progress bar
3. Wizard 7 secciones:
   - Datos personales (nombre, DOB, country origin)
   - Estatus migratorio (visa, I-94, entry date)
   - Datos peticionario (USC/LPR, address)
   - Matrimonio (date, place, prior marriages)
   - Hijos (nombres, DOBs)
   - Bona fide (cuenta conjunta, foto wedding, etc.)
   - Confirmación
4. Auto-save cada paso
5. Submit → success
6. (Si pack tiene Doc 03 Evidence) Lista de docs a subir aparece
7. Patricia recibe segundo link /upload/:token para subir documentos
```

**Pantallas:** `/q/:token`
**Datos:** form_submissions (form_data UPDATE)

---

### F-13 · Aplicante sube documentos solicitados

**Trigger:** paralegal envió checklist específico
**Outcome:** docs subidos con metadata (caption, fecha, contexto)
**Tiempo:** 20-40 min

```
1. Patricia click link → /upload/:token
2. Ve:
   - "Necesitamos estos documentos para tu caso:"
   - Lista solicitada por el paralegal (acta matrimonio, fotos, cuentas, etc.)
3. Por cada item:
   - Drag-drop o click upload
   - Opcional: caption ("Foto de la boda en mi casa")
   - Opcional: fecha
4. Cliente nota progreso "5 de 8 documentos subidos"
5. Submit → todos los archivos al storage
6. Sistema notifica al paralegal: "Patricia subió X documentos"
```

**Pantallas:** `/upload/:token`
**Datos:** evidence_items, Supabase Storage `evidence-files` bucket

---

### F-14 · Aplicante revisa estado del caso

**Trigger:** Patricia se acuerda preguntar "¿en qué estamos?"
**Outcome:** Patricia ve dónde está su caso sin tener que llamar
**Tiempo:** 1-2 min

```
1. Patricia click link bookmark → /case-track/:token
2. Ve:
   - Header: "Tu caso I-130 · Patricia Alvarado"
   - Pipeline visual: Lead → Consulta → ✅ Contrato → ✅ Caso iniciado → ✅ Cuestionario → ✅ Evidencia → 🔵 Packet armado → ⬜ Envío USCIS → ⬜ Receipt → ⬜ Aprobado
   - "Estás aquí: Packet armado (5 días)"
   - Próximo paso: "El abogado revisa antes de enviar"
3. Si hay tasks visibles para el cliente: "Próximas tareas tuyas: ninguna"
4. Si hay docs faltantes: "Necesitamos: tax returns 2025"
5. Botón "Mensaje a la firma" → abre WhatsApp con número de la firma
```

**Pantallas:** `/case-track/:token`
**Datos:** client_cases (status, process_stage), case_tasks (visible to client), evidence_items (pending)

---

## 6. FLOWS DETALLADOS — ROL PLATFORM ADMIN (Mr. Lorenzo)

### F-15 · Onboardear firma nueva

**Trigger:** Mr. Lorenzo vendió una firma nueva (Maya Immigration Law en Houston)
**Outcome:** Maya Law tiene su cuenta, owner puede entrar, recibe magic link
**Tiempo:** 5-10 min

```
1. /admin/firms → click "Nueva firma"
2. Modal NewFirmModal:
   - Nombre firma: "Maya Immigration Law"
   - Email owner: maya@mayalaw.com
   - Plan: Professional ($297)
   - Nombre attorney: "Maya Rodriguez"
   - Teléfono opt
3. Submit
4. Sistema:
   - Crea ner_accounts row
   - Crea auth.users + account_members
   - Asigna plan + features default + AI credits monthly
   - Envía welcome email con magic link
5. Mr. Lorenzo ve confirmación + nuevo row en /admin/firms
6. Próximo paso: Mr. Lorenzo envía a Maya manualmente el GHL location_id si aplica
```

**Pantallas:** `/admin/firms`, modal NewFirmModal
**Datos:** ner_accounts, auth.users, account_members, ai_credits, account_app_access

---

### F-16 · Revisar salud SaaS

**Trigger:** Mr. Lorenzo se sienta cada lunes a revisar
**Outcome:** sabe si alguna firma está churnneando, cuál crece más
**Tiempo:** 10-15 min

```
1. /admin/dashboard
2. Ve:
   - MRR actual ($2,376)
   - ARR proyectado
   - Distribución por plan (pie)
   - Nuevas firmas 30d
3. /admin/analytics
   - Uso de tools por firma (cuáles usan Affidavit/CSPA más)
   - AI credits consumed
   - Emails enviados
4. /admin/logs
   - Audit logs recientes
   - Errores reportados (cuando Sentry esté integrado)
5. Identifica:
   - "Mr Visa Immigration creció 30% en uso este mes"
   - "Acme Legal no entra hace 14 días" (red flag churn)
6. Action: contacta Acme Legal personally
```

**Pantallas:** `/admin/dashboard`, `/admin/analytics`, `/admin/logs`
**Datos:** múltiples cross-firmas via admin edge functions

---

### F-17 · Activar feature flag por firma (piloto)

**Trigger:** decidió piloto Strategic Packs solo con Mr Visa
**Outcome:** flag activo solo para 1 firma, otras 7 no ven nada
**Tiempo:** 2 min (cuando UI exista; hoy es SQL manual via Lovable)

```
1. /admin/features (TBD — pendiente construir)
2. Lista feature_flags (45 features)
3. Click "strategic-packs-v1"
4. Drawer/modal: lista de firmas con toggle on/off
5. Toggle ON solo Mr Visa
6. Apply → INSERT account_feature_overrides
7. Mr Visa hace hard refresh → ve packs
```

**Pantallas:** `/admin/features` (FUTURO)
**Datos:** account_feature_overrides

---

### F-18 · Soporte: impersonate firma para debugger

**Trigger:** firma reporta "no me anda algo"
**Outcome:** Mr. Lorenzo ve exactamente lo que la firma ve
**Tiempo:** 3-5 min

```
1. /admin/firms → buscar firma → click row
2. /admin/firms/:id (drill-down)
3. Botón "Entrar como firma" (icono UserCheck)
4. Sistema:
   - admin-impersonate edge function
   - sessionStorage.ner_impersonate set (expires 15min)
   - Redirect /hub
5. Banner amber arriba de Hub: "Modo Soporte: <firma> · Salir"
6. Navega el Hub como si fuera la firma
7. Identifica el bug
8. Click "Salir" → redirect /admin/firms
```

**Pantallas:** `/admin/firms`, `/admin/firms/:id`, `/hub` (modo impersonate)
**Datos:** audit_logs (admin.impersonate)

---

## 7. MATRIZ ROL × FUNCIONALIDAD

¿Qué puede hacer cada rol? Matriz cruzada:

| Funcionalidad | Abogado | Rep Acreditado | Preparador | Aplicante | Platform Admin |
|---|:--:|:--:|:--:|:--:|:--:|
| Login NER | ✅ | ✅ | ✅ | ❌ (token-only) | ✅ |
| Ver Hub Dashboard | ✅ | ✅ | ✅ | ❌ | (no aplica) |
| Crear caso | ✅ | ✅ | ✅ | ❌ | (no aplica) |
| Editar caso | ✅ | ✅ | ✅ | ❌ | (no aplica) |
| Llenar Smart Form | ✅ | ✅ | ✅ | ❌ | (no aplica) |
| Firmar G-28 (attorney section) | ✅ | ✅ | ❌ | N/A | N/A |
| Crear notas attorney_only | ✅ | ✅ | ❌ | ❌ | ❌ |
| Ver notas attorney_only | ✅ | ✅ | ❌ | ❌ | ❌ (solo si impersonate) |
| Ver notas admin_only | ✅ (si role admin) | ❌ | ❌ | ❌ | ❌ (solo si impersonate) |
| Invocar Felix/Nina/Max (AI) | ✅ | ✅ | ✅ | ❌ | (no aplica) |
| Cliente 360 (perfil completo) | ✅ | ✅ | ✅ | ❌ (solo SU perfil) | (no aplica) |
| Completar pre-intake | (no aplica) | (no aplica) | (no aplica) | ✅ | (no aplica) |
| Completar cuestionario (/q/:token) | (no aplica) | (no aplica) | (no aplica) | ✅ | (no aplica) |
| Subir documentos (/upload/:token) | (no aplica) | (no aplica) | (no aplica) | ✅ | (no aplica) |
| Ver case tracker (/case-track/:token) | (no aplica) | (no aplica) | (no aplica) | ✅ | (no aplica) |
| Cambiar plan firma | ❌ (solo owner) | ❌ | ❌ | ❌ | ✅ |
| Crear firma nueva | ❌ | ❌ | ❌ | ❌ | ✅ |
| Impersonate firma | ❌ | ❌ | ❌ | ❌ | ✅ |
| Activar feature flag | ❌ | ❌ | ❌ | ❌ | ✅ |
| Ver audit logs platform | ❌ | ❌ | ❌ | ❌ | ✅ |

**Nota:** dentro de una firma, los roles son: `owner` → `admin` → `attorney` → `paralegal/member` → `assistant` → `readonly`. Las celdas "✅" arriba asumen role = attorney o superior. Para paralegales sin attorney role, las acciones con G-28 sign están bloqueadas.

---

## 8. SLAs ESPERADOS

Cada flow tiene un tiempo objetivo. Si en producción se desvía 2x, hay bug.

| Flow | Target | Real (medido) | Status |
|---|---:|---:|:--:|
| F-01 Mañana operativa | 3-5 min | TBD | Necesita medir |
| F-02 Lead nuevo a consulta | 2-3 min | TBD | Necesita medir |
| F-04 Consulta + decisión | 30-60 min | TBD | Necesita medir |
| F-07 Llenar I-130 + PDF | 20-45 min (Felix: 10-15) | TBD | Necesita medir |
| F-08 RFE response | 45-90 min | TBD | Necesita medir |
| F-11 Pre-intake aplicante | 10-15 min | TBD | Necesita medir |
| F-13 Upload docs aplicante | 20-40 min | TBD | Necesita medir |
| F-15 Onboardear firma | 5-10 min | ~7 min ✅ | Bien |

**TODO futuro:** instrumentar tracking de tiempo en flows críticos.

---

## 9. PAIN POINTS IDENTIFICADOS (de uso real)

Basado en el audit completo:

| Pain | Flow afectado | Severidad | Fix |
|---|---|:--:|---|
| Briefing IA es genérico, no nombra clientes reales | F-01 | 🔴 ALTA | Edge function `hub-morning-briefing` debe leer casos del user |
| No hay link visible de Case Engine a Strategic Packs | F-05, F-06 | 🔴 ALTA | Migrar Packs a tab del Case Engine |
| Forms route sale del /hub a /dashboard (namespace inconsistency) | F-07 | 🟡 MEDIO | Migrar `/dashboard/smart-forms` → `/hub/forms` |
| Tools standalone duplicados en 2 rutas | Todos | 🟡 MEDIO | Consolidar a `/tools/X` solo |
| `process_stage` es text libre, casos caen en "sin clasificar" | F-09, F-10 | 🟡 MEDIO | Crear ENUM o usar trigger existente |
| Sin link directo de /case-track a contacto firma | F-14 | 🟢 BAJO | Agregar botón WhatsApp |
| Sin auto-billing al cambiar stage a "Aprobado" | F-09 | 🟡 MEDIO | GHL invisible Fase 4 |
| Sin tracker USCIS automático | F-09 | 🟡 MEDIO | Edge fn poll USCIS (futuro) |

---

## 10. SCENARIO HAPPY PATH FULL — un caso I-130 de A a Z

Para ilustrar TODO el flow integrado, acá un escenario completo:

```
DÍA 0 — Lead llega
─────────────────────
Día 0, 14:30: Patricia Alvarado (futura beneficiaria I-130) llena form de
contacto en website de "Mr Visa Immigration" → contacto crea row en GHL.
Vanessa (paralegal de Mr Visa) ve badge "1 nuevo" en sidebar Leads del Hub.

Vanessa entra a /hub/leads → click Patricia → ve detalles GHL.
Click "Agendar consulta" → modal selecciona fecha (jueves 11am) y attorney
(Anna). Submit. Sistema crea appointment + genera token pre-intake.

Sistema envía SMS a Patricia: "Hola Patricia, tu consulta el jueves a las
11am con Anna. Completa este formulario antes: [link /intake/:token]"


DÍA 1 — Pre-intake
─────────────────────
Día 1, 19:00: Patricia recibe SMS, click. Llega a /intake/:token.
Ve logo Mr Visa, toggle ES, 5 secciones. Completa en 12 minutos.
Submit. "Nos vemos jueves." 

Sistema notifica a Vanessa: "Patricia completó pre-intake."


DÍA 3 — Consulta sucede
─────────────────────
Jueves 11am. Anna abre /hub/consultations → ve "Patricia 11am en cola".
Click → ConsultationRoom abre. Anna lee pre-intake mientras Patricia se
sienta. Click "Empezar grabación Camila". 35 minutos de consulta grabada.

Camila auto-genera resumen:
"Patricia, 28 años, mexicana, casada con Carlos Alvarado (USC, 35). Entró
con visa B-2 en 2024. Match con 245(c) bar discutido. Carlos puede peticionar
I-130 + filing concurrente I-485 (visa current IR1). Bona fide solid: misma
dirección, cuenta conjunta, fotos timeline 2 años."

Anna marca decisión: ✅ Tomar caso. Sistema crea client_cases row tipo i-130.
Aterriza en /hub/cases/:caseId. Stage = "Caso iniciado".


DÍA 3 — Caso iniciado
─────────────────────
Anna click tab "Strategic Pack" (apareció porque case_type=i-130).
Doc 01 "Cuestionario Cliente" → genera link cuestionario detallado.
Envía SMS: "Patricia, completa este cuestionario: [link /q/:token?pack=i130]"


DÍA 5 — Patricia completa cuestionario
─────────────────────
Patricia llena 35 preguntas en 45 min. Auto-save cada paso. Submit.
Sistema notifica a Vanessa: "Patricia completó cuestionario."

Vanessa entra al case → tab "Formularios" → ve el form_submission draft
pre-llenado con datos del cuestionario. 70% de los campos del I-130 ya
están llenos.


DÍA 7 — Vanessa solicita evidencia faltante
─────────────────────
Vanessa click tab "Strategic Pack" → Doc 03 Evidence Checklist.
Marca como recibidos: pasaporte, marriage cert, divorces previos.
Marca como faltantes: 3 años tax returns conjuntos, fotos timeline, 5 cartas
de amigos (Matter of Patel format).
Click "Enviar lista al cliente" → checkbox-select + batch send.
Patricia recibe email + SMS con lista específica.


DÍA 10-15 — Patricia sube documentos
─────────────────────
Patricia entra a /upload/:token. Ve checklist. Sube docs uno por uno.
Camila notifica a Vanessa cada upload. Patricia sube todo en 3 sesiones.


DÍA 16 — Vanessa arma packet
─────────────────────
Vanessa entra al case → tab "Documentos" → revisa todos los uploads.
Click "Tools del caso" → "Photo Evidence Organizer" → abre nueva tab con
?case_id=X. Sube fotos timeline. Organiza cronológicamente. Genera PDF.
Click "Guardar al expediente". PDF queda en Outputs del case.

Click tab "Strategic Pack" → Doc 04 Packet Preparation.
Checklist: cover letter ✓, I-130 firmado ✓, I-130A ✓, evidencia organizada ✓,
fotos PDF ✓, tax transcripts ✓, G-1450 (no money order) ✓.
Click "Continuar al I-130 Wizard".


DÍA 16 — Vanessa llena el Smart Form I-130
─────────────────────
Tab "Formularios" → click form existente (pre-llenado por Felix).
Wizard 9 pasos. Vanessa revisa cada paso (Felix puso 80%, ella ajusta 20%).
Step 9 → "Descargar PDF USCIS". Bajado el I-130_Alvarado_2026-05-30.pdf.


DÍA 17 — Anna review + sign
─────────────────────
Anna (attorney) entra al case. Tab Documentos → ve PDF del I-130.
Imprime, lo firma como preparer + atorney (G-28 incluido).
Carlos (peticionario) firma también (presencial).
Anna manualmente arma el packet físico y envía a USCIS Chicago Lockbox.

Vanessa cambia stage en Case Engine: "Envío USCIS · esperando receipt".


DÍA 30 — USCIS receipt
─────────────────────
Llega I-797C de USCIS con receipt number. Vanessa lo registra en el caso.
(Futuro: USCIS tracker auto-polls y avisa).
Stage: "USCIS · Petición en proceso".


DÍA 45 — Biometrics scheduled
─────────────────────
Patricia recibe biometrics notice. Vanessa lo registra.
Camila genera task automática: "Patricia biometrics 2026-07-15".


DÍA 75 — RFE llega (este es F-08 happy path)
─────────────────────
USCIS envía RFE pidiendo más bona fide evidence. Anna lo escanea.
Tab Documentos → upload. Click Tools → USCIS Analyzer.
Análisis: "USCIS pide más fotos cronológicas + 2 cartas adicionales tipo
Matter of Patel + tax return 2024."

Vanessa contacta Patricia. Solicita evidence specific. Patricia sube en /upload.
Vanessa actualiza packet response. Anna firma. Envío a USCIS.
Stage: "USCIS · Respuesta a RFE enviada".


DÍA 120 — APROBADO
─────────────────────
USCIS aprueba el I-130. Anna actualiza stage: "APROBADO · Caso resuelto".
Sistema notifica a Patricia vía /case-track. Patricia ve "✅ Aprobado".
Sistema crea task automática: "Próximo paso: I-485 (Patricia ya en USA)".
Anna decide: filing concurrente NO posible (ya pasó), filing standalone I-485.
Crea sub-caso o continúa en el mismo case con case_type='i-485'.
Tab "Strategic Pack" cambia a i485-pack.

Flow continúa...
```

**Duración real:** 4-12 meses (USCIS times varían)
**Touches en NER:** 30-50 interactions cross-días
**Outcome:** I-130 approved, base para greencard
**Valor por la firma:** $5,000-15,000 honorarios (variable por mercado)
**Costo NER a la firma:** $297/mes = $1,188 en 4 meses · ROI obvio

---

## 11. PRINCIPIOS DE UX EXTRAÍDOS

De estos 18 flows, los principios que aplican a TODO el producto:

1. **Un solo entry point por caso.** El paralegal NUNCA sale del Case Engine para hacer trabajo del caso.

2. **Briefing personalizado, no genérico.** El Hub Dashboard debe mostrar nombres reales, no contadores abstractos.

3. **Auto-detección de stage.** Cuando un caso pasa a NVC/Embajada/Court, los tabs aparecen automáticamente. El paralegal NO configura nada.

4. **Cliente cómodo, profesional poderoso.** Cliente ve UI simple bilingual. Profesional ve UI rica con shortcuts.

5. **Tools standalone con opción de save-to-case.** Pattern additive ya implementado. Mantener.

6. **Camila siempre disponible.** Voice/chat accessible en cualquier momento.

7. **Felix para velocidad, no para reemplazar juicio.** AI llena 70%, profesional revisa el 30% crítico.

8. **Mobile-first para aplicante, desktop-first para profesional.** Patricia usa WhatsApp. Vanessa usa monitor 27".

9. **Notificaciones contextuales, no spam.** Briefing del día > 5 notificaciones push.

10. **Privacy by default.** Visibility 'team' por default, escalar a attorney_only/admin_only solo cuando necesario.

---

**Documento entregado: 2026-05-14**
**Próximo: WIREFRAMES.md (estructura visual de cada pantalla)**
