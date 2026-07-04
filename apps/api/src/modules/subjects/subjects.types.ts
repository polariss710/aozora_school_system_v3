import { RecordStatus } from "@prisma/client";

export type SubjectWriteBody = {
  code?: unknown;
  name?: unknown;
  category?: unknown;
  sortOrder?: unknown;
  memo?: unknown;
};

export type ListSubjectsQuery = {
  status?: unknown;
  keyword?: unknown;
  limit?: unknown;
};

export type NormalizedSubjectInput = {
  code: string;
  name: string;
  category: string | null;
  sortOrder: number;
  memo: string | null;
};

export type SubjectSnapshot = {
  id: string;
  code: string;
  name: string;
  category: string | null;
  sortOrder: number;
  status: RecordStatus;
  memo: string | null;
};
