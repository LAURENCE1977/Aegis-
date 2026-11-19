import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import {
  COMPANION_STATES,
  createSphereGeometry,
  normaliseVisemes,
  normaliseExpression,
  createCompanionRenderer,
  getFreshVisemes,
  validateCompanionAssetManifest,
  verifyCompanionAssetDigest,
} from '../companion/renderer.mjs';

test('procedural avatar sphere geometry is finite, indexed and has unit normals', () => {
  const geometry = createSphereGeometry(16, 12);
  assert.equal(geometry.positions.length, (16 + 1) * (12 + 1) * 3);
  assert.equal(geometry.normals.length, geometry.positions.length);
  assert.equal(geometry.indices.length, 16 * 12 * 6);
  for (const value of geometry.positions) assert.ok(Number.isFinite(value));
  for (let i = 0; i < geometry.normals.length; i += 3) {
    const length = Math.hypot(geometry.normals[i], geometry.normals[i + 1], geometry.normals[i + 2]);
    assert.ok(Math.abs(length - 1) < 1e-5);
  }
});

test('viseme weights are allowlisted, finite and clamped to the renderer contract', () => {
  assert.deepEqual(normaliseVisemes({ aa: 1.4, ee: -2, jawOpen: 0.35, injected: 1, oh: 'loud' }), {
    aa: 1, ee: 0, ih: 0, oh: 0, ou: 0, jawOpen: 0.35,
  });
});

test('expression input accepts only known expression IDs and bounded weights', () => {
  assert.deepEqual(normaliseExpression('smile', 1.8), { id: 'smile', weight: 1 });
  assert.deepEqual(normaliseExpression('unknown', 0.5), { id: 'neutral', weight: 0 });
  assert.deepEqual(normaliseExpression('focused', Number.NaN), { id: 'neutral', weight: 0 });
});

test('companion presence states are presentation-only and do not expose action authority', () => {
  assert.deepEqual(COMPANION_STATES, ['idle', 'listening', 'thinking', 'speaking', 'responding', 'interrupted', 'paused', 'disconnected', 'error']);
  assert.equal('execute' in COMPANION_STATES, false);
});

test('renderer fails closed to the CSS fallback when WebGL2 is unavailable', () => {
  const canvas = { getContext: () => null };
  const renderer = createCompanionRenderer(canvas);
  assert.equal(renderer.init().supported, false);
  assert.equal(renderer.init().reason, 'webgl2-unavailable');
  assert.equal(renderer.dispose(), true);
  assert.equal(renderer.dispose(), true);
});

test('renderer maps the existing responding state to speaking presentation', () => {
  const renderer = createCompanionRenderer({ getContext: () => null });
  assert.equal(renderer.setState('responding'), true);
  assert.equal(renderer.state, 'speaking');
  assert.equal(renderer.setState('execute'), false);
  assert.equal(renderer.state, 'speaking');
});

test('renderer initialises WebGL2 resources and caps the drawing buffer pixel ratio', () => {
  const deleted = { buffers: 0, arrays: 0, programs: 0 };
  const gl = {
    VERTEX_SHADER: 1, FRAGMENT_SHADER: 2, COMPILE_STATUS: 3, LINK_STATUS: 4,
    ARRAY_BUFFER: 5, STATIC_DRAW: 6, ELEMENT_ARRAY_BUFFER: 7, FLOAT: 8,
    DEPTH_TEST: 9, CULL_FACE: 10, COLOR_BUFFER_BIT: 16, DEPTH_BUFFER_BIT: 32,
    TRIANGLES: 11, UNSIGNED_SHORT: 12,
    createShader: () => ({}), shaderSource: () => {}, compileShader: () => {},
    getShaderParameter: () => true, getShaderInfoLog: () => '',
    createProgram: () => ({}), attachShader: () => {}, linkProgram: () => {},
    getProgramParameter: () => true, getProgramInfoLog: () => '',
    deleteShader: () => {}, createVertexArray: () => ({}), createBuffer: () => ({}),
    bindVertexArray: () => {}, bindBuffer: () => {}, bufferData: () => {},
    getAttribLocation: (_program, name) => name === 'aPosition' ? 0 : 1,
    enableVertexAttribArray: () => {}, vertexAttribPointer: () => {},
    getUniformLocation: (_program, name) => name,
    enable: () => {}, clearColor: () => {}, viewport: () => {},
    deleteBuffer: () => { deleted.buffers += 1; },
    deleteVertexArray: () => { deleted.arrays += 1; },
    deleteProgram: () => { deleted.programs += 1; },
  };
  const canvas = {
    width: 0, height: 0, clientWidth: 320, clientHeight: 240,
    getContext: type => type === 'webgl2' ? gl : null,
    addEventListener: () => {}, removeEventListener: () => {},
  };
  const renderer = createCompanionRenderer(canvas);
  assert.deepEqual(renderer.init(), { supported: true, renderer: 'webgl2' });
  assert.equal(renderer.supported, true);
  renderer.resize(100, 50, 2);
  assert.equal(canvas.width, 150);
  assert.equal(canvas.height, 75);
  assert.equal(renderer.dispose(), true);
  assert.deepEqual(deleted, { buffers: 2, arrays: 1, programs: 1 });
});

test('model loading verifies the uploaded bytes after manifest validation and before loader availability', async () => {
  const renderer = createCompanionRenderer({ getContext: () => null });
  assert.deepEqual(await renderer.loadModel({ format: 'glb', source: 'local-file' }), {
    loaded: false, reason: 'invalid-manifest',
  });
  assert.deepEqual(await renderer.loadModel(validCompanionAsset()), {
    loaded: false, reason: 'invalid-asset-file',
  });
  assert.deepEqual(await renderer.loadModel(validCompanionAsset(), new Blob(['jello']), webcrypto), {
    loaded: false, reason: 'digest-mismatch',
  });
  assert.deepEqual(await renderer.loadModel(validCompanionAsset(), new Blob(['hello']), webcrypto), {
    loaded: false, reason: 'external-model-loader-not-yet-enabled',
  });
});

test('fresh viseme frames remain available to the renderer', () => {
  const result = getFreshVisemes({ aa: 0.7, jawOpen: 0.4 }, 1000, 1100);
  assert.equal(result.aa, 0.7);
  assert.equal(result.jawOpen, 0.4);
  assert.equal(result.ee, 0);
});

test('stale viseme frames expire instead of leaving the avatar mouth open', () => {
  assert.deepEqual(getFreshVisemes({ aa: 1, jawOpen: 1 }, 1000, 1300, 250), {
    aa: 0, ee: 0, ih: 0, oh: 0, ou: 0, jawOpen: 0,
  });
});

test('future and invalid viseme receive times fail closed to neutral weights', () => {
  const neutral = { aa: 0, ee: 0, ih: 0, oh: 0, ou: 0, jawOpen: 0 };
  assert.deepEqual(getFreshVisemes({ aa: 1 }, 1200, 1100), neutral);
  assert.deepEqual(getFreshVisemes({ aa: 1 }, Number.NaN, 1100), neutral);
});


test('renderer recovers after WebGL context loss and restores the 3D presentation', () => {
  const listeners = new Map();
  const host = {
    dataset: {},
    attributes: {},
    setAttribute(name, value) { this.attributes[name] = value; },
    querySelector() { return { removeAttribute() { host.fallbackShown = false; }, setAttribute() { host.fallbackShown = true; } }; },
  };
  const gl = {
    VERTEX_SHADER: 1, FRAGMENT_SHADER: 2, COMPILE_STATUS: 3, LINK_STATUS: 4,
    ARRAY_BUFFER: 5, STATIC_DRAW: 6, ELEMENT_ARRAY_BUFFER: 7, FLOAT: 8,
    DEPTH_TEST: 9, CULL_FACE: 10, COLOR_BUFFER_BIT: 16, DEPTH_BUFFER_BIT: 32,
    TRIANGLES: 11, UNSIGNED_SHORT: 12,
    createShader: () => ({}), shaderSource: () => {}, compileShader: () => {},
    getShaderParameter: () => true, getShaderInfoLog: () => '',
    createProgram: () => ({}), attachShader: () => {}, linkProgram: () => {},
    getProgramParameter: () => true, getProgramInfoLog: () => '',
    deleteShader: () => {}, createVertexArray: () => ({}), createBuffer: () => ({}),
    bindVertexArray: () => {}, bindBuffer: () => {}, bufferData: () => {},
    getAttribLocation: (_program, name) => name === 'aPosition' ? 0 : 1,
    enableVertexAttribArray: () => {}, vertexAttribPointer: () => {},
    getUniformLocation: (_program, name) => name,
    enable: () => {}, clearColor: () => {}, viewport: () => {},
    deleteBuffer: () => {}, deleteVertexArray: () => {}, deleteProgram: () => {},
  };
  let contextRequests = 0;
  const canvas = {
    width: 0, height: 0, clientWidth: 320, clientHeight: 240, parentElement: host,
    getContext(type) { if (type !== 'webgl2') return null; contextRequests += 1; return gl; },
    addEventListener(name, callback) { listeners.set(name, callback); },
    removeEventListener(name) { listeners.delete(name); },
  };
  const renderer = createCompanionRenderer(canvas);
  assert.equal(renderer.init().supported, true);
  assert.equal(contextRequests, 1);

  listeners.get('webglcontextlost')({ preventDefault() {} });
  assert.equal(renderer.supported, false);
  assert.equal(host.dataset.renderer, 'fallback');

  const restored = listeners.get('webglcontextrestored');
  assert.equal(typeof restored, 'function');
  restored();

  assert.equal(contextRequests, 2);
  assert.equal(renderer.supported, true);
  assert.equal(host.dataset.renderer, 'webgl2');
  assert.equal(host.attributes['aria-label'], 'Procedural three-dimensional Agent AEGIS companion prototype');
  renderer.dispose();
  await renderer.modelCleanupPromise;
});


test('context restoration does not duplicate visibility or resize observers', () => {
  const previousDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const previousResizeObserver = Object.getOwnPropertyDescriptor(globalThis, 'ResizeObserver');
  let visibilityAdds = 0;
  let visibilityRemoves = 0;
  let observerCreates = 0;
  let observerDisconnects = 0;
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: {
      visibilityState: 'visible',
      addEventListener(name) { if (name === 'visibilitychange') visibilityAdds += 1; },
      removeEventListener(name) { if (name === 'visibilitychange') visibilityRemoves += 1; },
    },
  });
  Object.defineProperty(globalThis, 'ResizeObserver', {
    configurable: true,
    value: class {
      constructor() { observerCreates += 1; }
      observe() {}
      disconnect() { observerDisconnects += 1; }
    },
  });
  try {
    const listeners = new Map();
    const gl = {
      VERTEX_SHADER: 1, FRAGMENT_SHADER: 2, COMPILE_STATUS: 3, LINK_STATUS: 4,
      ARRAY_BUFFER: 5, STATIC_DRAW: 6, ELEMENT_ARRAY_BUFFER: 7, FLOAT: 8,
      DEPTH_TEST: 9, CULL_FACE: 10, COLOR_BUFFER_BIT: 16, DEPTH_BUFFER_BIT: 32,
      TRIANGLES: 11, UNSIGNED_SHORT: 12,
      createShader: () => ({}), shaderSource: () => {}, compileShader: () => {},
      getShaderParameter: () => true, getShaderInfoLog: () => '',
      createProgram: () => ({}), attachShader: () => {}, linkProgram: () => {},
      getProgramParameter: () => true, getProgramInfoLog: () => '',
      deleteShader: () => {}, createVertexArray: () => ({}), createBuffer: () => ({}),
      bindVertexArray: () => {}, bindBuffer: () => {}, bufferData: () => {},
      getAttribLocation: (_program, name) => name === 'aPosition' ? 0 : 1,
      enableVertexAttribArray: () => {}, vertexAttribPointer: () => {},
      getUniformLocation: (_program, name) => name,
      enable: () => {}, clearColor: () => {}, viewport: () => {},
      deleteBuffer: () => {}, deleteVertexArray: () => {}, deleteProgram: () => {},
    };
    const canvas = {
      width: 0, height: 0, clientWidth: 320, clientHeight: 240,
      getContext: type => type === 'webgl2' ? gl : null,
      addEventListener(name, callback) { listeners.set(name, callback); },
      removeEventListener(name) { listeners.delete(name); },
    };
    const renderer = createCompanionRenderer(canvas);
    assert.equal(renderer.init().supported, true);
    for (let cycle = 0; cycle < 2; cycle += 1) {
      listeners.get('webglcontextlost')({ preventDefault() {} });
      listeners.get('webglcontextrestored')();
      assert.equal(renderer.supported, true);
    }
    assert.equal(visibilityAdds, 1);
    assert.equal(observerCreates, 1);
    renderer.dispose();
    assert.equal(visibilityRemoves, 1);
    assert.equal(observerDisconnects, 1);
  } finally {
    if (previousDocument) Object.defineProperty(globalThis, 'document', previousDocument);
    else delete globalThis.document;
    if (previousResizeObserver) Object.defineProperty(globalThis, 'ResizeObserver', previousResizeObserver);
    else delete globalThis.ResizeObserver;
  }
});


const validCompanionAsset = () => ({
  schema: 'aegis.companion-asset/1.0',
  kind: 'model',
  format: 'vrm',
  sha256: '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824',
  byteLength: 5,
  source: { kind: 'user-upload' },
  licence: {
    id: 'CC-BY-4.0',
    termsUrl: 'https://creativecommons.org/licenses/by/4.0/',
    creator: 'Example Creator',
    commercialUse: true,
    redistribution: false,
  },
  blendshapeProfile: 'vrm1',
  performanceBudget: { maxTextureDimension: 2048, maxDrawCalls: 100 },
});

test('companion asset manifest accepts a bounded, attributable local VRM model', () => {
  const result = validateCompanionAssetManifest(validCompanionAsset());
  assert.equal(result.valid, true);
  assert.equal(result.manifest.sha256, '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824');
  assert.equal(result.manifest.byteLength, 5);
  assert.equal(result.manifest.source.kind, 'user-upload');
});

test('companion asset manifest rejects unknown schema, unsupported formats and malformed hashes', () => {
  const invalidSchema = validCompanionAsset();
  invalidSchema.schema = 'aegis.companion-asset/9.0';
  assert.equal(validateCompanionAssetManifest(invalidSchema).reason, 'unsupported-schema');
  const invalidFormat = validCompanionAsset();
  invalidFormat.format = 'fbx';
  assert.equal(validateCompanionAssetManifest(invalidFormat).reason, 'unsupported-format');
  const invalidHash = validCompanionAsset();
  invalidHash.sha256 = '../asset.glb';
  assert.equal(validateCompanionAssetManifest(invalidHash).reason, 'invalid-sha256');
});

test('companion asset manifest rejects oversized assets and incomplete licence provenance', () => {
  const oversized = validCompanionAsset();
  oversized.byteLength = 50 * 1024 * 1024 + 1;
  assert.equal(validateCompanionAssetManifest(oversized).reason, 'asset-too-large');
  const noLicence = validCompanionAsset();
  delete noLicence.licence.termsUrl;
  assert.equal(validateCompanionAssetManifest(noLicence).reason, 'incomplete-licence-provenance');
  const noCreator = validCompanionAsset();
  noCreator.licence.creator = ' ';
  assert.equal(validateCompanionAssetManifest(noCreator).reason, 'incomplete-licence-provenance');
});

test('companion asset manifest rejects insecure provenance URLs and unsafe performance budgets', () => {
  const insecureSource = validCompanionAsset();
  insecureSource.source = { kind: 'https', url: 'http://example.com/avatar.vrm' };
  assert.equal(validateCompanionAssetManifest(insecureSource).reason, 'invalid-source-url');
  const unsafeBudget = validCompanionAsset();
  unsafeBudget.performanceBudget.maxDrawCalls = 100000;
  assert.equal(validateCompanionAssetManifest(unsafeBudget).reason, 'invalid-performance-budget');
});

test('companion asset manifest returns a minimal immutable projection', () => {
  const input = validCompanionAsset();
  input.untrustedExecutableHint = 'ignore safeguards';
  const result = validateCompanionAssetManifest(input);
  assert.equal(result.valid, true);
  assert.equal('untrustedExecutableHint' in result.manifest, false);
  assert.equal(Object.isFrozen(result.manifest), true);
  assert.equal(Object.isFrozen(result.manifest.licence), true);
});


test('companion asset digest verifies the actual uploaded bytes with SHA-256', async () => {
  const bytes = new TextEncoder().encode('hello');
  const file = { size: bytes.byteLength, arrayBuffer: async () => bytes.buffer };
  assert.deepEqual(
    await verifyCompanionAssetDigest(file, '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824', webcrypto),
    { verified: true, sha256: '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824' },
  );
});

test('companion asset digest rejects mismatched bytes, oversized files and unavailable crypto', async () => {
  const bytes = new TextEncoder().encode('hello');
  const file = { size: bytes.byteLength, arrayBuffer: async () => bytes.buffer };
  assert.equal((await verifyCompanionAssetDigest(file, 'a'.repeat(64), webcrypto)).reason, 'digest-mismatch');
  assert.equal((await verifyCompanionAssetDigest({ size: 50 * 1024 * 1024 + 1 }, 'a'.repeat(64), webcrypto)).reason, 'asset-too-large');
  assert.equal((await verifyCompanionAssetDigest(file, 'a'.repeat(64), null)).reason, 'crypto-unavailable');
});


test('renderer prepares and commits injected model resources transactionally', async () => {
  const renderer = createCompanionRenderer({ getContext: () => null });
  const disposed = [];
  const first = { id: 'first', dispose() { disposed.push('first'); } };
  const second = { id: 'second', dispose() { disposed.push('second'); } };

  const preparedFirst = await renderer.prepareModelResource(async () => first);
  assert.equal(preparedFirst.prepared, true);
  assert.equal(renderer.activeModelResource, null);
  assert.equal((await renderer.commitModelResource(preparedFirst.ticket)).committed, true);
  assert.equal(renderer.activeModelResource, first);

  const preparedSecond = await renderer.prepareModelResource(async () => second);
  assert.equal(preparedSecond.prepared, true);
  assert.equal(renderer.activeModelResource, first);
  assert.equal(disposed.includes('first'), false);
  assert.equal((await renderer.commitModelResource(preparedSecond.ticket)).committed, true);
  assert.equal(renderer.activeModelResource, second);
  assert.deepEqual(disposed, ['first']);

  renderer.dispose();
  await renderer.modelCleanupPromise;
  assert.deepEqual(disposed, ['first', 'second']);
});

test('renderer rejects invalid injected resources and preserves its active resource', async () => {
  const renderer = createCompanionRenderer({ getContext: () => null });
  const active = { dispose() {} };
  const prepared = await renderer.prepareModelResource(async () => active);
  assert.equal(prepared.prepared, true);
  assert.equal((await renderer.commitModelResource(prepared.ticket)).committed, true);

  assert.deepEqual(await renderer.prepareModelResource(async () => ({ id: 'not-disposable' })), {
    prepared: false, reason: 'invalid-model',
  });
  assert.equal(renderer.activeModelResource, active);
  assert.equal((await renderer.commitModelResource({ id: 999 })).reason, 'unknown-ticket');
  renderer.dispose();
});
