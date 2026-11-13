# API y OpenAPI

## Documentación completa

- [Explorador Swagger dentro de MkDocs](api-explorer.md), con contrato y recursos locales.
- [Referencia HTTP](api-reference.md): parámetros, ejemplos, respuestas, artefactos, estados y errores.
- [Catálogo de endpoints](api-catalog.md): inventario completo por recurso.
- [Integraciones externas](integrations.md): Gemini, OpenAI, Ollama, Stitch, n8n y Whisper; credenciales, límites y compatibilidad.
- [Ingeniería de prompts](prompts.md): fases, modelos, plantillas, contratos y evaluación.

## Acceso

| Recurso | URL local |
| --- | --- |
| Estado | `http://localhost:8080/api/health` |
| Swagger UI | `http://localhost:8080/api/docs/` |
| Contrato OpenAPI 3.0 | `http://localhost:8080/api/openapi.json` |

La fuente del contrato es `backend/src/docs/openapi.json`, incluida en la imagen del backend. Swagger UI sirve sus recursos desde las dependencias locales. El servidor relativo `/api` utiliza el mismo origen que el backend.

La interfaz se configura para consulta: las solicitudes que modifican proyectos se ejecutan desde los clientes habituales. No se declara autenticación en el contrato porque las rutas actuales no implementan un middleware de autenticación.

## Convenciones

Las respuestas habituales incluyen `success` y `data`. Los errores centralizados contienen `success: false` y `error.message`; `error.code` puede estar presente. Algunas operaciones tienen formatos particulares y respuestas de trabajo asíncrono.

El contrato incluye un inventario de las rutas existentes y esquemas concretos para salud, proyectos, cargas PDF, análisis asíncrono, diagramas y chat. Las operaciones con objetos abiertos requieren consultar sus controladores y servicios antes de construir un cliente que dependa de campos aún no tipados.

Las cargas utilizan `multipart/form-data`: `file` en extracción/análisis de documentos y `files` para fuentes o archivos de proyecto. Los límites dependen del endpoint. Las rutas de audio deshabilitadas por la política PDF responden rechazo y no se presentan como cargas funcionales.

## Validación

```sh
cd backend
npm run docs:check
```

Al modificar rutas, actualizar el contrato y sus cuerpos, parámetros, códigos y ejemplos. La prueba verifica sintaxis OpenAPI, cobertura de rutas Express y servicio HTTP de Swagger, JSON y recursos estáticos.

Referencias: [Swagger UI](https://swagger.io/docs/open-source-tools/swagger-ui/usage/installation/) y [OpenAPI 3.0](https://spec.openapis.org/oas/v3.0.3.html).
