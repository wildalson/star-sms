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

  const mutate = (page: string, values: unknown) =>
    call('admin', '/rows/' + encodeURIComponent(page), adminCookie, values);
  const channel = {
    operation: 'create', form: 'smpp', values: {
      'channel name/vendor': 'Local test channel', 'Access protocol': 'SMPP', 'Extension length': '20',
      'Total delivery speed': '100', 'Number of channel connections': '1', 'Billing mode': 'Submission billing',
      password: 'discard-this-test-value',
    },
  };
  assert.equal((await mutate('channel list', { ...channel, values: { ...channel.values, 'Total delivery speed': '9' } })).status, 400);
  assert.equal((await mutate('channel list', channel)).status, 204);
  const saved = await (await call('admin', '/state', adminCookie)).json() as State;
  const savedChannel = saved.rows['channel list'].find(row => row['channel name/vendor'] === 'Local test channel');
  assert.equal(savedChannel?.['Access protocol'], 'SMPP');
  assert.equal(savedChannel?.password, undefined);
  assert.equal(savedChannel?.['enabled state'], 'disabled');
  assert.equal((await mutate('user whitelist', { operation: 'create', form: 'whitelist', values: {
    account: 'Demo customer', 'Whitelist mobile phone number': '+630000000000\n+630000000001\n+630000000000',
  } })).status, 204);

  const future = '2099-01-02T12:34';
  assert.equal((await call('client', '/tasks', clientCookie, { ...task, 'Scheduled send time (UTC+8)': '2099-02-30T12:34' })).status, 400);
  assert.equal((await call('client', '/tasks', clientCookie, { ...task, 'Scheduled send time (UTC+8)': future })).status, 201);
  const afterScheduling = await (await call('admin', '/state', adminCookie)).json() as State;
  assert.equal(afterScheduling.rows['user whitelist'].length, 2);
  assert.equal(afterScheduling.rows['send task'].at(-1)?.['task type'], 'Scheduled');
  assert.match(String(afterScheduling.rows['send task'].at(-1)?.['create time/timed transmission time']), /2099-01-02 12:34:00/);

  assert.equal((await mutate('role', { operation: 'create', values: { 'Role name': 'Test role', Permissions: '4,19' } })).status, 204);
  assert.equal((await mutate('role', { operation: 'create', values: { 'Role name': 'Invalid role', Permissions: '999999' } })).status, 400);
  assert.equal((await mutate('user list', {
    operation: 'edit', form: 'customerAttributes', index: 0, expected: saved.rows['user list'][0],
    values: { 'Hide reports': 'yes', 'Hide cell phone number': 'yes', 'Hidden state': 'yes' },
  })).status, 204);
  const restricted = await (await call('client', '/state', clientCookie)).json() as State;
  assert.equal(restricted.settings['customer rights']['Hide reports'], 'yes');
  assert.match(String(restricted.rows['send record'][0]['mobile/extension']), /\*+0000$/);
  assert.equal(restricted.rows['send record'][0].status, undefined);
});
