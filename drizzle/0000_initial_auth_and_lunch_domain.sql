CREATE TYPE "public"."group_member_role" AS ENUM('owner', 'admin', 'member');--> statement-breakpoint
CREATE TYPE "public"."group_member_status" AS ENUM('active', 'invited', 'removed');--> statement-breakpoint
CREATE TYPE "public"."expense_status" AS ENUM('posted', 'voided');--> statement-breakpoint
CREATE TYPE "public"."split_type" AS ENUM('exact', 'equal', 'percentage', 'shares');--> statement-breakpoint
CREATE TYPE "public"."ledger_entry_type" AS ENUM('expense', 'expense_reversal', 'settlement', 'settlement_reversal');--> statement-breakpoint
CREATE TYPE "public"."ledger_transaction_type" AS ENUM('expense', 'expense_reversal', 'settlement', 'settlement_reversal');--> statement-breakpoint
CREATE TYPE "public"."settlement_status" AS ENUM('posted', 'voided');--> statement-breakpoint
CREATE TYPE "public"."settlement_transfer_status" AS ENUM('suggested', 'confirmed');--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
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
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "group_members" (
	"group_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" "group_member_role" DEFAULT 'member' NOT NULL,
	"status" "group_member_status" DEFAULT 'active' NOT NULL,
	"joined_at" timestamp,
	"removed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "groups" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"currency" text DEFAULT 'MNT' NOT NULL,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"archived_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "expense_participants" (
	"expense_id" text NOT NULL,
	"user_id" text NOT NULL,
	"amount_minor" bigint,
	"share_count" integer,
	"percentage" numeric,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "expenses" (
	"id" text PRIMARY KEY NOT NULL,
	"group_id" text NOT NULL,
	"payer_user_id" text NOT NULL,
	"created_by_user_id" text NOT NULL,
	"description" text,
	"total_amount_minor" bigint NOT NULL,
	"currency" text DEFAULT 'MNT' NOT NULL,
	"split_type" "split_type" DEFAULT 'exact' NOT NULL,
	"status" "expense_status" DEFAULT 'posted' NOT NULL,
	"occurred_on" date NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"voided_at" timestamp,
	"voided_by_user_id" text
);
--> statement-breakpoint
CREATE TABLE "ledger_entries" (
	"id" text PRIMARY KEY NOT NULL,
	"transaction_id" text NOT NULL,
	"group_id" text NOT NULL,
	"user_id" text NOT NULL,
	"amount_minor" bigint NOT NULL,
	"currency" text DEFAULT 'MNT' NOT NULL,
	"entry_type" "ledger_entry_type" NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "ledger_entries_amount_minor_non_zero" CHECK ("ledger_entries"."amount_minor" <> 0)
);
--> statement-breakpoint
CREATE TABLE "ledger_transactions" (
	"id" text PRIMARY KEY NOT NULL,
	"group_id" text NOT NULL,
	"type" "ledger_transaction_type" NOT NULL,
	"source_id" text NOT NULL,
	"reverses_transaction_id" text,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settlement_batches" (
	"id" text PRIMARY KEY NOT NULL,
	"group_id" text NOT NULL,
	"created_by_user_id" text NOT NULL,
	"status" "settlement_status" DEFAULT 'posted' NOT NULL,
	"settled_from" timestamp,
	"settled_to" timestamp NOT NULL,
	"note" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"voided_at" timestamp,
	"voided_by_user_id" text
);
--> statement-breakpoint
CREATE TABLE "settlement_transfers" (
	"id" text PRIMARY KEY NOT NULL,
	"settlement_batch_id" text NOT NULL,
	"from_user_id" text NOT NULL,
	"to_user_id" text NOT NULL,
	"amount_minor" bigint NOT NULL,
	"currency" text DEFAULT 'MNT' NOT NULL,
	"status" "settlement_transfer_status" DEFAULT 'suggested' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_members" ADD CONSTRAINT "group_members_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_members" ADD CONSTRAINT "group_members_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "groups" ADD CONSTRAINT "groups_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_participants" ADD CONSTRAINT "expense_participants_expense_id_expenses_id_fk" FOREIGN KEY ("expense_id") REFERENCES "public"."expenses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_participants" ADD CONSTRAINT "expense_participants_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_payer_user_id_user_id_fk" FOREIGN KEY ("payer_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_voided_by_user_id_user_id_fk" FOREIGN KEY ("voided_by_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_transaction_id_ledger_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."ledger_transactions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_transactions" ADD CONSTRAINT "ledger_transactions_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_transactions" ADD CONSTRAINT "ledger_transactions_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settlement_batches" ADD CONSTRAINT "settlement_batches_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settlement_batches" ADD CONSTRAINT "settlement_batches_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settlement_batches" ADD CONSTRAINT "settlement_batches_voided_by_user_id_user_id_fk" FOREIGN KEY ("voided_by_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settlement_transfers" ADD CONSTRAINT "settlement_transfers_settlement_batch_id_settlement_batches_id_fk" FOREIGN KEY ("settlement_batch_id") REFERENCES "public"."settlement_batches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settlement_transfers" ADD CONSTRAINT "settlement_transfers_from_user_id_user_id_fk" FOREIGN KEY ("from_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settlement_transfers" ADD CONSTRAINT "settlement_transfers_to_user_id_user_id_fk" FOREIGN KEY ("to_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_userId_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "session_userId_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");--> statement-breakpoint
CREATE UNIQUE INDEX "group_members_group_id_user_id_unique" ON "group_members" USING btree ("group_id","user_id");--> statement-breakpoint
CREATE INDEX "group_members_user_id_idx" ON "group_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "group_members_group_id_status_idx" ON "group_members" USING btree ("group_id","status");--> statement-breakpoint
CREATE INDEX "groups_created_by_user_id_idx" ON "groups" USING btree ("created_by_user_id");--> statement-breakpoint
CREATE INDEX "groups_archived_at_idx" ON "groups" USING btree ("archived_at");--> statement-breakpoint
CREATE UNIQUE INDEX "expense_participants_expense_id_user_id_unique" ON "expense_participants" USING btree ("expense_id","user_id");--> statement-breakpoint
CREATE INDEX "expense_participants_user_id_idx" ON "expense_participants" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "expenses_group_id_occurred_on_idx" ON "expenses" USING btree ("group_id","occurred_on");--> statement-breakpoint
CREATE INDEX "expenses_group_id_status_idx" ON "expenses" USING btree ("group_id","status");--> statement-breakpoint
CREATE INDEX "expenses_payer_user_id_idx" ON "expenses" USING btree ("payer_user_id");--> statement-breakpoint
CREATE INDEX "ledger_entries_group_id_user_id_idx" ON "ledger_entries" USING btree ("group_id","user_id");--> statement-breakpoint
CREATE INDEX "ledger_entries_transaction_id_idx" ON "ledger_entries" USING btree ("transaction_id");--> statement-breakpoint
CREATE INDEX "ledger_entries_group_id_created_at_idx" ON "ledger_entries" USING btree ("group_id","created_at");--> statement-breakpoint
CREATE INDEX "ledger_transactions_group_id_created_at_idx" ON "ledger_transactions" USING btree ("group_id","created_at");--> statement-breakpoint
CREATE INDEX "ledger_transactions_source_id_idx" ON "ledger_transactions" USING btree ("source_id");--> statement-breakpoint
CREATE INDEX "ledger_transactions_reverses_transaction_id_idx" ON "ledger_transactions" USING btree ("reverses_transaction_id");--> statement-breakpoint
CREATE INDEX "settlement_batches_group_id_created_at_idx" ON "settlement_batches" USING btree ("group_id","created_at");--> statement-breakpoint
CREATE INDEX "settlement_batches_group_id_status_idx" ON "settlement_batches" USING btree ("group_id","status");--> statement-breakpoint
CREATE INDEX "settlement_transfers_batch_id_idx" ON "settlement_transfers" USING btree ("settlement_batch_id");--> statement-breakpoint
CREATE INDEX "settlement_transfers_from_user_id_idx" ON "settlement_transfers" USING btree ("from_user_id");--> statement-breakpoint
CREATE INDEX "settlement_transfers_to_user_id_idx" ON "settlement_transfers" USING btree ("to_user_id");-- Derived balance view for the lunch settlement ledger.
--
-- Source of truth: ledger_entries
-- Current balance: SUM(amount_minor) per group/user/currency
--
-- Positive balance means the user should receive money.
-- Negative balance means the user owes money.
-- Zero balance means the user is settled.
--
-- This view intentionally does not store mutable balances. Redis may cache
-- responses that use this view, but Redis is never the accounting source of truth.

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
