# Datos y trazabilidad

La definición vigente de modelos, campos, enumeraciones e índices está en `backend/prisma/schema.prisma`.

`Project` agrupa fuentes, requisitos y modelos. Las versiones de fuentes conservan evidencia; los candidatos se revisan antes de convertirse en elementos oficiales. Actores, entidades, atributos, relaciones, casos de uso, navegación y arquitectura describen el sistema analizado.

`Artifact` y `ArtifactVersion` conservan artefactos y sus versiones. `RequirementVersion`, `ChangeRequest` y `ProjectBaseline` permiten revisar historial, impacto y snapshots. Las relaciones de dependencia permiten marcar elementos afectados como desactualizados.

Las operaciones de ingeniería utilizan transacciones y control de revisión donde corresponde. Un conflicto de versión requiere recargar el estado y revisar los cambios; no debe resolverse sobrescribiendo información a ciegas.

Antes de cambiar Prisma: revisar compatibilidad con datos existentes, generar el cliente y probar sobre una base aislada. No ejecutar resets ni aceptar pérdida de datos en una base compartida.
