import { serve } from '@hono/node-server';
import app from './server.js';

// Start node server, reading PORT from environment variables for production cloud hosting
const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
console.log(`Starting Hono backend server on http://localhost:${port}`);
serve({
  fetch: app.fetch,
  port,
});
