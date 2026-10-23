/**
 * Web fallback: expo-sqlite on web needs wasm + cross-origin isolation, so the
 * browser build keeps records in localStorage instead (raw frames only while they fit).
 */
import { base64ToBytes, bytesToBase64 } from '@/core/base64';

import type { AnalysisRecord, AnalysisStore, KvStorage } from './types';

const ls = () => {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
};

export const kvStorage: KvStorage = {
  async getItem(key) {
    return ls()?.getItem(key) ?? null;
  },
  async setItem(key, value) {
    try {
      ls()?.setItem(key, value);
    } catch {}
  },
  async removeItem(key) {
    ls()?.removeItem(key);
  },
};

const LIST_KEY = 'thermolens.analyses';
const rawKey = (id: string) => `thermolens.raw.${id}`;

function readList(): AnalysisRecord[] {
  try {
    return JSON.parse(ls()?.getItem(LIST_KEY) ?? '[]') as AnalysisRecord[];
  } catch {
    return [];
  }
}

export const analysisStore: AnalysisStore = {
  async list() {
    return readList().sort((a, b) => b.createdAt - a.createdAt);
  },
  async save(rec, raw) {
    const list = readList().filter((r) => r.id !== rec.id);
    list.push(rec);
    try {
      ls()?.setItem(LIST_KEY, JSON.stringify(list));
      if (raw) ls()?.setItem(rawKey(rec.id), bytesToBase64(new Uint8Array(raw.buffer, raw.byteOffset, raw.byteLength)));
    } catch {
      // quota exceeded: metadata may be saved without raw data
    }
  },
  async getRaw(id) {
    const s = ls()?.getItem(rawKey(id));
    if (!s) return null;
    const b = base64ToBytes(s);
    const copy = new Uint8Array(b);
    return new Uint16Array(copy.buffer, 0, copy.byteLength >> 1);
  },
  async remove(id) {
    ls()?.setItem(LIST_KEY, JSON.stringify(readList().filter((r) => r.id !== id)));
    ls()?.removeItem(rawKey(id));
  },
};
