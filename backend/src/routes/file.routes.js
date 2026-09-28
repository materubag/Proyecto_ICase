const express = require('express');
const router = express.Router();
const fileController = require('../controllers/file.controller');

router.delete('/:id', (req, res, next) => fileController.delete(req, res, next));

module.exports = router;
