const fs = require('fs');
const path = require('path');
const prisma = require('../src/config/prisma');
const { buildProjectSpec, computeCanonicalHash } = require('../src/services/codegen/projectSpecBuilder');
const { buildFieldContract } = require('../src/services/codegen/screenContract');

const projectId = '6ba45264-e3e6-4819-a0dd-18909f1fb674';
const version = 'autron5.intake.v1';
const ref = $ref => ({ $ref });
const schema = (properties, required = []) => ({ type: 'object', additionalProperties: false, properties, required });
const text = { type: 'string' };
const integer = { type: 'integer' };
const roles = ['Recepción']; // Existing actor of UC-16 and linked actor of UC-20/24; no additional roles.

async function prepare() {
  const project = await prisma.project.findUnique({ where: { id: projectId }, include: {
    requirements: true, actors: true, useCases: true, navigationNodes: true,
    entities: { include: { attributes: true } }
  } });
  if (project?.name !== 'Autron5') throw new Error('Proyecto distinto del autorizado');
  const spec = await buildProjectSpec(projectId);
  const actor = project.actors.find(a => a.name === roles[0]);
  const entity = name => spec.entities.find(e => e.name === name);
  const source = (name, alias) => ({ name: alias, operationId: `op_${entity(name).tableName}_list`, route: `/api/${entity(name).endpoint}` });
  const relation = (name, alias, labels, filter) => ({ entityId: entity(name).id, endpoint: `/api/${entity(name).endpoint}`, dataSource: alias, valueField: 'id', labelField: labels[0], labelFields: labels, ...(filter ? { filter } : {}) });
  const sources = [source('CLIENTE', 'clientes'), source('VEHICULO', 'vehiculos'), source('CITA', 'citas'), source('RECEPCION', 'recepciones'), source('EVIDENCIA_MULTIMEDIA', 'evidencias')];
  const clientFields = Object.fromEntries(['nombre', 'telefono', 'correo', 'direccion'].map(key => [key, ref('payload.' + key)]));
  const vehicleFields = Object.fromEntries(['clienteId', 'placa', 'marca', 'modelo', 'anio', 'vin', 'color'].map(key => [key, ref('payload.' + key)]));
  const receiptFields = Object.fromEntries(['vehiculoId', 'citaId', 'kilometraje', 'nivelCombustible', 'motivoIngreso', 'observaciones'].map(key => [key, ref('payload.' + key)]));
  const uploadSchema = schema({ token: { type: 'string', minLength: 1 }, observaciones: text }, ['token']);
  const operations = [
    { code: 'UC-20', entity: 'CLIENTE', input: schema(Object.fromEntries(Object.keys(clientFields).map(key => [key, key === 'nombre' ? { type: 'string', minLength: 1 } : text])), ['nombre']), resultStep: 'cliente',
      steps: [{ step: 1, id: 'cliente', action: 'CREATE', entity: entity('CLIENTE').modelName, fields: { ...clientFields, fechaCreacion: ref('now') } }] },
    { code: 'UC-24', entity: 'VEHICULO', input: schema({ clienteId: integer, placa: { type: 'string', minLength: 1 }, marca: text, modelo: text, anio: integer, vin: text, color: text }, ['clienteId', 'placa']), resultStep: 'vehiculo',
      steps: [{ step: 1, id: 'cliente', action: 'QUERY', entity: entity('CLIENTE').modelName, where: { id: ref('payload.clienteId') }, requireMatch: true },
        { step: 2, id: 'vehiculo', action: 'CREATE', entity: entity('VEHICULO').modelName, fields: { ...vehicleFields, fechaRegistro: ref('now') } }] },
    { code: 'UC-16', entity: 'RECEPCION', input: schema({ vehiculoId: integer, citaId: integer, kilometraje: integer,
      nivelCombustible: { type: 'number', minimum: 0, maximum: 1 }, motivoIngreso: { type: 'string', minLength: 1 }, observaciones: text,
      evidencias: { type: 'array', items: uploadSchema } }, ['vehiculoId', 'kilometraje', 'nivelCombustible', 'motivoIngreso']),
      resultStep: 'recepcion', uploadFields: ['evidencias'],
      steps: [
        { step: 1, id: 'vehiculo', action: 'QUERY', entity: entity('VEHICULO').modelName, where: { id: ref('payload.vehiculoId') }, requireMatch: true },
        { step: 2, id: 'cita', action: 'QUERY', entity: entity('CITA').modelName, when: ref('payload.citaId'), where: { id: ref('payload.citaId'), vehiculoId: ref('payload.vehiculoId') }, requireMatch: true },
        { step: 3, id: 'recepcion', action: 'CREATE', entity: entity('RECEPCION').modelName,
          fields: { ...receiptFields, usuarioId: ref('user.id'), fechaRecepcion: ref('now') } },
        { step: 4, id: 'evidencias', action: 'CREATE', entity: entity('EVIDENCIA_MULTIMEDIA').modelName, forEach: ref('payload.evidencias'),
          fields: { recepcionId: ref('steps.recepcion.id'), usuarioId: ref('user.id'), urlOriginal: ref('item.urlOriginal'), pesoBytes: ref('item.pesoBytes'), formatoMime: ref('item.formatoMime'), observaciones: ref('item.observaciones'), fechaCarga: ref('now') } }
      ] }
  ];
  const definitions = [
    { code: 'UC-20', route: '/clientes', title: 'Clientes', listSource: 'clientes', description: 'Registrar los datos del cliente y consultar su directorio.', names: Object.keys(clientFields),
      sources: [sources[0]], columns: [{ field: 'nombre', label: 'Cliente' }, { field: 'telefono', label: 'Teléfono' }, { field: 'correo', label: 'Correo' }] },
    { code: 'UC-24', route: '/vehiculos', title: 'Vehículos', listSource: 'vehiculos', description: 'Registrar el vehículo y asociarlo con su cliente responsable.', names: Object.keys(vehicleFields),
      sources: sources.slice(0, 2), columns: [{ field: 'placa', label: 'Placa' }, { field: 'clienteId', label: 'Cliente', relation: relation('CLIENTE', 'clientes', ['nombre']) }, { field: 'marca', label: 'Marca' }, { field: 'modelo', label: 'Modelo' }] },
    { code: 'UC-16', route: '/recepcion', title: 'Recepción de vehículos', listSource: 'recepciones', description: 'Selecciona el vehículo y registra los datos de ingreso y las fotografías.',
      names: ['vehiculoId', 'citaId', 'kilometraje', 'nivelCombustible', 'motivoIngreso', 'observaciones'], sources,
      columns: [{ field: 'vehiculoId', label: 'Vehículo', relation: relation('VEHICULO', 'vehiculos', ['placa', 'marca', 'modelo']) }, { field: 'kilometraje', label: 'Kilometraje' }, { field: 'nivelCombustible', label: 'Combustible (fracción)' }, { field: 'motivoIngreso', label: 'Motivo' }] }
  ];
  const screens = definitions.map(definition => {
    const operation = operations.find(op => op.code === definition.code);
    const target = entity(operation.entity);
    const node = project.navigationNodes.find(n => n.route === definition.route);
    if (!node) throw new Error('Falta navegación de ' + definition.route);
    const fields = buildFieldContract(target, spec.relationships, spec.entities).map(field => ({ ...field, mode: definition.names.includes(field.fieldName) ? 'editable' : 'automatic', required: operation.input.required.includes(field.fieldName) }));
    const labels = { nombre: 'Nombre', telefono: 'Teléfono', correo: 'Correo electrónico', direccion: 'Dirección', placa: 'Placa', marca: 'Marca', modelo: 'Modelo', anio: 'Año', vin: 'VIN', color: 'Color', clienteId: 'Cliente', citaId: 'Cita (opcional)', vehiculoId: 'Vehículo', observaciones: 'Observaciones' };
    for (const item of fields) if (labels[item.fieldName]) item.label = labels[item.fieldName];
    const field = name => fields.find(f => f.fieldName === name);
    if (field('clienteId')) field('clienteId').relation = relation('CLIENTE', 'clientes', ['nombre']);
    if (definition.code === 'UC-16') {
      fields.unshift({ fieldName: 'clienteId', label: 'Cliente', dataType: 'INTEGER', mode: 'editable', submit: false, required: false, relation: relation('CLIENTE', 'clientes', ['nombre']), help: 'Filtra los vehículos del cliente.' });
      field('vehiculoId').relation = relation('VEHICULO', 'vehiculos', ['placa', 'marca', 'modelo'], { field: 'clienteId', valueFrom: 'clienteId' });
      field('citaId').relation = relation('CITA', 'citas', ['fechaHora', 'motivo'], { field: 'vehiculoId', valueFrom: 'vehiculoId' });
      field('kilometraje').label = 'Kilometraje de ingreso';
      field('kilometraje').step = 1;
      field('nivelCombustible').label = 'Combustible';
      field('nivelCombustible').options = [{ value: 0, label: 'Vacío' }, { value: .25, label: '1/4' }, { value: .5, label: '1/2' }, { value: .75, label: '3/4' }, { value: 1, label: 'Lleno' }];
      field('motivoIngreso').label = 'Motivo de ingreso';
      fields.push({ fieldName: 'evidencias', label: 'Fotografías (opcionales)', control: 'files', dataType: 'JSON', mode: 'editable', required: false, uploadEndpoint: '/api/upload' });
    }
    if (definition.code === 'UC-16') {
      definition.columns.find(c => c.field === 'nivelCombustible').options = field('nivelCombustible').options;
      definition.columns.push({ field: 'id', label: 'Fotografias', attachments: { dataSource: 'evidencias', foreignKey: 'recepcionId', urlField: 'urlOriginal' } });
    }
    const order = definition.code === 'UC-16' ? ['clienteId', 'vehiculoId', 'citaId', 'kilometraje', 'nivelCombustible', 'motivoIngreso', 'observaciones', 'evidencias'] : definition.names;
    fields.sort((a, b) => (order.indexOf(a.fieldName) < 0 ? 999 : order.indexOf(a.fieldName)) - (order.indexOf(b.fieldName) < 0 ? 999 : order.indexOf(b.fieldName)));
    return { nodeId: node.id, useCaseId: project.useCases.find(u => u.codeId === definition.code).id, route: definition.route, title: definition.title,
      contract: { renderer: 'task', order: { 'UC-20': 1, 'UC-24': 2, 'UC-16': 3 }[definition.code], entityId: target.id, actorIds: [actor.id], purpose: definition.description, summary: definition.code === 'UC-16' ? 'La lectura de kilometraje queda vinculada a este ingreso. Para confirmar, todas las fotografías seleccionadas deben cargarse correctamente.' : definition.description,
        primaryActionId: 'confirmar', actions: [{ actionId: 'confirmar', operationId: definition.code, name: definition.code === 'UC-16' ? 'Confirmar recepción' : 'Guardar ' + (definition.code === 'UC-20' ? 'cliente' : 'vehículo') }],
        fields, dataSources: definition.sources, listSource: definition.listSource, listTitle: definition.title + ' registrados', columns: definition.columns,
        navigation: definitions.filter(d => d.code !== definition.code).map(d => ({ route: d.route, label: 'Ir a ' + d.title.toLowerCase() })),
        ...(definition.code === 'UC-16' ? { uploads: { private: true, roles } } : {}), unresolved: [] },
      html: `<main><header><h1>${definition.title}</h1><p>${definition.description}</p></header><div class="contract-task-grid"><section data-contract-slot="form"></section><aside class="contract-panel"><section data-contract-slot="summary"></section></aside></div><section data-contract-slot="table"></section></main>` };
  });
  const manifest = { version, projectId, sourceDocument: 'AUTRON_Propuesta_Overleaf.pdf', sourceRequirements: ['RF-03', 'RF-04', 'RF-07', 'RF-17', 'RNF-05', 'RNF-06', 'RNF-11'],
    userDecisions: { requiredIdentityFields: { CLIENTE: ['nombre'], VEHICULO: ['clienteId', 'placa'] }, requiredReceiptFields: ['vehiculoId', 'kilometraje', 'nivelCombustible', 'motivoIngreso'], evidenceRequired: false, odometerPolicy: 'RECEIPT_ONLY', fuelUnit: 'FRACTION_0_1', uploadFailurePolicy: 'DO_NOT_CONFIRM' },
    operations, screens, roles, scope: 'Recepción: Cliente → Vehículo → Recepción; no autorización de otros procesos.' };
  const dir = path.resolve(__dirname, '../specifications/autron5');
  fs.writeFileSync(path.join(dir, 'intake.contract.json'), JSON.stringify(manifest, null, 2));
  if (!process.argv.includes('--apply')) return console.log('Contrato preparado; sin cambios en la base.');
  await prisma.$transaction(async tx => {
    for (const operation of operations) {
      const uc = project.useCases.find(u => u.codeId === operation.code);
      const executionContract = { bindingVersion: 2, authorizedRoles: roles, input: { params: [], query: [], bodySchema: operation.input }, resultStep: operation.resultStep, uploadFields: operation.uploadFields || [], unresolved: [],
        decisionEvidence: { confirmedBy: 'user', date: '2026-10-31', decisions: manifest.userDecisions } };
      if (uc.evidence?.intakeVersion === version && computeCanonicalHash(uc.mainFlow) === computeCanonicalHash(operation.steps) && computeCanonicalHash(uc.evidence.executionContract) === computeCanonicalHash(executionContract)) continue;
      if (!uc.actorIds.includes(actor.id)) throw new Error('Recepción no está vinculada al caso de uso ' + operation.code);
      const updated = await tx.useCase.updateMany({ where: { id: uc.id, revision: uc.revision }, data: {
        mainFlow: operation.steps, revision: { increment: 1 },
        evidence: { ...(uc.evidence || {}), intakeVersion: version, previousNarrativeFlow: uc.evidence?.previousNarrativeFlow || uc.mainFlow, sourceRequirements: uc.requirementIds,
          executionContract }
      } });
      if (updated.count !== 1) throw new Error('Edición concurrente del caso de uso ' + uc.id);
    }
    for (const screen of screens) {
      const node = project.navigationNodes.find(n => n.id === screen.nodeId);
      if (node.evidence?.intakeVersion === version && computeCanonicalHash(node.evidence.screenContract) === computeCanonicalHash(screen.contract)) continue;
      await tx.navigationNode.update({ where: { id: node.id }, data: { actorIds: [actor.id], useCaseIds: [screen.useCaseId], revision: { increment: 1 },
        evidence: { intakeVersion: version, sources: node.evidence?.sources || node.evidence, screenContract: screen.contract } } });
      const artifact = await tx.artifact.findFirst({ where: { projectId, type: 'MOCKUP', name: node.id }, include: { versions: { orderBy: { version: 'desc' }, take: 1 } } });
      if (!artifact) throw new Error('Falta mockup existente de ' + node.name);
      const previous = artifact.versions[0];
      await tx.artifactVersion.create({ data: { artifactId: artifact.id, version: previous.version + 1, status: 'PENDING_REVIEW',
        structuredContent: { ...previous.structuredContent, intakeVersion: version, basedOnVersionId: previous.id,
          screen: { ...previous.structuredContent.screen, title: screen.title, html: screen.html, contract: screen.contract } }, renderedContent: screen.html } });
      await tx.artifact.update({ where: { id: artifact.id }, data: { revision: { increment: 1 } } });
    }
    for (const name of ['CLIENTE', 'VEHICULO', 'RECEPCION', 'EVIDENCIA_MULTIMEDIA', 'CITA']) {
      const ent = project.entities.find(e => e.name === name);
      if (ent.evidence?.intakeVersion === version) continue;
      // Intake writes must pass through their use case; raw CRUD is not an alternate permission path.
      await tx.entity.update({ where: { id: ent.id }, data: { revision: { increment: 1 }, evidence: { ...(ent.evidence || {}), intakeVersion: version,
        crudPermissions: { list: roles, getById: roles, create: [], update: [], delete: [] } } } });
    }
    for (const [name, fieldNames] of [['CLIENTE', ['nombre']], ['VEHICULO', ['cliente_id', 'placa']], ['RECEPCION', ['vehiculo_id', 'kilometraje', 'nivel_combustible', 'motivo_ingreso']]]) {
      for (const attr of project.entities.find(e => e.name === name).attributes.filter(a => fieldNames.includes(a.name))) {
        if (attr.evidence?.intakeVersion === version) continue;
        await tx.entityAttribute.update({ where: { id: attr.id }, data: { revision: { increment: 1 }, evidence: { ...(attr.evidence || {}), intakeVersion: version, fieldContract: { allowNull: false } } } });
      }
    }
  });
  console.log('UC-16, UC-20, UC-24 y contratos actualizados; snapshots aprobados intactos.');
}

prepare().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
