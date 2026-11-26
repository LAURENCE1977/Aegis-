import { resolveSessionPrincipal,isSameOriginRequest,ROOT_PRINCIPAL_ID,ROOT_TENANT_ID } from "../../lib/auth.mjs";
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{"content-type":"application/json","cache-control":"no-store"}});
const enc=new TextEncoder();async function digest(s){return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",enc.encode(s))),x=>x.toString(16).padStart(2,"0")).join("");}
function makeToken(){return Array.from(crypto.getRandomValues(new Uint8Array(32)),x=>x.toString(16).padStart(2,"0")).join("");}
export async function onRequestPost({request,env}){
 const p=await resolveSessionPrincipal(request,env);if(!p)return json({error:"UNAUTHORIZED"},401);
 if(!p.roles.some(x=>x==="owner"||x==="admin"))return json({error:"FORBIDDEN"},403);
 if(!isSameOriginRequest(request))return json({error:"Invalid request origin."},403);
 let b;try{b=await request.json();}catch{return json({error:"Invalid request."},400);}
 if(typeof b.principalId!=="string"||(b.principalId===ROOT_PRINCIPAL_ID&&p.tenantId!==ROOT_TENANT_ID))return json({error:"Invalid recovery target."},400);
 try{
  const target=await env.AEGIS_DB.prepare("SELECT p.status,m.status AS membership_status FROM aegis_principals p JOIN aegis_tenant_memberships m ON m.principal_id=p.id WHERE p.id=? AND m.tenant_id=?").bind(b.principalId,p.tenantId).first();
  if(!target)return json({error:"Principal not found in this tenant."},404);
  if(target.status!=="suspended"&&target.membership_status!=="suspended")return json({error:"Principal is not suspended."},409);
  const raw=makeToken(),now=new Date().toISOString(),expires=Math.floor(Date.now()/1000)+3600;
  await env.AEGIS_DB.prepare("INSERT INTO aegis_account_recovery_tokens(recovery_id,token_hash,principal_id,tenant_id,issued_by_principal_id,created_at,expires_at) VALUES(?,?,?,?,?,?,?)")
   .bind("rec-"+crypto.randomUUID(),await digest(raw),b.principalId,p.tenantId,p.principalId,now,expires).run();
  return json({recoveryToken:raw,principalId:b.principalId,tenantId:p.tenantId,expiresAt:expires},201);
 }catch{return json({error:"Unable to issue recovery token."},503);}
}