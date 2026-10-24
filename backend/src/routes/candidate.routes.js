const express = require('express');
const candidateController = require('../controllers/candidate.controller');

const router = express.Router();

router.get('/:candidateId', (req, res, next) => candidateController.getById(req, res, next));
router.put('/:candidateId', (req, res, next) => candidateController.update(req, res, next));
router.post('/:candidateId/approve', (req, res, next) => candidateController.approve(req, res, next));
router.post('/:candidateId/reject', (req, res, next) => candidateController.reject(req, res, next));

module.exports = router;
