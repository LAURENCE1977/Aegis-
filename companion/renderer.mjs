import { createCompanionModelLifecycle } from './model-lifecycle.mjs';

const VISeme_KEYS = Object.freeze(['aa', 'ee', 'ih', 'oh', 'ou', 'jawOpen']);
const EXPRESSION_IDS = new Set(['neutral', 'smile', 'focused', 'concerned']);
const COMPANION_ASSET_SCHEMA = 'aegis.companion-asset/1.0';
const COMPANION_ASSET_MAX_BYTES = 50 * 1024 * 1024;
const COMPANION_ASSET_FORMATS = new Set(['glb', 'vrm', 'vrma']);
const COMPANION_BLENDSHAPE_PROFILES = new Set(['none', 'vrm0', 'vrm1', 'arkit', 'custom']);

function isBoundedText(value, maxLength) {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= maxLength;
}

function isHttpsProvenanceUrl(value) {
  if (!isBoundedText(value, 2048)) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password;
  } catch {
    return false;
  }
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

/**
 * Validate metadata for a user-supplied companion asset. This function never
 * fetches URLs, reads files, executes content or certifies a licence claim.
 */
export function validateCompanionAssetManifest(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { valid: false, reason: 'invalid-manifest' };
  }
  if (typeof input.schema !== 'string' || !input.schema.trim()) {
    return { valid: false, reason: 'invalid-manifest' };
  }
  if (input.schema !== COMPANION_ASSET_SCHEMA) {
    return { valid: false, reason: 'unsupported-schema' };
  }
  if (!['model', 'animation'].includes(input.kind) ||
      !COMPANION_ASSET_FORMATS.has(input.format) ||
      (input.kind === 'model' && input.format === 'vrma') ||
      (input.kind === 'animation' && input.format !== 'vrma')) {
    return { valid: false, reason: 'unsupported-format' };
  }
  if (typeof input.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(input.sha256)) {
    return { valid: false, reason: 'invalid-sha256' };
  }
  if (!Number.isSafeInteger(input.byteLength) || input.byteLength < 1 ||
      input.byteLength > COMPANION_ASSET_MAX_BYTES) {
    return { valid: false, reason: 'asset-too-large' };
  }
  const source = input.source;
  if (!source || typeof source !== 'object' || Array.isArray(source) ||
      !(['user-upload', 'https'].includes(source.kind)) ||
      (source.kind === 'https' && !isHttpsProvenanceUrl(source.url)) ||
      (source.kind === 'user-upload' && source.url !== undefined)) {
    return { valid: false, reason: 'invalid-source-url' };
  }
  const licence = input.licence;
  if (!licence || typeof licence !== 'object' || Array.isArray(licence) ||
      !isBoundedText(licence.id, 80) || !isHttpsProvenanceUrl(licence.termsUrl) ||
      !isBoundedText(licence.creator, 160) ||
      typeof licence.commercialUse !== 'boolean' ||
      typeof licence.redistribution !== 'boolean') {
    return { valid: false, reason: 'incomplete-licence-provenance' };
  }
  if (!COMPANION_BLENDSHAPE_PROFILES.has(input.blendshapeProfile)) {
    return { valid: false, reason: 'invalid-blendshape-profile' };
  }
  const budget = input.performanceBudget;
  if (!budget || typeof budget !== 'object' || Array.isArray(budget) ||
      !Number.isInteger(budget.maxTextureDimension) ||
      budget.maxTextureDimension < 256 || budget.maxTextureDimension > 4096 ||
      !Number.isInteger(budget.maxDrawCalls) ||
      budget.maxDrawCalls < 1 || budget.maxDrawCalls > 2000) {
    return { valid: false, reason: 'invalid-performance-budget' };
  }
  const manifest = deepFreeze({
    schema: COMPANION_ASSET_SCHEMA,
    kind: input.kind,
    format: input.format,
    sha256: input.sha256,
    byteLength: input.byteLength,
    source: source.kind === 'https'
      ? { kind: 'https', url: new URL(source.url).href }
      : { kind: 'user-upload' },
    licence: {
      id: licence.id.trim(),
      termsUrl: new URL(licence.termsUrl).href,
      creator: licence.creator.trim(),
      commercialUse: licence.commercialUse,
      redistribution: licence.redistribution,
    },
    blendshapeProfile: input.blendshapeProfile,
    performanceBudget: {
      maxTextureDimension: budget.maxTextureDimension,
      maxDrawCalls: budget.maxDrawCalls,
    },
  });
  return { valid: true, manifest };
}

/**
 * Verify the actual uploaded Blob/File bytes against a declared SHA-256.
 * No network access, file persistence or executable content handling occurs.
 */
export async function verifyCompanionAssetDigest(file, expectedSha256, cryptoApi = globalThis.crypto) {
  if (typeof expectedSha256 !== 'string' || !/^[a-f0-9]{64}$/.test(expectedSha256)) {
    return { verified: false, reason: 'invalid-sha256' };
  }
  if (!file || typeof file !== 'object' ||
      !Number.isSafeInteger(file.size) || file.size < 1) {
    return { verified: false, reason: 'invalid-asset-file' };
  }
  if (file.size > COMPANION_ASSET_MAX_BYTES) {
    return { verified: false, reason: 'asset-too-large' };
  }
  if (typeof file.arrayBuffer !== 'function') {
    return { verified: false, reason: 'invalid-asset-file' };
  }
  if (!cryptoApi?.subtle || typeof cryptoApi.subtle.digest !== 'function') {
    return { verified: false, reason: 'crypto-unavailable' };
  }
  let bytes;
  try {
    bytes = await file.arrayBuffer();
  } catch {
    return { verified: false, reason: 'asset-read-failed' };
  }
  if (!(bytes instanceof ArrayBuffer) || bytes.byteLength !== file.size) {
    return { verified: false, reason: 'asset-size-mismatch' };
  }
  try {
    const digest = await cryptoApi.subtle.digest('SHA-256', bytes);
    const sha256 = Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, '0')).join('');
    return sha256 === expectedSha256
      ? { verified: true, sha256 }
      : { verified: false, reason: 'digest-mismatch', sha256 };
  } catch {
    return { verified: false, reason: 'digest-failed' };
  }
}

export const COMPANION_STATES = Object.freeze([
  'idle', 'listening', 'thinking', 'speaking', 'responding', 'interrupted', 'paused', 'disconnected', 'error',
]);

export function normaliseVisemes(input = {}) {
  const output = {};
  for (const key of VISeme_KEYS) {
    const value = Number(input?.[key]);
    output[key] = Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
  }
  return output;
}

export function getFreshVisemes(weights, receivedAt, now, maxAgeMs = 250) {
  const received = Number(receivedAt);
  const current = Number(now);
  const age = current - received;
  if (!Number.isFinite(received) || !Number.isFinite(current) || !Number.isFinite(maxAgeMs) ||
      maxAgeMs < 0 || age < 0 || age > maxAgeMs) return normaliseVisemes();
  return normaliseVisemes(weights);
}

export function normaliseExpression(id, weight) {
  const value = Number(weight);
  if (!EXPRESSION_IDS.has(id) || !Number.isFinite(value)) return { id: 'neutral', weight: 0 };
  return { id, weight: Math.max(0, Math.min(1, value)) };
}

export function createSphereGeometry(longitudeSegments = 24, latitudeSegments = 16) {
  if (!Number.isInteger(longitudeSegments) || longitudeSegments < 3 || longitudeSegments > 128 ||
      !Number.isInteger(latitudeSegments) || latitudeSegments < 2 || latitudeSegments > 128) {
    throw new RangeError('Sphere geometry segments are outside the supported range');
  }
  const positions = [];
  const normals = [];
  const indices = [];
  for (let y = 0; y <= latitudeSegments; y += 1) {
    const v = y / latitudeSegments;
    const phi = v * Math.PI;
    for (let x = 0; x <= longitudeSegments; x += 1) {
      const u = x / longitudeSegments;
      const theta = u * Math.PI * 2;
      const nx = -Math.cos(theta) * Math.sin(phi);
      const ny = Math.cos(phi);
      const nz = Math.sin(theta) * Math.sin(phi);
      positions.push(nx, ny, nz);
      normals.push(nx, ny, nz);
    }
  }
  for (let y = 0; y < latitudeSegments; y += 1) {
    for (let x = 0; x < longitudeSegments; x += 1) {
      const a = y * (longitudeSegments + 1) + x;
      const b = a + longitudeSegments + 1;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    indices: new Uint16Array(indices),
  };
}

const VERTEX_SHADER = `#version 300 es
in vec3 aPosition;
in vec3 aNormal;
uniform mat4 uProjection;
uniform mat4 uView;
uniform mat4 uModel;
out vec3 vNormal;
out vec3 vWorldPosition;
void main() {
  vec4 world = uModel * vec4(aPosition, 1.0);
  vWorldPosition = world.xyz;
  vNormal = normalize(mat3(uModel) * aNormal);
  gl_Position = uProjection * uView * world;
}`;

const FRAGMENT_SHADER = `#version 300 es
precision highp float;
in vec3 vNormal;
in vec3 vWorldPosition;
uniform vec3 uColour;
uniform vec3 uCamera;
uniform float uGlow;
out vec4 outColour;
void main() {
  vec3 normal = normalize(vNormal);
  vec3 light = normalize(vec3(-0.45, 0.72, 0.8));
  float diffuse = max(dot(normal, light), 0.0);
  float rim = pow(1.0 - max(dot(normal, normalize(uCamera - vWorldPosition)), 0.0), 2.2);
  vec3 colour = uColour * (0.28 + diffuse * 0.72) + vec3(0.22, 0.72, 0.82) * (rim * 0.32 + uGlow);
  outColour = vec4(colour, 1.0);
}`;

function compileShader(gl, type, source) {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('Unable to allocate WebGL shader');
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader) || 'Shader compilation failed';
    gl.deleteShader(shader);
    throw new Error(message);
  }
  return shader;
}

function multiply(a, b) {
  const out = new Float32Array(16);
  for (let column = 0; column < 4; column += 1) {
    for (let row = 0; row < 4; row += 1) {
      out[column * 4 + row] =
        a[row] * b[column * 4] +
        a[4 + row] * b[column * 4 + 1] +
        a[8 + row] * b[column * 4 + 2] +
        a[12 + row] * b[column * 4 + 3];
    }
  }
  return out;
}

function translation(x, y, z) {
  const m = identity();
  m[12] = x; m[13] = y; m[14] = z;
  return m;
}
function scaling(x, y, z) {
  const m = identity();
  m[0] = x; m[5] = y; m[10] = z;
  return m;
}
function rotationX(angle) {
  const c = Math.cos(angle), s = Math.sin(angle), m = identity();
  m[5] = c; m[6] = s; m[9] = -s; m[10] = c;
  return m;
}
function rotationY(angle) {
  const c = Math.cos(angle), s = Math.sin(angle), m = identity();
  m[0] = c; m[2] = -s; m[8] = s; m[10] = c;
  return m;
}
function identity() {
  return new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]);
}
function perspective(fov, aspect, near, far) {
  const f = 1 / Math.tan(fov / 2), nf = 1 / (near - far);
  const out = new Float32Array(16);
  out[0] = f / aspect; out[5] = f; out[10] = (far + near) * nf;
  out[11] = -1; out[14] = 2 * far * near * nf;
  return out;
}
function lookAt(eye, centre, up) {
  const normalise = v => { const l = Math.hypot(...v) || 1; return v.map(n => n / l); };
  const cross = (a,b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
  const subtract = (a,b) => a.map((n,i) => n-b[i]);
  const z = normalise(subtract(eye, centre));
  const x = normalise(cross(up, z));
  const y = cross(z, x);
  return new Float32Array([
    x[0], y[0], z[0], 0,
    x[1], y[1], z[1], 0,
    x[2], y[2], z[2], 0,
    -x[0]*eye[0]-x[1]*eye[1]-x[2]*eye[2],
    -y[0]*eye[0]-y[1]*eye[1]-y[2]*eye[2],
    -z[0]*eye[0]-z[1]*eye[1]-z[2]*eye[2], 1,
  ]);
}

export function createCompanionRenderer(canvas, options = {}) {
  let gl = null;
  let program = null;
  let buffer = null;
  let indexBuffer = null;
  let vao = null;
  let raf = 0;
  let disposed = false;
  let initialised = false;
  let lastFrame = 0;
  let state = 'idle';
  let expression = { id: 'neutral', weight: 0 };
  let visemes = normaliseVisemes();
  let visemeTimestamp = 0;
  let visemeReceivedAt = 0;
  let resizeObserver = null;
  const reducedMotion = options.reducedMotion ?? (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const geometry = createSphereGeometry(32, 24);
  const defaultPixelRatio = options.pixelRatio ?? (typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 1.5) : 1);
  const modelNames = ['uProjection', 'uView', 'uModel', 'uColour', 'uCamera', 'uGlow'];
  let uniforms = {};
  const modelLifecycle = createCompanionModelLifecycle();

  function resize(width, height, pixelRatio = defaultPixelRatio) {
    if (!canvas || disposed) return false;
    const ratio = Math.max(1, Math.min(Number(pixelRatio) || 1, 1.5));
    const w = Math.max(1, Math.floor((Number(width) || canvas.clientWidth || 1) * ratio));
    const h = Math.max(1, Math.floor((Number(height) || canvas.clientHeight || 1) * ratio));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    if (gl) gl.viewport(0, 0, w, h);
    return true;
  }

  function init() {
    if (disposed) return { supported: false, reason: 'disposed' };
    if (initialised) return { supported: true, renderer: 'webgl2' };
    if (!canvas || typeof canvas.getContext !== 'function') return { supported: false, reason: 'canvas-unavailable' };
    gl = canvas.getContext('webgl2', { alpha: true, antialias: true, powerPreference: 'low-power', depth: true });
    if (!gl) return { supported: false, reason: 'webgl2-unavailable' };
    try {
      const vertex = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
      const fragment = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
      program = gl.createProgram();
      if (!program) throw new Error('Unable to allocate WebGL program');
      gl.attachShader(program, vertex); gl.attachShader(program, fragment); gl.linkProgram(program);
      gl.deleteShader(vertex); gl.deleteShader(fragment);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) || 'Program link failed');
      vao = gl.createVertexArray();
      buffer = gl.createBuffer();
      indexBuffer = gl.createBuffer();
      if (!vao || !buffer || !indexBuffer) throw new Error('Unable to allocate avatar geometry');
      gl.bindVertexArray(vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      const interleaved = new Float32Array(geometry.positions.length + geometry.normals.length);
      for (let i = 0; i < geometry.positions.length / 3; i += 1) {
        interleaved.set(geometry.positions.subarray(i * 3, i * 3 + 3), i * 6);
        interleaved.set(geometry.normals.subarray(i * 3, i * 3 + 3), i * 6 + 3);
      }
      gl.bufferData(gl.ARRAY_BUFFER, interleaved, gl.STATIC_DRAW);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, geometry.indices, gl.STATIC_DRAW);
      const position = gl.getAttribLocation(program, 'aPosition');
      const normal = gl.getAttribLocation(program, 'aNormal');
      gl.enableVertexAttribArray(position); gl.vertexAttribPointer(position, 3, gl.FLOAT, false, 24, 0);
      gl.enableVertexAttribArray(normal); gl.vertexAttribPointer(normal, 3, gl.FLOAT, false, 24, 12);
      gl.bindVertexArray(null);
      uniforms = Object.fromEntries(modelNames.map(name => [name, gl.getUniformLocation(program, name)]));
      gl.enable(gl.DEPTH_TEST);
      gl.enable(gl.CULL_FACE);
      gl.clearColor(0, 0, 0, 0);
      initialised = true;
      resize();
      if (!contextLostHandler) {
        contextLostHandler = event => {
          event.preventDefault();
          stop();
          initialised = false;
          const host = canvas.parentElement;
          if (host) {
            host.dataset.renderer = 'fallback';
            host.querySelector('.companion-avatar')?.removeAttribute('hidden');
            host.setAttribute('aria-label', 'Agent AEGIS companion presentation using the accessible 2D fallback');
          }
          cleanupGl();
        };
        contextRestoredHandler = () => {
          if (disposed) return;
          const result = init();
          const host = canvas.parentElement;
          if (host && result.supported) {
            host.dataset.renderer = 'webgl2';
            host.querySelector('.companion-avatar')?.setAttribute('hidden', '');
            host.setAttribute('aria-label', 'Procedural three-dimensional Agent AEGIS companion prototype');
          }
        };
        canvas.addEventListener('webglcontextlost', contextLostHandler);
        canvas.addEventListener('webglcontextrestored', contextRestoredHandler);
      }
      if (!visibilityHandler && typeof document !== 'undefined') {
        visibilityHandler = () => {
          if (document.visibilityState === 'visible') schedule();
          else stop();
        };
        document.addEventListener('visibilitychange', visibilityHandler);
      }
      if (typeof ResizeObserver !== 'undefined') {
        if (!resizeObserver) {
          resizeObserver = new ResizeObserver(entries => {
            const rect = entries[0]?.contentRect;
            if (rect) resize(rect.width, rect.height, Math.min(window.devicePixelRatio || 1, 1.5));
            schedule();
          });
          resizeObserver.observe(canvas);
        }
      } else if (typeof window !== 'undefined' && !windowResizeAttached) {
        window.addEventListener('resize', onResize);
        windowResizeAttached = true;
      }
      schedule();
      return { supported: true, renderer: 'webgl2' };
    } catch (error) {
      cleanupGl();
      return { supported: false, reason: 'renderer-initialisation-failed', message: String(error?.message || error) };
    }
  }
  let visibilityHandler = null;
  let windowResizeAttached = false;
  let contextLostHandler = null;
  let contextRestoredHandler = null;
  function onResize() { resize(canvas.clientWidth, canvas.clientHeight, Math.min(window.devicePixelRatio || 1, 1.5)); schedule(); }
  function stop() {
    if (raf && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(raf);
    raf = 0;
  }
  function schedule() {
    if (!initialised || disposed || raf || typeof requestAnimationFrame !== 'function') return;
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
    const rect = canvas.getBoundingClientRect?.();
    if (rect && (rect.width < 1 || rect.height < 1)) return;
    raf = requestAnimationFrame(render);
  }
  function drawPart(model, colour, glow = 0) {
    gl.uniformMatrix4fv(uniforms.uModel, false, model);
    gl.uniform3fv(uniforms.uColour, colour);
    gl.uniform1f(uniforms.uGlow, glow);
    gl.drawElements(gl.TRIANGLES, geometry.indices.length, gl.UNSIGNED_SHORT, 0);
  }
  function render(now = 0) {
    raf = 0;
    if (!initialised || disposed || !gl) return;
    if (now - lastFrame < 32) { schedule(); return; }
    lastFrame = now;
    const t = now / 1000;
    resize();
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.useProgram(program);
    gl.bindVertexArray(vao);
    const aspect = canvas.width / Math.max(1, canvas.height);
    const projection = perspective(0.72, aspect, 0.1, 30);
    const view = lookAt([0, 0.2, 5.2], [0, 0.05, 0], [0, 1, 0]);
    gl.uniformMatrix4fv(uniforms.uProjection, false, projection);
    gl.uniformMatrix4fv(uniforms.uView, false, view);
    gl.uniform3fv(uniforms.uCamera, [0, 0.2, 5.2]);
    const active = state !== 'paused' && state !== 'disconnected';
    const motion = reducedMotion ? 0 : (active ? Math.sin(t * (state === 'thinking' ? 1.2 : 0.72)) * 0.035 : 0);
    const turn = reducedMotion ? 0 : (state === 'listening' ? Math.sin(t * 1.3) * 0.08 : Math.sin(t * 0.28) * 0.025);
    const root = multiply(rotationY(turn), translation(0, motion, 0));
    const skin = [0.34, 0.56, 0.68];
    const shell = [0.055, 0.17, 0.25];
    const trim = [0.23, 0.72, 0.78];
    const part = (position, scale, colour, glow = 0, rotation = identity()) => {
      drawPart(multiply(root, multiply(translation(...position), multiply(rotation, scale))), colour, glow);
    };
    part([0, -0.7, 0], [0.73, 0.76, 0.42], shell, 0.025, rotationX(-0.08));
    part([0, 0.05, 0], [0.18, 0.34, 0.19], skin);
    part([-0.62, -0.23, 0], [0.25, 0.34, 0.27], shell, 0.04, rotationZSafe(-0.28));
    part([0.62, -0.23, 0], [0.25, 0.34, 0.27], shell, 0.04, rotationZSafe(0.28));
    part([0, 0.64, 0], [0.46, 0.59, 0.39], skin, 0.015, rotationX(reducedMotion ? 0 : Math.sin(t * 0.4) * 0.012));
    part([0, 0.27, 0.34], [0.31, 0.11, 0.075], trim, 0.09);
    const eyeGlow = state === 'thinking' ? 0.24 : state === 'speaking' ? 0.3 : 0.14;
    part([-0.18, 0.69, 0.345], [0.075, 0.025, 0.035], [0.72, 0.94, 0.98], eyeGlow);
    part([0.18, 0.69, 0.345], [0.075, 0.025, 0.035], [0.72, 0.94, 0.98], eyeGlow);
    part([0, 0.52, 0.37], [0.035, 0.085, 0.045], trim, 0.03);
    const activeVisemes = getFreshVisemes(visemes, visemeReceivedAt, now);
    const mouthOpen = Math.max(activeVisemes.jawOpen, activeVisemes.aa * 0.9, activeVisemes.oh * 0.75, activeVisemes.ou * 0.55);
    const smile = expression.id === 'smile' ? expression.weight : 0;
    const mouthHeight = 0.018 + mouthOpen * 0.095;
    part([0, 0.39, 0.37], [0.105 + smile * 0.035, mouthHeight, 0.025], [0.025, 0.055, 0.075], 0);
    if (state === 'listening' || state === 'speaking') {
      part([0, 1.28, 0], [0.035, 0.035, 0.035], trim, 0.25);
    }
    gl.bindVertexArray(null);
    schedule();
  }
  function rotationZSafe(angle) {
    const c = Math.cos(angle), s = Math.sin(angle), m = identity();
    m[0] = c; m[1] = s; m[4] = -s; m[5] = c;
    return m;
  }
  function cleanupGl() {
    if (!gl) return;
    if (buffer) gl.deleteBuffer(buffer);
    if (indexBuffer) gl.deleteBuffer(indexBuffer);
    if (vao) gl.deleteVertexArray(vao);
    if (program) gl.deleteProgram(program);
    buffer = indexBuffer = vao = program = null;
    gl = null;
    initialised = false;
  }
  function setState(next) {
    if (!COMPANION_STATES.includes(next)) return false;
    state = next === 'responding' ? 'speaking' : next === 'error' ? 'disconnected' : next;
    schedule(); return true;
  }
  function setExpression(id, weight) {
    expression = normaliseExpression(id, weight); schedule(); return expression;
  }
  function setVisemes(timestamp, weights) {
    const time = Number(timestamp);
    visemeTimestamp = Number.isFinite(time) ? Math.max(0, time) : 0;
    visemeReceivedAt = typeof performance !== 'undefined' && Number.isFinite(performance.now()) ? performance.now() : 0;
    visemes = normaliseVisemes(weights);
    schedule();
    return { timestamp: visemeTimestamp, weights: { ...visemes } };
  }
  async function prepareModelResource(loader) {
    if (disposed) return { prepared: false, reason: 'renderer-disposed' };
    return modelLifecycle.prepare(async () => {
      const resource = await loader();
      return resource && typeof resource === 'object' && typeof resource.dispose === 'function'
        ? resource
        : null;
    });
  }
  async function commitModelResource(ticket) {
    if (disposed) return { committed: false, reason: 'renderer-disposed' };
    return modelLifecycle.commit(ticket);
  }
  async function loadModel(assetManifest, file, cryptoApi = globalThis.crypto) {
    const validation = validateCompanionAssetManifest(assetManifest);
    if (!validation.valid) return { loaded: false, reason: validation.reason };
    if (!file || typeof file !== 'object' || !Number.isSafeInteger(file.size) || file.size < 1) {
      return { loaded: false, reason: 'invalid-asset-file' };
    }
    if (file.size > COMPANION_ASSET_MAX_BYTES) return { loaded: false, reason: 'asset-too-large' };
    if (file.size !== validation.manifest.byteLength) return { loaded: false, reason: 'asset-size-mismatch' };
    const digest = await verifyCompanionAssetDigest(file, validation.manifest.sha256, cryptoApi);
    if (!digest.verified) return { loaded: false, reason: digest.reason };
    return { loaded: false, reason: 'external-model-loader-not-yet-enabled' };
  }
  function playAnimation(id) { return setState(id); }
  function suspend() { stop(); return true; }
  function resume() { schedule(); return true; }
  function dispose() {
    if (disposed) return true;
    disposed = true;
    void modelLifecycle.destroy();
    stop();
    if (resizeObserver) resizeObserver.disconnect();
    if (contextLostHandler) canvas?.removeEventListener('webglcontextlost', contextLostHandler);
    if (contextRestoredHandler) canvas?.removeEventListener('webglcontextrestored', contextRestoredHandler);
    if (typeof document !== 'undefined' && visibilityHandler) document.removeEventListener('visibilitychange', visibilityHandler);
    if (typeof window !== 'undefined') window.removeEventListener('resize', onResize);
    cleanupGl();
    return true;
  }
  return { init, resize, setState, setExpression, setVisemes, loadModel, prepareModelResource, commitModelResource, playAnimation, suspend, resume, dispose, get activeModelResource() { return modelLifecycle.active; }, get state() { return state; }, get supported() { return initialised; } };
}

function mountCompanionCanvases() {
  const hosts = [document.getElementById('companionVisual'), document.getElementById('companionModeVisual')].filter(Boolean);
  for (const host of hosts) {
    const canvas = document.createElement('canvas');
    canvas.className = 'companion-render-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    canvas.setAttribute('role', 'presentation');
    host.prepend(canvas);
    const renderer = createCompanionRenderer(canvas);
    const result = renderer.init();
    if (result.supported) {
      host.dataset.renderer = 'webgl2';
      host.setAttribute('aria-label', 'Procedural three-dimensional Agent AEGIS companion prototype');
      host.querySelector('.companion-avatar')?.setAttribute('hidden', '');
      const status = document.getElementById('companionStatus');
      if (status) status.textContent = '3D procedural prototype · WebGL2 · imported models and voice are not connected.';
      const modeState = document.getElementById('companionModeState');
      if (modeState) modeState.textContent = '3D procedural prototype ready. Microphone capture and spoken responses are not connected.';
    } else {
      canvas.remove();
      host.dataset.renderer = 'fallback';
      const status = document.getElementById('companionStatus');
      if (status) status.textContent = 'WebGL2 is unavailable here; using the accessible 2D companion fallback.';
    }
    host._aegisRenderer = renderer;
    if (typeof IntersectionObserver !== 'undefined') {
      const observer = new IntersectionObserver(entries => {
        if (entries[0]?.isIntersecting) renderer.resume();
        else renderer.suspend();
      });
      observer.observe(host);
      host._aegisObserver = observer;
    }
  }
}
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mountCompanionCanvases, { once: true });
  else mountCompanionCanvases();
}
