/**
 * Server and Configuration Generator
 * Produces production-ready server.js, database.js, package.json, .env.example and README.md.
 * Completely domain-agnostic, with versioned migration support and no automotive constants.
 */

function generateServerFile(projectName = 'App', options = {}) {
  const safeName = projectName.toLowerCase().replace(/[^a-z0-9]/g, '_');

  return `/**
 * Servidor Principal Express + Sequelize
 * Generado automáticamente por ICASE Studio para ${projectName}
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { sequelize } = require('./models');
const routes = require('./routes');

const app = express();
const PORT = process.env.PORT || 8080;

// Middlewares globales
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Directorio para almacenamiento de archivos estáticos
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
${options.privateUploads ? '// Los archivos se sirven solo mediante la ruta autenticada de uploads.' : "app.use('/uploads', express.static(uploadsDir));"}

// Montaje de rutas API
app.use('/api', routes);

// Manejador de rutas no encontradas (404)
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: \`Ruta no encontrada: \${req.method} \${req.originalUrl}\`
  });
});

// Manejador global de errores (500)
app.use((err, req, res, next) => {
  console.error('Error no controlado:', err);
  const status = err.status || 500;
  res.status(status).json({
    success: false,
    message: err.message || 'Error interno del servidor',
    error: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

// Inicio del servidor con autenticación de base de datos
async function startServer() {
  try {
    // Verificación obligatoria de entorno de seguridad
    if (!process.env.JWT_SECRET) {
      throw new Error('La variable de entorno JWT_SECRET es obligatoria para la seguridad del servidor.');
    }

    console.log('⏳ Conectando con PostgreSQL mediante Sequelize...');
    await sequelize.authenticate();
    console.log('✅ Conexión con PostgreSQL establecida exitosamente.');

    // En desarrollo local inicial, asegurar que las tablas existan sin alter destructivo
    if (process.env.AUTO_SYNC_DB === 'true') {
      console.log('⏳ Sincronizando modelos (sin alter destructivo)...');
      await sequelize.sync();
      console.log('✅ Modelos sincronizados correctamente.');
    }

${options.systemOperations ? "    require('./services/system.scheduler').start();" : ''}
    app.listen(PORT, () => {
      console.log(\`🚀 Servidor \${process.env.APP_NAME || '${projectName}'} ejecutándose en el puerto \${PORT}\`);
      console.log(\`📡 API disponible en: http://localhost:\${PORT}/api\`);
    });
  } catch (error) {
    console.error('❌ Error fatal al iniciar el servidor:', error.message);
    process.exit(1);
  }
}

startServer();

module.exports = app;
`;
}

function generateDatabaseConfig(projectName = 'app') {
  const dbName = projectName.toLowerCase().replace(/[^a-z0-9]/g, '_') + '_db';

  return `/**
 * Configuración de Conexión a Base de Datos PostgreSQL
 * Generado automáticamente por ICASE Studio
 */

const { Sequelize } = require('sequelize');

const sequelize = new Sequelize(
  process.env.DB_NAME || '${dbName}',
  process.env.DB_USER || 'postgres',
  process.env.DB_PASSWORD || 'postgres123',
  {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 5432,
    dialect: 'postgres',
    logging: process.env.NODE_ENV === 'development' ? false : false,
    pool: {
      max: 10,
      min: 0,
      acquire: 30000,
      idle: 10000
    },
    define: {
      timestamps: true,
      underscored: true
    }
  }
);

module.exports = sequelize;
`;
}

function generatePackageJson(projectName = 'app') {
  const safeName = projectName.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/^-|-$/g, '') || 'icase-api';

  return JSON.stringify({
    name: `${safeName}-backend`,
    version: '1.0.0',
    description: `API Backend para ${projectName} generada por ICASE Studio`,
    main: 'src/server.js',
    scripts: {
      start: 'node src/server.js',
      dev: 'nodemon src/server.js',
      migrate: 'node src/migrate.js',
      'seed:account': 'node src/seed-account.js',
      'migrate:cli': 'npx sequelize-cli db:migrate',
      'migrate:undo': 'npx sequelize-cli db:migrate:undo'
    },
    dependencies: {
      bcryptjs: '^2.4.3',
      cors: '^2.8.5',
      dotenv: '^16.4.5',
      express: '^4.19.2',
      jsonwebtoken: '^9.0.2',
      multer: '^2.4.0',
      pg: '^8.12.0',
      'pg-hstore': '^2.3.4',
      sequelize: '^6.37.3',
      'sequelize-cli': '^6.6.2'
    },
    devDependencies: {
      nodemon: '^3.1.4'
    }
  }, null, 2);
}

function generateEnvExample(projectName = 'app') {
  const dbName = projectName.toLowerCase().replace(/[^a-z0-9]/g, '_') + '_db';

  return `# Entorno y Configuración del Servidor
PORT=8080
NODE_ENV=development
APP_NAME="${projectName}"
AUTO_SYNC_DB=false

# Conexión PostgreSQL
DB_HOST=localhost
DB_PORT=5432
DB_NAME=${dbName}
DB_USER=postgres
DB_PASSWORD=postgres123

# Seguridad y Autenticación
JWT_SECRET=super_secret_jwt_key_change_in_production
JWT_EXPIRATION=8h
`;
}

function generateReadme(projectName = 'app', entities = []) {
  const entityList = entities.map(e => `- **${e.modelName || e.name}**: /api/${e.endpoint || e.name.toLowerCase()}`).join('\n');

  return `# ${projectName} — Sistema Full-Stack Generado por ICASE Studio

Este proyecto se genera a partir de icase.spec.json. Consulte el estado de validación y aprobación de esa especificación antes de desplegarlo.

## Arquitectura

- **Frontend:** React 18, Vite, Single Page Application (SPA), Fetch Client.
- **Backend:** Node.js, Express, Rutas RESTful, Middlewares de validación.
- **Base de Datos:** PostgreSQL con Sequelize ORM y migraciones versionadas.
- **Contenedores:** Docker Compose con soporte multi-servicio y redes aisladas.

## Módulos y Entidades de Datos

${entityList || '- Sin entidades configuradas.'}

## Instrucciones de Ejecución

### Opción 1: Con Docker Compose (Recomendado)

\`\`\`bash
docker compose up --build
\`\`\`

- Frontend disponible en: \`http://localhost:3005\` (Nginx reenvía \`/api\` al backend)
- Backend API disponible en: \`http://localhost:8085/api\`
- PostgreSQL en puerto: \`5435\`

No uses el puerto 8080 del Studio iCASE: el API generado publica **8085** para no chocar con iCASE. Si corres el frontend con \`npm run dev\`, el proxy de Vite apunta a \`http://localhost:8085\`.

### Opción 2: Ejecución Local

1. **Configurar la Base de Datos:**
   Asegúrate de tener PostgreSQL corriendo y crea la base de datos indicada en \`backend/.env\`.

2. **Iniciar el Backend:**
   \`\`\`bash
   cd backend
   npm install
   cp .env.example .env
   npm run dev
   \`\`\`

3. **Iniciar el Frontend:**
   \`\`\`bash
   cd frontend
   npm install
   npm run dev
   \`\`\`
`;
}

module.exports = {
  generateServerFile,
  generateDatabaseConfig,
  generatePackageJson,
  generateEnvExample,
  generateReadme
};
