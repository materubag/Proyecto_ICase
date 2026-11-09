const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const parser = require('@apidevtools/swagger-parser');
const spec = require('../src/docs/openapi.json');

test('OpenAPI is valid and covers every mounted Express operation', async () => {
  await parser.validate(JSON.parse(JSON.stringify(spec)));
  // Backend-only Docker images do not include the root documentation portal.
  if (fs.existsSync(path.join(__dirname, '../../mkdocs.yml'))) {
    const portalSpec = JSON.parse(fs.readFileSync(path.join(__dirname, '../../docs/assets/swagger/openapi.json'), 'utf8'));
    assert.deepEqual(portalSpec, spec, 'Run npm run docs:sync to update the MkDocs contract');
  }
  const mounts = { project: '/projects', requirement: '/requirements', actor: '/actors',
    document: '/documents', useCase: '/use-cases', classModel: '/classes', screen: '/screens',
    file: '/files', versionHistory: '/history', source: '/sources', candidate: '/candidates',
    engineering: '/projects/:projectId/engineering' };
  const operations = new Set(['get /health']);
  for (const [file, prefix] of Object.entries(mounts)) {
    const source = fs.readFileSync(path.join(__dirname, '../src/routes', `${file}.routes.js`), 'utf8');
    for (const [, method, suffix] of source.matchAll(/router\.(get|post|put|patch|delete)\(\s*['"]([^'"]+)['"]/g)) {
      const url = (prefix + (suffix === '/' ? '' : suffix)).replace(/:([A-Za-z0-9_]+)/g, '{$1}');
      assert.ok(spec.paths[url]?.[method], `Missing ${method} ${url}`);
      operations.add(`${method} ${url}`);
    }
  }
  for (const [url, item] of Object.entries(spec.paths)) {
    for (const method of Object.keys(item)) assert.ok(operations.has(`${method} ${url}`), `Stale ${method} ${url}`);
  }
});

test('Swagger serves HTML and static assets without the JSON content type', async t => {
  const app = require('../src/app');
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  // Use node:http because the offline fixture intentionally disables global.fetch.
  const get = pathname => new Promise((resolve, reject) => {
    require('node:http').get({ host: '127.0.0.1', port: server.address().port, path: pathname }, res => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, type: res.headers['content-type'], body }));
    }).on('error', reject);
  });
  for (const [url, type] of [['/api/docs/', /text\/html/], ['/api/docs/swagger-ui.css', /text\/css/],
    ['/api/docs/swagger-ui-bundle.js', /javascript/], ['/api/openapi.json', /application\/json/]]) {
    const response = await get(url);
    assert.equal(response.status, 200, url);
    assert.match(response.type, type, url);
    if (url.endsWith('.json')) assert.deepEqual(JSON.parse(response.body), spec);
  }
  const health = await get('/api/health');
  assert.equal(JSON.parse(health.body).data.status, 'UP');
  const root = await get('/');
  assert.equal(JSON.parse(root.body).documentation, '/api/docs');
});
