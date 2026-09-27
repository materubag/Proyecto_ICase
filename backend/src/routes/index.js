const express = require('express');
const router = express.Router();

const projectRoutes = require('./project.routes');
const requirementRoutes = require('./requirement.routes');
const actorRoutes = require('./actor.routes');
const documentRoutes = require('./document.routes');
const useCaseRoutes = require('./useCase.routes');
const classModelRoutes = require('./classModel.routes');
const screenRoutes = require('./screen.routes');
const fileRoutes = require('./file.routes');
const versionHistoryRoutes = require('./versionHistory.routes');
const sourceRoutes = require('./source.routes');
const candidateRoutes = require('./candidate.routes');

// Health Check
router.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      status: 'UP',
      timestamp: new Date().toISOString(),
      service: 'ICASE-Backend-API'
    }
  });
});

// Resources
router.use('/projects', projectRoutes);
router.use('/requirements', requirementRoutes);
router.use('/actors', actorRoutes);
router.use('/documents', documentRoutes);
router.use('/use-cases', useCaseRoutes);
router.use('/classes', classModelRoutes);
router.use('/screens', screenRoutes);
router.use('/files', fileRoutes);
router.use('/history', versionHistoryRoutes);
router.use('/sources', sourceRoutes);
router.use('/candidates', candidateRoutes);

module.exports = router;
