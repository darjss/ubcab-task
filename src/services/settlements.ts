import { sql } from "drizzle-orm";
import { err, ok, ResultAsync } from "neverthrow";
import { db } from "~/db";
import { queries } from "~/db/queries";
import type { QueryClient } from "~/db/queries/client";
import {
	getJsonCache,
	invalidateGroupAccountingCache,
	setJsonCache,
	settlementPreviewCacheKey,
} from "~/lib/cache";
import { domainError } from "~/lib/errors";
import { newSettlementBatchId, newSettlementTransferId } from "~/lib/ids";
import { calculateSettlementTransfers } from "~/lib/settlement";
import type { SettlementTransferSuggestion } from "~/lib/types";
import { requireActiveMember, requireGroupAdmin } from "./groups";
import {
	createLedgerTransaction,
	createReversalLedgerTransaction,
} from "./ledger";

type SettlementPreviewResponse = {
	groupId: string;
	currency: "MNT";
	balances: { userId: string; balanceMinor: number }[];
	suggestedTransfers: SettlementTransferSuggestion[];
	asOf: string;
};

const toSettlementResponse = (settlement: {
	id: string;
	status: "posted" | "voided";
	settledTo: Date;
	createdAt: Date;
}) => ({
	id: settlement.id,
	status: settlement.status,
	settledTo: settlement.settledTo.toISOString(),
	createdAt: settlement.createdAt.toISOString(),
});

const toSettlementTransferResponse = (transfer: {
	fromUserId: string;
	toUserId: string;
	amountMinor: number;
}) => ({
	fromUserId: transfer.fromUserId,
	toUserId: transfer.toUserId,
	amountMinor: transfer.amountMinor,
});

export const previewSettlement = (input: {
	groupId: string;
	requestedByUserId: string;
}) =>
	ResultAsync.fromPromise(
		(async () => {
			const membership = await requireActiveMember(
				input.groupId,
				input.requestedByUserId,
			);
			if (membership.isErr()) return err(membership.error);

			const cacheKey = settlementPreviewCacheKey(input.groupId);
			const cached = await getJsonCache<SettlementPreviewResponse>(cacheKey);
			if (cached) return ok(cached);

			const balances = await queries.balances.listByGroup(input.groupId);
			const transfersResult = calculateSettlementTransfers(balances);
			if (transfersResult.isErr()) return err(transfersResult.error);

			const response: SettlementPreviewResponse = {
				groupId: input.groupId,
				currency: "MNT",
				balances: balances.map((balance) => ({
					userId: balance.userId,
					balanceMinor: balance.balanceMinor,
				})),
				suggestedTransfers: transfersResult.value,
				asOf: new Date().toISOString(),
			};

			await setJsonCache(cacheKey, response);
			return ok(response);
		})(),
		(error) =>
			domainError("INTERNAL_SERVER_ERROR", "Failed to preview settlement.", {
				cause: error instanceof Error ? error.message : String(error),
			}),
	).andThen((result) => result);

export const createSettlement = (input: {
	groupId: string;
	settledTo: string;
	note?: string;
	createdByUserId: string;
}) =>
	ResultAsync.fromPromise(
		(async () => {
			const result = await db.transaction(async (tx) => {
				const client = tx as QueryClient;
				const admin = await requireGroupAdmin(
					input.groupId,
					input.createdByUserId,
					client,
				);
				if (admin.isErr()) return err(admin.error);

				await client.execute(
					sql`select pg_advisory_xact_lock(hashtext(${input.groupId}))`,
				);

				const balances = await queries.balances.listByGroup(
					input.groupId,
					client,
				);
				const transfersResult = calculateSettlementTransfers(balances);
				if (transfersResult.isErr()) return err(transfersResult.error);

				const batch = await queries.settlements.createBatch(
					{
						id: newSettlementBatchId(),
						groupId: input.groupId,
						createdByUserId: input.createdByUserId,
						settledTo: new Date(input.settledTo),
						note: input.note ?? null,
					},
					client,
				);

				const transfers = await queries.settlements.createTransfers(
					transfersResult.value.map((transfer) => ({
						id: newSettlementTransferId(),
						settlementBatchId: batch.id,
						fromUserId: transfer.fromUserId,
						toUserId: transfer.toUserId,
						amountMinor: transfer.amountMinor,
						currency: transfer.currency,
					})),
					client,
				);

				const ledgerResult = await createLedgerTransaction(
					{
						groupId: input.groupId,
						type: "settlement",
						entryType: "settlement",
						sourceId: batch.id,
						createdByUserId: input.createdByUserId,
						currency: "MNT",
						entries: balances
							.filter((balance) => balance.balanceMinor !== 0)
							.map((balance) => ({
								userId: balance.userId,
								amountMinor: -balance.balanceMinor,
							})),
					},
					client,
				);
				if (ledgerResult.isErr()) return err(ledgerResult.error);

				return ok({
					batch,
					transfers,
					ledgerTransaction: ledgerResult.value.transaction,
				});
			});

			if (result.isOk()) await invalidateGroupAccountingCache(input.groupId);
			return result;
		})(),
		(error) =>
			domainError("INTERNAL_SERVER_ERROR", "Failed to create settlement.", {
				cause: error instanceof Error ? error.message : String(error),
			}),
	).andThen((result) => result);

export const listSettlements = (input: {
	groupId: string;
	requestedByUserId: string;
	status?: "posted" | "voided";
	limit?: number;
}) =>
	ResultAsync.fromPromise(
		(async () => {
			const member = await requireActiveMember(
				input.groupId,
				input.requestedByUserId,
			);
			if (member.isErr()) return err(member.error);

			const settlements = await queries.settlements.listByGroup(input.groupId, {
				status: input.status,
				limit: input.limit,
			});

			return ok(settlements.map(toSettlementResponse));
		})(),
		(error) =>
			domainError("INTERNAL_SERVER_ERROR", "Failed to list settlements.", {
				cause: error instanceof Error ? error.message : String(error),
			}),
	).andThen((result) => result);

export const getSettlement = (input: {
	groupId: string;
	settlementId: string;
	requestedByUserId: string;
}) =>
	ResultAsync.fromPromise(
		(async () => {
			const member = await requireActiveMember(
				input.groupId,
				input.requestedByUserId,
			);
			if (member.isErr()) return err(member.error);

			const settlement = await queries.settlements.findById(
				input.groupId,
				input.settlementId,
			);
			if (!settlement) {
				return err(
					domainError("SETTLEMENT_NOT_FOUND", "Settlement not found."),
				);
			}

			const transfers = await queries.settlements.listTransfers(settlement.id);
			return ok({
				...toSettlementResponse(settlement),
				transfers: transfers.map(toSettlementTransferResponse),
			});
		})(),
		(error) =>
			domainError("INTERNAL_SERVER_ERROR", "Failed to get settlement.", {
				cause: error instanceof Error ? error.message : String(error),
			}),
	).andThen((result) => result);

export const voidSettlement = (input: {
	groupId: string;
	settlementId: string;
	voidedByUserId: string;
}) =>
	ResultAsync.fromPromise(
		(async () => {
			const result = await db.transaction(async (tx) => {
				const client = tx as QueryClient;
				const admin = await requireGroupAdmin(
					input.groupId,
					input.voidedByUserId,
					client,
				);
				if (admin.isErr()) return err(admin.error);

				const settlement = await queries.settlements.findById(
					input.groupId,
					input.settlementId,
					client,
				);
				if (!settlement) {
					return err(
						domainError("SETTLEMENT_NOT_FOUND", "Settlement not found."),
					);
				}
				if (settlement.status === "voided") {
					return err(
						domainError(
							"SETTLEMENT_ALREADY_VOIDED",
							"Settlement is already voided.",
						),
					);
				}

				const originalTransaction =
					await queries.ledger.findTransactionBySource(
						input.groupId,
						settlement.id,
						"settlement",
						client,
					);
				if (!originalTransaction) {
					return err(
						domainError(
							"LEDGER_NOT_BALANCED",
							"Original settlement ledger transaction was not found.",
						),
					);
				}

				const originalEntries = await queries.ledger.listEntriesByTransaction(
					originalTransaction.id,
					client,
				);
				const updatedSettlement = await queries.settlements.markVoided(
					input.groupId,
					settlement.id,
					input.voidedByUserId,
					client,
				);

				const reversal = await createReversalLedgerTransaction(
					{
						groupId: input.groupId,
						type: "settlement_reversal",
						entryType: "settlement_reversal",
						sourceId: settlement.id,
						createdByUserId: input.voidedByUserId,
						currency: "MNT",
						reversesTransactionId: originalTransaction.id,
						originalEntries,
					},
					client,
				);
				if (reversal.isErr()) return err(reversal.error);

				return ok({
					settlement: updatedSettlement,
					reversalLedgerTransaction: reversal.value.transaction,
				});
			});

			if (result.isOk()) await invalidateGroupAccountingCache(input.groupId);
			return result;
		})(),
		(error) =>
			domainError("INTERNAL_SERVER_ERROR", "Failed to void settlement.", {
				cause: error instanceof Error ? error.message : String(error),
			}),
	).andThen((result) => result);
