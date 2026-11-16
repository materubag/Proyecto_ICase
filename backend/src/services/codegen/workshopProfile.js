"use strict";
// An explicit domain compiler. Never select implementations by project name or HTTP verb.
const { deriveNaming, toOpenApiType } = require("./typeMapper");
const crypto = require("node:crypto");
const VERSION = 1;
const PUBLIC = [
  "USUARIO",
  "ROL",
  "CLIENTE",
  "VEHICULO",
  "CITA",
  "RECEPCION",
  "DIAGNOSTICO",
  "FALLA",
  "ZONADIAGNOSTICO",
  "EVIDENCIAMULTIMEDIA",
  "SERVICIO",
  "COTIZACION",
  "COTIZACIONDETALLE",
  "COTIZACIONDECISION",
  "ORDENTRABAJO",
  "ORDENTRABAJODETALLE",
  "ASIGNACIONMECANICO",
  "PRODUCTO",
  "MOVIMIENTOINVENTARIO",
  "ALERTASTOCK",
  "VENTA",
  "VENTADETALLE",
  "PROVEEDOR",
  "COMPRA",
  "COMPRADETALLE",
  "REGLAMANTENIMIENTO",
  "AVISOMANTENIMIENTO",
  "OBDCONOCIMIENTO",
  "AUDITORIA",
];
const norm = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/gi, "")
    .toUpperCase();
const HANDLERS = new Set([
  "sale",
  "repair",
  "history",
  "reports",
  "auditList",
  "diagnose",
  "quote",
  "inventory",
  "knowledgeSearch",
  "accounts",
  "appointments",
  "createOrder",
  "intake",
  "progress",
  "decision",
  "zones",
  "customers",
  "obdAttach",
  "assign",
  "maintenanceOrService",
  "permissions",
  "maintenanceEvaluate",
  "knowledge",
  "vehicles",
  "consume",
  "products",
]);
const REQUIREMENT_HANDLERS = {
  "RF-01": "accounts",
  "RF-02": "permissions",
  "RF-03": "customers",
  "RF-04": "vehicles",
  "RF-05": "history",
  "RF-06": "appointments",
  "RF-07": "intake",
  "RF-08": "diagnose",
  "RF-09": "diagnose",
  "RF-10": "zones",
  "RF-11": "obdAttach",
  "RF-12": "diagnose",
  "RF-13": "maintenanceOrService",
  "RF-14": "quote",
  "RF-15": "decision",
  "RF-16": "decision",
  "RF-17": "createOrder",
  "RF-18": "assign",
  "RF-19": "repair",
  "RF-20": "progress",
  "RF-21": "products",
  "RF-22": "inventory",
  "RF-23": "consume",
  "RF-24": "inventory",
  "RF-25": "sale",
  "RF-26": "inventory",
  "RF-27": "history",
  "RF-28": "maintenanceOrService",
  "RF-29": "maintenanceEvaluate",
  "RF-30": "knowledge",
  "RF-31": "knowledgeSearch",
  "RF-32": "reports",
  "RF-33": "reports",
  "RF-34": "auditList",
};
const INTERNAL = {
  Permission: { codigo: "STRING", descripcion: "STRING" },
  RolePermission: { rolId: "INTEGER", codigo: "STRING", permitido: "BOOLEAN" },
  Slot: {
    fecha: "STRING",
    horaInicio: "STRING",
    horaFin: "STRING",
    capacidad: "INTEGER",
    activo: "BOOLEAN",
  },
  Recovery: {
    usuarioId: "INTEGER",
    tokenHash: "STRING",
    vence: "DATE",
    usado: "DATE",
  },
  File: {
    usuarioId: "INTEGER",
    vehiculoId: "INTEGER",
    recepcionId: "INTEGER",
    diagnosticoId: "INTEGER",
    nombre: "STRING",
    optimizado: "STRING",
    miniatura: "STRING",
    mime: "STRING",
    peso: "INTEGER",
  },
  KnowledgeProposal: {
    usuarioId: "INTEGER",
    estado: "STRING",
    contenido: "JSON",
    resueltoPor: "INTEGER",
  },
  History: {
    vehiculoId: "INTEGER",
    usuarioId: "INTEGER",
    tipo: "STRING",
    contenido: "JSON",
    fecha: "DATE",
  },
  Request: {
    clave: "STRING",
    usuarioId: "INTEGER",
    huella: "STRING",
    resultado: "JSON",
  },
  Notice: {
    usuarioId: "INTEGER",
    vehiculoId: "INTEGER",
    tipo: "STRING",
    mensaje: "STRING",
    leida: "BOOLEAN",
    fecha: "DATE",
  },
};
function resolveModels(entities) {
  const result = {};
  for (const key of PUBLIC) {
    const entity = (entities || []).find(
      (e) => norm(e.modelName || e.name) === key,
    );
    if (!entity) return null;
    result[key] = entity;
  }
  const required = {
    USUARIO: ["correo", "hashContrasena", "rolId"],
    CLIENTE: ["usuarioId"],
    VEHICULO: ["clienteId", "placa"],
    COTIZACION: ["clienteId", "vehiculoId"],
    PRODUCTO: ["existencias", "stockMinimo"],
    ORDENTRABAJO: ["clienteId", "vehiculoId"],
  };
  if (
    Object.entries(required).some(([key, fields]) =>
      fields.some(
        (field) => !result[key].attributes.some((a) => a.fieldName === field),
      ),
    )
  )
    return null;
  return result;
}
function supports(spec) {
  if (spec.security?.authType !== "JWT" || !resolveModels(spec.entities))
    return false;
  const text = (spec.requirements || [])
    .map((r) => r.name + " " + (r.description || ""))
    .join(" ");
  return (
    /cotizaci[oó]n/i.test(text) &&
    /inventario|existencias/i.test(text) &&
    /mec[aá]nico|taller/i.test(text)
  );
}
function executable(operation, entities) {
  return (
    operation?.implementation?.runtime === "workshop-v1" &&
    HANDLERS.has(operation.implementation.handler) &&
    Boolean(resolveModels(entities))
  );
}
function compile(input) {
  if (!supports(input)) return input;
  const spec = JSON.parse(JSON.stringify(input));
  const bindings = resolveModels(spec.entities);
  const add = (entity, field, type, extra = {}) => {
    if (!entity.attributes.some((a) => a.fieldName === field))
      entity.attributes.push({
        fieldName: field,
        name: field,
        type,
        allowNull: true,
        ...extra,
      });
  };
  add(bindings.USUARIO, "versionSesion", "INTEGER", {
    defaultValue: 0,
    readOnly: true,
  });
  add(bindings.USUARIO, "cambioObligatorio", "BOOLEAN", {
    defaultValue: false,
    readOnly: true,
  });
  add(bindings.USUARIO, "temporalVence", "DATE", { readOnly: true });
  add(bindings.CLIENTE, "direccion", "STRING");
  add(bindings.VEHICULO, "color", "STRING");
  add(bindings.VEHICULO, "kilometrajeBaseMantenimiento", "INTEGER", {
    defaultValue: 0,
    readOnly: true,
  });
  add(bindings.VEHICULO, "fechaBaseMantenimiento", "DATE", { readOnly: true });
  add(bindings.RECEPCION, "mecanicoId", "INTEGER");
  add(bindings.CITA, "espacioId", "INTEGER");
  add(bindings.DIAGNOSTICO, "codigosObd", "JSON");
  add(bindings.COTIZACIONDECISION, "itemsAceptados", "JSON");
  add(bindings.ORDENTRABAJODETALLE, "usuarioId", "INTEGER", { readOnly: true });
  add(bindings.ORDENTRABAJODETALLE, "stockDescontado", "DECIMAL(12,2)", {
    defaultValue: 0,
    readOnly: true,
  });
  add(bindings.COMPRA, "inventarioAplicado", "BOOLEAN", {
    defaultValue: false,
    readOnly: true,
  });
  for (const key of ["USUARIO", "VEHICULO", "PRODUCTO"]) {
    const field =
      key === "USUARIO" ? "correo" : key === "VEHICULO" ? "placa" : "codigo";
    const attribute = bindings[key].attributes.find(
      (a) => a.fieldName === field,
    );
    if (attribute) attribute.unique = true;
  }
  const models = Object.fromEntries(
    Object.entries(bindings).map(([key, e]) => [
      key,
      deriveNaming(e.name).modelName,
    ]),
  );
  for (const [key, fields] of Object.entries(INTERNAL)) {
    const name =
      "ICASE_" + key.replace(/([a-z])([A-Z])/g, "$1_$2").toUpperCase();
    let entity = spec.entities.find((e) => e.internal && e.name === name);
    if (!entity) {
      const naming = deriveNaming(name);
      entity = {
        id: "icase-workshop-" + key,
        name,
        modelName: naming.modelName,
        tableName: naming.tableName,
        internal: true,
        primaryKey: { fieldName: "id" },
        attributes: [
          {
            fieldName: "id",
            type: "INTEGER",
            isPk: true,
            autoIncrement: true,
            allowNull: false,
          },
          ...Object.entries(fields).map(([fieldName, type]) => ({
            fieldName,
            type,
            allowNull: true,
            unique:
              ["Permission", "Recovery", "File", "Request"].includes(key) &&
              ["codigo", "tokenHash", "nombre", "clave"].includes(fieldName),
          })),
        ],
      };
      spec.entities.push(entity);
    }
    models[key] = deriveNaming(entity.name).modelName;
  }
  const nativeRoles = spec.security?.roles || spec.roles || [];
  const roles = {
    admin: nativeRoles.find((r) => /admin/i.test(r)),
    client: nativeRoles.find((r) => /client/i.test(r)),
    mechanic: nativeRoles.find((r) => /mec[aá]nic/i.test(r)),
    reception: nativeRoles.find((r) => /recep/i.test(r)),
  };
  if (Object.values(roles).some((r) => !r)) return input;
  const all = Object.values(roles),
    staff = [roles.admin, roles.reception, roles.mechanic];
  const permissions = (entity, method) => {
    if (entity === "AUDITORIA" || entity === "USUARIO" || entity === "ROL")
      return [roles.admin];
    if (
      [
        "SERVICIO",
        "PRODUCTO",
        "REGLAMANTENIMIENTO",
        "PROVEEDOR",
        "COMPRA",
        "COMPRADETALLE",
        "ALERTASTOCK",
        "MOVIMIENTOINVENTARIO",
      ].includes(entity)
    )
      return method === "GET"
        ? entity === "SERVICIO"
          ? all
          : staff
        : [roles.admin];
    if (["VENTA", "VENTADETALLE"].includes(entity))
      return method === "GET"
        ? [roles.admin, roles.reception]
        : [roles.reception];
    if (entity === "CLIENTE") return [roles.admin, roles.reception];
    if (entity === "OBDCONOCIMIENTO") return [roles.admin, roles.mechanic];
    if (
      [
        "VEHICULO",
        "CITA",
        "COTIZACION",
        "COTIZACIONDETALLE",
        "COTIZACIONDECISION",
      ].includes(entity)
    )
      return method === "GET"
        ? all
        : [
            roles.admin,
            roles.reception,
            ...(["VEHICULO", "CITA", "COTIZACIONDECISION"].includes(entity)
              ? [roles.client]
              : []),
          ];
    if (entity === "AVISOMANTENIMIENTO")
      return method === "GET" ? staff : [roles.admin];
    return method === "GET" ? all : staff;
  };
  const resources = {};
  const required = {
    USUARIO: ["nombre", "correo", "rolId", "contrasena"],
    ROL: ["nombre"],
    CLIENTE: ["nombre"],
    VEHICULO: ["clienteId", "placa"],
    CITA: ["clienteId", "vehiculoId", "fechaHora"],
    RECEPCION: ["vehiculoId"],
    DIAGNOSTICO: ["vehiculoId"],
    FALLA: ["diagnosticoId", "sistema"],
    ZONADIAGNOSTICO: ["diagnosticoId", "zona", "estado"],
    SERVICIO: ["nombre", "descripcion"],
    PRODUCTO: ["codigo", "nombre"],
    COTIZACION: ["clienteId", "vehiculoId"],
    COTIZACIONDETALLE: ["cotizacionId"],
    COTIZACIONDECISION: ["cotizacionId", "estadoResultante"],
    ORDENTRABAJO: ["clienteId", "vehiculoId", "cotizacionId"],
    ORDENTRABAJODETALLE: ["ordenTrabajoId", "servicioId"],
    ASIGNACIONMECANICO: ["ordenTrabajoId", "usuarioId"],
    PROVEEDOR: ["nombre", "identificacion"],
    COMPRA: ["proveedorId"],
    COMPRADETALLE: ["compraId", "productoId"],
    VENTA: ["clienteId"],
    VENTADETALLE: ["ventaId", "productoId"],
    REGLAMANTENIMIENTO: ["nombre"],
    OBDCONOCIMIENTO: ["codigoObd"],
  };
  for (const [key, entity] of Object.entries(bindings)) {
    const properties = {};
    for (const a of entity.attributes)
      if (
        !a.isPk &&
        !a.autoIncrement &&
        !a.readOnly &&
        !["id", "createdAt", "updatedAt"].includes(a.fieldName)
      )
        properties[a.fieldName] = {
          ...toOpenApiType(a.dataType || a.type),
          nullable: a.allowNull !== false,
        };
    if (key === "USUARIO") {
      delete properties.hashContrasena;
      properties.contrasena = { type: "string", minLength: 8 };
    }
    if (key === "COTIZACIONDECISION")
      properties.itemsAceptados = { type: "array", items: { type: "integer" } };
    if (key === "DIAGNOSTICO")
      properties.codigosObd = { type: "array", items: { type: "string" } };
    resources[key] = {
      model: models[key],
      endpoint: "/api/" + deriveNaming(entity.name).endpoint,
      schema: {
        type: "object",
        properties,
        required: required[key] || [],
        additionalProperties: false,
      },
      roles: Object.fromEntries(
        ["GET", "POST", "PUT", "DELETE"].map((method) => [
          method,
          permissions(key, method),
        ]),
      ),
    };
  }
  const codes = new Map(spec.requirements.map((r) => [r.id, r.code]));
  const implementations = {};
  for (const op of spec.operations) {
    if (op.type !== "BUSINESS_LOGIC") {
      const key = Object.keys(bindings).find((k) => models[k] === op.entity);
      if (!key) continue;
      op.authorizedRoles = permissions(key, op.method);
      op.permissionSource = "REQUIREMENT_WORKSHOP_PROFILE";
      if (["POST", "PUT"].includes(op.method))
        op.input = {
          ...op.input,
          bodySchema: {
            ...resources[key].schema,
            required: op.method === "PUT" ? [] : resources[key].schema.required,
          },
        };
      continue;
    }
    const refs = (op.requirementIds || []).map((id) => codes.get(id));
    const handler = refs
      .map((code) => REQUIREMENT_HANDLERS[code])
      .find(Boolean);
    if (!handler) continue;
    op.implementation = {
      runtime: "workshop-v1",
      handler,
      requirementCodes: refs,
    };
    op.sourceUnresolved = op.sourceUnresolved || op.unresolved || [];
    op.unresolved = [];
    if (handler === "createOrder" || handler === "assign")
      op.authorizedRoles = [roles.reception];
    implementations[op.operationId] = {
      handler,
      roles: op.authorizedRoles,
      requirements: refs,
    };
  }
  const {
    routes: adapterRoutes,
    permissionGroups,
  } = require("./workshopContracts");
  spec.workshopProfile = {
    version: VERSION,
    models,
    roles,
    resources,
    implementations,
    permissionGroups,
    adapterPermissions: Object.fromEntries(adapterRoutes.map(([method,url,allowed])=>[method.toUpperCase()+':/api'+url,allowed.map(role=>roles[role])])),
    settings: {
      timeZone: spec.project.timeZone || "UTC",
      open: "08:00",
      close: "17:00",
      slotMinutes: 60,
      capacity: 1,
    },
    sourceRequirements: spec.requirements.map((r) => r.code),
  };
  spec.uploads = { private: true, roles: all };
  // Internal tables are infrastructure, never public CRUD resources.
  spec.workshopProfile.fingerprint = crypto
    .createHash("sha256")
    .update(JSON.stringify(spec.workshopProfile))
    .digest("hex");
  if (!input.workshopProfile) {
    spec.sourceSpecHash = input.hash || null;
    delete spec.hash;
    delete spec.approvedAt;
    spec.compilationRequiresReview = true;
  }
  const api = spec.apiContract || {
    openapi: "3.0.3",
    info: { title: spec.project.name, version: "1.0.0" },
    paths: {},
    components: {
      securitySchemes: { bearerAuth: { type: "http", scheme: "bearer" } },
    },
  };
  const route = (uri, method, description, properties = {}, required = []) => {
    api.paths[uri] ||= {};
    api.paths[uri][method] = {
      summary: description,
      security: uri.includes("/auth/recover") ? [] : [{ bearerAuth: [] }],
      ...(method !== "get"
        ? {
            requestBody: {
              required: true,
              content: {
                "application/json": {
                  schema: { type: "object", properties, required },
                },
              },
            },
          }
        : {}),
      responses: {
        200: { description: "Operación completada" },
        400: { description: "Entrada inválida" },
        403: { description: "Sin permiso" },
        409: { description: "Conflicto con el estado actual" },
      },
    };
  };
  route(
    "/api/auth/recover",
    "post",
    "Solicitar recuperación verificada por correo",
    { email: { type: "string", format: "email" } },
    ["email"],
  );
  route(
    "/api/auth/recover/confirm",
    "post",
    "Consumir código de recuperación de un solo uso",
    { token: { type: "string" }, password: { type: "string", minLength: 8 } },
    ["token", "password"],
  );
  route("/api/roles/{id}/permisos", "get", "Consultar permisos efectivos");
  route(
    "/api/roles/{id}/permisos",
    "put",
    "Configurar permisos de un rol",
    {
      permisos: {
        type: "array",
        items: {
          type: "object",
          properties: {
            codigo: { type: "string" },
            permitido: { type: "boolean" },
          },
          required: ["codigo", "permitido"],
        },
      },
    },
    ["permisos"],
  );
  for (const [method, url, allowed, resource] of adapterRoutes) {
    const uri = ("/api" + url).replace(/:([A-Za-z0-9_]+)/g, "{$1}");
    if (!api.paths[uri]?.[method])
      route(
        uri,
        method,
        "Adaptador de taller: " + url,
        resource ? resources[resource].schema.properties : {},
      );
    const entry = api.paths[uri][method];
    entry["x-authorized-roles"] = allowed.map((role) => roles[role]);
    entry.parameters = [...uri.matchAll(/\{(\w+)\}/g)].map(([, name]) => ({
      name,
      in: "path",
      required: true,
      schema:
        name === "filename"
          ? { type: "string" }
          : { type: "integer", minimum: 1 },
    }));
    if (method === "get" && /disponibilidad/.test(url))
      entry.parameters.push({
        name: "fecha",
        in: "query",
        required: true,
        schema: { type: "string", format: "date" },
      });
    if (method === "get" && /expediente/.test(url))
      entry.parameters.push({
        name: "vehiculoId",
        in: "query",
        required: true,
        schema: { type: "integer" },
      });
  }
  api.paths["/api/upload"].post.requestBody = {
    required: true,
    content: {
      "multipart/form-data": {
        schema: {
          type: "object",
          properties: { file: { type: "string", format: "binary" } },
          required: ["file"],
        },
      },
    },
  };
  for (const op of spec.operations) {
    const uri = op.route.replace(/:([A-Za-z0-9_]+)/g, "{$1}");
    const entry = api.paths[uri]?.[op.method.toLowerCase()];
    if (entry) {
      entry["x-authorized-roles"] = op.authorizedRoles;
      if (op.input?.bodySchema)
        entry.requestBody = {
          required: true,
          content: { "application/json": { schema: op.input.bodySchema } },
        };
    }
  }
  spec.apiContract = api;
  return spec;
}
module.exports = { compile, supports, executable, HANDLERS, VERSION };
