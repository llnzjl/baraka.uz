// Production HTTP smoke test against a fresh isolated fixture, never user data.
import { spawn } from 'node:child_process';
import { randomUUID, randomBytes, scryptSync } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const directory=path.resolve('.test-db',`http-${randomUUID()}`);
mkdirSync(directory,{recursive:true});
const username='sqlite-http-test',password=randomUUID(),salt=randomBytes(32).toString('hex');
const origin='http://localhost:3100';
const child=spawn(process.execPath,['node_modules/next/dist/bin/next','start','-p','3100'],{
 windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,
 NODE_ENV:'production',NEXT_DIST_DIR:'.next-sqlite-build',DATABASE_DRIVER:'sqlite',SQLITE_PATH:path.join(directory,'restaurant.sqlite'),
 APP_ORIGIN:origin,TRUSTED_IP_HEADER:'x-test-ip',RATE_LIMIT_SECRET:randomUUID(),CRON_SECRET:randomUUID(),BARAKA_EDGE:'false',
 OWNER_USERNAME:username,OWNER_PASSWORD_HASH:`${salt}:${scryptSync(password,salt,64).toString('hex')}`,
 RESEND_API_KEY:'',RESEND_FROM:'',NEXT_PUBLIC_API_BASE_URL:'',
 RESERVATION_RECORDS_PATH:path.join(directory,'reservations.txt'),ORDERS_RECORDS_PATH:path.join(directory,'orders.txt'),
 RECEIPTS_RECORDS_PATH:path.join(directory,'receipts.txt'),HISTORY_RECORDS_PATH:path.join(directory,'history.txt'),
 }});
let log=''; child.stdout.on('data',d=>{log+=d;}); child.stderr.on('data',d=>{log+=d;});
const exited=new Promise(resolve=>child.on('exit',resolve));
const request=(route,options={})=>fetch(origin+route,{...options,headers:{origin,'content-type':'application/json','x-test-ip':'127.0.0.1',...options.headers},signal:AbortSignal.timeout(10000)});
try {
 let ready=false;
 for(let n=0;n<40;n++) {
   if(child.exitCode!==null) throw new Error('Test server exited: '+log);
   if(log.includes('Ready in')) {ready=true;break;}
   await new Promise(resolve=>setTimeout(resolve,250));
 }
 assert.ok(ready,'Test server became ready');
 const login=await request('/api/session',{method:'POST',body:JSON.stringify({kind:'owner',username,password})});
 assert.equal(login.status,200,`Owner login failed: ${await login.clone().text()}\n${log}`);
 assert.equal((await login.json()).kind,'owner');
 const cookie=login.headers.get('set-cookie').split(';')[0];
 assert.equal((await (await request('/api/session',{headers:{cookie}})).json()).session.kind,'owner');
 for(const route of ['/api/admin/config','/api/admin/profile','/api/admin/orders','/api/admin/history','/api/menu'])
   assert.equal((await request(route,{headers:{cookie}})).status,200,route);
 assert.equal((await request('/api/admin/config')).status,401);
 const guest=await request('/api/session',{method:'POST',body:JSON.stringify({kind:'guest'})});
 assert.equal(guest.status,200);
 const guestCookie=guest.headers.get('set-cookie').split(';')[0];
 assert.equal((await request('/api/orders/catalog',{headers:{cookie:guestCookie}})).status,200);
 assert.equal((await request('/api/admin/config',{headers:{cookie:guestCookie}})).status,401);
 assert.equal((await request('/api/session',{method:'DELETE',headers:{cookie}})).status,200);
 assert.equal((await (await request('/api/session',{headers:{cookie}})).json()).session,null);
 console.log('Production HTTP checks passed: SQLite owner login, session restoration, admin access, menu, guest access, authorization and logout.');
} finally {child.kill();await exited;}
