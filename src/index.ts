import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { openapi } from "@elysia/openapi";
import { auth, authOpenAPI } from "~/auth";

// Auth guard macro plugin — resolves user/session from Better Auth
const authGuard = new Elysia({ name: "auth-guard" }).macro({
  auth: {
    async resolve({ status, request: { headers } }) {
      const session = await auth.api.getSession({
        headers,
      });

      if (!session) {
        return status(401, "Unauthorized");
      }

      return {
        user: session.user,
        session: session.session,
      };
    },
  },
});

const authComponents = await authOpenAPI.components;
const authPaths = await authOpenAPI.getPaths();

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
          description: "Shared lunch expense tracking API with Better Auth authentication, groups, expenses, ledger balances, and settlements.",
        },
        components: authComponents,
        paths: authPaths,
      },
    }),
  )
  .use(
    cors({
      origin: "http://localhost:3001",
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      credentials: true,
      allowedHeaders: ["Content-Type", "Authorization"],
    }),
  )
  .mount("/auth", auth.handler)
  .use(authGuard)
  .group("/api", (app) =>
    app
      .get("/health", () => ({ status: "ok" }))
      .get("/me", ({ user }) => user, {
        auth: true,
      }),
  )
  .get("/", () => "Eat your vegetables 🥦")
  .listen(process.env.PORT ?? 3000);

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`,
);
