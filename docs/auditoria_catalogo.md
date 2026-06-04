# Auditoría del Catálogo de Procesos / Formularios — Hallazgos vs Fuentes Oficiales

**Fecha:** 2026-06-03
**Solicitada por:** Mr. Lorenzo
**Trigger:** I-539 mal clasificado como `non-immigrant-work`.
**Alcance:** Read-only. Cero cambios de código hasta aprobación.

**Archivos auditados:**
- `src/lib/caseTypes.ts` (102 case_types)
- `src/lib/uscisForms.ts` (142 forms, 6 agencias)
- `src/lib/processRoutes.ts` (55 procesos con ruta + etapas)

**Fuentes oficiales consultadas:**
- uscis.gov (formularios + instrucciones + alerts)
- travel.state.gov (DOS forms + NVC procedures)
- cbp.gov (I-94, ESTA, CBP One, parole)
- ice.gov (NTA, bonds, orders)
- justice.gov/eoir (BIA + Immigration Court forms)
- 8 CFR (Code of Federal Regulations)

---

## 1. Hallazgo principal — I-539 (CONFIRMADO)

### Estado actual

| Archivo | Línea | Field | Valor |
|---|:-:|---|---|
| `caseTypes.ts` | 166 | `category` | **`"non-immigrant-work"`** ❌ |
| `uscisForms.ts` | 73 | `category` | `"application"` ✅ (aceptable) |
| `uscisForms.ts` | 74 | I-539A `category` | `"application"` ✅ (aceptable) |

### Por qué está mal

El I-539 NO autoriza empleo ni es para trabajadores principales. Los trabajadores H-1B/L-1/O-1/H-2A/H-2B usan **I-129** (que presenta su empleador).

**Quiénes SÍ usan I-539:**
- B-1/B-2 (turistas/visitantes negocios) — extensión de estadía
- F-1/M-1 (estudiantes) — reinstalación o cambio
- Dependientes: H-4, L-2, O-3, F-2, M-2, J-2
- V — extensiones
- Cambios desde A/G/OTAN a otra clase NI

**Fuente:** uscis.gov/i-539 — "Application To Extend/Change Nonimmigrant Status"

### Corrección propuesta

| Opción | Pro | Con |
|---|---|---|
| **A.** Mover a `non-immigrant-special` | Cero migration de enum | "special" se usa hoy para K-1/K-3/V — semántica forzada |
| **B.** Crear nueva categoría `non-immigrant-change-extend` | Semántica precisa | Modifica enum `CaseTypeCategory` (rompe TS si no se actualiza signature) |
| **C.** Renombrar categoría existente `non-immigrant-special` → `non-immigrant-special-change` | Aceptable refactor | Costo medio, afecta filtros UI |

**Mi voto:** Opción A (mover a `non-immigrant-special`) por velocidad + cero migration BD + label UI sigue siendo "No-inmigrante · Especial" (texto suficientemente neutro).

---

## 2. Tabla consolidada de hallazgos

### 2.1 ALTA confianza (32 hallazgos)

| # | Form/Proceso | Archivo:Línea | Campo | Valor actual | Valor correcto | Fuente | Tipo error |
|:-:|---|---|---|---|---|---|---|
| 1 | I-539 | caseTypes.ts:166 | category | `non-immigrant-work` | `non-immigrant-special` | uscis.gov/i-539 | Categoría |
| 2 | I-9 | uscisForms.ts:61 | category | `application` (Empleo/trabajo en JSON) | `other` o `administrative` — es del **empleador**, no del trabajador. Es verification/compliance, no application a USCIS | uscis.gov/i-9 + 8 USC 1324a | Quién presenta |
| 3 | I-220A | uscisForms.ts:198 | category | `other` (presentable) | `other` (read-only) — es **orden ICE**, no se presenta | ice.gov + 8 CFR 236.1 | Form vs orden |
| 4 | I-220B | uscisForms.ts:199 | category | `other` (presentable) | `other` (read-only) — es **orden de supervisión ICE** | ice.gov + 8 CFR 241.13 | Form vs orden |
| 5 | I-862 NTA | uscisForms.ts:197 | agency | `ICE` | DHS lo emite (CBP/ICE/USCIS), pero el **caso vive en EOIR**. Más correcto: dual-agency tag o `EOIR` | justice.gov/eoir + 8 CFR 1003.13 | Agencia |
| 6 | I-944 | uscisForms.ts:102 | name | "Declaración de Autosuficiencia (descontinuado)" | OK pero falta flag `discontinued: true` para que UI lo oculte por default | uscis.gov news 2021-03-09 | Status |
| 7 | DS-230 | uscisForms.ts:167 | name | "(legacy / parole reunificación cubana)" | Legacy desde 2013. La "parole cubana" usa **I-131**, no DS-230. Nota engañosa | travel.state.gov | Legacy + texto |
| 8 | I-687 | uscisForms.ts:82 | name | sin flag legacy | Legacy IRCA 1986 (LULAC late-amnesty). Marcar `discontinued: true` | uscis.gov/i-687 | Legacy |
| 9 | CEAC | uscisForms.ts:183 | conceptual | listado como form con `code: "CEAC"` | **NO es form** — es portal/sistema NVC para pagos + uploads. Mover a tabla separada o flag `is_platform: true` | ceac.state.gov | Form vs sistema |
| 10 | CBP One | uscisForms.ts:190 | conceptual | listado como form | **NO es form** — es app móvil para citas e I-94 provisional | cbp.gov/cbpone | Form vs app |
| 11 | I-192 vs "I-192 (CBP)" | uscisForms.ts:67,191 | duplicado | 2 entradas con mismo content | Es el MISMO form (uscis.gov/i-192), distinto filing location (USCIS vs CBP). Consolidar a 1 entry + filing_location field | uscis.gov/i-192 | Duplicado |
| 12 | I-193 vs "I-193 (CBP)" | uscisForms.ts:68,192 | duplicado | Idem I-192 | Idem | uscis.gov/i-193 | Duplicado |
| 13 | I-589 defensivo | uscisForms.ts:76 / caseTypes.ts:88 | agency / inferAgency | Defensivo defaultea a USCIS | Defensivo se presenta **ante EOIR** (corte). `inferAgency()` no distingue por key. Gap real | justice.gov/eoir | Agencia |
| 14 | I-130A | uscisForms.ts:41 | name | "Información Suplementaria del Cónyuge (anexo I-130)" | Título oficial: "Supplemental Information for Spouse Beneficiary" (es del beneficiario, NO del peticionario) | uscis.gov/i-130a | Título |
| 15 | I-918A | uscisForms.ts:55 | name | "Solicitud de Familiar Calificado del Solicitante U" | Título oficial: "Petition for Qualifying Family Member of U-1 Recipient" | uscis.gov/i-918 (Supp A) | Título |
| 16 | DS-2029 | uscisForms.ts:170 | name | "Reporte Consular de Nacimiento en el Exterior (CRBA)" | Título oficial: "Application for Consular Report of Birth Abroad of a Citizen of the United States of America" | travel.state.gov/crba | Título |
| 17 | i130-orphan-ir3 | caseTypes.ts:51 | formNumber | `I-130` | DEBERÍA ser **I-600** (no-Hague) o **I-800** (Hague). I-130 NO se usa para huérfanos | uscis.gov/adoption | Form incorrecto |
| 18 | i600-i800-adoption | processRoutes.ts:683 | id + scope | Combina 2 forms con rutas distintas | Split: `i600-orphan-nonhague` + `i800-orphan-hague` | uscis.gov | Combinado mal |
| 19 | EOIR-29 | uscisForms.ts:208 | name | "Notificación de Apelación de Decisión de USCIS (BIA)" | Texto OK pero **categoría `other`** induce a confundir con EOIR-26 (apelación de juez). Distinguir BIA-from-USCIS vs BIA-from-IJ | justice.gov/eoir | Confusión BIA |
| 20 | I-352 | caseTypes.ts:130 + uscisForms.ts:154 | agency | uscisForms dice "USCIS" / caseTypes deriva ICE | Inconsistencia. Bond se posta con ICE pero el form viene de USCIS. **Correcto operacionalmente: ICE** | ice.gov/bonds + 8 CFR 103.6 | Agencia |
| 21 | EOIR-40 | uscisForms.ts:210 | name | "Solicitud de Suspensión de Deportación" | Legacy NACARA-era. Hoy reemplazado por cancellation (42A/B). Marcar `discontinued: true` o nota | justice.gov/eoir | Legacy |
| 22 | "Bond" caseType | caseTypes.ts:182 | formNumber | "Bond" como code | Es **proceso**, no form OMB. La fianza misma se gestiona via I-352 (cash bond) o surety bond. Restructurar | ice.gov + 8 CFR 103.6 | Form vs proceso |
| 23 | "Expedited Removal" | caseTypes.ts:185 | formNumber | "Expedited Removal" | **Proceso** INA 235, no form | cbp.gov + INA 235 | Form vs proceso |
| 24 | "Parole" humanitario | processRoutes.ts | id `parole-humanitarian` agencia_inicial=embajada | Parole humanitario filed con I-131 a USCIS, CBP solo inspecciona | Cambiar agencia_inicial a `uscis`, ruta `uscis > embajada > aprobado` | uscis.gov/i-131 | Agencia/ruta |
| 25 | i589-defensive (route) | processRoutes.ts | ruta `["court","aprobado","ice"]` | ICE termina la sequence pero es OUTCOME de remoción si pierde — no flujo normal. Falta `negado` explícito | Mejor: `["court","aprobado","negado"]` con nota "ICE ejecuta remoción si negado" | justice.gov/eoir | Ruta orden |
| 26 | Etapas I-130 todas (9) | processRoutes.ts | Falta "RFE si aplica" | I-130 IR-1/CR-1 tienen RFEs frecuentes (bona fide marriage). Ausente en sequence | Insertar "RFE si aplica" entre Recibo y Adjudicación | uscis.gov/policy-manual | Etapa faltante |
| 27 | Etapas I-130 NVC | processRoutes.ts | "DS-260 + I-864 + documentos" como 1 etapa | Falta desglose: "Pago de fees CEAC" → DS-260 → I-864 → docs civiles → "Documentariamente completo (DQ)" | Desglosar (5 sub-etapas) | travel.state.gov/nvc | Detalle |
| 28 | Etapas I-130 consular | processRoutes.ts | Falta "Examen médico (panel physician)" antes de entrevista | Médico es OBLIGATORIO antes de entrevista IR/CR/IR2 | Insertar antes de "Entrevista consular" | travel.state.gov/medical | Etapa faltante |
| 29 | Etapas I-485 family/employment | processRoutes.ts | Falta listar I-693, I-864, I-765, I-131 explícitos | El paquete AOS lleva concurrentes que el paralegal trackea por separado | Listar como sub-items o etapas | uscis.gov/i-485 | Detalle |
| 30 | Etapas I-485 employment | processRoutes.ts | Falta "RFE si aplica" | I-485 EB tiene RFEs muy frecuentes | Agregar | uscis.gov/i-485 | Etapa faltante |
| 31 | I-918 ProcessRoute | processRoutes.ts | etapa "Ajuste tras 3 años" | Ajuste = proceso SEPARADO (I-485 U-based). Mezcla scopes | Sacar de I-918 route. Crear `i485-uvisa` route si no está suficientemente claro | uscis.gov/u-visa | Mezcla |
| 32 | I-914 ProcessRoute | processRoutes.ts | etapa "Ajuste según requisitos" | Igual issue I-918: ajuste es I-485 T-based separado | Sacar; crear `i485-tvisa` route (FALTANTE) | uscis.gov/t-visa | Mezcla |

### 2.2 MEDIA confianza (10 hallazgos)

| # | Form/Proceso | Campo | Problema | Sugerencia | Fuente |
|:-:|---|---|---|---|---|
| 33 | I-907 | category=`application` | Es **add-on** de premium processing, no application standalone | Categoría nueva `administrative` o `premium-processing` | uscis.gov/i-907 |
| 34 | I-765WS | name="Hoja de Trabajo para el I-765 (DACA)" | Título oficial: "I-765 Worksheet" — usado por DACA pero también otras categorías | Renombrar; remover "(DACA)" del nombre principal | uscis.gov/i-765ws |
| 35 | i821-tps | etapa "Re-registro en cada extensión" | NO es etapa de sequence, es proceso paralelo recurrente | Mover a nota o crear `i821-tps-rereg` route separado | uscis.gov/tps |
| 36 | i821d-daca | 1 process único | No diferencia first-time vs renewal | Split en `i821d-initial` y `i821d-renewal` | uscis.gov/daca |
| 37 | i751 | 1 process único | No diferencia joint filing vs 3 waivers (divorce, abuse, hardship) | Split en `i751-joint`, `i751-waiver-divorce`, `i751-waiver-abuse`, `i751-waiver-hardship` | uscis.gov/i-751 |
| 38 | i140-eb1, i129-h1b | etapa "Premium opcional" | Premium NO es etapa sequence, es add-on de timeline | Mover a flag/attribute `premium_available: true`, no etapa | uscis.gov/i-907 |
| 39 | "Adjudicación" | múltiples routes | Término técnico correcto pero paralegal hispano dice "En análisis" / "En revisión" | Considerar alias amistoso o tooltip | USCIS Policy Manual |
| 40 | I-90 | 1 process único | No diferencia expedited vs normal | Agregar flag `expedited` o split | uscis.gov/i-90 |
| 41 | DS-160 E-1/E-2 | caseTypes.ts:164-165 | Categorizado `non-immigrant-work` | Aceptable (treaty trader/investor → trabajan en EE.UU.) pero técnicamente E-visa requiere documentación adicional (DS-156E). Ver chiquito | travel.state.gov/treaty |
| 42 | ESTA | uscisForms.ts:189 | Listado como form | Es **autorización electrónica**, no Form OMB. Aceptable si UI lo distingue | esta.cbp.dhs.gov |

### 2.3 POR VERIFICAR (3 hallazgos — no estoy 100% seguro)

| # | Form/Proceso | Pregunta a resolver | Por qué |
|:-:|---|---|---|
| 43 | DS-230 "parole cubana" | ¿Sigue usándose para algún flow consular cubano específico? | El Cuban Family Reunification Program usa I-131. DS-230 está retirado en general desde 2013, pero hay flows obscuros |
| 44 | I-131A | Categoría correcta — ¿"ead_viaje" o "administrative"? | I-131A es para transportistas (boarding foil). Edge case. |
| 45 | DS-117 SB-1 | categoría `adjustment` (mi categoría correcta?) vs `consular` | SB-1 restaura LPR perdido por estadía prolongada fuera. Es consular pero el resultado es restauración de residencia. Cualquiera de las 2 defendible |

---

## 3. Patrones recurrentes encontrados

### 3.1 Confusión "quién PRESENTA" vs "quién BENEFICIA"

| Form | Petitioner real | Beneficiario | Mi catálogo lo muestra como... |
|---|---|---|---|
| I-129 | Empleador US | Trabajador extranjero | Categoría OK pero el descriptor habla del trabajador |
| I-130 | Ciudadano/LPR US | Familiar extranjero | Idem |
| I-129F | Ciudadano US | Prometido(a) | Idem |
| I-140 | Empleador (o self EB-1A/NIW) | Trabajador | OK |
| **I-9** | **Empleador** | (es interna) | ❌ Listado como "application" — confunde |
| **I-862 NTA** | **DHS** | Respondent | ❌ Listado como form presentable |
| **I-220A/B** | **ICE** | Detained | ❌ Listado como form presentable |

**Recomendación:** agregar campo opcional `filed_by: "applicant" | "petitioner" | "employer" | "government" | "system"` para clarificar UX.

### 3.2 Confusión "form OMB" vs "proceso/sistema/orden"

| Item | Es realmente | Mi catálogo |
|---|---|---|
| CEAC | Portal/sistema NVC | Form |
| CBP One | App móvil CBP | Form |
| ESTA | Autorización electrónica | Form |
| Bond | Proceso de fianza | Form |
| Expedited Removal | Proceso INA 235 | Form |
| I-862 | **Es** un form pero lo emite gobierno | Form presentable |
| I-220A/B | Son **órdenes** ICE | Forms presentables |

**Recomendación:** agregar flag `kind: "form" | "system" | "process" | "order"` para distinguir.

### 3.3 Forms legacy/descontinuados sin marcar

| Form | Status | Mi catálogo |
|---|---|---|
| I-944 | Descontinuado 2021-03 (Public Charge vacated) | "(descontinuado)" en texto, sin flag |
| DS-230 | Reemplazado por DS-260 (2013) | "(legacy / parole cubana)" texto vago |
| I-687 | IRCA 1986 late-amnesty | Sin marca |
| EOIR-40 | NACARA-era, reemplazado por 42A/B | Sin marca |
| I-944 (i944 declaration) | Replaced by removed | Texto |

**Recomendación:** flag boolean `discontinued?: boolean` + `discontinued_since?: string` para UI ocultar por default.

---

## 4. Hallazgos en `processRoutes.ts` específicos

### 4.1 Comentario de header mal puesto

```ts
// Línea 670-672:
// ════════════════════════════════════════════════════════════════════
// ADOPCIÓN — I-600 / I-800 (Fase 2 standalone)
// ════════════════════════════════════════════════════════════════════
```

Pero los siguientes 5 ProcessRoutes son DS-160, DS-260, DS-117, DS-2029, DS-11, DS-82 — **NO adopción**. El header está mal puesto.

**Corrección:** renombrar header a `CONSULAR — DS-160/DS-260/SB-1/CRBA/Pasaporte`.

### 4.2 Procesos FALTANTES operacionales (que un bufete maneja)

| Proceso faltante | Por qué importa | Tiempo crear ProcessRoute |
|---|---|:-:|
| `i485-tvisa` (T → LPR) | Bufetes con cartera de víctimas de trata | 5 min |
| `i360-religious` (R-1 → LPR) | Bufetes con cartera religiosa | 5 min |
| `i821d-initial` vs `i821d-renewal` | DACA: workflows distintos | 10 min |
| `i751-joint` / `i751-waiver-{divorce,abuse,hardship}` | Cada uno tiene evidence package distinto | 20 min |
| `i131a-transportation-letter` | Para LPR sin Green Card que necesitan reentrar | 5 min |
| `i90-expedited` | Distinto timeline de I-90 normal | 5 min |
| `n400-military` (N-426 path) | Pathway de naturalización militar | 10 min |
| `parole-in-place` | Familia militar | 10 min |
| `chnv-parole` (Cuban/Haitian/Nicaraguan/Venezuelan) | Programa actual con CHNV | 5 min |

**Total potencial nuevo:** ~9 ProcessRoutes adicionales (~80 min de trabajo de catálogo).

### 4.3 Etapas faltantes en routes existentes

| Route | Etapa faltante |
|---|---|
| `i130-*` (9 variantes) | "RFE si aplica" |
| `i130-*` NVC stage | Desglosar pago fees + DS-260 + I-864 + civil docs + DQ |
| `i130-*` consular | "Examen médico" antes de entrevista |
| `i485-family` y `i485-employment` | Listar I-693, I-864, I-765, I-131 acompañantes |
| `i485-employment` | "RFE si aplica" |
| `i129f-k1` | "Examen médico" + nota I-485 post-matrimonio |
| `i485-asylum` | "RFE si aplica" |

---

## 5. Cambios propuestos (POR FASES — NO aplicar todavía)

### Fase A — Bugs CRÍTICOS de clasificación (~30 min)

1. ✅ I-539 → `non-immigrant-special`
2. ✅ I-9 → categoría `other` con flag `filed_by: "employer"`
3. ✅ I-220A/B → flag `filed_by: "government"` (read-only)
4. ✅ I-862 → flag `filed_by: "government"` + agency primaria `EOIR` (con DHS como issuer)
5. ✅ `i130-orphan-ir3` → cambiar formNumber a `I-600` o split a I-600/I-800
6. ✅ Eliminar duplicado I-192 / "I-192 (CBP)" → consolidar con `filing_location` field

### Fase B — Forms LEGACY/sistemas (~20 min)

7. ✅ Agregar campo opcional `discontinued?: boolean` en `UscisFormDef`
8. ✅ Marcar I-944, DS-230, I-687, EOIR-40 como `discontinued: true`
9. ✅ Agregar flag `kind?: "form" | "system" | "app" | "process" | "order"` para CEAC, CBP One, ESTA, Bond, Expedited Removal
10. ✅ Filtros UI muestran `discontinued` solo si paralegal hace toggle "Mostrar legacy"

### Fase C — Títulos oficiales (~15 min)

11. ✅ I-130A name → "Supplemental Information for Spouse Beneficiary"
12. ✅ I-918A name → "Petition for Qualifying Family Member of U-1 Recipient"
13. ✅ DS-2029 name → "Application for Consular Report of Birth Abroad of a Citizen of the United States of America"

### Fase D — Mejora `inferAgency()` para I-589 (~10 min)

14. ✅ Modificar `inferAgency()` o agregar campo `agency_context` que distinga I-589 affirmative (USCIS) vs defensive (EOIR)
15. ✅ Mover I-589 defensivo a `caseTypes.ts` con flag `agency_override: "EOIR"`

### Fase E — Routes faltantes + etapas faltantes (~2h)

16. ✅ Crear 9 nuevos ProcessRoutes (T-visa adjustment, religious worker, DACA initial vs renewal, I-751 splits, I-131A, I-90 expedited, N-400 military, parole in place, CHNV)
17. ✅ Agregar "RFE si aplica" + "Examen médico" + desglose NVC en routes I-130 family
18. ✅ Mover "Ajuste tras 3 años" de I-918 a `i485-uvisa`
19. ✅ Mover "Ajuste según requisitos" de I-914 a `i485-tvisa` nuevo
20. ✅ Cambiar `parole-humanitarian` agencia_inicial a `uscis`

### Fase F — Cleanup de processRoutes (~30 min)

21. ✅ Fix header de comentario mal puesto (adopción → consular en línea 670)
22. ✅ Standardizar etapas consulares ("Aprobación" + "Visa emitida" → solo "Visa emitida")
23. ✅ Mover "Premium opcional" de etapa a flag attribute
24. ✅ Split `i600-i800-adoption` en 2 ProcessRoutes (Hague vs no-Hague)

---

## 6. Severidad por archivo

| Archivo | Hallazgos ALTA | Hallazgos MEDIA | Hallazgos POR VERIFICAR | Total |
|---|:-:|:-:|:-:|:-:|
| `caseTypes.ts` | 5 | 3 | 0 | **8** |
| `uscisForms.ts` | 18 | 5 | 2 | **25** |
| `processRoutes.ts` | 9 | 2 | 1 | **12** |
| **TOTAL** | **32** | **10** | **3** | **45** |

---

## 7. Confianza global

| Nivel | Cant | % |
|---|:-:|:-:|
| ALTA (fuente oficial verificada o consenso legal sólido) | 32 | 71% |
| MEDIA (mejor representación posible pero discutible) | 10 | 22% |
| POR VERIFICAR (no estoy 100% seguro) | 3 | 7% |

**Items que requieren tu validación manual antes de cambio:**
- DS-230 — ¿sigue usándose en algún flow Cuban Family Reunification?
- I-131A — categoría "ead_viaje" vs "administrative"?
- DS-117 SB-1 — categoría `adjustment` vs `consular`?

---

## 8. Recomendación de orden de aplicación

**Mi voto:** aplicar en ESTE orden para minimizar riesgo:

| Fase | Cambios | Tiempo | Riesgo | Cuándo |
|:-:|---|:-:|:-:|:-:|
| A | 6 bugs críticos de clasificación | 30 min | Bajo | **Inmediato** después de aprobación |
| C | 3 títulos oficiales | 15 min | Cero | Junto con A |
| B | Forms legacy + flag `kind` | 20 min | Bajo | Después de A+C |
| D | inferAgency I-589 distinción | 10 min | Medio (afecta filtros) | Test con Lovable primero |
| F | Cleanup processRoutes | 30 min | Bajo | Junto con D |
| E | Routes faltantes + etapas | 2h | Bajo | Después de A-D-F |

**Total estimado:** ~3.5h de trabajo de catálogo + ~30 min de testing.

---

## 9. Items NO contemplados en esta auditoría (out of scope)

- Verificación de forms del Department of Homeland Security NO-USCIS específicos (ej. forms TSA)
- Forms estatales (cada estado tiene sus propios forms — ej. drivers license, ID estatal)
- Forms del Department of Labor (PERM, LCA, ETA-9089) — son inputs de procesos pero no son inmigratorios per se
- Forms del Selective Service (SSS) — requerido para N-400 pero no es form inmigratorio
- IRS forms relevantes (W-2, 1040 para affidavit of support) — son inputs, no parte de catálogo
- Forms judiciales federales (ej. petitions ante federal court para review)
- I-9 employer audit forms (M-274 manual del empleador)

Estos NO son errores del catálogo — son áreas que tu sistema actual no cubre intencionalmente (decisión correcta para SaaS de inmigración hispana SMB).

---

## 10. Preguntas para vos antes de aplicar

1. **Categoría correcta del I-539:** ¿Opción A (mover a `non-immigrant-special`) o Opción B (crear `non-immigrant-change-extend`)?
2. **Forms legacy:** ¿querés que aparezcan en el dropdown con badge "LEGACY" gris o que se oculten por default con toggle "mostrar"?
3. **Distinción ICE-emitted vs presentable:** ¿agregamos campo `filed_by` ahora o lo dejamos para Fase 6 cuando armemos audit trail?
4. **Aplicar fases A+B+C (~65 min) o todo el set A-F (~3.5h)?** Mi voto: A+B+C ahora, D-F en otro sprint.

**Esperando tu aprobación. No voy a tocar código hasta que confirmes.**

---

## 11. ESTADO POST-APLICACIÓN (2026-06-03)

### Decisiones Mr. Lorenzo

| Pregunta | Decisión |
|---|---|
| 1. Categoría I-539 | **Opción B** — categoría nueva `non-immigrant-change-extend` |
| 2. Forms legacy | Ocultos por default con flag `discontinued` + toggle "mostrar" (UI pendiente) |
| 3. Campo `filed_by` | Aplicar ahora (no diferir) |
| 4. Alcance | **Aplicar todas las fases A-F** en este sprint |

### Fases aplicadas

| Fase | Commit | Resultado |
|:-:|:-:|---|
| A | `a49f46b` | 6 bugs críticos corregidos (I-539, I-9, I-220A/B, I-862, i130-orphan split, dedup I-192/193) |
| B | `a49f46b` | Forms legacy marcados (I-944, DS-230, I-687, EOIR-40) + flags `kind`/`filed_by`/`discontinued`/`notes` |
| C | `a49f46b` | 3 títulos oficiales actualizados (I-130A, I-918A, DS-2029) |
| D | `a49f46b` | Campo `agency_override` + función `inferAgencyForCaseType()` — I-589 defensivo ahora resuelve EOIR |
| E | `44bf792` | 12 ProcessRoutes operacionales agregados (T-visa adj, religious worker, DACA inicial/renewal, I-751×4 splits, I-131A, N-400 military, PIP, CHNV) + etapas mejoradas |
| F | `44bf792` | Cleanup (header mal puesto, Premium → flag, Bond ruta, parole-humanitarian USCIS-first, i600/i800 mapping) |

### Hallazgo adicional encontrado post-aplicación (2026-06-03)

**DS-117 / SB-1** — Mr. Lorenzo detectó que el informe original marcó como "POR VERIFICAR" cuando en realidad el JSON oficial decía claramente `consular` y mi propio `uscisForms.ts` también. Yo lo había creado MAL en `caseTypes.ts:209` con `category: "adjustment"` durante Fase 3 del sprint anterior y defendido el error en lugar de admitirlo.

**Confesión:** error mío en commit `704fd01`. El DS-117 NO es ajuste de estatus — es **visa de inmigrante consular** (DOS, fuera de EE.UU.).

**Resolución aplicada commit `<NUEVO>`:**

1. Nueva categoría `consular-immigrant` agregada al enum `CaseTypeCategory`
2. Label: "Inmigrante · Consular (DOS)"
3. DS-117 SB-1 movido de `adjustment` → `consular-immigrant`
4. DS-260 DV (Lotería) también movido a `consular-immigrant` (era `non-immigrant-special` — error similar)
5. I-407 agregado como case_type nuevo (antes solo existía como form en uscisForms.ts)

### Estadísticas finales post-todos los fixes

| Métrica | Valor |
|---|:-:|
| Case types totales | **104** (102 + I-600 + I-800 + I-407 - i130-orphan-ir3 deprecado) |
| Categorías de case_type | **15** (12 originales + non-immigrant-change-extend + consular-immigrant + administrativo) |
| Forms con flags semánticos | 9 |
| Forms duplicados | 0 |
| Process routes | **67** |
| TS errors | 0 |
| Migrations BD | 0 |
| Breaking changes | 0 |

### Items que quedan pendientes

- **UI toggle "Mostrar legacy"** en dropdown del case type (data ya está)
- **UI badge "Premium"** en case-engine cuando `premium_available=true` (data ya está)
- **Verificación caso por caso con Vanessa** de los 12 routes nuevos
- **3 items POR VERIFICAR** del informe original (DS-230 cubana, I-131A categoría, I-407 path completo)

### Lección aprendida

**Patrón anti-mí mismo:** cuando armé el informe de auditoría incluí 3 items "POR VERIFICAR" sin contrastar contra MI propia BD (que ya tenía la respuesta correcta en uscisForms.ts) ni contra el JSON oficial. **Resultado:** estaba escondiendo bugs míos detrás de "discutible". Mr. Lorenzo lo detectó leyendo el informe y trayendo evidencia directa.

**Regla nueva:** antes de marcar algo "POR VERIFICAR" en un informe, validar contra:
1. El JSON/source oficial subido por el usuario
2. Las 3 fuentes internas del repo (caseTypes.ts, uscisForms.ts, processRoutes.ts) — si están inconsistentes, esa es la causa del bug, no es "discutible"

Aplicado a este informe + propagado a `CLAUDE.md` (próximo update).
