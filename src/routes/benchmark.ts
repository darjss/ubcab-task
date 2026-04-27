import { sql } from "drizzle-orm";
import { Elysia } from "elysia";
import { db } from "~/db";
import { BenchmarkResponseSchema } from "~/lib/schemas";
import { redis } from "~/lib/redis";

const elapsedMs = (start: number) =>
	Math.round((performance.now() - start) * 1000) / 1000;

export const benchmarkRoutes = new Elysia({ name: "benchmark-routes" }).get(
	"/benchmark",
	async () => {
		// Redis — easy: PING
		let t0 = performance.now();
		const ping = await redis.ping();
		const redisEasyMs = elapsedMs(t0);

		// Redis — hard: many round-trips in one pipeline (80 commands)
		t0 = performance.now();
		const pipe = redis.pipeline();
		for (let i = 0; i < 40; i++) {
			const k = `__bench:hard:${i}`;
			pipe.set(k, `v${i}`, "EX", 60);
			pipe.get(k);
		}
		await pipe.exec();
		const redisHardMs = elapsedMs(t0);

		// Postgres — easy
		t0 = performance.now();
		await db.execute(sql`SELECT 1 AS n`);
		const pgEasyMs = elapsedMs(t0);

		// Postgres — hard: join + aggregates + sort (typical reporting load)
		t0 = performance.now();
		const heavy = await db.execute<{
			id: string;
			user_id: string | null;
			n_entries: string;
			total_minor: string;
		}>(sql`
			SELECT
				g.id,
				le.user_id,
				COUNT(le.id)::int AS n_entries,
				COALESCE(SUM(le.amount_minor), 0)::bigint AS total_minor
			FROM groups g
			LEFT JOIN ledger_entries le ON le.group_id = g.id
			GROUP BY g.id, le.user_id
			ORDER BY g.id, le.user_id
			LIMIT 5000
		`);
		const pgHardMs = elapsedMs(t0);

		return {
			data: {
				redis: {
					easyMs: redisEasyMs,
					hardMs: redisHardMs,
					ping: String(ping),
					hardPipelineCommands: 80,
				},
				postgres: {
					easyMs: pgEasyMs,
					hardMs: pgHardMs,
					hardRowCount: heavy.rows.length,
				},
				generatedAt: new Date().toISOString(),
			},
		};
	},
	{
		response: {
			200: BenchmarkResponseSchema,
		},
		detail: {
			tags: ["Benchmark"],
			summary: "Latency probe for Redis and Postgres",
			description:
				"Returns wall-clock timings (ms) for a trivial and a heavier operation on each store. No auth required.",
		},
	},
);
