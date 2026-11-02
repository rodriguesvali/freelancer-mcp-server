import assert from 'node:assert/strict';
import {test} from 'node:test';
import {apiPost,apiPut,apiForm,initApiClients} from '../dist/services/api.js';
import {mockHttp} from './helpers/http.mjs';

test('HTTP writes preserve methods, account, content types and payload encoding', async t => {
  const requests=mockHttp(t, () => ({id:1,status:'active'}));
  initApiClients({main:'fake-main',client:'fake-client'});
  await apiPost('/messages/0.1/threads/1/messages',{message:'A & B', ids:[1,2], skip:null, missing:undefined},{form:true,account:'client'});
  await apiForm('delete','/users/0.1/self/jobs',{jobs:[1,2]},{note:'A & B'},'client');
  await apiPost('/projects/0.1/bids',{project_id:1},{account:'client'});
  await apiPut('/users/0.1/profiles',{profile_id:1},'client');
  assert.deepEqual(requests.map(r=>r.method),['post','delete','post','put']);
  assert.deepEqual(requests.map(r=>r.url),['/messages/0.1/threads/1/messages','/users/0.1/self/jobs','/projects/0.1/bids','/users/0.1/profiles']);
  assert.equal(requests[0].data,'message=A+%26+B&ids%5B%5D=1&ids%5B%5D=2');
  assert.equal(requests[1].data,'jobs%5B%5D=1&jobs%5B%5D=2&note=A+%26+B');
  assert.equal(requests[0].headers.get('Content-Type'),'application/x-www-form-urlencoded');
  assert.equal(requests[1].headers.get('Content-Type'),'application/x-www-form-urlencoded');
  assert.equal(requests[2].headers.get('Content-Type'),'application/json');
  assert.deepEqual(JSON.parse(requests[2].data),{project_id:1});
  assert.deepEqual(JSON.parse(requests[3].data),{profile_id:1});
  for(const request of requests) {assert.equal(request.timeout,15000); assert.equal(request.headers.get('freelancer-oauth-v1'),'fake-client');}
});
