import { apiGet, apiPost, apiPut, apiForm } from "../src/services/api.js";

async function verifyTypeContracts(): Promise<void> {
  const messages = await apiGet("/messages/0.1/messages");
  messages.messages[0].message satisfies string;
  // @ts-expect-error Messages responses cannot be treated as project results.
  messages.projects;
  // @ts-expect-error Callers cannot choose an arbitrary result type.
  await apiGet<{ injected: string }>("/messages/0.1/messages");
  // @ts-expect-error Unsupported routes must not compile.
  await apiGet("/unregistered/endpoint");
  // @ts-expect-error A GET route is not a valid POST route.
  await apiPost("/messages/0.1/messages");
  // @ts-expect-error Profile updates use their registered route.
  await apiPut("/projects/0.1/bids");
  // @ts-expect-error Form writes are limited to the skills endpoint.
  await apiForm("post", "/users/0.1/profiles");
  const sent = await apiPost(`/messages/0.1/threads/${123}/messages`);
  sent.id satisfies number;
}
void verifyTypeContracts;
