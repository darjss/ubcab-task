import { relations } from "drizzle-orm";
import {
	bigint,
	date,
	index,
	integer,
	numeric,
	pgEnum,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
} from "drizzle-orm/pg-core";
import { groups } from "./groups";
import { user } from "./user";

export const splitType = pgEnum("split_type", [
	"exact",
	"equal",
	"percentage",
	"shares",
]);

export const expenseStatus = pgEnum("expense_status", ["posted", "voided"]);

export const expenses = pgTable(
	"expenses",
	{
		id: text("id").primaryKey(),
		groupId: text("group_id")
			.notNull()
			.references(() => groups.id, { onDelete: "cascade" }),
		payerUserId: text("payer_user_id")
			.notNull()
			.references(() => user.id, { onDelete: "restrict" }),
		createdByUserId: text("created_by_user_id")
			.notNull()
			.references(() => user.id, { onDelete: "restrict" }),
		description: text("description"),
		totalAmountMinor: bigint("total_amount_minor", {
			mode: "number",
		}).notNull(),
		currency: text("currency").default("MNT").notNull(),
		splitType: splitType("split_type").default("exact").notNull(),
		status: expenseStatus("status").default("posted").notNull(),
		occurredOn: date("occurred_on").notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		voidedAt: timestamp("voided_at"),
		voidedByUserId: text("voided_by_user_id").references(() => user.id, {
			onDelete: "restrict",
		}),
	},
	(table) => [
		index("expenses_group_id_occurred_on_idx").on(
			table.groupId,
			table.occurredOn,
		),
		index("expenses_group_id_status_idx").on(table.groupId, table.status),
		index("expenses_payer_user_id_idx").on(table.payerUserId),
	],
);

export const expenseParticipants = pgTable(
	"expense_participants",
	{
		expenseId: text("expense_id")
			.notNull()
			.references(() => expenses.id, { onDelete: "cascade" }),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "restrict" }),
		amountMinor: bigint("amount_minor", { mode: "number" }),
		shareCount: integer("share_count"),
		percentage: numeric("percentage"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		uniqueIndex("expense_participants_expense_id_user_id_unique").on(
			table.expenseId,
			table.userId,
		),
		index("expense_participants_user_id_idx").on(table.userId),
	],
);

export const expensesRelations = relations(expenses, ({ one, many }) => ({
	group: one(groups, {
		fields: [expenses.groupId],
		references: [groups.id],
	}),
	payer: one(user, {
		fields: [expenses.payerUserId],
		references: [user.id],
	}),
	createdBy: one(user, {
		fields: [expenses.createdByUserId],
		references: [user.id],
	}),
	voidedBy: one(user, {
		fields: [expenses.voidedByUserId],
		references: [user.id],
	}),
	participants: many(expenseParticipants),
}));

export const expenseParticipantsRelations = relations(
	expenseParticipants,
	({ one }) => ({
		expense: one(expenses, {
			fields: [expenseParticipants.expenseId],
			references: [expenses.id],
		}),
		user: one(user, {
			fields: [expenseParticipants.userId],
			references: [user.id],
		}),
	}),
);
