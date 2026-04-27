import { and, desc, eq } from "drizzle-orm";
import { db } from "~/db";
import { settlementBatches, settlementTransfers } from "~/db/schema";
import type {
	NewSettlementBatch,
	NewSettlementTransfer,
	SettlementStatus,
} from "~/lib/types";
import type { QueryClient } from "./client";

export const settlementQueries = {
	createBatch: async (batch: NewSettlementBatch, client: QueryClient = db) => {
		const [created] = await client
			.insert(settlementBatches)
			.values(batch)
			.returning();
		return created;
	},

	createTransfers: async (
		transfers: NewSettlementTransfer[],
		client: QueryClient = db,
	) => {
		if (transfers.length === 0) return [];
		return client.insert(settlementTransfers).values(transfers).returning();
	},

	findById: async (
		groupId: string,
		settlementId: string,
		client: QueryClient = db,
	) => {
		const [settlement] = await client
			.select()
			.from(settlementBatches)
			.where(
				and(
					eq(settlementBatches.groupId, groupId),
					eq(settlementBatches.id, settlementId),
				),
			)
			.limit(1);

		return settlement ?? null;
	},

	listByGroup: async (
		groupId: string,
		options: { status?: SettlementStatus; limit?: number } = {},
		client: QueryClient = db,
	) => {
		const conditions = [eq(settlementBatches.groupId, groupId)];

		if (options.status)
			conditions.push(eq(settlementBatches.status, options.status));

		return client
			.select()
			.from(settlementBatches)
			.where(and(...conditions))
			.orderBy(desc(settlementBatches.createdAt))
			.limit(options.limit ?? 50);
	},

	listTransfers: async (
		settlementBatchId: string,
		client: QueryClient = db,
	) => {
		return client
			.select()
			.from(settlementTransfers)
			.where(eq(settlementTransfers.settlementBatchId, settlementBatchId));
	},

	markVoided: async (
		groupId: string,
		settlementId: string,
		voidedByUserId: string,
		client: QueryClient = db,
	) => {
		const [updated] = await client
			.update(settlementBatches)
			.set({
				status: "voided",
				voidedAt: new Date(),
				voidedByUserId,
			})
			.where(
				and(
					eq(settlementBatches.groupId, groupId),
					eq(settlementBatches.id, settlementId),
				),
			)
			.returning();

		return updated ?? null;
	},
};
