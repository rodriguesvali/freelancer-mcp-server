import assert from 'node:assert/strict';
import {test} from 'node:test';
import {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {InMemoryTransport} from '@modelcontextprotocol/sdk/inMemory.js';
import {z} from 'zod';
import {BoundedToolTransport, limitToolResult, MAX_TOOL_RESULT_BYTES} from '../dist/services/mcp-response.js';
const bytes = o => Buffer.byteLength(JSON.stringify(o));

test('oversized results include omission counts and stay within the byte budget', () => {
  const original = {content:[{type:'text',text:'😀"\\'.repeat(20000)}],structuredContent:{messages:Array(500).fill({text:'é'.repeat(1000)})}};
  const result = limitToolResult(original);
  assert.ok(bytes(result) <= MAX_TOOL_RESULT_BYTES);
  assert.equal(result.structuredContent.truncated,true);
  assert.deepEqual(result.structuredContent.omitted_items,[{field:'messages',count:500}]);
  assert.match(result.content[0].text,/same offset/);
  assert.doesNotMatch(result.content[0].text, /\uFFFD/);
  assert.deepEqual(JSON.parse(JSON.stringify(result)),result);
  const small = {content:[{type:'text',text:'ok'}],structuredContent:{messages:[]}};
  assert.equal(limitToolResult(small),small);
  assert.equal(limitToolResult({...original,isError:true}).isError,true);
});

test('MCP transport bounds structured output and leaves other responses intact', async t => {
  const server = new McpServer({name:'test',version:'1'});
  server.registerTool('large', {inputSchema:z.object({})}, async () => ({content:[{type:'text',text:'Summary'}],structuredContent:{messages:['😃'.repeat(20000)]}}));
  const client = new Client({name:'test',version:'1'});
  const [ct,st] = InMemoryTransport.createLinkedPair();
  t.after(async () => {await client.close(); await server.close();});
  await server.connect(new BoundedToolTransport(st));
  await client.connect(ct);
  assert.ok((await client.listTools()).tools.some(tool => tool.name === 'large'));
  const result = await client.callTool({name:'large',arguments:{}});
  assert.ok(bytes(result) <= MAX_TOOL_RESULT_BYTES);
  assert.equal(result.structuredContent.truncated,true);
  assert.match(result.content[0].text,/structured content/);
});

test('real message tool reports a usable retry when its page exceeds the limit', async t => {
  const {initApiClients} = await import('../dist/services/api.js');
  const {registerMessageTools} = await import('../dist/tools/messages.js');
  const {mockHttp} = await import('./helpers/http.mjs');
  const requests = mockHttp(t, config => {
    const {limit, offset} = config.params;
    return {total_count:100, messages:Array.from({length:limit},(_,index)=>({id:offset+index+1,from_user:1,message:'😀'.repeat(300)}))};
  });
  initApiClients({main:'fake-token'});
  const server = new McpServer({name:'test',version:'1'});
  registerMessageTools(server);
  const client = new Client({name:'test',version:'1'});
  const [ct,st] = InMemoryTransport.createLinkedPair();
  t.after(async()=>{await client.close();await server.close();});
  await server.connect(new BoundedToolTransport(st)); await client.connect(ct);
  const result = await client.callTool({name:'freelancer_get_messages',arguments:{thread_id:1,limit:50,offset:10}});
  assert.ok(bytes(result) <= MAX_TOOL_RESULT_BYTES);
  assert.equal(result.structuredContent.truncated,true);
  assert.deepEqual(result.structuredContent.retry,{limit:25,offset:10});
  assert.deepEqual(result.structuredContent.omitted_items,[{field:'messages',count:50}]);
  const again = await client.callTool({name:'freelancer_get_messages',arguments:{thread_id:1,limit:result.structuredContent.retry.limit,offset:result.structuredContent.retry.offset}});
  assert.ok(bytes(again) <= MAX_TOOL_RESULT_BYTES);
  assert.equal(requests[1].params.offset,10);
});

test('single-item oversized response does not suggest impossible pagination', () => {
  const result=limitToolResult({content:[{type:'text',text:'a'.repeat(50000)}]}, {limit:1,offset:2});
  assert.ok(bytes(result)<=MAX_TOOL_RESULT_BYTES);
  assert.equal(result.structuredContent.retry,undefined);
  assert.match(result.content[0].text,/single|smaller|query/i);
  assert.doesNotMatch(result.content[0].text,/structured content.*omitted/i);
});

test('parallel paginated calls retain their own retry context', async t => {
  const server = new McpServer({name:'test',version:'1'});
  server.registerTool('freelancer_get_messages', {inputSchema:z.object({limit:z.number(),offset:z.number()})}, async ({offset}) => {
    if (offset === 8) await new Promise(resolve => setTimeout(resolve, 20));
    return {content:[{type:'text',text:'large'}],structuredContent:{messages:['x'.repeat(40000)]}};
  });
  const client = new Client({name:'test',version:'1'});
  const [ct,st] = InMemoryTransport.createLinkedPair();
  t.after(async()=>{await client.close();await server.close();});
  await server.connect(new BoundedToolTransport(st)); await client.connect(ct);
  const [first,second] = await Promise.all([
    client.callTool({name:'freelancer_get_messages',arguments:{limit:40,offset:8}}),
    client.callTool({name:'freelancer_get_messages',arguments:{limit:20,offset:30}}),
  ]);
  assert.deepEqual(first.structuredContent.retry,{limit:20,offset:8});
  assert.deepEqual(second.structuredContent.retry,{limit:10,offset:30});
  assert.ok(bytes(first)<=MAX_TOOL_RESULT_BYTES);
  assert.ok(bytes(second)<=MAX_TOOL_RESULT_BYTES);
});

test('escaped metadata field names cannot exceed the budget', () => {
  const structuredContent={};
  for(let i=0;i<20;i++) structuredContent['\u0001'.repeat(127)+String.fromCharCode(65+i)]=['x'];
  const result=limitToolResult({content:[{type:'text',text:'x'.repeat(100000)}],structuredContent});
  assert.ok(bytes(result)<=MAX_TOOL_RESULT_BYTES);
});
