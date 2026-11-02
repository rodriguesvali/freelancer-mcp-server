import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerSkillTools } from "./skills.js";
import { registerSpecialtyProfileTools } from "./specialty-profiles.js";

export function registerAccountTools(server: McpServer): void {
  registerSkillTools(server);
  registerSpecialtyProfileTools(server);
}
