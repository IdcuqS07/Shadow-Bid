import { promises as fs } from 'node:fs';
import path from 'node:path';
import { createDefaultDb, deserializeDb, serializeDb } from '../ops-api/core.js';

export function createFileStore(dbPath) {
  const dataDir = path.dirname(dbPath);

  async function ensureDataDir() {
    await fs.mkdir(dataDir, { recursive: true });
  }

  return {
    async loadDb() {
      await ensureDataDir();

      try {
        const raw = await fs.readFile(dbPath, 'utf8');
        return deserializeDb(raw);
      } catch {
        const defaultDb = createDefaultDb();
        await fs.writeFile(dbPath, serializeDb(defaultDb), 'utf8');
        return defaultDb;
      }
    },

    async saveDb(db) {
      await ensureDataDir();
      await fs.writeFile(dbPath, serializeDb(db), 'utf8');
    },
  };
}
