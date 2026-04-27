import { redis } from "~/lib/redis";

const DEFAULT_TTL_SECONDS = 30;

export const getJsonCache = async <T>(key: string): Promise<T | null> => {
	try {
		const cached = await redis.get(key);
		return cached ? (JSON.parse(cached) as T) : null;
	} catch {
		return null;
	}
};

export const setJsonCache = async (
	key: string,
	value: unknown,
	ttlSeconds = DEFAULT_TTL_SECONDS,
) => {
	try {
		await redis.set(key, JSON.stringify(value), "EX", ttlSeconds);
	} catch {
		// Cache failures should not break reads. Postgres remains source of truth.
	}
};

export const balanceCacheKey = (groupId: string) => `group:${groupId}:balances`;
export const settlementPreviewCacheKey = (groupId: string) =>
	`group:${groupId}:settlement-preview`;

export const invalidateGroupAccountingCache = async (groupId: string) => {
	try {
		await redis.del(
			balanceCacheKey(groupId),
			settlementPreviewCacheKey(groupId),
		);
	} catch {
		// Cache invalidation failure should be logged in production.
		// The short TTL keeps stale reads bounded for this assignment.
	}
};
