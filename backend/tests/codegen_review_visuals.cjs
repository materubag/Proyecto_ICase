// Visual fixtures only; never counted as real API behavior acceptance.
const fs = require('fs'), path = require('path'), assert = require('node:assert/strict');
const { pathToFileURL } = require('url');
const root = path.resolve(__dirname, '../..');
const meta = JSON.parse(fs.readFileSync(path.join(root, '.verification/autron5-last-export.json')));
const spec = JSON.parse(fs.readFileSync(path.join(meta.directory, 'icase.spec.json')));
const { screenTabKey } = require('../src/services/codegen/screenContract');
const { sha256 } = require('../src/services/codegen/exportIntegrity');
process.env.PLAYWRIGHT_BROWSERS_PATH = path.join(root, '.verification/browsers');
const { chromium } = require(path.join(root, 'frontend/node_modules/@playwright/test'));
async function run() {
  const { preview } = await import(pathToFileURL(path.join(meta.directory, 'frontend/node_modules/vite/dist/node/index.js')).href);
  const server = await preview({ root: path.join(meta.directory, 'frontend'), configFile: false, preview: { host: '127.0.0.1', port: 5298, strictPort: true } });
  const browser = await chromium.launch({ headless: true });
  const report = { ready: false, behaviorAcceptance: false, data: 'Simulated empty GET responses. Source screenshots contain illustrative design data. No pixel equality certification.', screenshots: [], consoleErrors: [], comparisons: [], errors: [] };
  const assetDir = path.join(meta.directory, 'frontend/dist/assets');
  const css = fs.readdirSync(assetDir).filter(f => f.endsWith('.css')).map(f => fs.readFileSync(path.join(assetDir, f), 'utf8')).join('\n');
  try {
    for (const [device, width, height] of [['desktop',1440,900],['mobile',390,844]]) for (const screen of spec.screens.filter(s => s.html)) {
      const page = await browser.newPage({ viewport: { width, height } }); page.setDefaultTimeout(12000);
      page.on('pageerror', error => report.consoleErrors.push({ route: screen.route, device, message: error.message }));
      await page.route('**/api/**', route => route.fulfill({ status: 200, json: { success: true, data: [] } }));
      const isLogin = screen.route === '/login';
      const role = (screen.roles || []).find(r => spec.security.roles.includes(r)) || 'Administrador';
      if (!isLogin) await page.addInitScript(role => { localStorage.setItem('token', 'VISUAL_FIXTURE_ONLY'); localStorage.setItem('user', JSON.stringify({ nombre:'VISUAL FIXTURE', role })); }, role);
      try {
        await page.goto('http://127.0.0.1:5298');
        if (isLogin) await page.locator('#identifier').waitFor();
        else {
          if (width < 900) await page.getByRole('button', { name: /Abrir navegaci.n/, exact:true }).click();
          await page.locator('[data-screen-key="' + screenTabKey(screen) + '"]').click();
          await page.locator('.mockup-screen').waitFor();
        }
        await page.evaluate(() => document.fonts.ready); await page.evaluate(() => window.scrollTo(0,0));
        const key = screen.route.slice(1), generated = path.join(meta.directory, `${device}-${key}-generated.png`);
        await page.screenshot({ path:generated, fullPage:true }); report.screenshots.push(generated);
        const comparison = { route:screen.route, device, horizontalOverflow:await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), unresolvedControls:await page.locator('[data-unresolved-control]').count(), generated };
        const original = fs.readFileSync(path.join(meta.directory, 'mockups/original', screen.id + '.html'));
        assert.equal(sha256(original), sha256(Buffer.from(screen.html)), 'Original mockup must be byte-identical'); comparison.originalHtmlSha256 = sha256(original);
        const visual = require('../src/services/codegen/mockupVisualContract').extractVisualContract(screen.html);
        let source = screen.html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*')/gi,'');
        source = source.replace(/<head\b[^>]*>/i, `$&<style>${css}</style>`).replace(/<body\b([^>]*)>/i, `<body data-mockup-screen="${visual.id}" $1><div class="mockup-screen">`).replace(/<\/body>/i,'</div></body>');
        const reference = await browser.newPage({ viewport:{width,height} });
        try { await reference.setContent(source, { waitUntil:'domcontentloaded' }); await reference.evaluate(() => document.fonts.ready);
          const filename = path.join(meta.directory, `${device}-${key}-source.png`); await reference.screenshot({ path:filename, fullPage:true }); report.screenshots.push(filename); comparison.source = filename;
          comparison.sourceHorizontalOverflow = await reference.evaluate(() => document.documentElement.scrollWidth > innerWidth);
        } finally { await reference.close(); }
        report.comparisons.push(comparison); console.log('VISUAL '+device+' '+screen.route+' overflow='+comparison.horizontalOverflow);
      } catch(error) { report.errors.push({route:screen.route,device,message:error.message}); }
      finally { await page.close(); }
    }
  } finally { fs.writeFileSync(path.join(meta.directory,'visual-review-results.json'),JSON.stringify(report,null,2)); await browser.close(); await new Promise(resolve => server.httpServer.close(resolve)); }
  console.log(JSON.stringify({screenshots:report.screenshots.length,consoleErrors:report.consoleErrors.length,errors:report.errors,behaviorAcceptance:false}));
  if(report.errors.length || report.consoleErrors.length) process.exitCode=1;
}
run().catch(error=>{console.error(error.message);process.exitCode=1;});