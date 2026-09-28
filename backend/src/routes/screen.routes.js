const express = require('express');
const router = express.Router();
const screenController = require('../controllers/screen.controller');

router.patch('/:id/select', (req, res, next) => screenController.toggleSelect(req, res, next));
router.patch('/:id/status', (req, res, next) => screenController.updateStatus(req, res, next));
router.put('/:id', (req, res, next) => screenController.update(req, res, next));
router.delete('/:id', (req, res, next) => screenController.delete(req, res, next));

module.exports = router;
