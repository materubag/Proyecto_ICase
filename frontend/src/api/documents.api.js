import { request } from './client';

export const documentsApi = {
  /**
   * Extrae texto y metadatos desde un archivo PDF
   * @param {File} file
   */
  extract: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return request('/documents/extract', {
      method: 'POST',
      body: formData
    });
  },

  /**
   * Ejecuta el análisis estructurado de IA/Ollama
   * @param {File|Object} fileOrData
   */
  analyze: (fileOrData) => {
    if (fileOrData instanceof File) {
      const formData = new FormData();
      formData.append('file', fileOrData);
      return request('/documents/analyze', {
        method: 'POST',
        body: formData
      });
    }
    return request('/documents/analyze', {
      method: 'POST',
      body: { extractionData: fileOrData }
    });
  },

  /**
   * Importa y persiste el análisis estructurado en PostgreSQL
   * @param {string} projectId
   * @param {Object} analysisData
   */
  importAnalysis: (projectId, analysisData) => {
    return request(`/projects/${projectId}/import-analysis`, {
      method: 'POST',
      body: { analysisData }
    });
  }
};
