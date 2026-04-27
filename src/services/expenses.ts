import { err, errAsync, ok, ResultAsync } from "neverthrow";
import { db } from "~/db";
import { queries } from "~/db/queries";
import type { QueryClient } from "~/db/queries/client";
import { invalidateGroupAccountingCache } from "~/lib/cache";
import { domainError } from "~/lib/errors";
import { newExpenseId } from "~/lib/ids";
import { validateExactSplitTotal, validatePositiveAmount } from "~/lib/money";
import { requireActiveMember, requireGroupAdmin } from "./groups";
import {
	createLedgerTransaction,
	createReversalLedgerTransaction,
} from "./ledger";

const toExpenseResponse = (expense: {
	id: string;
	groupId: string;
	payerUserId: string;
	description: string | null;
	totalAmountMinor: number;
	currency: string;
	splitType: "exact" | "equal" | "percentage" | "shares";
	status: "posted" | "voided";
	occurredOn: string;
	createdAt: Date;
}) => ({
	id: expense.id,
	groupId: expense.groupId,
	payerUserId: expense.payerUserId,
	description: expense.description,
	totalAmountMinor: expense.totalAmountMinor,
	currency: "MNT" as const,
	splitType: "exact" as const,
	status: expense.status,
	occurredOn: expense.occurredOn,
	createdAt: expense.createdAt.toISOString(),
});

export const listExpenses = (input: {
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

			const expenses = await queries.expenses.listByGroup(input.groupId, {
				status: input.status,
				limit: input.limit,
			});

			return ok(expenses.map(toExpenseResponse));
		})(),
		(error) =>
			domainError("INTERNAL_SERVER_ERROR", "Failed to list expenses.", {
				cause: error instanceof Error ? error.message : String(error),
			}),
	).andThen((result) => result);

export const getExpense = (input: {
	groupId: string;
	expenseId: string;
	requestedByUserId: string;
}) =>
	ResultAsync.fromPromise(
		(async () => {
			const member = await requireActiveMember(
				input.groupId,
				input.requestedByUserId,
			);
			if (member.isErr()) return err(member.error);

			const expense = await queries.expenses.findById(
				input.groupId,
				input.expenseId,
			);
			if (!expense)
				return err(domainError("EXPENSE_NOT_FOUND", "Expense not found."));

			const participants = await queries.expenses.listParticipants(expense.id);
			return ok({
				...toExpenseResponse(expense),
				participants: participants.map((participant) => ({
					userId: participant.userId,
					amountMinor: participant.amountMinor ?? 0,
				})),
			});
		})(),
		(error) =>
			domainError("INTERNAL_SERVER_ERROR", "Failed to get expense.", {
				cause: error instanceof Error ? error.message : String(error),
			}),
	).andThen((result) => result);

export const createExpense = (input: {
	groupId: string;
	payerUserId: string;
	description?: string;
	occurredOn: string;
	totalAmountMinor: number;
	splitType: "exact";
	participants: { userId: string; amountMinor: number }[];
	createdByUserId: string;
}) => {
	const totalError = validatePositiveAmount(
		input.totalAmountMinor,
		"totalAmountMinor",
	);
	if (totalError) return errAsync(totalError);

	const duplicateUserIds = input.participants.filter(
		(participant, index) =>
			input.participants.findIndex(
				(item) => item.userId === participant.userId,
			) !== index,
	);

	if (duplicateUserIds.length > 0) {
		return errAsync(
			domainError(
				"INVALID_SPLIT",
				"Participant list cannot contain duplicate users.",
				{
					duplicateUserIds: duplicateUserIds.map(
						(participant) => participant.userId,
					),
				},
			),
		);
	}

	for (const participant of input.participants) {
		const amountError = validatePositiveAmount(
			participant.amountMinor,
			"amountMinor",
		);
		if (amountError) return errAsync(amountError);
	}

	const splitError = validateExactSplitTotal(
		input.totalAmountMinor,
		input.participants.map((participant) => participant.amountMinor),
	);

	if (splitError) return errAsync(splitError);

	return ResultAsync.fromPromise(
		(async () => {
			const result = await db.transaction(async (tx) => {
				const client = tx as QueryClient;
				const requester = await requireActiveMember(
					input.groupId,
					input.createdByUserId,
					client,
				);
				if (requester.isErr()) return err(requester.error);

				const payer = await requireActiveMember(
					input.groupId,
					input.payerUserId,
					client,
				);
				if (payer.isErr())
					return err(
						domainError(
							"PAYER_NOT_MEMBER",
							"Payer must be an active group member.",
						),
					);

				for (const participant of input.participants) {
					const member = await requireActiveMember(
						input.groupId,
						participant.userId,
						client,
					);
					if (member.isErr()) {
						return err(
							domainError(
								"PARTICIPANT_NOT_MEMBER",
								"Every participant must be an active group member.",
								{
									userId: participant.userId,
								},
							),
						);
					}
				}

				const expense = await queries.expenses.create(
					{
						id: newExpenseId(),
						groupId: input.groupId,
						payerUserId: input.payerUserId,
						createdByUserId: input.createdByUserId,
						description: input.description ?? null,
						totalAmountMinor: input.totalAmountMinor,
						currency: "MNT",
						splitType: input.splitType,
						occurredOn: input.occurredOn,
					},
					client,
				);

				await queries.expenses.createParticipants(
					input.participants.map((participant) => ({
						expenseId: expense.id,
						userId: participant.userId,
						amountMinor: participant.amountMinor,
					})),
					client,
				);

				const payerMeal =
					input.participants.find(
						(participant) => participant.userId === input.payerUserId,
					)?.amountMinor ?? 0;

				const ledgerEntries = [
					{
						userId: input.payerUserId,
						amountMinor: input.totalAmountMinor - payerMeal,
					},
					...input.participants
						.filter((participant) => participant.userId !== input.payerUserId)
						.map((participant) => ({
							userId: participant.userId,
							amountMinor: -participant.amountMinor,
						})),
				].filter((entry) => entry.amountMinor !== 0);

				const ledgerResult = await createLedgerTransaction(
					{
						groupId: input.groupId,
						type: "expense",
						entryType: "expense",
						sourceId: expense.id,
						createdByUserId: input.createdByUserId,
						currency: "MNT",
						entries: ledgerEntries,
					},
					client,
				);

				if (ledgerResult.isErr()) return err(ledgerResult.error);

				return ok({
					expense,
					ledgerTransaction: ledgerResult.value.transaction,
					ledgerEntries: ledgerResult.value.entries,
				});
			});

			if (result.isOk()) await invalidateGroupAccountingCache(input.groupId);
			return result;
		})(),
		(error) =>
			domainError("INTERNAL_SERVER_ERROR", "Failed to create expense.", {
				cause: error instanceof Error ? error.message : String(error),
			}),
	).andThen((result) => result);
};

export const voidExpense = (input: {
	groupId: string;
	expenseId: string;
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

				const expense = await queries.expenses.findById(
					input.groupId,
					input.expenseId,
					client,
				);
				if (!expense)
					return err(domainError("EXPENSE_NOT_FOUND", "Expense not found."));
				if (expense.status === "voided") {
					return err(
						domainError("EXPENSE_ALREADY_VOIDED", "Expense is already voided."),
					);
				}

				const originalTransaction =
					await queries.ledger.findTransactionBySource(
						input.groupId,
						expense.id,
						"expense",
						client,
					);

				if (!originalTransaction) {
					return err(
						domainError(
							"LEDGER_NOT_BALANCED",
							"Original expense ledger transaction was not found.",
						),
					);
				}

				const originalEntries = await queries.ledger.listEntriesByTransaction(
					originalTransaction.id,
					client,
				);

				const updatedExpense = await queries.expenses.markVoided(
					input.groupId,
					expense.id,
					input.voidedByUserId,
					client,
				);

				const reversal = await createReversalLedgerTransaction(
					{
						groupId: input.groupId,
						type: "expense_reversal",
						entryType: "expense_reversal",
						sourceId: expense.id,
						createdByUserId: input.voidedByUserId,
						currency: "MNT",
						reversesTransactionId: originalTransaction.id,
						originalEntries,
					},
					client,
				);

				if (reversal.isErr()) return err(reversal.error);

				return ok({
					expense: updatedExpense,
					reversalLedgerTransaction: reversal.value.transaction,
				});
			});

			if (result.isOk()) await invalidateGroupAccountingCache(input.groupId);
			return result;
		})(),
		(error) =>
			domainError("INTERNAL_SERVER_ERROR", "Failed to void expense.", {
				cause: error instanceof Error ? error.message : String(error),
			}),
	).andThen((result) => result);
