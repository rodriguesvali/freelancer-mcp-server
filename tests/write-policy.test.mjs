import assert from 'node:assert/strict';
import { test } from 'node:test';
import { messageClient } from './helpers/mcp.mjs';
import { mockHttp } from './helpers/http.mjs';

test('read-only mode prevents every mutation before HTTP and allows reads', async t => {
  process.env.FREELANCER_READ_ONLY = 'true';
  t.after(() => { delete process.env.FREELANCER_READ_ONLY; });
  const requests = mockHttp(t, () => ({projects: [], total_count: 0}));
  const client = await messageClient(t);
  const writes = [
    ['freelancer_send_message', {thread_id: 1, message: 'Hello'}],
    ['freelancer_place_bid', {project_id: 1, amount: 10, period: 2, description: 'A valid proposal'}],
    ...['add','remove','set'].map(op => ['freelancer_' + op + '_skills', {skills: ['Python']}]),
    ['freelancer_create_profile', {profile_name:'P', tagline:'T', hourly_rate:1, description:'D', skills:['Python']}],
    ['freelancer_update_profile', {profile_id:1, skills:['Python']}],
  ];
  for (const [name, args] of writes) {
    const response = await client.callTool({name, arguments: args});
    assert.equal(response.isError, true, name);
    assert.match(response.content[0].text, /read.only/i);
  }
  assert.equal(requests.length, 0);
  const read = await client.callTool({name:'freelancer_search_projects', arguments:{}});
  assert.notEqual(read.isError, true);
  assert.equal(requests.length, 1);
});

test('write-enabled mode requires the selected account before skill lookup', async t => {
  const requests = mockHttp(t, config => config.url === '/projects/0.1/jobs/' ? [{id:1,name:'Python'}] : {});
  const client = await messageClient(t, {main:'fake-main', client:'fake-client'});
  const missing = await client.callTool({name:'freelancer_add_skills', arguments:{skills:['Python']}});
  assert.equal(missing.isError, true);
  assert.equal(requests.length, 0);
  const result = await client.callTool({name:'freelancer_add_skills', arguments:{skills:['Python'], account:'client'}});
  assert.notEqual(result.isError, true);
  assert.equal(requests.at(-1).headers.get('freelancer-oauth-v1'), 'fake-client');
});
