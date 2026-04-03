import { promises as fs } from 'node:fs';
import path from 'node:path';
import { createDefaultDb, deserializeDb, prepareDbForSave, serializeDb } from '../ops-api/core.js';

export function createFileStore(dbPath) {
  const dataDir = path.dirname(dbPath);
  const backupPath = `${dbPath}.bak`;
  let operationQueue = Promise.resolve();

  async function ensureDataDir() {
    await fs.mkdir(dataDir, { recursive: true });
  }

  function withExclusive(callback) {
    const run = operationQueue.then(callback, callback);
    operationQueue = run.catch(() => {});
    return run;
  }

  async function pathExists(targetPath) {
    try {
      await fs.access(targetPath);
      return true;
    } catch {
      return false;
    }
  }

  async function readDbFile(targetPath) {
    const raw = await fs.readFile(targetPath, 'utf8');
    return deserializeDb(raw);
  }

  async function writeDbFile(db) {
    const persistedDb = prepareDbForSave(db);
    const tempPath = `${dbPath}.${process.pid}.${Date.now()}.tmp`;

    await ensureDataDir();
    await fs.writeFile(tempPath, serializeDb(persistedDb), 'utf8');
    await fs.rename(tempPath, dbPath);
    await fs.copyFile(dbPath, backupPath);

    return persistedDb;
  }

  return {
    withExclusive,

    async loadDb() {
      await ensureDataDir();

      try {
        return await readDbFile(dbPath);
      } catch (error) {
        if (error?.code !== 'ENOENT') {
          try {
            const recoveredDb = await readDbFile(backupPath);
            await writeDbFile(recoveredDb);
            return recoveredDb;
          } catch {
            try {
              if (await pathExists(dbPath)) {
                await fs.rename(dbPath, `${dbPath}.corrupt-${Date.now()}.json`);
              }
            } catch {
              // Keep recovery best-effort only.
            }
          }
        }

        const defaultDb = createDefaultDb();
        return writeDbFile(defaultDb);
      }
    },

    async saveDb(db) {
      return writeDbFile(db);
    },

    async getInfo() {
      await ensureDataDir();

      try {
        const [dbStats, backupExists] = await Promise.all([
          fs.stat(dbPath),
          pathExists(backupPath),
        ]);

        return {
          mode: 'filesystem',
          dbPath,
          backupPath,
          exists: true,
          sizeBytes: dbStats.size,
          updatedAt: dbStats.mtime.toISOString(),
          backupExists,
          exclusiveWrites: true,
        };
      } catch {
        return {
          mode: 'filesystem',
          dbPath,
          backupPath,
          exists: false,
          sizeBytes: 0,
          updatedAt: null,
          backupExists: await pathExists(backupPath),
          exclusiveWrites: true,
        };
      }
    },
  };
}
