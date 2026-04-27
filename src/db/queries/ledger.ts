import { and, desc, eq, gte, lt, lte } from "drizzle-orm";
import { db } from "~/db";
import { ledgerEntries, ledgerTransactions } from "~/db/schema";
import type {
	LedgerEntryType,
	NewLedgerEntry,
	NewLedgerTransaction,
} from "~/lib/types";
import type { QueryClient } from "./client";

export const ledgerQueries = {
	createTransaction: async (
		transaction: NewLedgerTransaction,
		client: QueryClient = db,
	) => {
		const [created] = await client
			.insert(ledgerTransactions)
			.values(transaction)
			.returning();
		return created;
	},

	createEntries: async (
		entries: NewLedgerEntry[],
		client: QueryClient = db,
	) => {
		if (entries.length === 0) return [];
		return client.insert(ledgerEntries).values(entries).returning();
	},

	findTransactionById: async (
		transactionId: string,
		client: QueryClient = db,
	) => {
		const [transaction] = await client
			.select()
			.from(ledgerTransactions)
			.where(eq(ledgerTransactions.id, transactionId))
			.limit(1);

		return transaction ?? null;
	},

	findTransactionBySource: async (
		groupId: string,
		sourceId: string,
		type: "expense" | "settlement",
		client: QueryClient = db,
	) => {
		const [transaction] = await client
			.select()
			.from(ledgerTransactions)
			.where(
				and(
					eq(ledgerTransactions.groupId, groupId),
					eq(ledgerTransactions.sourceId, sourceId),
					eq(ledgerTransactions.type, type),
				),
			)
			.limit(1);

		return transaction ?? null;
	},

	listEntriesByTransaction: async (
		transactionId: string,
		client: QueryClient = db,
	) => {
		return client
			.select()
			.from(ledgerEntries)
			.where(eq(ledgerEntries.transactionId, transactionId));
	},

	listEntriesByGroup: async (
		groupId: string,
		options: {
			userId?: string;
			type?: LedgerEntryType;
			from?: Date;
			to?: Date;
			limit?: number;
			cursor?: Date;
		} = {},
		client: QueryClient = db,
	) => {
		const conditions = [eq(ledgerEntries.groupId, groupId)];

		if (options.userId)
			conditions.push(eq(ledgerEntries.userId, options.userId));
		if (options.type)
			conditions.push(eq(ledgerEntries.entryType, options.type));
		if (options.from)
			conditions.push(gte(ledgerEntries.createdAt, options.from));
		if (options.to) conditions.push(lte(ledgerEntries.createdAt, options.to));
		if (options.cursor)
			conditions.push(lt(ledgerEntries.createdAt, options.cursor));

		return client
			.select()
			.from(ledgerEntries)
			.where(and(...conditions))
			.orderBy(desc(ledgerEntries.createdAt), desc(ledgerEntries.id))
			.limit(options.limit ?? 50);
	},
};
