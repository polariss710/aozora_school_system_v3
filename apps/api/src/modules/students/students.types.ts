import { RecordStatus } from "@prisma/client";

export type StudentWriteBody = {
  code?: unknown;
  name?: unknown;
  kanaName?: unknown;
  primaryBusinessEntityId?: unknown;
  memo?: unknown;
};

export type ListStudentsQuery = {
  status?: unknown;
  keyword?: unknown;
  primaryBusinessEntityId?: unknown;
  limit?: unknown;
};

export type NormalizedStudentInput = {
  code: string | null;
  name: string;
  kanaName: string | null;
  primaryBusinessEntityId: string | null;
  memo: string | null;
};

export type StudentSnapshot = {
  id: string;
  code: string | null;
  name: string;
  kanaName: string | null;
  status: RecordStatus;
  primaryBusinessEntityId: string | null;
  primaryBusinessEntity: {
    id: string;
    code: string;
    name: string;
  } | null;
  memo: string | null;
};
