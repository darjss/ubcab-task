import type { authOpenAPI } from "~/auth";

type AwaitedValue<T> = T extends Promise<infer U> ? U : T;

export type AuthOpenAPIComponents = AwaitedValue<typeof authOpenAPI.components>;
export type AuthOpenAPIPaths = AwaitedValue<
	ReturnType<typeof authOpenAPI.getPaths>
>;
