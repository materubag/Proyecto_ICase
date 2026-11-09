const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const env = require('../config/env');
const { validateAudioFile, sanitizeFilename } = require('../utils/fileSecurity');

const tempAudioDir = path.join(__dirname, '../../uploads/temp');
if (!fs.existsSync(tempAudioDir)) {
  fs.mkdirSync(tempAudioDir, { recursive: true });
}

const audioDiskStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, tempAudioDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const randomId = crypto.randomBytes(8).toString('hex');
    cb(null, `audio-${Date.now()}-${randomId}${ext}`);
  }
});

const audioUpload = multer({
  storage: audioDiskStorage,
  limits: { fileSize: (env.MAX_AUDIO_SIZE_MB || 100) * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const validation = validateAudioFile(file.originalname, file.mimetype);
    if (!validation.valid) {
      const error = new Error(validation.error);
      error.statusCode = 400;
      return cb(error);
    }
    file.originalname = sanitizeFilename(file.originalname);
    cb(null, true);
  }
});

module.exports = {
  audioUpload,
  tempAudioDir
};
