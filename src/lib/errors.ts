export type DomainErrorCode =
	| "VALIDATION_ERROR"
	| "UNAUTHENTICATED"
	| "FORBIDDEN"
	| "GROUP_NOT_FOUND"
	| "NOT_GROUP_MEMBER"
	| "PAYER_NOT_MEMBER"
	| "PARTICIPANT_NOT_MEMBER"
	| "INVALID_SPLIT"
	| "LEDGER_NOT_BALANCED"
	| "EXPENSE_NOT_FOUND"
	| "EXPENSE_ALREADY_VOIDED"
	| "SETTLEMENT_NOT_FOUND"
	| "SETTLEMENT_ALREADY_VOIDED"
	| "IDEMPOTENCY_KEY_REQUIRED"
	| "IDEMPOTENCY_CONFLICT"
	| "INFRASTRUCTURE_UNAVAILABLE"
	| "INTERNAL_SERVER_ERROR";

export type DomainError = {
	code: DomainErrorCode;
	message: string;
	details?: Record<string, unknown>;
};

export type ErrorResponse = {
	error: DomainError;
};

export const domainError = (
	code: DomainErrorCode,
	message: string,
	details?: Record<string, unknown>,
): DomainError => ({
	code,
	message,
	...(details ? { details } : {}),
});

export const toHttpStatus = (error: DomainError): number => {
	switch (error.code) {
		case "VALIDATION_ERROR":
		case "INVALID_SPLIT":
		case "IDEMPOTENCY_KEY_REQUIRED":
			return 400;
		case "UNAUTHENTICATED":
			return 401;
		case "FORBIDDEN":
		case "NOT_GROUP_MEMBER":
		case "PAYER_NOT_MEMBER":
		case "PARTICIPANT_NOT_MEMBER":
			return 403;
		case "GROUP_NOT_FOUND":
		case "EXPENSE_NOT_FOUND":
		case "SETTLEMENT_NOT_FOUND":
			return 404;
		case "IDEMPOTENCY_CONFLICT":
		case "EXPENSE_ALREADY_VOIDED":
		case "SETTLEMENT_ALREADY_VOIDED":
			return 409;
		case "LEDGER_NOT_BALANCED":
			return 422;
		case "INFRASTRUCTURE_UNAVAILABLE":
			return 503;
		default:
			return 500;
	}
};

export const toErrorResponse = (error: DomainError): ErrorResponse => ({
	error,
});
