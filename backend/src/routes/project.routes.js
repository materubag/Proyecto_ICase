const express = require('express');
const router = express.Router();
const projectController = require('../controllers/project.controller');
const requirementController = require('../controllers/requirement.controller');
const actorController = require('../controllers/actor.controller');
const aiController = require('../controllers/ai.controller');
const mockupController = require('../controllers/mockup.controller');
const documentController = require('../controllers/document.controller');

// Projects CRUD
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

// AI Analysis for Project
router.post('/:projectId/analyze', (req, res, next) => aiController.analyze(req, res, next));

// Import Document Analysis into Project
router.post('/:projectId/import-analysis', (req, res, next) => documentController.importAnalysis(req, res, next));

// Mockup Generation for Project (n8n prepared)
router.post('/:projectId/mockup', (req, res, next) => mockupController.generate(req, res, next));

module.exports = router;
