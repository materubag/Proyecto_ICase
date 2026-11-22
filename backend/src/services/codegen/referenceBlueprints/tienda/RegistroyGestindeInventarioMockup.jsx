import React, { useState, useEffect } from 'react';
import apiClient from '../../api/client';
import { INITIAL_STORE_PRODUCTS } from './CatlogodeProductosparaVentaMockup';

export default function RegistroyGestindeInventarioMockup() {
  const [products, setProducts] = useState(INITIAL_STORE_PRODUCTS);
  const [search, setSearch] = useState('');
  const [filterLowStock, setFilterLowStock] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [formData, setFormData] = useState({
    codigo: '',
    nombre: '',
    categoria: 'Abarrotes',
    costo: '',
    precio_venta: '',
    existencia_actual: '',
    stockMinimo: '10'
  });
  const [toast, setToast] = useState(null);

  const loadProducts = () => {
    apiClient.get('/productos')
      .then(res => {
        const list = Array.isArray(res) ? res : (res?.data || []);
        if (Array.isArray(list) && list.length > 0) {
          const mapped = list.map(p => ({
            id: p.id,
            codigo: p.codigo || `SKU-${p.id}`,
            nombre: p.nombre || 'Producto',
            categoria: p.categoria || 'Abarrotes',
            costo: Number(p.costo ?? (p.precio_venta ? p.precio_venta * 0.7 : 5.0)),
            precio_venta: Number(p.precio_venta ?? p.precio ?? 10.0),
            existencia_actual: Number(p.existencia_actual ?? p.stock ?? 15),
            stockMinimo: Number(p.stockMinimo ?? 10)
          }));
          setProducts(mapped);
        }
      })
      .catch(() => {});
  };

  useEffect(() => {
    loadProducts();
  }, []);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const handleOpenCreate = () => {
    setEditingProduct(null);
    setFormData({
      codigo: `SKU-${Math.floor(10000 + Math.random() * 90000)}`,
      nombre: '',
      categoria: 'Abarrotes',
      costo: '',
      precio_venta: '',
      existencia_actual: '',
      stockMinimo: '10'
    });
    setModalOpen(true);
  };

  const handleOpenEdit = (p) => {
    setEditingProduct(p);
    setFormData({
      codigo: p.codigo,
      nombre: p.nombre,
      categoria: p.categoria,
      costo: String(p.costo),
      precio_venta: String(p.precio_venta),
      existencia_actual: String(p.existencia_actual),
      stockMinimo: String(p.stockMinimo)
    });
    setModalOpen(true);
  };

  const handleSaveProduct = async (e) => {
    e.preventDefault();
    const payload = {
      codigo: formData.codigo,
      nombre: formData.nombre,
      categoria: formData.categoria,
      costo: parseFloat(formData.costo) || 0,
      precio_venta: parseFloat(formData.precio_venta) || 0,
      precio: parseFloat(formData.precio_venta) || 0,
      existencia_actual: parseInt(formData.existencia_actual, 10) || 0,
      stock: parseInt(formData.existencia_actual, 10) || 0,
      stockMinimo: parseInt(formData.stockMinimo, 10) || 10
    };

    if (editingProduct) {
      try {
        await apiClient.put(`/productos/${editingProduct.id}`, payload);
      } catch (err) {}
      setProducts(prev => prev.map(p => p.id === editingProduct.id ? { ...p, ...payload } : p));
      showToast(`Producto ${payload.nombre} actualizado correctamente`);
    } else {
      const newId = products.length ? Math.max(...products.map(p => p.id)) + 1 : 1;
      try {
        await apiClient.post('/productos', { ...payload, id: newId });
      } catch (err) {}
      setProducts(prev => [{ ...payload, id: newId }, ...prev]);
      showToast(`Nuevo producto ${payload.nombre} registrado en inventario`);
    }

    setModalOpen(false);
  };

  const handleDeactivate = (id) => {
    if (window.confirm('¿Confirmar dar de baja a este producto del inventario?')) {
      setProducts(prev => prev.filter(p => p.id !== id));
      showToast('Producto dado de baja exitosamente');
    }
  };

  // KPIs
  const totalItems = products.reduce((sum, p) => sum + p.existencia_actual, 0);
  const totalValuation = products.reduce((sum, p) => sum + (p.existencia_actual * p.costo), 0);
  const lowStockCount = products.filter(p => p.existencia_actual <= p.stockMinimo).length;
  const catalogedCount = products.length;

  const filtered = products.filter(p => {
    const term = search.toLowerCase();
    const match = (p.nombre || '').toLowerCase().includes(term) || (p.codigo || '').toLowerCase().includes(term) || (p.categoria || '').toLowerCase().includes(term);
    const matchLow = !filterLowStock || p.existencia_actual <= p.stockMinimo;
    return match && matchLow;
  });

  return (
    <div className="w-full max-w-[1200px] mx-auto pb-12">
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 text-sm font-medium border border-slate-700 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <svg className="w-5 h-5 text-emerald-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"/></svg>
          <span>{toast}</span>
        </div>
      )}

      {/* 1. Ruta de migas de pan */}
      <nav aria-label="Migas de pan" className="flex items-center gap-2 mb-4 text-xs text-slate-500 font-medium">
        <span>Tienda</span>
        <span className="text-slate-300">/</span>
        <span>Inventario</span>
        <span className="text-slate-300">/</span>
        <span className="text-slate-900 font-semibold">Registro y Gestión de Inventario</span>
      </nav>

      {/* 2. Encabezado principal */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">Registro y Gestión de Inventario</h1>
          <p className="text-sm text-slate-500 mt-1">Supervisión de existencias, costos, movimientos y alertas de bajo stock.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleOpenCreate}
            className="h-11 px-5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition-colors flex items-center gap-2 cursor-pointer shadow-xs"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"/></svg>
            <span>Nuevo Producto</span>
          </button>
        </div>
      </header>

      {/* 3. 4 Indicadores métricos */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Existencias Totales</span>
          <div className="text-[36px] leading-[42px] font-bold text-slate-900">{totalItems}</div>
          <span className="text-xs text-slate-500 mt-1 block">Unidades físicas en bodega</span>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Valoración Total</span>
          <div className="text-[36px] leading-[42px] font-bold text-slate-900">${totalValuation.toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          <span className="text-xs text-slate-500 mt-1 block">A precio de costo</span>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
          <span className="text-xs font-bold text-amber-600 uppercase tracking-wider block mb-1">Alertas de Bajo Stock</span>
          <div className="text-[36px] leading-[42px] font-bold text-amber-600">{lowStockCount}</div>
          <span className="text-xs text-amber-600 mt-1 block">Por debajo del umbral mínimo</span>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
          <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider block mb-1">Artículos Catalogados</span>
          <div className="text-[36px] leading-[42px] font-bold text-indigo-600">{catalogedCount}</div>
          <span className="text-xs text-indigo-600 mt-1 block">Referencias activas</span>
        </div>
      </section>

      {/* 4. Tabla de Inventario */}
      <section className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-slate-100 gap-4 mb-6">
          <div className="relative flex-1 max-w-md">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
            </span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por SKU, nombre o categoría..."
              className="w-full h-11 pl-10 pr-4 bg-white border border-slate-200 rounded-xl text-slate-900 text-xs placeholder:text-slate-400 focus:outline-none focus:border-indigo-600"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setFilterLowStock(!filterLowStock)}
              className={`h-11 px-4 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
                filterLowStock
                  ? 'bg-amber-100 text-amber-800 border border-amber-300'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-amber-500"></span>
              <span>Solo Stock Bajo ({lowStockCount})</span>
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold">
                <th className="py-3.5 px-4">Código SKU</th>
                <th className="py-3.5 px-4">Artículo</th>
                <th className="py-3.5 px-4">Categoría</th>
                <th className="py-3.5 px-4 text-right">Costo</th>
                <th className="py-3.5 px-4 text-right">Precio Venta</th>
                <th className="py-3.5 px-4 text-center">Stock Actual</th>
                <th className="py-3.5 px-4 text-center">Estado</th>
                <th className="py-3.5 px-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(p => {
                const isLow = p.existencia_actual <= p.stockMinimo;
                return (
                  <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-4 px-4 font-mono font-bold text-slate-900">{p.codigo}</td>
                    <td className="py-4 px-4 font-bold text-slate-900">{p.nombre}</td>
                    <td className="py-4 px-4">
                      <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 font-medium">
                        {p.categoria}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-right font-medium text-slate-600">${Number(p.costo).toFixed(2)}</td>
                    <td className="py-4 px-4 text-right font-bold text-slate-900">${Number(p.precio_venta).toFixed(2)}</td>
                    <td className="py-4 px-4 text-center">
                      <span className={`text-sm font-extrabold ${isLow ? 'text-amber-600' : 'text-slate-900'}`}>
                        {p.existencia_actual}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-center">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                        isLow ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${isLow ? 'bg-amber-500' : 'bg-emerald-500'}`}></span>
                        {isLow ? 'Bajo Stock' : 'Disponible'}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-right">
                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(p)}
                          className="text-xs font-bold text-indigo-600 hover:text-indigo-800 cursor-pointer"
                        >
                          Editar
                        </button>
                        <span className="text-slate-300">|</span>
                        <button
                          type="button"
                          onClick={() => handleDeactivate(p.id)}
                          className="text-xs font-bold text-rose-600 hover:text-rose-800 cursor-pointer"
                        >
                          Baja
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Modal: Crear / Editar Producto */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
              <h3 className="text-sm font-bold text-slate-900">
                {editingProduct ? 'Editar Producto del Inventario' : 'Registrar Nuevo Producto'}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Código SKU *</label>
                  <input
                    type="text"
                    required
                    value={formData.codigo}
                    onChange={(e) => setFormData({ ...formData, codigo: e.target.value })}
                    className="w-full h-10 px-3 border border-slate-300 rounded-xl focus:border-indigo-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Categoría *</label>
                  <select
                    value={formData.categoria}
                    onChange={(e) => setFormData({ ...formData, categoria: e.target.value })}
                    className="w-full h-10 px-3 border border-slate-300 rounded-xl focus:border-indigo-600 focus:outline-none"
                  >
                    <option value="Abarrotes">Abarrotes</option>
                    <option value="Bebidas">Bebidas</option>
                    <option value="Limpieza">Limpieza</option>
                    <option value="Lácteos">Lácteos</option>
                    <option value="Enlatados">Enlatados</option>
                    <option value="Pastas">Pastas</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Descripción / Nombre Comercial *</label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Arroz Flor Extra 1kg"
                  value={formData.nombre}
                  onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                  className="w-full h-10 px-3 border border-slate-300 rounded-xl focus:border-indigo-600 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Precio Costo ($) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={formData.costo}
                    onChange={(e) => setFormData({ ...formData, costo: e.target.value })}
                    className="w-full h-10 px-3 border border-slate-300 rounded-xl focus:border-indigo-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Precio Venta Público ($) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={formData.precio_venta}
                    onChange={(e) => setFormData({ ...formData, precio_venta: e.target.value })}
                    className="w-full h-10 px-3 border border-slate-300 rounded-xl focus:border-indigo-600 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Stock Inicial *</label>
                  <input
                    type="number"
                    required
                    value={formData.existencia_actual}
                    onChange={(e) => setFormData({ ...formData, existencia_actual: e.target.value })}
                    className="w-full h-10 px-3 border border-slate-300 rounded-xl focus:border-indigo-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Umbral Mínimo (Alerta) *</label>
                  <input
                    type="number"
                    required
                    value={formData.stockMinimo}
                    onChange={(e) => setFormData({ ...formData, stockMinimo: e.target.value })}
                    className="w-full h-10 px-3 border border-slate-300 rounded-xl focus:border-indigo-600 focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-semibold hover:bg-slate-50 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold cursor-pointer shadow-xs"
                >
                  {editingProduct ? 'Guardar Cambios' : 'Registrar Producto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
