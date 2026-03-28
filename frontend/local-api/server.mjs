import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createOpsHttpHandler } from '../ops-api/core.js';
import { createFileStore } from './fileStore.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.OPS_API_PORT || process.env.LOCAL_API_PORT || 8787);
const HOST = process.env.OPS_API_HOST || process.env.LOCAL_API_HOST || '127.0.0.1';
const DATA_DIR = process.env.OPS_API_DATA_DIR || path.join(__dirname, 'data');
const DB_PATH = process.env.OPS_API_DB_PATH || path.join(DATA_DIR, 'db.json');
const handler = createOpsHttpHandler({
  storage: createFileStore(DB_PATH),
  serviceName: process.env.OPS_API_SERVICE_NAME || 'shadowbid-local-ops-api',
  environment: process.env.OPS_API_ENVIRONMENT || 'local',
  storageDriver: 'filesystem',
  corsOrigin: process.env.OPS_ALLOWED_ORIGIN || '*',
});

const server = http.createServer(async (request, response) => {
  await handler(request, response);
});

server.listen(PORT, HOST, async () => {
  console.log(`[shadowbid-local-api] listening on http://${HOST}:${PORT}`);
});
