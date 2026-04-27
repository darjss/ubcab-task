-- SQL dump generated using DBML (dbml.dbdiagram.io)
-- Database: PostgreSQL
-- Generated at: 2026-04-27T03:47:24.486Z

CREATE TYPE "group_member_role" AS ENUM (
  'owner',
  'admin',
  'member'
);

CREATE TYPE "group_member_status" AS ENUM (
  'active',
  'invited',
  'removed'
);

CREATE TYPE "split_type" AS ENUM (
  'exact',
  'equal',
  'percentage',
  'shares'
);

CREATE TYPE "expense_status" AS ENUM (
  'posted',
  'voided'
);

CREATE TYPE "ledger_transaction_type" AS ENUM (
  'expense',
  'expense_reversal',
  'settlement',
  'settlement_reversal'
);

CREATE TYPE "ledger_entry_type" AS ENUM (
  'expense',
  'expense_reversal',
  'settlement',
  'settlement_reversal'
);

CREATE TYPE "settlement_status" AS ENUM (
  'posted',
  'voided'
);

CREATE TYPE "settlement_transfer_status" AS ENUM (
  'suggested',
  'confirmed'
);

CREATE TABLE "user" (
  "id" text PRIMARY KEY,
  "name" text NOT NULL,
  "email" text UNIQUE NOT NULL,
  "email_verified" boolean NOT NULL DEFAULT false,
  "image" text,
  "created_at" timestamp NOT NULL DEFAULT (now()),
  "updated_at" timestamp NOT NULL DEFAULT (now())
);

CREATE TABLE "session" (
  "id" text PRIMARY KEY,
  "expires_at" timestamp NOT NULL,
  "token" text UNIQUE NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT (now()),
  "updated_at" timestamp NOT NULL DEFAULT (now()),
  "ip_address" text,
  "user_agent" text,
  "user_id" text NOT NULL
);

CREATE TABLE "account" (
  "id" text PRIMARY KEY,
  "account_id" text NOT NULL,
  "provider_id" text NOT NULL,
  "user_id" text NOT NULL,
  "access_token" text,
  "refresh_token" text,
  "id_token" text,
  "access_token_expires_at" timestamp,
  "refresh_token_expires_at" timestamp,
  "scope" text,
  "password" text,
  "created_at" timestamp NOT NULL DEFAULT (now()),
  "updated_at" timestamp NOT NULL DEFAULT (now())
);

CREATE TABLE "verification" (
  "id" text PRIMARY KEY,
  "identifier" text NOT NULL,
  "value" text NOT NULL,
  "expires_at" timestamp NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT (now()),
  "updated_at" timestamp NOT NULL DEFAULT (now())
);

CREATE TABLE "groups" (
  "id" text PRIMARY KEY,
  "name" text NOT NULL,
  "currency" text NOT NULL DEFAULT 'MNT',
  "created_by_user_id" text NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT (now()),
  "updated_at" timestamp NOT NULL DEFAULT (now()),
  "archived_at" timestamp
);

CREATE TABLE "group_members" (
  "group_id" text NOT NULL,
  "user_id" text NOT NULL,
  "role" group_member_role NOT NULL DEFAULT 'member',
  "status" group_member_status NOT NULL DEFAULT 'active',
  "joined_at" timestamp,
  "removed_at" timestamp,
  "created_at" timestamp NOT NULL DEFAULT (now()),
  "updated_at" timestamp NOT NULL DEFAULT (now())
);

CREATE TABLE "expenses" (
  "id" text PRIMARY KEY,
  "group_id" text NOT NULL,
  "payer_user_id" text NOT NULL,
  "created_by_user_id" text NOT NULL,
  "description" text,
  "total_amount_minor" bigint NOT NULL,
  "currency" text NOT NULL DEFAULT 'MNT',
  "split_type" split_type NOT NULL DEFAULT 'exact',
  "status" expense_status NOT NULL DEFAULT 'posted',
  "occurred_on" date NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT (now()),
  "voided_at" timestamp,
  "voided_by_user_id" text
);

CREATE TABLE "expense_participants" (
  "expense_id" text NOT NULL,
  "user_id" text NOT NULL,
  "amount_minor" bigint,
  "share_count" integer,
  "percentage" numeric,
  "created_at" timestamp NOT NULL DEFAULT (now())
);

CREATE TABLE "ledger_transactions" (
  "id" text PRIMARY KEY,
  "group_id" text NOT NULL,
  "type" ledger_transaction_type NOT NULL,
  "source_id" text NOT NULL,
  "reverses_transaction_id" text,
  "created_by_user_id" text NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT (now())
);

CREATE TABLE "ledger_entries" (
  "id" text PRIMARY KEY,
  "transaction_id" text NOT NULL,
  "group_id" text NOT NULL,
  "user_id" text NOT NULL,
  "amount_minor" bigint NOT NULL,
  "currency" text NOT NULL DEFAULT 'MNT',
  "entry_type" ledger_entry_type NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT (now())
);

CREATE TABLE "settlement_batches" (
  "id" text PRIMARY KEY,
  "group_id" text NOT NULL,
  "created_by_user_id" text NOT NULL,
  "status" settlement_status NOT NULL DEFAULT 'posted',
  "settled_from" timestamp,
  "settled_to" timestamp NOT NULL,
  "note" text,
  "created_at" timestamp NOT NULL DEFAULT (now()),
  "voided_at" timestamp,
  "voided_by_user_id" text
);

CREATE TABLE "settlement_transfers" (
  "id" text PRIMARY KEY,
  "settlement_batch_id" text NOT NULL,
  "from_user_id" text NOT NULL,
  "to_user_id" text NOT NULL,
  "amount_minor" bigint NOT NULL,
  "currency" text NOT NULL DEFAULT 'MNT',
  "status" settlement_transfer_status NOT NULL DEFAULT 'suggested',
  "created_at" timestamp NOT NULL DEFAULT (now())
);

CREATE TABLE "group_member_balances_view" (
  "group_id" text,
  "user_id" text,
  "currency" text,
  "balance_minor" bigint
);

CREATE INDEX "session_userId_idx" ON "session" ("user_id");

CREATE INDEX "account_userId_idx" ON "account" ("user_id");

CREATE INDEX "verification_identifier_idx" ON "verification" ("identifier");

CREATE INDEX "groups_created_by_user_id_idx" ON "groups" ("created_by_user_id");

CREATE INDEX "groups_archived_at_idx" ON "groups" ("archived_at");

CREATE UNIQUE INDEX "group_members_group_id_user_id_unique" ON "group_members" ("group_id", "user_id");

CREATE INDEX "group_members_user_id_idx" ON "group_members" ("user_id");

CREATE INDEX "group_members_group_id_status_idx" ON "group_members" ("group_id", "status");

CREATE INDEX "expenses_group_id_occurred_on_idx" ON "expenses" ("group_id", "occurred_on");

CREATE INDEX "expenses_group_id_status_idx" ON "expenses" ("group_id", "status");

CREATE INDEX "expenses_payer_user_id_idx" ON "expenses" ("payer_user_id");

CREATE UNIQUE INDEX "expense_participants_expense_id_user_id_unique" ON "expense_participants" ("expense_id", "user_id");

CREATE INDEX "expense_participants_user_id_idx" ON "expense_participants" ("user_id");

CREATE INDEX "ledger_transactions_group_id_created_at_idx" ON "ledger_transactions" ("group_id", "created_at");

CREATE INDEX "ledger_transactions_source_id_idx" ON "ledger_transactions" ("source_id");

CREATE INDEX "ledger_transactions_reverses_transaction_id_idx" ON "ledger_transactions" ("reverses_transaction_id");

CREATE INDEX "ledger_entries_group_id_user_id_idx" ON "ledger_entries" ("group_id", "user_id");

CREATE INDEX "ledger_entries_transaction_id_idx" ON "ledger_entries" ("transaction_id");

CREATE INDEX "ledger_entries_group_id_created_at_idx" ON "ledger_entries" ("group_id", "created_at");

CREATE INDEX "settlement_batches_group_id_created_at_idx" ON "settlement_batches" ("group_id", "created_at");

CREATE INDEX "settlement_batches_group_id_status_idx" ON "settlement_batches" ("group_id", "status");

CREATE INDEX "settlement_transfers_batch_id_idx" ON "settlement_transfers" ("settlement_batch_id");

CREATE INDEX "settlement_transfers_from_user_id_idx" ON "settlement_transfers" ("from_user_id");

CREATE INDEX "settlement_transfers_to_user_id_idx" ON "settlement_transfers" ("to_user_id");

COMMENT ON TABLE "user" IS 'Better Auth user table. Domain records reference user.id.';

COMMENT ON TABLE "group_members" IS 'Membership is group-scoped. Same user can have different roles in different groups.';

COMMENT ON TABLE "expense_participants" IS 'MVP exact split uses amount_minor. share_count and percentage are for future split types.';

COMMENT ON TABLE "ledger_transactions" IS 'Groups ledger entries under one accounting event.';

COMMENT ON TABLE "ledger_entries" IS 'Source of truth for balances. DB: amount_minor <> 0. App: SUM per transaction = 0.';

COMMENT ON TABLE "settlement_transfers" IS 'Stored transfer plan from settlement time. Do not recalculate historical settlements.';

COMMENT ON TABLE "group_member_balances_view" IS 'PostgreSQL VIEW group_member_balances_view (not a physical table).';

ALTER TABLE "session" ADD FOREIGN KEY ("user_id") REFERENCES "user" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "account" ADD FOREIGN KEY ("user_id") REFERENCES "user" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "groups" ADD FOREIGN KEY ("created_by_user_id") REFERENCES "user" ("id") ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "group_members" ADD FOREIGN KEY ("group_id") REFERENCES "groups" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "group_members" ADD FOREIGN KEY ("user_id") REFERENCES "user" ("id") ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "expenses" ADD FOREIGN KEY ("group_id") REFERENCES "groups" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "expenses" ADD FOREIGN KEY ("payer_user_id") REFERENCES "user" ("id") ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "expenses" ADD FOREIGN KEY ("created_by_user_id") REFERENCES "user" ("id") ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "expenses" ADD FOREIGN KEY ("voided_by_user_id") REFERENCES "user" ("id") ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "expense_participants" ADD FOREIGN KEY ("expense_id") REFERENCES "expenses" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "expense_participants" ADD FOREIGN KEY ("user_id") REFERENCES "user" ("id") ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "ledger_transactions" ADD FOREIGN KEY ("group_id") REFERENCES "groups" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "ledger_transactions" ADD FOREIGN KEY ("created_by_user_id") REFERENCES "user" ("id") ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "ledger_transactions" ADD FOREIGN KEY ("reverses_transaction_id") REFERENCES "ledger_transactions" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "ledger_entries" ADD FOREIGN KEY ("transaction_id") REFERENCES "ledger_transactions" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "ledger_entries" ADD FOREIGN KEY ("group_id") REFERENCES "groups" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "ledger_entries" ADD FOREIGN KEY ("user_id") REFERENCES "user" ("id") ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "settlement_batches" ADD FOREIGN KEY ("group_id") REFERENCES "groups" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "settlement_batches" ADD FOREIGN KEY ("created_by_user_id") REFERENCES "user" ("id") ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "settlement_batches" ADD FOREIGN KEY ("voided_by_user_id") REFERENCES "user" ("id") ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "settlement_transfers" ADD FOREIGN KEY ("settlement_batch_id") REFERENCES "settlement_batches" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "settlement_transfers" ADD FOREIGN KEY ("from_user_id") REFERENCES "user" ("id") ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "settlement_transfers" ADD FOREIGN KEY ("to_user_id") REFERENCES "user" ("id") ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "group_member_balances_view" ADD FOREIGN KEY ("group_id") REFERENCES "groups" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "group_member_balances_view" ADD FOREIGN KEY ("user_id") REFERENCES "user" ("id") DEFERRABLE INITIALLY IMMEDIATE;
