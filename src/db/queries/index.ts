import { balanceQueries } from "./balances";
import { expenseQueries } from "./expenses";
import { groupQueries } from "./groups";
import { ledgerQueries } from "./ledger";
import { memberQueries } from "./members";
import { settlementQueries } from "./settlements";

export const queries = {
	groups: groupQueries,
	members: memberQueries,
	expenses: expenseQueries,
	ledger: ledgerQueries,
	settlements: settlementQueries,
	balances: balanceQueries,
} as const;

export type Queries = typeof queries;
