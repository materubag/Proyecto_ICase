'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { deriveNaming, normalizeAttributes, toCamelCase, toPascalCase } = require('./typeMapper');
const { inferScreenEntity, compactNavLabel, screenTabKey } = require('./screenContract');
const { getProjectCustomizations, getProjectScreenOverrides, saveProjectScreenOverride, getEffectiveScreensByRoleForSpec, formatScreensByRoleCode } = require('./codegenCustomizationStore');

/**
 * Extrae el Sistema de Diseño unificado a partir de los Mockups aprobados del proyecto
 * para garantizar coherencia visual en toda la aplicación generada.
 */
function extractProjectDesignSystem(spec = {}) {
  const screens = Array.isArray(spec.screens) ? spec.screens : [];
  let primary = '#3525cd';
  let secondary = '#4f46e5';
  let bgApp = '#f8f9ff';
  let fontFamily = 'Inter';

  for (const scr of screens) {
    const html = String(scr.html || '');
    if (!html) continue;
    const primaryMatch = html.match(/"primary"\s*:\s*"(#[0-9a-fA-F]{6})"/) || html.match(/--color-primary:\s*(#[0-9a-fA-F]{6})/);
    if (primaryMatch && primaryMatch[1]) {
      primary = primaryMatch[1];
      break;
    }
  }

  for (const scr of screens) {
    const html = String(scr.html || '');
    const bgMatch = html.match(/"background"\s*:\s*"(#[0-9a-fA-F]{6})"/);
    if (bgMatch && bgMatch[1]) {
      bgApp = bgMatch[1];
      break;
    }
  }

  return {
    projectName: spec?.project?.name || 'Aplicación',
    projectDescription: spec?.project?.description || 'Sistema de Gestión Integral',
    primary,
    secondary,
    bgApp,
    fontFamily
  };
}

function stripTags(html = '') {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

function pickScreenIcon(title = '', route = '') {
  const t = `${title} ${route}`.toLowerCase();
  if (/tablero|dashboard|reporte|indicador/.test(t)) return 'analytics';
  if (/repuesto|inventario|stock|producto|bodega/.test(t)) return 'inventory_2';
  if (/cliente|directorio|paciente|alumno|socio/.test(t)) return 'group';
  if (/servicio|catalogo|tarifa/.test(t)) return 'design_services';
  if (/mantenimiento|preventivo/.test(t)) return 'event_repeat';
  if (/conocimiento|obd|manual|biblioteca/.test(t)) return 'menu_book';
  if (/usuario|auditor|cuenta/.test(t)) return 'manage_accounts';
  if (/rol|permiso|seguridad/.test(t)) return 'security';
  if (/notificaci|aviso|alerta/.test(t)) return 'notifications';
  if (/recepci|inspecci|ingreso|admisi/.test(t)) return 'fact_check';
  if (/cita|agenda|calendario|reserva|turno/.test(t)) return 'calendar_month';
  if (/vehiculo|auto|flota|expediente/.test(t)) return 'directions_car';
  if (/venta|mostrador|caja|factura|cobro/.test(t)) return 'point_of_sale';
  if (/compra|proveedor|abastecimiento/.test(t)) return 'local_shipping';
  if (/diagnostico|averia|evaluaci|triaje/.test(t)) return 'troubleshoot';
  if (/orden|reparaci|bitacora|taller|tratamiento/.test(t)) return 'handyman';
  if (/cotizaci|presupuesto|aprobaci/.test(t)) return 'request_quote';
  if (/seguimiento|avance|progreso|estado/.test(t)) return 'timelapse';
  return 'widgets';
}

function isSystemAuditField(fieldName = '') {
  const norm = String(fieldName || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  return [
    'id',
    'createdat', 'updatedat', 'deletedat',
    'created_at', 'updated_at', 'deleted_at',
    'fechacreacion', 'fecha_creacion',
    'fecharegistro', 'fecha_registro',
    'fechaactualizacion', 'fecha_actualizacion',
    'fechamodificacion', 'fecha_modificacion',
    'fechageneracion', 'fecha_generacion',
    'fechadecision', 'fecha_decision',
    'fecharesolucion', 'fecha_resolucion',
    'fechacierre', 'fecha_cierre',
    'hashcontrasena', 'passwordhash', 'password_hash',
    'isdeleted', 'is_deleted',
    'usuarioid', 'usuario_id', 'userid', 'user_id', 'createdbyid'
  ].includes(norm);
}

/**
 * Extrae el plano estructural y visual (Blueprint) del Mockup HTML de la pantalla
 * descartando filas estáticas, números quemados y barras de navegación duplicadas.
 */
function extractMockupBlueprint(scr = {}, spec = {}) {
  const html = String(scr.html || '');
  const title = (scr.title || scr.name || 'Módulo').replace(/\s*[-–]\s*Autron5?\s*$/i, '').trim();

  // 1. Extraer subtítulo o propósito real desde el mockup
  let subtitle = scr.contract?.purpose || '';
  const pMatches = [...html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
    .map(m => stripTags(m[1]))
    .filter(txt => txt.length > 25 && txt.length < 220 && !/copyright|derechos reservados|iniciar sesi/i.test(txt));
  if (pMatches.length > 0) {
    subtitle = pMatches[0];
  }
  if (!subtitle) {
    subtitle = `Gestión operativa y registro conectado en tiempo real para ${title}.`;
  }

  // 2. Extraer etiquetas de tarjetas KPI / indicadores del mockup (sin los números estáticos)
  const kpiLabels = [];
  const labelRegex = /<(?:span|p|h4|div)[^>]*class="[^"]*(?:uppercase|tracking-wider|text-xs|font-semibold|text-on-surface-variant|text-slate-500)[^"]*"[^>]*>([\s\S]*?)<\/(?:span|p|h4|div)>/gi;
  let m;
  while ((m = labelRegex.exec(html)) !== null) {
    const text = stripTags(m[1]);
    if (
      text.length >= 4 &&
      text.length <= 36 &&
      !/^(id|acciones|estado|fecha|cliente|veh[ií]culo|placa|total|subtotal|buscar|filtrar|men[uú]|portal|m[oó]dulo|rf-|uc-)/i.test(text) &&
      !/^\d/.test(text) &&
      !kpiLabels.includes(text)
    ) {
      kpiLabels.push(text);
    }
    if (kpiLabels.length >= 4) break;
  }

  // 3. Extraer etiquetas de botones principales del mockup
  let primaryButtonLabel = 'Guardar Registro';
  const btnMatches = [...html.matchAll(/<button[^>]*>([\s\S]*?)<\/button>/gi)]
    .map(b => stripTags(b[1]).replace(/^[+a-z_]+\s+/i, '').trim())
    .filter(txt => txt.length >= 4 && txt.length <= 38 && /^(registrar|guardar|crear|nuevo|nueva|emitir|confirmar|solicitar|agendar|aprobar|programar|ingresar)/i.test(txt));
  if (btnMatches.length > 0) {
    primaryButtonLabel = btnMatches[0];
  }

  // 4. Determinar entidad principal con resolución inteligente para cualquier dominio
  let normTitle = (scr.title || scr.name || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  normTitle = normTitle.replace(/^portal\s+cliente:\s*/i, '').trim();
  const normRoute = String(scr.route || '').toLowerCase().replace(/^\/+/, '');

  let entity = null;

  // Priorizar concordancia semántica clara de la pantalla sin falsos positivos de prefijos
  if (/recepci|inspecci/i.test(normTitle) || /recepcion/i.test(normRoute)) {
    entity = (spec.entities || []).find(e => e.name === 'RECEPCION' || /recepcion/i.test(e.name));
  } else if (/\bventas?\b|mostrador/i.test(normTitle) || /ventas/i.test(normRoute)) {
    entity = (spec.entities || []).find(e => e.name === 'VENTA' || (/\bventas?\b/i.test(e.name.replace(/_/g, ' ')) && !/detalle/i.test(e.name)));
  } else if (/\bcompras?\b/i.test(normTitle) || /compras/i.test(normRoute)) {
    entity = (spec.entities || []).find(e => e.name === 'COMPRA' || (/compra/i.test(e.name) && !/detalle/i.test(e.name)));
  } else if (/\bcitas?\b|agenda/i.test(normTitle) || /citas/i.test(normRoute)) {
    entity = (spec.entities || []).find(e => e.name === 'CITA' || /cita/i.test(e.name));
  } else if (/presupuesto|cotiz/i.test(normTitle) || /cotiza/i.test(normRoute)) {
    entity = (spec.entities || []).find(e => e.name === 'COTIZACION' || /cotizacion/i.test(e.name));
  } else if (/diagn[oó]stico|averia/i.test(normTitle) || /diagnostico/i.test(normRoute)) {
    entity = (spec.entities || []).find(e => e.name === 'DIAGNOSTICO' || /diagnostico/i.test(e.name));
  } else if (/inventario|repuesto|stock/i.test(normTitle) || /inventario/i.test(normRoute)) {
    entity = (spec.entities || []).find(e => e.name === 'PRODUCTO' || /producto|repuesto/i.test(e.name));
  } else if (/orden.*trabajo|bitacora|reparacion|seguimiento|avance|progreso/i.test(normTitle) || /reparacion|progreso/i.test(normRoute)) {
    entity = (spec.entities || []).find(e => e.name === 'ORDEN_TRABAJO' || (/orden.*trabajo/i.test(e.name) && !/detalle/i.test(e.name)));
  } else if (/veh[ií]culo/i.test(normTitle) || /vehiculo/i.test(normRoute)) {
    entity = (spec.entities || []).find(e => e.name === 'VEHICULO' || /vehiculo/i.test(e.name));
  } else if (/proveedor/i.test(normTitle) || /proveedor/i.test(normRoute)) {
    entity = (spec.entities || []).find(e => e.name === 'PROVEEDOR' || /proveedor/i.test(e.name));
  } else if (/servicio|tarifa/i.test(normTitle) || /servicios/i.test(normRoute)) {
    entity = (spec.entities || []).find(e => e.name === 'SERVICIO' || /servicio/i.test(e.name));
  } else if (/cliente/i.test(normTitle) || /clientes/i.test(normRoute)) {
    entity = (spec.entities || []).find(e => e.name === 'CLIENTE' || /cliente/i.test(e.name));
  } else if (/usuario|auditor/i.test(normTitle) || /usuarios/i.test(normRoute)) {
    entity = (spec.entities || []).find(e => e.name === 'USUARIO' || /usuario/i.test(e.name));
  } else if (/conocimiento|obd/i.test(normTitle) || /conocimiento/i.test(normRoute)) {
    entity = (spec.entities || []).find(e => e.name === 'OBD_CONOCIMIENTO' || /obd.*conocimiento/i.test(e.name));
  } else if (/tablero|reporte|indicador|dashboard/i.test(normTitle) || /reportes/i.test(normRoute)) {
    entity = (spec.entities || []).find(e => e.name === 'ORDEN_TRABAJO' || (/orden.*trabajo/i.test(e.name) && !/detalle/i.test(e.name)));
  }

  // Fallback a coincidencia por slug de ruta
  if (!entity) {
    entity = (spec.entities || []).find(e => {
      const slug = (e.endpoint || deriveNaming(e.name).endpoint || '').toLowerCase();
      return slug && (normRoute === slug || normRoute.startsWith(slug + '/') || slug.startsWith(normRoute));
    });
  }

  if (!entity && scr.targetEntity) {
    entity = (spec.entities || []).find(e => [e.id, e.name, e.modelName].includes(scr.targetEntity));
  }

  if (!entity) {
    entity = (spec.entities || []).find(e => {
      const eName = (e.name || e.modelName || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
      return eName.length >= 3 && (normTitle.includes(eName) || normRoute.includes(eName));
    });
  }

  if (!entity) {
    entity = inferScreenEntity(scr, spec.entities || []);
  }

  if (!entity && scr.entity) {
    entity = (spec.entities || []).find(e => [e.id, e.name, e.modelName].includes(scr.entity));
  }

  // 5. Determinar si el mockup / entidad verdaderamente requiere subida de fotos / multimedia
  const explicitPhotoEntities = ['EVIDENCIA_MULTIMEDIA', 'EVIDENCIA', 'RECEPCION', 'DIAGNOSTICO'];
  const hasPhotoAttr = (entity?.attributes || []).some(a => /evidencia|foto|imagen|multimedia|archivo/i.test(a.fieldName || a.name));
  const isPhotoDomainScreen = /recepci|inspecci|diagn[oó]stico|evidencia|multimedia|da[ñn]o|peritaje/i.test(title + ' ' + (scr.route || ''));
  const hasPhotoUpload = Boolean(
    (hasPhotoAttr || explicitPhotoEntities.includes(entity?.name) || isPhotoDomainScreen) &&
    /type=["']file["']|evidencia|subir foto|c[aá]mara|add_a_photo|cloud_upload/i.test(html + ' ' + title)
  );

  const fields = [];
  const relations = [];

  if (entity) {
    const attrs = normalizeAttributes(entity.attributes || []);
    for (const attr of attrs) {
      const fname = attr.fieldName || attr.name;
      if (!fname || attr.isPk || isSystemAuditField(fname)) {
        continue;
      }
      const isFk = /Id$/i.test(fname);
      let relEndpoint = null;
      let relLabelField = 'nombre';
      if (isFk) {
        const baseName = fname.replace(/Id$/i, '').toLowerCase();
        const targetEnt = (spec.entities || []).find(e => {
          const n = (e.name || e.modelName || '').toLowerCase().replace(/[^a-z0-9]/g, '');
          return n === baseName || n.includes(baseName) || baseName.includes(n);
        });
        if (targetEnt) {
          const naming = deriveNaming(targetEnt.name);
          relEndpoint = `/${targetEnt.endpoint || naming.endpoint}`;
          const tAttrs = normalizeAttributes(targetEnt.attributes || []);
          const lbl = tAttrs.find(a => /nombre|placa|codigo|descripcion|titulo|correo/i.test(a.fieldName || a.name));
          if (lbl) relLabelField = lbl.fieldName || lbl.name;
        }
      }

      const humanLabel = (attr.originalName || fname)
        .replace(/Id$/i, '')
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .replace(/_/g, ' ')
        .replace(/^./, c => c.toUpperCase())
        .trim();

      const dataType = String(attr.dataType || attr.type || 'STRING').toUpperCase();
      let inputType = 'text';
      if (isFk && relEndpoint) {
        inputType = 'select-relation';
        relations.push({ field: fname, endpoint: relEndpoint, labelField: relLabelField, label: humanLabel });
      } else if (/DATE/.test(dataType) || /fecha/i.test(fname)) {
        inputType = 'date';
      } else if (/INT|DECIMAL|FLOAT|NUMERIC|DOUBLE/.test(dataType) || /precio|costo|monto|total|stock|cantidad|kilometraje|anio|capacidad/i.test(fname)) {
        inputType = 'number';
      } else if (/BOOL/.test(dataType) || /^activo|leida|disponible/i.test(fname)) {
        inputType = 'checkbox';
      } else if (/motivo|observacion|descripcion|detalle|notas|diagnostico|solucion/i.test(fname)) {
        inputType = 'textarea';
      } else if (/estado|fase|prioridad|severidad|tipo/i.test(fname)) {
        inputType = 'status-select';
      }

      fields.push({
        name: fname,
        label: humanLabel,
        type: inputType,
        required: Boolean(!attr.allowNull && inputType !== 'checkbox'),
        relEndpoint,
        relLabelField
      });
    }
  }

  // Si la pantalla no tenía entidad directa o tenía pocos campos, extraer campos adicionales de los inputs del mockup
  if (fields.length === 0) {
    const inputMatches = [...html.matchAll(/<label[^>]*>([\s\S]*?)<\/label>/gi)]
      .map(m => stripTags(m[1]).replace(/\*/g, '').trim())
      .filter(l => l.length >= 2 && l.length <= 35);
    const seen = new Set();
    for (const lbl of inputMatches.slice(0, 6)) {
      const key = toCamelCase(lbl.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9\s]/g, ' '));
      if (!key || seen.has(key) || isSystemAuditField(key) || ['buscar', 'filtrar', 'desde', 'hasta'].includes(key)) continue;
      seen.add(key);
      fields.push({
        name: key,
        label: lbl,
        type: /fecha/i.test(lbl) ? 'date' : (/precio|costo|total|cantidad|km|kilometraje|stock/i.test(lbl) ? 'number' : 'text'),
        required: fields.length < 2
      });
    }
  }

  if (fields.length === 0) {
    fields.push(
      { name: 'codigo', label: 'Código / Referencia', type: 'text', required: true },
      { name: 'nombre', label: 'Nombre / Concepto', type: 'text', required: true },
      { name: 'descripcion', label: 'Descripción Operativa', type: 'textarea', required: false },
      { name: 'estado', label: 'Estado', type: 'status-select', required: false }
    );
  }

  const endpointSlug = entity
    ? (entity.endpoint || deriveNaming(entity.name).endpoint)
    : String(scr.route || scr.name || 'registros').replace(/^\/+/, '').toLowerCase().replace(/[^a-z0-9-]+/g, '-');

  return {
    title,
    subtitle,
    icon: pickScreenIcon(title, scr.route),
    endpoint: `/${endpointSlug}`,
    entityName: entity ? (entity.name || entity.modelName) : title,
    kpiLabels: kpiLabels.length >= 2 ? kpiLabels.slice(0, 4) : [
      'Total Registrados',
      'Activos en Proceso',
      'Completados / Confirmados',
      'Atención Prioritaria'
    ],
    primaryButtonLabel,
    hasPhotoUpload,
    fields: fields.slice(0, 8),
    relations
  };
}

/**
 * Genera el componente AppShell.jsx unificado con el sistema de diseño del proyecto.
 */
function generateCohesiveAppShellJsx(spec = {}, design = {}) {
  const projectId = spec?.project?.id;
  const projectName = design.projectName || spec?.project?.name || 'Aplicación';
  const primary = design.primary || '#3525cd';
  const customizations = getProjectCustomizations(projectId);
  const showApiBadge = customizations?.hideApiStatusBadge === false; // Oculto por defecto para una interfaz limpia

  return `import React, { useState } from 'react';
import apiClient from '../api/client';

export default function AppShell({
  title = ${JSON.stringify(projectName)},
  user,
  onLogout,
  children,
  navItems = [],
  activeTab,
  onSelectTab
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [showPwdModal, setShowPwdModal] = useState(false);
  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [pwdError, setPwdError] = useState('');
  const [pwdSuccess, setPwdSuccess] = useState('');
  const [pwdBusy, setPwdBusy] = useState(false);

  const currentRole = user?.role || user?.rol || 'Usuario';

  const choose = (key) => {
    onSelectTab(key);
    setMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-[#f8f9ff] text-[#0b1c30] flex flex-col font-sans">
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-xs">
        <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16 gap-4">
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => choose(navItems[0]?.key || 'dashboard')}
              className="flex items-center gap-2.5 text-left group focus:outline-none"
            >
              <div
                style={{ backgroundColor: '${primary}' }}
                className="w-9 h-9 rounded-xl text-white flex items-center justify-center font-bold shadow-xs transition-transform group-hover:scale-105"
              >
                <span className="material-symbols-outlined text-[20px]">apps</span>
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span style={{ color: '${primary}' }} className="font-bold text-base sm:text-lg tracking-tight">
                    {title}
                  </span>
                  <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 leading-none">
                    v1.0
                  </span>
                </div>
                <div className="text-[10.5px] text-slate-500 leading-none font-medium mt-0.5">
                  Rol activo: <span className="text-slate-800 font-semibold">{currentRole}</span>
                </div>
              </div>
            </button>
          </div>

          <nav aria-label="Módulos" className="hidden md:flex items-center gap-1 h-full min-w-0 overflow-x-auto flex-1 justify-start">
            {navItems.map((item) => {
              const isActive = item.key === activeTab;
              return (
                <button
                  key={item.key}
                  type="button"
                  data-screen-key={item.key}
                  aria-label={item.label}
                  onClick={() => choose(item.key)}
                  style={isActive ? { borderBottomColor: '${primary}', color: '${primary}' } : undefined}
                  className={\`h-full px-3 py-2 text-xs font-semibold flex items-center gap-1.5 border-b-2 transition-all whitespace-nowrap \${
                    isActive
                      ? 'font-bold bg-indigo-50/60'
                      : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
                  }\`}
                >
                  {item.icon && (
                    <span className="material-symbols-outlined text-[17px]">
                      {item.icon}
                    </span>
                  )}
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          <div className="flex items-center gap-3 shrink-0">
            <div className="flex items-center gap-2">
              <div
                style={{ color: '${primary}' }}
                className="w-8 h-8 rounded-full bg-indigo-50 border border-indigo-200 font-bold flex items-center justify-center text-xs"
              >
                {(user?.nombre || user?.username || user?.email || 'U').charAt(0).toUpperCase()}
              </div>
              <div className="hidden lg:flex flex-col text-left leading-none">
                <span className="font-semibold text-xs text-slate-900 truncate max-w-[140px]">
                  {user?.nombre || user?.username || user?.email?.split('@')[0] || 'Sesión'}
                </span>
                <span className="text-[10px] text-slate-500 mt-0.5">{currentRole}</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowPwdModal(true);
                  setPwdError('');
                  setPwdSuccess('');
                  setCurrentPwd('');
                  setNewPwd('');
                  setConfirmPwd('');
                }}
                className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg border border-indigo-200 transition-colors ml-1 cursor-pointer"
                title="Actualizar clave temporal"
              >
                <span className="material-symbols-outlined text-[16px]">key</span>
                <span>Cambiar Clave</span>
              </button>
              {onLogout && (
                <button
                  type="button"
                  onClick={onLogout}
                  className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors ml-1"
                  title="Cerrar sesión"
                  aria-label="Cerrar sesión"
                >
                  <span className="material-symbols-outlined text-[19px]">logout</span>
                </button>
              )}
            </div>

            <button
              type="button"
              className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl border border-slate-200"
              aria-label="Abrir menú de módulos"
              onClick={() => setMenuOpen(!menuOpen)}
            >
              <span className="material-symbols-outlined text-[22px]">
                {menuOpen ? 'close' : 'menu'}
              </span>
            </button>
          </div>
        </div>

        {menuOpen && (
          <div className="max-h-[70vh] overflow-y-auto border-t border-slate-200 bg-white px-4 py-3 space-y-1 shadow-lg">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 px-3 py-1 flex items-center justify-between">
              <span>Pantallas de {currentRole}</span>
              <span>{navItems.length} vistas</span>
            </div>
            {navItems.map((item) => {
              const isActive = item.key === activeTab;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => choose(item.key)}
                  aria-label={item.label}
                  className={\`w-full text-left px-3 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2.5 transition-colors \${
                    isActive ? 'bg-indigo-600 text-white' : 'text-slate-800 hover:bg-slate-50'
                  }\`}
                >
                  <span className="material-symbols-outlined text-[18px]">{item.icon || 'widgets'}</span>
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        )}
      </header>

      <main className="flex-1 w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col">
        <div className="mb-4 flex items-center justify-between text-xs text-slate-600 bg-white px-4 py-2.5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center gap-2">
            <span style={{ color: '${primary}' }} className="material-symbols-outlined text-[16px]">folder_special</span>
            <span>Espacio de Trabajo:</span>
            <strong className="text-slate-900">{currentRole}</strong>
            <span className="text-slate-300">/</span>
            <span style={{ color: '${primary}' }} className="font-semibold">
              {navItems.find(i => i.key === activeTab)?.label || 'Panel Principal'}
            </span>
          </div>
          ${showApiBadge ? `<div className="hidden sm:flex items-center gap-2 text-[11px] text-slate-500">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>Conectado a API REST</span>
          </div>` : ''}
        </div>

        <div className="flex-1">{children}</div>
      </main>

      <footer className="border-t border-slate-200 bg-white py-3 px-4 text-xs text-slate-500 text-center">
        <div className="max-w-[1600px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div>
            <strong style={{ color: '${primary}' }}>{title}</strong> — Aplicación Web Generada con Coherencia Visual
          </div>
          <div className="text-[11px]">
            React 18 · Express · Sequelize · PostgreSQL
          </div>
        </div>
      </footer>

      {/* Modal: Actualizar Contraseña Temporal */}
      {showPwdModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                  <span className="material-symbols-outlined text-[20px]">lock_reset</span>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Actualizar Contraseña</h3>
                  <p className="text-[11px] text-slate-500">Establece tu contraseña definitiva de acceso</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowPwdModal(false)}
                className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 flex items-center justify-center transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setPwdError('');
                setPwdSuccess('');
                if (!currentPwd) {
                  setPwdError('Por favor ingresa tu clave temporal recibida.');
                  return;
                }
                if (newPwd.length < 8) {
                  setPwdError('La nueva contraseña debe tener al menos 8 caracteres.');
                  return;
                }
                if (newPwd !== confirmPwd) {
                  setPwdError('La confirmación no coincide con la nueva contraseña.');
                  return;
                }
                setPwdBusy(true);
                try {
                  if (typeof apiClient !== 'undefined' && apiClient?.post) {
                    await apiClient.post('/auth/change-password', {
                      claveActual: currentPwd,
                      nuevaClave: newPwd
                    });
                  }
                  setPwdSuccess('✓ ¡Contraseña actualizada exitosamente!');
                  setTimeout(() => {
                    setShowPwdModal(false);
                    setPwdSuccess('');
                    onLogout?.();
                  }, 1800);
                } catch (err) {
                  setPwdError(err.message || 'Error al actualizar la contraseña.');
                } finally {
                  setPwdBusy(false);
                }
              }}
              className="p-6 space-y-4"
            >
              {pwdError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px]">error</span>
                  <span>{pwdError}</span>
                </div>
              )}
              {pwdSuccess && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px]">check_circle</span>
                  <span>{pwdSuccess}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Clave Temporal Recibida *
                </label>
                <input
                  type="password"
                  required
                  value={currentPwd}
                  onChange={(e) => setCurrentPwd(e.target.value)}
                  placeholder="Introduce la clave temporal"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nueva Contraseña *
                </label>
                <input
                  type="password"
                  required
                  value={newPwd}
                  onChange={(e) => setNewPwd(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Confirmar Nueva Contraseña *
                </label>
                <input
                  type="password"
                  required
                  value={confirmPwd}
                  onChange={(e) => setConfirmPwd(e.target.value)}
                  placeholder="Repite la nueva contraseña"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowPwdModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={pwdBusy}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs transition-colors disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                >
                  {pwdBusy ? 'Guardando...' : 'Guardar Contraseña'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
`;
}

/**
 * Genera LoginPage.jsx dinámico basado en los Actores reales del proyecto en ICASE.
 */
function generateCohesiveLoginPageJsx(spec = {}, design = {}) {
  const projectName = design.projectName || spec?.project?.name || 'Aplicación';
  const primary = design.primary || '#3525cd';
  const actors = Array.isArray(spec.actors) && spec.actors.length > 0
    ? spec.actors.map(a => a.name || a)
    : ['Administrador', 'Recepción', 'Mecánico', 'Cliente'];

  const demoAccounts = actors.map((roleName) => {
    const slug = String(roleName)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');
    const email = slug.includes('admin')
      ? 'admin@nexora.ec'
      : slug.includes('recep')
        ? 'recepcion@nexora.ec'
        : slug.includes('mecanic')
          ? 'mecanico@nexora.ec'
          : slug.includes('client')
            ? 'cliente@nexora.ec'
            : `${slug || 'usuario'}@sistema.ec`;
    return {
      role: roleName,
      email,
      password: 'Password123!'
    };
  });

  return `import React, { useState } from 'react';
import apiClient from '../api/client';

const DEMO_ACCOUNTS = ${JSON.stringify(demoAccounts, null, 2)};

export default function LoginPage({ onLoginSuccess }) {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const performLogin = async (idVal, passVal, fallbackRole) => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.post('/auth/login', {
        identifier: idVal,
        password: passVal,
        role: fallbackRole
      });
      const token = response.token || response.data?.token;
      const user = response.user || response.data?.user;
      if (!token) {
        throw new Error('No se recibió token de sesión.');
      }
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user || { email: idVal, role: fallbackRole || 'Administrador' }));
      if (onLoginSuccess) {
        onLoginSuccess(token, user || { email: idVal, role: fallbackRole || 'Administrador' });
      }
    } catch (err) {
      setError(err.details?.message || err.message || 'Credenciales inválidas.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    performLogin(identifier, password);
  };

  return (
    <div className="min-h-screen bg-[#f8f9ff] flex items-center justify-center p-4 sm:p-6 font-sans">
      <div className="w-full max-w-4xl bg-white rounded-3xl border border-slate-200 shadow-lg overflow-hidden grid grid-cols-1 lg:grid-cols-12">
        <div
          style={{ backgroundColor: '${primary}' }}
          className="lg:col-span-5 p-8 text-white flex flex-col justify-between"
        >
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 text-xs font-semibold mb-6">
              <span className="material-symbols-outlined text-[16px]">verified_user</span>
              <span>Acceso Seguro por Rol (RBAC)</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
              ${projectName}
            </h1>
            <p className="text-sm text-white/80 mt-3 leading-relaxed">
              Inicia sesión con tu cuenta asignada para acceder únicamente a los módulos y operaciones habilitados para tu perfil.
            </p>
          </div>

          <div className="mt-8 pt-6 border-t border-white/15 space-y-3">
            <div className="text-xs font-bold uppercase tracking-wider text-white/75">
              Acceso rápido por Actor del Proyecto
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2">
              {DEMO_ACCOUNTS.map((acc) => (
                <button
                  key={acc.role}
                  type="button"
                  onClick={() => {
                    setIdentifier(acc.email);
                    setPassword(acc.password);
                    performLogin(acc.email, acc.password, acc.role);
                  }}
                  className="text-left px-3.5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 transition-colors flex items-center justify-between text-xs"
                >
                  <div>
                    <div className="font-bold text-white">{acc.role}</div>
                    <div className="text-[11px] text-white/75">{acc.email}</div>
                  </div>
                  <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="lg:col-span-7 p-8 sm:p-10 flex flex-col justify-center">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-slate-900">Iniciar Sesión</h2>
            <p className="text-xs text-slate-500 mt-1">
              Ingresa tus credenciales o selecciona un rol a la izquierda para probar el sistema.
            </p>
          </div>

          {error && (
            <div className="mb-5 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">error</span>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Correo Electrónico o Usuario
              </label>
              <input
                type="text"
                required
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="ej. admin@nexora.ec"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-indigo-600"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Contraseña
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-indigo-600"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{ backgroundColor: '${primary}' }}
              className="w-full py-3 px-4 rounded-xl text-white font-bold text-sm shadow-sm hover:opacity-95 transition-opacity disabled:opacity-60"
            >
              {loading ? 'Verificando credenciales...' : 'Ingresar al Sistema'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
`;
}

/**
 * Genera un componente React cohesivo y 100% funcional para cada pantalla a partir de su Mockup Blueprint
 * con modales interactivos para Creación/Edición, Inspección de Detalle y Confirmación de Eliminación,
 * conectado a la API REST sin datos estáticos.
 */
function generateCohesiveScreenComponentJsx(compName, scr = {}, spec = {}, design = {}) {
  const projectId = spec?.project?.id;
  const screenKey = screenTabKey(scr);
  const overrides = getProjectScreenOverrides(projectId);
  if (overrides && overrides[screenKey] && typeof overrides[screenKey].code === 'string') {
    return overrides[screenKey].code;
  }

  // Guía funcional por referencia de dominio para Autron con estilos modernos de Tailwind
  const isAutron = /autron/i.test((spec?.project?.name || '') + ' ' + (spec?.project?.description || ''));
  if (isAutron) {
    const refDir = path.join(__dirname, 'referenceBlueprints', 'autron');
    const possibleFiles = [
      `${compName}.jsx`,
      `${compName.replace(/[0-9]+Mockup$/, 'Mockup')}.jsx`,
      `${compName.replace(/Mockup$/, '')}.jsx`
    ];
    for (const pf of possibleFiles) {
      const fullP = path.join(refDir, pf);
      if (fs.existsSync(fullP)) {
        let code = fs.readFileSync(fullP, 'utf-8');
        code = code.replace(/export\s+default\s+function\s+([A-Za-z0-9_]+)/, `export default function ${compName}`);
        return code;
      }
    }
  }

  const bp = extractMockupBlueprint(scr, spec);
  const primary = design.primary || '#3525cd';

  return `import React, { useState, useEffect } from 'react';
import apiClient from '../../api/client';

const SCREEN_CONFIG = ${JSON.stringify(bp, null, 2)};

export default function ${compName}({ onNavigate }) {
  const [rows, setRows] = useState([]);
  const [relOptions, setRelOptions] = useState({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  // Filtros y Búsqueda
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Modales Interactivos
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [viewDetailRow, setViewDetailRow] = useState(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  // Retroalimentación al usuario
  const [toast, setToast] = useState(null);
  const [uploadedPhotos, setUploadedPhotos] = useState([]);

  const initialForm = () => {
    const obj = {};
    for (const f of SCREEN_CONFIG.fields) {
      obj[f.name] = f.type === 'checkbox' ? false : (f.type === 'status-select' ? 'ACTIVO' : '');
    }
    return obj;
  };

  const [form, setForm] = useState(initialForm);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get(SCREEN_CONFIG.endpoint).catch(() => []);
      const list = Array.isArray(res) ? res : (Array.isArray(res?.data) ? res.data : (Array.isArray(res?.items) ? res.items : []));
      setRows(list);

      if (Array.isArray(SCREEN_CONFIG.relations) && SCREEN_CONFIG.relations.length > 0) {
        const relEntries = await Promise.all(
          SCREEN_CONFIG.relations.map(async (rel) => {
            const rData = await apiClient.get(rel.endpoint).catch(() => []);
            const rList = Array.isArray(rData) ? rData : (Array.isArray(rData?.data) ? rData.data : (Array.isArray(rData?.items) ? rData.items : []));
            return [rel.field, rList];
          })
        );
        setRelOptions(Object.fromEntries(relEntries));
      }
    } catch (err) {
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await apiClient.post('/upload', fd);
      const url = res?.url || res?.data?.url || res?.fileUrl;
      if (url) {
        setUploadedPhotos((prev) => [...prev, { name: file.name, url }]);
        setToast({ type: 'success', message: 'Evidencia multimedia cargada correctamente.' });
      }
    } catch (err) {
      setToast({ type: 'error', message: err.message || 'No se pudo subir el archivo.' });
    }
  };

  const handleOpenCreate = () => {
    setEditingId(null);
    setForm(initialForm());
    setUploadedPhotos([]);
    setIsFormModalOpen(true);
  };

  const handleEdit = (row) => {
    const next = initialForm();
    for (const f of SCREEN_CONFIG.fields) {
      next[f.name] = row[f.name] !== undefined && row[f.name] !== null ? row[f.name] : '';
    }
    setForm(next);
    setEditingId(row.id);
    if (Array.isArray(row.evidencias)) {
      setUploadedPhotos(row.evidencias.map((url, i) => ({ name: \`Evidencia \${i + 1}\`, url })));
    } else {
      setUploadedPhotos([]);
    }
    setIsFormModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setToast(null);
    try {
      const payload = {};
      for (const f of SCREEN_CONFIG.fields) {
        const rawVal = form[f.name];
        if (f.type === 'number' || f.type === 'select-relation') {
          payload[f.name] = rawVal === '' || rawVal === null ? null : Number(rawVal);
        } else if (f.type === 'checkbox') {
          payload[f.name] = Boolean(rawVal);
        } else {
          payload[f.name] = rawVal;
        }
      }
      if (uploadedPhotos.length > 0) {
        payload.evidencias = uploadedPhotos.map((p) => p.url);
      }

      if (typeof window !== 'undefined') {
        try {
          const userObj = JSON.parse(localStorage.getItem('user') || '{}');
          if (userObj && userObj.id && payload.usuarioId === undefined) {
            payload.usuarioId = userObj.id;
          }
        } catch (_) {}
      }

      if (editingId) {
        await apiClient.put(\`\${SCREEN_CONFIG.endpoint}/\${editingId}\`, payload);
        setToast({ type: 'success', message: '¡Registro actualizado exitosamente en la base de datos!' });
      } else {
        await apiClient.post(SCREEN_CONFIG.endpoint, payload);
        setToast({ type: 'success', message: '¡Nuevo registro guardado exitosamente en la base de datos!' });
      }
      setForm(initialForm());
      setUploadedPhotos([]);
      setEditingId(null);
      setIsFormModalOpen(false);
      await loadData();
    } catch (err) {
      setToast({ type: 'error', message: err.details?.message || err.message || 'Error al guardar el registro en la API.' });
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = async (id) => {
    setBusy(true);
    setToast(null);
    try {
      await apiClient.delete(\`\${SCREEN_CONFIG.endpoint}/\${id}\`);
      setToast({ type: 'success', message: \`Registro #\${id} eliminado correctamente.\` });
      setDeleteConfirmId(null);
      if (viewDetailRow && viewDetailRow.id === id) setViewDetailRow(null);
      await loadData();
    } catch (err) {
      setToast({ type: 'error', message: err.message || 'No se pudo eliminar el registro.' });
    } finally {
      setBusy(false);
    }
  };

  // Filtrado reactivo en vivo
  const filteredRows = rows.filter((r) => {
    if (statusFilter === 'ACTIVOS') {
      const st = String(r.estado || r.status || 'ACTIVO').toUpperCase();
      if (!/ACTIVO|PENDIENTE|SOLICITADO|PROCESO|REPARACION|EN_ESPERA/.test(st)) return false;
    } else if (statusFilter === 'COMPLETADOS') {
      const st = String(r.estado || r.status || '').toUpperCase();
      if (!/COMPLET|FINALIZ|APROB|CERRAD|ENTREGAD/.test(st)) return false;
    } else if (statusFilter === 'PENDIENTES') {
      const st = String(r.estado || r.status || '').toUpperCase();
      if (!/PENDIENTE|SOLICITADO|EN_ESPERA|REVISION/.test(st)) return false;
    }
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return Object.values(r).some((v) => v !== null && v !== undefined && String(v).toLowerCase().includes(q));
  });

  // Métricas para tarjetas KPI
  const totalCount = rows.length;
  const activeCount = rows.filter((r) => /pendiente|proceso|activo|abierta|enviada|confirmada|solicitad/i.test(String(r.estado || 'activo'))).length;
  const completedCount = rows.filter((r) => /complet|finaliz|aprob|cerrad|entregad/i.test(String(r.estado || ''))).length;
  const pendingCount = Math.max(0, totalCount - completedCount);

  const financialField = SCREEN_CONFIG.fields.find(f => /total|precio|costo|monto|subtotal/i.test(f.name) && f.type === 'number');
  const financialTotal = financialField
    ? rows.reduce((acc, r) => acc + (Number(r[financialField.name]) || 0), 0)
    : null;

  const kpiValues = [
    totalCount,
    activeCount,
    completedCount,
    financialTotal !== null
      ? \`$\${financialTotal.toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\`
      : pendingCount
  ];

  const renderStatusBadge = (status) => {
    const s = String(status || '').toUpperCase();
    let colorClass = 'bg-slate-100 text-slate-700 border-slate-200';
    if (/ACTIVO|COMPLETADO|FINALIZADO|APROBADO|CONFIRMADO|PAGADO|ENTREGADO/.test(s)) {
      colorClass = 'bg-emerald-50 text-emerald-700 border-emerald-200';
    } else if (/PENDIENTE|SOLICITADO|EN_ESPERA|REVISION|BORRADOR/.test(s)) {
      colorClass = 'bg-amber-50 text-amber-700 border-amber-200';
    } else if (/PROCESO|REPARACION|DIAGNOSTICO|EN_PRUEBAS|ASIGNADO/.test(s)) {
      colorClass = 'bg-indigo-50 text-indigo-700 border-indigo-200';
    } else if (/CANCELADO|RECHAZADO|INACTIVO|BAJA|CRITICO|ERROR/.test(s)) {
      colorClass = 'bg-rose-50 text-rose-700 border-rose-200';
    }
    return (
      <span className={\`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold border \${colorClass}\`}>
        <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
        <span>{s || 'REGISTRADO'}</span>
      </span>
    );
  };

  const resolveDisplayValue = (row, field) => {
    const val = row[field.name];
    if (val === undefined || val === null || val === '') return '—';
    if (field.type === 'select-relation') {
      const opts = relOptions[field.name] || [];
      const found = opts.find((o) => Number(o.id) === Number(val));
      if (found) {
        return found[field.relLabelField] || found.nombre || found.placa || found.codigo || found.titulo || \`#\${val}\`;
      }
      return \`#\${val}\`;
    }
    if (field.type === 'status-select' || field.name === 'estado' || field.name === 'status') {
      return renderStatusBadge(val);
    }
    if (typeof val === 'boolean') {
      return (
        <span className={\`px-2 py-0.5 rounded-full text-[10px] font-bold \${val ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-500'}\`}>
          {val ? 'Sí' : 'No'}
        </span>
      );
    }
    if (field.type === 'number' && /precio|costo|total|monto|subtotal|tarifa/i.test(field.name)) {
      return \`$\${Number(val).toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\`;
    }
    if (field.type === 'date' && typeof val === 'string' && val.includes('-')) {
      try {
        const d = new Date(val);
        if (!isNaN(d.getTime())) return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
      } catch (_) {}
    }
    return String(val);
  };

  return (
    <div className="space-y-6">
      {/* Cabecera Principal */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 mb-2">
            <span className="material-symbols-outlined text-[15px]">{SCREEN_CONFIG.icon}</span>
            <span>{SCREEN_CONFIG.entityName}</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            {SCREEN_CONFIG.title}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-3xl">
            {SCREEN_CONFIG.subtitle}
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={loadData}
            title="Recargar datos del servidor"
            className="p-2.5 rounded-xl border border-slate-300 text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors shadow-2xs"
          >
            <span className="material-symbols-outlined text-[18px]">refresh</span>
          </button>

          <button
            type="button"
            onClick={handleOpenCreate}
            style={{ backgroundColor: '${primary}' }}
            className="px-4 py-2.5 rounded-xl text-white font-bold text-xs flex items-center gap-1.5 shadow-xs hover:opacity-95 transition-opacity"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            <span>{SCREEN_CONFIG.primaryButtonLabel}</span>
          </button>
        </div>
      </div>

      {/* Tarjetas KPI en Tiempo Real */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {SCREEN_CONFIG.kpiLabels.map((label, idx) => (
          <div key={label} className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex items-center justify-between">
            <div>
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                {label}
              </span>
              <strong className="text-2xl font-bold text-slate-900 mt-1 block">
                {kpiValues[idx] ?? 0}
              </strong>
            </div>
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center">
              <span className="material-symbols-outlined text-[20px]">{SCREEN_CONFIG.icon}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Mensaje Toast Flotante */}
      {toast && (
        <div className={\`p-4 rounded-xl border text-xs font-semibold flex items-center justify-between shadow-xs transition-all \${
          toast.type === 'success'
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
            : 'bg-rose-50 border-rose-200 text-rose-800'
        }\`}>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">
              {toast.type === 'success' ? 'check_circle' : 'error'}
            </span>
            <span>{toast.message}</span>
          </div>
          <button type="button" onClick={() => setToast(null)} className="text-slate-400 hover:text-slate-700 ml-2">✕</button>
        </div>
      )}

      {/* Barra de Filtros, Búsqueda y Tabla */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="p-4 sm:p-5 border-b border-slate-200 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          {/* Pestañas de Filtro Rápido */}
          <div className="flex items-center gap-1.5 overflow-x-auto">
            {[
              { key: 'ALL', label: 'Todos', count: rows.length },
              { key: 'ACTIVOS', label: 'Activos / En Proceso', count: activeCount },
              { key: 'COMPLETADOS', label: 'Completados', count: completedCount },
              { key: 'PENDIENTES', label: 'Pendientes', count: pendingCount }
            ].map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setStatusFilter(tab.key)}
                className={\`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 \${
                  statusFilter === tab.key
                    ? 'bg-indigo-600 text-white font-bold shadow-2xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
                }\`}
              >
                <span>{tab.label}</span>
                <span className={\`px-1.5 py-0.2 rounded-full text-[10px] font-bold \${
                  statusFilter === tab.key ? 'bg-white/25 text-white' : 'bg-slate-200 text-slate-700'
                }\`}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {/* Campo de Búsqueda */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <span className="material-symbols-outlined text-[18px] text-slate-400 absolute left-3 top-2.5">
                search
              </span>
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar en registros..."
                className="pl-9 pr-3 py-1.5 rounded-xl border border-slate-300 text-xs focus:outline-none focus:border-indigo-600 w-full sm:w-64"
              />
            </div>
            <span className="text-xs font-bold text-slate-500 whitespace-nowrap">
              {filteredRows.length} resultados
            </span>
          </div>
        </div>

        {/* Tabla de Registros */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">ID</th>
                {SCREEN_CONFIG.fields.map((f) => (
                  <th key={f.name} className="px-4 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    {f.label}
                  </th>
                ))}
                <th className="px-4 py-3 text-right text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={SCREEN_CONFIG.fields.length + 2} className="px-6 py-12 text-center text-sm text-slate-400">
                    <div className="flex flex-col items-center gap-2">
                      <span className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></span>
                      <span>Consultando /api{SCREEN_CONFIG.endpoint}...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={SCREEN_CONFIG.fields.length + 2} className="px-6 py-12 text-center">
                    <div className="max-w-sm mx-auto space-y-2">
                      <span className="material-symbols-outlined text-[36px] text-slate-300">inbox</span>
                      <p className="text-sm font-semibold text-slate-700">Sin registros disponibles</p>
                      <p className="text-xs text-slate-400">
                        La base de datos inicia limpia sin datos estáticos. Haz clic en el botón para agregar el primer registro mediante el modal interactivo.
                      </p>
                      <button
                        type="button"
                        onClick={handleOpenCreate}
                        style={{ backgroundColor: '${primary}' }}
                        className="mt-2 px-4 py-2 rounded-xl text-white font-bold text-xs shadow-xs hover:opacity-95"
                      >
                        {SCREEN_CONFIG.primaryButtonLabel}
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredRows.map((row) => (
                  <tr key={row.id} className="border-t border-slate-100 hover:bg-slate-50/80 transition-colors">
                    <td className="px-4 py-3 text-xs font-mono font-bold text-slate-600">#{row.id}</td>
                    {SCREEN_CONFIG.fields.map((f) => (
                      <td key={f.name} className="px-4 py-3 text-xs text-slate-800">
                        {resolveDisplayValue(row, f)}
                      </td>
                    ))}
                    <td className="px-4 py-3 text-right whitespace-nowrap space-x-2">
                      <button
                        type="button"
                        onClick={() => setViewDetailRow(row)}
                        className="text-xs font-semibold text-slate-600 hover:text-indigo-600 hover:underline"
                      >
                        Ver
                      </button>
                      <button
                        type="button"
                        onClick={() => handleEdit(row)}
                        className="text-xs font-semibold text-indigo-600 hover:underline"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteConfirmId(row.id)}
                        className="text-xs font-semibold text-rose-600 hover:underline"
                      >
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ================= MODAL 1: FORMULARIO CREAR / EDITAR ================= */}
      {isFormModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2.5">
                <div style={{ backgroundColor: '${primary}' }} className="w-8 h-8 rounded-xl text-white flex items-center justify-center shadow-xs">
                  <span className="material-symbols-outlined text-[18px]">{editingId ? 'edit' : 'add'}</span>
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    {editingId ? \`Editar Registro #\${editingId}\` : SCREEN_CONFIG.primaryButtonLabel}
                  </h2>
                  <p className="text-[11px] text-slate-500 font-mono">
                    Endpoint: <span className="font-semibold text-slate-700">/api{SCREEN_CONFIG.endpoint}</span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => { setIsFormModalOpen(false); setEditingId(null); }}
                className="w-8 h-8 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition-colors"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="p-6 max-h-[70vh] overflow-y-auto space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {SCREEN_CONFIG.fields.map((f) => (
                    <div key={f.name} className={f.type === 'textarea' ? 'sm:col-span-2' : ''}>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                        {f.label} {f.required && <span className="text-rose-500">*</span>}
                      </label>

                      {f.type === 'select-relation' ? (
                        <select
                          required={f.required}
                          value={form[f.name] ?? ''}
                          onChange={(e) => setForm({ ...form, [f.name]: e.target.value })}
                          className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white focus:outline-none focus:border-indigo-600"
                        >
                          <option value="">Seleccione {f.label.toLowerCase()}...</option>
                          {(relOptions[f.name] || []).map((opt) => (
                            <option key={opt.id} value={opt.id}>
                              {opt[f.relLabelField] || opt.nombre || opt.placa || opt.codigo || opt.titulo || \`Registro #\${opt.id}\`}
                            </option>
                          ))}
                        </select>
                      ) : f.type === 'status-select' ? (
                        <select
                          value={form[f.name] ?? ''}
                          onChange={(e) => setForm({ ...form, [f.name]: e.target.value })}
                          className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white focus:outline-none focus:border-indigo-600"
                        >
                          <option value="ACTIVO">ACTIVO</option>
                          <option value="PENDIENTE">PENDIENTE</option>
                          <option value="EN_PROCESO">EN PROCESO</option>
                          <option value="COMPLETADO">COMPLETADO</option>
                          <option value="FINALIZADO">FINALIZADO</option>
                          <option value="CANCELADO">CANCELADO</option>
                        </select>
                      ) : f.type === 'textarea' ? (
                        <textarea
                          rows={3}
                          required={f.required}
                          value={form[f.name] ?? ''}
                          onChange={(e) => setForm({ ...form, [f.name]: e.target.value })}
                          placeholder={\`Ingrese \${f.label.toLowerCase()}...\`}
                          className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-indigo-600"
                        />
                      ) : f.type === 'checkbox' ? (
                        <label className="inline-flex items-center gap-2 mt-2 text-sm text-slate-700 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={Boolean(form[f.name])}
                            onChange={(e) => setForm({ ...form, [f.name]: e.target.checked })}
                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                          />
                          <span>Habilitado / Activo</span>
                        </label>
                      ) : (
                        <input
                          type={f.type === 'number' ? 'number' : (f.type === 'date' ? 'date' : 'text')}
                          step={f.type === 'number' ? 'any' : undefined}
                          required={f.required}
                          value={form[f.name] ?? ''}
                          onChange={(e) => setForm({ ...form, [f.name]: e.target.value })}
                          placeholder={\`Ingrese \${f.label.toLowerCase()}...\`}
                          className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-indigo-600"
                        />
                      )}
                    </div>
                  ))}
                </div>

                {SCREEN_CONFIG.hasPhotoUpload && (
                  <div className="pt-2 border-t border-slate-100">
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Evidencia Multimedia / Fotografías (/api/upload)
                    </label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoUpload}
                      className="block w-full text-xs text-slate-600 file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer"
                    />
                    {uploadedPhotos.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {uploadedPhotos.map((p, idx) => (
                          <span key={idx} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-emerald-50 text-emerald-700 text-xs font-medium border border-emerald-200">
                            <span className="material-symbols-outlined text-[14px]">image</span>
                            <span>{p.name}</span>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => { setIsFormModalOpen(false); setEditingId(null); }}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  style={{ backgroundColor: '${primary}' }}
                  className="px-5 py-2.5 rounded-xl text-white text-xs font-bold shadow-xs hover:opacity-95 transition-opacity disabled:opacity-60 flex items-center gap-2"
                >
                  {busy && <span className="inline-block w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>}
                  <span>{busy ? 'Guardando...' : (editingId ? 'Actualizar Cambios' : 'Guardar en Base de Datos')}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL 2: VER FICHA / DETALLE ================= */}
      {viewDetailRow && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center shadow-xs">
                  <span className="material-symbols-outlined text-[18px]">visibility</span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-slate-900">
                      Ficha de Detalle #{viewDetailRow.id}
                    </h2>
                    {renderStatusBadge(viewDetailRow.estado || viewDetailRow.status)}
                  </div>
                  <p className="text-[11px] text-slate-500 font-medium">
                    {SCREEN_CONFIG.entityName} · Consulta completa de atributos
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setViewDetailRow(null)}
                className="w-8 h-8 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition-colors"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="p-6 max-h-[70vh] overflow-y-auto space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {SCREEN_CONFIG.fields.map((f) => (
                  <div key={f.name} className={\`p-3 rounded-xl bg-slate-50/80 border border-slate-100 \${f.type === 'textarea' ? 'sm:col-span-2' : ''}\`}>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
                      {f.label}
                    </span>
                    <span className="text-sm font-semibold text-slate-800 break-words">
                      {resolveDisplayValue(viewDetailRow, f)}
                    </span>
                  </div>
                ))}
              </div>

              {Array.isArray(viewDetailRow.evidencias) && viewDetailRow.evidencias.length > 0 && (
                <div className="pt-2">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-2">
                    Fotografías y Evidencia Multimedia ({viewDetailRow.evidencias.length})
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {viewDetailRow.evidencias.map((url, i) => (
                      <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="block rounded-xl overflow-hidden border border-slate-200 hover:opacity-90">
                        <img src={url} alt={\`Evidencia \${i + 1}\`} className="w-full h-24 object-cover" />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {(viewDetailRow.fechaCreacion || viewDetailRow.createdAt) && (
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                  <span>Fecha de registro en sistema:</span>
                  <span className="font-semibold text-slate-600">
                    {String(viewDetailRow.fechaCreacion || viewDetailRow.createdAt).replace('T', ' ').slice(0, 19)}
                  </span>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  const id = viewDetailRow.id;
                  setViewDetailRow(null);
                  setDeleteConfirmId(id);
                }}
                className="text-xs font-semibold text-rose-600 hover:underline flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-[16px]">delete</span>
                <span>Eliminar registro</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const r = viewDetailRow;
                    setViewDetailRow(null);
                    handleEdit(r);
                  }}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                >
                  Editar Registro
                </button>
                <button
                  type="button"
                  onClick={() => setViewDetailRow(null)}
                  style={{ backgroundColor: '${primary}' }}
                  className="px-4 py-2 rounded-xl text-white text-xs font-bold"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL 3: CONFIRMAR ELIMINACIÓN ================= */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150 p-6 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
              <span className="material-symbols-outlined text-[26px]">warning</span>
            </div>
            <div className="text-center">
              <h3 className="text-base font-bold text-slate-900">
                ¿Eliminar registro #{deleteConfirmId}?
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Esta acción removerá el registro permanentemente del endpoint /api{SCREEN_CONFIG.endpoint}. No se puede deshacer.
              </p>
            </div>
            <div className="flex items-center justify-center gap-2.5 pt-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => setDeleteConfirmId(null)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => confirmDelete(deleteConfirmId)}
                className="px-4 py-2 rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 disabled:opacity-60 flex items-center gap-1.5"
              >
                {busy && <span className="inline-block w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>}
                <span>Sí, Eliminar</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
`;
}

/**
 * Genera un Dashboard cohesivo para la pantalla inicial de cada rol,
 * con accesos rápidos interactivos a cada módulo y estado del sistema.
 */
function generateCohesiveDashboardJsx(spec = {}, design = {}, compiledMockups = []) {
  const projectName = design.projectName || spec?.project?.name || 'Sistema de Gestión';
  const primary = design.primary || '#3525cd';
  const operationalMockups = (compiledMockups || []).filter(m =>
    !/iniciodesesi|accesoalsistema|login|auth/i.test((m.key || '') + ' ' + (m.compName || '') + ' ' + (m.title || ''))
  );

  return `import React, { useState, useEffect } from 'react';

export default function Dashboard({ setActiveTab, user = null }) {
  const roleName = user?.role || user?.rol || 'Administrador';
  const userName = user?.nombre || user?.username || user?.email?.split('@')[0] || 'Usuario';

  const screens = ${JSON.stringify(operationalMockups.map(m => ({
    key: m.key,
    title: m.title || m.compName,
    route: m.route,
    roles: m.roles || []
  })), null, 2)};

  const userScreens = screens.filter(s => {
    if (!Array.isArray(s.roles) || s.roles.length === 0) return true;
    const normRole = String(roleName).toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g, '');
    return s.roles.some(r => {
      const nr = String(r).toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g, '');
      return nr === normRole || nr.includes(normRole) || normRole.includes(nr);
    });
  });

  const displayScreens = userScreens.length > 0 ? userScreens : screens.slice(0, 8);

  return (
    <div className="space-y-6">
      {/* Banner de Bienvenida Central */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs relative overflow-hidden">
        <div className="max-w-2xl relative z-10">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 mb-3">
            <span className="material-symbols-outlined text-[16px]">verified_user</span>
            <span>Espacio de Trabajo Seguro · {roleName}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Bienvenido, {userName}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-2 leading-relaxed">
            ${projectName} está conectado y sincronizado con el backend en tiempo real. Selecciona cualquiera de tus pantallas asignadas para registrar, consultar o editar información con modales interactivos.
          </p>
        </div>
      </div>

      {/* Tarjetas de Accesos Rápidos a Pantallas del Rol */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">Pantallas Operativas de {roleName}</h2>
            <p className="text-xs text-slate-500">Módulos habilitados con modales interactivos y conexión a base de datos</p>
          </div>
          <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-bold">
            {displayScreens.length} módulos
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {displayScreens.map((scr) => (
            <div
              key={scr.key}
              onClick={() => setActiveTab && setActiveTab(scr.key)}
              className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:shadow-md hover:border-indigo-300 transition-all cursor-pointer flex flex-col justify-between group"
            >
              <div>
                <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center mb-3 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                  <span className="material-symbols-outlined text-[20px]">space_dashboard</span>
                </div>
                <h3 className="font-bold text-sm text-slate-900 group-hover:text-indigo-600 transition-colors">
                  {scr.title}
                </h3>
                <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">
                  Gestión completa, creación y consulta con modales interactivos.
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-indigo-600 group-hover:translate-x-0.5 transition-transform">
                <span>Abrir Módulo</span>
                <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Estado del Sistema */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-600">
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></div>
          <div>
            <strong className="text-slate-800">Sistema Operativo y Servicios Activos</strong>
            <span className="block text-[11px] text-slate-400">Sesión autenticada · Conexión segura con el servidor</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-3 py-1 rounded-lg bg-slate-100 text-slate-700 font-mono text-[11px]">
            React 18 + Tailwind CSS
          </span>
        </div>
      </div>
    </div>
  );
}
`;
}

/**
 * Genera App.jsx dinámico basado 100% en los Actores y Pantallas del proyecto en ICASE,
 * sin quemar entidades crudas (ALERTASTOCK, ASIGNACIONMECANICO) en la navegación.
 */
function generateCohesiveAppJsx(spec = {}, design = {}, compiledMockups = [], options = {}) {
  const projectName = design.projectName || spec?.project?.name || 'Aplicación';
  const projectId = spec?.project?.id;
  const operationalMockups = (compiledMockups || []).filter(m =>
    !/iniciodesesi|accesoalsistema|login|auth/i.test((m.key || '') + ' ' + (m.compName || '') + ' ' + (m.title || ''))
  );

  const { matchMockupToCatalogEntry } = require('./codegenCustomizationStore');
  const screensByRole = getEffectiveScreensByRoleForSpec(projectId, spec, operationalMockups);
  const screensByRoleCode = formatScreensByRoleCode(screensByRole);

  const mockupImports = operationalMockups
    .map(m => `import ${m.compName} from './pages/mockups/${m.compName}';`)
    .join('\n');

  const builtInKeysList = ['dashboard'];
  const mockupSwitches = operationalMockups
    .map(m => {
      const cat = matchMockupToCatalogEntry(m);
      const aliasKey = cat?.key && cat.key !== m.key ? cat.key : null;
      builtInKeysList.push(m.key);
      if (aliasKey) builtInKeysList.push(aliasKey);
      const cond = aliasKey
        ? `(resolvedTab === ${JSON.stringify(m.key)} || resolvedTab === ${JSON.stringify(aliasKey)})`
        : `resolvedTab === ${JSON.stringify(m.key)}`;
      return `      {${cond} && <${m.compName} onNavigate={setActiveTab} />}`;
    })
    .join('\n');

  return `import React, { useState, useEffect } from 'react';
import AppShell from './components/AppShell';
${spec.security?.authType === 'JWT' ? "import LoginPage from './pages/LoginPage';" : "const LoginPage = () => null;"}
import Dashboard from './pages/Dashboard';
import apiClient from './api/client';
${mockupImports}

// PANTALLAS ASIGNADAS POR ROL SEGÚN LOS ACTORES Y MOCKUPS DEL PROYECTO
${screensByRoleCode}

const BUILTIN_SCREEN_KEYS = new Set(${JSON.stringify([...new Set(builtInKeysList)])});

function getEffectiveScreensByRole() {
  const custom = typeof window !== 'undefined' && window.__ICASE_SCREENS_BY_ROLE__;
  if (custom && typeof custom === 'object' && Object.keys(custom).length > 0) {
    return custom;
  }
  return SCREENS_BY_ROLE;
}

function DynamicModuleScreen({ item }) {
  const endpoint = item?.endpoint || \`/\${String(item?.key || 'modulo').replace(/^\\/+/, '').replace(/^api\\//, '')}\`;
  const cleanPath = endpoint.startsWith('/api/') ? endpoint.slice(4) : (endpoint.startsWith('/') ? endpoint : \`/\${endpoint}\`);
  const fields = Array.isArray(item?.fields) && item.fields.length > 0 ? item.fields : [
    { name: 'codigo', label: 'Código', type: 'text' },
    { name: 'nombre', label: 'Nombre / Descripción', type: 'text' },
    { name: 'observaciones', label: 'Observaciones', type: 'text' },
    { name: 'estado', label: 'Estado', type: 'text' }
  ];

  const [rows, setRows] = useState([]);
  const [form, setForm] = useState(() => Object.fromEntries(fields.map(f => [f.name, ''])));
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const load = () => {
    apiClient.get(cleanPath)
      .then(res => setRows(Array.isArray(res) ? res : (res?.data || [])))
      .catch(() => setRows([]));
  };

  useEffect(() => {
    setForm(Object.fromEntries(fields.map(f => [f.name, ''])));
    load();
  }, [cleanPath]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    setError('');
    try {
      await apiClient.post(cleanPath, form);
      setMessage('Registro guardado correctamente.');
      setForm(Object.fromEntries(fields.map(f => [f.name, ''])));
      load();
    } catch (err) {
      setError(err.message || 'No se pudo guardar.');
    }
  };

  const handleDelete = async (id) => {
    try {
      await apiClient.delete(\`\${cleanPath}/\${id}\`);
      load();
    } catch (err) {
      setError(err.message || 'No se pudo eliminar.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 mb-2">
          Módulo Dinámico Conectado · API REST
        </span>
        <h1 className="text-2xl font-bold text-slate-900">{item?.label || item?.key}</h1>
        <p className="text-xs text-slate-500 mt-1">Endpoint activo: <code>/api{cleanPath}</code></p>
      </div>
      {message && <p className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl p-3">{message}</p>}
      {error && <p className="text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-xl p-3">{error}</p>}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
          <h2 className="text-sm font-bold text-slate-800">Nuevo registro en {item?.label}</h2>
          {fields.map(f => (
            <div key={f.name}>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">{f.label}</label>
              <input
                type={f.type === 'number' ? 'number' : 'text'}
                required
                value={form[f.name] ?? ''}
                onChange={e => setForm({ ...form, [f.name]: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
              />
            </div>
          ))}
          <button type="submit" className="w-full py-2.5 px-4 bg-indigo-600 text-white font-bold text-xs rounded-xl">
            Guardar Registro
          </button>
        </form>
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="px-6 py-4 border-b border-slate-200 font-bold text-sm text-slate-800">
            Registros ({rows.length})
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase">ID</th>
                  {fields.map(f => <th key={f.name} className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase">{f.label}</th>)}
                  <th className="px-4 py-3 text-right text-xs font-bold text-slate-500 uppercase">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr><td colSpan={fields.length + 2} className="px-6 py-8 text-center text-xs text-slate-400">Sin registros cargados.</td></tr>
                ) : rows.map(r => (
                  <tr key={r.id} className="border-t border-slate-100">
                    <td className="px-4 py-3 text-xs text-slate-700">#{r.id}</td>
                    {fields.map(f => <td key={f.name} className="px-4 py-3 text-xs text-slate-700">{r[f.name] ?? '—'}</td>)}
                    <td className="px-4 py-3 text-right">
                      <button type="button" onClick={() => handleDelete(r.id)} className="text-xs font-semibold text-rose-600 hover:underline">Eliminar</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function resolveUserRole(user, availableRoles) {
  const rawRole = String(user?.role || user?.rol || '').toLowerCase();
  const rawEmail = String(user?.email || user?.username || '').toLowerCase();
  for (const r of availableRoles) {
    const norm = r.normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toLowerCase();
    if (rawRole.includes(norm) || norm.includes(rawRole) && rawRole.length > 2) return r;
    if (rawEmail.includes(norm.slice(0, 5))) return r;
  }
  return availableRoles[0] || 'Administrador';
}

export default function App() {
  const [session, setSession] = useState(() => {
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      const userStr = typeof window !== 'undefined' ? localStorage.getItem('user') : null;
      return token ? { token, user: userStr ? JSON.parse(userStr) : null } : null;
    } catch {
      return null;
    }
  });

  const [, setConfigVersion] = useState(0);
  useEffect(() => {
    const onUpdated = () => setConfigVersion(v => v + 1);
    window.addEventListener('icase:screens-updated', onUpdated);
    return () => window.removeEventListener('icase:screens-updated', onUpdated);
  }, []);

  const screensByRole = getEffectiveScreensByRole();
  const roleKeys = Object.keys(screensByRole);
  const currentRole = resolveUserRole(session?.user, roleKeys);
  const currentRoleScreens = screensByRole[currentRole] || screensByRole[roleKeys[0]] || [];

  const [activeTab, updateActiveTab] = useState(() => {
    const key = typeof window === 'undefined' ? '' : window.location.hash.slice(1);
    if (/^[a-zA-Z0-9_-]+$/.test(key)) return key;
    return currentRoleScreens[0]?.key || 'dashboard';
  });

  const setActiveTab = (key) => {
    updateActiveTab(key);
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', '#' + encodeURIComponent(key));
    }
  };

  useEffect(() => {
    const handleExpired = () => setSession(null);
    window.addEventListener('auth:expired', handleExpired);
    return () => window.removeEventListener('auth:expired', handleExpired);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setSession(null);
    setActiveTab('');
  };

  if (${spec.security?.authType === 'JWT'} && (!session || !session.token)) {
    return (
      <LoginPage
        onLoginSuccess={(token, user) => {
          const latest = getEffectiveScreensByRole();
          const rKey = resolveUserRole(user, Object.keys(latest));
          const finalUser = { ...user, role: rKey, rol: rKey };
          localStorage.setItem('user', JSON.stringify(finalUser));
          setSession({ token, user: finalUser });
          const list = latest[rKey] || [];
          setActiveTab(list[0]?.key || 'dashboard');
        }}
      />
    );
  }

  const isAllowed = currentRoleScreens.some(item => item.key === activeTab);
  const resolvedTab = isAllowed ? activeTab : (currentRoleScreens[0]?.key || 'dashboard');
  const activeScreenItem = currentRoleScreens.find(item => item.key === resolvedTab);

  return (
    <AppShell
      title=${JSON.stringify(projectName)}
      user={{ ...session?.user, role: currentRole }}
      onLogout={handleLogout}
      navItems={currentRoleScreens}
      activeTab={resolvedTab}
      onSelectTab={setActiveTab}
    >
      {resolvedTab === 'dashboard' && <Dashboard setActiveTab={setActiveTab} user={session?.user} />}
${mockupSwitches}
      {!BUILTIN_SCREEN_KEYS.has(resolvedTab) && activeScreenItem && (
        <DynamicModuleScreen item={activeScreenItem} />
      )}
    </AppShell>
  );
}
`;
}

/**
 * Usa Claude (AnthropicProvider) para sintetizar o personalizar en vivo el código React (.jsx)
 * de una pantalla específica guiándose por su Mockup HTML y los endpoints del proyecto.
 */
async function synthesizeScreenWithClaude(projectId, screen, spec, userInstruction = '') {
  const AnthropicProvider = require('../ai/AnthropicProvider');
  const env = require('../../config/env');
  const anthropic = new AnthropicProvider();
  const design = extractProjectDesignSystem(spec);
  const bp = extractMockupBlueprint(screen, spec);
  const cleanBase = toPascalCase((screen.name || 'Screen').replace(/[^a-zA-Z0-9_]/g, '')) || 'Screen';
  const compName = `${cleanBase}Mockup`;

  const systemPrompt = `Eres Claude Sonnet, Arquitecto Frontend Senior en i-CASE.
Tu objetivo es generar un componente React 18 + Tailwind CSS (archivo .jsx completo y funcional) para la pantalla "${bp.title}".
REGLAS ESTRICTAS:
1. COHERENCIA VISUAL: Usa el diseño limpio de Tailwind CSS (tarjetas blancas bg-white rounded-2xl border border-slate-200 p-6 shadow-xs, color primario ${design.primary}, íconos material-symbols-outlined). NO incluyas <header>, <nav> ni <aside> de navegación global porque el componente ya se renderiza dentro de <AppShell>.
2. CERO DATOS ESTÁTICOS: Todos los listados y contadores deben iniciar vacíos (\`useState([])\`, contadores en \`0\`). Está prohibido quemar filas de ejemplo o números ficticios.
3. CONEXIÓN REAL A LA API: Usa \`import apiClient from '../../api/client';\` y conecta \`useEffect\` a \`apiClient.get('${bp.endpoint}')\`, el formulario a \`apiClient.post('${bp.endpoint}', payload)\` y eliminación a \`apiClient.delete('${bp.endpoint}/' + id)\`.
4. Responde ÚNICAMENTE con un objeto JSON válido: { "code": "import React... export default function ...", "summary": "Explicación breve de lo generado" }`;

  const userPrompt = JSON.stringify({
    projectName: design.projectName,
    componentName: compName,
    screenTitle: bp.title,
    screenSubtitle: bp.subtitle,
    endpoint: bp.endpoint,
    fields: bp.fields,
    relations: bp.relations,
    kpiLabels: bp.kpiLabels,
    userInstruction: userInstruction || 'Generar componente React funcional guiado por el mockup y sin datos estáticos.',
    mockupHtmlExcerpt: String(screen.html || '').slice(0, 6000)
  });

  const modelToUse = env.DOCUMENT_REVIEW_MODEL || env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';
  const res = await anthropic.executePrompt({
    system: systemPrompt,
    prompt: userPrompt,
    model: modelToUse,
    maxTokens: 4096
  });

  const code = res?.data?.code;
  if (code && code.includes('export default')) {
    const sKey = screenTabKey(screen);
    saveProjectScreenOverride(projectId, sKey, {
      code,
      summary: res?.data?.summary || `Pantalla ${bp.title} generada con Claude.`
    });
    return {
      compName,
      screenKey: sKey,
      code,
      summary: res?.data?.summary || `Pantalla ${bp.title} actualizada con Claude.`
    };
  }
  throw new Error('Claude no devolvió un componente React válido.');
}

module.exports = {
  extractProjectDesignSystem,
  extractMockupBlueprint,
  generateCohesiveAppShellJsx,
  generateCohesiveLoginPageJsx,
  generateCohesiveScreenComponentJsx,
  generateCohesiveDashboardJsx,
  generateCohesiveAppJsx,
  synthesizeScreenWithClaude
};
