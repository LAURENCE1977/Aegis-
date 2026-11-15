import test from 'node:test';
import assert from 'node:assert/strict';
import { createSessionToken } from '../functions/lib/auth.mjs';
import { onRequestPost as inspect } from '../functions/api/forge/inspect.js';
import { onRequestPost as read } from '../functions/api/forge/read.js';

const secret='forge-inspection-test-session-secret-long-enough';
const env={AEGIS_PASSWORD:'test-password-long-enough',AEGIS_SESSION_SECRET:secret};

async function request(path,body,{authenticated=true,origin='https://aegis.example'}={}){
  const headers={'Content-Type':'application/json',Origin:origin};
  if(authenticated) headers.Cookie='__Host-aegis_session='+await createSessionToken(secret);
  return new Request('https://aegis.example'+path,{method:'POST',headers,body:JSON.stringify(body)});
}

function response(body,status=200){
  return {ok:status>=200&&status<300,status,async json(){return body;}};
}

test('Forge inspection requires owner authentication and same-origin requests',async()=>{
  const unauth=await inspect({request:await request('/api/forge/inspect',{sourceUrl:'https://github.com/example/agent'},{authenticated:false}),env});
  assert.equal(unauth.status,401);
  const cross=await inspect({request:await request('/api/forge/inspect',{sourceUrl:'https://github.com/example/agent'},{origin:'https://attacker.example'}),env});
  assert.equal(cross.status,403);
});

test('Forge inspection endpoint returns pinned source tree metadata without executing code',async()=>{
  let calls=0;
  const result=await inspect({
    request:await request('/api/forge/inspect',{sourceUrl:'https://github.com/example/agent'}),
    env,
    fetchImpl:async(url)=>{
      calls++;
      if(url.endsWith('/repos/example/agent')) return response({
        full_name:'example/agent',html_url:'https://github.com/example/agent',
        default_branch:'main',private:false,
      });
      return response({sha:'tree-sha',truncated:false,tree:[
        {path:'README.md',type:'blob',sha:'a'.repeat(40),size:100},
      ]});
    },
  });
  assert.equal(result.status,200);
  assert.match(result.headers.get('cache-control'),/no-store/);
  const data=await result.json();
  assert.equal(data.repository.fullName,'example/agent');
  assert.equal(data.repository.files[0].sha,'a'.repeat(40));
  assert.equal(calls,2);
});

test('Forge blob reader returns only a bounded pinned UTF-8 blob',async()=>{
  const blob='source code';
  const result=await read({
    request:await request('/api/forge/read',{sourceUrl:'https://github.com/example/agent',blobSha:'b'.repeat(40)}),
    env,
    fetchImpl:async()=>response({
      sha:'b'.repeat(40),size:blob.length,encoding:'base64',content:btoa(blob),
    }),
  });
  assert.equal(result.status,200);
  const data=await result.json();
  assert.equal(data.sha,'b'.repeat(40));
  assert.equal(data.content,blob);
  assert.match(result.headers.get('cache-control'),/no-store/);
});

test('Forge blob reader rejects unknown fields and malformed object identifiers',async()=>{
  const unknown=await read({
    request:await request('/api/forge/read',{sourceUrl:'https://github.com/example/agent',blobSha:'a'.repeat(40),execute:true}),
    env,fetchImpl:async()=>{throw new Error('must not fetch');},
  });
  assert.equal(unknown.status,400);
  const invalid=await read({
    request:await request('/api/forge/read',{sourceUrl:'https://github.com/example/agent',blobSha:'../../etc/passwd'}),
    env,fetchImpl:async()=>{throw new Error('must not fetch');},
  });
  assert.equal(invalid.status,400);
});
