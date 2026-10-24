/**
 * Generador de Mockups HTML Interactivos y Minimalistas para Pantallas ICASE.
 * Diseño limpio, 100% en español, sin sobrecarga visual y con coherencia de datos.
 */

function generateHtmlMockup(screen) {
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
    // Prototipo minimalista estándar si no tiene componentes declarados
    componentsHtml = `
      <div class="mockup-heading">
        <h2>${title}</h2>
        <p class="mockup-subtext">${description}</p>
      </div>

      <div class="mockup-card">
        <div class="mockup-card-title">Datos Principales</div>
        <div class="mockup-form-grid">
          <div class="mockup-form-group">
            <label class="mockup-label">Código / Referencia</label>
            <input type="text" class="mockup-input" placeholder="Ej: REG-001" />
          </div>
          <div class="mockup-form-group">
            <label class="mockup-label">Nombre / Descripción</label>
            <input type="text" class="mockup-input" placeholder="Detalle de la operación..." />
          </div>
        </div>
        <div class="mockup-action-group">
          <button class="btn-mockup btn-mockup-primary">Registrar</button>
          <button class="btn-mockup btn-mockup-secondary">Limpiar</button>
        </div>
      </div>

      <div class="mockup-card" style="padding: 0; overflow: hidden; margin-top: 1.25rem;">
        <div style="padding: 0.9rem 1.25rem; border-bottom: 1px solid #f1f5f9; display: flex; justify-content: space-between; align-items: center;">
          <span style="font-weight: 600; font-size: 0.9rem; color: #0f172a;">Historial Reciente</span>
          <span style="font-size: 0.75rem; color: #64748b;">Actualizado</span>
        </div>
        <table class="mockup-table">
          <thead>
            <tr><th>Código</th><th>Operación</th><th>Responsable</th><th>Estado</th></tr>
          </thead>
          <tbody>
            <tr>
              <td><code>REG-001</code></td>
              <td>Atención registrada con éxito</td>
              <td>Administrador</td>
              <td><span class="mockup-badge success">Completado</span></td>
            </tr>
            <tr>
              <td><code>REG-002</code></td>
              <td>Solicitud pendiente de validación</td>
              <td>Recepción</td>
              <td><span class="mockup-badge pending">En Proceso</span></td>
            </tr>
          </tbody>
        </table>
      </div>
    `;
  }

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>${title} - Prototipo ICASE</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
    body { background-color: #f8fafc; color: #0f172a; padding: 1.25rem; }
    .mockup-container { max-width: 820px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; box-shadow: 0 4px 16px -2px rgba(15, 23, 42, 0.04); overflow: hidden; }
    .mockup-topbar { background: #0f172a; color: #ffffff; padding: 0.7rem 1.25rem; display: flex; justify-content: space-between; align-items: center; font-size: 0.825rem; }
    .mockup-topbar .route-badge { background: #1e293b; color: #38bdf8; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.75rem; padding: 3px 8px; border-radius: 4px; }
    .mockup-body { padding: 1.5rem; display: flex; flexDirection: column; gap: 1rem; }
    .mockup-heading { margin-bottom: 0.5rem; }
    .mockup-heading h2 { font-size: 1.25rem; font-weight: 700; color: #0f172a; letter-spacing: -0.01em; margin-bottom: 0.25rem; }
    .mockup-subtext { color: #64748b; font-size: 0.85rem; line-height: 1.4; }
    .mockup-navbar { background: #f8fafc; border: 1px solid #e2e8f0; padding: 0.6rem 1rem; border-radius: 8px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; }
    .mockup-navbar .brand { font-weight: 600; color: #0f172a; font-size: 0.85rem; }
    .mockup-navbar .nav-links { display: flex; gap: 1rem; font-size: 0.8rem; }
    .mockup-navbar .nav-item { color: #64748b; }
    .mockup-navbar .nav-item.active { color: #0f172a; font-weight: 600; }
    .mockup-card { background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 1.25rem; }
    .mockup-card-title { font-weight: 600; font-size: 0.95rem; color: #0f172a; margin-bottom: 0.5rem; }
    .mockup-form-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 1rem; }
    .mockup-form-group { display: flex; flex-direction: column; gap: 0.35rem; }
    .mockup-label { font-size: 0.8rem; font-weight: 600; color: #334155; }
    .mockup-input { width: 100%; padding: 0.55rem 0.75rem; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 0.85rem; outline: none; transition: border-color 0.15s; background: #ffffff; color: #0f172a; }
    .mockup-input:focus { border-color: #2563eb; }
    .mockup-action-group { display: flex; gap: 0.5rem; }
    .btn-mockup { padding: 0.5rem 1rem; border-radius: 6px; font-size: 0.825rem; font-weight: 600; cursor: pointer; border: none; transition: opacity 0.15s; }
    .btn-mockup:hover { opacity: 0.9; }
    .btn-mockup-primary { background: #0f172a; color: #ffffff; }
    .btn-mockup-secondary { background: #f1f5f9; color: #334155; border: 1px solid #e2e8f0; }
    .mockup-table { width: 100%; border-collapse: collapse; text-align: left; font-size: 0.825rem; }
    .mockup-table th { background: #f8fafc; padding: 0.6rem 1rem; color: #475569; font-weight: 600; border-bottom: 1px solid #e2e8f0; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.03em; }
    .mockup-table td { padding: 0.65rem 1rem; border-bottom: 1px solid #f1f5f9; color: #1e293b; }
    .mockup-badge { display: inline-block; padding: 2px 7px; border-radius: 4px; font-size: 0.725rem; font-weight: 600; }
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
