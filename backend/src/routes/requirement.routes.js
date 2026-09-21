const express = require('express');
const router = express.Router();
const requirementController = require('../controllers/requirement.controller');

// Requirements item operations
router.put('/:id', (req, res, next) => requirementController.update(req, res, next));
router.delete('/:id', (req, res, next) => requirementController.delete(req, res, next));

module.exports = router;
