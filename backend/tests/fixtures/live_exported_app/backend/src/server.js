/**
 * Servidor Principal Express + Sequelize
 * Generado automáticamente por ICASE Studio para Hospital San Lucas
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
app.use('/uploads', express.static(uploadsDir));

// Montaje de rutas API
app.use('/api', routes);

// Manejador de rutas no encontradas (404)
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Ruta no encontrada: ${req.method} ${req.originalUrl}`
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

    app.listen(PORT, () => {
      console.log(`🚀 Servidor ${process.env.APP_NAME || 'Hospital San Lucas'} ejecutándose en el puerto ${PORT}`);
      console.log(`📡 API disponible en: http://localhost:${PORT}/api`);
    });
  } catch (error) {
    console.error('❌ Error fatal al iniciar el servidor:', error.message);
    process.exit(1);
  }
}

startServer();

module.exports = app;
