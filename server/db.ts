import fs from 'node:fs';
import path from 'node:path';
import mysql from 'mysql2/promise';
import type { Pool, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { DatabaseSync } from 'node:sqlite';
import { config } from './config.ts';

export type Dialect = 'mysql' | 'sqlite';

export interface ExecResult {
  insertId: number;
  affectedRows: number;
}

let dialect: Dialect = 'mysql';
let mysqlPool: Pool | null = null;
let sqliteDb: DatabaseSync | null = null;

function initSqlite() {
  const dataDir = path.resolve(process.cwd(), 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  const dbPath = path.join(dataDir, 'argaloka.sqlite');
  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec('PRAGMA journal_mode = WAL;');

  db.exec(`
    CREATE TABLE IF NOT EXISTS pengguna (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      nama TEXT NOT NULL,
      peran TEXT NOT NULL DEFAULT 'staf' CHECK (peran IN ('admin', 'staf')),
      kata_sandi_hash TEXT NOT NULL,
      dibuat_pada TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS kategori (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nama TEXT NOT NULL UNIQUE
    );

    CREATE TABLE IF NOT EXISTS warna (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nama TEXT NOT NULL UNIQUE,
      hex TEXT NOT NULL DEFAULT '#1b1b1b'
    );

    CREATE TABLE IF NOT EXISTS produk (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nama TEXT NOT NULL,
      kategori_id INTEGER NOT NULL REFERENCES kategori(id) ON UPDATE CASCADE ON DELETE RESTRICT,
      warna_id INTEGER NULL REFERENCES warna(id) ON UPDATE CASCADE ON DELETE RESTRICT,
      harga_beli INTEGER NOT NULL DEFAULT 0,
      harga_jual INTEGER NOT NULL,
      stok INTEGER NOT NULL DEFAULT 0,
      dibuat_pada TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS transaksi (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tanggal TEXT NOT NULL,
      jenis TEXT NOT NULL CHECK (jenis IN ('masuk', 'keluar')),
      produk_id INTEGER NULL REFERENCES produk(id) ON UPDATE CASCADE ON DELETE SET NULL,
      nama_produk TEXT NOT NULL DEFAULT '',
      jumlah INTEGER NOT NULL,
      harga INTEGER NOT NULL,
      harga_modal INTEGER NOT NULL DEFAULT 0,
      keuntungan INTEGER NOT NULL DEFAULT 0,
      dicatat_oleh INTEGER NULL REFERENCES pengguna(id) ON UPDATE CASCADE ON DELETE SET NULL,
      dibuat_pada TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TRIGGER IF NOT EXISTS trg_transaksi_before_insert
    BEFORE INSERT ON transaksi
    FOR EACH ROW
    BEGIN
      SELECT RAISE(ABORT, 'Produk wajib dipilih.')
       WHERE NEW.produk_id IS NULL;

      SELECT RAISE(ABORT, 'Produk tidak ditemukan.')
       WHERE NOT EXISTS (SELECT 1 FROM produk WHERE id = NEW.produk_id);

      SELECT RAISE(ABORT, 'Stok tidak cukup untuk penjualan ini.')
       WHERE NEW.jenis = 'keluar'
         AND (SELECT stok FROM produk WHERE id = NEW.produk_id) < NEW.jumlah;
    END;

    CREATE TRIGGER IF NOT EXISTS trg_transaksi_after_insert
    AFTER INSERT ON transaksi
    FOR EACH ROW
    BEGIN
      UPDATE transaksi
         SET nama_produk = CASE
               WHEN COALESCE(NEW.nama_produk, '') = '' THEN (SELECT nama FROM produk WHERE id = NEW.produk_id)
               ELSE NEW.nama_produk
             END,
             harga_modal = (SELECT harga_beli FROM produk WHERE id = NEW.produk_id),
             keuntungan = CASE
               WHEN NEW.jenis = 'keluar'
               THEN (NEW.harga - (SELECT harga_beli FROM produk WHERE id = NEW.produk_id)) * NEW.jumlah
               ELSE 0
             END
       WHERE id = NEW.id;

      UPDATE produk
         SET harga_beli = CASE
               WHEN NEW.jenis = 'masuk' AND (stok + NEW.jumlah) > 0
               THEN CAST(ROUND(((stok * harga_beli) + (NEW.jumlah * NEW.harga)) * 1.0 / (stok + NEW.jumlah)) AS INTEGER)
               ELSE harga_beli
             END,
             stok = CASE
               WHEN NEW.jenis = 'masuk' THEN stok + NEW.jumlah
               ELSE stok - NEW.jumlah
             END
       WHERE id = NEW.produk_id;
    END;

    CREATE TRIGGER IF NOT EXISTS trg_transaksi_before_update
    BEFORE UPDATE ON transaksi
    FOR EACH ROW
    BEGIN
      SELECT RAISE(ABORT, 'Perubahan ini membuat stok produk menjadi negatif. Kurangi jumlahnya.')
       WHERE NEW.produk_id IS NOT NULL
         AND (
           (SELECT stok FROM produk WHERE id = NEW.produk_id)
           + (CASE WHEN OLD.jenis = 'masuk' THEN (NEW.jumlah - OLD.jumlah) ELSE -(NEW.jumlah - OLD.jumlah) END)
         ) < 0;
    END;

    CREATE TRIGGER IF NOT EXISTS trg_transaksi_after_update
    AFTER UPDATE OF tanggal, jumlah, harga ON transaksi
    FOR EACH ROW
    BEGIN
      UPDATE transaksi
         SET keuntungan = CASE
               WHEN NEW.jenis = 'keluar' THEN (NEW.harga - NEW.harga_modal) * NEW.jumlah
               ELSE 0
             END
       WHERE id = NEW.id;

      UPDATE produk
         SET stok = stok + (CASE WHEN OLD.jenis = 'masuk' THEN (NEW.jumlah - OLD.jumlah) ELSE -(NEW.jumlah - OLD.jumlah) END)
       WHERE id = NEW.produk_id
         AND NEW.produk_id IS NOT NULL
         AND NEW.jumlah <> OLD.jumlah;
    END;
  `);

  const countRow = db.prepare('SELECT COUNT(*) AS cnt FROM pengguna').get() as { cnt: number };
  if (countRow.cnt === 0) {
    db.exec(`
      INSERT INTO pengguna (id, username, nama, peran, kata_sandi_hash) VALUES
        (1, 'admin', 'Admin Argaloka', 'admin', 'scrypt:51534196aad3eefab38014578689cace:cb13f39c8f9c05e9e432252579d5b82cdb7d4719c010fa1af9715b4a88cd090e8f7ff99b84635e617102ff6addd8f0e00ed5566c6d774d1d3a8194e5a2086ff7'),
        (2, 'staff', 'Staf Gudang', 'staf', 'scrypt:71fe1ea22da77123898daa0eb8906b0e:f912923ceda133bf9072bd7aa89242508728033d188b40961cc44b84aa2bf4340d13e18c48e2ba4e62a93f5fd026515349f1f15397b8068e682100ab7ad94122');

      INSERT INTO kategori (id, nama) VALUES
        (1, 'Ransel'),
        (2, 'Tote Bag'),
        (3, 'Sling Bag'),
        (4, 'Dompet'),
        (5, 'Pouch');

      INSERT INTO warna (id, nama, hex) VALUES
        (1, 'Hitam', '#1b1b1b'),
        (2, 'Navy', '#1f2f55'),
        (3, 'Hijau Army', '#4b5a3a'),
        (4, 'Coklat', '#6b4a2f'),
        (5, 'Krem', '#d8c9a8'),
        (6, 'Abu-abu', '#8a8f93');

      INSERT INTO produk (id, nama, kategori_id, warna_id, harga_beli, harga_jual, stok) VALUES
        (1, 'Ransel Rinjani 30L', 1, 1, 180000, 289000, 0),
        (2, 'Tote Canvas Merbabu', 2, 5, 55000, 99000, 0),
        (3, 'Sling Bag Semeru', 3, 3, 85000, 149000, 0),
        (4, 'Dompet Kulit Bromo', 4, 4, 60000, 119000, 0);

      INSERT INTO transaksi (tanggal, jenis, produk_id, jumlah, harga, dicatat_oleh) VALUES
        (date('now', 'localtime', '-10 days'), 'masuk', 1, 30, 180000, 1),
        (date('now', 'localtime', '-9 days'), 'masuk', 2, 50, 55000, 1),
        (date('now', 'localtime', '-8 days'), 'masuk', 3, 10, 85000, 1),
        (date('now', 'localtime', '-7 days'), 'masuk', 4, 22, 60000, 1),
        (date('now', 'localtime', '-5 days'), 'keluar', 1, 4, 289000, 1),
        (date('now', 'localtime', '-4 days'), 'keluar', 2, 6, 99000, 2),
        (date('now', 'localtime', '-3 days'), 'keluar', 3, 4, 149000, 2),
        (date('now', 'localtime', '-2 days'), 'keluar', 4, 4, 119000, 1),
        (date('now', 'localtime', '-1 days'), 'keluar', 1, 2, 289000, 1),
        (date('now', 'localtime', '-1 days'), 'keluar', 2, 4, 99000, 2),
        (date('now', 'localtime'), 'keluar', 3, 2, 149000, 1);
    `);
  }

  sqliteDb = db;
  dialect = 'sqlite';
}

export async function initDb(): Promise<Dialect> {
  if (config.dbDriver === 'sqlite') {
    initSqlite();
    console.log('[db] Mode SQLite aktif (./data/argaloka.sqlite)');
    return dialect;
  }

  const pool = mysql.createPool({
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
    database: config.db.database,
    waitForConnections: true,
    connectionLimit: 10,
    dateStrings: true,
    connectTimeout: 2500,
  });

  try {
    await pool.query('SELECT 1');
    mysqlPool = pool;
    dialect = 'mysql';
    console.log(`[db] Terhubung ke MySQL (${config.db.host}:${config.db.port}/${config.db.database})`);
    return dialect;
  } catch (err) {
    await pool.end().catch(() => {});
    if (config.dbStrict) {
      throw err;
    }
    console.warn(`[db] MySQL (${config.db.host}:${config.db.port}) tidak terdeteksi, beralih ke SQLite lokal (./data/argaloka.sqlite).`);
    initSqlite();
    return dialect;
  }
}

export function getDialect(): Dialect {
  return dialect;
}

export async function pingDb(): Promise<void> {
  if (dialect === 'mysql' && mysqlPool) {
    await mysqlPool.query('SELECT 1');
    return;
  }
  if (sqliteDb) {
    sqliteDb.prepare('SELECT 1').get();
    return;
  }
  throw new Error('Database belum diinisialisasi.');
}

function toSqlParams(params: unknown[]): Array<string | number | null | Uint8Array> {
  return params.map((p) => {
    if (p === undefined || p === null) return null;
    if (typeof p === 'boolean') return p ? 1 : 0;
    if (typeof p === 'number' || typeof p === 'string' || p instanceof Uint8Array) return p;
    return String(p);
  });
}

export async function query<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  if (dialect === 'mysql' && mysqlPool) {
    const [rows] = await mysqlPool.query<RowDataPacket[]>(sql, params);
    return rows as unknown as T[];
  }
  if (sqliteDb) {
    const stmt = sqliteDb.prepare(sql);
    return stmt.all(...toSqlParams(params)) as unknown as T[];
  }
  throw new Error('Database belum diinisialisasi.');
}

export async function one<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
): Promise<T | null> {
  const rows = await query<T>(sql, params);
  return rows[0] ?? null;
}

export async function exec(sql: string, params: unknown[] = []): Promise<ExecResult> {
  if (dialect === 'mysql' && mysqlPool) {
    const [result] = await mysqlPool.query<ResultSetHeader>(sql, params);
    return {
      insertId: Number(result.insertId || 0),
      affectedRows: Number(result.affectedRows || 0),
    };
  }
  if (sqliteDb) {
    const stmt = sqliteDb.prepare(sql);
    const info = stmt.run(...toSqlParams(params));
    return {
      insertId: Number(info.lastInsertRowid || 0),
      affectedRows: Number(info.changes || 0),
    };
  }
  throw new Error('Database belum diinisialisasi.');
}

export async function closeDb(): Promise<void> {
  if (mysqlPool) {
    await mysqlPool.end();
    mysqlPool = null;
  }
  if (sqliteDb) {
    sqliteDb.close();
    sqliteDb = null;
  }
}
