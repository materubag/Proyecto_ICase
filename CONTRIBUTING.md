# Contribuir a ICASE

## Preparación

Leer `README.md` y la documentación técnica en `docs/`. Configurar el entorno con `.env.example`, instalar dependencias con `npm ci` en backend y frontend, y generar el cliente Prisma. Nunca compartir credenciales ni evidencia de usuarios.

## Flujo de trabajo

1. Describir el problema o mejora y su alcance en una incidencia, evitando datos sensibles.
2. Crear una rama con un nombre descriptivo, por ejemplo `feat/openapi` o `fix/source-validation`.
3. Realizar cambios acotados siguiendo CommonJS en el backend y los patrones existentes en React.
4. Actualizar documentación técnica, contrato OpenAPI y `CHANGELOG.md` cuando cambie el comportamiento público.
5. Ejecutar las comprobaciones pertinentes y abrir una solicitud de cambios con problema, solución y resultados de validación.

## Comprobaciones

```sh
cd backend
npm test
npm run docs:check
cd ../frontend
npm run build
cd ..
python -m mkdocs build --strict
```

Los cambios de persistencia requieren revisar el esquema Prisma, compatibilidad y pruebas en una base aislada. Ejecutar integración o navegador cuando el cambio lo requiera e indicar dependencias externas que no se hayan verificado.

## Revisión

Explicar cambios de API, riesgos de migración y pasos de reproducción. No incluir `node_modules`, `site/`, `.env`, logs ni datos reales. Seguir [el código de conducta](CODE_OF_CONDUCTS.md). Las vulnerabilidades se comunican según [SECURITY.md](SECURITY.md).

Las contribuciones se distribuyen bajo la licencia ISC del proyecto, conservando la autoría correspondiente.
