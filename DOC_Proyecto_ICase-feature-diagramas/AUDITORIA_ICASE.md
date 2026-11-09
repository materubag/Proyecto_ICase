# Auditoría y correcciones de iCASE — 16 de octubre de 2026

> Este informe conserva el resultado histórico de la fase 1. El estado actualizado, la restricción exclusiva a PDF, las pruebas PostgreSQL y la reparación de regresiones se documentan en [FASE_2_ICASE.md](FASE_2_ICASE.md).

Se implementaron cambios sobre los servicios existentes. No se hicieron llamadas a OpenAI, no se cambió `.env`, no se cambió el modelo configurado y no se aplicaron migraciones ni escrituras a una base de datos real.

## Recorrido auditado

Frontend React/Vite → clientes `sources.api`, `documents.api`, `ai.api` → controladores Source/Document/AI → `analysisPipeline` o `analysisOrchestrator` → `documentExtraction` → `RuleBasedExtractor`, `SectionDetector`, evidencia y contrato → proveedor configurado → resolución de actores → `extractionStore` → candidatos y snapshot Prisma → aprobación explícita → requisitos oficiales → modelos/diagramas.

La carga PDF utiliza `PdfExtractor`; los documentos subidos como archivos pasan también por `file.service`. La extracción de PDF conserva el texto original separado del texto limpiado de presentación. La persistencia usa transacción y bloqueo por proyecto, claves canónicas, snapshots y enlaces de evidencia. Se conservaron estos mecanismos y la protección del texto aprobado.

`DocumentImportModal`, `ProjectSources`, `ProjectSummary` y `ProjectAIAnalysis` invocan estas rutas. Existían dos convenciones de proveedores (clases y archivos en minúsculas); el flujo documental vigente usa las clases y el contrato de extracción, no el antiguo prompt de análisis integral.

## Problemas y cambios

| Archivos | Causa anterior y corrección |
| --- | --- |
| `backend/src/services/document/PdfExtractor.js` | No liberaba el parser. Ahora destruye el parser incluso ante error y solicita separadores de celda y líneas, conservando páginas. |
| `backend/src/services/document/RuleBasedExtractor.js` | Las columnas podían mezclarse y los marcadores de página cortaban descripciones. Reconstruye tablas delimitadas con encabezados reconocibles, omite encabezados repetidos, conserva continuaciones y marca columnas ambiguas. Conserva la cita original completa, incluidos metadatos descartados de la descripción. |
| `backend/src/services/analysis/documentExtraction.js` | Mezclaba capacidades sin código con catálogos explícitos. Añade `EXPLICIT_REQUIREMENTS` y `REQUIREMENTS_DISCOVERY`; las capacidades adicionales quedan en `additionalCandidates`, nunca reciben RF automáticamente. Conserva reglas explícitas incluso si falla IA; excluye al sistema interno del catálogo de actores externos. |
| `backend/src/services/analysis/requirementIdentity.js` | La consolidación podía perder problemas de extracción de un duplicado. Ahora combina esos problemas sin ocultarlos. |
| `backend/src/services/analysis/catalogIntegrity.js` (nuevo) | Añade controles de códigos conflictivos, descripciones incompletas, tipos, referencias de actores y dependencias explícitas. `ANALYZED`, `UNANALYZED` y `UNRESOLVED` distinguen ausencia documentada de falta de análisis. Los errores críticos bloquean generación. |
| `backend/src/services/analysis/actorRelationshipResolver.js` | Reanalizaba todos los RF aunque el sujeto estuviera documentado. Resuelve sujetos explícitos localmente, identifica destinatarios de asignaciones y mantiene `accessActorIds` separado de participación. Omite la pasada semántica para esos ejecutores; conserva la verificación semántica existente para otros casos. |
| `backend/src/services/analysis/actorEvidence.js` | Clasificaba integraciones externas documentadas como proveedores del proyecto. Reconoce intercambios explícitos con el sistema. |
| `backend/src/services/analysis/analysisUsage.js` (nuevo) | Normaliza modelo, etapa, tokens de entrada/salida y costo estimado. Sin tarifas configuradas, el costo es `null`, nunca una cifra inventada. |
| `backend/src/services/analysis/extractionContract.js` | Invalida cachés de la versión anterior mediante nueva versión de contrato. Conserva validación JSON, cobertura, citas y referencias. |
| `backend/src/services/analysis/extractionStore.js` | Persiste estados de revisión, dependencias con evidencia, comportamiento interno, reglas y capacidades adicionales. Revalida antes de guardar, protege textos aprobados y rechaza conflictos de código original al promover, en vez de renumerarlos. Las dependencias cuyos destinos aún no están promovidos quedan pendientes. La huella incluye modo y descripción de actores. |
| `backend/src/services/analysis/candidate.service.js` | Reglas/capacidades quedaban ocultas. Las incluye en revisión y estadísticas; la aprobación explícita de una capacidad usa la promoción normal. Se eliminan confianza y prioridad inventadas en su presentación. |
| `backend/src/services/analysis/analysisPipeline.js` | Revalida el resultado tras resolver relaciones, incluido el reutilizado desde snapshot. |
| `backend/src/services/ai/AIService.js` | La importación antigua borraba pendientes y añadía condiciones, arquitectura y modelos genéricos. Ahora usa el almacén de candidatos existente; exige texto fuente para entradas antiguas y devuelve 422 si falta. Agrega capacidades de todas las fuentes y revalida el consolidado. |
| `backend/src/services/ai/OpenAIProvider.js` | Podía cambiar de modelo tras HTTP 400/404. Se elimina ese fallback. El prompt antiguo deja de exigir RNF inexistentes. |
| `backend/src/services/ai/MockAIProvider.js` | Fabricaba catálogos completos según palabras del dominio. Ahora ejecuta extracción local con evidencia; proveedor desconocido produce error explícito. Es un cambio deliberado del comportamiento de demostración. |
| `backend/src/services/analysis/entityDetector.js` | Añadía relaciones automotrices al encontrar pares de entidades. Se elimina esa tabla de supuestos. |
| `backend/src/services/diagrams/diagramContextBuilder.js` | Añadía clases, atributos, métodos CRUD y relaciones por nombre del dominio o proyecto. Se retiran esos catálogos y claves primarias implícitas; los métodos sin evidencia quedan vacíos. |
| `backend/src/services/diagrams/DiagramService.js`, `diagramAiService.js`, `backend/src/services/engineering/model.service.js`, `useCase.service.js`, `classModel.service.js` | Añaden la puerta de extracción antes de generar artefactos/modelos/casos de uso/clases. |
| `backend/src/services/diagrams/erDiagramGenerator.js` | Inventaba `id PK`, omitía cardinalidades desconocidas y podía colisionar nombres normalizados. Ya no añade atributos; rechaza cardinalidad desconocida y distingue identificadores. |
| `backend/src/services/diagrams/navigationGenerator.js`, `architectureGenerator.js` | Un modelo vacío producía pantallas/infraestructura por defecto. El resultado vacío permanece vacío. |
| `backend/src/services/file.service.js` | Interpretaba archivos Word binarios como UTF-8. Ahora rechaza DOC/DOCX/ODT con 422; no afirma haberlos extraído correctamente. |
| `backend/src/services/mockup/GoogleStitchService.js` | El prompt imponía coherencia automotriz a todos los proyectos. Usa el dominio documentado. |
| `backend/src/services/requirement.service.js`, `backend/prisma/schema.prisma` | La prioridad desconocida se convertía en MEDIA. Se permite `null` para requisitos y candidatos. |
| `backend/prisma/migrations/20261016000000_unknown_requirement_priority/migration.sql` | Quita únicamente los defaults y NOT NULL de prioridad. Conserva todas las filas y prioridades existentes. No se ejecutó contra una base real. |
| `frontend/src/pages/ProjectRequirements.jsx` | La edición y lectura añadían condiciones genéricas. Ahora permanecen vacías si son desconocidas; prioridad desconocida se muestra pendiente, y dependencias vacías sin análisis no aparecen como inexistentes. |
| `frontend/src/utils/mockupScreenOptions.js` | Proponía 18 pantallas automotrices para cualquier proyecto y asignaba requisitos huérfanos a administración. Ahora usa navegación y requisitos aprobados, mantiene sus textos y presenta propuestas revisables. |
| `frontend/src/components/mockup-renderer/AppShellPreview.jsx` | Infería roles automotrices y perfiles ficticios por el nombre de la pantalla. Usa los roles documentados y una identidad genérica de vista previa. |
| `.gitignore`, `backend/package.json`, pruebas/fixtures | Hace revisable la suite offline antes ignorada; incorpora las pruebas nuevas a `npm test`. El texto AUTRON existente se copia a un fixture para no depender de documentación ignorada. |

## Consumo y caché

Se mantienen caché por contenido/proveedor/modelo/contrato y recuperación de lotes parciales. Los IDs de segmentos dependen ahora del texto y su ocurrencia, de modo que una edición ajena no cambia todos los IDs. El contexto vecino y el catálogo global de requisitos siguen formando parte de la huella: una modificación puede invalidar varios lotes; no se garantiza una solicitud por requisito cambiado.

Configuración opcional: `EXTRACTION_BATCH_SIZE` (8), `EXTRACTION_BATCH_CHARS` (12000), `RELATIONSHIP_BATCH_SIZE` (6). Se aceptan también opciones internas equivalentes. `ANALYSIS_INPUT_USD_PER_MILLION` y `ANALYSIS_OUTPUT_USD_PER_MILLION` permiten estimar costo usando las tarifas del modelo configurado; no se cargaron tarifas ni se consultó una cuenta.

Mediciones instrumentadas offline: el segundo análisis idéntico reutiliza dos lotes y hace **0 solicitudes**; un sujeto explícito resuelto localmente provoca **0 solicitudes** adicionales de relaciones. Las respuestas fixture prueban contratos y orquestación, no calidad de una respuesta real de OpenAI. USD 0,08 es el dato informado por el usuario; no existe una medición real anterior/posterior que permita afirmar un porcentaje de ahorro.

## Verificación y límites

- Suite principal: **65/65** pruebas pasaron, con `fetch` bloqueado y claves vacías.
- Frontend: 10/10 pruebas unitarias pasaron; compilación Vite verificada. Vite informa chunks grandes, sin error de compilación.
- Prisma: cliente generado; esquema validado con URL ficticia local únicamente para validación estática. No hubo conexión, migración aplicada ni prueba transaccional contra PostgreSQL.
- Regresión ampliada: **117/121** pruebas pasaron; los cuatro fallos se detallan abajo y no se presentan como aprobados.

Pendientes concretos:

1. **AUTRON V6 ausente.** El fixture disponible tiene 34 RF y 12 RNF; se verifica ese contenido sin crear RF adicionales. No se certifica RF-001…RF-049. Los cuatro ejemplos suministrados se prueban como datos separados.
2. **Alcance actualizado por el usuario: exclusivamente PDF.** DOC, DOCX, ODT, texto y audio no son formatos de carga admitidos; implementar Word no es un pendiente. Las limitaciones de reconstrucción de PDF y su verificación actualizada se detallan en el informe de fase 2.
3. **Dependencias semánticas complejas:** el análisis local reconoce referencias explícitas con evidencia. Prerrequisitos sin código, estados habilitantes y relaciones de procesos requieren análisis/revisión adicional; no se crean a partir de palabras compartidas.
4. **Pruebas PostgreSQL:** faltó una base configurada para demostrar migración, concurrencia e idempotencia reales. Las pruebas aisladas verifican la protección del texto aprobado y reúso de identidad; no sustituyen esa integración.
5. **Regresión antigua:** `ai.test.js` depende de PostgreSQL y espera mock por defecto; `document.test.js` necesita `AUTRON_Propuesta_Overleaf.pdf`, ausente; `master_overhaul.test.js` exige consolidación semántica que no cumple el servicio actual; un test de flujo en `er_diagram_fix.test.js` espera dos intentos y observa uno. No se cambiaron esas expectativas para ocultar fallos.
6. No se certifica toda la cadena Documento → prueba de software generado: se conservan los enlaces existentes y se bloquean errores detectados en las entradas de generación intervenidas. No se ejecutó un navegador con backend/base real ni generación pagada.

Las ramas por nombre AUTRON y los catálogos automotrices de extracción/contexto/pantallas intervenidos se eliminaron. Los ejemplos de prueba no se usan como reglas productivas. Esto no constituye una certificación exhaustiva de todos los generadores antiguos o de todas las integraciones del repositorio.

## Comparación

| Caso | Antes | Después verificado |
| --- | --- | --- |
| Documento mixto | Capacidades añadidas al mismo arreglo de RF | Catálogo explícito y candidatos separados |
| RF con tabla delimitada entre páginas | Corte en marcador y mezcla de columnas | Continuación de descripción y evidencia literal de ambas páginas |
| Código repetido con texto distinto | Candidatos sin bloqueo común | Conflicto y `NEEDS_REVIEW`; generación bloqueada |
| Condiciones/prioridad desconocidas | Texto genérico y MEDIA | Vacío/null y estado pendiente |
| Asignación a otro actor | Riesgo de confundir mención con ejecutor | Sujeto ejecutor, asignado destinatario y lista de acceso separada |
| Dependencias vacías | Sin distinción de causa | Estado explícito; referencia inválida bloquea |
| Modelo solicitado no disponible | Sustitución automática | Error con modelo conservado |
| Proyecto sin pantallas/clases | Catálogos y CRUD de ejemplo | Sin catálogo productivo por defecto |
| Importación antigua sin evidencia | Reemplazo/borrado de pendientes | 422 antes de persistir |

## Comandos

Desde `Proyecto_ICase/backend`:

```powershell
npm ci
npx prisma generate
npx prisma validate  # requiere DATABASE_URL en el entorno
npm test
npm run test:integrity
node --require ./tests/fixtures/offline.cjs --test tests/*.test.js
```

Para desplegar la migración en una base configurada, revisar primero el SQL y disponer del respaldo habitual; el comando es `npx prisma migrate deploy`. No usar `db push` para reemplazar la migración de este cambio.

Desde `Proyecto_ICase/frontend`:

```powershell
npm ci
node --test tests/responseReader.test.mjs tests/mockupScreenOptions.test.mjs tests/chen.test.mjs
npm run build
```

Los registros locales se encuentran en `backend/verification-tests.log`, `backend/regression-tests.log` y `frontend/build-verification.log` (ignorados por Git).
