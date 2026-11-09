# Registro de cambios

Los cambios siguientes todavía no corresponden a una nueva versión publicada. El historial previo debe consultarse en Git; no se atribuyen fechas de lanzamiento a versiones no verificadas.

## [Unreleased]

### Añadido

- Documentación de endpoints, integraciones, autenticación, claves, errores, límites y formatos de artefactos.
- Ingeniería de prompts por fase y catálogo literal de plantillas extraído del código.
- Visor Swagger local dentro de MkDocs y sincronización del contrato para el portal.
- Guía de desarrollo, README estructurado y capturas reproducibles con datos de demostración.

- Servicio `mkdocs` en Docker Compose, disponible en el puerto 8000 con recarga de documentación local.

- Swagger UI en `/api/docs/` y contrato OpenAPI 3.0.3 en `/api/openapi.json`.
- Inventario de operaciones HTTP y esquemas iniciales de salud, proyectos y cargas PDF.
- Validación OpenAPI, cobertura de rutas y comprobación HTTP de documentación.
- Portal técnico MkDocs Material con arquitectura, instalación, API, datos, operación y pruebas.
- Archivos de contribución, conducta, licencia ISC y reporte de vulnerabilidades.

### Modificado

- La respuesta raíz del backend apunta a la documentación de API.
- `docs/` se puede versionar; la salida generada `site/` y el entorno Python local quedan excluidos.
- La prueba de evidencia de actores utiliza el fixture existente en `backend/tests/fixtures/`, sin depender de documentos técnicos.
