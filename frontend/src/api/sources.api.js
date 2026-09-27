import { request } from './client';

export const sourcesApi = {
  list: (projectId, filters = {}) => {
    const query = new URLSearchParams(filters).toString();
    return request(`/projects/${projectId}/sources${query ? `?${query}` : ''}`);
  },
  uploadPdfs: (projectId, files) => {
    const body = new FormData();
    files.forEach(file => body.append('files', file));
    return request(`/projects/${projectId}/sources`, { method: 'POST', body });
  },
  uploadAudio: (projectId, file) => {
    const body = new FormData();
    body.append('file', file);
    return request(`/projects/${projectId}/sources/audio`, { method: 'POST', body });
  },
  retryAudio: (sourceId, file) => {
    const body = new FormData();
    if (file) body.append('file', file);
    return request(`/sources/${sourceId}/retry`, { method: 'POST', body });
  },
  analyze: (sourceId, data = {}) =>
    request(`/sources/${sourceId}/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }),
  get: (sourceId) => request(`/sources/${sourceId}`),
  getVersion: (sourceId, version) => request(`/sources/${sourceId}/versions/${version}`)
};
