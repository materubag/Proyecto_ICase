# Explorador Swagger

Este visor incluye el contrato OpenAPI y los recursos de Swagger UI dentro de MkDocs. No necesita conexión con una CDN ni un backend encendido para consultar operaciones y esquemas. La ejecución de solicitudes está deshabilitada.

[Abrir Swagger en página completa](assets/swagger/index.html) · [Descargar OpenAPI JSON](assets/swagger/openapi.json)

<iframe src="../assets/swagger/index.html" title="Explorador Swagger de la API ICASE" style="width:100%;height:1000px;border:1px solid #ddd;border-radius:8px" loading="lazy"></iframe>

La copia estática se actualiza con `npm run docs:sync` en `backend`. Para consultar el contrato servido por el backend en ejecución, abrir `http://localhost:8080/api/docs/`. Cambiar el host si el despliegue no es local.

La [referencia detallada](api-reference.md) explica el flujo documental, ejemplos, autenticación y errores. Las [integraciones externas](integrations.md) tienen credenciales y límites distintos a los endpoints propios.
