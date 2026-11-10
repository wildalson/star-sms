import { randomBytes, randomInt } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import cookieParser from 'cookie-parser';
import express, { Router, type Request, type Response } from 'express';
import { rateLimit } from 'express-rate-limit';
import { demoAccounts } from '../src/demo-accounts.ts';
import { configForms, pages } from '../src/pages.ts';
import { dateTime, type Fields, type Role, type Row } from '../src/model.ts';
import type { Store } from './store.ts';

const clientPages = new Set(['send task', 'send record', 'reply record', 'recharge record',
  'user template', 'user blacklist', 'user whitelist', 'user statis', 'product list']);
const clientEditable = new Set(['user template', 'user blacklist', 'user whitelist']);
const legacyDemoUsernames: Record<Role, string> = { admin: 'admin', client: 'customer' };

class InputError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

function formFields(input: unknown, allowed: string[], max = 5000): Fields {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new InputError('Invalid fields.');
  const values = input as Record<string, unknown>;
  return Object.fromEntries(allowed.map(key => {
    const value = values[key] ?? '';
    if (typeof value !== 'string' || value.length > max) throw new InputError('Invalid ' + key);
    return [key, value.trim()];
  }));
}

export function createApi(store: Store, hostedPasswords?: Record<Role, string>) {
  const api = Router();
  api.use(express.json({ limit: '3mb' }), cookieParser());
  api.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });

  for (const role of ['admin', 'client'] as const) {
    api.use('/' + role, roleApi(role, store, hostedPasswords?.[role]));
  }

  api.use((_req, res) => { res.status(404).json({ error: 'API route not found.' }); });
  api.use((error: Error & { status?: number }, _req: Request, res: Response, _next: unknown) => {
    const status = error.status && error.status >= 400 && error.status < 500 ? error.status : 500;
    if (status === 500) console.error(error);
    res.status(status).json({ error: status === 500 ? 'The server could not complete this request.' : error.message });
  });
  return api;
}

function roleApi(role: Role, store: Store, hostedPassword?: string) {
  const router = Router();
  const sessions = new Map<string, number>();
  const challenges = new Map<string, { code: string; expires: number }>();
  const cookie = 'star_sms_' + role;
  const cookieSettings = { httpOnly: true, sameSite: 'strict' as const, path: '/api/' + role, secure: Boolean(hostedPassword) };
  const token = () => randomBytes(24).toString('base64url');

  router.use(['/challenge', '/login'], rateLimit({
    windowMs: 10 * 60_000,
    limit: 60,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: 'Too many login attempts. Try again in a few minutes.' },
  }));

  router.get('/challenge', (_req, res) => {
    const chars = '23456789ACDEFGHJKLMNPQRTUVWXY';
    const code = Array.from({ length: 4 }, () => chars[randomInt(chars.length)]).join('');
    const id = token();
    const now = Date.now();
    for (const [key, value] of challenges) if (value.expires <= now) challenges.delete(key);
    challenges.set(id, { code, expires: now + 180_000 });
    const glyphs = [...code].map((letter, index) => {
      const x = 24 + 30 * index;
      return `<text x="${x}" y="26" transform="rotate(${randomInt(-23, 24)} ${x} 24)">${letter}</text>`;
    }).join('');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="156" height="38">
      <path fill="#f7fbff" d="M0 0h156v38H0z"/>
      <g fill="none" stroke="#a2a5c5"><path d="M0 23Q28 51 66 17T156 18"/><path d="M0 12Q40 28 77 8T156 24"/></g>
      <g font-family="Georgia,serif" font-size="22" font-weight="bold" fill="#29265e">${glyphs}</g>
    </svg>`;
    res.json({ id, image: 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64'), localDemo: !hostedPassword });
  });

  router.post('/login', async (req, res) => {
    const { username, password, captcha, challengeId } = formFields(req.body, ['username', 'password', 'captcha', 'challengeId']);
    const challenge = challenges.get(challengeId);
    challenges.delete(challengeId);
    const now = Date.now();
    const demo = demoAccounts[role];
    const matchesDemo = username === demo.username && password === (hostedPassword ?? demo.password);
    const matchesLegacyDemo = !hostedPassword && username === legacyDemoUsernames[role] && password === 'sms-demo';
    if (!challenge || challenge.expires <= now || challenge.code !== captcha.toUpperCase() ||
      !(matchesDemo || matchesLegacyDemo)) {
      throw new InputError('Incorrect username, password or CAPTCHA.', 401);
    }
    if (role === 'client') {
      const state = await store.read();
      if (state.rows['user list']?.some(row => row.ID === 1 && row.status === 'locked')) {
        throw new InputError('This customer account is locked.', 403);
      }
    }
    for (const [key, expires] of sessions) if (expires <= now) sessions.delete(key);
    const id = token();
    sessions.set(id, now + 8 * 3_600_000);
    res.cookie(cookie, id, { ...cookieSettings, maxAge: 8 * 3_600_000 }).json({ role });
  });

  router.use((req, _res, next) => {
    const id = req.cookies[cookie];
    const expires = typeof id === 'string' ? sessions.get(id) : undefined;
    if (!expires || expires <= Date.now()) throw new InputError('Log in to continue.', 401);
    next();
  });

  router.post('/logout', (req, res) => {
    sessions.delete(req.cookies[cookie]);
    res.clearCookie(cookie, cookieSettings).sendStatus(204);
  });

  router.get('/state', async (_req, res) => {
    const state = await store.read();
    if (role === 'admin') return res.json(state);
    const rows = Object.fromEntries(Object.entries(state.rows).filter(([key]) => clientPages.has(key)));
    rows['user list'] = [{ account: 'Demo customer' }];
    res.json({ rows, settings: { 'site config': { 'Site name': state.settings['site config']?.['Site name'] ?? '短信' } } });
  });

  router.post('/tasks', async (req, res) => {
    if (role !== 'client') throw new InputError('Open the customer portal to submit SMS tasks.', 403);
    const fields = formFields(req.body, ['product type', 'Sender', 'mobile', 'SMS content'], 16_000);
    const recipients = [...new Set(fields.mobile.split(/[\s,;，]+/).filter(Boolean))];
    if (!recipients.length || recipients.length > 1000 || recipients.some(value => !/^\+?\d{7,16}$/.test(value))) {
      throw new InputError('Enter up to 1,000 valid phone numbers.');
    }
    if (!fields['SMS content']) throw new InputError('Enter message content.');
    await store.update(state => {
      if (!(state.rows['product list'] ?? []).some(row => row['Product name'] === fields['product type'])) {
        throw new InputError('Select a valid product.');
      }
      const id = ++state.lastTaskId;
      const now = dateTime();
      const status = 'queued (demo)';
      (state.rows['send task'] ??= []).push({
        'task ID': id, 'user/company': 'Demo customer', 'create time/timed transmission time': now,
        'task status': status, 'product/code': fields['product type'], 'send content': fields['SMS content'],
        'Total number/Submission success/submission failure': recipients.length + '/0/0',
      });
      const records = state.rows['send record'] ??= [];
      for (const mobile of recipients) records.push({
        'S/N': ++state.lastRecordId, 'user/company': 'Demo customer', 'mobile/extension': mobile, date: now,
        status, 'SMS content': fields['SMS content'], 'product/code': fields['product type'], 'task ID': id, senderID: fields.Sender,
      });
    });
    res.sendStatus(201);
  });

  router.put('/settings/:page', async (req, res) => {
    const name = req.params.page;
    if (role !== 'admin' || name === 'my password' || !Object.hasOwn(configForms, name)) {
      throw new InputError('Configuration is unavailable.', 403);
    }
    const labels = configForms[name][2].map(([label]) => label).filter(label => label !== 'Password');
    const fields = formFields(req.body, labels, name === 'site config' ? 710_000 : 5000);
    await store.update(state => { state.settings[name] = fields; });
    res.sendStatus(204);
  });

  router.post('/rows/:page', async (req, res) => {
    const name = req.params.page;
    if (!Object.hasOwn(pages, name) || (role === 'client' && !clientEditable.has(name) && name !== 'send task')) {
      throw new InputError('This page is unavailable.', 403);
    }
    const { operation, expected } = req.body ?? {};
    const index = req.body?.index;
    const spec = pages[name];
    await store.update(state => {
      const rows = state.rows[name] ??= [];
      if (operation === 'delete-many' && spec.editFields.length) {
        const results: unknown = req.body?.results;
        if (!Array.isArray(results) || !results.length) throw new InputError('Select records to delete.');
        const indexes = new Set<number>();
        for (const result of results) {
          const index = result?.index;
          if (!Number.isSafeInteger(index) || !rows[index] || !isDeepStrictEqual(rows[index], result.record)) {
            throw new InputError('These records changed. Refresh and try again.', 409);
          }
          indexes.add(index);
        }
        state.rows[name] = rows.filter((_, index) => !indexes.has(index));
        return;
      }
      if (operation === 'create') {
        if (!spec.editFields.length) throw new InputError('This table does not allow new records.');
        const values = editableValues(req.body?.values, spec.editFields);
        const next: Row = { ...values, 'create time': dateTime() };
        for (const key of ['ID', 'UID', 'S/N', 'channel id'].filter(key => spec.columns.includes(key))) {
          next[key] = rows.reduce((max, row) => Math.max(max, Number(row[key]) || 0), 0) + 1;
        }
        if (name === 'user list') next.status = 'normal';
        if (name === 'account') setAccountLabel(next);
        rows.push(next);
        return;
      }

      const record = Number.isSafeInteger(index) ? rows[index] : undefined;
      if (!record || !isDeepStrictEqual(record, expected)) throw new InputError('This record changed. Refresh and try again.', 409);
      if (operation === 'delete' && (spec.editFields.length || name === 'send task')) {
        rows.splice(index, 1);
        if (name === 'send task') {
          state.rows['send record'] = (state.rows['send record'] ?? []).filter(row => row['task ID'] !== record['task ID']);
        }
      } else if (operation === 'edit' && spec.editFields.length) {
        Object.assign(record, editableValues(req.body?.values, spec.editFields));
        if (name === 'account') setAccountLabel(record);
      } else if (operation === 'lock' && name === 'user list') {
        record.status = record.status === 'locked' ? 'normal' : 'locked';
      } else if (operation === 'product' && name === 'user list') {
        const { product } = formFields(req.body?.values, ['product']);
        if (!(state.rows['product list'] ?? []).some(row => row['Product name'] === product)) throw new InputError('Select a product.');
        const products = String(record['launched product'] ?? '').split('|').filter(Boolean);
        record['launched product'] = [...new Set([...products, product])].join('|');
      } else {
        throw new InputError('Operation unavailable.');
      }
    });
    res.sendStatus(204);
  });

  return router;
}

function editableValues(input: unknown, labels: string[]) {
  const values = formFields(input, labels.filter(label => !/password/i.test(label)));
  if (!values[labels[0]]) throw new InputError(labels[0] + ' is required.');
  return values;
}

function setAccountLabel(row: Row) {
  row['User name/name/mobile phone number'] = [row['User name'], row.name, row.mobile].filter(Boolean).join(' / ');
}
