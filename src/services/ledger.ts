import { err, errAsync, ok, type Result, ResultAsync } from "neverthrow";
import { db } from "~/db";
import { queries } from "~/db/queries";
import type { QueryClient } from "~/db/queries/client";
import { type DomainError, domainError } from "~/lib/errors";
import { newLedgerEntryId, newLedgerTransactionId } from "~/lib/ids";
import { isNonZeroIntegerAmount, sumAmounts } from "~/lib/money";
import type {
	LedgerEntryType,
	LedgerTransactionType,
	NewLedgerEntry,
} from "~/lib/types";
import { requireActiveMember } from "./groups";

type LedgerEntryInput = {
	userId: string;
	amountMinor: number;
};

type CreateLedgerTransactionInput = {
	groupId: string;
	type: LedgerTransactionType;
	entryType: LedgerEntryType;
	sourceId: string;
	createdByUserId: string;
	currency: "MNT";
	reversesTransactionId?: string | null;
	entries: LedgerEntryInput[];
};

type ListLedgerEntriesInput = {
	groupId: string;
	requestedByUserId: string;
	userId?: string;
	type?: LedgerEntryType;
	from?: string;
	to?: string;
	limit?: number;
	cursor?: string;
};

const parseOptionalDate = (value: string | undefined, field: string) => {
	if (!value) return ok(undefined);

	const date = new Date(value);
	if (Number.isNaN(date.getTime())) {
		return err(
			domainError(
				"VALIDATION_ERROR",
				`${field} must be a valid ISO timestamp.`,
				{
					field,
				},
			),
		);
	}

	return ok(date);
};

export const validateLedgerEntries = (
	entries: readonly LedgerEntryInput[],
): Result<readonly LedgerEntryInput[], DomainError> => {
	if (entries.length < 2) {
		return err(
			domainError(
				"LEDGER_NOT_BALANCED",
				"A ledger transaction needs at least two entries.",
			),
		);
	}

	const invalidEntry = entries.find(
		(entry) => !isNonZeroIntegerAmount(entry.amountMinor),
	);

	if (invalidEntry) {
		return err(
			domainError(
				"VALIDATION_ERROR",
				"Ledger entry amounts must be non-zero integers.",
				{
					userId: invalidEntry.userId,
					amountMinor: invalidEntry.amountMinor,
				},
			),
		);
	}

	const totalAmountMinor = sumAmounts(
		entries.map((entry) => entry.amountMinor),
	);

	if (totalAmountMinor !== 0) {
		return err(
			domainError("LEDGER_NOT_BALANCED", "Ledger entries must sum to zero.", {
				totalAmountMinor,
			}),
		);
	}

	return ok(entries);
};

export const listLedgerEntries = (input: ListLedgerEntriesInput) => {
	const from = parseOptionalDate(input.from, "from");
	if (from.isErr()) return errAsync(from.error);

	const to = parseOptionalDate(input.to, "to");
	if (to.isErr()) return errAsync(to.error);

	const cursor = parseOptionalDate(input.cursor, "cursor");
	if (cursor.isErr()) return errAsync(cursor.error);

	return ResultAsync.fromPromise(
		(async () => {
			const membership = await requireActiveMember(
				input.groupId,
				input.requestedByUserId,
			);
			if (membership.isErr()) return err(membership.error);

			const limit = input.limit ?? 50;
			const entries = await queries.ledger.listEntriesByGroup(input.groupId, {
				userId: input.userId,
				type: input.type,
				from: from.value,
				to: to.value,
				limit: limit + 1,
				cursor: cursor.value,
			});

			const page = entries.slice(0, limit);
			const nextEntry = entries[limit];

			return ok({
				data: page.map((entry) => ({
					id: entry.id,
					transactionId: entry.transactionId,
					type: entry.entryType,
					userId: entry.userId,
					amountMinor: entry.amountMinor,
					currency: "MNT" as const,
					createdAt: entry.createdAt.toISOString(),
				})),
				pagination: {
					nextCursor: nextEntry?.createdAt.toISOString() ?? null,
				},
			});
		})(),
		(error) =>
			domainError("INTERNAL_SERVER_ERROR", "Failed to list ledger entries.", {
				cause: error instanceof Error ? error.message : String(error),
			}),
	).andThen((result) => result);
};

export const createLedgerTransaction = (
	input: CreateLedgerTransactionInput,
	client: QueryClient = db,
) => {
	const validEntries = validateLedgerEntries(input.entries);

	if (validEntries.isErr()) {
		return errAsync(validEntries.error);
	}

	return ResultAsync.fromPromise(
		(async () => {
			const transaction = await queries.ledger.createTransaction(
				{
					id: newLedgerTransactionId(),
					groupId: input.groupId,
					type: input.type,
					sourceId: input.sourceId,
					reversesTransactionId: input.reversesTransactionId ?? null,
					createdByUserId: input.createdByUserId,
				},
				client,
			);

			const entries: NewLedgerEntry[] = input.entries.map((entry) => ({
				id: newLedgerEntryId(),
				transactionId: transaction.id,
				groupId: input.groupId,
				userId: entry.userId,
				amountMinor: entry.amountMinor,
				currency: input.currency,
				entryType: input.entryType,
			}));

			const ledgerEntries = await queries.ledger.createEntries(entries, client);

			return {
				transaction,
				entries: ledgerEntries,
			};
		})(),
		(error) =>
			domainError(
				"INTERNAL_SERVER_ERROR",
				"Failed to create ledger transaction.",
				{
					cause: error instanceof Error ? error.message : String(error),
				},
			),
	);
};

export const createReversalLedgerTransaction = (
	input: Omit<CreateLedgerTransactionInput, "entries"> & {
		originalEntries: readonly NewLedgerEntry[];
	},
	client: QueryClient = db,
) =>
	createLedgerTransaction(
		{
			...input,
			entries: input.originalEntries.map((entry) => ({
				userId: entry.userId,
				amountMinor: -entry.amountMinor,
			})),
		},
		client,
	);
