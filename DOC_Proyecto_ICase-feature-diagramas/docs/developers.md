# Guía para desarrolladores

## Comprender el repositorio

| Ruta | Contenido |
| --- | --- |
| `backend/src/app.js`, `server.js` | Aplicación Express y arranque |
| `backend/src/routes/`, `controllers/` | Endpoints y adaptación HTTP |
| `backend/src/services/analysis/` | Extracción, evidencia, identidad, relaciones y tareas |
| `backend/src/services/ai/` | Proveedores actuales y adaptadores compatibles |
| `backend/src/services/diagrams/` | Contexto, prompts, generadores y validación Mermaid |
| `backend/src/services/engineering/` | Modelos, impacto, cambios, versiones y baselines |
| `backend/src/services/mockup/` | Stitch, n8n, respaldo IA y componentes HTML |
| `backend/src/docs/` | Contrato OpenAPI del backend |
| `backend/prisma/` | Esquema y migraciones |
| `backend/tests/`, `frontend/tests/` | Pruebas y fixtures |
| `frontend/src/` | UI React, clientes HTTP y componentes |
| `whisper/` | Servicio FastAPI de transcripción local |
| `docs/`, `mkdocs.yml` | Portal técnico y navegación |
| `docker-compose.yml` | Servicios de desarrollo |

## Dependencias y requisitos

Docker Engine con Compose para el entorno completo. Para desarrollo sin contenedores: Node.js 20 (versión base del Dockerfile), npm y PostgreSQL 16. Python 3.9 o posterior solo para ejecutar MkDocs localmente; Whisper tiene su propia imagen y requisitos. La disponibilidad de Edge/Chromium es necesaria para capturas y pruebas de navegador.

Backend: Express, Prisma, Multer y pdf-parse; Swagger UI para el contrato. Frontend: React, Vite, Mermaid y bibliotecas de UI/modelado. Documentación: MkDocs 1.6.1 y Material 9.6.23. Los archivos `package-lock.json` y `requirements-docs.txt` registran las dependencias correspondientes.

## Instalar y configurar

Clonar el repositorio del equipo y entrar en su raíz. No se inventa aquí una URL remota; usar la URL del repositorio donde se consulta esta guía.

```sh
cp .env.example .env
docker compose up --build -d
```

En PowerShell: `Copy-Item .env.example .env`. Completar las variables antes del arranque. Para evitar iniciar servicios opcionales:

```sh
docker compose up --build -d postgres backend frontend mkdocs
```

Direcciones: frontend `http://localhost:3001`, API `http://localhost:8080/api`, Swagger `http://localhost:8080/api/docs/` y portal `http://localhost:8000`. Ollama y Whisper no son requisitos para extraer PDF mediante Gemini/OpenAI. La primera descarga de modelos locales necesita red y almacenamiento.

Consultar [instalación local](getting-started.md) y [configuración de integraciones](integrations.md). Al ejecutar Node dentro de `backend`, `dotenv` busca `.env` según el directorio de trabajo: exportar las variables en la terminal o crear un archivo local `backend/.env` ignorado por Git. Un `.env` en la raíz no se carga automáticamente al iniciar desde cualquier subdirectorio.

El arranque Docker usa `prisma db push --skip-generate`; no ejecuta automáticamente una estrategia completa de migraciones versionadas. Revisar el diff del esquema, respaldo y procedimiento de actualización antes de aplicarlo a datos compartidos.

## Ciclo de desarrollo y revisión

1. Seguir el punto de entrada HTTP hasta el servicio que implementa la regla.
2. Mantener la lógica de dominio fuera del controlador cuando el patrón existente lo permita.
3. Preservar IDs, evidencia, historial y revisiones; comprobar pertenencia al proyecto y estado de dependencias.
4. Documentar cualquier diferencia entre flujos compatibles y actuales.
5. Agregar pruebas de comportamiento cuando el cambio altere extracción, contratos, persistencia o validación.
6. Actualizar el contrato y la página técnica afectada; seguir `CONTRIBUTING.md` de la raíz para abrir la solicitud de cambios.

## Comprobaciones

```sh
cd backend
npm ci
npm run prisma:generate
npm test
npm run docs:sync
npm run docs:check
cd ../frontend
npm ci
npm run build
cd ..
docker compose run --rm mkdocs build --strict
```

La integración con PostgreSQL y las pruebas E2E se explican en [pruebas](testing.md). No ejecutar integración en una base de producción. Las capturas de esta entrega utilizan una interfaz real con datos sintéticos interceptados; no certifican una integración remota.

## Mantenimiento

- Revisar actualizaciones y auditorías de npm/Python en una rama; validar compatibilidad antes de aplicar cambios mayores.
- Respaldar PostgreSQL y verificar restauraciones.
- Supervisar errores de proveedores, resultados parciales, uso y coste; evitar reintentos ilimitados.
- Mantener prompts y contrato junto con la implementación. Generar el catálogo con `npm run docs:sync`.
- No versionar `.env`, caché de evidencia, logs sensibles, datos de usuarios ni archivos generados de `site/`.
- Consultar `SECURITY.md`, `CODE_OF_CONDUCTS.md`, `LICENSE.md` y `CHANGELOG.md` en la raíz.

## Evidencia visual

Ver [capturas y reproducción](screenshots.md). Las capturas deben actualizarse si cambia la interfaz y deben usar datos sintéticos o anonimizados.
