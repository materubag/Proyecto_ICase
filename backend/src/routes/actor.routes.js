const express = require('express');
const router = express.Router();
const actorController = require('../controllers/actor.controller');

// Actors item operations
router.put('/:id', (req, res, next) => actorController.update(req, res, next));
router.patch('/:id/status', (req, res, next) => actorController.updateStatus(req, res, next));
router.delete('/:id', (req, res, next) => actorController.delete(req, res, next));

module.exports = router;
