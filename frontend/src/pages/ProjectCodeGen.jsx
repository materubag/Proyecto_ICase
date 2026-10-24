import React, { useState, useEffect, useMemo } from 'react';
import { codegenApi } from '../api/codegen.api';

export default function ProjectCodeGen({ project, onNavigateTo }) {
  const [includeDocker, setIncludeDocker] = useState(true);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState(null);
  const [generatedData, setGeneratedData] = useState(null);
  const [selectedFilePath, setSelectedFilePath] = useState('docker-compose.yml');
  const [copied, setCopied] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
  const [stackFilter, setStackFilter] = useState('all'); // 'all' | 'frontend' | 'backend'

  // Carga automática inicial de la previsualización
  useEffect(() => {
    if (project?.id) {
      loadPreview();
    }
  }, [project?.id, includeDocker]);

  async function loadPreview() {
    try {
      setLoading(true);
      setError(null);
      const data = await codegenApi.getPreview(project.id, includeDocker);
      setGeneratedData(data);
      if (data?.files?.length > 0) {
        const hasCurrent = data.files.some(f => f.path === selectedFilePath);
        if (!hasCurrent) {
          const defaultFile = data.files.find(f => f.path.includes('docker-compose.yml') || f.path.includes('server.js')) || data.files[0];
          setSelectedFilePath(defaultFile.path);
        }
      }
    } catch (err) {
      console.error('Error al generar previsualización de código:', err);
      setError(err.message || 'Error al generar código');
    } finally {
      setLoading(false);
    }
  }

  async function handleDownload() {
    try {
      setDownloading(true);
      setError(null);
      const safeName = (project.name || 'proyecto').toLowerCase().replace(/[^a-z0-9]/g, '_');
      await codegenApi.downloadZip(project.id, includeDocker, `${safeName}-fullstack.zip`);
    } catch (err) {
      console.error('Error al descargar ZIP:', err);
      setError(err.message || 'Error al descargar archivo');
    } finally {
      setDownloading(false);
    }
  }

  function handleCopy() {
    if (!selectedFile?.content) return;
    navigator.clipboard.writeText(selectedFile.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const files = generatedData?.files || [];

  // Filtrado de archivos por búsqueda y por capa (Full-Stack / Frontend / Backend)
  const filteredFiles = useMemo(() => {
    return files.filter(f => {
      const matchesSearch = !searchFilter.trim() || f.path.toLowerCase().includes(searchFilter.toLowerCase());
      if (!matchesSearch) return false;

      if (stackFilter === 'backend') {
        return f.path.startsWith('backend/') || !f.path.includes('/');
      }
      if (stackFilter === 'frontend') {
        return f.path.startsWith('frontend/') || !f.path.includes('/');
      }
      return true;
    });
  }, [files, searchFilter, stackFilter]);

  const selectedFile = useMemo(() => {
    return files.find(f => f.path === selectedFilePath) || filteredFiles[0] || files[0] || null;
  }, [files, filteredFiles, selectedFilePath]);

  // Agrupación de archivos Full-Stack por carpetas
  const categorizedFiles = useMemo(() => {
    const rootFiles = [];
    const backendRootFiles = [];
    const backendModels = [];
    const backendControllers = [];
    const backendRoutes = [];
    const frontendRootFiles = [];
    const frontendPages = [];
    const frontendOrmPages = [];

    for (const f of filteredFiles) {
      if (f.path.startsWith('backend/src/models/')) backendModels.push(f);
      else if (f.path.startsWith('backend/src/controllers/')) backendControllers.push(f);
      else if (f.path.startsWith('backend/src/routes/')) backendRoutes.push(f);
      else if (f.path.startsWith('backend/')) backendRootFiles.push(f);
      else if (f.path.startsWith('frontend/src/pages/orm/')) frontendOrmPages.push(f);
      else if (f.path.startsWith('frontend/src/pages/')) frontendPages.push(f);
      else if (f.path.startsWith('frontend/')) frontendRootFiles.push(f);
      else rootFiles.push(f);
    }

    return { rootFiles, backendRootFiles, backendModels, backendControllers, backendRoutes, frontendRootFiles, frontendPages, frontendOrmPages };
  }, [filteredFiles]);

  const stats = generatedData?.stats || {
    entitiesCount: project.entities?.length || 0,
    relationshipsCount: project.relationships?.length || 0,
    filesCount: files.length
  };

  const getFileIcon = (path) => {
    if (path.endsWith('.json')) return 'data_object';
    if (path.endsWith('.jsx')) return 'code_blocks';
    if (path.endsWith('.js')) return 'javascript';
    if (path.endsWith('.css')) return 'css';
    if (path.endsWith('.html')) return 'html';
    if (path.endsWith('.md')) return 'article';
    if (path.includes('docker') || path.includes('nginx')) return 'deployed_code';
    if (path.endsWith('.example') || path.endsWith('.env')) return 'tune';
    return 'description';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', background: 'var(--surface)' }}>
      {/* 1. Header de Acción y Configuración */}
      <div style={{
        padding: '12px 20px',
        borderBottom: '1px solid var(--outline-variant, rgba(0,0,0,0.08))',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
        background: 'var(--surface-container-low, #fff)'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="ms ms-md" style={{ color: 'var(--primary, #0056b3)' }}>terminal</span>
            <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 600 }}>Generador Full-Stack (Frontend + Backend + BD)</h2>
            <span className="badge" style={{ background: '#dcfce7', color: '#15803d', fontSize: '0.72rem', fontWeight: 600 }}>
              Full-Stack Ejecutable
            </span>
          </div>
          <p style={{ margin: '2px 0 0 0', fontSize: '0.8rem', color: 'var(--on-surface-variant, #666)' }}>
            Genera una aplicación completa: Vistas React con formularios, API REST Express, ORM Sequelize y Docker.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          {/* Switch Docker */}
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', cursor: 'pointer', userSelect: 'none' }}>
            <input
              type="checkbox"
              checked={includeDocker}
              onChange={(e) => setIncludeDocker(e.target.checked)}
              disabled={loading}
              style={{ cursor: 'pointer' }}
            />
            <span>Incluir Docker Compose (BD + API + React)</span>
          </label>

          {/* Botón Regenerar */}
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={loadPreview}
            disabled={loading}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            title="Volver a generar el código desde los modelos aprobados"
          >
            <span className={`ms ms-xs ${loading ? 'spin' : ''}`}>sync</span>
            <span>{loading ? 'Generando...' : 'Regenerar'}</span>
          </button>

          {/* Botón Chat IA Asistente */}
          {onNavigateTo && (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => onNavigateTo('chat')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--primary, #0056b3)' }}
              title="Abrir Chat IA Asistente para dudas o diagnóstico de errores"
            >
              <span className="ms ms-xs">chat</span>
              <span>Asistente IA</span>
            </button>
          )}

          {/* Botón Descargar ZIP */}
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={handleDownload}
            disabled={downloading || loading || files.length === 0}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}
          >
            <span className="ms ms-xs">download</span>
            <span>{downloading ? 'Descargando...' : 'Descargar Proyecto Full-Stack (.ZIP)'}</span>
          </button>
        </div>
      </div>

      {/* 2. Barra de Métricas y Filtros de Capa */}
      <div style={{
        padding: '6px 20px',
        background: 'var(--surface-container-lowest, #f8fafc)',
        borderBottom: '1px solid var(--outline-variant, rgba(0,0,0,0.06))',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        fontSize: '0.78rem',
        color: 'var(--on-surface-variant, #64748b)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          <span>📦 <strong>{stats.entitiesCount}</strong> Entidades convertidas</span>
          <span>🔗 <strong>{stats.relationshipsCount}</strong> Relaciones</span>
          <span>📄 <strong>{files.length}</strong> Archivos totales</span>
          <span style={{ color: '#0284c7' }}>🎨 React 18 + Vite</span>
          <span style={{ color: '#16a34a' }}>⚙️ Express + Sequelize</span>
          {includeDocker && <span style={{ color: '#059669' }}>🐳 Docker listo (3 contenedores)</span>}
        </div>

        {/* Selector de visualización de capa */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#e2e8f0', borderRadius: '4px', padding: '2px' }}>
          <button
            type="button"
            onClick={() => setStackFilter('all')}
            style={{
              border: 'none',
              padding: '3px 8px',
              borderRadius: '3px',
              fontSize: '0.72rem',
              cursor: 'pointer',
              background: stackFilter === 'all' ? '#fff' : 'transparent',
              fontWeight: stackFilter === 'all' ? 600 : 400
            }}
          >
            Todo ({files.length})
          </button>
          <button
            type="button"
            onClick={() => setStackFilter('frontend')}
            style={{
              border: 'none',
              padding: '3px 8px',
              borderRadius: '3px',
              fontSize: '0.72rem',
              cursor: 'pointer',
              background: stackFilter === 'frontend' ? '#fff' : 'transparent',
              color: stackFilter === 'frontend' ? '#0284c7' : 'inherit',
              fontWeight: stackFilter === 'frontend' ? 600 : 400
            }}
          >
            🎨 Frontend
          </button>
          <button
            type="button"
            onClick={() => setStackFilter('backend')}
            style={{
              border: 'none',
              padding: '3px 8px',
              borderRadius: '3px',
              fontSize: '0.72rem',
              cursor: 'pointer',
              background: stackFilter === 'backend' ? '#fff' : 'transparent',
              color: stackFilter === 'backend' ? '#16a34a' : 'inherit',
              fontWeight: stackFilter === 'backend' ? 600 : 400
            }}
          >
            ⚙️ Backend
          </button>
        </div>
      </div>

      {/* Aviso informativo amigable si no hay entidades aún */}
      {stats.entitiesCount === 0 && !loading ? (
        <div style={{
          padding: '14px 20px',
          background: '#eff6ff',
          borderBottom: '1px solid #bfdbfe',
          color: '#1e40af',
          fontSize: '0.86rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span className="ms ms-md" style={{ color: '#2563eb' }}>info</span>
            <div>
              <strong>Este proyecto aún no tiene entidades en el modelo de datos.</strong>
              <div style={{ fontSize: '0.78rem', color: '#3b82f6', marginTop: '2px' }}>
                Para generar la aplicación Full-Stack ejecutable, primero crea o aprueba las entidades del sistema en la sección de Modelado.
              </div>
            </div>
          </div>
          {onNavigateTo && (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => onNavigateTo('modeling')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <span className="ms ms-xs">schema</span>
              <span>Ir a Modelado de Datos</span>
            </button>
          )}
        </div>
      ) : error ? (
        <div style={{
          padding: '10px 20px',
          background: '#fef2f2',
          borderBottom: '1px solid #fecaca',
          color: '#991b1b',
          fontSize: '0.85rem',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <span className="ms ms-sm">error</span>
          <span>{error}</span>
        </div>
      ) : null}

      {/* 3. Área Principal: Explorador estilo IDE (2 Columnas) */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', overflow: 'hidden' }}>
        {/* Panel Izquierdo: Explorador de Archivos */}
        <div style={{
          width: '290px',
          minWidth: '240px',
          borderRight: '1px solid var(--outline-variant, rgba(0,0,0,0.08))',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--surface-container-low, #fafbfc)'
        }}>
          {/* Cabecera del explorador con filtro */}
          <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--outline-variant, rgba(0,0,0,0.06))' }}>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                placeholder="Buscar archivo..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                style={{
                  width: '100%',
                  fontSize: '0.76rem',
                  padding: '4px 6px 4px 24px',
                  borderRadius: '4px',
                  border: '1px solid rgba(0,0,0,0.15)',
                  boxSizing: 'border-box'
                }}
              />
              <span className="ms ms-xs" style={{ position: 'absolute', left: '6px', top: '7px', color: '#94a3b8', fontSize: '13px' }}>
                search
              </span>
            </div>
          </div>

          {/* Lista de archivos en árbol */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '6px 4px', fontSize: '0.78rem' }}>
            {files.length === 0 && !loading && (
              <div style={{ padding: '20px 10px', textAlign: 'center', color: '#94a3b8' }}>
                No hay archivos generados.
              </div>
            )}

            {/* Raíz (docker-compose, README, etc.) */}
            {categorizedFiles.rootFiles.map(file => (
              <div
                key={file.path}
                onClick={() => setSelectedFilePath(file.path)}
                style={{
                  padding: '5px 8px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                  borderRadius: '4px',
                  background: selectedFilePath === file.path ? 'rgba(0, 86, 179, 0.1)' : 'transparent',
                  color: selectedFilePath === file.path ? 'var(--primary, #0056b3)' : 'inherit',
                  fontWeight: selectedFilePath === file.path ? 600 : 400
                }}
              >
                <span className="ms ms-xs" style={{ fontSize: '14px', color: '#64748b' }}>
                  {getFileIcon(file.path)}
                </span>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {file.path}
                </span>
              </div>
            ))}

            {/* SECCIÓN FRONTEND */}
            {(stackFilter === 'all' || stackFilter === 'frontend') && (
              <div style={{ marginTop: '10px' }}>
                <div style={{ padding: '4px 8px', fontWeight: 700, color: '#0284c7', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span className="ms ms-xs" style={{ fontSize: '15px' }}>folder_open</span>
                  <span>🎨 frontend/</span>
                </div>

                <div style={{ paddingLeft: '12px' }}>
                  {categorizedFiles.frontendRootFiles.map(file => (
                    <div
                      key={file.path}
                      onClick={() => setSelectedFilePath(file.path)}
                      style={{
                        padding: '4px 6px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        cursor: 'pointer',
                        borderRadius: '4px',
                        background: selectedFilePath === file.path ? 'rgba(0, 86, 179, 0.1)' : 'transparent',
                        color: selectedFilePath === file.path ? 'var(--primary, #0056b3)' : 'inherit',
                        fontWeight: selectedFilePath === file.path ? 600 : 400
                      }}
                    >
                      <span className="ms ms-xs" style={{ fontSize: '13px', color: '#64748b' }}>
                        {getFileIcon(file.path)}
                      </span>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {file.path.replace('frontend/', '')}
                      </span>
                    </div>
                  ))}

                  {/* pages/ (Pantallas Funcionales según Requerimientos y Mockups) */}
                  {categorizedFiles.frontendPages.length > 0 && (
                    <div style={{ marginTop: '4px' }}>
                      <div style={{ padding: '3px 6px', fontWeight: 600, color: '#0369a1', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span className="ms ms-xs" style={{ fontSize: '13px' }}>folder</span>
                        <span>src/pages/ (Módulos Funcionales)</span>
                      </div>
                      <div style={{ paddingLeft: '10px' }}>
                        {categorizedFiles.frontendPages.map(file => (
                          <div
                            key={file.path}
                            onClick={() => setSelectedFilePath(file.path)}
                            style={{
                              padding: '3px 6px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              cursor: 'pointer',
                              borderRadius: '4px',
                              background: selectedFilePath === file.path ? 'rgba(0, 86, 179, 0.1)' : 'transparent',
                              color: selectedFilePath === file.path ? 'var(--primary, #0056b3)' : 'inherit',
                              fontWeight: selectedFilePath === file.path ? 600 : 400
                            }}
                          >
                            <span className="ms ms-xs" style={{ fontSize: '13px', color: '#0284c7' }}>
                              preview
                            </span>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {file.path.replace('frontend/src/pages/', '')}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* pages/orm/ (Tablas de Datos ORM) */}
                  {categorizedFiles.frontendOrmPages.length > 0 && (
                    <div style={{ marginTop: '4px' }}>
                      <div style={{ padding: '3px 6px', fontWeight: 600, color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span className="ms ms-xs" style={{ fontSize: '13px' }}>folder</span>
                        <span>src/pages/orm/ (Tablas ORM)</span>
                      </div>
                      <div style={{ paddingLeft: '10px' }}>
                        {categorizedFiles.frontendOrmPages.map(file => (
                          <div
                            key={file.path}
                            onClick={() => setSelectedFilePath(file.path)}
                            style={{
                              padding: '3px 6px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              cursor: 'pointer',
                              borderRadius: '4px',
                              background: selectedFilePath === file.path ? 'rgba(0, 86, 179, 0.1)' : 'transparent',
                              color: selectedFilePath === file.path ? 'var(--primary, #0056b3)' : 'inherit',
                              fontWeight: selectedFilePath === file.path ? 600 : 400
                            }}
                          >
                            <span className="ms ms-xs" style={{ fontSize: '13px', color: '#64748b' }}>
                              table_chart
                            </span>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {file.path.replace('frontend/src/pages/orm/', '')}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* SECCIÓN BACKEND */}
            {(stackFilter === 'all' || stackFilter === 'backend') && (
              <div style={{ marginTop: '10px' }}>
                <div style={{ padding: '4px 8px', fontWeight: 700, color: '#16a34a', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span className="ms ms-xs" style={{ fontSize: '15px' }}>folder_open</span>
                  <span>⚙️ backend/</span>
                </div>

                <div style={{ paddingLeft: '12px' }}>
                  {categorizedFiles.backendRootFiles.map(file => (
                    <div
                      key={file.path}
                      onClick={() => setSelectedFilePath(file.path)}
                      style={{
                        padding: '4px 6px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        cursor: 'pointer',
                        borderRadius: '4px',
                        background: selectedFilePath === file.path ? 'rgba(0, 86, 179, 0.1)' : 'transparent',
                        color: selectedFilePath === file.path ? 'var(--primary, #0056b3)' : 'inherit',
                        fontWeight: selectedFilePath === file.path ? 600 : 400
                      }}
                    >
                      <span className="ms ms-xs" style={{ fontSize: '13px', color: '#64748b' }}>
                        {getFileIcon(file.path)}
                      </span>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {file.path.replace('backend/', '')}
                      </span>
                    </div>
                  ))}

                  {/* models/ */}
                  {categorizedFiles.backendModels.length > 0 && (
                    <div style={{ marginTop: '4px' }}>
                      <div style={{ padding: '3px 6px', fontWeight: 600, color: '#15803d', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span className="ms ms-xs" style={{ fontSize: '13px' }}>folder</span>
                        <span>src/models/ (Sequelize)</span>
                      </div>
                      <div style={{ paddingLeft: '10px' }}>
                        {categorizedFiles.backendModels.map(file => (
                          <div
                            key={file.path}
                            onClick={() => setSelectedFilePath(file.path)}
                            style={{
                              padding: '3px 6px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              cursor: 'pointer',
                              borderRadius: '4px',
                              background: selectedFilePath === file.path ? 'rgba(0, 86, 179, 0.1)' : 'transparent',
                              color: selectedFilePath === file.path ? 'var(--primary, #0056b3)' : 'inherit',
                              fontWeight: selectedFilePath === file.path ? 600 : 400
                            }}
                          >
                            <span className="ms ms-xs" style={{ fontSize: '13px', color: '#16a34a' }}>
                              schema
                            </span>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {file.path.replace('backend/src/models/', '')}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* controllers/ */}
                  {categorizedFiles.backendControllers.length > 0 && (
                    <div style={{ marginTop: '4px' }}>
                      <div style={{ padding: '3px 6px', fontWeight: 600, color: '#15803d', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span className="ms ms-xs" style={{ fontSize: '13px' }}>folder</span>
                        <span>src/controllers/</span>
                      </div>
                      <div style={{ paddingLeft: '10px' }}>
                        {categorizedFiles.backendControllers.map(file => (
                          <div
                            key={file.path}
                            onClick={() => setSelectedFilePath(file.path)}
                            style={{
                              padding: '3px 6px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              cursor: 'pointer',
                              borderRadius: '4px',
                              background: selectedFilePath === file.path ? 'rgba(0, 86, 179, 0.1)' : 'transparent',
                              color: selectedFilePath === file.path ? 'var(--primary, #0056b3)' : 'inherit',
                              fontWeight: selectedFilePath === file.path ? 600 : 400
                            }}
                          >
                            <span className="ms ms-xs" style={{ fontSize: '13px', color: '#16a34a' }}>
                              code
                            </span>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {file.path.replace('backend/src/controllers/', '')}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* routes/ */}
                  {categorizedFiles.backendRoutes.length > 0 && (
                    <div style={{ marginTop: '4px' }}>
                      <div style={{ padding: '3px 6px', fontWeight: 600, color: '#15803d', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span className="ms ms-xs" style={{ fontSize: '13px' }}>folder</span>
                        <span>src/routes/</span>
                      </div>
                      <div style={{ paddingLeft: '10px' }}>
                        {categorizedFiles.backendRoutes.map(file => (
                          <div
                            key={file.path}
                            onClick={() => setSelectedFilePath(file.path)}
                            style={{
                              padding: '3px 6px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              cursor: 'pointer',
                              borderRadius: '4px',
                              background: selectedFilePath === file.path ? 'rgba(0, 86, 179, 0.1)' : 'transparent',
                              color: selectedFilePath === file.path ? 'var(--primary, #0056b3)' : 'inherit',
                              fontWeight: selectedFilePath === file.path ? 600 : 400
                            }}
                          >
                            <span className="ms ms-xs" style={{ fontSize: '13px', color: '#d97706' }}>
                              alt_route
                            </span>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {file.path.replace('backend/src/routes/', '')}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Panel Derecho: Visor de Código */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', background: '#0f172a' }}>
          {/* Barra de cabecera del archivo seleccionado */}
          <div style={{
            padding: '8px 16px',
            background: '#1e293b',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            color: '#f8fafc',
            fontSize: '0.8rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
              <span className="ms ms-xs" style={{ color: '#38bdf8' }}>
                {getFileIcon(selectedFile?.path || '')}
              </span>
              <span style={{ fontWeight: 600, fontFamily: 'monospace', letterSpacing: '0.2px' }}>
                {selectedFile?.path || 'Ningún archivo seleccionado'}
              </span>
              {selectedFile?.language && (
                <span style={{ fontSize: '0.7rem', padding: '1px 6px', borderRadius: '3px', background: 'rgba(255,255,255,0.1)', color: '#94a3b8' }}>
                  {selectedFile.language.toUpperCase()}
                </span>
              )}
            </div>

            {selectedFile && (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={handleCopy}
                style={{
                  color: copied ? '#4ade80' : '#cbd5e1',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '3px 8px',
                  fontSize: '0.75rem',
                  border: '1px solid rgba(255,255,255,0.15)',
                  background: 'rgba(255,255,255,0.05)'
                }}
                title="Copiar código al portapapeles"
              >
                <span className="ms ms-xs">{copied ? 'check' : 'content_copy'}</span>
                <span>{copied ? '¡Copiado!' : 'Copiar'}</span>
              </button>
            )}
          </div>

          {/* Área de código con números de línea */}
          <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '12px 16px' }}>
            {loading ? (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', gap: '8px' }}>
                <span className="ms spin">sync</span>
                <span>Generando arquitectura Full-Stack (Frontend React + Backend Sequelize)...</span>
              </div>
            ) : selectedFile ? (
              <pre style={{
                margin: 0,
                fontFamily: '"Fira Code", "Cascadia Code", "Source Code Pro", Consolas, monospace',
                fontSize: '0.82rem',
                lineHeight: '1.6',
                color: '#e2e8f0',
                tabSize: 2,
                whiteSpace: 'pre'
              }}>
                <code>{selectedFile.content}</code>
              </pre>
            ) : (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
                Selecciona un archivo del explorador para previsualizarlo.
              </div>
            )}
          </div>

          {/* Guía de ejecución en terminal al pie */}
          <div style={{
            padding: '6px 16px',
            background: '#020617',
            borderTop: '1px solid rgba(255,255,255,0.06)',
            color: '#94a3b8',
            fontSize: '0.74rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '8px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="ms ms-xs" style={{ color: '#22c55e' }}>play_circle</span>
              <span>Ejecución: Descomprime el ZIP y ejecuta: <code>docker compose up --build -d</code></span>
              {onNavigateTo && (
                <button
                  type="button"
                  onClick={() => onNavigateTo('chat')}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#38bdf8',
                    cursor: 'pointer',
                    fontSize: '0.74rem',
                    textDecoration: 'underline',
                    padding: '0 4px',
                    marginLeft: '8px'
                  }}
                  title="Preguntar a la IA si surge algún error al ejecutar"
                >
                  ¿Error en terminal? Diagnosticar con Chat IA
                </button>
              )}
            </div>
            <span>Frontend: <code>:3005</code> | API: <code>:8085/api</code> | PostgreSQL: <code>:5435</code> <span style={{ opacity: 0.6 }}>(Configurable en .env)</span></span>
          </div>
        </div>
      </div>
    </div>
  );
}
