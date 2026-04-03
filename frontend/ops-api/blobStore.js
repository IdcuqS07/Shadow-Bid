/* global process */
import crypto from 'node:crypto';
import { del, get, list, put } from '@vercel/blob';
import { createDefaultDb, deserializeDb, prepareDbForSave, serializeDb } from './core.js';

const configuredPrefix = process.env.OPS_BLOB_PREFIX?.trim() || 'shadowbid-ops/snapshots';
const SNAPSHOT_PREFIX = configuredPrefix.replace(/^\/+/, '').replace(/\/?$/, '/');
const MAX_SNAPSHOTS = Math.max(5, Number(process.env.OPS_BLOB_MAX_SNAPSHOTS || 25));
const configuredAccess = process.env.OPS_BLOB_ACCESS?.trim();
const ACCESS_CANDIDATES = configuredAccess ? [configuredAccess] : ['private', 'public'];

let resolvedAccessPromise;

function createSnapshotPathname() {
  return `${SNAPSHOT_PREFIX}${Date.now().toString().padStart(16, '0')}-${crypto.randomUUID()}.json`;
}

async function streamToString(stream) {
  const decoder = new TextDecoder();

  if (typeof stream?.getReader === 'function') {
    const reader = stream.getReader();
    let raw = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      raw += decoder.decode(value, { stream: true });
    }

    raw += decoder.decode();
    return raw;
  }

  let raw = '';

  for await (const chunk of stream) {
    raw += decoder.decode(chunk, { stream: true });
  }

  raw += decoder.decode();
  return raw;
}

async function detectAccessMode() {
  if (ACCESS_CANDIDATES.length === 1) {
    return ACCESS_CANDIDATES[0];
  }

  let lastError = null;

  for (const access of ACCESS_CANDIDATES) {
    const probePathname = `${SNAPSHOT_PREFIX}__probe__/${crypto.randomUUID()}.txt`;

    try {
      const probe = await put(probePathname, 'ops-probe', {
        access,
        addRandomSuffix: false,
        contentType: 'text/plain',
      });
      await del(probe.url);
      return access;
    } catch (error) {
      lastError = error;
    }
  }

  throw new Error(lastError instanceof Error ? lastError.message : 'Unable to resolve Blob store access mode');
}

async function resolveAccessMode() {
  if (!resolvedAccessPromise) {
    resolvedAccessPromise = detectAccessMode();
  }

  return resolvedAccessPromise;
}

async function listSnapshots() {
  const snapshots = [];
  let cursor;

  do {
    const page = await list({
      prefix: SNAPSHOT_PREFIX,
      limit: 1000,
      cursor,
    });

    snapshots.push(
      ...(page.blobs || []).filter((blob) => blob.pathname.endsWith('.json')),
    );
    cursor = page.cursor;

    if (!page.hasMore) {
      break;
    }
  } while (cursor);

  return snapshots.sort((left, right) => left.pathname.localeCompare(right.pathname));
}

async function readLatestSnapshot(pathname) {
  const access = await resolveAccessMode();
  const snapshot = await get(pathname, { access });

  if (!snapshot || snapshot.statusCode !== 200 || !snapshot.stream) {
    throw new Error(`Unable to load Blob snapshot: ${pathname}`);
  }

  const raw = await streamToString(snapshot.stream);
  return deserializeDb(raw);
}

async function pruneSnapshots(snapshots) {
  const staleUrls = snapshots.slice(0, -MAX_SNAPSHOTS).map((snapshot) => snapshot.url);

  if (staleUrls.length > 0) {
    await del(staleUrls);
  }
}

export function createBlobStore() {
  let operationQueue = Promise.resolve();

  function withExclusive(callback) {
    const run = operationQueue.then(callback, callback);
    operationQueue = run.catch(() => {});
    return run;
  }

  const store = {
    withExclusive,

    async loadDb() {
      const snapshots = await listSnapshots();

      if (snapshots.length === 0) {
        const defaultDb = createDefaultDb();
        await store.saveDb(defaultDb);
        return defaultDb;
      }

      let lastError = null;

      for (let index = snapshots.length - 1; index >= 0; index -= 1) {
        try {
          return await readLatestSnapshot(snapshots[index].pathname);
        } catch (error) {
          lastError = error;
        }
      }

      throw new Error(lastError instanceof Error ? lastError.message : 'Unable to load any Blob snapshot');
    },

    async saveDb(db) {
      const access = await resolveAccessMode();
      const persistedDb = prepareDbForSave(db);

      // Immutable snapshots avoid stale reads when Blob content is cached globally.
      await put(createSnapshotPathname(), serializeDb(persistedDb), {
        access,
        addRandomSuffix: false,
        contentType: 'application/json',
      });

      const snapshots = await listSnapshots();
      if (snapshots.length > MAX_SNAPSHOTS) {
        await pruneSnapshots(snapshots);
      }

      return persistedDb;
    },

    async getInfo() {
      const snapshots = await listSnapshots();
      const latestSnapshot = snapshots.at(-1) || null;

      return {
        mode: 'blob',
        prefix: SNAPSHOT_PREFIX,
        snapshots: snapshots.length,
        latestSnapshot: latestSnapshot?.pathname || null,
        maxSnapshots: MAX_SNAPSHOTS,
        exclusiveWrites: true,
      };
    },
  };

  return store;
}
