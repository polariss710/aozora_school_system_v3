import { AccountType, CurrencyCode, RecordStatus } from "@prisma/client";

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
