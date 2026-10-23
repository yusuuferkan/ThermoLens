/** Native persistence on expo-sqlite. The web implementation lives in db.web.ts. */
import * as SQLite from 'expo-sqlite';

import type { AnalysisRecord, AnalysisStore, KvStorage } from './types';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

function getDb() {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync('thermolens.db');
      await db.execAsync(`
        PRAGMA journal_mode = WAL;
        CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS analyses (
          id TEXT PRIMARY KEY NOT NULL,
          created_at INTEGER NOT NULL,
          json TEXT NOT NULL,
          raw BLOB
        );
      `);
      return db;
    })();
  }
  return dbPromise;
}

export const kvStorage: KvStorage = {
  async getItem(key) {
    const db = await getDb();
    const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM kv WHERE key = ?', key);
    return row?.value ?? null;
  },
  async setItem(key, value) {
    const db = await getDb();
    await db.runAsync('INSERT OR REPLACE INTO kv (key, value) VALUES (?, ?)', key, value);
  },
  async removeItem(key) {
    const db = await getDb();
    await db.runAsync('DELETE FROM kv WHERE key = ?', key);
  },
};

export const analysisStore: AnalysisStore = {
  async list() {
    const db = await getDb();
    const rows = await db.getAllAsync<{ json: string }>('SELECT json FROM analyses ORDER BY created_at DESC');
    return rows.map((r) => JSON.parse(r.json) as AnalysisRecord);
  },
  async save(rec, raw) {
    const db = await getDb();
    const blob = raw ? new Uint8Array(raw.buffer, raw.byteOffset, raw.byteLength) : null;
    await db.runAsync(
      'INSERT OR REPLACE INTO analyses (id, created_at, json, raw) VALUES (?, ?, ?, ?)',
      rec.id,
      rec.createdAt,
      JSON.stringify(rec),
      blob,
    );
  },
  async getRaw(id) {
    const db = await getDb();
    const row = await db.getFirstAsync<{ raw: Uint8Array | null }>('SELECT raw FROM analyses WHERE id = ?', id);
    if (!row?.raw) return null;
    const copy = new Uint8Array(row.raw); // realign for Uint16Array view
    return new Uint16Array(copy.buffer, 0, copy.byteLength >> 1);
  },
  async remove(id) {
    const db = await getDb();
    await db.runAsync('DELETE FROM analyses WHERE id = ?', id);
  },
};
