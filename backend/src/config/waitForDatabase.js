// Container startup preflight: verify the same authenticated TCP connection Prisma uses.
async function waitForDatabase(options = {}) {
  const connectionString = options.connectionString ?? process.env.DATABASE_URL;
  const attempts = Number(options.attempts ?? process.env.DB_CONNECT_MAX_ATTEMPTS ?? 60);
  const delayMs = Number(options.delayMs ?? process.env.DB_CONNECT_RETRY_MS ?? 2000);
  if (!connectionString) throw new Error('DATABASE_URL no está configurada.');
  let target;
  try { const url = new URL(connectionString); target = `${url.hostname}:${url.port || 5432}`; }
  catch { throw new Error('DATABASE_URL no tiene un formato válido.'); }
  if (!Number.isInteger(attempts) || attempts < 1 || !Number.isFinite(delayMs) || delayMs < 0) {
    throw new Error('Configuración de reintentos de base de datos inválida.');
  }
  const Client = options.Client || require('pg').Client;
  const sleep = options.sleep || (ms => new Promise(resolve => setTimeout(resolve, ms)));
  const log = options.log || console.log;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const client = new Client({ connectionString, connectionTimeoutMillis: 5000, query_timeout: 5000 });
    try {
      await client.connect();
      await client.query('SELECT 1');
      log(`[Database] Conexión TCP autenticada disponible en ${target}.`);
      return;
    } catch (error) {
      const code = error.code || 'CONNECTION_FAILED';
      // Configuration failures need intervention, rather than repeated connection attempts.
      if (['28P01', '28000', '3D000'].includes(code)) {
        throw Object.assign(new Error(`Configuración PostgreSQL rechazada en ${target} (${code}).`), { code });
      }
      log(`[Database] Esperando ${target}: intento ${attempt}/${attempts} (${code}).`);
      if (attempt === attempts) {
        throw Object.assign(new Error(`PostgreSQL no está accesible en ${target}. Compruebe la red Docker; ejecute scripts/start-icase.ps1 desde el equipo.`), { code: 'DB_UNAVAILABLE' });
      }
    } finally { await client.end().catch(() => {}); }
    await sleep(delayMs);
  }
}

if (require.main === module) waitForDatabase().catch(error => {
  console.error('[Database]', error.message);
  process.exitCode = 1;
});
module.exports = { waitForDatabase };
