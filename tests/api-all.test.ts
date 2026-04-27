/**
 * Full API integration tests against a running server (local or deployed).
 *
 * - Public routes: always run.
 * - Authenticated: set E2E_EMAIL and E2E_PASSWORD (Better Auth).
 * - Peer flows (split expense + settlement commit): set E2E_PEER_USER_ID to an existing user id.
 *
 *   E2E_EMAIL=you@x.com E2E_PASSWORD=... bun test tests/api-all.test.ts
 *   E2E_BASE_URL=https://ubcab-task-production.up.railway.app E2E_EMAIL=... E2E_PASSWORD=... E2E_PEER_USER_ID=... bun test tests/api-all.test.ts
 */
import { beforeAll, describe, expect, test } from "bun:test";

const BASE = (process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000").replace(
	/\/$/u,
	"",
);
const ORIGIN = process.env.E2E_ORIGIN ?? new URL(BASE).origin;
const EMAIL = process.env.E2E_EMAIL ?? "";
const PASSWORD = process.env.E2E_PASSWORD ?? "";
const PEER_USER_ID = process.env.E2E_PEER_USER_ID ?? "";

const hasAuth = Boolean(EMAIL && PASSWORD);
const hasPeer = Boolean(PEER_USER_ID);

function pickCookies(res: Response): string {
	const fn = (res.headers as { getSetCookie?: () => string[] | undefined })
		.getSetCookie;
	if (fn) {
		const list = fn();
		if (list?.length) {
			return list.map((c) => c.split(/;\s?/u)[0]).join("; ");
		}
	}
	const single = res.headers.get("set-cookie");
	if (!single) return "";
	return single
		.split(/,(?=\s*[^,]+=)/u)
		.map((c) => c.split(/;\s?/u)[0])
		.join("; ");
}

async function signIn(): Promise<string> {
	const r = await fetch(`${BASE}/auth/api/sign-in/email`, {
		method: "POST",
		headers: {
			"content-type": "application/json",
			origin: ORIGIN,
		},
		body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
	});
	if (!r.ok) {
		const t = await r.text();
		throw new Error(`sign-in ${r.status}: ${t.slice(0, 400)}`);
	}
	const cookie = pickCookies(r);
	if (!cookie.includes("session_token")) {
		throw new Error("no session_token cookie after sign-in");
	}
	return cookie;
}

function api(
	path: string,
	init: RequestInit & { cookie?: string } = {},
): Promise<Response> {
	const { cookie, ...rest } = init;
	const headers = new Headers(rest.headers);
	if (cookie) {
		headers.set(
			"cookie",
			[cookie, headers.get("cookie")].filter(Boolean).join("; "),
		);
	}
	return fetch(`${BASE}${path}`, { ...rest, headers });
}

const runTag = `e2e-${Date.now()}`;

describe("public", () => {
	test("GET /api/health", async () => {
		const r = await api("/api/health");
		expect(r.status).toBe(200);
		expect(((await r.json()) as { status: string }).status).toBe("ok");
	});

	test("GET /api/benchmark", async () => {
		const r = await api("/api/benchmark");
		expect(r.status).toBe(200);
		const j = (await r.json()) as { data: { redis: { ping: string } } };
		expect(j.data.redis.ping).toBe("PONG");
	});

	test("GET /openapi/json", async () => {
		const r = await api("/openapi/json");
		expect(r.status).toBe(200);
		const j = (await r.json()) as { openapi: string; components?: object };
		expect(j.openapi).toMatch(/3\./u);
		expect(j.components).toBeDefined();
	});

	test("GET /api/groups without auth returns 401", async () => {
		const r = await api("/api/groups");
		expect(r.status).toBe(401);
	});

	test("POST /auth/api/sign-in/email rejects unknown user", async () => {
		const r = await fetch(`${BASE}/auth/api/sign-in/email`, {
			method: "POST",
			headers: { "content-type": "application/json", origin: ORIGIN },
			body: JSON.stringify({
				email: "nobody@invalid.local",
				password: "wrong",
			}),
		});
		expect(r.status).toBe(401);
	});
});

describe("authenticated flow (set E2E_EMAIL + E2E_PASSWORD)", () => {
	let cookieJar = "";
	let myUserId = "";

	beforeAll(async () => {
		if (!hasAuth) return;
		cookieJar = await signIn();
		const me = await api("/api/me", { cookie: cookieJar });
		expect(me.status).toBe(200);
		myUserId = ((await me.json()) as { id: string }).id;
	});

	test.skipIf(!hasAuth)(
		"full journey: groups, expenses, balances, settlements, ledger, void",
		async () => {
			const r = await api("/api/groups", {
				method: "POST",
				cookie: cookieJar,
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ name: `E2E ${runTag}`, currency: "MNT" }),
			});
			expect(r.status).toBe(201);
			const groupId = ((await r.json()) as { data: { id: string } }).data.id;

			const list = await api("/api/groups", { cookie: cookieJar });
			expect(list.status).toBe(200);
			expect(
				((await list.json()) as { data: { id: string }[] }).data.some(
					(x) => x.id === groupId,
				),
			).toBe(true);

			const one = await api(`/api/groups/${groupId}`, { cookie: cookieJar });
			expect(one.status).toBe(200);
			expect(((await one.json()) as { data: { id: string } }).data.id).toBe(
				groupId,
			);

			const mem0 = await api(`/api/groups/${groupId}/members`, {
				cookie: cookieJar,
			});
			expect(mem0.status).toBe(200);
			expect(
				((await mem0.json()) as { data: { userId: string }[] }).data.some(
					(m) => m.userId === myUserId,
				),
			).toBe(true);

			if (hasPeer) {
				const addP = await api(`/api/groups/${groupId}/members`, {
					method: "POST",
					cookie: cookieJar,
					headers: { "content-type": "application/json" },
					body: JSON.stringify({ userId: PEER_USER_ID, role: "member" }),
				});
				expect([201, 409]).toContain(addP.status);
			}

			const total = 10_000;
			const parts =
				hasPeer && PEER_USER_ID
					? [
							{ userId: myUserId, amountMinor: 4000 },
							{ userId: PEER_USER_ID, amountMinor: 6000 },
						]
					: [{ userId: myUserId, amountMinor: total }];

			const ex = await api(`/api/groups/${groupId}/expenses`, {
				method: "POST",
				cookie: cookieJar,
				headers: {
					"content-type": "application/json",
					"Idempotency-Key": `${runTag}-exp-1`,
				},
				body: JSON.stringify({
					payerUserId: myUserId,
					occurredOn: "2026-01-15",
					totalAmountMinor: total,
					splitType: "exact",
					description: "e2e",
					participants: parts,
				}),
			});
			if (!ex.ok) {
				throw new Error(
					`create expense ${ex.status}: ${(await ex.text()).slice(0, 400)}`,
				);
			}
			expect(ex.status).toBe(201);
			const expenseId = ((await ex.json()) as { data: { id: string } }).data.id;

			const li = await api(`/api/groups/${groupId}/expenses`, {
				cookie: cookieJar,
			});
			expect(li.status).toBe(200);
			expect(
				((await li.json()) as { data: { id: string }[] }).data.some(
					(e) => e.id === expenseId,
				),
			).toBe(true);

			const ge = await api(`/api/groups/${groupId}/expenses/${expenseId}`, {
				cookie: cookieJar,
			});
			expect(ge.status).toBe(200);
			const detail = (await ge.json()) as {
				data: { participants: { userId: string }[] };
			};
			expect(detail.data.participants.length).toBeGreaterThan(0);

			const bal = await api(`/api/groups/${groupId}/balances`, {
				cookie: cookieJar,
			});
			expect(bal.status).toBe(200);
			expect(
				((await bal.json()) as { data: { groupId: string } }).data.groupId,
			).toBe(groupId);

			const prev = await api(`/api/groups/${groupId}/settlements/preview`, {
				cookie: cookieJar,
			});
			expect(prev.status).toBe(200);
			const prevJ = (await prev.json()) as {
				data: { suggestedTransfers: unknown[] };
			};
			expect(Array.isArray(prevJ.data.suggestedTransfers)).toBe(true);

			if (hasPeer) {
				const st = await api(`/api/groups/${groupId}/settlements`, {
					method: "POST",
					cookie: cookieJar,
					headers: {
						"content-type": "application/json",
						"Idempotency-Key": `${runTag}-settle-1`,
					},
					body: JSON.stringify({
						settledTo: new Date().toISOString(),
						note: "e2e",
					}),
				});
				if (!st.ok) {
					throw new Error(
						`settlement ${st.status}: ${(await st.text()).slice(0, 500)}`,
					);
				}
				expect(st.status).toBe(201);
				const batchId = (
					(await st.json()) as { data: { batch: { id: string } } }
				).data.batch.id;

				const sl = await api(`/api/groups/${groupId}/settlements`, {
					cookie: cookieJar,
				});
				expect(sl.status).toBe(200);

				const sg = await api(`/api/groups/${groupId}/settlements/${batchId}`, {
					cookie: cookieJar,
				});
				expect(sg.status).toBe(200);

				const b2 = await api(`/api/groups/${groupId}/balances`, {
					cookie: cookieJar,
				});
				expect(b2.status).toBe(200);
				for (const row of (
					(await b2.json()) as {
						data: { balances: { balanceMinor: number }[] };
					}
				).data.balances) {
					expect(row.balanceMinor).toBe(0);
				}
			}

			const led = await api(`/api/groups/${groupId}/ledger?limit=20`, {
				cookie: cookieJar,
			});
			expect(led.status).toBe(200);
			const ledJ = (await led.json()) as { data: unknown[] };
			expect(Array.isArray(ledJ.data)).toBe(true);

			const li2 = await api(
				`/api/groups/${groupId}/expenses?status=posted&limit=10`,
				{
					cookie: cookieJar,
				},
			);
			expect(li2.status).toBe(200);
			const posted = (
				(await li2.json()) as { data: { id: string; status: string }[] }
			).data.find((e) => e.status === "posted");
			if (posted) {
				const v = await api(
					`/api/groups/${groupId}/expenses/${posted.id}/void`,
					{
						method: "POST",
						cookie: cookieJar,
						headers: {
							"content-type": "application/json",
							"Idempotency-Key": `${runTag}-void-${posted.id}`,
						},
						body: JSON.stringify({ reason: "e2e" }),
					},
				);
				expect(v.status).toBe(200);
				expect(
					((await v.json()) as { data: { status: string } }).data.status,
				).toBe("voided");
			}
		},
		{ timeout: 120_000 },
	);
});
