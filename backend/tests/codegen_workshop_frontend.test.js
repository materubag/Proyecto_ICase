"use strict";
const test = require("node:test"),
  assert = require("node:assert/strict"),
  vm = require("node:vm");
const { compile } = require("../src/services/codegen/workshopProfile");
const frontend = require("../src/services/codegen/workshopFrontend");
const fixture = require("./fixtures/workshop-flow/spec.json");
test("The workshop frontend is generated from capabilities even when mockups omit all screens", async () => {
  const service = require("../src/services/codegen/codeGenerator.service");
  const result = await service.generateProjectFiles(fixture.project.id, {
    spec: fixture,
    reviewOnly: true,
    allowUnapproved: true,
  });
  const files = new Map(result.files.map((file) => [file.path, file.content]));
  assert.match(files.get("frontend/src/App.jsx"), /WorkshopWorkspace/);
  const profile = JSON.parse(files.get("frontend/src/workshop.profile.json"));
  assert.equal(profile.modules.length, 20);
  const requirements = new Set(
    profile.modules.flatMap((module) => module.requirements),
  );
  for (let i = 1; i <= 34; i++)
    assert.ok(
      requirements.has("RF-" + String(i).padStart(2, "0")),
      "Missing frontend requirement RF-" + i,
    );
  const client = profile.modules
    .filter((module) => module.roles.includes("client"))
    .map((module) => module.key);
  assert.ok(client.includes("vehiculos"));
  assert.ok(client.includes("cotizaciones"));
  assert.ok(client.includes("ordenes"));
  assert.ok(!client.includes("usuarios"));
  assert.ok(!client.includes("auditoria"));
  assert.ok(
    profile.adapterPermissions["POST:/api/mi/vehiculos"].includes(
      profile.roles.client,
    ),
  );
  const esbuild = require("../../frontend/node_modules/esbuild");
  esbuild.transformSync(
    files.get("frontend/src/components/WorkshopWorkspace.jsx"),
    { loader: "jsx", format: "cjs" },
  );
  esbuild.transformSync(files.get("frontend/src/components/AppShell.jsx"), {
    loader: "jsx",
    format: "cjs",
  });
  esbuild.transformSync(files.get("frontend/src/api/client.js"), {
    loader: "js",
    format: "cjs",
  });
});
test("Adding domain UI does not replace the frontend for unrelated specifications", () => {
  assert.deepEqual(frontend.generate({ project: { name: "Biblioteca" } }), []);
  const spec = compile(fixture);
  spec.project.name = "Sin nombre de referencia";
  assert.ok(
    frontend
      .generate(spec)
      .some((file) => file.path === "frontend/src/App.jsx"),
  );
});
test("Generated HTTP client preserves multipart uploads, binary authentication and session revocation", async () => {
  const source =
    require("../src/services/codegen/reactFrontendGenerator").generateApiClientJs();
  const storage = new Map([["token", "revoked"]]);
  const events = [];
  const window = {
    localStorage: {
      getItem: (key) => storage.get(key),
      removeItem: (key) => storage.delete(key),
    },
    dispatchEvent: (event) => events.push(event.type),
  };
  const form = new FormData();
  form.append("file", new Blob(["test"]), "image.png");
  let last;
  const context = {
    window,
    localStorage: window.localStorage,
    FormData,
    Event,
    fetch: async (url, options) => {
      last = { url, options };
      return {
        ok: true,
        json: async () => ({ success: true, data: { saved: true } }),
        blob: async () => new Blob(["image"]),
      };
    },
  };
  const esbuild = require("../../frontend/node_modules/esbuild"),
    loaded = { exports: {} };
  new vm.Script(
    esbuild.transformSync(source, { format: "cjs" }).code,
  ).runInNewContext({ ...context, module: loaded });
  await loaded.exports.default.post("/upload", form);
  assert.equal(last.options.headers["Content-Type"], undefined);
  assert.equal(last.options.headers.Authorization, "Bearer revoked");
  assert.equal(last.options.body, form);
  await loaded.exports.default.blob("/api/upload/files/image.webp");
  assert.equal(last.url, "/api/upload/files/image.webp");
  assert.equal(last.options.headers.Authorization, "Bearer revoked");
  context.fetch = async () => ({
    ok: false,
    status: 401,
    json: async () => ({ code: "SESSION_REVOKED" }),
  });
  const rejected = { exports: {} };
  new vm.Script(
    esbuild.transformSync(source, { format: "cjs" }).code,
  ).runInNewContext({ ...context, module: rejected });
  await assert.rejects(rejected.exports.default.get("/auth/me"));
  assert.equal(storage.has("token"), false);
  assert.deepEqual(events, ["auth:expired"]);
});
