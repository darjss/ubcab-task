import type { TSchema } from "@sinclair/typebox";
import { t } from "elysia";

export const IdSchema = t.String({ minLength: 1 });
export const CurrencySchema = t.Literal("MNT");
export const AmountMinorSchema = t.Number({ minimum: 1, multipleOf: 1 });
export const SignedAmountMinorSchema = t.Number({ multipleOf: 1 });
export const IsoDateSchema = t.String({ format: "date" });
export const IsoDateTimeSchema = t.String({ format: "date-time" });

/** Public health check (no auth). */
export const HealthResponseSchema = t.Object({
	status: t.Literal("ok"),
});

export const ErrorResponseSchema = t.Object({
	error: t.Object({
		code: t.String(),
		message: t.String(),
		details: t.Optional(t.Record(t.String(), t.Unknown())),
	}),
});

export const PaginationQuerySchema = t.Object({
	limit: t.Optional(t.Number({ minimum: 1, maximum: 100, multipleOf: 1 })),
	cursor: t.Optional(t.String()),
});

export const PaginationResponseSchema = t.Object({
	nextCursor: t.Union([t.String(), t.Null()]),
});

export const GroupParamsSchema = t.Object({
	groupId: IdSchema,
});

export const UserParamsSchema = t.Object({
	groupId: IdSchema,
	userId: IdSchema,
});

export const ExpenseParamsSchema = t.Object({
	groupId: IdSchema,
	expenseId: IdSchema,
});

export const SettlementParamsSchema = t.Object({
	groupId: IdSchema,
	settlementId: IdSchema,
});

export const CreateGroupBodySchema = t.Object({
	name: t.String({ minLength: 1, maxLength: 120 }),
	currency: t.Optional(CurrencySchema),
});

export const GroupResponseSchema = t.Object({
	id: IdSchema,
	name: t.String(),
	currency: CurrencySchema,
	role: t.Optional(
		t.Union([t.Literal("owner"), t.Literal("admin"), t.Literal("member")]),
	),
	myRole: t.Optional(
		t.Union([t.Literal("owner"), t.Literal("admin"), t.Literal("member")]),
	),
	memberCount: t.Optional(t.Number()),
	createdAt: t.String(),
});

export const AddMemberBodySchema = t.Object({
	userId: IdSchema,
	role: t.Optional(t.Union([t.Literal("admin"), t.Literal("member")])),
});

export const UpdateMemberBodySchema = t.Object({
	role: t.Union([t.Literal("admin"), t.Literal("member")]),
});

export const MemberResponseSchema = t.Object({
	groupId: IdSchema,
	userId: IdSchema,
	name: t.Optional(t.String()),
	email: t.Optional(t.String()),
	role: t.Union([t.Literal("owner"), t.Literal("admin"), t.Literal("member")]),
	status: t.Union([
		t.Literal("active"),
		t.Literal("invited"),
		t.Literal("removed"),
	]),
	joinedAt: t.Union([t.String(), t.Null()]),
});

export const ExpenseParticipantInputSchema = t.Object({
	userId: IdSchema,
	amountMinor: AmountMinorSchema,
});

export const CreateExpenseBodySchema = t.Object({
	payerUserId: IdSchema,
	description: t.Optional(t.String({ maxLength: 500 })),
	occurredOn: IsoDateSchema,
	totalAmountMinor: AmountMinorSchema,
	splitType: t.Literal("exact"),
	participants: t.Array(ExpenseParticipantInputSchema, { minItems: 1 }),
});

export const VoidBodySchema = t.Object({
	reason: t.Optional(t.String({ maxLength: 500 })),
});

export const LedgerEntryResponseSchema = t.Object({
	userId: IdSchema,
	amountMinor: SignedAmountMinorSchema,
});

export const LedgerEntryTypeSchema = t.Union([
	t.Literal("expense"),
	t.Literal("expense_reversal"),
	t.Literal("settlement"),
	t.Literal("settlement_reversal"),
]);

export const LedgerListQuerySchema = t.Object({
	userId: t.Optional(IdSchema),
	type: t.Optional(LedgerEntryTypeSchema),
	from: t.Optional(IsoDateTimeSchema),
	to: t.Optional(IsoDateTimeSchema),
	limit: t.Optional(t.Number({ minimum: 1, maximum: 100, multipleOf: 1 })),
	cursor: t.Optional(IsoDateTimeSchema),
});

export const LedgerAuditEntryResponseSchema = t.Object({
	id: IdSchema,
	transactionId: IdSchema,
	type: LedgerEntryTypeSchema,
	userId: IdSchema,
	amountMinor: SignedAmountMinorSchema,
	currency: CurrencySchema,
	createdAt: IsoDateTimeSchema,
});

export const PaginatedLedgerAuditResponseSchema = t.Object({
	data: t.Array(LedgerAuditEntryResponseSchema),
	pagination: PaginationResponseSchema,
});

export const ExpenseResponseSchema = t.Object({
	id: IdSchema,
	groupId: IdSchema,
	payerUserId: IdSchema,
	description: t.Union([t.String(), t.Null()]),
	totalAmountMinor: AmountMinorSchema,
	currency: CurrencySchema,
	splitType: t.Literal("exact"),
	status: t.Union([t.Literal("posted"), t.Literal("voided")]),
	occurredOn: IsoDateSchema,
	createdAt: t.String(),
});

export const ExpenseDetailResponseSchema = t.Composite([
	ExpenseResponseSchema,
	t.Object({
		participants: t.Array(ExpenseParticipantInputSchema),
	}),
]);

export const CreateExpenseResponseSchema = t.Composite([
	ExpenseResponseSchema,
	t.Object({
		ledgerTransactionId: IdSchema,
		ledgerEntries: t.Array(LedgerEntryResponseSchema),
	}),
]);

export const VoidExpenseResponseSchema = t.Object({
	expenseId: IdSchema,
	status: t.Literal("voided"),
	reversalLedgerTransactionId: IdSchema,
	voidedAt: t.Union([t.String(), t.Null()]),
});

export const MemberBalanceResponseSchema = t.Object({
	userId: IdSchema,
	name: t.Optional(t.String()),
	balanceMinor: SignedAmountMinorSchema,
});

export const SettlementTransferSchema = t.Object({
	fromUserId: IdSchema,
	toUserId: IdSchema,
	amountMinor: AmountMinorSchema,
});

export const BalanceResponseSchema = t.Object({
	groupId: IdSchema,
	currency: CurrencySchema,
	balances: t.Array(MemberBalanceResponseSchema),
	asOf: IsoDateTimeSchema,
});

export const SettlementPreviewResponseSchema = t.Object({
	groupId: IdSchema,
	currency: CurrencySchema,
	balances: t.Array(MemberBalanceResponseSchema),
	suggestedTransfers: t.Array(SettlementTransferSchema),
	asOf: IsoDateTimeSchema,
});

export const SettlementResponseSchema = t.Object({
	id: IdSchema,
	status: t.Union([t.Literal("posted"), t.Literal("voided")]),
	settledTo: IsoDateTimeSchema,
	createdAt: IsoDateTimeSchema,
});

export const SettlementDetailResponseSchema = t.Composite([
	SettlementResponseSchema,
	t.Object({
		transfers: t.Array(SettlementTransferSchema),
	}),
]);

export const CreateSettlementResponseSchema = t.Object({
	batch: t.Object({
		id: IdSchema,
		groupId: IdSchema,
		status: t.Union([t.Literal("posted"), t.Literal("voided")]),
		settledTo: t.Union([t.String(), t.Date()]),
		createdAt: t.Union([t.String(), t.Date()]),
	}),
	transfers: t.Array(
		t.Composite([
			SettlementTransferSchema,
			t.Object({
				id: IdSchema,
				settlementBatchId: IdSchema,
				currency: CurrencySchema,
			}),
		]),
	),
	ledgerTransaction: t.Object({
		id: IdSchema,
	}),
});

export const VoidSettlementResponseSchema = t.Object({
	settlement: t.Object({
		id: IdSchema,
		status: t.Literal("voided"),
		voidedAt: t.Union([t.String(), t.Date(), t.Null()]),
	}),
	reversalLedgerTransaction: t.Object({
		id: IdSchema,
	}),
});

export const CreateSettlementBodySchema = t.Object({
	settledTo: IsoDateTimeSchema,
	note: t.Optional(t.String({ maxLength: 500 })),
});

export const DataResponse = <T extends TSchema>(schema: T) =>
	t.Object({ data: schema });

export const DataArrayResponse = <T extends TSchema>(schema: T) =>
	t.Object({ data: t.Array(schema) });

export const DomainErrorResponses = {
	400: ErrorResponseSchema,
	401: ErrorResponseSchema,
	403: ErrorResponseSchema,
	404: ErrorResponseSchema,
	409: ErrorResponseSchema,
	422: ErrorResponseSchema,
	500: ErrorResponseSchema,
	503: ErrorResponseSchema,
};

export const BenchmarkResponseSchema = t.Object({
	data: t.Object({
		redis: t.Object({
			easyMs: t.Number({ description: "PING round-trip" }),
			hardMs: t.Number({
				description: "Pipeline: 40 SET + 40 GET on scratch keys",
			}),
			ping: t.String(),
			hardPipelineCommands: t.Number(),
		}),
		postgres: t.Object({
			easyMs: t.Number({ description: "SELECT 1" }),
			hardMs: t.Number({
				description:
					"GROUP BY join: groups × ledger_entries, aggregate, ORDER BY, LIMIT",
			}),
			hardRowCount: t.Number(),
		}),
		generatedAt: t.String({ format: "date-time" }),
	}),
});
