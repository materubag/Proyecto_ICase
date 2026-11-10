# 📑 Especificación del Flujo Refinado: Aprobación Previa de Actores, Relevo de Contexto y Control de Tokens

Este documento detalla la arquitectura de **carrera de relevos por artefactos JSON**, el orden estricto de aprobación (primero Actores, luego Requerimientos), la repartición exacta de contexto entre **Claude 3.5 Sonnet** y **GPT-4o mini**, y la justificación matemática del bajo consumo de tokens.

---

## 🧭 1. Principio Fundamental: Primero Actores, Luego Requisitos

En la ingeniería de software formal (ISO/IEC/IEEE 29148:2018), **no se pueden redactar requerimientos funcionales ni criterios de aceptación sin conocer previamente quién ejecuta la acción**.

```
[PDF del Usuario]
       │
       ▼
┌────────────────────────────────────────────────────────┐
│ PASO 1A: Extracción y Aprobación de ACTORES            │
│ 1. GPT-4o mini extrae menciones de roles del texto.   │
│ 2. Claude 3.5 Sonnet normaliza los roles formales.    │
│ 3. 👤 EL USUARIO APRUEBA LA LISTA DE ACTORES.          │
│    (Los actores quedan CONGELADOS con IDs fijos)      │
└────────────────────────────────────────────────────────┘
       │
       ▼ (Solo viajan los Actores Aprobados + Texto)
┌────────────────────────────────────────────────────────┐
│ PASO 1B: Formulación de REQUERIMIENTOS con Asignación │
│ 1. Claude formula los Requerimientos Funcionales (RF).│
│ 2. Regla estricta: Solo puede asignar actores que     │
│    estén en la lista aprobada del Paso 1A.            │
│ 3. Redacta criterios Gherkin (Dado/Cuando/Entonces).  │
│ 4. 👤 EL USUARIO APRUEBA LA TABLA DE REQUERIMIENTOS.   │
└────────────────────────────────────────────────────────┘
```

---

## 🏃 2. La Carrera de Relevos de Contexto (Paso a Paso)

Ningún modelo acumula historial de chat. Cada modelo recibe únicamente el artefacto JSON estructurado producido y validado en el paso anterior.

---

### 🟢 Paso 1A: Definición y Aprobación de Actores
* **Modelo activo:** `GPT-4o mini` (Lectura masiva) + `Claude 3.5 Sonnet` (Normalización).
* **Contexto de Entrada (Input):** Texto limpio del PDF extraído por `PdfExtractor.js`.
* **Procesamiento:** Detecta palabras clave de usuarios (*"el supervisor autoriza"*, *"los mecánicos reportan"*).
* **Artefacto de Salida (JSON):**
  ```json
  [
    { "id": "ACT-01", "name": "Supervisor de Planta", "role": "ADMIN", "description": "Aprueba órdenes y visualiza auditorías." },
    { "id": "ACT-02", "name": "Técnico Mecánico", "role": "OPERATOR", "description": "Registra averías y horas de trabajo." }
  ]
  ```
* **Compuerta Humana 1A:** En la pantalla **Requerimientos**, entras a la pestaña **`[Actores]`**, revisas o editas la lista y pulsas **"Aprobar Actores"**.

---

### 🟢 Paso 1B: Requerimientos y Criterios Gherkin
* **Modelo activo:** `Claude 3.5 Sonnet`.
* **Contexto de Entrada (Input):**
  1. Texto de las secciones de requisitos del PDF.
  2. **El array de Actores Aprobados en el Paso 1A** (`ACT-01`, `ACT-02`).
* **Instrucción del Sistema:**
  > *"Formula los requerimientos funcionales bajo ISO 29148. Para el campo 'actorId', utiliza EXCLUSIVAMENTE uno de los IDs de los actores aprobados. Prohibido inventar nuevos actores."*
* **Artefacto de Salida (`icase.spec.json`):**
  ```json
  {
    "requirements": [
      {
        "code": "RF-01",
        "name": "Registro de Incidencia Mecánica",
        "actorId": "ACT-02",
        "actorName": "Técnico Mecánico",
        "gherkin": "Dado un Técnico autenticado en planta, cuando ingresa el código de máquina y falla, el sistema genera la orden de trabajo.",
        "suggestedEntities": ["Incidencia", "Maquina", "OrdenTrabajo"]
      }
    ]
  }
  ```
* **Compuerta Humana 1B:** En la pestaña **`[Requisitos]`**, revisas la tabla con los badges azules de cada actor y pulsas **"Aprobar Requerimientos"**.

---

### 🟢 Paso 2: Modelado Relacional (E/R) y Casos de Uso
* **Modelo activo:** `GPT-4o mini`.
* **Contexto de Entrada (Input):**
  * **NO** se le envía el PDF original.
  * Solo se le envía el `icase.spec.json` (Actores aprobados + Requisitos con `suggestedEntities`).
* **Artefacto de Salida:**
  * Esquema de tablas SQL (campos, tipos `UUID`, `VARCHAR`, llaves foráneas `1:N`, `N:M`).
  * Sintaxis Mermaid de **Casos de Uso**:
    ```mermaid
    graph LR
        ACT_02(("👤 Técnico Mecánico")) --- RF_01(["CU-01: Registrar Incidencia Mecánica"])
        ACT_01(("👤 Supervisor de Planta")) --- RF_02(["CU-02: Aprobar Orden"])
    ```
* **Compuerta Humana 2:** En la pantalla **Modelado**, visualizas los diagramas interactivos y pulsas **"Aprobar Modelado"**.

---

### 🟢 Paso 3: Navegación y Wireframes Visuales
* **Modelo activo:** `GPT-4o mini`.
* **Contexto de Entrada (Input):** Actores aprobados + Requerimientos aprobados.
* **Artefacto de Salida:** Árbol de navegación y código HTML/Tailwind para cada pantalla.
* **Compuerta Humana 3:** En **Navegación** y **Mockups**, revisas la interfaz y pulsas **"Aprobar Mockups"**.

---

### 🟢 Paso 4: Contrato Canónico Swagger / OpenAPI (El Pivote Central)
* **Modelo activo:** `Claude 3.5 Sonnet`.
* **Contexto de Entrada (Input):**
  * Esquema SQL aprobado del Paso 2.
  * Pantallas aprobadas del Paso 3.
  * Requerimientos aprobados del Paso 1B.
* **Artefacto de Salida (`openapi.json`):**
  * Especificación OpenAPI 3.0 con endpoints REST estrictos (`POST /api/v1/incidencias`, `GET /api/v1/ordenes`), validaciones de entrada (DTOs) y respuestas (`200 OK`, `400 Bad Request`).
* **Compuerta Humana 4:** En la pantalla **Arquitectura**, pruebas interactivamente los endpoints con el botón *"Try it out"* de Swagger UI y pulsas **"Aprobar especificación"**.

---

### 🟢 Pasos 5 y 6: Generación de Código Paralela y Sincronizada
Al estar aprobado y congelado el `openapi.json`, se dispara la codificación:

1. **Backend (GPT-4o mini):**
   * *Recibe:* `openapi.json` + Esquema SQL.
   * *Genera:* Controladores Express, modelos Sequelize/Prisma y rutas conectadas a PostgreSQL real.
2. **Frontend (Claude 3.5 Sonnet):**
   * *Recibe:* `openapi.json` + Mockups HTML.
   * *Genera:* Componentes React con formularios que apuntan exactamente a las rutas del Swagger.

---

### 🟢 Paso 7: Orquestación Docker y Verificación
* **Modelo activo:** `GPT-4o mini`.
* **Contexto de Entrada (Input):** Estructura de archivos de backend y frontend.
* **Artefacto de Salida:** `docker-compose.yml` que orquesta `db` (Postgres 16), `backend` (Express) y `frontend` (React/Nginx).
* **Ejecución final:** `docker compose up --build -d`.

---

## 💰 3. Análisis Matemático de Consumo y Costo de Tokens

### ¿Por qué NO es un gasto elevado?
En un chat tradicional, el contexto se acumula ($5,000 \rightarrow 15,000 \rightarrow 30,000 \rightarrow 60,000$ tokens en cada mensaje).

En este sistema, cada paso es una **petición independiente (stateless)** que solo transfiere pequeños JSON de 1 a 3 KB:

| Etapa | Operación | Modelo | Tokens Entrada | Tokens Salida | Costo Real (USD) |
| :--- | :--- | :---: | :---: | :---: | :---: |
| **Paso 1A** | Extracción y normalización de Actores | GPT-4o mini + Claude | ~3,500 | ~1,200 | **$0.015** |
| **Paso 1B** | Formulación de Requerimientos y Gherkin | Claude 3.5 Sonnet | ~3,000 | ~2,500 | **$0.046** |
| **Paso 2** | Modelado E/R y Casos de Uso (Mermaid) | GPT-4o mini | ~2,500 | ~2,000 | **$0.002** |
| **Paso 3** | Árbol de Navegación y Wireframes UI | GPT-4o mini | ~3,000 | ~2,500 | **$0.002** |
| **Paso 4** | Contrato central Swagger (`openapi.json`) | Claude 3.5 Sonnet | ~4,500 | ~4,000 | **$0.073** |
| **Paso 5** | Controladores y Rutas de Backend Express | GPT-4o mini | ~7,000 | ~8,000 | **$0.006** |
| **Paso 6** | Componentes React UI conectados al Swagger | Claude 3.5 Sonnet | ~6,000 | ~8,000 | **$0.138** |
| **Paso 7** | `docker-compose.yml` y auditoría de salud | GPT-4o mini | ~3,000 | ~1,500 | **$0.001** |
| **TOTAL** | **Aplicación Completa de Principio a Fin** | | **~32,500** | **~29,700** | **~$0.283 USD** |

### Rendimiento con tus $6.00 USD de saldo:
* **Costo por app completa:** **$0.28 USD** (menos de 30 centavos).
* **Aplicaciones completas posibles:** **$6.00 / $0.28 = ~21 aplicaciones completas**.
* **Iteraciones o ajustes parciales (con GPT-4o mini):** Más de **300 ejecuciones**.

---

## 🛠️ 4. Cambios a Realizar en el Código de iCASE

Para que este flujo opere de forma nativa en tu interfaz:

1. **En `backend/src/services/ai/HybridPipelineRouter.js`:**
   * Agregar la ruta de ejecución `FASE_1A_ACTORES` que devuelve la lista de actores normalizada.
   * Agregar la ruta `FASE_1B_REQUISITOS_CON_ACTORES` que inyecta los actores aprobados al prompt de Claude.

2. **En `frontend/src/pages/ProjectRequirements.jsx`:**
   * Al importar el documento, abrir automáticamente la pestaña `[Actores]`.
   * Colocar un botón primario: **"✓ Aprobar Actores y Continuar a Requisitos"**.
   * Al hacer clic, se guardan los actores en la base de datos y se desbloquea la pestaña `[Requisitos]` con el desplegable restringido a los actores oficiales.

3. **En `frontend/src/pages/ProjectCodeGen.jsx`:**
   * Convertir la barra de progreso en un Stepper interactivo donde el usuario pulsa *"Generar y Aprobar"* en cada fase (Base de datos $\rightarrow$ Swagger $\rightarrow$ Backend $\rightarrow$ Frontend $\rightarrow$ Docker).

