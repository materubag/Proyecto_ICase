# Datos y trazabilidad

La definición formal de modelos relacionales, campos, enumeraciones e índices se encuentra en `backend/prisma/schema.prisma`.

## 1. Núcleo Relacional del Proyecto
* **`Project`**: Agrupa todas las fuentes, requerimientos, actores, modelos, diagramas y configuraciones de plataforma (`WEB`, `MOBILE`, `DESKTOP`).
* **`Source` y `SourceVersion`**: Almacenan el contenido original extraído de documentos PDF, textos o transcripciones de audio, conservando el hash criptográfico (`fileHash`) y texto normalizado como evidencia auditable.
* **`RequirementCandidate`**: Candidatos propuestos durante la extracción automatizada. Al ser aprobados por revisión humana, se promueven a requerimientos oficiales (`Requirement`).
* **`Actor`**: Actores y roles del sistema clasificados con clave canónica unificada para evitar duplicados gramaticales o de pluralización.
* **`Requirement`**: Requerimientos funcionales y no funcionales aprobados. Cuentan con un número secuencial de `revision` para control de cambios optimista.

## 2. Modelos del Dominio y Prototipos
* **`Entity` y `EntityAttribute`**: Definición de entidades de datos relacionales, tipos primitivos, llaves primarias (`isPk`), foráneas y opcionalidad.
* **`EntityRelationship`**: Cardinalidades (1:1, 1:N, N:M) entre entidades.
* **`UseCase`**: Procesos fundamentales del negocio vinculados a actores y requerimientos.
* **`NavigationNode`**: Pantallas de la aplicación y transiciones del flujo de usuario.
* **`Screen`**: Pantallas asociadas a mockups HTML/Tailwind interactivos y componentes visuales.
* **`Architecture` y `ArchitectureComponent`**: Especificación de la arquitectura del software (estilo en 3 capas, tecnologías frontend, backend y BD).

## 3. Versionamiento, Trazabilidad e Impacto
* **`Artifact` y `ArtifactVersion`**: Almacenan el código fuente Mermaid o especificaciones estructuradas de diagramas (ER, clases, casos de uso, arquitectura, navegación) con control estricto de versiones numéricas.
* **`ArtifactRelation`**: Mapeo directo y bidireccional entre artefactos (`toType`, `toId`, `fromType`, `fromId`, `relation`). Permite al motor de impacto recorrer el grafo para identificar efectos colaterales ante cambios.
* **`ChangeRequest`**: Solicitudes formales de cambio sobre requerimientos o modelos (`CREATE`, `UPDATE`, `DELETE`), con cálculo de impacto previo y aprobación obligatoria.
* **`ProjectBaseline`**: Copias congeladas (*snapshots*) completas del espacio de trabajo del proyecto en formato JSON, permitiendo auditoría histórica y comparación de diferencias (`diff`).

## 4. Persistencia del Motor de Codegen
Para evitar sobrecarga innecesaria en la base de datos relacional durante ciclos intensivos de compilación y validación, el motor de generación utiliza almacenamiento persistente estructurado en el sistema de archivos:
* **`.cache/codegen_jobs/<jobId>.json`**: Registro del ciclo de vida del trabajo asíncrono, métricas de consumo de tokens (prompt y completion), diagnósticos de validación y lista de archivos generados.
* **`.cache/codegen_jobs/active_<projectId>.json`**: Puntero transaccional que asegura que solo exista un trabajo de generación activo por proyecto.
* **`.verification/`**: Almacén seguro donde se compilan y sellan los archivos `.zip` de código generado, validados contra su firma SHA-256 antes de la descarga del cliente.

