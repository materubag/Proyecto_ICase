import React from 'react';

export default function Dashboard({ setActiveTab }) {
  return (
    <div style={{ padding: '8px' }}>
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 700 }}>Panel de Control — Hospital San Lucas</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '4px' }}>
          Sistema de gestión integral generado a partir de la especificación técnica aprobada en ICASE Studio.
        </p>
      </div>

      {/* Tarjetas de Entidades del Dominio */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div className="card" style={{ borderLeft: '4px solid var(--primary)', cursor: 'pointer' }} onClick={() => setActiveTab('roles')}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Entidad</span>
            <span className="material-symbols-outlined" style={{ color: 'var(--primary)', fontSize: '20px' }}>table_chart</span>
          </div>
          <h3 style={{ fontSize: '1.25rem', marginTop: '6px', fontWeight: 700 }}>Rol</h3>
          <span style={{ fontSize: '0.78rem', color: '#2563eb' }}>/api/roles</span>
        </div>
        <div className="card" style={{ borderLeft: '4px solid var(--primary)', cursor: 'pointer' }} onClick={() => setActiveTab('usuarios')}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Entidad</span>
            <span className="material-symbols-outlined" style={{ color: 'var(--primary)', fontSize: '20px' }}>table_chart</span>
          </div>
          <h3 style={{ fontSize: '1.25rem', marginTop: '6px', fontWeight: 700 }}>Usuario</h3>
          <span style={{ fontSize: '0.78rem', color: '#2563eb' }}>/api/usuarios</span>
        </div>
        <div className="card" style={{ borderLeft: '4px solid var(--primary)', cursor: 'pointer' }} onClick={() => setActiveTab('pacientes')}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Entidad</span>
            <span className="material-symbols-outlined" style={{ color: 'var(--primary)', fontSize: '20px' }}>table_chart</span>
          </div>
          <h3 style={{ fontSize: '1.25rem', marginTop: '6px', fontWeight: 700 }}>Paciente</h3>
          <span style={{ fontSize: '0.78rem', color: '#2563eb' }}>/api/pacientes</span>
        </div>
      </div>

      {/* Accesos Rápidos */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <h3 style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: '14px' }}>Acceso Rápido a Módulos</h3>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button className="btn btn-primary" onClick={() => setActiveTab('roles')}>
            <span className="material-symbols-outlined" style={{ fontSize: '16px', marginRight: '4px' }}>list</span>
            Rol
          </button>
          <button className="btn btn-primary" onClick={() => setActiveTab('usuarios')}>
            <span className="material-symbols-outlined" style={{ fontSize: '16px', marginRight: '4px' }}>list</span>
            Usuario
          </button>
          <button className="btn btn-primary" onClick={() => setActiveTab('pacientes')}>
            <span className="material-symbols-outlined" style={{ fontSize: '16px', marginRight: '4px' }}>list</span>
            Paciente
          </button>
        </div>
      </div>

      {/* Estado del Entorno */}
      <div className="card">
        <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '12px' }}>Entorno de Ejecución</h3>
        <ul style={{ listStyle: 'none', padding: 0, fontSize: '0.88rem', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: '#16a34a' }}>●</span>
            <span>API REST Express + Sequelize ORM operativa</span>
          </li>
          <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: '#16a34a' }}>●</span>
            <span>Persistencia en PostgreSQL mediante migraciones estructuradas</span>
          </li>
        </ul>
      </div>
    </div>
  );
}
