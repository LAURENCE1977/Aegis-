INSERT INTO eval_suites (
  id, owner_id, suite_id, version, suite_digest, suite_json, created_at
) VALUES (
  'eval-suite-smoke', 'owner', 'guardian-regression', '1.0.0',
  'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  '{"id":"guardian-regression","version":"1.0.0","title":"Guardian regression suite","taskType":"reasoning","minimumScore":100,"cases":[{"id":"scope-check","weight":1,"required":true}]}',
  '2026-11-17T12:00:00.000Z'
);

SELECT review_status FROM guardian_resources WHERE id = 'guardian-resource-smoke';
