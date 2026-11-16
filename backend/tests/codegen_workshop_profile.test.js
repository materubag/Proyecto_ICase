"use strict";
const test = require("node:test"),
  assert = require("node:assert/strict"),
  vm = require("node:vm");
const {
  compile,
  supports,
} = require("../src/services/codegen/workshopProfile");
const fixture = require("./fixtures/workshop-flow/spec.json");
const clone = (value) => JSON.parse(JSON.stringify(value));
test("Workshop compiler selects schema and requirements, regardless of project name", () => {
  const a = clone(fixture);
  a.project.name = "Proyecto sin nombre de taller";
  assert.equal(supports(a), true);
  assert.equal(
    Object.keys(compile(a).workshopProfile.implementations).length,
    28,
  );
  a.entities = a.entities.filter((e) => e.modelName !== "PRODUCTO");
  assert.equal(compile(a), a);
  const b = clone(fixture);
  b.requirements = [];
  assert.equal(compile(b), b);
  const c = clone(fixture);
  c.security.authType = "NONE";
  assert.equal(compile(c), c);
});
test("Compilation is idempotent and changed contracts never retain approval", () => {
  const original = clone(fixture);
  original.hash = "old";
  original.approvedAt = "2026-01-01";
  const a = compile(original),
    b = compile(a);
  assert.equal(a.hash, undefined);
  assert.equal(a.approvedAt, undefined);
  assert.equal(a.sourceSpecHash, "old");
  assert.deepEqual(a, b);
  assert.equal(original.entities.length, 29);
  assert.equal(a.entities.length, 38);
});
test("Profile emits executable business implementations, private files and explicit public schemas", () => {
  const spec = compile(fixture);
  const {
    executionProblems,
  } = require("../src/services/codegen/executableContract");
  const business = spec.operations.filter((op) => op.type === "BUSINESS_LOGIC");
  for (const op of business)
    assert.deepEqual(executionProblems(op, spec.entities), []);
  const code =
    require("../src/services/codegen/operationGenerator").generateOperationServiceFile(
      business,
      spec.entities,
    );
  assert.doesNotMatch(code, /UNRESOLVED_OPERATION/);
  assert.match(code, /workshop\.runtime/);
  new vm.Script(code);
  assert.equal(spec.uploads.private, true);
  assert.equal(
    spec.workshopProfile.resources.USUARIO.schema.properties.hashContrasena,
    undefined,
  );
  assert.deepEqual(spec.workshopProfile.resources.PRODUCTO.roles.POST, [
    "Administrador",
  ]);
  assert.equal(
    spec.workshopProfile.resources.COTIZACIONDECISION.schema.properties
      .itemsAceptados.type,
    "array",
  );
});
test("A full fresh emission has valid JavaScript and no public infrastructure controllers", async () => {
  const service = require("../src/services/codegen/codeGenerator.service");
  const result = await service.generateProjectFiles(fixture.project.id, {
    spec: fixture,
    reviewOnly: true,
    allowUnapproved: true,
  });
  assert.equal(result.files.length > 200, true);
  const map = new Map(result.files.map((f) => [f.path, f.content]));
  for (const [name, code] of map)
    if (name.startsWith("backend/") && name.endsWith(".js"))
      new vm.Script(code, { filename: name });
  const central = map.get("backend/src/routes/index.js");
  assert.doesNotMatch(central, /icaseRecovery|icaseFile|icaseRolePermission/i);
  assert.match(central, /workshop\.runtime/);
  assert.match(
    map.get("backend/src/controllers/usuario.controller.js"),
    /workshop\.runtime/,
  );
  const contract = JSON.parse(map.get("openapi.json"));
  assert.ok(contract.paths["/api/auth/recover"]);
  assert.ok(contract.paths["/api/workshop-flow/compras"]);
  assert.ok(contract.paths["/api/roles/{id}/permisos"]);
  const api = JSON.parse(map.get("backend/package.json"));
  assert.ok(api.dependencies.sharp);
  assert.ok(api.dependencies.nodemailer);
});
