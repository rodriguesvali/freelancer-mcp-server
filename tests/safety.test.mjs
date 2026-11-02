import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spawnSync } from 'node:child_process';
import { resolveThreadId, initApiClients, apiGet, apiPost, apiPut, apiForm } from '../dist/services/api.js';
import { mockHttp } from './helpers/http.mjs';
import { messageClient } from './helpers/mcp.mjs';

test('thread IDs are extracted only from supported URLs and safe positive integers', () => {
  for (const input of ['123', 123, 'https://www.freelancer.com/messages/thread/123?page=2#section', 'https://freelancer.com/messages/thread/123?project=456']) assert.equal(resolveThreadId(input), 123);
  for (const input of ['0', '-1', '9007199254740992', Infinity, 'https://example.org/messages/thread/123', 'https://freelancer.com.evil.org/messages/thread/123', 'https://www.freelancer.com/other/123']) assert.throws(() => resolveThreadId(input));
});

test('MCP messages target the intended thread and reject invalid links before HTTP', async t => {
  const requests = mockHttp(t, () => ({ id: 42, time_created: 1 }));
  const client = await messageClient(t);
  const result = await client.callTool({ name: 'freelancer_send_message', arguments: { thread_id: 'https://www.freelancer.com/messages/thread/123?page=2', message: 'Hello' } });
  assert.notEqual(result.isError, true);
  assert.equal(requests[0].url, '/messages/0.1/threads/123/messages');
  const rejected = await client.callTool({ name: 'freelancer_send_message', arguments: { thread_id: 'https://example.org/123', message: 'Hello' } });
  assert.equal(rejected.isError, true);
  assert.equal(requests.length, 1);
});

test('MCP reading uses the thread path rather than query parameters', async t => {
  const requests = mockHttp(t, () => ({ messages: [], total_count: 0 }));
  const client = await messageClient(t);
  const result = await client.callTool({ name: 'freelancer_get_messages', arguments: { thread_id: 'https://www.freelancer.com/messages/thread/123?project=456' } });
  assert.notEqual(result.isError, true);
  assert.equal(requests[0].params['threads[]'], 123);
  const rejected = await client.callTool({ name: 'freelancer_get_messages', arguments: { thread_id: 'https://example.org/123' } });
  assert.equal(rejected.isError, true);
  assert.equal(requests.length, 1);
});

test('writes require explicit account only when multiple accounts exist', async t => {
  const requests = mockHttp(t);
  initApiClients({ main: 'fake-main', client: 'fake-client' });
  for (const write of [() => apiPost('/test'), () => apiPost('/test', {}, { account: '' }), () => apiPut('/test'), () => apiForm('delete', '/test')]) await assert.rejects(write(), /account/i);
  assert.equal(requests.length, 0);
  await apiGet('/test');
  await apiPost('/test', {}, { account: 'client' });
  assert.equal(requests[0].headers.get('freelancer-oauth-v1'), 'fake-main');
  assert.equal(requests[1].headers.get('freelancer-oauth-v1'), 'fake-client');
  await assert.rejects(apiPost('/test', {}, { account: 'missing' }), /unknown account/i);
  initApiClients({ main: 'fake-main' });
  await apiPost('/test');
  assert.equal(requests[2].headers.get('freelancer-oauth-v1'), 'fake-main');
});

test('invalid multi-account configuration fails closed even with a single token', () => {
  for (const input of ['not-json', '[]', 'null', '{"client":42}', '{"client":""}', '{"":"token"}']) {
    const child = spawnSync(process.execPath, ['dist/index.js'], { env: { FREELANCER_OAUTH_TOKEN: 'fake-main', FREELANCER_ACCOUNTS: input }, encoding: 'utf8', timeout: 3000 });
    assert.equal(child.status, 1, input);
    assert.match(child.stderr, /FREELANCER_ACCOUNTS/);
    assert.ok(!child.stderr.includes('fake-main'));
  }
});
