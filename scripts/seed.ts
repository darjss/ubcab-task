/**
 *   bun run db:seed                 # 7 @lunch.ub users + data when SEED_RESET/SEED_FULL
 *   SEED_RESET=1 bun run db:seed    # TRUNCATE all, 7 users, 2 groups, meals, settlements, voids
 *   bun run db:seed:prod            # (see seed-prod.ts) — needs DATABASE_PUBLIC_URL
 *
 * Domain coverage: 7 users, 2 groups, 10+7 meals, multiple settlements, voided expenses, voided settlements.
 */
import "dotenv/config";
import { inArray, sql } from "drizzle-orm";
import { db } from "~/db";
import { account, user } from "~/db/schema";
import { groups } from "~/db/schema/groups";
import { auth } from "~/lib/auth";
import { runDomainSeed, SEED_PASSWORD, SEED_USER_ROWS } from "./seed-data";

const origin = (process.env.BETTER_AUTH_URL ?? "http://127.0.0.1:3000").replace(
	/\/+$/u,
	"",
);
const signUpHeaders = new Headers({ origin });

async function maybeReset() {
	if (process.env.SEED_RESET !== "1") return;

	console.log("SEED_RESET=1: truncating domain + auth tables…");
	await db.execute(sql`
		TRUNCATE TABLE
			"ledger_entries",
			"ledger_transactions",
			"settlement_transfers",
			"settlement_batches",
			"expense_participants",
			"expenses",
			"group_members",
			"groups",
			"verification",
			"session",
			"account",
			"user"
		RESTART IDENTITY CASCADE
	`);
}

async function clearAuthOnly() {
	if (process.env.SEED_AUTH_CLEAR === "1") {
		console.log(
			"SEED_AUTH_CLEAR=1: deleting account + user (domain must be empty)…",
		);
		await db.delete(account);
		await db.delete(user);
	}
}

async function signUpOnce(entry: (typeof SEED_USER_ROWS)[number]) {
	return auth.api.signUpEmail({
		body: {
			email: entry.email,
			password: SEED_PASSWORD,
			name: entry.name,
		},
		headers: signUpHeaders,
	});
}

/** Ensure all seed users exist (sign up; on duplicate, only log). */
export async function ensureUsers() {
	for (const u of SEED_USER_ROWS) {
		try {
			const res = await signUpOnce(u);
			console.log(
				"Signed up:",
				u.email,
				(res as { user?: { id: string } }).user?.id,
			);
		} catch (e: unknown) {
			const m = e instanceof Error ? e.message : String(e);
			if (
				m.includes("already") ||
				m.includes("exists") ||
				m.includes("UNIQUE")
			) {
				console.log("Skip (exists):", u.email);
			} else {
				throw e;
			}
		}
	}
}

export async function hasSeedGroups(): Promise<boolean> {
	const [g] = await db
		.select({ id: groups.id })
		.from(groups)
		.where(
			inArray(groups.name, ["Mizorn team lunch", "Tenger floor coffee run"]),
		)
		.limit(1);
	return Boolean(g);
}

export async function seed() {
	const wantDomain =
		process.env.SEED_RESET === "1" || process.env.SEED_FULL === "1";

	if (process.env.SEED_RESET === "1") {
		await maybeReset();
	} else {
		await clearAuthOnly();
	}

	console.log("Auth: upsert 7 users …");
	await ensureUsers();

	if (!wantDomain) {
		console.log(
			"Domain seed skipped. Run with SEED_RESET=1 (full TRUNC) or SEED_FULL=1 (if no seed groups).",
		);
		return;
	}

	if (process.env.SEED_RESET !== "1" && (await hasSeedGroups())) {
		console.log(
			"Seed groups already present; skip domain. Use SEED_RESET=1 to replace.",
		);
		return;
	}

	console.log("Domain: 2 groups, ~19 meals, settlements, voids …");
	const out = await runDomainSeed();
	console.log("Seeded group ids:", out.gid1, out.gid2);
}

seed()
	.catch((err) => {
		console.error("Seed failed:", err);
		process.exit(1);
	})
	.finally(() => {
		process.exit(0);
	});
