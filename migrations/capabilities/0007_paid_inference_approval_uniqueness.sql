-- A single active approval may exist for one exact paid inference operation.
-- The binding includes run, provider, model, token ceiling and prompt digest.
CREATE UNIQUE INDEX IF NOT EXISTS idx_paid_inference_approval_exact_active
  ON capability_approvals (
    principal_id, capability_id, capability_version, action_id, resource_id, input_digest
  )
  WHERE capability_id = 'paid-inference' AND status IN ('pending', 'approved');
