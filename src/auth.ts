import "dotenv/config";
import { betterAuth } from "better-auth";
import { openAPI } from "better-auth/plugins";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { redisStorage } from "@better-auth/redis-storage";
import { typeid } from "typeid-js";
import { db } from "~/db";
import { redis } from "~/lib/redis";

if (!process.env.BETTER_AUTH_SECRET) {
	throw new Error("BETTER_AUTH_SECRET is not set");
}

if (!process.env.BETTER_AUTH_URL) {
	throw new Error("BETTER_AUTH_URL is not set");
}

export const auth = betterAuth({
	database: drizzleAdapter(db, {
		provider: "pg",
	}),
	basePath: "/api",
	secret: process.env.BETTER_AUTH_SECRET,
	appUrl: process.env.BETTER_AUTH_URL,
	secondaryStorage: redisStorage({
		client: redis,
		keyPrefix: "better-auth:",
	}),
	plugins: [
		openAPI({
			path: "/reference",
			theme: "default",
		}),
	],
	advanced: {
		database: {
			generateId: (options) => {
				if (options.model === "user" || options.model === "users") {
					return typeid("user").toString();
				}
				return crypto.randomUUID();
			},
		},
	},
});

let openApiSchema: ReturnType<typeof auth.api.generateOpenAPISchema> | undefined;

const getOpenApiSchema = async () => {
	openApiSchema ??= auth.api.generateOpenAPISchema();
	return openApiSchema;
};

export const authOpenAPI = {
	components: getOpenApiSchema().then(({ components }) => components),
	getPaths: (prefix = "/auth/api") =>
		getOpenApiSchema().then(({ paths }) => {
			const prefixedPaths: typeof paths = Object.create(null);

			for (const path of Object.keys(paths)) {
				const key = `${prefix}${path}`;
				prefixedPaths[key] = paths[path];

				for (const method of Object.keys(paths[path])) {
					const operation = (prefixedPaths[key] as any)[method];
					operation.tags = ["Auth"];
				}
			}

			return prefixedPaths;
		}),
} as const;
