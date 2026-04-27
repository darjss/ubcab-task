import { Elysia } from "elysia";

const REDACT_HEADER = new Set(["authorization", "cookie", "set-cookie"]);

function redactHeaders(
	headers: Record<string, string | undefined>,
): Record<string, string | undefined> {
	const out: Record<string, string | undefined> = {};
	for (const [key, value] of Object.entries(headers)) {
		out[key] = REDACT_HEADER.has(key.toLowerCase()) ? "[REDACTED]" : value;
	}
	return out;
}

function omitEmptyRecord(
	record: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
	if (!record || typeof record !== "object") return undefined;
	const keys = Object.keys(record);
	return keys.length ? { ...record } : undefined;
}

function serializeForLog(value: unknown): unknown {
	if (value === null || value === undefined) return value;
	const t = typeof value;
	if (t === "string" || t === "number" || t === "boolean") return value;
	if (typeof value === "bigint") return value.toString();
	if (value instanceof Error) {
		return { name: value.name, message: value.message, stack: value.stack };
	}
	if (value instanceof Response) {
		return {
			type: "Response",
			status: value.status,
			contentType: value.headers.get("content-type"),
		};
	}
	if (Array.isArray(value)) return value.map(serializeForLog);
	if (t === "object") {
		try {
			return JSON.parse(
				JSON.stringify(value, (_k, v) =>
					typeof v === "bigint" ? v.toString() : v,
				),
			);
		} catch {
			return String(value);
		}
	}
	return String(value);
}

function validationDetails(error: unknown): unknown {
	if (error && typeof error === "object" && "all" in error) {
		return (error as { all: unknown }).all;
	}
	return undefined;
}

export const requestLogger = new Elysia({ name: "request-logger" })
	.derive(() => ({
		requestLogId: crypto.randomUUID(),
		requestStartedAt: performance.now(),
	}))
	.onBeforeHandle(
		({ request, requestLogId, path, route, body, query, params, headers }) => {
			const url = new URL(request.url);
			const input = {
				kind: "http.request" as const,
				id: requestLogId,
				method: request.method,
				path,
				route,
				pathname: url.pathname,
				search: url.search || undefined,
				query: omitEmptyRecord(query as Record<string, unknown>),
				params: omitEmptyRecord(params as Record<string, unknown>),
				body: body !== undefined ? serializeForLog(body) : undefined,
				headers: redactHeaders(headers),
			};
			console.log(JSON.stringify(input));
		},
	)
	.onAfterHandle(({ requestLogId, requestStartedAt, response, set }) => {
		const durationMs = Math.round(performance.now() - requestStartedAt);
		const output = {
			kind: "http.response" as const,
			id: requestLogId,
			status: set.status ?? 200,
			durationMs,
			body: serializeForLog(response),
		};
		console.log(JSON.stringify(output));
	})
	.onError((ctx) => {
		const { code, error, request, set } = ctx;
		const id =
			"requestLogId" in ctx &&
			typeof (ctx as { requestLogId?: unknown }).requestLogId === "string"
				? (ctx as { requestLogId: string }).requestLogId
				: null;
		const url = new URL(request.url);
		const err = {
			kind: "http.error" as const,
			id,
			code,
			method: request.method,
			path: "path" in ctx ? ctx.path : url.pathname,
			route: "route" in ctx ? ctx.route : undefined,
			pathname: url.pathname,
			status: set.status,
			message: error instanceof Error ? error.message : String(error),
			input: {
				query:
					"query" in ctx
						? omitEmptyRecord(ctx.query as Record<string, unknown>)
						: undefined,
				params:
					"params" in ctx
						? omitEmptyRecord(ctx.params as Record<string, unknown>)
						: undefined,
				body:
					"body" in ctx && ctx.body !== undefined
						? serializeForLog(ctx.body)
						: undefined,
				headers:
					"headers" in ctx && ctx.headers
						? redactHeaders(ctx.headers as Record<string, string | undefined>)
						: undefined,
			},
			validation: code === "VALIDATION" ? validationDetails(error) : undefined,
			stack: error instanceof Error ? error.stack : undefined,
		};
		console.error(JSON.stringify(err));
	});
