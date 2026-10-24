import React, { useState, useMemo } from 'react';
import { SCREEN_CATALOG } from '../../utils/mockupScreenOptions';

/**
 * AppShellPreview
 * Marco Maestro de Aplicación Unificado con Segmentación por ROLES y ACTORES.
 * Permite simular y validar las vistas agrupadas según el perfil del usuario:
 * - Recepción
 * - Mecánico / Taller
 * - Portal del Cliente
 * - Administrador
 * - Acceso / Login
 */

const THEMES = {
  indigo: {
    name: 'Índigo Corporativo',
    primary: '#4f46e5',
    primaryHover: '#4338ca',
    primaryLight: '#eef2ff',
    primaryBorder: '#c7d2fe',
    badgeText: '#4338ca',
    sidebarBg: '#0f172a',
    sidebarText: '#94a3b8',
    sidebarActiveBg: '#4f46e5',
    sidebarActiveText: '#ffffff'
  },
  blue: {
    name: 'Azul Clásico',
    primary: '#2563eb',
    primaryHover: '#1d4ed8',
    primaryLight: '#eff6ff',
    primaryBorder: '#bfdbfe',
    badgeText: '#1e40af',
    sidebarBg: '#0f172a',
    sidebarText: '#94a3b8',
    sidebarActiveBg: '#2563eb',
    sidebarActiveText: '#ffffff'
  },
  emerald: {
    name: 'Verde Esmeralda',
    primary: '#059669',
    primaryHover: '#047857',
    primaryLight: '#ecfdf5',
    primaryBorder: '#a7f3d0',
    badgeText: '#065f46',
    sidebarBg: '#064e3b',
    sidebarText: '#a7f3d0',
    sidebarActiveBg: '#059669',
    sidebarActiveText: '#ffffff'
  },
  violet: {
    name: 'Violeta Moderno',
    primary: '#7c3aed',
    primaryHover: '#6d28d9',
    primaryLight: '#f5f3ff',
    primaryBorder: '#ddd6fe',
    badgeText: '#5b21b6',
    sidebarBg: '#1e1b4b',
    sidebarText: '#c4b5fd',
    sidebarActiveBg: '#7c3aed',
    sidebarActiveText: '#ffffff'
  },
  slate: {
    name: 'Slate Minimalista',
    primary: '#0f172a',
    primaryHover: '#1e293b',
    primaryLight: '#f1f5f9',
    primaryBorder: '#cbd5e1',
    badgeText: '#0f172a',
    sidebarBg: '#020617',
    sidebarText: '#94a3b8',
    sidebarActiveBg: '#334155',
    sidebarActiveText: '#ffffff'
  }
};

function getScreenIcon(name = '') {
  const n = name.toLowerCase();
  if (n.includes('login') || n.includes('acceso') || n.includes('sesion')) return 'login';
  if (n.includes('dash') || n.includes('inicio') || n.includes('principal')) return 'dashboard';
  if (n.includes('client') || n.includes('fichas') || n.includes('directorio')) return 'people';
  if (n.includes('vehic') || n.includes('auto') || n.includes('carr')) return 'directions_car';
  if (n.includes('cit') || n.includes('calen') || n.includes('agenda')) return 'calendar_month';
  if (n.includes('orden') || n.includes('trabaj') || n.includes('bitacora')) return 'engineering';
  if (n.includes('diag') || n.includes('falla') || n.includes('obd')) return 'build';
  if (n.includes('conoc') || n.includes('manual') || n.includes('guia')) return 'menu_book';
  if (n.includes('repuest') || n.includes('inven') || n.includes('stock')) return 'inventory_2';
  if (n.includes('cotiz') || n.includes('presupuesto')) return 'request_quote';
  if (n.includes('progres') || n.includes('seguim') || n.includes('avance')) return 'trending_up';
  if (n.includes('rep') || n.includes('estad') || n.includes('kpi') || n.includes('tablero')) return 'analytics';
  if (n.includes('usuar') || n.includes('rol') || n.includes('audit')) return 'admin_panel_settings';
  if (n.includes('conf') || n.includes('ajust')) return 'settings';
  return 'article';
}

function getRoleIcon(role = '') {
  const r = role.toLowerCase();
  if (r.includes('admin') || r.includes('gerent')) return 'admin_panel_settings';
  if (r.includes('recep') || r.includes('ingres')) return 'directions_car';
  if (r.includes('mecanic') || r.includes('tecnic') || r.includes('taller')) return 'build';
  if (r.includes('client') || r.includes('portal')) return 'person';
  if (r.includes('acces') || r.includes('login') || r.includes('public')) return 'login';
  return 'badge';
}

function resolveScreenActor(s) {
  if (s.actorName && s.actorName.trim()) return s.actorName.trim();
  if (s.categoryName && s.categoryName.trim()) return s.categoryName.trim();
  
  const catalogMatch = SCREEN_CATALOG.find(cat => {
    if (cat.route && s.route && cat.route === s.route) return true;
    if (cat.match && cat.match.test(s.name || '')) return true;
    return false;
  });

  if (catalogMatch) return catalogMatch.actorName || catalogMatch.categoryName;

  const n = (s.name || '').toLowerCase();
  if (n.includes('login') || n.includes('acceso')) return 'Acceso y Login';
  if (n.includes('recep') || n.includes('cita') || n.includes('cliente') || n.includes('vehiculo')) return 'Recepción';
  if (n.includes('diag') || n.includes('orden') || n.includes('taller') || n.includes('conocimiento')) return 'Mecánico';
  if (n.includes('portal') || n.includes('mis vehic') || n.includes('cotiz')) return 'Portal del Cliente';
  if (n.includes('report') || n.includes('usuario') || n.includes('admin') || n.includes('indicador')) return 'Administrador';

  return 'Operaciones del Sistema';
}

export default function AppShellPreview({
  screen,
  project,
  allScreens = [],
  onSelectScreen,
  themeConfig = { color: 'indigo', layout: 'sidebar', showShell: true },
  children
}) {
  const currentTheme = THEMES[themeConfig?.color] || THEMES.indigo;
  const layout = themeConfig?.layout || 'sidebar';
  const showShell = themeConfig?.showShell !== false;

  const screenList = allScreens.length > 0 ? allScreens : (screen ? [screen] : []);
  const title = screen?.name || screen?.title || 'Vista del Sistema';
  const route = screen?.route || '/modulo';

  // 1. Agrupación semántica por Roles / Actores
  const groupedByRole = useMemo(() => {
    const groups = {};
    for (const s of screenList) {
      const role = resolveScreenActor(s);
      if (!groups[role]) {
        groups[role] = [];
      }
      groups[role].push(s);
    }
    return groups;
  }, [screenList]);

  const availableRoles = useMemo(() => Object.keys(groupedByRole), [groupedByRole]);

  // 2. Rol activo actual simulado (por defecto 'ALL' o el rol de la pantalla seleccionada)
  const [selectedRoleFilter, setSelectedRoleFilter] = useState('ALL');

  // Si se selecciona un rol en particular, filtrar solo las pantallas de ese rol
  const visibleGroups = useMemo(() => {
    if (selectedRoleFilter === 'ALL') return groupedByRole;
    return {
      [selectedRoleFilter]: groupedByRole[selectedRoleFilter] || []
    };
  }, [groupedByRole, selectedRoleFilter]);

  // Perfil del usuario simulado según el rol
  const userProfile = useMemo(() => {
    if (selectedRoleFilter === 'Mecánico') {
      return { name: 'Ing. Javier Morales', role: 'Técnico Mecánico Especialista', initials: 'JM', icon: 'build' };
    }
    if (selectedRoleFilter === 'Recepción') {
      return { name: 'Elena Ramírez', role: 'Atención y Recepción de Vehículos', initials: 'ER', icon: 'directions_car' };
    }
    if (selectedRoleFilter === 'Cliente' || selectedRoleFilter === 'Portal del Cliente') {
      return { name: 'Carlos Mendoza', role: 'Cliente Particular', initials: 'CM', icon: 'person' };
    }
    if (selectedRoleFilter === 'Administrador') {
      return { name: 'Lic. Roberto Gómez', role: 'Administrador General del Sistema', initials: 'RG', icon: 'admin_panel_settings' };
    }
    return { name: 'Usuario Principal', role: 'Superusuario (Todos los Roles)', initials: 'SA', icon: 'shield' };
  }, [selectedRoleFilter]);

  if (!showShell) {
    return <div className="standalone-mockup-wrapper">{children}</div>;
  }

  return (
    <div className="unified-app-shell" style={{
      display: 'flex',
      flexDirection: 'column',
      width: '100%',
      minHeight: '680px',
      backgroundColor: '#f8fafc',
      borderRadius: '12px',
      overflow: 'hidden',
      border: '1px solid #cbd5e1',
      boxShadow: '0 10px 25px -5px rgba(15, 23, 42, 0.08), 0 8px 10px -6px rgba(15, 23, 42, 0.04)',
      fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
      {/* 1. Barra de Control de la Ventana (Browser Chrome Header) */}
      <div style={{
        backgroundColor: '#ffffff',
        borderBottom: '1px solid #e2e8f0',
        padding: '8px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        fontSize: '0.8rem',
        flexWrap: 'wrap',
        gap: '8px'
      }}>
        {/* Puntos de ventana macOS */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#ef4444', display: 'inline-block' }} />
          <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#f59e0b', display: 'inline-block' }} />
          <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#10b981', display: 'inline-block' }} />
          <span style={{ marginLeft: '12px', fontWeight: 600, color: '#334155', fontSize: '0.8rem' }}>
            {project?.name || 'Sistema de Gestión'}
          </span>
        </div>

        {/* Barra de URL interactiva */}
        <div style={{
          backgroundColor: '#f1f5f9',
          padding: '4px 14px',
          borderRadius: '6px',
          border: '1px solid #e2e8f0',
          fontFamily: 'ui-monospace, monospace',
          fontSize: '0.75rem',
          color: '#475569',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          minWidth: '260px',
          justifyContent: 'center'
        }}>
          <span style={{ color: '#10b981', fontSize: '10px' }}>●</span>
          <span>https://app.{project?.name ? project.name.toLowerCase().replace(/[^a-z0-9]/g, '') : 'sistema'}.com{route}</span>
        </div>

        {/* Selector de Simulación de Rol */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '0.725rem', color: '#64748b', fontWeight: 600 }}>Perfil Activo:</span>
          <select
            value={selectedRoleFilter}
            onChange={e => setSelectedRoleFilter(e.target.value)}
            style={{
              padding: '3px 8px',
              borderRadius: '6px',
              border: `1px solid ${currentTheme.primaryBorder}`,
              backgroundColor: currentTheme.primaryLight,
              color: currentTheme.badgeText,
              fontWeight: 600,
              fontSize: '0.725rem',
              cursor: 'pointer',
              outline: 'none'
            }}
          >
            <option value="ALL">✦ Todos los Roles ({screenList.length} vistas)</option>
            {availableRoles.map(r => (
              <option key={r} value={r}>
                {r} ({groupedByRole[r]?.length || 0})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 2. Disposición: Top Navbar (si layout === 'topbar') */}
      {layout === 'topbar' && (
        <div style={{
          backgroundColor: currentTheme.sidebarBg,
          color: '#ffffff',
          padding: '0 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          minHeight: '52px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.06)',
          flexWrap: 'wrap',
          gap: '8px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, fontSize: '0.95rem' }}>
              <span className="ms ms-sm" style={{ color: currentTheme.primary }}>apps</span>
              <span>{project?.name || 'Sistema'}</span>
            </div>

            {/* Enlaces de navegación con selector de rol */}
            <div style={{ display: 'flex', gap: '4px', overflowX: 'auto', padding: '4px 0' }}>
              {screenList.map(s => {
                const isActive = (s.id === screen?.id) || (s.name === screen?.name);
                return (
                  <button
                    key={s.id || s.name}
                    onClick={() => onSelectScreen && onSelectScreen(s.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '6px 12px',
                      borderRadius: '6px',
                      fontSize: '0.8rem',
                      fontWeight: isActive ? 600 : 400,
                      color: isActive ? currentTheme.sidebarActiveText : currentTheme.sidebarText,
                      backgroundColor: isActive ? currentTheme.sidebarActiveBg : 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    <span className="ms ms-xs">{getScreenIcon(s.name)}</span>
                    <span>{s.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.8rem' }}>
            <span style={{ opacity: 0.85, fontSize: '0.75rem' }}>{userProfile.role}</span>
            <div style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: currentTheme.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: '0.75rem' }}>
              {userProfile.initials}
            </div>
          </div>
        </div>
      )}

      {/* 3. Cuerpo Principal: Sidebar Agrupado por Roles + Área de Contenido */}
      <div style={{ display: 'flex', flex: 1, minHeight: '580px' }}>
        {layout === 'sidebar' && (
          <aside style={{
            width: '260px',
            backgroundColor: currentTheme.sidebarBg,
            color: currentTheme.sidebarText,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            borderRight: '1px solid #1e293b',
            flexShrink: 0
          }}>
            <div>
              {/* Header del Sidebar */}
              <div style={{
                padding: '16px',
                borderBottom: '1px solid rgba(255,255,255,0.06)',
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
              }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  backgroundColor: currentTheme.primary,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: '0.9rem'
                }}>
                  {project?.name ? project.name.charAt(0).toUpperCase() : 'S'}
                </div>
                <div>
                  <div style={{ color: '#ffffff', fontWeight: 700, fontSize: '0.875rem', lineHeight: 1.2 }}>
                    {project?.name || 'Sistema ICASE'}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
                    Control de Acceso por Roles
                  </div>
                </div>
              </div>

              {/* Selector de Rol en Sidebar */}
              <div style={{ padding: '10px 12px 6px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <div style={{ fontSize: '0.675rem', fontWeight: 700, textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.05em', marginBottom: '4px' }}>
                  Filtrar Vista por Rol
                </div>
                <select
                  value={selectedRoleFilter}
                  onChange={e => setSelectedRoleFilter(e.target.value)}
                  style={{
                    width: '100%',
                    backgroundColor: 'rgba(255,255,255,0.06)',
                    color: '#ffffff',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '6px',
                    padding: '5px 8px',
                    fontSize: '0.75rem',
                    outline: 'none',
                    cursor: 'pointer'
                  }}
                >
                  <option value="ALL" style={{ backgroundColor: '#0f172a', color: '#fff' }}>
                    ✦ Todos los Roles ({screenList.length})
                  </option>
                  {availableRoles.map(r => (
                    <option key={r} value={r} style={{ backgroundColor: '#0f172a', color: '#fff' }}>
                      {r} ({groupedByRole[r]?.length || 0})
                    </option>
                  ))}
                </select>
              </div>

              {/* Módulos agrupados por Rol / Actor */}
              <div style={{ padding: '8px', maxHeight: '420px', overflowY: 'auto' }}>
                {Object.entries(visibleGroups).map(([roleName, screensInRole]) => {
                  if (!screensInRole || screensInRole.length === 0) return null;
                  return (
                    <div key={roleName} style={{ marginBottom: '14px' }}>
                      {/* Cabecera de Sección por Rol */}
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '4px 8px',
                        marginBottom: '4px'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span className="ms ms-xs" style={{ color: currentTheme.primary, fontSize: '13px' }}>
                            {getRoleIcon(roleName)}
                          </span>
                          <span style={{
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            color: '#cbd5e1',
                            letterSpacing: '0.04em'
                          }}>
                            {roleName}
                          </span>
                        </div>
                        <span style={{
                          fontSize: '0.625rem',
                          backgroundColor: 'rgba(255,255,255,0.08)',
                          color: '#94a3b8',
                          padding: '1px 5px',
                          borderRadius: '4px',
                          fontWeight: 600
                        }}>
                          {screensInRole.length}
                        </span>
                      </div>

                      {/* Pantallas del Rol */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        {screensInRole.map(s => {
                          const isActive = (s.id === screen?.id) || (s.name === screen?.name);
                          return (
                            <button
                              key={s.id || s.name}
                              onClick={() => onSelectScreen && onSelectScreen(s.id)}
                              style={{
                                width: '100%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: '8px',
                                padding: '7px 10px',
                                borderRadius: '6px',
                                fontSize: '0.785rem',
                                fontWeight: isActive ? 600 : 400,
                                color: isActive ? currentTheme.sidebarActiveText : currentTheme.sidebarText,
                                backgroundColor: isActive ? currentTheme.sidebarActiveBg : 'transparent',
                                border: 'none',
                                cursor: 'pointer',
                                textAlign: 'left',
                                transition: 'all 0.15s ease'
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                                <span className="ms ms-xs" style={{ opacity: isActive ? 1 : 0.7 }}>
                                  {getScreenIcon(s.name)}
                                </span>
                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {s.name}
                                </span>
                              </div>
                              {isActive && (
                                <span style={{ fontSize: '9px', backgroundColor: 'rgba(255,255,255,0.25)', padding: '1px 4px', borderRadius: '3px' }}>
                                  Activo
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Footer de Usuario Simulado en Sidebar */}
            <div style={{
              padding: '12px 14px',
              borderTop: '1px solid rgba(255,255,255,0.06)',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              backgroundColor: 'rgba(0,0,0,0.15)'
            }}>
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                backgroundColor: currentTheme.primary,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                fontWeight: 700,
                fontSize: '0.75rem',
                flexShrink: 0
              }}>
                {userProfile.initials}
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ color: '#ffffff', fontSize: '0.775rem', fontWeight: 600, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {userProfile.name}
                </div>
                <div style={{ fontSize: '0.675rem', color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {userProfile.role}
                </div>
              </div>
            </div>
          </aside>
        )}

        {/* 4. Área de Trabajo Central */}
        <main style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: '#f8fafc',
          overflow: 'hidden'
        }}>
          {/* Header Superior del Área de Contenido con Role Badge */}
          <div style={{
            backgroundColor: '#ffffff',
            borderBottom: '1px solid #e2e8f0',
            padding: '14px 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '10px'
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <h1 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: '#0f172a' }}>
                  {title}
                </h1>
                <span style={{
                  fontSize: '0.7rem',
                  fontFamily: 'monospace',
                  padding: '2px 8px',
                  backgroundColor: '#f1f5f9',
                  color: '#475569',
                  borderRadius: '4px',
                  border: '1px solid #e2e8f0'
                }}>
                  {route}
                </span>

                {/* Rol asignado a esta pantalla */}
                <span style={{
                  fontSize: '0.7rem',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  backgroundColor: currentTheme.primaryLight,
                  color: currentTheme.badgeText,
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  <span className="ms ms-xs" style={{ fontSize: '11px' }}>{getRoleIcon(resolveScreenActor(screen || {}))}</span>
                  Rol: {resolveScreenActor(screen || {})}
                </span>
              </div>
              <p style={{ margin: '4px 0 0', fontSize: '0.775rem', color: '#64748b' }}>
                {screen?.description || screen?.purpose || `Módulo operativo integrado para el rol de ${resolveScreenActor(screen || {})}.`}
              </p>
            </div>

            {/* Indicador de Estado y Acciones Rápidas */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                fontSize: '0.75rem',
                color: '#065f46',
                backgroundColor: '#ecfdf5',
                padding: '4px 10px',
                borderRadius: '6px',
                border: '1px solid #a7f3d0',
                fontWeight: 600
              }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10b981' }} />
                En Línea
              </span>
            </div>
          </div>

          {/* Contenedor del contenido */}
          <div style={{
            flex: 1,
            padding: '20px',
            overflowY: 'auto'
          }}>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

export { THEMES };
