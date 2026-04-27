import { typeid } from "typeid-js";

export const newGroupId = () => typeid("group").toString();
export const newExpenseId = () => typeid("exp").toString();
export const newLedgerTransactionId = () => typeid("ltx").toString();
export const newLedgerEntryId = () => typeid("le").toString();
export const newSettlementBatchId = () => typeid("stl").toString();
export const newSettlementTransferId = () => typeid("stx").toString();
