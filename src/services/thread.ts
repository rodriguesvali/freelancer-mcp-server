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

