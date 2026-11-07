import { request } from './client';

const BASE_URL = import.meta.env.VITE_API_URL || '/api';

export const codegenApi = {
  /**
   * Obtiene la previsualización del árbol de archivos y contenido de código
   */
  getPreview: (projectId, includeDocker = true) => {
    return request(`/projects/${projectId}/codegen/preview?includeDocker=${includeDocker}`);
  },

  /**
   * Obtiene la especificación JSON común y su diagnóstico de validación
   */
  getSpecification: (projectId) => {
    return request(`/projects/${projectId}/codegen/spec`);
  },

  /**
   * Valida una especificación JSON arbitraria contra los Quality Gates
   */
  validateSpecification: (projectId, spec) => {
    return request(`/projects/${projectId}/codegen/spec/validate`, {
      method: 'POST',
      body: spec
    });
  },

  /**
   * Aprueba formalmente la especificación y la congela en un baseline inmutable
   */
  approveSpecification: (projectId, data = {}) => {
    return request(`/projects/${projectId}/codegen/spec/approve`, {
      method: 'POST',
      body: data
    });
  },

  /**
   * Descarga el archivo .zip directamente en el navegador
   */
  downloadZip: async (projectId, includeDocker = true, defaultFilename = 'proyecto-api.zip', jobId = null) => {
    const url = `${BASE_URL}/projects/${projectId}/codegen/download?includeDocker=${includeDocker}${jobId ? '&jobId=' + encodeURIComponent(jobId) : ''}`;
    const response = await fetch(url);
    if (!response.ok) {
      const errJson = await response.json().catch(() => ({}));
      const msg = errJson?.error?.message || `Error al descargar el archivo ZIP (HTTP ${response.status})`;
      throw new Error(msg);
    }

    // Obtener nombre del header si viene
    const disposition = response.headers.get('Content-Disposition');
    let filename = defaultFilename;
    if (disposition && disposition.includes('filename=')) {
      const match = disposition.match(/filename="?([^"]+)"?/);
      if (match && match[1]) filename = match[1];
    }

    const blob = await response.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(blobUrl);

    return { success: true, filename };
  },

  /**
   * Obtiene el estado de operaciones incompletas, mockups y propuestas de IA
   */
  getAiStatus: (projectId) => {
    return request(`/projects/${projectId}/codegen/ai/status`);
  },

  /**
   * Solicita propuestas de IA para operaciones incompletas
   */
  proposeOperations: (projectId, operationIds = [], options = {}) => {
    return request(`/projects/${projectId}/codegen/ai/propose-operations`, {
      method: 'POST',
      body: { operationIds, useLiveAi: options.useLiveAi === true }
    });
  },

  /**
   * Solicita propuestas de vinculación de mockups a la API
   */
  proposeBindings: (projectId, screenIds = [], options = {}) => {
    return request(`/projects/${projectId}/codegen/ai/propose-bindings`, {
      method: 'POST',
      body: { screenIds, useLiveAi: options.useLiveAi === true }
    });
  },

  /**
   * Aprueba o rechaza una propuesta generada por IA
   */
  reviewProposal: (projectId, { proposalId, status, notes = '' }) => {
    return request(`/projects/${projectId}/codegen/ai/review-proposal`, {
      method: 'POST',
      body: { proposalId, status, notes }
    });
  },

  /**
   * Aplica las propuestas aprobadas a la especificación del proyecto
   */
  applyApprovedProposals: (projectId) => {
    return request(`/projects/${projectId}/codegen/ai/apply`, {
      method: 'POST',
      body: {}
    });
  },

  /**
   * Inicia un trabajo persistente de generación asistida por IA
   */
  startGenerationJob: (projectId, options = {}) => {
    return request(`/projects/${projectId}/codegen/jobs/start`, {
      method: 'POST',
      body: options
    });
  },

  /**
   * Obtiene el trabajo activo de generación para un proyecto
   */
  getActiveJob: (projectId) => {
    return request(`/projects/${projectId}/codegen/jobs/active`);
  },

  /**
   * Obtiene el estado y logs de un trabajo de generación específico
   */
  getJobStatus: (projectId, jobId) => {
    return request(`/projects/${projectId}/codegen/jobs/${jobId}`);
  },

  /**
   * Envía la respuesta a una pregunta de aclaración de negocio
   */
  submitJobInput: (projectId, jobId, submission) => {
    return request(`/projects/${projectId}/codegen/jobs/${jobId}/input`, {
      method: 'POST',
      body: submission
    });
  },

  /**
   * Cancela un trabajo de generación en ejecución
   */
  cancelJob: (projectId, jobId) => {
    return request(`/projects/${projectId}/codegen/jobs/${jobId}/cancel`, {
      method: 'POST',
      body: {}
    });
  },

  reviewAll: (projectId, jobId) => request(`/projects/${projectId}/codegen/jobs/${jobId}/resume`, {
    method: 'POST', body: { batchReview: true }
  }),

  /**
   * Obtiene las decisiones de negocio pendientes para el proyecto
   */
  getPendingDecisions: (projectId) => {
    return request(`/projects/${projectId}/codegen/decisions`);
  },

  /**
   * Guarda directamente una decisión de negocio
   */
  submitDecision: (projectId, submission) => {
    return request(`/projects/${projectId}/codegen/decisions`, {
      method: 'POST',
      body: submission
    });
  }
};
