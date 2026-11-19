INSERT INTO learning_paths (
  id, owner_id, path_id, version, graph_digest, graph_json, created_at
) VALUES (
  'learning-path-smoke', 'owner', 'javascript-foundations', '1.0.0',
  'dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd',
  '{"id":"javascript-foundations","version":"1.0.0","title":"JavaScript Foundations","description":"A beginner path.","nodes":[{"id":"javascript-basics","title":"JavaScript basics","outcomes":["Explain variables"],"prerequisites":[],"difficulty":"beginner","sourceRefs":["https://developer.mozilla.org/en-US/docs/Web/JavaScript"],"contentLicenseStatus":"link-only"},{"id":"javascript-functions","title":"Functions","outcomes":["Define functions"],"prerequisites":["javascript-basics"],"difficulty":"beginner","sourceRefs":["https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Functions"],"contentLicenseStatus":"link-only"}]}',
  '2026-11-17T12:00:00.000Z'
);
