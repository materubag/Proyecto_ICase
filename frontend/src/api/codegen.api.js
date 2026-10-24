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
   * Descarga el archivo .zip directamente en el navegador
   */
  downloadZip: async (projectId, includeDocker = true, defaultFilename = 'proyecto-api.zip') => {
    const url = `${BASE_URL}/projects/${projectId}/codegen/download?includeDocker=${includeDocker}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Error al descargar el archivo ZIP (HTTP ${response.status})`);
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
  }
};
