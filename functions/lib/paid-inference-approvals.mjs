import {
  createApprovalRequest,
  consumeApproval,
} from './capability-approvals.mjs';

const MAX_TOKENS_PER_RUN = 100000;
const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const DIGEST = /^sha256:[a-f0-9]{64}$/i;
const TTL_MS = 10 * 60 * 1000;

function validateRequest(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError('Paid inference approval request is required');
  }
  for (const field of ['threadId', 'runId', 'providerId', 'modelId']) {
    if (typeof input[field] !== 'string' || !ID.test(input[field])) {
      throw new TypeError('Invalid paid inference ' + field);
    }
  }
  if (!Number.isSafeInteger(input.estimatedTokens) || input.estimatedTokens < 1 ||
      !Number.isSafeInteger(input.maxTokensPerRun) || input.maxTokensPerRun < 1 ||
      input.maxTokensPerRun > MAX_TOKENS_PER_RUN ||
      input.estimatedTokens > input.maxTokensPerRun) {
    throw new TypeError('Invalid paid inference token ceiling');
  }
  if (typeof input.requestDigest !== 'string' || !DIGEST.test(input.requestDigest)) {
    throw new TypeError('Invalid paid inference request digest');
  }
}

async function sha256(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return 'sha256:' + [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

function mapExisting(row) {
  if (!row) return null;
  return {
    id: row.id,
    status: row.status,
    expiresAt: row.expires_at,
    operationSummary: row.operation_summary,
    resourceId: row.resource_id,
  };
}

/**
 * Build the server-side approval binding. The digest covers the exact run,
 * provider, model, token estimate/ceiling and a digest of the prepared prompt.
 */
export async function buildPaidInferenceApprovalBinding(input) {
  validateRequest(input);
  const canonical = JSON.stringify({
    threadId: input.threadId,
    runId: input.runId,
    providerId: input.providerId,
    modelId: input.modelId,
    estimatedTokens: input.estimatedTokens,
    maxTokensPerRun: input.maxTokensPerRun,
    requestDigest: input.requestDigest.toLowerCase(),
  });
  const inputDigest = await sha256(canonical);
  const resourceId = 'paid-inference:' + inputDigest.slice(7);
  const operationSummary = 'Paid AI run ' + input.runId + ': ' + input.providerId + '/' +
    input.modelId + '; estimated ' + input.estimatedTokens + ' tokens; ceiling ' +
    input.maxTokensPerRun + ' tokens.';
  if (resourceId.length > 256 || operationSummary.length > 500) {
    throw new TypeError('Paid inference approval binding is too long');
  }
  return {
    principalId: 'owner',
    capabilityId: 'paid-inference',
    capabilityVersion: '1.0.0',
    actionId: 'dispatch',
    resourceId,
    operationSummary,
    connectionId: null,
    inputDigest,
    requestedBy: 'owner:ag-ui',
  };
}

/**
 * Return an existing decision for this exact operation, or create one pending
 * owner decision. Existing denied/consumed/expired records are not re-opened.
 */
export async function requestPaidInferenceApproval(db, input, now = Date.now()) {
  if (!db || typeof db.prepare !== 'function') {
    throw new TypeError('Paid inference approval database is required');
  }
  if (!Number.isFinite(now)) throw new TypeError('Invalid paid inference approval clock');
  const binding = await buildPaidInferenceApprovalBinding(input);
  const findExisting = () => db.prepare(`
    SELECT * FROM capability_approvals
    WHERE principal_id = ? AND capability_id = ? AND capability_version = ?
      AND action_id = ? AND resource_id = ? AND input_digest = ?
    ORDER BY requested_at DESC LIMIT 1
  `).bind(
    binding.principalId, binding.capabilityId, binding.capabilityVersion,
    binding.actionId, binding.resourceId, binding.inputDigest,
  ).first();
  const existing = await findExisting();
  if (existing) {
    const approval = mapExisting(existing);
    if (Date.parse(approval.expiresAt) <= now && approval.status === 'pending') {
      return { status: 'expired', approval };
    }
    return { status: approval.status, approval };
  }
  try {
    const approval = await createApprovalRequest(db, {
      ...binding,
      expiresAt: new Date(now + TTL_MS).toISOString(),
    }, now);
    return { status: approval.status, approval };
  } catch (error) {
    // The partial unique index closes the concurrent create race. If another
    // request won, return its exact record instead of creating a second prompt.
    const raced = await findExisting();
    if (raced) {
      const approval = mapExisting(raced);
      return { status: approval.status, approval };
    }
    throw error;
  }
}

/** Consume the owner's decision atomically immediately before paid dispatch. */
export async function digestPaidInferenceRequest(messages, tools = []) {
  if (!Array.isArray(messages) || !Array.isArray(tools)) {
    throw new TypeError('Prepared paid inference messages and tools are required');
  }
  return sha256(JSON.stringify({ messages, tools }));
}

export async function consumePaidInferenceApproval(db, input, now = Date.now()) {
  if (!db || typeof db.prepare !== 'function') {
    throw new TypeError('Paid inference approval database is required');
  }
  if (!Number.isFinite(now)) throw new TypeError('Invalid paid inference approval clock');
  const binding = await buildPaidInferenceApprovalBinding(input);
  const approved = await db.prepare(`
    SELECT id FROM capability_approvals
    WHERE principal_id = ? AND capability_id = ? AND capability_version = ?
      AND action_id = ? AND resource_id = ? AND input_digest = ?
      AND status = 'approved' AND consumed_at IS NULL AND expires_at > ?
    ORDER BY decided_at DESC LIMIT 1
  `).bind(
    binding.principalId, binding.capabilityId, binding.capabilityVersion,
    binding.actionId, binding.resourceId, binding.inputDigest,
    new Date(now).toISOString(),
  ).first();
  if (!approved) return null;
  return consumeApproval(db, {
    id: approved.id,
    ...binding,
    now,
  });
}
