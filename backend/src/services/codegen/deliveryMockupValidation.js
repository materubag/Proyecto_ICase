const fs = require('node:fs');
const path = require('node:path');
const p = require('./deliveryPolicy');
async function inspectMockup(screen, html, browserAdapter) {
  if (!html || !/<(?:html|main|body)[\s>]/i.test(html)) return { errors: ['HTML ausente o inválido'], rendered: false };
  const playwright = browserAdapter || require('playwright-core');
  const browser = await playwright.chromium.launch({ headless: true, ...(process.env.CODEGEN_CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.CODEGEN_CHROMIUM_EXECUTABLE_PATH } : {}) });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, serviceWorkers: 'block' });
    // HTML from a provider cannot request iCASE credentials or internal APIs.
    await context.route('**/*', route => route.abort());
    const page = await context.newPage(); await page.setContent(html, { waitUntil: 'domcontentloaded' });
    const controls = await page.locator('input,select,textarea,button,a').evaluateAll(nodes => nodes.map(node => ({ tag: node.tagName.toLowerCase(),
      label: node.labels?.[0]?.textContent?.trim() || node.getAttribute('aria-label') || node.getAttribute('placeholder') || node.textContent?.trim(),
      name: node.getAttribute('name') || node.id, href: node.getAttribute('href'), type: node.getAttribute('type') })));
    const norm = text => String(text || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
    const errors = [], correspondence = [], expected = [...(screen.fields || []).map(f => ({ id: f.id, label: f.label, kind: 'field' })), ...(screen.actions || []).map(a => ({ id: a.id, label: a.label, kind: 'action' }))];
    for (const item of expected) {
      const found = controls.some(c => norm(c.name) === norm(item.id) || norm(c.label).includes(norm(item.label)));
      correspondence.push({ ...item, present: found }); if (!found) errors.push('Control aprobado ausente: ' + item.label);
    }
    const unmatched = controls.filter(c => !['hidden', 'submit'].includes(c.type) && !expected.some(e => norm(c.name) === norm(e.id) || norm(c.label).includes(norm(e.label))) &&
      !(screen.navigation || []).some(n => c.href === n.route || c.name === n.screenId));
    if (unmatched.length) errors.push('Controles sin correspondencia: ' + unmatched.map(c => c.label || c.name || c.tag).join(', '));
    const directory = path.resolve(process.cwd().endsWith('backend') ? process.cwd() : path.join(process.cwd(), 'backend'), '.cache/implementation/rendered');
    fs.mkdirSync(directory, { recursive: true }); const screenshot = path.join(directory, p.hash([screen, html]) + '.png');
    await page.screenshot({ path: screenshot, fullPage: true });
    const body = await page.locator('body').innerText(); await context.close();
    return { errors, controls, correspondence, unmatched, rendered: true, screenshot, screenshotHash: p.hash(fs.readFileSync(screenshot).toString('base64')),
      renderText: body.slice(0, 10000), visualInspection: 'ICASE_RENDERED_DOM_ONLY',
      limitations: ['Los recursos externos se bloquearon durante la validación aislada.', 'La comparación DOM no acredita revisión visual Sonnet ni conexión con una API.'] };
  } finally { await browser.close(); }
}
module.exports = { inspectMockup };
