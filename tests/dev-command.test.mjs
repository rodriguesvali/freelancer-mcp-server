import assert from 'node:assert/strict';
import {test} from 'node:test';
import {spawnSync} from 'node:child_process';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';

const cleanEnv = {...process.env};
delete cleanEnv.FREELANCER_OAUTH_TOKEN;
delete cleanEnv.FREELANCER_ACCOUNTS;
delete cleanEnv.FREELANCER_READ_ONLY;

test('development command reports missing credentials', {timeout:30000}, () => {
  const child=spawnSync('npm',['run','dev'],{env:cleanEnv,encoding:'utf8',timeout:25000});
  assert.equal(child.status,1);
  assert.match(child.stderr,/no Freelancer accounts configured/i);
  assert.doesNotMatch(child.stderr,/ts-node|not found|unknown file extension/i);
});

test('development command starts an MCP server with a dummy token', {timeout:30000}, async t => {
  const transport=new StdioClientTransport({command:'npm',args:['run','--silent','dev'],env:{...cleanEnv,FREELANCER_OAUTH_TOKEN:'fake-dev-token'},stderr:'pipe'});
  const client=new Client({name:'dev-test',version:'1'});
  t.after(()=>client.close());
  await client.connect(transport);
  assert.ok((await client.listTools()).tools.some(tool=>tool.name==='freelancer_list_accounts'));
  const result=await client.callTool({name:'freelancer_list_accounts',arguments:{}});
  assert.deepEqual(result.structuredContent.accounts,['default']);
});
