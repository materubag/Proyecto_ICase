import React, { useState, useEffect } from 'react';
import apiClient from '../../api/client';

export const INITIAL_STORE_PRODUCTS = [
  { id: 1, codigo: 'SKU-77210', nombre: 'Aceite de Oliva Extra Virgen 500ml', categoria: 'Abarrotes', precio_venta: 128.50, precio: 128.50, costo: 95.00, existencia_actual: 45, stock: 45, stockMinimo: 10, activo: true },
  { id: 2, codigo: 'SKU-31094', nombre: 'Café Tostado en Grano Selección 1kg', categoria: 'Bebidas', precio_venta: 245.00, precio: 245.00, costo: 180.00, existencia_actual: 3, stock: 3, stockMinimo: 10, activo: true },
  { id: 3, codigo: 'SKU-99412', nombre: 'Detergente Líquido Biodegradable 3L', categoria: 'Limpieza', precio_venta: 162.00, precio: 162.00, costo: 115.00, existencia_actual: 28, stock: 28, stockMinimo: 8, activo: true },
  { id: 4, codigo: 'SKU-48190', nombre: 'Agua Mineral de Manantial Pack 6x500ml', categoria: 'Bebidas', precio_venta: 72.00, precio: 72.00, costo: 48.00, existencia_actual: 60, stock: 60, stockMinimo: 15, activo: true },
  { id: 5, codigo: 'SKU-10245', nombre: 'Arroz Flor Extra Envejecido 1kg', categoria: 'Abarrotes', precio_venta: 38.00, precio: 38.00, costo: 25.00, existencia_actual: 40, stock: 40, stockMinimo: 10, activo: true },
  { id: 6, codigo: 'SKU-55219', nombre: 'Atún Lomitos en Aceite de Girasol 140g', categoria: 'Enlatados', precio_venta: 45.00, precio: 45.00, costo: 32.00, existencia_actual: 50, stock: 50, stockMinimo: 12, activo: true },
  { id: 7, codigo: 'SKU-88231', nombre: 'Leche Entera Larga Vida 1L', categoria: 'Lácteos', precio_venta: 28.00, precio: 28.00, costo: 19.00, existencia_actual: 35, stock: 35, stockMinimo: 10, activo: true },
  { id: 8, codigo: 'SKU-66324', nombre: 'Fideos Spaghetti Clásico 400g', categoria: 'Pastas', precio_venta: 22.00, precio: 22.00, costo: 14.00, existencia_actual: 8, stock: 8, stockMinimo: 10, activo: true }
];

export default function CatlogodeProductosparaVentaMockup({ onNavigate }) {
  const [products, setProducts] = useState(INITIAL_STORE_PRODUCTS);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Todas');
  const [quantities, setQuantities] = useState({});
  const [cart, setCart] = useState(() => {
    try {
      const saved = sessionStorage.getItem('icase_active_cart');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return [
      { id: 1, codigo: 'SKU-77210', nombre: 'Aceite de Oliva Extra Virgen 500ml', precio: 128.50, cantidad: 2 },
      { id: 2, codigo: 'SKU-31094', nombre: 'Café Tostado en Grano Selección 1kg', precio: 245.00, cantidad: 1 },
      { id: 4, codigo: 'SKU-48190', nombre: 'Agua Mineral de Manantial Pack 6x500ml', precio: 72.00, cantidad: 1 }
    ];
  });
  const [toast, setToast] = useState(null);

  useEffect(() => {
    try {
      sessionStorage.setItem('icase_active_cart', JSON.stringify(cart));
    } catch (e) {}
  }, [cart]);

  useEffect(() => {
    let mounted = true;
    apiClient.get('/productos')
      .then(res => {
        const list = Array.isArray(res) ? res : (res?.data || []);
        if (mounted && Array.isArray(list) && list.length > 0) {
          const mapped = list.map(p => ({
            id: p.id,
            codigo: p.codigo || `SKU-${p.id}`,
            nombre: p.nombre || 'Producto',
            categoria: p.categoria || 'Abarrotes',
            precio_venta: Number(p.precio_venta ?? p.precio ?? 10.0),
            existencia_actual: Number(p.existencia_actual ?? p.stock ?? 15),
            stockMinimo: Number(p.stockMinimo ?? 10),
            activo: p.activo !== false
          }));
          setProducts(mapped);
        }
      })
      .catch(() => {});
    return () => { mounted = false; };
  }, []);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const getQty = (id) => quantities[id] || 1;
  const setQty = (id, val) => {
    const prod = products.find(p => p.id === id);
    const maxStock = Number(prod?.existencia_actual ?? prod?.stock ?? 1);
    const n = Math.min(maxStock, Math.max(1, parseInt(val, 10) || 1));
    setQuantities(prev => ({ ...prev, [id]: n }));
  };

  const handleAddToCart = (product) => {
    const stockAvailable = Number(product.existencia_actual ?? product.stock ?? 0);
    if (stockAvailable <= 0) {
      showToast(`¡Sin existencias! ${product.nombre} no tiene stock disponible.`);
      return;
    }
    const qty = getQty(product.id);
    const currentInCart = cart.find(item => item.id === product.id)?.cantidad || 0;
    if (currentInCart + qty > stockAvailable) {
      showToast(`No puedes superar el stock disponible (${stockAvailable} unidades). Ya tienes ${currentInCart} en la factura.`);
      return;
    }
    setCart(prev => {
      const idx = prev.findIndex(item => item.id === product.id);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = { ...updated[idx], cantidad: updated[idx].cantidad + qty };
        return updated;
      }
      return [...prev, {
        id: product.id,
        codigo: product.codigo,
        nombre: product.nombre,
        precio: product.precio_venta,
        cantidad: qty
      }];
    });
    showToast(`Agregado a la factura: ${qty}x ${product.nombre}`);
  };

  const updateCartQty = (id, delta) => {
    const prod = products.find(p => p.id === id);
    const maxStock = Number(prod?.existencia_actual ?? prod?.stock ?? 9999);
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        const newQty = item.cantidad + delta;
        if (delta > 0 && newQty > maxStock) {
          showToast(`Stock máximo alcanzado (${maxStock} unidades disponibles).`);
          return item;
        }
        return newQty > 0 ? { ...item, cantidad: newQty } : null;
      }
      return item;
    }).filter(Boolean));
  };

  const removeFromCart = (id) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  const clearCart = () => {
    setCart([]);
  };

  const handleContinueToBilling = () => {
    try {
      sessionStorage.setItem('icase_active_cart', JSON.stringify(cart));
    } catch (e) {}
    if (onNavigate) {
      onNavigate('facturacion');
    }
  };

  // KPIs
  const totalProducts = products.length;
  const inStockCount = products.filter(p => p.existencia_actual > 0).length;
  const lowStockCount = products.filter(p => p.existencia_actual > 0 && p.existencia_actual <= (p.stockMinimo || 10)).length;
  const cartItemsCount = cart.reduce((sum, item) => sum + item.cantidad, 0);

  // Totales
  const subtotal = cart.reduce((sum, item) => sum + (item.precio * item.cantidad), 0);
  const iva = subtotal * 0.15;
  const total = subtotal + iva;

  // Filtros
  const categories = ['Todas', ...Array.from(new Set(products.map(p => p.categoria || 'General')))];
  const filteredProducts = products.filter(p => {
    const term = search.toLowerCase();
    const matchesSearch = (p.nombre || '').toLowerCase().includes(term) || (p.codigo || '').toLowerCase().includes(term);
    const matchesCategory = selectedCategory === 'Todas' || p.categoria === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="w-full max-w-[1200px] mx-auto pb-12">
      {/* Toast de confirmación */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 text-sm font-medium border border-slate-700 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <svg className="w-5 h-5 text-emerald-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"/></svg>
          <span>{toast}</span>
        </div>
      )}

      {/* 1. Ruta de migas de pan (Exacta Stitch) */}
      <nav aria-label="Migas de pan" className="flex items-center gap-2 mb-4 text-xs text-slate-500 font-medium">
        <span>Tienda</span>
        <span className="text-slate-300">/</span>
        <span>Ventas</span>
        <span className="text-slate-300">/</span>
        <span className="text-slate-900 font-semibold">Catálogo de Productos</span>
      </nav>

      {/* 2. Encabezado principal (Exacto Stitch) */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">Catálogo de Productos</h1>
          <p className="text-sm text-slate-500 mt-1">Explora inventario disponible y agrega productos al detalle de la venta actual.</p>
        </div>
        <div className="flex items-center gap-2 self-start md:self-auto">
          <span className="text-xs font-semibold px-3 py-1 bg-slate-100 rounded-full text-slate-700 border border-slate-200">
            Turno Activo: Mañana
          </span>
          <span className="text-xs font-semibold px-3 py-1 bg-slate-100 rounded-full text-slate-700 border border-slate-200">
            Caja 02
          </span>
        </div>
      </header>

      {/* 3. Resumen métrico (4 indicadores limpios Stitch) */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Total Productos</span>
          <div className="text-[36px] leading-[42px] font-bold text-slate-900">{totalProducts}</div>
          <span className="text-xs text-slate-500 mt-1 block">En catálogo central</span>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">En Existencia</span>
          <div className="text-[36px] leading-[42px] font-bold text-slate-900">{inStockCount}</div>
          <span className="text-xs text-slate-500 mt-1 block">Con unidades listas</span>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Stock Bajo</span>
          <div className="text-[36px] leading-[42px] font-bold text-amber-600">{lowStockCount}</div>
          <span className="text-xs text-slate-500 mt-1 block">Menos de 10 unidades</span>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Ítems en Factura</span>
          <div className="text-[36px] leading-[42px] font-bold text-indigo-600">{cartItemsCount}</div>
          <span className="text-xs text-slate-500 mt-1 block">Seleccionados actualmente</span>
        </div>
      </section>

      {/* 4. Barra de acciones y filtros */}
      <section className="bg-white border border-slate-200 rounded-2xl p-6 mb-8 shadow-xs">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
          <div className="relative flex-1">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
            </span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar producto por nombre o código SKU..."
              className="w-full h-12 pl-12 pr-4 bg-white border border-slate-200 rounded-xl text-slate-900 text-sm placeholder:text-slate-400 focus:outline-none focus:border-indigo-600 transition-colors"
            />
          </div>
          <div className="flex items-center gap-2 overflow-x-auto pb-1 lg:pb-0">
            {categories.map(cat => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`h-9 px-3.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                  selectedCategory === cat
                    ? 'bg-indigo-50 border border-indigo-600 text-indigo-600'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => { setSearch(''); setSelectedCategory('Todas'); }}
            className="h-12 px-5 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs font-semibold hover:bg-slate-50 transition-colors flex items-center justify-center gap-2 shrink-0 cursor-pointer"
          >
            <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
            <span>Limpiar filtros</span>
          </button>
        </div>
      </section>

      {/* 5. Contenido en 2 columnas (Exacto Stitch Mockup) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Columna Izquierda: Listado de Productos (SIN IMÁGENES SEGÚN RF-03 / RF-04) */}
        <main className="lg:col-span-8 bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-xs">
          <div className="flex items-center justify-between pb-6 border-b border-slate-100 mb-6">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Productos Disponibles</h2>
              <span className="text-xs text-slate-500">Mostrando {filteredProducts.length} resultados filtrados</span>
            </div>
            <div className="text-xs text-slate-500">
              Venta de mostrador (Mostrador directo)
            </div>
          </div>

          <div className="space-y-4">
            {filteredProducts.map(product => {
              const qty = getQty(product.id);
              const isLowStock = product.existencia_actual <= product.stockMinimo;
              return (
                <article
                  key={product.id}
                  className="p-5 border border-slate-200 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-slate-300 transition-colors bg-white"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                        {product.categoria}
                      </span>
                      <span className="text-[11px] text-slate-500 font-mono font-medium">
                        {product.codigo}
                      </span>
                    </div>
                    <h3 className="text-base font-bold text-slate-900 truncate">
                      {product.nombre}
                    </h3>
                    <div className="flex items-center gap-4 mt-2">
                      <span className="text-lg font-extrabold text-slate-900">
                        ${Number(product.precio_venta).toFixed(2)}
                      </span>
                      <span className={`text-xs font-medium flex items-center gap-1.5 ${
                        isLowStock ? 'text-amber-600 font-semibold' : 'text-slate-600'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${isLowStock ? 'bg-amber-500' : 'bg-emerald-500'}`}></span>
                        {product.existencia_actual} en existencia
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <div className="flex items-center border border-slate-200 rounded-xl h-11 bg-white">
                      <button
                        type="button"
                        onClick={() => setQty(product.id, qty - 1)}
                        className="w-9 h-full flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-50 rounded-l-xl transition-colors cursor-pointer"
                        title="Disminuir cantidad"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 12H4"/></svg>
                      </button>
                      <input
                        type="number"
                        min="1"
                        max={product.existencia_actual}
                        value={qty}
                        onChange={(e) => setQty(product.id, e.target.value)}
                        className="w-12 h-full text-center text-sm font-bold text-slate-900 bg-transparent focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setQty(product.id, qty + 1)}
                        className="w-9 h-full flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-50 rounded-r-xl transition-colors cursor-pointer"
                        title="Aumentar cantidad"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"/></svg>
                      </button>
                    </div>

                    {Number(product.existencia_actual ?? product.stock ?? 0) <= 0 ? (
                      <span className="h-11 px-4 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 text-xs font-bold flex items-center gap-2">
                        Sin stock
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleAddToCart(product)}
                        className="h-11 px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 text-xs font-bold transition-colors flex items-center gap-2 cursor-pointer shadow-2xs"
                      >
                        <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"/></svg>
                        <span>Agregar a factura</span>
                      </button>
                    )}
                  </div>
                </article>
              );
            })}

            {filteredProducts.length === 0 && (
              <div className="p-8 text-center border border-dashed border-slate-200 rounded-xl text-slate-500 text-sm">
                No se encontraron productos coincidentes con los filtros aplicados.
              </div>
            )}
          </div>
        </main>

        {/* Columna Derecha: Detalle de Venta Actual (Sticky ~380px) */}
        <aside className="lg:col-span-4 bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-xs sticky top-20">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-6">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Detalle de Venta</h2>
              <span className="text-xs text-slate-500">Folio preliminar #VT-2024-089</span>
            </div>
            {cart.length > 0 && (
              <button
                type="button"
                onClick={clearCart}
                className="text-xs font-semibold text-rose-600 hover:text-rose-700 transition-colors cursor-pointer"
              >
                Vaciar
              </button>
            )}
          </div>

          {/* Lista de Ítems en Factura */}
          <div className="space-y-4 mb-6 max-h-[360px] overflow-y-auto pr-1">
            {cart.map(item => (
              <div key={item.id} className="pb-4 border-b border-slate-100">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <p className="text-xs font-bold text-slate-900 leading-snug">{item.nombre}</p>
                    <span className="text-[11px] text-slate-500">${Number(item.precio).toFixed(2)} c/u</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeFromCart(item.id)}
                    className="text-slate-400 hover:text-rose-600 p-1 transition-colors cursor-pointer"
                    title="Eliminar ítem"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                  </button>
                </div>
                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center border border-slate-200 rounded-lg h-7 bg-white">
                    <button
                      type="button"
                      onClick={() => updateCartQty(item.id, -1)}
                      className="w-6 h-full flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-50 rounded-l-lg transition-colors cursor-pointer"
                    >
                      -
                    </button>
                    <span className="w-7 text-center text-xs font-bold text-slate-900">{item.cantidad}</span>
                    <button
                      type="button"
                      onClick={() => updateCartQty(item.id, 1)}
                      className="w-6 h-full flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-50 rounded-r-lg transition-colors cursor-pointer"
                    >
                      +
                    </button>
                  </div>
                  <span className="text-xs font-bold text-slate-900">${(item.precio * item.cantidad).toFixed(2)}</span>
                </div>
              </div>
            ))}

            {cart.length === 0 && (
              <div className="py-8 text-center text-slate-400 text-xs">
                El detalle de la venta está vacío. Seleccione productos de la lista izquierda.
              </div>
            )}
          </div>

          {/* Desglose Financiero */}
          <div className="space-y-2 mb-6 text-xs text-slate-600 border-t border-slate-100 pt-4">
            <div className="flex justify-between items-center">
              <span>Subtotal</span>
              <span className="text-slate-900 font-semibold">${subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span>IVA (15%)</span>
              <span className="text-slate-900 font-semibold">${iva.toFixed(2)}</span>
            </div>
            <div className="pt-3 border-t border-slate-200 flex justify-between items-baseline">
              <span className="text-sm font-bold text-slate-900">Total a Cobrar</span>
              <span className="text-2xl font-black text-indigo-600">${total.toFixed(2)}</span>
            </div>
          </div>

          {/* Botón Principal Continuar a Facturación */}
          <button
            type="button"
            onClick={handleContinueToBilling}
            disabled={cart.length === 0}
            className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-sm rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-xs"
          >
            <span>Continuar a Facturación</span>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg>
          </button>
        </aside>
      </div>
    </div>
  );
}
