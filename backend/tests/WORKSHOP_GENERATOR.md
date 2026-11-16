# Corrección del generador de backend de taller

La corrección reside en ICASE. No se modificó `autron-revision` durante este trabajo.

## Implementación

- `src/services/codegen/workshopProfile.js` compila un perfil explícito a partir del modelo de taller, sus requisitos y sus cuatro roles. No selecciona implementaciones por el nombre del proyecto. Los dominios que no cumplen el perfil conservan el generador general.
- `workshop/runtime.js` es una plantilla del generador: se emite en una descarga nueva junto con sus modelos y configuración. Implementa operaciones sobre PostgreSQL mediante Sequelize y transacciones, sin datos simulados.
- `workshopContracts.js` documenta los adaptadores consumidos por las pantallas y relaciona permisos configurables con rutas reales.
- El constructor de especificaciones, las validaciones, los controladores y las operaciones utilizan el mismo perfil. Una especificación antigua cuyo contrato cambia no conserva su aprobación como si fuera el mismo documento.

Incluye altas y cambios de usuarios, contraseñas temporales y revocación de sesiones, recuperación mediante correo, clientes sin cuenta obligatoria, vehículos propios, disponibilidad y citas, recepción con o sin cita, diagnóstico, códigos OBD, zonas, evidencia privada optimizada, cotización calculada, decisiones parciales, órdenes autorizadas, asignación de mecánicos, actividades y consumo de repuestos, ventas y compras, alertas, mantenimiento, expediente, conocimiento técnico, indicadores y auditoría.

Se aceptan los alias explícitos del frontend, incluidos `stock`, `duracionEstimadaMinutos`, `repuestoId`, `tipoItem/elementoId` e `itemsAprobadosIds`. Se siguen rechazando propiedades desconocidas y valores contradictorios.

Las salidas de stock usan bloqueo de filas. Las ventas fallidas revierten encabezado, detalles y movimientos; las operaciones con `claveOperacion` admiten reintentos; cerrar una orden descuenta únicamente el consumo pendiente. Los campos de responsable y fecha se asignan en el servidor.

## Verificación realizada

Se generaron 224 archivos desde el fixture `Taller de verificacion`, con un nombre distinto del proyecto original. Se construyó y ejecutó ese backend nuevo en un proyecto Docker de prueba con PostgreSQL en tmpfs, sin puertos publicados ni volúmenes de la aplicación.

- **211 casos automáticos aprobados, 0 fallos y 0 bloqueados.**
- **15 pasos del recorrido completo aprobados**, desde los cuatro accesos hasta diagnóstico, autorización, reparación, consumo, venta e indicadores.
- **35 pruebas de regresión específicas aprobadas**, incluidas validación de especificaciones, múltiples dominios, permisos, importaciones, descarga de revisión y arranque.
- **11 pruebas adicionales de perfil e integridad aprobadas**; este grupo se solapa con el anterior.
- Cinco aspectos quedan como comprobaciones externas: interfaz/navegadores, HTTPS, respaldo y restauración, usabilidad y revisión arquitectónica. No se certifican mediante HTTP.

Informe reproducible de la última ejecución:

`backend/.verification/workshop-generated/tests/results/2026-11-16T01-12-29-745Z-54e18a/FLUJO_BACKEND.md`

El informe adjunto `run.json` registra el hash del backend ejecutado, el aislamiento y la limpieza del entorno.

La suite general `npm run test:codegen` tiene 102 aprobaciones, 3 fallos y 1 omitida. Los fallos restantes corresponden al estado HTTP esperado por una prueba de trabajo heredado, una expectativa antigua de registro sin middleware y una clase CSS de un mockup. No se presenta esa suite como aprobada.

## Repetir

Desde `backend`:

```powershell
npm run test:codegen:workshop
npm run test:codegen:workshop:flow
```

El segundo comando genera desde las fuentes de ICASE antes de construir y probar. No utiliza un backend exportado y corregido a mano. Docker debe estar disponible; la limpieza solo afecta al proyecto de prueba con identificador aleatorio.

## Aplicación

El backend de ICASE se reinició y respondió HTTP 200 en `/api/projects`. La descarga anterior conserva su contenido: para recibir las correcciones hay que generar una especificación actual y descargar un nuevo proyecto. Si el cambio de contrato invalida una aprobación anterior, debe revisarse y aprobarse la nueva especificación.

La recuperación por correo requiere `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD` y `SMTP_FROM`, transmitidos por el Compose generado. Sin SMTP la API devuelve `503 MAIL_NOT_CONFIGURED`; no simula el envío. El envío a un servidor SMTP real no se comprobó sin credenciales.

Los espacios predeterminados usan UTC. Las pruebas no certifican la presentación de horarios, imágenes o estados en las pantallas del frontend.
