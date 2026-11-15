import React, { useState, useEffect } from 'react';
import apiClient from '../../api/client';

const MODULE_PERMISSIONS = [
  {
    modulo: 'Gestión de Citas (RF-06 - RF-09)',
    permisos: [
      { id: 'citas.crear', nombre: 'Agendar cita de taller', admin: true, recepcion: true, mecanico: false, cliente: true },
      { id: 'citas.reprogramar', nombre: 'Aprobar o rechazar reprogramación', admin: true, recepcion: true, mecanico: false, cliente: false },
      { id: 'citas.disponibilidad', nombre: 'Definir disponibilidad y bahías', admin: true, recepcion: true, mecanico: false, cliente: false },
    ]
  },
  {
    modulo: 'Recepción e Inspección (RF-10 - RF-12)',
    permisos: [
      { id: 'recepcion.crear', nombre: 'Recepción e inventario pericial del vehículo', admin: true, recepcion: true, mecanico: false, cliente: false },
      { id: 'recepcion.danos', nombre: 'Mapeo de daños y nivel de combustible', admin: true, recepcion: true, mecanico: false, cliente: false },
      { id: 'entrega.registrar', nombre: 'Registrar entrega física y conformidad', admin: true, recepcion: true, mecanico: false, cliente: false }
    ]
  },
  {
    modulo: 'Diagnóstico Técnico y OBD-II (RF-10, RF-30, RF-31)',
    permisos: [
      { id: 'diag.registrar', nombre: 'Registrar diagnóstico técnico y fotos', admin: true, recepcion: false, mecanico: true, cliente: false },
      { id: 'diag.obd', nombre: 'Consultar base de conocimiento OBD-II', admin: true, recepcion: true, mecanico: true, cliente: false },
      { id: 'diag.proponer', nombre: 'Proponer soluciones a la base de conocimiento', admin: true, recepcion: false, mecanico: true, cliente: false }
    ]
  },
  {
    modulo: 'Presupuestos y Cotizaciones (RF-13 - RF-16)',
    permisos: [
      { id: 'cotiz.elaborar', nombre: 'Elaborar cotización con tarifas oficiales', admin: true, recepcion: true, mecanico: false, cliente: false },
      { id: 'cotiz.aprobar_parcial', nombre: 'Aprobación selectiva (ítem por ítem)', admin: true, recepcion: false, mecanico: false, cliente: true },
      { id: 'cotiz.bloqueo', nombre: 'Bloqueo por vencimiento comercial', admin: true, recepcion: false, mecanico: false, cliente: false }
    ]
  },
  {
    modulo: 'Órdenes de Trabajo y Taller (RF-17 - RF-20)',
    permisos: [
      { id: 'ot.asignar', nombre: 'Asignar mecánicos a bahías de trabajo', admin: true, recepcion: true, mecanico: false, cliente: false },
      { id: 'ot.bitacora', nombre: 'Registrar avance técnico en bitácora', admin: true, recepcion: false, mecanico: true, cliente: false },
      { id: 'ot.consumo_stock', nombre: 'Descontar repuestos para la reparación', admin: true, recepcion: false, mecanico: true, cliente: false },
      { id: 'ot.seguimiento_cliente', nombre: 'Visualizar progreso en vivo por fase', admin: true, recepcion: true, mecanico: true, cliente: true }
    ]
  },
  {
    modulo: 'Inventario, Ventas y Compras (RF-21 - RF-26)',
    permisos: [
      { id: 'inv.ajuste', nombre: 'Ajuste manual de existencias y motivos', admin: true, recepcion: false, mecanico: false, cliente: false },
      { id: 'inv.alertas', nombre: 'Configurar stock mínimo y alertas', admin: true, recepcion: false, mecanico: false, cliente: false },
      { id: 'inv.venta_mostrador', nombre: 'Emitir venta directa en mostrador', admin: true, recepcion: true, mecanico: false, cliente: false },
      { id: 'inv.compras', nombre: 'Emitir orden de compra y recibir stock', admin: true, recepcion: false, mecanico: false, cliente: false }
    ]
  },
  {
    modulo: 'Métricas, Seguridad y Auditoría (RF-01, RF-02, RF-32 - RF-34)',
    permisos: [
      { id: 'reportes.kpi', nombre: 'Ver tablero ejecutivo de ingresos y productividad', admin: true, recepcion: false, mecanico: false, cliente: false },
      { id: 'usuarios.admin', nombre: 'Alta, baja y reseteo de usuarios', admin: true, recepcion: false, mecanico: false, cliente: false },
      { id: 'auditoria.ver', nombre: 'Acceso a la bitácora criptográfica', admin: true, recepcion: false, mecanico: false, cliente: false }
    ]
  }
];

export default function Rolesypermisos19Mockup({ onNavigate }) {
  const [permissions, setPermissions] = useState(MODULE_PERMISSIONS);
  const [feedback, setFeedback] = useState(null);
  const [selectedRole, setSelectedRole] = useState('administrador');
  const [dbRoles, setDbRoles] = useState([]);

  const roleName = { administrador: 'Administrador', recepcion: 'Recepción', mecanico: 'Mecánico', cliente: 'Cliente' };

  useEffect(() => {
    let mounted = true;
    apiClient.get('/workshop-flow/permisos').then((res) => {
      if (!mounted || !res) return;
      setDbRoles(res.roles || []);
      const granted = new Set((res.asignaciones || []).map((item) => {
        const rol = (res.roles || []).find((role) => role.id === item.rolId);
        const permiso = (res.permisos || []).find((perm) => perm.id === item.permisoId);
        return rol && permiso ? `${permiso.codigo}:${rol.nombre}` : '';
      }));
      setPermissions((current) => current.map((module) => ({
        ...module,
        permisos: module.permisos.map((permiso) => ({
          ...permiso,
          admin: granted.has(`${permiso.id}:Administrador`),
          recepcion: granted.has(`${permiso.id}:Recepción`),
          mecanico: granted.has(`${permiso.id}:Mecánico`),
          cliente: granted.has(`${permiso.id}:Cliente`)
        }))
      })));
    }).catch(() => {});
    return () => { mounted = false; };
  }, []);

  const handleToggle = async (moduleIndex, permIndex, roleKey) => {
    const current = permissions[moduleIndex].permisos[permIndex];
    const nextVal = !current[roleKey];
    const updated = JSON.parse(JSON.stringify(permissions));
    updated[moduleIndex].permisos[permIndex][roleKey] = nextVal;
    setPermissions(updated);
    try {
      await apiClient.post('/workshop-flow/permisos', {
        rol: roleName[roleKey],
        codigo: current.id,
        concedido: nextVal
      });
      setFeedback(nextVal ? 'Permiso concedido. La API ya lo exige.' : 'Permiso revocado. La API ya lo bloquea.');
    } catch (err) {
      setFeedback(err.details?.message || err.message || 'No se pudo guardar el permiso.');
    }
    setTimeout(() => setFeedback(null), 4000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-md bg-indigo-50 text-indigo-600 font-semibold text-xs uppercase tracking-wider">
              Módulo 1 · Seguridad y Roles
            </span>
            <span className="text-xs text-slate-500 font-medium">RF-02 · Control RBAC por Perfil</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Matriz de Roles y Permisos</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Configuración y verificación de privilegios operativos para Administrador, Recepción, Mecánico y Cliente.
          </p>
        </div>

        <button
          type="button"
          onClick={() => onNavigate?.('usuarios')}
          className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-50 text-white font-semibold text-xs flex items-center gap-1.5 shadow-xs transition-colors"
        >
          <span className="material-symbols-outlined text-[18px]">manage_accounts</span>
          Gestionar Cuentas de Usuario
        </button>
      </div>

      {feedback && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-medium flex items-center gap-2">
          <span className="material-symbols-outlined text-emerald-600">verified</span>
          <span>{feedback}</span>
        </div>
      )}

      {/* Role Cards Definition from PDF */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
                Administrador
              </span>
              <span className="material-symbols-outlined text-indigo-600 text-[20px]">admin_panel_settings</span>
            </div>
            <p className="text-xs text-slate-500 mt-2">
              Control absoluto. Tarificación, compras a proveedores, auditoría criptográfica, reportes de productividad y finanzas.
            </p>
          </div>
          <div className="mt-3 pt-2 border-t border-slate-200 text-[11px] text-indigo-600 font-bold">
            100% de capacidades
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-sky-100 text-sky-800 border border-sky-200">
                Recepción & Asesoría
              </span>
              <span className="material-symbols-outlined text-sky-600 text-[20px]">desk</span>
            </div>
            <p className="text-xs text-slate-500 mt-2">
              Atención presencial, agendamiento, recepción e inspección pericial del auto con checklist de daños, entrega y ventas mostrador.
            </p>
          </div>
          <div className="mt-3 pt-2 border-t border-slate-200 text-[11px] text-sky-700 font-bold">
            Atención al cliente
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
                Mecánico de Taller
              </span>
              <span className="material-symbols-outlined text-amber-600 text-[20px]">handyman</span>
            </div>
            <p className="text-xs text-slate-500 mt-2">
              Diagnósticos técnicos, averías OBD-II, bitácora de órdenes de trabajo, descuento de repuestos para reparaciones y pruebas.
            </p>
          </div>
          <div className="mt-3 pt-2 border-t border-slate-200 text-[11px] text-amber-700 font-bold">
            Operación técnica
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                Cliente Propietario
              </span>
              <span className="material-symbols-outlined text-emerald-600 text-[20px]">directions_car</span>
            </div>
            <p className="text-xs text-slate-500 mt-2">
              Portal digital: seguimiento del progreso del vehículo en vivo, aprobación total o parcial de presupuestos, historial y citas.
            </p>
          </div>
          <div className="mt-3 pt-2 border-t border-slate-200 text-[11px] text-emerald-700 font-bold">
            Portal web cliente
          </div>
        </div>
      </div>

      {/* Permissions Matrix */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-indigo-600 text-[22px]">tune</span>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Matriz Detallada de Privilegios Operativos (RBAC)</h3>
              <p className="text-xs text-slate-500">Los cambios son validados por middleware en cada petición API del backend</p>
            </div>
          </div>
          <span className="text-xs font-mono text-slate-500">Conforme a la Sección 5.4 del Documento Técnico</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4 w-1/2">Operación / Funcionalidad</th>
                <th className="py-3 px-4 text-center">Administrador</th>
                <th className="py-3 px-4 text-center">Recepción</th>
                <th className="py-3 px-4 text-center">Mecánico</th>
                <th className="py-3 px-4 text-center">Cliente</th>
              </tr>
            </thead>
            <tbody>
              {permissions.map((module, mIdx) => (
                <React.Fragment key={mIdx}>
                  <tr className="bg-slate-100 border-t border-b border-slate-200">
                    <td colSpan={5} className="py-2.5 px-4 font-bold text-indigo-600 flex items-center gap-1.5 uppercase tracking-wide text-[11px]">
                      <span className="material-symbols-outlined text-[16px]">folder_open</span>
                      {module.modulo}
                    </td>
                  </tr>
                  {module.permisos.map((perm, pIdx) => (
                    <tr key={perm.id} className="border-b border-slate-200 hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900">{perm.nombre}</div>
                        <div className="text-[11px] font-mono text-slate-500">{perm.id}</div>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggle(mIdx, pIdx, 'admin')}
                          className={`w-6 h-6 rounded-md inline-flex items-center justify-center transition-colors ${
                            perm.admin ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          <span className="material-symbols-outlined text-[16px]">
                            {perm.admin ? 'check' : 'remove'}
                          </span>
                        </button>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggle(mIdx, pIdx, 'recepcion')}
                          className={`w-6 h-6 rounded-md inline-flex items-center justify-center transition-colors ${
                            perm.recepcion ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          <span className="material-symbols-outlined text-[16px]">
                            {perm.recepcion ? 'check' : 'remove'}
                          </span>
                        </button>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggle(mIdx, pIdx, 'mecanico')}
                          className={`w-6 h-6 rounded-md inline-flex items-center justify-center transition-colors ${
                            perm.mecanico ? 'bg-amber-600 text-white' : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          <span className="material-symbols-outlined text-[16px]">
                            {perm.mecanico ? 'check' : 'remove'}
                          </span>
                        </button>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggle(mIdx, pIdx, 'cliente')}
                          className={`w-6 h-6 rounded-md inline-flex items-center justify-center transition-colors ${
                            perm.cliente ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          <span className="material-symbols-outlined text-[16px]">
                            {perm.cliente ? 'check' : 'remove'}
                          </span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
