import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { env } from '../config/env.js';
// Deliberately no HTTP endpoint: only the developer with local filesystem access can read OTPs.
let queue = Promise.resolve();
export function writeLocalMessage({channel,to,subject='',message=''}) {
 if(env.NODE_ENV==='production') throw new Error('Local delivery is prohibited in production');
 const action=queue.then(async()=>{
   let rows=[];
   try { rows=(await readFile(env.LOCAL_OUTBOX_PATH,'utf8')).split('\n').filter(Boolean).map(x=>JSON.parse(x)); } catch(e) { if(e.code!=='ENOENT') throw e; }
   const now=Date.now(); rows=rows.filter(r=>Date.parse(r.expiresAt)>now).slice(-99);
   rows.push({id:randomUUID(),channel,to,subject,message,createdAt:new Date(now).toISOString(),expiresAt:new Date(now+600000).toISOString()});
   await mkdir(dirname(env.LOCAL_OUTBOX_PATH),{recursive:true,mode:0o700});
   await writeFile(env.LOCAL_OUTBOX_PATH,rows.map(r=>JSON.stringify(r)).join('\n')+'\n',{mode:0o600});
   return {delivered:true,simulated:true,provider:'local'};
 });
 queue=action.catch(()=>{}); return action;
}
