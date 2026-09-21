const actorService = require('../services/actor.service');

class ActorController {
  async getByProject(req, res, next) {
    try {
      const { projectId } = req.params;
      const actors = await actorService.getActorsByProject(projectId);
      res.status(200).json({
        success: true,
        data: actors
      });
    } catch (error) {
      next(error);
    }
  }

  async create(req, res, next) {
    try {
      const { projectId } = req.params;
      const actor = await actorService.createActor(projectId, req.body);
      res.status(201).json({
        success: true,
        data: actor
      });
    } catch (error) {
      next(error);
    }
  }

  async update(req, res, next) {
    try {
      const { id } = req.params;
      const updated = await actorService.updateActor(id, req.body);
      res.status(200).json({
        success: true,
        data: updated
      });
    } catch (error) {
      next(error);
    }
  }

  async delete(req, res, next) {
    try {
      const { id } = req.params;
      await actorService.deleteActor(id);
      res.status(200).json({
        success: true,
        data: { message: `Actor ${id} successfully deleted` }
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new ActorController();
