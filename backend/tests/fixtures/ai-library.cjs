function fixture(id = 'ai-pipeline-' + Date.now()) {
  const entity = { id: 'book', name: 'Book', modelName: 'Book', tableName: 'books', endpoint: 'books', primaryKey: { fieldName: 'id', type: 'INTEGER', autoIncrement: true }, attributes: [
    { fieldName: 'id', type: 'INTEGER', dataType: 'INTEGER', isPk: true, autoIncrement: true, allowNull: false },
    { fieldName: 'title', type: 'STRING', dataType: 'STRING', allowNull: false },
    { fieldName: 'ownerId', type: 'INTEGER', dataType: 'INTEGER', allowNull: false }
  ] };
  const source = { operationId: 'create-book', type: 'BUSINESS_LOGIC', name: 'Registrar libro propio', method: 'POST', route: '/api/operations/create-book', authorizedRoles: ['Lector'], requirementIds: ['r1'], targetEntity: 'Book', steps: [], output: { successStatus: 201 } };
  const proposal = { ...source, bindingVersion: 2, transaction: true, input: { bodySchema: { type: 'object', additionalProperties: false, properties: { title: { type: 'string', minLength: 1 } }, required: ['title'] } },
    steps: [{ id: 'created', action: 'CREATE', entity: 'Book', fields: { title: { $ref: 'payload.title' }, ownerId: { $ref: 'user.id' } } }], resultStep: 'created', unresolved: [], ambiguities: [] };
  const screen = { id: 'books', name: 'Mis libros', title: 'Mis libros', route: '/mis-libros', roles: ['Lector'], requirementIds: ['r1'], html: '<html><body><header>Biblioteca de muestra</header><section><h1>Mis libros</h1><input placeholder="Título" /><button>Registrar libro</button><table><tbody><tr><td>Referencia</td></tr></tbody></table></section></body></html>', contract: { renderer: 'task', entityId: 'book', fields: [{ fieldName: 'title', dataType: 'STRING', mode: 'editable', required: true }], actions: [{ actionId: 'confirmar', operationId: source.operationId }], primaryActionId: 'confirmar', unresolved: [], dataSources: [] } };
  proposal.acceptanceScenarios = [{ id: 'create-own-book', requirementIds: ['r1'], users: [{ id: 'reader', role: 'Lector' }], fixtures: [],
    requests: [{ id: 'created', operationId: source.operationId, as: 'reader', body: { title: 'Libro API' }, status: 201, equals: [{ path: 'data.data.title', value: 'Libro API' }] }],
    persistence: [{ entity: 'Book', where: { id: { $ref: 'responses.created.data.data.id' } }, count: 1, fields: { title: 'Libro API' } }],
    browser: [{ as: 'reader', screenId: 'books', steps: [{ action: 'fill', field: 'title', value: 'Libro navegador' }, { action: 'click', actionId: 'confirmar' }, { action: 'text', value: 'Libro navegador' }, { action: 'reload' }, { action: 'text', value: 'Libro navegador' }] }]
  }];
  screen.contract.tableColumns = [{ index: 0, field: 'title' }];
  source.input = proposal.input;
  source.narrativeDescription = 'El Lector registra un libro propio. Recibe exclusivamente title, obligatorio y no vacío. ownerId lo asigna el servidor desde user.id; nunca se solicita ni acepta en el body. Consultas y listados solo muestran libros del usuario autenticado. No existen reglas de unicidad del título.';
  source.narrativeSteps = ['Validar title obligatorio', 'Crear Book con title del payload y ownerId del usuario autenticado', 'Devolver el libro guardado'];
  return { source, proposal, screen, spec: { schemaVersion: '1.0.0', project: { id, name: 'Biblioteca IA' }, entities: [entity], operations: [source], screens: [screen], relationships: [], requirements: [{ id: 'r1', code: 'RF-01', name: 'Libros propios', type: 'FUNCTIONAL', status: 'APPROVED' }], businessRules: [], security: { authType: 'JWT', roles: ['Lector', 'Visitante'] }, technologies: [] } };
}

module.exports = { fixture };
