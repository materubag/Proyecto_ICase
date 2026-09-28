import { request } from './client';
export const engineering = (projectId, path = '', body, method = 'POST') => request(`/projects/${projectId}/engineering${path}`, body === undefined ? {} : { method, body });
