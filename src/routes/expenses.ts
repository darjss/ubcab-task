import { Elysia, t } from "elysia";
import {
	createIdempotencyScope,
	getIdempotencyKey,
	hashRequestBody,
	runIdempotent,
} from "~/lib/idempotency";
import {
	CreateExpenseBodySchema,
	CreateExpenseResponseSchema,
	DataArrayResponse,
	DataResponse,
	DomainErrorResponses,
	ExpenseDetailResponseSchema,
	ExpenseParamsSchema,
	ExpenseResponseSchema,
	GroupParamsSchema,
	VoidBodySchema,
	VoidExpenseResponseSchema,
} from "~/lib/schemas";
import { authGuard } from "~/plugins/auth-guard";
import {
	createExpense,
	getExpense,
	listExpenses,
	voidExpense,
} from "~/services/expenses";
import { respondWithError } from "./respond";

const ExpenseListQuerySchema = t.Object({
	status: t.Optional(t.Union([t.Literal("posted"), t.Literal("voided")])),
	limit: t.Optional(t.Number({ minimum: 1, maximum: 100, multipleOf: 1 })),
});

export const expenseRoutes = new Elysia({ name: "expense-routes" })
	.use(authGuard)
	.get(
		"/groups/:groupId/expenses",
		async ({ params, query, user, status }) => {
			const result = await listExpenses({
				groupId: params.groupId,
				requestedByUserId: user.id,
				status: query.status,
				limit: query.limit,
			});

			if (result.isErr()) return respondWithError(status, result.error);
			return { data: result.value };
		},
		{
			auth: true,
			params: GroupParamsSchema,
			query: ExpenseListQuerySchema,
			response: {
				200: DataArrayResponse(ExpenseResponseSchema),
				...DomainErrorResponses,
			},
			detail: {
				tags: ["Expenses"],
				summary: "List expenses",
				description:
					"Lists expenses for a group. Requester must be an active group member.",
			},
		},
	)
	.post(
		"/groups/:groupId/expenses",
		async ({ params, body, headers, user, status }) => {
			const idempotencyKey = getIdempotencyKey(headers);
			if (!idempotencyKey) {
				return respondWithError(status, {
					code: "IDEMPOTENCY_KEY_REQUIRED",
					message:
						"Idempotency-Key header is required for this write endpoint.",
				});
			}

			const result = await runIdempotent({
				redisKey: createIdempotencyScope({
					userId: user.id,
					groupId: params.groupId,
					key: idempotencyKey,
				}),
				requestHash: await hashRequestBody(body),
				run: () =>
					createExpense({
						groupId: params.groupId,
						payerUserId: body.payerUserId,
						description: body.description,
						occurredOn: body.occurredOn,
						totalAmountMinor: body.totalAmountMinor,
						splitType: body.splitType,
						participants: body.participants,
						createdByUserId: user.id,
					}),
			});

			if (result.isErr()) return respondWithError(status, result.error);

			return status(201, {
				data: {
					...result.value.expense,
					currency: "MNT" as const,
					splitType: "exact" as const,
					createdAt: result.value.expense.createdAt.toISOString(),
					ledgerTransactionId: result.value.ledgerTransaction.id,
					ledgerEntries: result.value.ledgerEntries.map((entry) => ({
						userId: entry.userId,
						amountMinor: entry.amountMinor,
					})),
				},
			});
		},
		{
			auth: true,
			params: GroupParamsSchema,
			body: CreateExpenseBodySchema,
			response: {
				201: DataResponse(CreateExpenseResponseSchema),
				...DomainErrorResponses,
			},
			detail: {
				tags: ["Expenses"],
				summary: "Create expense",
				description:
					"Creates an exact-split expense and balanced immutable ledger entries.",
			},
		},
	)
	.get(
		"/groups/:groupId/expenses/:expenseId",
		async ({ params, user, status }) => {
			const result = await getExpense({
				groupId: params.groupId,
				expenseId: params.expenseId,
				requestedByUserId: user.id,
			});

			if (result.isErr()) return respondWithError(status, result.error);
			return { data: result.value };
		},
		{
			auth: true,
			params: ExpenseParamsSchema,
			response: {
				200: DataResponse(ExpenseDetailResponseSchema),
				...DomainErrorResponses,
			},
			detail: {
				tags: ["Expenses"],
				summary: "Get expense",
				description: "Returns expense details and participants.",
			},
		},
	)
	.post(
		"/groups/:groupId/expenses/:expenseId/void",
		async ({ params, body, headers, user, status }) => {
			const idempotencyKey = getIdempotencyKey(headers);
			if (!idempotencyKey) {
				return respondWithError(status, {
					code: "IDEMPOTENCY_KEY_REQUIRED",
					message:
						"Idempotency-Key header is required for this write endpoint.",
				});
			}

			const result = await runIdempotent({
				redisKey: createIdempotencyScope({
					userId: user.id,
					groupId: params.groupId,
					key: idempotencyKey,
				}),
				requestHash: await hashRequestBody({ params, body }),
				run: () =>
					voidExpense({
						groupId: params.groupId,
						expenseId: params.expenseId,
						voidedByUserId: user.id,
					}),
			});

			if (result.isErr()) return respondWithError(status, result.error);
			return {
				data: {
					expenseId: params.expenseId,
					status: "voided" as const,
					reversalLedgerTransactionId:
						result.value.reversalLedgerTransaction.id,
					voidedAt: result.value.expense?.voidedAt?.toISOString() ?? null,
				},
			};
		},
		{
			auth: true,
			params: ExpenseParamsSchema,
			body: VoidBodySchema,
			response: {
				200: DataResponse(VoidExpenseResponseSchema),
				...DomainErrorResponses,
			},
			detail: {
				tags: ["Expenses"],
				summary: "Void expense",
				description:
					"Voids an expense by creating reversal ledger entries. Only owners/admins can void expenses.",
			},
		},
	);
