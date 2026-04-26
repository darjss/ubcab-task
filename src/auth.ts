import "dotenv/config";
import { betterAuth } from "better-auth";
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
