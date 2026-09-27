const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const env = require('../config/env');
const { sanitizeFilename } = require('../utils/fileSecurity');

const tempPdfDir = path.join(__dirname, '../../uploads/temp');
if (!fs.existsSync(tempPdfDir)) {
  fs.mkdirSync(tempPdfDir, { recursive: true });
}

const pdfDiskStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, tempPdfDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.pdf';
    const randomId = crypto.randomBytes(8).toString('hex');
    cb(null, `pdf-${Date.now()}-${randomId}${ext}`);
  }
});

const sourceUpload = multer({
  storage: pdfDiskStorage,
  limits: { fileSize: (env.MAX_PDF_SIZE_MB || 10) * 1024 * 1024, files: 20 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf' || file.originalname.toLowerCase().endsWith('.pdf')) {
      file.originalname = sanitizeFilename(file.originalname);
      return cb(null, true);
    }
    const error = new Error(`Solo se permiten archivos PDF en Fuentes. Archivo recibido: "${file.originalname}". Para grabaciones, utiliza la opción de Subir Audio.`);
    error.statusCode = 400;
    cb(error);
  }
});

module.exports = {
  sourceUpload,
  tempPdfDir
};
