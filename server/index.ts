import { resolve } from 'node:path';
import express from 'express';
import { createApi } from './api.ts';
import { createStore } from './store.ts';

const root = resolve(import.meta.dirname, '..');
const dev = process.argv.includes('--dev');
const databaseUrl = process.env.DATABASE_URL?.trim();
const store = createStore(databaseUrl, resolve(root, '.data/demo.json'));
const app = express();

app.disable('x-powered-by');
app.use((req, res, next) => {
  if (!['localhost', '127.0.0.1'].includes(req.hostname)) {
    return res.status(403).send('Open this demo from localhost.');
  }
  next();
});
app.use('/api', createApi(store));
app.get('/', (_req, res) => res.redirect('/client/'));

if (dev) {
  const { createServer } = await import('vite');
  const vite = await createServer({
    root,
    server: {
      middlewareMode: true,
      fs: { deny: ['.env', '.env.*', '*.{crt,pem}', '**/.git/**', '**/.data/**', '**/server/**'] },
    },
  });
  app.use(vite.middlewares);
} else {
  app.use(express.static(resolve(root, 'dist')));
}

const port = Number(process.env.PORT || 4173);
app.listen(port, '127.0.0.1', () => {
  console.log(`Client  http://127.0.0.1:${port}/client/`);
  console.log(`Admin   http://127.0.0.1:${port}/admin/`);
  console.log(databaseUrl ? 'Data: PostgreSQL' : 'Data: local demo file');
});
