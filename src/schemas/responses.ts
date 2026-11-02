import { z } from "zod";

// The API can send null for optional fields; expose a consistent undefined internally.
const optional = <T extends z.ZodType>(schema: T) =>
  schema.nullish().transform(value => value ?? undefined);
const id = z.union([
  z.number().int().positive().safe(),
  z.string().regex(/^[1-9]\d*$/).refine(value => Number.isSafeInteger(Number(value))).transform(Number),
]);
const number = z.number().finite();
const count = z.number().int().nonnegative();
const record = <T extends z.ZodType>(value: T) => z.record(z.string(), value);

// Keep only fields used or deliberately returned by the MCP tools.
const job = z.object({
  id, name: z.string(),
  category: optional(z.object({ id, name: z.string() })),
  seo_url: optional(z.string()),
});
const user = z.object({
  id, username: optional(z.string()), display_name: optional(z.string()),
  avatar: optional(z.string()), role: optional(z.string()), tagline: optional(z.string()),
  hourly_rate: optional(number), registration_date: optional(number),
  jobs: optional(z.array(job.pick({ name: true }))),
  reputation: optional(z.object({
    entire_history: optional(z.object({ overall: optional(number), reviews: optional(number) })),
  })),
  location: optional(z.object({
    city: optional(z.string()), country: optional(z.object({ name: optional(z.string()) })),
  })),
  earnings: optional(z.object({ earnings: optional(number) })),
});
const project = z.object({
  id, title: z.string(), description: optional(z.string()), status: optional(z.string()),
  type: optional(z.string()),
  budget: optional(z.object({ minimum: optional(number), maximum: optional(number), currency_code: optional(z.string()) })),
  bid_stats: optional(z.object({ bid_count: optional(number), bid_avg: optional(number) })),
  time_submitted: optional(number), time_updated: optional(number),
  jobs: optional(z.array(job.pick({ name: true }))), owner_id: optional(id),
  hired_freelancers: optional(z.array(id)),
});
const bid = z.object({
  id, amount: optional(number), period: optional(number), status: optional(z.string()),
  project_id: optional(id), bidder_id: optional(id), description: optional(z.string()),
  time_submitted: optional(number), reputation: optional(z.object({ overall: optional(number) })),
  bidder: optional(user),
});
const milestone = z.object({
  id: optional(id), transaction_id: optional(id), project_id: optional(id),
  amount: optional(number), description: optional(z.string()), status: z.string(),
  time_created: optional(number), time_updated: optional(number),
  currency: optional(z.object({ code: optional(z.string()) })),
});
const message = z.object({
  id, thread_id: optional(id), from_user: optional(id), from_user_id: optional(id),
  message: z.string(), time_created: optional(number),
  attachments: optional(z.array(z.object({ filename: z.string(), url: optional(z.string()) }))),
});
const sentMessage = z.object({ id, time_created: optional(number) });
const thread = z.object({
  id: optional(id),
  thread: optional(z.object({
    id: optional(id), thread_type: optional(z.string()), members: optional(z.array(id)),
    owner: optional(id),
    context: optional(z.object({ type: optional(z.string()), id: optional(id) })),
    time_created: optional(number),
  })),
  message_count: optional(number), time_updated: optional(number),
});
const profile = z.object({
  profile_id: optional(id), id: optional(id), profile_name: optional(z.string()),
  tagline: optional(z.string()), hourly_rate: optional(number), description: optional(z.string()),
  skill_ids: optional(z.array(id)),
});

const projectList = z.object({ projects: z.array(project), total_count: optional(count) });
const projectLookup = z.object({ projects: z.union([record(project), z.array(project)]), total_count: optional(count) });
const milestones = z.object({ milestones: z.union([z.array(milestone), record(milestone)]).transform(value =>
  Array.isArray(value) ? value : Object.entries(value).map(([key, item]) => ({
    ...item,
    id: item.id ?? item.transaction_id ?? (/^[1-9]\d*$/.test(key) && Number.isSafeInteger(Number(key)) ? Number(key) : undefined),
  })))
});

// These schemas are the single source of both runtime validation and API return types.
export const getSchemas = {
  "/messages/0.1/threads": z.object({ threads: z.array(thread), total_count: optional(count) }),
  "/messages/0.1/messages": z.object({ messages: z.array(message), total_count: optional(count), unfiltered_count: optional(count) }),
  "/projects/0.1/jobs/": z.array(job),
  "/users/0.1/self": user.extend({ jobs: optional(z.array(job)) }),
  "/users/0.1/users": z.object({ users: record(user) }),
  "/users/0.1/profiles": z.object({ profiles: z.array(profile) }),
  "/projects/0.1/projects/active": projectList,
  "/projects/0.1/projects": projectLookup,
  "/projects/0.1/bids": z.object({ bids: z.array(bid), total_count: optional(count) }),
  "/projects/0.1/milestones": milestones,
} as const;
export const postSchemas = {
  "/projects/0.1/bids": bid,
  "/users/0.1/profiles": profile,
} as const;
export const sentMessageSchema = sentMessage;
export const putSchemas = { "/users/0.1/profiles": profile } as const;
export const skillWriteSchema = z.union([z.null(), z.object({})]);

/** Select a schema based on the operation and request shape, never on response data. */
export function resultSchema(method: string, path: string, params?: Record<string, unknown>): z.ZodType | undefined {
  if (method === "get") {
    if (path === "/projects/0.1/projects" && params?.["ids[]"] === undefined) return projectList;
    return Object.hasOwn(getSchemas, path) ? getSchemas[path as keyof typeof getSchemas] : undefined;
  }
  if (["post", "put", "delete"].includes(method) && path === "/users/0.1/self/jobs") return skillWriteSchema;
  if (method === "post" && /^\/messages\/0\.1\/threads\/\d+\/messages$/.test(path)) return sentMessageSchema;
  if (method === "post") return Object.hasOwn(postSchemas, path) ? postSchemas[path as keyof typeof postSchemas] : undefined;
  if (method === "put" && Object.hasOwn(putSchemas, path)) return putSchemas[path as keyof typeof putSchemas];
  return undefined;
}

export type FreelancerJob = z.infer<typeof job>;
export type FreelancerUser = z.infer<typeof user>;
export type FreelancerProject = z.infer<typeof project>;
export type FreelancerBid = z.infer<typeof bid>;
export type FreelancerMilestone = z.infer<typeof milestone>;
export type FreelancerMessage = z.infer<typeof message>;
export type FreelancerSentMessage = z.infer<typeof sentMessage>;
export type FreelancerThread = z.infer<typeof thread>;
