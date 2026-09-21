import { request } from './client';

export const mockupApi = {
  generateMockup: (projectId, prompt = '') =>
    request(`/projects/${projectId}/mockup`, {
      method: 'POST',
      body: { prompt }
    })
};
