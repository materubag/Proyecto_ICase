import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const output = fileURLToPath(new URL('../../docs/assets/screenshots/', import.meta.url));
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge', headless: true });
let server;
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  // All UI API traffic is intercepted: no database, user data or model calls.
  await page.route(url => url.pathname.startsWith('/api/'), route => route.fulfill({ status: 200, contentType: 'application/json',
    body: JSON.stringify({ success: true, data: [] }) }));
  await page.goto(process.env.DOCS_FRONTEND_URL || 'http://127.0.0.1:4175', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /Nuevo proyecto/i }).waitFor();
  await page.screenshot({ path: output + 'projects.png', fullPage: true });
  await page.getByRole('button', { name: /Nuevo proyecto/i }).click();
  await page.getByRole('button', { name: 'Crear Proyecto', exact: true }).waitFor();
  await page.screenshot({ path: output + 'new-project.png', fullPage: true });
  const app = require('../../backend/src/app');
  server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const swagger = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await swagger.goto(`http://127.0.0.1:${server.address().port}/api/docs/`, { waitUntil: 'networkidle' });
  await swagger.locator('.swagger-ui .info .title').waitFor();
  await swagger.screenshot({ path: output + 'swagger.png' });
  console.log('Capturas de UI y Swagger guardadas; sin escritura en base de datos ni llamadas a IA.');
} finally {
  await browser.close();
  if (server) await new Promise(resolve => server.close(resolve));
}
