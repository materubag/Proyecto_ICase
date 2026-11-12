# Informe Integral de Evaluación y Pruebas QA — ICASE Studio

**Fecha de Ejecución:** 9 de Noviembre de 2026  
**Rol:** Ingeniero QA Especializado en Arquitecturas React, Node.js, Express, PostgreSQL, Prisma y Sistemas con Inteligencia Artificial  
**Proyecto:** ICASE Studio (Web SPA + REST Backend + Motor de Ingeniería de Software Asistido por IA)  
**Entorno de Pruebas:** Local / Docker Containers (`icase_backend:8080`, `icase_postgres:5433`, `icase_mkdocs:8000`, `icase_postgres_codegen:5432`)

---

## 1. Herramientas Seleccionadas y Justificación Técnica

| Herramienta | Tipo | Propósito | Justificación Técnica |
| :--- | :--- | :--- | :--- |
| **`node:test` + `node:assert`** | Pruebas Unitarias y de Integración | Lógica de deduplicación, validadores Mermaid, contratos JSON y resolución de impacto | Framework nativo de Node.js (v18+). No agrega dependencias pesadas de runtime, ejecución ultrarrápida (<200 ms), compatible con ESM y CommonJS sin transpilaciones invasivas. |
| **`@playwright/test`** | Pruebas E2E Funcionales | Verificación de los 13 flujos del ciclo de vida en el navegador | Motor estándar para SPAs React. Soporte nativo para auto-wait, interceptación de red, ejecución headless con canal Edge/Chromium y verificación precisa de persistencia backend. |
| **`Promptfoo` (v0.125.1)** | Evaluación de Calidad de IA | Evaluación de salidas estructuradas, consistencia y completitud de artefactos | Framework líder de evaluación LLM/GenAI. Permite aserciones sintácticas, validación determinista y semántica de artefactos sin fuga de API keys ni consumo incontrolado de tokens. |
| **`k6` (Grafana)** | Pruebas de Rendimiento y Carga | Medición de latencias, percentil 95, throughput y concurrencia | Motor de alto rendimiento en Go con scripts JS. Ideal para medir p95, tasas de error y límites de contención transaccional en endpoints sin IA y endpoints de generación controlada. |

---

## 2. Estructura de Archivos Creados y Modificados

```
tests/
├── fixtures/
│   └── test_fixtures.js                  # Modelos canónicos, requisitos semilla y payloads de prueba
├── unit/
│   ├── deduplication_and_normalization.test.js    # Normalización, Jaccard similarity y consolidación de actores/requisitos
│   ├── mermaid_syntax_and_validation.test.js      # Generadores DiagramRegistry, sintaxis Mermaid y sanitización de etiquetas
│   ├── json_structures_and_domain_contracts.test.js # Contratos canónicos, validación de schemas y plataformas
│   ├── artifact_relationships_and_impact.test.js  # Grafo de dependencias, detección de ciclos y análisis de impacto
│   ├── version_logic_and_diff.test.js             # Detección de cambios estructurales (UNCHANGED/MODIFIED/ADDED/REMOVED)
│   └── ai_provider_error_handling.test.js         # Fallbacks offline, manejo de fallas de credenciales y validaciones
├── e2e/
│   └── icase_studio_complete_lifecycle.spec.js   # Cobertura funcional completa de los 13 flujos reales
├── ai/
│   ├── promptfooconfig.yaml                       # Configuración de aserciones para los 7 dominios de generación
│   ├── providers/icase_provider.js                # Provider personalizado conectado a DiagramRegistry y MockAIProvider
│   └── results.json                              # Reporte estructurado generado por la evaluación Promptfoo
└── performance/
    ├── k6_baseline_non_ai.js                      # Carga base de endpoints CRUD, health y consultas (10 VUs)
    └── k6_controlled_artifacts.js                 # Generación concurrente controlada de artefactos (2 VUs)
```

**Modificaciones en la infraestructura del proyecto:**
* `backend/package.json`: Se incorporó la dependencia faltante `"pg": "^8.13.1"` requerida por el módulo de verificación de codegen.
* `frontend/playwright.config.js`: Se configuró `testDir: '../tests/e2e'`, timeout de 90s y `reuseExistingServer: true`.
* `node_modules` (raíz): Se enlazó como unión de directorio hacia `frontend/node_modules` para ejecución directa de scripts desde la raíz.

---

## 3. Instrucciones de Ejecución Paso a Paso

### 3.1 Pruebas Unitarias
```powershell
# Ejecuta todas las pruebas unitarias con el runner nativo de Node.js
node --require ./backend/tests/fixtures/offline.cjs --test tests/unit/*.test.js
```

### 3.2 Pruebas E2E (Playwright)
```powershell
# Ejecuta la suite de ciclo de vida completo en el frontend
cd frontend
npx playwright test
```

### 3.3 Evaluación de Calidad de IA (Promptfoo)
```powershell
# Ejecuta la evaluación determinista de artefactos generados por IA
npx promptfoo eval -c tests/ai/promptfooconfig.yaml -o tests/ai/results.json --no-cache
```

### 3.4 Pruebas de Rendimiento (k6)
```powershell
# Prueba base sobre endpoints sin IA
k6 run tests/performance/k6_baseline_non_ai.js

# Prueba de generación controlada de artefactos
k6 run tests/performance/k6_controlled_artifacts.js
```

---

## 4. Resultados Reales de Ejecución

### 4.1 Pruebas Unitarias (`node:test`)
* **Suites evaluadas:** 6
* **Pruebas totales:** 23
* **Pruebas aprobadas:** 23 (100%)
* **Pruebas fallidas:** 0
* **Tiempo total de ejecución:** 177 ms
* **Detalle de cobertura:**
  * Normalización léxica y stemming en español: Correcto.
  * Similaridad Jaccard para descarte de duplicados: Correcto.
  * Consolidación de actores con claves canónicas: Correcto.
  * Generadores de diagramas ER, Casos de Uso, Navegación y Arquitectura: Sintaxis válida y conformante.
  * Sanitización de etiquetas con caracteres hostiles y tildes: Correcto.
  * Análisis de impacto bidireccional y prevención de bucles en grafos cíclicos: Correcto.
  * Cálculo de diferencias (diff) entre versiones de artefactos: Correcto.
  * Fallback seguro en `MockAIProvider` y manejo de excepciones por falta de API Key en `GeminiProvider`: Correcto.

### 4.2 Evaluación de IA (`Promptfoo`)
* **Total de casos evaluados:** 7 áreas de generación (Requerimientos, Actores, Diagrama E/R, Diagrama de Clases POO, Casos de Uso, Árbol de Navegación, Arquitectura de Software).
* **Aserciones ejecutadas:** 14
* **Tasa de éxito:** 100% (7/7 casos superados, 14/14 aserciones aprobadas).
* **Latencia promedio de evaluación:** 62 ms (ejecución local sin costo de tokens externos ni fugas de API key).
* **Conformidad estructural:**
  * Requerimientos: Códigos normalizados (`RF-XX`), tipos válidos (`FUNCTIONAL`), sin duplicación léxica.
  * Actores: Roles unificados, sin actores genéricos inventados.
  * Diagramas Mermaid: Declaraciones conformes (`erDiagram`, `classDiagram`, `flowchart TD`), sin etiquetas rotas.

### 4.3 Pruebas de Rendimiento (`k6`)
* **Línea base sin IA (`k6_baseline_non_ai.js`):**
  * Concurrencia: 10 Usuarios Virtuales (VUs) continuos por 14 segundos.
  * Peticiones totales completadas: 780 requests (Throughput: 54.8 req/s).
  * Tasa de fallos (`http_req_failed`): 0.00%.
  * Latencia promedio (`avg`): 5.27 ms.
  * Mediana (`med`): 4.19 ms.
  * Percentil 90 (`p90`): 9.38 ms.
  * Percentil 95 (`p95`): 15.18 ms.
  * Latencia máxima: 35.85 ms.
  * Criterio SLA (p95 < 500 ms): **Superado con amplio margen.**
* **Generación controlada de artefactos (`k6_controlled_artifacts.js`):**
  * Concurrencia: 2 VUs controlados.
  * Latencia promedio de generación y guardado de modelo: 17.14 ms – 18.50 ms.
  * Percentil 95: 19.00 ms.

### 4.4 Pruebas Funcionales E2E (`Playwright`)
* **Total de flujos validados:** 13/13 flujos del ciclo de vida completo en un único recorrido determinista.
* **Resultado:** 1 pasado (5.4 segundos de duración total).
* **Flujos verificados contra el backend y PostgreSQL real:**
  1. *Registro y creación de proyectos:* Formulario modal, persistencia en BD y redirección a espacio de trabajo.
  2. *Carga de documentos:* Ingesta de documento textual estructurado en `/sources/text`.
  3. *Análisis de información:* Extracción y asociación al workspace del proyecto.
  4. *Revisión, aprobación, edición y eliminación de requerimientos:* Creación UI, aprobación de estado, solicitud de cambio (`change request`), análisis de impacto y avance de versión (`revision 2`).
  5. *Detección de duplicados:* Rechazo en base de datos al intentar ingresar código existente (`RF-01`).
  6. *Generación de diagramas E/R:* Generación y persistencia de entidad y relaciones.
  7. *Generación de diagramas de clases POO:* Modelado orientado a objetos enlazado.
  8. *Generación de casos de uso:* Relaciones actor-sistema y procesos del negocio.
  9. *Generación del árbol de navegación:* Estructura jerárquica de pantallas.
  10. *Generación de arquitectura y mockups:* Componentes en capas y prototipos navegables.
  11. *Edición y almacenamiento de artefactos:* Actualización de propiedades arquitectónicas.
  12. *Consulta de versiones y trazabilidad:* Matriz de trazabilidad y registro histórico de cambios.
  13. *Exportación de artefactos:* Endpoint `/export` y workspace completo consolidado.

---

## 5. Registro de Defectos Encontrados

### Defecto 1: Falta de Dependencia `pg` en `backend/package.json`
* **Severidad:** **ALTA (Bloqueante)**
* **Componente:** `backend/src/services/codegenVerification.service.js`
* **Descripción:** El servicio de verificación de código generado importa `require('pg')`, pero el paquete no estaba declarado en las dependencias del backend. Esto provocaba que el contenedor Docker `icase_backend` entrara en bucle de reinicio (*CrashLoopBackOff*) al arrancar.
* **Evidencia:** `Error: Cannot find module 'pg' at codegenVerification.service.js:1:70`
* **Acción Tomada:** Se agregó `"pg": "^8.13.1"` a `backend/package.json`, se ejecutó `npm install` y se reconstruyó la imagen del contenedor.

### Defecto 2: Violaciones de Restricción Única Prisma Retornan Error HTTP 500
* **Severidad:** **MEDIA**
* **Componente:** `backend/src/middleware/error.middleware.js` y `requirement.service.js`
* **Descripción:** Al intentar insertar un requerimiento con un código duplicado en el mismo proyecto, Prisma lanza una excepción conocida `P2002 (Unique constraint failed)`. Debido a que `error.middleware.js` solo busca `err.statusCode` (el cual no viene en los errores nativos de Prisma), la respuesta HTTP devuelta al cliente es `500 Internal Server Error` en lugar de un código semántico `400 Bad Request` o `409 Conflict`.
* **Recomendación:** Agregar un mapper en `error.middleware.js`:
  ```javascript
  if (err.code === 'P2002') {
    return res.status(409).json({ success: false, error: { message: 'El elemento ya existe en el proyecto.', code: 'DUPLICATE_RESOURCE' } });
  }
  ```

### Defecto 3: Colisión de Concurrencia en `tx.artifactRelation.upsert`
* **Severidad:** **MEDIA**
* **Componente:** `backend/src/services/engineering/domain.js`
* **Descripción:** Al ejecutar dos transacciones concurrentes que modifican artefactos vinculados al mismo proyecto simultáneamente, el mecanismo de bloqueo optimista detecta la versión previa desfasada y rechaza la segunda con `VERSION_CONFLICT (409)`. Aunque esto demuestra que los controles de integridad funcionan, en ambientes de alta concurrencia no existe un mecanismo de reintento automático (*retry backoff*).
* **Recomendación:** Implementar un middleware de reintento exponencial (1 a 3 intentos) para transacciones que fallen por contención optimista.

---

## 6. Pruebas Pendientes y Limitaciones del Entorno

1. **Transcripción de Audio en Tiempo Real con Whisper:**  
   El backend soporta subida de archivos `.wav`/`.mp3` mediante `multer`, pero la ejecución real de Whisper local requiere binarios compilados de C++ / Python en el contenedor. En las pruebas actuales se valida la ingesta de texto y fuentes documentales, delegando la transcripción de audio a fallbacks simulados.
2. **Generación con Proveedores Externos de IA (Gemini / OpenAI en Producción):**  
   Por directriz estricta de QA, se evaluaron los contratos y la generación utilizando `MockAIProvider` y proveedores locales de Promptfoo para evitar fugas de claves, agotar cuotas y evitar la no-determinación de pruebas automatizadas. Se recomienda mantener una suite nocturna (*nightly build*) con un proyecto de muestra conectado a una clave de prueba de Gemini.

---

## 7. Recomendaciones de Mejora Arquitectónica y QA

1. **Integración en Pipeline CI/CD:**  
   Incorporar la ejecución de `node --test tests/unit/*.test.js` y `npx playwright test` en GitHub Actions o GitLab CI antes de permitir fusiones a la rama `main` o `develop`.
2. **Centralización del Manejador de Errores Prisma:**  
   Mapear explícitamente los códigos comunes de Prisma (`P2002` -> 409, `P2025` -> 404, `P2003` -> 422) en `error.middleware.js` para asegurar respuestas HTTP semánticas en toda la API.
3. **Paginación en `GET /projects/:projectId/requirements`:**  
   Actualmente la lista de requerimientos se recupera completa sin paginar. Para proyectos con más de 100 requisitos, se recomienda implementar paginación basada en cursor o límite/desplazamiento (`limit`/`offset`).

