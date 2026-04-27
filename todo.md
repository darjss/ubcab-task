# Implementation Todo

We will implement this in small reviewable increments. After each task is completed, pause for review before continuing.

## Task 1: Project dependency and current app review

- [x] Inspect current `package.json`, `src/index.ts`, `src/db/index.ts`, Drizzle config, and existing schema exports.
- [x] Confirm installed packages for Elysia OpenAPI/Scalar, Drizzle, Postgres, Redis, and `neverthrow`.
- [x] Identify any missing dependencies before writing domain code.
- [x] Summarize current project shape and proposed minimal changes.

**Pause for review after Task 1.**

### Task 1 review notes

Current project already has:

- Elysia app in `src/index.ts`
- Scalar/OpenAPI via `@elysia/openapi`
- CORS via `@elysiajs/cors`
- Better Auth mounted under `/auth`
- Better Auth OpenAPI paths/components merged into the OpenAPI document
- Auth guard macro that exposes `user` and `session`
- Drizzle configured with PostgreSQL in `src/db/index.ts`
- Existing Better Auth schema exported from `src/db/schema/index.ts`
- Redis client in `src/lib/redis.ts`
- Docker Compose services for Postgres and Redis

Installed dependencies relevant to the plan:

- `elysia`
- `@elysia/openapi`
- `@elysiajs/cors`
- `drizzle-orm`
- `drizzle-kit`
- `drizzle-typebox`
- `pg`
- `ioredis`
- `better-auth`
- `@better-auth/redis-storage`
- `typeid-js`

Missing dependency:

- `neverthrow` was missing initially and has now been installed.

Small implementation notes:

- `src/db/schema/index.ts` currently only exports `./user`; domain schemas should be added there.
- OpenAPI already uses provider `scalar` at `/openapi` and JSON spec at `/openapi/json`.
- CORS `allowedHeaders` now includes `Idempotency-Key` for idempotent write endpoints.
- Auth endpoints are mounted at `/auth`, while Better Auth itself uses `basePath: /api`, so generated auth OpenAPI paths are prefixed through the existing `authOpenAPI.getPaths()` helper.
- Before domain routes are added, keep route registration small and incremental.

---

## Task 2: Domain database schema

- [x] Add Drizzle schema files:
  - `src/db/schema/groups.ts`
  - `src/db/schema/expenses.ts`
  - `src/db/schema/ledger.ts`
  - `src/db/schema/settlements.ts`
- [x] Define enums for:
  - group member role
  - group member status
  - split type
  - expense status
  - ledger transaction type
  - ledger entry type
  - settlement status
  - settlement transfer status
- [x] Reference existing Better Auth `user.id` from `src/db/schema/user.ts`.
- [x] Update `src/db/schema/index.ts` exports.
- [x] Add useful indexes and unique constraints.

**Pause for review after Task 2.**

### Task 2 review notes

Added domain schema files:

- `src/db/schema/groups.ts`
- `src/db/schema/expenses.ts`
- `src/db/schema/ledger.ts`
- `src/db/schema/settlements.ts`

Added enums:

- `group_member_role`: `owner`, `admin`, `member`
- `group_member_status`: `active`, `invited`, `removed`
- `split_type`: `exact`, `equal`, `percentage`, `shares`
- `expense_status`: `posted`, `voided`
- `ledger_transaction_type`: `expense`, `expense_reversal`, `settlement`, `settlement_reversal`
- `ledger_entry_type`: `expense`, `expense_reversal`, `settlement`, `settlement_reversal`
- `settlement_status`: `posted`, `voided`
- `settlement_transfer_status`: `suggested`, `confirmed`

Important choices:

- All domain tables reference the existing Better Auth `user.id`.
- Amounts use Postgres `bigint` with Drizzle `{ mode: "number" }` for now, matching the API's integer minor unit model.
- `group_members` and `expense_participants` use unique indexes to prevent duplicate membership/participants.
- `ledger_entries` has a DB check constraint preventing zero-value ledger entries.
- The balanced transaction invariant, `SUM(ledger_entries.amount_minor) = 0`, will be enforced in the ledger service because it spans multiple rows.
- `settlement_transfers` are stored for audit.

Validation:

- `bun run build` passes.
- Added `src/lib/types.ts` with Drizzle-inferred select/insert types for existing auth user and new domain tables.
- Added `src/lib/ids.ts` with TypeID helpers for externally referenced domain IDs:
  - `group_*`
  - `exp_*`
  - `ltx_*`
  - `le_*`
  - `stl_*`
  - `stx_*`

---

## Task 3: Balance SQL view / migration plan

- [x] Add migration or SQL file for `group_member_balances_view`.
- [x] Ensure view derives balances from `ledger_entries`.
- [x] Document that the view is source-derived and Redis is only cache.

**Pause for review after Task 3.**

### Task 3 review notes

Added:

- `src/db/views/group-member-balances.sql`
- `src/db/views/README.md`

The balance view derives current balances from immutable ledger entries:

```sql
SELECT
  le.group_id,
  le.user_id,
  le.currency,
  SUM(le.amount_minor) AS balance_minor
FROM ledger_entries AS le
GROUP BY
  le.group_id,
  le.user_id,
  le.currency;
```

Balance semantics:

- positive balance: user should receive money
- negative balance: user owes money
- zero balance: user is settled

Design note:

- `ledger_entries` remains the source of truth.
- `group_member_balances_view` is derived state.
- Redis can cache API responses that read from this view, but Redis is not accounting storage.

Migration note:

- Drizzle table schemas do not automatically create this view.
- Apply this SQL as a manual migration after the `ledger_entries` table exists, or copy it into a generated Drizzle migration.

Validation:

- `bun run build` passes.

---

## Task 4: Shared library foundations

- [x] Add `src/lib/types.ts` for shared domain types.
- [x] Add `src/lib/errors.ts` with typed domain errors and HTTP mapping.
- [x] Add `src/lib/money.ts` for money helpers and validation helpers.
- [x] Add `src/lib/settlement.ts` with pure settlement transfer algorithm.
- [x] Add `src/lib/schemas.ts` with TypeBox HTTP schemas.

**Pause for review after Task 4.**

### Task 4 review notes

Added shared foundation files:

- `src/lib/errors.ts`
- `src/lib/money.ts`
- `src/lib/settlement.ts`
- `src/lib/schemas.ts`

Already added earlier:

- `src/lib/types.ts`
- `src/lib/ids.ts`

Highlights:

- `errors.ts` defines typed domain error codes, response shape, and HTTP status mapping.
- `money.ts` defines positive integer minor-unit validation and exact split total validation.
- `settlement.ts` implements pure greedy settlement transfer calculation with `neverthrow` Result.
- `schemas.ts` contains shared Elysia TypeBox HTTP schemas for params, groups, members, expenses, balances, settlements, and errors.

Validation:

- `bun run build` passes.

---

## Task 5: Query layer skeleton

- [x] Add `src/db/queries/index.ts` exporting grouped `queries` object.
- [x] Add query files:
  - `groups.ts`
  - `members.ts`
  - `expenses.ts`
  - `ledger.ts`
  - `settlements.ts`
  - `balances.ts`
- [x] Implement basic group/member/balance reads first.
- [x] Keep query functions small and domain-grouped.

**Pause for review after Task 5.**

### Task 5 review notes

Added query layer files:

- `src/db/queries/index.ts`
- `src/db/queries/groups.ts`
- `src/db/queries/members.ts`
- `src/db/queries/expenses.ts`
- `src/db/queries/ledger.ts`
- `src/db/queries/settlements.ts`
- `src/db/queries/balances.ts`

The query layer exports a grouped object:

```ts
queries.groups.*
queries.members.*
queries.expenses.*
queries.ledger.*
queries.settlements.*
queries.balances.*
```

Implemented basic reads/writes needed by upcoming services:

- group create/read/list/count
- member create/find/list/update/remove
- expense create/list/find/participants
- ledger transaction/entry insert and audit list
- settlement batch/transfer create/list/find
- balance reads from `group_member_balances_view`

Design note:

- Query files are split by domain but still exposed as one organized `queries` object.
- Query functions now accept an optional query client parameter defaulting to the app-level `db` instance, so later accounting services can pass a transaction client and keep multi-table writes atomic.

Validation:

- `bun run build` passes.

---

## Task 6: Ledger service and invariants

- [x] Add `src/services/ledger.ts`.
- [x] Implement balanced-entry invariant checks.
- [x] Implement helper for creating ledger transaction + entries inside an existing DB transaction.
- [x] Use `neverthrow` for expected domain errors.

**Pause for review after Task 6.**

### Task 6 review notes

Added:

- `src/services/ledger.ts`

Implemented straightforward procedural ledger helpers:

- `validateLedgerEntries(entries)`
- `createLedgerTransaction(input, client?)`
- `createReversalLedgerTransaction(input, client?)`

Ledger invariant checks:

- A ledger transaction needs at least two entries.
- Every ledger entry amount must be a non-zero safe integer.
- Ledger entries must sum to exactly zero.

Transaction support:

- Ledger service accepts an optional query client.
- Normal usage defaults to app-level `db`.
- Accounting services can later pass a transaction client so transaction + entries are inserted atomically.

Error handling:

- Expected validation/accounting failures use `neverthrow` `Result` / `ResultAsync` with typed `DomainError`.
- Unexpected DB failures are mapped to `INTERNAL_SERVER_ERROR`.

Code style:

- Kept the service functional/procedural and inferred return types where practical.

Validation:

- `bun run build` passes.

---

## Task 7: Groups and members API

- [x] Add group/member services.
- [x] Add routes:
  - `GET /api/groups`
  - `POST /api/groups`
  - `GET /api/groups/:groupId`
  - `GET /api/groups/:groupId/members`
  - `POST /api/groups/:groupId/members`
  - `PATCH /api/groups/:groupId/members/:userId`
  - `DELETE /api/groups/:groupId/members/:userId`
- [x] Add auth guard integration using existing Better Auth session/user.
- [x] Add TypeBox route schemas and OpenAPI descriptions.

**Pause for review after Task 7.**

### Task 7 review notes

Added services:

- `src/services/groups.ts`
- `src/services/members.ts`

Added routes:

- `src/routes/groups.ts`
- `src/routes/members.ts`
- `src/routes/respond.ts`

Registered the routes in `src/index.ts` under `/api` after the existing Better Auth guard plugin.

Implemented endpoints:

- `GET /api/groups`
- `POST /api/groups`
- `GET /api/groups/:groupId`
- `GET /api/groups/:groupId/members`
- `POST /api/groups/:groupId/members`
- `PATCH /api/groups/:groupId/members/:userId`
- `DELETE /api/groups/:groupId/members/:userId`

Design notes:

- Group creation is transactional: it creates the group and owner membership together.
- Group/member services use straightforward functional/procedural code.
- Expected business failures use `neverthrow` and typed domain errors.
- Routes use TypeBox schemas from `src/lib/schemas.ts` so OpenAPI can be generated from the runtime validation schemas.
- Member deletion marks membership as `removed`; it does not delete historical records.

Validation:

- `bun run build` passes.

---

## Task 8: Expense creation and voiding

- [x] Add expense service.
- [x] Implement exact split validation.
- [x] Implement expense creation transaction:
  - expense
  - participants
  - ledger transaction
  - ledger entries
- [x] Implement expense reversal/voiding.
- [x] Add routes:
  - `GET /api/groups/:groupId/expenses`
  - `POST /api/groups/:groupId/expenses`
  - `GET /api/groups/:groupId/expenses/:expenseId`
  - `POST /api/groups/:groupId/expenses/:expenseId/void`

**Pause for review after Task 8.**

### Task 8 review notes

Added:

- `src/services/expenses.ts`
- `src/routes/expenses.ts`

Updated:

- `src/db/queries/expenses.ts`
- `src/db/queries/ledger.ts`
- `src/index.ts`

Implemented endpoints:

- `GET /api/groups/:groupId/expenses`
- `POST /api/groups/:groupId/expenses`
- `GET /api/groups/:groupId/expenses/:expenseId`
- `POST /api/groups/:groupId/expenses/:expenseId/void`

Expense creation behavior:

- Validates positive integer minor-unit amounts.
- Rejects duplicate participants.
- Validates exact split total equals `totalAmountMinor`.
- Validates requester, payer, and every participant are active group members.
- Runs expense insert, participant insert, ledger transaction insert, and ledger entry inserts inside one DB transaction.
- Creates balanced ledger entries where payer receives `totalAmountMinor - payerMealAmount` and other participants owe their exact meal amounts.

Expense voiding behavior:

- Only owner/admin can void.
- Does not delete the expense or original ledger entries.
- Marks expense as `voided`.
- Looks up original expense ledger transaction and entries.
- Creates reversal ledger transaction with opposite entries.

Validation:

- `bun run build` passes.

Known TODO for later:

- Idempotency key enforcement is intentionally deferred to Task 11.
- Response schemas for create/get/void expense can be tightened further during OpenAPI polish.

---

## Task 9: Balances and settlement preview

- [x] Add balance service.
- [x] Add settlement preview service using `src/lib/settlement.ts`.
- [x] Add Redis read-through cache for balances/preview if simple enough.
- [x] Add routes:
  - `GET /api/groups/:groupId/balances`
  - `GET /api/groups/:groupId/settlements/preview`

**Pause for review after Task 9.**

### Task 9 review notes

Added:

- `src/lib/cache.ts`
- `src/services/balances.ts`
- `src/services/settlements.ts`
- `src/routes/balances.ts`
- `src/routes/settlements.ts`

Updated:

- `src/index.ts`

Implemented endpoints:

- `GET /api/groups/:groupId/balances`
- `GET /api/groups/:groupId/settlements/preview`

Balance behavior:

- Requester must be an active group member.
- Reads balances from `group_member_balances_view` through `queries.balances.listByGroup`.
- Returns only current balances and `asOf` timestamp.

Settlement preview behavior:

- Requester must be an active group member.
- Reads current balances.
- Uses pure `calculateSettlementTransfers` from `src/lib/settlement.ts`.
- Returns balances plus suggested group-level net transfers.
- Does not mutate the ledger.

Redis cache behavior:

- Added short TTL read-through cache for balances and settlement preview.
- Cache failures are swallowed for reads; Postgres remains source of truth.
- Cache invalidation for ledger-changing writes is deferred to Task 11.

Validation:

- `bun run format` passes.
- `bunx tsc --noEmit` passes.
- `bun run lint` passes.
- `bun run format:check` passes.
- `bun run build` passes.

---

## Task 10: Settlement commit and voiding

- [x] Implement settlement creation transaction:
  - advisory lock/group lock
  - read balances
  - calculate transfers
  - settlement batch
  - settlement transfers
  - offsetting ledger entries
- [x] Implement settlement reversal/voiding.
- [x] Add routes:
  - `POST /api/groups/:groupId/settlements`
  - `GET /api/groups/:groupId/settlements`
  - `GET /api/groups/:groupId/settlements/:settlementId`
  - `POST /api/groups/:groupId/settlements/:settlementId/void`

**Pause for review after Task 10.**

### Task 10 review notes

Updated:

- `src/services/settlements.ts`
- `src/routes/settlements.ts`
- `src/db/queries/settlements.ts`
- `src/db/queries/ledger.ts`
- `src/services/expenses.ts`

Implemented endpoints:

- `POST /api/groups/:groupId/settlements`
- `GET /api/groups/:groupId/settlements`
- `GET /api/groups/:groupId/settlements/:settlementId`
- `POST /api/groups/:groupId/settlements/:settlementId/void`

Settlement creation behavior:

- Only owner/admin can create settlement batches.
- Runs inside a PostgreSQL transaction.
- Takes group-level transaction advisory lock using `pg_advisory_xact_lock(hashtext(groupId))`.
- Reads current balances from the derived balance view.
- Calculates suggested transfers using `calculateSettlementTransfers`.
- Stores `settlement_batches` and `settlement_transfers`.
- Inserts offsetting settlement ledger entries to zero current balances.

Settlement voiding behavior:

- Only owner/admin can void settlements.
- Does not delete the settlement or original ledger entries.
- Marks settlement as `voided`.
- Looks up original settlement ledger transaction and entries.
- Creates reversal ledger transaction with opposite entries.

Validation:

- `bun run format` passes.
- `bunx tsc --noEmit` passes.
- `bun run lint` passes.
- `bun run format:check` passes.
- `bun run build` passes.

---

## Task 11: Redis idempotency and cache invalidation

- [x] Add `src/lib/idempotency.ts`.
- [x] Require `Idempotency-Key` for accounting write endpoints.
- [x] Store completed responses for retry safety.
- [x] Add cache invalidation after successful DB commits.
- [x] Decide fail-closed behavior for idempotency Redis failures.

**Pause for review after Task 11.**

### Task 11 review notes

Added:

- `src/lib/idempotency.ts`

Updated:

- `src/lib/cache.ts`
- `src/routes/expenses.ts`
- `src/routes/settlements.ts`
- `src/services/expenses.ts`
- `src/services/settlements.ts`

Idempotency behavior:

- Requires `Idempotency-Key` header for accounting write endpoints:
  - `POST /api/groups/:groupId/expenses`
  - `POST /api/groups/:groupId/expenses/:expenseId/void`
  - `POST /api/groups/:groupId/settlements`
  - `POST /api/groups/:groupId/settlements/:settlementId/void`
- Redis key scope includes user, group, and idempotency key.
- Request body is hashed with SHA-256.
- Reusing the same key with a different body returns `IDEMPOTENCY_CONFLICT`.
- Reusing the same key with the same body after completion returns the stored response.
- If Redis idempotency storage fails, the request fails closed through the route error path rather than creating duplicate accounting entries.

Cache invalidation behavior:

- Added `invalidateGroupAccountingCache(groupId)`.
- Invalidates:
  - `group:{groupId}:balances`
  - `group:{groupId}:settlement-preview`
- Runs after successful DB transaction for:
  - expense creation
  - expense voiding
  - settlement creation
  - settlement voiding

Validation:

- `bun run format` passes.
- `bunx tsc --noEmit` passes.
- `bun run lint` passes.
- `bun run format:check` passes.
- `bun run build` passes.

---

## Task 12: OpenAPI/Scalar documentation polish

- [x] Confirm Elysia OpenAPI/Scalar route is exposed.
- [x] Ensure every route has:
  - summary
  - description
  - params schema
  - query schema where needed
  - body schema where needed
  - response schema
  - tags
- [ ] Add examples where supported.
- [x] Keep `plan.md` as human-readable design explanation.

**Pause for review after Task 12.**

### Task 12 review notes

Confirmed generated OpenAPI/Scalar docs are exposed at:

- Scalar UI: `GET /openapi`
- JSON spec: `GET /openapi/json`

Verified generated OpenAPI includes domain paths:

- `/api/groups`
- `/api/groups/{groupId}`
- `/api/groups/{groupId}/members`
- `/api/groups/{groupId}/members/{userId}`
- `/api/groups/{groupId}/expenses`
- `/api/groups/{groupId}/expenses/{expenseId}`
- `/api/groups/{groupId}/expenses/{expenseId}/void`
- `/api/groups/{groupId}/balances`
- `/api/groups/{groupId}/settlements/preview`
- `/api/groups/{groupId}/settlements`
- `/api/groups/{groupId}/settlements/{settlementId}`
- `/api/groups/{groupId}/settlements/{settlementId}/void`

Also verified Better Auth OpenAPI paths are included under `/auth/api/*`.

Current route docs include:

- tags
- summary
- description
- params schemas where needed
- query schemas where needed
- body schemas where needed

Important implementation note:

- Elysia's OpenAPI plugin uses runtime schemas by default, so domain routes now declare explicit `response` schemas instead of relying on erased TypeScript handler return types.
- Shared `DomainErrorResponses` documents the common error envelope for status-specific domain failures.
- `plan.md` remains the human-readable API contract with example request/response bodies and system design reasoning.

Validation:

- Started dev server and fetched `/openapi/json` successfully.
- `bun run format` passes.
- `bunx tsc --noEmit` passes.
- `bun run lint` passes.
- `bun run format:check` passes.
- `bun run build` passes.

---

## Task 13: Ledger audit endpoint

- [x] Add ledger query/service.
- [x] Add route:
  - `GET /api/groups/:groupId/ledger`
- [x] Support filters:
  - `userId`
  - `type`
  - `from`
  - `to`
  - `limit`
  - `cursor`

**Pause for review after Task 13.**

### Task 13 review notes

Updated:

- `src/db/queries/ledger.ts`
- `src/services/ledger.ts`
- `src/lib/schemas.ts`
- `src/index.ts`

Added:

- `src/routes/ledger.ts`

Implemented endpoint:

- `GET /api/groups/:groupId/ledger`

Ledger audit behavior:

- Requester must be an active group member.
- Returns immutable ledger entries for the group.
- Supports optional filters:
  - `userId`
  - `type`
  - `from`
  - `to`
  - `limit`
  - `cursor`
- Uses timestamp cursor pagination and returns `pagination.nextCursor`.
- Response entries include ledger entry id, transaction id, entry type, user id, signed amount, currency, and creation timestamp.

Validation:

- `bunx tsc --noEmit` passes.
- `bun run build` passes.
- IDE lint check for edited files passes.

---

## Task 14: Final validation and cleanup

- [x] Run formatter/linter.
- [x] Run typecheck/build.
- [x] Generate Drizzle migrations if appropriate.
- [x] Verify endpoint names match `plan.md`.
- [x] Update `plan.md` if implementation tradeoffs changed.
- [x] Mark all completed tasks.

**Pause for final review.**

### Task 14 review notes

Whole-project validation:

- `bun run format:check` passes.
- `bun run lint` passes.
- `bunx tsc --noEmit` passes.
- `bun run build` passes.

Migration state:

- A generated initial migration exists at `drizzle/0000_initial_auth_and_lunch_domain.sql`.
- The migration includes Better Auth tables, lunch domain tables, enums, indexes, foreign keys, and `group_member_balances_view`.
- Docker Compose provides local Postgres and Redis services.

Endpoint coverage against `plan.md`:

- Group endpoints are implemented.
- Member endpoints are implemented.
- Expense create/list/get/void endpoints are implemented.
- Balance endpoint is implemented.
- Settlement preview/create/list/get/void endpoints are implemented.
- Ledger audit endpoint is implemented.
- Better Auth endpoints are mounted and merged into OpenAPI.

Requirement fit:

- Backend-only REST API: yes.
- Users can create groups: yes.
- One user can belong to multiple groups: yes, through `group_members`.
- Balances are per group: yes, ledger entries and balance view are group-scoped.
- Different participant counts per lunch: yes, each expense has its own participant list.
- Different meal prices per participant: yes, exact split supports per-user `amountMinor`.
- Batch settlement after a period: yes, settlement preview calculates transfers and settlement commit inserts offsetting ledger entries.
- Balances reset after settlement: yes, settlement commit writes inverse ledger entries so derived balances become zero.
- REST endpoint documentation with input/output: yes, in `plan.md` and generated OpenAPI/Scalar.

Known limitations to mention honestly:

- The MVP supports exact split only; equal/percentage/share split enums are modeled for future extension.
- Cursor pagination is timestamp-based and good enough for the assignment, but a production API should use a stable composite cursor such as `createdAt + id`.
- API examples are primarily in `plan.md`; route-level OpenAPI examples can be added later if needed.
- Live end-to-end curl testing still needs a local seeded database and authenticated session cookies.

---

## Task 15: API client testing plan with realistic seed data

- [ ] Start local Postgres and Redis from Docker Compose.
- [ ] Apply migrations to the local Postgres database.
- [ ] Seed realistic users, group membership, expenses, ledger transactions, and ledger entries.
- [ ] Start the Elysia server locally.
- [ ] Fetch `/openapi/json` and verify all expected domain paths exist.
- [ ] Use curl with an authenticated session cookie or seeded session to test the API.
- [ ] Verify the Mizorn example balances before settlement:
  - Bataa: `-35200`
  - Ganaa: `28920`
  - Bayaraa: `-1840`
  - Gerlee: `8120`
- [ ] Preview settlement and verify suggested transfers:
  - Bataa -> Ganaa: `28920`
  - Bataa -> Gerlee: `6280`
  - Bayaraa -> Gerlee: `1840`
- [ ] Commit settlement with an `Idempotency-Key`.
- [ ] Verify balances become zero after settlement.
- [ ] Re-run the same settlement request with the same idempotency key and verify the stored response is returned.
- [ ] Re-run the same idempotency key with a different body and verify `IDEMPOTENCY_CONFLICT`.
- [ ] Query ledger audit endpoint and verify original expense entries plus settlement entries exist.
- [ ] Void an expense and verify reversal ledger entries are added instead of deleting history.
- [ ] Void a settlement and verify reversal ledger entries restore pre-settlement balances.

### Seed scenario

Seed these users:

- Bataa: `user_bataa`
- Ganaa: `user_ganaa`
- Bayaraa: `user_bayaraa`
- Gerlee: `user_gerlee`

Seed one group:

- `group_mizorn_lunch`
- currency: `MNT`
- owner: Bataa
- active members: Bataa, Ganaa, Bayaraa, Gerlee

Seed direct SQL ledger fixture data for the exact target balance from the assignment:

- Insert balanced ledger transaction fixture entries:
  - Bataa: `-35200`
  - Ganaa: `28920`
  - Bayaraa: `-1840`
  - Gerlee: `8120`

This keeps the target-balance test focused on balance reading, settlement preview, settlement commit, idempotency, and ledger audit.

Separately test expense creation with realistic positive participant amounts:

- Bataa pays `50000`; participants Bataa `12000`, Ganaa `15000`, Bayaraa `10000`, Gerlee `13000`.
- Ganaa pays `36000`; participants Bataa `18000`, Ganaa `9000`, Gerlee `9000`.
- Gerlee pays `28000`; participants Bataa `16000`, Bayaraa `12000`.

Those API-created expenses verify exact split validation and ledger generation, but they do not need to be the same fixture used for the assignment's exact sample balance.

### Curl test sequence

1. Start dependencies:
   - `docker compose up -d postgres redis`
2. Apply database migration:
   - `bun run db:push` or execute `drizzle/0000_initial_auth_and_lunch_domain.sql` directly.
3. Seed auth users, group, members, and fixture ledger entries.
4. Start server:
   - `bun run dev`
5. Fetch OpenAPI:
   - `GET /openapi/json`
6. Authenticate or seed a valid Better Auth session and save cookies.
7. Test:
   - `GET /api/groups`
   - `GET /api/groups/group_mizorn_lunch`
   - `GET /api/groups/group_mizorn_lunch/members`
   - `GET /api/groups/group_mizorn_lunch/balances`
   - `GET /api/groups/group_mizorn_lunch/settlements/preview`
   - `POST /api/groups/group_mizorn_lunch/settlements`
   - `GET /api/groups/group_mizorn_lunch/balances`
   - `GET /api/groups/group_mizorn_lunch/ledger`
   - `POST /api/groups/group_mizorn_lunch/expenses`
   - `POST /api/groups/group_mizorn_lunch/expenses/:expenseId/void`

### Expected demo narrative

This implementation is intentionally a small accounting system, not just CRUD:

- Postgres is the source of truth.
- Redis is used only for idempotency and cache, never as accounting storage.
- Every accounting event writes immutable ledger entries.
- Balances are derived from ledger sums.
- Settlement is a transactional batch operation that stores suggested transfers and writes offsetting ledger entries.
- Corrections are reversals, not deletes.
- Elysia TypeBox schemas drive validation and OpenAPI response documentation.

---

## Task 16: DB diagram and Railway deployment

- [x] Create DBML diagram file for dbdiagram.io.
- [x] Document where the diagram file lives.
- [x] Check whether DBML CLI tooling exists.
- [x] Document Railway deployment plan with Railway Postgres and Redis.
- [ ] Import DBML into dbdiagram.io UI and visually verify layout.
- [ ] Deploy to Railway app service.
- [ ] Add Railway Postgres.
- [ ] Add Railway Redis.
- [ ] Set production Railway variables.
- [ ] Run migration on Railway.
- [ ] Smoke test Railway `/openapi`, `/openapi/json`, and `/api/health`.

### Task 16 review notes

Added DB diagram file:

- `docs/dbdiagram/lunch-settlement.dbml`

Usage:

- Open [dbdiagram.io](https://dbdiagram.io/home/).
- Paste/import `docs/dbdiagram/lunch-settlement.dbml`.
- Use the rendered diagram in assignment presentation.

CLI tooling:

- DBML has official CLI tooling through `@dbml/cli`.
- Useful commands:
  - `dbml2sql`
  - `sql2dbml`
  - `db2dbml`
- Local validation command attempted:
  - `bunx @dbml/cli dbml2sql docs/dbdiagram/lunch-settlement.dbml -o /tmp/schema.sql`
- On local Node `v25.9.0`, the CLI crashed while printing parser diagnostics, so visual validation should be done in dbdiagram.io UI.

Railway deployment notes:

- Use Railway app service for Bun/Elysia API.
- Use Railway-managed Postgres for `DATABASE_URL`.
- Use Railway-managed Redis for `REDIS_URL`.
- Required app variables:
  - `DATABASE_URL`
  - `REDIS_URL`
  - `BETTER_AUTH_SECRET`
  - `BETTER_AUTH_URL`
- App already reads `process.env.PORT`.
- Run migration after linking Railway DB:
  - `railway run bun run db:push`
