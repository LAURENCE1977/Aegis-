const DEFAULT_MAX_CHARS = 1200;
const MAX_CHARS = 8192;
const MAX_DOCUMENT_CHARS = 2 * 1024 * 1024;

function lineAt(source, offset) {
  let line = 1;
  for (let index = 0; index < offset; index += 1) {
    if (source.charCodeAt(index) === 10) line += 1;
  }
  return line;
}

function splitOversizedBlock(source, startOffset, endOffset, maxChars, headingPath) {
  const tokens = [];
  const text = source.slice(startOffset, endOffset);
  for (const match of text.matchAll(/\S+/g)) {
    tokens.push({ start: startOffset + match.index, end: startOffset + match.index + match[0].length });
  }
  const chunks = [];
  let first = 0;
  while (first < tokens.length) {
    let last = first;
    while (last + 1 < tokens.length && tokens[last + 1].end - tokens[first].start <= maxChars) last += 1;
    if (tokens[last].end - tokens[first].start > maxChars) {
      let offset = tokens[first].start;
      while (offset < tokens[first].end) {
        const end = Math.min(offset + maxChars, tokens[first].end);
        chunks.push({ startOffset: offset, endOffset: end, headingPath: [...headingPath] });
        offset = end;
      }
    } else {
      chunks.push({ startOffset: tokens[first].start, endOffset: tokens[last].end, headingPath: [...headingPath] });
    }
    first = last + 1;
  }
  return chunks;
}

function collectBlocks(source) {
  const blocks = [];
  const headingStack = [];
  let offset = 0;
  let blockStart = null;
  let blockEnd = null;
  let fence = null;
  const flush = () => {
    if (blockStart !== null && blockEnd > blockStart) {
      blocks.push({ startOffset: blockStart, endOffset: blockEnd, headingPath: headingStack.map(item => item.title) });
    }
    blockStart = null;
    blockEnd = null;
  };

  for (const lineWithEnding of source.match(/[^\n]*(?:\n|$)/g) || []) {
    if (!lineWithEnding) continue;
    const line = lineWithEnding.endsWith('\n') ? lineWithEnding.slice(0, -1) : lineWithEnding;
    const lineStart = offset;
    const lineEnd = lineStart + line.length;
    offset += lineWithEnding.length;
    const fenceMatch = line.match(/^\s*([\x60]{3,}|~{3,})/);
    if (fence) {
      if (blockStart === null) blockStart = lineStart;
      blockEnd = lineEnd;
      if (fenceMatch && fenceMatch[1][0] === fence.char && fenceMatch[1].length >= fence.length) fence = null;
      continue;
    }
    if (fenceMatch) {
      if (blockStart === null) blockStart = lineStart;
      blockEnd = lineEnd;
      fence = { char: fenceMatch[1][0], length: fenceMatch[1].length };
      continue;
    }
    const heading = line.match(/^\s{0,3}(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (heading) {
      flush();
      const level = heading[1].length;
      headingStack.splice(level - 1);
      headingStack[level - 1] = { title: heading[2].trim() };
      continue;
    }
    if (!line.trim()) {
      flush();
      continue;
    }
    if (blockStart === null) blockStart = lineStart;
    blockEnd = lineEnd;
  }
  flush();
  return blocks;
}

/**
 * Structure-aware Markdown chunking with exact character and line provenance.
 * Overlap is deliberately disabled so evidence spans remain unambiguous.
 */
export function chunkMarkdownDocument(source, options = {}) {
  if (typeof source !== 'string' || source.length === 0 || source.length > MAX_DOCUMENT_CHARS) {
    throw new TypeError('Invalid document text or document exceeds the 2 MiB limit');
  }
  if (!options || typeof options !== 'object' || Array.isArray(options) ||
      Object.keys(options).some(key => !['maxChars', 'overlapChars'].includes(key))) {
    throw new TypeError('Invalid chunking options');
  }
  const maxChars = options.maxChars === undefined ? DEFAULT_MAX_CHARS : options.maxChars;
  const overlapChars = options.overlapChars === undefined ? 0 : options.overlapChars;
  if (!Number.isInteger(maxChars) || maxChars < 64 || maxChars > MAX_CHARS) {
    throw new TypeError('Invalid chunk size; use an integer between 64 and 8192 characters');
  }
  if (overlapChars !== 0) {
    throw new TypeError('Chunk overlap is not supported; evidence spans must remain non-overlapping');
  }

  const ranges = [];
  let current = null;
  const flush = () => { if (current) ranges.push(current); current = null; };
  for (const block of collectBlocks(source)) {
    const blockLength = block.endOffset - block.startOffset;
    if (blockLength > maxChars) {
      flush();
      ranges.push(...splitOversizedBlock(source, block.startOffset, block.endOffset, maxChars, block.headingPath));
      continue;
    }
    if (current && current.headingPath.join('\0') === block.headingPath.join('\0') &&
        block.endOffset - current.startOffset <= maxChars) {
      current.endOffset = block.endOffset;
    } else {
      flush();
      current = { ...block, headingPath: [...block.headingPath] };
    }
  }
  flush();

  return ranges.map((range, index) => ({
    id: 'chunk-' + String(index + 1).padStart(6, '0'),
    index,
    text: source.slice(range.startOffset, range.endOffset),
    startOffset: range.startOffset,
    endOffset: range.endOffset,
    startLine: lineAt(source, range.startOffset),
    endLine: lineAt(source, Math.max(range.startOffset, range.endOffset - 1)),
    headingPath: range.headingPath,
  }));
}
