UPDATE forge_candidates
SET licence_review = 'verified',
    decision = 'adapt',
    status = 'approved',
    metadata_json = json_set(
      metadata_json,
      '$.licenceReviewHistory',
      json_array(json_object(
        'reviewedAt', '2026-11-16T00:01:00.000Z',
        'reviewer', 'owner',
        'licenceReview', 'verified',
        'evidenceUrl', 'https://github.com/example/repo/blob/main/LICENSE',
        'attested', 1,
        'note', 'Owner reviewed the exact upstream licence text.',
        'decision', 'adapt',
        'status', 'approved'
      ))
    ),
    updated_at = '2026-11-16T00:01:00.000Z'
WHERE id = 'forge-smoke' AND owner_id = 'owner';

UPDATE forge_knowledge_records
SET status = 'reviewed',
    review_note = 'Owner checked the cited source, evidence and stated limitations.',
    reviewer_id = 'owner',
    reviewed_at = '2026-11-16T00:01:00.000Z',
    updated_at = '2026-11-16T00:01:00.000Z',
    version = version + 1
WHERE id = 'knowledge-smoke' AND owner_id = 'owner' AND status = 'draft';

UPDATE forge_knowledge_records
SET status = 'accepted',
    review_note = 'Evidence is reproducible and suitable for internal reference.',
    reviewer_id = 'owner',
    accepted_at = '2026-11-16T00:02:00.000Z',
    updated_at = '2026-11-16T00:02:00.000Z',
    version = version + 1
WHERE id = 'knowledge-smoke' AND owner_id = 'owner' AND status = 'reviewed';
