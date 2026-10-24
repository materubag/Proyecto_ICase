const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { convertHtmlToJsx } = require('../src/services/codegen/mockupConverter');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

async function testViteCompilation() {
  const artifacts = await prisma.artifact.findMany({
    where: { projectId: 'a40f13c9-3b2c-435b-90a9-90a4f5dfea66', type: 'MOCKUP' },
    include: { versions: { orderBy: { version: 'desc' }, take: 1 } }
  });

  const testDir = path.join('/tmp', 'vite_test_app');
  if (fs.existsSync(testDir)) fs.rmSync(testDir, { recursive: true, force: true });
  fs.mkdirSync(path.join(testDir, 'src', 'pages'), { recursive: true });

  console.log(`Converting ${artifacts.length} mockups to test components...`);
  const pageImports = [];
  const pageSwitches = [];

  for (const a of artifacts) {
    const v = a.versions[0];
    const s = v?.structuredContent?.screen;
    const html = v?.renderedContent;
    if (!html || !s?.route) continue;

    const safeName = s.route.replace(/^\//, '').replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    const pascal = safeName ? safeName.charAt(0).toUpperCase() + safeName.slice(1) : 'Home';
    const componentName = `${pascal}Page`;

    const jsx = convertHtmlToJsx(html, s.name, s.route);

    const compContent = `import React, { useState } from 'react';

export default function ${componentName}({ onLogin }) {
  return (
    <div className="w-full">
      ${jsx}
    </div>
  );
}
`;
    fs.writeFileSync(path.join(testDir, 'src', 'pages', `${componentName}.jsx`), compContent, 'utf8');
    pageImports.push(`import ${componentName} from './pages/${componentName}';`);
    pageSwitches.push(`        {tab === '${safeName}' && <${componentName} />}`);
  }

  // App.jsx
  const appJsx = `import React, { useState } from 'react';
${pageImports.join('\n')}

export default function App() {
  const [tab, setTab] = useState('recepcion');
  return (
    <div className="min-h-screen bg-background">
${pageSwitches.join('\n')}
    </div>
  );
}
`;
  fs.writeFileSync(path.join(testDir, 'src', 'App.jsx'), appJsx, 'utf8');

  // main.jsx
  fs.writeFileSync(path.join(testDir, 'src', 'main.jsx'), `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
`, 'utf8');

  // index.html
  fs.writeFileSync(path.join(testDir, 'index.html'), `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Test App</title>
  <script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/main.jsx"></script>
</body>
</html>
`, 'utf8');

  // vite.config.js
  fs.writeFileSync(path.join(testDir, 'vite.config.js'), `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()]
});
`, 'utf8');

  // package.json
  fs.writeFileSync(path.join(testDir, 'package.json'), JSON.stringify({
    name: 'test-vite-app',
    version: '1.0.0',
    type: 'module',
    scripts: { build: 'vite build' },
    dependencies: { react: '^18.3.1', 'react-dom': '^18.3.1' },
    devDependencies: { '@vitejs/plugin-react': '^4.3.1', vite: '^5.4.2' }
  }, null, 2), 'utf8');

  console.log('Running npm install & vite build on all 18 converted mockups...');
  execSync('npm install', { cwd: testDir, stdio: 'inherit' });
  execSync('npm run build', { cwd: testDir, stdio: 'inherit' });
  console.log('SUCCESS: All 18 converted mockups built cleanly with Vite!');
}

testViteCompilation().finally(() => prisma.$disconnect());
