import { UserStatus } from "@prisma/client";

export type UserWriteBody = {
  email?: unknown;
  displayName?: unknown;
  password?: unknown;
  roleCodes?: unknown;
  memo?: unknown;
};

export type UserPasswordBody = {
  password?: unknown;
};

export type ListUsersQuery = {
  status?: unknown;
  keyword?: unknown;
  limit?: unknown;
};

export type NormalizedUserInput = {
  email: string;
  displayName: string;
  password: string | null;
  roleCodes: string[];
  memo: string | null;
};

export type UserSnapshot = {
  id: string;
  email: string;
  displayName: string;
  status: UserStatus;
  memo: string | null;
  roleCodes: string[];
};
