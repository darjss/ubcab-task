import { createAuthClient } from "better-auth/client";

/**
 * Browser / HTTP client. Auth is mounted at `/auth`; Better Auth’s internal
 * `basePath` is `/api`, so the public base for requests is `/auth/api`.
 *
 * `bun run dev` and `BETTER_AUTH_URL` (e.g. `http://127.0.0.1:3000`) are expected.
 * For scripts, prefer `auth.api.signUpEmail` from `~/lib/auth` (no server required).
 */
export const authClient = createAuthClient({
	baseURL: (process.env.BETTER_AUTH_URL ?? "http://127.0.0.1:3000").replace(
		/\/+$/u,
		"",
	),
	basePath: "/auth/api",
});
