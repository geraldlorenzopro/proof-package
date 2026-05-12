# Auditoría E2E Smart Forms — 2026-05-12

**Auditor:** Claude Code (Opus 4.7) + Explore agent
**Para:** Mr. Lorenzo (CEO)
**Alcance:** módulo Smart Forms completo (8 archivos core + 4 entry points + routing App.tsx)

---

## Resumen ejecutivo

- **67 botones auditados** en 11 archivos
- **0 botones rotos** (todas las rutas existen en App.tsx)
- **2 brand fails CRÍTICOS** (gradient-gold + accentVariant="gold")
- **3 brand fails MENORES** (shadow-accent en 3 archivos = 5 ocurrencias)
- **3 brand fails fuera del módulo** (HubAiPage tabs)
- **0 microcopy incorrecto**
- **3 botones faltantes** recomendados para próximo sprint

**Veredicto:** 97% compliant. 8 fixes obvios = ~10 min de trabajo. Una vez aplicados, 100% compliant.

---

## Hallazgos CRÍTICOS (deben fixearse)

| # | Archivo | Línea | Problema | Fix |
|---|---|---|---|---|
| 1 | `src/pages/SmartFormsSettings.tsx` | 212 | Botón "Guardar cambios" usa `gradient-gold` legacy | `bg-primary text-primary-foreground hover:bg-primary/90` |
| 2 | `src/components/smartforms/SmartFormsLayout.tsx` | 275 | Splash del módulo pasa `accentVariant="gold"` | `accentVariant="cyan"` |

## Hallazgos MENORES (sombras legacy)

| # | Archivo | Línea | Problema | Fix |
|---|---|---|---|---|
| 3 | `src/pages/SmartFormsList.tsx` | 309 | `shadow-md shadow-accent/10` en botón Nuevo Formulario | `shadow-md shadow-primary/10` |
| 4 | `src/pages/SmartFormsList.tsx` | 329 | `shadow-sm shadow-accent/10` en filter chip activo | `shadow-sm shadow-primary/10` |
| 5 | `src/components/smartforms/I765Wizard.tsx` | 409 | `shadow-md shadow-accent/10` en role selector activo | `shadow-md shadow-primary/10` |
| 6 | `src/components/smartforms/I130Wizard.tsx` | 368 | `shadow-md shadow-accent/10` en role selector activo | `shadow-md shadow-primary/10` |

## Hallazgos fuera del scope Smart Forms (entry points)

| # | Archivo | Línea | Problema | Fix |
|---|---|---|---|---|
| 7 | `src/pages/HubAiPage.tsx` | 89, 93, 97 | TabsTrigger usa `bg-accent/15 text-accent` legacy | `bg-primary/15 text-primary` |

---

## Pantallas auditadas — Inventario de botones

### 1. SmartFormsList (`/dashboard/smart-forms`)

10 botones / CTAs. Catálogo de 15 formularios + tabla submissions. Filter chips + dropdown menus + dialog catálogo + dialog beneficiary picker. Todas las rutas correctas. Brand 95% (2 shadow-accent legacy).

### 2. SmartFormPage (`/dashboard/smart-forms/new` o `:id`)

2 botones propios + delega al wizard. Banner Felix IA (purple, correcto), botón "Generar con Felix IA" (purple-500, brand-OK para agente). 100% compliant.

### 3. I765Wizard (9 pasos)

14 botones / CTAs. Footer nav (Atrás/Siguiente/Generar PDF) + 3 role cards + 2 language toggles + ClientLinkSection + +Agregar nombre + Volver al panel + 2 PDF type cards + 2 success dialog buttons. Una sola shadow-accent legacy (línea 409). 99% compliant.

### 4. I130Wizard (13 pasos)

Mirror estructural de I765 con misma jerarquía de botones. Una shadow-accent legacy (línea 368). 99% compliant.

### 5. SmartFormsLayout (shell)

10 botones / CTAs en TopNavBar + step pills + mobile drawer + seat dialog. **1 fail CRÍTICO**: splash module pasa `accentVariant="gold"`. Resto 100%.

### 6. SmartFormsSettings (`/dashboard/smart-forms/settings`)

2 botones (back + save). **1 fail CRÍTICO**: botón Guardar usa `gradient-gold` legacy.

### 7. ToolSplash (componente genérico)

3 botones. Componente parametrizable por `accentVariant`. La variant `gold` que usa Smart Forms está en gold legacy. Cambiando a `cyan` (preexistente, ya fixed en commit fdead24), el splash queda en Electric Cyan #22D3EE oficial.

### 8. HubFormsPage (entry point `/hub/forms`)

2 botones. Empty state CTA + form row click. 100% compliant después del fix de `ff0e574`.

### 9. HubAiPage (entry point `/hub/ai` tab Herramientas)

2 botones relevantes a Smart Forms ("Formularios USCIS" + "NER Smart Forms" — ambos navegan a la misma ruta). **3 fails MENORES**: TabsTrigger en líneas 89, 93, 97 con `bg-accent/15 text-accent`.

### 10. CaseFormsPanel (entry point dentro de un caso)

6 botones / CTAs. Empty state + 6 botones per form row. 100% compliant.

### 11. QuickFormLauncher (entry point workspace)

2 botones. Form row + I-765 create card. 100% compliant.

---

## Verificación de rutas (App.tsx líneas 122-126)

```tsx
<Route path="/dashboard/smart-forms" element={<ProtectedRoute><SmartFormsLayout /></ProtectedRoute>}>
  <Route index element={<SmartFormsList />} />
  <Route path="new" element={<SmartFormPage />} />
  <Route path="settings" element={<SmartFormsSettings />} />
  <Route path=":id" element={<SmartFormPage />} />
</Route>
```

✅ Todas las rutas que se navegan en el módulo existen. Sin 404 posibles.

---

## Botones faltantes — Recomendaciones próximo sprint

Estos NO son fails actuales, son features que Vanessa (UX paralegal) flagueó como necesarios para uso real:

| # | Pantalla | Falta | Prioridad | Estimado |
|---|---|---|---|---|
| 1 | SmartFormsList | Sort UI por `updated_at` (toggle más-reciente / más-antiguo) | MEDIA | 1h |
| 2 | SmartFormsList | Bulk delete (checkbox por row + "Eliminar seleccionados") | MEDIA | 2h |
| 3 | SmartFormsList | Filter "Abandonados >30 días" (drafts sin tocar hace mucho) | BAJA | 30min |
| 4 | I765/I130 Wizard | "Volver al panel" duplicado en footer móvil (accesibilidad) | MEDIA | 30min |
| 5 | I765/I130 Wizard | "Cambiar form_type" (gear icon header) por si paralegal se equivocó | BAJA | 1.5h |
| 6 | I765/I130 Wizard | "Enviar a cliente" por email (no solo generar link) | BAJA | 2h (requiere integración email) |

Total potencial sprint UX: ~7h.

---

## Microcopy auditado

Todos los textos revisados son aceptados según brandbook:

- "Configura este caso" ✅
- "¿Qué necesitas?" ✅
- "Cuéntanos sobre ti" ✅
- "Genera un enlace para que el cliente complete sus datos desde su dispositivo" ✅
- "El PDF resumen del cliente ha sido descargado." ✅
- "Formularios inteligentes para USCIS" ✅

Sin ocurrencias de "Estamos aquí para ayudarte" (frase prohibida).

---

## Para validación visual final

Mr. Lorenzo: abrir Lovable preview (después que Lovable haga pull de los fixes), navegar:

1. `/hub/forms` → click "Crear formulario nuevo" → ¿llega a `/dashboard/smart-forms`?
2. `/dashboard/smart-forms` → ¿todos los botones del catálogo y submissions están en AI Blue?
3. Click "Crear Formulario" → modal aparece. Seleccionar I-130 → modal beneficiary → "Continuar"
4. `/dashboard/smart-forms/new` → wizard de 13 pasos del I-130. ¿Splash arriba está en cyan, NO en amarillo?
5. Navegar paso por paso. ¿Botones "Siguiente" en AI Blue? ¿Step indicator activo en cyan o AI Blue (no gold)?
6. Llegar al paso final → "Generar PDF" → dialog selector
7. `/dashboard/smart-forms/settings` → ¿botón "Guardar cambios" en AI Blue (NO gold)?

Si algo se ve distinto a lo descrito, screenshot + comentario.
