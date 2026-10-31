/**
 * Mockup Wiring and Dynamic JSX Generator Test Suite
 * Tests parsing, normalization, dynamic table mapping, controlled inputs, and action buttons.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const {
  normalizeHtmlControls,
  synthesizeMockupBindings
} = require('../src/services/codegen/aiMockupSynthesizer');
const {
  convertHtmlToJsx,
  generateInteractiveMockupComponent
} = require('../src/services/codegen/mockupConverter');

describe('Mockup Wiring & Dynamic Component Tests', () => {
  const sampleStitchHtml = `
    <main class="container mx-auto p-6">
      <h1 class="text-2xl font-bold mb-4">Gestión de Libros</h1>
      <form id="form-libro" class="mb-6 bg-white p-4 rounded shadow">
        <div class="mb-4">
          <label for="titulo">Título del Libro</label>
          <input type="text" id="titulo" name="titulo" placeholder="Ingrese el título" class="border p-2 w-full" />
        </div>
        <div class="mb-4">
          <label for="isbn">Código ISBN</label>
          <input type="text" id="isbn" name="isbn" placeholder="978-..." class="border p-2 w-full" />
        </div>
        <button type="submit" id="btn-guardar" class="bg-blue-600 text-white px-4 py-2 rounded">
          Guardar Libro
        </button>
      </form>

      <table id="tabla-libros" class="min-w-full bg-white border">
        <thead>
          <tr>
            <th>ID</th>
            <th>Título</th>
            <th>ISBN</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>1</td>
            <td>Don Quijote (Mock Estático)</td>
            <td>978-012345</td>
            <td><button class="text-red-600">Eliminar</button></td>
          </tr>
          <tr>
            <td>2</td>
            <td>Cien Años de Soledad (Mock Estático)</td>
            <td>978-067890</td>
            <td><button class="text-red-600">Eliminar</button></td>
          </tr>
        </tbody>
      </table>
    </main>
  `;

  test('Normalizes HTML controls: finds table headers, form inputs and action buttons', () => {
    const { tables, forms, buttons } = normalizeHtmlControls(sampleStitchHtml);

    assert.strictEqual(tables.length, 1);
    assert.strictEqual(tables[0].columns.length, 4);
    assert.strictEqual(tables[0].columns[1].header, 'Título');

    assert.strictEqual(forms.length, 1);
    assert.strictEqual(forms[0].fields.length, 2);
    assert.strictEqual(forms[0].fields[0].inputName, 'titulo');

    assert.ok(buttons.length >= 1);
    assert.ok(buttons.some(b => b.label.includes('Guardar')));
  });

  test('Synthesizes valid mockup bindings matching API operations', () => {
    const screen = {
      id: 'scr_libros',
      name: 'LibrosPage',
      route: '/libros',
      title: 'Catálogo de Libros',
      html: sampleStitchHtml
    };

    const catalog = {
      entities: [
        {
          modelName: 'Libro',
          tableName: 'libros',
          attributes: [
            { fieldName: 'id', type: 'integer', isPk: true },
            { fieldName: 'titulo', type: 'string' },
            { fieldName: 'isbn', type: 'string' }
          ]
        }
      ],
      operations: [
        { operationId: 'op_libros_list', method: 'GET', route: '/api/libros', entity: 'Libro' },
        { operationId: 'op_libros_create', method: 'POST', route: '/api/libros', entity: 'Libro' },
        { operationId: 'op_libros_delete', method: 'DELETE', route: '/api/libros/:id', entity: 'Libro' }
      ],
      roles: ['Administrador', 'Bibliotecario']
    };

    const res = synthesizeMockupBindings('proj_test', screen, catalog);
    assert.strictEqual(res.valid, true, `Errores: ${res.validationErrors.join(', ')}`);
    assert.strictEqual(res.proposal.dataSources.length, 1);
    assert.strictEqual(res.proposal.dataSources[0].endpoint, '/api/libros');
    assert.strictEqual(res.proposal.tableBindings[0].columns.length, 3); // ID, Título and ISBN
  });

  test('convertHtmlToJsx replaces static dummy tbody rows with dynamic dataList.map', () => {
    const converted = convertHtmlToJsx(sampleStitchHtml, 'LibrosMockup', '/libros', 'Libro');

    // Static dummy text must NOT be present
    assert.ok(!converted.includes('Don Quijote (Mock Estático)'), 'No debe contener filas estáticas');
    assert.ok(!converted.includes('Cien Años de Soledad (Mock Estático)'), 'No debe contener filas estáticas');

    // Dynamic React mapping must be present
    assert.ok(converted.includes('dataList.map'), 'Debe mapear dinámicamente dataList');
    assert.ok(converted.includes('dataLoading'), 'Debe incluir estado de carga');
    assert.ok(converted.includes('No hay registros disponibles'), 'Debe incluir estado vacío');
  });

  test('generateInteractiveMockupComponent generates functional component with loadData and real endpoints', () => {
    const screen = {
      name: 'LibrosPage',
      route: '/libros',
      title: 'Libros'
    };
    const matchingOp = {
      name: 'Listar Libros',
      operationId: 'op_libros_list',
      method: 'GET',
      route: '/api/libros'
    };

    const convertedJsx = convertHtmlToJsx(sampleStitchHtml, 'LibrosMockup', '/libros', 'Libro');
    const compCode = generateInteractiveMockupComponent('LibrosMockup', screen, convertedJsx, matchingOp, []);

    // Verify non-empty loadData
    assert.ok(compCode.includes("apiClient.get('/api/libros')"), 'loadData debe llamar al endpoint real');
    assert.ok(compCode.includes('setDataList'), 'loadData debe actualizar el estado');
    assert.ok(compCode.includes('executeRowDelete'), 'Debe incluir handler de eliminación de fila');
    assert.ok(compCode.includes('handleSubmit'), 'Debe incluir handler de envío de formulario');
  });

  test('convertHtmlToJsx correctly handles self-closing inputs without stray slashes before value/onChange', () => {
    const htmlWithSelfClosing = '<input className="w-full h-11 px-3.5" id="username" name="username" placeholder="ejemplo@autron.com" required="" type="text"/>';
    const converted = convertHtmlToJsx(htmlWithSelfClosing, 'LoginMockup', '/login', 'Usuario');
    assert.ok(!converted.includes('/ value='), 'No debe contener slash antes de value=');
    assert.ok(converted.includes("value={formData['username']"), 'Debe contener value bind');
    assert.ok(converted.includes('onChange={handleInputChange}'), 'Debe contener onChange bind');
    assert.ok(converted.endsWith('/>') || converted.endsWith('/>\n'), 'Debe terminar con cierre válido />');
  });
});
