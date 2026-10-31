# Sistema de Diseño y Guía de Generación Minimalista — Mecánica Autron (Estándar Esencial v3.0)

**Versión:** 3.0 (Enfoque Ultra-Minimalista: Cero Sobrecarga Visual y Máxima Claridad Operativa)  
**Pantallas de Referencia Oficiales:**
- Autenticación e Interfaces Focales: `{{DATA:SCREEN:SCREEN_5}}` (*Mecánica Autron - Inicio de Sesión Minimalista*)
- Gestión y Vistas de Trabajo: `{{DATA:SCREEN:SCREEN_16}}` (*Portal Cliente: Citas y Agendamiento (Diseño Simplificado)*)
**Sistema de Diseño Base:** `{{DATA:DESIGN_SYSTEM:DESIGN_SYSTEM_2}}` (*Mecánica Autron Design System*)  
**Plataforma / Dispositivo Principal:** Desktop (1440px / 1280px centrado) con adaptación responsive fluida.  
**Idioma Oficial:** Español.

---

## 1. Manifiesto y Filosofía: "Solo lo Esencial"

Esta especificación tiene como mandato inquebrantable erradicar la sobrecarga cognitiva en todas las pantallas del ecosistema Mecánica Autron. Ninguna pantalla debe contener elementos ornamentales, métricas superfluas, registros innecesarios ni micro-etiquetas que distraigan del propósito principal.

### Los 5 Mandamientos Minimalistas:
1. **Un solo propósito principal por pantalla/vista:** 
   - En *Login*: exclusivamente usuario, contraseña y botón de ingreso. Sin tablas de auditoría, sin avisos del taller ni selectores secundarios.
   - En *Formularios*: solo los campos estrictamente requeridos para completar la transacción.
   - En *Listados y Dashboards*: métricas sintetizadas (máximo 3 o 4 esenciales) y foco directo en el contenido accionable.
2. **Eliminación total del "ruido administrativo":**
   - Prohibido exponer códigos de especificación técnica interna (p. ej. `RF-01`, `RF-15`, `RF-35`, hashes SHA-256 o tokens criptográficos) en la interfaz regular de usuario.
   - Prohibido duplicar historiales, paneles de noticias o registros de auditoría en pantallas cuyo objetivo sea otro (ej. pantallas de autenticación o de ingreso rápido).
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

Cualquier nueva pantalla que se genere bajo este sistema debe pertenecer a uno de estos tres arquetipos esenciales:

### Arquetipo A: Pantalla Focal / Autenticación (Basada en `{{DATA:SCREEN:SCREEN_5}}`)
- **Propósito:** Tareas de un único paso donde el usuario solo necesita concentrarse en una acción (Login, Registro puntual, Recuperar Clave, Confirmación de Cita).
- **Estructura:**
  - **Cabecera Minimalista:** Barra fija o alineada superior con el logo institucional (`Mecanica Autron`), badge sutil de estado (ej. "Acceso Seguro SSL") y sin menú de navegación que distraiga.
  - **Tarjeta Central:** Centrada vertical y horizontalmente en el viewport, ancho de `440px` a `480px`, fondo blanco puro, borde `1px solid #E2E8F0`, radio `16px`, padding de `36px` a `40px`.
  - **Contenido Interior:**
    - Icono de acción sobrio en contenedor suave (40x40px).
    - Título claro (22px, SemiBold) + subtítulo breve (14px, muted).
    - Máximo 2 a 3 campos de entrada con etiquetas superiores (`text-sm font-medium text-slate-700`).
    - Botón primario de ancho completo (altura 44px, radio 8px, fondo `#4F46E5`, texto blanco).
    - Enlace secundario discreto de ayuda o recuperación centrado abajo.
  - **Pie de Página Discreto:** Copyright atenuado y enlaces de términos/privacidad en tipografía pequeña (12px, gris neutro).

### Arquetipo B: Formulario de Gestión / Proceso Guiado (Basado en `{{DATA:SCREEN:SCREEN_16}}`)
- **Propósito:** Procesos de solicitud, carga o edición de datos (p. ej. Agendar Cita, Ingreso de Vehículo, Generar Presupuesto).
- **Estructura:**
  - **Cabecera Estándar:** Logo a la izquierda, enlaces limpios a secciones clave y avatar de usuario a la derecha.
  - **Contenedor Principal:** Ancho máximo `1200px` a `1280px`, centrado.
  - **Encabezado de Página:** Título de la acción y breadcrumbs ligeros.
  - **Distribución Bicolumna (65% / 35%):**
    - *Columna Izquierda (Flujo):* Pasos ordenados (1, 2, 3) con tarjetas de selección limpias, calendarios compactos y campos accesibles sin atiborrar de texto.
    - *Columna Derecha (Resumen Dinámico):* Tarjeta blanca fija con el resumen de la selección en curso, estado actual y botón de confirmación o contacto rápido.

### Arquetipo C: Panel de Monitoreo / Dashboard Limpio
- **Propósito:** Visualización de avances, órdenes de trabajo o expedientes técnicos.
- **Estructura:**
  - Fila superior de **KPIs Sintetizados (3 o 4 tarjetas máximo)** con métricas en números grandes y claros, acompañadas de micro-dots de tendencia.
  - Bloque central con tarjetas de estado o stepper horizontal simplificado (indicador *"Dot + Label"*).
  - Tabla de registros maestra: cabecera gris suave (`#F8FAFC`), filas aireadas (54-58px de alto), búsqueda simple y estados en badges sutiles sin colores estridentes.

---

## 4. Componentes Estándar Reutilizables

### 4.1 Campo de Entrada (`FormField / Input`)
```html
<div class="space-y-1.5">
  <label class="block text-sm font-medium text-slate-700">Usuario o Correo Corporativo</label>
  <div class="relative">
    <input type="text" class="w-full h-11 px-3.5 rounded-lg border border-slate-200 bg-white text-slate-800 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-colors" placeholder="usuario@autron.es" />
  </div>
</div>
```

### 4.2 Botón Primario Minimalista (`Button Primary`)
```html
<button class="w-full h-11 px-5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm flex items-center justify-center gap-2 shadow-sm transition-all duration-150">
  <span>Iniciar Sesión</span>
  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg>
</button>
```

### 4.3 Badge de Estado Semántico Ligero (`StatusBadge`)
```html
<!-- Éxito / Operativo -->
<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-100">
  <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
  <span>Confirmado</span>
</span>

<!-- En Espera / Revisión -->
<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-100">
  <span class="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
  <span>En Proceso</span>
</span>
```

---

## 5. Plantilla de Instrucción (Prompt Boilerplate) para Generar Nuevas Pantallas

Copia y utiliza el siguiente bloque cada vez que solicites a Stitch generar o modificar una nueva pantalla en este estilo:

```text
Genera la siguiente pantalla para el sistema "Mecánica Autron" aplicando estrictamente el ESTÁNDAR MINIMALISTA (v3.0):

REGLAS DE DISEÑO OBLIGATORIAS:
1. Referencia visual: Seguir la estética limpia, sin sobrecarga cognitiva y aireada de {{DATA:SCREEN:SCREEN_5}} y {{DATA:SCREEN:SCREEN_16}}.
2. Paleta cromática: Índigo (#4F46E5) como acento de acción, fondo de página #F8FAFC, tarjetas en blanco puro (#FFFFFF) con bordes finos de 1px solid #E2E8F0. Sin sombras pesadas ni degradados saturados.
3. Cero sobrecarga visual: Eliminar por completo códigos normativos internos (como RF-XX, hashes, sellos redundantes), no incluir widgets ni historiales fuera de contexto.
4. Jerarquía y foco: Contener únicamente la información y acciones esenciales para el propósito específico de esta pantalla.
5. Tipografía y componentes: Usar Inter/Manrope con inputs de 44px de altura, radios de 8px en controles y tarjetas con padding generoso (24px a 36px).
6. Idioma: Español.

ESPECIFICACIÓN DE LA PANTALLA:
- Nombre / Propósito: [Ejemplo: Detalle de Orden de Trabajo / Registro de Cliente / etc.]
- Arquetipo: [Arquetipo A: Pantalla Focal / Arquetipo B: Proceso Guiado / Arquetipo C: Monitoreo Limpio]
- Elementos esenciales: [Listar los 3 o 4 datos/acciones estrictamente necesarios]
```

---

## 6. Lista de Verificación (Checklist de Calidad)

Antes de considerar terminada una pantalla generada:
- [ ] ¿La pantalla contiene **solo** lo necesario para su función inmediata?
- [ ] ¿Se eliminaron todos los códigos crípticos, etiquetas normativas y tablas auxiliares innecesarias?
- [ ] ¿Las tarjetas y contenedores tienen padding amplio y bordes limpios sin sombras agresivas?
- [ ] ¿El botón de acción primaria resalta inequívocamente en color índigo `#4F46E5`?
- [ ] ¿El usuario puede entender el propósito de la pantalla en menos de 3 segundos sin fatiga visual?
