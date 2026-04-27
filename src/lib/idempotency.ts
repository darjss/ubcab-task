import { err, ok, type ResultAsync } from "neverthrow";
import { redis } from "~/lib/redis";
import { type DomainError, domainError } from "./errors";

type IdempotencyState = "processing" | "completed";

type IdempotencyRecord = {
	state: IdempotencyState;
	requestHash: string;
	response?: unknown;
};

const TTL_SECONDS = 24 * 60 * 60;

export const getIdempotencyKey = (
	headers: Record<string, string | undefined>,
) => headers["idempotency-key"] ?? headers["Idempotency-Key"];

export const createIdempotencyScope = (input: {
	userId: string;
	groupId: string;
	key: string;
}) => `idempotency:${input.userId}:${input.groupId}:${input.key}`;

export const hashRequestBody = async (body: unknown) => {
	const encoded = new TextEncoder().encode(JSON.stringify(body ?? null));
	const hash = await crypto.subtle.digest("SHA-256", encoded);
	return [...new Uint8Array(hash)]
		.map((byte) => byte.toString(16).padStart(2, "0"))
		.join("");
};

const readRecord = async (key: string) => {
	const value = await redis.get(key);
	return value ? (JSON.parse(value) as IdempotencyRecord) : null;
};

export const runIdempotent = async <T>(input: {
	redisKey: string;
	requestHash: string;
	run: () => ResultAsync<T, DomainError>;
}) => {
	const existing = await readRecord(input.redisKey);

	if (existing) {
		if (existing.requestHash !== input.requestHash) {
			return err(
				domainError(
					"IDEMPOTENCY_CONFLICT",
					"Idempotency key was already used with a different request body.",
				),
			);
		}

		if (existing.state === "completed") {
			return ok(existing.response as T);
		}

		return err(
			domainError(
				"IDEMPOTENCY_CONFLICT",
				"An identical request with this idempotency key is still processing.",
			),
		);
	}

	const created = await redis.set(
		input.redisKey,
		JSON.stringify({ state: "processing", requestHash: input.requestHash }),
		"EX",
		TTL_SECONDS,
		"NX",
	);

	if (created !== "OK") {
		return err(
			domainError(
				"IDEMPOTENCY_CONFLICT",
				"Idempotency key is already being processed.",
			),
		);
	}

	const result = await input.run();

	if (result.isErr()) {
		await redis.del(input.redisKey);
		return err(result.error);
	}

	await redis.set(
		input.redisKey,
		JSON.stringify({
			state: "completed",
			requestHash: input.requestHash,
			response: result.value,
		}),
		"EX",
		TTL_SECONDS,
	);

	return ok(result.value);
};
