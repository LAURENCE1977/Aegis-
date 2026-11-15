export async function readBoundedText(request, maxBytes) {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) {
    throw new TypeError('A positive request-body limit is required.');
  }
  const declared = Number(request.headers.get('Content-Length'));
  if (Number.isFinite(declared) && declared > maxBytes) {
    const error = new Error('Request body exceeds the size limit.');
    error.status = 413;
    throw error;
  }
  if (!request.body) return '';
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let size = 0;
  let output = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        const error = new Error('Request body exceeds the size limit.');
        error.status = 413;
        try { await reader.cancel(); } catch {}
        throw error;
      }
      output += decoder.decode(value, { stream: true });
    }
    output += decoder.decode();
    return output;
  } finally {
    try { reader.releaseLock(); } catch {}
  }
}
