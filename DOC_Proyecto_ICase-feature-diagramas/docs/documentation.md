# Mantenimiento de documentación

## Documentos de la raíz en el sitio

La sección **Proyecto y colaboración** publica README, contribución, conducta, licencia, cambios y seguridad. El hook `scripts/mkdocs_hooks.py` lee los Markdown originales de la raíz al compilar y los incorpora como páginas virtuales, adaptando sus enlaces. No hace falta copiarlos a `docs/`. MkDocs también vigila esos archivos para recargar al editarlos.

Compose monta cada documento y el hook en modo lectura. Tras añadir o cambiar estos montajes, recrear el servicio para aplicarlos:

```sh
docker compose up -d --force-recreate mkdocs
```

## Con Docker Compose

Desde la raíz, ejecutar:

```sh
docker compose up -d mkdocs
```

Abrir `http://localhost:8000`. El servicio también se inicia con `docker compose up --build -d` junto con el proyecto. Monta `mkdocs.yml` y `docs/` desde el equipo y recarga las páginas al editar la documentación. No requiere instalar Python localmente.

Para consultar logs o compilar en modo estricto:

```sh
docker compose logs mkdocs
docker compose run --rm mkdocs build --strict
```

La compilación de este comando queda dentro del contenedor temporal.

## Con Python local

Requiere Python 3.9 o posterior. Desde la raíz:

```sh
python -m venv .venv-docs
```

Activar el entorno en PowerShell con `.venv-docs\Scripts\Activate.ps1`, o en Linux/macOS con `source .venv-docs/bin/activate`.

```sh
python -m pip install -r requirements-docs.txt
python -m mkdocs serve
```

Abrir `http://127.0.0.1:8000`. Para generar el sitio:

```sh
python -m mkdocs build --strict
```

Agregar páginas técnicas a `docs/` y registrarlas en `mkdocs.yml`. Usar enlaces relativos entre páginas. Las políticas de comunidad permanecen en la raíz. Los contratos de API se mantienen en `backend/src/docs/` para que estén disponibles en el contenedor sin duplicar archivos.

El visor Swagger de MkDocs necesita una copia estática del contrato y de los recursos UI. Para actualizarla, junto con los catálogos de endpoints y plantillas literales:

```sh
cd backend
npm run docs:sync
npm run docs:check
```

Versionar los archivos generados en `docs/assets/swagger/`, `docs/api-catalog.md` y `docs/prompt-templates.md`, para que Compose pueda servirlos sin instalar npm. No editarlos manualmente. La fuente del contrato sigue siendo `backend/src/docs/openapi.json`; la prueba comprueba que la copia de MkDocs coincide.

No publicar secretos, evidencia de usuarios ni datos de producción. La compilación genera `site/`; su publicación se configura según el alojamiento elegido.

Referencias: [Material for MkDocs](https://squidfunk.github.io/mkdocs-material/getting-started/) y [MkDocs](https://www.mkdocs.org/user-guide/).
