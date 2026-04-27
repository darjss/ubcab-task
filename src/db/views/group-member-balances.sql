-- Derived balance view for the lunch settlement ledger.
--
-- Source of truth: ledger_entries
-- Current balance: SUM(amount_minor) per group/user/currency
--
-- Positive balance means the user should receive money.
-- Negative balance means the user owes money.
-- Zero balance means the user is settled.
--
-- This view intentionally does not store mutable balances. Redis may cache
-- responses that use this view, but Redis is never the accounting source of truth.

CREATE OR REPLACE VIEW group_member_balances_view AS
SELECT
	le.group_id,
	le.user_id,
	le.currency,
	SUM(le.amount_minor) AS balance_minor
FROM ledger_entries AS le
GROUP BY
	le.group_id,
	le.user_id,
	le.currency;
