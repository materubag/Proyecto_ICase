const prisma = require('../../config/prisma');
const env = require('../../config/env');
const GeminiProvider = require('../ai/GeminiProvider');
const diagramAvailabilityService = require('./diagramAvailabilityService');
const diagramContextBuilder = require('./diagramContextBuilder');
const mermaidNormalizer = require('./mermaidNormalizer');
const mermaidValidator = require('./mermaidValidator');
const mermaidRepairer = require('./mermaidRepairer');
const diagramSemanticValidator = require('./diagramSemanticValidator');

// Deterministic generators
const erDiagramGenerator = require('./erDiagramGenerator');
const useCaseGenerator = require('./useCaseGenerator');
const flowchartGenerator = require('./flowchartGenerator');
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
    const validHeaders = ['graph', 'flowchart', 'erdiagram', 'classdiagram', 'sequencediagram', 'statediagram', 'gitgraph', 'pie', 'mindmap'];
    const firstHeaderIdx = lines.findIndex(l => {
      const trimmed = l.trim().toLowerCase();
      return validHeaders.some(vh => trimmed.startsWith(vh));
    });

    if (firstHeaderIdx > 0) {
      text = lines.slice(firstHeaderIdx).join('\n');
    }

    // 3. Remove trailing markdown backticks or explanations
    text = text.replace(/```/g, '').trim();

    return text;
  }

  /**
   * Prompts specialized per diagram type following theoretical software engineering rules.
   */
  getSystemInstructions(diagramType) {
    switch (diagramType) {
      case 'ER':
        return `Eres un arquitecto de software y diseñador de bases de datos relacionales experto en Mermaid.js erDiagram.
Tu objetivo es generar el modelo de datos persistente del sistema analizado.
Genera EXCLUSIVAMENTE código Mermaid erDiagram válido.

REGLAS CRÍTICAS DE CALIDAD Y SEMÁNTICA (CUMPLIMIENTO ESTRICTO):
1. Estructura inicial obligatoria:
   erDiagram
       direction TB

2. QUÉ ES UNA ENTIDAD:
   - Modela solo entidades con identidad propia y persistencia real (Cliente, Vehiculo, Cita, OrdenTrabajo, Producto, Servicio, Proveedor, Usuario, etc.).
   - PROHIBIDO convertir frases o conceptos abstractos en entidades (NO inventes entidades por meras frases del documento).

3. PROHIBICIÓN ESTRICTA DE ENTIDADES VACÍAS:
   - NUNCA generes una entidad sin atributos como:
     PROVEEDOR {
     }
   - Si una entidad existe en el contexto, DEBE tener sus atributos y su clave primaria definidos.

Declara un bloque de atributos para CADA entidad usada en relaciones. Comprueba que nombres de extremos coincidan exactamente. Respeta direccion y cardinalidades de las claves foraneas: si USUARIO tiene id_rol, la relacion es ROL ||--o{ USUARIO. No inventes atributos sin respaldo del contexto.
4. CLAVES PRIMARIAS (PK) TÉCNICAS:
   - Toda entidad persistente DEBE tener una PK razonable: 'int id PK' o 'string codigo PK'.
   - PROHIBIDO usar frases o textos descriptivos como PK (PROHIBIDO: 'string claridad_la_falla PK', 'string descripcion PK').

5. NORMALIZACIÓN DE ATRIBUTOS:
   - Solo caracteres ASCII alfanuméricos y guiones bajos (ej: precio_mano_obra, fecha_ingreso, telefono).
   - Tipos válidos: int, string, float, boolean, date, datetime.
   - NUNCA pongas espacios ni acentos en nombres de atributos.

6. RELACIONES Y CARDINALIDADES:
   - Infiere las relaciones reales fundamentadas en requisitos, procesos y reglas de negocio.
   - Cardinalidades válidas:
     ||--||  (Exactamente 1 a 1)
     ||--o{  (1 a muchos)
     o{--o{  (Muchos a muchos)
   - Resuelve relaciones muchos a muchos (N:M) mediante entidades asociativas (ej: DETALLE_ORDEN) cuando haya que registrar cantidades, precios u horas.
   - Formato: ENTIDAD_A ||--o{ ENTIDAD_B : "posee"

EJEMPLO INCORRECTO (PROHIBIDO):
erDiagram
    direction TB
    PROVEEDOR {
    }
    CLIENTE {
        string claridad_la_falla PK
    }
    VENTA ||--o{ PRODUCTO : "incluye"

EJEMPLO CORRECTO (REQUERIDO):
erDiagram
    direction TB
    CLIENTE {
        int id PK
        string nombre
        string telefono
        string email
    }
    VEHICULO {
        int id PK
        string placa
        string marca
        string modelo
        int cliente_id FK
    }
    CITA {
        int id PK
        datetime fecha_hora
        string estado
        int cliente_id FK
        int vehiculo_id FK
    }
    ORDEN_TRABAJO {
        int id PK
        string numero_orden
        datetime fecha_ingreso
        string estado
        float total
        int vehiculo_id FK
    }
    CLIENTE ||--o{ VEHICULO : "posee"
    CLIENTE ||--o{ CITA : "solicita"
    VEHICULO ||--o{ CITA : "corresponde"
    VEHICULO ||--o{ ORDEN_TRABAJO : "tiene"

7. Devuelve ÚNICAMENTE el código Mermaid, sin bloques explicativos ni notas fuera del diagrama.`;

      case 'CLASS':
        return `Eres un arquitecto de software experto en Diseño Orientado a Objetos (POO, UML) y Mermaid.js classDiagram.
Genera EXCLUSIVAMENTE código Mermaid classDiagram válido que represente el MODELO DE DOMINIO del software.

REGLAS CRÍTICAS DE CALIDAD Y SEMÁNTICA (CUMPLIMIENTO ESTRICTO):
1. Estructura inicial obligatoria:
   classDiagram

2. FOCO EN EL DOMINIO DEL NEGOCIO:
   - Modela clases del dominio (ej: Cliente, Vehiculo, Cita, OrdenTrabajo, Producto, Servicio, Proveedor, Usuario).
   - PROHIBICIÓN ESTRICTA DE INFRAESTRUCTURA TÉCNICA: NO incluyas clases ajenas al negocio como 'AuthenticationService', 'JwtService', 'TokenService', 'N8nService' o capas de red. El diagrama debe representar el dominio del cliente.

3. PROHIBICIÓN DE CLASES VACÍAS:
   - NUNCA generes una clase sin miembros:
     class Cita {
     }
   - Incluye atributos respaldados; metodos solo con responsabilidad sustentada. No obligues metodos en objetos de datos.

4. ATRIBUTOS VÁLIDOS PARA CÓDIGO:
   - Convención camelCase estricta sin espacios ni tildes:
     +int id
     +String nombre
     +String telefono
     +Decimal precioUnitario
   - PROHIBIDO: '+String claridad la falla', '+String código', '+Decimal precio de mano de obra'.

5. MÉTODOS DEL DOMINIO REAL:
   - Deriva métodos que reflejen operaciones reales sustentadas por los procesos y casos de uso del proyecto:
     +registrar()
     +actualizarDatos()
     +agendar()
     +cancelar()
     +calcularTotal()
     +cerrarOrden()
   - PROHIBICIÓN ESTRICTA DE MÉTODOS GENÉRICOS DE RELLENO (PROHIBIDO: getId, setId, toDTO, validate, save, validarReglas). No inventes métodos abstractos.

6. RED COHERENTE DE RELACIONES:
   - Herencia solo con especializacion documentada; acceso y roles no justifican herencia.
   - Multiplicidades inferidas son propuestas, no reglas confirmadas. Permite cotizaciones pendientes sin orden.
   - ConsumoRepuesto conecta orden y Producto con cantidad; no conecta orden al inventario global.
   - Consultas devuelven tipos concretos; void solo para operaciones sin retorno. Parametros tipados.
   - No inventes relaciones para conectar clases. Una clase aislada requiere revision.
   - Relaciones UML permitidas:
     Asociación: ClaseA "1" --> "0..*" ClaseB : "asociacion"
     Composición: ClaseA *-- ClaseB : "compone"
     Agregación: ClaseA o-- ClaseB : "agrega"
     Herencia: ClaseHija --|> ClasePadre

EJEMPLO INCORRECTO (PROHIBIDO):
classDiagram
    class AuthenticationService {
        -String jwtSecret
        +login()
    }
    class Cita {
    }
    class Cliente {
        +String claridad la falla
        +getId()
        +toDTO()
    }

EJEMPLO CORRECTO (REQUERIDO):
classDiagram
    class Cliente {
        +int id
        +String nombre
        +String telefono
        +String email
        +registrar()
        +actualizarDatos()
    }
    class Vehiculo {
        +int id
        +String placa
        +String marca
        +String modelo
        +registrar()
        +actualizarKilometraje()
    }
    class Cita {
        +int id
        +Date fecha
        +String estado
        +agendar()
        +cancelar()
    }
    class OrdenTrabajo {
        +int id
        +Date fecha
        +String estado
        +crear()
        +calcularTotal()
        +cerrarOrden()
    }
    Cliente "1" --> "0..*" Vehiculo : "posee"
    Cliente "1" --> "0..*" Cita : "solicita"
    Vehiculo "1" --> "0..*" Cita : "corresponde"
    Vehiculo "1" --> "0..*" OrdenTrabajo : "genera"

7. Devuelve ÚNICAMENTE el código Mermaid, sin comentarios ni explicaciones adicionales.`;

      case 'USE_CASE':
        return `Eres un analista de sistemas experto en casos de uso UML y Mermaid.js flowchart.
Genera EXCLUSIVAMENTE código Mermaid para el Diagrama de Casos de Uso.
REGLAS CRÍTICAS:
1. Comienza SIEMPRE con:
   flowchart LR
2. Los ACTORES son externos al sistema y se representan con doble paréntesis:
   ACT_CLI(("👤 Cliente"))
   ACT_ADM(("👤 Administrador"))
   ACT_MEC(("👤 Mecánico"))
   PROHIBIDO convertir la base de datos, el backend o PostgreSQL en actores.
3. Los CASOS DE USO representan funcionalidades desde la perspectiva del usuario y van entre corchetes y paréntesis:
   UC_REG(["Registrar vehículo"])
   UC_COT(["Generar cotización"])
4. Relación actor a caso de uso:
   ACT_CLI --> UC_COT
5. Dependencias entre casos de uso:
   <<include>> (obligatorio): UC_PAGO -.->|<<include>>| UC_AUTENTICACION
   <<extend>> (opcional/condicional): UC_ALERTA -.->|<<extend>>| UC_INSPECCION
6. Agrupa los casos de uso dentro de un subgraph que delimite el sistema:
   subgraph SISTEMA ["Sistema de Gestión"]
     UC_1(["..."])
   end
7. Devuelve ÚNICAMENTE el código Mermaid.`;

      case 'FLOWCHART':
        return `Eres un ingeniero de procesos y modelado BPMN experto en Mermaid.js flowchart.
Genera EXCLUSIVAMENTE código Mermaid para el Diagrama de Flujo de Procesos de Negocio.
REGLAS CRÍTICAS:
1. Comienza SIEMPRE con:
   flowchart TD
2. Este diagrama representa la SECUENCIA OPERATIVA de un proceso real del dominio:
   - Nodo de inicio: START(["Inicio: Nombre del Proceso"])
   - Pasos/Actividades: STEP1["Paso o Acción concreta"]
   - Nodos de decisión: DEC1{"¿Condición o Validación?"}
   - Ramas de decisión:
     DEC1 -->|Sí / Válido| STEP_OK["Continuar operación"]
     DEC1 -->|No / Inválido| STEP_ERR["Acción correctiva"]
   - Nodo de fin: FIN(["Fin del Proceso"])
3. PROHIBICIÓN ABSOLUTA: NUNCA uses la palabra 'end' como identificador de un nodo en Mermaid (ej: usa 'FIN' o 'NODE_FIN', JAMÁS 'end').
4. Los identificadores deben ser alfanuméricos simples (START, STEP1, DEC1, STEP2, FIN).
5. Las etiquetas dentro de ["..."] y {"..."} deben tener las comillas bien cerradas.
6. Refleja fielmente los requisitos y reglas de negocio del contexto.
7. Devuelve ÚNICAMENTE el código Mermaid.`;

      case 'NAVIGATION':
        return `Eres un arquitecto de información y UX experto en Mermaid.js flowchart.
Genera EXCLUSIVAMENTE código Mermaid para el ÁRBO DE NAVEGACIÓN de la aplicación.
CONCEPTO FUNDAMENTAL:
Este diagrama NO es un flujo de procesos. Representa la ESTRUCTURA JERÁRQUICA (PADRE → HIJO) del sistema.
REGLAS CRÍTICAS:
1. Comienza SIEMPRE con:
   flowchart TD
2. Estructura jerárquica estricta:
   APP_ROOT["🌐 Sistema"]
   APP_ROOT --> MOD_AUTH["Portal de Acceso"]
   APP_ROOT --> MOD_MAIN["Panel Principal / Dashboard"]
   MOD_AUTH --> SCR_LOGIN["Inicio de Sesión\\n/login"]
   MOD_MAIN --> MOD_SECCION["Módulo Funcional"]
   MOD_SECCION --> SCR_LISTA["Lista / Vista Principal"]
   SCR_LISTA --> SCR_DETALLE["Detalle / Formulario"]
3. SOLO usa las pantallas reales que están en el contexto JSON "screens".
4. NUNCA incluyas actores, tablas ni requisitos como nodos.
5. Identificadores seguros (SCR_LOGIN, SCR_DASHBOARD, etc.).
6. Devuelve ÚNICAMENTE el código Mermaid.`;

      case 'ARCHITECTURE':
        return `Eres un arquitecto de software de sistemas empresariales experto en Mermaid.js flowchart.
Genera EXCLUSIVAMENTE código Mermaid para la Arquitectura de Software Lógica del PROYECTO ANALIZADO.
REGLAS CRÍTICAS DE AISLAMIENTO Y DOMINIO:
1. Representa EXCLUSIVAMENTE la arquitectura del software documentado en el proyecto.
2. PROHIBICIÓN ABSOLUTA: NUNCA incluyas herramientas, puertos ni componentes de la infraestructura de 'i-CASE Studio' (PROHIBIDO: Ollama, Gemini, n8n, Faster-Whisper, Prisma ORM, puertos 3001, 8080, 5433).
3. Comienza SIEMPRE con:
   flowchart TB
4. Organiza en capas lógicas claras mediante subgraphs:
   subgraph PRESENTATION ["1. CAPA DE PRESENTACIÓN (CLIENTE / FRONTEND)"]
     UI_APP["Aplicación Web / Interfaz de Usuario"]
   end
   subgraph DOMAIN ["2. CAPA DE NEGOCIO Y DOMINIO (SERVICIOS)"]
     SVC_API["Servicios y Lógica del Negocio"]
   end
   subgraph DATA ["3. CAPA DE DATOS Y PERSISTENCIA"]
     DB_SQL[("Base de Datos del Sistema")]
   end
5. Conexiones entre capas con protocolos de comunicación del dominio:
   PRESENTATION -->|Peticiones / REST API| DOMAIN
   DOMAIN -->|Conexión SQL / Driver| DATA
6. Asegura que cada 'subgraph' tenga su respectivo 'end'.
7. Devuelve ÚNICAMENTE el código Mermaid.`;

      default:
        return 'Genera código Mermaid.js válido.';
    }
  }

  /**
   * Builds context constraint block for user prompt.
   */
  buildConstraintBlock(diagramType, structuredContext) {
    if (diagramType === 'ER' && structuredContext.entities?.length > 0) {
      const names = structuredContext.entities.map(e => e.name).join(', ');
      return `\n\nCONSTRAINT OBLIGATORIO: Solo puedes usar EXACTAMENTE estos nombres de entidades:\n[${names}]\nNormaliza todos los atributos sin tildes ni caracteres especiales.`;
    }
    if (diagramType === 'NAVIGATION' && structuredContext.screens?.length > 0) {
      const names = structuredContext.screens.map(s => s.name).join(', ');
      return `\n\nCONSTRAINT OBLIGATORIO: Solo incluye las pantallas autorizadas: [${names}]. Estructura estrictamente como árbol jerárquico Padre -> Hijo.`;
    }
    return '';
  }

  /**
   * Deterministic fallback generation when Gemini is not configured, offline or produces invalid syntax.
   */
  generateDeterministicFallback(diagramType, project, context) {
    switch (diagramType) {
      case 'USE_CASE': {
        const actors = project.actors || [];
        const useCases = (project.useCases && project.useCases.length > 0)
          ? project.useCases
          : (context.functionalRequirements || []).map((r, i) => ({
              code: `CU-${String(i + 1).padStart(2, '0')}`,
              name: r.name,
              id: r.id, actorIds: r.actorIds || []
            }));
        return useCaseGenerator.generate(actors, useCases);
      }
      case 'ER':
        return erDiagramGenerator.generate(project.entities || [], project.relationships || []);
      case 'CLASS': {
        let code = 'classDiagram\n';
        const entities = (context?.classes || []).length > 0
          ? context.classes
          : (project.entities || []).filter(e => e.reviewStatus === 'APPROVED' || e.status === 'APPROVED');
        entities.forEach(e => {
          const className = mermaidNormalizer.toSafeIdentifier(e.name, 'Class');
          const pascalName = className.charAt(0).toUpperCase() + className.slice(1);
          code += `  class ${pascalName} {\n`;
          const attrs = e.attributes || [];
          attrs.forEach(a => {
            const vis = a.visibility || '+';
            const type = mermaidNormalizer.normalizeDataType(a.type);
            const name = mermaidNormalizer.toSafeIdentifier(a.name, 'attr');
            code += `    ${vis}${type} ${name}\n`;
          });
          const methods = e.methods || [];
          methods.forEach(m => {
            const vis = m.visibility || '+';
            const ret = mermaidNormalizer.toSafeIdentifier(m.returnType || 'void', 'type');
            const mname = mermaidNormalizer.toSafeIdentifier(m.name, 'method');
            code += `    ${vis}${mname}() ${ret}\n`;
          });
          code += `  }\n`;
        });
        const rels = context?.relationships || project.relationships || [];
        rels.forEach(r => {
          const srcName = mermaidNormalizer.toSafeIdentifier(r.source, 'Class');
          const tgtName = mermaidNormalizer.toSafeIdentifier(r.target, 'Class');
          if (srcName && tgtName) {
            code += `  ${srcName.charAt(0).toUpperCase() + srcName.slice(1)} --> ${tgtName.charAt(0).toUpperCase() + tgtName.slice(1)}\n`;
          }
        });
        return code;
      }
      case 'FLOWCHART':
        return flowchartGenerator.generate(context.steps || project.requirements || [], project.useCases || [], project.name);
      case 'NAVIGATION':
        return require('./navigationTree').generate((project.navigationNodes||[]).length?project.navigationNodes:project.screens||[], project.name);
      case 'ARCHITECTURE':
        return architectureGenerator.generate(project.architectures?.[0] || {
          components: (project.technologies || []).map(t => ({ name: t.name, layer: t.category }))
        });
      default:
        return 'flowchart TD\n  START([Inicio]) --> FIN([Fin])';
    }
  }

  /**
   * Generates a single diagram with Gemini, deterministic normalization, validation and repair.
   */
  async generateDiagram(projectId, diagramType, options = {}) {
    if(diagramType==='USE_CASE')await prisma.$transaction(tx=>require('../analysis/actorIdentity').refresh(tx,projectId));
    const force = typeof options.force === 'object' ? Boolean(options.force?.force) : Boolean(options.force);

    // 1. Check availability
    const availability = await diagramAvailabilityService.checkAvailability(projectId);
    const diagCheck = availability.diagrams[diagramType];

    if (!diagCheck) {
      const err = new Error(`Tipo de diagrama '${diagramType}' no reconocido.`);
      err.statusCode = 400;
      throw err;
    }

    if (diagCheck.status === 'INSUFFICIENT') {
      const err = new Error(`Información insuficiente para generar el ${diagCheck.title}: ${diagCheck.missing.join(', ')}`);
      err.statusCode = 422;
      err.code = 'INSUFFICIENT_DATA';
      err.details = diagCheck.missing;
      throw err;
    }

    // Check if already generated and valid
    if (diagramType !== 'USE_CASE' && diagCheck.isGenerated && !force && !diagCheck.isOutdated) {
      const existingCode = diagCheck.mermaidCode || diagCheck.renderedContent;
      const existingValidation = mermaidValidator.validate(existingCode, diagramType);
      if (existingValidation.isValid) {
        const normalizedExisting = mermaidNormalizer.normalize(existingCode, diagramType);
        return {
          alreadyExists: true,
          diagramType,
          title: diagCheck.title,
          code: normalizedExisting,
          mermaidCode: normalizedExisting,
          diagram: { mermaidCode: normalizedExisting },
          artifact: { mermaidCode: normalizedExisting },
          generatedAt: diagCheck.generatedAt,
          status: 'EXISTING',
          message: 'El diagrama ya existe y es válido. Usa force=true para regenerarlo.'
        };
      }
      console.warn(`[DiagramAiService] El diagrama existente para ${diagramType} es inválido (${existingValidation.error}). Forzando regeneración...`);
    }

    // 2. Fetch full project data with complete context
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
        useCases: { where: { isDeleted: false } },
        modelCandidates: true,
        businessRules: true
      }
    });

    if(diagramType==='ARCHITECTURE') project.sources=await prisma.source.findMany({where:{projectId},include:{currentVersion:true}});
    const structuredContext = diagramContextBuilder.buildContext(diagramType, project);
    const systemPrompt = this.getSystemInstructions(diagramType);
    const constraintBlock = this.buildConstraintBlock(diagramType, structuredContext);
    const userPrompt = `Contexto estructurado para generar ${diagCheck.title}:\n${JSON.stringify(structuredContext, null, 2)}${constraintBlock}\n\nGenera el código Mermaid:`;

    let mermaidCode = null;
    let technicalError = null;
    let usedProvider = 'GEMINI';
    let repairMethod = 'DIRECT';

    const isMock = env.AI_PROVIDER === 'mock' || (!env.GEMINI_API_KEY && !this.gemini.apiKey);

    if(diagramType==='ARCHITECTURE') {
      const proposal=require('./architectureProposal').generate(project);
      mermaidCode=proposal.code;structuredContext.architectureProposal=proposal;structuredContext.flowWarning=proposal.warning;
      usedProvider='LOCAL_PROPOSAL';repairMethod='REQUIREMENTS_BASED_PROPOSAL';
    }else if(['ER','CLASS','NAVIGATION','FLOWCHART'].includes(diagramType)&&['openai','gemini'].includes(env.AI_PROVIDER)){
      const extraction=require('../analysis/documentExtraction');
      const config=extraction.configuration();
      const modelInstructions=diagramType==='ER'?'Compatible con Mermaid 10: no incluyas direction dentro de erDiagram. Cuando no haya entidades aprobadas, deriva un modelo PROPUESTO exclusivamente de las capacidades de persistencia documentadas en los requisitos. Las claves tecnicas son decisiones de modelado propuestas.':'Genera classDiagram compatible con Mermaid 10. Si no hay clases ni entidades aprobadas, deriva un modelo de dominio PROPUESTO desde los requisitos funcionales y casos de uso. Incluye atributos y operaciones del negocio justificados. No copies automaticamente el modelo relacional ni conviertas actores en clases sin identidad persistente documentada. No inventes servicios tecnicos, metodos genericos ni herencia sin respaldo. Usa firmas de metodos sencillas sin tipos complejos.';
      let instructions=diagramType==='NAVIGATION'?'Genera flowchart TD compatible con Mermaid 10. Representa un ARBOL con una sola raiz del proyecto, modulos y pantallas justificadas por los requisitos. Cada nodo salvo la raiz tiene exactamente un padre, sin ciclos ni nodos desconectados. No dibujes pasos de procesos ni flujos operativos. Conserva parentId y rutas documentadas cuando existan. Si faltan pantallas, los modulos y rutas son una propuesta de diseño, no permisos confirmados. No asignes accesos a roles ni inventes capacidades. Usa etiquetas sencillas sin sintaxis HTML.':modelInstructions;
      if(diagramType==='CLASS') instructions += '\nRevisa TODOS los requisitos funcionales del contexto. Modela conceptos persistentes, objetos de valor y detalles de operaciones respaldados; no resumas procesos distintos en clases genericas. Atributos con visibilidad y tipos; operaciones con parametros tipados y retornos concretos. No obligues metodos en objetos de datos. Incluye detalles, autorizaciones parciales, asignaciones, movimientos y registros cuando esten documentados. No conviertas RNF en clases por defecto. Marca multiplicidades inferidas y restricciones con notas. Justifica cobertura y omisiones, sin cantidad de clases objetivo.';
      let format=diagramType==='NAVIGATION'?'Devuelve exclusivamente JSON {"nodes":[{"id":"identificador unico","name":"nombre","parentId":null,"route":null}]}. parentId referencia otro nodo o es null para modulos principales. No devuelvas Mermaid.':'Devuelve JSON {"mermaidCode":"codigo Mermaid completo"}.';
      if(diagramType==='FLOWCHART'){
        instructions='Representa procesos de negocio PROPUESTOS desde los requisitos. No encadenes procesos independientes arbitrariamente ni representes menus de navegacion. Cada proceso tiene inicio y fin; procesos separados tienen inicios separados. Solo decisiones con condiciones respaldadas por requisitos. No inventes validaciones, notificaciones ni permisos. Cada paso y decision cita los IDs de requisitos que lo justifican. Se permiten bucles documentados con salida.';
        instructions += ' No generes una orden o ejecucion cuando la autorizacion es pendiente o rechazada. Representa aprobacion parcial usando solo items autorizados si esta documentada. No conviertas funciones de menu en flujo ni des por obligatorio consumo de recursos opcionales. Declara una cobertura coherente del proceso seleccionado y no omitas decisiones de autorizacion descritas en requisitos.';
        format='Devuelve exclusivamente JSON {"nodes":[{"id":"id unico","label":"accion o condicion","type":"start|end|process|decision","requirementIds":["UUID exacto"]}],"edges":[{"source":"id","target":"id","label":"condicion de rama o vacio"}]}. Cada decision tiene al menos dos ramas etiquetadas. Todos los pasos tienen camino desde un inicio a un fin. No devuelvas Mermaid.';
      }
      let response;
      try {
        response=await extraction.createProvider(config.provider).extractDocumentBatch(structuredContext,{model:config.model,prompt:instructions+'\n'+format+' No modifiques requisitos ni actores ni inventes permisos.'});
      } catch(error) {
        if(/HTTP (503|429)/.test(error.message)) throw Object.assign(new Error('El proveedor de IA no esta disponible temporalmente o alcanzo su limite. El diagrama guardado se conserva. No se realizaron reintentos automaticos.'),{statusCode:503,code:'AI_TEMPORARILY_UNAVAILABLE'});
        throw error;
      }
      if(diagramType==='FLOWCHART'){
        try{response.data.mermaidCode=require('./processFlow').generate(response.data,structuredContext.steps);}catch(error){
          const repaired=await extraction.createProvider(config.provider).extractDocumentBatch({...structuredContext,previousProposal:response.data,validationError:error.message},{model:config.model,prompt:instructions+'\n'+format+' Corrige la propuesta anterior generando una version simplificada de los procesos documentados. En esta reparacion solo usa type start, process y end; NO uses decision ni interrogaciones. Omite bifurcaciones incompletas; no inventes ramas para completarlas. Mantiene acciones documentadas, referencias de requisitos y caminos de inicio a fin. Separa procesos independientes.'});
          try{response.data=repaired.data;response.data.mermaidCode=require('./processFlow').generate(response.data,structuredContext.steps);}catch(repairError){
            const flow=require('./processFlow');response.data=flow.independent(structuredContext.steps);response.data.mermaidCode=flow.generate(response.data,structuredContext.steps);structuredContext.flowWarning='La IA no pudo justificar un flujo conectado completo. Se muestran operaciones independientes respaldadas por requisitos, sin inferir su secuencia.';
          }
        }structuredContext.proposedFlow={nodes:response.data.nodes,edges:response.data.edges};
      }
      if(diagramType==='NAVIGATION'){
        if(!Array.isArray(response.data?.nodes))throw Object.assign(new Error('Jerarquia de navegacion invalida'),{statusCode:502});
        response.data.mermaidCode=require('./navigationTree').generate(response.data.nodes,project.name);structuredContext.proposedNavigationNodes=response.data.nodes;
      }
      if(typeof response.data?.mermaidCode!=='string')throw Object.assign(new Error('La IA no devolvió un diagrama válido. Vuelve a generar.'),{statusCode:502});
      mermaidCode=this.cleanMermaidCode(response.data.mermaidCode);usedProvider=config.provider.toUpperCase();
    }else if (isMock || diagramType === 'USE_CASE') {
      console.log(`[DiagramAiService] Generando ${diagramType} con generador determinista (modo mock)...`);
      mermaidCode = this.generateDeterministicFallback(diagramType, project, structuredContext);
      usedProvider = 'MOCK_DETERMINISTIC';
    } else {
      try {
        console.log(`[DiagramAiService] Solicitando ${diagramType} a Gemini con contexto compacto...`);
        const payload = {
          contents: [{ role: 'user', parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 2048 }
        };

        const rawResponse = await this.gemini.callGeminiApi(payload);
        const cleaned = this.cleanMermaidCode(rawResponse);

        // Run validation, normalization and repair pipeline
        const repairResult = await mermaidRepairer.repairAndValidate(
          cleaned,
          diagramType,
          structuredContext,
          this.gemini,
          () => this.generateDeterministicFallback(diagramType, project, structuredContext)
        );

        mermaidCode = repairResult.code;
        technicalError = repairResult.technicalError;
        repairMethod = repairResult.repairMethod;
      } catch (geminiErr) {
        console.error(`[DiagramAiService] Error en llamada a Gemini para ${diagramType}:`, geminiErr.message);
        technicalError = geminiErr.message;
        mermaidCode = this.generateDeterministicFallback(diagramType, project, structuredContext);
        usedProvider = 'FALLBACK_DETERMINISTIC';
        repairMethod = 'DETERMINISTIC_FALLBACK';
      }
    }

    // Final safety normalization
    mermaidCode = mermaidNormalizer.normalize(mermaidCode, diagramType);

    // Run semantic validation
    const validation = this.validateDiagram(diagramType, mermaidCode);
    if(diagramType==='ER'&&(!validation.isValid||!validation.stats?.entitiesCount))throw Object.assign(new Error('No se pudo generar un diagrama E/R válido: '+(validation.errors||[]).join('; ')),{statusCode:422,code:'INVALID_ER_DIAGRAM'});
    if(diagramType==='CLASS'&&(!validation.isValid||!validation.stats?.classesCount))throw Object.assign(new Error('No se pudo generar un diagrama UML válido: '+(validation.errors||[]).join('; ')),{statusCode:422,code:'INVALID_CLASS_DIAGRAM'});

    // Persist into Artifact and ArtifactVersion with structured content for traceability
    const persisted = await this.persistDiagramArtifact(
      projectId,
      diagramType,
      structuredContext,
      mermaidCode,
      technicalError || (validation.isValid ? null : validation.errors.join('; '))
    );

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
      mermaidCode,
      diagram: { mermaidCode },
      artifact: { mermaidCode },
      provider: usedProvider,
      warning: structuredContext.flowWarning||null,
      repairMethod,
      validation,
      generatedAt: persisted.createdAt || new Date().toISOString(),
      artifactVersionId: persisted.id,
      technicalError,
      status: technicalError ? 'GENERATED_WITH_FALLBACK' : 'GENERATED'
    };
  }

  /**
   * Evaluates semantic and syntactic quality for a diagram code.
   */
  validateDiagram(diagramType, mermaidCode, crossCompareCode = null) {
    if (diagramType === 'ER') {
      const report = diagramSemanticValidator.validateER(mermaidCode);
      if (crossCompareCode) {
        report.crossValidation = diagramSemanticValidator.crossValidate(mermaidCode, crossCompareCode);
      }
      return report;
    }
    if (diagramType === 'CLASS') {
      const report = diagramSemanticValidator.validateClass(mermaidCode);
      if (crossCompareCode) {
        report.crossValidation = diagramSemanticValidator.crossValidate(crossCompareCode, mermaidCode);
      }
      return report;
    }
    const val = mermaidValidator.validate(mermaidCode, diagramType);
    return {
      isValid: val.isValid,
      syntaxValid: val.isValid,
      errors: val.isValid ? [] : [val.error],
      warnings: [],
      stats: {}
    };
  }

  /**
   * Saves and versions user-edited Mermaid code with validation and audit.
   */
  async saveCustomDiagram(projectId, diagramType, rawCode) {
    const normalized = mermaidNormalizer.normalize(rawCode, diagramType);
    const validation = this.validateDiagram(diagramType, normalized);

    const persisted = await this.persistDiagramArtifact(
      projectId,
      diagramType,
      { manualEdit: true, source: 'USER_EDITOR' },
      normalized,
      validation.isValid ? null : validation.errors.join('; ')
    );

    return {
      success: true,
      diagramType,
      code: normalized,
      mermaidCode: normalized,
      diagram: { mermaidCode: normalized },
      artifact: { mermaidCode: normalized },
      validation,
      artifactVersionId: persisted.id,
      updatedAt: persisted.createdAt || new Date().toISOString()
    };
  }

  /**
   * Persists the generated diagram into Artifact and ArtifactVersion in PostgreSQL.
   */
  async persistDiagramArtifact(projectId, diagramType, structuredContent, renderedContent, error = null) {
    const artifactName = `DIAGRAM_${diagramType}`;

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

    const version = await prisma.artifactVersion.create({
      data: {
        artifactId: artifact.id,
        version: artifact.revision,
        structuredContent,
        renderedContent,
        status: error ? 'ERROR' : 'APPROVED',
        validationStatus: error ? 'ERROR' : 'VALID',
        technicalError: error
      }
    });

    await prisma.artifact.update({
      where: { id: artifact.id },
      data: { approvedVersionId: version.id }
    });

    return version;
  }

  /**
   * Fetches the latest stored diagram for a project with semantic quality report.
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
    const rawCode = latestVersion?.renderedContent || null;
    const code = rawCode ? mermaidNormalizer.normalize(rawCode, diagramType) : null;
    const validation = code ? this.validateDiagram(diagramType, code) : null;

    return {
      projectId,
      diagramType,
      title: diagCheck?.title || diagramType,
      isGenerated: Boolean(code),
      code,
      mermaidCode: code,
      diagram: { mermaidCode: code },
      artifact: { mermaidCode: code },
      validation,
      generatedAt: latestVersion?.createdAt || null,
      isOutdated: diagCheck?.isOutdated || false,
      technicalError: latestVersion?.technicalError || null,
      architectureProposal: latestVersion?.structuredContent?.context?.architectureProposal || latestVersion?.structuredContent?.architectureProposal || null,
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
          code: null
        };
      }
    }
    return results;
  }
}

module.exports = new DiagramAiService();
