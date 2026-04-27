# Lunch Settlement Backend Plan

## 1. Zorilgo

Ene system ni Mizorn company-iin ajilchid hamtdaa hool ideh ued udur bur bankaar shiljuuleg hiihgui, group dotor avlaga/ugluguur ni tootsood, todorhoi hugatsaanii daraa buund ni settlement hiih bolomjtoi backend REST API yum.

Gol shaardlaga:

- Humuus group uusgene.
- Neg hun heden ch group-d baij bolno.
- Group buriin balance tusdaa tootsoologdono.
- Hoolnii zardal deer payer, participants, hun buriin meal cost uur baij bolno.
- Balance-g harna.
- Settlement preview harna.
- Settlement commit hiigeed balance zero bolgono.
- Endpoint-uud input/output, path/query parameter, example data-tai documentlogdono.

## 2. Current Implementation State

Project odoogoor daraah stack-aar ajillaj baina:

- Bun runtime
- ElysiaJS REST API
- `@elysia/openapi` + Scalar generated docs
- Better Auth authentication
- PostgreSQL source of truth
- Drizzle ORM schema/query layer
- Redis cache/idempotency
- TypeBox runtime validation and OpenAPI schemas
- neverthrow domain error/result handling

Local endpoints:

- Scalar UI: `GET /openapi`
- OpenAPI JSON: `GET /openapi/json`
- Domain API prefix: `/api`
- Auth mount: `/auth`

Validation odoogoor pass:

- `bun run format:check`
- `bun run lint`
- `bunx tsc --noEmit`
- `bun run build`

## 3. Core Accounting Decision

Balance-g mutable column deer hadgalahgui. Ledger entry-uudees derive hiine.

```text
balance = SUM(ledger_entries.amount_minor)
```

Balance meaning:

```text
positive balance = hun mungu avah yostoi
negative balance = hun mungu tuluh yostoi
zero balance     = settled
```

Ledger invariant:

```text
SUM(entries.amount_minor) per ledger transaction = 0
```

Ene ni financial/accounting system deer heregtei auditability ugdug. Expense, settlement, void/correction bugd immutable ledger event bolj uldene.

## 4. Example Expense

Bataa 50,000 tugrug tuluv.

Participants:

| User | Meal Cost |
|---|---:|
| Bataa | 12,000 |
| Ganaa | 15,000 |
| Bayaraa | 10,000 |
| Gerlee | 13,000 |

Ledger entries:

| User | Entry |
|---|---:|
| Bataa | +38,000 |
| Ganaa | -15,000 |
| Bayaraa | -10,000 |
| Gerlee | -13,000 |

Bataa-gii `+38,000`:

```text
total paid - own meal = 50,000 - 12,000
```

Entries sum:

```text
38000 - 15000 - 10000 - 13000 = 0
```

## 5. Database Design

Existing Better Auth tables:

- `user`
- `session`
- `account`
- `verification`

Domain tables:

- `groups`
- `group_members`
- `expenses`
- `expense_participants`
- `ledger_transactions`
- `ledger_entries`
- `settlement_batches`
- `settlement_transfers`

Important design choices:

- Domain tables reference existing `user.id`.
- `group_members` deer role/status baigaa uchraas neg user neg group-d owner, uur group-d member baij bolno.
- `expense_participants` ni expense buriin participant list-iig tusdaa hadgalna.
- `ledger_entries` bol accounting source of truth.
- `settlement_transfers` ni settlement hiih ued suggested transfer plan-iig audit zorilgoor hadgalna.

## 6. Balance View

Mutable balance table uusgehgui. PostgreSQL view ashiglana:

```sql
CREATE OR REPLACE VIEW group_member_balances_view AS
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

Meaning:

- `ledger_entries`: source of truth
- `group_member_balances_view`: derived current state
- Redis: cache only

## 7. Redis Usage

Redis-iig accounting source bolgoj ashiglahgui.

Redis ashiglaj baigaa zuils:

- Idempotency key for accounting writes.
- Balance response cache.
- Settlement preview cache.
- Better Auth secondary/session-related storage.

Idempotency required endpoints:

- `POST /api/groups/:groupId/expenses`
- `POST /api/groups/:groupId/expenses/:expenseId/void`
- `POST /api/groups/:groupId/settlements`
- `POST /api/groups/:groupId/settlements/:settlementId/void`

Redis idempotency fail bol accounting write fail closed hiine. Uchiriin ni duplicate ledger entry uusgeh ni financial bug.

## 8. Error Handling

Expected domain error-uudiig `neverthrow`-iin `Result` / `ResultAsync` ashiglan butsaana.

Common error envelope:

```json
{
  "error": {
    "code": "INVALID_SPLIT",
    "message": "Participant amounts must add up to totalAmountMinor.",
    "details": {
      "expectedTotalMinor": 50000,
      "actualTotalMinor": 48000
    }
  }
}
```

HTTP mapping:

| Status | Use |
|---:|---|
| 400 | validation, invalid split, missing idempotency key |
| 401 | unauthenticated |
| 403 | forbidden, not group member |
| 404 | group/expense/settlement not found |
| 409 | idempotency conflict, already voided |
| 422 | ledger not balanced |
| 500 | unexpected server error |
| 503 | required infra unavailable |

## 9. REST API

Base path:

```text
/api
```

### Groups

#### List groups

```http
GET /api/groups
```

Response:

```json
{
  "data": [
    {
      "id": "group_mizorn_lunch",
      "name": "Mizorn Lunch",
      "currency": "MNT",
      "role": "owner",
      "createdAt": "2026-04-27T10:00:00.000Z"
    }
  ]
}
```

#### Create group

```http
POST /api/groups
```

Request:

```json
{
  "name": "Mizorn Lunch",
  "currency": "MNT"
}
```

Response:

```json
{
  "data": {
    "id": "group_mizorn_lunch",
    "name": "Mizorn Lunch",
    "currency": "MNT",
    "role": "owner",
    "createdAt": "2026-04-27T10:00:00.000Z"
  }
}
```

#### Get group

```http
GET /api/groups/:groupId
```

Path params:

```text
groupId: string
```

Response:

```json
{
  "data": {
    "id": "group_mizorn_lunch",
    "name": "Mizorn Lunch",
    "currency": "MNT",
    "myRole": "owner",
    "memberCount": 4,
    "createdAt": "2026-04-27T10:00:00.000Z"
  }
}
```

### Members

#### List members

```http
GET /api/groups/:groupId/members?status=active
```

Query params:

```text
status?: active | invited | removed
```

Response:

```json
{
  "data": [
    {
      "groupId": "group_mizorn_lunch",
      "userId": "user_bataa",
      "name": "Bataa",
      "email": "bataa@example.com",
      "role": "owner",
      "status": "active",
      "joinedAt": "2026-04-27T10:00:00.000Z"
    }
  ]
}
```

#### Add member

```http
POST /api/groups/:groupId/members
```

Request:

```json
{
  "userId": "user_ganaa",
  "role": "member"
}
```

#### Update member role

```http
PATCH /api/groups/:groupId/members/:userId
```

Request:

```json
{
  "role": "admin"
}
```

#### Remove member

```http
DELETE /api/groups/:groupId/members/:userId
```

Remove ni hard delete bish. Membership status `removed` bolno.

### Expenses

#### List expenses

```http
GET /api/groups/:groupId/expenses?status=posted&limit=50
```

Query params:

```text
status?: posted | voided
limit?: number
```

#### Create expense

```http
POST /api/groups/:groupId/expenses
Idempotency-Key: lunch-2026-04-27-bataa-001
```

Request:

```json
{
  "payerUserId": "user_bataa",
  "description": "Lunch at Korean restaurant",
  "occurredOn": "2026-04-27",
  "totalAmountMinor": 50000,
  "splitType": "exact",
  "participants": [
    { "userId": "user_bataa", "amountMinor": 12000 },
    { "userId": "user_ganaa", "amountMinor": 15000 },
    { "userId": "user_bayaraa", "amountMinor": 10000 },
    { "userId": "user_gerlee", "amountMinor": 13000 }
  ]
}
```

Response:

```json
{
  "data": {
    "id": "exp_123",
    "groupId": "group_mizorn_lunch",
    "payerUserId": "user_bataa",
    "description": "Lunch at Korean restaurant",
    "totalAmountMinor": 50000,
    "currency": "MNT",
    "splitType": "exact",
    "status": "posted",
    "occurredOn": "2026-04-27",
    "createdAt": "2026-04-27T12:00:00.000Z",
    "ledgerTransactionId": "ltx_123",
    "ledgerEntries": [
      { "userId": "user_bataa", "amountMinor": 38000 },
      { "userId": "user_ganaa", "amountMinor": -15000 },
      { "userId": "user_bayaraa", "amountMinor": -10000 },
      { "userId": "user_gerlee", "amountMinor": -13000 }
    ]
  }
}
```

#### Get expense

```http
GET /api/groups/:groupId/expenses/:expenseId
```

#### Void expense

```http
POST /api/groups/:groupId/expenses/:expenseId/void
Idempotency-Key: void-expense-123
```

Request:

```json
{
  "reason": "Wrong participant list"
}
```

Voiding ni original expense/ledger entry-g delete hiihgui. Reversal ledger transaction uusgene.

### Balances

#### Get balances

```http
GET /api/groups/:groupId/balances
```

Response:

```json
{
  "data": {
    "groupId": "group_mizorn_lunch",
    "currency": "MNT",
    "balances": [
      { "userId": "user_bataa", "balanceMinor": -35200 },
      { "userId": "user_ganaa", "balanceMinor": 28920 },
      { "userId": "user_bayaraa", "balanceMinor": -1840 },
      { "userId": "user_gerlee", "balanceMinor": 8120 }
    ],
    "asOf": "2026-04-27T14:00:00.000Z"
  }
}
```

### Settlements

#### Preview settlement

```http
GET /api/groups/:groupId/settlements/preview
```

Response:

```json
{
  "data": {
    "groupId": "group_mizorn_lunch",
    "currency": "MNT",
    "balances": [
      { "userId": "user_bataa", "balanceMinor": -35200 },
      { "userId": "user_ganaa", "balanceMinor": 28920 },
      { "userId": "user_bayaraa", "balanceMinor": -1840 },
      { "userId": "user_gerlee", "balanceMinor": 8120 }
    ],
    "suggestedTransfers": [
      { "fromUserId": "user_bataa", "toUserId": "user_ganaa", "amountMinor": 28920 },
      { "fromUserId": "user_bataa", "toUserId": "user_gerlee", "amountMinor": 6280 },
      { "fromUserId": "user_bayaraa", "toUserId": "user_gerlee", "amountMinor": 1840 }
    ],
    "asOf": "2026-04-27T14:00:00.000Z"
  }
}
```

#### Create settlement

```http
POST /api/groups/:groupId/settlements
Idempotency-Key: settle-april-2026
```

Request:

```json
{
  "settledTo": "2026-04-30T23:59:59.000Z",
  "note": "April lunch settlement"
}
```

Behavior:

- owner/admin only
- transaction dotor ajillana
- group-level advisory lock avna
- current balances unshina
- suggested transfers tootsono
- settlement batch/transfers hadgalna
- inverse ledger entries bichij balance zero bolgono

#### List settlements

```http
GET /api/groups/:groupId/settlements?status=posted&limit=50
```

#### Get settlement

```http
GET /api/groups/:groupId/settlements/:settlementId
```

#### Void settlement

```http
POST /api/groups/:groupId/settlements/:settlementId/void
Idempotency-Key: void-settlement-123
```

Voiding ni settlement-g delete hiihgui. Settlement reversal ledger transaction uusgene.

### Ledger Audit

#### List ledger entries

```http
GET /api/groups/:groupId/ledger?userId=user_bataa&type=expense&limit=50
```

Query params:

```text
userId?: string
type?: expense | expense_reversal | settlement | settlement_reversal
from?: ISO timestamp
to?: ISO timestamp
limit?: number
cursor?: ISO timestamp
```

Response:

```json
{
  "data": [
    {
      "id": "le_123",
      "transactionId": "ltx_123",
      "type": "expense",
      "userId": "user_bataa",
      "amountMinor": 38000,
      "currency": "MNT",
      "createdAt": "2026-04-27T12:00:00.000Z"
    }
  ],
  "pagination": {
    "nextCursor": null
  }
}
```

## 10. Settlement Algorithm

Settlement preview ni original lunch buriin debt-iig shuud tulduggui. Group-level net balance ashiglana.

Algorithm:

1. Current balances unshina.
2. Negative balance-tai users = debtors.
3. Positive balance-tai users = creditors.
4. Debt/credit amount-aar sort hiine.
5. Greedy matching hiij `min(debtorRemaining, creditorRemaining)` transfer uusgene.
6. Bukh balance zero boltol davtana.

Example:

| User | Balance |
|---|---:|
| Bataa | -35,200 |
| Ganaa | +28,920 |
| Bayaraa | -1,840 |
| Gerlee | +8,120 |

Suggested transfers:

| From | To | Amount |
|---|---|---:|
| Bataa | Ganaa | 28,920 |
| Bataa | Gerlee | 6,280 |
| Bayaraa | Gerlee | 1,840 |

## 11. OpenAPI Strategy

Elysia OpenAPI plugin defaultoor runtime schema ashigladag. TypeScript return type runtime deer baihgui bolhoor route buriin `response` schema-g TypeBox-oor explicit tavisan.

Schemas ashiglagdaj baigaa gazruud:

- request `params`
- request `query`
- request `body`
- response schemas
- generated OpenAPI docs
- runtime validation

`fromTypes()` bol optional. Ene project deer primary strategy bish. Runtime schema ni status-specific response, error envelope zereg deer iluu predictable.

## 12. File Structure

```text
src/
  auth.ts
  index.ts
  db/
    index.ts
    schema/
      user.ts
      groups.ts
      expenses.ts
      ledger.ts
      settlements.ts
    queries/
      groups.ts
      members.ts
      expenses.ts
      ledger.ts
      settlements.ts
      balances.ts
    views/
      group-member-balances.sql
  lib/
    cache.ts
    errors.ts
    idempotency.ts
    ids.ts
    money.ts
    schemas.ts
    settlement.ts
    types.ts
  plugins/
    auth-guard.ts
  routes/
    groups.ts
    members.ts
    expenses.ts
    balances.ts
    settlements.ts
    ledger.ts
  services/
    groups.ts
    members.ts
    expenses.ts
    balances.ts
    settlements.ts
    ledger.ts
```

Layer responsibilities:

- `routes`: HTTP handler, schema, OpenAPI metadata, response mapping
- `services`: business logic, transaction orchestration, authorization checks
- `db/queries`: small DB operations grouped by domain
- `db/schema`: Drizzle schema
- `lib`: shared helpers/types/schemas

## 13. Testing Plan

Local dependencies:

```bash
docker compose up -d postgres redis
bun run db:push
bun run dev
```

Static validation:

```bash
bun run format:check
bun run lint
bunx tsc --noEmit
bun run build
```

API testing flow:

1. Fetch `GET /openapi/json` and verify paths.
2. Seed Better Auth users: Bataa, Ganaa, Bayaraa, Gerlee.
3. Seed `group_mizorn_lunch` and active memberships.
4. Seed ledger fixture for assignment sample balances:
   - Bataa `-35200`
   - Ganaa `28920`
   - Bayaraa `-1840`
   - Gerlee `8120`
5. Call `GET /api/groups/:groupId/balances`.
6. Call `GET /api/groups/:groupId/settlements/preview`.
7. Verify suggested transfers match expected values.
8. Call `POST /api/groups/:groupId/settlements` with `Idempotency-Key`.
9. Call balances again and verify all balances are zero.
10. Call `GET /api/groups/:groupId/ledger` and verify original + settlement entries exist.
11. Test realistic `POST /expenses` with positive participant amounts.
12. Test void expense and verify reversal ledger entries.

## 14. DB Diagram

DB diagram-iig DBML format-aar hadgalsan:

```text
docs/dbdiagram/lunch-settlement.dbml
```

Ene file-iig [dbdiagram.io](https://dbdiagram.io/home/) deer import hiij ER diagram bolgoj haruulna.

Diagram deer haragdah gol domain relationships:

- `user` -> `group_members`
- `groups` -> `expenses`
- `expenses` -> `expense_participants`
- `groups` -> `ledger_transactions`
- `ledger_transactions` -> `ledger_entries`
- `groups` -> `settlement_batches`
- `settlement_batches` -> `settlement_transfers`

DBML CLI option:

```bash
bunx @dbml/cli dbml2sql docs/dbdiagram/lunch-settlement.dbml -o /tmp/schema.sql
```

Local deer Node `v25.9.0` deer CLI error diagnostic crash hiij baina. Tiimees visual verification-iig dbdiagram.io UI deer hiih ni zuv.

## 15. Railway Deployment Plan

Railway deer app + Railway-managed Postgres + Railway-managed Redis ashiglana.

Steps:

1. `railway login`
2. `railway init`
3. Railway dashboard esvel CLI-aar Postgres service nemne.
4. Railway dashboard esvel CLI-aar Redis service nemne.
5. App service deer env variables set hiine:
   - `DATABASE_URL`
   - `REDIS_URL`
   - `BETTER_AUTH_SECRET`
   - `BETTER_AUTH_URL`
6. Deploy:
   - `railway up`
7. Migration:
   - `railway run bun run db:push`
8. Smoke test:
   - `GET /openapi`
   - `GET /openapi/json`
   - `GET /api/health`

Railway deer `PORT` dynamic baij bolno. App already `process.env.PORT ?? 3000` ashigladag.

Production-ish notes:

- `BETTER_AUTH_SECRET` local default bish strong random value baih yostoi.
- `BETTER_AUTH_URL` ni Railway public domain baih yostoi.
- CORS origin-iig frontend domain medegdeheer ni update hiine.
- Migration-g deploy bolgon deer avtomataar ajilluulah uu, manual `railway run bun run db:push` hiih uu gedgee todorhoilno.

## 16. Requirement Match

Original daalgavartai taarah baidal:

- Backend-only service: implemented.
- REST API: implemented.
- Endpoint input/output documented: `plan.md` + OpenAPI.
- Database design: Drizzle schemas + generated migration.
- Group support: implemented.
- One user many groups: implemented through `group_members`.
- Group-scoped balances: implemented.
- Different participants per lunch: implemented.
- Different meal costs: implemented by exact split participant amounts.
- Daily bank transfer avoid: solved through derived balances.
- Bulk settlement: implemented.
- Balance reset after settlement: implemented through offsetting ledger entries.
- Code organization: layered routes/services/queries/schema/lib.

## 17. Why This Design Is Strong

Ene design junior-level CRUD bish. Production system design-iin sanaanuud orson:

- Ledger-based immutable accounting.
- Derived balances, mutable balance bugs baihgui.
- Transactional accounting writes.
- Group-level advisory lock settlement deer ashiglasan.
- Reversal-based correction.
- Redis fail behavior sanasan.
- Idempotency on financial writes.
- Runtime validation and generated OpenAPI.
- Domain error modeling with `neverthrow`.

Main interview sentence:

> Bi ene daalgavriig jijig accounting system gej uzej hiisen: ledger entries ni source of truth, balance ni derived state, settlement ni batch transaction, correction ni reversal bolohoos delete bish.
