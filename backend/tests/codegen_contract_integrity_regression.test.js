const test = require('node:test');
const assert = require('node:assert/strict');
const { executionProblems } = require('../src/services/codegen/executableContract');
const { generateOperationServiceFile, generateOperationRoutesFile } = require('../src/services/codegen/operationGenerator');
const { generateEntityRoutesFile } = require('../src/services/codegen/routeGenerator');
const { computeDependencyHash } = require('../src/services/codegen/aiProposalStore');
const { extractVisualContract } = require('../src/services/codegen/mockupVisualContract');
const { convertHtmlToJsx } = require('../src/services/codegen/mockupConverter');
const { generateContractTask } = require('../src/services/codegen/contractTaskGenerator');
const { auditScreenBindings } = require('../src/services/codegen/screenBindingAudit');
const { executeSteps } = require('../src/services/codegen/operationRuntime');
const { validateProjectSpec } = require('../src/services/codegen/projectSpecValidator');

const entities = [
  { id: 'book', name: 'Book', modelName: 'Book', attributes: [{ fieldName: 'id', isPk: true }, { fieldName: 'title' }] },
  { id: 'loan', name: 'Loan', modelName: 'Loan', attributes: [{ fieldName: 'id', isPk: true }, { fieldName: 'bookId' }] }
];
test('Related library entities never imply writes or a shared payload', () => {
  const op = { operationId: 'loan', name: 'Manage loans', type: 'BUSINESS_LOGIC', method: 'POST', route: '/api/operations/loan', steps: [{ action: 'CREATE', entity: 'Book' }, { action: 'CREATE', entity: 'Loan' }] };
  assert.ok(executionProblems(op, entities).length >= 2);
  assert.throws(() => generateOperationServiceFile([op], entities), { code: 'UNRESOLVED_OPERATION_CONTRACT' });
  const review = generateOperationServiceFile([op], entities, { reviewOnly: true });
  assert.match(review, /501/);
  assert.doesNotMatch(review, /\.create\(/);
});
test('Field projection and prior-result dependencies are checked before generation', () => {
  const op = { bindingVersion: 2, steps: [{ id: 'loan', action: 'CREATE', entity: 'Loan', fields: { title: { $ref: 'steps.later.id' } } }] };
  const issues = executionProblems(op, entities);
  assert.ok(issues.some(issue => issue.includes('title')));
  assert.ok(issues.some(issue => issue.includes('posterior')));
});
test('Dependency hashes include nested values and ignore object key order', () => {
  assert.notEqual(computeDependencyHash({ fields: [{ fieldName: 'title' }] }), computeDependencyHash({ fields: [{ fieldName: 'bookId' }] }));
  assert.equal(computeDependencyHash({ a: { x: 1, y: 2 }, b: 3 }), computeDependencyHash({ b: 3, a: { y: 2, x: 1 } }));
});
test('Visual tokens are parsed as data; code cannot run in a mockup configuration', () => {
  const visual = extractVisualContract('<script>tailwind.config = {theme:{extend:{spacing:{"space-lg":"24px"},colors:{primary:"#123456"}}}};</script>');
  assert.equal(visual.config.theme.extend.spacing['space-lg'], '24px');
  assert.deepEqual(visual.errors, []);
  const malicious = extractVisualContract('<script>tailwind.config = {theme: (globalThis.EXECUTED=true)};</script>');
  assert.equal(globalThis.EXECUTED, undefined);
  assert.equal(malicious.errors.length, 1);
});
test('Mockups retain their structure without adding a second form; missing controls are explicit', () => {
  const screen = { name: 'Loans', route: '/loans', html: '<main><div><span>Vista 1 de 2</span><h1>Loans</h1></div><input name="bookId"/><button data-action-id="lend">Lend</button></main>', contract: { renderer: 'task', primaryActionId: 'lend', fields: [{ fieldName: 'bookId', mode: 'editable' }, { fieldName: 'readerId', mode: 'editable' }], actions: [{ actionId: 'lend', name: 'Lend', method: 'POST', route: '/api/operations/lend' }] } };
  const jsx = convertHtmlToJsx(screen.html, 'Loans', screen.route, '', { screenContract: screen.contract });
  assert.match(jsx, /slots\.setField\("bookId"/);
  assert.match(jsx, /slots\.execute\("lend"/);
  assert.match(jsx, /<div><h1>Loans<\/h1><\/div>/);
  const code = generateContractTask('Loans', screen, jsx);
  assert.doesNotMatch(code, /Datos del sistema|mockup-live-region/);
  assert.deepEqual(auditScreenBindings(screen).missingFields, ['readerId']);
});
test('Roles are exact and generic CRUD cannot bypass an executable business mutation', () => {
  const op = { operationId: 'lend', name: 'Lend', type: 'BUSINESS_LOGIC', bindingVersion: 2, method: 'POST', route: '/api/operations/lend', authorizedRoles: ['Librarian'], steps: [{ entity: 'Loan', action: 'CREATE' }] };
  const route = generateOperationRoutesFile([op], { authType: 'JWT', roles: ['Librarian', 'Administrator'] });
  assert.doesNotMatch(route, /authorizeRoles\([^)]*Administrator/);
  const crud = generateEntityRoutesFile({ name: 'Loan' }, { hasAuth: true, operations: [op], defaultRoles: ['Administrator'] });
  assert.match(crud, /BUSINESS_CONTRACT_REQUIRED/);
  assert.doesNotMatch(crud, /authorizeRoles\([^)]*Administrator/);
});
test('Record authorization rejects another reader before a library write', async () => {
  let writes = 0;
  const contract = { authorizedRoles: ['Reader'], recordAccess: [{ entity: 'Loan', where: { id: { $ref: 'payload.loanId' }, readerId: { $ref: 'user.id' } } }], steps: [{ id: 'book', action: 'CREATE', entity: 'Book', fields: { title: 'Authorized' } }], resultStep: 'book' };
  const models = { Loan: { findOne: async ({ where }) => where.readerId === 7 ? { id: where.id } : null }, Book: { create: async fields => { writes++; return fields; } } };
  await assert.rejects(executeSteps(models, contract, { loanId: 10 }, { id: 9, role: 'Reader' }, {}), { code: 'FORBIDDEN_RECORD' });
  assert.equal(writes, 0);
  assert.equal((await executeSteps(models, contract, { loanId: 10 }, { id: 7, role: 'Reader' }, {})).title, 'Authorized');
  assert.equal(writes, 1);
});
test('JWT, an endpoint and unexecuted test cases do not certify requirements', () => {
  const spec = { entities, security: { authType: 'JWT' }, operations: [{ operationId: 'login', route: '/api/login', method: 'POST', authorizedRoles: ['Reader'], output: { successStatus: 200 }, requirementIds: ['rf'] }], requirements: [{ id: 'rf', name: 'Login and permissions', type: 'FUNCTIONAL' }], testCases: [{ requirementIds: ['rf'] }] };
  const result = validateProjectSpec(spec, { validatedRequirementIds: ['rf'] });
  assert.equal(result.coverage.requirementsTraced, 1);
  assert.equal(result.coverage.requirementsGenerated, 0);
  assert.equal(result.coverage.requirementsCompiled, 0);
  assert.equal(result.coverage.requirementsValidated, 0);
});
