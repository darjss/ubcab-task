import "dotenv/config";
import { redisStorage } from "@better-auth/redis-storage";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { openAPI } from "better-auth/plugins";
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
	emailAndPassword: {
		enabled: true,
		requireEmailVerification: false,
	},
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

let openApiSchema:
	| ReturnType<typeof auth.api.generateOpenAPISchema>
	| undefined;

type AuthOpenAPIPathItem = Record<string, { tags?: string[] }>;

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

				const pathItem = prefixedPaths[key] as AuthOpenAPIPathItem;
				for (const method of Object.keys(pathItem)) {
					const operation = pathItem[method];
					operation.tags = ["Auth"];
				}
			}

			return prefixedPaths;
		}),
} as const;
