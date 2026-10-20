# Integraciones externas y servicios de IA

Esta página describe las llamadas implementadas en el repositorio. Los nombres de modelos son valores configurados, no evidencia de una ejecución ni garantía de acceso a un modelo en una cuenta concreta. No se documenta Claude como integración disponible: no existe un adaptador Anthropic en el código actual.

## Mapa de comunicación

```text
React → Express /api → controladores → servicios → Prisma → PostgreSQL
                                    ├─ extracción local de PDF
                                    ├─ Gemini/OpenAI → JSON → validación de evidencia
                                    ├─ generadores locales / IA → Mermaid → validación
                                    └─ Stitch / n8n / IA / fallback local → mockups
```

Los proveedores se invocan desde el backend; el navegador no necesita conocer sus claves. Hay dos interfaces: `extractDocumentBatch` para el pipeline documental actual y `analyzeProject` para adaptadores de compatibilidad y chat. No todos los proveedores implementan ambas.

## Servicios y autenticación

| Servicio | Método y destino usado por el código | Autenticación | Entrada → salida |
| --- | --- | --- | --- |
| OpenAI | `POST https://api.openai.com/v1/chat/completions` | `Authorization: Bearer <OPENAI_API_KEY>` | `model`, `messages`, `response_format`, `reasoning_effort` opcional → `choices[].message.content` con JSON y `usage` |
| Gemini | `POST https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent` | Extracción: `x-goog-api-key`; adaptador compatible: clave en query `key` | `systemInstruction`, `contents`, `generationConfig` → `candidates[].content.parts[].text` y `usageMetadata` |
| Ollama | `POST {OLLAMA_BASE_URL}/api/generate` | No añade credenciales | `model`, `prompt`, `format: "json"`, `stream: false`, `options.temperature` → campo `response`, posteriormente parseado |
| Google Stitch | `POST https://stitch.googleapis.com/mcp` | `X-Goog-Api-Key: <GOOGLE_STITCH_API_KEY>` | JSON-RPC `tools/call`: `create_project` y `generate_screen_from_text` → identificadores y recursos HTML/captura |
| n8n mockups | `POST {N8N_MOCKUP_WEBHOOK}` | El cliente no añade cabecera de autenticación | Proyecto, requisitos y pantallas → `{screens: [...]}` |
| Whisper local | `GET /health`, `POST /transcribe` en `http://whisper:8001` dentro de Compose | Sin autenticación en FastAPI | Multipart `file` → `{success,text,language,duration}` |

Fuentes: `backend/src/services/ai/OpenAIProvider.js`, `GeminiProvider.js`, `OllamaProvider.js`, `backend/src/services/mockup/GoogleStitchService.js`, `mockup.service.js` y `whisper/main.py`.

## Compatibilidad por flujo

| Flujo | Implementación efectiva |
| --- | --- |
| Extracción PDF versionada | `documentExtraction.createProvider` admite `gemini` y `openai`. `local` evita la IA y deja relaciones sin resolver para revisión. Elegir `ollama` o `mock` no añade soporte al contrato documental |
| Chat contextual | Recuperación local de requisitos; llamadas opcionales a `ollama` u `openai` mediante `analyzeProject` |
| Diagramas `/projects/{id}/diagrams/*` | IA para varios tipos con Gemini/OpenAI; rutas deterministas según tipo/configuración; ver [prompts](prompts.md) |
| Diagramas `/engineering/diagrams` | Registro de generadores deterministas; no implica una llamada a un modelo |
| Mockups | Stitch si se configura y tiene clave; n8n si se selecciona y tiene webhook; respaldo de IA y generación local según resultado |
| Audio desde fuentes del backend | Las rutas `/projects/{id}/sources/audio` y `/sources/{id}/retry` rechazan con `415 PDF_REQUIRED`. Tener Whisper en Compose no habilita esas rutas |

## Modelos y versión efectiva

| Variable | `.env.example` / Compose | Valor por defecto en `config/env.js` |
| --- | --- | --- |
| `AI_PROVIDER` | `gemini` | `gemini` |
| `GEMINI_MODEL` | `gemini-3.1-flash-lite` | `gemini-3.1-flash-lite` |
| `OPENAI_MODEL` | `gpt-4o` | `gpt-5.6-luna` |
| `OLLAMA_MODEL` | `llama3` | `llama3` |
| `WHISPER_MODEL` | `base` | `base` |

En Compose prevalecen las variables suministradas al contenedor y sus valores de sustitución. En desarrollo local puede aplicarse el valor por defecto del módulo. La extracción permite `providerOverride` y `modelOverride`; registrar el modelo efectivo de `metrics.model`, el proveedor, `promptVersion` y el commit para reproducir una ejecución. No se fija actualmente un snapshot inmutable de los modelos remotos ni se conoce el modelo interno de Stitch o de un workflow n8n.

## Ejemplo de contrato OpenAI

Ejemplo conceptual de la solicitud que arma el adaptador; no contiene una clave ni representa una ejecución real:

```http
POST /v1/chat/completions
Host: api.openai.com
Authorization: Bearer <clave-solo-en-servidor>
Content-Type: application/json
```

```json
{
  "model": "<OPENAI_MODEL>",
  "response_format": {"type": "json_object"},
  "messages": [
    {"role": "system", "content": "<plantilla versionada de extracción>"},
    {"role": "user", "content": "<JSON de segmentos y requisitos conocidos>"}
  ]
}
```

El adaptador exige `finish_reason: "stop"` y parsea el JSON de `message.content`. JSON mode no sustituye la validación de campos y evidencia del proyecto. La documentación oficial distingue JSON válido de cumplimiento de un esquema: [OpenAI Chat Completions](https://developers.openai.com/api/reference/resources/chat).

## Ejemplo de contrato Gemini

```json
{
  "systemInstruction": {"parts": [{"text": "<plantilla de extracción>"}]},
  "contents": [{"parts": [{"text": "<JSON del lote>"}]}],
  "generationConfig": {
    "responseMimeType": "application/json",
    "maxOutputTokens": 8192,
    "temperature": 0
  }
}
```

El adaptador documental exige `finishReason: "STOP"`, excluye partes marcadas como pensamiento y convierte el texto en JSON. Referencia del endpoint: [Gemini generateContent](https://ai.google.dev/api/generate-content).

## n8n y mockups

Ejemplo reducido de entrada al webhook:

```json
{
  "projectId": "<id>",
  "projectName": "Catálogo de ejemplo",
  "platform": "WEB",
  "actors": [],
  "useCases": [],
  "requirements": [{"id": "<req>", "code": "RF-01", "description": "Consultar productos", "status": "APPROVED"}],
  "screens": [{"id": "<node>", "name": "Catálogo", "route": "/catalogo", "platform": "WEB"}],
  "prompt": "<instrucciones de diseño>"
}
```

Salida esperada, cuyos nombres y rutas deben corresponder a la navegación solicitada:

```json
{"screens":[{"name":"Catálogo","route":"/catalogo","html":"<main><h1>Catálogo</h1></main>","components":[]}]}
```

El proveedor de mockups puede recurrir a respaldos si fallan Stitch o n8n. Por tanto, una pantalla renderizada no demuestra que un servicio remoto haya respondido. Revisar `provider`, versiones, logs y el contenido final. Los workflows de n8n no están versionados en este repositorio.

## Límites, cuota y errores

| Componente | Límite o comportamiento implementado |
| --- | --- |
| Express | JSON y URL-encoded de hasta `10mb`; sin limitador global por usuario |
| PDF documentos | Un archivo `file`; `MAX_PDF_SIZE_MB`, por defecto 10 MB |
| PDF fuentes | Hasta 20 `files`, máximo por archivo según `MAX_PDF_SIZE_MB` |
| PDF archivos de proyecto | Hasta 15 `files`, 35 MB por archivo en su middleware |
| Extracción actual | Segmentos de hasta 3000 caracteres; lotes de 12000 caracteres y 8 segmentos por defecto, ajustables con `EXTRACTION_BATCH_CHARS` y `EXTRACTION_BATCH_SIZE` en el proceso |
| Gemini documental | Timeout 90 s; temperatura 0; salida hasta 8192 tokens; intervalo `GEMINI_MIN_REQUEST_INTERVAL_MS`, defecto 6000 ms; un reintento en red, 429 o 503 |
| OpenAI documental | Timeout 120 s; JSON mode; sin reintento automático en `extractDocumentBatch` |
| Ollama compatible | `OLLAMA_TIMEOUT`, defecto 120 s; temperatura 0.1, sin streaming |
| n8n mockups | `N8N_TIMEOUT`: Compose propone 120000 ms; el módulo usa 900000 ms si no recibe valor. Valores menores que 10000 se interpretan como segundos |
| Stitch | Concurrencia por `STITCH_CONCURRENCY`, defecto 4 |
| Whisper | Límite `MAX_AUDIO_SIZE_MB`, defecto 100 MB; una transcripción a la vez por proceso |

Los límites del proveedor dependen de cuenta y modelo; no se codifica una cuota comercial fija. Los valores `GEMINI_MAX_OUTPUT_TOKENS` o `AI_MAX_CHUNKS` de flujos compatibles no gobiernan todas las llamadas: el método documental usa los valores indicados arriba. Las variables `EXTRACTION_BATCH_*` no están propagadas en Compose actualmente; añadirlas explícitamente si se desea configurarlas allí.

Un HTTP remoto 429/503 puede aparecer como fallo parcial del lote con resultados locales conservados. Un trabajo asíncrono puede devolver HTTP 200 con `status: "FAILED"`; un diagrama puede usar fallback y responder 200 con metadatos. No hay correspondencia universal entre estado remoto y código HTTP del backend.

## Gestión de claves y observaciones técnicas

1. Copiar `.env.example` a `.env`; completar solo los servicios usados y evitar claves en comandos, capturas o commits.
2. Mantener claves en el backend. No usar prefijos `VITE_` para secretos: sus valores pueden incorporarse al frontend.
3. En despliegues, inyectar secretos con el mecanismo del entorno y restringir acceso al archivo, los contenedores y los logs.
4. Rotar claves expuestas, revisar consumo y limitar privilegios del proyecto del proveedor.
5. El adaptador compatible de Gemini usa clave en query; ocultar URLs en logs/proxies. Los errores de proveedores pueden incorporar detalles remotos; revisar y sanear antes de compartirlos.
6. El cliente n8n no añade token y Whisper/Ollama no tienen autenticación en estos adaptadores: mantenerlos en red controlada o configurar protección externa.

Referencias adicionales: [Ollama generate](https://docs.ollama.com/api/generate). El funcionamiento efectivo se determina por el código y su configuración; estas referencias describen las APIs externas.
