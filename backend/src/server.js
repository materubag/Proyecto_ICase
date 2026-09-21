const app = require('./app');
const env = require('./config/env');
const prisma = require('./config/prisma');

const PORT = env.PORT || 8080;

async function startServer() {
  try {
    // Test database connection
    console.log('[Database] Checking connection to PostgreSQL...');
    await prisma.$connect();
    console.log('[Database] PostgreSQL connection established successfully.');

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`====================================================`);
      console.log(`   ICASE Backend running on http://0.0.0.0:${PORT}`);
      console.log(`   AI Provider: [${env.AI_PROVIDER.toUpperCase()}]`);
      console.log(`   Mockup Webhook: ${env.N8N_MOCKUP_WEBHOOK || '(not set - using Mock)'}`);
      console.log(`====================================================`);
    });
  } catch (error) {
    console.error('[Server Startup Error]:', error.message);
    // Allow server to listen anyway so docker container doesn't immediately crash if db is still warming up
    app.listen(PORT, '0.0.0.0', () => {
      console.warn(`[Warning] Server started on port ${PORT} with deferred DB connection retry.`);
    });
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down server gracefully...');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('SIGTERM signal received. Shutting down...');
  await prisma.$disconnect();
  process.exit(0);
});

startServer();
