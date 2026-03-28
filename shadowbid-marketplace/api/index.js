/* global process */
import { createBlobStore } from '../ops-api/blobStore.js';
import { createOpsFetchHandler } from '../ops-api/core.js';

const handler = createOpsFetchHandler({
  storage: createBlobStore(),
  serviceName: 'shadowbid-ops-api',
  environment: process.env.VERCEL_ENV || 'production',
  storageDriver: 'vercel-blob',
});

export default {
  async fetch(request) {
    return handler(request);
  },
};
