
## Problema actual
Escribir dígitos sin `+` es ambiguo: `5712345678` puede ser Colombia (+57) o un número US. `34612345678` puede ser España (+34) o Nigeria (+234). No hay forma confiable de adivinar.

## Propuesta: Detección solo con prefijo `+`

### Regla principal
- **Si el usuario escribe `+` al inicio** → detectar país automáticamente con `libphonenumber-js`
- **Si NO escribe `+`** → usar el país del dropdown (default 🇺🇸 +1) y tratar los dígitos como número local

### Comportamiento del campo

1. **Input acepta `+`**: Si el primer carácter es `+`, activar modo internacional
2. **Modo internacional** (empieza con `+`):
   - Parsear con `libphonenumber-js` en `onBlur`
   - Actualizar bandera y código automáticamente
   - Separar el número local del código de país
   - Ejemplo: `+34612345678` → 🇪🇸 +34 | 612 345 678
3. **Modo local** (sin `+`):
   - Usar el país del dropdown tal cual
   - Solo validar que el número sea válido para ese país
   - Ejemplo: con 🇺🇸 +1 seleccionado, `5712345678` → +15712345678
   - Si el usuario quiere Colombia, primero cambia el dropdown a 🇨🇴 +57

### Dropdown mejorado
- Mantener el dropdown searchable existente
- Al cambiar país manualmente, se re-valida el número
- Hint debajo del campo: "Incluye + para detectar país automáticamente"

### Validación (onBlur)
- Validar con `libphonenumber-js` usando el país seleccionado
- ✅ verde = número válido para ese país
- ⚠️ amarillo = número incompleto o inválido

### Lo que se guarda
- Siempre formato E.164: `+[código][número]`

### Casos especiales preservados
- 10 dígitos sin `+` con 809/829/849 → 🇩🇴 (mercado principal)
- 10 dígitos sin `+` cualquier otro → 🇺🇸 (default)

### Archivos a modificar
- `src/lib/phoneDetect.ts` — simplificar lógica
- `src/components/intake/steps/StepClient.tsx` — permitir `+` en input, hint visual
