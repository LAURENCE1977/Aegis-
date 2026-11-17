import { chunkMarkdownDocument } from './knowledge-chunking.mjs';

const STATUSES = new Set(['draft', 'reviewed', 'accepted', 'superseded']);
const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const MAX_SOURCE_PATH = 240;

function hasControlCharacters(value) {\n  return [...value].some(character => {\n    const code = character.charCodeAt(0);\n    return code <= 0x1f || code === 0x7f;\n  });\n}\n\nfunction validateSourcePath(value) {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || !value || value.length > MAX_SOURCE_PATH ||
      value.startsWith('/') || value.includes('\\') ||
      /[\\u0000-\\u001f\\u007f]/.test(value) ||
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
 * Compile already-extracted document text into source-addressable chunks.
 * This function does not persist content, accept/promote knowledge, or execute it.
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
  const status = document.status === undefined ? 'draft' : document.status;
  if (!STATUSES.has(status) || status !== 'draft') {
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
    status,
  }));

  return {
    schemaVersion: '1.0.0',
    sourceId: document.sourceId,
    ...(sourcePath === undefined ? {} : { sourcePath }),
    contentDigest,
    status,
    chunkCount: chunks.length,
    chunks,
    execution: 'none',
    persisted: false,
  };
}
