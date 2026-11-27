import { createPasswordCredential,isStrongPassword } from "../../lib/identity.mjs";
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{"content-type":"application/json","cache-control":"no-store"}});
const enc=new TextEncoder();async function digest(s){return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",enc.encode(s))),x=>x.toString(16).padStart(2,"0")).join("");}
export async function onRequestPost({request,env}){
 let b;try{b=await request.json();}catch{return json({error:"Invalid request."},400);}
 if(typeof b.token!=="string"||!/^[a-f0-9]{64}$/.test(b.token)||typeof b.newPassword!=="string"||!isStrongPassword(b.newPassword))return json({error:"Invalid recovery request."},400);
 try{
  const row=await env.AEGIS_DB.prepare("SELECT recovery_id,principal_id,tenant_id,expires_at,accepted_at FROM aegis_account_recovery_tokens WHERE token_hash=?").bind(await digest(b.token)).first();
  if(!row)return json({error:"Recovery token not found."},404);
  if(row.accepted_at)return json({error:"Recovery token already used."},409);
  const now=new Date().toISOString(),epoch=Math.floor(Date.now()/1000);
  if(Number(row.expires_at)<=epoch)return json({error:"Recovery token expired."},410);
  const c=await createPasswordCredential(b.newPassword,env);
  const result=await env.AEGIS_DB.batch([
   env.AEGIS_DB.prepare("UPDATE aegis_account_recovery_tokens SET accepted_at=? WHERE recovery_id=? AND accepted_at IS NULL AND expires_at>?").bind(now,row.recovery_id,epoch),
   env.AEGIS_DB.prepare("UPDATE aegis_principals SET status='active' WHERE id=? AND EXISTS(SELECT 1 FROM aegis_account_recovery_tokens WHERE recovery_id=? AND accepted_at=?)").bind(row.principal_id,row.recovery_id,now),
   env.AEGIS_DB.prepare("UPDATE aegis_tenant_memberships SET status='active',updated_at=? WHERE principal_id=? AND tenant_id=? AND EXISTS(SELECT 1 FROM aegis_account_recovery_tokens WHERE recovery_id=? AND accepted_at=?)").bind(now,row.principal_id,row.tenant_id,row.recovery_id,now),
   env.AEGIS_DB.prepare("UPDATE aegis_principal_credentials SET password_algorithm=?,password_pepper_version=?,password_salt=?,password_hash=?,password_iterations=?,updated_at=? WHERE principal_id=? AND EXISTS(SELECT 1 FROM aegis_account_recovery_tokens WHERE recovery_id=? AND accepted_at=?)").bind(c.passwordAlgorithm,c.passwordPepperVersion,c.passwordSalt,c.passwordHash,c.passwordIterations,now,row.principal_id,row.recovery_id,now),
   env.AEGIS_DB.prepare("UPDATE auth_sessions SET revoked_at=? WHERE principal_id=? AND revoked_at IS NULL").bind(now,row.principal_id)
  ]);
  if(!result?.[0]?.meta?.changes)return json({error:"Recovery token already used or expired."},409);
  return json({recovered:true,principalId:row.principal_id,tenantId:row.tenant_id});
 }catch{return json({error:"Unable to complete account recovery."},503);}
}