import { chunkMarkdownDocument } from './knowledge-chunking.mjs';

const STATUSES = new Set(['draft', 'reviewed', 'accepted', 'superseded']);
const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const MAX_SOURCE_PATH = 240;

function hasControlCharacters(value) {
  return [...value].some(character => {
    const code = character.charCodeAt(0);
    return code <= 0x1f || code === 0x7f;
  });
}

