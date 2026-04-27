import { eq } from "drizzle-orm";
import type { Result } from "neverthrow";
import { db } from "~/db";
import { user } from "~/db/schema";
import type { DomainError } from "~/lib/errors";
import { createExpense, voidExpense } from "~/services/expenses";
import { createGroup } from "~/services/groups";
import { addGroupMember } from "~/services/members";
import { createSettlement, voidSettlement } from "~/services/settlements";

function unwrap<T>(r: Result<T, DomainError>, label: string): T {
	if (r.isErr()) {
		throw new Error(`${label}: ${JSON.stringify(r.error)}`);
	}
	return r.value;
}

export const SEED_PASSWORD = "Password123" as const;

export const SEED_USER_ROWS = [
	{ key: "bataa", name: "Bataa", email: "bataa@lunch.ub" },
	{ key: "ganaa", name: "Ganaa", email: "ganaa@lunch.ub" },
	{ key: "bayaraa", name: "Bayaraa", email: "bayaraa@lunch.ub" },
	{ key: "gerlee", name: "Gerlee", email: "gerlee@lunch.ub" },
	{ key: "tsetsgee", name: "Tsetsgee", email: "tsetsgee@lunch.ub" },
	{ key: "oyunaa", name: "Oyunaa", email: "oyunaa@lunch.ub" },
	{ key: "bold", name: "Bold", email: "bold@lunch.ub" },
] as const;

export type SeedKey = (typeof SEED_USER_ROWS)[number]["key"];
export type UserIds = Record<SeedKey, string>;

type Part = { key: SeedKey; m: number };

export async function resolveUserIdsByEmail(): Promise<UserIds> {
	const out = {} as UserIds;
	for (const { key, email } of SEED_USER_ROWS) {
		const [r] = await db.select().from(user).where(eq(user.email, email));
		if (!r) throw new Error(`Missing user in DB: ${email}. Run sign-up first.`);
		out[key] = r.id;
	}
	return out;
}

const G1_NAME = "Mizorn team lunch";
const G2_NAME = "Tenger floor coffee run";

/**
 * Group 1: 7 people, 12 meals, 2 voided expenses, 3 settlements, 2 voided settlements, final posted settle.
 * Group 2: 6 people, 7 meals, 1 voided expense, 3 settlements, 1 voided settlement, final posted settle.
 */
export async function runDomainSeed() {
	const u = await resolveUserIdsByEmail();

	// —— Group 1: Bataa owner, Ganaa admin, rest members
	const g1r = await createGroup({
		name: G1_NAME,
		currency: "MNT",
		createdByUserId: u.bataa,
	});
	const g1 = unwrap(g1r, "createGroup G1");
	const gid1 = g1.id;

	for (const [uid, role] of [
		[u.ganaa, "admin" as const],
		[u.bayaraa, "member" as const],
		[u.gerlee, "member" as const],
		[u.tsetsgee, "member" as const],
		[u.oyunaa, "member" as const],
		[u.bold, "member" as const],
	] as const) {
		unwrap(
			await addGroupMember({
				groupId: gid1,
				userId: uid,
				role: role,
				requestedByUserId: u.bataa,
			}),
			"addGroupMember G1",
		);
	}

	// —— Group 2: Ganaa owner, Bataa admin, 4 others; Bold is not in this group
	const g2r = await createGroup({
		name: G2_NAME,
		currency: "MNT",
		createdByUserId: u.ganaa,
	});
	const g2 = unwrap(g2r, "createGroup G2");
	const gid2 = g2.id;
	for (const [uid, role] of [
		[u.bataa, "admin" as const],
		[u.bayaraa, "member" as const],
		[u.gerlee, "member" as const],
		[u.tsetsgee, "member" as const],
		[u.oyunaa, "member" as const],
	] as const) {
		unwrap(
			await addGroupMember({
				groupId: gid2,
				userId: uid,
				role: role,
				requestedByUserId: u.ganaa,
			}),
			"addGroupMember G2",
		);
	}

	// —— G1: meals
	const p = (k: Part[]) =>
		k.map((x) => ({ userId: u[x.key], amountMinor: x.m }));

	// 1
	unwrap(
		await createExpense({
			groupId: gid1,
			payerUserId: u.bataa,
			createdByUserId: u.bataa,
			description: "Cafeteria: four of us (Mon)",
			occurredOn: "2026-01-02",
			totalAmountMinor: 50_000,
			splitType: "exact",
			participants: p([
				{ key: "bataa", m: 12_000 },
				{ key: "ganaa", m: 15_000 },
				{ key: "tsetsgee", m: 10_000 },
				{ key: "oyunaa", m: 13_000 },
			]),
		}),
		"E1 G1",
	);
	// 2
	unwrap(
		await createExpense({
			groupId: gid1,
			payerUserId: u.ganaa,
			createdByUserId: u.ganaa,
			description: "Quick lunch 3p",
			occurredOn: "2026-01-03",
			totalAmountMinor: 36_000,
			splitType: "exact",
			participants: p([
				{ key: "bataa", m: 18_000 },
				{ key: "ganaa", m: 9_000 },
				{ key: "bold", m: 9_000 },
			]),
		}),
		"E2 G1",
	);
	// 3 (will be voided later)
	const e3 = unwrap(
		await createExpense({
			groupId: gid1,
			payerUserId: u.gerlee,
			createdByUserId: u.gerlee,
			description: "Duo meal (reversed in audit)",
			occurredOn: "2026-01-04",
			totalAmountMinor: 28_000,
			splitType: "exact",
			participants: p([
				{ key: "bataa", m: 16_000 },
				{ key: "bayaraa", m: 12_000 },
			]),
		}),
		"E3 G1",
	);
	// 4
	unwrap(
		await createExpense({
			groupId: gid1,
			payerUserId: u.bayaraa,
			createdByUserId: u.bayaraa,
			description: "Set lunch — five people",
			occurredOn: "2026-01-05",
			totalAmountMinor: 100_000,
			splitType: "exact",
			participants: p([
				{ key: "bataa", m: 20_000 },
				{ key: "ganaa", m: 20_000 },
				{ key: "gerlee", m: 20_000 },
				{ key: "tsetsgee", m: 20_000 },
				{ key: "oyunaa", m: 20_000 },
			]),
		}),
		"E4 G1",
	);
	// 5
	unwrap(
		await createExpense({
			groupId: gid1,
			payerUserId: u.tsetsgee,
			createdByUserId: u.tsetsgee,
			description: "Burger run",
			occurredOn: "2026-01-06",
			totalAmountMinor: 64_000,
			splitType: "exact",
			participants: p([
				{ key: "bataa", m: 16_000 },
				{ key: "ganaa", m: 16_000 },
				{ key: "bold", m: 16_000 },
				{ key: "oyunaa", m: 16_000 },
			]),
		}),
		"E5 G1",
	);
	// 6
	unwrap(
		await createExpense({
			groupId: gid1,
			payerUserId: u.oyunaa,
			createdByUserId: u.oyunaa,
			description: "All-hands 7p",
			occurredOn: "2026-01-08",
			totalAmountMinor: 77_000,
			splitType: "exact",
			participants: p([
				{ key: "bataa", m: 11_000 },
				{ key: "ganaa", m: 11_000 },
				{ key: "bayaraa", m: 11_000 },
				{ key: "gerlee", m: 11_000 },
				{ key: "tsetsgee", m: 11_000 },
				{ key: "oyunaa", m: 11_000 },
				{ key: "bold", m: 11_000 },
			]),
		}),
		"E6 G1",
	);

	// First settlement
	const s1g1 = unwrap(
		await createSettlement({
			groupId: gid1,
			settledTo: "2026-01-10T12:00:00.000Z",
			note: "Mid-month settle #1 (Mizorn)",
			createdByUserId: u.bataa,
		}),
		"S1 G1",
	);

	// 7-10
	unwrap(
		await createExpense({
			groupId: gid1,
			payerUserId: u.bold,
			createdByUserId: u.bold,
			description: "Korean, 3 people",
			occurredOn: "2026-01-12",
			totalAmountMinor: 45_000,
			splitType: "exact",
			participants: p([
				{ key: "bold", m: 15_000 },
				{ key: "bataa", m: 15_000 },
				{ key: "ganaa", m: 15_000 },
			]),
		}),
		"E7 G1",
	);
	const e8 = unwrap(
		await createExpense({
			groupId: gid1,
			payerUserId: u.bayaraa,
			createdByUserId: u.bayaraa,
			description: "To be voided: duplicate entry",
			occurredOn: "2026-01-13",
			totalAmountMinor: 30_000,
			splitType: "exact",
			participants: p([
				{ key: "bataa", m: 10_000 },
				{ key: "ganaa", m: 10_000 },
				{ key: "gerlee", m: 10_000 },
			]),
		}),
		"E8 G1",
	);
	unwrap(
		await createExpense({
			groupId: gid1,
			payerUserId: u.bataa,
			createdByUserId: u.bataa,
			description: "Friday four",
			occurredOn: "2026-01-15",
			totalAmountMinor: 88_000,
			splitType: "exact",
			participants: p([
				{ key: "bataa", m: 22_000 },
				{ key: "ganaa", m: 22_000 },
				{ key: "tsetsgee", m: 22_000 },
				{ key: "oyunaa", m: 22_000 },
			]),
		}),
		"E9 G1",
	);
	unwrap(
		await createExpense({
			groupId: gid1,
			payerUserId: u.gerlee,
			createdByUserId: u.gerlee,
			description: "Pho, 2 people",
			occurredOn: "2026-01-16",
			totalAmountMinor: 32_000,
			splitType: "exact",
			participants: p([
				{ key: "gerlee", m: 16_000 },
				{ key: "tsetsgee", m: 16_000 },
			]),
		}),
		"E10 G1",
	);

	const s2g1 = unwrap(
		await createSettlement({
			groupId: gid1,
			settledTo: "2026-01-20T10:00:00.000Z",
			note: "Settle #2 (Mizorn)",
			createdByUserId: u.bataa,
		}),
		"S2 G1",
	);

	// Reversals: void expense 3, void expense 8, void settlement 1
	unwrap(
		await voidExpense({
			groupId: gid1,
			expenseId: e3.expense.id,
			voidedByUserId: u.bataa,
		}),
		"void E3 G1",
	);
	unwrap(
		await voidExpense({
			groupId: gid1,
			expenseId: e8.expense.id,
			voidedByUserId: u.bataa,
		}),
		"void E8 G1",
	);
	unwrap(
		await voidSettlement({
			groupId: gid1,
			settlementId: s1g1.batch.id,
			voidedByUserId: u.bataa,
		}),
		"void S1 G1",
	);

	// 11-12
	unwrap(
		await createExpense({
			groupId: gid1,
			payerUserId: u.ganaa,
			createdByUserId: u.ganaa,
			description: "Post-voids catch-up",
			occurredOn: "2026-01-22",
			totalAmountMinor: 40_000,
			splitType: "exact",
			participants: p([
				{ key: "bataa", m: 10_000 },
				{ key: "ganaa", m: 10_000 },
				{ key: "bayaraa", m: 10_000 },
				{ key: "gerlee", m: 10_000 },
			]),
		}),
		"E11 G1",
	);
	unwrap(
		await createExpense({
			groupId: gid1,
			payerUserId: u.tsetsgee,
			createdByUserId: u.tsetsgee,
			description: "End of run",
			occurredOn: "2026-01-25",
			totalAmountMinor: 50_000,
			splitType: "exact",
			participants: p([
				{ key: "bataa", m: 12_500 },
				{ key: "ganaa", m: 12_500 },
				{ key: "bold", m: 12_500 },
				{ key: "oyunaa", m: 12_500 },
			]),
		}),
		"E12 G1",
	);

	// Second settlement (from earlier) is still S2; void it for audit, then final settle
	unwrap(
		await voidSettlement({
			groupId: gid1,
			settlementId: s2g1.batch.id,
			voidedByUserId: u.ganaa,
		}),
		"void S2 G1",
	);

	unwrap(
		await createSettlement({
			groupId: gid1,
			settledTo: "2026-01-28T18:00:00.000Z",
			note: "Final January settle (Mizorn) after voids",
			createdByUserId: u.bataa,
		}),
		"S3 G1",
	);

	// —— Group 2: 6 people, 7 meals, 2 settlements, void 1 exp + void 1 settlement
	unwrap(
		await createExpense({
			groupId: gid2,
			payerUserId: u.bataa,
			createdByUserId: u.bataa,
			description: "Coffee and pastries (Tenger)",
			occurredOn: "2026-01-04",
			totalAmountMinor: 30_000,
			splitType: "exact",
			participants: p([
				{ key: "bataa", m: 6_000 },
				{ key: "ganaa", m: 6_000 },
				{ key: "bayaraa", m: 6_000 },
				{ key: "oyunaa", m: 6_000 },
				{ key: "tsetsgee", m: 6_000 },
			]),
		}),
		"G2 E1",
	);
	const g2e2 = unwrap(
		await createExpense({
			groupId: gid2,
			payerUserId: u.gerlee,
			createdByUserId: u.gerlee,
			description: "Will be voided",
			occurredOn: "2026-01-05",
			totalAmountMinor: 9_000,
			splitType: "exact",
			participants: p([
				{ key: "gerlee", m: 3_000 },
				{ key: "bataa", m: 3_000 },
				{ key: "ganaa", m: 3_000 },
			]),
		}),
		"G2 E2",
	);
	unwrap(
		await createExpense({
			groupId: gid2,
			payerUserId: u.oyunaa,
			createdByUserId: u.oyunaa,
			description: "Lunch 4p",
			occurredOn: "2026-01-07",
			totalAmountMinor: 48_000,
			splitType: "exact",
			participants: p([
				{ key: "bataa", m: 12_000 },
				{ key: "ganaa", m: 12_000 },
				{ key: "tsetsgee", m: 12_000 },
				{ key: "oyunaa", m: 12_000 },
			]),
		}),
		"G2 E3",
	);
	unwrap(
		await createExpense({
			groupId: gid2,
			payerUserId: u.tsetsgee,
			createdByUserId: u.tsetsgee,
			description: "Milk + supplies",
			occurredOn: "2026-01-10",
			totalAmountMinor: 25_000,
			splitType: "exact",
			participants: p([
				{ key: "bataa", m: 5_000 },
				{ key: "ganaa", m: 5_000 },
				{ key: "gerlee", m: 5_000 },
				{ key: "tsetsgee", m: 5_000 },
				{ key: "oyunaa", m: 5_000 },
			]),
		}),
		"G2 E4",
	);

	const s1g2 = unwrap(
		await createSettlement({
			groupId: gid2,
			settledTo: "2026-01-12T09:00:00.000Z",
			note: "Tenger mid-month",
			createdByUserId: u.ganaa,
		}),
		"S1 G2",
	);

	unwrap(
		await createExpense({
			groupId: gid2,
			payerUserId: u.bayaraa,
			createdByUserId: u.bayaraa,
			description: "Cake day",
			occurredOn: "2026-01-15",
			totalAmountMinor: 30_000,
			splitType: "exact",
			participants: p([
				{ key: "bataa", m: 6_000 },
				{ key: "ganaa", m: 6_000 },
				{ key: "gerlee", m: 6_000 },
				{ key: "tsetsgee", m: 6_000 },
				{ key: "oyunaa", m: 6_000 },
			]),
		}),
		"G2 E5",
	);
	unwrap(
		await createExpense({
			groupId: gid2,
			payerUserId: u.bataa,
			createdByUserId: u.bataa,
			description: "Snacks 6p",
			occurredOn: "2026-01-18",
			totalAmountMinor: 36_000,
			splitType: "exact",
			participants: p([
				{ key: "bataa", m: 6_000 },
				{ key: "ganaa", m: 6_000 },
				{ key: "bayaraa", m: 6_000 },
				{ key: "gerlee", m: 6_000 },
				{ key: "tsetsgee", m: 6_000 },
				{ key: "oyunaa", m: 6_000 },
			]),
		}),
		"G2 E6",
	);
	unwrap(
		await createExpense({
			groupId: gid2,
			payerUserId: u.ganaa,
			createdByUserId: u.ganaa,
			description: "End Jan coffee",
			occurredOn: "2026-01-25",
			totalAmountMinor: 14_000,
			splitType: "exact",
			participants: p([
				{ key: "bataa", m: 7_000 },
				{ key: "ganaa", m: 7_000 },
			]),
		}),
		"G2 E7",
	);

	unwrap(
		await voidExpense({
			groupId: gid2,
			expenseId: g2e2.expense.id,
			voidedByUserId: u.ganaa,
		}),
		"void G2 E2",
	);

	const _s2g2 = unwrap(
		await createSettlement({
			groupId: gid2,
			settledTo: "2026-01-20T10:00:00.000Z",
			note: "Tenger settle (before final)",
			createdByUserId: u.ganaa,
		}),
		"S2 G2",
	);

	unwrap(
		await voidSettlement({
			groupId: gid2,
			settlementId: s1g2.batch.id,
			voidedByUserId: u.ganaa,
		}),
		"void S1 G2",
	);

	unwrap(
		await createSettlement({
			groupId: gid2,
			settledTo: "2026-01-28T12:00:00.000Z",
			note: "Final Tenger run",
			createdByUserId: u.ganaa,
		}),
		"S3 G2 (final)",
	);

	return { gid1, gid2 };
}
