import { Elysia, t } from "elysia";
import {
	AddMemberBodySchema,
	DataArrayResponse,
	DataResponse,
	DomainErrorResponses,
	GroupParamsSchema,
	MemberResponseSchema,
	UpdateMemberBodySchema,
	UserParamsSchema,
} from "~/lib/schemas";
import { authGuard } from "~/plugins/auth-guard";
import {
	addGroupMember,
	listGroupMembers,
	removeGroupMember,
	updateGroupMemberRole,
} from "~/services/members";
import { respondWithError } from "./respond";

const MemberStatusQuerySchema = t.Object({
	status: t.Optional(
		t.Union([t.Literal("active"), t.Literal("invited"), t.Literal("removed")]),
	),
});

export const memberRoutes = new Elysia({ name: "member-routes" })
	.use(authGuard)
	.get(
		"/groups/:groupId/members",
		async ({ params, query, user, status }) => {
			const result = await listGroupMembers({
				groupId: params.groupId,
				requestedByUserId: user.id,
				status: query.status,
			});

			if (result.isErr()) return respondWithError(status, result.error);

			return { data: result.value };
		},
		{
			auth: true,
			params: GroupParamsSchema,
			query: MemberStatusQuerySchema,
			response: {
				200: DataArrayResponse(MemberResponseSchema),
				...DomainErrorResponses,
			},
			detail: {
				tags: ["Members"],
				summary: "List group members",
				description:
					"Lists members in a group. The requester must be an active member.",
			},
		},
	)
	.post(
		"/groups/:groupId/members",
		async ({ params, body, user, status }) => {
			const result = await addGroupMember({
				groupId: params.groupId,
				userId: body.userId,
				role: body.role,
				requestedByUserId: user.id,
			});

			if (result.isErr()) return respondWithError(status, result.error);

			return status(201, { data: result.value });
		},
		{
			auth: true,
			params: GroupParamsSchema,
			body: AddMemberBodySchema,
			response: {
				201: DataResponse(MemberResponseSchema),
				...DomainErrorResponses,
			},
			detail: {
				tags: ["Members"],
				summary: "Add group member",
				description:
					"Adds a user to a group. Only owners/admins can add members.",
			},
		},
	)
	.patch(
		"/groups/:groupId/members/:userId",
		async ({ params, body, user, status }) => {
			const result = await updateGroupMemberRole({
				groupId: params.groupId,
				userId: params.userId,
				role: body.role,
				requestedByUserId: user.id,
			});

			if (result.isErr()) return respondWithError(status, result.error);

			return { data: result.value };
		},
		{
			auth: true,
			params: UserParamsSchema,
			body: UpdateMemberBodySchema,
			response: {
				200: DataResponse(MemberResponseSchema),
				...DomainErrorResponses,
			},
			detail: {
				tags: ["Members"],
				summary: "Update member role",
				description:
					"Updates a member role. Only owners/admins can change roles.",
			},
		},
	)
	.delete(
		"/groups/:groupId/members/:userId",
		async ({ params, user, status }) => {
			const result = await removeGroupMember({
				groupId: params.groupId,
				userId: params.userId,
				requestedByUserId: user.id,
			});

			if (result.isErr()) return respondWithError(status, result.error);

			return { data: result.value };
		},
		{
			auth: true,
			params: UserParamsSchema,
			response: {
				200: DataResponse(MemberResponseSchema),
				...DomainErrorResponses,
			},
			detail: {
				tags: ["Members"],
				summary: "Remove member",
				description:
					"Marks a member as removed without deleting historical records.",
			},
		},
	);
