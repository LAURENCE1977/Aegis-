import { listModules } from './modules.mjs';

/**
 * First-party, local-only adapter set.
 *
 * These handlers do not access the network, secrets, files or process APIs.
 * They are descriptive read-only capabilities, not permission grants.
 */
export function createBuiltinAdapterRegistry() {
  return Object.freeze({
    'aegis-module-catalogue:list': async (input) => {
      if (!input || typeof input !== 'object' || Array.isArray(input) ||
          Object.keys(input).length !== 0) {
        throw new TypeError('Module catalogue adapter does not accept input');
      }
      const modules = listModules();
      return { modules, total: modules.length };
    },
  });
}
