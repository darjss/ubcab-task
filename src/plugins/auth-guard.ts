import { Elysia } from "elysia";
import { auth } from "~/auth";
import { toErrorResponse } from "~/lib/errors";

export const authGuard = new Elysia({ name: "auth-guard" }).macro({
	auth: {
		async resolve({ status, request: { headers } }) {
			const session = await auth.api.getSession({ headers });

			if (!session) {
				return status(
					401,
					toErrorResponse({
						code: "UNAUTHENTICATED",
						message: "Authentication is required.",
					}),
				);
			}

			return {
				user: session.user,
				session: session.session,
			};
		},
	},
});
