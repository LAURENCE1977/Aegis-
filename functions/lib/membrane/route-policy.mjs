import { MembraneError } from './data-guards.mjs';

export const GLOBAL_MAX_BODY_SIZE = 1024 * 1024;
const str = (maxLength, minLength = 0, extra = {}) => Object.freeze({ type: 'string', minLength, maxLength, ...extra });

// Policies are explicit contracts for each migrated route. Memory POST
// deliberately excludes ownerId: ownership is derived server-side.
const obj = (properties, required) => Object.freeze({
  type: 'object', additionalProperties: false,
  required: Object.freeze(required), properties: Object.freeze(properties),
});
const array = (items, maxItems) => Object.freeze({ type: 'array', items, maxItems });
const nullable = (descriptor) => Object.freeze({ ...descriptor, nullable: true });

export const ROUTE_POLICIES = Object.freeze([
  Object.freeze({
    path: '/api/login',
    methods: Object.freeze(['GET', 'POST', 'DELETE']),
    allowBodies: true,
    maxBodySize: 16 * 1024,
    allowedMediaTypes: Object.freeze(['application/json']),
    profile: 'minimal',
    schema: Object.freeze({
      type: 'object',
      additionalProperties: false,
      required: Object.freeze(['password']),
      properties: Object.freeze({ password: str(1024, 1), identity: str(254, 3), tenantId: str(128, 3) }),
    }),
    credentialFields: Object.freeze(['password']),
    formFields: Object.freeze([]),
    multiValuedFormFields: Object.freeze([]),
    allowDuplicateFormFields: false,
  }),
  Object.freeze({
    path: '/api/memories',
    methods: Object.freeze(['GET', 'POST']),
    allowBodies: true,
    maxBodySize: 8192,
    allowedMediaTypes: Object.freeze(['application/json']),
    profile: 'standard',
    schema: obj({
      projectId: str(100, 1),
      kind: str(32, 1, { enum: ['fact', 'preference', 'decision', 'event', 'procedure', 'artifact'] }),
      content: str(4000, 1),
      source: obj({
        type: str(32, 1, { enum: ['user-stated', 'conversation', 'document', 'external-source'] }),
        url: str(2048, 9),
        attribution: str(300, 1),
        observedAt: str(24, 20),
      }, ['type', 'url', 'attribution']),
      confidence: Object.freeze({ type: 'number', minimum: 0, maximum: 1 }),
      sensitivity: str(16, 1, { enum: ['public', 'internal', 'private', 'restricted'] }),
      tags: array(str(64, 1), 30),
      expiresAt: nullable(str(24, 20)),
    }, ['kind', 'content', 'source']),
    querySchema: obj({
      projectId: str(100, 1),
      limit: str(2, 1, { enum: Array.from({ length: 50 }, (_, i) => String(i + 1)) }),
      q: str(200, 1),
      review: str(1, 1, { enum: ['0', '1'] }),
    }, []),
    credentialFields: Object.freeze([]), formFields: Object.freeze([]),
    multiValuedFormFields: Object.freeze([]), allowDuplicateFormFields: false,
  }),
  Object.freeze({
    path: '/api/ask', methods: Object.freeze(['POST']), allowBodies: true,
    maxBodySize: 48 * 1024, allowedMediaTypes: Object.freeze(['application/json']),
    profile: 'standard',
    schema: obj({
      question: str(4000, 1),
      conversationId: str(128, 1),
      history: array(obj({
        role: str(9, 4, { enum: ['user', 'assistant'] }),
        content: str(4000, 1),
        signature: str(64, 43),
      }, ['role', 'content']), 10),
    }, ['question']),
    credentialFields: Object.freeze([]), formFields: Object.freeze([]),
    multiValuedFormFields: Object.freeze([]), allowDuplicateFormFields: false,
  }),

  Object.freeze({
    path: '/api/admin/principals',
    methods: Object.freeze(['GET', 'POST', 'PATCH']),
    allowBodies: true,
    maxBodySize: 8192,
    allowedMediaTypes: Object.freeze(['application/json']),
    profile: 'standard',
    schema: obj({
      identity: str(254, 3),
      displayName: str(120, 1),
      password: str(1024, 12),
      role: str(6, 4, { enum: ['owner', 'admin', 'member'] }),
      principalId: str(80, 3),
      status: str(9, 6, { enum: ['active', 'suspended', 'revoked'] }),
      principalStatus: str(9, 6, { enum: ['active', 'suspended', 'revoked'] }),
    }, []),
    querySchema: obj({}, []),
    credentialFields: Object.freeze(['password']),
    formFields: Object.freeze([]),
    multiValuedFormFields: Object.freeze([]),
    allowDuplicateFormFields: false,
  }),
  Object.freeze({
    path: '/api/admin/tenants',
    methods: Object.freeze(['GET', 'POST', 'PATCH']),
    allowBodies: true,
    maxBodySize: 4096,
    allowedMediaTypes: Object.freeze(['application/json']),
    profile: 'standard',
    schema: obj({
      name: str(120, 2),
      tenantId: str(128, 3),
      status: str(9, 6, { enum: ['active', 'suspended', 'revoked'] }),
    }, []),
    querySchema: obj({}, []),
    credentialFields: Object.freeze([]),
    formFields: Object.freeze([]),
    multiValuedFormFields: Object.freeze([]),
    allowDuplicateFormFields: false,
  }),
  Object.freeze({
    path: '/api/sessions',
    methods: Object.freeze(['GET', 'DELETE']),
    allowBodies: true,
    maxBodySize: 1024,
    allowedMediaTypes: Object.freeze(['application/json']),
    profile: 'standard',
    schema: obj({ sessionId: str(64, 1) }, []),
    credentialFields: Object.freeze([]),
    formFields: Object.freeze([]),
    multiValuedFormFields: Object.freeze([]),
    allowDuplicateFormFields: false,
  }),
]);

const METHODS = new Set(['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']);
const PROFILES = new Set(['strict', 'standard', 'minimal']);
const MEDIA = new Set(['application/json', 'application/x-www-form-urlencoded']);
const NAME = /^[A-Za-z][A-Za-z0-9_-]{0,63}$/;
function assert(condition, message) {
  if (!condition) throw new MembraneError(`Invalid route policy: ${message}`, { code: 'INVALID_ROUTE_POLICY', status: 500 });
}

function validateSchema(schema, path = 'schema', depth = 0) {
  assert(depth <= 6 && schema && typeof schema === 'object' && !Array.isArray(schema), `${path} must be an object within schema depth limit`);
  assert(['object', 'string', 'integer', 'number', 'boolean', 'array'].includes(schema.type), `${path}.type unsupported`);
  const allowedKeys = {
    object: ['type', 'properties', 'required', 'additionalProperties'],
    string: ['type', 'minLength', 'maxLength', 'enum'],
    integer: ['type', 'minimum', 'maximum'],
    number: ['type', 'minimum', 'maximum'],
    boolean: ['type'],
    array: ['type', 'items', 'maxItems'],
  }[schema.type];
  assert(Object.keys(schema).every((key) => allowedKeys.includes(key) || key === 'nullable'), `${path} contains an unknown descriptor key`);
  if (schema.nullable !== undefined) assert(typeof schema.nullable === 'boolean', `${path}.nullable must be boolean`);
  if (schema.type === 'object') {
    assert(schema.properties && typeof schema.properties === 'object' && !Array.isArray(schema.properties), `${path}.properties required`);
    const keys = Object.keys(schema.properties);
    assert(keys.every((key) => NAME.test(key)), `${path} has invalid property names`);
    assert(Array.isArray(schema.required) && new Set(schema.required).size === schema.required.length, `${path}.required invalid`);
    assert(schema.required.every((key) => Object.hasOwn(schema.properties, key)), `${path}.required must be a subset of properties`);
    assert(typeof schema.additionalProperties === 'boolean', `${path}.additionalProperties must be boolean`);
    for (const [key, child] of Object.entries(schema.properties)) validateSchema(child, `${path}.${key}`, depth + 1);
  } else if (schema.type === 'string') {
    assert(Number.isSafeInteger(schema.maxLength) && schema.maxLength >= 1, `${path}.maxLength invalid`);
    assert(Number.isSafeInteger(schema.minLength ?? 0) && (schema.minLength ?? 0) >= 0 && (schema.minLength ?? 0) <= schema.maxLength, `${path}.minLength invalid`);
    if (schema.enum !== undefined) assert(Array.isArray(schema.enum) && schema.enum.length > 0 && schema.enum.every((value) => typeof value === 'string' && value.length <= schema.maxLength), `${path}.enum invalid`);
  } else if (schema.type === 'array') {
    assert(Number.isSafeInteger(schema.maxItems) && schema.maxItems >= 1, `${path}.maxItems invalid`);
    validateSchema(schema.items, `${path}.items`, depth + 1);
  } else if (schema.type === 'integer' || schema.type === 'number') {
    assert(Number.isFinite(schema.minimum) && Number.isFinite(schema.maximum) && schema.minimum <= schema.maximum, `${path} numeric bounds invalid`);
  }
}

export function validateRoutePolicies(policies = ROUTE_POLICIES) {
  assert(Array.isArray(policies) && policies.length > 0, 'registry must be a non-empty array');
  const paths = new Set();
  for (const policy of policies) {
    assert(policy && typeof policy === 'object', 'entry must be an object');
    assert(typeof policy.path === 'string' && /^\/api(?:\/[a-z0-9-]+)+$/.test(policy.path), 'path must be canonical lowercase API path');
    assert(!paths.has(policy.path), `duplicate path ${policy.path}`);
    paths.add(policy.path);
    assert(Array.isArray(policy.methods) && policy.methods.length > 0 && new Set(policy.methods).size === policy.methods.length && policy.methods.every((method) => METHODS.has(method)), `${policy.path} methods invalid`);
    assert(typeof policy.allowBodies === 'boolean', `${policy.path} allowBodies invalid`);
    assert(Number.isSafeInteger(policy.maxBodySize) && policy.maxBodySize >= 0 && policy.maxBodySize <= GLOBAL_MAX_BODY_SIZE, `${policy.path} maxBodySize invalid`);
    assert(PROFILES.has(policy.profile), `${policy.path} profile invalid`);
    assert(Array.isArray(policy.allowedMediaTypes) && new Set(policy.allowedMediaTypes).size === policy.allowedMediaTypes.length && policy.allowedMediaTypes.every((type) => MEDIA.has(type)), `${policy.path} media types invalid`);
    if (policy.allowBodies) assert(policy.maxBodySize > 0 && policy.allowedMediaTypes.length > 0, `${policy.path} body-bearing policy needs a positive limit and media types`);
    assert(Array.isArray(policy.credentialFields) && new Set(policy.credentialFields).size === policy.credentialFields.length && policy.credentialFields.every((field) => typeof field === 'string' && NAME.test(field)), `${policy.path} credentialFields invalid`);
    assert(Array.isArray(policy.formFields) && new Set(policy.formFields).size === policy.formFields.length && policy.formFields.every((field) => NAME.test(field)), `${policy.path} formFields invalid`);
    assert(Array.isArray(policy.multiValuedFormFields) && new Set(policy.multiValuedFormFields).size === policy.multiValuedFormFields.length && policy.multiValuedFormFields.every((field) => policy.formFields.includes(field)), `${policy.path} multiValuedFormFields invalid`);
    assert(typeof policy.allowDuplicateFormFields === 'boolean', `${policy.path} duplicate policy invalid`);
    assert(policy.schema?.type === 'object', `${policy.path} root schema must be object`);
    validateSchema(policy.schema, `${policy.path}.schema`);
    if (policy.querySchema !== undefined) {
      assert(policy.methods.includes('GET'), `${policy.path} query schema requires GET`);
      assert(policy.querySchema?.type === 'object', `${policy.path} query schema must be an object`);
      validateSchema(policy.querySchema, `${policy.path}.querySchema`);
    }
    assert(policy.credentialFields.every((field) => Object.hasOwn(policy.schema.properties, field)), `${policy.path} credentials must be schema properties`);
    assert(policy.formFields.every((field) => Object.hasOwn(policy.schema.properties, field)), `${policy.path} form fields must be schema properties`);
    if (!policy.allowBodies) assert(policy.maxBodySize === 0 && policy.allowedMediaTypes.length === 0, `${policy.path} bodyless policy must have zero size and no media types`);
  }
  return true;
}

validateRoutePolicies();

export function evaluateRoutePolicy(path, method) {
  const policy = ROUTE_POLICIES.find((entry) => entry.path === path);
  if (!policy) return { ok: false, status: 404, code: 'ROUTE_NOT_FOUND' };
  if (!policy.methods.includes(method)) return { ok: false, status: 405, code: 'METHOD_NOT_ALLOWED', allow: policy.methods.join(', ') };
  return { ok: true, policy };
}
