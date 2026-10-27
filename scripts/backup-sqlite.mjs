import { backup } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { SQLitePool } from '../db/sqlite.mjs';
const db=new SQLitePool();
try {
 const directory=path.join(path.dirname(db.filename),'backups');
 mkdirSync(directory,{recursive:true,mode:0o700});
 const target=path.join(directory,`restaurant-${new Date().toISOString().replaceAll(':','-')}-${randomUUID()}.sqlite`);
 await backup(db.raw,target);
 console.log(`Consistent SQLite backup saved: ${target}`);
} finally { await db.end(); }
