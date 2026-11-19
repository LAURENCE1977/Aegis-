SELECT COUNT(*) AS assessment_count
FROM learning_assessments
WHERE owner_id = 'owner' AND assessment_id = 'assessment-smoke-check';

SELECT COUNT(*) AS registration_events
FROM learning_assessment_events
WHERE owner_id = 'owner' AND assessment_id = 'assessment-smoke-check'
  AND event_type = 'registered';

SELECT assessment_id, version, path_id, path_version, node_id
FROM learning_assessments
WHERE id = 'learning-assessment-smoke';
