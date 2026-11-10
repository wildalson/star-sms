import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import express from 'express';
import { createApi } from './api.ts';
import { createStore } from './store.ts';
import type { Role, State } from '../src/model.ts';

test('separate portal sessions and a shared, persistent demo queue', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'star-sms-test-'));
  const file = join(dir, 'demo.json');
  const app = express();
  app.use('/api', createApi(createStore(undefined, file)));
  const server = app.listen(0, '127.0.0.1');
  t.after(async () => {
    await new Promise<void>(resolve => server.close(() => resolve()));
    await rm(dir, { recursive: true, force: true });
  });
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const base = 'http://127.0.0.1:' + address.port + '/api/';

  const call = (role: Role, path: string, cookie?: string, body?: unknown) => fetch(base + role + path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { ...(cookie ? { cookie } : {}), ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  async function login(role: Role, username: string, password: string) {
    const response = await call(role, '/challenge');
    assert.equal(response.status, 200);
    const { id, image } = await response.json() as { id: string; image: string };
    const svg = Buffer.from(image.split(',')[1], 'base64').toString();
    const captcha = [...svg.matchAll(/<text [^>]+>(.)<\/text>/g)].map(match => match[1]).join('');
    assert.equal(captcha.length, 4);
    return call(role, '/login', undefined, { username, password, captcha, challengeId: id });
  }

  assert.equal((await call('admin', '/state')).status, 401);
  assert.equal((await login('admin', 'demo-client', 'client-demo')).status, 401);
  assert.equal((await login('client', 'demo-admin', 'admin-demo')).status, 401);
  assert.equal((await login('admin', 'demo-admin', 'client-demo')).status, 401);
  assert.equal((await login('client', 'customer', 'sms-demo')).status, 200);
  assert.equal((await login('admin', 'admin', 'sms-demo')).status, 200);
  const customer = await login('client', 'demo-client', 'client-demo');
  const administrator = await login('admin', 'demo-admin', 'admin-demo');
  assert.equal(customer.status, 200);
  assert.equal(administrator.status, 200);
  const clientCookie = customer.headers.getSetCookie()[0].split(';')[0];
  const adminCookie = administrator.headers.getSetCookie()[0].split(';')[0];
  assert.match(administrator.headers.getSetCookie()[0], /HttpOnly; SameSite=Strict/i);
  assert.equal((await call('admin', '/state', clientCookie)).status, 401);
  assert.equal((await call('client', '/state', adminCookie)).status, 401);
  assert.equal((await call('client', '/rows/account', clientCookie, { operation: 'create' })).status, 403);

  const task = { 'product type': 'Philippines', Sender: 'DEMO', mobile: '+630000000000\n+630000000000', 'SMS content': 'Local demo' };
  assert.equal((await call('client', '/tasks', clientCookie, { ...task, mobile: 'invalid' })).status, 400);
  const submissions = await Promise.all([call('client', '/tasks', clientCookie, task), call('client', '/tasks', clientCookie, task)]);
  assert.deepEqual(submissions.map(response => response.status), [201, 201]);
  const state = await (await call('admin', '/state', adminCookie)).json() as State;
  assert.deepEqual(state.rows['send task'].map(row => row['task ID']), [1, 2]);
  assert.equal(state.rows['send record'].length, 2);
  assert.equal(state.rows['send record'][0].status, 'queued (demo)');
  assert.deepEqual(state.settings, {});
  const customerState = await (await call('client', '/state', clientCookie)).json() as State;
  assert.equal(customerState.rows.account, undefined);
  assert.equal(customerState.rows['channel list'], undefined);
  assert.equal((await createStore(undefined, file).read()).lastTaskId, 2);
});
