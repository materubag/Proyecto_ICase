"use strict";
// Generate a fresh backend from a differently named project. Never patch an existing export.
require("../tests/fixtures/codegen-offline.cjs");
const fs = require("node:fs"),
  path = require("node:path");
const root = path.resolve(__dirname, "../.verification/workshop-generated");
const service = require("../src/services/codegen/codeGenerator.service");
async function main() {
  const spec = require("../tests/fixtures/workshop-flow/spec.json");
  const result = await service.generateProjectFiles(spec.project.id, {
    spec,
    reviewOnly: true,
    allowUnapproved: true,
    includeDocker: true,
  });
  if (!result.files?.length) {
    console.error(JSON.stringify(result.diagnostics, null, 2));
    throw new Error("No generated files");
  }
  for (const file of result.files) {
    const target = path.resolve(root, file.path);
    if (!target.startsWith(root + path.sep))
      throw new Error("Unsafe export path");
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, file.content);
  }
  const tests = path.join(root, "tests");
  fs.mkdirSync(tests, { recursive: true });
  fs.cpSync(
    path.resolve(__dirname, "../tests/fixtures/workshop-flow"),
    path.join(tests, "flow"),
    { recursive: true },
  );
  for (const name of ["run-backend-flow.cjs", "compose.flow-tests.yml"])
    fs.copyFileSync(
      path.resolve(__dirname, "../tests/fixtures/workshop-flow", name),
      path.join(tests, name),
    );
  console.log(
    JSON.stringify(
      {
        files: result.files.length,
        ready: result.ready,
        errors: result.diagnostics?.errors,
        root,
      },
      null,
      2,
    ),
  );
  if(process.argv.includes('--run')) {
    const {spawnSync}=require('node:child_process');
    const run=spawnSync(process.execPath,[path.join(tests,'run-backend-flow.cjs')],{stdio:'inherit'});
    if(run.status!==0)throw new Error('La suite aislada falló; consulte el informe generado.');
  }
}
main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => require("../src/config/prisma").$disconnect());
