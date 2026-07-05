import {
  AccountTransactionDirection,
  AccountTransactionStatus,
  AccountType,
  CurrencyCode,
  RecordStatus,
} from "@prisma/client";

export type AccountWriteBody = {
  code?: unknown;
  name?: unknown;
  type?: unknown;
  currency?: unknown;
  memo?: unknown;
};

export type ListAccountsQuery = {
  status?: unknown;
  type?: unknown;
  currency?: unknown;
  keyword?: unknown;
  limit?: unknown;
};

export type ListAccountTransactionsQuery = {
  accountId?: unknown;
  direction?: unknown;
  status?: unknown;
  sourceType?: unknown;
  incomeRecordId?: unknown;
  expenseRecordId?: unknown;
  keyword?: unknown;
  limit?: unknown;
};

export type ManualAccountTransactionBody = {
  accountId?: unknown;
  direction?: unknown;
  transactionDate?: unknown;
  title?: unknown;
  currency?: unknown;
  amountJpy?: unknown;
  amountCny?: unknown;
  sourceType?: unknown;
  sourceId?: unknown;
  idempotencyKey?: unknown;
  externalEventId?: unknown;
  memo?: unknown;
};

export type CreateAccountTransactionFromIncomeBody = {
  accountId?: unknown;
  transactionDate?: unknown;
  memo?: unknown;
};

export type CreateAccountTransactionFromExpenseBody =
  CreateAccountTransactionFromIncomeBody;

export type NormalizedAccountInput = {
  code: string;
  name: string;
  type: AccountType;
  currency: CurrencyCode;
  memo: string | null;
};

export type AccountSnapshot = {
  id: string;
  code: string;
  name: string;
  type: AccountType;
  currency: CurrencyCode;
  status: RecordStatus;
  memo: string | null;
};

export type NormalizedManualAccountTransactionInput = {
  accountId: string;
  direction: AccountTransactionDirection;
  transactionDate: Date;
  title: string;
  currency: CurrencyCode;
  amountJpy: number | null;
  amountCny: number | null;
  sourceType: string;
  sourceId: string | null;
  idempotencyKey: string | null;
  externalEventId: string | null;
  memo: string | null;
};

export type AccountTransactionSnapshot = {
  id: string;
  accountId: string;
  direction: AccountTransactionDirection;
  sourceType: string;
  sourceId: string | null;
  incomeRecordId: string | null;
  expenseRecordId: string | null;
  transactionDate: Date;
  title: string;
  currency: CurrencyCode;
  amountJpy: number | null;
  amountCny: unknown;
  status: AccountTransactionStatus;
  idempotencyKey: string | null;
  externalEventId: string | null;
  memo: string | null;
};
