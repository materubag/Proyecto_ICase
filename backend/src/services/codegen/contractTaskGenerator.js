function generateContractTask(componentName, screen, jsx, navigation = []) {
  screen = { ...screen, contract: screen.contract || { purpose: screen.title || screen.name, fields: [], actions: [], unresolved: ['UNRESOLVED: pantalla sin contrato explícito.'] } };
  const contract = {
    ...screen.contract,
    navigation: (screen.contract.navigation || []).map(item => ({
      ...item,
      key: item.key || navigation.find(n => n.route === item.route)?.key || navigation.find(n => n.key === item.key)?.key
    }))
  };
  const title = JSON.stringify(screen.title || screen.name || contract.purpose || 'Tarea');
  const purpose = JSON.stringify(contract.purpose || '');
  const hasMockupLayout = Boolean(jsx && String(jsx).trim());
  const layout = hasMockupLayout
    ? `<div className="mockup-screen">${jsx}</div>`
    : `<div className="contract-task-grid">
      <section className="contract-panel">
        <h1>{${title}}</h1>
        <p className="contract-purpose">{${purpose}}</p>
        {slots.form}
      </section>
      {slots.table}
    </div>`;

  return `import React from 'react';
import ContractTask from '../../components/ContractTask';
const contract = ${JSON.stringify(contract, null, 2)};
export default function ${componentName}({ onNavigate }) {
  return <ContractTask contract={contract} onNavigate={onNavigate} layout={slots => (
    ${layout}
  )} />;
}
`;
}

module.exports = { generateContractTask };
