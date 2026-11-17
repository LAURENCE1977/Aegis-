import { chunkMarkdownDocument } from './knowledge-chunking.mjs';

const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const MAX_SOURCE_PATH = 240;

function hasControlCharacters(value) {
  return [...value].some(character => {
    const code = character.charCodeAt(0);
    return code <= 0x1f || code === 0x7f;
  });
}

function validateSourcePath(value) {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || !value || value.length > MAX_SOURCE_PATH ||
      value.startsWith('/') || value.includes('\\\\') ||
      hasControlCharacters(value) ||
      value.split('/').some(part => !part || part === '.' || part === '..')) {
    throw new TypeError('Invalid knowledge source path');
  }
  return value;
}

async function digestText(value) {
  if (!globalThis.crypto?.subtle || typeof globalThis.TextEncoder !== 'function') {
    throw new Error('Secure document digest support is unavailable');
  }
  const bytes = new TextEncoder().encode(value);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Compile extracted document text into source-addressable chunks.
 * New compilations are always drafts; review transitions belong to the Knowledge Library.
 * This function does not persist content or execute it.
 */
export async function compileKnowledgeDocument(document, options = {}) {
  if (!document || typeof document !== 'object' || Array.isArray(document) ||
      Object.keys(document).some(key => !['sourceId', 'sourcePath', 'content', 'status'].includes(key))) {
    throw new TypeError('Invalid knowledge document fields');
  }
  if (typeof document.sourceId !== 'string' || !ID_PATTERN.test(document.sourceId)) {
    throw new TypeError('Invalid knowledge source ID');
  }
  if (typeof document.content !== 'string' || !document.content.trim()) {
    throw new TypeError('Invalid knowledge document content');
  }
  const sourcePath = validateSourcePath(document.sourcePath);
  if (document.status !== undefined && document.status !== 'draft') {
    throw new TypeError('Knowledge compilation must start as a draft');
  }
  if (!options || typeof options !== 'object' || Array.isArray(options) ||
      Object.keys(options).some(key => key !== 'maxChars')) {
    throw new TypeError('Invalid knowledge compilation options');
  }

  const contentDigest = await digestText(document.content);
  const chunks = chunkMarkdownDocument(document.content, {
    ...(options.maxChars === undefined ? {} : { maxChars: options.maxChars }),
  }).map(chunk => ({
    ...chunk,
    id: document.sourceId + ':' + chunk.id,
    sourceId: document.sourceId,
    ...(sourcePath === undefined ? {} : { sourcePath }),
    contentDigest,
    status: 'draft',
  }));

  return {
    schemaVersion: '1.0.0',
    sourceId: document.sourceId,
    ...(sourcePath === undefined ? {} : { sourcePath }),
    contentDigest,
    status: 'draft',
    chunkCount: chunks.length,
    chunks,
    execution: 'none',
    persisted: false,
  };
}
