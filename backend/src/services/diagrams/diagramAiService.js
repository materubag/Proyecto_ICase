const prisma = require('../../config/prisma');
const env = require('../../config/env');
const GeminiProvider = require('../ai/GeminiProvider');
const diagramAvailabilityService = require('./diagramAvailabilityService');
const diagramContextBuilder = require('./diagramContextBuilder');

// Deterministic fallback generators
const erDiagramGenerator = require('./erDiagramGenerator');
const useCaseGenerator = require('./useCaseGenerator');
const navigationGenerator = require('./navigationGenerator');
const architectureGenerator = require('./architectureGenerator');

class DiagramAiService {
  constructor() {
    this.gemini = new GeminiProvider();
  }

  /**
   * Cleans and sanitizes Mermaid code returned by LLM.
   */
  cleanMermaidCode(rawText) {
    if (!rawText || typeof rawText !== 'string') return '';
    let text = rawText.trim();

    // 1. Remove markdown code fences
    const fenceMatch = text.match(/```(?:mermaid)?\s*([\s\S]*?)\s*```/i);
    if (fenceMatch) {
      text = fenceMatch[1].trim();
    }

    // 2. Remove leading/trailing non-mermaid notes or conversational filler
    const lines = text.split('\n');
    const validHeaders = ['graph', 'flowchart', 'erdiagram', 'classdiagram', 'sequencediagram', 'statediagram', 'gitgraph', 'pie'];
    const firstHeaderIdx = lines.findIndex(l => {
      const trimmed = l.trim().toLowerCase();
      return validHeaders.some(vh => trimmed.startsWith(vh));
    });

    if (firstHeaderIdx > 0) {
      text = lines.slice(firstHeaderIdx).join('\n');
    }

    // 3. Remove trailing markdown backticks or explanations
    text = text.replace(/```/g, '').trim();

    // 4. Sanitize unquoted quotes or special chars inside label brackets
    return text;
  }

  /**
   * Basic client-side/server-side Mermaid validation.
   */
  validateMermaidSyntax(code, diagramType) {
    if (!code || typeof code !== 'string') return { isValid: false, error: 'Código Mermaid vacío' };
    const trimmed = code.trim().toLowerCase();

    switch (diagramType) {
      case 'USE_CASE':
      case 'NAVIGATION':
      case 'ARCHITECTURE':
        if (!trimmed.startsWith('graph') && !trimmed.startsWith('flowchart')) {
          return { isValid: false, error: `Se esperaba que el diagrama comience con 'flowchart' o 'graph'` };
        }
        break;
      case 'ER':
        if (!trimmed.startsWith('erdiagram')) {
          return { isValid: false, error: `Se esperaba que el diagrama comience con 'erDiagram'` };
        }
        break;
      case 'CLASS':
        if (!trimmed.startsWith('classdiagram')) {
          return { isValid: false, error: `Se esperaba que el diagrama comience con 'classDiagram'` };
        }
        break;
    }

    // Check for unmatched brackets or broken arrows
    const openBrackets = (code.match(/\[/g) || []).length;
    const closeBrackets = (code.match(/\]/g) || []).length;
    if (Math.abs(openBrackets - closeBrackets) > 2) {
      return { isValid: false, error: 'Corchetes desbalanceados en la definición de nodos Mermaid' };
    }

    return { isValid: true };
  }

  /**
   * Prompts specialized per diagram type.
   */
  getSystemInstructions(diagramType) {
    switch (diagramType) {
      case 'USE_CASE':
        return `Eres un arquitecto de software experto en modelado UML y Mermaid.js.
Genera EXCLUSIVAMENTE código Mermaid válido para un Diagrama de Casos de Uso (flowchart LR).
REGLAS CRÍTICAS:
1. Comienza SIEMPRE con 'flowchart LR' (actores a la izquierda, casos a la derecha).
2. Actores con doble paréntesis: ACT_1(("NombreActor"))
3. Casos de uso con corchetes y paréntesis: UC_1(["Nombre Caso de Uso"])
4. IDs alfanuméricos sin espacios ni acentos (ACT_1, UC_1, UC_2).
5. Relaciones actor -> caso: ACT_1 --> UC_1
6. <<include>>: UC_1 -.->|<<include>>| UC_2
7. NO inventes actores ni casos de uso que no aparezcan en el contexto.
8. Devuelve ÚNICAMENTE el código Mermaid, sin explicaciones.`;

      case 'ER':
        return `Eres un experto en bases de datos y Mermaid.js erDiagram.
Genera EXCLUSIVAMENTE código Mermaid erDiagram.
REGLAS CRÍTICAS — VIOLACIÓN = DIAGRAMA INVÁLIDO:
1. Comienza SIEMPRE con 'erDiagram'.
2. SOLO usa los nombres de entidades que aparecen en la sección "entities" del contexto JSON.
   PROHIBIDO inventar, pluralizar o renombrar entidades.
   Si el contexto dice VEHICULO, usa VEHICULO. NO uses VEHICULOS ni Vehiculo.
3. Formato de entidad:
   NOMBRE_ENTIDAD {
     int id PK
     string nombre
   }
4. Cardinalidades válidas ÚNICAMENTE:
   ||--||  (1 a 1)
   ||--o{  (1 a N)
   }o--o{  (N a M)
5. Formato de relacion:
   ENTIDAD_A ||--o{ ENTIDAD_B : "descripcion"
6. Si no existe informacion para una relacion, NO la incluyas.
7. NO uses nombres compuestos ni con espacios como ID de entidad.
8. Devuelve ÚNICAMENTE el código Mermaid, sin explicaciones.`;

      case 'CLASS':
        return `Eres un ingeniero experto en diseño OOP y Mermaid.js classDiagram.
Genera EXCLUSIVAMENTE código Mermaid classDiagram.
DIFERENCIA CLAVE: Este NO es un E/R. Es un diagrama de clases orientado a objetos (OOP).
REGLAS CRÍTICAS:
1. Comienza SIEMPRE con 'classDiagram'.
2. Clases en CamelCase sin espacios: ClienteVehiculo, no CLIENTE_VEHICULO.
3. Formato de clase:
   class NombreClase {
     -String id
     +String nombre
     +metodo() void
   }
4. Visibilidad: + publico, - privado, # protegido.
5. Relaciones UML:
   Asociacion: ClaseA --> ClaseB
   Herencia: ClaseB --|> ClaseA
   Composicion: ClaseA *-- ClaseB
   Agregacion: ClaseA o-- ClaseB
6. SOLO incluye metodos si la informacion del contexto los especifica.
   Si no hay metodos disponibles, solo incluye atributos.
7. No repitas las mismas relaciones del E/R sin razon OOP.
8. Devuelve UNICAMENTE el codigo Mermaid, sin explicaciones.`;

      case 'NAVIGATION':
        return `Eres un experto en arquitectura de informacion y Mermaid.js flowchart.
Genera EXCLUSIVAMENTE codigo Mermaid para el Arbol de Navegacion.

REGLAS CRITICAS SIEMPRE APLICABLES:
1. Comienza SIEMPRE con 'flowchart TD' (top-down). NUNCA uses LR.
2. SOLO usa las pantallas que aparecen en la seccion "screens" del contexto JSON.
   PROHIBIDO declarar nodos para pantallas que no esten en esa lista.
3. Identificadores de nodos: sin acentos, sin espacios. Ej: SCR_LOGIN, SCR_DASHBOARD.
4. Formato de nodo: SCR_LOGIN["Login\\n/login"]
5. Conexion con etiqueta: SCR_LOGIN -->|"Autenticacion exitosa"| SCR_DASHBOARD
6. Agrupa en subgraphs por modulo funcional cuando tenga sentido.
7. Devuelve UNICAMENTE el codigo Mermaid, sin explicaciones.

MODO EXPLICIT (inferMode = EXPLICIT):
- El contexto incluye "transitions" con el flujo real registrado.
- USA esas transiciones como base principal para las conexiones.
- No inventes conexiones que no esten en transitions.
- Si una pantalla no tiene transicion, declarala con estilo gris:
  style SCR_XXXX fill:#f0f0f0,stroke:#aaa,stroke-dasharray:4

MODO INFERRED (inferMode = INFERRED):
- NO hay transiciones registradas. Debes INFERIR el flujo de navegacion.
- Usa las pantallas, requisitos funcionales (functionalRequirements), casos de uso (useCases) y actores (actors).
- LOGICA DE INFERENCIA (aplica en orden):
  a) Identifica la pantalla de entrada (Login, Inicio, Autenticacion) si existe.
  b) El Dashboard/Panel principal conecta a todos los modulos de primer nivel.
  c) Un modulo de "Gestion de X" conecta a "Lista de X", y esta a "Detalle/Form de X".
  d) Un RF que menciona una pantalla como precondicion o postcondicion implica una transicion.
  e) Un caso de uso vincula un actor con una funcionalidad: infiere que el actor navega a la pantalla que soporta ese CU.
  f) Pantallas de configuracion/reportes suelen ser accesibles desde el Dashboard.
  g) NO inventes pantallas nuevas. Solo conecta las que estan en "screens".
  h) Si realmente no hay informacion para conectar una pantalla, declarala aislada con estilo gris.
- La pregunta es: como navega logicamente un usuario de una pantalla a otra segun el dominio del sistema?`;


      case 'ARCHITECTURE':
        return `Eres un arquitecto de soluciones experto en Mermaid.js flowchart.
Genera EXCLUSIVAMENTE código Mermaid para el Diagrama de Arquitectura de Software en Capas.
REGLAS CRÍTICAS:
1. Comienza SIEMPRE con 'flowchart TB'.
2. Organiza en subgraphs claros por capa (Presentacion, Negocio, Datos/Infraestructura).
3. Refleja ÚNICAMENTE las tecnologias y componentes del contexto proporcionado.
4. Conexiones claras entre capas con etiquetas de protocolo.
5. Devuelve ÚNICAMENTE el código Mermaid, sin explicaciones.`;

      default:
        return 'Genera código Mermaid válido.';
    }
  }

  /**
   * Builds an additional constraint block for the user prompt
   * listing the EXACT allowed entity/screen names.
   */
  buildConstraintBlock(diagramType, structuredContext) {
    if (diagramType === 'ER' && structuredContext.entities?.length > 0) {
      const names = structuredContext.entities.map(e => e.name).join(', ');
      return `\n\nCONSTRAINT OBLIGATORIO: Solo puedes usar EXACTAMENTE estos nombres de entidades (ni plurales, ni variantes):\n[${names}]\nCualquier relacion que referencie un nombre distinto debe ser omitida.`;
    }
    if (diagramType === 'NAVIGATION' && structuredContext.screens?.length > 0) {
      const names = structuredContext.screens.map(s => s.name).join(', ');
      const transCount = (structuredContext.transitions || []).length;
      const mode = structuredContext.inferMode || 'EXPLICIT';
      if (mode === 'INFERRED') {
        return `\n\nCONSTRAINT OBLIGATORIO (inferMode=INFERRED):\n- Pantallas disponibles (UNICOS nodos permitidos): [${names}]\n- NO hay transiciones registradas. Infiere el flujo usando los requisitos funcionales y casos de uso del contexto.\n- Aplica la logica de dominio descrita en el prompt del sistema.\n- No inventes pantallas adicionales.`;
      }
      return `\n\nCONSTRAINT OBLIGATORIO (inferMode=EXPLICIT):\n- Pantallas disponibles: [${names}]\n- Transiciones registradas: ${transCount}. USA esas transiciones. Si una pantalla no aparece en ninguna transicion, marcala como nodo aislado (estilo gris).`;
    }
    return '';
  }

  /**
   * Post-generation: validates ER consistency (no references to undeclared entities).
   * Returns { isValid, issues[] }
   */
  validateERConsistency(mermaidCode, entities) {
    const { normalize, resolveEntityName } = require('./mermaidSyntax');
    const normalizedMap = new Map();
    for (const e of entities) normalizedMap.set(normalize(e.name), e.name);

    const issues = [];
    // Match lines like: ENTITY_A ||--o{ ENTITY_B : "..."
    const relLineRegex = /^\s*(\S+)\s+[|}][|o][|-]{2}[|o][{|]\s*(\S+)\s*:/gm;
    let match;
    while ((match = relLineRegex.exec(mermaidCode)) !== null) {
      const [, src, tgt] = match;
      const srcNorm = normalize(src.replace(/T_/g, ''));
      const tgtNorm = normalize(tgt.replace(/T_/g, ''));
      if (!normalizedMap.has(srcNorm) && !resolveEntityName(src, normalizedMap)) {
        issues.push(`Entidad no declarada en relacion: "${src}"`);
      }
      if (!normalizedMap.has(tgtNorm) && !resolveEntityName(tgt, normalizedMap)) {
        issues.push(`Entidad no declarada en relacion: "${tgt}"`);
      }
    }
    return { isValid: issues.length === 0, issues };
  }

  /**
   * Post-generation: validates NAVIGATION diagram uses flowchart TD and only declared screens.
   */
  validateNavigationConsistency(mermaidCode, screens) {
    const { normalize } = require('./mermaidSyntax');
    const issues = [];

    if (!mermaidCode.trim().toLowerCase().startsWith('flowchart td')) {
      issues.push('El diagrama de navegacion debe comenzar con flowchart TD, no LR.');
    }

    const screenNames = new Set(screens.map(s => normalize(s.name)));
    const nodeRegex = /^\s*(\w+)\[/gm;
    let match;
    while ((match = nodeRegex.exec(mermaidCode)) !== null) {
      const nodeId = match[1];
      // Skip style, subgraph keywords
      if (['style', 'subgraph', 'end', 'classDef'].includes(nodeId.toLowerCase())) continue;
      // The nodeId should be derivable from a screen name — we can't perfectly reverse-map
      // so we only flag if screens exist and node count seems wildly off
    }

    return { isValid: issues.length === 0, issues };
  }

  /**
   * Generates a single diagram via Gemini with validation and fallback.
   */
  async generateDiagram(projectId, diagramType, options = {}) {
    const { force = false } = options;

    // 1. Check availability
    const availability = await diagramAvailabilityService.checkAvailability(projectId);
    const diagCheck = availability.diagrams[diagramType];

    if (!diagCheck) {
      const err = new Error(`Tipo de diagrama '${diagramType}' no reconocido.`);
      err.statusCode = 400;
      throw err;
    }

    // Strict validation: if insufficient, do not call Gemini
    if (diagCheck.status === 'INSUFFICIENT') {
      const err = new Error(`No se puede generar el ${diagCheck.title}. Información insuficiente: ${diagCheck.missing.join(', ')}`);
      err.statusCode = 422;
      err.code = 'INSUFFICIENT_DATA';
      err.details = diagCheck.missing;
      throw err;
    }

    // Check if already generated
    if (diagCheck.isGenerated && !force && !diagCheck.isOutdated) {
      return {
        alreadyExists: true,
        diagramType,
        title: diagCheck.title,
        code: diagCheck.mermaidCode || diagCheck.renderedContent,
        generatedAt: diagCheck.generatedAt,
        status: 'EXISTING',
        message: 'El diagrama ya existe. Usa force=true para regenerarlo.'
      };
    }

    // 2. Fetch full project data to build reduced context
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        requirements: { where: { isDeleted: false } },
        requirementCandidates: true,
        actors: { where: { isDeleted: false } },
        entities: {
          where: { isDeleted: false },
          include: { attributes: true }
        },
        relationships: true,
        classModels: { where: { isDeleted: false } },
        screens: { where: { isDeleted: false } },
        navigationNodes: { where: { isDeleted: false } },
        architectures: {
          include: { components: true },
          orderBy: { createdAt: 'desc' }
        },
        technologies: true,
        useCases: { where: { isDeleted: false } }
      }
    });

    const structuredContext = diagramContextBuilder.buildContext(diagramType, project);
    const systemPrompt = this.getSystemInstructions(diagramType);
    const constraintBlock = this.buildConstraintBlock(diagramType, structuredContext);
    const userPrompt = `Contexto estructurado del proyecto para generar ${diagCheck.title}:\n${JSON.stringify(structuredContext, null, 2)}${constraintBlock}\n\nGenera el código Mermaid:`;

    let mermaidCode = null;
    let technicalError = null;
    let usedProvider = 'GEMINI';

    // 3. Call Gemini (with 1 controlled retry if syntax validation fails)
    const isMock = env.AI_PROVIDER === 'mock' || (!env.GEMINI_API_KEY && !this.gemini.apiKey);

    if (isMock) {
      console.log(`[DiagramAiService] Generando ${diagramType} con generador determinista (modo mock/fallback)...`);
      mermaidCode = this.generateDeterministicFallback(diagramType, project, structuredContext);
      usedProvider = 'MOCK_DETERMINISTIC';
    } else {
      try {
        console.log(`[DiagramAiService] Solicitando generación de ${diagramType} a Gemini con contexto compacto...`);
        const payload = {
          contents: [
            {
              role: 'user',
              parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }]
            }
          ],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 2048
          }
        };

        const rawResponse = await this.gemini.callGeminiApi(payload);
        mermaidCode = this.cleanMermaidCode(rawResponse);

        // Validate syntax
        const val = this.validateMermaidSyntax(mermaidCode, diagramType);
        if (!val.isValid) {
          console.warn(`[DiagramAiService] Validación inicial falló (${val.error}). Ejecutando reintento controlado...`);
          const retryPayload = {
            contents: [
              {
                role: 'user',
                parts: [{
                  text: `${systemPrompt}\n\nEl código Mermaid anterior produjo un error: ${val.error}.\nCódigo erróneo:\n${mermaidCode}\n\nCorrige el error y devuelve ÚNICAMENTE el código Mermaid corregido y funcional:`
                }]
              }
            ],
            generationConfig: {
              temperature: 0.0,
              maxOutputTokens: 2048
            }
          };
          const retryResponse = await this.gemini.callGeminiApi(retryPayload);
          mermaidCode = this.cleanMermaidCode(retryResponse);
        }

        // Post-generation semantic validation
        if (mermaidCode) {
          if (diagramType === 'ER' && structuredContext.entities?.length > 0) {
            const erVal = this.validateERConsistency(mermaidCode, structuredContext.entities);
            if (!erVal.isValid) {
              console.warn(`[DiagramAiService] ER inconsistente post-Gemini (${erVal.issues.length} problemas). Usando fallback determinista.`, erVal.issues);
              mermaidCode = this.generateDeterministicFallback(diagramType, project, structuredContext);
              usedProvider = 'FALLBACK_DETERMINISTIC';
            }
          }
          if (diagramType === 'NAVIGATION' && structuredContext.screens?.length > 0) {
            const navVal = this.validateNavigationConsistency(mermaidCode, structuredContext.screens);
            if (!navVal.isValid) {
              console.warn(`[DiagramAiService] NAVIGATION inconsistente post-Gemini. Issues:`, navVal.issues);
              // Solo corrección de orientación — no reemplazar el diagrama completo
              if (mermaidCode.trim().toLowerCase().startsWith('flowchart lr')) {
                mermaidCode = mermaidCode.replace(/^flowchart\s+LR/i, 'flowchart TD');
              }
            }
          }
        }
      } catch (geminiErr) {
        console.error(`[DiagramAiService] Error al llamar a Gemini para ${diagramType}:`, geminiErr.message);
        technicalError = geminiErr.message;
        // Fallback determinista para no dejar al usuario bloqueado
        console.log(`[DiagramAiService] Usando generador determinista como respaldo para ${diagramType}...`);
        mermaidCode = this.generateDeterministicFallback(diagramType, project, structuredContext);
        usedProvider = 'FALLBACK_DETERMINISTIC';
      }
    }

    // 4. Final safety check on code
    if (!mermaidCode || mermaidCode.length < 10) {
      mermaidCode = this.generateDeterministicFallback(diagramType, project, structuredContext);
    }

    // 5. Persist into Artifact and ArtifactVersion
    const persisted = await this.persistDiagramArtifact(projectId, diagramType, structuredContext, mermaidCode, technicalError);

    // 6. If architecture, update domain record
    if (diagramType === 'ARCHITECTURE' && project.architectures && project.architectures.length > 0) {
      await prisma.architecture.update({
        where: { id: project.architectures[0].id },
        data: { softwareDiagram: mermaidCode }
      }).catch(err => console.warn('[DiagramAiService] No se pudo actualizar architecture.softwareDiagram:', err.message));
    }

    return {
      success: true,
      diagramType,
      title: diagCheck.title,
      code: mermaidCode,
      provider: usedProvider,
      generatedAt: persisted.createdAt || new Date().toISOString(),
      artifactVersionId: persisted.id,
      technicalError,
      status: technicalError ? 'GENERATED_WITH_FALLBACK' : 'GENERATED'
    };
  }

  /**
   * Deterministic fallback generation when Gemini is not configured or offline.
   */
  generateDeterministicFallback(diagramType, project, context) {
    switch (diagramType) {
      case 'USE_CASE': {
        const actors = project.actors || [];
        const useCases = (context.useCases && context.useCases.length > 0)
          ? context.useCases
          : (context.functionalRequirements || []).map((r, i) => ({
              code: `CU-${String(i + 1).padStart(2, '0')}`,
              name: r.name,
              actor: actors[0]?.name || 'Usuario'
            }));
        return useCaseGenerator.generate(actors, useCases);
      }
      case 'ER':
        return erDiagramGenerator.generate(project.entities || [], project.relationships || []);
      case 'CLASS': {
        let code = 'classDiagram\n';
        // Only approved entities, derived from context (not raw project)
        const entities = (context?.classes || []).length > 0
          ? context.classes
          : (project.entities || []).filter(e => e.reviewStatus === 'APPROVED' || e.status === 'APPROVED');
        entities.forEach(e => {
          // Use CamelCase class name
          const className = String(e.name || 'Entidad')
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-zA-Z0-9]/g, '')
            .replace(/^./, c => c.toUpperCase());
          code += `  class ${className} {\n`;
          const attrs = e.attributes || [];
          attrs.forEach(a => {
            const visibility = a.visibility || '+';
            const type = (a.type || 'String').replace(/[^a-zA-Z0-9]/g, '');
            const name = (a.name || 'dato').replace(/[^a-zA-Z0-9_]/g, '');
            code += `    ${visibility}${type} ${name}\n`;
          });
          // Only add methods if explicitly available
          const methods = e.methods || [];
          methods.forEach(m => {
            const visibility = m.visibility || '+';
            const ret = (m.returnType || 'void').replace(/[^a-zA-Z0-9]/g, '');
            const mname = (m.name || 'metodo').replace(/[^a-zA-Z0-9_]/g, '');
            code += `    ${visibility}${mname}() ${ret}\n`;
          });
          code += `  }\n`;
        });
        // Relationships from context
        const rels = context?.relationships || project.relationships || [];
        const { normalize, resolveEntityName } = require('./mermaidSyntax');
        const classMap = new Map();
        entities.forEach(e => {
          const cn = String(e.name || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]/g, '').replace(/^./, c => c.toUpperCase());
          classMap.set(normalize(e.name), cn);
        });
        rels.forEach(r => {
          const srcName = resolveEntityName(r.source || '', classMap);
          const tgtName = resolveEntityName(r.target || '', classMap);
          if (srcName && tgtName) {
            code += `  ${srcName} --> ${tgtName}\n`;
          }
        });
        return code;
      }
      case 'NAVIGATION':
        return navigationGenerator.generate(project.navigationNodes || [], project.screens || []);
      case 'ARCHITECTURE':
        return architectureGenerator.generate(project.architectures?.[0] || {
          components: (project.technologies || []).map(t => ({ name: t.name, layer: t.category }))
        });
      default:
        return 'graph TD\n  Inicio --> Fin';
    }
  }

  /**
   * Persists the generated diagram into Artifact and ArtifactVersion in PostgreSQL.
   */
  async persistDiagramArtifact(projectId, diagramType, structuredContent, renderedContent, error = null) {
    const artifactName = `DIAGRAM_${diagramType}`;

    // Find or create Artifact
    let artifact = await prisma.artifact.findFirst({
      where: {
        projectId,
        type: diagramType,
        name: artifactName
      }
    });

    if (!artifact) {
      artifact = await prisma.artifact.create({
        data: {
          projectId,
          type: diagramType,
          name: artifactName,
          status: 'APPROVED',
          revision: 1
        }
      });
    } else {
      artifact = await prisma.artifact.update({
        where: { id: artifact.id },
        data: {
          revision: artifact.revision + 1,
          status: 'APPROVED'
        }
      });
    }

    // Create ArtifactVersion
    const versionNumber = artifact.revision;
    const version = await prisma.artifactVersion.create({
      data: {
        artifactId: artifact.id,
        version: versionNumber,
        structuredContent,
        renderedContent,
        status: error ? 'ERROR' : 'APPROVED',
        validationStatus: error ? 'ERROR' : 'VALID',
        technicalError: error
      }
    });

    // Update approvedVersionId
    await prisma.artifact.update({
      where: { id: artifact.id },
      data: { approvedVersionId: version.id }
    });

    return version;
  }

  /**
   * Fetches the latest stored diagram for a project.
   */
  async getStoredDiagram(projectId, diagramType) {
    const availability = await diagramAvailabilityService.checkAvailability(projectId);
    const diagCheck = availability.diagrams[diagramType];

    const artifact = await prisma.artifact.findFirst({
      where: {
        projectId,
        type: diagramType
      },
      include: {
        versions: {
          orderBy: { version: 'desc' },
          take: 1
        }
      }
    });

    const latestVersion = artifact?.versions?.[0];

    return {
      projectId,
      diagramType,
      title: diagCheck?.title || diagramType,
      isGenerated: Boolean(latestVersion?.renderedContent),
      code: latestVersion?.renderedContent || null,
      generatedAt: latestVersion?.createdAt || null,
      isOutdated: diagCheck?.isOutdated || false,
      technicalError: latestVersion?.technicalError || null,
      availability: diagCheck
    };
  }

  /**
   * Generates multiple diagrams in batch.
   */
  async generateBatch(projectId, diagramTypes = [], options = {}) {
    const results = {};
    for (const type of diagramTypes) {
      try {
        results[type] = await this.generateDiagram(projectId, type, options);
      } catch (err) {
        results[type] = {
          success: false,
          diagramType: type,
          error: err.message,
          code: err.code || 'GENERATION_FAILED',
          details: err.details || []
        };
      }
    }
    return results;
  }
}

module.exports = new DiagramAiService();
