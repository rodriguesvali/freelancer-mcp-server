import type { Transport, TransportSendOptions } from "@modelcontextprotocol/sdk/shared/transport.js";
import type { JSONRPCMessage, MessageExtraInfo, RequestId } from "@modelcontextprotocol/sdk/types.js";
import { DEFAULT_LIMIT } from "../constants.js";

// Byte limit applies to the serialized MCP result, including content and structuredContent.
export const MAX_TOOL_RESULT_BYTES = 32768;
const size = (value: unknown): number => Buffer.byteLength(JSON.stringify(value), "utf8");

type Pagination = { limit: number; offset: number };

export function limitToolResult(result: Record<string, unknown>, pagination?: Pagination): Record<string, unknown> {
  if (size(result) <= MAX_TOOL_RESULT_BYTES) return result;
  const structured = result.structuredContent;
  const fields = structured && typeof structured === "object" && !Array.isArray(structured)
    ? Object.keys(structured).slice(0, 20).map(key => key.slice(0, 128)) : [];
  const omittedItems = structured && typeof structured === "object" && !Array.isArray(structured)
    ? Object.entries(structured).filter(([, value]) => Array.isArray(value)).slice(0, 20)
      .map(([field, value]) => ({ field: field.slice(0, 128), count: (value as unknown[]).length })) : [];
  const text = Array.isArray(result.content)
    ? result.content.filter((block): block is { type: string; text: string } =>
        !!block && typeof block === "object" && block.type === "text" && typeof block.text === "string")
      .map(block => block.text).join("\n") : "";
  const retry = pagination && pagination.limit > 1
    ? { limit: Math.floor(pagination.limit / 2), offset: pagination.offset }
    : undefined;
  const omitted = structured === undefined ? "text or other content omitted" : "structured content and possibly text omitted";
  const advice = retry
    ? `Repeat with limit ${retry.limit} and the same offset ${retry.offset}.`
    : pagination?.limit === 1
      ? "A single item may be too large; use a more targeted query if available."
      : "For paginated tools, repeat with a smaller limit and the same offset.";
  const note = `[Response truncated: ${omitted}. ${advice}]`;
  const output = (prefix: string): Record<string, unknown> => ({
    content: [{ type: "text", text: prefix ? `${prefix}\n\n${note}` : note }],
    structuredContent: { truncated: true, omitted_structured_fields: fields, omitted_items: omittedItems, ...(retry ? { retry } : {}) },
    ...(result.isError === true ? { isError: true } : {}),
  });
  // Binary search over Unicode code points keeps surrogate pairs intact and accounts for JSON escaping.
  const points = Array.from(text);
  let low = 0;
  let high = points.length;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    if (size(output(points.slice(0, mid).join(""))) <= MAX_TOOL_RESULT_BYTES) low = mid;
    else high = mid - 1;
  }
  return output(points.slice(0, low).join(""));
}

const pageDefaults: Readonly<Record<string, number>> = {
  freelancer_search_projects: DEFAULT_LIMIT,
  freelancer_my_projects: DEFAULT_LIMIT,
  freelancer_get_project_bids: DEFAULT_LIMIT,
  freelancer_my_bids: DEFAULT_LIMIT,
  freelancer_list_threads: DEFAULT_LIMIT,
  freelancer_get_messages: 20,
};

/** Applies the cap to tools/call responses, including errors produced by the SDK. */
export class BoundedToolTransport implements Transport {
  onclose?: () => void;
  onerror?: (error: Error) => void;
  onmessage?: <T extends JSONRPCMessage>(message: T, extra?: MessageExtraInfo) => void;
  private readonly calls = new Map<RequestId, Pagination | undefined>();
  constructor(private readonly inner: Transport) {}
  get sessionId(): string | undefined { return this.inner.sessionId; }
  setProtocolVersion(version: string): void { this.inner.setProtocolVersion?.(version); }
  async start(): Promise<void> {
    this.inner.onclose = () => { this.calls.clear(); this.onclose?.(); };
    this.inner.onerror = error => this.onerror?.(error);
    this.inner.onmessage = (message, extra) => {
      if ("method" in message && message.method === "tools/call" && "id" in message) {
        const params = message.params;
        const name = params && typeof params.name === "string" ? params.name : "";
        const args = params?.arguments;
        let pagination: Pagination | undefined;
        if (Object.hasOwn(pageDefaults, name) && args && typeof args === "object" && !Array.isArray(args)) {
          const input = args as Record<string, unknown>;
          const limit = input.limit ?? pageDefaults[name];
          const offset = input.offset ?? 0;
          if (typeof limit === "number" && Number.isSafeInteger(limit) && limit > 0 &&
              typeof offset === "number" && Number.isSafeInteger(offset) && offset >= 0) pagination = { limit, offset };
        }
        this.calls.set(message.id, pagination);
      }
      this.onmessage?.(message, extra);
    };
    await this.inner.start();
  }
  async send(message: JSONRPCMessage, options?: TransportSendOptions): Promise<void> {
    if ("id" in message && !("method" in message) && message.id !== undefined && this.calls.has(message.id)) {
      const pagination = this.calls.get(message.id);
      this.calls.delete(message.id);
      if ("result" in message && message.result && typeof message.result === "object") {
        await this.inner.send({ ...message, result: limitToolResult(message.result, pagination) }, options);
        return;
      }
    }
    await this.inner.send(message, options);
  }
  async close(): Promise<void> { await this.inner.close(); }
}
