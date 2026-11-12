# Generación de código por etapas

El apartado **Generación de código** presenta las dependencias aprobadas y siete etapas guardadas por proyecto: stack, estructura, base de datos, endpoints, backend integrado, frontend conectado y Docker. La especificación de pantallas se aprueba en **Navegación** y cada diseño de Google Stitch se revisa y aprueba en **Mockups**. La generación usa esas versiones; nunca las sustituye silenciosamente.

Cada versión requiere comprobaciones técnicas, revisión de Sonnet y aprobación de una persona. En la primera etapa se aprueban backend, base de datos, frontend y servicios por separado. Cada endpoint de la cuarta etapa tiene aprobación de definición y luego aprobación de funcionamiento tras ejecutar pruebas. La quinta etapa integra los endpoints existentes, conservando sus archivos. Los resultados muestran archivos afectados, errores, observaciones y evidencia. La vista de archivos, la aplicación ejecutable y las pruebas son recursos diferentes. El ZIP solo se habilita tras verificar y aprobar la entrega.

Las aprobaciones y trabajos viven en `DeliveryWorkflow`, `DeliveryJob` y `DeliveryCall`. El trabajo generado se guarda por proyecto y versión en `backend/.cache/implementation`. Los archivos modificados a mano se conservan y los conflictos impiden sobrescribirlos. Una solicitud de cambio registra referencias afectadas e invalida las aprobaciones dependientes. Un reinicio del servidor deja los trabajos en estado interrumpido para reanudación explícita. Las llamadas a modelos y Stitch quedan registradas con identificadores y consumo; un resultado remoto ambiguo de Stitch exige resolver el ID remoto antes de reintentar la generación.

## Aprobación y entrega verificadas

La pantalla Código utiliza exclusivamente estas siete etapas. Las rutas compatibles `/stages/status` y `/stages/approve` consultan el mismo servicio: no existe una lista de aprobaciones independiente. Las aprobaciones antiguas de `CODEGEN_PROGRESSIVE_GATE`, sin revisión del contenido o sin confirmación manual, se conservan en el historial y dejan de habilitar etapas.

Antes de aprobar, la persona confirma que revisó y probó esa versión y puede registrar sus resultados. La aprobación guarda la versión, el hash de contenido, la revisión, la resolución de observaciones y la referencia a los archivos; no genera ni sobrescribe código. Las etapas ejecutables exigen pruebas con resultado y fecha, y la entrega exige además pruebas reales en contenedores. Un cambio de contratos, permisos, plataforma o fuentes invalida las etapas dependientes.

El panel permite inspeccionar archivos y mockups, resolver observaciones, consultar errores, registros y consumo, reanudar trabajos y recuperar una pantalla por su ID remoto de Stitch. Swagger expone únicamente definiciones aprobadas, incluye autenticación Bearer JWT y el endpoint de login con `identifier` y `password`. El entorno no arranca si falta la base aislada comprobada o falla su conexión.

Ambas rutas de ZIP exigen la entrega vigente y los mismos archivos que se verificaron. No hay descarga alternativa tras un fallo y se excluyen archivos de entorno privados. No se valida una aplicación por el hecho de que responda su endpoint de salud.

Pruebas de regresión sin proveedores: `npm run test:delivery-workflow`. La persistencia de las siete etapas se comprueba con `DELIVERY_TEST_DATABASE_URL` apuntando exclusivamente a `delivery_test`. Las pruebas de navegador `tests/delivery-workflow.spec.js` utilizan API simulada. La prueba histórica que accede al proyecto Autron5 real es optativa: requiere `AUTRON5_LIVE_ACCEPTANCE=true`; no pertenece a la validación aislada de una instalación.

El chat híbrido consulta OpenAI y después Anthropic; muestra errores parciales y el consumo informado. El modo local no llama a proveedores y las propuestas se presentan como candidatos pendientes. No modifica archivos ni concede aprobaciones. El esfuerzo de razonamiento es opcional y se omite para la familia GPT-4; su soporte depende del modelo, conforme a la [documentación oficial de OpenAI](https://developers.openai.com/api/docs/guides/reasoning).

Verificación de esta revisión: suite general, 79 pruebas aprobadas y una de persistencia optativa omitida; generación, 105 aprobadas y la aceptación histórica de Autron5 omitida; entrega con PostgreSQL temporal, 25 aprobadas sin omisiones; navegador, seis pruebas aprobadas. El runtime generado pasó migraciones, HTTP, permisos, recorridos con persistencia, migración incremental y ejecución en Docker, incluyendo conservación de datos tras reiniciar. El informe se guarda en `backend/.verification/delivery-runtime-report.json`. Las respuestas de IA fueron dobles; no se acredita disponibilidad ni calidad de proveedores reales con estas pruebas. Se retiraron los contenedores temporales al finalizar.

## Configuración

En el `.env` raíz configure `DOCUMENT_PREPARATION_MODEL` con el ID de Luna habilitado en su cuenta OpenAI, `DOCUMENT_REVIEW_MODEL` con el ID de Sonnet habilitado en Anthropic, y sus claves respectivas. `AI_PROVIDER` sigue configurando el análisis anterior; este flujo usa los dos modelos anteriores según la tarea. Para Stitch configure la integración MCP y sus credenciales en el backend. No se envían solicitudes externas al ejecutar las pruebas locales descritas aquí.

Para comprobar etapas que crean y migran bases, configure una instancia PostgreSQL **aislada** mediante `TEST_DB_HOST`, `CODEGEN_TEST_DB_PORT`, `TEST_DB_USER`, `TEST_DB_PASSWORD` y `TEST_DB_ADMIN_NAME`. El usuario de prueba necesita permiso para crear bases. `CODEGEN_CHROMIUM_EXECUTABLE_PATH` apunta a Chrome o Chromium para las pruebas de navegador. La prueba de contenedores de la séptima etapa se habilita explícitamente con `DELIVERY_TEST_DOCKER=true` y usa otro nombre de proyecto Compose y volumen. No use la base `icase_db` como base de pruebas.

Cuando iCASE corre dentro de Docker, la etapa 7 utiliza Docker CLI y Compose instalados en el backend y el socket de Docker montado en el contenedor. Los puertos del proyecto generado se asignan de forma dinámica y su base usa un volumen independiente. `CODEGEN_DOCKER_HOST` permite al verificador llegar a esos puertos desde el contenedor iCASE; en Docker Desktop se usa `host.docker.internal`.

El ZIP de entrega excluye el `.env` privado. Antes de levantar una copia descargada, cree su propio `.env` con `DB_PASSWORD`, `JWT_SECRET` e `INITIAL_ADMIN_PASSWORD`; Compose exige esos valores.

## Verificación

Desde `backend`: `npx prisma validate`, `npm run test:delivery-workflow` y, con la base aislada activa, `npm run test:delivery-runtime`. Desde `frontend`: `npm run build`. La prueba de runtime construye y ejecuta la aplicación exportada, comprueba migraciones, HTTP, permisos y navegador, y prueba una migración incremental que conserva datos existentes. Para probar Docker, ejecute el mismo test con `DELIVERY_TEST_DOCKER=true` y Docker disponible.

En la instalación Docker actual, `docker-entrypoint.sh` sincroniza las tablas nuevas con `prisma db push` sin `--accept-data-loss` al reconstruir y arrancar el backend. La migración aditiva `202611100002_delivery_workflow` queda disponible para instalaciones que administran historial con Prisma Migrate. Use una sola estrategia para cada base y revise el respaldo antes de actualizar una instalación con datos. Las pruebas locales nunca deben ejecutarse contra la base de producción.
