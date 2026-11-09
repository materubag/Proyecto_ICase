# Catálogo de endpoints

Generado por `backend/scripts/sync-docs.cjs` desde OpenAPI. El servidor base es `/api`. Los esquemas abiertos indican campos pendientes de tipado; consultar la [referencia detallada](api-reference.md) y los controladores para esas operaciones.

## health

| Método | Ruta | Operación | Entrada | Respuestas declaradas |
| --- | --- | --- | --- | --- |
| GET | `/health` | Estado HTTP del backend | — | 200 |

## project

| Método | Ruta | Operación | Entrada | Respuestas declaradas |
| --- | --- | --- | --- | --- |
| GET | `/projects` | GET /projects | query: `includeArchived` | 200, default |
| POST | `/projects` | Crear un proyecto | body: `application/json` | 201, default |
| GET | `/projects/{id}` | GET /projects/{id} | path: `id` (obligatorio) | 200, default |
| PUT | `/projects/{id}` | PUT /projects/{id} | path: `id` (obligatorio); body: `application/json` | 200, default |
| DELETE | `/projects/{id}` | DELETE /projects/{id} | path: `id` (obligatorio) | 200, default |
| POST | `/projects/{id}/restore` | POST /projects/{id}/restore | path: `id` (obligatorio); body: `application/json` | 200, default |
| GET | `/projects/{projectId}/requirements` | GET /projects/{projectId}/requirements | path: `projectId` (obligatorio) | 200, default |
| POST | `/projects/{projectId}/requirements` | POST /projects/{projectId}/requirements | path: `projectId` (obligatorio); body: `application/json` | 201, default |
| GET | `/projects/{projectId}/actors` | GET /projects/{projectId}/actors | path: `projectId` (obligatorio) | 200, default |
| POST | `/projects/{projectId}/actors` | POST /projects/{projectId}/actors | path: `projectId` (obligatorio); body: `application/json` | 201, default |
| POST | `/projects/{projectId}/actor-relations/regenerate` | POST /projects/{projectId}/actor-relations/regenerate | path: `projectId` (obligatorio); body: `application/json` | 200, default |
| GET | `/projects/{projectId}/actor-relations/jobs/{jobId}` | GET /projects/{projectId}/actor-relations/jobs/{jobId} | path: `projectId` (obligatorio); path: `jobId` (obligatorio) | 200, default |
| POST | `/projects/{projectId}/actors/approve-all` | POST /projects/{projectId}/actors/approve-all | path: `projectId` (obligatorio); body: `application/json` | 200, default |
| PATCH | `/projects/{projectId}/entities/{entityId}/status` | PATCH /projects/{projectId}/entities/{entityId}/status | path: `projectId` (obligatorio); path: `entityId` (obligatorio); body: `application/json` | 200, default |
| POST | `/projects/{projectId}/entities/approve-all` | POST /projects/{projectId}/entities/approve-all | path: `projectId` (obligatorio); body: `application/json` | 200, default |
| GET | `/projects/{projectId}/files` | GET /projects/{projectId}/files | path: `projectId` (obligatorio) | 200, default |
| POST | `/projects/{projectId}/files` | POST /projects/{projectId}/files | path: `projectId` (obligatorio); body: `multipart/form-data` | 201, default |
| POST | `/projects/{projectId}/analyze-consolidated` | POST /projects/{projectId}/analyze-consolidated | path: `projectId` (obligatorio); body: `application/json` | 200, default |
| GET | `/projects/{projectId}/use-cases` | GET /projects/{projectId}/use-cases | path: `projectId` (obligatorio) | 200, default |
| POST | `/projects/{projectId}/use-cases` | POST /projects/{projectId}/use-cases | path: `projectId` (obligatorio); body: `application/json` | 201, default |
| POST | `/projects/{projectId}/use-cases/generate` | POST /projects/{projectId}/use-cases/generate | path: `projectId` (obligatorio); body: `application/json` | 200, default |
| GET | `/projects/{projectId}/use-cases/diagram` | GET /projects/{projectId}/use-cases/diagram | path: `projectId` (obligatorio) | 200, default |
| GET | `/projects/{projectId}/classes` | GET /projects/{projectId}/classes | path: `projectId` (obligatorio) | 200, default |
| POST | `/projects/{projectId}/classes` | POST /projects/{projectId}/classes | path: `projectId` (obligatorio); body: `application/json` | 201, default |
| POST | `/projects/{projectId}/classes/generate` | POST /projects/{projectId}/classes/generate | path: `projectId` (obligatorio); body: `application/json` | 200, default |
| GET | `/projects/{projectId}/classes/diagram` | GET /projects/{projectId}/classes/diagram | path: `projectId` (obligatorio) | 200, default |
| GET | `/projects/{projectId}/screens` | GET /projects/{projectId}/screens | path: `projectId` (obligatorio) | 200, default |
| POST | `/projects/{projectId}/screens/select-multiple` | POST /projects/{projectId}/screens/select-multiple | path: `projectId` (obligatorio); body: `application/json` | 200, default |
| POST | `/projects/{projectId}/screens/generate-selected` | POST /projects/{projectId}/screens/generate-selected | path: `projectId` (obligatorio); body: `application/json` | 200, default |
| GET | `/projects/{projectId}/history` | GET /projects/{projectId}/history | path: `projectId` (obligatorio) | 200, default |
| GET | `/projects/{projectId}/sources` | GET /projects/{projectId}/sources | path: `projectId` (obligatorio) | 200, default |
| POST | `/projects/{projectId}/sources` | POST /projects/{projectId}/sources | path: `projectId` (obligatorio); body: `multipart/form-data` | 201, default |
| POST | `/projects/{projectId}/sources/audio` | POST /projects/{projectId}/sources/audio | path: `projectId` (obligatorio) | 415 |
| GET | `/projects/{projectId}/candidates` | GET /projects/{projectId}/candidates | path: `projectId` (obligatorio); query: `status`; query: `kind`; query: `category`; query: `type`; query: `origin`; query: `sourceId` | 200, default |
| GET | `/projects/{projectId}/candidates/stats` | GET /projects/{projectId}/candidates/stats | path: `projectId` (obligatorio) | 200, default |
| POST | `/projects/{projectId}/candidates/batch-approve` | POST /projects/{projectId}/candidates/batch-approve | path: `projectId` (obligatorio); body: `application/json` | 200, default |
| POST | `/projects/{projectId}/candidates/batch-reject` | POST /projects/{projectId}/candidates/batch-reject | path: `projectId` (obligatorio); body: `application/json` | 200, default |
| POST | `/projects/{projectId}/candidates/approve-category` | POST /projects/{projectId}/candidates/approve-category | path: `projectId` (obligatorio); body: `application/json` | 200, default |
| POST | `/projects/{projectId}/analyze` | POST /projects/{projectId}/analyze | path: `projectId` (obligatorio); body: `application/json` | 200, default |
| POST | `/projects/{projectId}/import-analysis` | POST /projects/{projectId}/import-analysis | path: `projectId` (obligatorio); body: `application/json` | 200, default |
| GET | `/projects/{projectId}/mockup` | GET /projects/{projectId}/mockup | path: `projectId` (obligatorio) | 200, default |
| POST | `/projects/{projectId}/mockup` | POST /projects/{projectId}/mockup | path: `projectId` (obligatorio); body: `application/json` | 200, default |
| GET | `/projects/{projectId}/diagrams/availability` | GET /projects/{projectId}/diagrams/availability | path: `projectId` (obligatorio) | 200, default |
| GET | `/projects/{projectId}/diagrams/{type}` | GET /projects/{projectId}/diagrams/{type} | path: `projectId` (obligatorio); path: `type` (obligatorio) | 200, default |
| PUT | `/projects/{projectId}/diagrams/{type}` | PUT /projects/{projectId}/diagrams/{type} | path: `projectId` (obligatorio); path: `type` (obligatorio); body: `application/json` | 200, default |
| POST | `/projects/{projectId}/diagrams/generate` | Generar diagramas Mermaid con validaci?n y fallback | path: `projectId` (obligatorio); body: `application/json` | 200, 400, 422, default |
| POST | `/projects/{projectId}/diagrams/{type}/validate` | POST /projects/{projectId}/diagrams/{type}/validate | path: `projectId` (obligatorio); path: `type` (obligatorio); body: `application/json` | 200, default |
| POST | `/projects/{projectId}/diagrams/cross-validate` | POST /projects/{projectId}/diagrams/cross-validate | path: `projectId` (obligatorio); body: `application/json` | 200, default |
| GET | `/projects/{projectId}/architecture` | GET /projects/{projectId}/architecture | path: `projectId` (obligatorio) | 200, default |
| PUT | `/projects/{projectId}/architecture` | PUT /projects/{projectId}/architecture | path: `projectId` (obligatorio); body: `application/json` | 200, default |

## requirement

| Método | Ruta | Operación | Entrada | Respuestas declaradas |
| --- | --- | --- | --- | --- |
| PUT | `/requirements/{id}` | PUT /requirements/{id} | path: `id` (obligatorio); body: `application/json` | 200, default |
| DELETE | `/requirements/{id}` | DELETE /requirements/{id} | path: `id` (obligatorio) | 200, default |
| PATCH | `/requirements/{id}/status` | PATCH /requirements/{id}/status | path: `id` (obligatorio); body: `application/json` | 200, default |

## actor

| Método | Ruta | Operación | Entrada | Respuestas declaradas |
| --- | --- | --- | --- | --- |
| PUT | `/actors/{id}` | PUT /actors/{id} | path: `id` (obligatorio); body: `application/json` | 200, default |
| DELETE | `/actors/{id}` | DELETE /actors/{id} | path: `id` (obligatorio) | 200, default |
| PATCH | `/actors/{id}/status` | PATCH /actors/{id}/status | path: `id` (obligatorio); body: `application/json` | 200, default |

## document

| Método | Ruta | Operación | Entrada | Respuestas declaradas |
| --- | --- | --- | --- | --- |
| POST | `/documents/extract` | Extraer texto y estructura de PDF sin IA | body: `multipart/form-data` | 200, default |
| POST | `/documents/analyze` | Analizar PDF o extracci?n previa con IA | body: `multipart/form-data`, `application/json` | 200, default |

## useCase

| Método | Ruta | Operación | Entrada | Respuestas declaradas |
| --- | --- | --- | --- | --- |
| PUT | `/use-cases/{id}` | PUT /use-cases/{id} | path: `id` (obligatorio); body: `application/json` | 200, default |
| DELETE | `/use-cases/{id}` | DELETE /use-cases/{id} | path: `id` (obligatorio) | 200, default |
| PATCH | `/use-cases/{id}/status` | PATCH /use-cases/{id}/status | path: `id` (obligatorio); body: `application/json` | 200, default |

## classModel

| Método | Ruta | Operación | Entrada | Respuestas declaradas |
| --- | --- | --- | --- | --- |
| PUT | `/classes/{id}` | PUT /classes/{id} | path: `id` (obligatorio); body: `application/json` | 200, default |
| DELETE | `/classes/{id}` | DELETE /classes/{id} | path: `id` (obligatorio) | 200, default |
| PATCH | `/classes/{id}/status` | PATCH /classes/{id}/status | path: `id` (obligatorio); body: `application/json` | 200, default |

## screen

| Método | Ruta | Operación | Entrada | Respuestas declaradas |
| --- | --- | --- | --- | --- |
| PATCH | `/screens/{id}/select` | PATCH /screens/{id}/select | path: `id` (obligatorio); body: `application/json` | 200, default |
| PATCH | `/screens/{id}/status` | PATCH /screens/{id}/status | path: `id` (obligatorio); body: `application/json` | 200, default |
| PUT | `/screens/{id}` | PUT /screens/{id} | path: `id` (obligatorio); body: `application/json` | 200, default |
| DELETE | `/screens/{id}` | DELETE /screens/{id} | path: `id` (obligatorio) | 200, default |

## file

| Método | Ruta | Operación | Entrada | Respuestas declaradas |
| --- | --- | --- | --- | --- |
| DELETE | `/files/{id}` | DELETE /files/{id} | path: `id` (obligatorio) | 200, default |

## versionHistory

| Método | Ruta | Operación | Entrada | Respuestas declaradas |
| --- | --- | --- | --- | --- |
| POST | `/history/{historyId}/restore` | POST /history/{historyId}/restore | path: `historyId` (obligatorio); body: `application/json` | 200, default |

## source

| Método | Ruta | Operación | Entrada | Respuestas declaradas |
| --- | --- | --- | --- | --- |
| GET | `/sources/{sourceId}` | GET /sources/{sourceId} | path: `sourceId` (obligatorio) | 200, default |
| GET | `/sources/{sourceId}/versions/{version}` | GET /sources/{sourceId}/versions/{version} | path: `sourceId` (obligatorio); path: `version` (obligatorio) | 200, default |
| POST | `/sources/{sourceId}/retry` | POST /sources/{sourceId}/retry | path: `sourceId` (obligatorio) | 415 |
| POST | `/sources/{sourceId}/analyze` | Analizar una fuente PDF y crear candidatos | path: `sourceId` (obligatorio); body: `application/json` | 200, 202, 400, 404, 409, 415, default |
| GET | `/sources/{sourceId}/analysis/{jobId}` | Consultar estado de trabajo de an?lisis | path: `sourceId` (obligatorio); path: `jobId` (obligatorio) | 200, 404 |

## candidate

| Método | Ruta | Operación | Entrada | Respuestas declaradas |
| --- | --- | --- | --- | --- |
| GET | `/candidates/{candidateId}` | GET /candidates/{candidateId} | path: `candidateId` (obligatorio) | 200, default |
| PUT | `/candidates/{candidateId}` | PUT /candidates/{candidateId} | path: `candidateId` (obligatorio); body: `application/json` | 200, default |
| POST | `/candidates/{candidateId}/approve` | POST /candidates/{candidateId}/approve | path: `candidateId` (obligatorio); body: `application/json` | 200, default |
| POST | `/candidates/{candidateId}/reject` | POST /candidates/{candidateId}/reject | path: `candidateId` (obligatorio); body: `application/json` | 200, default |

## engineering

| Método | Ruta | Operación | Entrada | Respuestas declaradas |
| --- | --- | --- | --- | --- |
| GET | `/projects/{projectId}/engineering` | GET /projects/{projectId}/engineering | path: `projectId` (obligatorio) | 200, default |
| POST | `/projects/{projectId}/engineering/models/generate` | POST /projects/{projectId}/engineering/models/generate | path: `projectId` (obligatorio); body: `application/json` | 200, default |
| POST | `/projects/{projectId}/engineering/models` | POST /projects/{projectId}/engineering/models | path: `projectId` (obligatorio); body: `application/json` | 200, default |
| PATCH | `/projects/{projectId}/engineering/models/{id}` | PATCH /projects/{projectId}/engineering/models/{id} | path: `projectId` (obligatorio); path: `id` (obligatorio); body: `application/json` | 200, default |
| POST | `/projects/{projectId}/engineering/diagrams` | POST /projects/{projectId}/engineering/diagrams | path: `projectId` (obligatorio); body: `application/json` | 200, default |
| PATCH | `/projects/{projectId}/engineering/versions/{id}` | PATCH /projects/{projectId}/engineering/versions/{id} | path: `projectId` (obligatorio); path: `id` (obligatorio); body: `application/json` | 200, default |
| POST | `/projects/{projectId}/engineering/versions/{id}/restore` | POST /projects/{projectId}/engineering/versions/{id}/restore | path: `projectId` (obligatorio); path: `id` (obligatorio); body: `application/json` | 200, default |
| GET | `/projects/{projectId}/engineering/impact/{type}/{id}` | GET /projects/{projectId}/engineering/impact/{type}/{id} | path: `projectId` (obligatorio); path: `type` (obligatorio); path: `id` (obligatorio) | 200, default |
| POST | `/projects/{projectId}/engineering/changes` | POST /projects/{projectId}/engineering/changes | path: `projectId` (obligatorio); body: `application/json` | 200, default |
| PATCH | `/projects/{projectId}/engineering/changes/{id}` | PATCH /projects/{projectId}/engineering/changes/{id} | path: `projectId` (obligatorio); path: `id` (obligatorio); body: `application/json` | 200, default |
| POST | `/projects/{projectId}/engineering/baselines` | POST /projects/{projectId}/engineering/baselines | path: `projectId` (obligatorio); body: `application/json` | 200, default |
| GET | `/projects/{projectId}/engineering/baselines/{id}` | GET /projects/{projectId}/engineering/baselines/{id} | path: `projectId` (obligatorio); path: `id` (obligatorio) | 200, default |
| POST | `/projects/{projectId}/engineering/compare` | POST /projects/{projectId}/engineering/compare | path: `projectId` (obligatorio); body: `application/json` | 200, default |
| PATCH | `/projects/{projectId}/engineering/platform` | PATCH /projects/{projectId}/engineering/platform | path: `projectId` (obligatorio); body: `application/json` | 200, default |
| POST | `/projects/{projectId}/engineering/sources/text` | POST /projects/{projectId}/engineering/sources/text | path: `projectId` (obligatorio); body: `application/json` | 200, default |
| POST | `/projects/{projectId}/engineering/chat` | Consultar contexto o proponer cambio para revisi?n | path: `projectId` (obligatorio); body: `application/json` | 200, 400, default |
| GET | `/projects/{projectId}/engineering/export` | GET /projects/{projectId}/engineering/export | path: `projectId` (obligatorio) | 200, default |

