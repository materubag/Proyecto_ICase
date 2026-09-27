/**
 * Generador de Mockups HTML Interactivos y Modernos para Pantallas ICASE.
 */

function generateHtmlMockup(screen) {
  const title = screen.name || 'Pantalla del Sistema';
  const description = screen.description || screen.purpose || 'Interfaz interactiva de usuario';
  const route = screen.route || '/';
  const components = screen.components || [];

  let componentsHtml = '';

  if (components.length > 0) {
    componentsHtml = components.map(c => {
      const type = (c.type || 'card').toLowerCase();
      const label = c.label || c.placeholder || 'Elemento';

      if (type === 'heading') {
        return `<div class="mockup-heading"><h2>${label}</h2><p class="mockup-subtext">${description}</p></div>`;
      }
      if (type === 'navbar' || type === 'header') {
        return `<nav class="mockup-navbar"><div class="brand">🚀 ${label}</div><div class="nav-links"><span class="nav-item active">Inicio</span><span class="nav-item">Gestión</span><span class="nav-item">Reportes</span></div></nav>`;
      }
      if (type === 'button') {
        return `<div class="mockup-action-group"><button class="btn-mockup btn-mockup-primary">${label}</button></div>`;
      }
      if (type === 'input' || type === 'form') {
        return `
          <div class="mockup-form-group">
            <label class="mockup-label">${label}</label>
            <input type="text" class="mockup-input" placeholder="${c.placeholder || 'Ingrese valor...'}" />
          </div>`;
      }
      if (type === 'table') {
        return `
          <div class="mockup-table-container">
            <h4 style="margin-bottom: 0.5rem; color: #1e293b;">${label}</h4>
            <table class="mockup-table">
              <thead><tr><th>ID</th><th>Registro</th><th>Fecha</th><th>Estado</th></tr></thead>
              <tbody>
                <tr><td>#001</td><td>Operación Principal</td><td>2026-09-27</td><td><span class="mockup-badge success">Completado</span></td></tr>
                <tr><td>#002</td><td>Verificación de Reglas</td><td>2026-09-27</td><td><span class="mockup-badge pending">En Proceso</span></td></tr>
              </tbody>
            </table>
          </div>`;
      }
      // Tarjeta por defecto
      return `
        <div class="mockup-card">
          <div class="mockup-card-title">${label}</div>
          <p style="color: #64748b; font-size: 0.875rem;">${c.placeholder || 'Componente funcional del prototipo.'}</p>
        </div>`;
    }).join('\n');
  } else {
    // Prototipo estándar moderno si no tiene componentes hijos aún
    componentsHtml = `
      <div class="mockup-card">
        <div class="mockup-card-title">Módulo de Operación: ${title}</div>
        <p style="color: #64748b; font-size: 0.9rem; margin-bottom: 1.25rem;">${description}</p>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1.5rem;">
          <div class="mockup-form-group">
            <label class="mockup-label">Parámetro / Identificador</label>
            <input type="text" class="mockup-input" placeholder="Ej. Código o Cédula..." />
          </div>
          <div class="mockup-form-group">
            <label class="mockup-label">Criterio de Búsqueda / Acción</label>
            <input type="text" class="mockup-input" placeholder="Buscar o filtrar..." />
          </div>
        </div>

        <div class="mockup-action-group">
          <button class="btn-mockup btn-mockup-primary">Ejecutar Acción Principal</button>
          <button class="btn-mockup btn-mockup-secondary">Limpiar Formulario</button>
        </div>
      </div>

      <div class="mockup-table-container" style="margin-top: 1.5rem;">
        <h4 style="margin-bottom: 0.5rem; color: #1e293b;">Resultados y Registros Asociados</h4>
        <table class="mockup-table">
          <thead>
            <tr><th>Código</th><th>Descripción de Operación</th><th>Fecha</th><th>Estado</th></tr>
          </thead>
          <tbody>
            <tr>
              <td><code>REG-101</code></td>
              <td>Transacción procesada correctamente</td>
              <td>2026-09-27</td>
              <td><span class="mockup-badge success">Aprobado</span></td>
            </tr>
            <tr>
              <td><code>REG-102</code></td>
              <td>Pendiente de autorización</td>
              <td>2026-09-27</td>
              <td><span class="mockup-badge pending">Pendiente</span></td>
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
  <title>${title} - Mockup ICASE</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
    body { background-color: #f8fafc; color: #0f172a; padding: 1.5rem; }
    .mockup-container { max-width: 900px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.05); overflow: hidden; }
    .mockup-topbar { background: #0f172a; color: #ffffff; padding: 0.75rem 1.25rem; display: flex; justify-content: space-between; align-items: center; }
    .mockup-topbar .route-badge { background: #1e293b; color: #38bdf8; font-family: monospace; font-size: 0.8rem; padding: 4px 10px; border-radius: 6px; }
    .mockup-body { padding: 1.75rem; }
    .mockup-heading { margin-bottom: 1.5rem; }
    .mockup-heading h2 { font-size: 1.4rem; color: #0f172a; margin-bottom: 0.35rem; }
    .mockup-subtext { color: #64748b; font-size: 0.9rem; }
    .mockup-navbar { background: #f1f5f9; padding: 0.75rem 1rem; border-radius: 8px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem; }
    .mockup-navbar .brand { font-weight: 700; color: #3b82f6; }
    .mockup-navbar .nav-links { display: flex; gap: 1rem; font-size: 0.85rem; }
    .mockup-navbar .nav-item { color: #64748b; cursor: pointer; }
    .mockup-navbar .nav-item.active { color: #1e293b; font-weight: 600; }
    .mockup-card { background: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 1.25rem; margin-bottom: 1rem; }
    .mockup-card-title { font-weight: 600; font-size: 1.05rem; color: #1e293b; margin-bottom: 0.5rem; }
    .mockup-form-group { margin-bottom: 1rem; }
    .mockup-label { display: block; font-size: 0.85rem; font-weight: 600; color: #334155; margin-bottom: 0.35rem; }
    .mockup-input { width: 100%; padding: 0.65rem 0.85rem; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 0.9rem; outline: none; transition: border-color 0.2s; }
    .mockup-input:focus { border-color: #3b82f6; }
    .mockup-action-group { display: flex; gap: 0.75rem; margin-top: 1rem; }
    .btn-mockup { padding: 0.6rem 1.2rem; border-radius: 6px; font-size: 0.875rem; font-weight: 600; cursor: pointer; border: none; transition: background 0.2s; }
    .btn-mockup-primary { background: #2563eb; color: #ffffff; }
    .btn-mockup-primary:hover { background: #1d4ed8; }
    .btn-mockup-secondary { background: #e2e8f0; color: #334155; }
    .mockup-table-container { border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; }
    .mockup-table { width: 100%; border-collapse: collapse; text-align: left; font-size: 0.875rem; }
    .mockup-table th { background: #f8fafc; padding: 0.65rem 1rem; color: #475569; font-weight: 600; border-bottom: 1px solid #e2e8f0; }
    .mockup-table td { padding: 0.65rem 1rem; border-bottom: 1px solid #f1f5f9; color: #1e293b; }
    .mockup-badge { display: inline-block; padding: 2px 8px; border-radius: 9999px; font-size: 0.75rem; font-weight: 600; }
    .mockup-badge.success { background: #dcfce7; color: #15803d; }
    .mockup-badge.pending { background: #fef3c7; color: #b45309; }
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
