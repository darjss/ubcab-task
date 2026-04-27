import { Elysia } from "elysia";
import {
	DomainErrorResponses,
	GroupParamsSchema,
	LedgerListQuerySchema,
	PaginatedLedgerAuditResponseSchema,
} from "~/lib/schemas";
import { authGuard } from "~/plugins/auth-guard";
import { listLedgerEntries } from "~/services/ledger";
import { respondWithError } from "./respond";

export const ledgerRoutes = new Elysia({ name: "ledger-routes" })
	.use(authGuard)
	.get(
		"/groups/:groupId/ledger",
		async ({ params, query, user, status }) => {
			const result = await listLedgerEntries({
				groupId: params.groupId,
				requestedByUserId: user.id,
				userId: query.userId,
				type: query.type,
				from: query.from,
				to: query.to,
				limit: query.limit,
				cursor: query.cursor,
			});

			if (result.isErr()) return respondWithError(status, result.error);

			return result.value;
		},
		{
			auth: true,
			params: GroupParamsSchema,
			query: LedgerListQuerySchema,
			response: {
				200: PaginatedLedgerAuditResponseSchema,
				...DomainErrorResponses,
			},
			detail: {
				tags: ["Ledger"],
				summary: "List ledger entries",
				description:
					"Lists immutable ledger entries for audit. Requester must be an active group member.",
			},
		},
	);
