import { err, ok, ResultAsync } from "neverthrow";
import { queries } from "~/db/queries";
import { balanceCacheKey, getJsonCache, setJsonCache } from "~/lib/cache";
import { domainError } from "~/lib/errors";
import { requireActiveMember } from "./groups";

type BalanceResponse = {
	groupId: string;
	currency: "MNT";
	balances: {
		userId: string;
		balanceMinor: number;
	}[];
	asOf: string;
};

export const getGroupBalances = (input: {
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

			const cacheKey = balanceCacheKey(input.groupId);
			const cached = await getJsonCache<BalanceResponse>(cacheKey);
			if (cached) return ok(cached);

			const balances = await queries.balances.listByGroup(input.groupId);
			const response: BalanceResponse = {
				groupId: input.groupId,
				currency: "MNT",
				balances: balances.map((balance) => ({
					userId: balance.userId,
					balanceMinor: balance.balanceMinor,
				})),
				asOf: new Date().toISOString(),
			};

			await setJsonCache(cacheKey, response);

			return ok(response);
		})(),
		(error) =>
			domainError("INTERNAL_SERVER_ERROR", "Failed to get balances.", {
				cause: error instanceof Error ? error.message : String(error),
			}),
	).andThen((result) => result);
