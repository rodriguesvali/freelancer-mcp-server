import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { apiGet, apiPost, apiPut, assertWriteAllowed } from "../services/api.js";
import { mcpError, truncate, ACCOUNT_DESC } from "../services/format.js";
import { CHARACTER_LIMIT } from "../constants.js";
import { skillList, resolveSkillIds } from "./skills.js";

export function registerSpecialtyProfileTools(server: McpServer): void {
  // ---- Specialty profiles: list ----
  server.registerTool(
    "freelancer_list_profiles",
    {
      title: "List Specialty Profiles",
      description: `Fetch one or more of your Freelancer.com "specialty profiles" by their numeric profile IDs.

Note: Freelancer's API has no endpoint that lists your profile IDs for you — you must already know the ID(s) (e.g. from the profile URL). This is a limitation of the public API, not this tool.

Args:
  - profile_ids (number[]): Numeric specialty-profile IDs to fetch.
  - account (string, optional): ${ACCOUNT_DESC}

Returns: profile details (name, tagline, hourly rate, description).

Use when: "Show specialty profile 12345"`,
      inputSchema: z.object({
        profile_ids: z.array(z.number().int().positive().safe()).min(1).max(100).describe("Numeric specialty-profile IDs"),
        account: z.string().optional().describe(ACCOUNT_DESC),
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ profile_ids, account }) => {
      try {
        const result = await apiGet<{ profiles: unknown[] }>("/users/0.1/profiles", {
          "ids[]": profile_ids,
        }, { account });
        const profiles = result.profiles || [];
        if (!profiles.length) {
          return { content: [{ type: "text", text: "No profiles found for those IDs." }] };
        }
        return {
          content: [{ type: "text", text: truncate(JSON.stringify(profiles, null, 2), CHARACTER_LIMIT) }],
          structuredContent: { profiles },
        };
      } catch (err) {
        return mcpError((err as Error).message);
      }
    }
  );

  // ---- Specialty profiles: create ----
  server.registerTool(
    "freelancer_create_profile",
    {
      title: "Create Specialty Profile",
      description: `Create a new Freelancer.com "specialty profile" (a focused sub-profile, separate from your main account profile).

All fields are required by the API.
Args:
  - profile_name (string): Internal name for the specialty profile
  - tagline (string): Short headline
  - hourly_rate (number): Hourly rate in USD
  - description (string): Profile description / bio
  - skills (string[], optional): Skill names or IDs for this profile
  - account (string, optional): ${ACCOUNT_DESC}

Returns: created profile (including its profile_id).

⚠️ Creates real data on your account. Freelancer caps the number of specialty profiles; some account types (e.g. certain corporate accounts) cannot create any and the API will reject with "reached the limit for creating new profiles".

Use when: "Create a specialty profile for AI automation"`,
      inputSchema: z.object({
        profile_name: z.string().trim().min(1).max(200).describe("Internal name for the specialty profile"),
        tagline: z.string().trim().min(1).max(500).describe("Short headline"),
        hourly_rate: z.number().positive().describe("Hourly rate in USD"),
        description: z.string().trim().min(1).max(10000).describe("Profile description / bio"),
        skills: skillList.optional().describe("Skill names or IDs"),
        account: z.string().optional().describe(ACCOUNT_DESC),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async ({ profile_name, tagline, hourly_rate, description, skills, account }) => {
      try {
        assertWriteAllowed(account);
        const body: Record<string, unknown> = { profile_name, tagline, hourly_rate, description };
        if (skills?.length) body.skill_ids = await resolveSkillIds(skills);
        const result = await apiPost<{ profile_id?: number }>("/users/0.1/profiles", body, { account });
        return {
          content: [{ type: "text", text: `✅ Specialty profile created${result?.profile_id ? ` (ID ${result.profile_id})` : ""}.` }],
          structuredContent: result,
        };
      } catch (err) {
        return mcpError((err as Error).message);
      }
    }
  );

  // ---- Specialty profiles: update ----
  server.registerTool(
    "freelancer_update_profile",
    {
      title: "Update Specialty Profile",
      description: `Update fields on one of your Freelancer.com "specialty profiles". Only the fields you supply are changed.

Important: this edits a SPECIALTY profile identified by profile_id — it does NOT edit your main account profile (description/tagline/hourly rate shown on your public freelancer page). Freelancer's public API exposes no endpoint to edit the main profile; that is web-UI-only.

Args:
  - profile_id (number): The specialty profile's numeric ID (you must already know it)
  - tagline (string, optional)
  - hourly_rate (number, optional): USD
  - description (string, optional)
  - skills (string[], optional): Non-empty skill names or IDs (replaces this profile's skills). Omit to leave them unchanged; clearing all skills is not supported.
  - account (string, optional): ${ACCOUNT_DESC}

Returns: confirmation.

⚠️ Modifies real data. The API enforces ownership: editing a profile_id you don't own is rejected.

Use when: "Update specialty profile 12345's hourly rate to 40"`,
      inputSchema: z.object({
        profile_id: z.number().int().positive().safe().describe("Specialty profile numeric ID"),
        tagline: z.string().max(500).optional().describe("Short headline"),
        hourly_rate: z.number().positive().optional().describe("Hourly rate in USD"),
        description: z.string().max(10000).optional().describe("Profile description"),
        skills: skillList.optional().describe("Skill names or IDs (replaces profile skills)"),
        account: z.string().optional().describe(ACCOUNT_DESC),
      }),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    },
    async ({ profile_id, tagline, hourly_rate, description, skills, account }) => {
      try {
        if (skills && skills.length === 0) return mcpError("Empty skills are not supported; omit skills to leave them unchanged.");
        assertWriteAllowed(account);
        const body: Record<string, unknown> = { profile_id };
        if (tagline !== undefined) body.tagline = tagline;
        if (hourly_rate !== undefined) body.hourly_rate = hourly_rate;
        if (description !== undefined) body.description = description;
        if (skills?.length) body.skill_ids = await resolveSkillIds(skills);
        if (Object.keys(body).length === 1) {
          return mcpError("Provide at least one field to update (tagline, hourly_rate, description or skills).");
        }
        const result = await apiPut<Record<string, unknown>>("/users/0.1/profiles", body, { account });
        return {
          content: [{ type: "text", text: `✅ Specialty profile ${profile_id} updated.` }],
          structuredContent: { profile_id, result },
        };
      } catch (err) {
        return mcpError((err as Error).message);
      }
    }
  );
}
