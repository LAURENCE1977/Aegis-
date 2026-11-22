import test from 'node:test';
import assert from 'node:assert/strict';
import { createSessionToken } from '../functions/lib/auth.mjs';
import { onRequestPost } from '../functions/api/ag-ui.js';
import { storeVaultSecret } from '../functions/lib/secret-vault.mjs';

const secret='ag-ui-api-test-session-secret-long-enough';
const envBase={AEGIS_PASSWORD:'test-password-long-enough',AEGIS_SESSION_SECRET:secret};

async function request(body,{authenticated=true,origin='https://aegis.example'}={}){
  const headers={'Content-Type':'application/json',Origin:origin};
  if(authenticated) headers.Cookie='__Host-aegis_session='+await createSessionToken(secret);
  return new Request('https://aegis.example/api/ag-ui',{method:'POST',headers,body:JSON.stringify(body)});
}

class UsageLedgerMemoryD1 {
  constructor(delegate = null, { autoApprovePaid = true } = {}) {
    this.delegate = delegate;
    this.reservations = new Map();
    this.approvals = new Map();
    this.autoApprovePaid = autoApprovePaid;
    this.quota = { id: "quota-test-001", window_start: new Date(Date.now() - 60000).toISOString(), window_end: new Date(Date.now() + 86400000).toISOString() };
  }
  prepare(sql) {
    const owner = this;
    if (sql.includes("INSERT INTO capability_approvals")) {
      return { values: [], bind(...values) { this.values = values; return this; }, async run() {
        const v = this.values;
        const approved = owner.autoApprovePaid;
        owner.approvals.set(v[0], {
          id: v[0], principal_id: v[1], capability_id: v[2], capability_version: v[3],
          action_id: v[4], resource_id: v[5], operation_summary: v[6], connection_id: v[7],
          input_digest: v[8], requested_by: v[9], requested_at: v[10], expires_at: v[11],
          status: approved ? "approved" : "pending",
          decided_by: approved ? "owner" : null,
          decided_at: approved ? new Date(Date.parse(v[10]) + 1000).toISOString() : null,
          consumed_at: null,
        });
        return { meta: { changes: 1 } };
      } };
    }
    if (sql.includes("FROM capability_approvals")) {
      return { values: [], bind(...values) { this.values = values; return this; },
        async first() {
          const v = this.values;
          if (sql.includes("WHERE id = ?")) {
            const row = owner.approvals.get(v[0]);
            return row ? { ...row } : null;
          }
          if (sql.includes("input_digest = ?")) {
            const row = [...owner.approvals.values()].find(item =>
              item.principal_id === v[0] && item.capability_id === v[1] &&
              item.capability_version === v[2] && item.action_id === v[3] &&
              item.resource_id === v[4] && item.input_digest === v[5] &&
              (!sql.includes("status = 'approved'") || item.status === "approved") &&
              (!sql.includes("expires_at > ?") || item.expires_at > v.at(-1))
            );
            return row ? { ...row } : null;
          }
          return null;
        },
        async run() { return { meta: { changes: 1 } }; }
      };
    }
    if (sql.includes("UPDATE capability_approvals")) {
      return { values: [], bind(...values) { this.values = values; return this; }, async first() {
        const v = this.values;
        const [consumedAt, id, expiresAt, principal, capability, version, action, resource, summary, connection, digest] = v;
        const row = owner.approvals.get(id);
        if (!row || row.status !== "approved" || row.consumed_at || row.expires_at <= expiresAt ||
            row.principal_id !== principal || row.capability_id !== capability ||
            row.capability_version !== version || row.action_id !== action ||
            row.resource_id !== resource || row.operation_summary !== summary ||
            row.connection_id !== connection || row.input_digest !== digest) return null;
        row.status = "consumed";
        row.consumed_at = consumedAt;
        return { ...row };
      } };
    }
    if (sql.includes("FROM model_usage_quota_windows") && sql.includes("SELECT id, window_start")) {
      return { bind(...values) { this.values = values; return this; }, async all() {
        return { results: [{ ...owner.quota, provider_id: this.values[0], model_id: this.values[1] }] };
      } };
    }
    if (sql.includes("model_usage_reservations") || sql.includes("model_usage_events")) {
      return { sql, values: [], bind(...values) { this.values = values; return this; },
        async first() {
          if (sql.includes("WHERE r.idempotency_key = ?")) {
            const row = [...owner.reservations.values()].find(item => item.idempotency_key === this.values[0]);
            return row ? owner.join(row) : null;
          }
          if (sql.includes("WHERE r.id = ?")) {
            const row = owner.reservations.get(this.values[0]);
            return row ? { reserved_units: row.reserved_units, status: row.status, provider_id: row.provider_id, model_id: row.model_id, unit_kind: "tokens" } : null;
          }
          return null;
        },
        async run() { return { meta: { changes: 1 } }; }
      };
    }
    if (owner.delegate?.prepare) return owner.delegate.prepare(sql);
    return { bind() { return this; }, async first() { return null; }, async all() { return { results: [] }; }, async run() { return { meta: { changes: 1 } }; } };
  }
  join(row) {
    return { ...row, provider_id: row.provider_id, model_id: row.model_id, unit_kind: "tokens", window_start: this.quota.window_start, window_end: this.quota.window_end };
  }
  async batch(statements) {
    const results = [];
    for (const statement of statements) {
      const sql = statement.sql || "";
      const v = statement.values || [];
      if (sql.includes("INSERT INTO model_usage_reservations")) {
        const [id, idempotency_key, principal_id, project_id, reserved_units, created_at, updated_at, quota_window_id, provider_id, model_id] = v;
        if (!this.reservations.has(id)) this.reservations.set(id, { id, idempotency_key, principal_id, project_id, reserved_units, actual_units: null, status: "reserved", created_at, updated_at, quota_window_id, provider_id, model_id });
      } else if (sql.includes("UPDATE model_usage_reservations SET status = 'settled'")) {
        const [actual_units, updated_at, id] = v;
        const row = this.reservations.get(id);
        if (row?.status === "reserved") { row.status = "settled"; row.actual_units = actual_units; row.updated_at = updated_at; }
      }
      results.push({ meta: { changes: 1 } });
    }
    return results;
  }
}


const input=(overrides={})=>({
  threadId:'thread-123',runId:'run-123',protocolVersion:'1.0',
  messages:[{id:'user-1',role:'user',content:'Hello AEGIS.'}],
  tools:[],context:[],...overrides,
});

test('AG-UI endpoint requires a configured signed session before model access',async()=>{
  const noConfig=await onRequestPost({request:await request(input()),env:{}});
  assert.equal(noConfig.status,503);
  const noSession=await onRequestPost({request:await request(input(),{authenticated:false}),env:envBase});
  assert.equal(noSession.status,401);
});

test('AG-UI endpoint rejects cross-origin writes',async()=>{
  const response=await onRequestPost({
    request:await request(input(),{origin:'https://attacker.example'}),
    env:envBase,
  });
  assert.equal(response.status,403);
});

test('AG-UI endpoint rejects frontend tools and ambient context until Sentinel mediation is connected',async()=>{
  const toolResponse=await onRequestPost({
    request:await request(input({tools:[{name:'dangerous-tool'}]})),
    env:envBase,
  });
  assert.equal(toolResponse.status,400);
  const contextResponse=await onRequestPost({
    request:await request(input({context:[{description:'untrusted',value:'inject'}]})),
    env:envBase,
  });
  assert.equal(contextResponse.status,400);
});

function modelSseStream(chunks) {
  const encoder=new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
}

test('AG-UI endpoint streams model deltas as ordered protocol 1.0 events',async()=>{
  let captured;
  const response=await onRequestPost({
    request:await request(input({
      messages:[
        {id:'old-user',role:'user',content:'Earlier question'},
        {id:'old-assistant',role:'assistant',content:'Earlier answer'},
        {id:'user-1',role:'user',content:'Hello AEGIS.'},
      ],
    })),
    env:{
      ...envBase,
      AI:{async run(model,payload){captured=payload;return modelSseStream(['data: {"response":"Hello "}\n\n','data: {"response":"from AEGIS."}\n\ndata: [DONE]\n\n']);}},
    },
  });
  assert.equal(response.status,200);
  assert.ok(response.headers.get('content-type').includes('text/event-stream'));
  const events=(await response.text()).trim().split('\n\n').map(frame=>JSON.parse(frame.slice(6)));
  assert.deepEqual(events.map(event=>event.type),[
    'RUN_STARTED','TEXT_MESSAGE_START','TEXT_MESSAGE_CONTENT','TEXT_MESSAGE_CONTENT','TEXT_MESSAGE_END','RUN_FINISHED',
  ]);
  assert.deepEqual(events.filter(event=>event.type==='TEXT_MESSAGE_CONTENT').map(event=>event.delta),['Hello ','from AEGIS.']);
  assert.equal(captured.stream,true);
  assert.equal(captured.messages.at(-1).content,'Hello AEGIS.');
  assert.match(captured.messages[0].content,/AEGIS/);
});


test('AG-UI reports model startup failures as a first-event RUN_ERROR frame',async()=>{
  const response=await onRequestPost({
    request:await request(input()),
    env:{...envBase,AI:{async run(){throw new Error('private provider secret must not leak');}}},
  });
  assert.equal(response.status,502);
  assert.ok(response.headers.get('content-type').includes('text/event-stream'));
  const body=await response.text();
  const firstFrame=body.split(/\\r?\n\\r?\n/)[0];
  const event=JSON.parse(firstFrame.slice(6));
  assert.equal(event.type,'RUN_ERROR');
  assert.equal(event.message,'The AI could not start this run. Please try again.');
  assert.doesNotMatch(body,/private provider secret/);
});

test('AG-UI endpoint rejects non-text and malformed runs rather than silently dropping content',async()=>{
  const noQuestion=await onRequestPost({
    request:await request(input({messages:[{id:'x',role:'assistant',content:'not a user turn'}]})),
    env:{...envBase,AI:{async run(){throw new Error('must not run');}}},
  });
  assert.equal(noQuestion.status,400);
  const multimodal=await onRequestPost({
    request:await request(input({messages:[{id:'x',role:'user',content:[{type:'image',source:{type:'url',value:'https://example.com/image.png'}}]}]})),
    env:{...envBase,AI:{async run(){throw new Error('must not run');}}},
  });
  assert.equal(multimodal.status,400);
});


test('AG-UI stream parser handles provider frames split across arbitrary network chunks',async()=>{
  const response=await onRequestPost({
    request:await request(input()),
    env:{
      ...envBase,
      AI:{async run(){return modelSseStream([
        'data: {"res',
        'ponse":"split',
        ' frame"}\n\n',
        'data: [DONE]\n\n',
      ]);}},
    },
  });
  const events=(await response.text()).trim().split('\n\n').map(frame=>JSON.parse(frame.slice(6)));
  assert.deepEqual(events.filter(event=>event.type==='TEXT_MESSAGE_CONTENT').map(event=>event.delta),['split frame']);
});

test('AG-UI reports a safe terminal error if the provider stream breaks mid-run',async()=>{
  let sent = false;
  const brokenStream=new ReadableStream({
    pull(controller) {
      if (!sent) {
        sent = true;
        controller.enqueue(new TextEncoder().encode('data: {"response":"partial"}\n\n'));
      } else {
        controller.error(new Error('provider internals must not leak'));
      }
    },
  });
  const response=await onRequestPost({
    request:await request(input()),
    env:{...envBase,AI:{async run(){return brokenStream;}}},
  });
  const frames=(await response.text()).trim().split('\n\n').map(frame=>JSON.parse(frame.slice(6)));
  assert.equal(frames[2].delta,'partial');
  assert.equal(frames[3].type,'RUN_ERROR');
  assert.doesNotMatch(JSON.stringify(frames),/provider internals/);
});


test('AG-UI endpoint rejects unknown top-level and message fields',async()=>{
  const unknownTop=await onRequestPost({
    request:await request(input({tools:[],experimentalExecution:true})),
    env:{...envBase,AI:{async run(){throw new Error('must not run');}}},
  });
  assert.equal(unknownTop.status,400);
  const unknownMessage=await onRequestPost({
    request:await request(input({messages:[{id:'x',role:'user',content:'hello',toolCalls:[{name:'shell'}]}]})),
    env:{...envBase,AI:{async run(){throw new Error('must not run');}}},
  });
  assert.equal(unknownMessage.status,400);
});

test('AG-UI endpoint bounds and validates run identifiers before model access',async()=>{
  const longRun=await onRequestPost({
    request:await request(input({runId:'r'.repeat(129)})),
    env:{...envBase,AI:{async run(){throw new Error('must not run');}}},
  });
  assert.equal(longRun.status,400);
  const control=await onRequestPost({
    request:await request(input({threadId:'thread\u0000bad'})),
    env:{...envBase,AI:{async run(){throw new Error('must not run');}}},
  });
  assert.equal(control.status,400);
});


test('AG-UI rejects invalid or non-owned Project Space context before model access',async()=>{
  const invalid=await onRequestPost({
    request:await request(input({projectId:'bad project id'})),
    env:{...envBase,AI:{async run(){throw new Error('must not run');}}},
  });
  assert.equal(invalid.status,400);
  const missing=await onRequestPost({
    request:await request(input({projectId:'project-123'})),
    env:{
      ...envBase,
      AEGIS_DB:{prepare(){return {bind(){return this;},async first(){return null;}};}},
      AI:{async run(){throw new Error('must not run');}},
    },
  });
  assert.equal(missing.status,404);
});


test('AG-UI streams Qwen deltas only when the owner explicitly selects the configured provider',async()=>{
  let captured;
  const response=await onRequestPost({
    request:await request(input()),
    env:{
      ...envBase,
      AEGIS_MODEL_PROVIDER:'alibaba-qwen',
      AEGIS_ALLOW_PAID_SPEND: 'true',
      AEGIS_PAID_INFERENCE_APPROVED: 'true',
      AEGIS_PAID_INFERENCE_MAX_TOKENS_PER_RUN: '100000',
      AEGIS_DB: new UsageLedgerMemoryD1(),
      AEGIS_QWEN_API_KEY:'test-qwen-api-key-long-enough',
      AEGIS_QWEN_WORKSPACE_ID:'workspace-123',
      AEGIS_QWEN_REGION:'ap-southeast-1',
      AEGIS_QWEN_MODEL:'qwen3.8-flash',
    },
    fetchImpl:async(url,options)=>{
      captured={url,options};
      return new Response(modelSseStream([
        'data: {"choices":[{"delta":{"content":"Qwen "}}]}\n\n',
        'data: {"choices":[{"delta":{"content":"stream."}}]}\n\n',
        'data: [DONE]\n\n',
      ]),{status:200,headers:{'Content-Type':'text/event-stream'}});
    },
  });
  assert.equal(response.status,200);
  const events=(await response.text()).trim().split('\n\n').map(frame=>JSON.parse(frame.slice(6)));
  assert.deepEqual(events.filter(event=>event.type==='TEXT_MESSAGE_CONTENT').map(event=>event.delta),['Qwen ','stream.']);
  assert.equal(captured.url,'https://workspace-123.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1/chat/completions');
  assert.equal(captured.options.headers.Authorization,'Bearer test-qwen-api-key-long-enough');
});

test('AG-UI zero-spend mode blocks paid provider calls even when legacy approval is enabled', async () => {
  const db = new UsageLedgerMemoryD1();
  let providerCalls = 0;
  const env = {
    ...envBase,
    AEGIS_MODEL_PROVIDER: 'alibaba-qwen',
    AEGIS_PAID_INFERENCE_APPROVED: 'true',
    AEGIS_PAID_INFERENCE_MAX_TOKENS_PER_RUN: '100000',
    AEGIS_DB: db,
    AEGIS_QWEN_API_KEY: 'test-qwen-api-key-long-enough',
    AEGIS_QWEN_WORKSPACE_ID: 'workspace-123',
    AEGIS_QWEN_REGION: 'ap-southeast-1',
    AEGIS_QWEN_MODEL: 'qwen3.8-flash',
  };
  const response = await onRequestPost({
    request: await request(input({ runId: 'run-zero-spend-lock' })),
    env,
    fetchImpl: async () => {
      providerCalls += 1;
      throw new Error('paid provider must not be contacted');
    },
  });
  assert.equal(response.status, 403);
  assert.equal((await response.json()).code, 'PAID_SPEND_DISABLED');
  assert.equal(providerCalls, 0);
  assert.equal(db.approvals.size, 0);
  assert.equal(db.reservations.size, 0);
});

test('AG-UI blocks paid provider access until the owner approves the exact run', async () => {
  const db = new UsageLedgerMemoryD1(null, { autoApprovePaid: false });
  let providerCalls = 0;
  const env = {
    ...envBase,
    AEGIS_MODEL_PROVIDER: 'alibaba-qwen',
    AEGIS_ALLOW_PAID_SPEND: 'true',
      AEGIS_PAID_INFERENCE_APPROVED: 'true',
    AEGIS_PAID_INFERENCE_MAX_TOKENS_PER_RUN: '100000',
    AEGIS_DB: db,
    AEGIS_QWEN_API_KEY: 'test-qwen-api-key-long-enough',
    AEGIS_QWEN_WORKSPACE_ID: 'workspace-123',
    AEGIS_QWEN_REGION: 'ap-southeast-1',
    AEGIS_QWEN_MODEL: 'qwen3.8-flash',
  };
  const fetchImpl = async () => {
    providerCalls += 1;
    return new Response(modelSseStream([
      'data: {"choices":[{"delta":{"content":"Approved run."}}]}\\n\\n',
      'data: {"choices":[],"usage":{"prompt_tokens":10,"completion_tokens":3,"total_tokens":13}}\\n\\n',
      'data: [DONE]\\n\\n',
    ]), { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
  };
  const body = input({ runId: 'run-exact-approval' });
  const pending = await onRequestPost({ request: await request(body), env, fetchImpl });
  assert.equal(pending.status, 202);
  const pendingBody = await pending.json();
  assert.equal(pendingBody.code, 'PAID_INFERENCE_APPROVAL_REQUIRED');
  assert.equal(db.approvals.size, 1);
  assert.equal([...db.approvals.values()][0].status, 'pending');
  assert.equal(providerCalls, 0);
  assert.equal(db.reservations.size, 0);

  const approval = [...db.approvals.values()][0];
  approval.status = 'approved';
  approval.decided_by = 'owner';
  approval.decided_at = new Date().toISOString();

  const resumed = await onRequestPost({ request: await request(body), env, fetchImpl });
  assert.equal(resumed.status, 200);
  assert.equal(providerCalls, 1);
  assert.equal(approval.status, 'consumed');
  assert.equal(db.reservations.size, 1);
});

test('AG-UI marks a response stopped by the output safety cap as cancelled, not successful',async()=>{
  let cancelled=false;
  const largeStream=new ReadableStream({
    start(controller){controller.enqueue(new TextEncoder().encode('data: '+JSON.stringify({response:'x'.repeat(12001)})+'\n\n'));}
    ,cancel(){cancelled=true;}
  });
  const response=await onRequestPost({
    request:await request(input()),
    env:{...envBase,AI:{async run(){return largeStream;}}},
  });
  const events=(await response.text()).trim().split('\n\n').map(frame=>JSON.parse(frame.slice(6)));
  const text=events.filter(event=>event.type==='TEXT_MESSAGE_CONTENT').map(event=>event.delta).join('');
  assert.equal(text.length,12000);
  assert.equal(events.at(-1).type,'RUN_FINISHED');
  assert.equal(events.at(-1).outcome,'cancelled');
  assert.equal(cancelled,true);
});
class AgentToolMemoryD1 {
  constructor(grantRow) {
    this.grantRow = grantRow;
    this.auditRows = [];
  }
  prepare(sql) {
    const db = this;
    return {
      values: [],
      bind(...values) { this.values = values; return this; },
      async first() {
        if (sql.includes('FROM capability_grants')) return db.grantRow ? { ...db.grantRow } : null;
        if (sql.includes('INSERT INTO capability_invocation_limits')) return { request_count: 1 };
        return null;
      },
      async all() { return { results: [] }; },
      async run() {
        if (sql.includes('INSERT INTO capability_invocation_audit')) db.auditRows.push(this.values);
        return { meta: { changes: 1 } };
      },
    };
  }
}

function moduleListGrant() {
  const now = Date.now();
  return {
    id: 'agent-grant-1',
    principal_id: 'owner',
    capability_id: 'aegis-module-catalogue',
    capability_version: '0.1.0',
    resource_id: 'aegis:modules',
    scopes_json: JSON.stringify(['aegis:module-catalogue:read']),
    status: 'active',
    created_by: 'owner',
    created_at: new Date(now - 1000).toISOString(),
    expires_at: new Date(now + 60_000).toISOString(),
    revoked_at: null,
  };
}

function qwenToolDelta(delta) {
  return 'data: ' + JSON.stringify({ choices: [{ delta }] }) + '\n\n';
}

test('AG-UI runs one server-defined Qwen tool through Sentinel and summarizes the audited result', async () => {
  const db = new AgentToolMemoryD1(moduleListGrant());
  const calls = [];
  const response = await onRequestPost({
    request: await request(input({
      messages: [{ id: 'user-1', role: 'user', content: 'List my AEGIS modules.' }],
    })),
    env: {
      ...envBase,
      AEGIS_AGENT_TOOLS_ENABLED: 'true',
      AEGIS_MODEL_PROVIDER: 'alibaba-qwen',
      AEGIS_DB: new UsageLedgerMemoryD1(),
      AEGIS_ALLOW_PAID_SPEND: 'true',
      AEGIS_PAID_INFERENCE_APPROVED: 'true',
      AEGIS_PAID_INFERENCE_MAX_TOKENS_PER_RUN: '100000',
      AEGIS_QWEN_API_KEY: 'test-qwen-api-key-long-enough',
      AEGIS_QWEN_WORKSPACE_ID: 'workspace-123',
      AEGIS_QWEN_REGION: 'ap-southeast-1',
      AEGIS_QWEN_MODEL: 'qwen3.8-flash',
      AEGIS_DB: new UsageLedgerMemoryD1(db),
    },
    fetchImpl: async (_url, options) => {
      const payload = JSON.parse(options.body);
      calls.push(payload);
      if (calls.length === 1) {
        return new Response(modelSseStream([
          qwenToolDelta({ tool_calls: [{
            index: 0, id: 'call_123', type: 'function',
            function: { name: 'aegis_list_modules', arguments: '{' },
          }] }),
          qwenToolDelta({ tool_calls: [{
            index: 0, function: { arguments: '}' },
          }] }),
          'data: {"choices":[],"usage":{"prompt_tokens":10,"completion_tokens":3,"total_tokens":13}}\n\n',
          'data: [DONE]\n\n',
        ]), { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
      }
      return new Response(modelSseStream([
        qwenToolDelta({ content: 'I checked AEGIS and found the module catalogue.' }),
        'data: {"choices":[],"usage":{"prompt_tokens":20,"completion_tokens":5,"total_tokens":25}}\n\n',
        'data: [DONE]\n\n',
      ]), { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
    },
  });

  assert.equal(response.status, 200);
  const events = (await response.text()).trim().split('\n\n').map(frame => JSON.parse(frame.slice(6)));
  assert.deepEqual(events.filter(event => event.type === 'TEXT_MESSAGE_CONTENT').map(event => event.delta), [
    'I checked AEGIS and found the module catalogue.',
  ]);
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[0].tools.map(tool => tool.function.name), [
    'aegis_list_modules',
    'aegis_discover_public_github_repository',
  ]);
  assert.equal(calls[0].tool_choice, 'auto');
  assert.equal(calls[1].tools, undefined);
  assert.deepEqual(calls[1].messages.slice(-2).map(message => message.role), ['assistant', 'tool']);
  assert.match(calls[1].messages.at(-1).content, /"ok":true/);
  assert.equal(db.auditRows.length, 3);
  assert.equal(events.at(-1).usageAccountingStatus, 'settled');
  assert.equal(events.at(-1).usage.totalTokens, 38);
});

test('AG-UI never offers or executes tools unless the owner explicitly enables supported Qwen plus D1', async () => {
  const db = new AgentToolMemoryD1(moduleListGrant());
  let captured;
  const response = await onRequestPost({
    request: await request(input()),
    env: {
      ...envBase,
      AEGIS_MODEL_PROVIDER: 'alibaba-qwen',
      AEGIS_ALLOW_PAID_SPEND: 'true',
      AEGIS_PAID_INFERENCE_APPROVED: 'true',
      AEGIS_PAID_INFERENCE_MAX_TOKENS_PER_RUN: '100000',
      AEGIS_QWEN_API_KEY: 'test-qwen-api-key-long-enough',
      AEGIS_QWEN_WORKSPACE_ID: 'workspace-123',
      AEGIS_QWEN_REGION: 'ap-southeast-1',
      AEGIS_DB: new UsageLedgerMemoryD1(db),
    },
    fetchImpl: async (_url, options) => {
      captured = JSON.parse(options.body);
      return new Response(modelSseStream([
        qwenToolDelta({ content: 'Tools are not enabled.' }),
        'data: [DONE]\n\n',
      ]), { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
    },
  });
  assert.equal(response.status, 200);
  assert.equal(captured.tools, undefined);
  assert.equal(db.auditRows.length, 0);
});

test('AG-UI rejects an oversized provider frame before parsing or forwarding it', async () => {
  const hugeFrame = 'data: ' + JSON.stringify({ response: 'x'.repeat(20_000) }) + '\n\n';
  const response = await onRequestPost({
    request: await request(input()),
    env: { ...envBase, AI: { async run() { return modelSseStream([hugeFrame]); } } },
  });
  const events = (await response.text()).trim().split('\n\n').map(frame => JSON.parse(frame.slice(6)));
  assert.equal(events.some(event => event.type === 'TEXT_MESSAGE_CONTENT'), false);
  assert.equal(events.at(-1).type, 'RUN_ERROR');
  assert.equal(events.at(-1).code, 'PROVIDER_FRAME_TOO_LARGE');
});

test('AG-UI cancels provider streams that exceed the total byte budget', async () => {
  const oversized = ': keepalive\n\n'.repeat(24_000);
  const response = await onRequestPost({
    request: await request(input()),
    env: { ...envBase, AI: { async run() { return modelSseStream([oversized]); } } },
  });
  const events = (await response.text()).trim().split('\n\n').map(frame => JSON.parse(frame.slice(6)));
  assert.equal(events.at(-1).type, 'RUN_ERROR');
  assert.equal(events.at(-1).code, 'PROVIDER_STREAM_TOO_LARGE');
});

test('AG-UI forwards Anthropic Messages content_block_delta text as normal assistant deltas', async () => {
  const anthropicFrames = [
    'event: message_start\ndata: {"type":"message_start","message":{"id":"msg_123","type":"message","role":"assistant","content":[]}}\n\n',
    'event: content_block_start\ndata: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}\n\n',
    'event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hello from Claude."}}\n\n',
    'event: content_block_stop\ndata: {"type":"content_block_stop","index":0}\n\n',
    'event: message_delta\ndata: {"type":"message_delta","delta":{"stop_reason":"end_turn"}}\n\n',
    'event: message_stop\ndata: {"type":"message_stop"}\n\n',
  ];
  const response = await onRequestPost({
    request: await request(input()),
    env: {
      ...envBase,
      AEGIS_MODEL_PROVIDER: 'anthropic',
      AEGIS_DB: new UsageLedgerMemoryD1(),
      AEGIS_ALLOW_PAID_SPEND: 'true',
      AEGIS_PAID_INFERENCE_APPROVED: 'true',
      AEGIS_PAID_INFERENCE_MAX_TOKENS_PER_RUN: '100000',
      ANTHROPIC_API_KEY: 'test-anthropic-api-key-long-enough',
      AEGIS_ANTHROPIC_MODEL: 'claude-opus-5-5',
    },
    fetchImpl: async (url, options) => {
      assert.equal(url, 'https://api.anthropic.com/v1/messages');
      assert.equal(options.headers.Authorization, 'Bearer test-anthropic-api-key-long-enough');
      return new Response(modelSseStream(anthropicFrames), {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      });
    },
  });
  assert.equal(response.status, 200);
  const events = (await response.text()).trim().split('\n\n')
    .map(frame => JSON.parse(frame.slice(6)));
  assert.ok(events.some(event => event.type === 'TEXT_MESSAGE_CONTENT' && event.delta === 'Hello from Claude.'), JSON.stringify(events));
  assert.equal(events.at(-1).type, 'RUN_FINISHED');
});


class VaultProviderMemoryD1 {
  constructor() { this.secrets = new Map(); this.connections = new Map(); }
  prepare(sql) {
    const db = this;
    return {
      values: [],
      bind(...values) { this.values = values; return this; },
      async run() {
        if (sql.includes('INSERT INTO capability_secrets')) {
          const [id, principal, provider, version, iv, ciphertext, createdAt] = this.values;
          db.secrets.set(id, {
            secret_id: id, principal_id: principal, provider_id: provider,
            key_version: version, iv_b64: iv, ciphertext_b64: ciphertext,
            created_at: createdAt, updated_at: createdAt, status: 'active',
          });
          return { meta: { changes: 1 } };
        }
        return { meta: { changes: 1 } };
      },
      async first() {
        if (sql.includes('FROM capability_connections')) {
          const [principal, provider, now] = this.values;
          const row = [...db.connections.values()].find(item =>
            item.principal_id === principal && item.provider_id === provider &&
            item.status === 'active' && !item.revoked_at &&
            (!item.expires_at || item.expires_at > now));
          return row ? { ...row } : null;
        }
        if (sql.includes('FROM capability_secrets')) {
          const [id, principal, provider] = this.values;
          const row = db.secrets.get(id);
          return row && row.principal_id === principal && row.provider_id === provider
            ? { ...row } : null;
        }
        return null;
      },
      async all() { return { results: [] }; },
    };
  }
}

test('AG-UI uses the active encrypted vault credential for Anthropic instead of the legacy environment key', async () => {
  const rawKey = crypto.getRandomValues(new Uint8Array(32));
  const keyB64 = btoa(String.fromCharCode(...rawKey));
  const vaultEnv = {
    AEGIS_VAULT_KEYRING: JSON.stringify({ v1: keyB64 }),
    AEGIS_VAULT_ACTIVE_KEY_VERSION: 'v1',
  };
  const db = new VaultProviderMemoryD1();
  const apiKey = 'anthropic-vault-key-secret-value-123';
  const stored = await storeVaultSecret(db, {
    principalId: 'owner', providerId: 'anthropic', secret: apiKey,
  }, vaultEnv);
  db.connections.set('connection-anthropic', {
    id: 'connection-anthropic', principal_id: 'owner', provider_id: 'anthropic',
    secret_ref: stored.secretRef,
    scopes_json: JSON.stringify(['anthropic:inference:chat']),
    status: 'active', revoked_at: null, expires_at: null,
  });

  let authorization;
  const response = await onRequestPost({
    request: await request(input()),
    env: {
      ...envBase,
      ...vaultEnv,
      AEGIS_DB: new UsageLedgerMemoryD1(db),
      AEGIS_MODEL_PROVIDER: 'anthropic',
      AEGIS_ALLOW_PAID_SPEND: 'true',
      AEGIS_PAID_INFERENCE_APPROVED: 'true',
      AEGIS_PAID_INFERENCE_MAX_TOKENS_PER_RUN: '100000',
      ANTHROPIC_API_KEY: 'legacy-environment-key-must-not-win',
      AEGIS_ANTHROPIC_MODEL: 'claude-sonnet-4-5',
    },
    fetchImpl: async (_url, options) => {
      authorization = options.headers.Authorization;
      return new Response(modelSseStream([
        'event: message_stop\ndata: {"type":"message_stop"}\n\n',
      ]), { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
    },
  });

  assert.equal(response.status, 200);
  assert.equal(authorization, 'Bearer ' + apiKey);
});


test('AG-UI uses the encrypted vault credential for Alibaba Qwen when no legacy key is configured', async () => {
  const rawKey = crypto.getRandomValues(new Uint8Array(32));
  const keyB64 = btoa(String.fromCharCode(...rawKey));
  const vaultEnv = {
    AEGIS_VAULT_KEYRING: JSON.stringify({ v1: keyB64 }),
    AEGIS_VAULT_ACTIVE_KEY_VERSION: 'v1',
  };
  const db = new VaultProviderMemoryD1();
  const apiKey = 'qwen-vault-key-secret-value-123456';
  const stored = await storeVaultSecret(db, {
    principalId: 'owner', providerId: 'alibaba-qwen', secret: apiKey,
  }, vaultEnv);
  db.connections.set('connection-qwen', {
    id: 'connection-qwen', principal_id: 'owner', provider_id: 'alibaba-qwen',
    secret_ref: stored.secretRef,
    scopes_json: JSON.stringify(['alibaba-qwen:inference:chat']),
    status: 'active', revoked_at: null, expires_at: null,
  });

  let authorization;
  const response = await onRequestPost({
    request: await request(input()),
    env: {
      ...envBase,
      ...vaultEnv,
      AEGIS_DB: new UsageLedgerMemoryD1(db),
      AEGIS_MODEL_PROVIDER: 'alibaba-qwen',
      AEGIS_ALLOW_PAID_SPEND: 'true',
      AEGIS_PAID_INFERENCE_APPROVED: 'true',
      AEGIS_PAID_INFERENCE_MAX_TOKENS_PER_RUN: '100000',
      AEGIS_QWEN_WORKSPACE_ID: 'workspace-123',
      AEGIS_QWEN_REGION: 'ap-southeast-1',
      AEGIS_QWEN_MODEL: 'qwen3.8-flash',
    },
    fetchImpl: async (_url, options) => {
      authorization = options.headers.Authorization;
      return new Response(modelSseStream([
        'data: {"choices":[{"delta":{"content":"Vault Qwen works."}}]}\n\n',
        'data: [DONE]\n\n',
      ]), { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
    },
  });

  assert.equal(response.status, 200);
  const body = await response.text();
  assert.equal(authorization, 'Bearer ' + apiKey);
  assert.match(body, /Vault Qwen works/);
  assert.doesNotMatch(body, /qwen-vault-key-secret-value/);
});


test('AG-UI includes Qwen provider-reported token usage only when the final usage chunk is present', async () => {
  let captured;
  const response = await onRequestPost({
    request: await request(input()),
    env: {
      ...envBase,
      AEGIS_MODEL_PROVIDER: 'alibaba-qwen',
      AEGIS_DB: new UsageLedgerMemoryD1(),
      AEGIS_ALLOW_PAID_SPEND: 'true',
      AEGIS_PAID_INFERENCE_APPROVED: 'true',
      AEGIS_PAID_INFERENCE_MAX_TOKENS_PER_RUN: '100000',
      AEGIS_QWEN_API_KEY: 'test-qwen-api-key-long-enough',
      AEGIS_QWEN_WORKSPACE_ID: 'workspace-123',
      AEGIS_QWEN_REGION: 'ap-southeast-1',
      AEGIS_QWEN_MODEL: 'qwen3.8-flash',
    },
    fetchImpl: async (_url, options) => {
      captured = JSON.parse(options.body);
      return new Response(modelSseStream([
        'data: {"choices":[{"delta":{"content":"Metered Qwen."}}]}\n\n',
        'data: {"choices":[],"usage":{"prompt_tokens":19,"completion_tokens":7,"total_tokens":26}}\n\n',
        'data: [DONE]\n\n',
      ]), { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
    },
  });

  assert.equal(response.status, 200);
  assert.deepEqual(captured.stream_options, { include_usage: true });
  const events = (await response.text()).trim().split('\n\n').map(frame => JSON.parse(frame.slice(6)));
  assert.deepEqual(events.at(-1).usage, {
    inputTokens: 19,
    outputTokens: 7,
    cacheCreationInputTokens: 0,
    cacheReadInputTokens: 0,
    totalTokens: 26,
    source: 'openai-compatible',
  });
  assert.equal(events.at(-1).usageAccountingStatus, 'settled');
});

test('AG-UI aggregates Anthropic input and output usage events without estimating missing values', async () => {
  const response = await onRequestPost({
    request: await request(input()),
    env: {
      ...envBase,
      AEGIS_MODEL_PROVIDER: 'anthropic',
      AEGIS_DB: new UsageLedgerMemoryD1(),
      AEGIS_ALLOW_PAID_SPEND: 'true',
      AEGIS_PAID_INFERENCE_APPROVED: 'true',
      AEGIS_PAID_INFERENCE_MAX_TOKENS_PER_RUN: '100000',
      ANTHROPIC_API_KEY: 'test-anthropic-api-key-long-enough',
      AEGIS_ANTHROPIC_MODEL: 'claude-sonnet-4-5',
    },
    fetchImpl: async () => new Response(modelSseStream([
      'event: message_start\ndata: {"type":"message_start","message":{"usage":{"input_tokens":31,"cache_creation_input_tokens":0,"cache_read_input_tokens":0}}}\n\n',
      'event: content_block_delta\ndata: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Metered Anthropic."}}\n\n',
      'event: message_delta\ndata: {"type":"message_delta","usage":{"output_tokens":11}}\n\n',
      'event: message_stop\ndata: {"type":"message_stop"}\n\n',
    ]), { status: 200, headers: { 'Content-Type': 'text/event-stream' } }),
  });

  assert.equal(response.status, 200);
  const events = (await response.text()).trim().split('\n\n').map(frame => JSON.parse(frame.slice(6)));
  assert.deepEqual(events.at(-1).usage, {
    inputTokens: 31,
    outputTokens: 11,
    cacheCreationInputTokens: 0,
    cacheReadInputTokens: 0,
    totalTokens: 42,
    source: 'anthropic',
  });
  assert.equal(events.at(-1).usageAccountingStatus, 'settled');
});

test('AG-UI omits usage metadata when a provider does not report complete token counts', async () => {
  const response = await onRequestPost({
    request: await request(input()),
    env: {
      ...envBase,
      AEGIS_MODEL_PROVIDER: 'anthropic',
      AEGIS_DB: new UsageLedgerMemoryD1(),
      AEGIS_ALLOW_PAID_SPEND: 'true',
      AEGIS_PAID_INFERENCE_APPROVED: 'true',
      AEGIS_PAID_INFERENCE_MAX_TOKENS_PER_RUN: '100000',
      ANTHROPIC_API_KEY: 'test-anthropic-api-key-long-enough',
      AEGIS_ANTHROPIC_MODEL: 'claude-sonnet-4-5',
    },
    fetchImpl: async () => new Response(modelSseStream([
      'event: message_start\ndata: {"type":"message_start","message":{"usage":{"input_tokens":31}}}\n\n',
      'event: message_stop\ndata: {"type":"message_stop"}\n\n',
    ]), { status: 200, headers: { 'Content-Type': 'text/event-stream' } }),
  });

  assert.equal(response.status, 200);
  const events = (await response.text()).trim().split('\n\n').map(frame => JSON.parse(frame.slice(6)));
  assert.equal(Object.hasOwn(events.at(-1), 'usage'), false);
  assert.equal(events.at(-1).usageAccountingStatus, 'reconciliation_required');
});


test('AG-UI requires a fresh exact-run approval before retrying incomplete paid usage', async () => {
  const db = new UsageLedgerMemoryD1();
  let providerCalls = 0;
  const env = {
    ...envBase,
    AEGIS_MODEL_PROVIDER: 'alibaba-qwen',
    AEGIS_ALLOW_PAID_SPEND: 'true',
      AEGIS_PAID_INFERENCE_APPROVED: 'true',
    AEGIS_PAID_INFERENCE_MAX_TOKENS_PER_RUN: '100000',
    AEGIS_DB: db,
    AEGIS_QWEN_API_KEY: 'test-qwen-api-key-long-enough',
    AEGIS_QWEN_WORKSPACE_ID: 'workspace-123',
    AEGIS_QWEN_REGION: 'ap-southeast-1',
    AEGIS_QWEN_MODEL: 'qwen3.8-flash',
  };
  const fetchImpl = async () => {
    providerCalls += 1;
    const frames = providerCalls === 1
      ? ['data: {"choices":[{"delta":{"content":"First attempt."}}]}\n\n', 'data: [DONE]\n\n']
      : [
          'data: {"choices":[{"delta":{"content":"Second attempt."}}]}\n\n',
          'data: {"choices":[],"usage":{"prompt_tokens":10,"completion_tokens":5,"total_tokens":15}}\n\n',
          'data: [DONE]\n\n',
        ];
    return new Response(modelSseStream(frames), {
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' },
    });
  };

  const first = await onRequestPost({ request: await request(input()), env, fetchImpl });
  const firstEvents = (await first.text()).trim().split('\n\n').map(frame => JSON.parse(frame.slice(6)));
  assert.equal(firstEvents.at(-1).usageAccountingStatus, 'reconciliation_required');
  assert.equal(db.reservations.size, 1);
  assert.equal([...db.reservations.values()][0].status, 'reserved');

  const second = await onRequestPost({ request: await request(input({ runId: 'run-124' })), env, fetchImpl });
  const secondEvents = (await second.text()).trim().split('\n\n').map(frame => JSON.parse(frame.slice(6)));
  assert.equal(secondEvents.at(-1).usageAccountingStatus, 'settled');
  assert.equal(providerCalls, 2);
  assert.equal(db.reservations.size, 2);
  assert.equal([...db.reservations.values()].filter(row => row.status === 'reserved').length, 1);
  assert.equal([...db.reservations.values()].filter(row => row.status === 'settled').length, 1);
});

test('AG-UI blocks a paid Qwen request before network access without explicit owner approval', async () => {
  let providerCalls = 0;
  const response = await onRequestPost({
    request: await request(input()),
    env: {
      ...envBase,
      AEGIS_MODEL_PROVIDER: 'alibaba-qwen',
      AEGIS_QWEN_API_KEY: 'test-qwen-api-key-long-enough',
      AEGIS_QWEN_WORKSPACE_ID: 'workspace-123',
      AEGIS_QWEN_REGION: 'ap-southeast-1',
      AEGIS_QWEN_MODEL: 'qwen3.8-flash',
    },
    fetchImpl: async () => {
      providerCalls += 1;
      return new Response(modelSseStream(['data: [DONE]\n\n']), {
        status: 200, headers: { 'Content-Type': 'text/event-stream' },
      });
    },
  });

  assert.equal(response.status, 403);
  assert.equal(providerCalls, 0);
  assert.match(await response.text(), /explicitly approved/i);
});

test('AG-UI blocks approved paid inference before provider access when verified quota storage is absent', async () => {
  let providerCalls = 0;
  const response = await onRequestPost({
    request: await request(input()),
    env: {
      ...envBase,
      AEGIS_MODEL_PROVIDER: 'alibaba-qwen',
      AEGIS_QWEN_API_KEY: 'test-qwen-api-key-long-enough',
      AEGIS_QWEN_WORKSPACE_ID: 'workspace-123',
      AEGIS_QWEN_REGION: 'ap-southeast-1',
      AEGIS_QWEN_MODEL: 'qwen3.8-flash',
      AEGIS_ALLOW_PAID_SPEND: 'true',
      AEGIS_PAID_INFERENCE_APPROVED: 'true',
      AEGIS_PAID_INFERENCE_MAX_TOKENS_PER_RUN: '100000',
    },
    fetchImpl: async () => {
      providerCalls += 1;
      return new Response(modelSseStream(['data: [DONE]\n\n']), { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
    },
  });
  assert.equal(response.status, 503);
  assert.equal(providerCalls, 0);
  assert.match(await response.text(), /verified token quota storage/i);
});
