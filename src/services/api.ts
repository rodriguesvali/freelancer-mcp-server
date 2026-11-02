import axios, { AxiosInstance } from "axios";
import { FREELANCER_API_BASE } from "../constants.js";
import { resultSchema } from "../schemas/responses.js";

const clients: Map<string, AxiosInstance> = new Map();
let defaultAccount: string | null = null;

/**
 * Initialize one Freelancer API client per configured account. Each account
 * is just a label -> OAuth token pair; no token ever touches disk except in
 * the caller's own MCP client config.
 */
export function initApiClients(accounts: Record<string, string>): void {
  clients.clear();
  defaultAccount = null;
  for (const [label, token] of Object.entries(accounts)) {
    if (!token) continue;
    clients.set(label, axios.create({
      baseURL: FREELANCER_API_BASE,
      headers: {
        "freelancer-oauth-v1": token,
        "Content-Type": "application/json",
      },
      timeout: 15000,
    }));
    if (!defaultAccount) defaultAccount = label;
  }
}

export function listAccounts(): string[] {
  return Array.from(clients.keys());
}

export function assertWritesEnabled(): void {
  const mode = process.env.FREELANCER_READ_ONLY;
  if (mode !== undefined && mode !== "true" && mode !== "false") {
    throw new Error("FREELANCER_READ_ONLY must be true or false.");
  }
  if (mode === "true") throw new Error("Server is in read-only mode.");
}

function getApiClient(account?: string, write = false): AxiosInstance {
  if (write) assertWritesEnabled();
  if (write && clients.size > 1 && !account?.trim()) {
    throw new Error("An explicit account is required for write operations when multiple accounts are configured.");
  }
  const label = account === undefined ? defaultAccount : account;
  if (!label) {
    throw new Error(
      "No Freelancer accounts configured. Set FREELANCER_OAUTH_TOKEN (single account) or " +
        "FREELANCER_ACCOUNTS (multiple, e.g. '{\"main\":\"token1\",\"client2\":\"token2\"}') in your MCP config."
    );
  }
  const client = clients.get(label);
  if (!client) {
    throw new Error(
      `Unknown account "${label}". Configured accounts: ${listAccounts().join(", ") || "none"}. ` +
        `Use freelancer_list_accounts to see what's available.`
    );
  }
  return client;
}

export function assertWriteAllowed(account?: string): void {
  getApiClient(account, true);
}

function unwrap<T>(data: unknown, method: string, path: string, params?: Record<string, unknown>): T {
  if (!data || typeof data !== "object" || !("status" in data) || typeof data.status !== "string") {
    throw new Error("Invalid Freelancer API response.");
  }
  if (data.status !== "success") throw new Error("Freelancer API returned an error.");
  if (!("result" in data) || data.result === undefined) throw new Error("Invalid Freelancer API response.");
  const schema = resultSchema(method, path, params);
  if (!schema) throw new Error("Unsupported Freelancer API response.");
  const result = schema.safeParse(data.result);
  if (!result.success) throw new Error(method === "get" ? "Invalid Freelancer API response." : "Invalid Freelancer API response after a write; the operation may have completed. Check its status before retrying.");
  return result.data as T;
}

function toApiError(error: unknown): Error {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    return new Error(status ? `Freelancer API request failed (${status}).` : "Freelancer API request failed.");
  }
  return error instanceof Error ? error : new Error("Freelancer API request failed.");
}

export async function apiGet<T>(
  path: string,
  params?: Record<string, unknown>,
  account?: string
): Promise<T> {
  const client = getApiClient(account);
  try {
    const response = await client.get<unknown>(path, { params });
    return unwrap(response.data, "get", path, params);
  } catch (error) {
    throw toApiError(error);
  }
}

export async function apiPost<T>(
  path: string,
  data?: Record<string, unknown>,
  opts?: { form?: boolean; account?: string }
): Promise<T> {
  const client = getApiClient(opts?.account, true);
  try {
    // The Freelancer API expects application/x-www-form-urlencoded for most
    // write endpoints; JSON bodies are silently ignored or rejected.
    let body: unknown = data;
    let config;
    if (opts?.form && data) {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(data)) {
        if (value === undefined || value === null) continue;
        if (Array.isArray(value)) {
          for (const v of value) params.append(`${key}[]`, String(v));
        } else {
          params.append(key, String(value));
        }
      }
      body = params.toString();
      config = { headers: { "Content-Type": "application/x-www-form-urlencoded" } };
    }
    const response = await client.post<unknown>(path, body, config);
    return unwrap(response.data, "post", path);
  } catch (error) {
    throw toApiError(error);
  }
}

export async function apiPut<T>(
  path: string,
  data?: Record<string, unknown>,
  account?: string
): Promise<T> {
  const client = getApiClient(account, true);
  try {
    const response = await client.put<unknown>(path, data);
    return unwrap(response.data, "put", path);
  } catch (error) {
    throw toApiError(error);
  }
}

/**
 * Some Freelancer write endpoints (notably /users/0.1/self/jobs) reject JSON and
 * require application/x-www-form-urlencoded with repeated array keys (jobs[]=1&jobs[]=2).
 * `arrayParams` maps a field name to a list of values serialized that way.
 */
export async function apiForm<T>(
  method: "post" | "put" | "delete",
  path: string,
  arrayParams: Record<string, Array<string | number>> = {},
  scalarParams: Record<string, string | number> = {},
  account?: string
): Promise<T> {
  const client = getApiClient(account, true);
  const body = new URLSearchParams();
  for (const [key, values] of Object.entries(arrayParams)) {
    for (const v of values) body.append(`${key}[]`, String(v));
  }
  for (const [key, value] of Object.entries(scalarParams)) {
    body.append(key, String(value));
  }
  try {
    const response = await client.request<unknown>({
      method,
      url: path,
      data: body.toString(),
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
    return unwrap(response.data, method, path);
  } catch (error) {
    throw toApiError(error);
  }
}

export function truncate(text: string, limit: number): string {
  if (text.length <= limit) return text;
  return text.slice(0, limit) + `\n\n[Truncated — ${text.length - limit} characters omitted]`;
}

export function formatDate(unix?: number): string {
  if (!unix) return "unknown";
  return new Date(unix * 1000).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function mcpError(message: string): {
  content: Array<{ type: "text"; text: string }>;
  isError: true;
} {
  return {
    content: [{ type: "text", text: `Error: ${message}` }],
    isError: true,
  };
}

/**
 * Accept either a raw numeric thread ID or a Freelancer chat URL
 * (e.g. https://www.freelancer.com/messages/thread/123456) and return the ID.
 */
export function resolveThreadId(input: string | number): number {
  let id: number;
  if (typeof input === "number") {
    id = input;
  } else if (/^\d+$/.test(input.trim())) {
    id = Number(input.trim());
  } else {
    try {
      const url = new URL(input.trim());
      const match = /^\/messages\/thread\/(\d+)\/?$/.exec(url.pathname);
      if (url.protocol !== "https:" || !["freelancer.com", "www.freelancer.com"].includes(url.hostname) || url.port || url.username || url.password || !match) throw new Error();
      id = Number(match[1]);
    } catch {
      throw new Error("Invalid thread ID or Freelancer chat URL.");
    }
  }
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error("Thread ID must be a positive safe integer.");
  return id;
}

/** Shared account selector schema description, reused across tool inputs. */
export const ACCOUNT_DESC =
  "Which configured Freelancer account to use (see freelancer_list_accounts for labels). Required for writes when multiple accounts are configured; otherwise defaults to the first account.";
