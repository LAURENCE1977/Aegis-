const SECRET_PATTERNS = [
  { regex: /\bBearer\s+[A-Za-z0-9._~+\/-]{12,}=*/gi, label: '[REDACTED_BEARER]' },
  { regex: /\b(?:sk-[A-Za-z0-9_-]{16,}|gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/g, label: '[REDACTED_TOKEN]' },
  { regex: /\bAKIA[0-9A-Z]{16}\b/g, label: '[REDACTED_AWS_KEY]' },
  { regex: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g, label: '[REDACTED_PRIVATE_KEY]' },
];
const PII_PATTERNS = [
  { regex: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, label: '[REDACTED_EMAIL]' },
  { regex: /(?<!\w)(?:\+?\d[\d .()\-]{7,}\d)(?!\w)/g, label: '[REDACTED_PHONE]' },
];
const MAX_DEPTH = 12;
const MAX_NODES = 2000;

export function scrubSensitiveText(input) {
  if (typeof input !== 'string') return { ok: false, value: null, redactions: 0 };
  let value = input;
  let redactions = 0;
  for (const { regex, label } of [...SECRET_PATTERNS, ...PII_PATTERNS]) {
    value = value.replace(regex, () => {
      redactions += 1;
      return label;
    });
  }
  return { ok: true, value, redactions };
}

export function scrubSensitiveData(input, { piiValues = [] } = {}) {
  let nodes = 0;
  let redactions = 0;
  const seen = new WeakSet();

  function visit(value, depth) {
    nodes += 1;
    if (nodes > MAX_NODES || depth > MAX_DEPTH) throw new TypeError('Payload exceeds scrubber limits');
    if (typeof value === 'string') {
      const result = scrubSensitiveText(value);
      if (!result.ok) throw new TypeError('Unsupported text value');
      let text = result.value;
      redactions += result.redactions;
      for (const item of piiValues) {
        if (typeof item !== 'string' || item.length < 2) throw new TypeError('Invalid configured PII value');
        if (text.includes(item)) {
          text = text.split(item).join('[REDACTED_CONFIGURED_PII]');
          redactions += 1;
        }
      }
      return text;
    }
    if (value === null || typeof value === 'boolean' || typeof value === 'number') {
      if (typeof value === 'number' && !Number.isFinite(value)) throw new TypeError('Non-finite number');
      return value;
    }
    if (Array.isArray(value)) {
      if (seen.has(value)) throw new TypeError('Circular payload');
      seen.add(value);
      const result = value.map((item) => visit(item, depth + 1));
      seen.delete(value);
      return result;
    }
    if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
      if (seen.has(value)) throw new TypeError('Circular payload');
      seen.add(value);
      const result = {};
      for (const [key, item] of Object.entries(value)) {
        if (/^(?:__proto__|prototype|constructor)$/i.test(key)) throw new TypeError('Unsafe payload key');
        result[key] = visit(item, depth + 1);
      }
      seen.delete(value);
      return result;
    }
    throw new TypeError('Unsupported payload type');
  }

  try {
    return { ok: true, value: visit(input, 0), redactions };
  } catch {
    return { ok: false, value: null, redactions };
  }
}
