import { relations } from "drizzle-orm";
import {
	bigint,
	index,
	pgEnum,
	pgTable,
	text,
	timestamp,
} from "drizzle-orm/pg-core";
import { groups } from "./groups";
import { user } from "./user";

export const settlementStatus = pgEnum("settlement_status", [
	"posted",
	"voided",
]);

export const settlementTransferStatus = pgEnum("settlement_transfer_status", [
	"suggested",
	"confirmed",
]);

export const settlementBatches = pgTable(
	"settlement_batches",
	{
		id: text("id").primaryKey(),
		groupId: text("group_id")
			.notNull()
			.references(() => groups.id, { onDelete: "cascade" }),
		createdByUserId: text("created_by_user_id")
			.notNull()
			.references(() => user.id, { onDelete: "restrict" }),
		status: settlementStatus("status").default("posted").notNull(),
		settledFrom: timestamp("settled_from"),
		settledTo: timestamp("settled_to").notNull(),
		note: text("note"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		voidedAt: timestamp("voided_at"),
		voidedByUserId: text("voided_by_user_id").references(() => user.id, {
			onDelete: "restrict",
		}),
	},
	(table) => [
		index("settlement_batches_group_id_created_at_idx").on(
			table.groupId,
			table.createdAt,
		),
		index("settlement_batches_group_id_status_idx").on(
			table.groupId,
			table.status,
		),
	],
);

export const settlementTransfers = pgTable(
	"settlement_transfers",
	{
		id: text("id").primaryKey(),
		settlementBatchId: text("settlement_batch_id")
			.notNull()
			.references(() => settlementBatches.id, { onDelete: "cascade" }),
		fromUserId: text("from_user_id")
			.notNull()
			.references(() => user.id, { onDelete: "restrict" }),
		toUserId: text("to_user_id")
			.notNull()
			.references(() => user.id, { onDelete: "restrict" }),
		amountMinor: bigint("amount_minor", { mode: "number" }).notNull(),
		currency: text("currency").default("MNT").notNull(),
		status: settlementTransferStatus("status").default("suggested").notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		index("settlement_transfers_batch_id_idx").on(table.settlementBatchId),
		index("settlement_transfers_from_user_id_idx").on(table.fromUserId),
		index("settlement_transfers_to_user_id_idx").on(table.toUserId),
	],
);

export const settlementBatchesRelations = relations(
	settlementBatches,
	({ one, many }) => ({
		group: one(groups, {
			fields: [settlementBatches.groupId],
			references: [groups.id],
		}),
		createdBy: one(user, {
			fields: [settlementBatches.createdByUserId],
			references: [user.id],
		}),
		voidedBy: one(user, {
			fields: [settlementBatches.voidedByUserId],
			references: [user.id],
		}),
		transfers: many(settlementTransfers),
	}),
);

export const settlementTransfersRelations = relations(
	settlementTransfers,
	({ one }) => ({
		settlementBatch: one(settlementBatches, {
			fields: [settlementTransfers.settlementBatchId],
			references: [settlementBatches.id],
		}),
		fromUser: one(user, {
			fields: [settlementTransfers.fromUserId],
			references: [user.id],
		}),
		toUser: one(user, {
			fields: [settlementTransfers.toUserId],
			references: [user.id],
		}),
	}),
);
