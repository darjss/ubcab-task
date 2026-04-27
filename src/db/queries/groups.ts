import { and, count, desc, eq, isNull } from "drizzle-orm";
import { db } from "~/db";
import { groupMembers, groups } from "~/db/schema";
import type { NewGroup, NewGroupMember } from "~/lib/types";
import type { QueryClient } from "./client";

export const groupQueries = {
	create: async (group: NewGroup, client: QueryClient = db) => {
		const [created] = await client.insert(groups).values(group).returning();
		return created;
	},

	createMember: async (member: NewGroupMember, client: QueryClient = db) => {
		const [created] = await client
			.insert(groupMembers)
			.values(member)
			.returning();
		return created;
	},

	findById: async (groupId: string, client: QueryClient = db) => {
		const [group] = await client
			.select()
			.from(groups)
			.where(and(eq(groups.id, groupId), isNull(groups.archivedAt)))
			.limit(1);

		return group ?? null;
	},

	listForUser: async (userId: string, client: QueryClient = db) => {
		return client
			.select({
				id: groups.id,
				name: groups.name,
				currency: groups.currency,
				role: groupMembers.role,
				status: groupMembers.status,
				createdAt: groups.createdAt,
			})
			.from(groupMembers)
			.innerJoin(groups, eq(groupMembers.groupId, groups.id))
			.where(
				and(
					eq(groupMembers.userId, userId),
					eq(groupMembers.status, "active"),
					isNull(groups.archivedAt),
				),
			)
			.orderBy(desc(groups.createdAt));
	},

	countActiveMembers: async (groupId: string, client: QueryClient = db) => {
		const [result] = await client
			.select({ count: count() })
			.from(groupMembers)
			.where(
				and(
					eq(groupMembers.groupId, groupId),
					eq(groupMembers.status, "active"),
				),
			);

		return result?.count ?? 0;
	},
};
