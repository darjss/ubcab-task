import type { DomainError } from "~/lib/errors";
import { toErrorResponse, toHttpStatus } from "~/lib/errors";

export const respondWithError = (
	status: (code: never, response: never) => unknown,
	error: DomainError,
) =>
	status(
		toHttpStatus(error) as never,
		toErrorResponse(error) as never,
	) as never;
