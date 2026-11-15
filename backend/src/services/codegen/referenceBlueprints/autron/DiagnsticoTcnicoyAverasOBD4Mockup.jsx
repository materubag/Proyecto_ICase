import React, { useState, useEffect, useRef } from 'react';
import apiClient from '../../api/client';

// Catálogo extenso de códigos de avería OBD-II (Powertrain, Chassis, Body, Network)
const OBD_DICTIONARY = {
  P0345: {
    code: 'P0345',
    title: 'Sensor de posición del árbol de levas "A" (Banco 2) - Falla de circuito',
    system: 'Sistema de Encendido, Sincronismo y Distribución',
    component: 'Sensor CMP Banco 2 / Cableado / Distribución',
    zone: 'motor',
    defaultSeverity: 'alta'
  },
  P0340: {
    code: 'P0340',
    title: 'Sensor de posición del árbol de levas "A" (Banco 1) - Circuito defectuoso',
    system: 'Sistema de Encendido y Sincronismo',
    component: 'Sensor CMP Banco 1 / Conector',
    zone: 'motor',
    defaultSeverity: 'alta'
  },
  P0335: {
    code: 'P0335',
    title: 'Sensor de posición del cigüeñal "A" (CKP) - Circuito defectuoso',
    system: 'Sistema de Encendido e Ignición',
    component: 'Sensor CKP Cigüeñal',
    zone: 'motor',
    defaultSeverity: 'critica'
  },
  P0300: {
    code: 'P0300',
    title: 'Fallo de encendido detectado en cilindros múltiples o aleatorios',
    system: 'Sistema de Encendido e Inyección',
    component: 'Bujías / Inyectores / Presión de Riel',
    zone: 'motor',
    defaultSeverity: 'alta'
  },
  P0301: {
    code: 'P0301',
    title: 'Fallo de encendido detectado en el cilindro 1',
    system: 'Sistema de Encendido e Inyección',
    component: 'Bobina de Ignición / Bujía Cilindro 1',
    zone: 'motor',
    defaultSeverity: 'alta'
  },
  P0302: {
    code: 'P0302',
    title: 'Fallo de encendido detectado en el cilindro 2',
    system: 'Sistema de Encendido e Inyección',
    component: 'Bobina de Ignición / Bujía Cilindro 2',
    zone: 'motor',
    defaultSeverity: 'alta'
  },
  P0303: {
    code: 'P0303',
    title: 'Fallo de encendido detectado en el cilindro 3',
    system: 'Sistema de Encendido e Inyección',
    component: 'Bobina de Ignición / Bujía Cilindro 3',
    zone: 'motor',
    defaultSeverity: 'alta'
  },
  P0304: {
    code: 'P0304',
    title: 'Fallo de encendido detectado en el cilindro 4',
    system: 'Sistema de Encendido e Inyección',
    component: 'Bobina de Ignición / Bujía Cilindro 4',
    zone: 'motor',
    defaultSeverity: 'alta'
  },
  P0420: {
    code: 'P0420',
    title: 'Eficiencia del sistema catalítico por debajo del umbral (Banco 1)',
    system: 'Sistema de Emisiones y Escape',
    component: 'Convertidor Catalítico / Sensor O2 Posterior',
    zone: 'escape',
    defaultSeverity: 'media'
  },
  P0171: {
    code: 'P0171',
    title: 'Sistema de combustible demasiado pobre (Banco 1)',
    system: 'Admisión y Alimentación de Combustible',
    component: 'Sensor MAF / Fuga de vacío en admisión',
    zone: 'motor',
    defaultSeverity: 'media'
  },
  P0172: {
    code: 'P0172',
    title: 'Sistema de combustible demasiado rico (Banco 1)',
    system: 'Inyección y Alimentación de Combustible',
    component: 'Inyectores con fuga / Regulador de Presión',
    zone: 'motor',
    defaultSeverity: 'media'
  },
  P0102: {
    code: 'P0102',
    title: 'Sensor de flujo de masa de aire (MAF) - Señal de entrada baja',
    system: 'Admisión y Sensores de Aire',
    component: 'Sensor MAF sucio o averiado',
    zone: 'motor',
    defaultSeverity: 'media'
  },
  P0113: {
    code: 'P0113',
    title: 'Sensor de temperatura de aire de admisión (IAT) - Entrada alta',
    system: 'Admisión y Termometría',
    component: 'Sensor IAT',
    zone: 'motor',
    defaultSeverity: 'baja'
  },
  P0128: {
    code: 'P0128',
    title: 'Termostato de refrigerante - Temperatura de motor por debajo de rango',
    system: 'Sistema de Enfriamiento y Termostato',
    component: 'Termostato atascado abierto / Sensor ECT',
    zone: 'motor',
    defaultSeverity: 'media'
  },
  P0500: {
    code: 'P0500',
    title: 'Sensor de velocidad del vehículo (VSS) - Mal funcionamiento',
    system: 'Transmisión y Medición de Velocidad',
    component: 'Sensor VSS / Cableado hacia velocímetro',
    zone: 'transmision',
    defaultSeverity: 'media'
  },
  P0700: {
    code: 'P0700',
    title: 'Sistema de control de transmisión (TCM) - Avería solicitada',
    system: 'Transmisión Automática y Solenoides',
    component: 'Módulo de Transmisión TCM / Solenoide de cambio',
    zone: 'transmision',
    defaultSeverity: 'alta'
  },
  C0035: {
    code: 'C0035',
    title: 'Sensor de velocidad de rueda delantera izquierda (ABS)',
    system: 'Frenos ABS y Control de Tracción',
    component: 'Sensor ABS Rueda Delantera / Anillo fónico',
    zone: 'frenosDelanteros',
    defaultSeverity: 'alta'
  },
  B0001: {
    code: 'B0001',
    title: 'Circuito de control de despliegue de airbag del conductor',
    system: 'Habitáculo y Seguridad Pasiva (SRS)',
    component: 'Módulo Airbag / Resorte espiral en volante',
    zone: 'habitaculo',
    defaultSeverity: 'alta'
  },
  U0100: {
    code: 'U0100',
    title: 'Pérdida de comunicación con el módulo de control del motor (ECM)',
    system: 'Red de Comunicación CAN-Bus',
    component: 'Línea de Bus CAN / Módulo ECM Central',
    zone: 'habitaculo',
    defaultSeverity: 'critica'
  }
};

export default function DiagnsticoTcnicoyAverasOBD4Mockup({ onNavigate }) {
  const fileInputRef = useRef(null);

  // Normalizador automático: corrige "PO" -> "P0" (letra O por cero) y mayúsculas
  const normalizeObdInput = (val) => {
    if (!val) return '';
    let code = val.toUpperCase().trim();
    if (code.startsWith('PO')) code = 'P0' + code.slice(2);
    return code;
  };

  const [vehicles, setVehicles] = useState([]);
  const [selectedPlate, setSelectedPlate] = useState('');

  const [observations, setObservations] = useState('');

  // Sincronizar automáticamente con la base de datos y nuevas recepciones
  useEffect(() => {
    let mounted = true;

    const loadBackendVehicles = () => {
      Promise.all([
        apiClient.get('/vehiculos').catch(() => []),
        apiClient.get('/clientes').catch(() => []),
        apiClient.get('/recepciones').catch(() => []),
        apiClient.get('/workshop-flow/asignaciones').catch(() => [])
      ]).then(([vRes, cRes, rRes, aRes]) => {
        if (!mounted) return;
        const vList = Array.isArray(vRes) ? vRes : (vRes?.data || []);
        const cList = Array.isArray(cRes) ? cRes : (cRes?.data || []);
        const rList = Array.isArray(rRes) ? rRes : (rRes?.data || []);

        if (vList && vList.length > 0) {
          const sessionUser = JSON.parse(localStorage.getItem('user') || 'null');
          const isMechanic = sessionUser?.role === 'Mecánico' || sessionUser?.rol === 'Mecánico';
          const assignments = Array.isArray(aRes) ? aRes : (aRes?.data || []);
          let mappedVehicles = vList.map(v => {
            const owner = cList.find(c => Number(c.id) === Number(v.clienteId || v.cliente_id));
            const rec = rList.filter(r => Number(r.vehiculoId || r.vehiculo_id) === Number(v.id)).pop();
            return {
              id: v.id,
              recepcionId: rec ? rec.id : null,
              orderId: rec ? `REC-${String(rec.id).padStart(3, '0')}` : `VEH-${String(v.id).padStart(3, '0')}`,
              clienteId: v.clienteId || null,
              clienteNombre: owner ? owner.nombre : 'Sin cliente',
              placa: v.placa,
              marca: v.marca || 'Vehículo',
              modelo: v.modelo || 'Modelo',
              anio: v.anio || 2020,
              color: v.color || 'Gris',
              motor: '1.6L 16V / DOHC',
              kilometrajeActual: rec?.kilometraje || v.kilometrajeActual || 0,
              bahia: 'Bahía Diagnóstico OBD',
              motivo: rec?.motivoIngreso || 'Ingreso pericial para diagnóstico',
              observacionesRecepcion: rec?.observaciones || ''
            };
          });
          if (isMechanic) {
            const allowed = new Set(assignments.map((item) => Number(item.vehiculoId)));
            mappedVehicles = mappedVehicles
              .filter((vehicle) => allowed.has(Number(vehicle.id)))
              .map((vehicle) => {
                const assignment = assignments.find((item) => Number(item.vehiculoId) === Number(vehicle.id));
                return assignment ? { ...vehicle, recepcionId: assignment.recepcionId } : vehicle;
              });
          }

          mappedVehicles = mappedVehicles.filter((vehicle) => vehicle.recepcionId);
          const remembered = localStorage.getItem('autron_selected_diagnosis_plate');
          const activePlate = (remembered && mappedVehicles.some((v) => v.placa === remembered) ? remembered : null) ||
            mappedVehicles[0]?.placa;

          setVehicles(mappedVehicles);
          if (mappedVehicles.length === 0) {
            setSelectedPlate('');
            setObservations('');
            localStorage.removeItem('autron_active_reception');
            localStorage.removeItem('autron_selected_diagnosis_plate');
            return;
          }

          if (activePlate && mappedVehicles.some(v => v.placa === activePlate)) {
            setSelectedPlate(activePlate);
            const veh = mappedVehicles.find(v => v.placa === activePlate);
            if (veh && veh.motivo) {
              setObservations(
                `[Ingreso ${veh.orderId}] Motivo: ${veh.motivo}. ` +
                (veh.observacionesRecepcion ? `Observaciones previas: ${veh.observacionesRecepcion}. ` : '') +
                'Inspección pericial y scanner OBD-II en curso.'
              );
            }
          }
        } else {
          setVehicles([]);
          setSelectedPlate('');
          setObservations('');
          localStorage.removeItem('autron_active_reception');
          localStorage.removeItem('autron_selected_diagnosis_plate');
        }
      });
    };

    loadBackendVehicles();

    const syncReception = () => {
      loadBackendVehicles();
    };

    syncReception();
    window.addEventListener('autron:new_reception', syncReception);
    window.addEventListener('autron:new_vehicle', loadBackendVehicles);
    window.addEventListener('storage', syncReception);
    return () => {
      mounted = false;
      window.removeEventListener('autron:new_reception', syncReception);
      window.removeEventListener('autron:new_vehicle', loadBackendVehicles);
      window.removeEventListener('storage', syncReception);
    };
  }, []);

  const currentVehicle = vehicles.find(v => v.placa === selectedPlate) || vehicles[0] || {
    placa: '—', orderId: 'SIN-ASIGNACION', clienteNombre: 'Sin vehículo asignado', motor: '—', anio: '', kilometrajeActual: 0, id: null, recepcionId: null
  };

  // Input libre de Código OBD-II (por defecto PO345 / P0345)
  const [inputCode, setInputCode] = useState('');
  const [customTitle, setCustomTitle] = useState('');
  const [customSystem, setCustomSystem] = useState('');
  const [customComponent, setCustomComponent] = useState('');
  const [severity, setSeverity] = useState('alta');
  const [affectedZone, setAffectedZone] = useState('motor');
  const [registeredDtcCodes, setRegisteredDtcCodes] = useState([]);

  // Mapa interactivo de zonas del vehículo (RF-10)
  const [zones, setZones] = useState({
    motor: { id: 'motor', name: 'Motor e Ignición', state: 'normal', detail: '' },
    frenosDelanteros: { id: 'frenosDelanteros', name: 'Eje Delantero y Frenos', state: 'normal', detail: '' },
    transmision: { id: 'transmision', name: 'Transmisión / Caja', state: 'normal', detail: '' },
    habitaculo: { id: 'habitaculo', name: 'Habitáculo y Sensores', state: 'normal', detail: '' },
    suspensionTrasera: { id: 'suspensionTrasera', name: 'Eje Trasero y Suspensión', state: 'normal', detail: '' },
    escape: { id: 'escape', name: 'Escape y Catalizador', state: 'normal', detail: '' }
  });

  const [activeZone, setActiveZone] = useState('motor');

  // Evidencias fotográficas reales (permite subir desde la cámara o disco local)
  const [evidences, setEvidences] = useState([]);

  const [lightboxPhoto, setLightboxPhoto] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [serviceCatalog, setServiceCatalog] = useState([]);
  const [partCatalog, setPartCatalog] = useState([]);
  const [quoteLines, setQuoteLines] = useState([]);
  const [serviceToAdd, setServiceToAdd] = useState('');
  const [partToAdd, setPartToAdd] = useState('');

  useEffect(() => {
    let mounted = true;
    Promise.all([
      apiClient.get('/servicios').catch(() => []),
      apiClient.get('/productos').catch(() => [])
    ]).then(([servicesRes, partsRes]) => {
      if (!mounted) return;
      const services = Array.isArray(servicesRes) ? servicesRes : (servicesRes?.data || []);
      const parts = Array.isArray(partsRes) ? partsRes : (partsRes?.data || []);
      setServiceCatalog(services);
      setPartCatalog(parts);
      if (services[0]) setServiceToAdd(String(services[0].id));
      if (parts[0]) setPartToAdd(String(parts[0].id));
    });
    return () => { mounted = false; };
  }, []);

  const addQuoteLine = (tipoItem, elementoId) => {
    const id = Number(elementoId);
    if (!id) return;
    const source = tipoItem === 'SERVICIO'
      ? serviceCatalog.find((item) => Number(item.id) === id)
      : partCatalog.find((item) => Number(item.id) === id);
    if (!source) return;
    setQuoteLines((current) => {
      const existing = current.find((line) => line.tipoItem === tipoItem && Number(line.elementoId) === id);
      if (existing) {
        return current.map((line) => line === existing ? { ...line, cantidad: Number(line.cantidad) + 1 } : line);
      }
      return [...current, {
        tipoItem,
        elementoId: id,
        nombre: source.nombre,
        precio: Number(tipoItem === 'SERVICIO' ? source.precioManoObra : source.precio) || 0,
        cantidad: 1
      }];
    });
  };
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Escuchar cambios en el input de código OBD-II
  const handleCodeChange = (val) => {
    setInputCode(val.toUpperCase());
    const clean = normalizeObdInput(val);
    const found = OBD_DICTIONARY[clean];

    if (found) {
      setCustomTitle(found.title);
      setCustomSystem(found.system);
      setCustomComponent(found.component);
      if (found.zone) setAffectedZone(found.zone);
      if (found.defaultSeverity) setSeverity(found.defaultSeverity);
    }
  };

  // Agregar código a la lista de averías del vehículo
  const handleAddDtcCode = () => {
    const clean = normalizeObdInput(inputCode);
    const title = customTitle.trim();
    if (!title) return;

    const newCode = {
      id: Date.now(),
      code: clean,
      title,
      system: customSystem.trim() || 'Inspección',
      component: customComponent.trim() || zones[affectedZone]?.name || 'Zona del vehículo',
      severity: severity,
      zone: affectedZone
    };

    setRegisteredDtcCodes(prev => [newCode, ...prev]);

    // Actualizar automáticamente la zona en el mapa 2D
    if (affectedZone && zones[affectedZone]) {
      const stateMap = {
        critica: 'falla_critica',
        alta: 'falla',
        media: 'revision',
        baja: 'revision'
      };
      setZones(prev => ({
        ...prev,
        [affectedZone]: {
          ...prev[affectedZone],
          state: stateMap[severity] || 'falla',
          detail: newCode.title
        }
      }));
      setActiveZone(affectedZone);
    }

    // Resetear campo para ingresar otro código si se desea
    setInputCode('');
    setCustomTitle('');
    setCustomSystem('');
    setCustomComponent('');
  };

  const handleRemoveDtcCode = (id) => {
    setRegisteredDtcCodes(prev => prev.filter(c => c.id !== id));
  };

  // Subida Real de Archivos (Fotos del Scanner, Motor, o Averías)
  const handleFileSelect = (filesList) => {
    const files = Array.from(filesList || []);
    if (files.length === 0) return;

    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target.result;
        const sizeFormatted = file.size > 1024 * 1024
          ? (file.size / (1024 * 1024)).toFixed(1) + ' MB'
          : (file.size / 1024).toFixed(0) + ' KB';

        setEvidences(prev => [
          ...prev,
          {
            id: Date.now() + Math.random(),
            name: file.name,
            size: sizeFormatted,
            tag: 'EVIDENCIA TALLER',
            url: dataUrl,
            file: file,
            uploadedAt: new Date().toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' })
          }
        ]);
      };
      reader.readAsDataURL(file);
    });

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer?.files?.length > 0) {
      handleFileSelect(e.dataTransfer.files);
    }
  };

  const handleRemovePhoto = (id) => {
    setEvidences(evidences.filter(e => e.id !== id));
  };

  const cycleZoneState = (zoneKey) => {
    const states = ['normal', 'revision', 'falla', 'falla_critica'];
    const currentIdx = states.indexOf(zones[zoneKey].state);
    const nextState = states[(currentIdx + 1) % states.length];
    setZones(prev => ({
      ...prev,
      [zoneKey]: { ...prev[zoneKey], state: nextState }
    }));
  };

  const getZoneBadge = (state) => {
    switch (state) {
      case 'normal':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">Normal</span>;
      case 'revision':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">Revisión</span>;
      case 'falla':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-orange-100 text-orange-800 border border-orange-300">Falla</span>;
      case 'falla_critica':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-800 border border-red-300">Falla Crítica</span>;
      default:
        return null;
    }
  };

  const getZoneColorClass = (state) => {
    switch (state) {
      case 'normal': return 'bg-emerald-500/20 border-emerald-500 text-emerald-800';
      case 'revision': return 'bg-amber-500/20 border-amber-500 text-amber-800';
      case 'falla': return 'bg-orange-500/20 border-orange-500 text-orange-800';
      case 'falla_critica': return 'bg-red-500/25 border-red-600 text-red-900 animate-pulse';
      default: return 'bg-slate-100 border-slate-300 text-slate-800';
    }
  };

  const handleSaveDiagnosis = async () => {
    setSaving(true);
    setSavedSuccess(false);
    setSaveError('');
    if (!currentVehicle?.id || !currentVehicle?.recepcionId) {
      setSaveError('Este vehículo no tiene un ingreso asignado. Recepción debe registrarlo y asignarte.');
      setSaving(false);
      return;
    }
    if (quoteLines.length === 0) {
      setSaveError('Agrega los servicios y repuestos que irán en la cotización. El código OBD es opcional.');
      setSaving(false);
      return;
    }

    try {
      const archivoIds = [];
      for (const ev of evidences) {
        if (!ev.file) continue;
        const formData = new FormData();
        formData.append('file', ev.file);
        const uploaded = await apiClient.post('/upload', formData);
        if (uploaded?.archivoId) archivoIds.push(uploaded.archivoId);
      }

      const result = await apiClient.post('/workshop-flow/diagnostico', {
        vehiculoId: Number(currentVehicle.id),
        recepcionId: Number(currentVehicle.recepcionId),
        observaciones: observations,
        items: quoteLines.map((line) => ({
          tipoItem: line.tipoItem,
          elementoId: Number(line.elementoId),
          cantidad: Number(line.cantidad)
        })),
        zonas: Object.entries(zones).map(([zona, value]) => ({ zona, estado: value.state })),
        fallas: registeredDtcCodes.map((dtc) => ({
          zona: dtc.zone || 'motor',
          sistema: dtc.system || 'Sistema del vehículo',
          componente: dtc.component || 'Componente',
          descripcion: [dtc.code, dtc.title].filter(Boolean).join(': ').slice(0, 255),
          severidad: dtc.severity === 'critica' || dtc.severity === 'alta' ? 'ALTA' : (dtc.severity === 'baja' ? 'BAJA' : 'MEDIA')
        })),
        archivoIds
      });

      const diagRecord = {
        id: result.diagnosticoId,
        cotizacionId: result.cotizacionId,
        vehiculoId: Number(currentVehicle.id),
        placa: currentVehicle.placa,
        observaciones: observations,
        timestamp: Date.now()
      };
      localStorage.setItem('autron_active_diagnosis', JSON.stringify(diagRecord));
      setSavedSuccess(true);
    } catch (err) {
      setSaveError(err.details?.message || err.message || 'No se pudo enviar la cotización.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="w-full bg-slate-50 min-h-full pb-12">
      {/* Context Sub-header */}
      <section className="w-full bg-white border-b border-slate-200">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500 mb-1 font-medium">
              <span>Taller Central</span>
              <span className="material-symbols-outlined text-xs">chevron_right</span>
              <span>Mecánica & Bahía</span>
              <span className="material-symbols-outlined text-xs">chevron_right</span>
              <span className="text-indigo-600 font-semibold">Diagnóstico Técnico y Mapa Visual (RF-08 a RF-12)</span>
            </div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                Diagnóstico Técnico y Averías OBD-II
              </h1>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-indigo-50 border border-indigo-300 text-indigo-600 text-xs font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-ping"></span>
                {currentVehicle.orderId} · {currentVehicle.placa} · Diagnóstico en Curso
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Inspección del vehículo, mapa de zonas y cotización. El código de avería solo se agrega si el escáner lo reporta.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onNavigate?.('recepcion')}
              className="px-3 py-1.5 text-xs font-semibold bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-slate-900 flex items-center gap-1 cursor-pointer transition-colors"
            >
              <span className="material-symbols-outlined text-sm">arrow_back</span>
              Volver a Recepción
            </button>
            <button
              type="button"
              onClick={() => onNavigate?.('reparaciones')}
              className="px-3 py-1.5 text-xs font-semibold bg-indigo-50 hover:bg-indigo-100 text-indigo-600 border border-indigo-200 rounded-lg flex items-center gap-1 cursor-pointer transition-colors"
            >
              <span className="material-symbols-outlined text-sm">build</span>
              Ver Órdenes de Trabajo
            </button>
          </div>
        </div>
      </section>

      {/* Main Workspace: Form (7 cols) + 2D Interactive Map (5 cols) */}
      <main className="max-w-[1600px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {savedSuccess && (
          <div className="mb-6 p-4 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-900 flex items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-emerald-600 text-2xl">check_circle</span>
              <div>
                <strong className="block text-sm font-bold">Diagnóstico guardado y cotización enviada al cliente</strong>
                <span className="text-xs text-emerald-800">
                  El cliente puede aprobarla total o parcialmente. El trabajo empieza cuando esa aprobación quede registrada.
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onNavigate?.('reparaciones')}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer"
            >
              <span>Ir a Órdenes de Trabajo</span>
              <span className="material-symbols-outlined text-sm">arrow_forward</span>
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* LEFT COLUMN: Guided Technical Diagnostic Form (7 cols) */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 shadow-xs flex flex-col gap-5">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-bold">
                    1
                  </span>
                  <h2 className="text-base font-bold text-slate-900">Captura de Averías desde Scanner OBD-II</h2>
                </div>
                {/* Indicador realista: Captura manual / Scanner de taller */}
                <span className="text-xs text-sky-800 font-semibold flex items-center gap-1.5 bg-sky-50 px-2.5 py-1 rounded-lg border border-sky-200">
                  <span className="material-symbols-outlined text-sm text-sky-600">tune</span>
                  Entrada Manual / Scanner de Taller (Autel / Launch / Bosch)
                </span>
              </div>

              {/* Vehicle Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-900 mb-1">
                  Vehículo en Intervención <span className="text-error">*</span>
                </label>
                <select
                  value={selectedPlate}
                  onChange={e => {
                    const plate = e.target.value;
                    setSelectedPlate(plate);
                    const veh = vehicles.find(v => v.placa === plate);
                    if (veh && veh.motivo) {
                      setObservations(
                        `[Ingreso ${veh.orderId}] Motivo: ${veh.motivo}. ` +
                        (veh.observacionesRecepcion ? `Observaciones previas: ${veh.observacionesRecepcion}. ` : '') +
                        'Inspección pericial y scanner OBD-II en curso.'
                      );
                    }
                  }}
                  className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-900 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer"
                >
                  {vehicles.length === 0 && <option value="">No hay vehículos ingresados</option>}
                  {vehicles.map(v => (
                    <option key={v.placa} value={v.placa}>
                      {v.orderId} · {v.placa} · {v.marca} {v.modelo} ({Number(v.kilometrajeActual).toLocaleString()} km) · {v.clienteNombre} {v.isRecent ? '⭐ [RECIÉN INGRESADO]' : ''}
                    </option>
                  ))}
                </select>

                {/* Quick Vehicle Pill */}
                <div className="mt-2.5 bg-slate-50 rounded-lg p-3 border border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div>
                    <span className="text-slate-500 block text-[10px] uppercase font-semibold">Cliente</span>
                    <strong className="text-slate-900 font-semibold truncate block" title={currentVehicle.clienteNombre}>
                      {currentVehicle.clienteNombre}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px] uppercase font-semibold">Placa</span>
                    <strong className="text-indigo-600 font-mono font-bold">{currentVehicle.placa}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px] uppercase font-semibold">Motor / Año</span>
                    <strong className="text-slate-900 block truncate">{currentVehicle.motor} ({currentVehicle.anio})</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px] uppercase font-semibold">Odómetro / Bahía</span>
                    <strong className="text-indigo-600 font-medium">{Number(currentVehicle.kilometrajeActual).toLocaleString()} km</strong>
                  </div>
                </div>
              </div>

              {/* OBD-II Code Input with Free Typing (e.g. PO345, P0345) */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                  <label htmlFor="codigo-obd" className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-indigo-600 text-base">qr_code_scanner</span>
                    1. Elige la zona y escribe la avería encontrada
                  </label>
                  <button
                    type="button"
                    onClick={() => onNavigate?.('conocimiento')}
                    className="text-indigo-600 hover:underline text-xs font-semibold inline-flex items-center gap-1 cursor-pointer self-start sm:self-auto"
                  >
                    <span className="material-symbols-outlined text-sm">library_books</span>
                    Consultar Base de Códigos OBD
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                  <div className="sm:col-span-8">
                    <input
                      type="text"
                      value={customTitle}
                      onChange={e => setCustomTitle(e.target.value)}
                      placeholder="Qué encontraste. Ejemplo: pastillas gastadas en el eje delantero"
                      className="w-full h-10 px-3 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-900 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                  <div className="sm:col-span-4">
                    <div className="relative">
                      <input
                        id="codigo-obd"
                        type="text"
                        value={inputCode}
                        onChange={e => handleCodeChange(e.target.value)}
                        placeholder="Código OBD, opcional"
                        className="w-full h-10 px-3 bg-white border-2 border-indigo-400 rounded-lg font-mono font-bold text-sm tracking-wider uppercase text-slate-900 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                      {inputCode.startsWith('PO') && (
                        <span className="absolute right-2 top-2.5 text-[9px] bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded font-mono font-bold">
                          Autocorrige P0
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Sistema afectado, Componente y Zona */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">Sistema Afectado</label>
                    <input
                      type="text"
                      value={customSystem}
                      onChange={e => setCustomSystem(e.target.value)}
                      placeholder="ej: Ignición y Distribución"
                      className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 focus:border-indigo-600 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">Componente Primario</label>
                    <input
                      type="text"
                      value={customComponent}
                      onChange={e => setCustomComponent(e.target.value)}
                      placeholder="ej: Sensor CMP Banco 2"
                      className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 focus:border-indigo-600 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">Zona del vehículo</label>
                    <select
                      value={affectedZone}
                      onChange={e => setAffectedZone(e.target.value)}
                      className="w-full h-9 px-2 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-900 focus:border-indigo-600 outline-none cursor-pointer"
                    >
                      <option value="motor">1. Motor e Ignición</option>
                      <option value="frenosDelanteros">2. Eje Delantero y Frenos</option>
                      <option value="transmision">3. Transmisión / Caja</option>
                      <option value="habitaculo">4. Habitáculo y Sensores</option>
                      <option value="suspensionTrasera">5. Eje Trasero y Suspensión</option>
                      <option value="escape">6. Línea de Escape y Catalizador</option>
                    </select>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {[['normal', 'Normal'], ['revision', 'Revisión'], ['falla', 'Falla'], ['falla_critica', 'Falla crítica']].map(([state, label]) => (
                        <button
                          key={state}
                          type="button"
                          onClick={() => setZones((prev) => ({ ...prev, [affectedZone]: { ...prev[affectedZone], state } }))}
                          className={`px-2 py-1 rounded text-[10px] font-bold border ${zones[affectedZone]?.state === state ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white border-slate-200'}`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Severidad Selector & Botón Agregar */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                  <div className="flex items-center gap-1.5 w-full sm:w-auto">
                    <span className="text-[11px] font-bold text-slate-500 mr-1">Severidad:</span>
                    {[
                      { id: 'baja', label: 'Baja', color: 'bg-emerald-100 text-emerald-800' },
                      { id: 'media', label: 'Media', color: 'bg-amber-100 text-amber-800' },
                      { id: 'alta', label: 'Alta', color: 'bg-red-100 text-red-800' },
                      { id: 'critica', label: 'Crítica', color: 'bg-rose-200 text-rose-900 font-bold' }
                    ].map(lvl => (
                      <button
                        key={lvl.id}
                        type="button"
                        onClick={() => setSeverity(lvl.id)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                          severity === lvl.id
                            ? `${lvl.color} border-current ring-2 ring-indigo-500 shadow-2xs`
                            : 'bg-white text-slate-900 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        {lvl.label}
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={handleAddDtcCode}
                    disabled={!customTitle.trim()}
                    className="w-full sm:w-auto px-4 py-2 bg-indigo-600 hover:bg-indigo-50 text-white text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-sm">add_circle</span>
                    Agregar avería a la zona
                  </button>
                </div>
              </div>

              {/* Lista de Códigos DTC Registrados en el Vehículo */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-900">
                    Averías y Códigos Registrados ({registeredDtcCodes.length})
                  </span>
                  <span className="text-[11px] text-slate-500">
                    Impactan directamente en el mapa 2D y el presupuesto
                  </span>
                </div>

                {registeredDtcCodes.length === 0 ? (
                  <div className="p-4 rounded-xl border border-dashed border-slate-200 text-center text-xs text-slate-500">
                    Todavía no agregas averías. Elige la zona, escribe lo que encontraste y pulsa Agregar avería. El código OBD es opcional.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {registeredDtcCodes.map(item => (
                      <div
                        key={item.id}
                        className="p-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition-colors flex items-center justify-between gap-3 shadow-2xs"
                      >
                        <div className="flex items-center gap-3">
                          <span className="font-mono font-bold text-sm bg-indigo-50 text-indigo-600 border border-indigo-200 px-2 py-1 rounded-lg">
                            {item.code}
                          </span>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="text-xs font-bold text-slate-900">{item.title}</h4>
                              <span className={`px-1.5 py-0.5 rounded text-[10px] uppercase font-bold ${
                                item.severity === 'critica' ? 'bg-red-100 text-red-800' :
                                item.severity === 'alta' ? 'bg-orange-100 text-orange-800' :
                                'bg-amber-100 text-amber-800'
                              }`}>
                                {item.severity}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                              {item.system} · Componente: <strong className="text-slate-900">{item.component}</strong>
                            </p>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemoveDtcCode(item.id)}
                          className="w-8 h-8 rounded-lg hover:bg-error-container/20 text-error flex items-center justify-center transition-colors cursor-pointer"
                          title="Eliminar avería"
                        >
                          <span className="material-symbols-outlined text-base">delete</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Technician Observations */}
              <div>
                <label htmlFor="observacion-mecanico" className="block text-xs font-bold text-slate-900 mb-1">
                  Observaciones Técnicas y Diagnóstico Pericial <span className="text-error">*</span>
                </label>
                <textarea
                  id="observacion-mecanico"
                  rows={3}
                  value={observations}
                  onChange={e => setObservations(e.target.value)}
                  className="w-full p-3 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500 outline-none resize-y font-sans leading-relaxed"
                />
              </div>

              {/* Photographic Evidences with REAL FILE UPLOAD (RF-12) */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <label className="text-xs font-bold text-slate-900 block">
                      Fotografías y Evidencias Técnicas ({evidences.length} adjuntas)
                    </label>
                    <span className="text-[11px] text-slate-500">
                      Fotos de pantalla del scanner, piezas desgastadas o estado físico
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 text-xs font-bold rounded-lg inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-sm">add_a_photo</span>
                    + Subir Fotografías
                  </button>
                </div>

                {/* Input de archivo real oculto */}
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/png,image/jpeg,image/webp,image/jpg"
                  multiple
                  onChange={e => handleFileSelect(e.target.files)}
                  className="hidden"
                />

                {/* Zona Drag and Drop */}
                <div
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-colors mb-3 ${
                    isDragging
                      ? 'border-indigo-600 bg-indigo-50'
                      : 'border-slate-200 hover:border-indigo-600 bg-slate-50'
                  }`}
                >
                  <span className="material-symbols-outlined text-indigo-600 text-2xl mb-1">upload_file</span>
                  <p className="text-xs font-semibold text-slate-900">
                    Haz clic aquí o arrastra tus fotografías (.jpg, .png, .webp)
                  </p>
                  <span className="text-[11px] text-slate-500">
                    Puedes adjuntar capturas del scanner OBD, componentes o fotos del motor
                  </span>
                </div>

                {/* Galería de Fotografías */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {evidences.map(ev => (
                    <div
                      key={ev.id}
                      className="border border-slate-200 rounded-xl overflow-hidden bg-white flex flex-col group shadow-2xs"
                    >
                      <div
                        onClick={() => setLightboxPhoto(ev)}
                        className="h-32 w-full bg-slate-900 relative overflow-hidden cursor-zoom-in"
                        title="Clic para ampliar fotografía"
                      >
                        <img
                          src={ev.url}
                          alt={ev.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                        <span className="absolute bottom-1.5 left-1.5 px-2 py-0.5 bg-black/80 backdrop-blur-xs text-white text-[9px] font-mono font-bold rounded">
                          {ev.tag}
                        </span>
                        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white">
                          <span className="material-symbols-outlined text-2xl">zoom_in</span>
                        </div>
                      </div>

                      <div className="p-2.5 flex items-center justify-between bg-white border-t border-slate-200">
                        <div className="overflow-hidden">
                          <span className="text-[11px] font-bold text-slate-900 block truncate max-w-[130px]" title={ev.name}>
                            {ev.name}
                          </span>
                          <span className="text-[10px] text-slate-500 font-mono">
                            {ev.size || '1.0 MB'} · {ev.uploadedAt || 'Hoy'}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemovePhoto(ev.id);
                          }}
                          className="text-error hover:bg-error-container/30 p-1.5 rounded-lg transition-colors cursor-pointer"
                          title="Eliminar foto"
                        >
                          <span className="material-symbols-outlined text-base">delete</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: Interactive Vehicle Zones Map (RF-10) & Sticky Summary Rail (5 cols) */}
          <aside className="lg:col-span-5 flex flex-col gap-6 sticky top-20">
            {/* INTERACTIVE VEHICLE ZONES MAP CARD (RF-10) */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col gap-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-indigo-600 text-xl">directions_car</span>
                  <h2 className="text-sm font-bold text-slate-900">Mapa Visual Interactivo de Zonas (RF-10)</h2>
                </div>
                <span className="text-[10px] text-slate-500 font-medium">Pulsa una zona del mapa para seleccionarla</span>
              </div>

              {/* Visual Legend */}
              <div className="grid grid-cols-4 gap-1 text-center text-[10px]">
                <div className="p-1 rounded bg-emerald-50 text-emerald-800 font-semibold border border-emerald-200">Normal</div>
                <div className="p-1 rounded bg-amber-50 text-amber-800 font-semibold border border-amber-200">Revisión</div>
                <div className="p-1 rounded bg-orange-50 text-orange-800 font-semibold border border-orange-200">Falla</div>
                <div className="p-1 rounded bg-red-50 text-red-800 font-semibold border border-red-200">Crítica</div>
              </div>

              {/* Interactive 2D Blueprint Schematic */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col items-center">
                <div className="text-[11px] font-bold text-slate-500 mb-2 uppercase tracking-wider">
                  Vista Superior Esquema Automotriz
                </div>

                <div className="w-full max-w-sm flex flex-col gap-2">
                  {/* Front / Engine Zone */}
                  <button
                    type="button"
                    onClick={() => { setActiveZone('motor'); setAffectedZone('motor'); }}
                    className={`w-full p-2.5 rounded-lg border-2 text-left transition-all flex items-center justify-between cursor-pointer ${getZoneColorClass(zones.motor.state)} ${activeZone === 'motor' ? 'ring-2 ring-indigo-500' : ''}`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-lg">bolt</span>
                      <div>
                        <div className="text-xs font-bold leading-tight">1. Frente / Compartimento Motor</div>
                        <div className="text-[10px] opacity-80">{zones.motor.detail}</div>
                      </div>
                    </div>
                    {getZoneBadge(zones.motor.state)}
                  </button>

                  {/* Front Axle / Brakes */}
                  <button
                    type="button"
                    onClick={() => { setActiveZone('frenosDelanteros'); setAffectedZone('frenosDelanteros'); }}
                    className={`w-full p-2.5 rounded-lg border-2 text-left transition-all flex items-center justify-between cursor-pointer ${getZoneColorClass(zones.frenosDelanteros.state)} ${activeZone === 'frenosDelanteros' ? 'ring-2 ring-indigo-500' : ''}`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-lg">tire_repair</span>
                      <div>
                        <div className="text-xs font-bold leading-tight">2. Eje Frontal y Frenos Delanteros</div>
                        <div className="text-[10px] opacity-80">{zones.frenosDelanteros.detail}</div>
                      </div>
                    </div>
                    {getZoneBadge(zones.frenosDelanteros.state)}
                  </button>

                  {/* Transmission */}
                  <button
                    type="button"
                    onClick={() => { setActiveZone('transmision'); setAffectedZone('transmision'); }}
                    className={`w-full p-2.5 rounded-lg border-2 text-left transition-all flex items-center justify-between cursor-pointer ${getZoneColorClass(zones.transmision.state)} ${activeZone === 'transmision' ? 'ring-2 ring-indigo-500' : ''}`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-lg">settings</span>
                      <div>
                        <div className="text-xs font-bold leading-tight">3. Transmisión / Caja de Cambios</div>
                        <div className="text-[10px] opacity-80">{zones.transmision.detail}</div>
                      </div>
                    </div>
                    {getZoneBadge(zones.transmision.state)}
                  </button>

                  {/* Cabin / Interior Sensors */}
                  <button
                    type="button"
                    onClick={() => { setActiveZone('habitaculo'); setAffectedZone('habitaculo'); }}
                    className={`w-full p-2.5 rounded-lg border-2 text-left transition-all flex items-center justify-between cursor-pointer ${getZoneColorClass(zones.habitaculo.state)} ${activeZone === 'habitaculo' ? 'ring-2 ring-indigo-500' : ''}`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-lg">airline_seat_recline_normal</span>
                      <div>
                        <div className="text-xs font-bold leading-tight">4. Habitáculo y Sensores de Cabina</div>
                        <div className="text-[10px] opacity-80">{zones.habitaculo.detail}</div>
                      </div>
                    </div>
                    {getZoneBadge(zones.habitaculo.state)}
                  </button>

                  {/* Rear Axle / Suspension */}
                  <button
                    type="button"
                    onClick={() => { setActiveZone('suspensionTrasera'); setAffectedZone('suspensionTrasera'); }}
                    className={`w-full p-2.5 rounded-lg border-2 text-left transition-all flex items-center justify-between cursor-pointer ${getZoneColorClass(zones.suspensionTrasera.state)} ${activeZone === 'suspensionTrasera' ? 'ring-2 ring-indigo-500' : ''}`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-lg">swap_driving_apps</span>
                      <div>
                        <div className="text-xs font-bold leading-tight">5. Eje Trasero y Suspensión</div>
                        <div className="text-[10px] opacity-80">{zones.suspensionTrasera.detail}</div>
                      </div>
                    </div>
                    {getZoneBadge(zones.suspensionTrasera.state)}
                  </button>

                  {/* Exhaust & Catalyst */}
                  <button
                    type="button"
                    onClick={() => { setActiveZone('escape'); setAffectedZone('escape'); }}
                    className={`w-full p-2.5 rounded-lg border-2 text-left transition-all flex items-center justify-between cursor-pointer ${getZoneColorClass(zones.escape.state)} ${activeZone === 'escape' ? 'ring-2 ring-indigo-500' : ''}`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-lg">mode_heat</span>
                      <div>
                        <div className="text-xs font-bold leading-tight">6. Línea de Escape y Catalizador</div>
                        <div className="text-[10px] opacity-80">{zones.escape.detail}</div>
                      </div>
                    </div>
                    {getZoneBadge(zones.escape.state)}
                  </button>
                </div>
              </div>

              <div className="border-t border-slate-200 pt-3 space-y-3">
                <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Servicios y repuestos de la cotización
                </span>
                <p className="text-[11px] text-slate-500">
                  El escaneo OBD es opcional. Puedes elegir un código del catálogo o guardar el diagnóstico solo con estos ítems.
                </p>
                <div className="flex gap-2">
                  <select value={serviceToAdd} onChange={(e) => setServiceToAdd(e.target.value)} className="flex-1 px-2 py-1.5 text-xs border border-slate-200 rounded-lg bg-white">
                    {serviceCatalog.map((item) => (
                      <option key={item.id} value={item.id}>{item.nombre} · ${Number(item.precioManoObra || 0).toFixed(2)}</option>
                    ))}
                  </select>
                  <button type="button" onClick={() => addQuoteLine('SERVICIO', serviceToAdd)} className="px-2 py-1.5 text-xs font-bold rounded-lg bg-indigo-600 text-white">Añadir</button>
                </div>
                <div className="flex gap-2">
                  <select value={partToAdd} onChange={(e) => setPartToAdd(e.target.value)} className="flex-1 px-2 py-1.5 text-xs border border-slate-200 rounded-lg bg-white">
                    {partCatalog.map((item) => (
                      <option key={item.id} value={item.id}>{item.nombre} · stock {Number(item.stock || 0)}</option>
                    ))}
                  </select>
                  <button type="button" onClick={() => addQuoteLine('REPUESTO', partToAdd)} className="px-2 py-1.5 text-xs font-bold rounded-lg bg-indigo-600 text-white">Añadir</button>
                </div>
                <div className="space-y-1.5 text-xs">
                  {quoteLines.length === 0 && <p className="text-slate-500">Todavía no hay ítems en la cotización.</p>}
                  {quoteLines.map((line) => (
                    <div key={`${line.tipoItem}-${line.elementoId}`} className="flex items-center justify-between gap-2 p-2 rounded bg-slate-50 border border-slate-200">
                      <div>
                        <strong className="block text-slate-900">{line.nombre}</strong>
                        <span className="text-[10px] text-slate-500">{line.tipoItem === 'SERVICIO' ? 'Servicio' : 'Repuesto'} · ${line.precio.toFixed(2)}</span>
                      </div>
                      <input
                        type="number"
                        min="1"
                        value={line.cantidad}
                        onChange={(e) => setQuoteLines((current) => current.map((item) => item === line ? { ...item, cantidad: Number(e.target.value) } : item))}
                        className="w-14 px-1 py-1 border border-slate-200 rounded text-center"
                      />
                      <button type="button" onClick={() => setQuoteLines((current) => current.filter((item) => item !== line))} className="text-error">Quitar</button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Primary Action Button */}
              <div className="pt-2">
                {saveError && (
                  <p className="mb-2 text-xs text-error bg-error-container/30 border border-error/30 rounded-lg px-3 py-2">{saveError}</p>
                )}
                <button
                  type="button"
                  disabled={saving}
                  onClick={handleSaveDiagnosis}
                  className="w-full py-3 bg-indigo-600 hover:bg-indigo-50 text-white font-bold rounded-xl text-sm shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-lg">assignment_turned_in</span>
                  <span>{saving ? 'Enviando cotización...' : 'Guardar diagnóstico y enviar cotización'}</span>
                </button>
                <p className="text-[11px] text-slate-500 text-center mt-2">
                  Se guarda el diagnóstico de {currentVehicle.placa} y se envía la cotización al cliente. Los códigos OBD solo se incluyen si los seleccionaste.
                </p>
              </div>
            </div>
          </aside>
        </div>
      </main>

      {/* Modal Lightbox para Ampliar Fotografías */}
      {lightboxPhoto && (
        <div
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xs flex items-center justify-center p-4 cursor-pointer"
          onClick={() => setLightboxPhoto(null)}
        >
          <div
            className="relative max-w-4xl w-full bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden p-3 shadow-2xl flex flex-col items-center cursor-default"
            onClick={e => e.stopPropagation()}
          >
            <div className="w-full flex items-center justify-between pb-2 mb-2 border-b border-slate-800 text-white">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-indigo-600">image</span>
                <span className="text-xs font-bold font-mono">{lightboxPhoto.name}</span>
                <span className="px-1.5 py-0.5 bg-indigo-100 text-indigo-600 text-[10px] rounded font-bold">{lightboxPhoto.tag}</span>
              </div>
              <button
                type="button"
                onClick={() => setLightboxPhoto(null)}
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-white flex items-center justify-center cursor-pointer transition-colors"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>
            <img
              src={lightboxPhoto.url}
              alt={lightboxPhoto.name}
              className="max-h-[75vh] w-auto max-w-full object-contain rounded-lg"
            />
          </div>
        </div>
      )}
    </div>
  );
}
