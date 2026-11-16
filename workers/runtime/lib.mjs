export const JOB_TYPES = Object.freeze(['aegis.health_check']);
export const JOB_STATUSES = Object.freeze(['pending_dispatch', 'queued', 'running', 'succeeded', 'failed']);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function validateJobSubmission(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError('Job submission must be an object.');
  }
  if (input.type !== 'aegis.health_check') {
    throw new TypeError('Unsupported job type.');
  }
  if (!input.payload || typeof input.payload !== 'object' || Array.isArray(input.payload)) {
    throw new TypeError('Job payload must be an object.');
  }
  if (Object.keys(input.payload).length !== 0) {
    throw new TypeError('The health-check job does not accept payload fields.');
  }
  const keys = Object.keys(input);
  if (keys.some((key) => !['type', 'payload'].includes(key))) {
    throw new TypeError('Unexpected job submission fields.');
  }
  return { type: 'aegis.health_check', payload: {} };
}

export function isJobId(value) {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

export function isTerminalJobStatus(status) {
  return status === 'succeeded' || status === 'failed';
}

export function buildHealthCheckResult(env) {
  return {
    ok: true,
    service: 'aegis-runtime',
    checks: {
      database: Boolean(env?.DB && typeof env.DB.prepare === 'function'),
      queue: Boolean(env?.JOBS && typeof env.JOBS.send === 'function'),
    },
  };
}
