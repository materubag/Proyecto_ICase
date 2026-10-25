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
const path = require('path');
const fs = require('fs');
const { sequelize } = require('./models');
const routes = require('./routes');

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares globales
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servidor estático para evidencias multimedia y fotografías (RF-12)
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/uploads', express.static(uploadsDir));

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
            { clienteId: 1, placa: 'PBA-3421', marca: 'Chevrolet', modelo: 'Sail 1.4', anio: 2021, anioFabricacion: 2021, kilometraje: 45200, color: 'Gris Plata' },
            { clienteId: 2, placa: 'PBC-8812', marca: 'Chevrolet', modelo: 'D-Max 4x4', anio: 2022, anioFabricacion: 2022, kilometraje: 71200, color: 'Blanco' },
            { clienteId: 3, placa: 'PCA-5520', marca: 'Kia', modelo: 'Sportage R', anio: 2020, anioFabricacion: 2020, kilometraje: 62000, color: 'Negro' }
          ]);
        }
        if (sequelize.models.Servicio) {
          await sequelize.models.Servicio.bulkCreate([
            { codigo: 'SRV-001', nombre: 'Mantenimiento Preventivo 10,000 / 20,000 km', descripcion: 'Revisión y cambio de fluidos', categoria: 'Mecánica Rápida', horas: 2.5, tarifaHora: 20.00, precioTotal: 50.00, precioManoObra: 50.00, duracionEstimadaMinutos: 150, activo: true },
            { codigo: 'SRV-002', nombre: 'Cambio de Pastillas de Freno y Rectificado de Discos', descripcion: 'Mantenimiento del sistema de frenos', categoria: 'Frenos', horas: 1.5, tarifaHora: 20.00, precioTotal: 30.00, precioManoObra: 30.00, duracionEstimadaMinutos: 90, activo: true },
            { codigo: 'SRV-003', nombre: 'Diagnóstico Pericial Computarizado OBD-II', descripcion: 'Escaneo electrónico y lectura de fallas', categoria: 'Electrónica', horas: 1.0, tarifaHora: 25.00, precioTotal: 25.00, precioManoObra: 25.00, duracionEstimadaMinutos: 60, activo: true }
          ]);
        }
        if (sequelize.models.Producto) {
          await sequelize.models.Producto.bulkCreate([
            { codigo: 'ACE-5W30-SYN', nombre: 'Aceite Sintético 5W-30 (Galón)', descripcion: 'Lubricante sintético alta gama', categoria: 'Fluidos y Lubricantes', stock: 14, stockActual: 14, stockMinimo: 8, costo: 25.00, precio: 38.50, precioVenta: 38.50, activo: true },
            { codigo: 'FLT-OIL-01', nombre: 'Filtro de Aceite Blindado Original', descripcion: 'Filtro blindado para motor a gasolina', categoria: 'Filtros', stock: 3, stockActual: 3, stockMinimo: 5, costo: 5.00, precio: 8.50, precioVenta: 8.50, activo: true },
            { codigo: 'PST-FRN-CER', nombre: 'Juego de Pastillas Delanteras Cerámicas', descripcion: 'Pastillas cerámicas de alto rendimiento', categoria: 'Frenos', stock: 2, stockActual: 2, stockMinimo: 4, costo: 28.00, precio: 42.00, precioVenta: 42.00, activo: true }
          ]);
        }
        if (sequelize.models.ConocimientoTecnico) {
          await sequelize.models.ConocimientoTecnico.bulkCreate([
            { codigo: 'P0300', titulo: 'Fallo de Encendido Múltiple / Aleatorio', sistema: 'Motor', sintomas: 'Pérdida de potencia, tirones en aceleración, luz Check Engine parpadeando', causas: 'Bujías desgastadas, bobinas defectuosas, baja presión de combustible', solucion: 'Revisar resistencia de bobinas con multímetro, reemplazar juego completo de bujías y verificar pulsos de inyección.' },
            { codigo: 'P0420', titulo: 'Eficiencia del Catalizador por Debajo del Umbral (Banco 1)', sistema: 'Emisiones', sintomas: 'Consumo elevado de combustible, olor a sulfuro en escape', causas: 'Catalizador degradado, fuga en escape antes del sensor, sensor de oxígeno post-catalizador descalibrado', solucion: 'Monitorear gráfica de voltaje de sensores O2 antes y después del catalizador. Si oscilan igual, reemplazar catalizador.' },
            { codigo: 'C0035', titulo: 'Circuito Sensor de Velocidad Rueda Delantera Izquierda', sistema: 'Frenos ABS', sintomas: 'Luz ABS y control de tracción encendidas en tablero', causas: 'Cableado cortado por movimiento de suspensión, sensor sucio con viruta metálica, rueda fónica fisurada', solucion: 'Limpiar sensor con limpiador de frenos, medir señal de onda y sustituir sensor si no hay señal.' },
            { codigo: 'P0171', titulo: 'Sistema Demasiado Pobre (Banco 1)', sistema: 'Admisión / Combustible', sintomas: 'Marcha mínima irregular, vacilación al pisar el acelerador', causas: 'Entrada de aire no medida, sensor MAF contaminado, filtro de combustible tapado', solucion: 'Realizar prueba de humo en múltiple de admisión y limpiar sensor de flujo de masa de aire (MAF).' }
          ]);
        }
        if (sequelize.models.Cotizacion) {
          await sequelize.models.Cotizacion.bulkCreate([
            { clienteId: 1, vehiculoId: 1, subtotal: 73.00, iva: 10.95, total: 83.95, estado: 'Pendiente de Aprobación' }
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
      multer: '^1.4.5-lts.1',
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
