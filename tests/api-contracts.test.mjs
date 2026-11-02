import assert from 'node:assert/strict';
import {test} from 'node:test';
import axios from 'axios';
import {initApiClients, apiGet} from '../dist/services/api.js';
import {resultSchema} from '../dist/schemas/responses.js';

const project = {id: 1, title:'Project', status:'active', type:'fixed'};
const cases = [
  ['get','/messages/0.1/threads',undefined,{threads:[{id:1}],total_count:1}],
  ['get','/messages/0.1/messages',undefined,{messages:[{id:1,from_user:2,message:'Hello'}],total_count:1}],
  ['get','/projects/0.1/jobs/',undefined,[{id:1,name:'Python'}]],
  ['get','/users/0.1/self',undefined,{id:1}],
  ['get','/users/0.1/users',undefined,{users:{'1':{id:1,username:'user',display_name:'User'}}}],
  ['get','/users/0.1/profiles',undefined,{profiles:[{profile_id:1}]}],
  ['get','/projects/0.1/projects/active',undefined,{projects:[project],total_count:1}],
  ['get','/projects/0.1/projects',{'ids[]':1},{projects:{'1':project}}],
  ['get','/projects/0.1/projects',{'owners[]':1},{projects:[project],total_count:1}],
  ['get','/projects/0.1/bids',undefined,{bids:[{id:1,amount:10,period:2,status:'active'}],total_count:1}],
  ['get','/projects/0.1/milestones',undefined,{milestones:[{id:1,amount:1,status:'created'}]}],
  ['post','/projects/0.1/bids',undefined,{id:1,status:'active'}],
  ['post','/messages/0.1/threads/1/messages',undefined,{id:1}],
  ['post','/users/0.1/profiles',undefined,{profile_id:1}],
  ['put','/users/0.1/profiles',undefined,{profile_id:1}],
  ['delete','/users/0.1/self/jobs',undefined,{}],
];
test('schemas cover every endpoint and reject malformed response types', () => {
  for (const [method,path,params,fixture] of cases) {
    const schema = resultSchema(method,path,params);
    assert.ok(schema, method + path);
    assert.equal(schema.safeParse(fixture).success, true, method + path);
    assert.equal(schema.safeParse('malformed').success, false, method + path);
  }
  assert.equal(resultSchema('get','/projects/0.1/projects',{'ids[]':1}).safeParse({projects: []}).success, true);
  assert.equal(resultSchema('get','/projects/0.1/projects',{'ids[]':1}).safeParse({projects: 42}).success, false);
  assert.equal(resultSchema('get','/messages/0.1/messages').safeParse({messages: [{id:1}],total_count:1}).success, false);
});

test('invalid envelopes and error details do not expose credentials', async t => {
  const previous = axios.defaults.adapter;
  t.after(() => {axios.defaults.adapter = previous;});
  let body;
  axios.defaults.adapter = async config => ({status:200,statusText:'OK',headers:{},config,data:body});
  initApiClients({main:'fake-secret-token'});
  for (body of [null, {}, {status:'success'}, {status:'success',result:{id:'wrong'}}, {status:'error',message:'fake-secret-token'}]) {
    await assert.rejects(apiGet('/users/0.1/self'), error => {
      assert.doesNotMatch(error.message, /fake-secret-token/);
      assert.match(error.message, /invalid|error/i);
      return true;
    });
  }
  body = {status:'success',result:{id:1,secret:'fake-secret-token'}};
  assert.deepEqual(await apiGet('/users/0.1/self'), {id:1});
});

test('MCP rejects malformed message content and strips unexpected fields', async t => {
  const {messageClient} = await import('./helpers/mcp.mjs');
  const {mockHttp} = await import('./helpers/http.mjs');
  let payload = {messages:[{id:1,from_user:2,message:42}],total_count:1};
  mockHttp(t, () => payload);
  const client = await messageClient(t);
  const invalid = await client.callTool({name:'freelancer_get_messages',arguments:{thread_id:1}});
  assert.equal(invalid.isError, true);
  assert.match(invalid.content[0].text, /invalid freelancer api response/i);
  payload = {messages:[{id:1,from_user:2,message:'Hello',secret:'fake-secret'}],total_count:1};
  const valid = await client.callTool({name:'freelancer_get_messages',arguments:{thread_id:1}});
  assert.notEqual(valid.isError, true);
  assert.equal(JSON.stringify(valid).includes('fake-secret'),false);
});

test('accepts response shapes demonstrated by Freelancer official SDK fixtures', () => {
  // Adapted from https://github.com/freelancer/freelancer-sdk-python/tree/17b8969d7480f3b9ea38d32e499e6c9bb3dd28b8/tests (synthetic, not live responses).
  const examples = [
    ['get','/messages/0.1/messages',undefined,{unfiltered_count:2,messages:[{thread_id:1,message:'Hello',id:1,attachments:[]}]}],
    ['get','/messages/0.1/threads',undefined,{threads:[{time_updated:1519826182,thread:{id:100,members:[102,103],context:{type:'project',id:101}}}]}],
    ['get','/projects/0.1/projects',{'ids[]':201},{total_count:3,projects:[{id:'201',title:'Example',description:'Project'}]}],
    ['get','/projects/0.1/milestones',undefined,{milestones:{'101':{status:'cleared',project_id:102,transaction_id:101}}}],
    ['get','/projects/0.1/bids',undefined,{bids:[{id:301,project_id:201,bidder_id:101}]}],
    ['post','/projects/0.1/bids',undefined,{id:39343812,project_id:1,bidder_id:2,description:'A bid',period:2,amount:10}],
  ];
  for (const [method,path,params,result] of examples) assert.equal(resultSchema(method,path,params).safeParse(result).success,true,`${method} ${path}`);
});

test('MCP tools handle SDK-style response variants without inventing totals', async t => {
  const {messageClient} = await import('./helpers/mcp.mjs');
  const {mockHttp} = await import('./helpers/http.mjs');
  mockHttp(t, config => {
    if (config.url === '/messages/0.1/messages') return {unfiltered_count:2,messages:[{id:1,thread_id:1,message:'Hello',attachments:[]}]};
    if (config.url === '/messages/0.1/threads') return {threads:[{thread:{id:100,members:[102]}}]};
    if (config.url === '/projects/0.1/projects') return {total_count:1,projects:[{id:'201',title:'Example'}]};
    if (config.url === '/projects/0.1/milestones') return {milestones:{'101':{status:'cleared',project_id:102,transaction_id:101}}};
    if (config.url === '/projects/0.1/bids') return {bids:[{id:301,project_id:201,bidder_id:101}]};
    throw Error('Unexpected simulated request');
  });
  const client = await messageClient(t);
  const operations = [
    ['freelancer_get_messages',{thread_id:1},/User unknown/],
    ['freelancer_list_threads',{},/Thread #100/],
    ['freelancer_get_project',{project_id:201},/Example/],
    ['freelancer_get_milestones',{project_id:102},/Milestone #101/],
    ['freelancer_get_project_bids',{project_id:201},/unknown total/],
  ];
  for (const [name,args,pattern] of operations) {
    const result=await client.callTool({name,arguments:args});
    assert.notEqual(result.isError,true,name+JSON.stringify(result));
    assert.match(result.content[0].text,pattern,name);
  }
});

test('SDK-style skill updates may succeed without a result body', async t => {
  const previous=axios.defaults.adapter;
  t.after(() => {axios.defaults.adapter=previous;});
  axios.defaults.adapter=async config => ({status:200,statusText:'OK',headers:{},config,data:{status:'success'}});
  initApiClients({main:'fake-token'});
  const {apiForm} = await import('../dist/services/api.js');
  assert.equal(await apiForm('post','/users/0.1/self/jobs',{jobs:[1]}),null);
});
