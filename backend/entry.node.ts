import { serve } from '@hono/node-server';
import app from './server.js';

const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
serve({ fetch: app.fetch, port }, (info) => {
  console.log(`Server listening on http://localhost:${info.port}`);
});
