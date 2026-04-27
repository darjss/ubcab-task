import { and, desc, eq } from "drizzle-orm";
import { db } from "~/db";
import { expenseParticipants, expenses } from "~/db/schema";
import type {
	ExpenseStatus,
	NewExpense,
	NewExpenseParticipant,
} from "~/lib/types";
import type { QueryClient } from "./client";

export const expenseQueries = {
	create: async (expense: NewExpense, client: QueryClient = db) => {
		const [created] = await client.insert(expenses).values(expense).returning();
		return created;
	},

	createParticipants: async (
		participants: NewExpenseParticipant[],
		client: QueryClient = db,
	) => {
		if (participants.length === 0) return [];
		return client.insert(expenseParticipants).values(participants).returning();
	},

	findById: async (
		groupId: string,
		expenseId: string,
		client: QueryClient = db,
	) => {
		const [expense] = await client
			.select()
			.from(expenses)
			.where(and(eq(expenses.groupId, groupId), eq(expenses.id, expenseId)))
			.limit(1);

		return expense ?? null;
	},

	listByGroup: async (
		groupId: string,
		options: { status?: ExpenseStatus; limit?: number } = {},
		client: QueryClient = db,
	) => {
		const conditions = [eq(expenses.groupId, groupId)];

		if (options.status) {
			conditions.push(eq(expenses.status, options.status));
		}

		return client
			.select()
			.from(expenses)
			.where(and(...conditions))
			.orderBy(desc(expenses.occurredOn), desc(expenses.createdAt))
			.limit(options.limit ?? 50);
	},

	listParticipants: async (expenseId: string, client: QueryClient = db) => {
		return client
			.select()
			.from(expenseParticipants)
			.where(eq(expenseParticipants.expenseId, expenseId));
	},

	markVoided: async (
		groupId: string,
		expenseId: string,
		voidedByUserId: string,
		client: QueryClient = db,
	) => {
		const [updated] = await client
			.update(expenses)
			.set({
				status: "voided",
				voidedAt: new Date(),
				voidedByUserId,
			})
			.where(and(eq(expenses.groupId, groupId), eq(expenses.id, expenseId)))
			.returning();

		return updated ?? null;
	},
};
