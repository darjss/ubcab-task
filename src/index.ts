import { openapi } from "@elysia/openapi";
import { cors } from "@elysiajs/cors";
import { Elysia } from "elysia";
import type { OpenAPIV3 } from "openapi-types";
import { auth, authOpenAPI } from "~/lib/auth";
import { domainOpenApiSchemas } from "~/lib/openapi-domain-schemas";
import { HealthResponseSchema } from "~/lib/schemas";
import { authGuard } from "~/plugins/auth-guard";
import { requestLogger } from "~/plugins/request-logger";
import { balanceRoutes } from "~/routes/balances";
import { benchmarkRoutes } from "~/routes/benchmark";
import { expenseRoutes } from "~/routes/expenses";
import { groupRoutes } from "~/routes/groups";
import { ledgerRoutes } from "~/routes/ledger";
import { memberRoutes } from "~/routes/members";
import { settlementRoutes } from "~/routes/settlements";

const authComponents =
	(await authOpenAPI.components) as OpenAPIV3.ComponentsObject;
const authPaths = await authOpenAPI.getPaths();
const mergedComponents: OpenAPIV3.ComponentsObject = {
	...authComponents,
	schemas: {
		...(authComponents.schemas ?? {}),
		...domainOpenApiSchemas,
	},
};

const app = new Elysia()
	.use(
		openapi({
			provider: "scalar",
			path: "/openapi",
			specPath: "/openapi/json",
			documentation: {
				info: {
					title: "Ubcab Task API",
					version: "1.0.0",
					description:
						"Shared lunch expense tracking API with Better Auth authentication, groups, expenses, ledger balances, and settlements.",
				},
				servers: [
					{
						url: "https://ubcab-task-production.up.railway.app",
						description: "Production (Railway)",
					},
					{
						url: "http://localhost:3000",
						description: "Local development",
					},
				],
				components: mergedComponents as never,
				paths: authPaths as never,
			},
		}),
	)
	.use(
		cors({
			origin:
				process.env.CORS_ORIGIN ??
				(process.env.BETTER_AUTH_URL
					? new URL(process.env.BETTER_AUTH_URL).origin
					: "http://localhost:3001"),
			methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
			credentials: true,
			allowedHeaders: ["Content-Type", "Authorization", "Idempotency-Key"],
		}),
	)
	.use(requestLogger)
	.mount("/auth", auth.handler)
	.use(authGuard)
	.group("/api", (app) =>
		app
			.get("/health", () => ({ status: "ok" as const }), {
				response: { 200: HealthResponseSchema },
				detail: {
					tags: ["Health"],
					summary: "Health check",
				},
			})
			.use(benchmarkRoutes)
			.get("/me", ({ user }) => user, {
				auth: true,
			})
			.use(groupRoutes)
			.use(memberRoutes)
			.use(expenseRoutes)
			.use(balanceRoutes)
			.use(settlementRoutes)
			.use(ledgerRoutes),
	)
	.get("/", () => "Eat your vegetables 🥦")
	.listen(process.env.PORT ?? 3000);

console.log(
	`🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`,
);
