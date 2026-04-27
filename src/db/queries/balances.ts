import { sql } from "drizzle-orm";
import { db } from "~/db";
import type { Balance } from "~/lib/types";
import type { QueryClient } from "./client";

export const balanceQueries = {
	listByGroup: async (
		groupId: string,
		client: QueryClient = db,
	): Promise<Balance[]> => {
		const result = await client.execute<{
			group_id: string;
			user_id: string;
			currency: "MNT";
			balance_minor: string;
		}>(sql`
			SELECT
				group_id,
				user_id,
				currency,
				balance_minor
			FROM group_member_balances_view
			WHERE group_id = ${groupId}
			ORDER BY user_id
		`);

		return result.rows.map((row) => ({
			groupId: row.group_id,
			userId: row.user_id,
			currency: row.currency,
			balanceMinor: Number(row.balance_minor),
		}));
	},
};
