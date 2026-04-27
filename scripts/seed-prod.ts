/**
 * Production / remote DB: uses DATABASE_PUBLIC_URL (Postgres public proxy) so the
 * script works from a laptop. Railway’s internal *.railway.internal host does not
 * resolve locally.
 *
 * 1) Railway → Postgres → Connect → copy the *public* URL
 * 2) Add `DATABASE_PUBLIC_URL` on the ubcab-task service, then:
 *    `railway run -- bun run db:seed:prod`
 *    Or use a gitignored .env with that var and `bun run db:seed:prod`
 */
import { config } from "dotenv";

config();

const dbUrl = process.env.DATABASE_URL ?? "";
const looksInternal = /\.railway\.internal(?::|\/)/u.test(dbUrl);
const pub =
	process.env.DATABASE_PUBLIC_URL ??
	(dbUrl && !looksInternal ? dbUrl : undefined);

if (!pub) {
	console.error(
		"Set DATABASE_PUBLIC_URL to the Postgres *public* URL (Railway → Postgres → Connect → public),",
	);
	console.error(
		"or set DATABASE_URL to that public string. *railway.internal* only works inside Railway’s network.",
	);
	process.exit(1);
}

process.env.DATABASE_URL = pub;
process.env.SEED_PROD = "1";
process.env.BETTER_AUTH_URL ??= "https://ubcab-task-production.up.railway.app";

if (
	process.env.SEED_RESET === "1" &&
	process.env.ALLOW_DANGEROUS_PROD_RESET !== "1"
) {
	console.error(
		"Refusing SEED_RESET=1 against production. To wipe production data, set ALLOW_DANGEROUS_PROD_RESET=1 (you really mean it).",
	);
	process.exit(1);
}

await import("./seed");
