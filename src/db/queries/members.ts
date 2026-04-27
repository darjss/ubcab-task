import { and, eq } from "drizzle-orm";
import { db } from "~/db";
import { groupMembers, user } from "~/db/schema";
import type { GroupMemberStatus, NewGroupMember } from "~/lib/types";
import type { QueryClient } from "./client";

export const memberQueries = {
	findMembership: async (
		groupId: string,
		userId: string,
		client: QueryClient = db,
	) => {
		const [member] = await client
			.select()
			.from(groupMembers)
			.where(
				and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)),
			)
			.limit(1);

		return member ?? null;
	},

	findActiveMembership: async (
		groupId: string,
		userId: string,
		client: QueryClient = db,
	) => {
		const [member] = await client
			.select()
			.from(groupMembers)
			.where(
				and(
					eq(groupMembers.groupId, groupId),
					eq(groupMembers.userId, userId),
					eq(groupMembers.status, "active"),
				),
			)
			.limit(1);

		return member ?? null;
	},

	listByGroup: async (
		groupId: string,
		options: { status?: GroupMemberStatus } = {},
		client: QueryClient = db,
	) => {
		const conditions = [eq(groupMembers.groupId, groupId)];

		if (options.status) {
			conditions.push(eq(groupMembers.status, options.status));
		}

		return client
			.select({
				groupId: groupMembers.groupId,
				userId: groupMembers.userId,
				name: user.name,
				email: user.email,
				role: groupMembers.role,
				status: groupMembers.status,
				joinedAt: groupMembers.joinedAt,
			})
			.from(groupMembers)
			.innerJoin(user, eq(groupMembers.userId, user.id))
			.where(and(...conditions));
	},

	create: async (member: NewGroupMember, client: QueryClient = db) => {
		const [created] = await client
			.insert(groupMembers)
			.values(member)
			.returning();
		return created;
	},

	updateRole: async (
		groupId: string,
		userId: string,
		role: "admin" | "member",
		client: QueryClient = db,
	) => {
		const [updated] = await client
			.update(groupMembers)
			.set({ role })
			.where(
				and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)),
			)
			.returning();

		return updated ?? null;
	},

	markRemoved: async (
		groupId: string,
		userId: string,
		client: QueryClient = db,
	) => {
		const [updated] = await client
			.update(groupMembers)
			.set({ status: "removed", removedAt: new Date() })
			.where(
				and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)),
			)
			.returning();

		return updated ?? null;
	},
};
