"use strict";
const fs = require("node:fs"),
  path = require("node:path"),
  assert = require("node:assert/strict"),
  zlib = require("node:zlib");
const {
  chromium,
  expect,
} = require("../../frontend/node_modules/@playwright/test");
if (process.env.WORKSHOP_UI_ISOLATED !== "1")
  throw new Error(
    "Use scripts/verify-workshop-ui.cjs para probar sin tocar datos de la aplicación.",
  );
const base = process.env.WORKSHOP_UI_BASE,
  reportDirectory = process.env.WORKSHOP_UI_REPORT;
const report = {
  startedAt: new Date().toISOString(),
  cases: [],
  pageErrors: [],
  unexpectedRequests: [],
};
const context = {},
  record = {};
let browser, currentPage;
expect.configure({ timeout: 12000 });
async function step(name, fn) {
  const item = { name, status: "RUNNING" };
  report.cases.push(item);
  console.log("Checking: " + name);
  try {
    await fn();
    item.status = "PASS";
  } catch (error) {
    item.status = "FAIL";
    item.error = error.message;
    throw error;
  }
}
async function login(role, email, password = "Password123!") {
  const browserContext = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
    }),
    page = await browserContext.newPage();
  page.setDefaultTimeout(12000);
  page.on("pageerror", (error) =>
    report.pageErrors.push({ role, message: error.message }),
  );
  page.on("response", (response) => {
    if (
      response.url().startsWith(base + "/api/") &&
      [404, 500, 502, 503].includes(response.status()) &&
      !response.url().includes("/auth/recover")
    )
      report.unexpectedRequests.push({
        role,
        path: new URL(response.url()).pathname,
        status: response.status(),
      });
  });
  await page.goto(base, { waitUntil: "domcontentloaded" });
  await page.getByLabel("Correo", { exact: true }).fill(email);
  await page.getByLabel("Contraseña", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Inicio", level: 1 }),
  ).toBeVisible();
  context[role] = page;
  currentPage = page;
  return page;
}
async function go(page, key, title) {
  currentPage = page;
  await page.goto(base + "/#" + key, { waitUntil: "domcontentloaded" });
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(
    page.getByRole("heading", { name: title, level: 1 }),
  ).toBeVisible();
  await page
    .getByText("Cargando…", { exact: true })
    .first()
    .waitFor({ state: "hidden" })
    .catch(() => {});
}
async function post(page, url, button, status = 201) {
  const pending = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === "/api" + url &&
      response.request().method() === "POST",
  );
  await button.click();
  const response = await pending;
  const data = await response.json();
  assert.equal(
    response.status(),
    status,
    JSON.stringify({
      path: url,
      status: response.status(),
      message: data.message,
      code: data.code,
    }),
  );
  return data.data ?? data;
}
async function makeService(page, name, price) {
  await page
    .getByRole("button", { name: "Nuevo servicio", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Nombre", { exact: true }).fill(name);
  await dialog
    .getByLabel("Descripción", { exact: true })
    .fill("Servicio de prueba de navegador");
  await dialog.getByLabel("Mano de obra", { exact: true }).fill(String(price));
  await dialog.getByLabel("Duración en minutos", { exact: true }).fill("60");
  const row = await post(
    page,
    "/servicios",
    dialog.getByRole("button", { name: "Guardar", exact: true }),
  );
  await dialog.waitFor({ state: "hidden" });
  return row;
}
function png() {
  const crc = (data) => {
    let c = 0xffffffff;
    for (const byte of data) {
      c ^= byte;
      for (let n = 0; n < 8; n++) c = (c >>> 1) ^ (c & 1 ? 0xedb88320 : 0);
    }
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type, data) => {
    const b = Buffer.from(type),
      head = Buffer.alloc(4),
      sum = Buffer.alloc(4);
    head.writeUInt32BE(data.length);
    sum.writeUInt32BE(crc(Buffer.concat([b, data])));
    return Buffer.concat([head, b, data, sum]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(32, 0);
  ihdr.writeUInt32BE(32, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(Buffer.alloc(32 * (32 * 3 + 1)))),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}
async function addLine(dialog, index, value, quantity = 1) {
  await dialog
    .getByRole("button", { name: "Agregar concepto", exact: true })
    .click();
  await dialog
    .getByLabel("Concepto " + index, { exact: true })
    .selectOption(value);
  await dialog
    .getByLabel("Cantidad " + index, { exact: true })
    .fill(String(quantity));
}
async function main() {
  browser = await chromium.launch({ channel: "msedge", headless: true });
  await step("Administrador accede y crea servicios persistentes", async () => {
    const page = await login("admin", "admin@nexora.ec");
    await go(page, "servicios", "Servicios y tarifas");
    record.service = await makeService(page, "Servicio UI", 100);
    record.otherService = await makeService(page, "Balanceo UI", 50);
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(
      page.getByRole("row").filter({ hasText: "Servicio UI" }),
    ).toBeVisible();
  });
  await step(
    "Administrador crea repuesto y verifica stock tras recargar",
    async () => {
      const page = context.admin;
      await go(page, "productos", "Repuestos e inventario");
      await page
        .getByRole("button", { name: "Nuevo repuesto", exact: true })
        .click();
      const dialog = page.getByRole("dialog");
      await dialog.getByLabel("Código", { exact: true }).fill("UI-PART");
      await dialog.getByLabel("Nombre", { exact: true }).fill("Bujía UI");
      await dialog.getByLabel("Costo", { exact: true }).fill("10");
      await dialog.getByLabel("Precio", { exact: true }).fill("20");
      await dialog.getByLabel("Existencias", { exact: true }).fill("10");
      await dialog.getByLabel("Stock mínimo", { exact: true }).fill("2");
      record.product = await post(
        page,
        "/productos",
        dialog.getByRole("button", { name: "Guardar", exact: true }),
      );
      await page.reload({ waitUntil: "domcontentloaded" });
      const row = page
        .getByRole("table", { name: "Repuesto", exact: true })
        .getByRole("row")
        .filter({ hasText: "UI-PART" });
      await expect(row.locator("td").nth(2)).toHaveText(/^10(?:[.]00)?$/);
    },
  );
  await step(
    "Cliente accede y registra su vehículo sin seleccionar otro propietario",
    async () => {
      const page = await login("client", "cliente@nexora.ec");
      await go(page, "vehiculos", "Vehículos");
      await page
        .getByRole("button", { name: "Registrar vehículo", exact: true })
        .click();
      const dialog = page.getByRole("dialog");
      await expect(dialog.getByLabel("Cliente", { exact: true })).toHaveCount(
        0,
      );
      await dialog.getByLabel("Placa", { exact: true }).fill("UI-001");
      await dialog.getByLabel("Marca", { exact: true }).fill("Prueba");
      await dialog.getByLabel("Modelo", { exact: true }).fill("Taller");
      record.vehicle = await post(
        page,
        "/mi/vehiculos",
        dialog.getByRole("button", { name: "Guardar", exact: true }),
      );
      await page.reload({ waitUntil: "domcontentloaded" });
      await expect(
        page.getByRole("row").filter({ hasText: "UI-001" }),
      ).toBeVisible();
    },
  );
  await step("Cliente solicita una cita en un espacio disponible", async () => {
    const page = context.client;
    await go(page, "citas", "Citas y disponibilidad");
    await page
      .getByLabel("Fecha de atención", { exact: true })
      .fill("2031-06-18");
    await expect(
      page.getByRole("button", { name: "Solicitar cita", exact: true }),
    ).toBeEnabled();
    await page
      .getByRole("button", { name: "Solicitar cita", exact: true })
      .click();
    const dialog = page.getByRole("dialog");
    await dialog
      .getByLabel("Vehículo", { exact: true })
      .selectOption(String(record.vehicle.id));
    await dialog
      .getByLabel("Motivo", { exact: true })
      .fill("Revisión de encendido");
    await dialog
      .getByLabel("Espacio disponible", { exact: true })
      .selectOption({ index: 1 });
    record.appointment = await post(
      page,
      "/workshop-flow/citas",
      dialog.getByRole("button", { name: "Guardar cita", exact: true }),
    );
  });
  await step(
    "Recepción confirma la cita y registra ingreso con fotografía",
    async () => {
      const page = await login("reception", "recepcion@nexora.ec");
      await go(page, "citas", "Citas y disponibilidad");
      const row = page.getByRole("row").filter({ hasText: "UI-001" });
      await post(
        page,
        "/operations/uc-14/confirmar",
        row.getByRole("button", { name: "Confirmar cita", exact: true }),
        200,
      );
      await go(page, "recepcion", "Recepción e inspección");
      await page
        .getByRole("button", { name: "Registrar recepción", exact: true })
        .click();
      const dialog = page.getByRole("dialog");
      await dialog
        .getByLabel("Vehículo", { exact: true })
        .selectOption(String(record.vehicle.id));
      await dialog
        .getByLabel("Cita (opcional)", { exact: true })
        .selectOption(String(record.appointment.id));
      await dialog
        .getByLabel("Kilometraje de ingreso", { exact: true })
        .fill("0");
      await dialog
        .getByLabel("Motivo de ingreso", { exact: true })
        .fill("Ruido en encendido");
      await dialog
        .getByLabel("Fotografías de ingreso", { exact: true })
        .setInputFiles({
          name: "evidencia.png",
          mimeType: "image/png",
          buffer: png(),
        });
      record.intake = await post(
        page,
        "/workshop-flow/recepcion",
        dialog.getByRole("button", { name: "Guardar", exact: true }),
      );
    },
  );
  await step(
    "Mecánico registra diagnóstico, falla, zona y cotización con tres conceptos",
    async () => {
      const page = await login("mechanic", "mecanico@nexora.ec");
      await go(page, "diagnostico", "Diagnóstico técnico");
      await page
        .getByRole("button", { name: "Nuevo diagnóstico", exact: true })
        .click();
      const dialog = page.getByRole("dialog");
      await dialog
        .getByLabel("Recepción", { exact: true })
        .selectOption(String(record.intake.id));
      await dialog
        .getByLabel("Observaciones técnicas", { exact: true })
        .fill("Fallo aleatorio de encendido");
      await dialog
        .getByLabel("Códigos OBD (separados por coma)", { exact: true })
        .fill("P0300");
      await dialog
        .getByRole("button", { name: "Agregar falla", exact: true })
        .click();
      await dialog.getByLabel("Sistema 1", { exact: true }).fill("Motor");
      await dialog.getByLabel("Componente 1", { exact: true }).fill("Bujías");
      await dialog
        .getByRole("button", { name: "Agregar zona", exact: true })
        .click();
      await dialog.getByLabel("Zona 1", { exact: true }).fill("Motor");
      await addLine(dialog, 1, "S" + record.service.id);
      await addLine(dialog, 2, "P" + record.product.id, 3);
      await addLine(dialog, 3, "S" + record.otherService.id);
      record.diagnosis = await post(
        page,
        "/workshop-flow/diagnostico",
        dialog.getByRole("button", { name: "Guardar", exact: true }),
      );
      assert.ok(record.diagnosis.cotizacionId);
    },
  );
  await step(
    "Cliente autoriza parcialmente conceptos reales de su cotización",
    async () => {
      const page = context.client;
      await go(page, "cotizaciones", "Cotizaciones y autorizaciones");
      await page
        .getByRole("button", { name: "Autorizar o rechazar", exact: true })
        .click();
      const dialog = page.getByRole("dialog");
      const checkboxes = dialog.getByRole("checkbox");
      await expect(checkboxes).toHaveCount(3);
      await checkboxes.nth(2).uncheck();
      await dialog
        .getByLabel("Decisión", { exact: true })
        .selectOption("APROBAR_PARCIAL");
      await post(
        page,
        "/workshop-flow/decision",
        dialog.getByRole("button", { name: "Registrar decisión", exact: true }),
      );
      await dialog.waitFor({ state: "hidden" });
      await expect(
        page.getByRole("row").filter({ hasText: "APROBADA_PARCIALMENTE" }),
      ).toBeVisible();
    },
  );
  await step(
    "Recepción genera una orden autorizada y asigna un mecánico",
    async () => {
      const page = context.reception;
      await go(page, "ordenes", "Órdenes y reparación");
      await page
        .getByRole("button", { name: "Crear orden autorizada", exact: true })
        .click();
      let dialog = page.getByRole("dialog");
      await dialog
        .getByLabel("Cotización autorizada", { exact: true })
        .selectOption(String(record.diagnosis.cotizacionId));
      record.order = await post(
        page,
        "/workshop-flow/ordenes",
        dialog.getByRole("button", { name: "Crear orden", exact: true }),
      );
      await dialog.waitFor({ state: "hidden" });
      await page
        .getByRole("button", { name: "Asignar mecánicos", exact: true })
        .click();
      dialog = page.getByRole("dialog");
      const mechanicValue = await dialog
        .getByLabel("Mecánicos", { exact: true })
        .locator("option")
        .filter({ hasText: "Mecánico Nexora" })
        .getAttribute("value");
      await dialog
        .getByLabel("Mecánicos", { exact: true })
        .selectOption(mechanicValue);
      await post(
        page,
        "/workshop-flow/ordenes/mecanicos",
        dialog.getByRole("button", { name: "Guardar", exact: true }),
      );
    },
  );
  await step(
    "Mecánico documenta trabajo y consumo parcial sin doble descuento al cerrar",
    async () => {
      const page = context.mechanic;
      await go(page, "ordenes", "Órdenes y reparación");
      await page
        .getByRole("button", {
          name: "Registrar actividad y consumo",
          exact: true,
        })
        .click();
      let dialog = page.getByRole("dialog");
      await dialog
        .getByLabel("Actividad realizada", { exact: true })
        .fill("Cambio de bujías UI");
      await dialog
        .getByLabel("Pruebas efectuadas", { exact: true })
        .fill("Encendido estable");
      await addLine(dialog, 1, "P" + record.product.id, 2);
      await post(
        page,
        "/workshop-flow/ordenes/consumo",
        dialog.getByRole("button", {
          name: "Guardar actividad y consumo",
          exact: true,
        }),
      );
      await dialog.waitFor({ state: "hidden" });
      for (const phase of ["EN_REPARACION", "FINALIZADA"]) {
        await page
          .getByRole("button", { name: "Cambiar fase", exact: true })
          .click();
        dialog = page.getByRole("dialog");
        await dialog
          .getByLabel("Nueva fase", { exact: true })
          .selectOption(phase);
        await post(
          page,
          "/workshop-flow/fase",
          dialog.getByRole("button", { name: "Guardar", exact: true }),
          200,
        );
        await dialog.waitFor({ state: "hidden" });
      }
      await go(context.admin, "productos", "Repuestos e inventario");
      await expect(
        context.admin
          .getByRole("table", { name: "Repuesto", exact: true })
          .getByRole("row")
          .filter({ hasText: "UI-PART" })
          .locator("td")
          .nth(2),
      ).toHaveText(/^7(?:[.]00)?$/);
    },
  );
  await step(
    "Cliente consulta reparación e imagen privada del expediente",
    async () => {
      const page = context.client;
      await go(page, "ordenes", "Órdenes y reparación");
      await expect(
        page.getByRole("row").filter({ hasText: "FINALIZADA" }),
      ).toBeVisible();
      await page
        .getByRole("button", { name: "Ver reparación", exact: true })
        .click();
      await expect(
        page
          .getByRole("dialog")
          .getByRole("cell", { name: "Cambio de bujías UI", exact: true }),
      ).toBeVisible();
      await page
        .getByRole("dialog")
        .getByRole("button", { name: "Cerrar", exact: true })
        .click();
      await go(
        page,
        "expediente?vehiculoId=" + record.vehicle.id,
        "Expediente e historial",
      );
      await expect(
        page.getByRole("img", { name: "Evidencia del vehículo" }),
      ).toBeVisible();
      await expect
        .poll(() =>
          page
            .getByRole("img", { name: "Evidencia del vehículo" })
            .evaluate((image) => image.naturalWidth),
        )
        .toBeGreaterThan(0);
    },
  );
  await step(
    "Recepción realiza una venta y conserva el total confirmado",
    async () => {
      const page = context.reception;
      await go(page, "ventas", "Ventas de mostrador");
      await page
        .getByRole("button", { name: "Nueva venta", exact: true })
        .click();
      const dialog = page.getByRole("dialog");
      await dialog
        .getByLabel("Cliente", { exact: true })
        .selectOption(String(record.vehicle.clienteId));
      await addLine(dialog, 1, "P" + record.product.id, 1);
      record.sale = await post(
        page,
        "/workshop-flow/venta",
        dialog.getByRole("button", { name: "Confirmar venta", exact: true }),
      );
      assert.equal(Number(record.sale.total), 20);
      await page.reload({ waitUntil: "domcontentloaded" });
      await expect(
        page
          .getByRole("table", { name: "Ventas", exact: true })
          .getByRole("row")
          .filter({ hasText: "Cliente Nexora" }),
      ).toBeVisible();
    },
  );
  await step(
    "Administrador registra proveedor y compra con ingreso real de stock",
    async () => {
      const page = context.admin;
      await go(page, "compras", "Proveedores y compras");
      await page
        .getByRole("button", { name: "Nuevo proveedor", exact: true })
        .click();
      let dialog = page.getByRole("dialog");
      await dialog.getByLabel("Nombre", { exact: true }).fill("Proveedor UI");
      await dialog
        .getByLabel("Identificación", { exact: true })
        .fill("UI-RUC-001");
      record.vendor = await post(
        page,
        "/proveedores",
        dialog.getByRole("button", { name: "Guardar", exact: true }),
      );
      await dialog.waitFor({ state: "hidden" });
      await page
        .getByRole("button", {
          name: "Registrar compra e ingreso",
          exact: true,
        })
        .click();
      dialog = page.getByRole("dialog");
      await dialog
        .getByLabel("Proveedor", { exact: true })
        .selectOption(String(record.vendor.id));
      await addLine(dialog, 1, "P" + record.product.id, 4);
      await post(
        page,
        "/workshop-flow/compras",
        dialog.getByRole("button", {
          name: "Confirmar compra e ingresar stock",
          exact: true,
        }),
      );
      await page.reload({ waitUntil: "domcontentloaded" });
      await expect(
        page
          .getByRole("table", { name: "Compras", exact: true })
          .getByRole("row")
          .filter({ hasText: "Proveedor UI" }),
      ).toBeVisible();
      await go(page, "productos", "Repuestos e inventario");
      await expect(
        page
          .getByRole("table", { name: "Repuesto", exact: true })
          .getByRole("row")
          .filter({ hasText: "UI-PART" })
          .locator("td")
          .nth(2),
      ).toHaveText(/^10(?:[.]00)?$/);
    },
  );
  await step(
    "El frontend conserva el formulario y muestra errores reales del servidor",
    async () => {
      const page = context.admin;
      await page
        .getByRole("button", { name: "Nuevo repuesto", exact: true })
        .click();
      const dialog = page.getByRole("dialog");
      await dialog.getByLabel("Código", { exact: true }).fill("UI-PART");
      await dialog
        .getByLabel("Nombre", { exact: true })
        .fill("Duplicado que no debe guardarse");
      const pending = page.waitForResponse(
        (response) =>
          new URL(response.url()).pathname === "/api/productos" &&
          response.request().method() === "POST",
      );
      await dialog
        .getByRole("button", { name: "Guardar", exact: true })
        .click();
      assert.ok((await pending).status() >= 400);
      await expect(dialog.getByRole("alert")).toBeVisible();
      await expect(dialog.getByLabel("Nombre", { exact: true })).toHaveValue(
        "Duplicado que no debe guardarse",
      );
      await dialog.getByRole("button", { name: "Cerrar", exact: true }).click();
    },
  );
  await step(
    "Administrador obtiene CSV real de indicadores y consulta auditoría",
    async () => {
      const page = context.admin;
      await go(page, "reportes", "Indicadores y reportes");
      const downloadPromise = page.waitForEvent("download");
      await page
        .getByRole("button", { name: "Descargar CSV", exact: true })
        .click();
      const download = await downloadPromise;
      const target = path.join(reportDirectory, "indicadores.csv");
      await download.saveAs(target);
      const csv = fs.readFileSync(target, "utf8");
      assert.match(csv, /Ingresos del período/);
      assert.match(csv, /,"20",/);
      await go(page, "auditoria", "Auditoría");
      await expect(
        page
          .getByRole("table", { name: "Auditoría", exact: true })
          .getByRole("row")
          .filter({ hasText: "CREATE" })
          .first(),
      ).toBeVisible();
    },
  );
  await step("Usuario temporal cambia su clave antes de operar", async () => {
    const page = context.admin;
    await go(page, "usuarios", "Usuarios");
    await page
      .getByRole("button", { name: "Nuevo usuario", exact: true })
      .click();
    const dialog = page.getByRole("dialog");
    await dialog
      .getByLabel("Nombre", { exact: true })
      .fill("Cliente temporal UI");
    await dialog
      .getByLabel("Correo", { exact: true })
      .fill("ui-temporary@example.invalid");
    await dialog.getByLabel("Rol", { exact: true }).selectOption("Cliente");
    const account = await post(
      page,
      "/workshop-flow/usuarios",
      dialog.getByRole("button", { name: "Guardar usuario", exact: true }),
    );
    const browserContext = await browser.newContext(),
      temporary = await browserContext.newPage();
    currentPage = temporary;
    await temporary.goto(base);
    await temporary.getByLabel("Correo", { exact: true }).fill(account.correo);
    await temporary
      .getByLabel("Contraseña", { exact: true })
      .fill(account.passwordTemporal);
    await temporary
      .getByRole("button", { name: "Entrar", exact: true })
      .click();
    await expect(
      temporary.getByRole("heading", { name: "Cambia tu contraseña temporal" }),
    ).toBeVisible();
    await temporary
      .getByLabel("Contraseña temporal", { exact: true })
      .fill(account.passwordTemporal);
    await temporary
      .getByLabel("Nueva contraseña", { exact: true })
      .fill("Changed!Browser123");
    await temporary
      .getByLabel("Confirmar contraseña", { exact: true })
      .fill("Changed!Browser123");
    await temporary
      .getByRole("button", { name: "Guardar contraseña", exact: true })
      .click();
    await expect(
      temporary.getByRole("button", { name: "Entrar", exact: true }),
    ).toBeVisible();
    await browserContext.close();
  });
  await step(
    "Recepción registra cliente sin cuenta y habilita su acceso",
    async () => {
      const page = context.reception;
      await go(page, "clientes", "Clientes");
      await page
        .getByRole("button", { name: "Nuevo cliente", exact: true })
        .click();
      const dialog = page.getByRole("dialog");
      await dialog
        .getByLabel("Nombre", { exact: true })
        .fill("Cliente mostrador UI");
      await dialog
        .getByLabel("Correo", { exact: true })
        .fill("walkin-ui@example.invalid");
      await post(
        page,
        "/clientes",
        dialog.getByRole("button", { name: "Guardar", exact: true }),
      );
      await dialog.waitFor({ state: "hidden" });
      const row = page
        .getByRole("row")
        .filter({ hasText: "Cliente mostrador UI" });
      await expect(row).toContainText("Sin cuenta");
      await post(
        page,
        "/workshop-flow/clientes-acceso",
        row.getByRole("button", { name: "Dar acceso", exact: true }),
        200,
      );
      await expect(row).toContainText("Cuenta vinculada");
    },
  );
  await step(
    "Administrador configura mantenimiento y el cliente actualiza su odómetro",
    async () => {
      const page = context.admin;
      await go(page, "mantenimiento", "Mantenimiento preventivo");
      await page
        .getByRole("button", {
          name: "Nueva regla de mantenimiento",
          exact: true,
        })
        .click();
      const dialog = page.getByRole("dialog");
      await dialog.getByLabel("Nombre", { exact: true }).fill("Aceite UI");
      await dialog
        .getByLabel("Vehículo (opcional)", { exact: true })
        .selectOption(String(record.vehicle.id));
      await dialog
        .getByLabel("Intervalo en kilómetros", { exact: true })
        .fill("10");
      await dialog
        .getByLabel("Anticipación en kilómetros", { exact: true })
        .fill("2");
      await post(
        page,
        "/regla-mantenimientos",
        dialog.getByRole("button", { name: "Guardar", exact: true }),
      );
      const client = context.client;
      await go(client, "vehiculos", "Vehículos");
      await client
        .getByRole("button", { name: "Actualizar kilometraje", exact: true })
        .click();
      const mileage = client.getByRole("dialog");
      await mileage.getByLabel("Kilometraje actual", { exact: true }).fill("8");
      const pending = client.waitForResponse(
        (r) =>
          new URL(r.url()).pathname ===
            "/api/mi/vehiculos/" + record.vehicle.id &&
          r.request().method() === "PUT",
      );
      await mileage
        .getByRole("button", { name: "Guardar", exact: true })
        .click();
      assert.equal((await pending).status(), 200);
      await mileage.waitFor({ state: "hidden" });
      await go(context.reception, "mantenimiento", "Mantenimiento preventivo");
      await expect(
        context.reception
          .getByRole("table", { name: "Avisos de mantenimiento", exact: true })
          .getByRole("row")
          .filter({ hasText: "PENDIENTE" }),
      ).toBeVisible();
    },
  );
  await step(
    "Cliente recibe avisos reales y los marca como leídos",
    async () => {
      const page = context.client;
      await go(page, "notificaciones", "Notificaciones y alertas");
      await expect(
        page.getByRole("row").filter({ hasText: "Aceite UI" }),
      ).toBeVisible();
      const row = page.getByRole("row").filter({ hasText: "Aceite UI" });
      const pending = page.waitForResponse(
        (r) =>
          /\/api\/workshop-flow\/notificaciones\/\d+\/leida$/.test(
            new URL(r.url()).pathname,
          ) && r.request().method() === "POST",
      );
      await row
        .getByRole("button", { name: "Marcar como leída", exact: true })
        .click();
      assert.equal((await pending).status(), 200);
      await expect(
        row.getByRole("button", { name: "Marcar como leída", exact: true }),
      ).toHaveCount(0);
    },
  );
  await step(
    "Mecánico propone conocimiento y Administrador publica la solución",
    async () => {
      const page = context.mechanic;
      await go(page, "conocimiento", "Conocimiento técnico OBD");
      await page
        .getByRole("button", { name: "Proponer solución", exact: true })
        .click();
      let dialog = page.getByRole("dialog");
      await dialog.getByLabel("Código OBD", { exact: true }).fill("P0420");
      await dialog
        .getByLabel("Solución", { exact: true })
        .fill("Solución técnica UI verificada");
      await post(
        page,
        "/workshop-flow/obd/proponer",
        dialog.getByRole("button", { name: "Guardar", exact: true }),
      );
      await go(context.admin, "conocimiento", "Conocimiento técnico OBD");
      await post(
        context.admin,
        "/workshop-flow/obd/propuestas/1/resolver",
        context.admin.getByRole("button", {
          name: "Aprobar propuesta",
          exact: true,
        }),
        200,
      );
      await context.admin
        .getByLabel("Buscar conocimiento", { exact: true })
        .fill("P0420");
      await expect(
        context.admin
          .getByRole("table", { name: "Conocimiento técnico", exact: true })
          .getByRole("row")
          .filter({ hasText: "Solución técnica UI verificada" }),
      ).toBeVisible();
    },
  );
  await step(
    "Los permisos guardados cambian las acciones visibles tras verificar la sesión",
    async () => {
      const page = context.admin;
      await go(page, "roles", "Roles y permisos");
      const permission =
        "Editar catálogo y mínimos de inventario · Administrador";
      const pending = page.waitForResponse(
        (r) =>
          new URL(r.url()).pathname === "/api/workshop-flow/permisos" &&
          r.request().method() === "POST",
      );
      await page.getByLabel(permission, { exact: true }).click();
      assert.equal((await pending).status(), 200);
      await go(page, "productos", "Repuestos e inventario");
      await expect(
        page.getByRole("button", { name: "Editar", exact: true }),
      ).toHaveCount(0);
      await go(page, "roles", "Roles y permisos");
      const restore = page.waitForResponse(
        (r) =>
          new URL(r.url()).pathname === "/api/workshop-flow/permisos" &&
          r.request().method() === "POST",
      );
      await page.getByLabel(permission, { exact: true }).click();
      assert.equal((await restore).status(), 200);
      await go(page, "productos", "Repuestos e inventario");
      await expect(
        page.getByRole("button", { name: "Editar", exact: true }),
      ).toBeVisible();
    },
  );
  await step(
    "El mapa y las fallas guardadas aparecen en el expediente",
    async () => {
      const page = context.client;
      await go(
        page,
        "expediente?vehiculoId=" + record.vehicle.id,
        "Expediente e historial",
      );
      await expect(
        page
          .getByRole("table", { name: "Fallas del expediente", exact: true })
          .getByRole("row")
          .filter({ hasText: "Motor" }),
      ).toBeVisible();
      await expect(
        page.getByRole("img", { name: "Mapa visual de zonas del vehículo" }),
      ).toBeVisible();
      await expect(
        page
          .getByRole("table", { name: "Zonas del expediente", exact: true })
          .getByRole("row")
          .filter({ hasText: "Motor" }),
      ).toBeVisible();
    },
  );
  await step(
    "La navegación móvil abre todos los módulos autorizados sin desbordar la página",
    async () => {
      const page = context.client;
      await page.setViewportSize({ width: 390, height: 844 });
      await page
        .getByRole("button", { name: "Abrir menú de módulos", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Vehículos", exact: true })
        .click();
      await expect(
        page.getByRole("heading", { name: "Vehículos", level: 1 }),
      ).toBeVisible();
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth + 1,
        ),
        true,
      );
      await page.screenshot({
        path: path.join(reportDirectory, "mobile-vehicles.png"),
        fullPage: true,
      });
      await page.setViewportSize({ width: 1440, height: 1000 });
    },
  );
  await step("Navegación restringida y cierre de sesión", async () => {
    const page = context.client;
    await go(page, "usuarios", "Pantalla no disponible").catch(async () => {
      await expect(
        page.getByRole("heading", { name: "Pantalla no disponible" }),
      ).toBeVisible();
    });
    await expect(
      page.getByRole("button", { name: "Nuevo usuario", exact: true }),
    ).toHaveCount(0);
    await page
      .getByRole("button", { name: "Cerrar sesión", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Entrar", exact: true }),
    ).toBeVisible();
  });
  assert.deepEqual(report.pageErrors, []);
  await step(
    "La venta permite consultar sus productos e importes confirmados",
    async () => {
      const page = context.reception;
      await go(page, "ventas", "Ventas de mostrador");
      await page
        .getByRole("button", { name: "Ver detalle", exact: true })
        .click();
      const dialog = page.getByRole("dialog");
      await expect(
        dialog
          .getByRole("table", { name: "Detalle del documento", exact: true })
          .getByRole("row")
          .filter({ hasText: "Bujía UI" }),
      ).toBeVisible();
      await expect(dialog.getByText(/Total confirmado:/)).toBeVisible();
      await dialog.getByRole("button", { name: "Cerrar", exact: true }).click();
    },
  );
  await step(
    "Recuperación muestra un error real si el envío no está configurado",
    async () => {
      const page = context.client;
      await page
        .getByRole("button", { name: "Recuperar acceso", exact: true })
        .click();
      await page
        .getByLabel("Correo de la cuenta", { exact: true })
        .fill("cliente@nexora.ec");
      const pending = page.waitForResponse(
        (r) =>
          new URL(r.url()).pathname === "/api/auth/recover" &&
          r.request().method() === "POST",
      );
      await page
        .getByRole("button", { name: "Enviar instrucciones", exact: true })
        .click();
      assert.equal((await pending).status(), 503);
      await expect(
        page
          .getByRole("alert")
          .filter({ hasText: "Solicita ayuda al administrador" }),
      ).toBeVisible();
      await expect(
        page.getByLabel("Código recibido", { exact: true }),
      ).toHaveCount(0);
      await page
        .getByRole("button", { name: "Volver al acceso", exact: true })
        .click();
    },
  );
  assert.deepEqual(report.pageErrors, []);
  assert.deepEqual(report.unexpectedRequests, []);
  await context.admin.screenshot({
    path: path.join(reportDirectory, "desktop.png"),
    fullPage: true,
  });
  await context.client.setViewportSize({ width: 390, height: 844 });
  await context.client.screenshot({
    path: path.join(reportDirectory, "mobile-login.png"),
    fullPage: true,
  });
}
main()
  .catch(async (error) => {
    console.error(error.stack || error);
    process.exitCode = 1;
    try {
      await currentPage?.screenshot({
        path: path.join(reportDirectory, "failure.png"),
        fullPage: true,
      });
    } catch {}
  })
  .finally(async () => {
    report.finishedAt = new Date().toISOString();
    fs.writeFileSync(
      path.join(reportDirectory, "results.json"),
      JSON.stringify(report, null, 2),
    );
    await browser?.close();
    console.log(
      JSON.stringify({
        passed: report.cases.filter((item) => item.status === "PASS").length,
        failed: report.cases.filter((item) => item.status === "FAIL").length,
        pageErrors: report.pageErrors.length,
        unexpectedRequests: report.unexpectedRequests.length,
      }),
    );
  });
