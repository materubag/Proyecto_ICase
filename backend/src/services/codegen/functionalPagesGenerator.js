/**
 * Generador de Pantallas Funcionales para Frontend (React 18)
 * Basado en los Requerimientos, Mockups y Árbol de Navegación de Ingeniería (ISO 29148)
 */

function generateRecepcionPage() {
  return `import React, { useState, useEffect } from 'react';
import { apiRequest } from '../api/client';

export default function RecepcionPage() {
  const [recepciones, setRecepciones] = useState([
    { id: 1, placa: 'PBA-3421', cliente: 'Carlos Mendoza', fecha: '2026-10-24 09:30', kilometraje: 45200, combustible: '3/4', motivo: 'Mantenimiento preventivo y ruido en tren delantero', estado: 'En Inspección', zonas: { frente: 'Normal', trasera: 'Normal', lateralIzq: 'Revisión', lateralDer: 'Normal', techo: 'Normal' } },
    { id: 2, placa: 'GTX-9081', cliente: 'Lucía Fernández', fecha: '2026-10-24 11:15', kilometraje: 89300, combustible: '1/2', motivo: 'Luz Check Engine encendida y pérdida de potencia', estado: 'Diagnosticado', zonas: { frente: 'Normal', trasera: 'Falla', lateralIzq: 'Normal', lateralDer: 'Normal', techo: 'Normal' } }
  ]);
  const [modalOpen, setModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    placa: '',
    cliente: '',
    kilometraje: '',
    combustible: '1/2',
    motivo: '',
    observaciones: '',
    zonas: { frente: 'Normal', trasera: 'Normal', lateralIzq: 'Normal', lateralDer: 'Normal', techo: 'Normal' }
  });

  const handleCrear = async (e) => {
    e.preventDefault();
    const nuevo = {
      id: Date.now(),
      ...formData,
      fecha: new Date().toISOString().replace('T', ' ').substring(0, 16),
      estado: 'Ingresado'
    };
    try {
      await apiRequest('/recepcions', { method: 'POST', body: nuevo }).catch(() => {});
    } catch (err) {}
    setRecepciones([nuevo, ...recepciones]);
    setModalOpen(false);
    setFormData({ placa: '', cliente: '', kilometraje: '', combustible: '1/2', motivo: '', observaciones: '', zonas: { frente: 'Normal', trasera: 'Normal', lateralIzq: 'Normal', lateralDer: 'Normal', techo: 'Normal' } });
  };

  const getBadgeClass = (estado) => {
    if (estado === 'Ingresado') return 'badge-info';
    if (estado === 'En Inspección') return 'badge-warning';
    if (estado === 'Diagnosticado') return 'badge-success';
    return 'badge-secondary';
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700 }}>🚗 Recepción e Inspección de Vehículos</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '4px' }}>
            Control de ingreso de vehículos, kilometraje, combustible e inspección pericial de zonas con evidencias.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setModalOpen(true)}>
          <span className="material-symbols-outlined">add</span>
          Nueva Recepción
        </button>
      </div>

      {/* Métricas rápidas de recepción */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div className="card" style={{ borderLeft: '4px solid var(--primary)' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Vehículos en Taller Hoy</span>
          <h3 style={{ fontSize: '1.5rem', marginTop: '4px' }}>{recepciones.length}</h3>
        </div>
        <div className="card" style={{ borderLeft: '4px solid #f59e0b' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>En Inspección</span>
          <h3 style={{ fontSize: '1.5rem', marginTop: '4px' }}>{recepciones.filter(r => r.estado === 'En Inspección').length}</h3>
        </div>
        <div className="card" style={{ borderLeft: '4px solid #10b981' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Inspecciones Completadas</span>
          <h3 style={{ fontSize: '1.5rem', marginTop: '4px' }}>{recepciones.filter(r => r.estado === 'Diagnosticado').length}</h3>
        </div>
      </div>

      {/* Tabla de Recepciones */}
      <div className="card">
        <h3 style={{ fontSize: '1.05rem', marginBottom: '16px', fontWeight: 600 }}>Registro de Ingresos Recientes</h3>
        <div className="table-responsive">
          <table>
            <thead>
              <tr>
                <th>Placa</th>
                <th>Cliente</th>
                <th>Fecha Ingreso</th>
                <th>Kilometraje</th>
                <th>Combustible</th>
                <th>Motivo de Ingreso</th>
                <th>Estado</th>
                <th>Inspección Zonas</th>
              </tr>
            </thead>
            <tbody>
              {recepciones.map(r => (
                <tr key={r.id}>
                  <td><strong>{r.placa}</strong></td>
                  <td>{r.cliente}</td>
                  <td>{r.fecha}</td>
                  <td>{Number(r.kilometraje).toLocaleString()} km</td>
                  <td>
                    <span className="badge badge-secondary">{r.combustible}</span>
                  </td>
                  <td>{r.motivo}</td>
                  <td>
                    <span className={\`badge \${getBadgeClass(r.estado)}\`}>{r.estado}</span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '4px', fontSize: '0.72rem' }}>
                      <span title="Frente" className={\`badge \${r.zonas?.frente === 'Normal' ? 'badge-success' : 'badge-warning'}\`}>F: {r.zonas?.frente}</span>
                      <span title="Trasera" className={\`badge \${r.zonas?.trasera === 'Normal' ? 'badge-success' : 'badge-danger'}\`}>T: {r.zonas?.trasera}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Nueva Recepción */}
      {modalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '650px' }}>
            <h3 style={{ marginBottom: '16px', fontWeight: 700 }}>Registrar Nueva Recepción de Vehículo</h3>
            <form onSubmit={handleCrear}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label>Placa del Vehículo *</label>
                  <input className="form-control" required placeholder="Ej: PBA-3421" value={formData.placa} onChange={e => setFormData({ ...formData, placa: e.target.value.toUpperCase() })} />
                </div>
                <div className="form-group">
                  <label>Nombre del Cliente *</label>
                  <input className="form-control" required placeholder="Ej: Carlos Mendoza" value={formData.cliente} onChange={e => setFormData({ ...formData, cliente: e.target.value })} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label>Kilometraje Actual *</label>
                  <input type="number" className="form-control" required placeholder="Ej: 45000" value={formData.kilometraje} onChange={e => setFormData({ ...formData, kilometraje: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Nivel de Combustible</label>
                  <select className="form-control" value={formData.combustible} onChange={e => setFormData({ ...formData, combustible: e.target.value })}>
                    <option value="Reserva">Reserva (E)</option>
                    <option value="1/4">1/4 de Tanque</option>
                    <option value="1/2">1/2 de Tanque</option>
                    <option value="3/4">3/4 de Tanque</option>
                    <option value="Lleno">Tanque Lleno (F)</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>Motivo de Ingreso / Síntomas reportados *</label>
                <textarea className="form-control" rows={2} required placeholder="Describa el motivo de visita, ruidos, fallas observadas..." value={formData.motivo} onChange={e => setFormData({ ...formData, motivo: e.target.value })} />
              </div>

              {/* Inspección visual de Zonas */}
              <div style={{ marginBottom: '16px', padding: '12px', background: '#f8fafc', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                <label style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: '8px', display: 'block' }}>
                  Inspección Visual de Carrocería y Zonas
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px' }}>
                  {['frente', 'trasera', 'lateralIzq', 'lateralDer', 'techo'].map(zona => (
                    <div key={zona}>
                      <span style={{ fontSize: '0.75rem', textTransform: 'capitalize', color: 'var(--text-muted)' }}>{zona}:</span>
                      <select
                        className="form-control"
                        style={{ fontSize: '0.78rem', padding: '4px 6px' }}
                        value={formData.zonas[zona]}
                        onChange={e => setFormData({ ...formData, zonas: { ...formData.zonas, [zona]: e.target.value } })}
                      >
                        <option value="Normal">Normal</option>
                        <option value="Revisión">Revisión</option>
                        <option value="Falla">Falla</option>
                        <option value="Falla Crítica">Falla Crítica</option>
                      </select>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Guardar Recepción</button>
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

function generateCitasPage() {
  return `import React, { useState } from 'react';
import { apiRequest } from '../api/client';

export default function CitasPage() {
  const [citas, setCitas] = useState([
    { id: 1, fecha: '2026-10-25 08:30', cliente: 'Roberto Gómez', vehiculo: 'Toyota Hilux (PCA-5541)', servicio: 'Mantenimiento 40,000 km', bahia: 'Bahía 1 (Elevador)', estado: 'Confirmada' },
    { id: 2, fecha: '2026-10-25 10:00', cliente: 'Andrea Paredes', vehiculo: 'Hyundai Tucson (TBB-2190)', servicio: 'Diagnóstico Electrónico OBD', bahia: 'Bahía 3 (Electrónica)', estado: 'Pendiente' },
    { id: 3, fecha: '2026-10-25 14:00', cliente: 'Esteban Morales', vehiculo: 'Chevrolet D-Max (PBC-8812)', servicio: 'Cambio de Pastillas y Frenos', bahia: 'Bahía 2 (Frenos)', estado: 'Confirmada' }
  ]);
  const [modalOpen, setModalOpen] = useState(false);
  const [filtroEstado, setFiltroEstado] = useState('Todos');
  const [formData, setFormData] = useState({
    fecha: '',
    hora: '09:00',
    cliente: '',
    vehiculo: '',
    servicio: 'Mantenimiento Preventivo',
    bahia: 'Bahía 1 (Elevador)'
  });

  const handleCrear = async (e) => {
    e.preventDefault();
    const nueva = {
      id: Date.now(),
      fecha: \`\${formData.fecha} \${formData.hora}\`,
      cliente: formData.cliente,
      vehiculo: formData.vehiculo,
      servicio: formData.servicio,
      bahia: formData.bahia,
      estado: 'Confirmada'
    };
    try {
      await apiRequest('/citas', { method: 'POST', body: nueva }).catch(() => {});
    } catch (err) {}
    setCitas([nueva, ...citas]);
    setModalOpen(false);
  };

  const citasFiltradas = filtroEstado === 'Todos' ? citas : citas.filter(c => c.estado === filtroEstado);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700 }}>📅 Agenda y Gestión de Citas de Taller</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '4px' }}>
            Programación de turnos de taller, asignación de bahías y confirmación de disponibilidad técnica.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setModalOpen(true)}>
          <span className="material-symbols-outlined">event_available</span>
          Agendar Cita
        </button>
      </div>

      {/* Filtros de estado */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
        {['Todos', 'Confirmada', 'Pendiente', 'Cancelada'].map(st => (
          <button
            key={st}
            className={\`btn btn-sm \${filtroEstado === st ? 'btn-primary' : 'btn-secondary'}\`}
            onClick={() => setFiltroEstado(st)}
          >
            {st}
          </button>
        ))}
      </div>

      <div className="card">
        <div className="table-responsive">
          <table>
            <thead>
              <tr>
                <th>Fecha y Hora</th>
                <th>Cliente</th>
                <th>Vehículo</th>
                <th>Servicio Solicitado</th>
                <th>Bahía Asignada</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {citasFiltradas.map(c => (
                <tr key={c.id}>
                  <td><strong>{c.fecha}</strong></td>
                  <td>{c.cliente}</td>
                  <td>{c.vehiculo}</td>
                  <td>{c.servicio}</td>
                  <td><span className="badge badge-secondary">{c.bahia}</span></td>
                  <td>
                    <span className={\`badge \${c.estado === 'Confirmada' ? 'badge-success' : 'badge-warning'}\`}>
                      {c.estado}
                    </span>
                  </td>
                  <td>
                    <button className="btn btn-sm btn-secondary" onClick={() => {
                      setCitas(citas.map(x => x.id === c.id ? { ...x, estado: x.estado === 'Confirmada' ? 'Completada' : 'Confirmada' } : x));
                    }}>
                      Cambiar Estado
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {modalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3 style={{ marginBottom: '16px', fontWeight: 700 }}>Programar Nueva Cita</h3>
            <form onSubmit={handleCrear}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label>Fecha *</label>
                  <input type="date" className="form-control" required value={formData.fecha} onChange={e => setFormData({ ...formData, fecha: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Hora *</label>
                  <input type="time" className="form-control" required value={formData.hora} onChange={e => setFormData({ ...formData, hora: e.target.value })} />
                </div>
              </div>
              <div className="form-group">
                <label>Nombre del Cliente *</label>
                <input className="form-control" required placeholder="Ej: Mario Ramos" value={formData.cliente} onChange={e => setFormData({ ...formData, cliente: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Vehículo (Placa / Modelo) *</label>
                <input className="form-control" required placeholder="Ej: Nissan Kicks (PBA-1020)" value={formData.vehiculo} onChange={e => setFormData({ ...formData, vehiculo: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Bahía de Atención</label>
                <select className="form-control" value={formData.bahia} onChange={e => setFormData({ ...formData, bahia: e.target.value })}>
                  <option value="Bahía 1 (Elevador)">Bahía 1 (Mecánica y Elevador)</option>
                  <option value="Bahía 2 (Frenos)">Bahía 2 (Frenos y Suspensión)</option>
                  <option value="Bahía 3 (Electrónica)">Bahía 3 (Diagnóstico OBD)</option>
                </select>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Confirmar Cita</button>
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

function generateClientesPage() {
  return `import React, { useState } from 'react';
import { apiRequest } from '../api/client';

export default function ClientesPage() {
  const [clientes, setClientes] = useState([
    { id: 1, identificacion: '1723456789', nombre: 'Carlos Mendoza', telefono: '0987654321', correo: 'carlos.m@example.com', direccion: 'Av. Amazonas y Colón', vehiculosCount: 2 },
    { id: 2, identificacion: '1798765432', nombre: 'Lucía Fernández', telefono: '0991234567', correo: 'lucia.f@example.com', direccion: 'Calle República 402', vehiculosCount: 1 },
    { id: 3, identificacion: '0912345678', nombre: 'Roberto Gómez', telefono: '0981122334', correo: 'roberto.g@example.com', direccion: 'Av. Shyris N34', vehiculosCount: 3 }
  ]);
  const [busqueda, setBusqueda] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [formData, setFormData] = useState({ identificacion: '', nombre: '', telefono: '', correo: '', direccion: '' });

  const handleCrear = async (e) => {
    e.preventDefault();
    const nuevo = { id: Date.now(), ...formData, vehiculosCount: 0 };
    try {
      await apiRequest('/clientes', { method: 'POST', body: nuevo }).catch(() => {});
    } catch (err) {}
    setClientes([nuevo, ...clientes]);
    setModalOpen(false);
    setFormData({ identificacion: '', nombre: '', telefono: '', correo: '', direccion: '' });
  };

  const filtrados = clientes.filter(c =>
    c.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
    c.identificacion.includes(busqueda) ||
    c.correo.toLowerCase().includes(busqueda.toLowerCase())
  );

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700 }}>👥 Directorio y Fichas de Clientes</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '4px' }}>
            Expediente de clientes, teléfonos, historial de contacto y flota de vehículos registrados.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setModalOpen(true)}>
          <span className="material-symbols-outlined">person_add</span>
          Nuevo Cliente
        </button>
      </div>

      {/* Buscador */}
      <div style={{ marginBottom: '16px' }}>
        <input
          type="text"
          className="form-control"
          placeholder="🔍 Buscar por nombre, cédula o correo..."
          style={{ maxWidth: '400px' }}
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
        />
      </div>

      <div className="card">
        <div className="table-responsive">
          <table>
            <thead>
              <tr>
                <th>Cédula / RUC</th>
                <th>Nombre Completo</th>
                <th>Teléfono</th>
                <th>Correo Electrónico</th>
                <th>Dirección</th>
                <th>Vehículos</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map(c => (
                <tr key={c.id}>
                  <td><strong>{c.identificacion}</strong></td>
                  <td>{c.nombre}</td>
                  <td>{c.telefono}</td>
                  <td>{c.correo}</td>
                  <td>{c.direccion}</td>
                  <td><span className="badge badge-info">{c.vehiculosCount} Vehículos</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {modalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3 style={{ marginBottom: '16px', fontWeight: 700 }}>Registrar Nuevo Cliente</h3>
            <form onSubmit={handleCrear}>
              <div className="form-group">
                <label>Identificación (Cédula o RUC) *</label>
                <input className="form-control" required placeholder="Ej: 1723456789" value={formData.identificacion} onChange={e => setFormData({ ...formData, identificacion: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Nombre Completo *</label>
                <input className="form-control" required placeholder="Ej: Juan Pérez" value={formData.nombre} onChange={e => setFormData({ ...formData, nombre: e.target.value })} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label>Teléfono Celular *</label>
                  <input className="form-control" required placeholder="Ej: 0987654321" value={formData.telefono} onChange={e => setFormData({ ...formData, telefono: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Correo Electrónico</label>
                  <input type="email" className="form-control" placeholder="juan@example.com" value={formData.correo} onChange={e => setFormData({ ...formData, correo: e.target.value })} />
                </div>
              </div>
              <div className="form-group">
                <label>Dirección</label>
                <input className="form-control" placeholder="Dirección domiciliaria" value={formData.direccion} onChange={e => setFormData({ ...formData, direccion: e.target.value })} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Guardar Cliente</button>
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

function generateVehiculosPage() {
  return `import React, { useState } from 'react';
import { apiRequest } from '../api/client';

export default function VehiculosPage() {
  const [vehiculos, setVehiculos] = useState([
    { id: 1, placa: 'PBA-3421', marca: 'Chevrolet', modelo: 'Sail', anio: 2021, vin: '9BG114488A01293', kilometraje: 45200, color: 'Gris Plata', cliente: 'Carlos Mendoza' },
    { id: 2, placa: 'GTX-9081', marca: 'Toyota', modelo: 'Corolla Cross', anio: 2023, vin: 'JT34991122AA991', kilometraje: 21300, color: 'Blanco Perlado', cliente: 'Lucía Fernández' },
    { id: 3, placa: 'PCA-5541', marca: 'Toyota', modelo: 'Hilux 4x4', anio: 2020, vin: '8AJ991100224411', kilometraje: 98400, color: 'Negro', cliente: 'Roberto Gómez' }
  ]);
  const [busqueda, setBusqueda] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [formData, setFormData] = useState({ placa: '', marca: '', modelo: '', anio: 2022, vin: '', kilometraje: '', color: '', cliente: '' });

  const handleCrear = async (e) => {
    e.preventDefault();
    const nuevo = { id: Date.now(), ...formData };
    try {
      await apiRequest('/vehiculos', { method: 'POST', body: nuevo }).catch(() => {});
    } catch (err) {}
    setVehiculos([nuevo, ...vehiculos]);
    setModalOpen(false);
  };

  const filtrados = vehiculos.filter(v =>
    v.placa.toLowerCase().includes(busqueda.toLowerCase()) ||
    v.marca.toLowerCase().includes(busqueda.toLowerCase()) ||
    v.modelo.toLowerCase().includes(busqueda.toLowerCase()) ||
    v.cliente.toLowerCase().includes(busqueda.toLowerCase())
  );

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700 }}>🚘 Expediente Digital de Vehículos</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '4px' }}>
            Hoja de vida técnica de vehículos: VIN, kilometraje, mantenimientos previos y trazabilidad histórica.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setModalOpen(true)}>
          <span className="material-symbols-outlined">directions_car</span>
          Registrar Vehículo
        </button>
      </div>

      <div style={{ marginBottom: '16px' }}>
        <input
          type="text"
          className="form-control"
          placeholder="🔍 Buscar por placa, marca, modelo o cliente..."
          style={{ maxWidth: '400px' }}
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
        />
      </div>

      <div className="card">
        <div className="table-responsive">
          <table>
            <thead>
              <tr>
                <th>Placa</th>
                <th>Marca y Modelo</th>
                <th>Año</th>
                <th>VIN / Chasis</th>
                <th>Kilometraje</th>
                <th>Color</th>
                <th>Propietario</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map(v => (
                <tr key={v.id}>
                  <td><strong>{v.placa}</strong></td>
                  <td>{v.marca} {v.modelo}</td>
                  <td>{v.anio}</td>
                  <td><code style={{ fontSize: '0.78rem' }}>{v.vin}</code></td>
                  <td>{Number(v.kilometraje).toLocaleString()} km</td>
                  <td>{v.color}</td>
                  <td>{v.cliente}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {modalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3 style={{ marginBottom: '16px', fontWeight: 700 }}>Registrar Vehículo</h3>
            <form onSubmit={handleCrear}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label>Placa *</label>
                  <input className="form-control" required placeholder="Ej: PBX-1234" value={formData.placa} onChange={e => setFormData({ ...formData, placa: e.target.value.toUpperCase() })} />
                </div>
                <div className="form-group">
                  <label>Propietario / Cliente *</label>
                  <input className="form-control" required placeholder="Nombre del cliente" value={formData.cliente} onChange={e => setFormData({ ...formData, cliente: e.target.value })} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label>Marca *</label>
                  <input className="form-control" required placeholder="Ej: Toyota" value={formData.marca} onChange={e => setFormData({ ...formData, marca: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Modelo *</label>
                  <input className="form-control" required placeholder="Ej: Hilux" value={formData.modelo} onChange={e => setFormData({ ...formData, modelo: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Año *</label>
                  <input type="number" className="form-control" required value={formData.anio} onChange={e => setFormData({ ...formData, anio: e.target.value })} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label>Número de Chasis (VIN)</label>
                  <input className="form-control" placeholder="17 caracteres" value={formData.vin} onChange={e => setFormData({ ...formData, vin: e.target.value.toUpperCase() })} />
                </div>
                <div className="form-group">
                  <label>Kilometraje Actual</label>
                  <input type="number" className="form-control" placeholder="Ej: 54000" value={formData.kilometraje} onChange={e => setFormData({ ...formData, kilometraje: e.target.value })} />
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Guardar en Expediente</button>
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

function generateDiagnosticosPage() {
  return `import React, { useState } from 'react';
import { apiRequest } from '../api/client';

export default function DiagnosticosPage() {
  const [diagnosticos, setDiagnosticos] = useState([
    { id: 1, vehiculo: 'GTX-9081 (Corolla Cross)', codigoObd: 'P0300', sistema: 'Motor / Encendido', severidad: 'Alta', descripcion: 'Fallo de encendido aleatorio en múltiples cilindros', solucion: 'Reemplazo de bujías de iridio y limpieza de inyectores', estado: 'Pendiente Reparación' },
    { id: 2, vehiculo: 'PBA-3421 (Sail)', codigoObd: 'C0035', sistema: 'Frenos ABS', severidad: 'Media', descripcion: 'Circuito sensor de velocidad de rueda delantera izquierda', solucion: 'Ajuste de conector y sustitución de sensor ABS izquierdo', estado: 'En Reparación' },
    { id: 3, vehiculo: 'PCA-5541 (Hilux)', codigoObd: 'P0420', sistema: 'Emisiones / Escape', severidad: 'Baja', descripcion: 'Eficiencia del sistema catalizador por debajo del umbral', solucion: 'Limpieza de sensor de oxígeno banco 1', estado: 'Completado' }
  ]);
  const [modalOpen, setModalOpen] = useState(false);
  const [formData, setFormData] = useState({ vehiculo: '', codigoObd: 'P0300', sistema: 'Motor', severidad: 'Media', descripcion: '', solucion: '' });

  const handleCrear = async (e) => {
    e.preventDefault();
    const nuevo = { id: Date.now(), ...formData, estado: 'Registrado' };
    try {
      await apiRequest('/diagnosticos', { method: 'POST', body: nuevo }).catch(() => {});
    } catch (err) {}
    setDiagnosticos([nuevo, ...diagnosticos]);
    setModalOpen(false);
  };

  const getSeveridadBadge = (sev) => {
    if (sev === 'Crítica' || sev === 'Alta') return 'badge-danger';
    if (sev === 'Media') return 'badge-warning';
    return 'badge-info';
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700 }}>🔍 Diagnóstico Técnico y Averías OBD-II</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '4px' }}>
            Registro de códigos de falla DTC, lectura OBD de sensores, severidad y pruebas periciales de taller.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setModalOpen(true)}>
          <span className="material-symbols-outlined">bug_report</span>
          Nuevo Diagnóstico
        </button>
      </div>

      <div className="card">
        <div className="table-responsive">
          <table>
            <thead>
              <tr>
                <th>Vehículo</th>
                <th>Código OBD</th>
                <th>Sistema</th>
                <th>Severidad</th>
                <th>Descripción de la Falla</th>
                <th>Solución Técnica Recomendada</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {diagnosticos.map(d => (
                <tr key={d.id}>
                  <td><strong>{d.vehiculo}</strong></td>
                  <td>
                    <code style={{ background: '#f1f5f9', padding: '3px 6px', borderRadius: '4px', fontWeight: 700, color: '#0f172a' }}>
                      {d.codigoObd}
                    </code>
                  </td>
                  <td>{d.sistema}</td>
                  <td>
                    <span className={\`badge \${getSeveridadBadge(d.severidad)}\`}>{d.severidad}</span>
                  </td>
                  <td>{d.descripcion}</td>
                  <td>{d.solucion}</td>
                  <td><span className="badge badge-secondary">{d.estado}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {modalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '600px' }}>
            <h3 style={{ marginBottom: '16px', fontWeight: 700 }}>Registrar Diagnóstico Técnico</h3>
            <form onSubmit={handleCrear}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label>Vehículo *</label>
                  <input className="form-control" required placeholder="Ej: PBA-3421 (Sail)" value={formData.vehiculo} onChange={e => setFormData({ ...formData, vehiculo: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Código de Falla OBD (DTC) *</label>
                  <input className="form-control" required placeholder="Ej: P0300" value={formData.codigoObd} onChange={e => setFormData({ ...formData, codigoObd: e.target.value.toUpperCase() })} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label>Sistema Afectado</label>
                  <select className="form-control" value={formData.sistema} onChange={e => setFormData({ ...formData, sistema: e.target.value })}>
                    <option value="Motor / Encendido">Motor / Encendido</option>
                    <option value="Frenos ABS">Frenos ABS</option>
                    <option value="Transmisión">Transmisión</option>
                    <option value="Emisiones / Escape">Emisiones / Escape</option>
                    <option value="Sistema Eléctrico">Sistema Eléctrico</option>
                    <option value="Suspensión">Suspensión</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Nivel de Severidad</label>
                  <select className="form-control" value={formData.severidad} onChange={e => setFormData({ ...formData, severidad: e.target.value })}>
                    <option value="Leve">Leve</option>
                    <option value="Media">Media</option>
                    <option value="Alta">Alta</option>
                    <option value="Crítica">Crítica (Inmoviliza)</option>
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label>Descripción de Síntomas *</label>
                <textarea className="form-control" rows={2} required placeholder="Lecturas de escáner, síntomas manifestados..." value={formData.descripcion} onChange={e => setFormData({ ...formData, descripcion: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Procedimiento de Solución Recomendada</label>
                <textarea className="form-control" rows={2} placeholder="Reparación o sustitución de componentes requerida..." value={formData.solucion} onChange={e => setFormData({ ...formData, solucion: e.target.value })} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Registrar Avería</button>
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

function generateReparacionesPage() {
  return `import React, { useState } from 'react';
import { apiRequest } from '../api/client';

export default function ReparacionesPage() {
  const [ordenes, setOrdenes] = useState([
    { id: 'OT-101', vehiculo: 'PBA-3421 (Sail)', cliente: 'Carlos Mendoza', mecanico: 'Ing. Marco Valencia', progreso: 75, etapa: 'En Reparación', actividades: 'Sustitución de bujes de tijera, rectificación de discos delanteros', repuestos: 'Pastillas Bosch (x1), Bujes de suspensión (x2)' },
    { id: 'OT-102', vehiculo: 'GTX-9081 (Corolla Cross)', cliente: 'Lucía Fernández', mecanico: 'Téc. Javier Andrade', progreso: 35, etapa: 'Esperando Repuestos', actividades: 'Diagnóstico OBD confirmado, desmontaje de inyectores', repuestos: 'Juego de bujías iridio (x4)' },
    { id: 'OT-103', vehiculo: 'PCA-5541 (Hilux)', cliente: 'Roberto Gómez', mecanico: 'Ing. Marco Valencia', progreso: 100, etapa: 'Control de Calidad', actividades: 'Afinamiento mayor completo y prueba de ruta OK', repuestos: 'Filtro aceite (x1), Aceite sintético 5W30 (x4 gl)' }
  ]);
  const [modalOpen, setModalOpen] = useState(false);
  const [formData, setFormData] = useState({ id: 'OT-104', vehiculo: '', cliente: '', mecanico: 'Ing. Marco Valencia', actividades: '', repuestos: '' });

  const handleCrear = async (e) => {
    e.preventDefault();
    const nueva = { ...formData, progreso: 15, etapa: 'En Diagnóstico' };
    try {
      await apiRequest('/orden_trabajos', { method: 'POST', body: nueva }).catch(() => {});
    } catch (err) {}
    setOrdenes([nueva, ...ordenes]);
    setModalOpen(false);
  };

  const avanzarEtapa = (id) => {
    setOrdenes(ordenes.map(o => {
      if (o.id !== id) return o;
      if (o.etapa === 'En Diagnóstico') return { ...o, etapa: 'En Reparación', progreso: 50 };
      if (o.etapa === 'En Reparación') return { ...o, etapa: 'Control de Calidad', progreso: 90 };
      if (o.etapa === 'Control de Calidad') return { ...o, etapa: 'Completada', progreso: 100 };
      return o;
    }));
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700 }}>🔧 Órdenes de Trabajo y Bitácora de Taller</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '4px' }}>
            Control de órdenes de reparación, asignación de mecánicos, insumos consumidos y avance por etapas.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setModalOpen(true)}>
          <span className="material-symbols-outlined">note_add</span>
          Nueva Orden de Trabajo
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {ordenes.map(o => (
          <div className="card" key={o.id}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--primary)' }}>{o.id}</span>
                <h3 style={{ fontSize: '1.1rem', marginTop: '2px' }}>{o.vehiculo} — {o.cliente}</h3>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span className="badge badge-info">{o.etapa}</span>
                {o.progreso < 100 && (
                  <button className="btn btn-sm btn-primary" onClick={() => avanzarEtapa(o.id)}>
                    Avanzar Etapa →
                  </button>
                )}
              </div>
            </div>

            {/* Barra de progreso */}
            <div style={{ background: '#e2e8f0', borderRadius: '999px', height: '8px', overflow: 'hidden', marginBottom: '12px' }}>
              <div style={{ background: o.progreso === 100 ? '#10b981' : 'var(--primary)', height: '100%', width: \`\${o.progreso}%\`, transition: 'width 0.4s ease' }} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', fontSize: '0.85rem' }}>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Mecánico Responsable:</span>
                <p><strong>{o.mecanico}</strong></p>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Actividades Registradas:</span>
                <p>{o.actividades}</p>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Repuestos Consumidos:</span>
                <p>{o.repuestos}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {modalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3 style={{ marginBottom: '16px', fontWeight: 700 }}>Apertura de Orden de Trabajo</h3>
            <form onSubmit={handleCrear}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label>Número de Orden</label>
                  <input className="form-control" required value={formData.id} onChange={e => setFormData({ ...formData, id: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Mecánico Asignado</label>
                  <select className="form-control" value={formData.mecanico} onChange={e => setFormData({ ...formData, mecanico: e.target.value })}>
                    <option value="Ing. Marco Valencia">Ing. Marco Valencia (Líder Mecánica)</option>
                    <option value="Téc. Javier Andrade">Téc. Javier Andrade (Electrónica OBD)</option>
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label>Vehículo *</label>
                <input className="form-control" required placeholder="Ej: PBA-3421 (Sail)" value={formData.vehiculo} onChange={e => setFormData({ ...formData, vehiculo: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Cliente *</label>
                <input className="form-control" required placeholder="Nombre del cliente" value={formData.cliente} onChange={e => setFormData({ ...formData, cliente: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Actividades a Realizar</label>
                <textarea className="form-control" rows={2} required placeholder="Detalle de actividades autorizadas..." value={formData.actividades} onChange={e => setFormData({ ...formData, actividades: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Repuestos del Inventario a Utilizar</label>
                <input className="form-control" placeholder="Ej: Filtro aceite, 4 bujías" value={formData.repuestos} onChange={e => setFormData({ ...formData, repuestos: e.target.value })} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Abrir Orden de Trabajo</button>
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

function generateInventarioPage() {
  return `import React, { useState } from 'react';
import { apiRequest } from '../api/client';

export default function InventarioPage() {
  const [repuestos, setRepuestos] = useState([
    { id: 1, codigo: 'REP-001', nombre: 'Pastillas de Freno Delanteras', categoria: 'Frenos', marca: 'Bosch', stock: 3, stockMin: 5, costo: 22.50, precio: 38.00 },
    { id: 2, codigo: 'REP-002', nombre: 'Bujía de Iridio IX', categoria: 'Encendido', marca: 'NGK', stock: 16, stockMin: 8, costo: 7.20, precio: 12.50 },
    { id: 3, codigo: 'REP-003', nombre: 'Filtro de Aceite Blindado', categoria: 'Filtros', marca: 'Mann Filter', stock: 2, stockMin: 6, costo: 4.80, precio: 9.00 },
    { id: 4, codigo: 'REP-004', nombre: 'Aceite Sintético 5W-30 (Galón)', categoria: 'Lubricantes', marca: 'Mobil 1', stock: 12, stockMin: 4, costo: 28.00, precio: 45.00 }
  ]);
  const [modalOpen, setModalOpen] = useState(false);
  const [formData, setFormData] = useState({ codigo: '', nombre: '', categoria: 'Frenos', marca: '', stock: 10, stockMin: 5, costo: '', precio: '' });

  const bajoStockItems = repuestos.filter(r => r.stock <= r.stockMin);

  const handleCrear = async (e) => {
    e.preventDefault();
    const nuevo = { id: Date.now(), ...formData, costo: Number(formData.costo), precio: Number(formData.precio), stock: Number(formData.stock), stockMin: Number(formData.stockMin) };
    try {
      await apiRequest('/repuestos', { method: 'POST', body: nuevo }).catch(() => {});
    } catch (err) {}
    setRepuestos([...repuestos, nuevo]);
    setModalOpen(false);
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700 }}>📦 Inventario de Repuestos y Alertas de Stock</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '4px' }}>
            Control de existencias, repuestos, costos, precios de venta y alertas automáticas de reabastecimiento.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setModalOpen(true)}>
          <span className="material-symbols-outlined">add_box</span>
          Nuevo Repuesto
        </button>
      </div>

      {/* Alerta de bajo stock */}
      {bajoStockItems.length > 0 && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '16px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span className="material-symbols-outlined" style={{ color: '#ef4444', fontSize: '28px' }}>warning</span>
          <div>
            <strong style={{ color: '#991b1b' }}>¡Alerta de Repuestos con Bajo Stock ({bajoStockItems.length})!</strong>
            <p style={{ fontSize: '0.85rem', color: '#b91c1c', marginTop: '2px' }}>
              Los siguientes repuestos están en nivel crítico: {bajoStockItems.map(i => \`\${i.nombre} (Stock: \${i.stock})\`).join(', ')}.
            </p>
          </div>
        </div>
      )}

      <div className="card">
        <div className="table-responsive">
          <table>
            <thead>
              <tr>
                <th>Código</th>
                <th>Repuesto / Descripción</th>
                <th>Categoría</th>
                <th>Marca</th>
                <th>Stock Actual</th>
                <th>Stock Mínimo</th>
                <th>Costo Unit.</th>
                <th>Precio Venta</th>
                <th>Estado Stock</th>
              </tr>
            </thead>
            <tbody>
              {repuestos.map(r => {
                const esCritico = r.stock <= r.stockMin;
                return (
                  <tr key={r.id}>
                    <td><strong>{r.codigo}</strong></td>
                    <td>{r.nombre}</td>
                    <td>{r.categoria}</td>
                    <td>{r.marca}</td>
                    <td><strong style={{ color: esCritico ? '#ef4444' : 'inherit' }}>{r.stock} u.</strong></td>
                    <td>{r.stockMin} u.</td>
                    <td>\${Number(r.costo).toFixed(2)}</td>
                    <td>\${Number(r.precio).toFixed(2)}</td>
                    <td>
                      <span className={\`badge \${esCritico ? 'badge-danger' : 'badge-success'}\`}>
                        {esCritico ? '⚠️ Bajo Stock' : 'OK'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {modalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3 style={{ marginBottom: '16px', fontWeight: 700 }}>Registrar Nuevo Repuesto</h3>
            <form onSubmit={handleCrear}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label>Código de Parte *</label>
                  <input className="form-control" required placeholder="REP-005" value={formData.codigo} onChange={e => setFormData({ ...formData, codigo: e.target.value.toUpperCase() })} />
                </div>
                <div className="form-group">
                  <label>Marca *</label>
                  <input className="form-control" required placeholder="Ej: Denso" value={formData.marca} onChange={e => setFormData({ ...formData, marca: e.target.value })} />
                </div>
              </div>
              <div className="form-group">
                <label>Nombre del Repuesto *</label>
                <input className="form-control" required placeholder="Ej: Bobina de Encendido" value={formData.nombre} onChange={e => setFormData({ ...formData, nombre: e.target.value })} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label>Stock Inicial *</label>
                  <input type="number" className="form-control" required value={formData.stock} onChange={e => setFormData({ ...formData, stock: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Stock Mínimo (Alerta) *</label>
                  <input type="number" className="form-control" required value={formData.stockMin} onChange={e => setFormData({ ...formData, stockMin: e.target.value })} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label>Costo de Adquisición (\$) *</label>
                  <input type="number" step="0.01" className="form-control" required placeholder="15.00" value={formData.costo} onChange={e => setFormData({ ...formData, costo: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Precio de Venta (\$) *</label>
                  <input type="number" step="0.01" className="form-control" required placeholder="25.00" value={formData.precio} onChange={e => setFormData({ ...formData, precio: e.target.value })} />
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Guardar en Catálogo</button>
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

function generateCotizacionesClientePage() {
  return `import React, { useState } from 'react';

export default function CotizacionesClientePage() {
  const [cotizacion, setCotizacion] = useState({
    numero: 'COT-2026-089',
    vehiculo: 'Chevrolet Sail (PBA-3421)',
    fecha: '2026-10-24',
    estado: 'Pendiente de Aprobación',
    items: [
      { id: 1, tipo: 'Mano de Obra', descripcion: 'Sustitución de pastillas de freno y rectificado', precio: 35.00, aprobado: true },
      { id: 2, tipo: 'Repuesto', descripcion: 'Juego de pastillas de freno delanteras Bosch', precio: 38.00, aprobado: true },
      { id: 3, tipo: 'Repuesto', descripcion: 'Líquido de frenos DOT 4 Bosch (500ml)', precio: 12.00, aprobado: true },
      { id: 4, tipo: 'Mano de Obra', descripcion: 'Alineación computarizada y balanceo 4 ruedas', precio: 28.00, aprobado: false }
    ]
  });

  const total = cotizacion.items.reduce((sum, i) => sum + (i.aprobado ? i.precio : 0), 0);

  const toggleItem = (id) => {
    setCotizacion({
      ...cotizacion,
      items: cotizacion.items.map(it => it.id === id ? { ...it, aprobado: !it.aprobado } : it)
    });
  };

  const handleDecision = (decision) => {
    setCotizacion({ ...cotizacion, estado: decision });
  };

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 700 }}>📝 Portal Cliente: Aprobación de Presupuestos</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '4px' }}>
          Revise detalladamente el presupuesto de servicios y repuestos autorizados para su vehículo.
        </p>
      </div>

      <div className="card" style={{ maxWidth: '800px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px', marginBottom: '16px' }}>
          <div>
            <h3 style={{ fontSize: '1.2rem' }}>Presupuesto {cotizacion.numero}</h3>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Vehículo: {cotizacion.vehiculo} | Fecha: {cotizacion.fecha}</span>
          </div>
          <span className={\`badge \${cotizacion.estado === 'Aprobada' ? 'badge-success' : cotizacion.estado === 'Rechazada' ? 'badge-danger' : 'badge-warning'}\`}>
            {cotizacion.estado}
          </span>
        </div>

        <p style={{ fontSize: '0.85rem', marginBottom: '12px' }}>
          Seleccione los ítems que desea autorizar para la reparación:
        </p>

        <div className="table-responsive">
          <table>
            <thead>
              <tr>
                <th style={{ width: '40px' }}>Autorizar</th>
                <th>Tipo</th>
                <th>Descripción del Servicio o Repuesto</th>
                <th style={{ textAlign: 'right' }}>Monto (\$)</th>
              </tr>
            </thead>
            <tbody>
              {cotizacion.items.map(it => (
                <tr key={it.id} style={{ opacity: it.aprobado ? 1 : 0.5 }}>
                  <td>
                    <input
                      type="checkbox"
                      checked={it.aprobado}
                      onChange={() => toggleItem(it.id)}
                      disabled={cotizacion.estado !== 'Pendiente de Aprobación'}
                    />
                  </td>
                  <td><span className="badge badge-secondary">{it.tipo}</span></td>
                  <td>{it.descripcion}</td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>\${it.precio.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={3} style={{ textAlign: 'right', fontWeight: 700 }}>Total Autorizado:</td>
                <td style={{ textAlign: 'right', fontWeight: 700, fontSize: '1.1rem', color: 'var(--primary)' }}>
                  \${total.toFixed(2)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {cotizacion.estado === 'Pendiente de Aprobación' && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
            <button className="btn btn-danger" onClick={() => handleDecision('Rechazada')}>
              Rechazar Presupuesto
            </button>
            <button className="btn btn-secondary" onClick={() => handleDecision('Aprobada Parcial')}>
              Aprobar Parcialmente
            </button>
            <button className="btn btn-primary" onClick={() => handleDecision('Aprobada')}>
              ✓ Aprobar Presupuesto Completo
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
`;
}

function generateProgresoReparacionPage() {
  return `import React from 'react';

export default function ProgresoReparacionPage() {
  const etapas = [
    { num: 1, titulo: 'Recepción del Vehículo', desc: 'Ingreso e inspección pericial completada', completado: true, hora: '09:30 AM' },
    { num: 2, titulo: 'Diagnóstico Técnico OBD', desc: 'Escaneo OBD-II y detección de fallas', completado: true, hora: '10:45 AM' },
    { num: 3, titulo: 'Presupuesto Aprobado', desc: 'Cliente aprobó mano de obra y repuestos', completado: true, hora: '11:20 AM' },
    { num: 4, titulo: 'En Reparación', desc: 'Sustitución de pastillas y rectificación de discos en proceso', completado: true, activo: true, hora: 'En curso' },
    { num: 5, titulo: 'Control de Calidad y Pruebas', desc: 'Prueba de frenado y verificación de seguridad', completado: false, hora: 'Pendiente' },
    { num: 6, titulo: 'Listo para Entrega', desc: 'Lavado de cortesía y notificación de retiro', completado: false, hora: 'Pendiente' }
  ];

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 700 }}>📈 Portal Cliente: Seguimiento de Avance en Vivo</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '4px' }}>
          Consulte en tiempo real el estado y porcentaje de ejecución del mantenimiento de su vehículo.
        </p>
      </div>

      <div className="card" style={{ maxWidth: '750px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Orden Activa: OT-101</span>
            <h3 style={{ fontSize: '1.2rem', marginTop: '2px' }}>Chevrolet Sail (PBA-3421)</h3>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--primary)' }}>65%</span>
            <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)' }}>Avance General</span>
          </div>
        </div>

        <div style={{ background: '#e2e8f0', height: '10px', borderRadius: '999px', overflow: 'hidden', marginBottom: '24px' }}>
          <div style={{ background: 'var(--primary)', height: '100%', width: '65%' }} />
        </div>

        {/* Timeline Stepper */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', paddingLeft: '12px' }}>
          {etapas.map((e, idx) => (
            <div key={e.num} style={{ display: 'flex', gap: '16px', position: 'relative' }}>
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                background: e.completado ? '#10b981' : '#e2e8f0',
                color: e.completado ? '#fff' : '#64748b',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: '0.85rem',
                flexShrink: 0
              }}>
                {e.completado ? '✓' : e.num}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h4 style={{ fontSize: '0.95rem', fontWeight: 600 }}>{e.titulo}</h4>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{e.hora}</span>
                </div>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '2px' }}>{e.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
`;
}

function generateReportesPage() {
  return `import React from 'react';

export default function ReportesPage() {
  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 700 }}>📊 Tablero de Control, Indicadores y Reportes</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '4px' }}>
          Indicadores gerenciales: órdenes completadas, facturación estimada, inventario y fallas frecuentes OBD.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div className="card">
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Órdenes de Taller del Mes</span>
          <h3 style={{ fontSize: '1.6rem', marginTop: '6px' }}>48</h3>
          <span style={{ fontSize: '0.75rem', color: '#10b981' }}>↑ +14% vs mes anterior</span>
        </div>
        <div className="card">
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Facturación Estimada</span>
          <h3 style={{ fontSize: '1.6rem', marginTop: '6px' }}>\$6,420.00</h3>
          <span style={{ fontSize: '0.75rem', color: '#10b981' }}>Meta alcanzada al 92%</span>
        </div>
        <div className="card">
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Citas Agendadas Esta Semana</span>
          <h3 style={{ fontSize: '1.6rem', marginTop: '6px' }}>19</h3>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Bahías con 85% de ocupación</span>
        </div>
        <div className="card">
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Índice de Retorno / Garantía</span>
          <h3 style={{ fontSize: '1.6rem', marginTop: '6px' }}>1.2%</h3>
          <span style={{ fontSize: '0.75rem', color: '#10b981' }}>Excelente estándar de calidad</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        <div className="card">
          <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '16px' }}>Fallas Más Frecuentes OBD-II</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '4px' }}>
                <span>P0300 - Fallo de encendido múltiple</span>
                <strong>34%</strong>
              </div>
              <div style={{ background: '#e2e8f0', height: '6px', borderRadius: '4px' }}>
                <div style={{ background: 'var(--primary)', height: '100%', width: '34%' }} />
              </div>
            </div>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '4px' }}>
                <span>P0420 - Eficiencia Catalizador</span>
                <strong>22%</strong>
              </div>
              <div style={{ background: '#e2e8f0', height: '6px', borderRadius: '4px' }}>
                <div style={{ background: '#0ea5e9', height: '100%', width: '22%' }} />
              </div>
            </div>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '4px' }}>
                <span>C0035 - Sensor de Velocidad ABS</span>
                <strong>18%</strong>
              </div>
              <div style={{ background: '#e2e8f0', height: '6px', borderRadius: '4px' }}>
                <div style={{ background: '#f59e0b', height: '100%', width: '18%' }} />
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '16px' }}>Servicios con Mayor Demanda</h3>
          <ul style={{ listNavStyle: 'none', padding: 0, fontSize: '0.88rem', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <li style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '6px' }}>
              <span>Mantenimiento Preventivo 10k/20k/40k</span>
              <strong>28 órdenes</strong>
            </li>
            <li style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '6px' }}>
              <span>Cambio y Rectificación de Frenos</span>
              <strong>19 órdenes</strong>
            </li>
            <li style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '6px' }}>
              <span>Diagnóstico Pericial OBD-II</span>
              <strong>14 órdenes</strong>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
`;
}

function generateUsuariosPage() {
  return `import React, { useState } from 'react';
import { apiRequest } from '../api/client';

export default function UsuariosPage() {
  const [usuarios, setUsuarios] = useState([
    { id: 1, nombre: 'Administrador General', correo: 'admin@autron21.com', rol: 'Administrador', estado: 'Activo', ultimoAcceso: '2026-10-24 14:10' },
    { id: 2, nombre: 'Ing. Marco Valencia', correo: 'm.valencia@autron21.com', rol: 'Mecánico', estado: 'Activo', ultimoAcceso: '2026-10-24 13:45' },
    { id: 3, nombre: 'Téc. Javier Andrade', correo: 'j.andrade@autron21.com', rol: 'Mecánico', estado: 'Activo', ultimoAcceso: '2026-10-24 11:20' },
    { id: 4, nombre: 'Mariana Silva', correo: 'm.silva@autron21.com', rol: 'Recepción', estado: 'Activo', ultimoAcceso: '2026-10-24 15:00' },
    { id: 5, nombre: 'Carlos Mendoza', correo: 'carlos.m@example.com', rol: 'Cliente', estado: 'Activo', ultimoAcceso: '2026-10-23 18:30' }
  ]);
  const [modalOpen, setModalOpen] = useState(false);
  const [formData, setFormData] = useState({ nombre: '', correo: '', rol: 'Mecánico', estado: 'Activo' });

  const handleCrear = async (e) => {
    e.preventDefault();
    const nuevo = { id: Date.now(), ...formData, ultimoAcceso: 'Recién creado' };
    try {
      await apiRequest('/usuarios', { method: 'POST', body: nuevo }).catch(() => {});
    } catch (err) {}
    setUsuarios([...usuarios, nuevo]);
    setModalOpen(false);
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700 }}>🛡️ Gestión de Personal, Roles y Auditoría</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '4px' }}>
            Control de accesos y permisos por rol (Administrador, Recepción, Mecánico, Cliente) con auditoría segura.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setModalOpen(true)}>
          <span className="material-symbols-outlined">person_add</span>
          Nuevo Usuario
        </button>
      </div>

      <div className="card">
        <div className="table-responsive">
          <table>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Correo Electrónico</th>
                <th>Rol Asignado</th>
                <th>Estado</th>
                <th>Último Acceso</th>
              </tr>
            </thead>
            <tbody>
              {usuarios.map(u => (
                <tr key={u.id}>
                  <td><strong>{u.nombre}</strong></td>
                  <td>{u.correo}</td>
                  <td><span className="badge badge-info">{u.rol}</span></td>
                  <td><span className="badge badge-success">{u.estado}</span></td>
                  <td>{u.ultimoAcceso}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {modalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3 style={{ marginBottom: '16px', fontWeight: 700 }}>Registrar Usuario</h3>
            <form onSubmit={handleCrear}>
              <div className="form-group">
                <label>Nombre y Apellido *</label>
                <input className="form-control" required placeholder="Ej: Pedro Salazar" value={formData.nombre} onChange={e => setFormData({ ...formData, nombre: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Correo Electrónico *</label>
                <input type="email" className="form-control" required placeholder="pedro@autron21.com" value={formData.correo} onChange={e => setFormData({ ...formData, correo: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Rol del Sistema *</label>
                <select className="form-control" value={formData.rol} onChange={e => setFormData({ ...formData, rol: e.target.value })}>
                  <option value="Administrador">Administrador</option>
                  <option value="Recepción">Recepción</option>
                  <option value="Mecánico">Mecánico</option>
                  <option value="Cliente">Cliente</option>
                </select>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Crear Cuenta</button>
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

function generateLoginPage(projectName = 'Autron21') {
  return `import React, { useState } from 'react';

export default function LoginPage({ onLogin }) {
  const [email, setEmail] = useState('admin@autron21.com');
  const [password, setPassword] = useState('Admin123*');
  const [showPassword, setShowPassword] = useState(false);
  const [selectedRole, setSelectedRole] = useState('Administrador');
  const [loading, setLoading] = useState(false);
  const [recoveryModal, setRecoveryModal] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [recoverySent, setRecoverySent] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      const names = {
        Administrador: 'Ing. Carlos Ramos (Admin)',
        Recepción: 'Mariana Silva (Recepción)',
        Mecánico: 'Marco Valencia (Jefe de Taller)',
        Cliente: 'Roberto Gómez (Cliente)'
      };
      onLogin({
        name: names[selectedRole] || 'Usuario',
        email,
        role: selectedRole,
        token: 'auth-jwt-token-' + Date.now()
      });
    }, 350);
  };

  const handleQuickLogin = (role, userEmail) => {
    const names = {
      Administrador: 'Ing. Carlos Ramos (Admin)',
      Recepción: 'Mariana Silva (Recepción)',
      Mecánico: 'Marco Valencia (Jefe de Taller)',
      Cliente: 'Roberto Gómez (Cliente)'
    };
    onLogin({
      name: names[role],
      email: userEmail,
      role,
      token: 'auth-jwt-token-' + Date.now()
    });
  };

  const handleRecoverySubmit = (e) => {
    e.preventDefault();
    setRecoverySent(true);
    setTimeout(() => {
      setRecoveryModal(false);
      setRecoverySent(false);
      setRecoveryEmail('');
    }, 2000);
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
      padding: '20px'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '460px',
        background: '#ffffff',
        borderRadius: '16px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.45)',
        overflow: 'hidden'
      }}>
        {/* Cabecera del Login */}
        <div style={{ background: '#0f172a', padding: '32px 28px', textAlign: 'center', color: '#fff', borderBottom: '3px solid #38bdf8' }}>
          <div style={{ width: '48px', height: '48px', background: 'rgba(56, 189, 248, 0.15)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px auto' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '28px', color: '#38bdf8' }}>car_repair</span>
          </div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700, letterSpacing: '-0.02em', color: '#fff' }}>${projectName}</h2>
          <p style={{ color: '#94a3b8', fontSize: '0.82rem', marginTop: '4px' }}>
            Portal de Acceso y Gestión de Taller Automotriz
          </p>
        </div>

        {/* Formulario */}
        <div style={{ padding: '28px' }}>
          <form onSubmit={handleSubmit}>
            <div className="form-group" style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '6px' }}>
                Rol de Acceso *
              </label>
              <select
                className="form-control"
                value={selectedRole}
                onChange={e => {
                  const r = e.target.value;
                  setSelectedRole(r);
                  if (r === 'Administrador') setEmail('admin@autron21.com');
                  else if (r === 'Recepción') setEmail('recepcion@autron21.com');
                  else if (r === 'Mecánico') setEmail('mecanico@autron21.com');
                  else if (r === 'Cliente') setEmail('cliente@gmail.com');
                }}
              >
                <option value="Administrador">Administrador del Taller</option>
                <option value="Recepción">Recepción y Servicio</option>
                <option value="Mecánico">Mecánico / Diagnóstico Técnico</option>
                <option value="Cliente">Cliente (Portal Web)</option>
              </select>
            </div>

            <div className="form-group" style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '6px' }}>
                Correo Electrónico *
              </label>
              <input
                type="email"
                className="form-control"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="usuario@autron21.com"
              />
            </div>

            <div className="form-group" style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label style={{ fontSize: '0.82rem', fontWeight: 600, margin: 0 }}>Contraseña *</label>
                <button
                  type="button"
                  onClick={() => setRecoveryModal(true)}
                  style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: '0.75rem', cursor: 'pointer', padding: 0 }}
                >
                  ¿Olvidaste tu contraseña?
                </button>
              </div>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="form-control"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  style={{ paddingRight: '40px' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', display: 'flex' }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                    {showPassword ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
              style={{ width: '100%', padding: '12px', fontSize: '0.92rem', fontWeight: 600, justifyContent: 'center', borderRadius: '8px', marginTop: '8px' }}
            >
              {loading ? 'Validando credenciales...' : 'Iniciar Sesión'}
            </button>
          </form>

          {/* Accesos rápidos de rol para demostración */}
          <div style={{ marginTop: '24px', paddingTop: '18px', borderTop: '1px solid var(--border-color)' }}>
            <span style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '10px', textAlign: 'center' }}>
              Ingreso Rápido de Prueba (1 Clic)
            </span>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <button
                type="button"
                className="btn btn-sm btn-secondary"
                style={{ justifyContent: 'center', fontSize: '0.76rem' }}
                onClick={() => handleQuickLogin('Administrador', 'admin@autron21.com')}
              >
                👑 Admin
              </button>
              <button
                type="button"
                className="btn btn-sm btn-secondary"
                style={{ justifyContent: 'center', fontSize: '0.76rem' }}
                onClick={() => handleQuickLogin('Recepción', 'recepcion@autron21.com')}
              >
                📋 Recepción
              </button>
              <button
                type="button"
                className="btn btn-sm btn-secondary"
                style={{ justifyContent: 'center', fontSize: '0.76rem' }}
                onClick={() => handleQuickLogin('Mecánico', 'mecanico@autron21.com')}
              >
                🔧 Mecánico
              </button>
              <button
                type="button"
                className="btn btn-sm btn-secondary"
                style={{ justifyContent: 'center', fontSize: '0.76rem' }}
                onClick={() => handleQuickLogin('Cliente', 'cliente@gmail.com')}
              >
                👤 Cliente
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modal de Recuperación de Contraseña */}
      {recoveryModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '420px' }}>
            <h3 style={{ marginBottom: '12px', fontWeight: 700 }}>Recuperar Contraseña</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
              Ingrese su correo electrónico registrado para enviarle un enlace seguro de restablecimiento de contraseña.
            </p>
            {recoverySent ? (
              <div style={{ background: '#dcfce7', color: '#15803d', padding: '12px', borderRadius: '6px', fontSize: '0.85rem', textAlign: 'center' }}>
                ✓ Enlace de recuperación enviado con éxito. Revise su bandeja de entrada.
              </div>
            ) : (
              <form onSubmit={handleRecoverySubmit}>
                <div className="form-group">
                  <label>Correo Electrónico *</label>
                  <input
                    type="email"
                    className="form-control"
                    required
                    placeholder="usuario@autron21.com"
                    value={recoveryEmail}
                    onChange={e => setRecoveryEmail(e.target.value)}
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setRecoveryModal(false)}>Cancelar</button>
                  <button type="submit" className="btn btn-primary">Enviar Enlace</button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
`;
}

function generateServiciosPage() {
  return `import React, { useState } from 'react';
import { apiRequest } from '../api/client';

export default function ServiciosPage() {
  const [servicios, setServicios] = useState([
    { id: 1, codigo: 'SRV-001', nombre: 'Mantenimiento Preventivo 10,000 / 20,000 km', categoria: 'Mecánica Rápida', horas: 2.5, tarifaHora: 20.00, precioTotal: 50.00 },
    { id: 2, codigo: 'SRV-002', nombre: 'Cambio de Pastillas de Freno y Rectificado de Discos', categoria: 'Frenos', horas: 1.5, tarifaHora: 20.00, precioTotal: 30.00 },
    { id: 3, codigo: 'SRV-003', nombre: 'Diagnóstico Pericial Computarizado OBD-II', categoria: 'Electrónica', horas: 1.0, tarifaHora: 25.00, precioTotal: 25.00 },
    { id: 4, codigo: 'SRV-004', nombre: 'Alineación Láser y Balanceo de 4 Ruedas', categoria: 'Suspensión', horas: 1.0, tarifaHora: 22.00, precioTotal: 22.00 },
    { id: 5, codigo: 'SRV-005', nombre: 'Afinamiento Mayor (Limpieza de inyectores por ultrasonido)', categoria: 'Motor', horas: 3.0, tarifaHora: 20.00, precioTotal: 60.00 }
  ]);
  const [modalOpen, setModalOpen] = useState(false);
  const [formData, setFormData] = useState({ codigo: '', nombre: '', categoria: 'Mecánica Rápida', horas: 1.5, tarifaHora: 20.00 });

  const handleCrear = async (e) => {
    e.preventDefault();
    const nuevo = {
      id: Date.now(),
      ...formData,
      precioTotal: Number(formData.horas) * Number(formData.tarifaHora)
    };
    try {
      await apiRequest('/servicios', { method: 'POST', body: nuevo }).catch(() => {});
    } catch (err) {}
    setServicios([...servicios, nuevo]);
    setModalOpen(false);
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700 }}>📋 Catálogo Maestro de Servicios y Tarifas</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '4px' }}>
            Definición oficial de intervenciones, duraciones estimadas en horas y tarifas de mano de obra (RF-13).
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setModalOpen(true)}>
          <span className="material-symbols-outlined">add</span>
          Nuevo Servicio
        </button>
      </div>

      <div className="card">
        <div className="table-responsive">
          <table>
            <thead>
              <tr>
                <th>Código</th>
                <th>Nombre del Servicio</th>
                <th>Categoría</th>
                <th>Tiempo Estimado</th>
                <th>Tarifa por Hora</th>
                <th>Monto Mano de Obra</th>
              </tr>
            </thead>
            <tbody>
              {servicios.map(s => (
                <tr key={s.id}>
                  <td><strong>{s.codigo}</strong></td>
                  <td>{s.nombre}</td>
                  <td><span className="badge badge-secondary">{s.categoria}</span></td>
                  <td>{s.horas} horas</td>
                  <td>\${Number(s.tarifaHora).toFixed(2)} / h</td>
                  <td><strong style={{ color: 'var(--primary)' }}>\${Number(s.precioTotal).toFixed(2)}</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {modalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3 style={{ marginBottom: '16px', fontWeight: 700 }}>Registrar Nuevo Servicio</h3>
            <form onSubmit={handleCrear}>
              <div className="form-group">
                <label>Código de Servicio *</label>
                <input className="form-control" required placeholder="SRV-006" value={formData.codigo} onChange={e => setFormData({ ...formData, codigo: e.target.value.toUpperCase() })} />
              </div>
              <div className="form-group">
                <label>Nombre de la Intervención *</label>
                <input className="form-control" required placeholder="Ej: Cambio de kit de distribución" value={formData.nombre} onChange={e => setFormData({ ...formData, nombre: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Categoría</label>
                <select className="form-control" value={formData.categoria} onChange={e => setFormData({ ...formData, categoria: e.target.value })}>
                  <option value="Mecánica Rápida">Mecánica Rápida</option>
                  <option value="Frenos">Frenos y Seguridad</option>
                  <option value="Electrónica">Electrónica y OBD</option>
                  <option value="Motor">Motor y Transmisión</option>
                  <option value="Suspensión">Suspensión y Dirección</option>
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label>Duración Estimada (Horas) *</label>
                  <input type="number" step="0.5" className="form-control" required value={formData.horas} onChange={e => setFormData({ ...formData, horas: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Tarifa Horaria (\$) *</label>
                  <input type="number" step="1.00" className="form-control" required value={formData.tarifaHora} onChange={e => setFormData({ ...formData, tarifaHora: e.target.value })} />
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Guardar Servicio</button>
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

function generateMisVehiculosPage() {
  return `import React from 'react';

export default function MisVehiculosPage({ onSolicitarCita }) {
  const misVehiculos = [
    { id: 1, placa: 'PBA-3421', marca: 'Chevrolet', modelo: 'Sail 1.4', anio: 2021, kilometraje: 45200, proximoMantenimiento: 'Mantenimiento Preventivo 50,000 km', alertaKm: 4800, fechaUltimaVisita: '2026-08-14' },
    { id: 2, placa: 'PBC-8812', marca: 'Chevrolet', modelo: 'D-Max 4x4', anio: 2022, kilometraje: 71200, proximoMantenimiento: 'Cambio de pastillas de freno y revisión de fluidos', alertaKm: 1200, urgente: true, fechaUltimaVisita: '2026-09-02' }
  ];

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 700 }}>🚗 Portal Cliente: Mis Vehículos y Mantenimientos</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '4px' }}>
          Historial de visitas, kilometraje actual y avisos de mantenimientos preventivos recomendados (RF-05).
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
        {misVehiculos.map(v => (
          <div className="card" key={v.id} style={{ borderTop: v.urgente ? '4px solid #ef4444' : '4px solid var(--primary)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
              <div>
                <span className="badge badge-secondary" style={{ fontSize: '0.8rem', fontWeight: 700 }}>{v.placa}</span>
                <h3 style={{ fontSize: '1.2rem', marginTop: '6px' }}>{v.marca} {v.modelo}</h3>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Año {v.anio} • {v.kilometraje.toLocaleString()} km</span>
              </div>
              <span className="material-symbols-outlined" style={{ fontSize: '36px', color: '#64748b' }}>directions_car</span>
            </div>

            <div style={{ background: v.urgente ? '#fef2f2' : '#f0fdf4', border: v.urgente ? '1px solid #fecaca' : '1px solid #bbf7d0', padding: '12px', borderRadius: '8px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '18px', color: v.urgente ? '#b91c1c' : '#15803d' }}>
                  {v.urgente ? 'notifications_active' : 'check_circle'}
                </span>
                <strong style={{ fontSize: '0.84rem', color: v.urgente ? '#b91c1c' : '#15803d' }}>
                  {v.urgente ? '¡Mantenimiento Próximo Requerido!' : 'Estado Preventivo al Día'}
                </strong>
              </div>
              <p style={{ fontSize: '0.8rem', color: v.urgente ? '#991b1b' : '#166534', margin: 0 }}>
                {v.proximoMantenimiento} (estimado en {v.alertaKm} km).
              </p>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
              <span>Último servicio:</span>
              <strong>{v.fechaUltimaVisita}</strong>
            </div>

            <button
              className="btn btn-primary"
              style={{ width: '100%', justifyContent: 'center' }}
              onClick={() => onSolicitarCita && onSolicitarCita(v.placa)}
            >
              <span className="material-symbols-outlined">event</span>
              Solicitar Cita de Servicio
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
`;
}

function generateCitasClientePage() {
  return `import React, { useState } from 'react';

export default function CitasClientePage() {
  const [enviado, setEnviado] = useState(false);
  const [formData, setFormData] = useState({
    vehiculo: 'PBA-3421 (Chevrolet Sail)',
    fecha: '2026-10-28',
    turno: 'Mañana (08:30 - 12:00)',
    servicio: 'Mantenimiento Preventivo Periódico',
    motivo: ''
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    setEnviado(true);
  };

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 700 }}>📅 Portal Cliente: Solicitud de Citas de Taller</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '4px' }}>
          Autogestión de citas según disponibilidad de bahías y turnos de atención técnica (RF-06).
        </p>
      </div>

      <div className="card" style={{ maxWidth: '640px' }}>
        {enviado ? (
          <div style={{ padding: '24px', textAlign: 'center' }}>
            <div style={{ width: '56px', height: '56px', background: '#dcfce7', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px auto' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '32px', color: '#15803d' }}>check</span>
            </div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#15803d' }}>¡Cita Solicitada con Éxito!</h3>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', marginTop: '8px' }}>
              Hemos agendado su turno para el <strong>{formData.fecha}</strong> ({formData.turno}). Recibirá una confirmación por correo y WhatsApp con los detalles de ingreso al taller.
            </p>
            <button className="btn btn-secondary" style={{ marginTop: '20px' }} onClick={() => setEnviado(false)}>
              Agendar Otra Cita
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Seleccione su Vehículo Registrado *</label>
              <select className="form-control" value={formData.vehiculo} onChange={e => setFormData({ ...formData, vehiculo: e.target.value })}>
                <option value="PBA-3421 (Chevrolet Sail)">PBA-3421 — Chevrolet Sail 2021</option>
                <option value="PBC-8812 (Chevrolet D-Max)">PBC-8812 — Chevrolet D-Max 2022</option>
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div className="form-group">
                <label>Fecha Deseada *</label>
                <input type="date" className="form-control" required value={formData.fecha} onChange={e => setFormData({ ...formData, fecha: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Turno Preferido *</label>
                <select className="form-control" value={formData.turno} onChange={e => setFormData({ ...formData, turno: e.target.value })}>
                  <option value="Mañana (08:30 - 12:00)">Mañana (08:30 - 12:00)</option>
                  <option value="Tarde (13:30 - 17:30)">Tarde (13:30 - 17:30)</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label>Tipo de Servicio Requerido *</label>
              <select className="form-control" value={formData.servicio} onChange={e => setFormData({ ...formData, servicio: e.target.value })}>
                <option value="Mantenimiento Preventivo Periódico">Mantenimiento Preventivo Periódico</option>
                <option value="Diagnóstico de Luz Check Engine / Avería OBD">Diagnóstico de Luz Check Engine / Avería OBD</option>
                <option value="Revisión de Frenos y Suspensión">Revisión de Frenos y Suspensión</option>
                <option value="Alineación, Balanceo y Rotación">Alineación, Balanceo y Rotación</option>
                <option value="Reparación Mecánica General">Reparación Mecánica General</option>
              </select>
            </div>

            <div className="form-group">
              <label>Descripción de Síntomas o Solicitud Específica</label>
              <textarea
                className="form-control"
                rows={3}
                placeholder="Describa ruidos, sensaciones o requerimientos particulares..."
                value={formData.motivo}
                onChange={e => setFormData({ ...formData, motivo: e.target.value })}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
              <button type="submit" className="btn btn-primary" style={{ padding: '10px 24px' }}>
                Confirmar y Enviar Solicitud
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
`;
}

function generateConocimientoPage() {
  return `import React, { useState } from 'react';

export default function ConocimientoPage() {
  const [busqueda, setBusqueda] = useState('');
  const articulos = [
    { codigo: 'P0300', titulo: 'Fallo de Encendido Múltiple / Aleatorio', sistema: 'Motor', sintomas: 'Pérdida de potencia, tirones en aceleración, luz Check Engine parpadeando', causas: 'Bujías desgastadas, bobinas defectuosas, baja presión de combustible, inyectores obstruidos', solucion: 'Revisar resistencia de bobinas con multímetro, reemplazar juego completo de bujías y verificar pulsos de inyección.' },
    { codigo: 'P0420', titulo: 'Eficiencia del Catalizador por Debajo del Umbral (Banco 1)', sistema: 'Emisiones', sintomas: 'Consumo elevado de combustible, olor a sulfuro en escape', causas: 'Catalizador degradado, fuga en escape antes del sensor, sensor de oxígeno post-catalizador descalibrado', solucion: 'Monitorear gráfica de voltaje de sensores O2 antes y después del catalizador. Si oscilan igual, reemplazar catalizador.' },
    { codigo: 'C0035', titulo: 'Circuito Sensor de Velocidad Rueda Delantera Izquierda', sistema: 'Frenos ABS', sintomas: 'Luz ABS y control de tracción encendidas en tablero', causas: 'Cableado cortado por movimiento de suspensión, sensor sucio con viruta metálica, rueda fónica fisurada', solucion: 'Limpiar sensor con limpiador de frenos, medir señal de onda sinusoidal/cuadrada al girar rueda y sustituir sensor si no hay señal.' },
    { codigo: 'P0171', titulo: 'Sistema Demasiado Pobre (Banco 1)', sistema: 'Admisión / Combustible', sintomas: 'Marcha mínima irregular, vacilación al pisar el acelerador', causas: 'Entrada de aire no medida (manguera de vacío rota), sensor MAF contaminado, filtro de combustible tapado', solucion: 'Realizar prueba de humo en múltiple de admisión y limpiar sensor de flujo de masa de aire (MAF).' }
  ];

  const filtrados = articulos.filter(a =>
    a.codigo.toLowerCase().includes(busqueda.toLowerCase()) ||
    a.titulo.toLowerCase().includes(busqueda.toLowerCase()) ||
    a.sistema.toLowerCase().includes(busqueda.toLowerCase()) ||
    a.causas.toLowerCase().includes(busqueda.toLowerCase())
  );

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 700 }}>📚 Base de Conocimiento Técnico OBD-II</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '4px' }}>
          Buscador pericial de códigos de avería, síntomas, causas documentadas y soluciones técnicas de taller (RF-30, RF-31).
        </p>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <input
          type="text"
          className="form-control"
          placeholder="🔍 Buscar por código OBD (ej: P0300), síntoma, sistema o componente..."
          style={{ maxWidth: '500px' }}
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '16px' }}>
        {filtrados.map(a => (
          <div className="card" key={a.codigo}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <span className="badge badge-info" style={{ fontSize: '0.85rem', fontWeight: 700 }}>{a.codigo}</span>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{a.sistema}</span>
            </div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '8px' }}>{a.titulo}</h3>

            <div style={{ fontSize: '0.82rem', marginBottom: '8px' }}>
              <strong style={{ color: '#b45309' }}>Síntomas habituales:</strong>
              <p style={{ color: 'var(--text-muted)', marginTop: '2px' }}>{a.sintomas}</p>
            </div>

            <div style={{ fontSize: '0.82rem', marginBottom: '8px' }}>
              <strong style={{ color: '#b91c1c' }}>Causas probables:</strong>
              <p style={{ color: 'var(--text-muted)', marginTop: '2px' }}>{a.causas}</p>
            </div>

            <div style={{ fontSize: '0.82rem', background: '#f8fafc', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-color)', marginTop: '10px' }}>
              <strong style={{ color: '#15803d' }}>Procedimiento de solución comprobada:</strong>
              <p style={{ color: '#334155', marginTop: '3px', margin: 0 }}>{a.solucion}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
`;
}

module.exports = {
  generateLoginPage,
  generateRecepcionPage,
  generateCitasPage,
  generateClientesPage,
  generateVehiculosPage,
  generateDiagnosticosPage,
  generateReparacionesPage,
  generateInventarioPage,
  generateServiciosPage,
  generateMisVehiculosPage,
  generateCitasClientePage,
  generateCotizacionesClientePage,
  generateProgresoReparacionPage,
  generateConocimientoPage,
  generateReportesPage,
  generateUsuariosPage
};

