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
  analyze: async (sourceId, data = {}) => {
    let job=await request('/sources/'+sourceId+'/analyze',{method:'POST',body:{...data,async:true}});
    if(!job.jobId)return job;
    while(job.status==='RUNNING'){
      await new Promise(resolve=>setTimeout(resolve,2000));
      job=await request('/sources/'+sourceId+'/analysis/'+job.jobId);
    }
    if(job.status==='FAILED')throw new Error(job.error?.message || 'Error analizando fuente');
    return job.result;
  },
  get: (sourceId) => request(`/sources/${sourceId}`),
  getVersion: (sourceId, version) => request(`/sources/${sourceId}/versions/${version}`)
};
