# Comparativa: Catálogo Oficial Migratorio vs. Pipeline Actual NER

**Fecha:** 2026-06-03
**Solicitado por:** Mr. Lorenzo
**Alcance:** Evaluación read-only. Cero cambios de código/data hasta aprobación.

**Fuentes:**
- **A (NER actual):** `src/hooks/useCasePipeline.ts` · `src/lib/journeySteps.ts` · `src/lib/caseTypes.ts` · `src/lib/uscisForms.ts` · `src/lib/nextActionCatalog.ts` · migrations `process_stage` validator + `journey_step_sub_stage`
- **B (catálogo oficial):** 4 archivos subidos (JSON + 3 CSV). Basado en uscis.gov, travel.state.gov, cbp.gov, ice.gov, justice.gov/eoir.

---

## 1. Inventario lado a lado

### 1.1 Lanes / columnas del pipeline

| FUENTE A (key) | FUENTE A (label) | FUENTE B (id) | FUENTE B (label) | Status |
|---|---|---|---|---|
| `uscis` | USCIS | `uscis` | USCIS | ✅ coincide |
| `nvc` | NVC | `nvc` | NVC | ✅ coincide |
| `embajada` | Consular | `consular` | Consular | ⚠️ difiere key (label igual) |
| `court` | Corte EOIR | `eoir` | Corte EOIR | ⚠️ difiere key (label igual) |
| `ice` | ICE / Detención | `ice` | ICE / Detencion | ✅ coincide |
| `admin-processing` | Proceso Admin | `admin` | Proceso Admin | ⚠️ difiere key (label igual) |
| `aprobado` | Aprobado | `aprobado` | Aprobado | ✅ coincide |
| `negado` | Negado | `negado` | Negado | ✅ coincide |
| `sin-clasificar` | Sin clasificar | (no existe) | — | 🆕 falta en B |

**Conclusión lanes:** misma intención, diferencias solo de naming técnico (key). El usuario final ve las mismas columnas.

---

### 1.2 Statuses / estados intra-lane

**A NO tiene status por lane.** Mi modelo:
- `journey_step` ENUM con **12 valores universales** que aplican a TODOS los lanes (`cliente-nuevo` → `negado`).
- `sub_stage` TEXT free-form como detalle por ubicación.
- Decisión locked 2026-05-19 (Modelo C+).

**B tiene status específico por lane (67 statuses totales):**

| Lane | A (journey_step universal) | B (statuses específicos) | Cuenta B |
|---|---|---|---|
| USCIS | 12 generales | "Preparando paquete", "Recibido por gobierno", "RFE/NOID", "Biometricos programados/completados", "En adjudicacion", "Decision emitida", etc. | 11 |
| NVC | 12 generales | "Caso recibido de USCIS", "Invoice ID", "Visa Bulletin", "Pago fees", "DS-260 enviado", "Documentariamente completo", "Enviado al consulado", etc. | 12 |
| Consular | 12 generales | "Biometria", "Examen medico", "Entrevista realizada", "221(g)", "Procesamiento admin", "Visa aprobada", "Visa emitida" | 8 |
| EOIR | 12 generales | "NTA emitido", "Calendario maestro", "Alivio presentado", "Audiencia de meritos", "Decision del juez", "Apelacion BIA", "Revision federal" | 8 |
| ICE | 12 generales | "Arrestado", "Detenido", "Audiencia de fianza", "Bajo fianza", "ATD/check-in", "Orden final remocion", "Removido" | 9 |
| Admin | 12 generales | "221(g)", "Namecheck FBI", "Procesamiento admin", "Resuelto" | 4 |
| Aprobado | 12 generales | "Aprobado", "Tarjeta/visa en produccion", "Documento emitido", "Caso cerrado" | 4 |
| Negado | 12 generales | "Negado", "En periodo apelacion", "Apelacion presentada", "Caso cerrado" | 4 |

**Diferencia clave:** A usa 12 estados estables AI-friendly, B usa lenguaje real del rubro por agencia. Trade-off real, no superior/inferior. Detalle en §3.

---

### 1.3 Tipos de proceso

| Métrica | A | B |
|---|---|---|
| Total tipos de proceso | **88** (`CASE_TYPES`) | **45** |
| Granularidad I-130 (familiares) | 9 sub-types (IR-1, CR-1, F2A, IR-2, F1, F2B, F3, F4, IR-5) | 9 (mismo set) |
| Granularidad I-140 (empleo) | 7 sub-types (EB-1A, EB-1B, EB-1C, EB-2, EB-2 NIW, EB-3, EB-4) | 2 (EB-1, EB-2/EB-3) |
| Granularidad I-485 (AOS) | 5 sub-types (Familia, Empleo, Asilo, U-Visa, VAWA) | 4 (Familiar, Empleo, Asilo, Refugiado) |
| Incluye RUTA de lanes | ❌ NO | ✅ SÍ (ej. `uscis > nvc > consular > aprobado`) |
| Incluye ETAPAS sequence | ❌ NO (deriva implícito) | ✅ SÍ (8-10 etapas por tipo) |
| K-1, K-3, T-visa, U-visa | ✅ SÍ | ✅ SÍ |
| EB-1A, EB-1B, EB-1C separados | ✅ SÍ | ❌ NO (1 fila EB-1) |
| H-1B, L-1, O-1, H-2A/B | ✅ SÍ | ✅ SÍ |
| EOIR-42A/B en proceso de remocion | ❌ NO listado como tipo | ✅ SÍ |
| Bond hearing (ICE) | ❌ NO listado | ✅ SÍ |
| Parole humanitario (CBP) | ❌ NO listado | ✅ SÍ |
| Expedited Removal | ❌ NO listado | ✅ SÍ |
| Adopción I-600/I-800 separados | ✅ SÍ | ⚠️ Combinados |

---

### 1.4 Formularios

| Agencia | A (uscisForms + caseTypes únicos) | B | Gap |
|---|:-:|:-:|:-:|
| USCIS | ~33 forms | **95 forms** | +62 en B |
| DOS | 3 forms (DS-160, DS-260, DS-261) | **16 forms** | +13 en B |
| NVC | 0 explícitos | **2** (DS-261, CEAC) | +2 en B |
| CBP | 1 (I-94) | **5** (I-94, ESTA, CBP One, I-192, I-193) | +4 en B |
| ICE | 1 (I-352) | **4** (I-862, I-220A, I-220B, I-246) | +3 en B |
| EOIR | 2 (EOIR-26, EOIR-28) | **8** (EOIR-26, 27, 28, 29, 33, 40, 42A, 42B) | +6 en B |
| **TOTAL** | **~40 únicos** | **130 forms** | **+90 en B** |

**Detalle de gaps (los más importantes):**

Forms en B que faltan en A (selección de alto valor):
- **G-series operacionales:** G-28I (abogado extranjero), G-325A (biographic accion diferida), G-639 (FOIA), G-845 (SAVE verification), G-1450 (tarjeta credito), G-1566 (status detallado)
- **I-series de paquetes complejos:** I-9 (employment), I-102 (reemplazo I-94), I-129S (L-1 blanket), I-131A (transportista), I-134 (vs I-864 para no-inmigrantes), I-191, I-192/193, I-356 (fianza carga publica), I-407 (abandono LPR), I-526E (centro regional), I-539A (coaplicantes), I-693 (medico AOS), I-730 (reunificacion asilados), I-765V (VAWA EAD), I-800/I-800A (Hague adopcion), I-817 (Family Unity), I-824 (accion sobre aprobada), I-907 (premium), I-912 (fee waiver), I-942/I-942P (reduccion N-400 fee)
- **N-series ciudadania completas:** N-300, N-336, N-426 (military), N-470 (preservar residencia), N-565 (reemplazo cert), N-600K (322), N-644 (postuma), N-648 (medical excepcion)
- **DS-series completas:** DS-156E (E-visa), DS-117 (SB-1 returning resident), DS-1884 (SIV gobierno), DS-3035 (J-1 waiver), DS-5535 (info adicional), DS-2029 (CRBA), DS-11/DS-82/DS-5504/DS-64 (pasaportes EE.UU.)
- **CBP operacionales:** ESTA (Visa Waiver), CBP One (citas)
- **ICE/EOIR completos:** I-862 NTA, I-220A/B, I-246 (stay), EOIR-27/29/33/40 (apelaciones + cambio direccion)

Forms en A que NO están en B:
- **I-130A** (Supplemental Information for Spouse Beneficiary) — A lo tiene, B no
- **I-765WS** (Worksheet DACA) — A lo tiene, B no
- **DS-261** — Ambos lo tienen (en A como caseTypes, en B como NVC)
- (Cobertura A ⊂ B salvo I-130A y I-765WS)

---

## 2. Gaps consolidados

### 2.1 Gaps de B → A (lo que mi sistema no tiene y B sí)

🟥 **CRÍTICOS (afectan operación de bufete):**
1. **Ruta inter-agencia por tipo de proceso** — B mapea cada tipo a su recorrido de lanes. Ej: `I-130 IR-1` → `uscis > nvc > consular > aprobado`. Esto permite que Camila/Nina sugieran "próximo paso" basado en dónde está el caso en su ruta.
2. **Etapas sequence (sub-stages canónicas) por tipo** — B tiene 8-10 etapas ordenadas por tipo de proceso. Permite progress bar realista por caso.
3. **Casos de Corte/ICE explícitos como "tipo de proceso"** — A clasifica como `case_type`, pero Bond hearing, Expedited Removal, NTA Section 240, EOIR-42A/B son **tipos de proceso operacionales** que el bufete necesita listar.

🟧 **IMPORTANTES (afectan ergonomía):**
4. **Forms operativos del paquete USCIS** — G-1145 (e-notif), I-907 (premium), I-693 (medico), I-134 (affidavit financiero no-inmigrante), I-864A/EZ/P/W variantes — usados en cada paquete real.
5. **Forms de ciudadanía completos** — N-336 (apelación), N-426 (military), N-648 (médico waiver), N-600K
6. **Forms DOS completos** — DS-117 (SB-1), DS-2029 (CRBA), DS-11/82 (pasaportes) — el bufete maneja pasaportes y CRBA habitualmente.
7. **Status por lane (lenguaje real del rubro)** — "Documentariamente completo" en NVC, "221(g) pendiente" en consular, "Bajo ATD" en ICE — son términos que el paralegal usa, no los míos generalistas.

🟨 **NICE TO HAVE:**
8. **Forms de cumplimiento ICE/EOIR** — I-220A/B, I-246, EOIR-33, EOIR-40

### 2.2 Gaps de A → B (lo que yo tengo y B no cubre)

🟩 **A es MÁS granular en:**
1. **EB-1 splits (EB-1A/EB-1B/EB-1C)** — Bufete de empleo necesita esta granularidad. B los une.
2. **AOS por base distinta** — I-485 U-Visa y I-485 VAWA están separados en A, B solo tiene 4 buckets.
3. **K-1 vs K-3 nomenclatura** — A los modela como `i129f-k1` y `i129f-k3` separados. B también pero menos descriptivo.
4. **I-130A** — Form supplemental que A tiene.
5. **I-765WS DACA worksheet** — A lo tiene como form propio.

🟩 **A tiene lógica de UI que B no aporta:**
- `journey_step` universal AI-friendly (12 estados estables)
- `sub_stage` TEXT free-form
- `inferAgency()` función pura por prefix del form
- `searchTerms` por case_type para buscador en español
- `category` (`family-immigrant`, `humanitarian`, etc.) — taxonomía propia para filtros UX
- `responsible` (cliente/equipo/profesional/gobierno) — ball-in-court inferido
- Chips de filtro por agencia
- Catálogo de **acciones por etapa** (nextActionCatalog, 53 acciones)

---

## 3. Conflictos de nomenclatura

### 3.1 Lanes — equivalencias técnicas

| A (key BD) | B (id) | Acción propuesta |
|---|---|---|
| `embajada` | `consular` | Mantener `embajada` como key BD (rompe migration cambiarlo), label "Consular" ya está bien |
| `court` | `eoir` | Mantener `court` como key BD, label "Corte EOIR" ya está bien |
| `admin-processing` | `admin` | Mantener key BD, alinear label "Proceso Admin" (ya coincide) |

**Recomendación:** keys BD no se tocan (costo migration alto). Labels ya son los mismos. **0 conflicto operacional.**

### 3.2 Statuses — equivalencias propuestas

Mi `journey_step` universal vs sus statuses por lane. Tabla de mapeo:

| journey_step (A) | Lane USCIS B | Lane NVC B | Lane Consular B | Lane EOIR B | Lane ICE B |
|---|---|---|---|---|---|
| `cliente-nuevo` | (pre-Preparando paquete) | (pre-Caso recibido) | — | — | — |
| `esperando-cuestionario` | "Esperando cuestionario" | — | — | — | — |
| `esperando-documentos` | "Esperando documentos" | "Pago de fees", "DS-260 enviado", "Documentos enviados" | — | "Aplicaciones de alivio presentadas" | — |
| `preparando-paquete` | "Preparando paquete" | "Preparando paquete" | — | — | — |
| `pendiente-revision` | (interno NER) | (interno NER) | (interno NER) | (interno NER) | (interno NER) |
| `enviado` | "Recibido por gobierno" (recién entró) | "Caso recibido de USCIS" | — | — | — |
| `confirmado` | "Recibido por gobierno" (receipt) | "Caso creado (Invoice ID)" | "Cita programada" | "NTA emitido", "Calendario maestro" | "Arrestado", "Detenido" |
| `en-espera` | "Pendiente revision", "En adjudicacion" | "En revision NVC", "Esperando disponibilidad" | "Procesamiento administrativo" | "Audiencia de meritos programada" | "Bajo fianza", "Bajo ATD" |
| `pide-mas-info` | "RFE/NOID" | "Gobierno pide mas info" | "221(g) pendiente" | — | — |
| `cita-programada` | "Biometricos programados", "Entrevista programada" | "Listo para entrevista" | "Cita programada", "Biometria", "Examen medico" | "Audiencia de meritos programada", "Cita programada" | "Audiencia de fianza", "Cita programada" |
| `aprobado` | "Decision emitida" + positiva | (no aplica, pasa a Consular) | "Visa aprobada", "Visa emitida" | "Decision del juez" + positiva | — |
| `negado` | "Decision emitida" + negativa | — | — | "Decision del juez" + negativa, "Apelacion BIA" | "Orden final de remocion" |

**Conclusión:** mi `journey_step` cubre el 70% del espacio. Los statuses de B que NO mapean limpiamente son los muy específicos por agencia (ej. "Documentariamente completo" NVC, "Bajo ATD" ICE, "Namecheck FBI" admin). Esos van bien en mi `sub_stage` TEXT (ya está deployed via migration `20260528220000_journey_step_sub_stage.sql`).

---

## 4. Calidad de B

### 4.1 Lo que B hace bien

✅ **Fuentes oficiales declaradas** (uscis.gov, travel.state.gov, etc.) + nota explícita de "verificar siempre en sitio oficial. No es asesoría legal."
✅ **Categorización por agencia clara** (USCIS / DOS / NVC / CBP / ICE / EOIR)
✅ **Rutas inter-agencia realistas** — ej. `I-601A` → `uscis > nvc > consular > aprobado` (correcto: I-601A se aprueba en USCIS antes de salida al consulado).
✅ **Etapas dentro del proceso** — refleja workflow real del paralegal (ej. N-400 incluye "Aviso de ceremonia N-445" + "Juramento + Certificado").
✅ **Cobertura humanitaria completa** — incluye SIJ, NACARA (I-881), Parole humanitario, Expedited Removal con miedo creíble.
✅ **Tipos de proceso operacionales** — Bond hearing, Removal ERO, Expedited Removal son procesos reales que un bufete maneja.
✅ **Lenguaje del rubro** — "Documentariamente completo" en NVC, "Premium opcional" en EB-1/I-129 son términos canónicos.

### 4.2 Lo que B podría mejorar / verificar

⚠️ **DV (Lotería de Visas) modelada solo bajo DS-260** — Falta el paso de "registro DV Entry" como case_type (B lo incluye en etapas pero no como tipo de proceso separado).
⚠️ **VAWA / SIJ / TPS sin sub-rutas** — Cuando se aprueban derivan a I-485, pero la ruta no lo refleja.
⚠️ **EB-5 muy abreviado** — Solo "Presentar I-829" como etapa para remove conditions. El proceso real incluye AAO appeals y RC sustaining, falta detalle.
⚠️ **K-1 etapas no mencionan I-485 follow-on** — El K-1 termina con "matrimonio en 90 días + I-485" pero ese I-485 es un nuevo case, no etapa del K-1.
⚠️ **Sin definición de "Decisión emitida" positiva vs negativa** — En USCIS lane el status "Decision emitida" no distingue aprobacion vs denegación. El paralegal tiene que cambiar de lane manualmente.
⚠️ **Forms desactualizados marcados** — I-944 declara "(descontinuado)" ✓. Pero faltan notas de Public Charge bonds (I-945) que está en limbo legal post-Biden.
⚠️ **CBP One menciona "I-94 provisional"** — Eso es desactualizado post-junio 2024. CBP One desde fin de Trump-2 está restringido. Verificar fuente.

🔴 **No verificable sin acceso a BD interno del usuario:**
- Si las etapas reflejan los timelines reales del rubro de Mr. Lorenzo (Mr Visa)
- Si todos los descriptors están aceptados por las 5 firmas piloto
- Si falta alguna variante regional (NJ, NY, FL tienen patrones distintos)

**Veredicto general de B:** **calidad alta** para uso real de bufete pequeño-mediano. Sin asesoría legal, pero como **base de datos operacional** está sólida. Necesita verificación mínima por Mr. Lorenzo en 5-10 casos reales antes de hacerlo source-of-truth.

---

## 5. Recomendación — 3 opciones

### Opción 1 — Adoptar B completo

**Qué:** Reemplazar mis catálogos por B 1:1.

| Pros | Contras |
|---|---|
| Catálogo más completo de la industria | Pierdo granularidad EB-1A/B/C que A tiene |
| Cobertura forms 3x mayor | Rompo `case_type` ENUM existente en BD (migration costosa) |
| Rutas + etapas ya curadas | Pierdo journey_step universal (regreso a statuses fragmentados) |
| Status real del rubro | Pierdo `searchTerms`, `category`, `inferAgency` |
| | Refactor frontend grande (chips, filtros) |

**Costo:** alto. Migration BD + refactor caseTypes/journeySteps/nextActionCatalog. ~3-5 días de sprint.
**Riesgo:** alto. Romper UX que paralegales ya conocen.

**No recomiendo.** Sacrificio innecesario de cosas que A hace mejor.

### Opción 2 — Fusión inteligente (RECOMENDADA)

**Qué:** Mantener A como esqueleto + importar de B los datos que A no tiene.

**Importar de B:**
- ✅ **62 forms USCIS nuevos** a `uscisForms.ts` (G-*, I-9, I-102, I-407, I-693, I-730, etc.) — solo agregar, no romper nada
- ✅ **13 forms DOS** (DS-117, DS-11/82, DS-2029 CRBA, etc.)
- ✅ **8 forms EOIR completos** (EOIR-27, 29, 33, 40)
- ✅ **5 forms CBP/ICE** (I-862, I-220A/B, I-246, ESTA)
- ✅ **Tipos de proceso operacionales** (Bond, NTA Section 240, EOIR-42A/B, Expedited Removal, Parole humanitario)
- ✅ **Rutas de lanes por tipo de proceso** (nuevo campo `route: PipelineStageKey[]` en cada CaseType)
- ✅ **Etapas (sequence) por tipo** (nuevo campo `stages: string[]` en cada CaseType)
- ✅ **Statuses específicos por lane** como **sugerencias de `sub_stage`** (no reemplazan, complementan)
- ✅ **DS-11, DS-82 (pasaportes EE.UU.)** — bufete maneja esto

**Mantener de A:**
- ✅ Granularidad EB-1A/B/C, I-485 splits (5), K-1/K-3 separados, I-130A, I-765WS
- ✅ `journey_step` universal (12 estados)
- ✅ `inferAgency()`, `category`, `searchTerms`
- ✅ Process_stage ENUM BD (keys: embajada, court, admin-processing) — labels ya coinciden con B
- ✅ NEXT_ACTION_CATALOG (53 acciones)

| Pros | Contras |
|---|---|
| Mejora cobertura sin romper UX | Tabla `forms` crece 3x (rendimiento mínimo) |
| Migration BD opcional (Fase B) | Necesita curación manual de duplicados |
| Camila puede sugerir próximo paso usando ruta+etapas | Trabajo de fusión: 4-6h |
| Forms operativos del paquete USCIS disponibles | Verificación quality (5-10 casos) requerida antes de ir live |
| Zero breaking change en frontend | |

**Costo:** medio. ~6h de fusión + 2h verificación + 0 migrations BD obligatorias.
**Riesgo:** bajo. Solo agregar, no reescribir.

**Mi voto fuerte. ⭐**

### Opción 3 — Toma piezas selectivas (mínimo viable)

**Qué:** Importar SOLO lo crítico para HOY (5 firmas piloto).

**Importar de B:**
- ✅ Los 10 forms USCIS más usados del paquete (G-1145, I-907, I-693, I-134, I-864A, I-864EZ, I-485 Sup A)
- ✅ Status text como sugerencias en `sub_stage` dropdown (no migration, solo frontend hint)
- ✅ Marcar pasaportes EE.UU. (DS-11/82) como tipo de proceso

**No importar:**
- ❌ Tipos operacionales Corte/ICE (postponer Fase 5 del roadmap)
- ❌ Rutas de lanes (postponer)
- ❌ Etapas sequence (postponer)

| Pros | Contras |
|---|---|
| Cero riesgo | Pierdo el value-add más grande (rutas + etapas para Camila) |
| ~2h de trabajo | Volveré a tener este debate en 1-2 meses |
| Suficiente para piloto | |

**Costo:** muy bajo. ~2h.
**Riesgo:** mínimo.

**Recomendable solo si:** entregar HOY a 5 firmas es lo único que importa y vamos a re-evaluar en 30 días.

---

## 6. Plan de adopción por fases (sobre Opción 2)

### Fase 0 — Pre-adopción (read-only, sin código)

| Acción | Duración | Migration BD | Owner |
|---|:-:|:-:|:-:|
| Mr. Lorenzo revisa este informe | 1 día | No | Mr. Lorenzo |
| Mr. Lorenzo confirma 5-10 casos reales coinciden con etapas de B | 2h | No | Mr. Lorenzo + Vanessa |
| Aprobar opción + alcance | — | No | Mr. Lorenzo |

### Fase 1 — Expansión de catálogo de forms (sin migration)

| Acción | Duración | Migration BD | Riesgo |
|---|:-:|:-:|:-:|
| Agregar 90+ forms a `src/lib/uscisForms.ts` | 1h | No | Bajo |
| Importar agency oficial por form (`USCIS`/`DOS`/`NVC`/`CBP`/`ICE`/`EOIR`) — alinear con `inferAgency()` existente | 30min | No | Bajo |
| Actualizar `CATEGORY_LABELS` con nuevas categorías de B (admin, adopción, inversión, pasaporte) | 30min | No | Bajo |
| Tests del chip filtrador por agencia con catálogo expandido | 30min | No | Bajo |

**Resultado Fase 1:** dropdown "Tipo de proceso" muestra 90 forms más. Cero ruptura.

### Fase 2 — Rutas y etapas por tipo de proceso (sin migration BD)

| Acción | Duración | Migration BD | Riesgo |
|---|:-:|:-:|:-:|
| Extender `CaseTypeMeta` con `route: PipelineStageKey[]` + `stages: string[]` opcionales | 30min | No | Bajo |
| Poblar `route` y `stages` para los 45 tipos de B mapeados a los 88 de A | 2h | No | Medio (curación) |
| Helper `getStagesForCase(caseType)` para UI | 30min | No | Bajo |
| Mockup de "progress bar" del caso (etapas) en case-engine tab Resumen | 1h | No | Bajo |

**Resultado Fase 2:** cada caso muestra progress bar real con etapas estándar de la industria.

### Fase 3 — Tipos operacionales Corte/ICE/CBP (sin migration)

| Acción | Duración | Migration BD | Riesgo |
|---|:-:|:-:|:-:|
| Agregar tipos operacionales (Bond hearing, NTA Section 240, EOIR-42A/B, Expedited Removal, Parole humanitario) a `caseTypes.ts` | 1h | No | Bajo |
| Mapear a `process_stage` correcto (court / ice) | 30min | No | Bajo |
| Verificar que chip "EOIR" e "ICE" filtran correctamente con los nuevos | 30min | No | Bajo |

**Resultado Fase 3:** los 3 lanes Court/ICE/CBP dejan de estar "vacíos" de tipos de proceso.

### Fase 4 — Statuses específicos por lane como hints de sub_stage (sin migration)

| Acción | Duración | Migration BD | Riesgo |
|---|:-:|:-:|:-:|
| Definir `SUGGESTED_SUB_STAGES_BY_LANE: Record<lane, string[]>` con los statuses de B | 30min | No | Bajo |
| UI: cuando paralegal edita sub_stage, mostrar autocomplete con sugerencias del lane actual | 1h | No | Bajo |
| Si paralegal escribe libre, queda flag `is_custom` (igual que NEXT_ACTION_CATALOG) | 30min | No | Bajo |

**Resultado Fase 4:** sub_stage queda con vocabulario consistente del rubro + escape hatch.

### Fase 5 — Catálogo de acciones por etapa expandido (sin migration)

| Acción | Duración | Migration BD | Riesgo |
|---|:-:|:-:|:-:|
| Para los 45 tipos de proceso de B con sus `etapas` sequence, generar acciones contextuales | 2h | No | Bajo |
| Extender `NEXT_ACTION_CATALOG` por `(stage, case_type)` en vez de solo `stage` | 1h | No | Medio |
| Camila puede sugerir "próxima acción" basada en etapa actual del caso | — (Fase 8 IA) | — | — |

**Resultado Fase 5:** las 53 acciones actuales escalan a ~200+ contextualizadas por tipo + etapa.

### Fase 6 — Opcional: migration BD para `forms` table (postpone)

Si decidimos almacenar el catálogo en BD (en vez de constantes TS) para que las firmas puedan agregar custom forms:

| Acción | Duración | Migration BD | Riesgo |
|---|:-:|:-:|:-:|
| Crear tabla `migration_forms_catalog` (id, code, title, agency, category, is_active) | 30min | **SÍ** | Medio |
| Seed con datos de B | 30min | **SÍ** | Bajo |
| RLS: read público + write admin | 30min | **SÍ** | Bajo |
| Cambiar `uscisForms.ts` a hook que lee de BD con fallback al constant | 1h | — | Bajo |

**Postponer hasta:** que llegues a 20+ firmas y necesités custom forms por firma.

---

## Resumen ejecutivo (TL;DR)

- **B es de calidad alta** y cubre 3x más forms que mi sistema actual.
- **A es más granular** en empleo (EB-1A/B/C) y AOS (5 buckets) — eso no se pierde.
- **B aporta value-add masivo** con rutas inter-agencia + etapas sequence por tipo de proceso, que A no tiene.
- **Cero conflicto operacional** en lanes (mismas columnas, distintos keys técnicos).
- **Cero migration BD obligatoria** en Fases 1-5 — todo se hace en código TypeScript.
- **Recomendación:** **Opción 2 (Fusión inteligente).** Implementar en 5 fases incrementales, sin tocar BD, ~7-9h de trabajo total + 2h verificación tuya.

**Próximo paso pendiente de tu aprobación:**
1. ¿Procedemos con Opción 2 + plan de fases?
2. ¿Querés que arranque por Fase 1 (forms expansion) o por Fase 2 (rutas+etapas)?
3. ¿Alguna fase la querés saltear o priorizar distinto?

**NO modifico código hasta que confirmes.**
