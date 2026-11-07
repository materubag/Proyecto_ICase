/**
 * Codegen AI Synthesis & JSX Validator Test Suite
 * Verifies that JSX syntax validation, self-repair of read-only inputs,
 * file/image upload integration, and numeric adjusters are fully functional.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert');

const { validateAndRepairJsx } = require('../src/services/codegen/jsxValidator');
const { convertHtmlToJsx, generateInteractiveMockupComponent } = require('../src/services/codegen/mockupConverter');
const { generateUploadMiddlewareFile, generateUploadRoutesFile, generateMasterRoutesIndexFile } = require('../src/services/codegen/routeGenerator');

describe('Codegen AI Synthesis & JSX Validator Suite', () => {

  test('JSX Validator: Repairs broken arrow functions and malformed void tags', () => {
    const brokenCode = `
      export default function Test() {
        return (
          <div>
            <input type="text" onChange={(e) = />}
            <img src="test.jpg">
            <br>
            <input type="text" name="telefono" value="123456" />
          </div>
        );
      }
    `;

    const result = validateAndRepairJsx(brokenCode);
    assert.strictEqual(result.repaired, true);
    assert.ok(result.repairedJsx.includes('(e) => handleSearchChange(e)'));
    assert.ok(result.repairedJsx.includes('<img src="test.jpg" />'));
    assert.ok(result.repairedJsx.includes('<br />'));
    // Read-only input with static value receives onChange handler
    assert.ok(result.repairedJsx.includes('onChange={handleInputChange}'));
  });

  test('JSX Validator: Flags unclosed tags and self-heals root containers', () => {
    const unclosedCode = `
      export default function Test() {
        return (
          <div>
            <p>Texto sin cerrar
          </div>
        );
      }
    `;

    const result = validateAndRepairJsx(unclosedCode);
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('<p>')));
  });

  test('Mockup Converter: Binds inputs with prefilled static values to reactive controlled state', () => {
    const stitchHtml = `
      <form class="space-y-4">
        <label>Kilometraje Actual</label>
        <input type="text" name="kilometraje" value="48,250" class="border p-2">
        <label>Foto Evidencia</label>
        <input type="file" name="foto_inspeccion" class="border">
        <button type="button" class="btn">+100 km</button>
      </form>
    `;

    const convertedJsx = convertHtmlToJsx(stitchHtml, 'InspeccionMockup', '/inspeccion', 'Inspeccion');
    
    // Static value "48,250" must NOT be read-only; it must have value fallback and onChange
    assert.ok(convertedJsx.includes("formData['kilometraje'] !== undefined ? formData['kilometraje'] : '48,250'"));
    assert.ok(convertedJsx.includes('onChange={handleInputChange}'));

    // File input receives handleFileSelect
    assert.ok(convertedJsx.includes('onChange={handleFileSelect}'));

    // Increment button receives handleIncrementValue
    assert.ok(convertedJsx.includes("handleIncrementValue('kilometraje', 100)"));
  });

  test('Upload Infrastructure: Generates Multer middleware and upload route', () => {
    const middlewareCode = generateUploadMiddlewareFile();
    assert.ok(middlewareCode.includes('multer.diskStorage'));
    assert.ok(middlewareCode.includes('uploadsDir'));
    assert.ok(middlewareCode.includes('module.exports = { upload }'));

    const routeCode = generateUploadRoutesFile();
    assert.ok(routeCode.includes("upload.single('file')"));
    assert.ok(routeCode.includes("url: fileUrl"));

    const masterIndex = generateMasterRoutesIndexFile([{ name: 'Vehiculo' }], { hasAuth: true });
    assert.ok(masterIndex.includes("router.use('/upload', uploadRoutes)"));
  });

  test('Mockup Converter: Generates complete interactive component with file upload handler', () => {
    const componentCode = generateInteractiveMockupComponent(
      'VehiculoMockup',
      { name: 'Vehiculos', route: '/vehiculos', title: 'Gestión de Vehículos' },
      '<div>Mockup Content</div>',
      { route: '/api/vehiculos', method: 'GET' },
      [],
      { name: 'Vehiculo', attributes: [{ name: 'placa', type: 'STRING' }, { name: 'foto_url', type: 'STRING' }] }
    );

    assert.ok(componentCode.includes('handleFileSelect'));
    assert.ok(componentCode.includes('/api/upload'));
    assert.ok(componentCode.includes('handleIncrementValue'));
    assert.ok(componentCode.includes('apiClient.post'));
    assert.ok(componentCode.includes('apiClient.delete'));
    assert.ok(componentCode.includes('apiClient.put'));
  });

});

