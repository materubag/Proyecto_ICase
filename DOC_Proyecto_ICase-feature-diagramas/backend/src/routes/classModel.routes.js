const express = require('express');
const router = express.Router();
const classModelController = require('../controllers/classModel.controller');

router.put('/:id', (req, res, next) => classModelController.update(req, res, next));
router.patch('/:id/status', (req, res, next) => classModelController.updateStatus(req, res, next));
router.delete('/:id', (req, res, next) => classModelController.delete(req, res, next));

module.exports = router;
