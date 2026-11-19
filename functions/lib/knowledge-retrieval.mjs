const TOKEN_PATTERN = /[\p{L}\p{N}]+/gu;
const STATUSES = new Set(['draft', 'reviewed', 'accepted', 'superseded']);

function tokens(value) {
  return value.normalize('NFKC').toLocaleLowerCase('und').match(TOKEN_PATTERN) || [];
}

function validateChunk(chunk) {
  if (!chunk || typeof chunk !== 'object' || Array.isArray(chunk) ||
      typeof chunk.id !== 'string' || !chunk.id.trim() ||
      typeof chunk.text !== 'string' || !chunk.text.trim() ||
      typeof chunk.sourceId !== 'string' || !chunk.sourceId.trim() ||
      !Number.isSafeInteger(chunk.startOffset) || chunk.startOffset < 0 ||
      !Number.isSafeInteger(chunk.endOffset) || chunk.endOffset < chunk.startOffset ||
      !STATUSES.has(chunk.status) ||
      (chunk.sourcePath !== undefined && typeof chunk.sourcePath !== 'string') ||
      (chunk.headingPath !== undefined &&
        (!Array.isArray(chunk.headingPath) || chunk.headingPath.some(item => typeof item !== 'string')))) {
    throw new TypeError('Invalid knowledge chunk record');
  }
}

function termFrequencies(items) {
  const frequencies = new Map();
  for (const item of items) frequencies.set(item, (frequencies.get(item) || 0) + 1);
  return frequencies;
}

/**
 * Deterministic lexical BM25 retrieval over caller-authorized, reviewed evidence.
 * Owner/capability scoping must happen before candidates reach this function.
 * Draft, superseded and merely reviewed material is excluded by default.
 */
export function rankKnowledgeChunks(query, chunks, options = {}) {
  if (typeof query !== 'string' || query.length > 500 ||
      /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(query)) {
    throw new TypeError('Invalid knowledge search query');
  }
  if (!Array.isArray(chunks) || chunks.length > 10000) {
    throw new TypeError('Invalid knowledge chunk collection');
  }
  if (!options || typeof options !== 'object' || Array.isArray(options) ||
      Object.keys(options).some(key => key !== 'limit')) {
    throw new TypeError('Invalid knowledge retrieval options');
  }
  const limit = options.limit === undefined ? 10 : options.limit;
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new TypeError('Invalid knowledge retrieval limit');
  }

  for (const chunk of chunks) validateChunk(chunk);
  const queryTerms = [...new Set(tokens(query))].sort();
  if (queryTerms.length === 0) return [];

  const accepted = chunks.filter(chunk => chunk.status === 'accepted');
  if (accepted.length === 0) return [];
  const documents = accepted.map(chunk => ({ chunk, terms: tokens(chunk.text) }));
  const averageLength = documents.reduce((sum, document) => sum + document.terms.length, 0) /
    Math.max(1, documents.length);
  const documentFrequency = new Map(queryTerms.map(term => [
    term,
    documents.reduce((count, document) => count + (document.terms.includes(term) ? 1 : 0), 0),
  ]));

  const k1 = 1.2;
  const b = 0.75;
  const ranked = [];
  for (const document of documents) {
    const frequencies = termFrequencies(document.terms);
    const matchedTerms = queryTerms.filter(term => frequencies.has(term));
    if (matchedTerms.length === 0) continue;
    let score = 0;
    for (const term of matchedTerms) {
      const frequency = frequencies.get(term);
      const df = documentFrequency.get(term);
      const inverseDocumentFrequency = Math.log(1 + (documents.length - df + 0.5) / (df + 0.5));
      const denominator = frequency + k1 * (1 - b + b * document.terms.length / Math.max(1, averageLength));
      score += inverseDocumentFrequency * (frequency * (k1 + 1)) / denominator;
    }
    ranked.push({
      id: document.chunk.id,
      text: document.chunk.text,
      sourceId: document.chunk.sourceId,
      ...(document.chunk.sourcePath === undefined ? {} : { sourcePath: document.chunk.sourcePath }),
      startOffset: document.chunk.startOffset,
      endOffset: document.chunk.endOffset,
      headingPath: document.chunk.headingPath || [],
      score,
      matchedTerms,
    });
  }

  ranked.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  return ranked.slice(0, limit);
}
