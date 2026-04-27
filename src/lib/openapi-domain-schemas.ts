import { unwrapSchema } from "@elysia/openapi/openapi";
import type { OpenAPIV3 } from "openapi-types";
import * as schemas from "./schemas";

/**
 * Unwraps TypeBox → OpenAPI 3 schema objects for `components.schemas` (Scalar "Models").
 */
const u = (schema: Parameters<typeof unwrapSchema>[0]) => {
	const out = unwrapSchema(schema, undefined, "output");
	if (!out) {
		throw new Error("OpenAPI unwrapSchema returned undefined for a domain model");
	}
	return out;
};

/**
 * All domain DTOs for OpenAPI `components.schemas` (supplements Better Auth `User` / `Session` / `Account`).
 */
export const domainOpenApiSchemas: NonNullable<
	OpenAPIV3.ComponentsObject["schemas"]
> = {
	// Common
	HealthResponse: u(schemas.HealthResponseSchema),
	ErrorResponse: u(schemas.ErrorResponseSchema),
	PaginationQuery: u(schemas.PaginationQuerySchema),
	PaginationResponse: u(schemas.PaginationResponseSchema),

	// Path / query
	GroupParams: u(schemas.GroupParamsSchema),
	UserParams: u(schemas.UserParamsSchema),
	ExpenseParams: u(schemas.ExpenseParamsSchema),
	SettlementParams: u(schemas.SettlementParamsSchema),

	// Groups
	CreateGroupBody: u(schemas.CreateGroupBodySchema),
	GroupResponse: u(schemas.GroupResponseSchema),
	DataListGroup: u(schemas.DataArrayResponse(schemas.GroupResponseSchema)),
	DataGroup: u(schemas.DataResponse(schemas.GroupResponseSchema)),

	// Members
	AddMemberBody: u(schemas.AddMemberBodySchema),
	UpdateMemberBody: u(schemas.UpdateMemberBodySchema),
	MemberResponse: u(schemas.MemberResponseSchema),
	DataListMember: u(schemas.DataArrayResponse(schemas.MemberResponseSchema)),

	// Expenses
	ExpenseParticipantInput: u(schemas.ExpenseParticipantInputSchema),
	CreateExpenseBody: u(schemas.CreateExpenseBodySchema),
	ExpenseResponse: u(schemas.ExpenseResponseSchema),
	ExpenseDetailResponse: u(schemas.ExpenseDetailResponseSchema),
	CreateExpenseResponse: u(schemas.CreateExpenseResponseSchema),
	VoidBody: u(schemas.VoidBodySchema),
	VoidExpenseResponse: u(schemas.VoidExpenseResponseSchema),
	DataListExpense: u(schemas.DataArrayResponse(schemas.ExpenseResponseSchema)),

	// Balances
	MemberBalance: u(schemas.MemberBalanceResponseSchema),
	BalanceResponse: u(schemas.BalanceResponseSchema),
	DataBalance: u(schemas.DataResponse(schemas.BalanceResponseSchema)),

	// Settlements
	SettlementTransfer: u(schemas.SettlementTransferSchema),
	SettlementPreviewResponse: u(schemas.SettlementPreviewResponseSchema),
	SettlementResponse: u(schemas.SettlementResponseSchema),
	SettlementDetailResponse: u(schemas.SettlementDetailResponseSchema),
	CreateSettlementBody: u(schemas.CreateSettlementBodySchema),
	CreateSettlementResponse: u(schemas.CreateSettlementResponseSchema),
	VoidSettlementResponse: u(schemas.VoidSettlementResponseSchema),
	DataListSettlement: u(schemas.DataArrayResponse(schemas.SettlementResponseSchema)),

	// Ledger
	LedgerEntryType: u(schemas.LedgerEntryTypeSchema),
	LedgerEntryLine: u(schemas.LedgerEntryResponseSchema),
	LedgerListQuery: u(schemas.LedgerListQuerySchema),
	LedgerAuditEntry: u(schemas.LedgerAuditEntryResponseSchema),
	PaginatedLedgerAuditResponse: u(schemas.PaginatedLedgerAuditResponseSchema),

	// Ops
	BenchmarkResponse: u(schemas.BenchmarkResponseSchema),
};
