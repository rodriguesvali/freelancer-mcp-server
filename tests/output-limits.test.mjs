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
