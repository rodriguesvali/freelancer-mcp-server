#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { initApiClients } from "./services/api.js";
import { BoundedToolTransport } from "./services/mcp-response.js";
import { registerProfileTools } from "./tools/profile.js";
import { registerProjectTools } from "./tools/projects.js";
import { registerBidTools } from "./tools/bids.js";
import { registerMilestoneTools } from "./tools/milestones.js";
import { registerMessageTools } from "./tools/messages.js";
import { registerSkillTools } from "./tools/skills.js";
import { registerSpecialtyProfileTools } from "./tools/specialty-profiles.js";
import { registerMetaTools } from "./tools/meta.js";

/**
 * Accounts can be configured two ways (either or both):
 *  - FREELANCER_OAUTH_TOKEN: a single token, registered under the label "default"
 *  - FREELANCER_ACCOUNTS: JSON object of label -> token for multiple profiles,
 *    e.g. {"main":"tok_abc","client_acme":"tok_def"}
 * This lets one server instance serve several Freelancer accounts; every tool
 * takes an optional `account` argument to pick which one to act as.
 */
function loadAccounts(): Record<string, string> {
  const accounts: Record<string, string> = Object.create(null);

  const single = process.env.FREELANCER_OAUTH_TOKEN;
  if (single) accounts.default = single;

  const multi = process.env.FREELANCER_ACCOUNTS;
  if (multi !== undefined && multi !== "") {
    try {
      const parsed = JSON.parse(multi);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error();
      for (const [label, token] of Object.entries(parsed)) {
        if (!label.trim() || typeof token !== "string" || !token.trim() || Object.hasOwn(accounts, label)) throw new Error();
        accounts[label] = token;
      }
    } catch {
      console.error(
        "Error: FREELANCER_ACCOUNTS must contain valid unique labels and nonempty tokens. Expected format: " +
          '{"label1":"token1","label2":"token2"}'
      );
      process.exit(1);
    }
  }

  return accounts;
}

if (process.env.FREELANCER_READ_ONLY !== undefined && !["true", "false"].includes(process.env.FREELANCER_READ_ONLY)) {
  console.error("Error: FREELANCER_READ_ONLY must be true or false.");
  process.exit(1);
}

const accounts = loadAccounts();

if (Object.keys(accounts).length === 0) {
  console.error(
    "Error: no Freelancer accounts configured.\n" +
      "Set FREELANCER_OAUTH_TOKEN for a single account, or FREELANCER_ACCOUNTS " +
      '(JSON, e.g. {"main":"token1","client2":"token2"}) for multiple.\n' +
      "Get a Personal Access Token from: https://accounts.freelancer.com/settings/develop"
  );
  process.exit(1);
}

initApiClients(accounts);

const server = new McpServer({
  name: "freelancer-mcp-server",
  version: "2.0.0",
});

// Register all tool domains
registerMetaTools(server);
registerProfileTools(server);
registerProjectTools(server);
registerBidTools(server);
registerMilestoneTools(server);
registerMessageTools(server);
registerSkillTools(server);
registerSpecialtyProfileTools(server);

async function main(): Promise<void> {
  const transport = new BoundedToolTransport(new StdioServerTransport());
  await server.connect(transport);
  console.error(
    `Freelancer MCP server running via stdio — ${Object.keys(accounts).length} account(s) configured: ${Object.keys(accounts).join(", ")}`
  );
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
