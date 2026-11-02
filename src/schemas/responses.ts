import { z } from "zod";

// Keep only fields used or deliberately returned by the MCP tools.
const id = z.union([z.number().int().positive().safe(), z.string().regex(/^[1-9]\d*$/).refine(value => Number.isSafeInteger(Number(value))).transform(Number)]);
const number = z.number().finite();
const job = z.object({ id, name: z.string(), category: z.object({ id, name: z.string() }).optional(), seo_url: z.string().optional() });
const user = z.object({ id, username: z.string().optional(), display_name: z.string().optional(), avatar: z.string().optional(), role: z.string().optional(), tagline: z.string().optional(), hourly_rate: number.optional(), registration_date: number.optional(), jobs: z.array(job.pick({ name: true })).optional(), reputation: z.object({ entire_history: z.object({ overall: number.optional(), reviews: number.optional() }).optional() }).optional(), location: z.object({ city: z.string().optional(), country: z.object({ name: z.string().optional() }).optional() }).optional(), earnings: z.object({ earnings: number.optional() }).optional() });
const project = z.object({ id, title: z.string(), description: z.string().optional(), status: z.string().optional(), type: z.string().optional(), budget: z.object({ minimum: number.optional(), maximum: number.optional(), currency_code: z.string().optional() }).optional(), bid_stats: z.object({ bid_count: number.optional(), bid_avg: number.optional() }).optional(), time_submitted: number.optional(), time_updated: number.optional(), jobs: z.array(job.pick({name: true})).optional(), owner_id: id.optional(), hired_freelancers: z.array(id).optional() });
const bid = z.object({ id, amount: number.optional(), period: number.optional(), status: z.string().optional(), project_id: id.optional(), bidder_id: id.optional(), description: z.string().optional(), time_submitted: number.optional(), reputation: z.object({overall: number.optional()}).optional(), bidder: user.optional() });
const milestone = z.object({ id: id.optional(), transaction_id: id.optional(), project_id: id.optional(), amount: number.optional(), description: z.string().optional(), status: z.string(), time_created: number.optional(), time_updated: number.optional(), currency: z.object({code: z.string().optional()}).optional() });
const message = z.object({ id, thread_id: id.optional(), from_user: id.optional(), from_user_id: id.optional(), message: z.string(), time_created: number.optional(), attachments: z.array(z.object({filename: z.string(), url: z.string().optional()})).optional() });
const sentMessage = z.object({ id, time_created: number.optional() });
const thread = z.object({ id: id.optional(), thread: z.object({ id: id.optional(), thread_type: z.string().optional(), members: z.array(id).optional(), owner: id.optional(), context: z.object({type: z.string().optional(), id: id.optional()}).optional(), time_created: number.optional() }).optional(), message_count: number.optional(), time_updated: number.optional() });
const profile = z.object({ profile_id: id.optional(), id: id.optional(), profile_name: z.string().optional(), tagline: z.string().optional(), hourly_rate: number.optional(), description: z.string().optional(), skill_ids: z.array(id).optional() });
const count = z.number().int().nonnegative();
const record = <T extends z.ZodType>(value: T) => z.record(z.string(), value);

/** Select a schema based on the operation and request shape, never on response data. */
export function resultSchema(method: string, path: string, params?: Record<string, unknown>): z.ZodType | undefined {
  if (method === "get") {
    switch (path) {
      case "/messages/0.1/threads": return z.object({threads: z.array(thread), total_count: count.optional()});
      case "/messages/0.1/messages": return z.object({messages: z.array(message), total_count: count.optional(), unfiltered_count: count.optional()});
      case "/projects/0.1/jobs/": return z.array(job);
      case "/users/0.1/self": return user.extend({jobs: z.array(job).optional()});
      case "/users/0.1/users": return z.object({users: record(user)});
      case "/users/0.1/profiles": return z.object({profiles: z.array(profile)});
      case "/projects/0.1/projects/active": return z.object({projects: z.array(project), total_count: count.optional()});
      case "/projects/0.1/projects": return params?.["ids[]"] !== undefined ? z.object({projects: z.union([record(project), z.array(project)])}) : z.object({projects: z.array(project), total_count: count.optional()});
      case "/projects/0.1/bids": return z.object({bids: z.array(bid), total_count: count.optional()});
      case "/projects/0.1/milestones": return z.object({milestones: z.union([z.array(milestone), record(milestone)]).transform(value => Array.isArray(value) ? value : Object.entries(value).map(([key, item]) => ({...item, id: item.id ?? item.transaction_id ?? (/^[1-9]\d*$/.test(key) && Number.isSafeInteger(Number(key)) ? Number(key) : undefined)})))});
    }
  }
  if (method === "post" && /^\/messages\/0\.1\/threads\/\d+\/messages$/.test(path)) return sentMessage;
  if (method === "post" && path === "/projects/0.1/bids") return bid;
  if ((method === "post" || method === "put") && path === "/users/0.1/profiles") return profile;
  if (["post", "put", "delete"].includes(method) && path === "/users/0.1/self/jobs") return z.union([z.null(), z.object({})]);
  return undefined;
}

// Types describe parsed data, including optional fields allowed by the wire format.
export type FreelancerUser = z.infer<typeof user>;
export type FreelancerProject = z.infer<typeof project>;
export type FreelancerBid = z.infer<typeof bid>;
export type FreelancerMilestone = z.infer<typeof milestone>;
export type FreelancerMessage = z.infer<typeof message>;
export type FreelancerSentMessage = z.infer<typeof sentMessage>;
export type FreelancerThread = z.infer<typeof thread>;
