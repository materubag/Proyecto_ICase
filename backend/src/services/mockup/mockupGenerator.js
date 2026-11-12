const designSystemService = require('./designSystemService');

function generateHtmlMockup(screen) {
  const tokens = designSystemService.getCssTokens();
  const title = screen.name || 'Pantalla del Sistema';
  const description = screen.description || screen.purpose || 'Módulo operativo del sistema';
  const route = screen.route || '/';
  const components = screen.components || [];

  let componentsHtml = '';

  if (components.length > 0) {
    componentsHtml = components.map(c => {
      const type = (c.type || 'card').toLowerCase();
      const label = c.label || c.placeholder || 'Elemento';

      if (type === 'heading') {
        return `
          <div class="mockup-heading">
            <h2>${label}</h2>
            ${description ? `<p class="mockup-subtext">${description}</p>` : ''}
          </div>`;
      }

      if (type === 'navbar' || type === 'header') {
        return `
          <nav class="mockup-navbar">
            <div class="brand">✦ ${label}</div>
            <div class="nav-links">
              <span class="nav-item active">Principal</span>
              <span class="nav-item">Operación</span>
              <span class="nav-item">Consultas</span>
            </div>
          </nav>`;
      }

      if (type === 'button' || type === 'action') {
        const buttons = c.meta?.buttons || [{ label, variant: 'primary' }];
        const btnsHtml = buttons.map(b => `
          <button class="btn-mockup ${b.variant === 'secondary' || b.variant === 'outline' ? 'btn-mockup-secondary' : 'btn-mockup-primary'}">
            ${b.label || label}
          </button>
        `).join('');
        return `<div class="mockup-action-group">${btnsHtml}</div>`;
      }

      if (type === 'input' || type === 'form') {
        const fields = c.meta?.fields || [
          { label: label || 'Identificador', type: 'text', placeholder: 'Ingrese código o dato...' },
          { label: 'Descripción / Nota', type: 'text', placeholder: 'Detalle de la acción...' }
        ];

        const fieldsHtml = fields.map(f => `
          <div class="mockup-form-group">
            <label class="mockup-label">${f.label}</label>
            <input type="${f.type || 'text'}" class="mockup-input" placeholder="${f.placeholder || 'Completar campo...'}" />
          </div>
        `).join('');

        return `
          <div class="mockup-card">
            <div class="mockup-card-title">${label}</div>
            <div class="mockup-form-grid">
              ${fieldsHtml}
            </div>
            <div class="mockup-action-group" style="margin-top: 1rem;">
              <button class="btn-mockup btn-mockup-primary">Guardar</button>
              <button class="btn-mockup btn-mockup-secondary">Cancelar</button>
            </div>
          </div>`;
      }

      if (type === 'table') {
        const headers = c.meta?.headers || ['Código', 'Concepto', 'Responsable', 'Estado', 'Fecha'];
        const rows = c.meta?.rows || [
          ['#001', 'Registro Inicial', 'Administrador', 'Completado', '2026-10-12'],
          ['#002', 'Operación en Revisión', 'Recepción', 'En Proceso', '2026-10-13']
        ];

        const ths = headers.map(h => `<th>${h}</th>`).join('');
        const trs = rows.map(r => `
          <tr>
            ${r.map((cell, idx) => {
              if (idx === 0) return `<td><code>${cell}</code></td>`;
              if (String(cell).toLowerCase().includes('completado') || String(cell).toLowerCase().includes('aprobado') || String(cell).toLowerCase().includes('activo')) {
                return `<td><span class="mockup-badge success">${cell}</span></td>`;
              }
              if (String(cell).toLowerCase().includes('proceso') || String(cell).toLowerCase().includes('pendiente') || String(cell).toLowerCase().includes('revisión')) {
                return `<td><span class="mockup-badge pending">${cell}</span></td>`;
              }
              return `<td>${cell}</td>`;
            }).join('')}
          </tr>
        `).join('');

        return `
          <div class="mockup-card" style="padding: 0; overflow: hidden;">
            <div style="padding: 1rem 1.25rem; border-bottom: 1px solid #f1f5f9; display: flex; justify-content: space-between; align-items: center;">
              <span style="font-weight: 600; font-size: 0.95rem; color: #0f172a;">${label}</span>
              <span style="font-size: 0.75rem; color: #64748b;">${rows.length} registros</span>
            </div>
            <table class="mockup-table">
              <thead><tr>${ths}</tr></thead>
              <tbody>${trs}</tbody>
            </table>
          </div>`;
      }

      // Tarjeta minimalista por defecto
      return `
        <div class="mockup-card">
          <div class="mockup-card-title">${label}</div>
          <p style="color: #64748b; font-size: 0.85rem; margin-top: 4px;">${c.placeholder || description || 'Módulo operativo listo para interacción.'}</p>
        </div>`;
    }).join('\n');
  } else {
    const fields = (screen.fields || []).length ? screen.fields : [];
    const action = screen.primaryAction || 'Guardar';
    const fieldInputs = (fields.length ? fields : ['Dato principal']).map(label => `
          <div class="mockup-form-group">
            <label class="mockup-label">${label}</label>
            <input type="text" class="mockup-input" placeholder="${label}" />
          </div>`).join('');
    const headers = screen.tableHeaders || [];
    const rows = screen.sampleRows || [];
    componentsHtml = `
      <div class="mockup-heading">
        <h2>${title}</h2>
        <p class="mockup-subtext">${description}</p>
      </div>
      ${screen.nav?.length ? `<nav class="mockup-navbar"><div class="brand">${(screen.actors && screen.actors[0]) || 'Autron5'}</div><div class="nav-links">${screen.nav.map(item => `<span class="nav-item">${item}</span>`).join('')}</div></nav>` : ''}
      ${fields.length ? `<div class="mockup-card">
        <div class="mockup-card-title">${title}</div>
        <div class="mockup-form-grid">${fieldInputs}</div>
        <div class="mockup-action-group">
          <button class="btn-mockup btn-mockup-primary">${action}</button>
          <button class="btn-mockup btn-mockup-secondary">Cancelar</button>
        </div>
      </div>` : ''}
      ${headers.length ? `<div class="mockup-card" style="padding: 0; overflow: hidden; margin-top: 1.25rem;">
        <table class="mockup-table">
          <thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
          <tbody>${(rows.length ? rows : [headers.map(() => '—')]).map(row => `<tr>${row.map(cell => `<td>${cell}</td>`).join('')}</tr>`).join('')}</tbody>
        </table>
      </div>` : ''}
    `;
  }

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>${title} - Prototipo ICASE</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    :root {
      --color-primary: ${tokens['--color-primary'] || '#4338CA'};
      --color-primary-hover: ${tokens['--color-primary-hover'] || '#3730A3'};
      --color-bg-app: ${tokens['--color-bg-app'] || '#FAFAF9'};
      --color-surface: ${tokens['--color-surface'] || '#FFFFFF'};
      --color-border: ${tokens['--color-border'] || '#E7E5E0'};
      --color-border-focus: ${tokens['--color-border-focus'] || '#4338CA'};
      --color-text-title: ${tokens['--color-text-title'] || '#111111'};
      --color-text-body: ${tokens['--color-text-body'] || '#111111'};
      --color-text-muted: ${tokens['--color-text-muted'] || '#5F5F5A'};
      --radius-sm: ${tokens['--radius-sm'] || '6px'};
      --radius-md: ${tokens['--radius-md'] || '10px'};
      --radius-lg: ${tokens['--radius-lg'] || '16px'};
    }
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    body { background-color: var(--color-bg-app); color: var(--color-text-title); padding: 1.25rem; }
    .mockup-container { max-width: 1200px; margin: 0 auto; background: var(--color-surface); border-radius: var(--radius-lg); border: 1px solid var(--color-border); box-shadow: none; overflow: hidden; }
    .mockup-topbar { background: var(--color-text-title); color: #ffffff; padding: 0.7rem 1.25rem; display: flex; justify-content: space-between; align-items: center; font-size: 0.825rem; }
    .mockup-topbar .route-badge { background: #1e293b; color: #38bdf8; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.75rem; padding: 3px 8px; border-radius: 4px; }
    .mockup-body { padding: 1.5rem; display: flex; flex-direction: column; gap: 1rem; }
    .mockup-heading { margin-bottom: 0.5rem; }
    .mockup-heading h2 { font-size: 1.25rem; font-weight: 700; color: var(--color-text-title); letter-spacing: -0.01em; margin-bottom: 0.25rem; }
    .mockup-subtext { color: var(--color-text-muted); font-size: 0.85rem; line-height: 1.4; }
    .mockup-navbar { background: var(--color-bg-app); border: 1px solid var(--color-border); padding: 0.6rem 1rem; border-radius: var(--radius-md); display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; }
    .mockup-navbar .brand { font-weight: 600; color: var(--color-text-title); font-size: 0.85rem; }
    .mockup-navbar .nav-links { display: flex; gap: 1rem; font-size: 0.8rem; }
    .mockup-navbar .nav-item { color: var(--color-text-muted); }
    .mockup-navbar .nav-item.active { color: var(--color-text-title); font-weight: 600; }
    .mockup-card { background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: 1.25rem; }
    .mockup-card-title { font-weight: 600; font-size: 0.95rem; color: var(--color-text-title); margin-bottom: 0.5rem; }
    .mockup-form-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 1rem; }
    .mockup-form-group { display: flex; flex-direction: column; gap: 0.35rem; }
    .mockup-label { font-size: 0.8rem; font-weight: 600; color: var(--color-text-body); }
    .mockup-input { width: 100%; padding: 0.55rem 0.75rem; border: 1px solid var(--color-border); border-radius: var(--radius-md); font-size: 0.85rem; outline: none; transition: border-color 0.15s; background: var(--color-surface); color: var(--color-text-title); }
    .mockup-input:focus { border-color: var(--color-border-focus); }
    .mockup-action-group { display: flex; gap: 0.5rem; }
    .btn-mockup { padding: 0.5rem 1rem; border-radius: var(--radius-md); font-size: 0.825rem; font-weight: 600; cursor: pointer; border: none; transition: opacity 0.15s; }
    .btn-mockup:hover { opacity: 0.9; }
    .btn-mockup-primary { background: var(--color-primary); color: #ffffff; }
    .btn-mockup-primary:hover { background: var(--color-primary-hover); }
    .btn-mockup-secondary { background: #f1f5f9; color: var(--color-text-body); border: 1px solid var(--color-border); }
    .mockup-table { width: 100%; border-collapse: collapse; text-align: left; font-size: 0.825rem; }
    .mockup-table th { background: var(--color-bg-app); padding: 0.6rem 1rem; color: #475569; font-weight: 600; border-bottom: 1px solid var(--color-border); font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.03em; }
    .mockup-table td { padding: 0.65rem 1rem; border-bottom: 1px solid #f1f5f9; color: #1e293b; }
    .mockup-badge { display: inline-block; padding: 2px 7px; border-radius: var(--radius-sm); font-size: 0.725rem; font-weight: 600; }
    .mockup-badge.success { background: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0; }
    .mockup-badge.pending { background: #fffbeb; color: #92400e; border: 1px solid #fde68a; }
  </style>
</head>
<body>
  <div class="mockup-container">
    <div class="mockup-topbar">
      <div><strong>Prototipo ICASE</strong> • ${title}</div>
      <div class="route-badge">${route}</div>
    </div>
    <div class="mockup-body">
      ${componentsHtml}
    </div>
  </div>
</body>
</html>`;
}

module.exports = {
  generateHtmlMockup
};
