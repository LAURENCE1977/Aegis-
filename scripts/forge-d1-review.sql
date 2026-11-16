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
