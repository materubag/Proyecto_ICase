# 📘 Guía Maestra: Implementación Híbrida (Claude 3.5 + GPT-4o mini) y Generación de Código Paso a Paso

Este documento especifica en detalle **todo lo que se debe modificar en el código de iCASE** para habilitar la arquitectura híbrida multi-modelo y describe la **metodología de generación de código paso a paso** para garantizar aplicaciones 100% funcionales y desplegables en Docker.

---

## 🏗️ PARTE 1: Archivos a Modificar y Crear en iCASE

Para habilitar la orquestación híbrida en el proyecto actual (`c:\Users\melcu\Desktop\Icase3\Proyecto_ICase`), se intervienen únicamente los siguientes archivos:

```
backend/
├── .env                                       <-- [MODIFICAR] Claves de API (OpenAI y Anthropic)
├── src/
│   ├── config/
│   │   └── env.js                             <-- [MODIFICAR] Variables de entorno reconocidas
│   └── services/
│       ├── ai/
│       │   ├── AnthropicProvider.js           <-- [CREAR] Cliente nativo de Claude 3.5 Sonnet
│       │   ├── HybridPipelineRouter.js        <-- [CREAR] Enrutador inteligente por fases
│       │   └── AIService.js                   <-- [MODIFICAR] Registrar 'anthropic' e 'hybrid'
│       └── codegen/
│           └── codeGenerator.service.js       <-- [MODIFICAR] Soporte de generación incremental paso a paso
frontend/
└── src/
    └── pages/
        ├── ProjectCodeGen.jsx                 <-- [MODIFICAR] Stepper interactivo y selector de proveedor híbrido
        └── ProjectEngineering.jsx             <-- [MODIFICAR] Selector de proveedor en Chat IA
```

---

### 1.1 Configuración de Variables de Entorno (`.env` y `backend/src/config/env.js`)

#### En `.env`:
```env
# Proveedor GPT-4o mini (OpenAI)
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
OPENAI_MODEL=gpt-4o-mini

# Proveedor Claude 3.5 Sonnet (Anthropic)
ANTHROPIC_API_KEY=sk-ant-api03-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
ANTHROPIC_MODEL=claude-3-5-sonnet-20241022

# Proveedor por defecto para el pipeline
DEFAULT_AI_PIPELINE=hybrid
```

#### En `backend/src/config/env.js`:
Agregar la lectura de las nuevas variables:
```javascript
ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || null,
ANTHROPIC_MODEL: process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022',
DEFAULT_AI_PIPELINE: process.env.DEFAULT_AI_PIPELINE || 'hybrid',
```

---

### 1.2 Proveedor Nativo de Anthropic (`backend/src/services/ai/AnthropicProvider.js`)
* Realiza llamadas HTTP nativas con `fetch` a la API oficial de Anthropic (`https://api.anthropic.com/v1/messages`), sin necesidad de añadir librerías pesadas al contenedor.

```javascript
const AIProvider = require('./AIProvider');
const env = require('../../config/env');

class AnthropicProvider extends AIProvider {
  constructor() {
    super();
    this.apiKey = env.ANTHROPIC_API_KEY;
    this.model = env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022';
  }

  async executePrompt({ system, prompt, maxTokens = 4096, temperature = 0.2 }) {
    if (!this.apiKey) {
      throw new Error('ANTHROPIC_API_KEY no está configurada en el archivo .env');
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: maxTokens,
        temperature,
        system: system || 'Eres un arquitecto de software experto en iCASE. Responde estrictamente en JSON válido.',
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!response.ok) {
      const errBody = await response.text();
      throw new Error(`Anthropic HTTP ${response.status}: ${errBody.slice(0, 300)}`);
    }

    const data = await response.json();
    const content = data.content?.[0]?.text || '';
    
    // Extracción limpia de JSON
    const jsonMatch = content.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error('Claude no devolvió un JSON válido en la respuesta');
    
    return {
      data: JSON.parse(jsonMatch[0]),
      usage: data.usage,
      model: this.model
    };
  }
}

module.exports = AnthropicProvider;
```

---

### 1.3 Enrutador Híbrido (`backend/src/services/ai/HybridPipelineRouter.js`)
* Coordina qué modelo ejecuta cada paso exacto del pipeline:

```javascript
const OpenAIProvider = require('./OpenAIProvider');
const AnthropicProvider = require('./AnthropicProvider');

class HybridPipelineRouter {
  constructor() {
    this.fastProvider = new OpenAIProvider();       // GPT-4o mini (Rápido, económico, estructural)
    this.reasoningProvider = new AnthropicProvider(); // Claude 3.5 Sonnet (Razonamiento crítico y contratos)
  }

  /**
   * Enruta la solicitud según la fase del proyecto
   * @param {string} phase - FASE_1_REQUERIMIENTOS | FASE_2_MODELADO | FASE_4_OPENAPI | FASE_5_BACKEND | FASE_6_FRONTEND
   */
  async executePhase(phase, payload) {
    switch (phase) {
      case 'FASE_1_EXTRACCION':
        // Lectura de texto masivo -> GPT-4o mini
        return await this.fastProvider.extractDocumentBatch(payload);

      case 'FASE_1_REFINAMIENTO_ACTORES':
        // Asignación de Actores, Casos de Uso y Criterios Gherkin -> Claude 3.5 Sonnet
        return await this.reasoningProvider.executePrompt({
          system: 'Eres un Analista de Requerimientos Senior. Asigna a cada requerimiento su Actor exacto y criterios Gherkin.',
          prompt: JSON.stringify(payload)
        });

      case 'FASE_2_MODELADO_ER':
        // Entidades SQL y sintaxis Mermaid -> GPT-4o mini
        return await this.fastProvider.analyzeProject(payload);

      case 'FASE_4_SWAGGER_CONTRACT':
        // Contrato canónico OpenAPI / Swagger -> Claude 3.5 Sonnet
        return await this.reasoningProvider.executePrompt({
          system: 'Eres un Arquitecto de APIs REST. Genera el openapi.json estricto para las entidades y requerimientos dados.',
          prompt: JSON.stringify(payload),
          maxTokens: 6000
        });

      case 'FASE_5_BACKEND_CODE':
        // Modelos y controladores Express -> GPT-4o mini
        return await this.fastProvider.extractDocumentBatch(payload);

      case 'FASE_6_FRONTEND_CODE':
        // Vistas React integradas a Swagger -> Claude 3.5 Sonnet
        return await this.reasoningProvider.executePrompt({
          system: 'Eres un Desarrollador Frontend Senior. Genera componentes React que consuman la API REST de Swagger.',
          prompt: JSON.stringify(payload)
        });

      default:
        return await this.fastProvider.analyzeProject(payload);
    }
  }
}

module.exports = new HybridPipelineRouter();
```

---

## 🚀 PARTE 2: Metodología de Generación de Código Paso a Paso

El proceso se divide en 7 pasos estancos con **Aprobación Humana Obligatoria** en cada compuerta antes de avanzar:

```mermaid
flowchart TD
    P1["Paso 1: Requerimientos & Actores\n(Extracción GPT-4o mini + Refinamiento Claude)"] --> G1{"👤 Aprobación 1"}
    G1 -- Visto Bueno --> P2["Paso 2: Modelado de Datos & Casos de Uso\n(GPT-4o mini: E/R Mermaid y tablas SQL)"]
    P2 --> G2{"👤 Aprobación 2"}
    G2 -- Visto Bueno --> P3["Paso 3: Navegación & Mockups UI\n(GPT-4o mini: Wireframes HTML/Tailwind)"]
    P3 --> G3{"👤 Aprobación 3"}
    G3 -- Visto Bueno --> P4["Paso 4: Contrato Canónico Swagger / OpenAPI\n(Claude 3.5 Sonnet: openapi.json)"]
    P4 --> G4{"👤 Aprobación 4\n(Prueba interactiva en Swagger UI)"}
    G4 -- Visto Bueno --> P5["Paso 5: Generación del Backend Express\n(GPT-4o mini: Rutas, controladores y BD real)"]
    P5 --> G5{"👤 Aprobación 5"}
    G5 -- Visto Bueno --> P6["Paso 6: Generación del Frontend React\n(Claude 3.5 Sonnet: Componentes conectados a la API)"]
    P6 --> G6{"👤 Aprobación 6"}
    G6 -- Visto Bueno --> P7["Paso 7: Docker Compose & Verificación\n(GPT-4o mini: Orquestación completa y despliegue)"]
    P7 --> Ready(["🏁 Aplicación 100% Funcional Ejecutable"])
```

---

### Paso 1: Ingesta del PDF, Requerimientos y Asignación de Actores
* **Modelos involucrados:**
  1. `GPT-4o mini`: Lee el texto del PDF mediante `PdfExtractor.js` y extrae la lista preliminar de requerimientos y menciones de usuarios sin filtrar.
  2. `Claude 3.5 Sonnet`: Clasifica los Actores (`ACT-01: Administrador`, `ACT-02: Técnico`), asigna a cada requerimiento su actor responsable, define las entidades de base de datos sugeridas y redacta los criterios de aceptación en formato Gherkin (*Dado que... Cuando... Entonces...* bajo la norma ISO/IEC/IEEE 29148).
* **Entrada:** Archivo PDF o especificación textual.
* **Artefacto de salida canónico (`icase.spec.json`):**
  ```json
  {
    "proyecto": "Autron5 - Sistema de Mantenimiento",
    "metricas": {
      "totalRequerimientos": 12,
      "totalActores": 3,
      "totalEntidadesSugeridas": 6
    },
    "actores": [
      { "id": "ACT-01", "nombre": "Supervisor", "rol": "ADMIN", "descripcion": "Aprueba órdenes de trabajo y visualiza reportes." },
      { "id": "ACT-02", "nombre": "Técnico de Campo", "rol": "OPERADOR", "descripcion": "Registra fallas y horas de mantenimiento." }
    ],
    "requerimientos": [
      {
        "codigo": "RF-01",
        "nombre": "Registro de Fallas en Maquinaria",
        "prioridad": "ALTA",
        "actorAsignado": "Técnico de Campo",
        "actorId": "ACT-02",
        "criterioGherkin": "Dado un Técnico autenticado, cuando selecciona la máquina e ingresa la descripción del fallo, el sistema crea la orden de trabajo.",
        "entidadesRelacionadas": ["Maquina", "Incidencia", "OrdenTrabajo"]
      },
      {
        "codigo": "RF-02",
        "nombre": "Aprobación de Órdenes de Mantenimiento",
        "prioridad": "MEDIA",
        "actorAsignado": "Supervisor",
        "actorId": "ACT-01",
        "criterioGherkin": "Dado un Supervisor en su panel, cuando aprueba la orden, el sistema cambia su estado a AUTORIZADA y notifica al técnico.",
        "entidadesRelacionadas": ["OrdenTrabajo", "Usuario"]
      }
    ],
    "preguntasAclaracion": [
      "¿Qué sucede si un técnico registra una máquina que ya tiene una orden abierta?",
      "¿Se requiere firma digital o confirmación estándar?"
    ]
  }
  ```
* **Lo que se visualiza en la interfaz de iCASE:**
  * **Pantalla Resumen:** Tarjetas de métricas actualizadas (Requerimientos, Actores, Entidades y Pantallas).
  * **Pantalla Requerimientos:**
    * Píldora superior (`12 especificados`).
    * Conmutador tipo cápsula `[Requisitos | Candidatos por Revisar | Actores]`.
    * Tabla interactiva con badges de prioridad y el actor asignado en una etiqueta azul (`👤 Técnico de Campo`).
    * Cuadro de preguntas de aclaración para resolver ambigüedades con un clic.
* **Consumo de tokens:** ~4,000 entrada / ~2,500 salida (~**$0.045 USD**).
* **Tu Aprobación en iCASE:** Revisas la tabla en la pantalla **Requerimientos**. Puedes editar o reasignar cualquier actor directamente en el desplegable y pulsar **"Aprobar Requerimientos"** para avanzar al Paso 2.

---

### Paso 2: Modelado Relacional y Diagrama de Casos de Uso
* **Modelo involucrado:** `GPT-4o mini`.
* **Entrada:** Exclusivamente el array de requerimientos y entidades aprobadas del Paso 1.
* **Acciones:**
  * Define los campos y tipos de datos SQL (`UUID`, `VARCHAR`, `TIMESTAMP`, llaves foráneas).
  * Genera el diagrama de **Casos de Uso** conectando cada Actor con sus requerimientos correspondientes.
  * Genera el diagrama **Entidad–Relación** y de **Clases POO** en sintaxis Mermaid.
* **Consumo de tokens:** ~3,000 entrada / ~1,800 salida (~**$0.0018 USD**).
* **Tu Aprobación en iCASE:** En la pantalla **Modelado**, visualizas los diagramas interactivos en el lienzo blanco. Confirmas que las tablas y relaciones sean correctas.

---

### Paso 3: Árbol de Navegación y Wireframes Visuales
* **Modelo involucrado:** `GPT-4o mini`.
* **Entrada:** Requerimientos aprobados + Actores del sistema.
* **Acciones:**
  * Define la jerarquía de pantallas (Login, Dashboard, Listados, Formularios de creación, Modales).
  * Genera la estructura HTML y estilos Tailwind CSS de cada vista.
* **Consumo de tokens:** ~3,500 entrada / ~2,500 salida (~**$0.0022 USD**).
* **Tu Aprobación en iCASE:** En las pantallas **Navegación** y **Mockups**, navegas entre las vistas para comprobar que los formularios contengan los campos acordados.

---

### Paso 4: Contrato Canónico Swagger / OpenAPI (El Pivote Central)
> [!IMPORTANT]
> Éste es el paso que garantiza que el backend y el frontend se entiendan sin errores.
* **Modelo involucrado:** `Claude 3.5 Sonnet`.
* **Entrada:** Tablas de base de datos (Paso 2) + Pantallas y requerimientos (Pasos 1 y 3).
* **Acciones:**
  * Escribe el archivo unificado `openapi.json` con estándares OpenAPI 3.0.
  * Para cada endpoint especifica: Métodos (`GET`, `POST`, `PUT`, `DELETE`), DTOs de entrada y respuestas HTTP (`200 OK`, `201 Created`, `400 Bad Request`, `404 Not Found`).
* **Consumo de tokens:** ~5,000 entrada / ~4,000 salida (~**$0.075 USD**).
* **Tu Aprobación en iCASE:** En la pantalla **Arquitectura**, abres el **Swagger UI interactivo**. Puedes probar cada endpoint individualmente con el botón *"Try it out"* y pulsar **"Aprobar especificación"**.

---

### Paso 5: Generación del Backend Funcional (Express + BD Real)
* **Modelo involucrado:** `GPT-4o mini`.
* **Entrada:** El archivo aprobado `openapi.json` + los modelos de base de datos.
* **Acciones:**
  * Genera los modelos ORM (`Sequelize` o `Prisma`).
  * Genera los controladores de Express que leen y guardan datos en PostgreSQL real.
  * Genera las rutas y validaciones que coinciden al 100% con las rutas del Swagger.
* **Consumo de tokens:** ~7,000 entrada / ~8,000 salida (~**$0.0058 USD**).
* **Tu Aprobación en iCASE:** Verificas que la suite de rutas no tenga errores de sintaxis y das tu visto bueno para la generación del cliente.

---

### Paso 6: Generación del Frontend React
* **Modelo involucrado:** `Claude 3.5 Sonnet`.
* **Entrada:** El archivo aprobado `openapi.json` + los mockups de las pantallas del Paso 3.
* **Acciones:**
  * Genera los componentes React (Vite + Tailwind CSS).
  * Conecta cada formulario con llamadas `fetch` o `axios` dirigidas **exactamente a las URLs definidas en el Swagger**.
  * Maneja estados de carga (`loading`), mensajes de confirmación y tablas dinámicas.
* **Consumo de tokens:** ~6,500 entrada / ~8,500 salida (~**$0.147 USD**).
* **Tu Aprobación en iCASE:** Inspeccionas los componentes en el visor de código de la pantalla **Código**.

---

### Paso 7: Despliegue en Docker y Auditoría de Puerta de Calidad
* **Modelo involucrado:** `GPT-4o mini`.
* **Acciones:**
  * Genera los `Dockerfile` optimizados para backend y frontend.
  * Genera el archivo `docker-compose.yml` que enlaza:
    * `db`: PostgreSQL 16 con healthcheck y volumen persistente.
    * `backend`: Servidor Express con migración automática de tablas.
    * `frontend`: Aplicación React compilada y servida en Nginx/Vite.
  * Ejecuta la auditoría `screenBindingAudit.js` (certifica que ninguna pantalla llame a un endpoint inexistente).
* **Consumo de tokens:** ~3,500 entrada / ~1,500 salida (~**$0.0014 USD**).

---

## 💰 Presupuesto con tus $6 USD

| Etapa | Modelo | Costo Estimado (USD) |
| :--- | :---: | :---: |
| 1. Requerimientos & Actores | GPT-4o mini + Claude Sonnet | $0.045 |
| 2. Modelado de BD & E/R | GPT-4o mini | $0.002 |
| 3. Navegación & Mockups UI | GPT-4o mini | $0.002 |
| 4. Contrato OpenAPI / Swagger | Claude 3.5 Sonnet | $0.075 |
| 5. Backend Express & SQL | GPT-4o mini | $0.006 |
| 6. Frontend React UI | Claude 3.5 Sonnet | $0.147 |
| 7. Docker & Verificación | GPT-4o mini | $0.001 |
| **TOTAL POR GENERACIÓN COMPLETA** | | **~$0.278 USD** |

* **Con $6.00 USD de saldo:** Tienes crédito suficiente para generar entre **21 y 24 proyectos completos**, o realizar cientos de ajustes y regeneraciones individuales.

---

## 🚀 Ejecución Final de la Aplicación

Al finalizar el paso 7, la aplicación se descarga o se levanta ejecutando un único comando en la terminal del proyecto generado:

```bash
docker compose up --build -d
```

* **Frontend Web:** `http://localhost:3000` (Interfaz visual completa con datos reales).
* **Backend API & Swagger:** `http://localhost:8080/api/docs` (Documentación viva para probar endpoints).
* **Base de Datos:** `PostgreSQL` en el puerto `5432` con tablas y migraciones aplicadas.

