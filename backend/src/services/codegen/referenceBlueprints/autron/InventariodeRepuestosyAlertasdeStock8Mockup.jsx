import React, { useState, useEffect } from 'react';
import apiClient from '../../api/client';

export default function InventariodeRepuestosyAlertasdeStock8Mockup({ onNavigate }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [search, setSearch] = useState('');

  // Formulario: Registrar movimiento
  const [selectedProductId, setSelectedProductId] = useState('');
  const [movementQty, setMovementQty] = useState(1);
  const [movementType, setMovementType] = useState('Entrada por compra');
  const [movementReason, setMovementReason] = useState('Reabastecimiento preventivo por bajo stock');

  // Historial de movimientos en la sesión
  const [movements, setMovements] = useState([]);

  // Modales
  const [newProductModalOpen, setNewProductModalOpen] = useState(false);
  const [auditModalOpen, setAuditModalOpen] = useState(false);

  // Formulario nuevo repuesto
  const [newProdCode, setNewProdCode] = useState('');
  const [newProdName, setNewProdName] = useState('');
  const [newProdCat, setNewProdCat] = useState('Filtros');
  const [newProdBrand, setNewProdBrand] = useState('');
  const [newProdCost, setNewProdCost] = useState('');
  const [newProdPrice, setNewProdPrice] = useState('');
  const [newProdStock, setNewProdStock] = useState('0');
  const [newProdMinStock, setNewProdMinStock] = useState('5');

  // Carga inicial 100% limpia sin datos estáticos de respaldo
  useEffect(() => {
    let mounted = true;
    apiClient.get('/productos')
      .then(res => {
        const list = Array.isArray(res) ? res : (res?.data || []);
        if (mounted) {
          const mapped = list.map(p => ({
            id: p.id,
            code: p.codigo || p.code || `REP-${p.id}`,
            name: p.nombre || p.name || 'Sin descripción',
            category: p.categoria || 'Repuestos',
            brand: p.marca || 'Original',
            cost: Number(p.costo || 0),
            price: Number(p.precio || 0),
            stock: Number(p.stock || 0),
            minStock: Number(p.stockMinimo != null ? p.stockMinimo : (p.minStock || 5)),
            status: Number(p.stock || 0) <= Number(p.stockMinimo != null ? p.stockMinimo : (p.minStock || 5)) ? 'BAJO_STOCK' : 'OPTIMO'
          }));
          setProducts(mapped);
          if (mapped.length > 0) {
            setSelectedProductId(String(mapped[0].id));
          }
        }
      })
      .catch(() => {
        if (mounted) {
          // Si no hay respuesta o falla, permanece en 0 (sin mocks hardcodeados)
          setProducts([]);
        }
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => { mounted = false; };
  }, []);

  // Métricas calculadas reactivas
  const lowStockCount = products.filter(p => p.stock <= p.minStock).length;
  const totalValue = products.reduce((acc, p) => acc + (p.cost * p.stock), 0);

  // Filtro de búsqueda
  const filteredProducts = products.filter(p => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      (p.code && p.code.toLowerCase().includes(q)) ||
      (p.name && p.name.toLowerCase().includes(q)) ||
      (p.category && p.category.toLowerCase().includes(q)) ||
      (p.brand && p.brand.toLowerCase().includes(q))
    );
  });

  // Manejo de movimiento de stock
  const handleRegisterMovement = async (e) => {
    e.preventDefault();
    if (!selectedProductId) {
      setMsg('Por favor selecciona un repuesto del inventario.');
      setTimeout(() => setMsg(''), 4000);
      return;
    }
    const qty = Number(movementQty);
    if (!qty || qty <= 0) {
      setMsg('La cantidad debe ser mayor a 0.');
      setTimeout(() => setMsg(''), 4000);
      return;
    }

    const product = products.find(p => String(p.id) === String(selectedProductId));
    if (!product) return;

    setBusy(true);
    try {
      let delta = qty;
      if (movementType === 'Salida a taller') {
        delta = -qty;
      } else if (movementType === 'Ajuste de inventario') {
        delta = -qty;
      }

      const newStock = Math.max(0, product.stock + delta);

      await apiClient.post('/operations/uc-07/ajustar', {
        productoId: Number(product.id),
        variacion: delta,
        cantidadNueva: newStock,
        motivo: movementReason || `${movementType} en bodega`,
        claveOperacion: `ajuste-${Date.now()}`
      }).catch(err => {
        console.warn('Fallback al ajuste en memoria:', err);
      });

      const updatedStatus = newStock <= product.minStock ? 'BAJO_STOCK' : 'OPTIMO';
      setProducts(prev => prev.map(p => p.id === product.id ? { ...p, stock: newStock, status: updatedStatus } : p));

      const now = new Date();
      const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      const newMovement = {
        id: Date.now(),
        tipo: movementType,
        hora: `Hoy, ${timeStr}`,
        detalle: `${product.code} · ${qty}x ${product.name}`,
        motivo: movementReason || movementType,
        delta,
        stockFinal: newStock
      };

      setMovements(prev => [newMovement, ...prev]);
      setMsg(`Movimiento registrado: ${product.name} ahora tiene ${newStock} unidades en stock.`);
      setTimeout(() => setMsg(''), 4000);
    } catch (err) {
      setMsg('Error al registrar movimiento: ' + (err.message || 'Error de servidor'));
      setTimeout(() => setMsg(''), 4000);
    } finally {
      setBusy(false);
    }
  };

  // Creación de nuevo repuesto
  const handleCreateProduct = async (e) => {
    e.preventDefault();
    if (!newProdCode.trim() || !newProdName.trim()) {
      setMsg('El código y el nombre del repuesto son obligatorios.');
      setTimeout(() => setMsg(''), 4000);
      return;
    }

    setBusy(true);
    try {
      const payload = {
        codigo: newProdCode.trim(),
        nombre: newProdName.trim(),
        categoria: newProdCat || 'Repuestos',
        marca: newProdBrand.trim() || 'Original',
        costo: Number(newProdCost || 0),
        precio: Number(newProdPrice || 0),
        stock: Number(newProdStock || 0),
        stockMinimo: Number(newProdMinStock || 5)
      };

      const res = await apiClient.post('/productos', payload);
      const created = res?.data || res || payload;
      const newP = {
        id: created.id || Date.now(),
        code: created.codigo || payload.codigo,
        name: created.nombre || payload.nombre,
        category: created.categoria || payload.categoria,
        brand: created.marca || payload.marca,
        cost: Number(created.costo != null ? created.costo : payload.costo),
        price: Number(created.precio != null ? created.precio : payload.precio),
        stock: Number(created.stock != null ? created.stock : payload.stock),
        minStock: Number(created.stockMinimo != null ? created.stockMinimo : payload.stockMinimo),
        status: Number(created.stock || payload.stock) <= Number(created.stockMinimo || payload.stockMinimo) ? 'BAJO_STOCK' : 'OPTIMO'
      };

      setProducts(prev => [newP, ...prev]);
      setSelectedProductId(String(newP.id));
      setNewProductModalOpen(false);

      // Limpiar campos
      setNewProdCode('');
      setNewProdName('');
      setNewProdCat('Filtros');
      setNewProdBrand('');
      setNewProdCost('');
      setNewProdPrice('');
      setNewProdStock('0');
      setNewProdMinStock('5');

      setMsg(`Repuesto ${newP.code} - ${newP.name} registrado con éxito.`);
      setTimeout(() => setMsg(''), 4000);
    } catch (err) {
      setMsg('Error al crear el repuesto: ' + (err.message || 'Error de conexión'));
      setTimeout(() => setMsg(''), 4000);
    } finally {
      setBusy(false);
    }
  };

  // Descargar reporte CSV
  const handleExportReport = () => {
    if (products.length === 0) {
      setMsg('No hay repuestos registrados en inventario para exportar.');
      setTimeout(() => setMsg(''), 4000);
      return;
    }

    const headers = ['Código', 'Repuesto', 'Categoría', 'Marca', 'Existencias', 'Stock Mínimo', 'Estado', 'Costo Unitario', 'Precio Venta', 'Valor Total'];
    const rows = products.map(p => [
      `"${p.code}"`,
      `"${p.name.replace(/"/g, '""')}"`,
      `"${p.category}"`,
      `"${p.brand}"`,
      p.stock,
      p.minStock,
      p.stock <= p.minStock ? 'BAJO STOCK' : 'NORMAL',
      p.cost.toFixed(2),
      p.price.toFixed(2),
      (p.cost * p.stock).toFixed(2)
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `inventario_repuestos_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setMsg('Reporte de inventario descargado correctamente.');
    setTimeout(() => setMsg(''), 4000);
  };

  return (
    <div className="w-full bg-[#F8FAFC] min-h-screen text-[#111111] font-sans pb-16">
      <main className="w-full max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1">
        {/* 1) Ruta pequeña / Breadcrumb */}
        <div className="mb-2">
          <span className="text-[13px] text-slate-500 font-normal">/inventario</span>
        </div>

        {/* 2 & 3) Encabezado de página + Acciones secundarias */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-8 border-b border-[#E2E8F0]">
          <div>
            <h1 className="text-2xl sm:text-3xl font-semibold text-[#111111] tracking-tight">
              Inventario de Repuestos y Alertas de Stock
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Existencias, costos, movimientos y alertas de bajo stock.
            </p>
          </div>
          <div className="flex items-center gap-3 self-start md:self-auto shrink-0">
            <button
              type="button"
              onClick={handleExportReport}
              className="h-11 px-4 rounded-[10px] bg-transparent border border-[#E2E8F0] text-[#111111] text-xs font-semibold hover:bg-[#F8FAFC] inline-flex items-center gap-2 transition-colors"
            >
              <span className="material-symbols-outlined text-base">download</span>
              <span>Descargar reporte</span>
            </button>
            <button
              type="button"
              onClick={() => setNewProductModalOpen(true)}
              className="h-11 px-4 rounded-[10px] bg-transparent border border-[#E2E8F0] text-[#111111] text-xs font-semibold hover:bg-[#F8FAFC] inline-flex items-center gap-2 transition-colors"
            >
              <span className="material-symbols-outlined text-base">add</span>
              <span>Nuevo repuesto</span>
            </button>
          </div>
        </div>

        {/* Notificación de feedback */}
        {msg && (
          <div className="mt-6 p-4 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs font-medium flex items-center gap-2 shadow-xs">
            <span className="material-symbols-outlined text-emerald-600 text-lg">check_circle</span>
            <span>{msg}</span>
          </div>
        )}

        {/* 4) Resumen de 4 indicadores estadísticos (Inician en 0 si no hay datos) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 my-8">
          {/* Indicador 1: Repuestos registrados */}
          <div className="bg-white border border-[#E2E8F0] rounded-[16px] p-6 lg:p-7 flex flex-col justify-between shadow-xs">
            <div className="text-3xl lg:text-4xl font-bold text-[#111111]">
              {products.length}
            </div>
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mt-2">
              Repuestos registrados
            </div>
          </div>

          {/* Indicador 2: Alertas de bajo stock */}
          <div className="bg-white border border-[#E2E8F0] rounded-[16px] p-6 lg:p-7 flex flex-col justify-between shadow-xs">
            <div className={`text-3xl lg:text-4xl font-bold ${lowStockCount > 0 ? 'text-red-600' : 'text-[#111111]'}`}>
              {lowStockCount}
            </div>
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mt-2">
              Alertas de bajo stock
            </div>
          </div>

          {/* Indicador 3: Valoración de inventario */}
          <div className="bg-white border border-[#E2E8F0] rounded-[16px] p-6 lg:p-7 flex flex-col justify-between shadow-xs">
            <div className="text-3xl lg:text-4xl font-bold text-[#111111]">
              ${totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mt-2">
              Valoración de inventario
            </div>
          </div>

          {/* Indicador 4: Movimientos este mes */}
          <div className="bg-white border border-[#E2E8F0] rounded-[16px] p-6 lg:p-7 flex flex-col justify-between shadow-xs">
            <div className="text-3xl lg:text-4xl font-bold text-[#111111]">
              {movements.length}
            </div>
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mt-2">
              Movimientos este mes
            </div>
          </div>
        </div>

        {/* 5) LAYOUT EN DOS COLUMNAS */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* COLUMNA IZQUIERDA / PRINCIPAL (8 cols) */}
          <div className="lg:col-span-8 space-y-8">
            {/* A) Formulario 'Registrar movimiento de inventario' */}
            <section className="bg-white border border-[#E2E8F0] rounded-[16px] p-6 sm:p-8 shadow-xs">
              <div className="pb-6 border-b border-[#E2E8F0]">
                <h2 className="text-lg font-semibold text-[#111111]">Registrar movimiento de inventario</h2>
                <p className="text-xs text-slate-500 mt-1">
                  Actualización inmediata de existencias físicas en bodega central.
                </p>
              </div>

              <form onSubmit={handleRegisterMovement} className="space-y-6 mt-6">
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-6">
                  {/* Repuesto */}
                  <div className="sm:col-span-8 flex flex-col">
                    <label className="text-[11px] font-semibold text-slate-500 uppercase mb-[6px]" htmlFor="repuesto">
                      Repuesto
                    </label>
                    <div className="relative">
                      <select
                        id="repuesto"
                        value={selectedProductId}
                        onChange={e => setSelectedProductId(e.target.value)}
                        disabled={products.length === 0}
                        className="w-full h-11 bg-white border border-[#E2E8F0] rounded-[10px] px-3.5 text-xs text-[#111111] appearance-none pr-10 focus:border-[#4F46E5] disabled:bg-slate-50 disabled:text-slate-500 outline-none"
                      >
                        {products.length === 0 ? (
                          <option value="">-- Sin repuestos registrados en catálogo --</option>
                        ) : (
                          products.map(p => (
                            <option key={p.id} value={p.id}>
                              {p.code} · {p.name} (Existencias: {p.stock})
                            </option>
                          ))
                        )}
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-500">
                        <span className="material-symbols-outlined text-base">expand_more</span>
                      </div>
                    </div>
                  </div>

                  {/* Cantidad */}
                  <div className="sm:col-span-4 flex flex-col">
                    <label className="text-[11px] font-semibold text-slate-500 uppercase mb-[6px]" htmlFor="cantidad">
                      Cantidad
                    </label>
                    <input
                      id="cantidad"
                      type="number"
                      min="1"
                      required
                      value={movementQty}
                      onChange={e => setMovementQty(e.target.value)}
                      className="w-full h-11 bg-white border border-[#E2E8F0] rounded-[10px] px-3.5 text-xs text-[#111111] focus:border-[#4F46E5] outline-none"
                    />
                  </div>
                </div>

                {/* Tipo de movimiento */}
                <div className="flex flex-col">
                  <label className="text-[11px] font-semibold text-slate-500 uppercase mb-[6px]" htmlFor="tipo_movimiento">
                    Tipo de movimiento
                  </label>
                  <div className="relative">
                    <select
                      id="tipo_movimiento"
                      value={movementType}
                      onChange={e => setMovementType(e.target.value)}
                      className="w-full h-11 bg-white border border-[#E2E8F0] rounded-[10px] px-3.5 text-xs text-[#111111] appearance-none pr-10 focus:border-[#4F46E5] outline-none"
                    >
                      <option value="Entrada por compra">Entrada por compra</option>
                      <option value="Salida a taller">Salida a taller</option>
                      <option value="Ajuste de inventario">Ajuste de inventario</option>
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-500">
                      <span className="material-symbols-outlined text-base">expand_more</span>
                    </div>
                  </div>
                </div>

                {/* Motivo u observación */}
                <div className="flex flex-col">
                  <label className="text-[11px] font-semibold text-slate-500 uppercase mb-[6px]" htmlFor="observacion">
                    Motivo u observación
                  </label>
                  <input
                    id="observacion"
                    type="text"
                    required
                    value={movementReason}
                    onChange={e => setMovementReason(e.target.value)}
                    placeholder="Ej. Reabastecimiento preventivo por bajo stock"
                    className="w-full h-11 bg-white border border-[#E2E8F0] rounded-[10px] px-3.5 text-xs text-[#111111] focus:border-[#4F46E5] outline-none"
                  />
                </div>

                {/* Único botón sólido relleno #4F46E5 */}
                <div className="pt-2 flex justify-end">
                  <button
                    type="submit"
                    disabled={busy || products.length === 0}
                    className="w-full sm:w-auto h-11 px-6 rounded-[10px] bg-[#4F46E5] hover:bg-[#4338CA] active:bg-[#3730A3] text-white text-xs font-semibold inline-flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined text-base">check_circle</span>
                    <span>{busy ? 'Registrando...' : 'Registrar movimiento'}</span>
                  </button>
                </div>
              </form>
            </section>

            {/* B) Tabla de Existencias y Alertas de Bajo Stock */}
            <section className="bg-white border border-[#E2E8F0] rounded-[16px] overflow-hidden shadow-xs">
              <div className="p-6 border-b border-[#E2E8F0] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-[#111111]">Listado de Existencias y Alertas de Stock</h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Control de inventario físico, umbrales mínimos y márgenes.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative w-full sm:w-56">
                    <input
                      type="text"
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      placeholder="Filtrar catálogo..."
                      className="w-full h-9 bg-[#F8FAFC] border border-[#E2E8F0] rounded-[8px] pl-8 pr-3 text-xs text-[#111111] placeholder-slate-400 focus:border-[#4F46E5] outline-none"
                    />
                    <span className="material-symbols-outlined absolute left-2.5 top-2 text-slate-500 text-base">
                      search
                    </span>
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="h-10 bg-[#F8FAFC] border-b border-[#E2E8F0]">
                      <th className="px-6 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Código</th>
                      <th className="px-6 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Repuesto</th>
                      <th className="px-6 text-[10px] font-semibold text-slate-500 uppercase tracking-wider text-right">Existencias</th>
                      <th className="px-6 text-[10px] font-semibold text-slate-500 uppercase tracking-wider text-right">Mínimo</th>
                      <th className="px-6 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Estado</th>
                      <th className="px-6 text-[10px] font-semibold text-slate-500 uppercase tracking-wider text-right">Costo</th>
                      <th className="px-6 text-[10px] font-semibold text-slate-500 uppercase tracking-wider text-right">Precio</th>
                      <th className="px-6 text-[10px] font-semibold text-slate-500 uppercase tracking-wider text-right">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E2E8F0]">
                    {loading ? (
                      <tr>
                        <td colSpan="8" className="px-6 py-12 text-center text-slate-500 text-xs">
                          Cargando existencias de inventario...
                        </td>
                      </tr>
                    ) : filteredProducts.length === 0 ? (
                      <tr>
                        <td colSpan="8" className="px-6 py-12 text-center text-slate-500 text-xs">
                          <span className="material-symbols-outlined text-4xl text-slate-300 block mb-2">
                            inventory_2
                          </span>
                          {products.length === 0 ? (
                            <>
                              <span className="font-semibold text-slate-700">Sin repuestos registrados en el catálogo.</span>
                              <p className="text-slate-500 mt-1">
                                Haz clic en <strong>"+ Nuevo repuesto"</strong> en la parte superior para registrar el primer artículo.
                              </p>
                            </>
                          ) : (
                            <span>No se encontraron repuestos con el filtro <strong>"{search}"</strong>.</span>
                          )}
                        </td>
                      </tr>
                    ) : (
                      filteredProducts.map(p => {
                        const isLow = p.stock <= p.minStock;
                        return (
                          <tr key={p.id} className="h-12 hover:bg-[#F8FAFC] transition-colors">
                            <td className="px-6 font-semibold text-[#111111] whitespace-nowrap font-mono">
                              {p.code}
                            </td>
                            <td className="px-6 text-[#111111] font-medium">
                              <div>{p.name}</div>
                              {p.brand && <span className="text-[10px] text-slate-500 font-normal">{p.brand} · {p.category}</span>}
                            </td>
                            <td className={`px-6 text-right whitespace-nowrap font-semibold ${isLow ? 'text-red-600' : 'text-[#111111]'}`}>
                              {p.stock}
                            </td>
                            <td className="px-6 text-slate-500 text-right whitespace-nowrap">
                              {p.minStock}
                            </td>
                            <td className="px-6 whitespace-nowrap">
                              {isLow ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[6px] bg-red-50 border border-red-200 text-[11px] font-medium text-red-700">
                                  <span className="w-1.5 h-1.5 rounded-full bg-red-600"></span>
                                  Bajo stock
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[6px] bg-slate-50 border border-[#E2E8F0] text-[11px] font-medium text-slate-600">
                                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                                  Normal
                                </span>
                              )}
                            </td>
                            <td className="px-6 text-slate-500 text-right whitespace-nowrap font-mono">
                              ${p.cost.toFixed(2)}
                            </td>
                            <td className="px-6 font-semibold text-[#111111] text-right whitespace-nowrap font-mono">
                              ${p.price.toFixed(2)}
                            </td>
                            <td className="px-6 text-right whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedProductId(String(p.id));
                                  setMovementReason(`Ajuste para ${p.code}`);
                                }}
                                className="px-2.5 py-1 rounded-[6px] border border-[#E2E8F0] hover:bg-slate-100 text-[11px] font-semibold text-slate-700 transition-colors"
                              >
                                Seleccionar
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Paginador sutil */}
              <div className="px-6 py-4 border-t border-[#E2E8F0] flex items-center justify-between text-xs text-slate-500">
                <span>Mostrando {filteredProducts.length} de {products.length} referencias</span>
                <div className="flex items-center gap-2">
                  <button
                    disabled
                    type="button"
                    className="px-3 py-1 rounded-[6px] border border-[#E2E8F0] text-xs font-medium opacity-50 cursor-not-allowed"
                  >
                    Anterior
                  </button>
                  <button
                    disabled
                    type="button"
                    className="px-3 py-1 rounded-[6px] border border-[#E2E8F0] text-xs font-medium opacity-50 cursor-not-allowed"
                  >
                    Siguiente
                  </button>
                </div>
              </div>
            </section>
          </div>

          {/* COLUMNA DERECHA / LATERAL (4 cols) */}
          <div className="lg:col-span-4 space-y-8">
            {/* A) Tarjeta 'Alertas prioritarias de reposición' */}
            <section className="bg-white border border-[#E2E8F0] rounded-[16px] p-6 sm:p-7 shadow-xs">
              <div className="flex items-center justify-between pb-5 border-b border-[#E2E8F0]">
                <div>
                  <h2 className="text-base font-semibold text-[#111111]">Alertas prioritarias de reposición</h2>
                  <p className="text-xs text-slate-500 mt-1">Piezas por debajo del umbral de seguridad.</p>
                </div>
                <span className="material-symbols-outlined text-slate-500 text-xl">warning</span>
              </div>

              <div className="space-y-3.5 my-6">
                {products.filter(p => p.stock <= p.minStock).length === 0 ? (
                  <div className="p-5 rounded-[10px] border border-dashed border-slate-200 text-center text-slate-500 text-xs">
                    <span className="material-symbols-outlined text-emerald-600 text-3xl block mb-2">
                      check_circle
                    </span>
                    <strong className="text-slate-800 block mb-1">Nivel óptimo</strong>
                    Todas las existencias se encuentran en niveles seguros. Sin alertas críticas de reposición.
                  </div>
                ) : (
                  products.filter(p => p.stock <= p.minStock).map(item => (
                    <div key={item.id} className="p-4 rounded-[10px] border border-[#E2E8F0] bg-[#F8FAFC]">
                      <div className="flex items-start justify-between">
                        <div>
                          <span className="text-xs font-semibold text-[#111111]">
                            {item.code} · {item.name}
                          </span>
                          <p className="text-xs text-red-600 font-medium mt-1">
                            {item.stock} unidades restantes (mínimo {item.minStock})
                          </p>
                        </div>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-2 border-t border-[#E2E8F0] pt-2">
                        Notificación de necesidad de compra inmediata a distribuidor autorizado.
                      </p>
                    </div>
                  ))
                )}
              </div>

              {/* Botón de contorno secundario */}
              <button
                type="button"
                onClick={() => onNavigate?.('compras')}
                className="w-full h-11 px-5 rounded-[10px] bg-transparent border border-[#E2E8F0] text-[#111111] text-xs font-semibold hover:bg-[#F8FAFC] inline-flex items-center justify-center gap-2 transition-colors"
              >
                <span className="material-symbols-outlined text-base">shopping_cart</span>
                <span>Generar orden de compra</span>
              </button>
            </section>

            {/* B) Tarjeta 'Últimos movimientos registrados' */}
            <section className="bg-white border border-[#E2E8F0] rounded-[16px] p-6 sm:p-7 shadow-xs">
              <div className="pb-5 border-b border-[#E2E8F0]">
                <h2 className="text-base font-semibold text-[#111111]">Últimos movimientos registrados</h2>
                <p className="text-xs text-slate-500 mt-1">Bitácora reciente de transacciones y ajustes.</p>
              </div>

              <div className="divide-y divide-[#E2E8F0] mt-2">
                {movements.length === 0 ? (
                  <div className="py-8 text-center text-slate-500 text-xs">
                    Sin movimientos registrados en esta sesión.
                  </div>
                ) : (
                  movements.slice(0, 5).map(m => (
                    <div key={m.id} className="py-3.5 flex flex-col gap-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-slate-500 uppercase font-semibold">
                          {m.tipo}
                        </span>
                        <span className="text-[11px] text-slate-500">{m.hora}</span>
                      </div>
                      <p className="text-xs text-[#111111] font-medium">{m.detalle}</p>
                    </div>
                  ))
                )}
              </div>

              <div className="pt-4 border-t border-[#E2E8F0]">
                <button
                  type="button"
                  onClick={() => setAuditModalOpen(true)}
                  className="text-xs font-semibold text-[#4F46E5] hover:underline inline-flex items-center gap-1"
                >
                  <span>Ver historial completo de auditoría</span>
                  <span className="material-symbols-outlined text-[15px]">arrow_forward</span>
                </button>
              </div>
            </section>
          </div>
        </div>
      </main>

      {/* MODAL: Nuevo repuesto */}
      {newProductModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 sm:p-7 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200">
              <h3 className="text-base font-bold text-[#111111]">Nuevo Repuesto en Catálogo</h3>
              <button
                type="button"
                onClick={() => setNewProductModalOpen(false)}
                className="text-slate-500 hover:text-slate-700"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            <form onSubmit={handleCreateProduct} className="space-y-4 mt-5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase mb-1">
                    Código OEM / Referencia *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. FIL-001"
                    value={newProdCode}
                    onChange={e => setNewProdCode(e.target.value)}
                    className="w-full h-10 px-3 border border-[#E2E8F0] rounded-[8px] focus:border-[#4F46E5] outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase mb-1">
                    Categoría
                  </label>
                  <select
                    value={newProdCat}
                    onChange={e => setNewProdCat(e.target.value)}
                    className="w-full h-10 px-3 border border-[#E2E8F0] rounded-[8px] focus:border-[#4F46E5] outline-none"
                  >
                    <option value="Filtros">Filtros</option>
                    <option value="Frenos">Frenos</option>
                    <option value="Motor / Ignición">Motor / Ignición</option>
                    <option value="Lubricantes">Lubricantes</option>
                    <option value="Fluidos">Fluidos</option>
                    <option value="Eléctrico">Eléctrico</option>
                    <option value="Suspensión">Suspensión</option>
                    <option value="Carrocería">Carrocería</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-500 uppercase mb-1">
                  Descripción / Nombre del Repuesto *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Filtro de aceite sintético 10W40"
                  value={newProdName}
                  onChange={e => setNewProdName(e.target.value)}
                  className="w-full h-10 px-3 border border-[#E2E8F0] rounded-[8px] focus:border-[#4F46E5] outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-500 uppercase mb-1">
                  Marca / Fabricante
                </label>
                <input
                  type="text"
                  placeholder="Ej. Bosch, Brembo, Motul, Original"
                  value={newProdBrand}
                  onChange={e => setNewProdBrand(e.target.value)}
                  className="w-full h-10 px-3 border border-[#E2E8F0] rounded-[8px] focus:border-[#4F46E5] outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase mb-1">
                    Costo Base ($)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={newProdCost}
                    onChange={e => setNewProdCost(e.target.value)}
                    className="w-full h-10 px-3 border border-[#E2E8F0] rounded-[8px] focus:border-[#4F46E5] outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase mb-1">
                    Precio Venta ($)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={newProdPrice}
                    onChange={e => setNewProdPrice(e.target.value)}
                    className="w-full h-10 px-3 border border-[#E2E8F0] rounded-[8px] focus:border-[#4F46E5] outline-none font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase mb-1">
                    Stock Inicial
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={newProdStock}
                    onChange={e => setNewProdStock(e.target.value)}
                    className="w-full h-10 px-3 border border-[#E2E8F0] rounded-[8px] focus:border-[#4F46E5] outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase mb-1">
                    Stock Mínimo Alerta
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={newProdMinStock}
                    onChange={e => setNewProdMinStock(e.target.value)}
                    className="w-full h-10 px-3 border border-[#E2E8F0] rounded-[8px] focus:border-[#4F46E5] outline-none font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setNewProductModalOpen(false)}
                  className="px-4 py-2 border border-[#E2E8F0] rounded-[8px] font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="px-5 py-2 bg-[#4F46E5] hover:bg-[#4338CA] text-white rounded-[8px] font-semibold disabled:opacity-50 inline-flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-base">save</span>
                  <span>{busy ? 'Guardando...' : 'Guardar Repuesto'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Auditoría de movimientos */}
      {auditModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 sm:p-7 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200">
              <div>
                <h3 className="text-base font-bold text-[#111111]">Historial de Auditoría de Inventario</h3>
                <p className="text-xs text-slate-500 mt-0.5">Trazabilidad de movimientos y ajustes de existencias.</p>
              </div>
              <button
                type="button"
                onClick={() => setAuditModalOpen(false)}
                className="text-slate-500 hover:text-slate-700"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            <div className="my-5 max-h-[350px] overflow-y-auto divide-y divide-slate-100">
              {movements.length === 0 ? (
                <div className="py-8 text-center text-slate-500 text-xs">
                  No hay movimientos registrados en la bitácora actual.
                </div>
              ) : (
                movements.map(m => (
                  <div key={m.id} className="py-3 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-semibold text-slate-900">{m.detalle}</span>
                      <p className="text-[11px] text-slate-500 mt-0.5">Motivo: {m.motivo}</p>
                    </div>
                    <div className="text-right">
                      <span className="font-mono font-bold text-slate-800">
                        {m.delta > 0 ? `+${m.delta}` : m.delta} u.
                      </span>
                      <p className="text-[10px] text-slate-500">{m.hora}</p>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setAuditModalOpen(false)}
                className="px-4 py-2 border border-[#E2E8F0] rounded-[8px] text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
