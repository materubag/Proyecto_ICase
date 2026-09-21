# ICASE — Integrated Computer-Aided Software Engineering

Plataforma universitaria para la automatización, modelado y diseño asistido de proyectos de software en la asignatura de **Desarrollo Asistido por Software (DAS)**.

---

## 1. Descripción y Objetivo

ICASE es una herramienta de ingeniería de software asistida por computadora enfocada en transformar la especificación narrativa o requerimientos de negocio de un proyecto en una arquitectura formal y artefactos ejecutables.

### Flujo Inteligente Implementado (Paso 3):
```
DESCRIPCIÓN DEL PROYECTO
           ↓
ANÁLISIS ESTRUCTURADO (AIService)
           ↓
REQUISITOS + ACTORES + ENTIDADES + PANTALLAS + NAVEGACIÓN + ARQUITECTURA
           ↓
    Persistencia Transaccional en PostgreSQL (Reemplazo sin duplicados)
           ↓
┌──────────────────────┬──────────────────────┬──────────────────────┐
│  Modelo de Datos ER  │      Prototipos      │  Árbol de Navegación │
│  (Mermaid erDiagram) │ (Render Controlado)  │ (Mermaid flowchart)  │
└──────────────────────┴──────────────────────┴──────────────────────┘
                                  ↓
                        Arquitectura por Capas
                        (Mermaid flowchart)
```

---

## 2. Diagrama de Arquitectura de Proveedores de IA (Paso 3)

```mermaid
flowchart TB
    subgraph FrontendTier ["Frontend SPA (React + Vite)"]
        UI["Interfaz Minimalista SPA"]
        MermEngine["Motor Mermaid.js (ER, Navegación, Arquitectura)"]
        MockupRenderer["Renderizador Controlado de Prototipos"]
    end

    subgraph BackendTier ["Backend API (Node.js + Express)"]
        Router["REST Router (/api/projects/:id/analyze)"]
        AIService["AIService (Punto Único de Acceso / Factory)"]
        Validator["Validador Estricto de Contrato e Integridad"]
        
        subgraph Providers ["Capa Desacoplada de Proveedores"]
            MockP["MockAIProvider (Activo / Autónomo)"]
            GeminiP["GeminiProvider (Fase 2)"]
            OllamaP["OllamaProvider (Fase 2 Local)"]
            OpenAIP["OpenAIProvider (Fase 2)"]
            N8nP["N8nProvider (Fase 2 Webhook)"]
        end
    end

    subgraph PersistenceTier ["Persistencia Relacional (PostgreSQL + Prisma)"]
        Prisma["Prisma ORM (Model First)"]
        Postgres[("PostgreSQL 16 Engine")]
    end

    UI -->|POST /analyze| Router
    Router --> AIService
    AIService --> Providers
    Providers --> MockP
    MockP --> Validator
    Validator -->|Transacción Atómica| Prisma
    Prisma --> Postgres
    Prisma -.->|JSON Estructurado| UI
```

---

## 3. Contrato Único de Respuesta de IA

Cualquier proveedor debe exponer el método:
```javascript
analyzeProject(input)
```
Y retornar exclusivamente el contrato JSON canónico validado por `ai.contract.validator.js`:

```json
{
  "project": {
    "name": "Sistema de Biblioteca",
    "description": "Sistema para administrar libros, usuarios y préstamos."
  },
  "actors": [
    {
      "id": "ACT-01",
      "name": "Bibliotecario",
      "description": "Administra catálogo y préstamos."
    }
  ],
  "requirements": [
    {
      "code": "RF-01",
      "name": "Catálogo de Libros",
      "description": "Permite registrar y buscar libros.",
      "type": "FUNCIONAL",
      "priority": "ALTA",
      "actorIds": ["ACT-01"],
      "dependencies": []
    }
  ],
  "entities": [
    {
      "id": "ENT-01",
      "name": "Libro",
      "description": "Ejemplar bibliográfico.",
      "attributes": [
        { "name": "id", "type": "Int" },
        { "name": "isbn", "type": "String" }
      ]
    }
  ],
  "relationships": [
    {
      "id": "REL-01",
      "source": "Usuario",
      "target": "Prestamo",
      "cardinality": "1:N",
      "description": "Un usuario realiza préstamos."
    }
  ],
  "screens": [
    {
      "id": "SCR-01",
      "name": "Dashboard Principal",
      "description": "Resumen operativo.",
      "route": "/dashboard",
      "purpose": "Control central.",
      "components": [
        { "type": "heading", "label": "Panel de Control" },
        { "type": "card", "label": "Préstamos Activos", "description": "Resumen" },
        { "type": "button", "label": "Nuevo Préstamo" }
      ]
    }
  ],
  "navigation": [
    { "from": "Inicio de Sesión", "to": "Dashboard Principal", "action": "Login" }
  ],
  "architecture": {
    "style": "Clean Architecture en 3 Capas",
    "frontend": "React 18 + Vite SPA",
    "backend": "Node.js + Express REST API",
    "database": "PostgreSQL 16",
    "components": [],
    "connections": []
  }
}
```

---

## 4. Estructura del Código

```text
Proyecto_ICase/
├── docker-compose.yml          # Orquestación de PostgreSQL, Backend y Frontend
├── .env.example                # Plantilla de variables de entorno
├── .env                        # Variables locales
├── README.md                   # Documentación global
│
├── backend/
│   ├── Dockerfile
│   ├── docker-entrypoint.sh    # Sincronización automática de Prisma al iniciar
│   ├── package.json
│   ├── prisma/
│   │   └── schema.prisma       # Fuente de verdad: Project, Requirement, Actor, Entity,
│   │                           # EntityAttribute, EntityRelationship, Screen,
│   │                           # ScreenComponent, NavigationNode, Architecture
│   ├── tests/
│   │   └── ai.test.js          # Suite de pruebas automatizadas de IA
│   └── src/
│       ├── config/
│       │   ├── env.js          # Variables de entorno y timeouts
│       │   └── prisma.js       # Cliente Prisma singleton
│       ├── controllers/
│       │   ├── ai.controller.js
│       │   ├── project.controller.js
│       │   ├── requirement.controller.js
│       │   ├── actor.controller.js
│       │   └── mockup.controller.js
│       ├── routes/
│       ├── services/
│       │   ├── ai/
│       │   │   ├── AIProvider.js              # Clase base común (analyzeProject)
│       │   │   ├── AIService.js               # Factory y orquestador transaccional
│       │   │   ├── MockAIProvider.js          # Proveedor mock contextual
│       │   │   ├── GeminiProvider.js          # Proveedor Google Gemini
│       │   │   ├── OllamaProvider.js          # Proveedor Ollama local
│       │   │   ├── OpenAIProvider.js          # Proveedor OpenAI
│       │   │   ├── N8nProvider.js             # Proveedor n8n webhook
│       │   │   └── ai.contract.validator.js   # Validador de esquema y referencias
│       │   ├── project.service.js
│       │   ├── requirement.service.js
│       │   ├── actor.service.js
│       │   └── mockup/
│       ├── app.js
│       └── server.js
│
├── frontend/
│   ├── Dockerfile
│   ├── nginx.conf              # Reverse proxy de /api hacia el backend Docker
│   ├── package.json
│   ├── vite.config.js
│   └── src/
│       ├── api/                # Clientes REST (projects, requirements, actors, ai)
│       ├── components/
│       │   ├── common/         # Navbar, Modal
│       │   ├── diagrams/       # MermaidDiagram reactivo
│       │   └── mockup-renderer/# Renderizador controlado de prototipos (sin dangerouslySetInnerHTML)
│       ├── pages/
│       │   ├── ProjectsDashboard.jsx
│       │   ├── ProjectDetail.jsx
│       │   ├── ProjectSummary.jsx      # Resumen y botón [ Analizar proyecto ]
│       │   ├── ProjectRequirements.jsx # CRUD manual de requisitos
│       │   ├── ProjectActors.jsx       # CRUD manual de actores
│       │   ├── ProjectModel.jsx        # Visualizador ER Mermaid
│       │   ├── ProjectPrototype.jsx    # Visualizador de mockups controlados
│       │   ├── ProjectNavigation.jsx   # Árbol de navegación Mermaid
│       │   └── ProjectArchitecture.jsx # Arquitectura Mermaid
│       ├── utils/
│       │   └── mermaidGenerators.js    # Transformadores determinísticos sin IA
│       ├── App.jsx
│       └── index.css
│
└── n8n/
    └── README.md               # Guía técnica para futura integración con n8n
```

---

## 5. Variables de Entorno

```env
# Base de Datos PostgreSQL
POSTGRES_USER=icase_user
POSTGRES_PASSWORD=icase_password
POSTGRES_DB=icase_db
DATABASE_URL=postgresql://icase_user:icase_password@localhost:5432/icase_db?schema=public

# Servidor Backend
PORT=8080
NODE_ENV=development
FRONTEND_URL=http://localhost:3000

# Selección de Proveedor de IA (mock | gemini | ollama | openai | n8n)
AI_PROVIDER=mock

# Configuración Gemini (Fase 2)
GEMINI_API_KEY=
GEMINI_MODEL=gemini-1.5-pro

# Configuración Ollama Local (Fase 2)
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3
OLLAMA_TIMEOUT=60000

# Configuración OpenAI (Fase 2)
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o

# Configuración n8n Workflow Automation (Fase 2)
N8N_BASE_URL=
N8N_ANALYZE_WEBHOOK=
N8N_TIMEOUT=30000
```

---

## 6. Ejecución con Docker Compose

```bash
docker compose up --build -d
```

- **Frontend**: `http://localhost:3000`
- **Backend API**: `http://localhost:8080/api/health`
- **PostgreSQL**: `localhost:5432`

---

## 7. Ejecución de Pruebas Automatizadas

Para validar los 8 criterios de proveedores, contratos, validaciones e integridad referencial:

```bash
cd backend
node tests/ai.test.js
```
