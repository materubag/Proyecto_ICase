import React, { useState, useEffect } from 'react';
import apiClient from '../../api/client';
import { INITIAL_STORE_PRODUCTS } from './CatlogodeProductosparaVentaMockup';

const INITIAL_SALES = [
  { id: 1, factura: 'FAC-001-0024', fecha: '21 Nov 2024 · 10:15', cliente: 'Consumidor Final', vendedor: 'Carlos Mendoza', productos: '2x Aceite de Oliva 500ml, 1x Café Tostado 1kg', total: 502.00, subtotal: 436.52, iva: 65.48, unidades: 3 },
  { id: 2, factura: 'FAC-001-0023', fecha: '21 Nov 2024 · 09:42', cliente: 'Distribuidora San Juan', vendedor: 'Mariana Soto', productos: '5x Arroz Flor 1kg, 3x Atún Lomitos 140g', total: 325.00, subtotal: 282.61, iva: 42.39, unidades: 8 },
  { id: 3, factura: 'FAC-001-0022', fecha: '21 Nov 2024 · 08:30', cliente: 'Juan Carlos Morales', vendedor: 'Carlos Mendoza', productos: '2x Detergente Líquido 3L', total: 324.00, subtotal: 281.74, iva: 42.26, unidades: 2 },
  { id: 4, factura: 'FAC-001-0021', fecha: '20 Nov 2024 · 18:05', cliente: 'Consumidor Final', vendedor: 'Elena Castillo', productos: '6x Agua Mineral 500ml, 2x Fideos Spaghetti 400g', total: 116.00, subtotal: 100.87, iva: 15.13, unidades: 8 },
  { id: 5, factura: 'FAC-001-0020', fecha: '20 Nov 2024 · 16:20', cliente: 'Restaurante El Criollo', vendedor: 'Roberto Gómez', productos: '10x Arroz Flor 1kg, 4x Aceite 1L', total: 492.00, subtotal: 427.83, iva: 64.17, unidades: 14 }
];

export default function HistorialyConsultadeVentasMockup() {
  const [sales, setSales] = useState(INITIAL_SALES);
  const [products, setProducts] = useState(INITIAL_STORE_PRODUCTS);
  const [search, setSearch] = useState('');
  const [selectedProduct, setSelectedProduct] = useState(INITIAL_STORE_PRODUCTS[0]?.id || 1);
  const [quickQty, setQuickQty] = useState(2);
  const [quickCustomer, setQuickCustomer] = useState('Consumidor Final');
  const [selectedSaleDetail, setSelectedSaleDetail] = useState(null);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    let mounted = true;
    apiClient.get('/ventas')
      .then(res => {
        const list = Array.isArray(res) ? res : (res?.data || []);
        if (mounted && Array.isArray(list) && list.length > 0) {
          const mapped = list.map(v => ({
            id: v.id,
            factura: v.factura || v.numeroFactura || `FAC-001-${String(v.id).padStart(4, '0')}`,
            fecha: v.fecha || 'Hoy',
            cliente: v.cliente || 'Consumidor Final',
            vendedor: v.vendedor || 'Carlos Mendoza',
            productos: v.productos || (Array.isArray(v.items) ? v.items.map(i => `${i.cantidad}x ${i.nombre || i.descripcion}`).join(', ') : 'Venta de mostrador'),
            total: Number(v.total || 0),
            subtotal: Number(v.subtotal || v.total * 0.87),
            iva: Number(v.iva || v.total * 0.13),
            unidades: v.unidades || (Array.isArray(v.items) ? v.items.reduce((s, i) => s + (i.cantidad || 1), 0) : 1)
          }));
          setSales(mapped);
        }
      })
      .catch(() => {});
    return () => { mounted = false; };
  }, []);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const currentProd = products.find(p => p.id === Number(selectedProduct)) || products[0];
  const unitPrice = currentProd ? currentProd.precio_venta : 0;
  const quickSubtotal = unitPrice * quickQty;
  const quickIva = quickSubtotal * 0.15;
  const quickTotal = quickSubtotal + quickIva;

  const handleQuickSale = async (e) => {
    e.preventDefault();
    if (!currentProd) return;

    const newInvoice = `FAC-001-${Math.floor(1000 + Math.random() * 9000)}`;
    const saleRecord = {
      id: sales.length ? Math.max(...sales.map(s => s.id)) + 1 : 1,
      factura: newInvoice,
      fecha: 'Hoy · ' + new Date().toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' }),
      cliente: quickCustomer,
      vendedor: 'Carlos Mendoza',
      productos: `${quickQty}x ${currentProd.nombre}`,
      total: quickTotal,
      subtotal: quickSubtotal,
      iva: quickIva,
      unidades: quickQty
    };

    try {
      await apiClient.post('/ventas', {
        ...saleRecord,
        items: [{ id: currentProd.id, codigo: currentProd.codigo, cantidad: quickQty, precio: unitPrice }]
      });
    } catch (err) {}

    // Descontar inventario local
    setProducts(prev => prev.map(p => p.id === currentProd.id ? { ...p, existencia_actual: Math.max(0, p.existencia_actual - quickQty) } : p));
    setSales(prev => [saleRecord, ...prev]);
    showToast(`Venta #${newInvoice} cobrada exitosamente. Stock descontado.`);
  };

  // KPIs
  const totalSalesDay = sales.reduce((sum, s) => sum + s.total, 0);
  const totalInvoicesDay = sales.length;
  const avgTicket = totalInvoicesDay > 0 ? (totalSalesDay / totalInvoicesDay) : 0;
  const totalUnitsDiscounted = sales.reduce((sum, s) => sum + (s.unidades || 1), 0);

  const filtered = sales.filter(s => {
    const term = search.toLowerCase();
    return s.factura.toLowerCase().includes(term) || s.cliente.toLowerCase().includes(term) || s.vendedor.toLowerCase().includes(term);
  });

  return (
    <div className="w-full max-w-[1200px] mx-auto pb-12">
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 text-sm font-medium border border-slate-700 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <svg className="w-5 h-5 text-emerald-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"/></svg>
          <span>{toast}</span>
        </div>
      )}

      {/* 1. Ruta pequeña gris (Exacto Stitch) */}
      <nav className="text-xs text-slate-500 mb-2 font-medium">
        <span>Inicio</span>
        <span className="mx-1.5 text-slate-300">/</span>
        <span className="text-slate-900 font-semibold">/ventas</span>
      </nav>

      {/* 2. Título + descripción corta y 3. Acciones de encabezado */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">Historial y Consulta de Ventas</h1>
          <p className="text-sm text-slate-500 mt-1">Registro de ventas directas de mostrador y consulta de facturas emitidas.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => showToast('Reporte generado en PDF y listo para imprimir')}
            className="h-11 px-5 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-800 hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer"
          >
            Exportar reporte
          </button>
          <button
            type="button"
            onClick={() => showToast('Filtro establecido: Últimos 30 días')}
            className="h-11 px-5 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-800 hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer"
          >
            Filtrar período
          </button>
        </div>
      </div>

      {/* 4. Resumen: 4 indicadores arriba (Exacto Stitch) */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
          <div className="text-[36px] font-bold leading-none tracking-tight text-slate-900">${totalSalesDay.toFixed(2)}</div>
          <div className="text-xs font-medium text-slate-500 mt-2">Ventas del día</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
          <div className="text-[36px] font-bold leading-none tracking-tight text-slate-900">{totalInvoicesDay}</div>
          <div className="text-xs font-medium text-slate-500 mt-2">Facturas emitidas hoy</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
          <div className="text-[36px] font-bold leading-none tracking-tight text-indigo-600">${avgTicket.toFixed(2)}</div>
          <div className="text-xs font-medium text-slate-500 mt-2">Ticket promedio</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
          <div className="text-[36px] font-bold leading-none tracking-tight text-emerald-600">{totalUnitsDiscounted}</div>
          <div className="text-xs font-medium text-emerald-600 mt-2">Unidades descontadas</div>
        </div>
      </section>

      {/* 5. Dos Columnas: Formulario lateral de venta mostrador + Historial de facturas */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Lateral Izquierdo: Venta de mostrador (4 cols) */}
        <section className="lg:col-span-4 bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-xs">
          <div className="mb-6">
            <h2 className="text-lg font-bold text-slate-900">Venta de mostrador</h2>
            <p className="text-xs text-slate-500 mt-1">Venta rápida directa sin orden previa de trabajo.</p>
          </div>

          <form className="space-y-4 text-xs" onSubmit={handleQuickSale}>
            <div>
              <label className="block font-bold text-slate-700 mb-1" htmlFor="cliente">Cliente</label>
              <input
                type="text"
                id="cliente"
                value={quickCustomer}
                onChange={(e) => setQuickCustomer(e.target.value)}
                className="w-full h-11 px-3.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-indigo-600"
                required
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1" htmlFor="producto">Producto</label>
              <select
                id="producto"
                value={selectedProduct}
                onChange={(e) => setSelectedProduct(e.target.value)}
                className="w-full h-11 px-3 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-indigo-600 font-medium"
              >
                {products.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.codigo} - {p.nombre} (Stock: {p.existencia_actual})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1" htmlFor="cantidad">Cantidad</label>
                <input
                  type="number"
                  id="cantidad"
                  min="1"
                  max={currentProd?.existencia_actual || 99}
                  value={quickQty}
                  onChange={(e) => setQuickQty(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  className="w-full h-11 px-3.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-indigo-600"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1" htmlFor="precio">Precio</label>
                <input
                  type="text"
                  id="precio"
                  value={`$${Number(unitPrice).toFixed(2)}`}
                  readOnly
                  className="w-full h-11 px-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none"
                />
              </div>
            </div>

            <div className="pt-2 border-t border-slate-200 space-y-1.5 text-xs text-slate-600">
              <div className="flex justify-between py-0.5">
                <span>Subtotal</span>
                <span className="font-semibold text-slate-900">${quickSubtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between py-0.5">
                <span>IVA (15%)</span>
                <span className="font-semibold text-slate-900">${quickIva.toFixed(2)}</span>
              </div>
              <div className="flex justify-between py-1 border-t border-slate-200 text-sm font-bold text-slate-900">
                <span>Total a cobrar</span>
                <span className="text-indigo-600 text-base font-black">${quickTotal.toFixed(2)}</span>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                className="w-full h-11 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 transition-colors flex items-center justify-center cursor-pointer shadow-xs"
              >
                Cobrar venta
              </button>
              <p className="text-[11px] text-slate-400 text-center mt-2">
                Descuenta automáticamente del inventario al confirmar (RF-04).
              </p>
            </div>
          </form>
        </section>

        {/* Tarjeta Principal: Historial y Consulta de Ventas Registradas (8 cols) */}
        <section className="lg:col-span-8 bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-slate-200 gap-3 mb-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Ventas registradas</h2>
              <p className="text-xs text-slate-500 mt-0.5">Consulta de facturas, vendedores y desglose de productos.</p>
            </div>
            <div className="relative">
              <input
                type="text"
                placeholder="Buscar factura o cliente..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-10 px-3.5 text-xs bg-white border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-600 w-60"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold">
                  <th className="py-3 px-3.5">Factura</th>
                  <th className="py-3 px-3.5">Fecha</th>
                  <th className="py-3 px-3.5">Cliente</th>
                  <th className="py-3 px-3.5">Vendedor</th>
                  <th className="py-3 px-3.5">Detalle de productos</th>
                  <th className="py-3 px-3.5 text-right">Total</th>
                  <th className="py-3 px-3.5 text-center">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(s => (
                  <tr key={s.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3.5 px-3.5 font-mono font-bold text-slate-900">{s.factura}</td>
                    <td className="py-3.5 px-3.5 text-slate-500 whitespace-nowrap">{s.fecha}</td>
                    <td className="py-3.5 px-3.5 font-medium text-slate-900">{s.cliente}</td>
                    <td className="py-3.5 px-3.5 text-slate-600">{s.vendedor}</td>
                    <td className="py-3.5 px-3.5 text-slate-700 max-w-xs truncate">{s.productos}</td>
                    <td className="py-3.5 px-3.5 text-right font-black text-slate-900">${s.total.toFixed(2)}</td>
                    <td className="py-3.5 px-3.5 text-center">
                      <button
                        type="button"
                        onClick={() => setSelectedSaleDetail(s)}
                        className="text-indigo-600 hover:text-indigo-800 font-bold text-xs cursor-pointer"
                      >
                        Ver Detalle
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* Modal de Detalle de Factura */}
      {selectedSaleDetail && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
              <h3 className="text-sm font-bold text-slate-900">Detalle de Comprobante {selectedSaleDetail.factura}</h3>
              <button
                type="button"
                onClick={() => setSelectedSaleDetail(null)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                ✕
              </button>
            </div>
            <div className="p-6 space-y-3 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Fecha de Emisión</span>
                <span className="font-semibold text-slate-900">{selectedSaleDetail.fecha}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Cliente</span>
                <span className="font-bold text-slate-900">{selectedSaleDetail.cliente}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Vendedor Asignado</span>
                <span className="text-slate-900 font-medium">{selectedSaleDetail.vendedor}</span>
              </div>
              <div className="py-2 border-b border-slate-100">
                <span className="text-slate-500 block mb-1">Ítems Facturados</span>
                <span className="font-bold text-slate-800 block bg-slate-50 p-2.5 rounded-lg border border-slate-200">{selectedSaleDetail.productos}</span>
              </div>
              <div className="space-y-1 pt-1">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal</span>
                  <span>${selectedSaleDetail.subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>IVA 15%</span>
                  <span>${selectedSaleDetail.iva.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-base font-black text-slate-900 pt-2 border-t border-slate-200">
                  <span>Total Facturado</span>
                  <span className="text-indigo-600">${selectedSaleDetail.total.toFixed(2)}</span>
                </div>
              </div>
            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => { setSelectedSaleDetail(null); showToast('Enviando factura a impresora térmica...'); }}
                className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 cursor-pointer"
              >
                Imprimir Factura
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
