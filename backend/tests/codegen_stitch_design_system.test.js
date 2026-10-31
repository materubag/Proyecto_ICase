const test = require('node:test');
const assert = require('node:assert/strict');
const designSystemService = require('../src/services/mockup/designSystemService');
const googleStitchService = require('../src/services/mockup/GoogleStitchService');
const frontendGen = require('../src/services/codegen/reactFrontendGenerator');
const { convertHtmlToJsx, generateInteractiveMockupComponent } = require('../src/services/codegen/mockupConverter');

test('Stitch & Design System: Loads DESIGN_SYSTEM.md and produces domain-agnostic prompt context', () => {
  const content = designSystemService.getDesignSystemContent();
  assert.ok(content.length > 50, 'DESIGN_SYSTEM.md must be loaded');

  const tokens = designSystemService.getCssTokens();
  assert.equal(tokens['--color-primary'].toLowerCase(), '#4f46e5');
  assert.equal(tokens['--color-surface'].toLowerCase(), '#ffffff');
  assert.equal(tokens['--radius-lg'], '16px');

  const meta = designSystemService.getDesignSystemMetadata();
  assert.equal(meta.available, true);
  assert.ok(meta.hash && meta.hash.length === 64, 'Must compute SHA-256 hash of DESIGN_SYSTEM.md');
  assert.ok(meta.version, 'Must extract design system version');

  const prompt = designSystemService.getStitchPromptContext('Librería Central', 'Gestión de préstamos bibliotecarios');
  assert.ok(prompt.includes('Librería Central'), 'Prompt must use dynamic project name');
  assert.ok(prompt.includes('Gestión de préstamos'), 'Prompt must use dynamic project domain');
  assert.equal(prompt.includes('automotriz'), false, 'Must not inject automotive domain into library project');
  assert.ok(prompt.includes('#4F46E5'), 'Must enforce primary color token');
});

test('Stitch & Design System: GoogleStitchService incorporates design system rules into screen prompt', () => {
  const screen = { name: 'Catálogo de Libros', route: '/libros', actors: ['Bibliotecario'] };
  const project = { name: 'Biblioteca Nacional', description: 'Sistema bibliotecario' };

  const prompt = googleStitchService.buildScreenPrompt(screen, project, 1, 1);
  assert.ok(prompt.includes('Biblioteca Nacional'));
  assert.ok(prompt.includes('Catálogo de Libros'));
  assert.ok(prompt.includes('SISTEMA DE DISEÑO OFICIAL OBLIGATORIO'));
  assert.equal(prompt.includes('automotriz'), false, 'Prompt must be domain agnostic');

  const caps = googleStitchService.getCapabilities();
  assert.ok(caps.provider.includes('Google Stitch'));
  assert.ok(Array.isArray(caps.limitations), 'Must report Stitch limits transparently');
});

test('Stitch & Design System: Generates AppShell and shared UI components', () => {
  const appShellCode = frontendGen.generateAppShellComponent();
  assert.ok(appShellCode.includes('export default function AppShell'));
  assert.ok(appShellCode.includes('var(--color-bg-app)'));

  const formFieldCode = frontendGen.generateSharedFormFieldComponent();
  assert.ok(formFieldCode.includes('export default function FormField'));
  assert.ok(formFieldCode.includes('var(--radius-md)'));

  const buttonCode = frontendGen.generateSharedButtonComponent();
  assert.ok(buttonCode.includes('export default function Button'));
  assert.ok(buttonCode.includes('var(--color-primary)'));

  const badgeCode = frontendGen.generateSharedStatusBadgeComponent();
  assert.ok(badgeCode.includes('export default function StatusBadge'));
});

test('Stitch & Design System: Converts mockups into interactive React components connected to real operations', () => {
  const html = `
    <main class="login-card">
      <h2>Iniciar Sesión</h2>
      <form>
        <input type="text" name="username" class="form-control">
        <input type="password" name="password">
        <button type="submit" class="btn btn-primary">Ingresar</button>
      </form>
    </main>
  `;

  const convertedJsx = convertHtmlToJsx(html, 'LoginMockup', '/login');
  assert.ok(convertedJsx.includes('className="login-card"'));
  assert.ok(convertedJsx.includes('type="text" name="username" className="form-control" />'));

  const interactiveCode = generateInteractiveMockupComponent('LoginMockup', { name: 'Login', route: '/login' }, convertedJsx, { route: '/api/auth/login' });
  assert.ok(interactiveCode.includes('apiClient.post'));
  assert.ok(interactiveCode.includes('/api/auth/login'));
  assert.ok(interactiveCode.includes('handleInputChange'));
  assert.ok(interactiveCode.includes('handleSubmit'));
  assert.ok(interactiveCode.includes('resultMessage'));
  assert.ok(interactiveCode.includes('errorMessage'));

  // Test unlinked screen
  const unlinkedCode = generateInteractiveMockupComponent('DashboardMockup', { name: 'Dashboard', route: '/dashboard' }, '<div>Dashboard</div>', null);
  assert.ok(unlinkedCode.includes('Incompleto: Sin operación vinculada'));
});
