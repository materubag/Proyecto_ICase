# Frontend funcional emitido por ICASE

## Hallazgos corregidos

Las pantallas de referencia mezclaban llamadas reales con cambios locales que anunciaban operaciones guardadas. Compras y proveedores generaban registros únicamente en memoria; varios ajustes y citas ignoraban errores; había datos de ejemplo para VIN, mantenimiento y proveedores. Faltaban el alta de vehículos del cliente, la creación visible de órdenes autorizadas y partes de la consulta del expediente.

`src/services/codegen/workshopFrontend.js` y `workshop/Workspace.jsx` emiten un espacio funcional de **20 módulos**, con la cabecera, estilos y roles del proyecto. Se genera para el perfil de taller reconocido por modelo y requisitos, aunque el conjunto de mockups esté incompleto. Los demás dominios conservan su frontend general.

El punto de entrada generado utiliza ese espacio funcional. Las referencias anteriores no controlan el recorrido activo. El manifiesto `FRONTEND_CAPABILITIES.json` enumera módulos, roles y requisitos; no declara automáticamente que una descarga particular haya sido probada.

## Conexiones y funcionalidad

| Módulo | Funcionalidad conectada |
| --- | --- |
| Acceso | Inicio de sesión, verificación de sesión, cierre, recuperación y cambio obligatorio de contraseña temporal. |
| Usuarios | Alta con clave temporal, edición de nombre/correo/rol/estado y regeneración de clave. |
| Permisos | Lectura y escritura de permisos reales; las acciones visibles utilizan los permisos de la sesión verificada. |
| Clientes | Alta y edición sin cuenta obligatoria; generación de acceso para un cliente existente. |
| Vehículos | Alta propia con `/api/mi/vehiculos`; edición, odómetro sin retrocesos y acceso al expediente. Recepción elige un cliente registrado. |
| Citas | Disponibilidad persistente, solicitud, confirmación, cancelación, reprogramación y horarios del taller. |
| Recepción | Ingreso con o sin cita, combustible, kilometraje, observaciones, mecánico inicial y fotografías. |
| Diagnóstico | Fallas, severidades, códigos OBD, mapa visual de zonas, evidencia y conceptos para cotizar. |
| Servicios | Altas y cambios con precios numéricos, estado activo y duración expresada en minutos. |
| Cotizaciones | Servicios y repuestos reales; importes calculados; consulta, aprobación completa/parcial y rechazo con IDs de conceptos. |
| Órdenes | Creación desde autorización, asignación múltiple, fases, bitácora, pruebas y consumo. El cierre descuenta solo el consumo pendiente. |
| Inventario | Existencias y mínimos reales, edición del catálogo, ajustes con motivo y alertas. |
| Ventas | Venta persistente, salida de stock, total confirmado y consulta de productos del documento. |
| Compras | Proveedores persistentes, ingreso de stock y consulta de los detalles registrados. No se agrega un IVA ficticio al total. |
| Expediente | Recepciones, diagnósticos, fallas, zonas, reparaciones, avisos y fotografías privadas cargadas con autenticación. |
| Mantenimiento | Reglas por vehículo o tipo, días/kilómetros, anticipación y consulta de avisos. |
| Conocimiento | Búsqueda real, artículos, propuestas y resolución de propuestas por Administrador. |
| Notificaciones | Avisos propios, marcado de lectura persistente y alertas de inventario para personal autorizado. |
| Indicadores | Consulta por fechas, métricas reales, descarga CSV e impresión nativa del navegador. |
| Auditoría | Consulta del registro del servidor, sin edición ni eventos ficticios creados en el navegador. |

Los formularios conservan los datos cuando falla una petición y muestran el error. Los botones se bloquean durante el envío. Los cambios visibles se confirman con el servidor; los registros operativos no se guardan en `localStorage`.

La navegación tiene un menú completo accesible en escritorio y móvil. En móvil, los registros se muestran como tarjetas con sus acciones, para evitar que queden escondidas al extremo de una tabla.

La ampliación del backend en este cambio se limita a exponer los permisos propios en `/auth/me` y los datos ya registrados de fallas, zonas y actividades en el expediente. Se mantienen los filtros de propietario.

## Verificación

Se generó un proyecto nuevo, se construyeron frontend y backend y se ejecutó Microsoft Edge sin interfaz con cuatro sesiones reales. El entorno utilizó un proyecto Docker aleatorio, PostgreSQL en tmpfs y un único puerto HTTP aleatorio en `127.0.0.1`; al terminar se eliminaron sus contenedores. No se modificaron `autron-revision` ni los datos de la aplicación.

- **25 casos de navegador aprobados**, sin errores JavaScript ni rutas inesperadas.
- **7 pruebas del perfil/generador/cliente HTTP aprobadas**.
- **211 casos del backend aprobados nuevamente**, con los 15 pasos del recorrido completo.
- La construcción de Vite y Tailwind se ejecutó dentro del contenedor frontend generado.
- Se inspeccionaron capturas de escritorio y móvil. La prueba móvil también comprueba que la página no desborde horizontalmente.

Los casos incluyen la creación y recarga de registros, autorización parcial, consumo y cierre sin doble descuento, imágenes privadas, compras y ventas, CSV descargado, errores sin pérdida del formulario, cuentas temporales, permisos, conocimiento, mantenimiento, notificaciones y navegación restringida por rol.

Informe del navegador:

`backend/.verification/workshop-generated/tests/ui-results/2026-11-16T02-08-03-550Z/results.json`

`run.json` conserva los hashes de las fuentes ejecutadas y confirma la limpieza del entorno. Las capturas están junto al informe.

Informe de backend posterior al cambio:

`backend/.verification/workshop-generated/tests/results/2026-11-16T02-09-33-614Z-fcc8f0/FLUJO_BACKEND.md`

La suite general conserva sus tres fallos conocidos: expectativa HTTP de un trabajo heredado, expectativa antigua de registro sin middleware y clase CSS de un mockup general. No se declara aprobada esa suite completa: 102 aprobaciones, 3 fallos y 1 omitida.

## Repetir y aplicar

Con las dependencias de backend y frontend instaladas, Docker disponible y Microsoft Edge instalado, desde `backend`:

```powershell
npm run test:codegen:workshop
npm run test:codegen:workshop:ui
npm run test:codegen:workshop:flow
```

El runner de navegador vuelve a generar el proyecto antes de construirlo; no prueba una copia corregida manualmente.

Para recibir los cambios en el proyecto del usuario hay que generar y descargar una nueva versión desde ICASE. La recuperación de acceso requiere SMTP configurado: se verificó que la interfaz muestra el fallo cuando no hay servicio de correo y no anuncia un envío exitoso. No se ensayó entrega de correo con un proveedor real. La opción de impresión utiliza el diálogo del navegador; el CSV sí se descarga como archivo con los datos consultados.
