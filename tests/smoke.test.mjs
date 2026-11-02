import assert from "node:assert/strict";
import { test } from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { apiGet, initApiClients } from "../dist/services/api.js";
import { mockHttp, httpError, timeoutError } from "./helpers/http.mjs";

test("real stdio server initializes, lists tools and returns only account labels", { timeout: 10000 }, async (t) => {
  const transport = new StdioClientTransport({
    command: process.execPath, args: ["dist/index.js"],
    env: { FREELANCER_OAUTH_TOKEN: "fake-smoke-token", FREELANCER_ACCOUNTS: "" },
    stderr: "pipe",
  });
  const client = new Client({ name: "smoke-client", version: "1.0.0" });
  t.after(() => client.close());
  await client.connect(transport);
  const { tools } = await client.listTools();
  assert.ok(tools.some(({ name }) => name === "freelancer_send_message"));
  assert.ok(tools.some(({ name }) => name === "freelancer_place_bid"));
  const result = await client.callTool({ name: "freelancer_list_accounts", arguments: {} });
  assert.deepEqual(result.structuredContent, { accounts: ["default"], default: "default" });
  assert.ok(!JSON.stringify(result).includes("fake-smoke-token"));
});

test("HTTP adapter simulates success with the configured timeout", async (t) => {
  const requests = mockHttp(t, () => ({ id: 123 }));
  initApiClients({ main: "fake-main-token" });
  assert.deepEqual(await apiGet("/users/0.1/self"), { id: 123 });
  assert.equal(requests[0].timeout, 15000);
});

for (const [name, failure, expected] of [
  ["HTTP error", httpError, /403.*Access denied/],
  ["timeout", timeoutError, /timeout of 15000ms exceeded/],
]) {
  test(`HTTP adapter simulates ${name}`, async (t) => {
    const requests = mockHttp(t, (config) => { throw failure(config); });
    initApiClients({ main: "fake-main-token" });
    await assert.rejects(apiGet("/users/0.1/self"), expected);
    assert.equal(requests.length, 1);
  });
}
