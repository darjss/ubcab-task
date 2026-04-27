import { err, ok, ResultAsync } from "neverthrow";
import { db } from "~/db";
import { queries } from "~/db/queries";
import type { QueryClient } from "~/db/queries/client";
import { domainError } from "~/lib/errors";
import { newGroupId } from "~/lib/ids";

export const getActiveMembership = async (
	groupId: string,
	userId: string,
	client?: QueryClient,
) => queries.members.findActiveMembership(groupId, userId, client);

export const requireActiveMember = async (
	groupId: string,
	userId: string,
	client?: QueryClient,
) => {
	const membership = await getActiveMembership(groupId, userId, client);

	if (!membership) {
		return err(
			domainError(
				"NOT_GROUP_MEMBER",
				"User is not an active member of this group.",
			),
		);
	}

	return ok(membership);
};

export const requireGroupAdmin = async (
	groupId: string,
	userId: string,
	client?: QueryClient,
) => {
	const membershipResult = await requireActiveMember(groupId, userId, client);

	if (membershipResult.isErr()) return membershipResult;

	const membership = membershipResult.value;

	if (membership.role !== "owner" && membership.role !== "admin") {
		return err(
			domainError(
				"FORBIDDEN",
				"Only group owners or admins can perform this action.",
			),
		);
	}

	return ok(membership);
};

export const listGroupsForUser = (userId: string) =>
	ResultAsync.fromPromise(
		(async () => {
			const groups = await queries.groups.listForUser(userId);
			return groups.map((group) => ({
				id: group.id,
				name: group.name,
				currency: "MNT" as const,
				role: group.role,
				createdAt: group.createdAt.toISOString(),
			}));
		})(),
		(error) =>
			domainError("INTERNAL_SERVER_ERROR", "Failed to list groups.", {
				cause: error instanceof Error ? error.message : String(error),
			}),
	);

export const createGroup = (input: {
	name: string;
	currency?: "MNT";
	createdByUserId: string;
}) =>
	ResultAsync.fromPromise(
		db.transaction(async (tx) => {
			const group = await queries.groups.create(
				{
					id: newGroupId(),
					name: input.name,
					currency: input.currency ?? "MNT",
					createdByUserId: input.createdByUserId,
				},
				tx as QueryClient,
			);

			await queries.members.create(
				{
					groupId: group.id,
					userId: input.createdByUserId,
					role: "owner",
					status: "active",
					joinedAt: new Date(),
				},
				tx as QueryClient,
			);

			return {
				id: group.id,
				name: group.name,
				currency: "MNT" as const,
				createdAt: group.createdAt.toISOString(),
			};
		}),
		(error) =>
			domainError("INTERNAL_SERVER_ERROR", "Failed to create group.", {
				cause: error instanceof Error ? error.message : String(error),
			}),
	);

export const getGroupForUser = (groupId: string, userId: string) =>
	ResultAsync.fromPromise(
		(async () => {
			const group = await queries.groups.findById(groupId);

			if (!group) {
				return err(domainError("GROUP_NOT_FOUND", "Group not found."));
			}

			const membershipResult = await requireActiveMember(groupId, userId);

			if (membershipResult.isErr()) return err(membershipResult.error);

			const memberCount = await queries.groups.countActiveMembers(groupId);

			return ok({
				id: group.id,
				name: group.name,
				currency: "MNT" as const,
				myRole: membershipResult.value.role,
				memberCount,
				createdAt: group.createdAt.toISOString(),
			});
		})(),
		(error) =>
			domainError("INTERNAL_SERVER_ERROR", "Failed to get group.", {
				cause: error instanceof Error ? error.message : String(error),
			}),
	).andThen((result) => result);
