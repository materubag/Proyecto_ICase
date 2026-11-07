// Local manual review of the exact exported tree. Never connects to iCASE/AUTRON production databases.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const assert = require('node:assert/strict');
const { createRequire } = require('module');
const { pathToFileURL } = require('url');
const root = path.resolve(__dirname, '../..');
async function run() {
  const meta = JSON.parse(fs.readFileSync(path.join(root, '.verification/autron5-last-export.json')));
  const report = JSON.parse(fs.readFileSync(path.join(meta.directory, 'acceptance-results.json')));
  assert.equal(report.passed, true);
  assert.equal(report.browserPassed, true);
  assert.match(report.database, /^autron5_acceptance_[a-f0-9]+$/);
  const integrity = require('../src/services/codegen/exportIntegrity');
  assert.equal(integrity.fingerprint(integrity.snapshotFiles(meta.directory, report.testedFiles.map(f => f.path))), report.testedSourceHash);
  Object.assign(process.env, { DB_HOST: '127.0.0.1', DB_PORT: '55439', DB_NAME: report.database,
    DB_USER: 'icase_user', DB_PASSWORD: 'icase_password', AUTO_SYNC_DB: 'false', JWT_SECRET: crypto.randomBytes(32).toString('hex') });
  const requireExport = createRequire(path.join(meta.directory, 'backend/package.json'));
  const models = requireExport(path.join(meta.directory, 'backend/src/models'));
  const bcrypt = requireExport('bcryptjs');
  const spec = JSON.parse(fs.readFileSync(path.join(meta.directory, 'icase.spec.json')));
  const credentials = [];
  for (const [label, email, owner] of [
    ['Recepción', 'review-recepcion@autron.test', null],
    ['Cliente A', 'review-cliente-a@autron.test', 'OWNER-A'],
    ['Cliente B', 'review-cliente-b@autron.test', 'OWNER-B']
  ]) {
    const roleName = owner ? 'Cliente' : spec.security.roles.find(name => /recepci/i.test(name));
    assert.ok(roleName);
    const role = await models.ROL.findOne({ where: { nombre: roleName } }); assert.ok(role);
    const password = crypto.randomBytes(12).toString('base64url');
    const fields = { correo: email, nombre: 'PRUEBA MANUAL ' + label, rolId: role.id, activo: true, passwordHash: await bcrypt.hash(password, 12) };
    let user = await models.USUARIO.findOne({ where: { correo: email } });
    if (user) await user.update(fields); else user = await models.USUARIO.create(fields);
    if (owner) {
      const client = await models.CLIENTE.findOne({ where: { nombre: owner } }); assert.ok(client);
      await client.update({ usuarioId: user.id });
    }
    credentials.push({ label, email, password });
  }
  const express = requireExport('express');
  const app = express(); app.use(express.json()); app.use('/api', requireExport(path.join(meta.directory, 'backend/src/routes')));
  app.use((error, req, res, next) => res.status(error.statusCode || 500).json({ success: false, message: error.message }));
  const apiServer = await new Promise((resolve, reject) => { const server = app.listen(18085, '127.0.0.1', () => resolve(server)); server.once('error', reject); });
  const { preview } = await import(pathToFileURL(path.join(meta.directory, 'frontend/node_modules/vite/dist/node/index.js')).href);
  const frontend = await preview({ root: path.join(meta.directory, 'frontend'), configFile: false, preview: { host: '127.0.0.1', port: 15199, strictPort: true, proxy: { '/api': { target: 'http://127.0.0.1:18085' } } } });
  const access = { url: 'http://127.0.0.1:15199', api: 'http://127.0.0.1:18085', database: report.database, databasePort: 55439,
    scope: 'Revisión local con datos de prueba; ready=false. Las órdenes son fixtures.', credentials, pid: process.pid, directory: meta.directory };
  fs.writeFileSync(path.join(root, '.verification/autron-review-access.json'), JSON.stringify(access, null, 2));
  console.log('AUTRON review available: ' + access.url + '; access file: .verification/autron-review-access.json');
  const stop = async () => { await new Promise(resolve => frontend.httpServer.close(resolve)); await new Promise(resolve => apiServer.close(resolve)); await models.sequelize.close(); process.exit(0); };
  process.once('SIGTERM', stop); process.once('SIGINT', stop);
}
run().catch(error => { console.error(error.message); process.exit(1); });
