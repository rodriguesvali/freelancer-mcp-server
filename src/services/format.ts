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

/** Shared account selector schema description, reused across tool inputs. */
export const ACCOUNT_DESC =
  "Which configured Freelancer account to use (see freelancer_list_accounts for labels). Required for writes when multiple accounts are configured; otherwise defaults to the first account.";
