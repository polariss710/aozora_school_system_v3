import { RecordStatus } from "@prisma/client";

export type TeacherWriteBody = {
  code?: unknown;
  name?: unknown;
  kanaName?: unknown;
  memo?: unknown;
};

export type ListTeachersQuery = {
  status?: unknown;
  keyword?: unknown;
  limit?: unknown;
};

export type NormalizedTeacherInput = {
  code: string | null;
  name: string;
  kanaName: string | null;
  memo: string | null;
};

export type TeacherSnapshot = {
  id: string;
  code: string | null;
  name: string;
  kanaName: string | null;
  status: RecordStatus;
  memo: string | null;
};
