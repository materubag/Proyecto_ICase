# Sistema de Diseño y Guía de Generación Minimalista — Estándar Esencial ICASE (v3.0)

**Versión:** 3.0 (Enfoque Ultra-Minimalista: Cero Sobrecarga Visual y Máxima Claridad Operativa)  
**Plataforma / Dispositivo Principal:** Desktop (1440px / 1280px centrado) con adaptación responsive fluida.  
**Idioma Oficial:** Español.

---

## 1. Manifiesto y Filosofía: "Solo lo Esencial"

Esta especificación tiene como mandato inquebrantable erradicar la sobrecarga cognitiva en todas las pantallas del ecosistema. Ninguna pantalla debe contener elementos ornamentales, métricas superfluas, registros innecesarios ni micro-etiquetas que distraigan del propósito principal.

### Los 5 Mandamientos Minimalistas:
1. **Un solo propósito principal por pantalla/vista:** 
   - En *Login*: exclusivamente usuario, contraseña y botón de ingreso. Sin tablas de auditoría ni selectores secundarios.
   - En *Formularios*: solo los campos estrictamente requeridos para completar la transacción.
   - En *Listados y Dashboards*: métricas sintetizadas (máximo 3 o 4 esenciales) y foco directo en el contenido accionable.
2. **Eliminación total del "ruido administrativo":**
   - Prohibido exponer códigos de especificación técnica interna (p. ej. `RF-01`, `RF-15`, `RF-35`, hashes SHA-256 o tokens criptográficos) en la interfaz regular de usuario.
   - Prohibido duplicar historiales, paneles de noticias o registros de auditoría en pantallas cuyo objetivo sea otro.
3. **Respiración y espacio en blanco intencional:**
   - La interfaz no debe sentirse saturada. Se prioriza el espacio en blanco (`padding: 32px` a `40px` en tarjetas principales; márgenes de sección de `24px` a `32px`).
4. **Cromaticidad moderada y sin estridencias:**
   - Paleta de color estrictamente controlada. Un único color de acción primario (Índigo `#4F46E5`).
   - Fondos limpios y neutros (`#F8FAFC` superficie base, `#FFFFFF` tarjetas).
   - Prohibidos los degradados llamativos, bordes de alto contraste o sombras pesadas.
5. **Jerarquía tipográfica limpia:**
   - Un título claro (20px a 24px, peso 600), una bajada concisa explicativa en gris atenuado (14px) y etiquetas de campo legibles y directas.

---

## 2. Tokens de Diseño y Variables Visuales

| Token | Valor CSS | Uso Normativo |
| :--- | :--- | :--- |
| `--color-primary` | `#4F46E5` | Botones de acción principal, estados activos de selección, enlaces clave |
| `--color-primary-hover` | `#4338CA` | Hover en controles primarios |
| `--color-primary-subtle` | `#EEF2FF` | Fondos de selección activa y estados suaves |
| `--color-bg-app` | `#F8FAFC` | Fondo de la aplicación (gris neutro claro y limpio) |
| `--color-surface` | `#FFFFFF` | Fondo de tarjetas, modales y contenedores |
| `--color-border` | `#E2E8F0` | Bordes finos de 1px en tarjetas, campos y separadores |
| `--color-border-focus` | `#6366F1` | Borde al enfocar campos de texto |
| `--color-text-title` | `#0F172A` | Títulos principales y valores destacados |
| `--color-text-body` | `#334155` | Texto general de lectura, etiquetas de campos |
| `--color-text-muted` | `#64748B` | Subtítulos, textos de ayuda y marcas temporales |
| `--color-text-placeholder` | `#94A3B8` | Placeholders en inputs de formulario |
| `--status-success` | `#16A34A` / `#F0FDF4` | Dot indicador y fondo sutil para confirmaciones/éxito |
| `--status-warning` | `#D97706` / `#FFFBEB` | Dot indicador y fondo sutil para revisiones/pendientes |
| `--status-danger` | `#DC2626` / `#FEF2F2` | Dot indicador y fondo sutil para fallas críticas/errores |
| `--radius-sm` | `6px` | Badges, chips e indicadores compactos |
| `--radius-md` | `8px` | Botones, campos de entrada (`input`, `select`) |
| `--radius-lg` | `16px` | Tarjetas contenedoras principales y modales |
| `--shadow-card` | `0 1px 3px rgba(15, 23, 42, 0.04)` | Sombra sutil casi plana; evitar elevaciones pesadas |

---

## 3. Arquetipos de Pantalla y Distribución de Layout

Cualquier pantalla generada bajo este sistema debe pertenecer a uno de estos tres arquetipos esenciales:

### Arquetipo A: Pantalla Focal / Autenticación
- **Propósito:** Tareas de un único paso donde el usuario solo necesita concentrarse en una acción (Login, Registro puntual, Recuperar Clave).
- **Estructura:**
  - **Cabecera Minimalista:** Barra fija con logo institucional, badge sutil de estado (ej. "Acceso Seguro SSL") y sin menú distractor.
  - **Tarjeta Central:** Centrada vertical y horizontalmente en el viewport, ancho de `440px` a `480px`, fondo blanco puro, borde `1px solid #E2E8F0`, radio `16px`, padding de `36px` a `40px`.
  - **Contenido Interior:**
    - Icono de acción sobrio en contenedor suave (40x40px).
    - Título claro (22px, SemiBold) + subtítulo breve (14px, muted).
    - Máximo 2 a 3 campos de entrada con etiquetas superiores (`text-sm font-medium text-slate-700`).
    - Botón primario de ancho completo (altura 44px, radio 8px, fondo `#4F46E5`, texto blanco).
    - Enlace secundario discreto de ayuda o recuperación centrado abajo.

### Arquetipo B: Formulario de Gestión / Proceso Guiado
- **Propósito:** Procesos de solicitud, carga o edición de datos.
- **Estructura:**
  - **Cabecera Estándar:** Logo a la izquierda, enlaces limpios a secciones clave y avatar de usuario a la derecha.
  - **Contenedor Principal:** Ancho máximo `1200px` a `1280px`, centrado.
  - **Distribución Bicolumna (65% / 35%):**
    - *Columna Izquierda (Flujo):* Pasos ordenados con tarjetas de selección limpias y campos accesibles sin atiborrar de texto.
    - *Columna Derecha (Resumen Dinámico):* Tarjeta blanca fija con el resumen de la selección en curso, estado actual y botón de confirmación.

### Arquetipo C: Panel de Monitoreo / Dashboard Limpio
- **Propósito:** Visualización de avances, indicadores o expedientes.
- **Estructura:**
  - Fila superior de **KPIs Sintetizados (3 o 4 tarjetas máximo)** con métricas claras acompañadas de micro-dots de tendencia.
  - Tabla de registros maestra: cabecera gris suave (`#F8FAFC`), filas aireadas (54-58px de alto), búsqueda simple y estados en badges sutiles.
