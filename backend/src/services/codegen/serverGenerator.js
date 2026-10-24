/**
 * Server and Configuration Generator
 * Produces server.js, database.js, package.json, .env.example and README.md
 */

const { toSnakeCasePlural } = require('./typeMapper');

function generateServerFile(projectName = 'App') {
  return `/**
 * Servidor Principal Express + Sequelize
 * Generado automáticamente por ICASE Studio para ${projectName}
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { sequelize } = require('./models');
const routes = require('./routes');

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares globales
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Error interno del servidor',
    error: process.env.NODE_ENV === 'development' ? err : {}
  });
});

// Inicio del servidor con sincronización de Sequelize
async function startServer() {
  try {
    console.log('⏳ Conectando y sincronizando base de datos con Sequelize...');
    // Sincroniza los modelos con las tablas de PostgreSQL automáticamente
    await sequelize.sync({ alter: true });
    console.log('✅ Base de datos sincronizada correctamente.');

    // Sembrar registros iniciales de prueba si la base de datos está vacía
    try {
      if (sequelize.models.Cliente && (await sequelize.models.Cliente.count()) === 0) {
        console.log('🌱 Sembrando registros iniciales de demostración en PostgreSQL...');
        await sequelize.models.Cliente.bulkCreate([
          { nombre: 'Roberto Gómez', cedula: '1723458901', telefono: '0998765432', correo: 'roberto@gmail.com', direccion: 'Av. Amazonas y Colón' },
          { nombre: 'Mariana Silva', cedula: '1719876543', telefono: '0981234567', correo: 'mariana.silva@gmail.com', direccion: 'Calle República 450' },
          { nombre: 'Carlos Mendoza', cedula: '1708765432', telefono: '0976543210', correo: 'carlos.m@hotmail.com', direccion: 'Av. Shyris N34-12' }
        ]);
        if (sequelize.models.Vehiculo) {
          await sequelize.models.Vehiculo.bulkCreate([
            { placa: 'PBA-3421', marca: 'Chevrolet', modelo: 'Sail 1.4', anio: 2021, kilometraje: 45200, color: 'Gris Plata' },
            { placa: 'PBC-8812', marca: 'Chevrolet', modelo: 'D-Max 4x4', anio: 2022, kilometraje: 71200, color: 'Blanco' },
            { placa: 'PCA-5520', marca: 'Kia', modelo: 'Sportage R', anio: 2020, kilometraje: 62000, color: 'Negro' }
          ]);
        }
        if (sequelize.models.Servicio) {
          await sequelize.models.Servicio.bulkCreate([
            { codigo: 'SRV-001', nombre: 'Mantenimiento Preventivo 10,000 / 20,000 km', categoria: 'Mecánica Rápida', horas: 2.5, tarifaHora: 20.00, precioTotal: 50.00 },
            { codigo: 'SRV-002', nombre: 'Cambio de Pastillas de Freno y Rectificado de Discos', categoria: 'Frenos', horas: 1.5, tarifaHora: 20.00, precioTotal: 30.00 },
            { codigo: 'SRV-003', nombre: 'Diagnóstico Pericial Computarizado OBD-II', categoria: 'Electrónica', horas: 1.0, tarifaHora: 25.00, precioTotal: 25.00 }
          ]);
        }
        if (sequelize.models.Producto) {
          await sequelize.models.Producto.bulkCreate([
            { codigo: 'ACE-5W30-SYN', nombre: 'Aceite Sintético 5W-30 (Galón)', categoria: 'Fluidos y Lubricantes', stockActual: 14, stockMinimo: 8, precioVenta: 38.50 },
            { codigo: 'FLT-OIL-01', nombre: 'Filtro de Aceite Blindado Original', categoria: 'Filtros', stockActual: 3, stockMinimo: 5, precioVenta: 8.50 },
            { codigo: 'PST-FRN-CER', nombre: 'Juego de Pastillas Delanteras Cerámicas', categoria: 'Frenos', stockActual: 2, stockMinimo: 4, precioVenta: 42.00 }
          ]);
        }
        console.log('✅ Datos iniciales sembrados con éxito.');
      }
    } catch (seedErr) {
      console.log('ℹ️ Nota de inicialización:', seedErr.message);
    }

    app.listen(PORT, () => {
      console.log(\`🚀 Servidor \${process.env.APP_NAME || '${projectName}'} activo en: http://localhost:\${PORT}\`);
      console.log(\`📋 Healthcheck disponible en: http://localhost:\${PORT}/api/health\`);
    });
  } catch (error) {
    console.error('❌ Error crítico al iniciar el servidor:', error);
    process.exit(1);
  }
}

startServer();
`;
}

function generateDatabaseConfig(projectName = 'app') {
  const safeDb = projectName.toLowerCase().replace(/[^a-z0-9]/g, '_') + '_db';

  return `/**
 * Configuración de Conexión a Base de Datos con Sequelize
 * Generado automáticamente por ICASE Studio
 */

require('dotenv').config();
const { Sequelize } = require('sequelize');

const DB_NAME = process.env.DB_NAME || '${safeDb}';
const DB_USER = process.env.DB_USER || 'postgres';
const DB_PASSWORD = process.env.DB_PASSWORD || 'postgres123';
const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = process.env.DB_PORT || 5432;

const sequelize = new Sequelize(DB_NAME, DB_USER, DB_PASSWORD, {
  host: DB_HOST,
  port: DB_PORT,
  dialect: 'postgres',
  logging: process.env.NODE_ENV === 'development' ? console.log : false,
  pool: {
    max: 10,
    min: 0,
    acquire: 30000,
    idle: 10000
  },
  define: {
    underscored: true,
    timestamps: true
  }
});

module.exports = sequelize;
`;
}

function generatePackageJson(projectName = 'app') {
  const safeName = projectName.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/^-|-$/g, '') || 'app-api';

  return JSON.stringify({
    name: safeName,
    version: '1.0.0',
    description: `API REST generada automáticamente por ICASE Studio para ${projectName}`,
    main: 'src/server.js',
    scripts: {
      start: 'node src/server.js',
      dev: 'nodemon src/server.js'
    },
    dependencies: {
      cors: '^2.8.5',
      dotenv: '^16.4.5',
      express: '^4.19.2',
      pg: '^8.12.0',
      'pg-hstore': '^2.3.4',
      sequelize: '^6.37.3'
    },
    devDependencies: {
      nodemon: '^3.1.4'
    },
    engines: {
      node: '>=18.0.0'
    }
  }, null, 2);
}

function generateEnvExample(projectName = 'app') {
  const safeDb = projectName.toLowerCase().replace(/[^a-z0-9]/g, '_') + '_db';

  return `# Configuración de la Aplicación
APP_NAME="${projectName} API"
PORT=3000
NODE_ENV=development

# Base de Datos PostgreSQL
DB_HOST=localhost
DB_PORT=5432
DB_NAME=${safeDb}
DB_USER=postgres
DB_PASSWORD=postgres123
`;
}

function generateReadme(projectName = 'Aplicación', entities = []) {
  const endpointsList = entities.map(e => {
    const plural = toSnakeCasePlural(e.name);
    return `### Entidad: ${e.name}
- \`GET /api/${plural}\` - Listar todos los registros
- \`GET /api/${plural}/:id\` - Obtener un registro por ID
- \`POST /api/${plural}\` - Crear un nuevo registro
- \`PUT /api/${plural}/:id\` - Actualizar un registro existente
- \`DELETE /api/${plural}/:id\` - Eliminar un registro`;
  }).join('\n\n');

  return `# ${projectName} — Backend API REST

API REST completamente funcional generada automáticamente por **ICASE Studio** a partir de los modelos de ingeniería de software aprobados (ISO/IEC/IEEE 29148).

---

## 🚀 Puesta en marcha rápida con Docker (Recomendado)

No requieres instalar Node.js ni PostgreSQL en tu máquina. Con tener Docker abierto:

\`\`\`bash
# 1. Construir y levantar los contenedores de la API y PostgreSQL
docker compose up --build -d

# 2. Ver registros de inicio
docker compose logs -f api
\`\`\`

¡Listo! La aplicación Full-Stack estará corriendo en:
- **Frontend React:** [http://localhost:3005](http://localhost:3005)
- **API REST Backend:** [http://localhost:8085/api](http://localhost:8085/api)
- **Healthcheck:** [http://localhost:8085/api/health](http://localhost:8085/api/health)
- **PostgreSQL:** \`localhost:5435\` (Usuario: \`postgres\`, Password: \`postgres123\`)

*(Nota: Puedes cambiar cualquiera de estos puertos en el archivo \`.env\` generado en la raíz)*

Para apagar los contenedores:
\`\`\`bash
docker compose down
\`\`\`

---

## 💻 Puesta en marcha en Entorno Local (Sin Docker)

Si deseas ejecutarlo directamente en tu máquina:

1. Asegúrate de tener Node.js 18+ y un servidor PostgreSQL corriendo.
2. Copia las variables de entorno:
   \`\`\`bash
   cp .env.example .env
   \`\`\`
3. Configura tus credenciales de PostgreSQL en el archivo \`.env\`.
4. Instala dependencias y arranca:
   \`\`\`bash
   npm install
   npm start
   # o en modo desarrollo con recarga automática:
   npm run dev
   \`\`\`

Sequelize creará y sincronizará automáticamente las tablas en tu base de datos al iniciar.

---

## 📡 Endpoints REST Disponibles

${endpointsList}
`;
}

module.exports = {
  generateServerFile,
  generateDatabaseConfig,
  generatePackageJson,
  generateEnvExample,
  generateReadme
};
