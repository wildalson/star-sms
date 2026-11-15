import { randomBytes, randomInt } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import cookieParser from 'cookie-parser';
import express, { Router, type Request, type Response } from 'express';
import { rateLimit } from 'express-rate-limit';
import { demoAccounts } from '../src/demo-accounts.ts';
import { permissions } from '../src/permissions-tree.ts';
import { configForms, pages } from '../src/pages.ts';
import { adminFieldKey, adminForms, type AdminField, type AdminFormKey } from '../src/admin-forms.ts';
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
    rows['product list'] = (rows['product list'] ?? []).map(product => ({
      'Product name': product['Product name'],
      SPID: product.SPID ?? '',
    }));
    const customer = state.rows['user list']?.find(row => row.ID === 1);
    const rights = Object.fromEntries(['Hide reports', 'Hide send details', 'Hide your finances',
      'Hide exports', 'Hide cell phone number', 'Hidden state']
      .filter(key => customer?.[key] === 'yes').map(key => [key, 'yes']));
    if (rights['Hide reports']) delete rows['user statis'];
    if (rights['Hide your finances']) delete rows['recharge record'];
    if (rights['Hide send details']) {
      delete rows['send record'];
      delete rows['reply record'];
    }
    if (rights['Hide cell phone number'] || rights['Hidden state']) {
      for (const page of ['send record', 'reply record']) {
        if (!rows[page]) continue;
        rows[page] = rows[page].map(row => {
          const visible = { ...row };
          if (rights['Hide cell phone number']) {
            for (const key of ['mobile', 'mobile/extension', 'Whitelist mobile phone number']) {
              if (visible[key]) visible[key] = String(visible[key]).replace(/\d(?=\d{4})/g, '*');
            }
          }
          if (rights['Hidden state']) {
            delete visible.status;
            delete visible['task status'];
          }
          return visible;
        });
      }
    }
    rows['user list'] = [{ account: 'Demo customer' }];
    res.json({ rows, settings: {
      'site config': { 'Site name': state.settings['site config']?.['Site name'] ?? '短信' },
      'customer rights': rights,
    } });
  });

  router.post('/tasks', async (req, res) => {
    if (role !== 'client') throw new InputError('Open the customer portal to submit SMS tasks.', 403);
    const fields = formFields(req.body, ['product type', 'Sender', 'mobile', 'SMS content', 'Scheduled send time (UTC+8)'], 16_000);
    const recipients = [...new Set(fields.mobile.split(/[\s,;，]+/).filter(Boolean))];
    if (!recipients.length || recipients.length > 1000 || recipients.some(value => !/^\+?\d{7,16}$/.test(value))) {
      throw new InputError('Enter up to 1,000 valid phone numbers.');
    }
    if (!fields['SMS content']) throw new InputError('Enter message content.');
    const scheduled = fields['Scheduled send time (UTC+8)'];
    if (scheduled) {
      const instant = new Date(scheduled + ':00+08:00');
      if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(scheduled) ||
        !Number.isFinite(instant.getTime()) || dateTime(instant).slice(0, 16).replace(' ', 'T') !== scheduled ||
        instant.getTime() <= Date.now()) throw new InputError('Select a future send time.');
    }
    await store.update(state => {
      const product = state.rows['product list']?.find(row => row['Product name'] === fields['product type']);
      if (!product) throw new InputError('Select a valid product.');
      const id = ++state.lastTaskId;
      const now = dateTime();
      const status = 'queued (demo)';
      const spid = product.SPID ?? '';
      (state.rows['send task'] ??= []).push({
        'task ID': id, 'user/company': 'Demo customer',
        'create time/timed transmission time': scheduled ? now + ' / ' + scheduled.replace('T', ' ') + ':00' : now,
        'task type': scheduled ? 'Scheduled' : 'Immediate', SPID: spid,
        'task status': status, 'product/code': fields['product type'], 'send content': fields['SMS content'],
        'Total number/Submission success/submission failure': recipients.length + '/0/0',
      });
      const records = state.rows['send record'] ??= [];
      for (const mobile of recipients) records.push({
        'S/N': ++state.lastRecordId, 'user/company': 'Demo customer', 'mobile/extension': mobile, date: now,
        status, 'SMS content': fields['SMS content'], 'product/code': fields['product type'], 'task ID': id, senderID: fields.Sender, SPID: spid,
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
    const formKey = req.body?.form;
    const index = req.body?.index;
    const spec = pages[name];
    const form = typeof formKey === 'string' && Object.hasOwn(adminForms, formKey)
      ? adminForms[formKey as AdminFormKey] : undefined;
    if (formKey !== undefined && (!form || role !== 'admin' || form.page !== name ||
      (operation !== 'create' && operation !== 'edit') || (formKey === 'customerAttributes' && operation !== 'edit'))) {
      throw new InputError('Operation unavailable.', 403);
    }
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
        if (!form && !spec.editFields.length) throw new InputError('This table does not allow new records.');
        const values = form ? adminValues(req.body?.values, form.fields) : editableValues(req.body?.values, spec.editFields);
        const next: Row = { ...values, 'create time': dateTime() };
        for (const key of ['ID', 'UID', 'S/N', 'channel id'].filter(key => spec.columns.includes(key))) {
          next[key] = rows.reduce((max, row) => Math.max(max, Number(row[key]) || 0), 0) + 1;
        }
        if (name === 'user list') next.status = 'normal';
        if (name === 'account') setAccountLabel(next);
        if (form && 'subtype' in form) {
          next['Protocol'] = form.subtype;
          next['enabled state'] = 'disabled';
          next['Health state'] = 'offline';
        }
        if (formKey === 'blacklist' || formKey === 'whitelist') {
          const key = formKey === 'blacklist' ? 'mobile' : 'Whitelist mobile phone number';
          const numbers = [...new Set(String(next[key]).split(/\s+/).filter(Boolean))];
          if (!numbers.length || numbers.length > 20_000 || numbers.some(number => !/^\+?\d{7,16}$/.test(number))) {
            throw new InputError('Enter up to 20,000 valid phone numbers, one per line.');
          }
          for (const number of numbers) rows.push({ ...next, [key]: number });
          return;
        }
        if (formKey === 'userTemplate') next['Audit status'] = 'Pending review';
        if (formKey === 'announcement') next.date = next['create time'];
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
      } else if (operation === 'edit' && (form || spec.editFields.length)) {
        Object.assign(record, form ? adminValues(req.body?.values, form.fields) : editableValues(req.body?.values, spec.editFields));
        if (name === 'account') setAccountLabel(record);
      } else if (operation === 'lock' && name === 'user list') {
        record.status = record.status === 'locked' ? 'normal' : 'locked';
      } else if (operation === 'toggle-channel' && name === 'channel list' && role === 'admin') {
        record['enabled state'] = ['enable', 'enabled'].includes(String(record['enabled state'])) ? 'disabled' : 'enabled';
      } else if (operation === 'product' && name === 'user list') {
        const billingField = 'International product billing word count';
        const values = formFields(req.body?.values, ['product', billingField]);
        const { product } = values;
        if (!(state.rows['product list'] ?? []).some(row => row['Product name'] === product)) throw new InputError('Select a product.');
        if (values[billingField] && !['160words/pieces', '140words/pieces', 'force 1 piece'].includes(values[billingField])) {
          throw new InputError('Invalid ' + billingField);
        }
        const products = String(record['launched product'] ?? '').split('|').filter(Boolean);
        record['launched product'] = [...new Set([...products, product])].join('|');
        record[billingField + ' · ' + product] = values[billingField];
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
  if (values.Permissions) {
    const known = new Set(permissions.map(permission => permission.id));
    const selected = values.Permissions.split(',');
    if (selected.some(id => !known.has(id))) throw new InputError('Invalid permissions.');
    values.Permissions = [...new Set(selected)].join(',');
  }
  return values;
}

function setAccountLabel(row: Row) {
  row['User name/name/mobile phone number'] = [row['User name'], row.name, row.mobile].filter(Boolean).join(' / ');
}

function adminValues(input: unknown, fields: AdminField[]) {
  const persisted = fields.filter(field => !/password/i.test(field.label));
  const values = formFields(input, persisted.map(adminFieldKey), 400_000);
  for (const field of persisted) {
    const value = values[adminFieldKey(field)];
    if (field.checkbox && value && value !== 'yes') throw new InputError('Invalid ' + field.label);
    if (!value) {
      if (field.required) throw new InputError(field.label + ' is required.');
      continue;
    }
    if (field.options && !field.options.includes(value)) throw new InputError('Invalid ' + field.label);
    if (field.number && (!/^\d+$/.test(value) || Number(value) < field.number.min ||
      Number(value) > field.number.max)) throw new InputError('Invalid ' + field.label);
  }
  return values;
}
