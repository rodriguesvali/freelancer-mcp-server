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

test('an empty skills list never triggers lookup or writes, including mixed updates', async t => {
  const requests=mockHttp(t);
  const client=await messageClient(t,{first:'fake-first',second:'fake-second'});
  for (const args of [
    {profile_id:1,skills:[],account:'second'},
    {profile_id:1,skills:[],tagline:'New',hourly_rate:10,description:'New description',account:'second'},
    {profile_id:1,skills:[]},
  ]) {
    const result=await client.callTool({name:'freelancer_update_profile',arguments:args});
    assert.equal(result.isError,true);
    assert.match(result.content[0].text,/empty skills.*unverified/i);
  }
  assert.equal(requests.length,0);
});

test('profile updates preserve account, fields and destructive annotation', async t => {
  const requests=mockHttp(t,config=>config.url==='/projects/0.1/jobs/' ? [{id:1,name:'Python'}] : {id:1});
  const client=await messageClient(t,{first:'fake-first',second:'fake-second'});
  const tool=(await client.listTools()).tools.find(tool=>tool.name==='freelancer_update_profile');
  assert.equal(tool.annotations.destructiveHint,true);
  const missing=await client.callTool({name:'freelancer_update_profile',arguments:{profile_id:1,tagline:'Changed'}});
  assert.equal(missing.isError,true);
  assert.equal(requests.length,0);
  const result=await client.callTool({name:'freelancer_update_profile',arguments:{profile_id:1,tagline:'Changed',skills:[1],account:'second'}});
  assert.notEqual(result.isError,true);
  const writes=requests.filter(req=>req.method==='put');
  assert.equal(writes.length,1);
  assert.equal(writes[0].headers.get('freelancer-oauth-v1'),'fake-second');
  assert.deepEqual(JSON.parse(writes[0].data),{profile_id:1,tagline:'Changed',skill_ids:[1]});
});
