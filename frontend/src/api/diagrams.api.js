const API_BASE = '/api/projects';

export const diagramsApi = {
  /**
   * Evaluates available data and feasibility for all 5 diagram types.
   */
  async getAvailability(projectId) {
    const res = await fetch(`${API_BASE}/${projectId}/diagrams/availability`);
    const json = await res.json();
    if (!res.ok || !json.success) {
      throw new Error(json.error || 'Error al obtener disponibilidad de diagramas');
    }
    return json.data;
  },

  /**
   * Gets current stored diagram code and status for a diagram type.
   */
  async getDiagram(projectId, type) {
    const res = await fetch(`${API_BASE}/${projectId}/diagrams/${type}`);
    const json = await res.json();
    if (!res.ok || !json.success) {
      throw new Error(json.error || `Error al obtener diagrama ${type}`);
    }
    return json.data;
  },

  /**
   * Generates a single diagram via Gemini.
   */
  async generateDiagram(projectId, type, force = false) {
    const res = await fetch(`${API_BASE}/${projectId}/diagrams/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, force })
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      const err = new Error(json.error || `Error al generar diagrama ${type}`);
      err.code = json.code;
      err.details = json.details;
      throw err;
    }
    return json.data;
  },

  /**
   * Generates multiple diagrams in batch.
   */
  async generateBatch(projectId, types, force = false) {
    const res = await fetch(`${API_BASE}/${projectId}/diagrams/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ types, force })
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      throw new Error(json.error || 'Error al generar diagramas seleccionados');
    }
    return json.data;
  }
};
