import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { initApiClients } from "../../dist/services/api.js";
import { registerSkillTools } from "../../dist/tools/skills.js";
import { registerSpecialtyProfileTools } from "../../dist/tools/specialty-profiles.js";
import { registerProjectTools } from "../../dist/tools/projects.js";
import { registerMilestoneTools } from "../../dist/tools/milestones.js";
import { registerBidTools } from "../../dist/tools/bids.js";
import { registerMessageTools } from "../../dist/tools/messages.js";

export async function messageClient(t, accounts = { main: "fake-main-token" }) {
  initApiClients(accounts);
  const server = new McpServer({ name: "test-server", version: "1.0.0" });
  registerMessageTools(server);
  registerSkillTools(server);
  registerSpecialtyProfileTools(server);
  registerProjectTools(server);
  registerBidTools(server);
  registerMilestoneTools(server);
  const client = new Client({ name: "test-client", version: "1.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  t.after(async () => { await client.close(); await server.close(); });
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  return client;
}
