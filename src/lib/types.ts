import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import type {
	expenseParticipants,
	expenses,
	groupMembers,
	groups,
	ledgerEntries,
	ledgerTransactions,
	settlementBatches,
	settlementTransfers,
	user,
} from "~/db/schema";

export type User = InferSelectModel<typeof user>;
export type NewUser = InferInsertModel<typeof user>;

export type Group = InferSelectModel<typeof groups>;
export type NewGroup = InferInsertModel<typeof groups>;

export type GroupMember = InferSelectModel<typeof groupMembers>;
export type NewGroupMember = InferInsertModel<typeof groupMembers>;

export type Expense = InferSelectModel<typeof expenses>;
export type NewExpense = InferInsertModel<typeof expenses>;

export type ExpenseParticipant = InferSelectModel<typeof expenseParticipants>;
export type NewExpenseParticipant = InferInsertModel<
	typeof expenseParticipants
>;

export type LedgerTransaction = InferSelectModel<typeof ledgerTransactions>;
export type NewLedgerTransaction = InferInsertModel<typeof ledgerTransactions>;

export type LedgerEntry = InferSelectModel<typeof ledgerEntries>;
export type NewLedgerEntry = InferInsertModel<typeof ledgerEntries>;

export type SettlementBatch = InferSelectModel<typeof settlementBatches>;
export type NewSettlementBatch = InferInsertModel<typeof settlementBatches>;

export type SettlementTransfer = InferSelectModel<typeof settlementTransfers>;
export type NewSettlementTransfer = InferInsertModel<
	typeof settlementTransfers
>;

export type GroupMemberRole = GroupMember["role"];
export type GroupMemberStatus = GroupMember["status"];
export type SplitType = Expense["splitType"];
export type ExpenseStatus = Expense["status"];
export type LedgerTransactionType = LedgerTransaction["type"];
export type LedgerEntryType = LedgerEntry["entryType"];
export type SettlementStatus = SettlementBatch["status"];
export type SettlementTransferStatus = SettlementTransfer["status"];

export type CurrencyCode = "MNT";
export type AmountMinor = number;

export type Balance = {
	groupId: string;
	userId: string;
	currency: CurrencyCode;
	balanceMinor: AmountMinor;
};

export type SettlementTransferSuggestion = {
	fromUserId: string;
	toUserId: string;
	amountMinor: AmountMinor;
	currency: CurrencyCode;
};
