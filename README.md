# Lunch Settlement Backend

Ene project ni ajilchdiin hamtiin hoolnii zardliig udur bur bankaar shiljuulehgui, group dotor avlaga/ugluguur ni hutuldug backend REST API yum. Gol sanaa ni mutable balance hadgalah bish, immutable ledger entry-g source of truth bolgood balance-iig ledger sum-aas tootsoh.

## Tech Stack

- Runtime/framework: Bun + ElysiaJS
- API documentation: Elysia OpenAPI plugin + Scalar UI
- Auth: Better Auth
- Database: PostgreSQL + Drizzle ORM
- Cache/idempotency: Redis
- Validation/docs schema: Elysia TypeBox
- Domain error handling: neverthrow

## URLs

### Local

- API root: `http://localhost:3000`
- Scalar UI: `http://localhost:3000/openapi`
- OpenAPI JSON: `http://localhost:3000/openapi/json`
- Auth mount: `/auth`
- Domain API prefix: `/api`

### Production (Railway)

- **API base:** [https://ubcab-task-production.up.railway.app](https://ubcab-task-production.up.railway.app)
- **Scalar / OpenAPI:** [https://ubcab-task-production.up.railway.app/openapi](https://ubcab-task-production.up.railway.app/openapi)
- **Groups in docs (deep link):** [https://ubcab-task-production.up.railway.app/openapi#tag/groups](https://ubcab-task-production.up.railway.app/openapi#tag/groups)

`package.json` sets `homepage` to the OpenAPI URL. In GitHub, set the repo **About → Website** (or **Settings → General → Website**) to the same link so the repo header matches production docs.

## Drizzle Studio

Browse and edit data with [Drizzle Kit Studio](https://orm.drizzle.team/kit-docs/studio) (uses `DATABASE_URL` from `.env` via `drizzle.config.ts`):

```bash
bun run db:studio
```

Default UI: `http://localhost:4983`. For the hosted Railway database from your machine, point `DATABASE_URL` at the Postgres **public** URL (see Railway Postgres variables → `DATABASE_PUBLIC_URL`), then run the command.

## Quick API checks (curl)

Production examples:

```bash
curl -sS "https://ubcab-task-production.up.railway.app/api/health"
curl -sS "https://ubcab-task-production.up.railway.app/api/benchmark"
curl -sS "https://ubcab-task-production.up.railway.app/openapi/json" | head -c 400
```

Or run the bundled smoke script (health, benchmark, model count, root):

```bash
./scripts/smoke-prod.sh
# optional: ./scripts/smoke-prod.sh https://other-host.example.com
```

**OpenAPI models:** the spec merges Better Auth `User` / `Session` / `Account` with all lunch-domain DTOs (`GroupResponse`, `BalanceResponse`, `LedgerAuditEntry`, `DataListGroup`, …) under **components → schemas** in Scalar (Models). Redeploy after changing `src/lib/openapi-domain-schemas.ts` or `src/lib/schemas.ts` for production `/openapi/json` to update.

Authenticated routes need a Better Auth session cookie from `/auth/api/...` (see Scalar **Auth** section).

## Local Setup

Docker deer Postgres, Redis aschihsan gej uzvel:

```bash
bun install
bun run db:push
bun run dev
```

Herev Docker service uudaa shineer asah bol:

```bash
docker compose up -d postgres redis
```

`.env.example` deer local default connection baina:

```text
DATABASE_URL="postgresql://betterauth:betterauth@localhost:5432/betterauth?schema=public"
REDIS_URL="redis://localhost:6379"
BETTER_AUTH_SECRET="change-me-to-a-random-string"
BETTER_AUTH_URL="http://localhost:3000"
```

## Validation Commands

```bash
bun run format:check
bun run lint
bunx tsc --noEmit
bun run build
```

Ene project deer deerh buh check odoogoor pass hiij baina.

## Implemented Domain

Group:

- `GET /api/groups`
- `POST /api/groups`
- `GET /api/groups/:groupId`

Members:

- `GET /api/groups/:groupId/members`
- `POST /api/groups/:groupId/members`
- `PATCH /api/groups/:groupId/members/:userId`
- `DELETE /api/groups/:groupId/members/:userId`

Expenses:

- `GET /api/groups/:groupId/expenses`
- `POST /api/groups/:groupId/expenses`
- `GET /api/groups/:groupId/expenses/:expenseId`
- `POST /api/groups/:groupId/expenses/:expenseId/void`

Balances:

- `GET /api/groups/:groupId/balances`

Settlements:

- `GET /api/groups/:groupId/settlements/preview`
- `POST /api/groups/:groupId/settlements`
- `GET /api/groups/:groupId/settlements`
- `GET /api/groups/:groupId/settlements/:settlementId`
- `POST /api/groups/:groupId/settlements/:settlementId/void`

Ledger audit:

- `GET /api/groups/:groupId/ledger`

Benchmark (no auth; Redis + Postgres latency):

- `GET /api/benchmark`

## Accounting Design

Ene system-iig engiin CRUD bish jijig accounting system shig hiisen.

- `ledger_entries` bol source of truth.
- Positive balance gevel tuhain hun mungu avah yostoi.
- Negative balance gevel tuhain hun mungu tuluh yostoi.
- Expense bol balanced ledger transaction uusgene.
- Settlement commit hiih ued current balance-uudiin esreg ledger entries bichij balance-iig zero bolgono.
- Aldaa zasahdaa delete hiihgui, reversal ledger transaction bichne.

Ledger invariant:

```text
SUM(ledger_entries.amount_minor) per transaction = 0
```

## Redis Usage

Redis-iig accounting storage bolgoj ashiglaaguI.

- Idempotency key hadgalna.
- Balance/settlement preview short TTL cache hiine.
- Ledger-changing write amjilttai bol cache invalidate hiine.
- Accounting write deer Redis idempotency ajillahgui bol fail closed hiine.

## OpenAPI

Elysia OpenAPI plugin defaultoor runtime schema ashigladag. Tiimees route-uud deer TypeBox `body`, `params`, `query`, `response` schema-g explicit tavisan.

Scalar UI:

```text
GET /openapi
```

OpenAPI JSON:

```text
GET /openapi/json
```

## DB Diagram

DBML diagram file:

```text
docs/dbdiagram/lunch-settlement.dbml
```

Rendered PNG (same schema, quick view):

```text
db-diagram.png
```

Ene file-iig [dbdiagram.io](https://dbdiagram.io/home/) deer import/paste hiivel ER diagram haragdana.

DBML CLI baigaa:

```bash
bunx @dbml/cli dbml2sql docs/dbdiagram/lunch-settlement.dbml -o /tmp/schema.sql
```

Note: local deer `@dbml/cli` Node `v25.9.0` deer parser error-g sain hevlej chadahgui crash hiij baina. dbdiagram.io UI deer import hiij shalgah ni iluu naidvartai. CLI package ni alban yosnii `@dbml/cli` package ba DBML docs deer `dbml2sql`, `sql2dbml`, `db2dbml` commands-tai gej documentlogdson.

## Railway Deployment Plan

Railway CLI ashiglah bol service-ees tusdaa Railway Postgres, Redis uusgene.

High-level flow:

```bash
railway login
railway init
railway add --database postgres
railway add --database redis
railway variables
```

Set variables:

```text
DATABASE_URL=<Railway Postgres connection string>
REDIS_URL=<Railway Redis connection string>
BETTER_AUTH_SECRET=<strong random secret>
BETTER_AUTH_URL=<Railway app public URL>
PORT=<Railway provided port, app already reads process.env.PORT>
```

Deploy:

```bash
railway up
railway run bun run db:push
```

Railway deer deploy hiisnii daraa:

- `GET /openapi`
- `GET /openapi/json`
- `GET /api/health`
- `GET /api/benchmark`

gej smoke test hiine.

## Folder Structure

```text
src/
  auth.ts
  index.ts
  db/
    schema/
    queries/
    views/
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
  services/
```

Layering:

- `routes`: HTTP handler, auth macro, TypeBox schema, response mapping
- `services`: business rule, transaction orchestration, neverthrow result
- `db/schema`: Drizzle table definitions
- `db/queries`: small grouped DB access functions
- `lib`: shared helpers and schemas

## Assignment Fit

Ene implementation ni original daalgavriin gol shaardlaguudiig hangana:

- Backend-only REST API.
- Group uusgej bolno.
- Neg user olon group-d baij bolno.
- Group bur tusdaa balance-toi.
- Hoolnii udur bur uur participant list, uur meal cost avna.
- Udur bur transfer hiihguigeer balance hutulnu.
- Periodiin daraa settlement preview haruulna.
- Settlement commit hiigeed balance zero bolgono.
- Input/output docs ni `plan.md` bolon generated OpenAPI deer baina.

