import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createHash } from 'node:crypto';

// Keep the existing Drizzle/D1 query interface while using a real, persistent SQLite database.
export class SqliteDatabase {
  readonly sqlite: DatabaseSync;
  constructor(file: string) {
    mkdirSync(dirname(file), {recursive:true, mode:0o700});
    this.sqlite = new DatabaseSync(file);
    this.sqlite.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=10000; PRAGMA foreign_keys=ON;');
  }
  migrate(directory = resolve(process.cwd(), 'drizzle/migrations')) {
    this.sqlite.exec('CREATE TABLE IF NOT EXISTS d1_migrations (name TEXT PRIMARY KEY, checksum TEXT NOT NULL)');
    for (const name of readdirSync(directory).filter(n=>n.endsWith('.sql')).sort()) {
      const sql = readFileSync(resolve(directory,name),'utf8');
      const checksum = createHash('sha256').update(sql).digest('hex');
      const old = this.sqlite.prepare('SELECT checksum FROM d1_migrations WHERE name=?').get(name);
      if (old) { if(old.checksum !== checksum) throw new Error(`Migration changed: ${name}`); continue; }
      this.sqlite.exec('BEGIN IMMEDIATE');
      try { this.sqlite.exec(sql); this.sqlite.prepare('INSERT INTO d1_migrations VALUES (?,?)').run(name,checksum); this.sqlite.exec('COMMIT'); }
      catch(error) { this.sqlite.exec('ROLLBACK'); throw error; }
    }
    this.sqlite.exec(`CREATE TABLE IF NOT EXISTS _cf_server_state (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS _cf_server_jobs (id TEXT PRIMARY KEY, kind TEXT NOT NULL, payload TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'queued', attempts INTEGER NOT NULL DEFAULT 0, available_at INTEGER NOT NULL DEFAULT 0, error TEXT);`);
  }
  prepare(query:string) { return new SqliteStatement(this,query); }
  async batch(statements:SqliteStatement[]) {
    this.sqlite.exec('BEGIN IMMEDIATE');
    try { const results = statements.map(s=>s.execute()); this.sqlite.exec('COMMIT'); return results; }
    catch(error) { this.sqlite.exec('ROLLBACK'); throw error; }
  }
  async exec(sql:string) { this.sqlite.exec(sql); return {count:1,duration:0}; }
  withSession() { return this; }
}
class SqliteStatement {
  constructor(private db:SqliteDatabase, private query:string, private values:unknown[] = []) {}
  bind(...values:unknown[]) { return new SqliteStatement(this.db,this.query,values); }
  private args() { return this.values.map(v=>v instanceof ArrayBuffer ? new Uint8Array(v) : typeof v === 'boolean' ? Number(v) : v) as (null|string|number|bigint|Uint8Array)[]; }
  execute() {
    const statement = this.db.sqlite.prepare(this.query);
    if(statement.columns().length) {
      return {success:true, results:statement.all(...this.args()),meta:{changes:0,duration:0}};
    }
    const result=statement.run(...this.args());
    return {success:true,results:[],meta:{changes:Number(result.changes),last_row_id:Number(result.lastInsertRowid),duration:0}};
  }
  async all<T>() { return this.execute() as {success:boolean;results:T[];meta:Record<string,number>}; }
  async run() { return this.execute(); }
  async raw(options?:{columnNames?:boolean}) {
    const statement=this.db.sqlite.prepare(this.query); statement.setReturnArrays(true);
    const rows=statement.all(...this.args());
    return options?.columnNames ? [statement.columns().map(c=>c.name),...rows] : rows;
  }
  async first(column?:string) { const row=this.db.sqlite.prepare(this.query).get(...this.args()); return row ? (column ? row[column] : row) : null; }
}
