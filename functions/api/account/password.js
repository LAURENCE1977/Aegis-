import { resolveSessionPrincipal,isSameOriginRequest } from "../../lib/auth.mjs";
import { createPasswordCredential,verifyPasswordCredential,isStrongPassword } from "../../lib/identity.mjs";
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{"content-type":"application/json","cache-control":"no-store"}});
export async function onRequestPost({request,env}){
 const p=await resolveSessionPrincipal(request,env);if(!p)return json({error:"UNAUTHORIZED"},401);
 if(!isSameOriginRequest(request))return json({error:"Invalid request origin."},403);
 let b;try{b=await request.json();}catch{return json({error:"Invalid request."},400);}
 if(typeof b.currentPassword!=="string"||typeof b.newPassword!=="string"||!isStrongPassword(b.newPassword)||b.currentPassword===b.newPassword)return json({error:"Invalid password change."},400);
 try{
  const row=await env.AEGIS_DB.prepare("SELECT password_salt,password_hash,password_iterations,password_algorithm,password_pepper_version FROM aegis_principal_credentials WHERE principal_id=?").bind(p.principalId).first();
  if(!row||!(await verifyPasswordCredential(b.currentPassword,row,env)))return json({error:"Current password is incorrect."},401);
  const c=await createPasswordCredential(b.newPassword,env),now=new Date().toISOString();
  await env.AEGIS_DB.batch([
   env.AEGIS_DB.prepare("UPDATE aegis_principal_credentials SET password_algorithm=?,password_pepper_version=?,password_salt=?,password_hash=?,password_iterations=?,updated_at=? WHERE principal_id=?").bind(c.passwordAlgorithm,c.passwordPepperVersion,c.passwordSalt,c.passwordHash,c.passwordIterations,now,p.principalId),
   env.AEGIS_DB.prepare("UPDATE auth_sessions SET revoked_at=? WHERE principal_id=? AND revoked_at IS NULL AND session_id<>?").bind(now,p.principalId,p.sid)
  ]);
  return json({changed:true,otherSessionsRevoked:true});
 }catch{return json({error:"Unable to change password."},503);}
}