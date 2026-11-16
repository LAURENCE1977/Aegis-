INSERT INTO capability_invocation_limits (
  principal_id, capability_id, action_id, window_start_ms, request_count, updated_at
) VALUES (
  'rate-test-owner', 'aegis-github-public-discovery', 'discover',
  1794787200000, 1, '2026-11-16T00:00:00.000Z'
)
ON CONFLICT (principal_id, capability_id, action_id, window_start_ms)
DO UPDATE SET request_count = capability_invocation_limits.request_count + 1,
  updated_at = excluded.updated_at
WHERE capability_invocation_limits.request_count < 2;

INSERT INTO capability_invocation_limits (
  principal_id, capability_id, action_id, window_start_ms, request_count, updated_at
) VALUES (
  'rate-test-owner', 'aegis-github-public-discovery', 'discover',
  1794787200000, 1, '2026-11-16T00:00:01.000Z'
)
ON CONFLICT (principal_id, capability_id, action_id, window_start_ms)
DO UPDATE SET request_count = capability_invocation_limits.request_count + 1,
  updated_at = excluded.updated_at
WHERE capability_invocation_limits.request_count < 2;

INSERT INTO capability_invocation_limits (
  principal_id, capability_id, action_id, window_start_ms, request_count, updated_at
) VALUES (
  'rate-test-owner', 'aegis-github-public-discovery', 'discover',
  1794787200000, 1, '2026-11-16T00:00:02.000Z'
)
ON CONFLICT (principal_id, capability_id, action_id, window_start_ms)
DO UPDATE SET request_count = capability_invocation_limits.request_count + 1,
  updated_at = excluded.updated_at
WHERE capability_invocation_limits.request_count < 2;

CREATE TABLE IF NOT EXISTS capability_rate_limit_assertion (
  ok INTEGER NOT NULL CHECK (ok = 1)
);

INSERT INTO capability_rate_limit_assertion (ok)
SELECT CASE WHEN request_count = 2 THEN 1 ELSE 0 END
FROM capability_invocation_limits
WHERE principal_id = 'rate-test-owner'
  AND capability_id = 'aegis-github-public-discovery'
  AND action_id = 'discover'
  AND window_start_ms = 1794787200000;
