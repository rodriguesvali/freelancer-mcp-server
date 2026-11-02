import assert from 'node:assert/strict';
import {test} from 'node:test';
import {mockHttp} from './helpers/http.mjs';
import {messageClient} from './helpers/mcp.mjs';

test('empty skills are rejected without suppressing other updates', async t => {
  const requests = mockHttp(t, config => config.url === '/projects/0.1/jobs/' ? [{id:1,name:'Python'}] : {profile_id:1});
  const client = await messageClient(t);
  const empty = await client.callTool({name:'freelancer_update_profile',arguments:{profile_id:1,tagline:'New',skills:[]}});
  assert.equal(empty.isError,true);
  assert.match(empty.content[0].text,/empty|at least one/i);
  assert.equal(requests.length,0);
  const omitted = await client.callTool({name:'freelancer_update_profile',arguments:{profile_id:1,tagline:'New'}});
  assert.notEqual(omitted.isError,true);
  assert.equal(JSON.parse(requests.at(-1).data).skill_ids,undefined);
  const filled = await client.callTool({name:'freelancer_update_profile',arguments:{profile_id:1,skills:['Python']}});
  assert.notEqual(filled.isError,true);
  assert.deepEqual(JSON.parse(requests.at(-1).data).skill_ids,[1]);
});
