# Configuración y operación

`.env.example` enumera la configuración inicial. `backend/src/config/env.js` define cómo se carga. Usar secretos locales o el gestor de secretos del despliegue.

| Variables | Uso |
| --- | --- |
| `DATABASE_URL`, `POSTGRES_*` | Conexión y credenciales PostgreSQL |
| `PORT`, `FRONTEND_URL`, `VITE_API_URL` | Puertos y URL de los servicios |
| `AI_PROVIDER`, `AI_ANALYSIS_STRATEGY` | Selección y estrategia de análisis |
| `OLLAMA_BASE_URL`, `OLLAMA_MODEL`, `OLLAMA_TIMEOUT` | Proveedor local |
| `OPENAI_API_KEY`, `OPENAI_MODEL` | Proveedor remoto |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | Proveedor documental por defecto |
| `MOCKUP_PROVIDER`, `GOOGLE_STITCH_API_KEY`, `N8N_MOCKUP_WEBHOOK` | Mockups y automatizaciones de diseño |
| `MAX_PDF_SIZE_MB`, `MAX_AUDIO_SIZE_MB`, `N8N_TIMEOUT` | Límites y tiempos |

Consultar [integraciones](integrations.md) para límites efectivos por método, timeouts, respaldos y disponibilidad. Las rutas de fuentes de audio están bloqueadas por política PDF; los adaptadores históricos de transcripción no implican soporte de audio en el flujo actual.

## Diagnóstico

1. Consultar `/api/health`: confirma disponibilidad HTTP, no conectividad con todas las dependencias.
2. Revisar `docker compose logs backend` y el estado de PostgreSQL.
3. Comprobar URLs internas de contenedores y variables del proveedor seleccionado.
4. En análisis asíncronos, consultar el endpoint de estado del trabajo; los trabajos en memoria pueden perderse al reiniciar.

Respaldar PostgreSQL y probar restauraciones antes de cambios de esquema. No incorporar logs con evidencia sensible al repositorio. La API actual requiere controles de acceso y TLS en la infraestructura antes de exponerse a redes no confiables; CORS por sí solo no autentica usuarios.
