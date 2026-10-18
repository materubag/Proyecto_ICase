# iCASE — Corrección y verificación, fase 2

Fecha: 16 de octubre de 2026. Trabajo realizado sobre los cambios existentes, sin modificar `.env`, sin sustituir el modelo configurado y sin solicitudes reales a modelos de IA.

## Resultado ejecutado

| Resultado | Clasificación | Evidencia |
| --- | --- | --- |
| Carga exclusiva de PDF | **CORREGIDO Y VERIFICADO** | Validación compartida de extensión/MIME; firma `%PDF-` y parser real; pruebas HTTP rechazan DOCX disfrazado, PDF de contenido inválido y rutas de audio. |
| Análisis del proyecto desde PDF | **CORREGIDO Y VERIFICADO** | Solo se analizan fuentes `PDF`; la descripción es contexto, no una fuente de nuevos requisitos. La ruta general de archivos también registra fuentes PDF reutilizables. |
| Tablas, líneas, columnas y páginas | **CORREGIDO Y VERIFICADO** | Pruebas con PDF binarios generados localmente, cuatro dominios y estructuras distintas; evidencia y texto de disposición original conservados. |
| Abreviaturas y actores múltiples | **CORREGIDO Y VERIFICADO** | Leyenda documental o configuración explícita; ejecutores y lectores separados; menciones pasivas y destinatarios no conceden ejecución. |
| Dependencias explícitas, ciclos y referencias | **CORREGIDO Y VERIFICADO** | Columnas y referencias múltiples sin IA, tipos de relación, comprobación de destinos y ciclos; promoción tardía de destinos probada en PostgreSQL. |
| Propuestas semánticas y revisión explícita | **CORREGIDO Y VERIFICADO** | JSON y citas validados; candidatos separados; aprobación/rechazo mediante el servicio existente. Prueba PostgreSQL aprueba relaciones, rechaza un ciclo y vuelve a bloquear una aprobación tras cambiar el texto revisado. |
| Persistencia y migraciones SQL | **CORREGIDO Y VERIFICADO** | PostgreSQL 16 en un contenedor nuevo, base `icase_phase2_test`, esquema aleatorio; ambas migraciones aplicadas al esquema de prueba previo a ellas. |
| Regresión offline | **CORREGIDO Y VERIFICADO** | `npm test`: **139 aprobadas, 0 fallidas, 1 omitida**, de 140 pruebas. La omitida es AUTRON V6. |
| Frontend | **CORREGIDO Y VERIFICADO** | **11/11** pruebas unitarias; compilación Vite correcta. |
| Integración PostgreSQL | **CORREGIDO Y VERIFICADO** | `npm run test:postgres`: **1/1** escenario de integración, con las comprobaciones detalladas abajo. |
| AUTRON V6 completo | **BLOQUEADO** | No se encontró el PDF ni una referencia verificada de sus descripciones completas. No se certifican 49 RF, 12 RNF ni cuatro actores de ese archivo. |
| Precisión real de GPT-6 Luna y costo real posterior | **PENDIENTE** | Se respetó la prohibición de llamadas pagadas. Los fixtures verifican contratos y orquestación, no respuestas reales del modelo. |
| Interacción visual completa en navegador | **PENDIENTE** | Se ejecutaron build, pruebas unitarias y solicitudes HTTP; no una sesión E2E de navegador. |

Los resultados de fixtures generados no se presentan como evidencia de AUTRON V6. El fixture antiguo disponible sigue conteniendo 34 RF y 12 RNF y se prueba como tal.

## Recorrido comprobado y alcance

`ProjectSources`/`ProjectSummary` → `sources.api.uploadPdfs` → `POST /projects/:id/sources` → `SourceService.createPdfSources` → `DocumentAnalyzer.extractDocument` → `PdfExtractor` → `SourceVersion` → `POST /sources/:id/analyze` → `analysisPipeline` → `documentExtraction` → relaciones/validación → `extractionStore` → candidatos → promoción explícita → modelos y artefactos.

`DocumentImportModal` mantiene el recorrido de extracción/análisis/importación de su API; la vista previa usa ahora el texto con disposición conservada, no la versión limpiada que pierde columnas. Las cargas generales de `files` comparten el registro de fuentes y no disparan una interpretación alternativa. Las notas de descripción no generan requisitos por su cuenta.

El análisis documental vigente usa `documentExtraction` y el contrato de lotes. Las funciones antiguas de `DocumentAnalyzer` para metamodelos y enriquecimiento integral no son la ruta principal de análisis de PDF. No se usaron como prueba de extracción semántica real.

Las rutas de subida/reintento de audio devuelven 415 por la nueva restricción de alcance. Se retiraron los selectores de audio; los datos históricos existentes no se eliminaron. Un archivo no se admite solo porque su nombre o su MIME declare PDF: también se comprueba su contenido y se ejecuta el parser.

## Extracción y comparación de contenido

El parser anterior podía perder el hueco entre columnas porque pdf.js introduce elementos de espacio artificial. `pdfLayout.js` reconstruye líneas desde las coordenadas de los elementos reales; el texto del parser sin esa reconstrucción se conserva en `rawLayoutText`.

`RuleBasedExtractor` mantiene los identificadores originales y conserva `originalDescription`, `sourceText`, páginas, offsets y columnas `declared`. El enunciado lógico normaliza los espacios y saltos de línea de maquetación; la evidencia literal permite recuperar el texto previo a esa normalización. No se reescribe su significado.

Se separan descripción, tipo, actores, dependencias, prioridad y referencias a reglas cuando hay encabezados suficientes. Las columnas sin encabezado fiable o las fronteras dudosas entre párrafos generan `NEEDS_REVIEW`; el texto contiguo dudoso queda en `boundaryContext`, sin incorporarlo arbitrariamente. Los encabezados repetidos entre páginas no se añaden al enunciado. Los requisitos numerados o varios códigos explícitos en un párrafo se conservan por separado.

| Fixture real generado | Disposición | Original esperado y extracción comparada |
| --- | --- | --- |
| Gestión académica | Lista numerada | `RF-001`: `Registrar matriculas.`; `RNF-01`: `Responder en dos segundos.` |
| Inventario comercial | Tabla con prioridad | `RF-001`: `Registrar existencias.`; `RNF-01`: `Conservar integridad.`; prioridad fuera del enunciado. |
| Reservas | Continuación entre dos páginas y título repetido | `RF-001`: `Registrar reservas con fecha y recurso.`; `RNF-01`: `Cifrar las comunicaciones.` |
| Gestión de servicios | Dos columnas independientes | `RF-001`: `Registrar solicitudes.`; `RNF-01`: `Mantener disponibilidad.` |

Estas descripciones se compararon completas, no solo por cantidad o código. Se añadieron también pruebas de reglas multilínea, requisitos dentro de párrafos, tablas con leyenda y bloqueo de evidencia ausente.

Para aplicar una nueva versión del extractor a un PDF ya conocido hay que volver a cargarlo. Si su hash coincide pero sus metadatos corresponden al extractor anterior, se crea otra `SourceVersion`; se conserva la anterior. La siguiente carga idéntica, con el extractor actual, se reutiliza. Este caso se verificó en PostgreSQL.

## Actores, reglas y relaciones

Con una leyenda `A=Administrador; R=Recepción; C=Auditor; E=Ejecutor; L=Consulta`, la fila `RF-001 | El Administrador y Recepción podrán crear cuentas. | A:E; R:E; C:L` conserva la descripción y produce dos ejecutores y un lector. Sin leyenda no se asigna significado a `A:E`.

Los cuatro ejemplos de la solicitud anterior se mantienen como pruebas aisladas: Recepción ejecuta la asignación y Mecánico es destinatario; Mecánico finaliza; Cliente autoriza; un descuento explícitamente automático del sistema es `SYSTEM_BEHAVIOR`. Son datos de prueba, no reglas por código ni tratamientos de AUTRON.

`accessActorIds`, `readActorIds` y asociaciones de participación/destino permanecen separados. Los verbos pasivos como «asignado» no se interpretan como «asigna». No se crea un actor externo para el sistema interno.

Las reglas explícitas conservan código, texto y evidencia multilínea y permanecen independientes de los RF. Las referencias de columnas a reglas se validan.

Las dependencias documentadas se resuelven localmente. Se distinguen relaciones `PREREQUISITE`, `FUNCTIONAL`, `BUSINESS_RULE`, `DATA_RELATION`, `ENABLES_STATE` y `PROCESS`. Las propuestas de IA necesitan cita literal, IDs válidos y justificación; se guardan como `REQUIREMENT_RELATION` en `ModelCandidate`, sin aprobarse automáticamente.

El servicio de revisión de candidatos permite aprobar o rechazar esas propuestas después de promover los requisitos referenciados. La aprobación registra historia y enlaces; un prerrequisito circular se rechaza dentro de la transacción. La puerta de generación contrasta el contenido aprobado con el texto vigente; una edición posterior exige nueva revisión. Los estados pendientes no se convierten silenciosamente en «sin dependencias».

Se retiraron cuotas y ejemplos de dominio impuestos por prompts activos de UML. El fallback de flujo ya no inserta recepciones, cotizaciones, decisiones o ramas genéricas: conserva actividades documentadas independientes y avisa que falta una secuencia. La validación vuelve a ejecutarse al aprobar un artefacto, no solo al generarlo.

## Estado de los cuatro fallos anteriores

| Archivo | Diagnóstico | Corrección y estado |
| --- | --- | --- |
| `ai.test.js` | Contrato desactualizado de proveedor por defecto y mezcla de pruebas unitarias con PostgreSQL de aplicación. | Factory configurada y rechazo de proveedor desconocido probados offline; persistencia trasladada a integración aislada. **CORREGIDO Y VERIFICADO**. |
| `document.test.js` | Fixture PDF privado ausente y mezcla del flujo antiguo con verificaciones de proveedores externos. | Pruebas reproducibles de PDF real generado; AUTRON V6 tiene prueba específica omitida si faltan documento o referencia. Parser: **CORREGIDO Y VERIFICADO**; V6: **BLOQUEADO**. |
| `master_overhaul.test.js` | Exigía fusionar tres códigos explícitos distintos por sinonimia y asumir una abreviatura de actor. Eso contradice la preservación del catálogo. | Se preservan los tres códigos y textos; los alias se consolidan cuando están declarados. Se mantienen comprobaciones de UML, arquitectura y ER. **CORREGIDO Y VERIFICADO**. |
| `er_diagram_fix.test.js` | Esperaba dos llamadas donde el flujo hace una; además, el fallback omitía actividades reales y fabricaba un proceso genérico. | Una llamada, aviso explícito y actividades originales conservadas. Se comprueba también el rechazo de UML vacío. **CORREGIDO Y VERIFICADO**. |

Una prueba antigua de calidad exigía decisiones sin documentar condiciones. Se corrigió junto con el generador para comprobar que no se inventan decisiones y que se conservan todas las actividades. Las expectativas se alinearon con los contratos solicitados; las referencias completas de extracción no se relajaron para hacer pasar pruebas.

## PostgreSQL y Prisma

Se creó un contenedor exclusivo `icase-phase2-test-20261016`, con PostgreSQL 16 y puerto local asignado por Docker. La prueba solo admite una URL explícita `ICASE_TEST_DATABASE_URL`, host local y base `icase_phase2_test`; ignora la `DATABASE_URL` de la aplicación y crea un esquema aleatorio por ejecución.

Al terminar se detuvo ese contenedor. Se conservaron sus esquemas y datos de prueba; no se eliminaron bases ni contenedores existentes del usuario.

La prueba establece un esquema anterior a las migraciones en esa base vacía de pruebas, inserta una fila aprobada y aplica los dos SQL existentes dentro de transacciones. Comprueba:

1. Conservación de la fila anterior y de su prioridad HIGH tras ambas migraciones.
2. Prioridad y precondiciones desconocidas como `null` en los nuevos requisitos.
3. Reanálisis y llamadas concurrentes sin candidatos duplicados.
4. UUID y texto aprobado conservados aun al forzar el reanálisis.
5. Actor existente con evidencia persistida y relaciones conservadas.
6. Dependencias válidas, incluidos destinos promovidos después del dependiente.
7. Rollback de una actualización fallida, versiones y enlaces de procedencia.
8. Carga repetida por la API general sin duplicar fuentes/archivos.
9. Actualización del extractor creando una nueva versión, sin borrar la anterior.
10. Propuestas semánticas, aprobación explícita de varias relaciones, rechazo de ciclos, historial y bloqueo tras cambiar el texto aprobado.

La integración encontró y permitió corregir un fallo real: los actores conocidos de Prisma podían tener `evidence: null` y carecer de `source`, lo que rompía `extractionStore`. Ahora su incorporación conserva la evidencia documental de la operación y el origen explícito.

**PENDIENTE:** el repositorio no contiene una migración inicial completa ni `migration_lock.toml`; no se certifica que `migrate deploy` pueda crear una instalación vacía por sí solo. Los SQL incrementales sí se probaron sobre su esquema previo. No se aplicó ningún cambio a una base existente del usuario.

## Métricas instrumentadas

| Escenario de prueba | Solicitudes a proveedor fixture | Solicitudes pagadas |
| --- | --- | --- |
| Primera ejecución del escenario PostgreSQL | 2: extracción y relaciones | 0 |
| Reanálisis idéntico servido por snapshot | 0 | 0 |
| RF con sujeto explícito y sin ambigüedad | 0 | 0 |

La versión de contrato, el modo, el modelo, la configuración de leyendas y el catálogo de actores participan en invalidación/reutilización. Se conservan lotes configurables, recuperación parcial e IDs de segmentos estables. La descripción del proyecto ya no añade una pasada de IA sobre otro texto.

`analysisUsage` conserva etapa, modelo, tokens y cálculo de costo con tarifas configuradas; también registra usage cuando falla la etapa de relaciones. Los tests de aritmética usan valores sintéticos claramente identificados. En la integración anterior `inputTokens` y `outputTokens` son `null`: el proveedor fixture no devuelve tokens reales.

No se midió una factura de OpenAI ni se afirma un porcentaje de ahorro respecto a los USD 0,08 informados. Cambios en el catálogo global o en el contexto vecino pueden invalidar varios lotes; no se garantiza recalcular únicamente un requisito por edición.

## Archivos de esta fase

| Grupo | Archivos realmente intervenidos |
| --- | --- |
| Política PDF | `backend/src/utils/pdfFilePolicy.js` (nuevo); `backend/src/routes/document.routes.js`, `project.routes.js`, `source.routes.js`; `backend/src/middleware/pdfUpload.middleware.js`; `backend/src/controllers/document.controller.js`. |
| Extracción y fuentes | `backend/src/services/document/pdfLayout.js` (nuevo), `PdfExtractor.js`, `RuleBasedExtractor.js`, `DocumentAnalyzer.js`; `backend/src/services/source.service.js`, `file.service.js`. |
| Análisis y revisión | `backend/src/services/analysis/declaredFields.js`, `dependencyResolver.js` (nuevos); `documentExtraction.js`, `actorRelationshipResolver.js`, `catalogIntegrity.js`, `extractionContract.js`, `extractionRecovery.js`, `extractionStore.js`, `candidate.service.js`, `deduplicationService.js`, `analysisPipeline.js`; `backend/src/services/ai/AIService.js`. |
| UML | `backend/src/services/diagrams/diagramAiService.js`, `flowchartGenerator.js`, `DiagramService.js`. |
| Frontend | `frontend/src/utils/pdfFilePolicy.js` (nuevo); `components/DocumentImportModal.jsx`, `components/sources/FileUploadQueue.jsx`, `AudioTranscriptionViewer.jsx`; `pages/ProjectSources.jsx`, `ProjectSummary.jsx`, `ProjectAIAnalysis.jsx`. |
| Pruebas y ejecución | `backend/tests/phase2_pdf.test.js`, `pdf_upload.test.js`, `analysis_postgres.integration.js`, `fixtures/pdfFixture.cjs` (nuevos); `ai.test.js`, `document.test.js`, `master_overhaul.test.js`, `er_diagram_fix.test.js`, `diagrams_quality.test.js`; `frontend/tests/pdfFilePolicy.test.mjs` (nuevo); `.gitignore`, `backend/package.json`. |
| Documentación | `AUDITORIA_ICASE.md`, este informe. |

Los demás cambios que ya figuraban al comenzar la fase 2 pertenecen a la fase 1. No se revirtieron. Se hicieron revisables los archivos de pruebas que estaban excluidos por `.gitignore` para que la suite completa sea reproducible.

## Comandos reproducibles

Backend, desde `Proyecto_ICase/backend`:

```powershell
npm ci
npx prisma generate
npm test
```

Integración: usar exclusivamente un PostgreSQL local dedicado a pruebas. El contenedor de esta ejecución expuso el puerto 63568; comprobarlo al reiniciar y sustituirlo en la URL si Docker asigna otro. La prueba genera su esquema y aplica los SQL; no requiere tocar una base de la aplicación.

```powershell
docker start icase-phase2-test-20261016
docker port icase-phase2-test-20261016 5432
$env:ICASE_TEST_DATABASE_URL='postgresql://icase_test:icase_test_only@127.0.0.1:63568/icase_phase2_test'
npm run test:postgres
```

AUTRON V6, cuando se disponga de sus archivos:

```powershell
$env:AUTRON_V6_PDF='C:\ruta\AUTRON_V6.pdf'
$env:AUTRON_V6_REFERENCE='C:\ruta\referencia-verificada.json'
npm test
```

La referencia es un arreglo ordenado con 61 objetos `{ "code": "RF-001", "statement": "descripción completa verificada" }`, incluidos los RNF. Debe proceder de una revisión independiente; no se genera a partir de la misma extracción que se está verificando.

Frontend, desde `Proyecto_ICase/frontend`:

```powershell
npm ci
node --test tests/*.test.mjs
npm run build
```

Registros locales: `backend/phase2-baseline.log`, `phase2-baseline-all.log`, `phase2-regression.log`, `phase2-postgres.log`, `frontend/phase2-build.log`. Están ignorados por Git. La advertencia de tamaño de bundles de Vite continúa; no impidió compilar.

## Límites pendientes

- **BLOQUEADO:** AUTRON V6 y su referencia verificada no están disponibles.
- **PENDIENTE:** validación de precisión y facturación con respuestas reales del modelo, fuera de esta ejecución sin llamadas pagadas.
- **PENDIENTE:** E2E de interacción visual y revisión de todos los generadores antiguos ajenos al recorrido intervenido.
- **IMPLEMENTADO, NO VERIFICADO:** reconstrucción geométrica fuera de los cuatro diseños concretos descritos. Tablas sin separación fiable, rotaciones, OCR y documentos escaneados no quedan certificados; los PDF sin texto se rechazan y los registros ambiguos requieren revisión. El adaptador de disposición usa la versión de `pdf-parse` fijada por el lockfile y debe probarse al actualizarla.

Las reglas nuevas son independientes del dominio y no contienen tratamientos por nombre AUTRON ni por RF-001/RF-049. Los ejemplos específicos residen en pruebas. No se certifica una aplicación generada completa ni se ejecutó generación pagada de UML o código.
