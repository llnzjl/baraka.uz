import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { unlink, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { SQLitePool, sqlitePath } from '../db/sqlite.mjs';
import { seoulDate } from '../src/lib/booking/validation';

test('SQLite persists credentials, blobs and sequences across restarts; rolls back abandoned transactions', async()=>{
 const file=path.resolve('.test-db',`persistence-${randomUUID()}.sqlite`);
 let db=new SQLitePool(file);
 try {
   await db.query("INSERT INTO booking.owner_credentials(id,username,password_salt,password_hash) VALUES(1,$1,$2,$3)",['owner','a'.repeat(64),'b'.repeat(128)]);
   const c=await db.connect();
   await c.query('BEGIN');
   await c.query("UPDATE booking.owner_credentials SET username='rolled-back'");
   c.release();
   const bytes=Buffer.from([0,255,1,127]);
   await db.query("INSERT INTO booking.restaurant_menu(id,name,name_ko,category,image_data,image_type) VALUES('test','Test','Test','mains',$1,'image/png')",[bytes]);
   const first=(await db.query("INSERT INTO booking.entry_sessions(kind,token_hash,guest_number,expires_at) VALUES('guest',$1,nextval('booking.entry_sessions_guest_number_seq'),now()+interval '8 hours') RETURNING guest_number",[randomUUID()])).rows[0];
   await db.end();
   db=new SQLitePool(file);
   assert.equal((await db.query('SELECT username FROM booking.owner_credentials')).rows[0].username,'owner');
   assert.deepEqual((await db.query('SELECT image_data FROM booking.restaurant_menu')).rows[0].image_data,bytes);
   const next=(await db.query("INSERT INTO booking.entry_sessions(kind,token_hash,guest_number,expires_at) VALUES('guest',$1,nextval('booking.entry_sessions_guest_number_seq'),now()+interval '8 hours') RETURNING guest_number",[randomUUID()])).rows[0];
   assert.equal(Number(next.guest_number),Number(first.guest_number)+1);
   await assert.rejects(db.query("INSERT INTO booking.table_allocations(reservation_id,table_id,starts_at,ends_at) VALUES('missing','missing',$1,$2)",[new Date(),new Date(Date.now()+60000)]),(e:any)=>e.code==='23503');
 } finally { await db.end(); for(const suffix of ['','-wal','-shm']) await unlink(file+suffix).catch(()=>{}); }
});

test('SQLite files cannot be stored in the public web directory',()=>{
 const old=process.env.SQLITE_PATH;
 try { process.env.SQLITE_PATH='public/private.sqlite'; assert.throws(sqlitePath,/outside public/); }
 finally { if(old===undefined) delete process.env.SQLITE_PATH; else process.env.SQLITE_PATH=old; }
});

test('separate Node processes cannot double-book the same table',async()=>{
 const folder=path.resolve('.test-db',`processes-${randomUUID()}`);
 await mkdir(folder,{recursive:true});
 const file=path.join(folder,'restaurant.sqlite');
 const db=new SQLitePool(file);
 const date=seoulDate(new Date(Date.now()+3*86400000));
 try {
   await db.query('UPDATE booking.restaurant_config SET enabled=true,min_notice_minutes=0');
   await db.query("INSERT INTO booking.dining_tables(name,seats) VALUES('Concurrency test',4)");
   await db.query('INSERT INTO booking.opening_hours(weekday,opens,closes) VALUES($1,600,1440)',[new Date(`${date}T12:00:00Z`).getUTCDay()]);
   const outcomes=await Promise.all(Array.from({length:4},()=>new Promise<string>((resolve,reject)=>{
     const child=spawn(process.execPath,['--import','tsx','tests/helpers/sqlite-worker.ts',date],{
       windowsHide:true,env:{...process.env,DATABASE_DRIVER:'sqlite',SQLITE_PATH:file,NODE_ENV:'test',BARAKA_EDGE:'false',RESEND_API_KEY:'',
         RESERVATION_RECORDS_PATH:path.join(folder,'reservations.txt'),ORDERS_RECORDS_PATH:path.join(folder,'orders.txt'),RECEIPTS_RECORDS_PATH:path.join(folder,'receipts.txt'),HISTORY_RECORDS_PATH:path.join(folder,'history.txt')},
     });
     let output='',errors='';
     child.stdout.on('data',data=>{output+=data;}); child.stderr.on('data',data=>{errors+=data;});
     child.on('error',reject); child.on('exit',code=>code===0?resolve(output.trim()):reject(new Error(errors)));
   })));
   assert.equal(outcomes.filter(s=>s==='COMMITTED').length,1);
   assert.equal(outcomes.filter(s=>s==='FULL').length,3);
   assert.equal((await db.query('SELECT count(*) AS n FROM booking.reservations')).rows[0].n,1);
 } finally { await db.end(); }
});
