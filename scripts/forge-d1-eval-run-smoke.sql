INSERT INTO eval_runs (
  id, owner_id, run_id, suite_id, suite_version, suite_digest,
  candidate_id, candidate_version, candidate_digest, status, score_percent,
  result_digest, result_json, completed_at, recorded_at
) VALUES (
  'eval-run-smoke', 'owner', 'run-smoke', 'guardian-regression', '1.0.0',
  'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  'agent-aegis', '0.4.0',
  'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
  'passed', 100,
  'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
  '{"id":"run-smoke","suiteId":"guardian-regression","suiteVersion":"1.0.0","candidateId":"agent-aegis","candidateVersion":"0.4.0","candidateDigest":"cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc","status":"passed","scorePercent":100,"evidenceVerified":true}',
  '2026-11-17T12:10:00.000Z', '2026-11-17T12:11:00.000Z'
);
