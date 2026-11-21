import { createAgentWorkflowRun } from './agent-workflow-run.mjs';
import { createAgentWorkflowCheckpoint } from './agent-workflow-checkpoint.mjs';
import { canonicalizeInput, digestCanonicalInput } from '../../functions/lib/canonical-input.mjs';

const PRINCIPAL_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:@-]{0,79}$/;
const RUN_PATTERN = /^[a-z0-9][a-z0-9._-]{0,79}$/;
const MAX_CHECKPOINT_BYTES = 32 * 1024;
const MAX_PAGE_SIZE = 100;

function validateText(value, pattern, label) {
  if (typeof value !== 'string' || !pattern.test(value)) {
    throw new TypeError(label + ' is invalid.');
  }
  return value;
}

function validateTimestamp(value, label) {
  if (typeof value !== 'string') throw new TypeError(label + ' must be a canonical UTC timestamp.');
  const date = new Date(value);
  if (!Number.isFinite(date.getTime()) || date.toISOString() !== value) {
    throw new TypeError(label + ' must be a canonical UTC timestamp.');
  }
  return value;
}

function requireDatabase(db) {
  if (!db || typeof db.prepare !== 'function') {
    throw new TypeError('A D1-compatible database binding is required.');
  }
  return db;
}

async function rebuildCheckpoint(run, definition, checkpoint, now) {
  const rebuiltRun = await createAgentWorkflowRun({
    definition,
    runId: run?.runId,
    createdAt: run?.createdAt,
    observedAt: now,
  });
  if (canonicalizeInput(run) !== canonicalizeInput(rebuiltRun)) {
    throw new TypeError('Workflow run envelope does not match its validated definition.');
  }
  const rebuiltCheckpoint = await createAgentWorkflowCheckpoint({
    run,
    definition,
    checkpointId: checkpoint?.checkpointId,
    sequence: checkpoint?.sequence,
    observedAt: checkpoint?.observedAt,
    eventType: checkpoint?.eventType,
    stepId: checkpoint?.stepId,
    evidence: checkpoint?.evidence,
  });
  if (canonicalizeInput(checkpoint) !== canonicalizeInput(rebuiltCheckpoint)) {
    throw new TypeError('Workflow checkpoint failed contract or digest verification.');
  }
  if (Date.parse(checkpoint.observedAt) > Date.parse(now)) {
    throw new RangeError('Checkpoint observation cannot be newer than its server acceptance time.');
  }
  return { rebuiltRun, rebuiltCheckpoint };
}

/**
 * Persist a validated checkpoint under a server-authenticated principal.
 * principalId MUST come from verified server-side identity context, never from
 * a request body, query string, run envelope or agent-supplied metadata.
 */
export async function appendAgentWorkflowCheckpoint({
  db,
  principalId,
  run,
  definition,
  checkpoint,
  now = new Date().toISOString(),
} = {}) {
  requireDatabase(db);
  validateText(principalId, PRINCIPAL_PATTERN, 'Authenticated principal');
  validateText(run?.runId, RUN_PATTERN, 'Workflow run identifier');
  validateTimestamp(now, 'Checkpoint acceptance timestamp');

  const { rebuiltRun, rebuiltCheckpoint } = await rebuildCheckpoint(run, definition, checkpoint, now);
  const checkpointJson = JSON.stringify(rebuiltCheckpoint);
  if (new TextEncoder().encode(checkpointJson).byteLength > MAX_CHECKPOINT_BYTES) {
    throw new RangeError('Workflow checkpoint exceeds the 32 KiB storage limit.');
  }

  const result = await db.prepare(
    'INSERT INTO agent_workflow_checkpoints (principal_id, run_id, sequence, checkpoint_id, workflow_id, definition_digest, checkpoint_digest, checkpoint_json, observed_at) SELECT ?, ?, ?, ?, ?, ?, ?, ?, ? WHERE ? = COALESCE((SELECT MAX(sequence) + 1 FROM agent_workflow_checkpoints WHERE principal_id = ? AND run_id = ?), 1) ON CONFLICT DO NOTHING'
  ).bind(
    principalId,
    rebuiltRun.runId,
    rebuiltCheckpoint.sequence,
    rebuiltCheckpoint.checkpointId,
    rebuiltRun.workflowId,
    rebuiltRun.definitionDigest,
    rebuiltCheckpoint.checkpointDigest,
    checkpointJson,
    rebuiltCheckpoint.observedAt,
    rebuiltCheckpoint.sequence,
    principalId,
    rebuiltRun.runId,
  ).run();

  if (Number(result?.meta?.changes || 0) === 1) {
    return Object.freeze({
      schemaVersion: 'aegis.agent-workflow-checkpoint-persistence.v1',
      status: 'appended',
      principalId,
      runId: rebuiltRun.runId,
      sequence: rebuiltCheckpoint.sequence,
      checkpointDigest: rebuiltCheckpoint.checkpointDigest,
    });
  }

  const existing = await db.prepare(
    'SELECT principal_id, run_id, sequence, checkpoint_id, workflow_id, definition_digest, checkpoint_digest, checkpoint_json, observed_at FROM agent_workflow_checkpoints WHERE principal_id = ? AND run_id = ? AND checkpoint_id = ?'
  ).bind(principalId, rebuiltRun.runId, rebuiltCheckpoint.checkpointId).first();

  if (existing) {
    if (existing.checkpoint_digest === rebuiltCheckpoint.checkpointDigest &&
        existing.checkpoint_json === checkpointJson &&
        existing.sequence === rebuiltCheckpoint.sequence) {
      return Object.freeze({
        schemaVersion: 'aegis.agent-workflow-checkpoint-persistence.v1',
        status: 'already_recorded',
        principalId,
        runId: rebuiltRun.runId,
        sequence: rebuiltCheckpoint.sequence,
        checkpointDigest: rebuiltCheckpoint.checkpointDigest,
      });
    }
    throw new Error('Checkpoint identifier already exists with different immutable content.');
  }

  const next = await db.prepare(
    'SELECT COALESCE(MAX(sequence), 0) + 1 AS next_sequence FROM agent_workflow_checkpoints WHERE principal_id = ? AND run_id = ?'
  ).bind(principalId, rebuiltRun.runId).first();

  return Object.freeze({
    schemaVersion: 'aegis.agent-workflow-checkpoint-persistence.v1',
    status: 'sequence_conflict',
    principalId,
    runId: rebuiltRun.runId,
    expectedNextSequence: Number(next?.next_sequence || 1),
    suppliedSequence: rebuiltCheckpoint.sequence,
  });
}

/** Read and integrity-check one principal's ordered checkpoint history. */
export async function listAgentWorkflowCheckpoints({
  db,
  principalId,
  runId,
  afterSequence = 0,
  limit = 25,
} = {}) {
  requireDatabase(db);
  validateText(principalId, PRINCIPAL_PATTERN, 'Authenticated principal');
  validateText(runId, RUN_PATTERN, 'Workflow run identifier');
  if (!Number.isSafeInteger(afterSequence) || afterSequence < 0) {
    throw new TypeError('Checkpoint history cursor must be a non-negative safe integer.');
  }
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_PAGE_SIZE) {
    throw new TypeError('Checkpoint history page size must be between 1 and 100.');
  }

  const result = await db.prepare(
    'SELECT principal_id, run_id, sequence, checkpoint_id, workflow_id, definition_digest, checkpoint_digest, checkpoint_json, observed_at FROM agent_workflow_checkpoints WHERE principal_id = ? AND run_id = ? AND sequence > ? ORDER BY sequence ASC LIMIT ?'
  ).bind(principalId, runId, afterSequence, limit + 1).all();
  const rows = result.results || [];
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const checkpoints = [];

  for (let index = 0; index < page.length; index += 1) {
    const row = page[index];
    let checkpoint;
    try {
      checkpoint = JSON.parse(row.checkpoint_json);
    } catch {
      throw new Error('Stored workflow checkpoint is not valid JSON.');
    }
    const { checkpointDigest, ...unsigned } = checkpoint || {};
    const actualDigest = await digestCanonicalInput(unsigned);
    if (row.principal_id !== principalId ||
        row.run_id !== runId ||
        row.sequence !== checkpoint.sequence ||
        row.checkpoint_id !== checkpoint.checkpointId ||
        row.workflow_id !== checkpoint.workflowId ||
        row.definition_digest !== checkpoint.definitionDigest ||
        row.checkpoint_digest !== checkpointDigest ||
        row.observed_at !== checkpoint.observedAt ||
        checkpoint.schemaVersion !== 'aegis.agent-workflow-checkpoint.v1' ||
        actualDigest !== checkpointDigest) {
      throw new Error('Stored workflow checkpoint failed integrity or ownership verification.');
    }
    if (checkpoint.sequence !== afterSequence + index + 1) {
      throw new Error('Stored workflow checkpoint history contains a sequence gap.');
    }
    checkpoints.push(Object.freeze(checkpoint));
  }

  return Object.freeze({
    checkpoints: Object.freeze(checkpoints),
    nextAfterSequence: checkpoints.length ? checkpoints[checkpoints.length - 1].sequence : afterSequence,
    hasMore,
  });
}
