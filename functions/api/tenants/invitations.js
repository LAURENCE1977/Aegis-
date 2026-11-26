import { resolveSessionPrincipal,isSameOriginRequest } from "../../lib/auth.mjs";
import { normalizeLoginIdentifier } from "../../lib/identity.mjs";
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{"content-type":"application/json","cache-control":"no-store"}});
const enc=new TextEncoder();async function digest(s){return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",enc.encode(s))),x=>x.toString(16).padStart(2,"0")).join("");}
function makeToken(){return Array.from(crypto.getRandomValues(new Uint8Array(32)),x=>x.toString(16).padStart(2,"0")).join("");}
export async function onRequestPost({request,env}){
 const p=await resolveSessionPrincipal(request,env);if(!p)return json({error:"UNAUTHORIZED"},401);
 if(!isSameOriginRequest(request))return json({error:"Invalid request origin."},403);
 let b;try{b=await request.json();}catch{return json({error:"Invalid request."},400);}
 if(typeof b.token==="string"){
  if(!/^[a-f0-9]{64}$/.test(b.token))return json({error:"Invalid token."},400);
  try{
   const hash=await digest(b.token),now=new Date().toISOString(),epoch=Math.floor(Date.now()/1000);
   const [inv,cred]=await Promise.all([
    env.AEGIS_DB.prepare("SELECT invitation_id,tenant_id,normalized_identity,role,expires_at,accepted_at FROM aegis_tenant_invitations WHERE token_hash=?").bind(hash).first(),
    env.AEGIS_DB.prepare("SELECT login_identifier FROM aegis_principal_credentials WHERE principal_id=?").bind(p.principalId).first()
   ]);
   if(!inv)return json({error:"Invitation not found."},404);
   if(inv.accepted_at)return json({error:"Invitation already used."},409);
   if(Number(inv.expires_at)<=epoch)return json({error:"Invitation expired."},410);
   if(!cred||cred.login_identifier!==inv.normalized_identity)return json({error:"Invitation identity mismatch."},403);
   const result=await env.AEGIS_DB.batch([
    env.AEGIS_DB.prepare("UPDATE aegis_tenant_invitations SET accepted_at=? WHERE invitation_id=? AND accepted_at IS NULL AND expires_at>?").bind(now,inv.invitation_id,epoch),
    env.AEGIS_DB.prepare("INSERT INTO aegis_tenant_memberships(principal_id,tenant_id,role,status,created_at,updated_at) SELECT ?,tenant_id,role,'active',?,? FROM aegis_tenant_invitations WHERE invitation_id=? AND accepted_at=?").bind(p.principalId,now,now,inv.invitation_id,now)
   ]);
   if(!result?.[0]?.meta?.changes)return json({error:"Invitation already used or expired."},409);
   return json({accepted:true,tenantId:inv.tenant_id,role:inv.role},201);
  }catch(e){if(/UNIQUE|constraint/i.test(String(e?.message)))return json({error:"Membership exists or invitation was consumed."},409);return json({error:"Unable to accept invitation."},503);}
 }
 if(!p.roles.some(x=>x==="owner"||x==="admin"))return json({error:"FORBIDDEN"},403);
 const identity=normalizeLoginIdentifier(b.identity),role=b.role||"member";
 if(!identity||!["admin","member"].includes(role))return json({error:"Invalid invitation."},400);
 if(p.roles.includes("admin")&&role!=="member")return json({error:"Admins may invite members only."},403);
 try{
  const tenant=await env.AEGIS_DB.prepare("SELECT status FROM aegis_tenants WHERE id=?").bind(p.tenantId).first();
  if(!tenant||tenant.status!=="active")return json({error:"Tenant is not active."},409);
  const raw=makeToken(),now=new Date().toISOString(),expires=Math.floor(Date.now()/1000)+604800;
  await env.AEGIS_DB.prepare("INSERT INTO aegis_tenant_invitations(invitation_id,token_hash,tenant_id,normalized_identity,role,created_by_principal_id,created_at,expires_at) VALUES(?,?,?,?,?,?,?,?)")
   .bind("inv-"+crypto.randomUUID(),await digest(raw),p.tenantId,identity,role,p.principalId,now,expires).run();
  return json({invitationToken:raw,tenantId:p.tenantId,identity,role,expiresAt:expires},201);
 }catch(e){if(/UNIQUE|constraint/i.test(String(e?.message)))return json({error:"A pending invitation already exists."},409);return json({error:"Unable to create invitation."},503);}
}