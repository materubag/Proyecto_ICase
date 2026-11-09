# Arquitectura

| Componente | Ubicación | Responsabilidad |
| --- | --- | --- |
| React y Vite | `frontend/` | Revisión de requisitos, modelos y renderizado Mermaid |
| Express | `backend/src/app.js` | Middleware, documentación HTTP y montaje de rutas |
| Rutas y controladores | `backend/src/routes/`, `controllers/` | Entrada HTTP y respuestas |
| Servicios | `backend/src/services/` | Análisis, revisión, diagramas, cambios e integraciones |
| Prisma y PostgreSQL | `backend/prisma/schema.prisma` | Persistencia, versiones y relaciones |
| Transcripción | `whisper/` e integraciones configuradas | Procesamiento de audio según el flujo habilitado |

La UI consume `/api`. Los controladores delegan en servicios; Prisma conserva el estado estructurado. Los proveedores de IA proponen candidatos y la revisión humana decide su incorporación. El flujo de ingeniería genera desde modelos aprobados; el servicio de diagramas asistidos también usa contexto documental y tiene un ciclo de persistencia distinto. Mermaid es una representación y no sustituye los datos estructurados.

Ver [integraciones externas](integrations.md) para el flujo de comunicación con modelos y [ingeniería de prompts](prompts.md) para las diferencias entre generadores y adaptadores.

El punto de entrada es `backend/src/server.js`; la aplicación Express exportada permite pruebas HTTP sin ejecutar ese servidor. Las rutas se montan desde `backend/src/routes/index.js`; ingeniería tiene su router anidado bajo proyectos.

Los servicios externos dependen de configuración y disponibilidad. Las pruebas con fixtures no verifican conectividad real con proveedores.
