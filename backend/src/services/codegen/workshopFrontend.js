"use strict";
const fs = require("node:fs");
const modules = [
  [
    "dashboard",
    "Inicio",
    "dashboard",
    ["admin", "reception", "mechanic", "client"],
    "RF-32",
  ],
  ["usuarios", "Usuarios", "manage_accounts", ["admin"], "RF-01"],
  ["roles", "Roles y permisos", "admin_panel_settings", ["admin"], "RF-02"],
  ["clientes", "Clientes", "groups", ["admin", "reception"], "RF-03"],
  [
    "vehiculos",
    "Vehículos",
    "directions_car",
    ["admin", "reception", "mechanic", "client"],
    "RF-04",
  ],
  [
    "citas",
    "Citas y disponibilidad",
    "calendar_month",
    ["admin", "reception", "client"],
    "RF-06",
  ],
  [
    "recepcion",
    "Recepción e inspección",
    "fact_check",
    ["admin", "reception"],
    "RF-07",
  ],
  [
    "diagnostico",
    "Diagnóstico técnico",
    "build",
    ["admin", "reception", "mechanic"],
    "RF-08",
  ],
  [
    "servicios",
    "Servicios y tarifas",
    "handyman",
    ["admin", "reception", "mechanic"],
    "RF-13",
  ],
  [
    "cotizaciones",
    "Cotizaciones y autorizaciones",
    "request_quote",
    ["admin", "reception", "mechanic", "client"],
    "RF-14",
  ],
  [
    "ordenes",
    "Órdenes y reparación",
    "construction",
    ["admin", "reception", "mechanic", "client"],
    "RF-17",
  ],
  [
    "productos",
    "Repuestos e inventario",
    "inventory_2",
    ["admin", "reception", "mechanic"],
    "RF-21",
  ],
  [
    "ventas",
    "Ventas de mostrador",
    "point_of_sale",
    ["admin", "reception"],
    "RF-25",
  ],
  ["compras", "Proveedores y compras", "local_shipping", ["admin"], "RF-26"],
  [
    "expediente",
    "Expediente e historial",
    "history",
    ["admin", "reception", "mechanic", "client"],
    "RF-27",
  ],
  [
    "mantenimiento",
    "Mantenimiento preventivo",
    "event_repeat",
    ["admin", "reception"],
    "RF-28",
  ],
  [
    "conocimiento",
    "Conocimiento técnico OBD",
    "menu_book",
    ["admin", "mechanic"],
    "RF-30",
  ],
  [
    "notificaciones",
    "Notificaciones y alertas",
    "notifications",
    ["admin", "reception", "mechanic", "client"],
    "RF-29",
  ],
  ["reportes", "Indicadores y reportes", "monitoring", ["admin"], "RF-33"],
  ["auditoria", "Auditoría", "policy", ["admin"], "RF-34"],
];
function generate(spec) {
  if (!spec.workshopProfile) return [];
  const config = {
    projectName: spec.project.name,
    ...spec.workshopProfile,
    permissionLabels: {
      "citas.crear": "Agendar citas",
      "citas.reprogramar": "Confirmar, cancelar y reprogramar citas",
      "citas.disponibilidad": "Definir horarios de atención",
      "recepcion.crear": "Registrar recepción",
      "recepcion.danos": "Registrar zonas y daños",
      "entrega.registrar": "Cambiar fase y registrar entrega",
      "diag.registrar": "Registrar diagnóstico",
      "diag.obd": "Consultar conocimiento técnico",
      "diag.proponer": "Proponer soluciones técnicas",
      "cotiz.elaborar": "Elaborar cotizaciones",
      "cotiz.aprobar_parcial": "Autorizar conceptos cotizados",
      "ot.asignar": "Asignar mecánicos",
      "ot.bitacora": "Registrar actividades de reparación",
      "ot.consumo_stock": "Registrar consumo de repuestos",
      "ot.seguimiento_cliente": "Consultar avance de reparación",
      "inv.ajuste": "Ajustar existencias",
      "inv.alertas": "Editar catálogo y mínimos de inventario",
      "inv.venta_mostrador": "Registrar ventas",
      "inv.compras": "Registrar compras e ingresar stock",
      "reportes.kpi": "Consultar indicadores",
      "usuarios.admin": "Gestionar usuarios y claves",
      "auditoria.ver": "Consultar auditoría",
    },
    modules: modules.map(([key, label, icon, roles, requirement]) => ({
      key,
      label,
      icon,
      roles,
      requirement,
      requirements: {
        diagnostico: ["RF-08", "RF-09", "RF-10", "RF-11", "RF-12"],
        cotizaciones: ["RF-14", "RF-15", "RF-16"],
        ordenes: ["RF-17", "RF-18", "RF-19", "RF-20", "RF-23"],
        productos: ["RF-21", "RF-22", "RF-24"],
        expediente: ["RF-05", "RF-27"],
        mantenimiento: ["RF-28", "RF-29"],
        conocimiento: ["RF-30", "RF-31"],
        reportes: ["RF-32", "RF-33"],
      }[key] || [requirement],
    })),
    operations: Object.fromEntries(
      spec.operations
        .filter((op) => op.implementation?.runtime === "workshop-v1")
        .map((op) => [
          op.implementation.handler,
          { path: op.route, roles: op.authorizedRoles },
        ]),
    ),
  };
  return [
    {
      path: "frontend/src/workshop.profile.json",
      content: JSON.stringify(config, null, 2),
      language: "json",
    },
    {
      path: "frontend/src/components/WorkshopWorkspace.jsx",
      content: fs.readFileSync(
        require.resolve("./workshop/Workspace.jsx"),
        "utf8",
      ),
      language: "javascript",
    },
    {
      path: "frontend/src/App.jsx",
      content:
        "import React from 'react';\nimport WorkshopWorkspace from './components/WorkshopWorkspace';\nexport default function App(){return <WorkshopWorkspace/>;}\n",
      language: "javascript",
    },
    {
      path: "FRONTEND_CAPABILITIES.json",
      content: JSON.stringify(
        {
          profile: "workshop-v1",
          modules: config.modules,
          source: "workshopFrontend.js",
          verified: false,
          notes: [
            "La funcionalidad se conecta al contrato del backend. La aprobación del proyecto no certifica pruebas de navegador.",
          ],
        },
        null,
        2,
      ),
      language: "json",
    },
  ];
}
module.exports = { generate, modules };
