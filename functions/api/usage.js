import { authorizeOwner, jsonResponse } from '../lib/owner-api.mjs';
import { buildUsageDashboard } from '../lib/usage-dashboard.mjs';

export async function onRequestGet({ request, env }) {
  const denied = await authorizeOwner(request, env);
  if (denied) return denied;
  if (!env.AEGIS_DB || typeof env.AEGIS_DB.prepare !== 'function') {
    return jsonResponse({ error: 'Usage ledger storage is not configured.' }, 503);
  }

  const now = new Date().toISOString();
  try {
    const result = await env.AEGIS_DB.prepare(`
      SELECT
        w.id, w.provider_id, w.model_id, w.unit_kind,
        w.window_start, w.window_end, w.limit_units, w.source_url,
        w.verified_at, w.status,
        COALESCE(SUM(CASE WHEN r.status = 'settled' THEN r.actual_units ELSE 0 END), 0) AS settled_units,
        COALESCE(SUM(CASE WHEN r.status = 'reserved' THEN r.reserved_units ELSE 0 END), 0) AS reserved_units,
        COUNT(CASE WHEN r.status = 'reserved' THEN 1 END) AS outstanding_reservations
      FROM model_usage_quota_windows w
      LEFT JOIN model_usage_reservations r ON r.quota_window_id = w.id
      WHERE w.status = 'enabled' AND w.unit_kind = 'tokens'
        AND w.window_start <= ? AND w.window_end > ?
      GROUP BY w.id
      ORDER BY w.provider_id ASC, w.model_id ASC
      LIMIT 50
    `).bind(now, now).all();

    if (!result || !Array.isArray(result.results)) {
      throw new Error('Invalid usage window query result');
    }

    const dashboard = buildUsageDashboard({
      windows: result.results,
      reservations: [],
      now,
      paidInferenceApproved: env.AEGIS_PAID_INFERENCE_APPROVED,
      maxTokensPerRun: env.AEGIS_PAID_INFERENCE_MAX_TOKENS_PER_RUN,
      selectedProviderId: env.AEGIS_MODEL_PROVIDER || 'workers-ai',
      selectedModelId: (env.AEGIS_MODEL_PROVIDER || 'workers-ai') === 'anthropic'
        ? (env.AEGIS_ANTHROPIC_MODEL || null)
        : (env.AEGIS_MODEL_PROVIDER || 'workers-ai') === 'alibaba-qwen'
          ? (env.AEGIS_QWEN_MODEL || 'qwen3.8-flash')
          : null,
    });
    return jsonResponse(dashboard);
  } catch {
    return jsonResponse({ error: 'Usage and quota information is temporarily unavailable.' }, 503);
  }
}
