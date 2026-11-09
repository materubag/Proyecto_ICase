import { request } from './client';

export const actorsApi = {
  regenerateRelations: async (projectId) => {
    let job=await request(`/projects/${projectId}/actor-relations/regenerate`,{method:'POST'});
    while(job.status==='RUNNING'){
      await new Promise(resolve=>setTimeout(resolve,2000));
      job=await request(`/projects/${projectId}/actor-relations/jobs/${job.jobId}`);
    }
    if(job.status==='FAILED')throw new Error(job.error?.message||'No se pudieron regenerar las relaciones.');
    return job.result;
  },
  getByProject: (projectId) => request(`/projects/${projectId}/actors`),
  create: (projectId, data) => request(`/projects/${projectId}/actors`, { method: 'POST', body: data }),
  update: (id, data) => request(`/actors/${id}`, { method: 'PUT', body: data }),
  updateStatus: (id, reviewStatus) => request(`/actors/${id}/status`, { method: 'PATCH', body: { reviewStatus } }),
  delete: (id) => request(`/actors/${id}`, { method: 'DELETE' })
};
