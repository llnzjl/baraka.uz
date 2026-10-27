import { createRequire } from 'node:module';
import { randomUUID, createHash } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { schema, triggers } from './sqlite-schema.mjs';

const dateFields = /(?:_at|_until|last_seen)$/;
const booleans = new Set(['enabled','auto_confirm','active','adult_attested','dirty','has_image','capped']);
const bigIntegers = new Set(['guest_number','guest_id','daily_number','number','queue_number','receipt_number','credential_version']);
const jsonFields = new Set(['items','tables','receipt']);
const iso = value => new Date(value).toISOString();
const seoulDate = () => new Date(Date.now()+9*3600000).toISOString().slice(0,10);
const midnight = () => iso(new Date(`${seoulDate()}T00:00:00+09:00`).getTime()+86400000);

export function sqlitePath() {
 const file = path.resolve(process.env.SQLITE_PATH || '.baraka-data/restaurant.sqlite');
 const relative = path.relative(path.resolve('public'), file);
 if (!relative || (!relative.startsWith('..'+path.sep) && relative !== '..' && !path.isAbsolute(relative)))
   throw new Error('SQLITE_PATH must be outside public/.');
 return file;
}

// These are the PostgreSQL expressions used by the shared application queries,
// not a general SQL translator. All user values remain bound parameters.
export function sqliteSQL(input) {
 let sql = input.replace(/\bbooking\./g,'');
 sql = sql.replace(/\s+FOR\s+(?:UPDATE|SHARE)(?:\s+SKIP LOCKED)?/gi,'');
 sql = sql.replace(/\(\(\((?:now|statement_timestamp)\(\) AT TIME ZONE 'Asia\/Seoul'\)::date\+1\)::timestamp AT TIME ZONE 'Asia\/Seoul'\)/g,'seoul_midnight()');
 sql = sql.replace(/\((?:now|statement_timestamp)\(\) AT TIME ZONE 'Asia\/Seoul'\)::date\s*-\s*1/g,"date(seoul_date(),'-1 day')");
 sql = sql.replace(/\((?:now|statement_timestamp)\(\) AT TIME ZONE 'Asia\/Seoul'\)::date/g,'seoul_date()');
 sql = sql.replace(/EXTRACT\((DOW|HOUR|MINUTE) FROM statement_timestamp\(\) AT TIME ZONE 'Asia\/Seoul'\)/g,(_,part)=>`seoul_part('${part}')`);
 sql = sql.replace(/to_char\(([\w.]+)( AT TIME ZONE 'Asia\/Seoul')?,\s*'([^']+)'\)/g,(_,col,zone,format)=>`app_format(${col},'${format}',${zone?1:0})`);
 sql = sql.replace(/((?:now|clock_timestamp|statement_timestamp)\(\)|[\w.]+)\s*([+-])\s*(?:(\$\d+)\s*\*\s*)?interval\s*'(\d+) (second|minute|hour|day)s?'/gi,
   (_,base,sign,param,amount,unit)=>`app_interval(${base},${sign==='-'?'-':''}${param?`${param}*`:''}${amount},'${unit}')`);
 sql = sql.replace(/=ANY\((\$\d+)::(?:text|uuid)\[\]\)/g,' IN (SELECT value FROM json_each($1))');
 sql = sql.replace(/::(?:text|int|integer|bigint|uuid|jsonb|timestamptz)\b/g,'');
 sql = sql.replace(/\b(?:now|clock_timestamp|statement_timestamp)\(\)/g,'app_now()');
 sql = sql.replace(/\bjson_agg\(/g,'json_group_array(').replace(/\bjsonb_build_object\(/g,'json_object(');
 sql = sql.replace(/'items',receipt\.items/g,"'items',json(receipt.items)");
 return sql;
}

function parameter(value) {
 if (value === null || value === undefined) return null;
 if (value instanceof Date) return value.toISOString();
 if (typeof value === 'boolean') return Number(value);
 if (Array.isArray(value)) return JSON.stringify(value);
 return value;
}
function rowValue(row) {
 return Object.fromEntries(Object.entries(row).map(([key,value]) => {
   if (value === null) return [key,null];
   if (booleans.has(key)) return [key,Boolean(value)];
   if (bigIntegers.has(key)) return [key,String(value)];
   if (jsonFields.has(key) && typeof value === 'string') return [key,JSON.parse(value)];
   if (dateFields.test(key) && typeof value === 'string') return [key,new Date(value)];
   if (value instanceof Uint8Array) return [key,Buffer.from(value)];
   return [key,value];
 }));
}
function databaseError(error) {
 const message = String(error.message);
 const code = /allocation_overlap|hours_overlap/.test(message) ? '23P01'
   : /UNIQUE constraint/.test(message) ? '23505'
   : /FOREIGN KEY constraint/.test(message) ? '23503'
   : /CHECK constraint|NOT NULL constraint/.test(message) ? '23514'
   : /database is locked|database is busy/.test(message) ? '55P03' : error.code;
 return Object.assign(error,{code});
}

export class SQLitePool {
 constructor(filename = sqlitePath()) {
   if (Number(process.versions.node.split('.')[0]) < 24) throw new Error('SQLite storage requires Node 24 or newer.');
   // Hosted PostgreSQL/Deno deployments never load the Node SQLite runtime.
   const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite');
   this.filename = filename;
   this.tail = Promise.resolve();
   this.importing = false;
   if (filename !== ':memory:') mkdirSync(path.dirname(filename),{recursive:true,mode:0o700});
   this.raw = new DatabaseSync(filename,{timeout:100});
   this.raw.exec('PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;');
   this.raw.function('app_now',()=>new Date().toISOString());
   this.raw.function('gen_random_uuid',()=>randomUUID());
   this.raw.function('importing',()=>Number(this.importing));
   this.raw.function('regexp',(pattern,value)=>Number(new RegExp(pattern).test(String(value))));
   this.raw.function('seoul_date',seoulDate);
   this.raw.function('seoul_midnight',midnight);
   this.raw.function('seoul_part',part=>{
     const d = new Date(Date.now()+9*3600000);
     return part==='DOW'?d.getUTCDay():part==='HOUR'?d.getUTCHours():d.getUTCMinutes();
   });
   this.raw.function('app_interval',(value,n,unit)=>iso(new Date(value).getTime()+Number(n)*({second:1000,minute:60000,hour:3600000,day:86400000}[unit])));
   this.raw.function('app_format',(value,format,korea)=>{
     const d = new Date(new Date(value).getTime()+(korea?9*3600000:0)).toISOString();
     const parts={YYYY:d.slice(0,4),MM:d.slice(5,7),DD:d.slice(8,10),HH24:d.slice(11,13),MI:d.slice(14,16),SS:d.slice(17,19)};
     return format.replace(/YYYY|HH24|MM|DD|MI|SS/g,part=>parts[part]);
   });
   this.raw.function('nextval',name=>this.raw.prepare('UPDATE sequences SET value=value+1 WHERE name=? RETURNING value').get(name.replace(/^booking\./,''))?.value ?? null);
   this.raw.function('guest_display_number',number=>number === null ? null : this.raw.prepare('SELECT daily_number FROM guest_numbers WHERE guest_id=?').get(number)?.daily_number ?? number);
   try { this.initialize(); } catch(error) { this.raw.close(); throw error; }
 }
 initialize() {
   const version = this.raw.prepare('PRAGMA user_version').get().user_version;
   if (version > 1) throw new Error('This SQLite database requires a newer application.');
   if (version === 0) {
     this.raw.exec('BEGIN IMMEDIATE');
     try {
       // Another process may have initialized while we waited for the write lock.
       if (this.raw.prepare('PRAGMA user_version').get().user_version === 0) {
         this.raw.exec(schema+triggers);
         this.raw.exec('CREATE TABLE app_migrations(version INTEGER PRIMARY KEY, checksum TEXT NOT NULL)');
         this.raw.prepare('INSERT INTO app_migrations VALUES(1,?)').run(createHash('sha256').update(schema+triggers).digest('hex'));
         this.raw.exec('PRAGMA user_version=1');
       }
       this.raw.exec('COMMIT');
     } catch(error) { this.raw.exec('ROLLBACK'); throw error; }
   }
   const expected=createHash('sha256').update(schema+triggers).digest('hex');
   if(this.raw.prepare('SELECT checksum FROM app_migrations WHERE version=1').get()?.checksum!==expected)
     throw new Error('SQLite schema checksum changed. Add a versioned migration instead of modifying an applied schema.');
 }
 async connect() {
   let unlock;
   const previous = this.tail;
   this.tail = new Promise(resolve=>{unlock=resolve;});
   await previous;
   let released = false;
   return {
     query: (sql,values=[])=>this.execute(sql,values),
     release: ()=>{
       if (released) return;
       released=true;
       // Never let an abandoned transaction leak into the next request.
       try { if (this.raw.isTransaction) this.raw.exec('ROLLBACK'); } finally { unlock(); }
     },
   };
 }
 async execute(input,values=[]) {
   // BEGIN IMMEDIATE replaces PostgreSQL row/advisory locks with a database
   // write lock. Holding the JS queue for the entire transaction prevents
   // other async requests from accidentally joining it on this connection.
   if (/^SET LOCAL lock_timeout=/.test(input) || /^SELECT pg_advisory_xact_lock\(\d+\)$/.test(input)) return {rows:[],rowCount:0};
   if (/^ROLLBACK\s*$/i.test(input) && !this.raw.isTransaction) return {rows:[],rowCount:0};
   const sql = /^BEGIN\s*$/i.test(input)?'BEGIN IMMEDIATE':sqliteSQL(input);
   const bound = {};
   for (const match of sql.matchAll(/\$(\d+)/g)) bound[match[0]]=parameter(values[Number(match[1])-1]);
   const deadline=Date.now()+5000;
   for (;;) {
     try {
       const statement=this.raw.prepare(sql);
       if (statement.columns().length) {
         const rows=statement.all(bound).map(rowValue);
         return {rows,rowCount:rows.length};
       }
       return {rows:[],rowCount:Number(statement.run(bound).changes)};
     } catch(error) {
       if (/database is locked|database is busy/.test(error.message) && Date.now()<deadline && !this.raw.isTransaction) {
         await new Promise(resolve=>setTimeout(resolve,25));
         continue;
       }
       throw databaseError(error);
     }
   }
 }
 async query(sql,values=[]) {
   const client=await this.connect();
   try { return await client.query(sql,values); } finally { client.release(); }
 }
 async end() { await this.tail; this.raw.close(); }
}
