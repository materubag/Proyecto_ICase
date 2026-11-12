import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Rate } from 'k6/metrics';

const artifactGenerationTrend = new Trend('artifact_generation_duration_ms', true);
const artifactErrorRate = new Rate('artifact_error_rate');

export const options = {
  vus: 2,
  duration: '10s',
  thresholds: {
    artifact_generation_duration_ms: ['p(95)<500'], // 95% under 500ms
    http_req_failed: ['rate<0.02'],
    artifact_error_rate: ['rate<0.02'],
  },
};

const BASE_URL = __ENV.TARGET_URL || 'http://host.docker.internal:8080';

// Initialize a project per VU to prevent optimistic concurrency collisions
export function setup() {
  const headers = { 'Content-Type': 'application/json' };
  const projects = [];

  for (let i = 0; i < 2; i++) {
    const projRes = http.post(`${BASE_URL}/api/projects`, JSON.stringify({
      name: `k6-artifacts-p${i}-${Date.now()}`,
      description: `Proyecto dedicado a VU ${i}`
    }), { headers });

    const proj = JSON.parse(projRes.body).data;

    // Create and approve requirement
    const reqRes = http.post(`${BASE_URL}/api/projects/${proj.id}/requirements`, JSON.stringify({
      code: `RF-k6-${i}`,
      name: `Requisito k6 VU ${i}`,
      description: 'Descripción de prueba para generación de artefactos.',
      status: 'APPROVED'
    }), { headers });
    const req = JSON.parse(reqRes.body).data;

    // Create and approve model candidate
    const modelRes = http.post(`${BASE_URL}/api/projects/${proj.id}/engineering/models`, JSON.stringify({
      kind: 'Entity',
      content: { name: `EntidadVU${i}`, description: 'Entidad de prueba' },
      requirementIds: [req.id]
    }), { headers });
    const model = JSON.parse(modelRes.body).data;

    http.patch(`${BASE_URL}/api/projects/${proj.id}/engineering/models/${model.id}`, JSON.stringify({
      status: 'APPROVED'
    }), { headers });

    projects.push(proj.id);
  }

  return { projects };
}

export default function (data) {
  const headers = { 'Content-Type': 'application/json' };
  // Each VU operates on its own dedicated project
  const projectId = data.projects[__VU - 1] || data.projects[0];

  // 1. Generate ER diagram
  const start = Date.now();
  const diagramRes = http.post(
    `${BASE_URL}/api/projects/${projectId}/engineering/diagrams`,
    JSON.stringify({ type: 'ER_DIAGRAM' }),
    { headers }
  );
  const elapsed = Date.now() - start;
  artifactGenerationTrend.add(elapsed);

  const ok = check(diagramRes, {
    'diagram generation status 200': (r) => r.status === 200,
    'diagram response has artifact': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.success === true && (body.data.artifact || body.data.id || body.data.type);
      } catch (e) {
        return false;
      }
    }
  });
  artifactErrorRate.add(!ok);

  // 2. Query workspace engineering state
  const engRes = http.get(`${BASE_URL}/api/projects/${projectId}/engineering`);
  check(engRes, {
    'engineering query status 200': (r) => r.status === 200,
  });

  sleep(1);
}

export function teardown(data) {
  const headers = { 'Content-Type': 'application/json' };
  if (data && data.projects) {
    for (const pid of data.projects) {
      http.put(`${BASE_URL}/api/projects/${pid}`, JSON.stringify({ status: 'ARCHIVED' }), { headers });
    }
  }
}
