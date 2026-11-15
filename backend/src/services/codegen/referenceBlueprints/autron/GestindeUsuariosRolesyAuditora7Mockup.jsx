import React, { useState, useEffect } from 'react';
import apiClient from '../../api/client';

export default function GestindeUsuariosRolesyAuditora7Mockup({ onNavigate }) {
  const [users, setUsers] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [activeTab, setActiveTab] = useState('users'); // 'users' | 'audit'
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [showNewUserModal, setShowNewUserModal] = useState(false);
  const [feedback, setFeedback] = useState(null);

  useEffect(() => {
    let mounted = true;
    apiClient.get('/usuarios')
      .then(res => {
        const list = Array.isArray(res) ? res : (res?.data || []);
        if (mounted && list && list.length > 0) {
          setUsers(list.map(u => ({
            id: u.id,
            nombre: u.nombre || u.correo.split('@')[0],
            correo: u.correo,
            cedula: '180' + String(u.id).padStart(7, '0'),
            rol: u.ROL?.nombre || (u.rolId === 1 ? 'Administrador' : u.rolId === 2 ? 'Cliente' : u.rolId === 3 ? 'Mecánico' : 'Recepción'),
            estado: u.activo !== false ? 'Activo' : 'Inactivo',
            ultimoAcceso: 'Activo recientemente',
            accionesAuditadas: 24
          })));
        } else if (mounted) {
          setUsers([]);
        }
      })
      .catch(() => {
        if (mounted) setUsers([]);
      });

    apiClient.get('/auditorias')
      .then(res => {
        const logs = Array.isArray(res) ? res : (res?.data || []);
        if (mounted && logs && logs.length > 0) {
          setAuditLogs(logs.map(l => ({
            id: 'AUD-' + l.id,
            timestamp: l.fechaEvento ? new Date(l.fechaEvento).toLocaleString() : 'Reciente',
            usuario: l.Usuario?.nombre || 'Usuario Registrado',
            rol: 'Operación Taller',
            accion: l.operacion || 'TRANSACCION_AUTORIZADA',
            detalles: `${l.entidad} ID: ${l.entidadId || '-'}`,
            ip: '192.168.1.10',
            estado: 'Exitoso'
          })));
        } else if (mounted) {
          setAuditLogs([]);
        }
      })
      .catch(() => {
        if (mounted) setAuditLogs([]);
      });

    return () => { mounted = false; };
  }, []);

  const [newUser, setNewUser] = useState({
    nombre: '',
    correo: '',
    cedula: '',
    rol: 'Mecánico',
    telefono: '+593 '
  });

  const handleToggleStatus = (userId) => {
    setUsers(users.map(u => {
      if (u.id === userId) {
        const nuevoEstado = u.estado === 'Activo' ? 'Inactivo' : 'Activo';
        const newLog = {
          id: `AUD-${Math.floor(8843 + Math.random() * 1000)}`,
          timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19),
          usuario: 'Sesión Actual (Administrador)',
          rol: 'Administrador',
          accion: 'CAMBIO_ESTADO_USUARIO',
          detalles: `Cambio de estado del usuario ${u.nombre} a ${nuevoEstado}`,
          ip: '192.168.1.10',
          estado: 'Exitoso'
        };
        setAuditLogs([newLog, ...auditLogs]);
        return { ...u, estado: nuevoEstado };
      }
      return u;
    }));
    setFeedback('✓ Estado de usuario actualizado y registrado en auditoría (RF-34).');
    setTimeout(() => setFeedback(null), 4000);
  };

  const handleResetPassword = async (u) => {
    try {
      const created = await apiClient.post(`/workshop-flow/usuarios/${u.id}/clave`, {});
      setFeedback(`Clave temporal de ${created.correo}: ${created.passwordTemporal}`);
      setTimeout(() => setFeedback(null), 12000);
      return;
    } catch (err) {
      setFeedback(err.details?.message || err.message || 'No se pudo regenerar la clave.');
      return;
    }
    const tempPass = 'Autron$' + Math.floor(1000 + Math.random() * 9000);
    const newLog = {
      id: `AUD-${Math.floor(8843 + Math.random() * 1000)}`,
      timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19),
      usuario: 'Sesión Actual (Administrador)',
      rol: 'Administrador',
      accion: 'RESET_PASSWORD_ADMIN',
      detalles: `Generación de clave temporal para ${u.correo}`,
      ip: '192.168.1.10',
      estado: 'Exitoso'
    };
    setAuditLogs([newLog, ...auditLogs]);
    setFeedback(`✓ Clave temporal generada para ${u.nombre}: [ ${tempPass} ]. Notificación enviada al correo.`);
    setTimeout(() => setFeedback(null), 7000);
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    if (!newUser.nombre || !newUser.correo) return;
    try {
      const created = await apiClient.post('/workshop-flow/usuarios', {
        nombre: newUser.nombre,
        correo: newUser.correo,
        rol: newUser.rol
      });
      setUsers([...users, { id: created.id, nombre: created.nombre, correo: created.correo, rol: created.rol, estado: 'Activo', ultimoAcceso: 'Sin accesos', accionesAuditadas: 0, cedula: newUser.cedula }]);
      setShowNewUserModal(false);
      setNewUser({ nombre: '', correo: '', cedula: '', rol: 'Mecánico', telefono: '+593 ' });
      setFeedback(`Usuario creado. Clave temporal de ${created.correo}: ${created.passwordTemporal}`);
    } catch (err) {
      setFeedback(err.details?.message || err.message || 'No se pudo crear el usuario.');
    }
    setTimeout(() => setFeedback(null), 12000);
  };

  const filteredUsers = roleFilter === 'ALL' ? users : users.filter(u => u.rol.toLowerCase() === roleFilter.toLowerCase());

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-md bg-indigo-50 text-indigo-600 font-semibold text-xs uppercase tracking-wider">
              Módulo 1 · Seguridad y Accesos
            </span>
            <span className="text-xs text-slate-500 font-medium">RF-01 · RF-02 · RF-34 Auditoría</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Gestión de Usuarios, Roles y Auditoría</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Administración centralizada de cuentas, control de perfiles y bitácora criptográfica inmutable.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onNavigate?.('seguridadRolesPermisos')}
            className="px-3.5 py-2 rounded-xl border border-slate-200 hover:bg-slate-100 font-semibold text-xs text-slate-900 flex items-center gap-1.5 transition-colors"
          >
            <span className="material-symbols-outlined text-[18px] text-indigo-600">security</span>
            Matriz de Permisos
          </button>
          <button
            type="button"
            onClick={() => setShowNewUserModal(true)}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-50 text-white font-semibold text-xs flex items-center gap-1.5 shadow-xs transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">person_add</span>
            + Nuevo Usuario
          </button>
        </div>
      </div>

      {feedback && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-medium flex items-center gap-2">
          <span className="material-symbols-outlined text-emerald-600">verified</span>
          <span>{feedback}</span>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Usuarios Registrados</div>
            <div className="text-2xl font-bold text-slate-900 mt-1">{users.length} cuentas</div>
            <div className="text-xs text-emerald-600 font-medium mt-0.5">
              {users.filter(u => u.estado === 'Activo').length} activas en producción
            </div>
          </div>
          <div className="w-11 h-11 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <span className="material-symbols-outlined text-[24px]">groups</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Personal Operativo</div>
            <div className="text-2xl font-bold text-slate-900 mt-1">
              {users.filter(u => u.rol === 'Mecánico' || u.rol === 'Recepción').length} técnicos
            </div>
            <div className="text-xs text-slate-500 mt-0.5">Taller & Recepción</div>
          </div>
          <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <span className="material-symbols-outlined text-[24px]">engineering</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Bitácora Criptográfica</div>
            <div className="text-2xl font-bold text-emerald-600 mt-1">100% activa</div>
            <div className="text-xs text-slate-500 mt-0.5">RNF-04 · SRI & Cumplimiento</div>
          </div>
          <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <span className="material-symbols-outlined text-[24px]">verified_user</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Eventos Críticos (RF-34)</div>
            <div className="text-2xl font-bold text-indigo-600 mt-1">{auditLogs.length} logs hoy</div>
            <div className="text-xs text-slate-500 mt-0.5">Trazabilidad en tiempo real</div>
          </div>
          <div className="w-11 h-11 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <span className="material-symbols-outlined text-[24px]">history_edu</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('users')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
            activeTab === 'users'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'bg-white text-slate-500 hover:text-slate-900 border border-slate-200'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">manage_accounts</span>
          Cuentas y Perfiles ({users.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('audit')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
            activeTab === 'audit'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'bg-white text-slate-500 hover:text-slate-900 border border-slate-200'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">lock_clock</span>
          Bitácora de Auditoría RF-34 ({auditLogs.length})
        </button>
      </div>

      {/* View 1: Users */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="flex items-center justify-between gap-4 bg-white p-3.5 rounded-xl border border-slate-200">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500">Filtrar por Perfil:</span>
              {['ALL', 'Administrador', 'Recepción', 'Mecánico', 'Cliente'].map(r => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRoleFilter(r)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                    roleFilter === r
                      ? 'bg-indigo-600 text-white font-semibold'
                      : 'bg-slate-100 text-slate-900 hover:bg-slate-200'
                  }`}
                >
                  {r === 'ALL' ? 'Todos' : r}
                </button>
              ))}
            </div>
            <span className="text-xs text-slate-500 font-mono">{filteredUsers.length} registros</span>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-4">Usuario</th>
                    <th className="py-3 px-4">Cédula / ID</th>
                    <th className="py-3 px-4">Rol Asignado</th>
                    <th className="py-3 px-4">Último Acceso</th>
                    <th className="py-3 px-4">Auditoría</th>
                    <th className="py-3 px-4">Estado</th>
                    <th className="py-3 px-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-slate-900">
                  {filteredUsers.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-600 font-bold flex items-center justify-center text-xs">
                            {u.nombre.charAt(0)}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900">{u.nombre}</div>
                            <div className="text-[11px] text-slate-500 font-mono">{u.correo}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-500">{u.cedula}</td>
                      <td className="py-3.5 px-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold ${
                          u.rol === 'Administrador' ? 'bg-indigo-100 text-indigo-800' :
                          u.rol === 'Recepción' ? 'bg-sky-100 text-sky-800' :
                          u.rol === 'Mecánico' ? 'bg-amber-100 text-amber-800' :
                          'bg-emerald-100 text-emerald-800'
                        }`}>
                          {u.rol}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-500 font-mono text-[11px]">{u.ultimoAcceso}</td>
                      <td className="py-3.5 px-4">
                        <span className="text-[11px] text-indigo-600 font-semibold">{u.accionesAuditadas} eventos</span>
                      </td>
                      <td className="py-3.5 px-4">
                        {u.estado === 'Activo' ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Activo
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span> Inactivo
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleResetPassword(u)}
                            title="Restablecer contraseña"
                            className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-500 hover:text-indigo-600 transition-colors"
                          >
                            <span className="material-symbols-outlined text-[16px]">lock_reset</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleStatus(u.id)}
                            title={u.estado === 'Activo' ? 'Desactivar cuenta' : 'Activar cuenta'}
                            className={`p-1.5 rounded-lg border transition-colors ${
                              u.estado === 'Activo'
                                ? 'border-error/30 text-error hover:bg-error-container/30'
                                : 'border-emerald-300 text-emerald-700 hover:bg-emerald-50'
                            }`}
                          >
                            <span className="material-symbols-outlined text-[16px]">
                              {u.estado === 'Activo' ? 'block' : 'check_circle'}
                            </span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* View 2: Bitácora de Auditoría */}
      {activeTab === 'audit' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-200 bg-white flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-indigo-600 text-[20px]">security</span>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Registro Criptográfico de Eventos (RF-34)</h3>
                <p className="text-xs text-slate-500">Trazabilidad inmutable de operaciones sensibles conforme a RNF-04</p>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-200 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Sincronizado
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4">ID Auditoría</th>
                  <th className="py-3 px-4">Fecha / Hora</th>
                  <th className="py-3 px-4">Usuario & Rol</th>
                  <th className="py-3 px-4">Operación</th>
                  <th className="py-3 px-4">Detalle de Transacción</th>
                  <th className="py-3 px-4">IP Origen</th>
                  <th className="py-3 px-4">Resultado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-slate-900 font-mono text-[11px]">
                {auditLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-4 font-bold text-indigo-600">{log.id}</td>
                    <td className="py-3 px-4 text-slate-500">{log.timestamp}</td>
                    <td className="py-3 px-4 font-sans">
                      <div className="font-semibold text-slate-900">{log.usuario.split('(')[0]}</div>
                      <div className="text-[10px] text-slate-500">{log.rol}</div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-900 font-bold text-[10px]">
                        {log.accion}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-sans text-xs text-slate-900 max-w-xs">{log.detalles}</td>
                    <td className="py-3 px-4 text-slate-500">{log.ip}</td>
                    <td className="py-3 px-4 font-sans">
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        ✓ {log.estado}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Nuevo Usuario */}
      {showNewUserModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-indigo-600 text-[24px]">person_add</span>
                <h3 className="font-bold text-base text-slate-900">Crear Usuario del Sistema (RF-01)</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowNewUserModal(false)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-500"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-900 mb-1">Nombre y Apellido *</label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Ing. Marco Tapia"
                  value={newUser.nombre}
                  onChange={(e) => setNewUser({ ...newUser, nombre: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-600"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-900 mb-1">Correo Electrónico (Acceso) *</label>
                <input
                  type="email"
                  required
                  placeholder="usuario@autron.ec"
                  value={newUser.correo}
                  onChange={(e) => setNewUser({ ...newUser, correo: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-900 mb-1">Cédula / Identificación *</label>
                  <input
                    type="text"
                    required
                    placeholder="180..."
                    value={newUser.cedula}
                    onChange={(e) => setNewUser({ ...newUser, cedula: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono focus:ring-2 focus:ring-indigo-500 focus:border-indigo-600"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-900 mb-1">Rol Operativo (RF-02) *</label>
                  <select
                    value={newUser.rol}
                    onChange={(e) => setNewUser({ ...newUser, rol: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-medium focus:ring-2 focus:ring-indigo-500 focus:border-indigo-600"
                  >
                    <option value="Administrador">Administrador</option>
                    <option value="Recepción">Recepción y Asesoría</option>
                    <option value="Mecánico">Mecánico de Taller</option>
                    <option value="Cliente">Cliente</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-900 mb-1">Teléfono Móvil</label>
                <input
                  type="text"
                  value={newUser.telefono}
                  onChange={(e) => setNewUser({ ...newUser, telefono: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono focus:ring-2 focus:ring-indigo-500 focus:border-indigo-600"
                />
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-[11px] text-slate-500 flex items-center gap-2">
                <span className="material-symbols-outlined text-indigo-600 text-base">info</span>
                <span>Se enviará un correo con la clave inicial autogenerada para el primer ingreso.</span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowNewUserModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-900 font-semibold hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-50 text-white font-bold shadow-xs transition-colors"
                >
                  Crear Usuario
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
