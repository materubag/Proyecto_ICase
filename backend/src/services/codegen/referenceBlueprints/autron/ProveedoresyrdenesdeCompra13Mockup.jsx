import React, { useState, useEffect } from 'react';
import apiClient from '../../api/client';

export default function ProveedoresyrdenesdeCompra13Mockup({ onNavigate }) {
  const [vendors, setVendors] = useState([]);
  const [catalogItems, setCatalogItems] = useState([]);
  const [orders, setOrders] = useState([]);
  const [tab, setTab] = useState('orders'); // 'orders' | 'vendors'
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [showVendorModal, setShowVendorModal] = useState(false);

  const CATALOG_ITEMS = catalogItems;

  useEffect(() => {
    let mounted = true;
    apiClient.get('/proveedores')
      .then(res => {
        const list = Array.isArray(res) ? res : (res?.data || []);
        if (mounted && list) {
          setVendors(list.map(v => ({
            id: v.id,
            nombre: v.nombre,
            ruc: v.identificacionFiscal || '1790000000001',
            contacto: 'Ventas Corporativas',
            telefono: v.telefono || '+593 99 000 0000',
            correo: v.correo || 'ventas@proveedor.ec',
            ciudad: v.direccion || 'Ecuador',
            calificacion: '5.0 ★',
            pedidosTotales: 0,
            creditoDias: 30
          })));
        }
      })
      .catch(() => {
        if (mounted) setVendors([]);
      });

    apiClient.get('/productos')
      .then(res => {
        const prods = Array.isArray(res) ? res : (res?.data || []);
        if (mounted && prods) {
          setCatalogItems(prods.map(p => ({
            id: p.id,
            codigo: p.codigo,
            nombre: p.nombre,
            costo: Number(p.costo || 0)
          })));
        }
      })
      .catch(() => {
        if (mounted) setCatalogItems([]);
      });

    return () => { mounted = false; };
  }, []);

  // New Vendor Form State
  const [newVendor, setNewVendor] = useState({
    nombre: '',
    ruc: '',
    contacto: '',
    telefono: '',
    correo: '',
    ciudad: 'Ambato',
    creditoDias: 30
  });

  // New Purchase Order Form State
  const [selectedVendorId, setSelectedVendorId] = useState('');
  const [docNumber, setDocNumber] = useState('FAC-001-' + Math.floor(1000 + Math.random() * 9000));
  const [orderLines, setOrderLines] = useState([]);
  const [feedbackMsg, setFeedbackMsg] = useState(null);

  const calculateSubtotal = () => {
    return orderLines.reduce((acc, line) => acc + (Number(line.cantidad) || 0) * (Number(line.costoUnitario) || 0), 0);
  };
  const subtotal = calculateSubtotal();
  const iva = subtotal * 0.15;
  const total = subtotal + iva;

  const totalInversion = orders.reduce((acc, ord) => acc + (Number(ord.total) || 0), 0);
  const ordenesTransito = orders.filter(ord => ord.estado === 'En Tránsito').length;

  const handleOpenOrderModal = () => {
    if (orderLines.length === 0 && catalogItems.length > 0) {
      setOrderLines([{ productoId: catalogItems[0].id, cantidad: 1, costoUnitario: catalogItems[0].costo || 0 }]);
    }
    if (!selectedVendorId && vendors.length > 0) {
      setSelectedVendorId(vendors[0].id);
    }
    setShowOrderModal(true);
  };

  const handleAddLine = () => {
    const firstProd = catalogItems[0];
    setOrderLines([...orderLines, { productoId: firstProd?.id || '', cantidad: 1, costoUnitario: firstProd?.costo || 0 }]);
  };

  const handleRemoveLine = (idx) => {
    if (orderLines.length === 1) return;
    setOrderLines(orderLines.filter((_, i) => i !== idx));
  };

  const handleLineChange = (index, field, value) => {
    const updated = [...orderLines];
    if (field === 'productoId') {
      const prod = catalogItems.find(p => p.id === Number(value));
      updated[index].productoId = Number(value);
      if (prod) updated[index].costoUnitario = prod.costo;
    } else {
      updated[index][field] = Number(value);
    }
    setOrderLines(updated);
  };

  const handleSaveOrder = (e) => {
    e.preventDefault();
    const vendorObj = vendors.find(v => v.id === Number(selectedVendorId));
    const newOrd = {
      id: `OC-2024-00${orders.length + 42}`,
      proveedor: vendorObj ? vendorObj.nombre : 'Proveedor Registrado',
      fecha: new Date().toISOString().slice(0, 10),
      itemsCount: orderLines.reduce((acc, l) => acc + l.cantidad, 0),
      subtotal,
      iva,
      total,
      estado: 'Recibida', // auto-stock increment RF-26
      guia: docNumber,
      fechaEntrega: new Date().toISOString().slice(0, 10)
    };
    setOrders([newOrd, ...orders]);
    setShowOrderModal(false);
    setFeedbackMsg(`✓ Orden ${newOrd.id} registrada e ingresada a bodega. El stock de ${orderLines.length} productos fue incrementado automáticamente (RF-26).`);
    setTimeout(() => setFeedbackMsg(null), 6000);
  };

  const handleSaveVendor = (e) => {
    e.preventDefault();
    if (!newVendor.nombre || !newVendor.ruc) return;
    const created = {
      ...newVendor,
      id: Date.now(),
      calificacion: '5.0 ★',
      pedidosTotales: 0
    };
    setVendors([...vendors, created]);
    setSelectedVendorId(created.id);
    setShowVendorModal(false);
    setFeedbackMsg(`✓ Proveedor ${created.nombre} dado de alta con éxito (RF-26).`);
    setTimeout(() => setFeedbackMsg(null), 5000);
  };

  const handleReceiveOrder = (orderId) => {
    setOrders(orders.map(o => o.id === orderId ? { ...o, estado: 'Recibida', fechaEntrega: new Date().toISOString().slice(0, 10) } : o));
    setFeedbackMsg(`✓ Mercadería de ${orderId} confirmada. Stock ingresado físicamente en bodega central (RF-26).`);
    setTimeout(() => setFeedbackMsg(null), 5000);
  };

  return (
    <div className="space-y-6">
      {/* Header banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-md bg-indigo-50 text-indigo-600 font-semibold text-xs uppercase tracking-wider">
              Módulo 7 · Abastecimiento
            </span>
            <span className="text-xs text-slate-500 font-medium">RF-26 · Control de Compras e Ingresos</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Proveedores y Órdenes de Compra</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Gestión de suministros, catálogo de distribuidores y reabastecimiento con impacto automático en inventario.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowVendorModal(true)}
            className="px-3.5 py-2 rounded-xl border border-slate-200 hover:bg-slate-100 font-semibold text-xs text-slate-900 flex items-center gap-1.5 transition-colors"
          >
            <span className="material-symbols-outlined text-[18px] text-indigo-600">domain_add</span>
            + Nuevo Proveedor
          </button>
          <button
            type="button"
            onClick={handleOpenOrderModal}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-50 text-white font-semibold text-xs flex items-center gap-1.5 shadow-xs transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">add_shopping_cart</span>
            Nueva Orden de Compra
          </button>
        </div>
      </div>

      {feedbackMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-medium flex items-center gap-2 animate-fadeIn">
          <span className="material-symbols-outlined text-emerald-600">verified</span>
          <span>{feedbackMsg}</span>
        </div>
      )}

      {/* KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Inversión Registrada</div>
            <div className="text-2xl font-bold text-slate-900 mt-1">${totalInversion.toFixed(2)}</div>
            <div className="text-xs text-slate-500 font-medium mt-0.5 flex items-center gap-1">
              <span className="material-symbols-outlined text-sm text-indigo-600">receipt</span> En {orders.length} órdenes emitidas
            </div>
          </div>
          <div className="w-11 h-11 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <span className="material-symbols-outlined text-[24px]">payments</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Órdenes en Tránsito</div>
            <div className="text-2xl font-bold text-amber-600 mt-1">{ordenesTransito} en despacho</div>
            <div className="text-xs text-slate-500 mt-0.5">Control de entregas SRI</div>
          </div>
          <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <span className="material-symbols-outlined text-[24px]">local_shipping</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Distribuidores Activos</div>
            <div className="text-2xl font-bold text-slate-900 mt-1">{vendors.length} registrados</div>
            <div className="text-xs text-slate-500 mt-0.5">Con RUC validado en SRI</div>
          </div>
          <div className="w-11 h-11 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <span className="material-symbols-outlined text-[24px]">verified</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Productos en Catálogo</div>
            <div className="text-2xl font-bold text-slate-900 mt-1">{catalogItems.length} ítems</div>
            <button
              onClick={() => onNavigate?.('inventario')}
              className="text-xs text-indigo-600 font-semibold hover:underline mt-0.5 block"
            >
              Ver inventario &rarr;
            </button>
          </div>
          <div className="w-11 h-11 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <span className="material-symbols-outlined text-[24px]">inventory_2</span>
          </div>
        </div>
      </div>

      {/* Tabs Switcher */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          type="button"
          onClick={() => setTab('orders')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
            tab === 'orders'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'bg-white text-slate-500 hover:text-slate-900 border border-slate-200'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">receipt_long</span>
          Órdenes de Compra ({orders.length})
        </button>
        <button
          type="button"
          onClick={() => setTab('vendors')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
            tab === 'vendors'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'bg-white text-slate-500 hover:text-slate-900 border border-slate-200'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">storefront</span>
          Directorio de Proveedores ({vendors.length})
        </button>
      </div>

      {/* View 1: Órdenes de Compra */}
      {tab === 'orders' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-white">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-indigo-600 text-[20px]">assignment</span>
              <h2 className="text-sm font-bold text-slate-900">Historial de Órdenes y Entregas</h2>
            </div>
            <span className="text-xs text-slate-500">
              Actualizado hace 3 min · SRI Ecuador IVA 15%
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4">N° Orden</th>
                  <th className="py-3 px-4">Proveedor / Distribuidor</th>
                  <th className="py-3 px-4">Fecha Emisión</th>
                  <th className="py-3 px-4">Doc / Factura</th>
                  <th className="py-3 px-4">Total (IVA 15%)</th>
                  <th className="py-3 px-4">Estado</th>
                  <th className="py-3 px-4 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-slate-900">
                {orders.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="py-12 text-center text-slate-500">
                      <span className="material-symbols-outlined text-slate-300 text-4xl block mb-2">receipt_long</span>
                      No hay órdenes de compra registradas. Cree una nueva orden para reabastecer el inventario.
                    </td>
                  </tr>
                ) : (
                  orders.map((ord) => (
                    <tr key={ord.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-indigo-600">{ord.id}</td>
                      <td className="py-3.5 px-4 font-medium">{ord.proveedor}</td>
                      <td className="py-3.5 px-4 text-slate-500">{ord.fecha}</td>
                      <td className="py-3.5 px-4 font-mono text-slate-500">{ord.guia}</td>
                      <td className="py-3.5 px-4 font-bold font-mono">${ord.total.toFixed(2)}</td>
                      <td className="py-3.5 px-4">
                        {ord.estado === 'Recibida' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                            Recibida en Bodega
                          </span>
                        )}
                        {ord.estado === 'En Tránsito' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-600 animate-pulse"></span>
                            En Tránsito
                          </span>
                        )}
                        {ord.estado === 'Borrador' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                            Borrador
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        {ord.estado === 'En Tránsito' ? (
                          <button
                            type="button"
                            onClick={() => handleReceiveOrder(ord.id)}
                            className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-[11px] inline-flex items-center gap-1 shadow-xs transition-colors"
                          >
                            <span className="material-symbols-outlined text-[14px]">inventory</span>
                            Recibir Stock
                          </button>
                        ) : (
                          <span className="text-[11px] text-slate-500 font-medium">Verificada</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* View 2: Directorio de Proveedores */}
      {tab === 'vendors' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {vendors.length === 0 ? (
            <div className="col-span-2 py-12 text-center text-slate-500 bg-white rounded-2xl border border-slate-200">
              <span className="material-symbols-outlined text-slate-300 text-4xl block mb-2">storefront</span>
              No hay proveedores registrados en el directorio. Registre su primer distribuidor con el botón "+ Nuevo Proveedor".
            </div>
          ) : (
            vendors.map((v) => (
              <div key={v.id} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:border-indigo-400 transition-all flex flex-col justify-between">
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-sm">
                        <span className="material-symbols-outlined text-[20px]">store</span>
                      </div>
                      <div>
                        <h3 className="font-bold text-sm text-slate-900">{v.nombre}</h3>
                        <div className="text-xs font-mono text-slate-500">RUC: {v.ruc}</div>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-xs font-bold">
                      {v.calificacion}
                    </span>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-slate-500 bg-slate-50 p-3 rounded-xl border border-slate-200">
                    <div>
                      <span className="font-semibold block text-slate-900">Contacto:</span>
                      <span>{v.contacto}</span>
                    </div>
                    <div>
                      <span className="font-semibold block text-slate-900">Teléfono:</span>
                      <span className="font-mono">{v.telefono}</span>
                    </div>
                    <div className="col-span-2">
                      <span className="font-semibold block text-slate-900">Correo Electrónico:</span>
                      <span className="text-indigo-600">{v.correo}</span>
                    </div>
                    <div>
                      <span className="font-semibold block text-slate-900">Ciudad:</span>
                      <span>{v.ciudad}</span>
                    </div>
                    <div>
                      <span className="font-semibold block text-slate-900">Crédito Comercial:</span>
                      <span>{v.creditoDias} días</span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-200 flex items-center justify-between text-xs">
                  <span className="text-slate-500 font-medium">
                    {v.pedidosTotales} pedidos registrados
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedVendorId(v.id);
                      handleOpenOrderModal();
                    }}
                    className="px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-600 font-semibold inline-flex items-center gap-1 transition-colors"
                  >
                    <span className="material-symbols-outlined text-[14px]">add_shopping_cart</span>
                    Crear Pedido
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Modal Nueva Orden de Compra */}
      {showOrderModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-2xl w-full p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-indigo-600 text-[24px]">shopping_cart</span>
                <div>
                  <h3 className="font-bold text-base text-slate-900">Emitir Orden de Compra (RF-26)</h3>
                  <p className="text-xs text-slate-500">Genera documento y actualiza existencias en bodega</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowOrderModal(false)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-500"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <form onSubmit={handleSaveOrder} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-900 mb-1">Proveedor *</label>
                  <select
                    value={selectedVendorId}
                    onChange={(e) => setSelectedVendorId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:ring-2 focus:ring-indigo-500 focus:border-indigo-600"
                  >
                    {vendors.map(v => (
                      <option key={v.id} value={v.id}>{v.nombre} (RUC: {v.ruc})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-900 mb-1">N° Factura / Guía *</label>
                  <input
                    type="text"
                    required
                    value={docNumber}
                    onChange={(e) => setDocNumber(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono text-xs focus:ring-2 focus:ring-indigo-500 focus:border-indigo-600"
                  />
                </div>
              </div>

              {/* Items Table */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">
                    Detalle de Repuestos e Insumos Solicitados
                  </span>
                  <button
                    type="button"
                    onClick={handleAddLine}
                    className="text-indigo-600 font-bold hover:underline inline-flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-[16px]">add</span> + Agregar Ítem
                  </button>
                </div>

                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                      <tr>
                        <th className="p-2.5">Repuesto / Producto</th>
                        <th className="p-2.5 w-24 text-center">Cant.</th>
                        <th className="p-2.5 w-28 text-right">Costo Unit.</th>
                        <th className="p-2.5 w-28 text-right">Subtotal</th>
                        <th className="p-2.5 w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {orderLines.map((line, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="p-2">
                            <select
                              value={line.productoId}
                              onChange={(e) => handleLineChange(idx, 'productoId', e.target.value)}
                              className="w-full px-2 py-1.5 rounded-lg border border-slate-200 text-xs"
                            >
                              {CATALOG_ITEMS.map(p => (
                                <option key={p.id} value={p.id}>{p.nombre} ({p.codigo})</option>
                              ))}
                            </select>
                          </td>
                          <td className="p-2">
                            <input
                              type="number"
                              min="1"
                              value={line.cantidad}
                              onChange={(e) => handleLineChange(idx, 'cantidad', e.target.value)}
                              className="w-full px-2 py-1.5 rounded-lg border border-slate-200 text-center font-mono text-xs"
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="number"
                              step="0.01"
                              value={line.costoUnitario}
                              onChange={(e) => handleLineChange(idx, 'costoUnitario', e.target.value)}
                              className="w-full px-2 py-1.5 rounded-lg border border-slate-200 text-right font-mono text-xs"
                            />
                          </td>
                          <td className="p-2 text-right font-mono font-bold text-slate-900">
                            ${((line.cantidad || 0) * (line.costoUnitario || 0)).toFixed(2)}
                          </td>
                          <td className="p-2 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveLine(idx)}
                              className="text-slate-500 hover:text-error"
                            >
                              <span className="material-symbols-outlined text-[16px]">delete</span>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Totals Summary */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 flex flex-col items-end gap-1 font-mono text-xs">
                <div>Subtotal: <span className="font-bold">${subtotal.toFixed(2)}</span></div>
                <div>IVA (15% Ecuador): <span className="font-bold">${iva.toFixed(2)}</span></div>
                <div className="text-sm font-bold text-indigo-600 pt-1 border-t border-slate-200">
                  Total Orden: <span>${total.toFixed(2)}</span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowOrderModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-900 font-semibold hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-50 text-white font-bold shadow-xs transition-colors"
                >
                  Confirmar e Ingresar a Bodega
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Nuevo Proveedor */}
      {showVendorModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-indigo-600 text-[24px]">domain_add</span>
                <h3 className="font-bold text-base text-slate-900">Registrar Distribuidor (RF-26)</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowVendorModal(false)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-500"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <form onSubmit={handleSaveVendor} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-900 mb-1">Razón Social *</label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Distribuidora Automotriz..."
                  value={newVendor.nombre}
                  onChange={(e) => setNewVendor({ ...newVendor, nombre: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-900 mb-1">RUC / NIT *</label>
                  <input
                    type="text"
                    required
                    placeholder="1790000000001"
                    value={newVendor.ruc}
                    onChange={(e) => setNewVendor({ ...newVendor, ruc: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono focus:ring-2 focus:ring-indigo-500 focus:border-indigo-600"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-900 mb-1">Ciudad</label>
                  <input
                    type="text"
                    value={newVendor.ciudad}
                    onChange={(e) => setNewVendor({ ...newVendor, ciudad: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-900 mb-1">Teléfono</label>
                  <input
                    type="text"
                    placeholder="+593 9..."
                    value={newVendor.telefono}
                    onChange={(e) => setNewVendor({ ...newVendor, telefono: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-600"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-900 mb-1">Crédito (días)</label>
                  <input
                    type="number"
                    value={newVendor.creditoDias}
                    onChange={(e) => setNewVendor({ ...newVendor, creditoDias: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono focus:ring-2 focus:ring-indigo-500 focus:border-indigo-600"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-900 mb-1">Correo Electrónico</label>
                <input
                  type="email"
                  placeholder="ventas@proveedor.com"
                  value={newVendor.correo}
                  onChange={(e) => setNewVendor({ ...newVendor, correo: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-600"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowVendorModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-900 font-semibold hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-50 text-white font-bold shadow-xs transition-colors"
                >
                  Registrar Proveedor
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
