const express = require('express');
const router = express.Router();
const multer = require('multer');
const env = require('../config/env');
const documentController = require('../controllers/document.controller');

const maxSizeBytes = (env.MAX_PDF_SIZE_MB || 10) * 1024 * 1024;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: maxSizeBytes },
  fileFilter: require('../utils/pdfFilePolicy').fileFilter
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
