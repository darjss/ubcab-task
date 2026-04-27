import { Elysia, t } from "elysia";
import {
	createIdempotencyScope,
	getIdempotencyKey,
	hashRequestBody,
	runIdempotent,
} from "~/lib/idempotency";
import {
	CreateSettlementBodySchema,
	CreateSettlementResponseSchema,
	DataArrayResponse,
	DataResponse,
	DomainErrorResponses,
	GroupParamsSchema,
	SettlementDetailResponseSchema,
	SettlementParamsSchema,
	SettlementPreviewResponseSchema,
	SettlementResponseSchema,
	VoidBodySchema,
	VoidSettlementResponseSchema,
} from "~/lib/schemas";
import { authGuard } from "~/plugins/auth-guard";
import {
	createSettlement,
	getSettlement,
	listSettlements,
	previewSettlement,
	voidSettlement,
} from "~/services/settlements";
import { respondWithError } from "./respond";

const SettlementListQuerySchema = t.Object({
	status: t.Optional(t.Union([t.Literal("posted"), t.Literal("voided")])),
	limit: t.Optional(t.Number({ minimum: 1, maximum: 100, multipleOf: 1 })),
});

export const settlementRoutes = new Elysia({ name: "settlement-routes" })
	.use(authGuard)
	.get(
		"/groups/:groupId/settlements/preview",
		async ({ params, user, status }) => {
			const result = await previewSettlement({
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
				200: DataResponse(SettlementPreviewResponseSchema),
				...DomainErrorResponses,
			},
			detail: {
				tags: ["Settlements"],
				summary: "Preview settlement",
				description:
					"Calculates current balances and suggested group-level net transfers without mutating the ledger.",
			},
		},
	)
	.post(
		"/groups/:groupId/settlements",
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
					createSettlement({
						groupId: params.groupId,
						settledTo: body.settledTo,
						note: body.note,
						createdByUserId: user.id,
					}),
			});
			if (result.isErr()) return respondWithError(status, result.error);
			// Idempotent replays pass JSON from Redis: dates may be strings, not Date.
			const toDate = (v: Date | string) => (v instanceof Date ? v : new Date(v));
			return status(201, {
				data: {
					batch: {
						id: result.value.batch.id,
						groupId: result.value.batch.groupId,
						status: result.value.batch.status,
						settledTo: toDate(result.value.batch.settledTo).toISOString(),
						createdAt: toDate(result.value.batch.createdAt).toISOString(),
					},
					transfers: result.value.transfers.map((transfer) => ({
						id: transfer.id,
						settlementBatchId: transfer.settlementBatchId,
						fromUserId: transfer.fromUserId,
						toUserId: transfer.toUserId,
						amountMinor: transfer.amountMinor,
						currency: "MNT" as const,
					})),
					ledgerTransaction: {
						id: result.value.ledgerTransaction.id,
					},
				},
			});
		},
		{
			auth: true,
			params: GroupParamsSchema,
			body: CreateSettlementBodySchema,
			response: {
				201: DataResponse(CreateSettlementResponseSchema),
				...DomainErrorResponses,
			},
			detail: {
				tags: ["Settlements"],
				summary: "Create settlement",
				description:
					"Commits a settlement batch, stores suggested transfers, and inserts offsetting ledger entries.",
			},
		},
	)
	.get(
		"/groups/:groupId/settlements",
		async ({ params, query, user, status }) => {
			const result = await listSettlements({
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
			query: SettlementListQuerySchema,
			response: {
				200: DataArrayResponse(SettlementResponseSchema),
				...DomainErrorResponses,
			},
			detail: {
				tags: ["Settlements"],
				summary: "List settlements",
				description: "Lists settlement batches for a group.",
			},
		},
	)
	.get(
		"/groups/:groupId/settlements/:settlementId",
		async ({ params, user, status }) => {
			const result = await getSettlement({
				groupId: params.groupId,
				settlementId: params.settlementId,
				requestedByUserId: user.id,
			});
			if (result.isErr()) return respondWithError(status, result.error);
			return { data: result.value };
		},
		{
			auth: true,
			params: SettlementParamsSchema,
			response: {
				200: DataResponse(SettlementDetailResponseSchema),
				...DomainErrorResponses,
			},
			detail: {
				tags: ["Settlements"],
				summary: "Get settlement",
				description: "Returns a settlement batch and its stored transfer plan.",
			},
		},
	)
	.post(
		"/groups/:groupId/settlements/:settlementId/void",
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
					voidSettlement({
						groupId: params.groupId,
						settlementId: params.settlementId,
						voidedByUserId: user.id,
					}),
			});
			if (result.isErr()) return respondWithError(status, result.error);
			return {
				data: {
					settlement: {
						id: result.value.settlement.id,
						status: "voided" as const,
						voidedAt: result.value.settlement.voidedAt?.toISOString() ?? null,
					},
					reversalLedgerTransaction: {
						id: result.value.reversalLedgerTransaction.id,
					},
				},
			};
		},
		{
			auth: true,
			params: SettlementParamsSchema,
			body: VoidBodySchema,
			response: {
				200: DataResponse(VoidSettlementResponseSchema),
				...DomainErrorResponses,
			},
			detail: {
				tags: ["Settlements"],
				summary: "Void settlement",
				description:
					"Voids a settlement batch by inserting reversal ledger entries. Only owners/admins can void settlements.",
			},
		},
	);
