import { resolve } from 'node:path';
import express from 'express';
import { createApi } from './api.ts';
import { createStore } from './store.ts';

const root = resolve(import.meta.dirname, '..');
const dev = process.argv.includes('--dev');
const hosted = process.env.RENDER === 'true';
const hostname = process.env.RENDER_EXTERNAL_HOSTNAME;
const clientPassword = process.env.STAR_SMS_CLIENT_PASSWORD;
const adminPassword = process.env.STAR_SMS_ADMIN_PASSWORD;
if (hosted && (dev || !hostname || !clientPassword || !adminPassword ||
  clientPassword.length < 16 || adminPassword.length < 16 || clientPassword === adminPassword)) {
  throw new Error('Render requires a hostname and distinct demo passwords of at least 16 characters.');
}
const hostedPasswords = hosted ? { client: clientPassword!, admin: adminPassword! } : undefined;
const databaseUrl = hosted ? undefined : process.env.DATABASE_URL?.trim();
const store = createStore(databaseUrl, hosted ? undefined : resolve(root, '.data/demo.json'));
const app = express();

app.disable('x-powered-by');
if (hosted) app.set('trust proxy', 1);
app.get('/healthz', (_req, res) => { res.status(200).type('text').send('ok'); });
app.use((req, res, next) => {
  const allowed = hosted ? req.hostname === hostname : ['localhost', '127.0.0.1'].includes(req.hostname);
  if (!allowed) {
    return res.status(403).send('Open the demo from its configured address.');
  }
  next();
});
app.use('/api', createApi(store, hostedPasswords));
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
app.listen(port, hosted ? '0.0.0.0' : '127.0.0.1', () => {
  const base = hosted ? 'https://' + hostname : 'http://127.0.0.1:' + port;
  console.log(`Client  ${base}/client/`);
  console.log(`Admin   ${base}/admin/`);
  console.log(hosted ? 'Data: demo memory' : databaseUrl ? 'Data: PostgreSQL' : 'Data: local demo file');
});
