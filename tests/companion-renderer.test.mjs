import test from 'node:test';
import assert from 'node:assert/strict';
import {
  COMPANION_STATES,
  createSphereGeometry,
  normaliseVisemes,
  normaliseExpression,
  createCompanionRenderer,
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

test('external model manifests remain explicitly unsupported until a licensed loader is added', async () => {
  const renderer = createCompanionRenderer({ getContext: () => null });
  assert.deepEqual(await renderer.loadModel({ format: 'glb', source: 'local-file' }), {
    loaded: false, reason: 'external-model-loader-not-yet-enabled',
  });
});
