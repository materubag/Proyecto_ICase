# Generación de código por etapas

El apartado **Generación de código** presenta las dependencias aprobadas y siete etapas guardadas por proyecto: stack, estructura, base de datos, endpoints, backend integrado, frontend conectado y Docker. La especificación de pantallas se aprueba en **Navegación** y cada diseño de Google Stitch se revisa y aprueba en **Mockups**. La generación usa esas versiones; nunca las sustituye silenciosamente.

Cada versión requiere comprobaciones técnicas, revisión de Sonnet y aprobación de una persona. En la primera etapa se aprueban backend, base de datos, frontend y servicios por separado. Cada endpoint de la cuarta etapa tiene aprobación de definición y luego aprobación de funcionamiento tras ejecutar pruebas. La quinta etapa integra los endpoints existentes, conservando sus archivos. Los resultados muestran archivos afectados, errores, observaciones y evidencia. La vista de archivos, la aplicación ejecutable y las pruebas son recursos diferentes. El ZIP solo se habilita tras verificar y aprobar la entrega.

Las aprobaciones y trabajos viven en `DeliveryWorkflow`, `DeliveryJob` y `DeliveryCall`. El trabajo generado se guarda por proyecto y versión en `backend/.cache/implementation`. Los archivos modificados a mano se conservan y los conflictos impiden sobrescribirlos. Una solicitud de cambio registra referencias afectadas e invalida las aprobaciones dependientes. Un reinicio del servidor deja los trabajos en estado interrumpido para reanudación explícita. Las llamadas a modelos y Stitch quedan registradas con identificadores y consumo; un resultado remoto ambiguo de Stitch exige resolver el ID remoto antes de reintentar la generación.

## Configuración

En el `.env` raíz configure `DOCUMENT_PREPARATION_MODEL` con el ID de Luna habilitado en su cuenta OpenAI, `DOCUMENT_REVIEW_MODEL` con el ID de Sonnet habilitado en Anthropic, y sus claves respectivas. `AI_PROVIDER` sigue configurando el análisis anterior; este flujo usa los dos modelos anteriores según la tarea. Para Stitch configure la integración MCP y sus credenciales en el backend. No se envían solicitudes externas al ejecutar las pruebas locales descritas aquí.

Para comprobar etapas que crean y migran bases, configure una instancia PostgreSQL **aislada** mediante `TEST_DB_HOST`, `CODEGEN_TEST_DB_PORT`, `TEST_DB_USER`, `TEST_DB_PASSWORD` y `TEST_DB_ADMIN_NAME`. El usuario de prueba necesita permiso para crear bases. `CODEGEN_CHROMIUM_EXECUTABLE_PATH` apunta a Chrome o Chromium para las pruebas de navegador. La prueba de contenedores de la séptima etapa se habilita explícitamente con `DELIVERY_TEST_DOCKER=true` y usa otro nombre de proyecto Compose y volumen. No use la base `icase_db` como base de pruebas.

Cuando iCASE corre dentro de Docker, la etapa 7 utiliza Docker CLI y Compose instalados en el backend y el socket de Docker montado en el contenedor. Los puertos del proyecto generado se asignan de forma dinámica y su base usa un volumen independiente. `CODEGEN_DOCKER_HOST` permite al verificador llegar a esos puertos desde el contenedor iCASE; en Docker Desktop se usa `host.docker.internal`.

El ZIP de entrega excluye el `.env` privado. Antes de levantar una copia descargada, cree su propio `.env` con `DB_PASSWORD`, `JWT_SECRET` e `INITIAL_ADMIN_PASSWORD`; Compose exige esos valores.

## Verificación

Desde `backend`: `npx prisma validate`, `npm run test:delivery-workflow` y, con la base aislada activa, `npm run test:delivery-runtime`. Desde `frontend`: `npm run build`. La prueba de runtime construye y ejecuta la aplicación exportada, comprueba migraciones, HTTP, permisos y navegador, y prueba una migración incremental que conserva datos existentes. Para probar Docker, ejecute el mismo test con `DELIVERY_TEST_DOCKER=true` y Docker disponible.

En la instalación Docker actual, `docker-entrypoint.sh` sincroniza las tablas nuevas con `prisma db push` sin `--accept-data-loss` al reconstruir y arrancar el backend. La migración aditiva `202611100002_delivery_workflow` queda disponible para instalaciones que administran historial con Prisma Migrate. Use una sola estrategia para cada base y revise el respaldo antes de actualizar una instalación con datos. Las pruebas locales nunca deben ejecutarse contra la base de producción.
