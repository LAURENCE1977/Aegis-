import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateCandidateRecord,
  validateKnowledgeRecord,
} from '../functions/lib/forge-records.mjs';

const candidate = {
  id: 'open-source-code-agent',
  sourceType: 'repository',
  sourceUrl: 'https://github.com/example/code-agent',
  version: 'abc123',
  licence: { identifier: 'MIT', review: 'verified' },
  decision: 'adapt',
  status: 'assessed',
  capabilities: ['code.plan', 'code.review'],
  dependencies: ['node>=22'],
  evidence: [{ url: 'https://github.com/example/code-agent/blob/main/README.md', note: 'Project documentation' }],
};

const knowledge = {
  id: 'agentic-coding-evaluation',
  title: 'Evaluating agentic coding systems',
  domain: 'coding-agents',
  knowledgeType: 'benchmark',
  summary: 'Evaluate coding agents against reproducible repository tasks.',
  evidenceLevel: 'high',
  status: 'reviewed',
  sources: [{ url: 'https://example.org/paper', title: 'Evaluation paper', attribution: 'Example authors' }],
  limitations: ['Benchmark scores do not guarantee production reliability'],
  applicableCapabilities: ['benchmark.compare', 'code.test'],
};

test('candidate records accept a versioned, attributed source with a reviewed licence', () => {
  assert.equal(validateCandidateRecord(candidate), true);
});

test('candidate records reject unsafe URLs and unknown decision values', () => {
  assert.throws(() => validateCandidateRecord({ ...candidate, sourceUrl: 'javascript:alert(1)' }));
  assert.throws(() => validateCandidateRecord({ ...candidate, decision: 'copy-everything' }));
});

test('candidate records require licence review before a reuse or adaptation decision', () => {
  assert.throws(() => validateCandidateRecord({
    ...candidate,
    licence: { identifier: 'unknown', review: 'review-required' },
  }));
});

test('candidate records reject duplicate capabilities and malformed evidence references', () => {
  assert.throws(() => validateCandidateRecord({ ...candidate, capabilities: ['code.read', 'code.read'] }));
  assert.throws(() => validateCandidateRecord({
    ...candidate,
    evidence: [{ url: 'file:///etc/passwd', note: 'bad source' }],
  }));
});

test('knowledge records accept sourced findings with evidence levels and limitations', () => {
  assert.equal(validateKnowledgeRecord(knowledge), true);
});

test('knowledge records require at least one attributable source', () => {
  assert.throws(() => validateKnowledgeRecord({ ...knowledge, sources: [] }));
  assert.throws(() => validateKnowledgeRecord({
    ...knowledge,
    sources: [{ url: 'https://example.org/paper', title: 'Paper' }],
  }));
});

test('knowledge records reject unsupported evidence levels and unsafe source URLs', () => {
  assert.throws(() => validateKnowledgeRecord({ ...knowledge, evidenceLevel: 'guaranteed' }));
  assert.throws(() => validateKnowledgeRecord({
    ...knowledge,
    sources: [{ url: 'http://example.org/paper', title: 'Paper', attribution: 'Author' }],
  }));
});
