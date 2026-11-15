import React, { useState, useEffect } from 'react';
import apiClient from '../../api/client';

export default function VentaDirectadeRepuestosenMostrador16Mockup({ onNavigate }) {
  const [clients, setClients] = useState([]);
  const [clientId, setClientId] = useState('');
  const [saleError, setSaleError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [cart, setCart] = useState([]);
  const [availableProducts, setAvailableProducts] = useState([]);
  const [busy, setBusy] = useState(false);
  const [successReceipt, setSuccessReceipt] = useState(null);

  useEffect(() => {
    let mounted = true;
    apiClient.get('/clientes').then((res) => {
      const list = Array.isArray(res) ? res : (res?.data || []);
      if (mounted) setClients(list);
    }).catch(() => {});
    apiClient.get('/productos')
      .then(res => {
        const list = Array.isArray(res) ? res : (res?.data || []);
        if (mounted && list && list.length > 0) {
          const mapped = list.map(p => ({
            id: p.id,
            code: p.codigo,
            name: p.nombre,
            price: Number(p.precio || 35.0),
            stock: Number(p.stock || 10)
          }));
          setAvailableProducts(mapped);
        } else if (mounted) {
          setAvailableProducts([]);
        }
      })
      .catch(() => {
        if (mounted) setAvailableProducts([]);
      });
    return () => { mounted = false; };
  }, []);

  const addToCart = (product) => {
    const existing = cart.find(c => c.id === product.id);
    if (existing) {
      setCart(cart.map(c => c.id === product.id ? { ...c, qty: c.qty + 1 } : c));
    } else {
      setCart([...cart, { ...product, qty: 1 }]);
    }
  };

  const updateQty = (id, delta) => {
    setCart(cart.map(c => {
      if (c.id === id) {
        const newQty = Math.max(1, c.qty + delta);
        return { ...c, qty: newQty };
      }
      return c;
    }));
  };

  const removeFromCart = (id) => {
    setCart(cart.filter(c => c.id !== id));
  };

  const subtotal = cart.reduce((acc, item) => acc + (item.price * item.qty), 0);
  const tax = subtotal * 0.15;
  const total = subtotal + tax;

  const handleEmitSale = async () => {
    if (cart.length === 0 || !clientId) {
      setSaleError('Selecciona el cliente y al menos un repuesto.');
      return;
    }
    setBusy(true);

    try {
      const result = await apiClient.post('/workshop-flow/venta', {
        clienteId: Number(clientId),
        items: cart.map(item => ({ repuestoId: item.id, cantidad: item.qty }))
      });
      const selected = clients.find((item) => Number(item.id) === Number(clientId));
      setSuccessReceipt({
        ticketNo: 'VTA-' + result.ventaId,
        client: selected?.nombre || 'Cliente',
        date: new Date().toLocaleString('es-EC'),
        total: total.toFixed(2),
        itemsCount: cart.reduce((acc, i) => acc + i.qty, 0)
      });
      setCart([]);
    } catch (err) {
      setSaleError(err.details?.message || err.message || 'No se pudo confirmar la venta.');
    } finally {
      setBusy(false);
    }
  };

  const filteredProducts = availableProducts.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="w-full bg-slate-50 min-h-full pb-12 font-sans">
      <section className="w-full bg-white border-b border-slate-200">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500 mb-1 font-medium">
              <span>Taller</span>
              <span className="material-symbols-outlined text-xs">chevron_right</span>
              <span>Almacén</span>
              <span className="material-symbols-outlined text-xs">chevron_right</span>
              <span className="text-indigo-600 font-semibold">Venta en Mostrador (RF-25)</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              Venta Directa de Repuestos en Mostrador
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Despacho rápido de repuestos e insumos sin necesidad de crear una orden de trabajo (RF-25).
            </p>
          </div>

          <button
            onClick={() => onNavigate?.('inventario')}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-semibold text-indigo-600 border border-indigo-200 flex items-center gap-1.5 transition-colors self-start md:self-auto"
          >
            <span className="material-symbols-outlined text-sm">inventory_2</span>
            Consultar Existencias
          </button>
        </div>
      </section>

      <main className="max-w-[1600px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {successReceipt && (
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-900 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-emerald-600 text-3xl">task_alt</span>
              <div>
                <strong className="block text-sm font-bold">¡Venta emitida y stock descontado exitosamente!</strong>
                <span className="text-xs">
                  Comprobante: <strong>{successReceipt.ticketNo}</strong> · Cliente: <strong>{successReceipt.client}</strong> · Total: <strong>${successReceipt.total}</strong> ({successReceipt.itemsCount} ítems)
                </span>
              </div>
            </div>
            <button
              onClick={() => setSuccessReceipt(null)}
              className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-semibold whitespace-nowrap"
            >
              Nueva Venta
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Product Catalog / Quick Add: 7 cols */}
          <section className="lg:col-span-7 bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <span className="material-symbols-outlined text-indigo-600">search</span>
                Catálogo de Repuestos Disponibles
              </h2>
              <span className="text-xs text-slate-500">{availableProducts.length} repuestos en catálogo</span>
            </div>

            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-2.5 text-slate-500 text-[18px]">search</span>
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Buscar repuesto por código OEM o nombre..."
                className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>

            <div className="divide-y divide-slate-200 max-h-[440px] overflow-y-auto">
              {filteredProducts.map(p => (
                <div key={p.id} className="py-3 flex items-center justify-between text-xs hover:bg-slate-50 transition-colors">
                  <div>
                    <strong className="block font-semibold text-slate-900">{p.name}</strong>
                    <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                      <span className="font-mono">{p.code}</span>
                      <span>·</span>
                      <span className={p.stock <= 3 ? 'text-amber-800 font-bold' : 'text-emerald-700'}>
                        Stock: {p.stock} un.
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-bold text-sm text-slate-900">${p.price.toFixed(2)}</span>
                    <button
                      type="button"
                      onClick={() => addToCart(p)}
                      className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-600 text-indigo-600 hover:text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1"
                    >
                      <span className="material-symbols-outlined text-sm">add_shopping_cart</span>
                      Añadir
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Cart / POS Register: 5 cols */}
          <aside className="lg:col-span-5 bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4 sticky top-20">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <span className="material-symbols-outlined text-indigo-600">point_of_sale</span>
                Ticket de Venta Directa
              </h2>
              <span className="text-xs font-mono font-bold text-indigo-600">{cart.length} ítems</span>
            </div>

            {/* Client Selector */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                Cliente Comprador
              </label>
              <select
                value={clientId}
                onChange={e => setClientId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-medium text-slate-900 bg-white outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Selecciona un cliente</option>
                {clients.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}
              </select>
              {saleError && <p className="mt-2 text-xs text-error">{saleError}</p>}
            </div>

            {/* Cart Items List */}
            <div className="space-y-2 max-h-56 overflow-y-auto">
              {cart.length === 0 ? (
                <div className="text-center py-8 text-slate-500 text-xs">
                  <span className="material-symbols-outlined text-3xl mb-1 text-slate-400">shopping_bag</span>
                  <p>El ticket está vacío. Seleccione repuestos del catálogo para despachar.</p>
                </div>
              ) : (
                cart.map(item => (
                  <div key={item.id} className="p-2.5 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-between text-xs">
                    <div className="min-w-0 flex-1 pr-2">
                      <strong className="block text-slate-900 truncate text-xs">{item.name}</strong>
                      <span className="font-mono text-[10px] text-slate-500">${item.price.toFixed(2)} c/u</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center border border-slate-200 rounded bg-white overflow-hidden">
                        <button
                          type="button"
                          onClick={() => updateQty(item.id, -1)}
                          className="px-2 py-0.5 hover:bg-slate-100 font-bold text-xs"
                        >
                          -
                        </button>
                        <span className="px-2 py-0.5 font-mono font-bold text-xs">{item.qty}</span>
                        <button
                          type="button"
                          onClick={() => updateQty(item.id, 1)}
                          className="px-2 py-0.5 hover:bg-slate-100 font-bold text-xs"
                        >
                          +
                        </button>
                      </div>
                      <span className="font-mono font-bold text-xs w-14 text-right">
                        ${(item.price * item.qty).toFixed(2)}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeFromCart(item.id)}
                        className="text-error hover:bg-error-container/30 p-1 rounded"
                      >
                        <span className="material-symbols-outlined text-sm">delete</span>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Financial Summary */}
            <div className="pt-3 border-t border-slate-200 space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-500">
                <span>Subtotal:</span>
                <span className="font-mono text-slate-900">${subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>IVA (15%):</span>
                <span className="font-mono text-slate-900">${tax.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-base font-bold text-indigo-600 pt-2 border-t border-slate-200">
                <span>Total a Cobrar:</span>
                <span className="font-mono">${total.toFixed(2)}</span>
              </div>
            </div>

            <button
              type="button"
              disabled={busy || cart.length === 0}
              onClick={handleEmitSale}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-50 text-white font-bold rounded-xl text-xs shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-base">receipt_long</span>
              <span>{busy ? 'Procesando Venta...' : 'Emitir Venta y Descontar Stock (RF-25)'}</span>
            </button>
          </aside>
        </div>
      </main>
    </div>
  );
}
