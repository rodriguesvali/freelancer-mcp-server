import axios, { AxiosInstance } from "axios";
import { FREELANCER_API_BASE } from "../constants.js";
import { resultSchema, getSchemas, postSchemas, putSchemas, sentMessageSchema, skillWriteSchema } from "../schemas/responses.js";
import type { z } from "zod";

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
  if (!("result" in data) || data.result === undefined) {
    if (path === "/users/0.1/self/jobs" && ["post", "put", "delete"].includes(method)) return null as T;
    throw new Error(method === "get" ? "Invalid Freelancer API response." : "Invalid Freelancer API response after a write; the operation may have completed. Check its status before retrying.");
  }
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

type RequestOptions = {
  method: "get" | "post" | "put" | "delete";
  path: string;
  account?: string;
  params?: Record<string, unknown>;
  data?: Record<string, unknown>;
  form?: boolean;
  formExtra?: Record<string, unknown>;
};

function serializeForm(...fields: Record<string, unknown>[]): string {
  const body = new URLSearchParams();
  for (const [key, value] of fields.flatMap(Object.entries)) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      for (const item of value) body.append(`${key}[]`, String(item));
    } else body.append(key, String(value));
  }
  return body.toString();
}

async function request<T>({ method, path, account, params, data, form, formExtra }: RequestOptions): Promise<T> {
  const client = getApiClient(account, method !== "get");
  try {
    const response = await client.request<unknown>({
      method,
      url: path,
      params,
      data: form && data ? serializeForm(data, formExtra ?? {}) : data,
      ...(form && data ? { headers: { "Content-Type": "application/x-www-form-urlencoded" } } : {}),
    });
    return unwrap(response.data, method, path, params);
  } catch (error) {
    throw toApiError(error);
  }
}

type AccountOptions = { account?: string };

type GetPath = keyof typeof getSchemas;
type PostPath = keyof typeof postSchemas | `/messages/0.1/threads/${number}/messages`;
type PostResult<P extends PostPath> = P extends keyof typeof postSchemas
  ? z.output<(typeof postSchemas)[P]>
  : z.output<typeof sentMessageSchema>;

export function apiGet<P extends GetPath>(path: P, params?: Record<string, unknown>, opts?: AccountOptions): Promise<z.output<(typeof getSchemas)[P]>> {
  return request({ method: "get", path, params, ...opts });
}

export function apiPost<P extends PostPath>(path: P, data?: Record<string, unknown>, opts?: { form?: boolean; account?: string }): Promise<PostResult<P>> {
  return request({ method: "post", path, data, ...opts });
}

export function apiPut<P extends keyof typeof putSchemas>(path: P, data?: Record<string, unknown>, opts?: AccountOptions): Promise<z.output<(typeof putSchemas)[P]>> {
  return request({ method: "put", path, data, ...opts });
}

/** Serialize array fields as repeated keys (jobs[]=1&jobs[]=2). */
export function apiForm(
  method: "post" | "put" | "delete",
  path: "/users/0.1/self/jobs",
  arrayParams: Record<string, Array<string | number>> = {},
  scalarParams: Record<string, string | number> = {},
  opts?: AccountOptions
): Promise<z.output<typeof skillWriteSchema>> {
  return request({ method, path, data: arrayParams, formExtra: scalarParams, form: true, ...opts });
}
