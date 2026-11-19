/**
 * Transactional lifecycle for companion model resources.
 *
 * Prepare never replaces the active model. Commit is the only operation that
 * swaps it, and destroy invalidates pending tickets and releases owned models.
 * The loader/parser is injected so this module has no dependency on a model
 * format, renderer, network client, or third-party runtime.
 */
export function createCompanionModelLifecycle({ disposeModel } = {}) {
  const release = typeof disposeModel === 'function'
    ? disposeModel
    : async model => {
      if (typeof model?.dispose === 'function') await model.dispose();
    };

  let active = null;
  let destroyed = false;
  let sequence = 0;
  const pending = new Map();

  async function disposeSafely(model) {
    try {
      await release(model);
      return true;
    } catch {
      return false;
    }
  }

  async function prepare(loader) {
    if (destroyed) return { prepared: false, reason: 'destroyed' };
    if (typeof loader !== 'function') return { prepared: false, reason: 'invalid-loader' };

    let candidate;
    try {
      candidate = await loader();
    } catch {
      return { prepared: false, reason: 'prepare-failed' };
    }

    if (!candidate || typeof candidate !== 'object') {
      return { prepared: false, reason: 'invalid-model' };
    }
    if (destroyed) {
      await disposeSafely(candidate);
      return { prepared: false, reason: 'destroyed' };
    }

    const ticket = Object.freeze({ id: ++sequence });
    pending.set(ticket, candidate);
    return { prepared: true, ticket };
  }

  async function commit(ticket) {
    if (destroyed) return { committed: false, reason: 'destroyed' };
    if (!ticket || !pending.has(ticket)) return { committed: false, reason: 'unknown-ticket' };

    const candidate = pending.get(ticket);
    pending.delete(ticket);
    const previous = active;
    active = candidate;

    const previousDisposalFailed = previous && previous !== candidate
      ? !(await disposeSafely(previous))
      : false;

    return { committed: true, previousDisposalFailed };
  }

  async function destroy() {
    if (destroyed) return { destroyed: true, disposedCount: 0 };
    destroyed = true;

    const owned = new Set(pending.values());
    pending.clear();
    if (active) owned.add(active);
    active = null;

    let disposedCount = 0;
    for (const model of owned) {
      if (await disposeSafely(model)) disposedCount += 1;
    }
    return { destroyed: true, disposedCount };
  }

  return {
    prepare,
    commit,
    destroy,
    get active() { return active; },
    get destroyed() { return destroyed; },
    get pendingCount() { return pending.size; },
  };
}
