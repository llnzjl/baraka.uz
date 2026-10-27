// One-time, read-only source snapshot. Never overwrite an existing SQLite database.
import pg from 'pg';
import { existsSync, readFileSync, writeFileSync, renameSync, unlinkSync, linkSync } from 'node:fs';
import path from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { SQLitePool, sqlitePath } from '../db/sqlite.mjs';

const target = sqlitePath();
if (existsSync(target)) throw new Error('SQLite destination already exists. Choose a new SQLITE_PATH; existing data will not be overwritten.');
const url=process.env.MIGRATION_DATABASE_URL || process.env.DATABASE_URL;
if (!url) throw new Error('Set DATABASE_URL to the existing PostgreSQL database before importing.');
const temporary=target+'.import-'+randomUUID();
const source=new pg.Client({connectionString:url,connectionTimeoutMillis:5000});
let sqlite;
let committed=false;
try {
 await source.connect();
 await source.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
 sqlite=new SQLitePool(temporary);
 sqlite.importing=true;
 const tables=['restaurant_config','dining_tables','opening_hours','closed_dates','reservations','table_allocations','notifications','admin_users','rate_limits','owner_credentials','customer_accounts','guest_numbers','entry_sessions','dining_orders','order_receipts','audit_log','restaurant_menu','records_export'];
 const sourceTables=(await source.query("SELECT tablename FROM pg_tables WHERE schemaname='booking'")).rows.map(r=>r.tablename).sort();
 if (JSON.stringify(sourceTables)!==JSON.stringify([...tables].sort())) throw new Error('Source schema differs from the supported migrations. Apply the current PostgreSQL migrations before importing.');
 sqlite.raw.exec('BEGIN IMMEDIATE');
 const counts=[];
 for (const table of tables) {
   const metadata=sqlite.raw.prepare(`PRAGMA table_info("${table}")`).all();
   const columns=metadata.map(c=>c.name);
   const rows=(await source.query(`SELECT * FROM booking."${table}"`)).rows;
   const expected=[];
   const fingerprint=values=>createHash('sha256').update(JSON.stringify(values.map((value,index)=>{
     if(value===null) return null;
     if(value instanceof Uint8Array) return Buffer.from(value).toString('hex');
     if(metadata[index].type==='INTEGER') {
       const number=Number(value);
       if(!Number.isSafeInteger(number)) throw new Error(`Integer exceeds the supported range in ${table}.${columns[index]}`);
       return number;
     }
     return value;
   }))).digest('hex');
   sqlite.raw.exec(`DELETE FROM "${table}"`);
   for (const row of rows) {
     if (Object.keys(row).some(name=>!columns.includes(name)) || columns.some(name=>!(name in row))) throw new Error(`Column mismatch in ${table}; import stopped without activating SQLite.`);
     const values=columns.map(name=>{
       const value=row[name];
       if(value===null) return null;
       if(value instanceof Date) return (name==='date'||name==='guest_date') ? `${value.getFullYear()}-${String(value.getMonth()+1).padStart(2,'0')}-${String(value.getDate()).padStart(2,'0')}` : value.toISOString();
       if(typeof value==='boolean') return Number(value);
       if(Buffer.isBuffer(value)) return value;
       if(typeof value==='object') return JSON.stringify(value);
       return value;
     });
     sqlite.raw.prepare(`INSERT INTO "${table}"(${columns.map(c=>`"${c}"`).join(',')}) VALUES(${columns.map(()=>'?').join(',')})`).run(...values);
     expected.push(fingerprint(values));
   }
   const count=sqlite.raw.prepare(`SELECT count(*) AS n FROM "${table}"`).get().n;
   if(count!==rows.length) throw new Error(`Row count mismatch in ${table}`);
   const actual=sqlite.raw.prepare(`SELECT * FROM "${table}"`).all().map(row=>fingerprint(columns.map(name=>row[name]))).sort();
   if(JSON.stringify(actual)!==JSON.stringify(expected.sort())) throw new Error(`Content mismatch in ${table}; import stopped.`);
   counts.push({table,rows:count});
 }
 for(const name of ['entry_sessions_guest_number_seq','dining_orders_queue_number_seq','order_receipts_receipt_number_seq']) {
   const sequence=(await source.query(`SELECT last_value,is_called FROM booking."${name}"`)).rows[0];
   sqlite.raw.prepare('UPDATE sequences SET value=? WHERE name=?').run(sequence.is_called?sequence.last_value:0,name);
 }
 if(sqlite.raw.prepare('PRAGMA foreign_key_check').all().length) throw new Error('Imported foreign keys failed validation.');
 if(sqlite.raw.prepare('PRAGMA integrity_check').get().integrity_check!=='ok') throw new Error('SQLite integrity check failed.');
 sqlite.raw.exec('COMMIT');
 sqlite.raw.exec('PRAGMA wal_checkpoint(TRUNCATE)');
 await sqlite.end(); sqlite=undefined;
 await source.query('COMMIT');
 // Target is checked again after the snapshot to catch an app started mid-import.
 if(existsSync(target)) throw new Error('Destination appeared during import; refusing to overwrite it.');
 // Hard-link publication is atomic and fails if the destination already exists.
 linkSync(temporary,target); committed=true;
 unlinkSync(temporary);
 console.table(counts);
 console.log(`Verified SQLite copy: ${target}. PostgreSQL data was not modified.`);
 if(process.argv.includes('--activate')) {
   const envFile=path.resolve('.env.local');
   let contents=existsSync(envFile)?readFileSync(envFile,'utf8'):'';
   for(const [key,value] of [['DATABASE_DRIVER','sqlite'],['SQLITE_PATH',target.replaceAll('\\','/')]]) {
     const pattern=new RegExp(`^${key}=.*$`,'m');
     contents=pattern.test(contents)?contents.replace(pattern,()=>`${key}=${value}`):contents+`\n${key}=${value}\n`;
   }
   const envTemp=envFile+'.'+randomUUID()+'.tmp';
   writeFileSync(envTemp,contents,{mode:0o600,flag:'wx'});
   renameSync(envTemp,envFile);
   console.log('SQLite activated in .env.local. Restart Next.js to switch connections.');
 }
} finally {
 if(sqlite) { if(sqlite.raw.isTransaction) sqlite.raw.exec('ROLLBACK'); await sqlite.end(); }
 await source.end();
 if(!committed) for(const suffix of ['', '-wal','-shm']) { try { unlinkSync(temporary+suffix); } catch {} }
}
