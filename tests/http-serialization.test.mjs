import assert from 'node:assert/strict';
import {test} from 'node:test';
import {apiPost,apiPut,apiForm,initApiClients} from '../dist/services/api.js';
import {mockHttp} from './helpers/http.mjs';

test('HTTP writes preserve methods, account, content types and payload encoding', async t => {
  const requests=mockHttp(t, () => ({id:1,status:'active'}));
  initApiClients({main:'fake-main',client:'fake-client'});
  await apiPost('/messages/0.1/threads/1/messages',{message:'A & B', ids:[1,2], skip:null, missing:undefined},{form:true,account:'client'});
  await apiForm('delete','/users/0.1/self/jobs',{jobs:[1,2]},{note:'A & B'},{account:'client'});
  await apiPost('/projects/0.1/bids',{project_id:1},{account:'client'});
  await apiPut('/users/0.1/profiles',{profile_id:1},{account:'client'});
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

test('form serialization preserves repeated array and scalar keys', async t => {
  const requests=mockHttp(t, () => ({}));
  initApiClients({main:'fake-main'});
  await apiForm('post','/users/0.1/self/jobs',{jobs:[1,2]},{jobs:3});
  assert.equal(requests.length,1);
  assert.equal(requests[0].data,'jobs%5B%5D=1&jobs%5B%5D=2&jobs=3');
});

test('ambiguous write failures are not retried and warn to verify before retrying', async t => {
  const {timeoutError}=await import('./helpers/http.mjs');
  const requests=mockHttp(t,config=>{throw timeoutError(config);});
  initApiClients({main:'fake-main'});
  await assert.rejects(apiPost('/projects/0.1/bids',{project_id:1}), /may have completed.*before retrying/i);
  assert.equal(requests.length,1);
});

test('server errors on writes preserve the HTTP status and warn about uncertain outcome', async t => {
  const {AxiosError}=await import('axios');
  const requests=mockHttp(t,config=>{throw new AxiosError('secret response', 'ERR_BAD_RESPONSE', config, undefined, {status:503,statusText:'Unavailable',headers:{},config,data:{message:'fake-secret'}});});
  initApiClients({main:'fake-main'});
  await assert.rejects(apiPut('/users/0.1/profiles',{profile_id:1}), error=>{
    assert.match(error.message,/503.*may have completed.*before retrying/i);
    assert.doesNotMatch(error.message,/fake-secret|secret response/);
    return true;
  });
  assert.equal(requests.length,1);
});

test('malformed successful write responses warn that the operation may have completed', async t => {
  const {default:axios}=await import('axios');
  const previous=axios.defaults.adapter;
  t.after(()=>{axios.defaults.adapter=previous;});
  let count=0;
  axios.defaults.adapter=async config=>{count++;return {data:null,status:200,statusText:'OK',headers:{},config};};
  initApiClients({main:'fake-main'});
  await assert.rejects(apiPost('/projects/0.1/bids',{project_id:1}), /may have completed.*before retrying/i);
  assert.equal(count,1);
});

test('a failed read is not presented as an uncertain write', async t => {
  const {timeoutError}=await import('./helpers/http.mjs');
  const {apiGet}=await import('../dist/services/api.js');
  const requests=mockHttp(t,config=>{throw timeoutError(config);});
  initApiClients({main:'fake-main'});
  await assert.rejects(apiGet('/users/0.1/self'), error=>{
    assert.match(error.message,/request failed/i);
    assert.doesNotMatch(error.message,/may have completed/i);
    return true;
  });
  assert.equal(requests.length,1);
});
