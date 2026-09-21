const express = require('express');
const router = express.Router();
const multer = require('multer');
const env = require('../config/env');
const documentController = require('../controllers/document.controller');

const maxSizeBytes = (env.MAX_PDF_SIZE_MB || 10) * 1024 * 1024;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: maxSizeBytes },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf' || file.originalname.toLowerCase().endsWith('.pdf')) {
      cb(null, true);
    } else {
      const err = new Error('Solo se permiten archivos en formato PDF (.pdf)');
      err.statusCode = 400;
      cb(err, false);
    }
  }
});

// Extracción sin IA
router.post('/extract', upload.single('file'), (req, res, next) => {
  documentController.extract(req, res, next);
});

// Análisis estructurado con IA / Ollama
router.post('/analyze', upload.single('file'), (req, res, next) => {
  documentController.analyze(req, res, next);
});

module.exports = router;
