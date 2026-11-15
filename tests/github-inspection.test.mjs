import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectGitHubRepository, readGitHubBlob } from '../functions/lib/github-discovery.mjs';

function response(body,status=200){
  return {ok:status>=200&&status<300,status,async json(){return body;}};
}

test('Forge inspection pins a public repository tree and returns useful source files only',async()=>{
  const calls=[];
  const fetchImpl=async(url,options)=>{
    calls.push({url,options});
    if(url.endsWith('/repos/example/agent')) return response({
      full_name:'example/agent',html_url:'https://github.com/example/agent',
      default_branch:'main',private:false,description:'Agent framework',
      pushed_at:'2026-11-15T00:00:00Z',stargazers_count:12,language:'TypeScript',
      license:{spdx_id:'MIT',name:'MIT License'},
    });
    return response({
      sha:'1'.repeat(40),
      truncated:false,
      tree:[
        {path:'README.md',type:'blob',sha:'a'.repeat(40),size:100},
        {path:'src/agent.ts',type:'blob',sha:'b'.repeat(40),size:200},
        {path:'package.json',type:'blob',sha:'c'.repeat(40),size:80},
        {path:'node_modules/pkg/index.js',type:'blob',sha:'d'.repeat(40),size:80},
        {path:'assets/logo.png',type:'blob',sha:'e'.repeat(40),size:80},
        {path:'src/huge.ts',type:'blob',sha:'f'.repeat(40),size:100000},
      ],
    });
  };
  const result=await inspectGitHubRepository('https://github.com/example/agent',fetchImpl);
  assert.equal(result.fullName,'example/agent');
  assert.equal(result.treeSha,'1'.repeat(40));
  assert.deepEqual(result.files.map(file=>file.path),['README.md','package.json','src/agent.ts']);
  assert.equal(result.files[0].sha,'a'.repeat(40));
  assert.equal(calls.length,2);
  assert.ok(calls.every(call=>call.options.redirect==='error'));
});

test('Forge inspection reports a truncated repository tree without claiming completeness',async()=>{
  const fetchImpl=async(url)=>{
    if(url.includes('/repos/example/agent')) return response({
      full_name:'example/agent',html_url:'https://github.com/example/agent',
      default_branch:'main',private:false,
    });
    return response({sha:'1'.repeat(40),truncated:true,tree:[]});
  };
  const result=await inspectGitHubRepository('https://github.com/example/agent',fetchImpl);
  assert.equal(result.truncated,true);
  assert.deepEqual(result.files,[]);
});

test('Forge blob reader only accepts pinned Git object IDs and bounded UTF-8 text',async()=>{
  const fetchImpl=async(url,options)=>{
    assert.equal(options.redirect,'error');
    return response({sha:'a'.repeat(40),size:11,encoding:'base64',content:btoa('hello AEGIS')});
  };
  const result=await readGitHubBlob('https://github.com/example/agent','a'.repeat(40),fetchImpl);
  assert.equal(result.content,'hello AEGIS');
  assert.equal(result.sha,'a'.repeat(40));
  await assert.rejects(()=>readGitHubBlob('https://github.com/example/agent','../../etc/passwd',fetchImpl),/blob/i);
});

test('Forge blob reader rejects oversized and non-text blobs',async()=>{
  await assert.rejects(()=>readGitHubBlob('https://github.com/example/agent','a'.repeat(40),async()=>response({
    sha:'a'.repeat(40),size:40000,encoding:'base64',content:btoa('x'),
  })),/size/i);
  await assert.rejects(()=>readGitHubBlob('https://github.com/example/agent','a'.repeat(40),async()=>response({
    sha:'a'.repeat(40),size:1,encoding:'base64',content:btoa(String.fromCharCode(255)),
  })),/UTF-8/i);
});
