import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {test} from 'node:test';
import {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {InMemoryTransport} from '@modelcontextprotocol/sdk/inMemory.js';
import {registerAccountTools} from '../dist/tools/account.js';

test('account tool definitions remain unchanged',async t => {
  const server=new McpServer({name:'test',version:'1'}); registerAccountTools(server);
  const client=new Client({name:'test',version:'1'}); const [ct,st]=InMemoryTransport.createLinkedPair();
  t.after(async()=>{await client.close();await server.close();});
  await server.connect(st); await client.connect(ct);
  const value=await client.listTools();
  assert.equal(createHash('sha256').update(JSON.stringify(value.tools)).digest('hex'),'fbe1ce83d72f9de7643519df37470b0c383b8672b82d35059fc013432eb2b4dc');
});
