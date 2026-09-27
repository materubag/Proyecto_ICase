const express = require('express');
const router = express.Router();
const multer = require('multer');

const projectController = require('../controllers/project.controller');
const requirementController = require('../controllers/requirement.controller');
const actorController = require('../controllers/actor.controller');
const aiController = require('../controllers/ai.controller');
const mockupController = require('../controllers/mockup.controller');
const documentController = require('../controllers/document.controller');
const useCaseController = require('../controllers/useCase.controller');
const classModelController = require('../controllers/classModel.controller');
const screenController = require('../controllers/screen.controller');
const fileController = require('../controllers/file.controller');
const versionHistoryController = require('../controllers/versionHistory.controller');
const sourceController = require('../controllers/source.controller');
const candidateController = require('../controllers/candidate.controller');
const env = require('../config/env');
const { audioUpload } = require('../middleware/audioUpload.middleware');
const { sourceUpload } = require('../middleware/pdfUpload.middleware');

// Multer memory storage para subida de múltiples archivos (documentos y audios)
const uploadMulti = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 35 * 1024 * 1024 } // 35 MB por archivo
});

// Projects CRUD
router.use('/:projectId/engineering', require('./engineering.routes'));
router.get('/', (req, res, next) => projectController.getAll(req, res, next));
router.get('/:id', (req, res, next) => projectController.getById(req, res, next));
router.post('/', (req, res, next) => projectController.create(req, res, next));
router.put('/:id', (req, res, next) => projectController.update(req, res, next));
router.delete('/:id', (req, res, next) => projectController.delete(req, res, next));

// Nested Project Requirements
router.get('/:projectId/requirements', (req, res, next) => requirementController.getByProject(req, res, next));
router.post('/:projectId/requirements', (req, res, next) => requirementController.create(req, res, next));

// Nested Project Actors
router.get('/:projectId/actors', (req, res, next) => actorController.getByProject(req, res, next));
router.post('/:projectId/actors', (req, res, next) => actorController.create(req, res, next));

// Subida Múltiple Opcional de Documentos y Audios
router.get('/:projectId/files', (req, res, next) => fileController.getByProject(req, res, next));
router.post('/:projectId/files', uploadMulti.array('files', 15), (req, res, next) => fileController.upload(req, res, next));
router.post('/:projectId/analyze-consolidated', (req, res, next) => fileController.analyzeConsolidated(req, res, next));

// Casos de Uso (4 Procesos Fundamentales)
router.get('/:projectId/use-cases', (req, res, next) => useCaseController.getByProject(req, res, next));
router.post('/:projectId/use-cases', (req, res, next) => useCaseController.create(req, res, next));
router.post('/:projectId/use-cases/generate', (req, res, next) => useCaseController.generate(req, res, next));
router.get('/:projectId/use-cases/diagram', (req, res, next) => useCaseController.getDiagram(req, res, next));

// Modelado de Datos y Diagrama de Clases
router.get('/:projectId/classes', (req, res, next) => classModelController.getByProject(req, res, next));
router.post('/:projectId/classes', (req, res, next) => classModelController.create(req, res, next));
router.post('/:projectId/classes/generate', (req, res, next) => classModelController.generate(req, res, next));
router.get('/:projectId/classes/diagram', (req, res, next) => classModelController.getDiagram(req, res, next));

// Pantallas y Generación de Mockups Seleccionados
router.get('/:projectId/screens', (req, res, next) => screenController.getByProject(req, res, next));
router.post('/:projectId/screens/select-multiple', (req, res, next) => screenController.selectMultiple(req, res, next));
router.post('/:projectId/screens/generate-selected', (req, res, next) => screenController.generateSelectedMockups(req, res, next));

// Historial de Versiones y Recuperación
router.get('/:projectId/history', (req, res, next) => versionHistoryController.getByProject(req, res, next));

// Project Sources
router.get('/:projectId/sources', (req, res, next) => sourceController.list(req, res, next));
router.post('/:projectId/sources', sourceUpload.array('files', 20), (req, res, next) => sourceController.upload(req, res, next));
router.post('/:projectId/sources/audio', audioUpload.single('file'), (req, res, next) => sourceController.uploadAudio(req, res, next));

// Project Candidates & Approval Center
router.get('/:projectId/candidates', (req, res, next) => candidateController.listByProject(req, res, next));
router.get('/:projectId/candidates/stats', (req, res, next) => candidateController.getStats(req, res, next));
router.post('/:projectId/candidates/batch-approve', (req, res, next) => candidateController.approveBatch(req, res, next));
router.post('/:projectId/candidates/batch-reject', (req, res, next) => candidateController.rejectBatch(req, res, next));
router.post('/:projectId/candidates/approve-category', (req, res, next) => candidateController.approveCategory(req, res, next));

// AI Analysis for Project
router.post('/:projectId/analyze', (req, res, next) => aiController.analyze(req, res, next));

// Import Document Analysis into Project
router.post('/:projectId/import-analysis', (req, res, next) => documentController.importAnalysis(req, res, next));

// Mockup Generation for Project (n8n prepared legacy)
router.post('/:projectId/mockup', (req, res, next) => mockupController.generate(req, res, next));

module.exports = router;
