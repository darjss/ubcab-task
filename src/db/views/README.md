# Database Views

## `group_member_balances_view`

This view derives each member's current balance from immutable ledger entries.

```sql
SELECT
  group_id,
  user_id,
  currency,
  SUM(amount_minor) AS balance_minor
FROM ledger_entries
GROUP BY group_id, user_id, currency;
```

Balance semantics:

```text
positive balance = user should receive money
negative balance = user owes money
zero balance     = user is settled
```

Important design rule:

```text
ledger_entries = source of truth
group_member_balances_view = derived current state
Redis = optional cache only
```

The project intentionally does not maintain a mutable `member_balances` table for the assignment. If production read volume grows, a rebuildable projection table can be added later.

## Applying the view

Drizzle table schemas do not automatically create this view. Apply it as a manual SQL migration or include it in a generated migration after the `ledger_entries` table is created.
