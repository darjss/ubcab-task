import { type DomainError, domainError } from "./errors";

export const DEFAULT_CURRENCY = "MNT" as const;
export const MAX_SAFE_AMOUNT_MINOR = Number.MAX_SAFE_INTEGER;

export const isPositiveIntegerAmount = (amount: number): boolean =>
	Number.isSafeInteger(amount) && amount > 0;

export const isNonZeroIntegerAmount = (amount: number): boolean =>
	Number.isSafeInteger(amount) && amount !== 0;

export const sumAmounts = (amounts: readonly number[]): number =>
	amounts.reduce((sum, amount) => sum + amount, 0);

export const validatePositiveAmount = (
	amount: number,
	fieldName = "amountMinor",
): DomainError | null => {
	if (isPositiveIntegerAmount(amount)) return null;

	return domainError(
		"VALIDATION_ERROR",
		`${fieldName} must be a positive integer.`,
		{
			field: fieldName,
			value: amount,
		},
	);
};

export const validateExactSplitTotal = (
	totalAmountMinor: number,
	participantAmounts: readonly number[],
): DomainError | null => {
	const actualTotalMinor = sumAmounts(participantAmounts);

	if (actualTotalMinor === totalAmountMinor) return null;

	return domainError(
		"INVALID_SPLIT",
		"Participant amounts must add up to totalAmountMinor.",
		{
			expectedTotalMinor: totalAmountMinor,
			actualTotalMinor,
		},
	);
};
