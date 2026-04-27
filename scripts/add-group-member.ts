/**
 * Add a user to a group (DB direct). For production use Railway/Postgres
 * public URL: DATABASE_URL=... from project variables.
 *
 *   bun run scripts/add-group-member.ts <groupId> [userNameOrEmailSubstring]
 *   GROUP_ID=... USER_MATCH=aviddaram USER_ID=... bun run scripts/add-group-member.ts
 *
 * If USER_ID is set, it wins over name/email search.
 */
import "dotenv/config";
import { eq, ilike, or } from "drizzle-orm";
import { db } from "~/db";
import { queries } from "~/db/queries";
import { user } from "~/db/schema";
import { groups } from "~/db/schema/groups";

const groupId = process.argv[2] ?? process.env.GROUP_ID ?? "";
const userMatch = process.argv[3] ?? process.env.USER_MATCH ?? "aviddaram";
const userId = process.env.USER_ID ?? "";

async function main() {
	if (!groupId) {
		console.error(
			"Usage: bun run scripts/add-group-member.ts <groupId> [userNameOrEmailSubstring]\n" +
				"   or: GROUP_ID=... USER_MATCH=aviddaram bun run scripts/add-group-member.ts",
		);
		process.exit(1);
	}

	const [g] = await db
		.select({ id: groups.id })
		.from(groups)
		.where(eq(groups.id, groupId))
		.limit(1);
	if (!g) {
		console.error(`Group not found: ${groupId}`);
		process.exit(1);
	}

	let targetId: string;
	if (userId) {
		const [u] = await db
			.select({ id: user.id, name: user.name, email: user.email })
			.from(user)
			.where(eq(user.id, userId))
			.limit(1);
		if (!u) {
			console.error(`No user for USER_ID: ${userId}`);
			process.exit(1);
		}
		targetId = u.id;
		console.log("Using user:", u);
	} else {
		const like = `%${userMatch.replace(/([%_])/g, "\\$1")}%`;
		const rows = await db
			.select({ id: user.id, name: user.name, email: user.email })
			.from(user)
			.where(or(ilike(user.name, like), ilike(user.email, like)));
		if (rows.length === 0) {
			console.error(`No user matching: ${userMatch}`);
			process.exit(1);
		}
		if (rows.length > 1) {
			console.error(
				`Multiple users match "${userMatch}"; set USER_ID=... or narrow the name/email.`,
			);
			for (const r of rows) {
				console.error(`  ${r.id}  ${r.name}  <${r.email}>`);
			}
			process.exit(1);
		}
		const u = rows[0];
		if (!u) {
			console.error(`No user matching: ${userMatch}`);
			process.exit(1);
		}
		targetId = u.id;
		console.log("Matched user:", u);
	}

	const existing = await queries.members.findMembership(groupId, targetId);
	if (existing?.status === "active") {
		console.log("Already an active member:", existing);
		process.exit(0);
	}

	if (existing) {
		const updated = await queries.members.restoreActive(
			groupId,
			targetId,
			"member",
		);
		console.log("Reactivated member:", updated);
		process.exit(0);
	}

	const created = await queries.members.create({
		groupId,
		userId: targetId,
		role: "member",
		status: "active",
		joinedAt: new Date(),
	});
	console.log("Added member:", created);
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
