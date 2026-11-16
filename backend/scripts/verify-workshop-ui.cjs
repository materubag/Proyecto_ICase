"use strict";
const fs = require("node:fs"),
  path = require("node:path"),
  crypto = require("node:crypto"),
  { spawnSync } = require("node:child_process");
const repo = path.resolve(__dirname, "../.."),
  root = path.resolve(__dirname, "../.verification/workshop-generated"),
  project = "icase-ui-" + crypto.randomBytes(5).toString("hex");
const runId = new Date().toISOString().replace(/[:.]/g, "-"),
  report = path.join(root, "tests", "ui-results", runId);
fs.mkdirSync(report, { recursive: true });
function run(executable, args, options = {}) {
  const result = spawnSync(executable, args, {
    cwd: repo,
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
    ...options,
  });
  if (result.status !== 0)
    throw new Error(
      executable +
        " failed: " +
        (result.stderr || result.stdout || "").slice(-6000),
    );
  return result.stdout;
}
const compose = path.join(report, "compose.yml");
const sourceHashes = {};
function sourceHash(directory) {
  const hash = crypto.createHash("sha256");
  const walk = (folder) => {
    for (const item of fs
      .readdirSync(folder, { withFileTypes: true })
      .sort((a, b) => a.name.localeCompare(b.name))) {
      const file = path.join(folder, item.name);
      if (item.isDirectory()) walk(file);
      else
        hash
          .update(path.relative(directory, file).replace(/\\/g, "/"))
          .update(fs.readFileSync(file));
    }
  };
  walk(directory);
  return hash.digest("hex");
}
const env = {
  ...process.env,
  UI_DB_PASSWORD: crypto.randomBytes(24).toString("hex"),
  UI_JWT_SECRET: crypto.randomBytes(48).toString("hex"),
};
const config = `services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: \${UI_DB_PASSWORD}
      POSTGRES_DB: workshop_ui_test
    tmpfs: [/var/lib/postgresql/data]
    healthcheck:
      test: [CMD-SHELL, pg_isready -U postgres -d workshop_ui_test]
      interval: 2s
      timeout: 3s
      retries: 30
  backend:
    build:
      context: ${JSON.stringify(path.join(root, "backend"))}
    command: sh -c "node src/migrate.js && node src/seed-demo-users.js && node src/server.js"
    environment:
      NODE_ENV: test
      DB_HOST: db
      DB_PORT: 5432
      DB_NAME: workshop_ui_test
      DB_USER: postgres
      DB_PASSWORD: \${UI_DB_PASSWORD}
      JWT_SECRET: \${UI_JWT_SECRET}
      PORT: 8080
    tmpfs: ["/app/uploads:uid=1000,gid=1000,mode=0770"]
    depends_on:
      db: {condition: service_healthy}
    healthcheck:
      test: [CMD, node, -e, "fetch('http://127.0.0.1:8080/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
      interval: 2s
      timeout: 3s
      retries: 30
  frontend:
    build:
      context: ${JSON.stringify(path.join(root, "frontend"))}
    ports: ["127.0.0.1::80"]
    depends_on:
      backend: {condition: service_healthy}
`;
const prefix = ["compose", "-p", project, "-f", compose];
let exitCode = 1;
try {
  console.log("Generating a clean frontend and backend...");
  run(process.execPath, [
    path.join(__dirname, "verify-workshop-generator.cjs"),
  ]);
  fs.writeFileSync(compose, config);
  sourceHashes.frontend = sourceHash(path.join(root, "frontend/src"));
  sourceHashes.backend = sourceHash(path.join(root, "backend/src"));
  console.log("Building isolated UI project " + project);
  const logs = run(
    "docker",
    [...prefix, "up", "--build", "-d", "--wait", "--wait-timeout", "180"],
    { env },
  );
  fs.writeFileSync(path.join(report, "build.log"), logs);
  const binding = run("docker", [...prefix, "port", "frontend", "80"], {
    env,
  }).trim();
  if (!/^127\.0\.0\.1:\d+$/.test(binding))
    throw new Error("Unexpected published address");
  console.log("Testing browser at http://" + binding);
  const result = run(
    process.execPath,
    [path.resolve(__dirname, "../tests/workshop_ui.browser.cjs")],
    {
      env: {
        ...env,
        WORKSHOP_UI_BASE: "http://" + binding,
        WORKSHOP_UI_REPORT: report,
        WORKSHOP_UI_ISOLATED: "1",
      },
      stdio: "pipe",
    },
  );
  console.log(result);
  exitCode = 0;
} catch (error) {
  console.error(error.message);
  fs.writeFileSync(path.join(report, "runner-error.log"), error.message);
  try {
    fs.writeFileSync(
      path.join(report, "containers.log"),
      run("docker", [...prefix, "logs", "--no-color", "--tail", "80"], { env }),
    );
  } catch {}
} finally {
  let clean = false;
  try {
    run("docker", [...prefix, "down", "--remove-orphans"], { env });
    clean = true;
  } catch (error) {
    console.error(error.message);
  }
  fs.writeFileSync(
    path.join(report, "run.json"),
    JSON.stringify(
      {
        runId,
        sourceHashes,
        project,
        exitCode,
        isolated: true,
        productionModified: false,
        database: "tmpfs",
        publishedAddress: "127.0.0.1:random",
        cleanupSucceeded: clean,
      },
      null,
      2,
    ),
  );
  console.log("Report: " + report);
  process.exitCode = clean ? exitCode : 1;
}
