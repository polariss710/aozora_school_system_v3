import { RecordStatus } from "@prisma/client";

export type ExternalWorkplaceWriteBody = {
  code?: unknown;
  name?: unknown;
  memo?: unknown;
};

export type ListExternalWorkplacesQuery = {
  status?: unknown;
  keyword?: unknown;
  limit?: unknown;
};

export type NormalizedExternalWorkplaceInput = {
  code: string;
  name: string;
  memo: string | null;
};

export type ExternalWorkplaceSnapshot = {
  id: string;
  code: string;
  name: string;
  status: RecordStatus;
  memo: string | null;
};
