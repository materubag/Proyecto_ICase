const express = require('express');
const router = express.Router();
const useCaseController = require('../controllers/useCase.controller');

router.put('/:id', (req, res, next) => useCaseController.update(req, res, next));
router.patch('/:id/status', (req, res, next) => useCaseController.updateStatus(req, res, next));
router.delete('/:id', (req, res, next) => useCaseController.delete(req, res, next));

module.exports = router;
