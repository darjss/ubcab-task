import { Elysia } from "elysia";
import {
	CreateGroupBodySchema,
	DataArrayResponse,
	DataResponse,
	DomainErrorResponses,
	GroupParamsSchema,
	GroupResponseSchema,
} from "~/lib/schemas";
import { authGuard } from "~/plugins/auth-guard";
import {
	createGroup,
	getGroupForUser,
	listGroupsForUser,
} from "~/services/groups";
import { respondWithError } from "./respond";

export const groupRoutes = new Elysia({ name: "group-routes" })
	.use(authGuard)
	.get(
		"/groups",
		async ({ user, status }) => {
			const result = await listGroupsForUser(user.id);

			if (result.isErr()) return respondWithError(status, result.error);

			return { data: result.value };
		},
		{
			auth: true,
			response: {
				200: DataArrayResponse(GroupResponseSchema),
				...DomainErrorResponses,
			},
			detail: {
				tags: ["Groups"],
				summary: "List my groups",
				description:
					"Returns active groups where the authenticated user is a member.",
			},
		},
	)
	.post(
		"/groups",
		async ({ body, user, status }) => {
			const result = await createGroup({
				name: body.name,
				currency: body.currency,
				createdByUserId: user.id,
			});

			if (result.isErr()) return respondWithError(status, result.error);

			return status(201, {
				data: {
					...result.value,
					role: "owner" as const,
				},
			});
		},
		{
			auth: true,
			body: CreateGroupBodySchema,
			response: {
				201: DataResponse(GroupResponseSchema),
				...DomainErrorResponses,
			},
			detail: {
				tags: ["Groups"],
				summary: "Create group",
				description:
					"Creates a group and adds the authenticated user as owner.",
			},
		},
	)
	.get(
		"/groups/:groupId",
		async ({ params, user, status }) => {
			const result = await getGroupForUser(params.groupId, user.id);

			if (result.isErr()) return respondWithError(status, result.error);

			return { data: result.value };
		},
		{
			auth: true,
			params: GroupParamsSchema,
			response: {
				200: DataResponse(GroupResponseSchema),
				...DomainErrorResponses,
			},
			detail: {
				tags: ["Groups"],
				summary: "Get group",
				description:
					"Returns a group if the authenticated user is an active member.",
			},
		},
	);
