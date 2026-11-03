// Opt-in live acceptance against a dedicated PostgreSQL instance on 55439.
// Uses the exported models, migrations, routes, services and built frontend.
const fs = require('fs');
const path = require('path');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const { spawnSync } = require('child_process');
const { pathToFileURL } = require('url');
const root = path.resolve(__dirname, '../..');
delete process.env.NODE_PATH;
require('module').Module._initPaths();
const { Client } = require('pg');

async function run() {
  const exported = JSON.parse(fs.readFileSync(path.join(root, '.verification/autron5-last-export.json')));
  assert.equal(exported.ready, false);
  const directory = exported.directory;
  const requireExport = require('module').createRequire(path.join(directory, 'backend/package.json'));
  const { Sequelize } = requireExport('sequelize');
  const express = requireExport('express');
  const bcrypt = requireExport('bcryptjs');
  assert.ok(requireExport.resolve('sequelize').startsWith(path.join(directory, 'backend/node_modules')), 'Install the exported backend dependencies before acceptance');
  const spec = JSON.parse(fs.readFileSync(path.join(directory, 'icase.spec.json')));
  const status = JSON.parse(fs.readFileSync(path.join(directory, 'REVIEW_STATUS.json')));
  assert.equal(status.ready, false);
  const report = { ready: false, passed: false, scope: 'Cliente → Vehículo → Recepción', directory, checks: [], screenshots: [] };
  const check = name => { report.checks.push(name); console.log('PASS ' + name); };
  const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? ['node_modules', 'dist'].includes(entry.name) ? [] : walk(path.join(dir, entry.name)) : [path.join(dir, entry.name)]);
  for (const filename of walk(path.join(directory, 'backend')).filter(file => file.endsWith('.js'))) {
    const result = spawnSync(process.execPath, ['--check', filename], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
  }
  check('Sintaxis de todo el backend exportado');
  const { build, preview } = await import(pathToFileURL(path.join(directory, 'frontend/node_modules/vite/dist/node/index.js')).href);
  await build({ root: path.join(directory, 'frontend') });
  check('Compilación Vite de las 18 pantallas, incluidos todos los mockups');
  const database = 'autron5_acceptance_' + crypto.randomBytes(6).toString('hex');
  const connection = { host: '127.0.0.1', port: 55439, user: 'icase_user', password: 'icase_password' };
  const admin = new Client({ ...connection, database: 'autron5_acceptance', connectionTimeoutMillis: 5000 });
  await admin.connect();
  await admin.query('CREATE DATABASE "' + database + '"');
  await admin.end();
  process.env.DB_HOST = connection.host; process.env.DB_PORT = String(connection.port);
  process.env.DB_NAME = database; process.env.DB_USER = connection.user; process.env.DB_PASSWORD = connection.password;
  process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex'); process.env.AUTO_SYNC_DB = 'false';
  const migrationDb = new Sequelize(database, connection.user, connection.password, { host: connection.host, port: connection.port, dialect: 'postgres', logging: false });
  let models, apiServer, frontendServer, browser, currentPage;
  try {
    await migrationDb.authenticate();
    const migrations = walk(path.join(directory, 'backend/src/migrations')).filter(file => file.endsWith('.js')).sort();
    for (const file of migrations) await require(file).up(migrationDb.getQueryInterface(), Sequelize);
    check(migrations.length + ' migraciones y claves foráneas en PostgreSQL temporal');
    models = require(path.join(directory, 'backend/src/models'));
    const password = 'Acceptance-' + crypto.randomBytes(8).toString('hex');
    const accounts = {};
    for (const name of spec.security.roles) {
      const role = await models.ROL.create({ nombre: name });
      const email = 'test-' + role.id + '@autron.test';
      const user = await models.USUARIO.create({ nombre: 'PRUEBA ' + name, correo: email, rolId: role.id, activo: true, passwordHash: await bcrypt.hash(password, 4) });
      accounts[name] = { user, email };
    }
    const app = express(); app.use(express.json());
    app.use('/api', require(path.join(directory, 'backend/src/routes')));
    app.use((err, req, res, next) => res.status(err.statusCode || err.status || 500).json({ success: false, message: err.message }));
    apiServer = await new Promise(resolve => { const server = app.listen(0, '127.0.0.1', () => resolve(server)); });
    const base = 'http://127.0.0.1:' + apiServer.address().port;
    const request = async (method, route, body, token) => {
      const response = await fetch(base + route, { method, headers: { ...(token ? { Authorization: 'Bearer ' + token } : {}), ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
      const raw = await response.text();
      let parsed; try { parsed = JSON.parse(raw); } catch { parsed = { message: raw }; }
      return { status: response.status, body: parsed };
    };
    for (const account of Object.values(accounts)) {
      const login = await request('POST', '/api/auth/login', { identifier: account.email, password });
      assert.equal(login.status, 200, JSON.stringify(login.body));
      account.token = login.body.token;
    }
    const reception = accounts['Recepción'];
    const operations = Object.fromEntries(spec.operations.map(op => [op.operationId, op]));
    const invoke = (code, body, token = reception.token) => request('POST', operations[code].route, body, token);
    const created = response => { assert.equal(response.status, 200, JSON.stringify(response.body)); assert.ok(response.body.data.data.id); return response.body.data.data; };
    assert.equal((await invoke('UC-16', {}, null)).status, 401);
    for (const [role, account] of Object.entries(accounts).filter(([role]) => role !== 'Recepción')) assert.equal((await invoke('UC-16', {}, account.token)).status, 403, role);
    assert.equal((await request('PUT', '/api/usuarios/' + reception.user.id, { rolId: accounts.Administrador.user.rolId }, reception.token)).status, 403);
    assert.equal((await request('POST', '/api/recepciones', {}, reception.token)).status, 403);
    assert.equal((await request('POST', '/api/auth/register', { email: 'escalation@autron.test', password, role: 'Recepción' })).status, 403);
    check('401/403 por rol, sin bypass CRUD ni autoasignación de Recepción');
    assert.equal((await invoke('UC-20', {})).status, 400);
    const client = created(await invoke('UC-20', { nombre: 'PRUEBA API Cliente', telefono: '0000000000' }));
    assert.equal((await invoke('UC-24', { clienteId: client.id })).status, 400);
    const vehicle = created(await invoke('UC-24', { clienteId: client.id, placa: 'API-PRUEBA', marca: 'Marca prueba', modelo: 'Modelo prueba' }));
    await models.VEHICULO.update({ kilometrajeActual: 25000 }, { where: { id: vehicle.id } });
    const body = { vehiculoId: vehicle.id, kilometraje: 10, nivelCombustible: 0, motivoIngreso: 'PRUEBA ingreso' };
    const count = await models.RECEPCION.count();
    assert.equal((await invoke('UC-16', { ...body, nivelCombustible: 1.1 })).status, 422);
    assert.equal((await invoke('UC-16', { ...body, kilometraje: '10' })).status, 400);
    assert.equal((await invoke('UC-16', { ...body, motivoIngreso: '' })).status, 400);
    assert.equal((await invoke('UC-16', { ...body, usuarioId: accounts.Administrador.user.id })).status, 400);
    const otherVehicle = created(await invoke('UC-24', { clienteId: client.id, placa: 'OTRO-PRUEBA' }));
    const cita = await models.CITA.create({ vehiculoId: otherVehicle.id, clienteId: client.id });
    assert.equal((await invoke('UC-16', { ...body, citaId: cita.id })).status, 422);
    assert.equal(await models.RECEPCION.count(), count);
    const vehicleCount = await models.VEHICULO.count();
    const receipt = created(await invoke('UC-16', body));
    assert.equal(receipt.usuarioId, reception.user.id);
    assert.ok(receipt.fechaRecepcion);
    assert.equal(await models.VEHICULO.count(), vehicleCount);
    assert.equal((await models.VEHICULO.findByPk(vehicle.id)).kilometrajeActual, 25000);
    assert.equal(await models.ORDENTRABAJO.count(), 0);
    check('Cliente/vehículo/recepción persistidos; combustible cero; lectura inferior admitida sin modificar vehículo ni crear orden');
    const image = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6YXQAAAAASUVORK5CYII=', 'base64');
    const upload = async (bytes, token, name = 'prueba.png') => {
      const form = new FormData(); form.append('file', new Blob([bytes], { type: 'image/png' }), name);
      const response = await fetch(base + '/api/upload', { method: 'POST', headers: token ? { Authorization: 'Bearer ' + token } : {}, body: form });
      return { status: response.status, body: await response.json() };
    };
    assert.equal((await upload(image, null)).status, 401);
    assert.equal((await upload(image, accounts.Cliente.token)).status, 403);
    assert.equal((await upload(Buffer.from('not an image'), reception.token)).status, 415);
    const photo = await upload(image, reception.token); assert.equal(photo.status, 201);
    assert.equal((await invoke('UC-16', { ...body, evidencias: [{ token: 'forged' }] })).status, 422);
    const beforeRollback = await models.RECEPCION.count();
    const failedEvidence = await invoke('UC-16', { ...body, evidencias: [{ token: photo.body.token, observaciones: 'x'.repeat(300) }] });
    assert.ok(failedEvidence.status >= 400);
    assert.equal(await models.RECEPCION.count(), beforeRollback);
    assert.equal(await models.EVIDENCIAMULTIMEDIA.count(), 0);
    const withPhoto = created(await invoke('UC-16', { ...body, evidencias: [{ token: photo.body.token }] }));
    const evidence = await models.EVIDENCIAMULTIMEDIA.findOne({ where: { recepcionId: withPhoto.id } });
    assert.equal(evidence.usuarioId, reception.user.id);
    assert.equal(evidence.pesoBytes, image.length);
    assert.equal((await fetch(base + evidence.urlOriginal)).status, 401);
    assert.equal((await fetch(base + evidence.urlOriginal, { headers: { Authorization: 'Bearer ' + reception.token } })).status, 200);
    const persisted = new Client({ ...connection, database }); await persisted.connect();
    const rows = await persisted.query('SELECT r.id, r.vehiculo_id, v.cliente_id FROM recepciones r JOIN vehiculos v ON v.id=r.vehiculo_id WHERE r.id=$1', [withPhoto.id]);
    assert.equal(rows.rows[0].cliente_id, client.id); await persisted.end();
    check('Evidencias vinculadas, archivos privados, persistencia en conexión independiente y rollback de recepción si falla evidencia');
    assert.equal((await request('GET', operations['UC-16'].route, undefined, reception.token)).status, 404);
    const pending = spec.operations.find(op => op.type === 'BUSINESS_LOGIC' && !op.steps?.length && !op.targetEntity && op.authorizedRoles?.length);
    if (pending) assert.equal((await request('POST', pending.route, {}, accounts[pending.authorizedRoles[0]].token)).status, 501);
    check('GET no ejecuta escrituras; operaciones no implementadas devuelven 501');
    const browsersDir = path.join(root, '.verification/browsers');
    if (fs.existsSync(browsersDir)) {
      process.env.PLAYWRIGHT_BROWSERS_PATH = browsersDir;
    }
    const { chromium } = require(path.join(root, 'frontend/node_modules/@playwright/test'));
    frontendServer = await preview({ root: path.join(directory, 'frontend'), configFile: false, preview: { host: '127.0.0.1', port: 5199, strictPort: true, proxy: { '/api': { target: base } } } });
    browser = await chromium.launch({ headless: true });
    for (const [name, width, height] of [['desktop', 1440, 900], ['mobile', 390, 844]]) {
      const page = await browser.newPage({ viewport: { width, height } });
      currentPage = page;
      page.on('pageerror', error => console.error('Browser runtime:', error.message));
      await page.goto('http://127.0.0.1:5199');
      await page.locator('input[type=text]').fill(reception.email);
      await page.locator('input[type=password]').fill(password);
      await page.getByRole('button', { name: /Iniciar Sesión/i }).click();
      await page.getByRole('heading', { name: 'Clientes', exact: true }).waitFor();
      const clientName = 'PRUEBA navegador ' + name;
      await page.locator('#nombre').fill(clientName);
      await page.getByRole('button', { name: 'Guardar cliente', exact: true }).click();
      await page.getByRole('status').filter({ hasText: 'Operación completada' }).waitFor();
      const screenshot = async stage => {
        const filename = path.join(directory, name + '-' + stage + '.png');
        await page.evaluate(() => { window.scrollTo(0, 0); });
        await page.screenshot({ path: filename, fullPage: true }); report.screenshots.push(filename);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, name + '/' + stage + ': horizontal overflow');
      };
      await screenshot('cliente');
      if (name === 'mobile') {
        await page.getByRole('button', { name: 'Abrir navegación' }).click();
        await page.getByRole('navigation', { name: 'Tareas', exact: true }).getByRole('button', { name: 'Vehículos', exact: true }).click();
        assert.equal(await page.getByRole('button', { name: 'Abrir navegación' }).getAttribute('aria-expanded'), 'false');
      } else await page.getByRole('button', { name: 'Ir a vehículos', exact: true }).click();
      await page.getByRole('heading', { name: 'Vehículos', exact: true }).waitFor();
      await page.locator('#clienteId').selectOption({ label: clientName });
      const plate = 'BROWSER-' + name;
      await page.locator('#placa').fill(plate);
      await page.getByRole('button', { name: 'Guardar vehículo', exact: true }).click();
      await page.getByRole('status').filter({ hasText: 'Operación completada' }).waitFor();
      await screenshot('vehiculo');
      await page.getByRole('button', { name: 'Ir a recepción de vehículos', exact: true }).click();
      await page.getByRole('heading', { name: 'Recepción de vehículos', exact: true }).waitFor();
      await page.locator('#clienteId').selectOption({ label: clientName });
      await page.locator('#vehiculoId').selectOption({ label: plate });
      await page.locator('#kilometraje').fill('17');
      await page.locator('#nivelCombustible').selectOption('0.25');
      await page.locator('#motivoIngreso').fill('PRUEBA recepción ' + name);
      assert.equal(await page.locator('input#id, input#usuarioId, input#fechaRecepcion').count(), 0);
      await page.locator('#evidencias').setInputFiles({ name: 'prueba.png', mimeType: 'image/png', buffer: image });
      const beforeFailure = await models.RECEPCION.count();
      let intakePosts = 0;
      page.on('request', request => { if (request.method() === 'POST' && request.url().endsWith(operations['UC-16'].route)) intakePosts++; });
      await page.route('**/api/upload', route => route.fulfill({ status: 503, json: { message: 'PRUEBA carga fallida' } }));
      await page.getByRole('button', { name: 'Confirmar recepción', exact: true }).click();
      await page.getByRole('alert').filter({ hasText: 'PRUEBA carga fallida' }).waitFor();
      assert.equal(await models.RECEPCION.count(), beforeFailure);
      assert.equal(intakePosts, 0);
      await page.unroute('**/api/upload');
      await page.getByRole('button', { name: 'Confirmar recepción', exact: true }).click();
      await page.getByRole('status').filter({ hasText: 'Operación completada' }).waitFor();
      assert.equal(intakePosts, 1);
      await page.getByRole('row').filter({ hasText: 'PRUEBA recepción ' + name }).getByRole('button', { name: 'Ver fotografía 1' }).click();
      await page.getByRole('dialog', { name: 'Fotografía de recepción' }).waitFor();
      await page.getByRole('dialog').locator('img').evaluate(img => img.decode());
      await page.getByRole('button', { name: 'Cerrar fotografía' }).click();
      await screenshot('recepcion');
      await page.reload();
      await page.getByRole('button', { name: 'Ir a recepción de vehículos', exact: true }).click();
      await page.getByText('PRUEBA recepción ' + name, { exact: true }).waitFor();
      const browserVehicle = await models.VEHICULO.findOne({ where: { placa: plate } });
      assert.equal(browserVehicle.kilometrajeActual, null);
      await page.close();
      check('Navegador ' + name + ': flujo completo real, fallo de foto sin confirmar, reintento y persistencia tras recarga');
    }
    report.database = database;
    report.passed = true;
  } catch (error) {
    report.error = error.message;
    if (currentPage && !currentPage.isClosed()) await currentPage.screenshot({ path: path.join(directory, 'failure.png'), fullPage: true });
    throw error;
  } finally {
    fs.writeFileSync(path.join(directory, 'acceptance-results.json'), JSON.stringify(report, null, 2));
    await browser?.close();
    if (frontendServer) await new Promise(resolve => frontendServer.httpServer.close(resolve));
    if (apiServer) await new Promise(resolve => apiServer.close(resolve));
    await models?.sequelize.close();
    await migrationDb.close();
  }
  console.log('Evidence: ' + path.join(directory, 'acceptance-results.json'));
}

run().catch(error => { console.error(error); process.exitCode = 1; });
