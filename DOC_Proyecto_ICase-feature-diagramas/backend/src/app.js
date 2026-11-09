const express = require('express');
const cors = require('cors');
const env = require('./config/env');
const apiRoutes = require('./routes/index');
const { errorHandler, notFoundHandler } = require('./middleware/error.middleware');

const app = express();
const swaggerUi = require('swagger-ui-express');
const openapi = require('./docs/openapi.json');

// CORS configuration
const corsOptions = {
  origin: (origin, callback) => {
    // Permitir cualquier origen en modo desarrollo o matching con FRONTEND_URL
    callback(null, true);
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve HTML, CSS and JavaScript before the API-only JSON content-type middleware.
app.get('/api/openapi.json', (req, res) => res.json(openapi));
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openapi, {
  customSiteTitle: 'ICASE API',
  swaggerOptions: { validatorUrl: null, supportedSubmitMethods: [] }
}));

// Explicit UTF-8 response headers
app.use((req, res, next) => {
  res.charset = 'utf-8';
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  next();
});

// Logging middleware in dev
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  next();
});

// API Routes
app.use('/api', apiRoutes);

// Root greeting
app.get('/', (req, res) => {
  res.json({
    name: 'ICASE Core Backend API',
    version: '1.0.0',
    description: 'Integrated Computer-Aided Software Engineering REST API',
    documentation: '/api/docs',
    openapi: '/api/openapi.json'
  });
});

// 404 handler
app.use(notFoundHandler);

// Centralized error handler
app.use(errorHandler);

module.exports = app;
