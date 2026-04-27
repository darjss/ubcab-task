import { Elysia } from "elysia";
import {
	BalanceResponseSchema,
	DataResponse,
	DomainErrorResponses,
	GroupParamsSchema,
} from "~/lib/schemas";
import { authGuard } from "~/plugins/auth-guard";
import { getGroupBalances } from "~/services/balances";
import { respondWithError } from "./respond";

export const balanceRoutes = new Elysia({ name: "balance-routes" })
	.use(authGuard)
	.get(
		"/groups/:groupId/balances",
		async ({ params, user, status }) => {
			const result = await getGroupBalances({
				groupId: params.groupId,
				requestedByUserId: user.id,
			});

			if (result.isErr()) return respondWithError(status, result.error);

			return { data: result.value };
		},
		{
			auth: true,
			params: GroupParamsSchema,
			response: {
				200: DataResponse(BalanceResponseSchema),
				...DomainErrorResponses,
			},
			detail: {
				tags: ["Balances"],
				summary: "Get group balances",
				description:
					"Returns current member balances derived from immutable ledger entries. Positive means receivable, negative means payable.",
			},
		},
	);
