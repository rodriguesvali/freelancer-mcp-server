# Freelancer API response contract evidence

The server validates responses at the HTTP boundary and removes fields outside its allowlists. Entity types and HTTP helper return types are derived from the schemas in `src/schemas/responses.ts`. `tests/type-contract.ts` checks at compile time that callers cannot select an unrelated result type or an unregistered route.

## Evidence gathered on 2026-11-02

- The public, unauthenticated `GET /projects/0.1/jobs/` response contained a `success` envelope and an array of 3,490 jobs. The entire response passed the job schema.
- The public, unauthenticated `GET /projects/0.1/projects/active` response, including a request with the parameters used by the tool, passed the project-list schema after optional null fields were normalized.
- The public, unauthenticated `GET /users/0.1/users` response passed the user-map schema after optional null fields were normalized.
- Requests for bids and milestones without credentials returned HTTP 401. Private messages, profile writes, and other account-bound operations were not exercised against a live account.
- Sanitized synthetic examples in `tests/api-contracts.test.mjs` are adapted from tests in the [official Freelancer Python SDK at commit 17b8969](https://github.com/freelancer/freelancer-sdk-python/tree/17b8969d7480f3b9ea38d32e499e6c9bb3dd28b8/tests). They demonstrate possible representations, not guarantees about current production responses.

No live response data or credentials are checked into the test suite. The public calls above are one-time observations, not CI dependencies; pagination, different requested fields, accounts, API revisions and error paths may return different shapes. Before marking T09 complete, confirm the remaining authenticated endpoints against up-to-date official reference documentation or sanitized sandbox responses, including success and error variants. In particular, the result shapes of specialty-profile operations and semantics of `skill_ids: []` remain unverified.

## Empty skill list on a specialty profile (T11)

The [official developer documentation application](https://developers.freelancer.com/) contains the profile endpoint documentation in its [JavaScript bundle](https://developers.freelancer.com/static/js/main.e494386d.js) (section `profiles-put`, inspected on 2026-11-02). It describes `skill_ids` as an array and requires `profile_id` for `PUT /users/0.1/profiles`; it does not specify whether an empty array clears skills, is ignored, or is rejected. An array without a documented minimum length is not evidence of its effect. The SDK's [sandbox instructions](https://github.com/freelancer/freelancer-sdk-python/tree/17b8969d7480f3b9ea38d32e499e6c9bb3dd28b8#examples) identify `https://www.freelancer-sandbox.com` as the test host.

The MCP tool deliberately rejects `skills: []` before any HTTP request. Omitting `skills` leaves it out of the update; a non-empty list is resolved and sent as `skill_ids`. Local tests cover all three cases, combined updates, multi-account selection and the destructive annotation.

### Sandbox verification plan

1. Use a disposable specialty profile in a sandbox account, a token supplied through the local environment, and the fixed sandbox host. Do not use production credentials, print the token or save raw profile responses.
2. Fetch the profile and confirm its identity and that it has a known, non-empty skill list. If its current skills cannot be reliably read, stop: an empty baseline cannot distinguish clearing from a no-op.
3. Submit one sandbox-only update with `skill_ids: []`, without changing other fields. Record the HTTP status and whether the API reports success, without recording secrets or raw personal data. On timeout or ambiguous response, read the profile before considering any retry.
4. Fetch the same profile again and compare its skill IDs with the baseline. An empty list demonstrates clearing; an unchanged list demonstrates a no-op; a rejected request with unchanged skills demonstrates rejection. Other outcomes remain inconclusive.
5. Record the date, relevant sanitized response shapes, and result here, then decide whether to support clearing or keep rejecting it. The profile must be disposable; any restoration is a separate sandbox operation and must be verified by a subsequent read.

No sandbox token or profile was configured when this investigation was performed, so no write was sent and the semantics remain unverified.
