// Trusted interpreter for test DATA. Model responses cannot execute JS, SQL,
// shell commands, or decide whether their own test passed.
const assert = require('node:assert/strict');
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');
const { createRequire } = require('module');
const { deriveUserFieldMapping } = require('./authGenerator');

const forbidden = new Set(['__proto__', 'prototype', 'constructor']);
function valueAt(object, key) {
  return String(key).split('.').reduce((node, part) => {
    if (forbidden.has(part)) throw new Error('INVALID_TEST_REFERENCE');
    return node?.[part];
  }, object);
}
function resolveTest(value, context) {
  if (Array.isArray(value)) return value.map(item => resolveTest(item, context));
  if (!value || typeof value !== 'object') return value;
  if (Object.hasOwn(value, '$ref')) {
    if (!/^(users|fixtures|responses)\./.test(value.$ref)) throw new Error('INVALID_TEST_REFERENCE');
    const result = valueAt(context, value.$ref);
    if (result === undefined) throw new Error('UNRESOLVED_TEST_REFERENCE');
    return result;
  }
  return Object.fromEntries(Object.entries(value).map(([key, item]) => {
    if (forbidden.has(key)) throw new Error('INVALID_TEST_FIELD');
    return [key, resolveTest(item, context)];
  }));
}

function validateScenario(scenario, spec) {
  const errors = [];
  if (!/^[a-zA-Z0-9_-]{1,120}$/.test(scenario?.id || '') || !scenario.requests?.length || !scenario.persistence?.length) errors.push('SCENARIO_REQUIRES_REQUESTS_AND_PERSISTENCE');
  if ((scenario.requests?.length || 0) > 60 || (scenario.fixtures?.length || 0) > 60 || (scenario.users?.length || 0) > 10) errors.push('SCENARIO_TOO_LARGE');
  const roles = spec.security?.roles || [];
  for (const user of scenario.users || []) if (!user.id || !roles.includes(user.role)) errors.push('INVALID_TEST_USER_ROLE');
  const entities = new Map((spec.entities || []).map(e => [e.modelName, e]));
  for (const fixture of scenario.fixtures || []) {
    const entity = entities.get(fixture.entity);
    if (!entity || !fixture.id || Object.keys(fixture.fields || {}).some(key => !entity.attributes.some(a => a.fieldName === key))) errors.push('INVALID_TEST_FIXTURE');
  }
  for (const request of scenario.requests || []) {
    if (!(spec.operations || []).some(op => op.operationId === request.operationId)) errors.push('UNKNOWN_TEST_OPERATION');
    if (!request.id || !Number.isInteger(request.status) || request.status < 200 || request.status > 499) errors.push('INVALID_EXPECTED_STATUS');
    if (request.status < 300 && !request.equals?.length) errors.push('MISSING_RESPONSE_ASSERTION');
    if (request.as && !(scenario.users || []).some(user => user.id === request.as)) errors.push('UNKNOWN_TEST_USER');
  }
  for (const invocation of scenario.systemInvocations || []) {
    if (!(spec.operations || []).some(op => op.operationId === invocation.operationId && op.invocation === 'SYSTEM')) errors.push('INVALID_SYSTEM_TEST_OPERATION');
  }
  for (const expectation of scenario.persistence || []) {
    const entity = entities.get(expectation.entity);
    if (!entity || !Object.keys(expectation.where || {}).length || !Number.isInteger(expectation.count) || expectation.count < 0) errors.push('INVALID_PERSISTENCE_ASSERTION');
    if (entity && [...Object.keys(expectation.where || {}), ...Object.keys(expectation.fields || {})].some(key => !entity.attributes.some(a => a.fieldName === key))) errors.push('UNKNOWN_PERSISTENCE_FIELD');
  }
  for (const journey of scenario.browser || []) {
    const screen = (spec.screens || []).find(screen => screen.id === journey.screenId);
    if (!(spec.screens || []).some(screen => screen.id === journey.screenId) || !(scenario.users || []).some(user => user.id === journey.as)) errors.push('INVALID_BROWSER_TARGET');
    if (!journey.steps?.some(step => step.action === 'reload') || !journey.steps?.some(step => step.action === 'text')) errors.push('BROWSER_REQUIRES_RELOAD_AND_ASSERTION');
    for (const step of journey.steps || []) if (!['fill', 'select', 'click', 'reload', 'text'].includes(step.action)) errors.push('UNSUPPORTED_BROWSER_STEP');
    const fields = new Set((screen?.contract?.fields || []).map(field => field.fieldName));
    for (const action of screen?.contract?.actions || []) for (const field of Object.keys((spec.operations || []).find(op => op.operationId === action.operationId)?.input?.bodySchema?.properties || {})) fields.add(field);
    for (const step of journey.steps || []) if (['fill', 'select'].includes(step.action) && !fields.has(step.field)) errors.push('UNKNOWN_BROWSER_FIELD: ' + step.field + '; allowed=' + [...fields].join(','));
  }
  return errors;
}

const scenarioSchema = {
  id: 'unique-kebab-id', requirementIds: ['approved-requirement-id'], users: [{ id: 'actorA', role: 'EXACT_APPROVED_ROLE', profile: {} }], fixtures: [],
  requests: [{ id: 'created', operationId: 'EXACT_OPERATION_ID', as: 'actorA', body: { inputField: 'sample' }, status: 201, equals: [{ path: 'data.data.field', value: 'sample' }] }],
  persistence: [{ entity: 'EXACT_MODEL', where: { id: { $ref: 'responses.created.data.data.id' } }, count: 1, fields: { field: 'sample' } }],
  browser: [{ as: 'actorA', screenId: 'EXACT_SCREEN_ID', steps: [{ action: 'fill', field: 'inputField', value: 'sample-browser' }, { action: 'click', actionId: 'confirmar' }, { action: 'text', value: 'sample-browser' }, { action: 'reload' }, { action: 'text', value: 'sample-browser' }] }]
};

async function runContractAcceptance({ models, independentModels, request, spec, directory, baseUrl }, options = {}) {
  const tests = [], screenshots = [], failures = [];
  const requireExport = createRequire(path.join(directory, 'backend/package.json'));
  const bcrypt = requireExport('bcryptjs');
  const mapping = deriveUserFieldMapping((spec.entities || []).find(e => /^(usuario|user|account|cuenta)$/i.test(e.name)));
  let browser;
  const scenarios = [...(spec.acceptanceScenarios || []), ...(spec.operations || []).flatMap(op => op.acceptanceScenarios || [])];
  if (!scenarios.length) return { passed: false, browserPassed: false, tests, failures: ['UNRESOLVED_ACCEPTANCE_SCENARIOS'], screenshots };
  try {
    for (const scenario of scenarios) {
      const test = { id: scenario.id, kind: 'REAL_POSTGRESQL_HTTP', passed: false, requirementIds: [], executedAt: new Date().toISOString() };
      try {
        assert.deepEqual(validateScenario(scenario, spec), [], 'INVALID_ACCEPTANCE_SCENARIO');
        const context = { users: {}, fixtures: {}, responses: {} };
        for (const user of scenario.users || []) {
          const identifier = 'verify-' + crypto.randomBytes(8).toString('hex') + '@icase.test';
          const password = crypto.randomBytes(20).toString('hex');
          const field = mapping.identifierField || mapping.emailField || mapping.usernameField;
          const data = { ...resolveTest(user.profile || {}, context), [field]: identifier, [mapping.passwordField]: await bcrypt.hash(password, 12) };
          if (mapping.nameField !== field && !data[mapping.nameField]) data[mapping.nameField] = identifier;
          if (mapping.isRoleFk) {
            const entity = spec.entities.find(e => /^(rol|role|perfil)$/i.test(e.name));
            const name = entity?.attributes.find(a => /^(nombre|name|rol|role)$/i.test(a.fieldName))?.fieldName;
            assert.ok(entity && name && entity.primaryKey?.fieldName, 'UNRESOLVED_ROLE_FIXTURE');
            const [record] = await models[entity.modelName].findOrCreate({ where: { [name]: user.role } });
            data[mapping.roleField] = record[entity.primaryKey.fieldName];
          } else data[mapping.roleField] = user.role;
          const record = await models[mapping.modelName].create(data);
          const login = await request('POST', '/api/auth/login', { identifier, password });
          assert.equal(login.status, 200, 'REAL_LOGIN_FAILED');
          const token = login.body.token || login.body.data?.token;
          assert.ok(token, 'MISSING_LOGIN_TOKEN');
          context.users[user.id] = { ...record.get({ plain: true }), id: record.get(mapping.idField), identifier, password, token };
        }
        for (const fixture of scenario.fixtures || []) context.fixtures[fixture.id] = (await models[fixture.entity].create(resolveTest(fixture.fields, context))).get({ plain: true });
        for (const action of scenario.requests) {
          const operation = spec.operations.find(op => op.operationId === action.operationId);
          let route = operation.route;
          for (const [key, value] of Object.entries(resolveTest(action.params || {}, context))) route = route.replace(':' + key, encodeURIComponent(String(value)));
          assert.ok(!route.includes(':'), 'MISSING_ROUTE_PARAMETER');
          const response = await request(operation.method, route, resolveTest(action.body, context), context.users[action.as]?.token);
          assert.equal(response.status, action.status, 'HTTP_STATUS: ' + action.id);
          context.responses[action.id] = response.body;
          for (const expected of action.equals || []) assert.deepEqual(valueAt(response.body, expected.path), resolveTest(expected.value, context), 'RESPONSE: ' + expected.path);
        }
        for (const invocation of scenario.systemInvocations || []) {
          const businessOps = spec.operations.filter(op => op.type === 'BUSINESS_LOGIC');
          const names = require('./operationGenerator').buildOperationNameMap(businessOps);
          const service = requireExport(path.join(directory, 'backend/src/services/operation.service'));
          const { systemIdentity } = requireExport(path.join(directory, 'backend/src/services/operation.runtime'));
          await service[names.get(invocation.operationId)](resolveTest(invocation.body || {}, context), systemIdentity());
        }
        for (const [journeyIndex, journey] of (scenario.browser || []).entries()) {
          if (!browser) {
            const localBrowsers = path.resolve(__dirname, '../../../../.verification/browsers');
            if (!process.env.PLAYWRIGHT_BROWSERS_PATH && fs.existsSync(localBrowsers)) process.env.PLAYWRIGHT_BROWSERS_PATH = localBrowsers;
            const playwright = options.playwright || require('playwright-core');
            browser = await playwright.chromium.launch({ headless: true, ...(process.env.CODEGEN_CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.CODEGEN_CHROMIUM_EXECUTABLE_PATH } : {}) });
          }
          const account = context.users[journey.as];
          const screen = spec.screens.find(s => s.id === journey.screenId);
          const browserContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
          let page;
          let lastStep = 'login';
          const runtimeErrors = [];
          try {
            page = await browserContext.newPage();
            page.on('pageerror', error => runtimeErrors.push(error.name));
            await page.goto(baseUrl);
            await page.locator('input:not([type="password"]):not([type="hidden"])').first().fill(account.identifier);
            await page.locator('input[type="password"]').fill(account.password);
            await page.locator('button[type="submit"]').click();
            const key = require('./screenContract').screenTabKey(screen);
            await page.locator('[data-screen-key=' + JSON.stringify(key) + ']').click();
            for (const step of journey.steps) {
              lastStep = step.action + ':' + (step.field || step.actionId || '');
              const value = resolveTest(step.value, context);
              if (step.action === 'fill') await page.locator('[name=' + JSON.stringify(step.field) + ']').fill(String(value));
              if (step.action === 'select') await page.locator('[name=' + JSON.stringify(step.field) + ']').selectOption(String(value));
              if (step.action === 'click') await page.locator('[data-action-id=' + JSON.stringify(step.actionId) + ']').click();
              if (step.action === 'reload') await page.reload();
              if (step.action === 'text') await page.getByText(String(value), { exact: false }).first().waitFor({ state: 'visible', timeout: 10000 });
            }
            assert.deepEqual(runtimeErrors, [], 'BROWSER_RUNTIME_ERROR');
            assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'BROWSER_HORIZONTAL_OVERFLOW');
            for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
              await page.setViewportSize(viewport);
              await page.reload();
              for (const step of journey.steps.filter(step => step.action === 'text')) await page.getByText(String(resolveTest(step.value, context)), { exact: false }).first().waitFor({ state: 'visible', timeout: 10000 });
              const overflow = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth,
                elements: [...document.querySelectorAll('body *')].filter(node => node.getBoundingClientRect().right > innerWidth + 1).slice(0, 8).map(node => ({ tag: node.tagName, className: typeof node.className === 'string' ? node.className.slice(0, 90) : '', right: Math.round(node.getBoundingClientRect().right) })) }));
              assert.equal(overflow.scroll > overflow.width, false, 'RESPONSIVE_HORIZONTAL_OVERFLOW ' + JSON.stringify(overflow));
              const relative = 'screenshots/' + scenario.id + '-' + journeyIndex + '-' + viewport.width + '.png';
              fs.mkdirSync(path.join(directory, 'screenshots'), { recursive: true });
              await page.screenshot({ path: path.join(directory, relative), fullPage: true }); screenshots.push(relative);
            }
            assert.deepEqual(runtimeErrors, [], 'BROWSER_RUNTIME_ERROR');
            test.browserPassed = true;
          } catch (error) {
            test.browserFailure = { step: lastStep, text: await page?.locator('body').innerText().catch(() => ''), runtimeErrors };
            throw error;
          } finally { await browserContext.close(); }
        }
        // A separately connected Sequelize instance sees only committed data.
        for (const expected of scenario.persistence) {
          const records = await independentModels[expected.entity].findAll({ where: resolveTest(expected.where, context) });
          assert.equal(records.length, expected.count, 'PERSISTENCE_COUNT: ' + expected.entity);
          for (const record of records) for (const [key, value] of Object.entries(expected.fields || {})) assert.deepEqual(record.get(key), resolveTest(value, context), 'PERSISTENCE_FIELD: ' + key);
        }
        test.passed = true;
        test.operationIds = [...new Set(scenario.requests.filter(request => request.status < 300).map(request => request.operationId))];
        test.operationIds.push(...new Set((scenario.systemInvocations || []).map(invocation => invocation.operationId)));
        // Generated test oracles provide execution evidence, not user approval.
        test.requirementIds = (scenario.requirementIds || []).filter(id => (spec.requirements || []).some(r => r.id === id));
      } catch (error) {
        test.error = error.message?.split('\n')[0] || error.code || error.name;
        if (error.code === 'MODULE_NOT_FOUND' || /browserType.launch|Executable doesn't exist/.test(error.message || '')) test.errorKind = 'MISSING_BROWSER_RUNTIME';
        failures.push(test.id + ': ' + test.error);
      }
      tests.push(test);
    }
  } finally { await browser?.close(); }
  return { passed: !failures.length && tests.length > 0, browserPassed: tests.some(test => test.browserPassed) && tests.every(test => test.passed), infrastructureFailure: tests.find(test => test.errorKind)?.errorKind, tests, failures, screenshots };
}
module.exports = { runContractAcceptance, validateScenario, resolveTest, scenarioSchema };
