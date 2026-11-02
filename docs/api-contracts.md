# Freelancer API response contract evidence

The server validates responses at the HTTP boundary and removes fields outside its allowlists. Entity types and HTTP helper return types are derived from the schemas in `src/schemas/responses.ts`. `tests/type-contract.ts` checks at compile time that callers cannot select an unrelated result type or an unregistered route.

## Evidence gathered on 2026-11-02

- The public, unauthenticated `GET /projects/0.1/jobs/` response contained a `success` envelope and an array of 3,490 jobs. The entire response passed the job schema.
- The public, unauthenticated `GET /projects/0.1/projects/active` response, including a request with the parameters used by the tool, passed the project-list schema after optional null fields were normalized.
- The public, unauthenticated `GET /users/0.1/users` response passed the user-map schema after optional null fields were normalized.
- Requests for bids and milestones without credentials returned HTTP 401. Private messages, profile writes, and other account-bound operations were not exercised against a live account.
- Sanitized synthetic examples in `tests/api-contracts.test.mjs` are adapted from tests in the [official Freelancer Python SDK at commit 17b8969](https://github.com/freelancer/freelancer-sdk-python/tree/17b8969d7480f3b9ea38d32e499e6c9bb3dd28b8/tests). They demonstrate possible representations, not guarantees about current production responses.

No live response data or credentials are checked into the test suite. The public calls above are one-time observations, not CI dependencies; pagination, different requested fields, accounts, API revisions and error paths may return different shapes. Before marking T09 complete, confirm the remaining authenticated endpoints against up-to-date official reference documentation or sanitized sandbox responses, including success and error variants. In particular, the result shapes of specialty-profile operations and semantics of `skill_ids: []` remain unverified.
