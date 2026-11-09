# Política de seguridad

## Alcance de soporte

Los reportes se revisan sobre la rama de desarrollo vigente. Actualmente no hay un calendario de soporte ni mantenimiento garantizado de versiones anteriores.

## Reportar una vulnerabilidad

No publicar vulnerabilidades sin corregir, credenciales ni documentos privados en incidencias públicas.

Usar el reporte privado de vulnerabilidades del alojamiento del repositorio si está habilitado. En caso contrario, contactar a una persona mantenedora por un canal privado verificado en su perfil. Si no existe uno, solicitar un canal privado sin describir públicamente la vulnerabilidad. El proyecto todavía no define un correo de seguridad.

Incluir versión o commit, componente afectado, pasos mínimos de reproducción, impacto y posibles mitigaciones. Usar datos sintéticos y ocultar secretos. El equipo revisará el reporte y coordinará corrección y divulgación; no se promete un plazo de respuesta que todavía no está establecido.

## Operación

- Guardar secretos fuera del repositorio y rotarlos si se exponen.
- Restringir acceso a PostgreSQL, webhooks, documentos y logs.
- Configurar TLS y controles de acceso antes de exponer la API; las rutas actuales no implementan autenticación de usuarios.
- Revisar dependencias, límites de archivos y respaldos antes de desplegar.
- Evitar enviar evidencia sensible a proveedores externos sin la autorización correspondiente.
