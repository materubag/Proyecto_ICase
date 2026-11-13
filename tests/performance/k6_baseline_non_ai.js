import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Rate } from 'k6/metrics';

// Custom metrics
const healthDuration = new Trend('health_req_duration', true);
const projectListDuration = new Trend('project_list_duration', true);
const errorRate = new Rate('custom_error_rate');

export const options = {
  stages: [
    { duration: '3s', target: 5 },   // Ramp up to 5 VUs
    { duration: '8s', target: 10 },  // Stay at 10 VUs
    { duration: '3s', target: 0 },   // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<300'], // 95% of requests under 300ms
    http_req_failed: ['rate<0.01'],    // Errors below 1%
    custom_error_rate: ['rate<0.01'],
  },
};

const BASE_URL = __ENV.TARGET_URL || 'http://host.docker.internal:8080';

export default function () {
  // 1. Health check
  const healthRes = http.get(`${BASE_URL}/api/health`);
  healthDuration.add(healthRes.timings.duration);
  const healthOk = check(healthRes, {
    'health returns 200': (r) => r.status === 200,
    'health status is UP': (r) => {
      try {
        return JSON.parse(r.body).data.status === 'UP';
      } catch (e) {
        return false;
      }
    },
  });
  errorRate.add(!healthOk);

  // 2. Project List
  const listRes = http.get(`${BASE_URL}/api/projects`);
  projectListDuration.add(listRes.timings.duration);
  const listOk = check(listRes, {
    'projects list returns 200': (r) => r.status === 200,
  });
  errorRate.add(!listOk);

  // 3. Project Creation & Retrieval
  const payload = JSON.stringify({
    name: `k6-test-p-${__VU}-${__ITER}-${Date.now()}`,
    description: 'Proyecto temporal para prueba de carga k6',
  });
  const headers = { 'Content-Type': 'application/json' };

  const createRes = http.post(`${BASE_URL}/api/projects`, payload, { headers });
  const createOk = check(createRes, {
    'create project returns 201 or 200': (r) => r.status === 200 || r.status === 201,
  });
  errorRate.add(!createOk);

  if (createOk) {
    try {
      const proj = JSON.parse(createRes.body).data;
      if (proj && proj.id) {
        // Read project detail
        const detailRes = http.get(`${BASE_URL}/api/projects/${proj.id}`);
        check(detailRes, {
          'project detail returns 200': (r) => r.status === 200,
        });

        // Archive/Cleanup project
        http.put(`${BASE_URL}/api/projects/${proj.id}`, JSON.stringify({ status: 'ARCHIVED' }), { headers });
      }
    } catch (e) {}
  }

  sleep(0.5);
}

