import { test } from 'node:test';
import assert from 'node:assert/strict';
import { messageClient } from './helpers/mcp.mjs';
import { mockHttp } from './helpers/http.mjs';

test('invalid skill and project arguments are rejected before HTTP', async t => {
  const requests = mockHttp(t);
  const client = await messageClient(t);
  for (const [name, args] of [
    ['freelancer_add_skills', {skills: [-1]}],
    ['freelancer_add_skills', {skills: ['  ']}],
    ['freelancer_add_skills', {skills: ['9007199254740992']}],
    ['freelancer_add_skills', {skills: Array(101).fill(1)}],
    ['freelancer_list_profiles', {profile_ids: [9007199254740992]}],
    ['freelancer_search_projects', {min_budget: -1}],
    ['freelancer_search_projects', {min_budget: 20, max_budget: 10}],
    ['freelancer_search_projects', {query: 'x'.repeat(501)}],
    ['freelancer_get_project', {project_id: 9007199254740992}],
    ['freelancer_get_messages', {thread_id: '1'.repeat(2049)}],
  ]) {
    const result = await client.callTool({name, arguments: args});
    assert.equal(result.isError, true, name + JSON.stringify(args).slice(0, 100));
  }
  assert.equal(requests.length, 0);
});

test('valid limits, skill trimming, deduplication and ambiguous names', async t => {
  const requests = mockHttp(t, config => {
    if (config.url === '/projects/0.1/jobs/') return [{id: 10, name: 'Python'}, {id: 11, name: 'Python Testing'}];
    if (config.url === '/projects/0.1/projects/active') return {projects: [], total_count: 0};
    return {};
  });
  const client = await messageClient(t);
  const list = await client.listTools();
  assert.ok(list.tools.some(tool => tool.name === 'freelancer_add_skills'));
  const search = await client.callTool({name: 'freelancer_search_projects', arguments: {query: 'x'.repeat(500), min_budget: 0, max_budget: 0}});
  assert.notEqual(search.isError, true);
  const add = await client.callTool({name: 'freelancer_add_skills', arguments: {skills: [' Python ', 10, '10']}});
  assert.notEqual(add.isError, true);
  assert.deepEqual(add.structuredContent.added, [10]);
  const writes = requests.filter(r => r.url === '/users/0.1/self/jobs');
  assert.equal(writes.length, 1);
  assert.equal(writes[0].data, 'jobs%5B%5D=10');
  const ambiguous = await client.callTool({name: 'freelancer_add_skills', arguments: {skills: ['Pyth']}});
  assert.equal(ambiguous.isError, true);
  assert.match(ambiguous.content[0].text, /could not resolve/i);
  assert.equal(requests.filter(r => r.url === '/users/0.1/self/jobs').length, 1);
});
