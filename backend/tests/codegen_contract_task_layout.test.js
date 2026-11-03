const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { convertHtmlToJsx } = require('../src/services/codegen/mockupConverter');
const { generateContractTask } = require('../src/services/codegen/contractTaskGenerator');

describe('Contract task layout does not close over formData', () => {
  const html = `
    <main>
      <h1>Recepción</h1>
      <section data-contract-slot="form">
        <form>
          <input type="text" id="placa" name="placa" value="ABC-123" />
          <button type="submit">Guardar</button>
        </form>
      </section>
      <section data-contract-slot="table">
        <table><tbody><tr><td>demo</td></tr></tbody></table>
      </section>
    </main>
  `;
  const screen = {
    name: 'Recepcion',
    contract: {
      renderer: 'task',
      purpose: 'Recepción',
      fields: [{ fieldName: 'placa', mode: 'editable' }],
      actions: [{ actionId: 'receive', operationId: 'receive', method: 'POST', route: '/api/operations/receive' }],
      navigation: []
    }
  };

  test('task conversion does not bind mockup inputs to formData', () => {
    const jsx = convertHtmlToJsx(html, 'RecepcionMockup', '/recepcion', 'Vehiculo', { screenContract: screen.contract });
    assert.ok(!jsx.includes('formData'), 'El layout visual no debe referenciar formData');
    assert.ok(!jsx.includes('handleInputChange'));
    assert.ok(!jsx.includes('handleSubmit'));
    assert.ok(!jsx.includes('dataLoading'));
  });

  test('generated page wires mockup controls to ContractTask slots', () => {
    const jsx = convertHtmlToJsx(html, 'RecepcionMockup', '/recepcion', 'Vehiculo', { screenContract: screen.contract });
    const page = generateContractTask('RecepcionMockup', screen, jsx, []);
    assert.ok(page.includes('layout={slots =>'));
    assert.ok(jsx.includes('slots.setField'));
    assert.ok(jsx.includes('slots.submit'));
    assert.ok(jsx.includes('slots.rows'));
    assert.ok(page.includes('mockup-screen'), 'Debe conservar el HTML del mockup como layout');
    assert.ok(page.includes('Recepción') || jsx.includes('Recepción'));
    assert.ok(!page.includes('formData'));
    assert.ok(!page.includes('handleInputChange'));
    assert.ok(!page.includes('mockup-live-panel'));
  });

  test('mockup without slot sections still binds the live form', () => {
    const jsx = convertHtmlToJsx(
      '<main><form><input name="placa" /></form><table><tbody><tr><td>x</td></tr></tbody></table></main>',
      'RecepcionMockup',
      '/recepcion',
      'Vehiculo',
      { screenContract: screen.contract }
    );
    const page = generateContractTask('RecepcionMockup', screen, jsx, []);
    assert.ok(jsx.includes('slots.setField("placa"') || jsx.includes("slots.setField('placa'") || jsx.includes('slots.setField("placa"') || jsx.includes('setField("placa"') || /slots\.setField\(\s*"placa"/.test(jsx));
    assert.ok(jsx.includes('slots.submit'));
    assert.ok(jsx.includes('slots.rows'));
    assert.ok(!page.includes('formData'));
  });
});
