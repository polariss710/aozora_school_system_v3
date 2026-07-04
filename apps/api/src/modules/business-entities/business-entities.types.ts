import { RecordStatus } from "@prisma/client";

export type BusinessEntityWriteBody = {
  code?: unknown;
  name?: unknown;
  memo?: unknown;
};

export type ListBusinessEntitiesQuery = {
  status?: unknown;
  keyword?: unknown;
  limit?: unknown;
};

export type NormalizedBusinessEntityInput = {
  code: string;
  name: string;
  memo: string | null;
};

export type BusinessEntitySnapshot = {
  id: string;
  code: string;
  name: string;
  status: RecordStatus;
  memo: string | null;
};
