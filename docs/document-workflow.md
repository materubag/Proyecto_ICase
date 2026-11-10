# Análisis documental por etapas

El PDF se carga y extrae con la ruta existente de Fuentes, sin llamadas de IA durante la carga. El panel compartido de Fuentes, Análisis, Actores y Requisitos permite preparar contexto con Luna, revisarlo con Sonnet y aprobarlo; después se repite para actores y, finalmente, requisitos con participantes. Este orden es una decisión de producto de iCASE.

Cada aprobación humana corresponde a una versión. La validación local y la revisión de Sonnet tienen estados separados. Las rutas antiguas de aprobación individual, por lote, promoción y restauración no pueden conceder la nueva aprobación documental. Los datos previos se adoptan como propuestas para revisar sin atribuirles revisiones de Sonnet.

Los catálogos y decisiones residen en `DocumentWorkflow.state`; sus versiones anteriores permanecen en `history`. Los requisitos aprobados se publican en las tablas existentes y en `RequirementVersion`, con `actorIds` compatibles con los consumidores actuales. `sources` conserva participantes con roles, citas, criterios, reglas y referencias de revisión/aprobación. No se modifica la generación de código por siete etapas.

Las llamadas se guardan en `DocumentWorkflowCall`, con proveedor, modelo, etapa, tarea, versiones, respuesta, consumo nativo, intentos y errores. Un consumo no informado permanece nulo/desconocido. Las llamadas concurrentes tienen una clave única; no hay reintentos automáticos. Después de una interrupción de más de tres minutos, se permite habilitar explícitamente un reintento y volver a solicitar la tarea. Máximo tres intentos por clave. Una recarga recupera los resultados y errores; un trabajo interrumpido se retoma explícitamente reutilizando unidades ya completadas.

La evidencia se divide en unidades con documento, versión, página, sección y texto literal. Antes de aprobar se comprueba la pertenencia de las citas. Cada revisión recibe las unidades originales, incluidas las que no produjeron candidatos. El contexto selecciona unidades pertinentes, contenido relacionado, decisiones humanas, preguntas y versiones; admite una ampliación de hasta dos unidades. Si todavía falta evidencia, formula una pregunta. Una modificación invalida las aprobaciones dependientes, conserva versiones y marca requisitos publicados afectados como pendientes. La caché de cada unidad incluye tarea, modelo, prompt, contenido, evidencias y dependencias seleccionadas. Ninguna respuesta obsoleta se publica.

## Configuración y despliegue

- `OPENAI_API_KEY`: credencial del proveedor de preparación.
- `DOCUMENT_PREPARATION_MODEL`: ID de Luna habilitado en la cuenta; obligatorio, sin sustitución silenciosa.
- `ANTHROPIC_API_KEY`: credencial del proveedor revisor.
- `DOCUMENT_REVIEW_MODEL`: ID de Claude Sonnet 5.5 habilitado en la cuenta; obligatorio.
- `DOCUMENT_REASONING_EFFORT`: opcional, solamente si el modelo seleccionado acepta ese valor.
- `DATABASE_URL`: PostgreSQL de la aplicación.
- `WORKFLOW_TEST_DATABASE_URL`: exclusivamente base aislada `workflow_test` en `localhost:55439`, para la prueba de persistencia. Las pruebas se niegan a usar otra base.

No se incorporan credenciales ni se cambian los archivos `.env` reales. No se presume que los nombres comerciales sean IDs válidos de API. Deben configurarse los IDs disponibles en cada cuenta. Preparación utiliza Responses (`max_output_tokens`, JSON, sin `temperature`); revisión utiliza Messages (`max_tokens`, `system`, sin `temperature`, comprueba truncamiento). Referencias consultadas: [OpenAI reasoning](https://developers.openai.com/api/docs/guides/reasoning) y [Claude Messages](https://platform.claude.com/docs/en/api/messages/create). La disponibilidad real de modelos/cuentas no se comprobó con llamadas pagadas.

Se recuperaron `backend/prisma/schema.prisma` y la migración de identidad desde HEAD local, porque faltaban en el directorio de trabajo. La nueva migración `202611100001_document_workflow` es aditiva. El historial local solo contiene una migración anterior incremental, no una inicialización completa desde cero: una instalación nueva necesita establecer la base desde el esquema; una instalación existente debe comprobar su historial antes de `prisma migrate deploy`. No ejecutar `db push` contra una base existente para probar.

En la instalación elegida: aplicar la migración aditiva conforme a su historial, ejecutar `npm run prisma:generate` en backend, reiniciar backend y desplegar el frontend compilado. No se aplicó ninguna migración a la base del proyecto durante esta implementación.

## Prueba manual con PDF

1. Cargar un PDF con texto seleccionable en Fuentes. Comprobar texto extraído; los PDF escaneados sin OCR muestran un error explícito.
2. En Contexto, preparar con Luna y solicitar revisión Sonnet. Examinar observaciones, editar con motivo si procede, volver a revisar y aprobar.
3. En Actores, preparar y revisar. Consultar citas, corregir nombres/alias/responsabilidades, agregar decisiones del usuario, rechazar o fusionar propuestas. Guardar, revisar de nuevo y seleccionar «Aprobar actores y continuar».
4. En Requisitos, preparar y revisar. Elegir participantes desde el catálogo aprobado y su tipo de participación. Se admiten varios participantes y requisitos automáticos/RNF sin actor humano. Revisar reglas, dependencias, criterios y preguntas. Resolver observaciones con una decisión registrada; aprobar.
5. Recargar entre pasos: deben conservarse borradores guardados, llamadas, errores y pendientes. Editar un actor y comprobar la invalidación de los requisitos relacionados. Una revisión ausente/fallida impide aprobar.
6. Para simular un fallo real sin cambiar datos, usar las pruebas con dobles. No ejecutar llamadas a los proveedores sin autorización de consumo.

## Verificación reproducible

En una base temporal aislada se aplicó primero el esquema de HEAD, después el SQL de la nueva migración. `prisma migrate diff --exit-code` indicó «No difference detected» y `prisma validate` pasó. Esta verificación no prueba el historial particular de una instalación existente.

Con `DATABASE_URL` y `WORKFLOW_TEST_DATABASE_URL` apuntando a la base de pruebas: `npm test` en backend. La suite incluye casos de compuertas, evidencia, varios participantes, fallo Sonnet, invalidación, decisiones humanas, persistencia tras reconstruir el servicio, resultados obsoletos, caché, concurrencia, reintentos y adopción de datos previos. `npm run test:document-workflow` ejecuta solamente los casos nuevos. Sin la variable de prueba se omiten explícitamente las pruebas de PostgreSQL, sin conectarse a la base del proyecto. Todos los proveedores son dobles en las pruebas; no demuestran calidad semántica de Luna/Sonnet.

Resultados ejecutados: backend `npm test`, **92 pruebas aprobadas**, incluida persistencia real en PostgreSQL temporal y proveedores simulados. Frontend `npm run build`, **correcto**, con advertencia de chunks mayores de 500 kB. Comprobación sintáctica: **197 archivos JavaScript del backend**. Navegador Edge sin interfaz: `npm run test:e2e -- tests/document-workflow.spec.js`, **1 prueba aprobada**, con API simulada, comprobando fallo visible de Sonnet, aprobación bloqueada, evidencia y guardado de varios participantes. No se ejecutó la batería completa de navegador que depende de una instalación real en el puerto 8080.

`git diff --check` detectó un espacio final ya presente en el cambio local de `ProjectSummary.jsx`; se conservó ese trabajo previo. La migración se verificó únicamente en la base temporal. No se desplegó ni se probó el circuito con proveedores reales.

## Archivos de la implementación

- Persistencia: `backend/prisma/schema.prisma`, migración `202611100001_document_workflow/migration.sql`.
- Flujo/contexto: `backend/src/services/analysis/documentWorkflow.js`, `workflowContext.js` y `backend/src/routes/documentWorkflow.routes.js`.
- Integración: `project.routes.js`, `source.controller.js`, servicios `AIService`, `OpenAIProvider`, `AnthropicProvider`, `HybridPipelineRouter`, `env.js`, `documentExtraction`, `extractionStore`, `actorIdentity`, `candidate.service`, `actor.service`, `requirement.service`, `versionHistory.service`, `engineering/change.service`, `engineering/model.service`.
- Interfaz: `DocumentWorkflowPanel.jsx`, `ProjectSources.jsx`, `ProjectAIAnalysis.jsx`, `ProjectActors.jsx`, `ProjectRequirements.jsx`, conexión del refresco de fuentes en `ProjectDetail.jsx`.
- Pruebas: `document_workflow.test.js`, `document_workflow_providers.test.js`, `analysis_jobs.test.js`, scripts de `backend/package.json`, `frontend/tests/document-workflow.spec.js` y su HTML de prueba aislado en `frontend/tests/fixtures/document-workflow.html`.
- Configuración/documentación: `.env.example` y este documento. Los cambios locales anteriores en otras pantallas se conservaron.
