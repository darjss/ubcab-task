import { relations, sql } from "drizzle-orm";
import {
	bigint,
	check,
	index,
	pgEnum,
	pgTable,
	text,
	timestamp,
} from "drizzle-orm/pg-core";
import { groups } from "./groups";
import { user } from "./user";

export const ledgerTransactionType = pgEnum("ledger_transaction_type", [
	"expense",
	"expense_reversal",
	"settlement",
	"settlement_reversal",
]);

export const ledgerEntryType = pgEnum("ledger_entry_type", [
	"expense",
	"expense_reversal",
	"settlement",
	"settlement_reversal",
]);

export const ledgerTransactions = pgTable(
	"ledger_transactions",
	{
		id: text("id").primaryKey(),
		groupId: text("group_id")
			.notNull()
			.references(() => groups.id, { onDelete: "cascade" }),
		type: ledgerTransactionType("type").notNull(),
		sourceId: text("source_id").notNull(),
		reversesTransactionId: text("reverses_transaction_id"),
		createdByUserId: text("created_by_user_id")
			.notNull()
			.references(() => user.id, { onDelete: "restrict" }),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		index("ledger_transactions_group_id_created_at_idx").on(
			table.groupId,
			table.createdAt,
		),
		index("ledger_transactions_source_id_idx").on(table.sourceId),
		index("ledger_transactions_reverses_transaction_id_idx").on(
			table.reversesTransactionId,
		),
	],
);

export const ledgerEntries = pgTable(
	"ledger_entries",
	{
		id: text("id").primaryKey(),
		transactionId: text("transaction_id")
			.notNull()
			.references(() => ledgerTransactions.id, { onDelete: "cascade" }),
		groupId: text("group_id")
			.notNull()
			.references(() => groups.id, { onDelete: "cascade" }),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "restrict" }),
		amountMinor: bigint("amount_minor", { mode: "number" }).notNull(),
		currency: text("currency").default("MNT").notNull(),
		entryType: ledgerEntryType("entry_type").notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		check(
			"ledger_entries_amount_minor_non_zero",
			sql`${table.amountMinor} <> 0`,
		),
		index("ledger_entries_group_id_user_id_idx").on(
			table.groupId,
			table.userId,
		),
		index("ledger_entries_transaction_id_idx").on(table.transactionId),
		index("ledger_entries_group_id_created_at_idx").on(
			table.groupId,
			table.createdAt,
		),
	],
);

export const ledgerTransactionsRelations = relations(
	ledgerTransactions,
	({ one, many }) => ({
		group: one(groups, {
			fields: [ledgerTransactions.groupId],
			references: [groups.id],
		}),
		createdBy: one(user, {
			fields: [ledgerTransactions.createdByUserId],
			references: [user.id],
		}),
		reversesTransaction: one(ledgerTransactions, {
			fields: [ledgerTransactions.reversesTransactionId],
			references: [ledgerTransactions.id],
		}),
		entries: many(ledgerEntries),
	}),
);

export const ledgerEntriesRelations = relations(ledgerEntries, ({ one }) => ({
	transaction: one(ledgerTransactions, {
		fields: [ledgerEntries.transactionId],
		references: [ledgerTransactions.id],
	}),
	group: one(groups, {
		fields: [ledgerEntries.groupId],
		references: [groups.id],
	}),
	user: one(user, {
		fields: [ledgerEntries.userId],
		references: [user.id],
	}),
}));
