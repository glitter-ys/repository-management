import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import fs from 'fs';
import path from 'path';

// Node's Single Executable Application API (present only when running as a
// packaged .exe). Absent in dev/compiled mode, so guard the require.
type SeaApi = { isSea(): boolean; getAsset(key: string, encoding?: string): ArrayBuffer };
let sea: SeaApi | undefined;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  sea = require('node:sea') as SeaApi;
} catch {
  sea = undefined;
}
const isSea = Boolean(sea?.isSea?.());

const isPackaged = isSea || Boolean((process as unknown as { pkg?: unknown }).pkg);

// In a packaged .exe, keep the database beside the executable so data persists
// across restarts; in dev/compiled mode keep it in the backend folder.
const DB_PATH = process.env.TIRE_WAREHOUSE_DB_PATH
  || (isPackaged
    ? path.join(path.dirname(process.execPath), 'data.db')
    : path.join(__dirname, '../../data.db'));

// Read the sql.js WebAssembly binary: from the SEA blob when packaged, from
// node_modules otherwise.
function loadWasmBinary(): Buffer {
  if (isSea && sea) {
    return Buffer.from(sea.getAsset('sql-wasm.wasm'));
  }
  const wasmPath = path.join(path.dirname(require.resolve('sql.js')), 'sql-wasm.wasm');
  return fs.readFileSync(wasmPath);
}

let db: SqlJsDatabase;

export async function initDb(): Promise<SqlJsDatabase> {
  const SQL = await initSqlJs({ wasmBinary: loadWasmBinary() } as Parameters<typeof initSqlJs>[0]);
  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS tires (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sku TEXT UNIQUE NOT NULL,
      brand TEXT NOT NULL,
      model TEXT NOT NULL,
      size TEXT NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 0,
      location TEXT NOT NULL DEFAULT '',
      createdAt TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      updatedAt TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS stock_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tireId INTEGER NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('IN', 'OUT')),
      quantity INTEGER NOT NULL,
      operator TEXT NOT NULL DEFAULT '',
      stockInTime TEXT NOT NULL DEFAULT '',
      stockOutTime TEXT NOT NULL DEFAULT '',
      unitPrice REAL NOT NULL DEFAULT 0,
      recipient TEXT NOT NULL DEFAULT '',
      remark TEXT NOT NULL DEFAULT '',
      createdAt TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (tireId) REFERENCES tires(id)
    )
  `);

  // Add newly introduced fields without discarding existing stock records.
  const stockRecordColumns = new Set<string>();
  const columnStatement = db.prepare('PRAGMA table_info(stock_records)');
  while (columnStatement.step()) {
    stockRecordColumns.add(String(columnStatement.getAsObject().name));
  }
  columnStatement.free();
  if (!stockRecordColumns.has('stockInTime')) {
    db.run("ALTER TABLE stock_records ADD COLUMN stockInTime TEXT NOT NULL DEFAULT ''");
  }
  if (!stockRecordColumns.has('stockOutTime')) {
    db.run("ALTER TABLE stock_records ADD COLUMN stockOutTime TEXT NOT NULL DEFAULT ''");
  }
  if (!stockRecordColumns.has('unitPrice')) {
    db.run('ALTER TABLE stock_records ADD COLUMN unitPrice REAL NOT NULL DEFAULT 0');
  }
  if (!stockRecordColumns.has('recipient')) {
    db.run("ALTER TABLE stock_records ADD COLUMN recipient TEXT NOT NULL DEFAULT ''");
  }
  db.run(`
    CREATE TABLE IF NOT EXISTS inventory_checks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      checkDate TEXT NOT NULL,
      items TEXT NOT NULL DEFAULT '[]',
      operator TEXT NOT NULL DEFAULT '',
      createdAt TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    )
  `);

  saveDb();

  return db;
}

export function getDb(): SqlJsDatabase {
  return db;
}

export function saveDb() {
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
}
