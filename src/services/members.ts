import { err, ok, ResultAsync } from "neverthrow";
import { queries } from "~/db/queries";
import { domainError } from "~/lib/errors";
import { requireActiveMember, requireGroupAdmin } from "./groups";

const toMemberResponse = (member: {
	groupId: string;
	userId: string;
	name?: string | null;
	email?: string | null;
	role: "owner" | "admin" | "member";
	status: "active" | "invited" | "removed";
	joinedAt: Date | null;
}) => ({
	groupId: member.groupId,
	userId: member.userId,
	...(member.name ? { name: member.name } : {}),
	...(member.email ? { email: member.email } : {}),
	role: member.role,
	status: member.status,
	joinedAt: member.joinedAt?.toISOString() ?? null,
});

export const listGroupMembers = (input: {
	groupId: string;
	requestedByUserId: string;
	status?: "active" | "invited" | "removed";
}) =>
	ResultAsync.fromPromise(
		(async () => {
			const membershipResult = await requireActiveMember(
				input.groupId,
				input.requestedByUserId,
			);

			if (membershipResult.isErr()) return err(membershipResult.error);

			const members = await queries.members.listByGroup(input.groupId, {
				status: input.status,
			});

			return ok(members.map(toMemberResponse));
		})(),
		(error) =>
			domainError("INTERNAL_SERVER_ERROR", "Failed to list group members.", {
				cause: error instanceof Error ? error.message : String(error),
			}),
	).andThen((result) => result);

export const addGroupMember = (input: {
	groupId: string;
	userId: string;
	role?: "admin" | "member";
	requestedByUserId: string;
}) =>
	ResultAsync.fromPromise(
		(async () => {
			const adminResult = await requireGroupAdmin(
				input.groupId,
				input.requestedByUserId,
			);

			if (adminResult.isErr()) return err(adminResult.error);

			const existing = await queries.members.findMembership(
				input.groupId,
				input.userId,
			);

			if (existing?.status === "active") {
				return ok(toMemberResponse(existing));
			}

			if (existing) {
				const updated = await queries.members.updateRole(
					input.groupId,
					input.userId,
					input.role ?? "member",
				);

				return ok(toMemberResponse(updated ?? existing));
			}

			const member = await queries.members.create({
				groupId: input.groupId,
				userId: input.userId,
				role: input.role ?? "member",
				status: "active",
				joinedAt: new Date(),
			});

			return ok(toMemberResponse(member));
		})(),
		(error) =>
			domainError("INTERNAL_SERVER_ERROR", "Failed to add group member.", {
				cause: error instanceof Error ? error.message : String(error),
			}),
	).andThen((result) => result);

export const updateGroupMemberRole = (input: {
	groupId: string;
	userId: string;
	role: "admin" | "member";
	requestedByUserId: string;
}) =>
	ResultAsync.fromPromise(
		(async () => {
			const adminResult = await requireGroupAdmin(
				input.groupId,
				input.requestedByUserId,
			);

			if (adminResult.isErr()) return err(adminResult.error);

			const updated = await queries.members.updateRole(
				input.groupId,
				input.userId,
				input.role,
			);

			if (!updated) {
				return err(
					domainError("NOT_GROUP_MEMBER", "Target user is not a group member."),
				);
			}

			return ok(toMemberResponse(updated));
		})(),
		(error) =>
			domainError(
				"INTERNAL_SERVER_ERROR",
				"Failed to update group member role.",
				{
					cause: error instanceof Error ? error.message : String(error),
				},
			),
	).andThen((result) => result);

export const removeGroupMember = (input: {
	groupId: string;
	userId: string;
	requestedByUserId: string;
}) =>
	ResultAsync.fromPromise(
		(async () => {
			const adminResult = await requireGroupAdmin(
				input.groupId,
				input.requestedByUserId,
			);

			if (adminResult.isErr()) return err(adminResult.error);

			const updated = await queries.members.markRemoved(
				input.groupId,
				input.userId,
			);

			if (!updated) {
				return err(
					domainError("NOT_GROUP_MEMBER", "Target user is not a group member."),
				);
			}

			return ok(toMemberResponse(updated));
		})(),
		(error) =>
			domainError("INTERNAL_SERVER_ERROR", "Failed to remove group member.", {
				cause: error instanceof Error ? error.message : String(error),
			}),
	).andThen((result) => result);
