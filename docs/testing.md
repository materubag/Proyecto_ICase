# Pruebas

## Backend sin proveedores externos

```sh
cd backend
npm test
npm run docs:check
```

La suite principal precarga fixtures offline. La verificación de documentación valida el contrato y usa un servidor efímero para comprobar JSON, HTML, CSS y salud, sin consultar PostgreSQL.

## Integración

```sh
cd backend
npm run test:integration
```

Requiere PostgreSQL configurado. Utilizar una base de prueba: la integración crea datos y puede archivarlos. Las pruebas con fixtures no validan proveedores reales.

## Frontend

```sh
cd frontend
npm run build
npm run test:e2e
```

Las pruebas de navegador requieren la API disponible y el navegador configurado por Playwright.

## Portal técnico

```sh
python -m pip install -r requirements-docs.txt
python -m mkdocs build --strict
```

Ejecutar desde la raíz. La salida `site/` es generada y no debe versionarse.
