import { err, ok, type Result } from "neverthrow";
import { type DomainError, domainError } from "./errors";
import type {
	AmountMinor,
	CurrencyCode,
	SettlementTransferSuggestion,
} from "./types";

type SettlementBalanceInput = {
	userId: string;
	balanceMinor: AmountMinor;
	currency: CurrencyCode;
};

type WorkingAmount = {
	userId: string;
	remainingMinor: AmountMinor;
};

export const calculateSettlementTransfers = (
	balances: readonly SettlementBalanceInput[],
): Result<SettlementTransferSuggestion[], DomainError> => {
	const total = balances.reduce(
		(sum, balance) => sum + balance.balanceMinor,
		0,
	);

	if (total !== 0) {
		return err(
			domainError("LEDGER_NOT_BALANCED", "Group balances must sum to zero.", {
				actualTotalMinor: total,
			}),
		);
	}

	const currencies = new Set(balances.map((balance) => balance.currency));

	if (currencies.size > 1) {
		return err(
			domainError(
				"VALIDATION_ERROR",
				"Settlement preview supports one currency at a time.",
				{
					currencies: [...currencies],
				},
			),
		);
	}

	const currency = balances[0]?.currency ?? "MNT";
	const debtors: WorkingAmount[] = balances
		.filter((balance) => balance.balanceMinor < 0)
		.map((balance) => ({
			userId: balance.userId,
			remainingMinor: Math.abs(balance.balanceMinor),
		}))
		.sort((a, b) => b.remainingMinor - a.remainingMinor);

	const creditors: WorkingAmount[] = balances
		.filter((balance) => balance.balanceMinor > 0)
		.map((balance) => ({
			userId: balance.userId,
			remainingMinor: balance.balanceMinor,
		}))
		.sort((a, b) => b.remainingMinor - a.remainingMinor);

	const transfers: SettlementTransferSuggestion[] = [];
	let debtorIndex = 0;
	let creditorIndex = 0;

	while (debtorIndex < debtors.length && creditorIndex < creditors.length) {
		const debtor = debtors[debtorIndex];
		const creditor = creditors[creditorIndex];
		const amountMinor = Math.min(
			debtor.remainingMinor,
			creditor.remainingMinor,
		);

		if (amountMinor > 0) {
			transfers.push({
				fromUserId: debtor.userId,
				toUserId: creditor.userId,
				amountMinor,
				currency,
			});
		}

		debtor.remainingMinor -= amountMinor;
		creditor.remainingMinor -= amountMinor;

		if (debtor.remainingMinor === 0) debtorIndex += 1;
		if (creditor.remainingMinor === 0) creditorIndex += 1;
	}

	return ok(transfers);
};
